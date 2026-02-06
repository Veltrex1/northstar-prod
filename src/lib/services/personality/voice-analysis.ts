import { DraftStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

type VoiceProfile = {
  avgSentenceLength: number;
  formalityLevel: number;
  emojiUsage: 'never' | 'rare' | 'moderate' | 'frequent';
  signaturePhrases: string[];
  openingPatterns: string[];
  closingPatterns: string[];
  lastAnalyzed: string;
};

const CONTRACTION_REGEX =
  /\b(?:can't|won't|don't|didn't|isn't|aren't|it's|i'm|you're|they're|we're|that's|there's|couldn't|shouldn't|wouldn't|haven't|hasn't|hadn't|i'll|you'll|we'll|they'll|i'd|you'd|we'd|they'd|let's|what's|who's|here's|there're|wasn't|weren't)\b/gi;
const FORMAL_REGEX =
  /\b(?:therefore|however|furthermore|moreover|consequently|nevertheless|additionally|regarding|accordingly|thus|hereby|therein|herein|thereafter|whereas|hence)\b/gi;
const SLANG_REGEX =
  /\b(?:lol|omg|btw|idk|imo|imho|tbh|ngl|ya|yep|nope|gonna|wanna|kinda|sorta|cool|awesome|dude|bros?|thx|sup|ya'll|y'all)\b/gi;
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;
const STOP_WORDS = new Set([
  'the',
  'and',
  'or',
  'but',
  'so',
  'to',
  'of',
  'in',
  'for',
  'on',
  'at',
  'with',
  'is',
  'it',
  'that',
  'this',
  'a',
  'an',
  'as',
  'be',
  'are',
  'was',
  'were',
  'by',
  'we',
  'you',
  'i',
  'they',
  'he',
  'she',
  'me',
  'my',
  'your',
  'our',
  'their',
  'from',
  'not',
  'have',
  'has',
  'had',
  'will',
  'can',
]);

export async function analyzeVoice(userId: string): Promise<VoiceProfile> {
  try {
    logger.info('Starting voice analysis', { userId });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const [drafts, emails] = await Promise.all([
      prisma.emailDraft.findMany({
        where: { userId, status: DraftStatus.SENT },
        select: { content: true },
      }),
      prisma.email.findMany({
        where: {
          userId,
          OR: [{ isExternal: false }, { from: user.email }],
        },
        select: { body: true },
      }),
    ]);

    const messages = [
      ...drafts.map((draft) => draft.content),
      ...emails.map((email) => email.body),
    ].filter((content): content is string => Boolean(content?.trim()));

    const profile = buildVoiceProfile(messages);

    await prisma.user.update({
      where: { id: userId },
      data: { voiceProfile: profile },
    });

    return profile;
  } catch (error) {
    logger.error('Voice analysis error', error);
    throw error;
  }
}

function buildVoiceProfile(messages: string[]): VoiceProfile {
  const lastAnalyzed = new Date().toISOString();

  if (messages.length === 0) {
    return {
      avgSentenceLength: 0,
      formalityLevel: 5,
      emojiUsage: 'never',
      signaturePhrases: [],
      openingPatterns: [],
      closingPatterns: [],
      lastAnalyzed,
    };
  }

  const sentenceStats = messages.reduce(
    (stats, message) => {
      const sentences = splitSentences(message);
      for (const sentence of sentences) {
        const wordCount = tokenizeWords(sentence).length;
        if (wordCount > 0) {
          stats.totalWords += wordCount;
          stats.totalSentences += 1;
        }
      }
      return stats;
    },
    { totalWords: 0, totalSentences: 0 }
  );

  const totalWords = messages.reduce(
    (count, message) => count + tokenizeWords(message).length,
    0
  );
  const totalSentences = sentenceStats.totalSentences;
  const avgSentenceLength =
    totalSentences === 0 ? 0 : roundToOneDecimal(sentenceStats.totalWords / totalSentences);

  const combinedText = messages.join('\n');
  const contractionCount = countRegexMatches(combinedText, CONTRACTION_REGEX);
  const formalCount = countRegexMatches(combinedText, FORMAL_REGEX);
  const slangCount = countRegexMatches(combinedText, SLANG_REGEX);
  const formalityLevel = calculateFormalityLevel({
    totalWords,
    contractionCount,
    formalCount,
    slangCount,
  });

  const emojiCount = countRegexMatches(combinedText, EMOJI_REGEX);
  const emojiUsage = categorizeEmojiUsage(emojiCount, messages.length);

  const signaturePhrases = extractSignaturePhrases(messages);
  const openingPatterns = extractPatterns(messages, extractOpeningPattern);
  const closingPatterns = extractPatterns(messages, extractClosingPattern);

  return {
    avgSentenceLength,
    formalityLevel,
    emojiUsage,
    signaturePhrases,
    openingPatterns,
    closingPatterns,
    lastAnalyzed,
  };
}

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const matches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return matches ? matches.map((sentence) => sentence.trim()).filter(Boolean) : [];
}

function tokenizeWords(text: string): string[] {
  return text.toLowerCase().match(/[a-zA-Z']+/g) || [];
}

function countRegexMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function calculateFormalityLevel(input: {
  totalWords: number;
  contractionCount: number;
  formalCount: number;
  slangCount: number;
}): number {
  const wordBase = Math.max(1, input.totalWords);
  const formalRate = input.formalCount / wordBase;
  const contractionRate = input.contractionCount / wordBase;
  const slangRate = input.slangCount / wordBase;

  let score = 5;
  score += Math.min(3, formalRate * 20);
  score -= Math.min(3, contractionRate * 30);
  score -= Math.min(3, slangRate * 40);

  return clamp(Math.round(score), 1, 10);
}

function categorizeEmojiUsage(emojiCount: number, messageCount: number): VoiceProfile['emojiUsage'] {
  if (emojiCount === 0 || messageCount === 0) {
    return 'never';
  }

  const emojiRate = (emojiCount / messageCount) * 100;

  if (emojiRate < 5) {
    return 'rare';
  }

  if (emojiRate <= 20) {
    return 'moderate';
  }

  return 'frequent';
}

function extractSignaturePhrases(messages: string[]): string[] {
  const phraseCounts = new Map<string, number>();

  for (const message of messages) {
    const words = tokenizeWords(message);
    for (let n = 2; n <= 4; n += 1) {
      for (let i = 0; i <= words.length - n; i += 1) {
        const phraseWords = words.slice(i, i + n);
        if (!phraseWords.some((word) => !STOP_WORDS.has(word))) {
          continue;
        }
        const phrase = phraseWords.join(' ');
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      }
    }
  }

  return [...phraseCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

function extractPatterns(
  messages: string[],
  extractor: (message: string) => string | null
): string[] {
  const counts = new Map<string, number>();

  for (const message of messages) {
    const pattern = extractor(message);
    if (pattern) {
      counts.set(pattern, (counts.get(pattern) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern]) => pattern);
}

function extractOpeningPattern(message: string): string | null {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const firstLine = lines[0];
  const match = firstLine.match(
    /^(hi|hey|hello|dear|good morning|good afternoon|good evening)\b[^\r\n]*/i
  );

  return match ? trimTrailingPunctuation(match[0]) : null;
}

function extractClosingPattern(message: string): string | null {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 4); i -= 1) {
    const line = lines[i];
    const match = line.match(
      /^(thanks|thank you|best|best regards|regards|kind regards|cheers|sincerely|warm regards|respectfully|yours truly)\b[^\r\n]*/i
    );

    if (match) {
      return trimTrailingPunctuation(match[0]);
    }
  }

  return null;
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[,.!?]+$/g, '').trim();
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
