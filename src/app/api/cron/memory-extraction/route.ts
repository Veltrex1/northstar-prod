import { prisma } from '@/lib/db/prisma';
import { extractMemories } from '@/lib/services/intelligence/memory-extraction';

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const conversations = await prisma.conversation.findMany({
      where: {
        updatedAt: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true },
    });

    const existing = await prisma.conversationMemory.findMany({
      where: {
        conversationId: { in: conversations.map((conv) => conv.id) },
        createdAt: { gte: dayStart },
      },
      select: { conversationId: true },
    });

    const processed = new Set(existing.map((memory) => memory.conversationId));
    let extracted = 0;
    let skipped = 0;

    for (const conversation of conversations) {
      if (processed.has(conversation.id)) {
        skipped += 1;
        continue;
      }
      try {
        const memories = await extractMemories(conversation.id);
        if (memories.length > 0) {
          extracted += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        console.error(`Failed to extract memories for ${conversation.id}:`, error);
      }
    }

    console.log('Memory extraction cron complete', { extracted, skipped });
    return Response.json({ extracted, skipped });
  } catch (error) {
    console.error('Memory extraction cron error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
