import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const PRIMARY_MODEL = "claude-sonnet-4-20250514";
const FALLBACK_MODEL = "claude-3-5-haiku-20241022";

export class RateLimitError extends Error {
  status: number;
  code: string;
  constructor(message: string) {
    super(message);
    this.status = 429;
    this.code = "RATE_LIMIT";
  }
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "status" in error && (error as { status?: number }).status === 429;
}

export interface ClaudeResponse {
  text: string;
  outputTokens: number;
}

export async function chatCompletion(
  messages: Anthropic.MessageParam[],
  systemPrompt?: string,
  maxTokens: number = 4096
): Promise<ClaudeResponse> {
  let response: Anthropic.Messages.Message;
  try {
    response = await claude.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });
  } catch (error) {
    if (!isRateLimitError(error)) {
      throw error;
    }

    try {
      response = await claude.messages.create({
        model: FALLBACK_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      });
    } catch (fallbackError) {
      if (isRateLimitError(fallbackError)) {
        throw new RateLimitError(
          "Rate limit reached. Please try again in a few minutes."
        );
      }
      throw fallbackError;
    }
  }

  const content = response.content[0];
  if (content.type === "text") {
    return {
      text: content.text,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }

  throw new Error("Unexpected response type");
}

export async function streamChatCompletion(
  messages: Anthropic.MessageParam[],
  systemPrompt?: string
) {
  return claude.messages.stream({
    model: PRIMARY_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });
}
