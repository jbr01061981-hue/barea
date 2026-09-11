import { NextRequest, NextResponse } from 'next/server';
import {
  getRealtimeTransport,
  getSessionRepository,
  getAuthorizedTeacherContext
} from '../../../../teacher/review/db';
import { LiveQuizEvent } from '../../../../../domain/live-quiz';
import { projectEventForRole } from '../../../../../transport/realtime-transport';
import {
  validateParticipantToken,
  ParticipantToken
} from '../../../../../domain/value-objects';
import {
  SessionClosedError,
  SessionLockedError,
  SessionNotFoundError
} from '../../../../../domain/domain-errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: sessionId } = await context.params;

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'INVALID_SESSION_ID', message: 'Invalid session ID' }, { status: 400 });
  }

  const repo = getSessionRepository();
  const session = repo.findSessionById(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND', message: 'Session not found or unavailable' }, { status: 404 });
  }

  let isHost = false;
  let effectiveRole: 'host' | 'participant';
  let authenticatedUserId: string | undefined;

  let teacherAuthFailed = false;
  let teacherAuthStatus = 401;
  let teacherAuthErrorCode = 'UNAUTHORIZED';
  let teacherAuthErrorMessage = 'Teacher authentication failed.';

  // 1. Check if caller is authenticated teacher context matching session.hostUserId
  try {
    const teacher = await getAuthorizedTeacherContext();
    if (teacher && teacher.userId) {
      if (teacher.userId === session.hostUserId) {
        isHost = true;
        effectiveRole = 'host';
        authenticatedUserId = teacher.userId;
      } else {
        teacherAuthFailed = true;
        teacherAuthStatus = 403;
        teacherAuthErrorCode = 'NOT_SESSION_HOST';
        teacherAuthErrorMessage = 'Forbidden: only the session host can obtain the host live stream projection.';
      }
    }
  } catch (err: unknown) {
    // Security Remediation: Never leak raw exception messages, internal runtime strings,
    // or database details to the caller. Log full error details server-side only.
    console.error('[SSE HostAuth Error]:', err);
    teacherAuthFailed = true;
    teacherAuthStatus = 401;
    teacherAuthErrorCode = 'UNAUTHORIZED';
    teacherAuthErrorMessage = 'Teacher authentication failed.';
  }

  if (isHost) {
    // Authenticated host receives host projection authoritatively without relying on client role claims
    effectiveRole = 'host';
  } else {
    // 2. Non-host: must provide a valid participant token belonging to this session
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const rawToken = request.nextUrl.searchParams.get('token')?.trim() ||
      request.headers.get('x-participant-token')?.trim() ||
      bearerToken;

    if (!rawToken) {
      if (teacherAuthFailed && teacherAuthStatus === 403) {
        return NextResponse.json(
          { error: teacherAuthErrorCode, message: teacherAuthErrorMessage },
          { status: teacherAuthStatus }
        );
      }
      if (request.nextUrl.searchParams.get('role') === 'host') {
        return NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Teacher authentication failed.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required to subscribe to live stream.' },
        { status: 401 }
      );
    }

    let validatedToken: ParticipantToken;
    try {
      validatedToken = validateParticipantToken(rawToken);
    } catch {
      return NextResponse.json(
        { error: 'INVALID_PARTICIPANT_TOKEN', message: 'Invalid participant token format.' },
        { status: 400 }
      );
    }

    try {
      const { participant } = repo.resumeSession(sessionId, validatedToken);
      effectiveRole = 'participant';
      authenticatedUserId = participant.userId;
    } catch (err) {
      if (err instanceof SessionClosedError || err instanceof SessionLockedError || err instanceof SessionNotFoundError) {
        return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
      }
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Participant token is not valid for this active session.' },
        { status: 403 }
      );
    }
  }

  const subscriberId = 'sub_' + Math.random().toString(36).substring(2, 10);
  const transport = getRealtimeTransport();
  const sinceParam = request.nextUrl.searchParams.get('since');
  const sinceSequence = sinceParam ? parseInt(sinceParam, 10) : 0;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection heartbeat
      controller.enqueue(encoder.encode(': connected\n\n'));

      // If reconnecting with a valid since sequence number, replay missed events via canonical projection filter
      if (Number.isInteger(sinceSequence) && sinceSequence > 0) {
        const missedEvents = transport.getHistory(sessionId, sinceSequence, effectiveRole);
        for (const evt of missedEvents) {
          try {
            // Apply canonical projection filter for role
            const projectedEvt = projectEventForRole(evt, effectiveRole);
            const data = `event: ${projectedEvt.eventType}\ndata: ${JSON.stringify(projectedEvt)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch {
            // Channel closed
            break;
          }
        }
      }

      const unsubscribe = transport.subscribe({
        subscriberId,
        sessionId,
        role: effectiveRole,
        userId: authenticatedUserId,
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
