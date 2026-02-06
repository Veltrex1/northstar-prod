import { prisma } from '@/lib/db/prisma';
import { retrieveKnowledge } from '@/lib/ai/knowledge-retrieval';
import { chatCompletion } from '@/lib/ai/claude-client';
import {
  assertWithinMonthlyOutputTokenCap,
  recordOutputTokens,
} from '@/lib/ai/usage-limits';
import { logger } from '@/lib/utils/logger';

const MAX_INTERACTIONS = 5;
const MAX_EMAILS = 5;
const MAX_DOCS_PER_QUERY = 4;
const CLAUDE_MAX_TOKENS = 2048;

type AttendeeContext = {
  email: string;
  name: string;
  title?: string | null;
  company?: string | null;
  lastContactAt?: Date | null;
  interactionCount: number;
  emailSummary: string;
};

type BriefPayload = {
  attendeeContext: Record<string, string>;
  talkingPoints: string[];
  questions: string[];
  relevantData: string[];
};

export async function generateMeetingBrief(eventId: string) {
  try {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Calendar event not found');
    }

    const user = await prisma.user.findUnique({
      where: { id: event.userId },
      select: { id: true, name: true, personalityProfile: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const attendeeEmails = (event.attendees || [])
      .map((email) => email.toLowerCase())
      .filter(Boolean);

    const attendeeContexts = await Promise.all(
      attendeeEmails.map((email) =>
        buildAttendeeContext({
          email,
          userId: user.id,
          companyId: event.companyId,
        })
      )
    );

    const knowledgeDocuments = await gatherRelevantDocuments({
      companyId: event.companyId,
      eventTitle: event.title,
      eventDescription: event.description || '',
      attendees: attendeeContexts,
    });

    const { systemPrompt, userPrompt } = buildClaudePrompt({
      event,
      user,
      attendeeContexts,
      knowledgeDocuments,
    });

    await assertWithinMonthlyOutputTokenCap(user.id, CLAUDE_MAX_TOKENS);
    const response = await chatCompletion(
      [{ role: 'user', content: userPrompt }],
      systemPrompt,
      CLAUDE_MAX_TOKENS
    );
    await recordOutputTokens(user.id, response.outputTokens);

    const parsedBrief = parseBriefResponse(response.text);

    const brief = await prisma.meetingBrief.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        content: response.text,
        attendeeContext: parsedBrief.attendeeContext,
        talkingPoints: parsedBrief.talkingPoints,
        questions: parsedBrief.questions,
        relevantDocs: knowledgeDocuments,
        generatedAt: new Date(),
      },
      update: {
        content: response.text,
        attendeeContext: parsedBrief.attendeeContext,
        talkingPoints: parsedBrief.talkingPoints,
        questions: parsedBrief.questions,
        relevantDocs: knowledgeDocuments,
        generatedAt: new Date(),
      },
    });

    return brief;
  } catch (error) {
    logger.error('Meeting brief generation error', error);
    throw error;
  }
}

async function buildAttendeeContext(input: {
  email: string;
  userId: string;
  companyId: string;
}): Promise<AttendeeContext> {
  const contact = await prisma.contact.upsert({
    where: {
      userId_email: {
        userId: input.userId,
        email: input.email,
      },
    },
    create: {
      userId: input.userId,
      companyId: input.companyId,
      email: input.email,
      name: input.email,
      company: inferCompanyFromEmail(input.email),
      category: 'OTHER',
    },
    update: {},
  });

  const [interactions, emails] = await Promise.all([
    prisma.contactInteraction.findMany({
      where: { contactId: contact.id },
      orderBy: { timestamp: 'desc' },
      take: MAX_INTERACTIONS,
    }),
    prisma.email.findMany({
      where: {
        userId: input.userId,
        OR: [
          { from: input.email },
          { to: { has: input.email } },
          { cc: { has: input.email } },
        ],
      },
      orderBy: { receivedAt: 'desc' },
      take: MAX_EMAILS,
    }),
  ]);

  const lastInteraction =
    interactions[0]?.timestamp ||
    emails[0]?.receivedAt ||
    contact.lastContactAt ||
    null;

  return {
    email: contact.email,
    name: contact.name,
    title: contact.title,
    company: contact.company,
    lastContactAt: lastInteraction,
    interactionCount: interactions.length,
    emailSummary: summarizeEmails(emails),
  };
}

