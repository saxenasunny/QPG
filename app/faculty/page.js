'use client';
import { useEffect, useState } from 'react';
import { api, logout, fmtDate, Msg } from '@/lib/client';

export default function Faculty() {
  const [me, setMe] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [formats, setFormats] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [kind, setKind] = useState('bank');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [m, s, f, u] = await Promise.all([api('/api/me'), api('/api/subjects'), api('/api/formats'), api('/api/uploads')]);
    if (m.ok) { if (m.data.role !== 'faculty') window.location.href = '/admin'; setMe(m.data); }
    setSubjects(s.data || []); setFormats(f.data || []); setUploads(u.data || []);
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const form = e.target;
    const res = await api('/api/uploads', { method: 'POST', body: new FormData(form) });
    setBusy(false);
    if (!res.ok) return setMsg({ type: 'err', text: res.data.error, list: res.data.details });
    setMsg({ type: res.data.warnings?.length ? 'warn' : 'ok', text: `Saved as Set ${res.data.set_no}: ${res.data.inserted} question(s) added.`, list: res.data.warnings });
    form.reset(); setKind('bank'); load();
  }

  async function remove(id) {
    if (!confirm('Delete this set and all questions it added?')) return;
    await api('/api/uploads?id=' + id, { method: 'DELETE' });
    load();
  }

  const used = (code) => uploads.filter((u) => u.code === code).length;

  return (
    <>
      <header className="top"><strong>Question Paper Generator</strong><span>{me?.name} <button onClick={logout} style={{ marginLeft: 12 }}>Sign out</button></span></header>
      <main className="wrap">
        <h1>Submit questions</h1>
        <p className="muted">You can submit 1 set of questions for each of your assigned subjects. Questions are stored for paper setting only; you and others cannot browse them afterwards.</p>

        {subjects.length === 0 && (
          <div className="msg warn" role="alert">
            No subjects have been assigned to your account yet. Please contact your exam cell administrator to assign subjects.
          </div>
        )}

        <form className="card" onSubmit={submit}>
          <h2>New upload</h2>
          <div className="seg" role="radiogroup" aria-label="Upload type">
            <label><input type="radio" name="kind" value="bank" checked={kind === 'bank'} onChange={() => setKind('bank')} />Question bank (Excel)</label>
            <label><input type="radio" name="kind" value="paper" checked={kind === 'paper'} onChange={() => setKind('paper')} />Ready paper (Word)</label>
          </div>
          <div className="row">
            <div>
              <label htmlFor="subject_id">Subject</label>
              <select id="subject_id" name="subject_id" required defaultValue="" disabled={subjects.length === 0}>
                <option value="" disabled>{subjects.length === 0 ? 'No assigned subjects' : 'Select assigned subject'}</option>
                {subjects.map((s) => {
                  const submitted = used(s.code) >= 1;
                  return (
                    <option key={s.id} value={s.id} disabled={submitted}>
                      {s.code} – {s.name} {submitted ? '✓ (Submitted)' : '(Pending)'}
                    </option>
                  );
                })}
              </select>
            </div>
            {kind === 'paper' && (
              <div>
                <label htmlFor="format_id">Paper format</label>
                <select id="format_id" name="format_id" required defaultValue="">
                  <option value="" disabled>Select format name</option>
                  {formats.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="file">{kind === 'bank' ? 'Excel file (.xlsx)' : 'Paper file (.docx)'}</label>
              <input id="file" name="file" type="file" required accept={kind === 'bank' ? '.xlsx' : '.docx'} />
            </div>
          </div>
          {kind === 'bank'
            ? <p className="muted">First row must be: Qno, Question, Question Level, CO. <a href="/question-bank-template.xlsx" download>Download template</a>. Level can be written as 1–6 or BT1–BT6.</p>
            : <p className="muted">Use the standard ETE paper layout: SECTION rows, then Q.1, Q.2… rows with the question, BT level and CO. Put OR between alternatives in the same row.</p>}
          <Msg m={msg} />
          <button disabled={busy}>{busy ? 'Checking file…' : 'Upload'}</button>
        </form>

        <div className="card scroll">
          <h2>Your uploads</h2>
          {uploads.length === 0 ? <p className="muted">Nothing uploaded yet. Choose a subject above to add your first set.</p> : (
            <table>
              <thead><tr><th>Subject</th><th>Set</th><th>Type</th><th>Questions</th><th>Uploaded</th><th></th></tr></thead>
              <tbody>{uploads.map((u) => (
                <tr key={u.id}>
                  <td>{u.code}<div className="muted">{u.subject}</div></td>
                  <td>{u.set_no}</td>
                  <td>{u.kind === 'bank' ? 'Question bank' : `Paper · ${u.format || 'format removed'}`}</td>
                  <td>{u.question_count}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td><button className="danger" onClick={() => remove(u.id)}>Delete</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
