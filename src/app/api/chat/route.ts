import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { handleChatMessage } from "@/lib/ai/chat-handler";
import { buildContext, type ContextResult } from "@/lib/ai/context-engine";
import { buildSystemPrompt } from "@/lib/ai/prompts/system-prompt";
import { prisma } from "@/lib/db/prisma";
import { MonthlyTokenLimitError } from "@/lib/ai/usage-limits";
import { createFollowUp } from "@/lib/services/intelligence/follow-ups";
import { extractMemories } from "@/lib/services/intelligence/memory-extraction";
import { events, trackEvent } from "@/lib/analytics/events";
import { z } from "zod";

const chatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  useSecondBrain: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { conversationId, message, useSecondBrain } = chatSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: auth.user.userId },
    });

    if (!user) {
      return errorResponse("USER_NOT_FOUND", "User not found", 404);
    }

    let conversation;
    let conversationHistory: any[] = [];

    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return errorResponse("NOT_FOUND", "Conversation not found", 404);
      }

      conversationHistory = conversation.messages as any[];
      if (shouldExtractMemories(conversation.updatedAt)) {
        try {
          await extractMemories(conversation.id);
        } catch (error) {
          console.error("Memory extraction failed", error);
        }
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          companyId: auth.user.companyId,
          userId: auth.user.userId,
          title: message.substring(0, 50),
          messages: [],
          useSecondBrain,
        },
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: auth.user.companyId },
    });

    if (!company) {
      return errorResponse("COMPANY_NOT_FOUND", "Company not found", 404);
    }

    if (conversationHistory.length > 0) {
      const lastAssistant = getLastAssistantMessage(conversationHistory);
      if (
        lastAssistant &&
        isFollowUpPrompt(lastAssistant.content) &&
        isAffirmativeResponse(message)
      ) {
        const scheduledFor = parseFollowUpSchedule(message) ?? addDays(new Date(), 7);
        const title = conversation.title || "Follow-up";
        await createFollowUp({
          userId: auth.user.userId,
          companyId: auth.user.companyId,
          conversationId: conversation.id,
          title,
          content: lastAssistant.content,
          scheduledFor,
        });
      }
    }

    const systemPrompt = buildSystemPrompt(user);
    const context = useSecondBrain
      ? await buildContext(message, auth.user.userId)
      : null;
    const contextMessage = context ? formatContextForChat(context) : "";

    const chatResponse = await handleChatMessage({
      message,
      conversationHistory,
      useSecondBrain,
      companyId: auth.user.companyId,
      companyName: company.name,
      userName: user.name,
      userId: auth.user.userId,
      systemPrompt,
      contextMessage,
    });

    const updatedMessages = [
      ...conversationHistory,
      {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: chatResponse.response,
        timestamp: new Date().toISOString(),
        sources: chatResponse.sources,
      },
    ];

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messages: updatedMessages,
        updatedAt: new Date(),
      },
    });

    trackEvent(events.CHAT_MESSAGE_SENT, {
      userId: auth.user.userId,
      companyId: auth.user.companyId,
      conversationId: conversation.id,
      messageLength: message.length,
    });

    const assistantName = user.nickname?.trim() || "Northstar";
    return successResponse({
      conversationId: conversation.id,
      ...chatResponse,
      assistantName,
      userName: user.name,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("VALIDATION_ERROR", error.errors[0].message, 400);
    }
    if (error instanceof MonthlyTokenLimitError) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse("CHAT_ERROR", "Failed to process chat message", 500);
  }
}

function formatContextForChat(context: ContextResult): string {
  const sections: string[] = [];

  if (context.documents.length > 0) {
    sections.push(
      `DOCUMENTS:\n${context.documents
        .map((doc) => `- ${doc.title}: ${truncateText(doc.content, 400)}`)
        .join("\n")}`
    );
  }

  if (context.conversations.length > 0) {
    sections.push(
      `PAST CONVERSATIONS:\n${context.conversations
        .map((conversation) => {
          const title = conversation.title || "Untitled conversation";
          return `- ${title} (${conversation.updatedAt.toISOString()})`;
        })
        .join("\n")}`
    );
  }

  if (context.emails.length > 0) {
    sections.push(
      `RELATED EMAILS:\n${context.emails
        .map((email) => `- ${email.subject}: ${truncateText(email.body, 300)}`)
        .join("\n")}`
    );
  }

  if (context.contacts.length > 0) {
    sections.push(
      `RELATED CONTACTS:\n${context.contacts
        .map((contact) => `- ${contact.name} (${contact.email})`)
        .join("\n")}`
    );
  }

  if (context.calendar.length > 0) {
    sections.push(
      `UPCOMING/RECENT MEETINGS:\n${context.calendar
        .map((event) => `- ${event.title} (${event.startTime.toISOString()})`)
        .join("\n")}`
    );
  }

  if (context.memories.length > 0) {
    sections.push(
      `MEMORIES:\n${context.memories
        .map((memory) => `- ${memory.title}: ${truncateText(memory.content, 300)}`)
        .join("\n")}`
    );
  }

  return sections.length > 0 ? sections.join("\n\n") : "";
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function shouldExtractMemories(updatedAt: Date) {
  const now = Date.now();
  const lastUpdated = updatedAt.getTime();
  return now - lastUpdated >= 10 * 60 * 1000;
}

function getLastAssistantMessage(
  history: Array<{ role: string; content: string }>
) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "assistant") {
      return history[i];
    }
  }
  return null;
}

function isFollowUpPrompt(message: string) {
  const normalized = message.toLowerCase();
  if (!normalized.includes("?")) {
    return false;
  }
  return /check in|follow up|follow-up|remind|circle back/.test(normalized);
}

function isAffirmativeResponse(message: string) {
  const normalized = message.trim().toLowerCase();
  return /^(yes|yeah|yep|sure|okay|ok|please|sounds good|do it|go ahead)\b/.test(
    normalized
  );
}

function parseFollowUpSchedule(message: string): Date | null {
  const normalized = message.toLowerCase();
  const now = new Date();

  if (normalized.includes("tomorrow")) {
    return addDays(now, 1);
  }

  if (normalized.includes("next week")) {
    return addDays(now, 7);
  }

  if (normalized.includes("next month")) {
    return addDays(now, 30);
  }

  const durationMatch = normalized.match(/in (\d+)\s*(day|days|week|weeks|month|months)/);
  if (durationMatch) {
    const amount = Number(durationMatch[1]);
    const unit = durationMatch[2];
    if (!Number.isNaN(amount)) {
      if (unit.startsWith("day")) {
        return addDays(now, amount);
      }
      if (unit.startsWith("week")) {
        return addDays(now, amount * 7);
      }
      if (unit.startsWith("month")) {
        return addDays(now, amount * 30);
      }
    }
  }

  const weekdayMatch = normalized.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
  );
  if (weekdayMatch) {
    return nextWeekday(now, weekdayMatch[1]);
  }

  return null;
}

function nextWeekday(from: Date, weekday: string) {
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const target = weekdays.indexOf(weekday);
  if (target === -1) return null;
  const current = from.getDay();
  let delta = (target - current + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }
  return addDays(from, delta);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