async function gatherRelevantDocuments(input: {
  companyId: string;
  eventTitle: string;
  eventDescription: string;
  attendees: AttendeeContext[];
}) {
  const queries = new Set<string>();
  if (input.eventTitle) {
    queries.add(input.eventTitle);
  }
  if (input.eventDescription) {
    queries.add(input.eventDescription);
  }
  for (const attendee of input.attendees) {
    if (attendee.company) {
      queries.add(attendee.company);
    }
  }

  const results = await Promise.all(
    Array.from(queries).map((query) =>
      retrieveKnowledge(query, input.companyId, MAX_DOCS_PER_QUERY)
    )
  );

  const documentsById = new Map<
    string,
    {
      documentId: string;
      title: string;
      content: string;
      relevanceScore: number;
      dataType: string;
      sourceUrl?: string;
      authorityWeight: number;
    }
  >();

  for (const result of results) {
    for (const doc of result.results) {
      const existing = documentsById.get(doc.documentId);
      if (!existing || doc.relevanceScore > existing.relevanceScore) {
        documentsById.set(doc.documentId, doc);
      }
    }
  }

  return Array.from(documentsById.values()).slice(0, 12);
}

function buildClaudePrompt(input: {
  event: {
    title: string;
    description: string | null;
    startTime: Date;
    endTime: Date;
    attendees: string[];
  };
  user: { name: string; personalityProfile: unknown };
  attendeeContexts: AttendeeContext[];
  knowledgeDocuments: Array<{
    title: string;
    content: string;
    sourceUrl?: string;
  }>;
}) {
  const duration = formatDuration(input.event.startTime, input.event.endTime);
  const attendeeList = input.attendeeContexts
    .map((attendee) => attendee.email)
    .join(', ');

  const attendeeContextBlocks = input.attendeeContexts
    .map((attendee) => {
      return `${attendee.name} (${attendee.title || 'Unknown title'} at ${
        attendee.company || 'Unknown company'
      })

Last interaction: ${attendee.lastContactAt?.toISOString() || 'None'}
Past interactions: ${attendee.interactionCount}
Recent emails: ${attendee.emailSummary}`;
    })
    .join('\n\n');

  const documents = input.knowledgeDocuments.length
    ? input.knowledgeDocuments
        .map((doc) => {
          const snippet = truncateText(doc.content, 300);
          return `- ${doc.title}${doc.sourceUrl ? ` (${doc.sourceUrl})` : ''}: ${snippet}`;
        })
        .join('\n')
    : 'No relevant documents found.';

  const systemPrompt = `You are a senior executive assistant. Use the user's personality profile to tailor tone and priorities.
Personality profile: ${JSON.stringify(input.user.personalityProfile ?? {}, null, 2)}

Return ONLY valid JSON.`;

  const userPrompt = `Generate a meeting brief for ${input.user.name} for this upcoming meeting:
Title: ${input.event.title}
Time: ${input.event.startTime.toISOString()}
Duration: ${duration}
Attendees: ${attendeeList || 'No attendees listed'}
Context about attendees:
${attendeeContextBlocks || 'No attendee context found.'}

Relevant documents:
${documents}
Generate:

Brief context about each attendee (2-3 sentences each)
3-5 suggested talking points for this meeting
3-5 questions ${input.user.name} should ask
Key data points to reference

Format as JSON:
{
"attendeeContext": {...},
"talkingPoints": [...],
"questions": [...],
"relevantData": [...]
}`;

  return { systemPrompt, userPrompt };
}

function parseBriefResponse(responseText: string): BriefPayload {
  const fallback: BriefPayload = {
    attendeeContext: {},
    talkingPoints: [],
    questions: [],
    relevantData: [],
  };

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<BriefPayload>;
    return {
      attendeeContext: parsed.attendeeContext || {},
      talkingPoints: Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      relevantData: Array.isArray(parsed.relevantData) ? parsed.relevantData : [],
    };
  } catch {
    return fallback;
  }
}

function summarizeEmails(
  emails: Array<{ subject: string; body: string; receivedAt: Date }>
): string {
  if (emails.length === 0) {
    return 'No recent emails.';
  }

  return emails
    .map((email) => {
      const snippet = truncateText(email.body, 180);
      return `${email.receivedAt.toISOString()} • ${email.subject}: ${snippet}`;
    })
    .join(' | ');
}

function formatDuration(startTime: Date, endTime: Date): string {
  const minutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) {
    return `${remaining} minutes`;
  }
  if (remaining === 0) {
    return `${hours} hours`;
  }
  return `${hours} hours ${remaining} minutes`;
}

function inferCompanyFromEmail(email: string): string | null {
  const domain = email.split('@')[1] || '';
  const normalized = domain.toLowerCase();
  const commonDomains = new Set([
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'yahoo.com',
    'icloud.com',
  ]);

  if (!normalized || commonDomains.has(normalized)) {
    return null;
  }

  const company = normalized.split('.')[0];
  return company ? company.charAt(0).toUpperCase() + company.slice(1) : null;
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}
