import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { SCHEMA, DEFAULT_FORMAT } from '@/lib/schema';
import { json } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Visit /api/setup?token=YOUR_SETUP_TOKEN once after deploying.
export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!process.env.SETUP_TOKEN || token !== process.env.SETUP_TOKEN) {
      return json({ error: 'Invalid setup token' }, 403);
    }
    await q(SCHEMA);
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
    let admin = 'no admin credentials set';
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const email = ADMIN_EMAIL.toLowerCase().trim();
      const pw = ADMIN_PASSWORD.trim();
      const hash = await bcrypt.hash(pw, 10);
      const existing = await q("select id, email from users where role='admin' or email=$1 limit 1", [email]);
      if (existing.rowCount) {
        await q('update users set name=$1, email=$2, password_hash=$3, role=$4 where id=$5', [
          ADMIN_NAME || 'Admin', email, hash, 'admin', existing.rows[0].id,
        ]);
        admin = 'updated admin credentials for: ' + email;
      } else {
        await q('insert into users(name,email,password_hash,role) values($1,$2,$3,$4)', [
          ADMIN_NAME || 'Admin', email, hash, 'admin',
        ]);
        admin = 'created: ' + email;
      }
    }
    await q('insert into formats(name, config) values($1,$2) on conflict (name) do nothing', [
      DEFAULT_FORMAT.name, JSON.stringify(DEFAULT_FORMAT.config),
    ]);
    return json({ ok: true, tables: 'ready', admin });
  } catch (err) {
    console.error('Setup error:', err);
    return json({ error: 'Setup failed: ' + (err.message || '') }, 500);
  }
}

