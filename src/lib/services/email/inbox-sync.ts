import { google } from 'googleapis';
import { EmailPriority } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { getMicrosoftAccessTokenFromIntegration } from '@/lib/integrations/microsoft/credentials';
import { logEmailInteraction } from '@/lib/services/relationships/interaction-log';

type EmailContext = {
  subject: string;
  fromDomain: string;
  investorDomains: Set<string>;
};

type ParsedAddress = {
  name: string | null;
  email: string | null;
};

type ParsedHeaders = {
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
};

type MicrosoftMessage = {
  id?: string;
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
};

export function classifyEmailPriority(email: EmailContext): EmailPriority {
  const subject = email.subject.toLowerCase();

  if (subject.includes('urgent') || subject.includes('asap') || subject.includes('immediate')) {
    return EmailPriority.URGENT;
  }

  if (email.fromDomain && email.investorDomains.has(email.fromDomain)) {
    return EmailPriority.HIGH;
  }

  if (subject.includes('?')) {
    return EmailPriority.HIGH;
  }

  return EmailPriority.NORMAL;
}

export function parseEmailBody(payload: any): string {
  if (!payload) {
    return '';
  }

  const plainPart = findPayloadPart(payload, 'text/plain');
  if (plainPart?.body?.data) {
    return decodeBase64(plainPart.body.data).trim();
  }

  const htmlPart = findPayloadPart(payload, 'text/html');
  if (htmlPart?.body?.data) {
    return decodeBase64(htmlPart.body.data).trim();
  }

  if (payload.body?.data) {
    return decodeBase64(payload.body.data).trim();
  }

  return '';
}

export async function syncGmailInbox(
  userId: string,
  integrationId: string
): Promise<number> {
  console.log(`Starting Gmail inbox sync for user ${userId}`);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        companyId: user.companyId,
        platform: 'GOOGLE_WORKSPACE',
        status: 'CONNECTED',
      },
    });

    if (!integration) {
      throw new Error('Google Workspace integration not found');
    }

    const credentials = JSON.parse(decrypt(integration.credentials)) as {
      accessToken: string;
      refreshToken: string;
    };

    const oauthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauthClient.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauthClient });

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'newer_than:7d',
      maxResults: 100,
    });

    const messages = listResponse.data.messages || [];
    const companyDomain = extractDomain(user.email);

    const investorContacts = await prisma.contact.findMany({
      where: {
        companyId: user.companyId,
        category: { in: ['INVESTOR', 'BOARD_MEMBER'] },
      },
      select: { email: true },
    });

    const investorDomains = new Set(
      investorContacts
        .map((contact) => extractDomain(contact.email))
        .filter((domain): domain is string => Boolean(domain))
    );

    let syncedCount = 0;

    for (const message of messages) {
      if (!message.id) {
        continue;
      }

      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        const payload = fullMessage.data.payload;
        const headers = parseHeaders(payload?.headers || []);
        const fromAddress = parseEmailAddress(headers.from);
        const toAddresses = parseEmailAddresses(headers.to);
        const ccAddresses = parseEmailAddresses(headers.cc);
        const subject = headers.subject || '(no subject)';
        const receivedAt = parseEmailDate(headers.date, fullMessage.data.internalDate);
        const body = parseEmailBody(payload);
        const fromEmail = fromAddress.email || headers.from;
        const fromDomain = extractDomain(fromEmail);
        const isExternal = companyDomain ? fromDomain !== companyDomain : true;
        const priority = classifyEmailPriority({
          subject,
          fromDomain: fromDomain || '',
          investorDomains,
        });

        const existingEmail = await prisma.email.findUnique({
          where: { messageId: message.id },
          select: { id: true },
        });

        const emailRecord = existingEmail
          ? await prisma.email.update({
              where: { messageId: message.id },
              data: {
                threadId: fullMessage.data.threadId || '',
                from: fromEmail,
                to: toAddresses,
                cc: ccAddresses,
                subject,
                body,
                snippet: fullMessage.data.snippet || '',
                receivedAt,
                priority,
                isExternal,
                metadata: {
                  headers,
                  labelIds: fullMessage.data.labelIds || [],
                },
              },
            })
          : await prisma.email.create({
              data: {
                companyId: user.companyId,
                userId: user.id,
                messageId: message.id,
                threadId: fullMessage.data.threadId || '',
                from: fromEmail,
                to: toAddresses,
                cc: ccAddresses,
                subject,
                body,
                snippet: fullMessage.data.snippet || '',
                receivedAt,
                priority,
                status: 'UNREAD',
                isExternal,
                metadata: {
                  headers,
                  labelIds: fullMessage.data.labelIds || [],
                },
              },
            });

        if (!existingEmail) {
          await logEmailInteraction(emailRecord.id);
        }

        syncedCount += 1;
        console.log(`Synced email ${message.id}`);
      } catch (error) {
        console.log(`Failed to sync email ${message.id}`, error);
      }
    }

    console.log(`Finished Gmail inbox sync. Synced ${syncedCount} emails.`);
    return syncedCount;
  } catch (error) {
    console.log('Gmail inbox sync failed', error);
    return 0;
  }
}

