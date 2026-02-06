import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

type CreateFollowUpParams = {
  userId: string;
  companyId: string;
  conversationId: string;
  title: string;
  content: string;
  scheduledFor: Date;
};

export async function createFollowUp(params: CreateFollowUpParams) {
  return prisma.followUp.create({
    data: {
      userId: params.userId,
      companyId: params.companyId,
      conversationId: params.conversationId,
      title: params.title,
      content: params.content,
      scheduledFor: params.scheduledFor,
    },
  });
}

export async function executeFollowUps() {
  const now = new Date();
  const followUps = await prisma.followUp.findMany({
    where: {
      completed: false,
      scheduledFor: { lte: now },
    },
    include: {
      conversation: {
        select: { id: true, messages: true },
      },
    },
  });

  let executed = 0;

  for (const followUp of followUps) {
    const conversation = followUp.conversation;
    if (!conversation) {
      logger.warn('Follow-up missing conversation', { followUpId: followUp.id });
      continue;
    }

    const messageContent = `Following up on: ${followUp.title}. ${followUp.content}`;
    const messages = Array.isArray(conversation.messages)
      ? conversation.messages
      : [];
    const updatedMessages = [
      ...messages,
      {
        role: 'assistant',
        content: messageContent,
        timestamp: new Date().toISOString(),
        followUpId: followUp.id,
      },
    ];

    try {
      await prisma.$transaction([
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { messages: updatedMessages, updatedAt: new Date() },
        }),
        prisma.followUp.update({
          where: { id: followUp.id },
          data: { completed: true, completedAt: new Date() },
        }),
      ]);
      executed += 1;
    } catch (error) {
      logger.error('Failed to execute follow-up', {
        followUpId: followUp.id,
        error,
      });
    }
  }

  return executed;
}
