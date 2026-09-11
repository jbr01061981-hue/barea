import { RateLimitExceededError, InvalidClientIpError } from '../domain/domain-errors';

export interface RateLimiter {
  checkRoomLookup(roomCode: string, clientIp?: string | null): void;
  recordFailedLookup(roomCode: string, clientIp?: string | null): void;
  checkUnauthenticatedRequest(clientIp?: string | null): void;
  checkJoinMutation(userId: string): void;
  reset(): void;
}

interface WindowBucket {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private failedLookups = new Map<string, WindowBucket>();
  private subnetFailedLookups = new Map<string, WindowBucket>();
  private roomCodeFailedLookups = new Map<string, WindowBucket>();
  private unauthRequests = new Map<string, WindowBucket>();
  private userJoins = new Map<string, WindowBucket>();

  private maxFailedLookupsPerMinute: number = 15;
  private maxSubnetFailedLookupsPerMinute: number = 60;
  private maxFailedLookupsPerRoomCodePerMinute: number = 15;
  private maxUnauthRequestsPer10Seconds: number = 100;
  private minSecondsBetweenUserJoins: number = 5;

  private nowProvider: () => number;

  constructor(
    nowProvider: () => number = () => Date.now(),
    options?: {
      maxFailedLookupsPerMinute?: number;
      maxSubnetFailedLookupsPerMinute?: number;
      maxFailedLookupsPerRoomCodePerMinute?: number;
      maxUnauthRequestsPer10Seconds?: number;
      minSecondsBetweenUserJoins?: number;
    }
  ) {
    this.nowProvider = nowProvider;
    if (options?.maxFailedLookupsPerMinute !== undefined) this.maxFailedLookupsPerMinute = options.maxFailedLookupsPerMinute;
    if (options?.maxSubnetFailedLookupsPerMinute !== undefined) this.maxSubnetFailedLookupsPerMinute = options.maxSubnetFailedLookupsPerMinute;
    if (options?.maxFailedLookupsPerRoomCodePerMinute !== undefined) this.maxFailedLookupsPerRoomCodePerMinute = options.maxFailedLookupsPerRoomCodePerMinute;
    if (options?.maxUnauthRequestsPer10Seconds !== undefined) this.maxUnauthRequestsPer10Seconds = options.maxUnauthRequestsPer10Seconds;
    if (options?.minSecondsBetweenUserJoins !== undefined) this.minSecondsBetweenUserJoins = options.minSecondsBetweenUserJoins;
  }

  resetUserJoin(userId: string): void {
    this.userJoins.delete(userId);
  }

  checkRoomLookup(roomCode: string, clientIp?: string | null): void {
    const now = this.nowProvider();

    // 1. Room-code-scoped failed lookup check (server-authoritative target key)
    const normalizedRoom = this.normalizeRoomCode(roomCode);
    if (normalizedRoom) {
      const roomBucket = this.roomCodeFailedLookups.get(normalizedRoom);
      if (roomBucket && roomBucket.resetAt > now && roomBucket.count >= this.maxFailedLookupsPerRoomCodePerMinute) {
        const retryAfter = Math.ceil((roomBucket.resetAt - now) / 1000);
        throw new RateLimitExceededError(Math.max(1, retryAfter));
      }
    }

    // 2. IP and subnet checks (strictly when trusted client IP is present)
    if (clientIp) {
      const normalizedIp = this.normalizeIp(clientIp);

      // Check individual IP bucket
      const ipBucket = this.failedLookups.get(normalizedIp);
      if (ipBucket && ipBucket.resetAt > now && ipBucket.count >= this.maxFailedLookupsPerMinute) {
        const retryAfter = Math.ceil((ipBucket.resetAt - now) / 1000);
        throw new RateLimitExceededError(Math.max(1, retryAfter));
      }

      // Check subnet bucket (/24 for IPv4, /48 for IPv6)
      const subnetKey = this.extractSubnet(normalizedIp);
      const subnetBucket = this.subnetFailedLookups.get(subnetKey);
      if (subnetBucket && subnetBucket.resetAt > now && subnetBucket.count >= this.maxSubnetFailedLookupsPerMinute) {
        const retryAfter = Math.ceil((subnetBucket.resetAt - now) / 1000);
        throw new RateLimitExceededError(Math.max(1, retryAfter));
      }
    }
  }

