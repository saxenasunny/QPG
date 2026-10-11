'use client';

export async function api(url, opts = {}) {
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401) { window.location.href = '/'; }
  return { ok: res.ok, status: res.status, data };
}

export async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

export const fmtDate = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function Msg({ m }) {
  if (!m) return null;
  return (
    <div className={`msg ${m.type}`} role={m.type === 'err' ? 'alert' : 'status'}>
      {m.text}
      {m.list?.length > 0 && <ul>{m.list.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </div>
  );
}
