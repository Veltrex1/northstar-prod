import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { errorResponse } from "@/lib/utils/api-response";
import { streamChatCompletion } from "@/lib/ai/claude-client";
import { retrieveKnowledge } from "@/lib/ai/knowledge-retrieval";
import {
  buildSystemPrompt,
  buildKnowledgeContext,
} from "@/lib/ai/prompts/chat";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const { conversationId, message, useSecondBrain } = await request.json();

    let conversationHistory: any[] = [];
    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      conversationHistory = (conversation?.messages as any[]) || [];
    }

    const company = await prisma.company.findUnique({
      where: { id: auth.user.companyId },
    });

    if (!company) {
      return errorResponse("COMPANY_NOT_FOUND", "Company not found", 404);
    }

    let knowledgeContext = "";
    if (useSecondBrain) {
      const knowledge = await retrieveKnowledge(message, auth.user.companyId);
      if (knowledge.results.length > 0) {
        knowledgeContext = buildKnowledgeContext(knowledge.results);
      }
    }

    const systemPrompt = buildSystemPrompt(company.name, auth.user.name);
    const messages = [
      ...conversationHistory,
      {
        role: "user" as const,
        content: knowledgeContext
          ? `${knowledgeContext}\n\nUser's question: ${message}`
          : message,
      },
    ];

    const stream = await streamChatCompletion(messages, systemPrompt);
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta") {
            const delta = chunk.delta;
            if (delta.type === "text_delta") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`)
              );
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return errorResponse("STREAM_ERROR", "Failed to stream response", 500);
  }
}
