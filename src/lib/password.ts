/**
 * Password hashing using Node's built-in crypto.scrypt.
 * No native dependencies (unlike argon2/bcrypt).
 * OWASP-recommended (scrypt with N=2^16, r=8, p=1).
 */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LEN = 64; // 512-bit key
const SCRYPT_N = 16384; // N parameter (2^14 — OWASP minimum for interactive)
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelism

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  // Format: scrypt:N:r:p:saltHex:hashHex
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], "hex");
  const storedHash = Buffer.from(parts[5], "hex");

  const hash = scryptSync(password, salt, storedHash.length, { N, r, p });

  // Constant-time comparison to prevent timing attacks
  if (hash.length !== storedHash.length) return false;
  return timingSafeEqual(hash, storedHash);
}