  recordFailedLookup(roomCode: string, clientIp?: string | null): void {
    const now = this.nowProvider();

    // 1. Record failure for room code
    const normalizedRoom = this.normalizeRoomCode(roomCode);
    if (normalizedRoom) {
      const roomBucket = this.roomCodeFailedLookups.get(normalizedRoom);
      if (!roomBucket || roomBucket.resetAt <= now) {
        this.roomCodeFailedLookups.set(normalizedRoom, { count: 1, resetAt: now + 60_000 });
      } else {
        roomBucket.count++;
      }
    }

    // 2. Record failure for IP and subnet (strictly when trusted client IP is present)
    if (clientIp) {
      const normalizedIp = this.normalizeIp(clientIp);

      // Record for IP
      const ipBucket = this.failedLookups.get(normalizedIp);
      if (!ipBucket || ipBucket.resetAt <= now) {
        this.failedLookups.set(normalizedIp, { count: 1, resetAt: now + 60_000 });
      } else {
        ipBucket.count++;
      }

      // Record for subnet
      const subnetKey = this.extractSubnet(normalizedIp);
      const subnetBucket = this.subnetFailedLookups.get(subnetKey);
      if (!subnetBucket || subnetBucket.resetAt <= now) {
        this.subnetFailedLookups.set(subnetKey, { count: 1, resetAt: now + 60_000 });
      } else {
        subnetBucket.count++;
      }
    }
  }

  checkUnauthenticatedRequest(clientIp?: string | null): void {
    // In pre-deployment without trusted IP provenance, clientIp is unavailable (null).
    // An unauthenticated global bucket would create a congregation-wide DoS vector,
    // so IP-scoped flood limits only apply when a verified client IP is present.
    if (!clientIp) {
      return;
    }

    const normalizedIp = this.normalizeIp(clientIp);
    const now = this.nowProvider();

    const bucket = this.unauthRequests.get(normalizedIp);
    if (!bucket || bucket.resetAt <= now) {
      this.unauthRequests.set(normalizedIp, { count: 1, resetAt: now + 10_000 });
    } else {
      bucket.count++;
      if (bucket.count > this.maxUnauthRequestsPer10Seconds) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        throw new RateLimitExceededError(Math.max(1, retryAfter));
      }
    }
  }

  checkJoinMutation(userId: string): void {
    if (!userId) return;
    const now = this.nowProvider();
    const bucket = this.userJoins.get(userId);

    if (bucket && bucket.resetAt > now) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      throw new RateLimitExceededError(Math.max(1, retryAfter));
    }

    this.userJoins.set(userId, { count: 1, resetAt: now + (this.minSecondsBetweenUserJoins * 1000) });
  }

  reset(): void {
    this.failedLookups.clear();
    this.subnetFailedLookups.clear();
    this.roomCodeFailedLookups.clear();
    this.unauthRequests.clear();
    this.userJoins.clear();
  }

  private normalizeRoomCode(roomCode: string): string {
    if (!roomCode || typeof roomCode !== 'string') return '';
    return roomCode.trim().toUpperCase();
  }

  private normalizeIp(ip: string): string {
    if (!ip || typeof ip !== 'string') {
      throw new InvalidClientIpError('IP address must be a valid non-empty string.');
    }
    const trimmed = ip.trim();
    if (trimmed.startsWith('::ffff:')) {
      return trimmed.substring(7);
    }
    return trimmed;
  }

  private extractSubnet(ip: string): string {
    // IPv4 /24
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      }
    }
    // IPv6 /48
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 3) {
        return `${parts[0]}:${parts[1]}:${parts[2]}::/48`;
      }
    }
    return ip;
  }
}
