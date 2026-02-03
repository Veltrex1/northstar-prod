import { google } from 'googleapis';
import { chatCompletion } from '@/lib/ai/claude-client';
import { prisma } from '@/lib/db/prisma';
import { getGoogleClient } from '@/lib/integrations/oauth/google';
import { decrypt } from '@/lib/utils/encryption';
import { logger } from '@/lib/utils/logger';

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

export async function analyzeSentEmails(userId: string): Promise<EmailStyle> {
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
        companyId: user.companyId,
        platform: 'GOOGLE_WORKSPACE',
      },
    });

    if (!integration) {
      throw new Error('Google Workspace not connected');
    }

    const credentials = JSON.parse(decrypt(integration.credentials));
    const authClient = getGoogleClient(credentials.accessToken, credentials.refreshToken);

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const sentMessages = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:sent',
      maxResults: 50,
    });

    if (!sentMessages.data.messages || sentMessages.data.messages.length === 0) {
      throw new Error('No sent emails found');
    }

    const emails: string[] = [];
    for (const message of sentMessages.data.messages.slice(0, 50)) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const body = extractEmailBody(fullMessage.data);
      if (body && body.length > 50) {
        emails.push(body);
      }
    }

    logger.info(`Analyzing ${emails.length} sent emails for user ${userId}`);

    const styleAnalysis = await analyzeWritingStyleWithAI(emails);

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

function extractEmailBody(message: any): string {
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

async function analyzeWritingStyleWithAI(emails: string[]): Promise<EmailStyle> {
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

  const jsonMatch = response.match(/\{[\s\S]*\}/);
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
