import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { getGoogleClient } from '@/lib/integrations/oauth/google';
import { logMeetingInteraction } from '@/lib/services/relationships/interaction-log';

const MS_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const MS_CALENDAR_ENDPOINT = '/me/calendar/events';
const DAY_MS = 24 * 60 * 60 * 1000;
const GOOGLE_MAX_RESULTS = 250;
const MICROSOFT_PAGE_SIZE = 50;

type GoogleCredentials = {
  accessToken: string;
  refreshToken?: string;
};

type MicrosoftCredentials = {
  accessToken: string;
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string | null;
  location?: string | null;
  status?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string | null }>;
};

type MicrosoftEvent = {
  id?: string;
  subject?: string | null;
  body?: { contentType?: string; content?: string | null };
  bodyPreview?: string | null;
  location?: { displayName?: string | null };
  start?: { dateTime?: string | null };
  end?: { dateTime?: string | null };
  attendees?: Array<{ emailAddress?: { address?: string | null } }>;
  isCancelled?: boolean | null;
  showAs?: string | null;
};

export async function syncGoogleCalendar(
  userId: string,
  integrationId: string
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true, email: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      companyId: user.companyId,
      status: 'CONNECTED',
    },
  });

  if (!integration || !['GOOGLE_CALENDAR', 'GOOGLE_WORKSPACE'].includes(integration.platform)) {
    throw new Error('Google Calendar integration not found');
  }

  const credentials = JSON.parse(
    decrypt(integration.credentials)
  ) as GoogleCredentials;

  const authClient = getGoogleClient(
    credentials.accessToken,
    credentials.refreshToken
  );
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const { timeMin, timeMax } = getCalendarWindow();

  let pageToken: string | undefined;
  let syncedCount = 0;

  do {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: GOOGLE_MAX_RESULTS,
      pageToken,
    });

    const events = (response.data.items || []) as GoogleEvent[];
    for (const event of events) {
      if (!event.id) {
        continue;
      }

      const startTime = parseGoogleDate(event.start);
      const endTime = parseGoogleDate(event.end);
      if (!startTime || !endTime) {
        continue;
      }

      const attendees = parseAttendees(event);
      const meetingUrl = extractMeetingUrl(event);

      const existingEvent = await prisma.calendarEvent.findUnique({
        where: { eventId: event.id },
        select: { id: true },
      });

      await prisma.calendarEvent.upsert({
        where: { eventId: event.id },
        create: {
          companyId: user.companyId,
          userId: user.id,
          eventId: event.id,
          provider: 'GOOGLE',
          title: event.summary || '(no title)',
          description: event.description || null,
          startTime,
          endTime,
          attendees,
          location: event.location || null,
          meetingUrl,
          status: mapGoogleStatus(event.status),
        },
        update: {
          title: event.summary || '(no title)',
          description: event.description || null,
          startTime,
          endTime,
          attendees,
          location: event.location || null,
          meetingUrl,
          status: mapGoogleStatus(event.status),
        },
      });

      if (existingEvent) {
        await ensureContacts({
          userId: user.id,
          companyId: user.companyId,
          attendeeEmails: attendees,
          meetingDate: startTime,
          excludeEmail: user.email,
        });
      } else {
        await logMeetingInteraction(event.id);
      }

      syncedCount += 1;
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  return syncedCount;
}

