import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { requireRole, json, denied, audit } from '@/lib/auth';
import { parseFacultyFile } from '@/lib/bulkImport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  const s = await requireRole('admin');
  if (!s) return denied();

  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'Please choose an Excel (.xlsx) or CSV file to upload.' }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { items, errors } = await parseFacultyFile(buffer, file.name);

  if (errors.length > 0 && items.length === 0) {
    return json({ error: 'File validation failed.', details: errors }, 422);
  }

  const allSubjects = (await q('select id, code from subjects')).rows;
  const subjectMap = new Map(allSubjects.map((sub) => [sub.code.toUpperCase(), sub.id]));

  let inserted = 0;
  let skipped = 0;
  const warnings = [...errors];

  for (const item of items) {
    try {
      const hash = await bcrypt.hash(item.password, 10);
      const res = await q(
        "insert into users(name, email, password_hash, role) values($1, $2, $3, 'faculty') on conflict (email) do nothing returning id",
        [item.name, item.email, hash]
      );

      let facultyId = res.rows[0]?.id;

      if (!facultyId) {
        skipped++;
        warnings.push(`${item.email} is already registered (skipped user creation).`);
        const existing = await q('select id from users where email=$1', [item.email]);
        facultyId = existing.rows[0]?.id;
      } else {
        inserted++;
      }

      if (facultyId && item.subjectCodes.length > 0) {
        for (const code of item.subjectCodes) {
          const subId = subjectMap.get(code);
          if (subId) {
            await q(
              'insert into faculty_subjects(faculty_id, subject_id) values($1, $2) on conflict do nothing',
              [facultyId, subId]
            );
          } else {
            warnings.push(`Row for ${item.email}: Subject code "${code}" was not found in subjects.`);
          }
        }
      }
    } catch (e) {
      warnings.push(`Faculty ${item.email}: ${e.message}`);
    }
  }

  await audit(s.uid, 'bulk_import_faculty', { filename: file.name, inserted, skipped });

  return json({
    ok: true,
    inserted,
    skipped,
    total: items.length,
    warnings: warnings.slice(0, 50),
  });
}
