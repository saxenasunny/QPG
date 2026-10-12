import { q } from '@/lib/db';
import { requireRole, json, denied, audit } from '@/lib/auth';
import { parseSubjectsFile } from '@/lib/bulkImport';

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
  const { items, errors } = await parseSubjectsFile(buffer, file.name);

  if (errors.length > 0 && items.length === 0) {
    return json({ error: 'File validation failed.', details: errors }, 422);
  }

  let inserted = 0;
  let skipped = 0;
  const warnings = [...errors];

  for (const item of items) {
    try {
      const res = await q(
        'insert into subjects(code, name, co_count) values($1, $2, $3) on conflict (code) do nothing',
        [item.code, item.name, item.co_count]
      );
      if (res.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
        warnings.push(`Subject ${item.code} already exists (skipped).`);
      }
    } catch (e) {
      warnings.push(`Subject ${item.code}: ${e.message}`);
    }
  }

  await audit(s.uid, 'bulk_import_subjects', { filename: file.name, inserted, skipped });

  return json({
    ok: true,
    inserted,
    skipped,
    total: items.length,
    warnings: warnings.slice(0, 50),
  });
}
