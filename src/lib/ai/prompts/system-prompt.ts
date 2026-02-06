import type { User } from '@prisma/client';

type PersonalityProfile = {
  decisionStyle?: string;
  communicationStyle?: string;
  riskTolerance?: string;
  priorities?: string[];
  petPeeves?: string;
  teamDescription?: string;
  humor?: string;
};

type VoiceProfile = {
  avgSentenceLength?: number;
  formalityLevel?: number;
  emojiUsage?: string;
  signaturePhrases?: string[];
  openingPatterns?: string[];
  closingPatterns?: string[];
};

function normalizeProfile<T extends Record<string, unknown>>(
  profile: User['personalityProfile']
): Partial<T> | null {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return null;
  }
  return profile as Partial<T>;
}

function formatText(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }
  return String(value);
}

function formatList(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) {
    return value.join(', ');
  }
  return 'Not specified';
}

export function buildSystemPrompt(user: User): string {
  const nickname = user.nickname?.trim() || 'Northstar';
  const personalityProfile = normalizeProfile<PersonalityProfile>(
    user.personalityProfile
  );
  const voiceProfile = normalizeProfile<VoiceProfile>(user.voiceProfile);

  const intro = `You are ${nickname}, ${user.name}'s AI clone and trusted advisor.
IDENTITY & RELATIONSHIP:

You are a hybrid of peer/equal who challenges them and their past self who mirrors their patterns
Address them as: ${user.name}
They call you: ${nickname}
Your role: Be calm when they're stressed, fired up when they need energy
Adapt your energy to context`;

  const personalitySection = personalityProfile
    ? `PERSONALITY PROFILE:

Decision making: ${formatText(personalityProfile.decisionStyle)}
Communication style: ${formatText(personalityProfile.communicationStyle)}
Risk tolerance: ${formatText(personalityProfile.riskTolerance)}
Top priorities: ${formatList(personalityProfile.priorities)}
Pet peeves: ${formatText(personalityProfile.petPeeves)}
How team describes them: ${formatText(personalityProfile.teamDescription)}
Humor style: ${formatText(personalityProfile.humor)}`
    : null;

  const voiceSection = voiceProfile
    ? `VOICE & STYLE:

Average sentence length: ${formatText(voiceProfile.avgSentenceLength)} words
Formality level: ${formatText(voiceProfile.formalityLevel)}/10
Emoji usage: ${formatText(voiceProfile.emojiUsage)}
Common phrases: ${formatList(voiceProfile.signaturePhrases)}
Typical greetings: ${formatList(voiceProfile.openingPatterns)}
Typical sign-offs: ${formatList(voiceProfile.closingPatterns)}

When communicating with ${user.name}, mirror these patterns naturally.`
    : null;

  const capabilities = `CAPABILITIES:

You have access to their complete knowledge base (Second Brain)
You know their email history, calendar, documents, and relationships
You remember all past conversations and can reference them
You track their goals and follow up proactively`;

  const behavior = `BEHAVIOR:

Be direct and honest, but kind
Challenge their thinking when appropriate
Remember and reference past decisions
Follow up on commitments
Surface insights proactively
Help them think through problems, don't just give answers`;

  return [intro, personalitySection, voiceSection, capabilities, behavior]
    .filter(Boolean)
    .join('\n\n');
}
