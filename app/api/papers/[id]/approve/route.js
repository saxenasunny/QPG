import { q } from '@/lib/db';
import { requireRole, json, denied, audit } from '@/lib/auth';

export async function POST(_req, { params }) {
  const s = await requireRole('admin');
  if (!s) return denied();
  const p = (await q('select created_by from generated_papers where id=$1', [params.id])).rows[0];
  if (!p) return json({ error: 'Paper not found.' }, 404);
  if (p.created_by === s.uid) return json({ error: 'A different admin must approve this paper.' }, 403);
  await q('insert into paper_approvals(paper_id, admin_id) values($1,$2) on conflict do nothing', [params.id, s.uid]);
  await audit(s.uid, 'approve', { paper: params.id });
  return json({ ok: true });
}
