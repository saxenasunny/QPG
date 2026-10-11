'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const f = new FormData(e.target);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server error (${res.status})` };
      }
      if (!res.ok) {
        setErr(data.error || 'Login failed. Please check your credentials.');
        return;
      }
      router.push(data.role === 'admin' ? '/admin' : '/faculty');
    } catch (err) {
      setErr(err.message || 'Connection error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <h1>Question Paper Generator</h1>
      <p className="muted">Sign in with the account your exam cell created for you.</p>
      <form className="card" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {err && <div className="msg err" role="alert">{err}</div>}
        <p><button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></p>
      </form>
    </main>
  );
}
