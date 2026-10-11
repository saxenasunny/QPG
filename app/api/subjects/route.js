import { q } from '@/lib/db';
import { requireRole, json, denied } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await requireRole();
  if (!s) return denied();
  if (s.role === 'admin') {
    return json((await q('select id, code, name, co_count from subjects order by code')).rows);
  }
  // Faculty only gets assigned subjects
  const res = await q(
    `select s.id, s.code, s.name, s.co_count
       from subjects s
       join faculty_subjects fs on fs.subject_id = s.id
      where fs.faculty_id = $1
      order by s.code`,
    [s.uid]
  );
  return json(res.rows);
}
export async function POST(req) {
  if (!(await requireRole('admin'))) return denied();
  const b = await req.json();
  const code = String(b.code || '').trim().toUpperCase(), name = String(b.name || '').trim(), co = Number(b.co_count) || 5;
  if (!code || !name) return json({ error: 'Subject code and name are required.' }, 400);
  try {
    await q('insert into subjects(code,name,co_count) values($1,$2,$3)', [code, name, co]);
  } catch { return json({ error: `Subject ${code} already exists.` }, 409); }
  return json({ ok: true });
}
export async function DELETE(req) {
  if (!(await requireRole('admin'))) return denied();
  await q('delete from subjects where id=$1', [new URL(req.url).searchParams.get('id')]);
  return json({ ok: true });
}
