import { chatCompletion } from '@/lib/ai/claude-client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

type ExtractedMemory = {
  type: 'GOAL' | 'DECISION' | 'CHALLENGE' | 'PATTERN' | 'RELATIONSHIP' | 'PREFERENCE';
  title: string;
  content: string;
};

const MAX_TOKENS = 2048;

export async function extractMemories(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];

  if (messages.length === 0) {
    return [];
  }

  const conversationText = messages
    .map((message) => {
      const role = message.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}: ${message.content}`;
    })
    .join('\n');

  const userPrompt = `Analyze this conversation and extract memorable items:
${conversationText}

Identify and extract:

Goals: Things the user wants to achieve
Decisions: Choices they made
Challenges: Problems they're facing repeatedly
Patterns: Behaviors or tendencies they exhibit
Relationships: Important people mentioned
Preferences: Their likes/dislikes

Return as JSON array:
[
{
"type": "GOAL",
"title": "Brief title",
"content": "Full description"
},
...
]`;

  const response = await chatCompletion(
    [{ role: 'user', content: userPrompt }],
    'Return ONLY valid JSON.',
    MAX_TOKENS
  );

  const extracted = parseMemoryResponse(response.text);
  if (extracted.length === 0) {
    return [];
  }

  const existing = await prisma.conversationMemory.findMany({
    where: { conversationId },
    select: { type: true, title: true, content: true },
  });

  const existingKeys = new Set(
    existing.map((memory) => `${memory.type}:${memory.title}:${memory.content}`)
  );

  const created: typeof existing = [];

  for (const memory of extracted) {
    const key = `${memory.type}:${memory.title}:${memory.content}`;
    if (existingKeys.has(key)) {
      continue;
    }

    try {
      const record = await prisma.conversationMemory.create({
        data: {
          userId: conversation.userId,
          companyId: conversation.companyId,
          conversationId: conversation.id,
          type: memory.type,
          title: memory.title,
          content: memory.content,
        },
      });
      existingKeys.add(key);
      created.push(record);
    } catch (error) {
      logger.error('Failed to create conversation memory', { error, memory });
    }
  }

  return created;
}

function parseMemoryResponse(responseText: string): ExtractedMemory[] {
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        type: String(item.type || '').toUpperCase(),
        title: String(item.title || '').trim(),
        content: String(item.content || '').trim(),
      }))
      .filter(
        (item): item is ExtractedMemory =>
          ['GOAL', 'DECISION', 'CHALLENGE', 'PATTERN', 'RELATIONSHIP', 'PREFERENCE'].includes(
            item.type
          ) &&
          item.title.length > 0 &&
          item.content.length > 0
      );
  } catch (error) {
    logger.error('Failed to parse memory extraction response', { error });
    return [];
  }
}
