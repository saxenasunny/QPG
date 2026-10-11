import { q } from '@/lib/db';
import { requireRole, json, denied, audit } from '@/lib/auth';
import { decryptJSON } from '@/lib/crypto';
import { buildDocx } from '@/lib/paperDoc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req, { params }) {
  const s = await requireRole('admin');
  if (!s) return denied();
  const p = (await q('select * from generated_papers where id=$1', [params.id])).rows[0];
  if (!p) return json({ error: 'Paper not found.' }, 404);
  if (new Date(p.release_at) > new Date()) return json({ error: `Sealed until ${new Date(p.release_at).toISOString()}.` }, 423);
  const need = Number(process.env.REQUIRED_APPROVALS || 0);
  const have = (await q('select count(*)::int n from paper_approvals where paper_id=$1', [p.id])).rows[0].n;
  if (have < need) return json({ error: `Needs ${need} approval(s) from other admins; has ${have}.` }, 423);

  const data = decryptJSON(p.payload);
  const buf = await buildDocx({ meta: data.meta, paper: data.paper, ref: data.ref });
  await q('update generated_papers set downloads = downloads + 1 where id=$1', [p.id]);
  await audit(s.uid, 'download', { paper: p.id, ref: p.paper_ref });
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${data.meta.courseCode}_${p.paper_ref}${p.label ? '_' + p.label.replace(' ', '') : ''}.docx"`,
    },
  });
}
