import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { events, trackEvent } from '@/lib/analytics/events';

type OnboardingPayload = {
  personalityProfile: Record<string, unknown>;
  nickname?: string;
  complete?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as OnboardingPayload;

    if (!body?.personalityProfile) {
      return errorResponse('INVALID_PAYLOAD', 'Missing personality profile', 400);
    }

    const shouldComplete = Boolean(body.complete);
    const updatedUser = await prisma.user.update({
      where: { id: auth.user.userId },
      data: {
        personalityProfile: body.personalityProfile,
        nickname: body.nickname || null,
        onboardingCompleted: shouldComplete ? true : undefined,
        onboardingCompletedAt: shouldComplete ? new Date() : undefined,
      },
      select: { id: true, onboardingCompleted: true },
    });

    if (shouldComplete && updatedUser.onboardingCompleted) {
      trackEvent(events.ONBOARDING_COMPLETED, {
        userId: auth.user.userId,
        companyId: auth.user.companyId,
      });
    }

    return successResponse({ user: updatedUser });
  } catch (error) {
    return errorResponse('UPDATE_ERROR', 'Failed to save onboarding data', 500);
  }
}
