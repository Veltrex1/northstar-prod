import { NextRequest } from 'next/server';
import { google } from 'googleapis';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';
import { getGoogleClient } from '@/lib/integrations/oauth/google';
import { decrypt } from '@/lib/utils/encryption';
import { events, trackEvent } from '@/lib/analytics/events';

export async function POST(
  request: NextRequest,
  { params }: { params: { emailId: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const email = await prisma.email.findUnique({
      where: { id: params.emailId },
      include: { draft: true },
    });

    if (!email) {
      return errorResponse('NOT_FOUND', 'Email not found', 404);
    }

    if (email.userId !== auth.user.userId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    if (!email.draft) {
      return errorResponse('DRAFT_NOT_FOUND', 'Draft not found', 404);
    }

    const integration = await prisma.integration.findFirst({
      where: {
        companyId: auth.user.companyId,
        platform: 'GOOGLE_WORKSPACE',
      },
    });

    if (!integration) {
      return errorResponse('NO_INTEGRATION', 'Gmail not connected', 400);
    }

    const credentials = JSON.parse(decrypt(integration.credentials));
    const authClient = getGoogleClient(credentials.accessToken, credentials.refreshToken);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const subject = email.draft.subject || email.subject;
    const ccLine = email.cc.length ? `Cc: ${email.cc.join(', ')}` : '';

    const message = [
      `To: ${email.from}`,
      ccLine,
      `Subject: ${subject}`,
      '',
      email.draft.content,
    ]
      .filter(Boolean)
      .join('\n');

    const encodedEmail = Buffer.from(message).toString('base64url');

    const sendResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId: email.draft.threadId || email.threadId || undefined,
      },
    });

    const contact = await prisma.contact.upsert({
      where: {
        userId_email: {
          userId: auth.user.userId,
          email: email.from,
        },
      },
      create: {
        userId: auth.user.userId,
        companyId: auth.user.companyId,
        email: email.from,
        name: email.from,
        category: 'OTHER',
        lastContactAt: new Date(),
      },
      update: {
        name: email.from,
        lastContactAt: new Date(),
      },
    });

    const timestamp = new Date();

    await prisma.$transaction([
      prisma.email.update({
        where: { id: email.id },
        data: { status: 'RESPONDED' },
      }),
      prisma.emailDraft.update({
        where: { id: email.draft.id },
        data: { status: 'SENT' },
      }),
      prisma.contactInteraction.create({
        data: {
          contactId: contact.id,
          type: 'EMAIL_SENT',
          subject,
          summary: email.draft.content,
          emailId: email.id,
          timestamp,
          metadata: {
            messageId: sendResult.data.id || null,
            threadId: sendResult.data.threadId || null,
          },
        },
      }),
    ]);

    trackEvent(events.EMAIL_DRAFT_SENT, {
      userId: auth.user.userId,
      companyId: auth.user.companyId,
      emailId: email.id,
      draftId: email.draft.id,
    });

    return successResponse({ message: 'Email sent successfully' });
  } catch (error) {
    return errorResponse('SEND_ERROR', 'Failed to send email', 500);
  }
}
