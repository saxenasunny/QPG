import { q } from '@/lib/db';
import { requireRole, json, denied, audit } from '@/lib/auth';
import { generatePapers, coverage } from '@/lib/generator';
import { encryptJSON, newPaperRef } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The paper is built, encrypted and stored in one step. The response never contains question text.
export async function POST(req) {
  const s = await requireRole('admin');
  if (!s) return denied();
  const b = await req.json();
  const versions = Math.min(3, Math.max(1, Number(b.versions) || 1));
  const release = new Date(b.release_at);
  if (isNaN(release) || release < new Date()) return json({ error: 'Choose a release time in the future.' }, 400);

  const subj = (await q('select * from subjects where id=$1', [b.subject_id])).rows[0];
  const fmt = (await q('select * from formats where id=$1', [b.format_id])).rows[0];
  if (!subj || !fmt) return json({ error: 'Choose a subject and a format.' }, 400);
  const source = ['bank', 'paper', 'both'].includes(b.source) ? b.source : 'both';

  const pool = (
    await q(
      `select qs.id, qs.text, qs.level, qs.co, qs.image, qs.times_used, qs.faculty_id
         from questions qs join uploads u on u.id=qs.upload_id
        where qs.subject_id=$1 and qs.co <= $2 and ($3='both' or u.kind=$3) and ($4 or qs.image is null)`,
      [subj.id, subj.co_count, source, !!b.allow_images]
    )
  ).rows;

  let papers;
  try {
    papers = generatePapers(pool, fmt.config, versions);
  } catch (e) {
    return json({ error: e.message }, 422);
  }

  const out = [];
  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    const ref = newPaperRef();
    const label = versions > 1 ? `Set ${'ABC'[i]}` : '';
    const meta = {
      institute: process.env.INSTITUTE_NAME || '', examTitle: b.exam_title || 'End Term Examination',
      courseCode: subj.code, courseTitle: subj.name, degree: b.degree || fmt.config.degree || '',
      semester: b.semester || '', time: fmt.config.duration || '3 Hrs', maxMarks: fmt.config.total_marks,
      instructions: fmt.config.instructions || 'Attempt all questions.', label,
    };
    const payload = encryptJSON({ meta, paper: { sections: p.sections }, ref });
    const ins = await q(
      'insert into generated_papers(subject_id, format_id, label, paper_ref, created_by, release_at, payload) values($1,$2,$3,$4,$5,$6,$7) returning id',
      [subj.id, fmt.id, label, ref, s.uid, release, payload]
    );
    await q('update questions set times_used = times_used + 1 where id = any($1::int[])', [p.ids]);
    out.push({ id: ins.rows[0].id, label, ref, coverage: coverage({ sections: p.sections }) });
  }
  await audit(s.uid, 'generate', { subject: subj.code, format: fmt.name, versions });
  return json({ ok: true, papers: out, release_at: release });
}
