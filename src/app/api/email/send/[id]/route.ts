import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';
import { google } from 'googleapis';
import { getGoogleClient } from '@/lib/integrations/oauth/google';
import { decrypt } from '@/lib/utils/encryption';
import { events, trackEvent } from '@/lib/analytics/events';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const draft = await prisma.emailDraft.findUnique({
      where: { id: params.id },
    });

    if (!draft) {
      return errorResponse('NOT_FOUND', 'Draft not found', 404);
    }

    if (draft.userId !== auth.user.userId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    const body = await request.json();
    const { to, cc, bcc } = body;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.userId },
    });

    const integration = await prisma.integration.findFirst({
      where: {
        companyId: user!.companyId,
        platform: 'GOOGLE_WORKSPACE',
      },
    });

    if (!integration) {
      return errorResponse('NO_INTEGRATION', 'Gmail not connected', 400);
    }

    const credentials = JSON.parse(decrypt(integration.credentials));
    const authClient = getGoogleClient(credentials.accessToken, credentials.refreshToken);

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const email = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      bcc ? `Bcc: ${bcc}` : '',
      `Subject: ${draft.subject}`,
      '',
      draft.content,
    ]
      .filter(Boolean)
      .join('\n');

    const encodedEmail = Buffer.from(email).toString('base64url');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId: draft.threadId || undefined,
      },
    });

    await prisma.emailDraft.update({
      where: { id: params.id },
      data: { status: 'SENT' },
    });

    trackEvent(events.EMAIL_DRAFT_SENT, {
      userId: auth.user.userId,
      companyId: user!.companyId,
      draftId: draft.id,
    });

    return successResponse({ message: 'Email sent successfully' });
  } catch (error) {
    return errorResponse('SEND_ERROR', 'Failed to send email', 500);
  }
}
