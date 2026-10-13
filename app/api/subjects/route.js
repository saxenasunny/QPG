import { q } from '@/lib/db';
import { requireRole, json, denied } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await requireRole();
  if (!s) return denied();
  if (s.role === 'admin') {
    return json(
      (
        await q(
          'select id, department, degree, batch, semester, code, name, co_count from subjects order by department, degree, batch, semester, code'
        )
      ).rows
    );
  }
  // Faculty only gets assigned subjects
  const res = await q(
    `select s.id, s.department, s.degree, s.batch, s.semester, s.code, s.name, s.co_count
       from subjects s
       join faculty_subjects fs on fs.subject_id = s.id
      where fs.faculty_id = $1
      order by s.department, s.degree, s.batch, s.semester, s.code`,
    [s.uid]
  );
  return json(res.rows);
}
export async function POST(req) {
  if (!(await requireRole('admin'))) return denied();
  const b = await req.json();
  const department = String(b.department || '').trim().toUpperCase() || 'SOES';
  const degree = String(b.degree || '').trim() || 'General';
  let batch = String(b.batch || '').trim() || '2024';
  const matchYear = batch.match(/\b(20\d{2}|19\d{2})\b/);
  if (matchYear) {
    batch = matchYear[1];
  } else {
    batch = batch.slice(0, 4);
  }
  const semester = String(b.semester || '').trim() || '1';
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  const co = Number(b.co_count) || 5;

  if (!code || !name) return json({ error: 'Subject code and name are required.' }, 400);

  const existing = await q(
    `select id from subjects 
      where upper(code) = $1 
        and upper(department) = $2 
        and upper(degree) = upper($3) 
        and upper(batch) = upper($4) 
        and upper(semester) = upper($5)`,
    [code, department, degree, batch, semester]
  );
  if (existing.rowCount > 0) {
    return json({ error: `Subject ${code} already exists for ${department} / ${degree} / ${batch} / Sem ${semester}.` }, 409);
  }

  try {
    await q(
      'insert into subjects(department, degree, batch, semester, code, name, co_count) values($1, $2, $3, $4, $5, $6, $7)',
      [department, degree, batch, semester, code, name, co]
    );
  } catch (err) {
    return json({ error: `Could not save subject ${code}: ${err.message}` }, 409);
  }
  return json({ ok: true });
}
export async function DELETE(req) {
  if (!(await requireRole('admin'))) return denied();
  await q('delete from subjects where id=$1', [new URL(req.url).searchParams.get('id')]);
  return json({ ok: true });
}
