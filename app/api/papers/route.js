import { q } from '@/lib/db';
import { requireRole, json, denied } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await requireRole('admin');
  if (!s) return denied();
  const need = Number(process.env.REQUIRED_APPROVALS || 0);
  const r = await q(
    `select p.id, p.label, p.paper_ref, p.release_at, p.created_at, p.downloads, p.created_by,
            s.code, s.name as subject, f.name as format, u.name as creator,
            (select count(*)::int from paper_approvals a where a.paper_id=p.id) as approvals,
            exists(select 1 from paper_approvals a where a.paper_id=p.id and a.admin_id=$1) as approved_by_me
       from generated_papers p join subjects s on s.id=p.subject_id
       left join formats f on f.id=p.format_id left join users u on u.id=p.created_by
      order by p.created_at desc limit 100`,
    [s.uid]
  );
  return json(r.rows.map((p) => ({ ...p, required: need, released: new Date(p.release_at) <= new Date() && p.approvals >= need })));
}
