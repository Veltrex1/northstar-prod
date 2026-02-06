import type {
  CalendarEvent,
  Contact,
  Conversation,
  ConversationMemory,
  Document,
  Email,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { vectorSearch } from './vector-search';

export type ContextBuildOptions = {
  includeEmails?: boolean;
  includeDocuments?: boolean;
  includeContacts?: boolean;
  includeCalendar?: boolean;
  includeMemories?: boolean;
};

export type ContextResult = {
  conversations: Conversation[];
  documents: Document[];
  emails: Email[];
  contacts: Contact[];
  calendar: CalendarEvent[];
  memories: ConversationMemory[];
};

const DEFAULT_LIMIT = 5;

export async function buildContext(
  query: string,
  userId: string,
  options: ContextBuildOptions = {}
): Promise<ContextResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const includeEmails = options.includeEmails ?? true;
    const includeDocuments = options.includeDocuments ?? true;
    const includeContacts = options.includeContacts ?? true;
    const includeCalendar = options.includeCalendar ?? true;
    const includeMemories = options.includeMemories ?? true;

    const [
      conversations,
      documents,
      emails,
      contacts,
      calendar,
      memories,
    ] = await Promise.all([
      searchPastConversations(query, userId, DEFAULT_LIMIT),
      includeDocuments
        ? searchDocuments(query, user.companyId, DEFAULT_LIMIT)
        : Promise.resolve([]),
      includeEmails ? searchEmails(query, userId, DEFAULT_LIMIT) : Promise.resolve([]),
      includeContacts ? searchContacts(query, userId, DEFAULT_LIMIT) : Promise.resolve([]),
      includeCalendar
        ? getRelevantMeetings(query, userId, DEFAULT_LIMIT)
        : Promise.resolve([]),
      includeMemories ? searchMemories(query, userId, DEFAULT_LIMIT) : Promise.resolve([]),
    ]);

    return {
      conversations,
      documents,
      emails,
      contacts,
      calendar,
      memories,
    };
  } catch (error) {
    logger.error('Context build error', error);
    return {
      conversations: [],
      documents: [],
      emails: [],
      contacts: [],
      calendar: [],
      memories: [],
    };
  }
}

export async function searchPastConversations(
  query: string,
  userId: string,
  limit: number = DEFAULT_LIMIT
): Promise<Conversation[]> {
  try {
    return await prisma.conversation.findMany({
      where: {
        userId,
        OR: [
          { messages: { string_contains: query } },
          { title: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    logger.error('Conversation search error', error);
    return [];
  }
}

export async function searchEmails(
  query: string,
  userId: string,
  limit: number = DEFAULT_LIMIT
): Promise<Email[]> {
  try {
    return await prisma.email.findMany({
      where: {
        userId,
        OR: [
          { subject: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    logger.error('Email search error', error);
    return [];
  }
}

export async function searchContacts(
  query: string,
  userId: string,
  limit: number = DEFAULT_LIMIT
): Promise<Contact[]> {
  try {
    return await prisma.contact.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { company: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    logger.error('Contact search error', error);
    return [];
  }
}

export async function getRelevantMeetings(
  query: string,
  userId: string,
  limit: number = DEFAULT_LIMIT
): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const pastWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const futureWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return await prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { gte: pastWindow, lte: futureWindow },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
  } catch (error) {
    logger.error('Calendar search error', error);
    return [];
  }
}

export async function searchMemories(
  query: string,
  userId: string,
  limit: number = DEFAULT_LIMIT
): Promise<ConversationMemory[]> {
  try {
    return await prisma.conversationMemory.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { lastAccessed: 'desc' },
      take: limit,
    });
  } catch (error) {
    logger.error('Memory search error', error);
    return [];
  }
}

async function searchDocuments(
  query: string,
  companyId: string,
  limit: number = DEFAULT_LIMIT
): Promise<Document[]> {
  try {
    const vectorResults = await vectorSearch(query, companyId, limit);
    const documentIds = vectorResults.map((result) => result.metadata.documentId);

    if (documentIds.length === 0) {
      return [];
    }

    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        companyId,
        isExcluded: false,
      },
    });

    const documentsById = new Map(documents.map((doc) => [doc.id, doc]));
    return documentIds.map((id) => documentsById.get(id)).filter(Boolean) as Document[];
  } catch (error) {
    logger.error('Document search error', error);
    return [];
  }
}