export async function syncMicrosoftInbox(
  userId: string,
  integrationId: string
): Promise<number> {
  console.log(`Starting Microsoft 365 inbox sync for user ${userId}`);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        companyId: user.companyId,
        platform: 'MICROSOFT_365',
        status: 'CONNECTED',
      },
    });

    if (!integration) {
      throw new Error('Microsoft 365 integration not found');
    }

    const { accessToken } = await getMicrosoftAccessTokenFromIntegration(integration);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7);

    const query = new URLSearchParams({
      $top: '100',
      $select:
        'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,internetMessageId,conversationId',
      $filter: `receivedDateTime ge ${sinceDate.toISOString()}`,
    });

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Microsoft Graph request failed');
    }

    const data = (await response.json()) as { value?: MicrosoftMessage[] };
    const messages = data.value || [];
    const companyDomain = extractDomain(user.email);

    const investorContacts = await prisma.contact.findMany({
      where: {
        companyId: user.companyId,
        category: { in: ['INVESTOR', 'BOARD_MEMBER'] },
      },
      select: { email: true },
    });

    const investorDomains = new Set(
      investorContacts
        .map((contact) => extractDomain(contact.email))
        .filter((domain): domain is string => Boolean(domain))
    );

    let syncedCount = 0;

    for (const message of messages) {
      const messageId = message.internetMessageId || message.id;
      if (!messageId) {
        continue;
      }

      try {
        const subject = message.subject || '(no subject)';
        const receivedAt = message.receivedDateTime
          ? new Date(message.receivedDateTime)
          : new Date();
        const fromAddress = parseMicrosoftAddress(message.from);
        const toAddresses = parseMicrosoftAddresses(message.toRecipients);
        const ccAddresses = parseMicrosoftAddresses(message.ccRecipients);
        const body = parseMicrosoftEmailBody(message);
        const fromEmail = fromAddress.email || '';
        const fromDomain = extractDomain(fromEmail);
        const isExternal = companyDomain ? fromDomain !== companyDomain : true;
        const priority = classifyEmailPriority({
          subject,
          fromDomain: fromDomain || '',
          investorDomains,
        });

        const existingEmail = await prisma.email.findUnique({
          where: { messageId },
          select: { id: true },
        });

        const emailRecord = existingEmail
          ? await prisma.email.update({
              where: { messageId },
              data: {
                threadId: message.conversationId || '',
                from: fromEmail,
                to: toAddresses,
                cc: ccAddresses,
                subject,
                body,
                snippet: message.bodyPreview || '',
                receivedAt,
                priority,
                isExternal,
                metadata: {
                  internetMessageId: message.internetMessageId || null,
                },
              },
            })
          : await prisma.email.create({
              data: {
                companyId: user.companyId,
                userId: user.id,
                messageId,
                threadId: message.conversationId || '',
                from: fromEmail,
                to: toAddresses,
                cc: ccAddresses,
                subject,
                body,
                snippet: message.bodyPreview || '',
                receivedAt,
                priority,
                status: 'UNREAD',
                isExternal,
                metadata: {
                  internetMessageId: message.internetMessageId || null,
                },
              },
            });

        if (!existingEmail) {
          await logEmailInteraction(emailRecord.id);
        }

        syncedCount += 1;
        console.log(`Synced Microsoft email ${messageId}`);
      } catch (error) {
        console.log(`Failed to sync Microsoft email ${messageId}`, error);
      }
    }

    console.log(`Finished Microsoft 365 inbox sync. Synced ${syncedCount} emails.`);
    return syncedCount;
  } catch (error) {
    console.log('Microsoft 365 inbox sync failed', error);
    return 0;
  }
}

function parseHeaders(headers: Array<{ name?: string; value?: string }>): ParsedHeaders {
  const getHeader = (name: string) =>
    headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value || '';

  return {
    from: getHeader('from'),
    to: getHeader('to'),
    cc: getHeader('cc'),
    subject: getHeader('subject'),
    date: getHeader('date'),
  };
}

function parseEmailDate(headerValue: string, internalDate?: string | null): Date {
  if (headerValue) {
    const parsed = new Date(headerValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (internalDate) {
    const parsed = new Date(Number(internalDate));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function parseEmailAddress(value: string): ParsedAddress {
  if (!value) {
    return { name: null, email: null };
  }

  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/"/g, '').trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }

  const email = value.trim().toLowerCase();
  return { name: null, email: email || null };
}

function parseEmailAddresses(value: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => parseEmailAddress(entry).email)
    .filter((email): email is string => Boolean(email));
}

function parseMicrosoftEmailBody(message: MicrosoftMessage): string {
  const contentType = message.body?.contentType?.toLowerCase();
  const content = message.body?.content || '';

  if (contentType === 'text') {
    return content.trim();
  }

  if (contentType === 'html') {
    return stripHtml(content);
  }

  return (message.bodyPreview || content || '').trim();
}

function parseMicrosoftAddress(value?: {
  emailAddress?: { address?: string; name?: string };
}): ParsedAddress {
  const address = value?.emailAddress?.address?.toLowerCase() || null;
  const name = value?.emailAddress?.name?.trim() || null;
  return { name, email: address };
}

function parseMicrosoftAddresses(
  value?: Array<{ emailAddress?: { address?: string } }>
): string[] {
  if (!value?.length) {
    return [];
  }

  return value
    .map((entry) => entry.emailAddress?.address?.toLowerCase())
    .filter((email): email is string => Boolean(email));
}

function extractDomain(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  return email.split('@')[1].toLowerCase();
}

function decodeBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function findPayloadPart(payload: any, mimeType: string): any | null {
  if (!payload) {
    return null;
  }

  if (payload.mimeType === mimeType && payload.body?.data) {
    return payload;
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const match = findPayloadPart(part, mimeType);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

