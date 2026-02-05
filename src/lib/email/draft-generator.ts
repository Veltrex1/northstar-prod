import { chatCompletion } from '@/lib/ai/claude-client';
import { EmailStyle } from './style-analyzer';
import { logger } from '@/lib/utils/logger';
import {
  assertWithinMonthlyOutputTokenCap,
  recordOutputTokens,
} from '@/lib/ai/usage-limits';

export interface DraftRequest {
  type: 'reply' | 'new';
  originalEmail?: {
    from: string;
    subject: string;
    body: string;
    threadHistory?: string;
  };
  prompt?: string;
  context?: string;
  style: EmailStyle;
  tone?: 'friendly' | 'professional' | 'concise' | 'detailed' | 'persuasive' | 'urgent';
  userId: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export async function generateEmailDraft(request: DraftRequest): Promise<EmailDraft> {
  try {
    logger.info('Generating email draft', { type: request.type });

    const systemPrompt = buildEmailSystemPrompt(request.style, request.tone);
    const userPrompt = buildEmailUserPrompt(request);

    await assertWithinMonthlyOutputTokenCap(request.userId, 2048);
    const response = await chatCompletion(
      [{ role: 'user', content: userPrompt }],
      systemPrompt,
      2048
    );
    await recordOutputTokens(request.userId, response.outputTokens);

    const draft = parseEmailDraft(response.text);

    return draft;
  } catch (error) {
    logger.error('Email draft generation error', error);
    throw error;
  }
}

function buildEmailSystemPrompt(style: EmailStyle, tone?: string): string {
  let basePrompt = `You are an email writing assistant. Your task is to write emails that match the user's writing style EXACTLY.

Writing Style Profile:
- Formality: ${style.formalityLevel}
- Average length: ${style.averageLength} words
- Typical greetings: ${style.greetingStyle.join(', ')}
- Typical closings: ${style.closingStyle.join(', ')}
- Sentence structure: ${style.sentenceStructure}
- Vocabulary level: ${style.vocabularyLevel}
- Common phrases: ${style.commonPhrases.join(', ')}
- Email structure: ${style.emailStructure}
- Tonal characteristics: ${style.tonalCharacteristics}

CRITICAL: Match this style exactly. Write as if YOU are this person.`;

  if (tone) {
    const toneInstructions: Record<string, string> = {
      friendly: 'Make the email warmer and more approachable while maintaining the core style.',
      professional: 'Increase formality and professionalism while maintaining the core style.',
      concise: 'Make the email more brief and to-the-point, cutting unnecessary words.',
      detailed: 'Add more context and explanation while maintaining readability.',
      persuasive: 'Make the email more compelling and action-oriented.',
      urgent: 'Convey urgency and importance while remaining professional.',
    };

    basePrompt += `\n\nTONE ADJUSTMENT: ${toneInstructions[tone]}`;
  }

  basePrompt += `\n\nProvide the email in this format:
SUBJECT: [subject line]
BODY:
[email body]

Do not include any other text or explanation.`;

  return basePrompt;
}

function buildEmailUserPrompt(request: DraftRequest): string {
  if (request.type === 'reply') {
    if (!request.originalEmail) {
      throw new Error('Original email required for reply');
    }

    let prompt = `Draft a reply to this email:

FROM: ${request.originalEmail.from}
SUBJECT: ${request.originalEmail.subject}

ORIGINAL EMAIL:
${request.originalEmail.body}`;

    if (request.originalEmail.threadHistory) {
      prompt += `\n\nTHREAD HISTORY:\n${request.originalEmail.threadHistory}`;
    }

    if (request.context) {
      prompt += `\n\nADDITIONAL CONTEXT:\n${request.context}`;
    }

    return prompt;
  }

  if (!request.prompt) {
    throw new Error('Prompt required for new email');
  }

  let prompt = `Draft a new email based on this request:\n${request.prompt}`;

  if (request.context) {
    prompt += `\n\nADDITIONAL CONTEXT:\n${request.context}`;
  }

  return prompt;
}

function parseEmailDraft(response: string): EmailDraft {
  const lines = response.trim().split('\n');

  let subject = '';
  let bodyLines: string[] = [];
  let inBody = false;

  for (const line of lines) {
    if (line.startsWith('SUBJECT:')) {
      subject = line.replace('SUBJECT:', '').trim();
    } else if (line.startsWith('BODY:')) {
      inBody = true;
    } else if (inBody) {
      bodyLines.push(line);
    }
  }

  return {
    subject: subject || 'No subject',
    body: bodyLines.join('\n').trim(),
  };
}

export async function modifyTone(
  originalDraft: EmailDraft,
  style: EmailStyle,
  newTone: 'friendly' | 'professional' | 'concise' | 'detailed' | 'persuasive' | 'urgent',
  userId: string
): Promise<EmailDraft> {
  const systemPrompt = buildEmailSystemPrompt(style, newTone);
  const userPrompt = `Rewrite this email with the specified tone adjustment:

SUBJECT: ${originalDraft.subject}
BODY:
${originalDraft.body}

Keep the same core message but adjust the tone as specified.`;

  await assertWithinMonthlyOutputTokenCap(userId, 2048);
  const response = await chatCompletion(
    [{ role: 'user', content: userPrompt }],
    systemPrompt,
    2048
  );
  await recordOutputTokens(userId, response.outputTokens);

  return parseEmailDraft(response.text);
}
