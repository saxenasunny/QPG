import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { requireRole, json, denied } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireRole('admin'))) return denied();
  return json((await q("select id, name, email, role from users where role='faculty' order by name")).rows);
}
export async function POST(req) {
  if (!(await requireRole('admin'))) return denied();
  const b = await req.json();
  const email = String(b.email || '').toLowerCase().trim();
  if (!b.name || !email || String(b.password || '').length < 8) return json({ error: 'Name, email and a password of at least 8 characters are required.' }, 400);
  try {
    await q("insert into users(name,email,password_hash,role) values($1,$2,$3,'faculty')", [b.name.trim(), email, await bcrypt.hash(b.password, 10)]);
  } catch { return json({ error: 'That email is already registered.' }, 409); }
  return json({ ok: true });
}
export async function DELETE(req) {
  if (!(await requireRole('admin'))) return denied();
  await q("delete from users where id=$1 and role='faculty'", [new URL(req.url).searchParams.get('id')]);
  return json({ ok: true });
}
