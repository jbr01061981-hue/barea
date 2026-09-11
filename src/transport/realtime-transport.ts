import {
  LiveQuizEvent,
  LiveQuizEventType,
  type QuestionLifecycleState
} from '../domain/live-quiz';

export type SubscriberRole = 'host' | 'participant' | 'projector';

export interface RealtimeSubscriber {
  readonly subscriberId: string;
  readonly sessionId: string;
  readonly role: SubscriberRole;
  readonly userId?: string;
  readonly onEvent: (event: LiveQuizEvent) => void;
  readonly onError?: (err: Error) => void;
}

function sanitizeQuestionPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...obj };
  delete sanitized.correctOptionIndices;
  delete sanitized.explanation;
  delete sanitized.correctOptionIndex;
  delete sanitized.correctAnswer;
  return sanitized;
}

/**
 * Canonical projection filter for live quiz events.
 * Ensures non-host subscribers (participant, projector) never receive sensitive host fields
 * such as answer keys, correct option indices, or explanation text.
 */
export function projectEventForRole(
  event: LiveQuizEvent,
  role: SubscriberRole
): LiveQuizEvent {
  if (role === 'host') {
    return event;
  }

  if (event.payload && typeof event.payload === 'object') {
    const payload = sanitizeQuestionPayload(event.payload as Record<string, unknown>);

    if (payload.question && typeof payload.question === 'object') {
      payload.question = sanitizeQuestionPayload(payload.question as Record<string, unknown>);
    }

    if (payload.currentQuestion && typeof payload.currentQuestion === 'object') {
      payload.currentQuestion = sanitizeQuestionPayload(payload.currentQuestion as Record<string, unknown>);
    }

    if (Array.isArray(payload.questions)) {
      payload.questions = payload.questions.map(q =>
        q && typeof q === 'object' ? sanitizeQuestionPayload(q as Record<string, unknown>) : q
      );
    }

    return {
      ...event,
      payload
    };
  }

  return event;
}

export interface RealtimeTransport {
  /**
   * Subscribes a client to live events for a specific session.
   * Returns an unsubscribe function.
   */
  subscribe(subscriber: RealtimeSubscriber): () => void;

  /**
   * Publishes an event to all authorized subscribers of the session.
   */
  publish(event: Omit<LiveQuizEvent, 'sequenceNumber'>): LiveQuizEvent;

  /**
   * Retrieves historical events for a session after a given sequence number,
   * enabling reconnecting clients to replay missed state transitions without drift.
   * When role is provided, applies canonical projection filter to prevent data leakage.
   */
  getHistory(sessionId: string, sinceSequenceNumber?: number, role?: SubscriberRole): readonly LiveQuizEvent[];

  /**
   * Returns active subscriber count for a session.
   */
  getSubscriberCount(sessionId: string): number;

  /**
   * Disconnects and cleans up all subscribers and history for a session.
   */
  clearSession(sessionId: string): void;
}

interface SessionChannel {
  subscribers: Map<string, RealtimeSubscriber>;
  eventLog: LiveQuizEvent[];
  nextSequence: number;
}

const MAX_EVENT_LOG_SIZE = 500;

/**
 * Server-authoritative in-memory realtime transport.
 * Enforces session isolation, monotonic sequence numbering, and replay buffers.
 */
export class InMemoryRealtimeTransport implements RealtimeTransport {
  private channels = new Map<string, SessionChannel>();

  private getOrCreateChannel(sessionId: string): SessionChannel {
    let channel = this.channels.get(sessionId);
    if (!channel) {
      channel = {
        subscribers: new Map(),
        eventLog: [],
        nextSequence: 1
      };
      this.channels.set(sessionId, channel);
    }
    return channel;
  }

  subscribe(subscriber: RealtimeSubscriber): () => void {
    if (!subscriber.sessionId || !subscriber.sessionId.trim()) {
      throw new Error('Subscriber must specify a valid sessionId.');
    }
    if (!subscriber.subscriberId || !subscriber.subscriberId.trim()) {
      throw new Error('Subscriber must specify a valid subscriberId.');
    }

    const channel = this.getOrCreateChannel(subscriber.sessionId);
    channel.subscribers.set(subscriber.subscriberId, subscriber);

    return () => {
      const ch = this.channels.get(subscriber.sessionId);
      if (ch) {
        ch.subscribers.delete(subscriber.subscriberId);
        if (ch.subscribers.size === 0 && ch.eventLog.length === 0) {
          this.channels.delete(subscriber.sessionId);
        }
      }
    };
  }

  publish(eventInput: Omit<LiveQuizEvent, 'sequenceNumber'>): LiveQuizEvent {
    if (!eventInput.sessionId || !eventInput.sessionId.trim()) {
      throw new Error('Event must specify a valid sessionId.');
    }

    const channel = this.getOrCreateChannel(eventInput.sessionId);
    const sequenceNumber = channel.nextSequence++;

    const fullEvent: LiveQuizEvent = {
      ...eventInput,
      sequenceNumber
    };

    // Buffer in event log for reconnect/catch-up
    channel.eventLog.push(fullEvent);
    if (channel.eventLog.length > MAX_EVENT_LOG_SIZE) {
      channel.eventLog.shift();
    }

    // Broadcast strictly to subscribers of this session (session isolation)
    for (const sub of channel.subscribers.values()) {
      try {
        // Project event payload via canonical projection filter
        const projectedEvent = projectEventForRole(fullEvent, sub.role);
        sub.onEvent(projectedEvent);
      } catch (err) {
        if (sub.onError && err instanceof Error) {
          try {
            sub.onError(err);
          } catch {
            // Protect dispatch loop
          }
        }
      }
    }

    return fullEvent;
  }

  getHistory(sessionId: string, sinceSequenceNumber: number = 0, role?: SubscriberRole): readonly LiveQuizEvent[] {
    const channel = this.channels.get(sessionId);
    if (!channel) return [];

    const events = channel.eventLog.filter(e => e.sequenceNumber > sinceSequenceNumber);
    if (role) {
      return events.map(e => projectEventForRole(e, role));
    }
    return events;
  }

  getSubscriberCount(sessionId: string): number {
    const channel = this.channels.get(sessionId);
    return channel ? channel.subscribers.size : 0;
  }

  clearSession(sessionId: string): void {
    this.channels.delete(sessionId);
  }
}
