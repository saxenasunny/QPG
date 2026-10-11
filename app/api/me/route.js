import { getSession, json } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const s = await getSession();
  return s ? json({ id: s.uid, role: s.role, name: s.name }) : json({ error: 'Not signed in' }, 401);
}
