'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldIcon } from '@/lib/client';

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
    <div className="login-container">
      <main className="login-card">
        <div className="login-header">
          <div className="shield-badge">
            <ShieldIcon size={26} color="#ffffff" />
          </div>
          <h1>Exam Cell Portal</h1>
          <p>Confidential question paper generation and sealed delivery system</p>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: '1.1rem' }}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="e.g. admin@college.edu"
              required
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your account password"
              required
            />
          </div>

          {err && (
            <div className="msg-banner err" role="alert" style={{ marginBottom: '1.25rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>{err}</div>
            </div>
          )}

          <button className="btn-login-submit" disabled={busy}>
            {busy ? 'Authenticating…' : 'Sign in to Portal'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.76rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
          🔒 AES-256-GCM Timelocked Encryption &bull; Zero-Knowledge Paper Setting
        </div>
      </main>
    </div>
  );
}
