import { NextRequest, NextResponse } from 'next/server';
import { getRealtimeTransport } from '../../../../teacher/review/db';
import { LiveQuizEvent } from '../../../../../domain/live-quiz';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: sessionId } = await context.params;

  if (!sessionId || typeof sessionId !== 'string') {
    return new NextResponse('Invalid session ID', { status: 400 });
  }

  const role = request.nextUrl.searchParams.get('role') === 'host' ? 'host' : 'participant';
  const subscriberId = 'sub_' + Math.random().toString(36).substring(2, 10);
  const transport = getRealtimeTransport();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial heartbeat
      controller.enqueue(encoder.encode(': connected\n\n'));

      const unsubscribe = transport.subscribe({
        subscriberId,
        sessionId,
        role,
        onEvent(event: LiveQuizEvent) {
          try {
            const data = `event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch {
            // Stream might be closed
          }
        },
        onError() {
          try {
            controller.close();
          } catch {
            // Ignore
          }
        }
      });

      request.signal.addEventListener('abort', () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Ignore
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
