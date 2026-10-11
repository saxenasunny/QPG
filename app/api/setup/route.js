import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { SCHEMA, DEFAULT_FORMAT } from '@/lib/schema';
import { json } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Visit /api/setup?token=YOUR_SETUP_TOKEN once after deploying.
export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token');
  if (!process.env.SETUP_TOKEN || token !== process.env.SETUP_TOKEN) return json({ error: 'Invalid setup token' }, 403);
  await q(SCHEMA);
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  const has = await q("select 1 from users where role='admin' limit 1");
  let admin = 'already exists';
  if (!has.rowCount && ADMIN_EMAIL && ADMIN_PASSWORD) {
    await q('insert into users(name,email,password_hash,role) values($1,$2,$3,$4)', [
      ADMIN_NAME || 'Admin', ADMIN_EMAIL.toLowerCase(), await bcrypt.hash(ADMIN_PASSWORD, 10), 'admin',
    ]);
    admin = 'created: ' + ADMIN_EMAIL;
  }
  await q('insert into formats(name, config) values($1,$2) on conflict (name) do nothing', [DEFAULT_FORMAT.name, DEFAULT_FORMAT.config]);
  return json({ ok: true, tables: 'ready', admin });
}
