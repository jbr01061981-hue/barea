import {
  InvalidRoomCodeError,
  InvalidParticipantTokenError,
  InvalidClientIpError,
  InvalidScheduledTimeError
} from './domain-errors';

declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type RoomCode = Brand<string, 'RoomCode'>;
export type ParticipantToken = Brand<string, 'ParticipantToken'>;
export type ClientIp = Brand<string, 'ClientIp'>;

// 1. RoomCode: Exactly 6 unambiguous uppercase characters (2-9, A-Z excl. 0, 1, I, O)
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

export function normalizeAndValidateRoomCode(raw: unknown): RoomCode {
  if (typeof raw !== 'string') {
    throw new InvalidRoomCodeError('Room code must be a string.');
  }
  const normalized = raw.trim().toUpperCase();
  if (!ROOM_CODE_REGEX.test(normalized)) {
    throw new InvalidRoomCodeError(
      `Room code must be exactly 6 characters using valid alphabet (${ROOM_CODE_ALPHABET}). Got: '${normalized}'`
    );
  }
  return normalized as RoomCode;
}

// 2. ParticipantToken: 'ptok_' followed by 43 base64url characters (~256 bits entropy)
export const PARTICIPANT_TOKEN_REGEX = /^ptok_[A-Za-z0-9_-]{43}$/;

export function validateParticipantToken(raw: unknown): ParticipantToken {
  if (typeof raw !== 'string' || !PARTICIPANT_TOKEN_REGEX.test(raw)) {
    throw new InvalidParticipantTokenError('Invalid participant session token format.');
  }
  return raw as ParticipantToken;
}

// 3. Email & Phone Normalizers for Allowlist Matching
export function normalizeAllowlistEmail(raw: string): string {
  if (typeof raw !== 'string') throw new Error('Email must be a string.');
  return raw.trim().toLowerCase();
}

export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

export function normalizeAllowlistPhone(raw: string): string {
  if (typeof raw !== 'string') throw new Error('Phone must be a string.');
  const trimmed = raw.trim().replace(/[\s()-]/g, '');
  if (!E164_PHONE_REGEX.test(trimmed)) {
    throw new Error(`Phone number must follow international E.164 format (e.g. +12125550123). Got: '${raw}'`);
  }
  return trimmed;
}

// 4. Scheduled Start Time Validator (ISO-8601 UTC)
export function validateScheduledStartTime(raw: unknown, nowEpochMs: number, expiresEpochMs: number): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') throw new InvalidScheduledTimeError('Scheduled start time must be a string.');

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime()) || !raw.endsWith('Z')) {
    throw new InvalidScheduledTimeError('Scheduled start time must be a valid UTC ISO-8601 timestamp ending in Z.');
  }

  const startMs = parsed.getTime();
  if (startMs <= nowEpochMs) {
    throw new InvalidScheduledTimeError('Scheduled start time must be in the future.');
  }
  if (startMs >= expiresEpochMs) {
    throw new InvalidScheduledTimeError('Scheduled start time cannot exceed session expiration time.');
  }

  return parsed.toISOString();
}

// 5. Personal Tenant ID Helper (Option A)
export const PERSONAL_TENANT_PREFIX = 'usr_ten_';

export function derivePersonalTenantId(userId: string): string {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required to derive personal tenant identity.');
  }
  return `${PERSONAL_TENANT_PREFIX}${userId.trim()}`;
}

export function isPersonalTenantId(tenantId: string): boolean {
  return typeof tenantId === 'string' && tenantId.startsWith(PERSONAL_TENANT_PREFIX);
}
