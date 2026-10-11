import { q, pool } from '@/lib/db';
import { requireRole, json, denied, audit } from '@/lib/auth';
import { parseBank } from '@/lib/parseExcel';
import { parseExamDocx } from '@/lib/parseDocx';
import { hashText, tokenSet, jaccard } from '@/lib/normalize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Counts only. Nobody can read question text through the app, not even admins.
export async function GET() {
  const s = await requireRole();
  if (!s) return denied();
  const admin = s.role === 'admin';
  const r = await q(
    `select u.id, u.set_no, u.kind, u.filename, u.question_count, u.warnings, u.created_at,
            s.code, s.name as subject, f.name as format, us.name as faculty
       from uploads u join subjects s on s.id=u.subject_id join users us on us.id=u.faculty_id
       left join formats f on f.id=u.format_id
      ${admin ? '' : 'where u.faculty_id=$1'} order by s.code, us.name, u.set_no`,
    admin ? [] : [s.uid]
  );
  return json(r.rows);
}

export async function POST(req) {
  const s = await requireRole('faculty');
  if (!s) return denied();
  const form = await req.formData();
  const file = form.get('file');
  const kind = form.get('kind');
  const subjectId = Number(form.get('subject_id'));
  const formatId = Number(form.get('format_id')) || null;
  if (!file || typeof file === 'string') return json({ error: 'Choose a file to upload.' }, 400);
  if (!['bank', 'paper'].includes(kind)) return json({ error: 'Choose what you are uploading.' }, 400);

  const subj = (await q('select * from subjects where id=$1', [subjectId])).rows[0];
  if (!subj) return json({ error: 'Choose a subject.' }, 400);

  const assigned = await q('select 1 from faculty_subjects where faculty_id=$1 and subject_id=$2', [s.uid, subjectId]);
  if (!assigned.rowCount) {
    return json({ error: `Subject ${subj.code} is not assigned to you. You can only submit questions for subjects assigned to you by the admin.` }, 403);
  }

  const alreadySubmitted = await q('select id from uploads where faculty_id=$1 and subject_id=$2', [s.uid, subjectId]);
  if (alreadySubmitted.rowCount >= 1) {
    return json({ error: `You have already submitted your set for ${subj.code}. You can submit only 1 set per assigned subject. Delete your existing submission below if you need to re-upload.` }, 409);
  }
  const setNo = 1;

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed, format = null;
  if (kind === 'bank') {
    parsed = await parseBank(buffer, subj.co_count);
    parsed.warnings = [];
  } else {
    if (!formatId) return json({ error: 'Select the paper format.' }, 400);
    const f = (await q('select * from formats where id=$1', [formatId])).rows[0];
    if (!f) return json({ error: 'That format no longer exists.' }, 400);
    format = { name: f.name, ...f.config };
    parsed = await parseExamDocx(buffer, { format, subjectCode: subj.code, coCount: subj.co_count });
  }
  if (parsed.errors.length) return json({ error: 'Fix these and upload again.', details: parsed.errors.slice(0, 40) }, 422);

  const warnings = [...(parsed.warnings || [])];
  const existing = (await q('select text from questions where subject_id=$1', [subjectId])).rows.map((r) => tokenSet(r.text));
  let nearDup = 0;
  for (const qq of parsed.questions) {
    const t = tokenSet(qq.text);
    if (existing.some((e) => jaccard(e, t) >= 0.85)) nearDup++;
  }
  if (nearDup) warnings.push(`${nearDup} question(s) look very similar to questions already in the pool.`);

  const client = await pool.connect();
  let inserted = 0, dup = 0;
  try {
    await client.query('begin');
    const up = await client.query(
      'insert into uploads(faculty_id, subject_id, set_no, kind, format_id, filename) values($1,$2,$3,$4,$5,$6) returning id',
      [s.uid, subjectId, setNo, kind, formatId, file.name]
    );
    for (const qq of parsed.questions) {
      const r = await client.query(
        `insert into questions(upload_id, subject_id, faculty_id, qno, text, level, co, section, image, text_hash)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (subject_id, text_hash) do nothing`,
        [up.rows[0].id, subjectId, s.uid, qq.qno, qq.text, qq.level, qq.co, qq.section, qq.image, hashText(qq.text)]
      );
      r.rowCount ? inserted++ : dup++;
    }
    if (dup) warnings.push(`${dup} question(s) were skipped because the same question is already in the pool.`);
    await client.query('update uploads set question_count=$1, warnings=$2 where id=$3', [inserted, JSON.stringify(warnings), up.rows[0].id]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    return json({ error: 'Upload failed. Try again.' }, 500);
  } finally {
    client.release();
  }
  await audit(s.uid, 'upload', { subject: subj.code, kind, set: setNo, inserted });
  return json({ ok: true, set_no: setNo, inserted, warnings });
}

export async function DELETE(req) {
  const s = await requireRole();
  if (!s) return denied();
  const id = new URL(req.url).searchParams.get('id');
  const r = await q(`delete from uploads where id=$1 ${s.role === 'admin' ? '' : 'and faculty_id=$2'}`, s.role === 'admin' ? [id] : [id, s.uid]);
  await audit(s.uid, 'delete_upload', { id });
  return json({ ok: r.rowCount > 0 });
}
