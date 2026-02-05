import { google } from 'googleapis';
import { chatCompletion } from '@/lib/ai/claude-client';
import { prisma } from '@/lib/db/prisma';
import { getGoogleClient } from '@/lib/integrations/oauth/google';
import { getMicrosoftAccessTokenFromIntegration } from '@/lib/integrations/microsoft/credentials';
import { decrypt } from '@/lib/utils/encryption';
import { logger } from '@/lib/utils/logger';
import {
  assertWithinMonthlyOutputTokenCap,
  recordOutputTokens,
} from '@/lib/ai/usage-limits';

export class EmailStyleError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type EmailPlatform = 'GOOGLE_WORKSPACE' | 'MICROSOFT_365';

const MICROSOFT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export interface EmailStyle {
  averageLength: number;
  greetingStyle: string[];
  closingStyle: string[];
  formalityLevel: 'very_formal' | 'formal' | 'neutral' | 'casual' | 'very_casual';
  sentenceStructure: string;
  vocabularyLevel: string;
  punctuationHabits: string[];
  commonPhrases: string[];
  emailStructure: string;
  tonalCharacteristics: string;
}

export async function analyzeSentEmails(
  userId: string,
  platform?: EmailPlatform
): Promise<EmailStyle> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      throw new EmailStyleError('USER_NOT_FOUND', 'User not found', 404);
    }

    const integrations = await prisma.integration.findMany({
      where: {
        companyId: user.companyId,
        platform: { in: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'] },
        status: 'CONNECTED',
      },
    });

    let selectedPlatform = platform;

    if (!selectedPlatform) {
      if (integrations.length === 0) {
        throw new EmailStyleError(
          'EMAIL_PROVIDER_NOT_CONNECTED',
          'No email provider connected',
          400
        );
      }

      if (integrations.length > 1) {
        throw new EmailStyleError(
          'MULTIPLE_EMAIL_PROVIDERS',
          'Multiple email providers connected',
          400
        );
      }

      selectedPlatform = integrations[0].platform as EmailPlatform;
    }

    const integration = integrations.find(
      (item) => item.platform === selectedPlatform
    );

    if (!integration) {
      throw new EmailStyleError(
        selectedPlatform === 'GOOGLE_WORKSPACE'
          ? 'GOOGLE_WORKSPACE_NOT_CONNECTED'
          : 'MICROSOFT_365_NOT_CONNECTED',
        selectedPlatform === 'GOOGLE_WORKSPACE'
          ? 'Google Workspace not connected'
          : 'Microsoft 365 not connected',
        400
      );
    }

    const emails =
      selectedPlatform === 'GOOGLE_WORKSPACE'
        ? await getGmailSentEmails(integration.credentials)
        : await getMicrosoftSentEmails(integration);

    if (emails.length === 0) {
      throw new EmailStyleError('NO_SENT_EMAILS', 'No sent emails found', 404);
    }

    logger.info(`Analyzing ${emails.length} sent emails for user ${userId}`);

    await assertWithinMonthlyOutputTokenCap(userId, 4096);
    const styleAnalysis = await analyzeWritingStyleWithAI(emails, userId);

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailStyleProfile: styleAnalysis,
      },
    });

    logger.info('Email style analysis complete', { userId });

    return styleAnalysis;
  } catch (error) {
    logger.error('Email style analysis error', error);
    throw error;
  }
}

function extractGmailEmailBody(message: any): string {
  try {
    let body = '';

    if (message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    body = body.split(/On .* wrote:|>|--|^From:/m)[0];

    body = body.trim();

    return body;
  } catch (error) {
    logger.error('Error extracting email body', error);
    return '';
  }
}

async function getGmailSentEmails(credentialsJson: string): Promise<string[]> {
  const credentials = JSON.parse(decrypt(credentialsJson));
  const authClient = getGoogleClient(credentials.accessToken, credentials.refreshToken);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  const sentMessages = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:sent',
    maxResults: 50,
  });

  const messages = sentMessages.data.messages || [];
  const emails: string[] = [];

  for (const message of messages.slice(0, 50)) {
    const fullMessage = await gmail.users.messages.get({
      userId: 'me',
      id: message.id!,
      format: 'full',
    });

    const body = extractGmailEmailBody(fullMessage.data);
    if (body && body.length > 50) {
      emails.push(body);
    }
  }

  return emails;
}

type MicrosoftMessage = {
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
};

async function getMicrosoftSentEmails(integration: {
  id: string;
  credentials: string;
}): Promise<string[]> {
  const { accessToken } = await getMicrosoftAccessTokenFromIntegration(
    integration
  );

  const response = await fetch(
    `${MICROSOFT_GRAPH_BASE_URL}/me/mailFolders/SentItems/messages?$top=50&$select=body,bodyPreview`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new EmailStyleError(
      'MICROSOFT_GRAPH_ERROR',
      'Failed to read Microsoft 365 sent emails',
      502
    );
  }

  const data = (await response.json()) as { value?: MicrosoftMessage[] };
  const messages = data.value || [];

  const emails: string[] = [];
  for (const message of messages) {
    const body = extractMicrosoftEmailBody(message);
    if (body && body.length > 50) {
      emails.push(body);
    }
  }

  return emails;
}

function extractMicrosoftEmailBody(message: MicrosoftMessage): string {
  const contentType = message.body?.contentType?.toLowerCase();
  const content = message.body?.content || '';
  const raw =
    contentType === 'html' ? stripHtml(content) : content || message.bodyPreview || '';

  return raw.trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function analyzeWritingStyleWithAI(
  emails: string[],
  userId: string
): Promise<EmailStyle> {
  const prompt = `Analyze the following ${emails.length} email samples and provide a detailed writing style profile.

Emails:
${emails.map((email, i) => `\n--- Email ${i + 1} ---\n${email}\n`).join('\n')}

Provide your analysis in the following JSON format:
{
  "averageLength": <number of words>,
  "greetingStyle": [<array of common greetings used>],
  "closingStyle": [<array of common closings used>],
  "formalityLevel": "<very_formal|formal|neutral|casual|very_casual>",
  "sentenceStructure": "<description of typical sentence patterns>",
  "vocabularyLevel": "<simple|moderate|advanced|technical>",
  "punctuationHabits": [<array of notable punctuation patterns>],
  "commonPhrases": [<array of frequently used phrases>],
  "emailStructure": "<description of how they structure emails>",
  "tonalCharacteristics": "<description of overall tone>"
}

Respond ONLY with valid JSON, no other text.`;

  const response = await chatCompletion(
    [{ role: 'user', content: prompt }],
    'You are an expert writing style analyzer. Provide detailed, accurate analysis.',
    4096
  );
  await recordOutputTokens(userId, response.outputTokens);

  const jsonMatch = response.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse style analysis response');
  }

  const styleProfile = JSON.parse(jsonMatch[0]);

  return styleProfile;
}

export async function getEmailStyle(userId: string): Promise<EmailStyle | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailStyleProfile: true },
  });

  return user?.emailStyleProfile as EmailStyle | null;
}
