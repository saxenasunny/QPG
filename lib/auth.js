import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { q } from './db.js';

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s || 'dev-only-secret');
}

export async function createSession(user) {
  const token = await new SignJWT({ uid: user.id, role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(secret());
  cookies().set('session', token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearSession() {
  cookies().set('session', '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getSession() {
  const t = cookies().get('session')?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    return payload;
  } catch {
    return null;
  }
}

/** Returns the session if the person has the role (or any role when omitted), else null. */
export async function requireRole(role) {
  const s = await getSession();
  if (!s || (role && s.role !== role)) return null;
  return s;
}

export const json = (data, status = 200) => Response.json(data, { status });
export const denied = () => json({ error: 'Not allowed' }, 403);

export async function audit(userId, action, detail = {}) {
  try {
    await q('insert into audit_log(user_id, action, detail) values($1,$2,$3)', [userId, action, detail]);
  } catch {}
}
