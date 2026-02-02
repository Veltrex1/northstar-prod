import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function chatCompletion(
  messages: Anthropic.MessageParam[],
  systemPrompt?: string,
  maxTokens: number = 4096
): Promise<string> {
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0];
  if (content.type === "text") {
    return content.text;
  }

  throw new Error("Unexpected response type");
}

export async function streamChatCompletion(
  messages: Anthropic.MessageParam[],
  systemPrompt?: string
) {
  return claude.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });
}
