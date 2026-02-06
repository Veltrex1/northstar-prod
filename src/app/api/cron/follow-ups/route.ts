import { executeFollowUps } from '@/lib/services/intelligence/follow-ups';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const executed = await executeFollowUps();
    console.log('Follow-up cron complete', { executed });
    return Response.json({ executed });
  } catch (error) {
    console.error('Follow-up cron error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
