import { prisma } from '@/lib/db/prisma';
import { generateDailyDigest } from '@/lib/services/intelligence/digest';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const users = await prisma.user.findMany({
      where: { onboardingCompleted: true },
      select: { id: true },
    });

    let generated = 0;
    let skipped = 0;

    for (const user of users) {
      const existing = await prisma.dailyDigest.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date: today,
          },
        },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      try {
        await generateDailyDigest(user.id, today);
        generated += 1;
      } catch (error) {
        console.error(`Failed to generate digest for user ${user.id}:`, error);
      }
    }

    console.log('Daily digest cron complete', { generated, skipped });
    return Response.json({ generated, skipped });
  } catch (error) {
    console.error('Daily digest cron error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
