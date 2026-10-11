import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { requireRole, json, denied } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireRole('admin'))) return denied();
  const rows = (
    await q(
      `select u.id, u.name, u.email, u.role,
              coalesce(
                json_agg(json_build_object('id', s.id, 'code', s.code, 'name', s.name))
                filter (where s.id is not null),
                '[]'
              ) as assigned_subjects
         from users u
         left join faculty_subjects fs on fs.faculty_id = u.id
         left join subjects s on s.id = fs.subject_id
        where u.role = 'faculty'
        group by u.id, u.name, u.email, u.role
        order by u.name`
    )
  ).rows;
  return json(rows);
}

export async function POST(req) {
  if (!(await requireRole('admin'))) return denied();
  const b = await req.json();
  const email = String(b.email || '').toLowerCase().trim();
  if (!b.name || !email || String(b.password || '').length < 8) {
    return json({ error: 'Name, email and a password of at least 8 characters are required.' }, 400);
  }
  try {
    const res = await q(
      "insert into users(name,email,password_hash,role) values($1,$2,$3,'faculty') returning id",
      [b.name.trim(), email, await bcrypt.hash(b.password, 10)]
    );
    const facultyId = res.rows[0].id;
    if (Array.isArray(b.subject_ids)) {
      for (const sid of b.subject_ids) {
        if (sid) {
          await q(
            'insert into faculty_subjects(faculty_id, subject_id) values($1,$2) on conflict do nothing',
            [facultyId, Number(sid)]
          );
        }
      }
    }
  } catch {
    return json({ error: 'That email is already registered.' }, 409);
  }
  return json({ ok: true });
}

export async function PUT(req) {
  if (!(await requireRole('admin'))) return denied();
  const b = await req.json();
  const facultyId = Number(b.faculty_id);
  const subjectIds = Array.isArray(b.subject_ids) ? b.subject_ids.map(Number).filter(Boolean) : [];
  if (!facultyId) return json({ error: 'Faculty ID required' }, 400);

  await q('delete from faculty_subjects where faculty_id=$1', [facultyId]);
  for (const sid of subjectIds) {
    await q(
      'insert into faculty_subjects(faculty_id, subject_id) values($1,$2) on conflict do nothing',
      [facultyId, sid]
    );
  }
  return json({ ok: true });
}

export async function DELETE(req) {
  if (!(await requireRole('admin'))) return denied();
  await q("delete from users where id=$1 and role='faculty'", [new URL(req.url).searchParams.get('id')]);
  return json({ ok: true });
}

