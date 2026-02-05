import { chatCompletion } from "./claude-client";
import { retrieveKnowledge, detectConflicts } from "./knowledge-retrieval";
import {
  buildSystemPrompt,
  buildKnowledgeContext,
  buildClarificationPrompt,
} from "./prompts/chat";
import { logger } from "@/lib/utils/logger";
import {
  assertWithinMonthlyOutputTokenCap,
  recordOutputTokens,
} from "@/lib/ai/usage-limits";

export interface ChatRequest {
  message: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  useSecondBrain: boolean;
  companyId: string;
  companyName: string;
  userName: string;
  userId: string;
}

export interface ChatResponse {
  response: string;
  sources: Array<{
    documentId: string;
    title: string;
    url?: string;
    excerpt: string;
  }>;
  needsClarification: boolean;
  clarificationOptions?: Array<{
    id: string;
    label: string;
    sourceId: string;
  }>;
  thinkingProcess?: string;
  suggestedQueries?: string[];
}

export async function handleChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  try {
    logger.info("Processing chat message", { message: request.message });

    let knowledgeContext = "";
    let sources: ChatResponse["sources"] = [];
    let needsClarification = false;
    let clarificationOptions: ChatResponse["clarificationOptions"];

    if (request.useSecondBrain) {
      const conflictCheck = await detectConflicts(
        request.message,
        request.companyId
      );

      if (conflictCheck.hasConflict && conflictCheck.conflictingResults) {
        needsClarification = true;
        clarificationOptions = conflictCheck.conflictingResults.map(
          (result, index) => ({
            id: `option_${index}`,
            label: `${result.title}: ${result.content.substring(0, 100)}...`,
            sourceId: result.documentId,
          })
        );

        const clarificationPrompt = buildClarificationPrompt(
          conflictCheck.conflictingResults
        );

        return {
          response: clarificationPrompt,
          sources: [],
          needsClarification: true,
          clarificationOptions,
        };
      }

      const knowledge = await retrieveKnowledge(
        request.message,
        request.companyId
      );

      if (knowledge.results.length > 0) {
        knowledgeContext = buildKnowledgeContext(knowledge.results);
        sources = knowledge.results.map((result) => ({
          documentId: result.documentId,
          title: result.title,
          url: result.sourceUrl,
          excerpt: result.content.substring(0, 200),
        }));
      }
    }

    const systemPrompt = buildSystemPrompt(request.companyName, request.userName);
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...(request.conversationHistory || []),
    ];

    const userMessage =
      request.useSecondBrain && knowledgeContext
        ? `${knowledgeContext}\n\nUser's question: ${request.message}`
        : request.message;

    messages.push({
      role: "user",
      content: userMessage,
    });

    await assertWithinMonthlyOutputTokenCap(request.userId, 4096);
    const response = await chatCompletion(messages, systemPrompt);
    await recordOutputTokens(request.userId, response.outputTokens);
    const suggestedQueries = generateSuggestedQueries(request.message);

    return {
      response: response.text,
      sources,
      needsClarification: false,
      thinkingProcess: request.useSecondBrain
        ? `Searched ${sources.length} documents from your knowledge base`
        : undefined,
      suggestedQueries,
    };
  } catch (error) {
    logger.error("Chat handler error", error);
    throw error;
  }
}

function generateSuggestedQueries(originalQuery: string): string[] {
  const suggestions: string[] = [];
  const loweredQuery = originalQuery.toLowerCase();

  if (loweredQuery.includes("revenue")) {
    suggestions.push("What was our profit margin last quarter?");
    suggestions.push("Show me year-over-year revenue growth");
  }

  if (loweredQuery.includes("team") || loweredQuery.includes("employee")) {
    suggestions.push("What is our current headcount?");
    suggestions.push("What are our hiring plans?");
  }

  return suggestions.slice(0, 3);
}