export async function syncMicrosoftCalendar(
  userId: string,
  integrationId: string
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true, email: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      companyId: user.companyId,
      status: 'CONNECTED',
    },
  });

  if (
    !integration ||
    !['MICROSOFT_CALENDAR', 'MICROSOFT_365'].includes(integration.platform)
  ) {
    throw new Error('Microsoft Calendar integration not found');
  }

  const credentials = JSON.parse(
    decrypt(integration.credentials)
  ) as MicrosoftCredentials;

  if (!credentials.accessToken) {
    throw new Error('Missing Microsoft access token');
  }

  const client = Client.init({
    authProvider: (done) => {
      done(null, credentials.accessToken);
    },
  });

  const { start, end } = getCalendarWindow();

  let requestUrl = `${MS_GRAPH_BASE_URL}${MS_CALENDAR_ENDPOINT}`;
  let syncedCount = 0;

  while (requestUrl) {
    const response = (await client
      .api(requestUrl)
      .query({
        $top: MICROSOFT_PAGE_SIZE,
        $select:
          'id,subject,body,bodyPreview,location,start,end,attendees,isCancelled,showAs',
        $orderby: 'start/dateTime',
        $filter: `start/dateTime ge '${start.toISOString()}' and start/dateTime le '${end.toISOString()}'`,
      })
      .get()) as { value?: MicrosoftEvent[]; '@odata.nextLink'?: string };

    const events = response.value || [];
    for (const event of events) {
      if (!event.id) {
        continue;
      }

      const startTime = parseMicrosoftDate(event.start?.dateTime);
      const endTime = parseMicrosoftDate(event.end?.dateTime);
      if (!startTime || !endTime) {
        continue;
      }

      if (startTime < start || startTime > end) {
        continue;
      }

      const attendees = parseAttendees(event);
      const meetingUrl = extractMeetingUrl(event);

      const existingEvent = await prisma.calendarEvent.findUnique({
        where: { eventId: event.id },
        select: { id: true },
      });

      await prisma.calendarEvent.upsert({
        where: { eventId: event.id },
        create: {
          companyId: user.companyId,
          userId: user.id,
          eventId: event.id,
          provider: 'MICROSOFT',
          title: event.subject || '(no title)',
          description: extractMicrosoftDescription(event),
          startTime,
          endTime,
          attendees,
          location: event.location?.displayName || null,
          meetingUrl,
          status: mapMicrosoftStatus(event),
        },
        update: {
          title: event.subject || '(no title)',
          description: extractMicrosoftDescription(event),
          startTime,
          endTime,
          attendees,
          location: event.location?.displayName || null,
          meetingUrl,
          status: mapMicrosoftStatus(event),
        },
      });

      if (existingEvent) {
        await ensureContacts({
          userId: user.id,
          companyId: user.companyId,
          attendeeEmails: attendees,
          meetingDate: startTime,
          excludeEmail: user.email,
        });
      } else {
        await logMeetingInteraction(event.id);
      }

      syncedCount += 1;
    }

    requestUrl = response['@odata.nextLink'] || '';
  }

  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  return syncedCount;
}

export function parseAttendees(event: GoogleEvent | MicrosoftEvent): string[] {
  const emails = new Set<string>();

  if ('attendees' in event && event.attendees?.length) {
    for (const attendee of event.attendees) {
      const email =
        'email' in attendee
          ? attendee.email
          : attendee.emailAddress?.address;
      if (email) {
        emails.add(email.toLowerCase());
      }
    }
  }

  return Array.from(emails);
}

export function extractMeetingUrl(event: GoogleEvent | MicrosoftEvent): string | null {
  const description =
    'description' in event ? event.description || '' : extractMicrosoftDescription(event);
  const location =
    'location' in event
      ? event.location || ''
      : event.location?.displayName || '';
  const combined = `${description} ${location}`;

  const match =
    combined.match(
      /((?:https?:\/\/)?(?:[\w.-]+\.)?(?:zoom\.us|meet\.google\.com)\/[^\s<>"']+)/i
    ) || [];

  if (!match[1]) {
    return null;
  }

  return match[1].startsWith('http') ? match[1] : `https://${match[1]}`;
}

function parseGoogleDate(
  date?: { dateTime?: string; date?: string }
): Date | null {
  if (!date) {
    return null;
  }

  if (date.dateTime) {
    const parsed = new Date(date.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (date.date) {
    const parsed = new Date(`${date.date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function parseMicrosoftDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapGoogleStatus(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'cancelled':
      return 'CANCELLED';
    case 'tentative':
      return 'TENTATIVE';
    default:
      return 'CONFIRMED';
  }
}

function mapMicrosoftStatus(event: MicrosoftEvent) {
  if (event.isCancelled) {
    return 'CANCELLED';
  }

  if ((event.showAs || '').toLowerCase() === 'tentative') {
    return 'TENTATIVE';
  }

  return 'CONFIRMED';
}

function extractMicrosoftDescription(event: MicrosoftEvent): string | null {
  const body = event.body?.content || '';
  const preview = event.bodyPreview || '';
  const combined = `${body} ${preview}`.trim();
  return combined || null;
}

function getCalendarWindow() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * DAY_MS);
  const end = new Date(now.getTime() + 90 * DAY_MS);

  return {
    start,
    end,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

async function ensureContacts(input: {
  userId: string;
  companyId: string;
  attendeeEmails: string[];
  meetingDate: Date;
  excludeEmail?: string | null;
}) {
  for (const email of input.attendeeEmails) {
    if (!email || (input.excludeEmail && email === input.excludeEmail.toLowerCase())) {
      continue;
    }

    await prisma.contact.upsert({
      where: {
        userId_email: {
          userId: input.userId,
          email,
        },
      },
      create: {
        userId: input.userId,
        companyId: input.companyId,
        email,
        name: email,
        category: 'OTHER',
        lastContactAt: input.meetingDate,
      },
      update: {
        lastContactAt: input.meetingDate,
      },
    });
  }
}
