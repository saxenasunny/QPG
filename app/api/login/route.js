import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { createSession, json, audit } from '@/lib/auth';

export async function POST(req) {
  const { email, password } = await req.json();
  const r = await q('select * from users where email=$1', [String(email || '').toLowerCase().trim()]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) return json({ error: 'Wrong email or password' }, 401);
  await createSession(u);
  await audit(u.id, 'login');
  return json({ role: u.role, name: u.name });
}
