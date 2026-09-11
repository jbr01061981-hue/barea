import {
  LiveQuizEvent,
  LiveQuizEventType,
  type QuestionLifecycleState
} from '../domain/live-quiz';

export interface RealtimeSubscriber {
  readonly subscriberId: string;
  readonly sessionId: string;
  readonly role: 'host' | 'participant' | 'projector';
  readonly userId?: string;
  readonly onEvent: (event: LiveQuizEvent) => void;
  readonly onError?: (err: Error) => void;
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
   */
  getHistory(sessionId: string, sinceSequenceNumber?: number): readonly LiveQuizEvent[];

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
        // Project event payload if necessary (e.g. strip correct answers for participants)
        const projectedEvent = this.projectEventForSubscriber(fullEvent, sub);
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

  getHistory(sessionId: string, sinceSequenceNumber: number = 0): readonly LiveQuizEvent[] {
    const channel = this.channels.get(sessionId);
    if (!channel) return [];

    return channel.eventLog.filter(e => e.sequenceNumber > sinceSequenceNumber);
  }

  getSubscriberCount(sessionId: string): number {
    const channel = this.channels.get(sessionId);
    return channel ? channel.subscribers.size : 0;
  }

  clearSession(sessionId: string): void {
    this.channels.delete(sessionId);
  }

  /**
   * Ensures participant and projector subscribers never receive sensitive host fields
   * (such as answer keys, correct option indices, or explanation text during active answering).
   */
  private projectEventForSubscriber(event: LiveQuizEvent, subscriber: RealtimeSubscriber): LiveQuizEvent {
    if (subscriber.role === 'host') {
      return event;
    }

    // If payload contains question data, ensure correct options and explanations are projected away
    if (event.payload && typeof event.payload === 'object') {
      const payload = { ...event.payload };
      delete (payload as Record<string, unknown>).correctOptionIndices;
      delete (payload as Record<string, unknown>).explanation;

      if (payload.question && typeof payload.question === 'object') {
        const q = { ...(payload.question as Record<string, unknown>) };
        delete q.correctOptionIndices;
        delete q.explanation;
        payload.question = q;
      }
      return {
        ...event,
        payload
      };
    }

    return event;
  }
}
