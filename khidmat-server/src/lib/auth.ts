import type { NextFunction, Request, Response } from 'express';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { env } from '../config/env';
import type { UserRole } from '../db/types';
import { handleError } from './responseHandler';

const scrypt = promisify(scryptCallback);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AuthSession = {
  userId: string;
  role: UserRole;
  expiresAt: number;
};

type PhoneVerificationProof = {
  purpose: 'phone_verification';
  phone: string;
  expiresAt: number;
};

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(payload: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(payload).digest('base64url');
}

export function createSessionToken(userId: string, role: UserRole): string {
  const payload = encode({ userId, role, expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token: string): AuthSession | null {
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) return null;
  const expected = signature(payload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthSession;
    if (!session.userId || !session.role || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function createPhoneVerificationProof(phone: string): string {
  const payload = encode({
    purpose: 'phone_verification',
    phone,
    expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
  });
  return `${payload}.${signature(payload)}`;
}

export function verifyPhoneVerificationProof(token: string, phone: string): boolean {
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) return false;
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
  try {
    const proof = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PhoneVerificationProof;
    return proof.purpose === 'phone_verification' && proof.phone === phone && proof.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(pin, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = (await scrypt(pin, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function requireAuth(roles?: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const session = token ? verifySessionToken(token) : null;
    if (!session) return handleError(res, 401, 'Please sign in again • Dobara login karein');
    if (roles && !roles.includes(session.role)) {
      return handleError(res, 403, 'You cannot use this action');
    }
    res.locals.auth = session;
    return next();
  };
}
