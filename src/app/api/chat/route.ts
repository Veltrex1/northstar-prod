import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { handleChatMessage } from "@/lib/ai/chat-handler";
import { prisma } from "@/lib/db/prisma";
import { MonthlyTokenLimitError } from "@/lib/ai/usage-limits";
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

    const chatResponse = await handleChatMessage({
      message,
      conversationHistory,
      useSecondBrain,
      companyId: auth.user.companyId,
      companyName: company.name,
      userName: auth.user.name,
      userId: auth.user.userId,
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

    return successResponse({
      conversationId: conversation.id,
      ...chatResponse,
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
