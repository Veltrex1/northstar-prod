import { syncGmailInbox, syncMicrosoftInbox } from '@/lib/services/email/inbox-sync';
import { generateAutoDraft } from '@/lib/services/email/auto-draft';
import { generateDailyDigest } from '@/lib/services/intelligence/digest';
import { executeFollowUps } from '@/lib/services/intelligence/follow-ups';
import { syncGoogleCalendar, syncMicrosoftCalendar } from '@/lib/services/meetings/calendar-sync';
import { generateMeetingBrief } from '@/lib/services/meetings/brief-generator';
import { analyzeVoice } from '@/lib/services/personality/voice-analysis';
import { syncContacts } from '@/lib/services/relationships/contact-sync';
import { logger } from '@/lib/utils/logger';

export enum JobType {
  EMAIL_SYNC = 'EMAIL_SYNC',
  CALENDAR_SYNC = 'CALENDAR_SYNC',
  AUTO_DRAFT = 'AUTO_DRAFT',
  MEETING_BRIEF = 'MEETING_BRIEF',
  DAILY_DIGEST = 'DAILY_DIGEST',
  FOLLOW_UPS = 'FOLLOW_UPS',
  VOICE_ANALYSIS = 'VOICE_ANALYSIS',
  CONTACT_SYNC = 'CONTACT_SYNC',
}

type EmailSyncPayload = {
  userId: string;
  integrationId: string;
  provider: 'GOOGLE' | 'MICROSOFT';
};

type CalendarSyncPayload = {
  userId: string;
  integrationId: string;
  provider: 'GOOGLE' | 'MICROSOFT';
};

type AutoDraftPayload = {
  emailId: string;
};

type MeetingBriefPayload = {
  eventId: string;
};

type DailyDigestPayload = {
  userId: string;
  date?: string | Date;
};

type VoiceAnalysisPayload = {
  userId: string;
};

type ContactSyncPayload = {
  userId: string;
};

export async function queueJob(type: JobType, payload: any) {
  logger.info('Queueing job (inline)', { type });
  return executeJob(type, payload);
}

export async function executeJob(type: JobType, payload: any) {
  logger.info('Executing job', { type });

  try {
    switch (type) {
      case JobType.EMAIL_SYNC: {
        const userId = requireString(payload?.userId, 'payload.userId');
        const integrationId = requireString(payload?.integrationId, 'payload.integrationId');
        const provider = requireProvider(payload?.provider, 'payload.provider');

        const result =
          provider === 'GOOGLE'
            ? await syncGmailInbox(userId, integrationId)
            : await syncMicrosoftInbox(userId, integrationId);

        logger.info('Email sync complete', { userId, integrationId, provider, result });
        return result;
      }
      case JobType.CALENDAR_SYNC: {
        const userId = requireString(payload?.userId, 'payload.userId');
        const integrationId = requireString(payload?.integrationId, 'payload.integrationId');
        const provider = requireProvider(payload?.provider, 'payload.provider');

        const result =
          provider === 'GOOGLE'
            ? await syncGoogleCalendar(userId, integrationId)
            : await syncMicrosoftCalendar(userId, integrationId);

        logger.info('Calendar sync complete', { userId, integrationId, provider, result });
        return result;
      }
      case JobType.AUTO_DRAFT: {
        const emailId = requireString(payload?.emailId, 'payload.emailId');
        const result = await generateAutoDraft(emailId);
        logger.info('Auto draft complete', { emailId });
        return result;
      }
      case JobType.MEETING_BRIEF: {
        const eventId = requireString(payload?.eventId, 'payload.eventId');
        const result = await generateMeetingBrief(eventId);
        logger.info('Meeting brief complete', { eventId });
        return result;
      }
      case JobType.DAILY_DIGEST: {
        const userId = requireString(payload?.userId, 'payload.userId');
        const date = normalizeDate(payload?.date);
        const result = await generateDailyDigest(userId, date);
        logger.info('Daily digest complete', { userId, date: date.toISOString() });
        return result;
      }
      case JobType.FOLLOW_UPS: {
        const result = await executeFollowUps();
        logger.info('Follow-ups executed', { executed: result });
        return result;
      }
      case JobType.VOICE_ANALYSIS: {
        const userId = requireString(payload?.userId, 'payload.userId');
        const result = await analyzeVoice(userId);
        logger.info('Voice analysis complete', { userId });
        return result;
      }
      case JobType.CONTACT_SYNC: {
        const userId = requireString(payload?.userId, 'payload.userId');
        const result = await syncContacts(userId);
        logger.info('Contact sync complete', { userId, result });
        return result;
      }
      default: {
        throw new Error(`Unsupported job type: ${type}`);
      }
    }
  } catch (error) {
    logger.error('Job execution failed', { type, error });
    throw error;
  }
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing or invalid ${label}`);
  }
  return value;
}

function requireProvider(value: unknown, label: string): 'GOOGLE' | 'MICROSOFT' {
  if (value === 'GOOGLE' || value === 'MICROSOFT') {
    return value;
  }
  throw new Error(`Missing or invalid ${label}`);
}

function normalizeDate(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid payload.date');
  }
  date.setHours(0, 0, 0, 0);
  return date;
}
