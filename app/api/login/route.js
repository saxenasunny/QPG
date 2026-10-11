import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { createSession, json, audit } from '@/lib/auth';
import { ensureDatabase } from '@/lib/init';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await ensureDatabase();
    const { email, password } = await req.json();
    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '');

    const envAdminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const envAdminPassword = (process.env.ADMIN_PASSWORD || '').trim();

    const r = await q('select * from users where email=$1', [cleanEmail]);
    let u = r.rows[0];

    // If matching admin from environment variables
    if (envAdminEmail && cleanEmail === envAdminEmail && envAdminPassword) {
      if (cleanPassword === envAdminPassword) {
        if (!u) {
          // Auto-create admin user
          const hash = await bcrypt.hash(cleanPassword, 10);
          const ins = await q(
            'insert into users(name,email,password_hash,role) values($1,$2,$3,$4) returning *',
            [process.env.ADMIN_NAME || 'Admin', cleanEmail, hash, 'admin']
          );
          u = ins.rows[0];
        } else if (!(await bcrypt.compare(cleanPassword, u.password_hash))) {
          // Sync admin password with updated environment variable
          const hash = await bcrypt.hash(cleanPassword, 10);
          await q('update users set password_hash=$1 where id=$2', [hash, u.id]);
          u.password_hash = hash;
        }
      }
    }

    if (!u || !(await bcrypt.compare(cleanPassword, u.password_hash))) {
      return json({ error: 'Wrong email or password' }, 401);
    }

    await createSession(u);
    await audit(u.id, 'login');
    return json({ role: u.role, name: u.name });
  } catch (err) {
    console.error('Login error:', err);
    return json(
      {
        error:
          'Database connection error. Please verify DATABASE_URL in Vercel settings: ' +
          (err.message || ''),
      },
      500
    );
  }
}

