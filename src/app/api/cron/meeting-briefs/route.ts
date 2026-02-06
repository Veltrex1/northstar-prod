import { prisma } from '@/lib/db/prisma';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const events = await prisma.calendarEvent.findMany({
      where: {
        startTime: {
          gte: oneHourFromNow,
          lte: twoHoursFromNow,
        },
        briefId: null,
        status: 'CONFIRMED',
      },
      include: {
        user: {
          select: { id: true, name: true, personalityProfile: true },
        },
      },
    });

    const { generateMeetingBrief } = await import(
      '@/lib/services/meetings/brief-generator'
    );

    let generated = 0;
    for (const event of events) {
      try {
        await generateMeetingBrief(event.id);
        generated += 1;
      } catch (error) {
        console.error(`Failed to generate brief for event ${event.id}:`, error);
      }
    }

    return Response.json({
      success: true,
      generated,
      total: events.length,
    });
  } catch (error) {
    console.error('Meeting brief cron error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
