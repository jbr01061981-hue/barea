import { RateLimitExceededError, InvalidClientIpError } from '../domain/domain-errors';

export interface RateLimiter {
  checkRoomLookup(clientIp?: string | null): void;
  recordFailedLookup(clientIp?: string | null): void;
  checkUnauthenticatedRequest(clientIp?: string | null): void;
  checkJoinMutation(userId: string): void;
  checkLiveMutation(userId: string): void;
  reset(): void;
}

interface WindowBucket {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private failedLookups = new Map<string, WindowBucket>();
  private subnetFailedLookups = new Map<string, WindowBucket>();
  private unauthRequests = new Map<string, WindowBucket>();
  private userJoins = new Map<string, WindowBucket>();
  private userLiveMutations = new Map<string, WindowBucket>();

  private maxFailedLookupsPerMinute: number = 15;
  private maxSubnetFailedLookupsPerMinute: number = 60;
  private maxUnauthRequestsPer10Seconds: number = 100;
  private minSecondsBetweenUserJoins: number = 5;
  private maxLiveMutationsPer5Seconds: number = 20;

  private nowProvider: () => number;

  constructor(
    nowProvider: () => number = () => Date.now(),
    options?: {
      maxFailedLookupsPerMinute?: number;
      maxSubnetFailedLookupsPerMinute?: number;
      maxUnauthRequestsPer10Seconds?: number;
      minSecondsBetweenUserJoins?: number;
      maxLiveMutationsPer5Seconds?: number;
    }
  ) {
    this.nowProvider = nowProvider;
    if (options?.maxFailedLookupsPerMinute !== undefined) this.maxFailedLookupsPerMinute = options.maxFailedLookupsPerMinute;
    if (options?.maxSubnetFailedLookupsPerMinute !== undefined) this.maxSubnetFailedLookupsPerMinute = options.maxSubnetFailedLookupsPerMinute;
    if (options?.maxUnauthRequestsPer10Seconds !== undefined) this.maxUnauthRequestsPer10Seconds = options.maxUnauthRequestsPer10Seconds;
    if (options?.minSecondsBetweenUserJoins !== undefined) this.minSecondsBetweenUserJoins = options.minSecondsBetweenUserJoins;
    if (options?.maxLiveMutationsPer5Seconds !== undefined) this.maxLiveMutationsPer5Seconds = options.maxLiveMutationsPer5Seconds;
  }

  resetUserJoin(userId: string): void {
    this.userJoins.delete(userId);
  }

  checkRoomLookup(clientIp?: string | null): void {
    // In pre-deployment without trusted IP provenance, clientIp is unavailable (null).
    // To prevent an attacker from creating a congregation-wide DoS or an exact-room DoS,
    // unauthenticated lookup throttling is strictly partitioned by trusted client IP / subnet
    // and is only evaluated when verified client IP provenance exists.
    if (!clientIp) {
      return;
    }

    const normalizedIp = this.normalizeIp(clientIp);
    const now = this.nowProvider();

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

  recordFailedLookup(clientIp?: string | null): void {
    if (!clientIp) {
      return;
    }

    const normalizedIp = this.normalizeIp(clientIp);
    const now = this.nowProvider();

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

  checkLiveMutation(userId: string): void {
    if (!userId) return;
    const now = this.nowProvider();
    const bucket = this.userLiveMutations.get(userId);

    // Limit live mutations per 5 seconds per authenticated user
    if (!bucket || bucket.resetAt <= now) {
      this.userLiveMutations.set(userId, { count: 1, resetAt: now + 5000 });
    } else {
      bucket.count++;
      if (bucket.count > this.maxLiveMutationsPer5Seconds) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        throw new RateLimitExceededError(Math.max(1, retryAfter));
      }
    }
  }

  reset(): void {
    this.failedLookups.clear();
    this.subnetFailedLookups.clear();
    this.unauthRequests.clear();
    this.userJoins.clear();
    this.userLiveMutations.clear();
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
