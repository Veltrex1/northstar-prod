import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { generateEmailDraft } from '@/lib/email/draft-generator';
import { RateLimitError } from '@/lib/ai/claude-client';
import { MonthlyTokenLimitError } from '@/lib/ai/usage-limits';
import { getEmailStyle } from '@/lib/email/style-analyzer';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const draftSchema = z.object({
  type: z.enum(['reply', 'new']),
  originalEmail: z
    .object({
      from: z.string(),
      subject: z.string(),
      body: z.string(),
      threadId: z.string().optional(),
      threadHistory: z.string().optional(),
    })
    .optional(),
  prompt: z.string().optional(),
  context: z.string().optional(),
  tone: z.enum(['friendly', 'professional', 'concise', 'detailed', 'persuasive', 'urgent']).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const draftRequest = draftSchema.parse(body);

    const style = await getEmailStyle(auth.user.userId);

    if (!style) {
      return errorResponse(
        'STYLE_NOT_LEARNED',
        'Email style not yet learned. Please run /api/email/learn first.',
        400
      );
    }

    const draft = await generateEmailDraft({
      type: draftRequest.type,
      originalEmail: draftRequest.originalEmail,
      prompt: draftRequest.prompt,
      context: draftRequest.context,
      style,
      tone: draftRequest.tone,
      userId: auth.user.userId,
    });

    const savedDraft = await prisma.emailDraft.create({
      data: {
        userId: auth.user.userId,
        threadId: draftRequest.originalEmail?.threadId,
        subject: draft.subject,
        content: draft.body,
        tone: draftRequest.tone,
        status: 'DRAFT',
        originalEmail: draftRequest.originalEmail || null,
      },
    });

    return successResponse({
      draftId: savedDraft.id,
      subject: draft.subject,
      content: draft.body,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof MonthlyTokenLimitError) {
      return errorResponse(error.code, error.message, error.status);
    }
    if (error instanceof RateLimitError) {
      return errorResponse(error.code, error.message, error.status);
    }
    if (typeof error === 'object' && error && 'status' in error) {
      const status = (error as { status?: number }).status;
      if (status === 429) {
        return errorResponse(
          'RATE_LIMIT',
          'Rate limit reached. Please try again in a few minutes.',
          429
        );
      }
    }
    return errorResponse('DRAFT_ERROR', 'Failed to generate draft', 500);
  }
}
