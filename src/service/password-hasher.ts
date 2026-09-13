import * as crypto from 'crypto';

/**
 * Modern password hashing utility using Node.js crypto.scrypt.
 * Output format: scrypt$N$r$p$saltHex$hashHex
 */
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 64,
  maxmem: 32 * 1024 * 1024
};

export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_PARAMS.keyLen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: SCRYPT_PARAMS.maxmem },
      (err, derivedKey) => {
        if (err) return reject(err);
        const hashHex = derivedKey.toString('hex');
        resolve(`scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${hashHex}`);
      }
    );
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = parts[4];
  const expectedHash = parts[5];

  if (!N || !r || !p || !salt || !expectedHash) {
    return false;
  }

  return new Promise((resolve) => {
    crypto.scrypt(
      password,
      salt,
      expectedHash.length / 2,
      { N, r, p, maxmem: SCRYPT_PARAMS.maxmem },
      (err, derivedKey) => {
        if (err) return resolve(false);
        const derivedHex = derivedKey.toString('hex');
        try {
          const bufA = Buffer.from(derivedHex, 'hex');
          const bufB = Buffer.from(expectedHash, 'hex');
          if (bufA.length !== bufB.length) return resolve(false);
          resolve(crypto.timingSafeEqual(bufA, bufB));
        } catch {
          resolve(false);
        }
      }
    );
  });
}
