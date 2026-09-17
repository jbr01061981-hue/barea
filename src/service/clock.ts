/**
 * Clock Port for Server-Authoritative Time
 *
 * Provides current server timestamps in milliseconds and ISO-8601 UTC string.
 * Decoupled from persistence layers and injectable into domain services.
 */
export interface Clock {
  /**
   * Returns the current server timestamp in milliseconds since Unix epoch.
   */
  nowMs(): number;

  /**
   * Returns the current server timestamp as an ISO-8601 UTC string (e.g. "2026-09-17T22:00:00.000Z").
   */
  nowIso(): string;
}

/**
 * Default system clock implementation utilizing ambient JavaScript runtime time.
 */
export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }

  nowIso(): string {
    return new Date().toISOString();
  }
}
