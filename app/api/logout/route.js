import { clearSession, json } from '@/lib/auth';
export async function POST() { clearSession(); return json({ ok: true }); }
