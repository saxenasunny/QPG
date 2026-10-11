import { q } from '@/lib/db';
import { requireRole, json, denied } from '@/lib/auth';
import { checkFormat } from '@/lib/formatConfig';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireRole())) return denied();
  return json((await q('select id, name, config from formats order by name')).rows);
}
export async function POST(req) {
  if (!(await requireRole('admin'))) return denied();
  const b = await req.json();
  const name = String(b.name || '').trim();
  if (!name) return json({ error: 'Give the format a name.' }, 400);
  const { config, errors } = checkFormat(b.config || {});
  if (errors.length) return json({ error: errors.join(' ') }, 400);
  try {
    await q('insert into formats(name, config) values($1,$2)', [name, config]);
  } catch { return json({ error: `A format named "${name}" already exists.` }, 409); }
  return json({ ok: true });
}
export async function DELETE(req) {
  if (!(await requireRole('admin'))) return denied();
  await q('delete from formats where id=$1', [new URL(req.url).searchParams.get('id')]);
  return json({ ok: true });
}
