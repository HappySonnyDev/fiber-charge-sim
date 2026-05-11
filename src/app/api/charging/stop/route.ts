import { NextRequest, NextResponse } from 'next/server';
import { getSessionById, updateSessionStatus } from '@/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id' },
        { status: 400 }
      );
    }

    const session = getSessionById(session_id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    updateSessionStatus(session_id, 'completed');

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: 'completed',
        total_paid: session.total_paid,
        total_fee: session.total_fee,
      },
    });
  } catch (error) {
    console.error('Stop charging error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop charging' },
      { status: 500 }
    );
  }
}
