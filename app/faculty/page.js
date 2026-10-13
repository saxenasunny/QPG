'use client';
import { useEffect, useState } from 'react';
import { api, logout, fmtDate, Msg, ShieldIcon, LogOutIcon, UploadIcon, DownloadIcon, TrashIcon } from '@/lib/client';

export default function Faculty() {
  const [me, setMe] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [formats, setFormats] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [kind, setKind] = useState('bank');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [m, s, f, u] = await Promise.all([
      api('/api/me'),
      api('/api/subjects'),
      api('/api/formats'),
      api('/api/uploads'),
    ]);
    if (m.ok) {
      if (m.data.role !== 'faculty') window.location.href = '/admin';
      setMe(m.data);
    }
    setSubjects(s.data || []);
    setFormats(f.data || []);
    setUploads(u.data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = e.target;
    const res = await api('/api/uploads', { method: 'POST', body: new FormData(form) });
    setBusy(false);
    if (!res.ok) return setMsg({ type: 'err', text: res.data.error, list: res.data.details });
    setMsg({
      type: res.data.warnings?.length ? 'warn' : 'ok',
      text: `Saved as ${kind === 'bank' ? 'Batch #' + res.data.set_no : 'Set 1'}: ${res.data.inserted} question(s) added successfully.`,
      list: res.data.warnings,
    });
    form.reset();
    setKind('bank');
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this submission and remove all questions it added?')) return;
    await api('/api/uploads?id=' + id, { method: 'DELETE' });
    load();
  }

  const paperSubmitted = (code) => uploads.some((u) => u.code === code && u.kind === 'paper');
  const bankCount = (code) => uploads.filter((u) => u.code === code && u.kind === 'bank').length;

  return (
    <>
      <header className="top-nav">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <ShieldIcon size={20} color="#ffffff" />
          </div>
          <div className="brand-title">
            QPG <span className="brand-badge">Faculty Portal</span>
          </div>
        </div>

        <div className="user-nav-box">
          <div className="user-profile-badge">
            <span className="avatar-circle">
              {me?.name ? me.name.charAt(0).toUpperCase() : 'F'}
            </span>
            <span>{me?.name}</span>
          </div>
          <button className="btn-signout" onClick={logout} title="Sign out">
            <LogOutIcon size={14} /> Sign out
          </button>
        </div>
      </header>

      <main className="main-wrapper">
        <div className="page-header">
          <h1>Submit Questions</h1>
          <p className="muted">
            Upload question banks on a regular basis to expand your subject's question pool, or upload a formatted ready paper (1 set max per assigned subject).
          </p>
        </div>

        {subjects.length === 0 && (
          <div className="msg-banner warn" role="alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <strong>No subjects assigned:</strong> You have not been assigned any subjects yet. Please contact the exam cell coordinator to assign your teaching subjects.
            </div>
          </div>
        )}

        <form className="card-box" onSubmit={submit}>
          <div className="card-header-flex">
            <h2>New Question Submission</h2>
            {kind === 'bank' && (
              <a href="/question-bank-template.xlsx" download className="btn btn-secondary btn-pill">
                <DownloadIcon size={13} /> Download Excel Template (.xlsx)
              </a>
            )}
          </div>

          <div className="seg-radio-group" role="radiogroup" aria-label="Upload type">
            <label className={`seg-radio-label ${kind === 'bank' ? 'active' : ''}`}>
              <input
                type="radio"
                name="kind"
                value="bank"
                checked={kind === 'bank'}
                onChange={() => setKind('bank')}
              />
              📊 Question Bank (.xlsx) &bull; Regular uploads
            </label>
            <label className={`seg-radio-label ${kind === 'paper' ? 'active' : ''}`}>
              <input
                type="radio"
                name="kind"
                value="paper"
                checked={kind === 'paper'}
                onChange={() => setKind('paper')}
              />
              📄 Ready Exam Paper (.docx) &bull; 1 Set Only
            </label>
          </div>

          <div className="form-grid">
            <div>
              <label htmlFor="subject_id">Assigned Subject</label>
              <select id="subject_id" name="subject_id" required defaultValue="" disabled={subjects.length === 0}>
                <option value="" disabled>
                  {subjects.length === 0 ? 'No assigned subjects' : 'Select an assigned subject'}
                </option>
                {subjects.map((s) => {
                  const hasPaper = paperSubmitted(s.code);
                  const banks = bankCount(s.code);
                  const disabled = kind === 'paper' && hasPaper;
                  return (
                    <option key={s.id} value={s.id} disabled={disabled}>
                      [{s.department || 'SOES'} &bull; {s.degree || 'General'} &bull; Sem {s.semester || '1'}] {s.code} &ndash; {s.name}{' '}
                      {kind === 'paper'
                        ? (hasPaper ? '✕ (Paper already submitted)' : '✓ (Paper slot open)')
                        : `(${banks} bank${banks === 1 ? '' : 's'} added)`}
                    </option>
                  );
                })}
              </select>
            </div>

            {kind === 'paper' && (
              <div>
                <label htmlFor="format_id">Target Paper Format</label>
                <select id="format_id" name="format_id" required defaultValue="">
                  <option value="" disabled>Choose paper format</option>
                  {formats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.config?.total_marks} Marks)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="file">
                {kind === 'bank' ? 'Excel File (.xlsx)' : 'Word Document (.docx)'}
              </label>
              <input
                id="file"
                name="file"
                type="file"
                required
                accept={kind === 'bank' ? '.xlsx' : '.docx'}
              />
            </div>
          </div>

          {kind === 'bank' ? (
            <p className="muted" style={{ marginBottom: '1.25rem' }}>
              First row in Excel must contain: <code>Qno</code>, <code>Question</code>, <code>Question Level</code> (BT1&ndash;6), and <code>CO</code>.
            </p>
          ) : (
            <p className="muted" style={{ marginBottom: '1.25rem' }}>
              Document must follow the standard table layout: <code>SECTION</code> headings, then numbered rows (Q.1, Q.2) with BT level and CO tags.
            </p>
          )}

          <Msg m={msg} />

          <button disabled={busy} style={{ minWidth: 150 }}>
            <UploadIcon size={16} /> {busy ? 'Validating file…' : 'Submit Questions'}
          </button>
        </form>

        <div className="card-box">
          <div className="card-header-flex">
            <h2>Your Submissions ({uploads.length})</h2>
          </div>

          {uploads.length === 0 ? (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p>No questions submitted yet. Select one of your assigned subjects above to upload.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Type / Batch</th>
                    <th>Questions</th>
                    <th>Uploaded At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.code}</strong>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{u.subject}</div>
                      </td>
                      <td>
                        {u.kind === 'bank' ? (
                          <span className="chip primary">
                            Question Bank &bull; Batch #{u.set_no}
                          </span>
                        ) : (
                          <span className="chip open">
                            Ready Paper (Set 1) &bull; {u.format || 'Format deleted'}
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{u.question_count}</strong> questions
                      </td>
                      <td className="muted">{fmtDate(u.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-danger btn-pill" onClick={() => remove(u.id)} title="Delete submission">
                          <TrashIcon size={13} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
