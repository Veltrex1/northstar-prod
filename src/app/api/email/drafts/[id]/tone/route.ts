import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { modifyTone } from '@/lib/email/draft-generator';
import { MonthlyTokenLimitError } from '@/lib/ai/usage-limits';
import { getEmailStyle } from '@/lib/email/style-analyzer';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const toneSchema = z.object({
  tone: z.enum(['friendly', 'professional', 'concise', 'detailed', 'persuasive', 'urgent']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { tone } = toneSchema.parse(body);

    const draft = await prisma.emailDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      return errorResponse('NOT_FOUND', 'Draft not found', 404);
    }

    if (draft.userId !== auth.user.userId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    const style = await getEmailStyle(auth.user.userId);
    if (!style) {
      return errorResponse('STYLE_NOT_LEARNED', 'Email style not learned', 400);
    }

    const modifiedDraft = await modifyTone(
      {
        subject: draft.subject || '',
        body: draft.content,
      },
      style,
      tone,
      auth.user.userId
    );

    const updatedDraft = await prisma.emailDraft.update({
      where: { id },
      data: {
        subject: modifiedDraft.subject,
        content: modifiedDraft.body,
        tone,
        status: 'REVISED',
      },
    });

    return successResponse({
      draftId: updatedDraft.id,
      subject: modifiedDraft.subject,
      content: modifiedDraft.body,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof MonthlyTokenLimitError) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse('TONE_ERROR', 'Failed to modify tone', 500);
  }
}
