'use client';
import { useEffect, useState } from 'react';
import { api, logout, fmtDate, Msg } from '@/lib/client';

const TABS = ['Generate', 'Papers', 'Formats', 'Subjects', 'Faculty', 'Uploads'];

export default function Admin() {
  const [tab, setTab] = useState('Generate');
  const [me, setMe] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [formats, setFormats] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [papers, setPapers] = useState([]);

  async function load() {
    const [m, s, f, fa, u, p] = await Promise.all([api('/api/me'), api('/api/subjects'), api('/api/formats'), api('/api/faculty'), api('/api/uploads'), api('/api/papers')]);
    if (m.ok) { if (m.data.role !== 'admin') window.location.href = '/faculty'; setMe(m.data); }
    setSubjects(s.data || []); setFormats(f.data || []); setFaculty(fa.data || []); setUploads(u.data || []); setPapers(p.data || []);
  }
  useEffect(() => { load(); }, []);

  const props = { subjects, formats, faculty, uploads, papers, reload: load, me };
  return (
    <>
      <header className="top"><strong>Question Paper Generator · Admin</strong><span>{me?.name} <button onClick={logout} style={{ marginLeft: 12 }}>Sign out</button></span></header>
      <main className="wrap">
        <div className="tabs" role="tablist">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        {tab === 'Generate' && <Generate {...props} />}
        {tab === 'Papers' && <Papers {...props} />}
        {tab === 'Formats' && <Formats {...props} />}
        {tab === 'Subjects' && <Subjects {...props} />}
        {tab === 'Faculty' && <Faculty {...props} />}
        {tab === 'Uploads' && <Uploads {...props} />}
      </main>
    </>
  );
}

function poolSize(uploads, code) {
  return uploads.filter((u) => u.code === code).reduce((a, u) => a + u.question_count, 0);
}

function Generate({ subjects, formats, uploads, reload }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const subj = subjects.find((s) => String(s.id) === String(subjectId));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const f = new FormData(e.target);
    const body = Object.fromEntries(f.entries());
    body.allow_images = f.get('allow_images') === 'on';
    body.release_at = new Date(body.release_at).toISOString();
    const res = await api('/api/generate', { method: 'POST', body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setMsg({ type: 'err', text: res.data.error });
    setMsg({
      type: 'ok',
      text: `Paper sealed. Nobody, including you, can open it before ${fmtDate(res.data.release_at)}.`,
      list: res.data.papers.map((p) => `${p.ref}${p.label ? ' (' + p.label + ')' : ''} – covers CO ${p.coverage.cos.join(', ')}`),
    });
    reload();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Make a final paper</h2>
      <p className="muted">The paper is picked at random, encrypted and sealed in one step. You will not see the questions.</p>
      <div className="row">
        <div>
          <label htmlFor="g_subject">Subject</label>
          <select id="g_subject" name="subject_id" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="" disabled>Select subject code</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
          </select>
          {subj && <div className="muted">{poolSize(uploads, subj.code)} questions in the pool</div>}
        </div>
        <div>
          <label htmlFor="g_format">Paper format</label>
          <select id="g_format" name="format_id" required defaultValue="">
            <option value="" disabled>Select format</option>
            {formats.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="g_source">Take questions from</label>
          <select id="g_source" name="source" defaultValue="both">
            <option value="both">Question banks and uploaded papers</option>
            <option value="bank">Question banks only</option>
            <option value="paper">Uploaded papers only</option>
          </select>
        </div>
        <div>
          <label htmlFor="g_versions">Number of sets</label>
          <select id="g_versions" name="versions" defaultValue="1">
            <option value="1">1 paper</option><option value="2">2 sets (A, B)</option><option value="3">3 sets (A, B, C)</option>
          </select>
        </div>
        <div>
          <label htmlFor="g_release">Unlock at</label>
          <input id="g_release" name="release_at" type="datetime-local" required />
        </div>
        <div>
          <label htmlFor="g_title">Exam title</label>
          <input id="g_title" name="exam_title" defaultValue="End Term Examination – December 2026" />
        </div>
        <div>
          <label htmlFor="g_degree">Degree programme</label>
          <input id="g_degree" name="degree" placeholder="BCA/MCA" />
        </div>
        <div>
          <label htmlFor="g_sem">Semester</label>
          <input id="g_sem" name="semester" placeholder="I" />
        </div>
      </div>
      <label style={{ fontWeight: 500 }}><input type="checkbox" name="allow_images" />Allow questions that contain images (diagrams are embedded in the paper)</label>
      <Msg m={msg} />
      <button disabled={busy}>{busy ? 'Building…' : 'Build and seal paper'}</button>
    </form>
  );
}

function Papers({ papers, reload }) {
  const [msg, setMsg] = useState(null);
  async function approve(id) {
    const r = await api(`/api/papers/${id}/approve`, { method: 'POST' });
    setMsg(r.ok ? { type: 'ok', text: 'Approved.' } : { type: 'err', text: r.data.error });
    reload();
  }
  async function download(p) {
    const r = await fetch(`/api/papers/${p.id}/download`);
    if (!r.ok) { const d = await r.json(); return setMsg({ type: 'err', text: d.error }); }
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.code}_${p.paper_ref}${p.label ? '_' + p.label.replace(' ', '') : ''}.docx`;
    a.click();
    reload();
  }
  return (
    <div className="card scroll">
      <h2>Sealed papers</h2>
      <Msg m={msg} />
      {papers.length === 0 ? <p className="muted">No papers yet. Use Generate to make one.</p> : (
        <table>
          <thead><tr><th>Paper</th><th>Subject</th><th>Unlocks</th><th>Status</th><th></th></tr></thead>
          <tbody>{papers.map((p) => {
            const timeOpen = new Date(p.release_at) <= new Date();
            const needsApproval = p.approvals < p.required;
            return (
              <tr key={p.id}>
                <td>{p.paper_ref}{p.label && ` · ${p.label}`}<div className="muted">made by {p.creator}</div></td>
                <td>{p.code}<div className="muted">{p.format}</div></td>
                <td>{fmtDate(p.release_at)}</td>
                <td>
                  {!timeOpen ? <span className="chip sealed">Sealed</span>
                    : needsApproval ? <span className="chip wait">Needs approval {p.approvals}/{p.required}</span>
                    : <span className="chip open">Open</span>}
                  {p.downloads > 0 && <div className="muted">downloaded {p.downloads}×</div>}
                </td>
                <td>
                  {p.released && <button onClick={() => download(p)}>Download</button>}
                  {timeOpen && needsApproval && !p.approved_by_me && <button className="ghost" onClick={() => approve(p.id)}>Approve</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </div>
  );
}

const blankSec = () => ({ name: '', count: 1, marks_each: 5, levels: '1,2,3', has_or: false, mix: '' });

function Formats({ formats, reload }) {
  const [msg, setMsg] = useState(null);
  const [secs, setSecs] = useState([{ name: 'A', count: 4, marks_each: 6, levels: '1,2,3', has_or: false, mix: '' }]);
  const total = secs.reduce((a, s) => a + (Number(s.count) || 0) * (Number(s.marks_each) || 0), 0);
  const set = (i, k, v) => setSecs(secs.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const sections = secs.map((s) => ({
      name: s.name, count: Number(s.count), marks_each: Number(s.marks_each), has_or: s.has_or,
      levels: s.levels.split(',').map((x) => Number(x.trim())).filter(Boolean),
      level_mix: Object.fromEntries(s.mix.split(',').map((p) => p.split(':').map((x) => x.trim())).filter((p) => p.length === 2 && p[0] && p[1])),
    }));
    const res = await api('/api/formats', {
      method: 'POST',
      body: JSON.stringify({ name: f.get('name'), config: { total_marks: total, duration: f.get('duration'), degree: f.get('degree'), instructions: f.get('instructions'), sections } }),
    });
    setMsg(res.ok ? { type: 'ok', text: 'Format saved.' } : { type: 'err', text: res.data.error });
    if (res.ok) reload();
  }
  async function remove(id) {
    if (!confirm('Delete this format?')) return;
    await api('/api/formats?id=' + id, { method: 'DELETE' }); reload();
  }

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>New paper format</h2>
        <p className="muted">A format says which BT levels go in each section, how many questions it has and the marks. Faculty pick a format when uploading a ready paper; you pick one when making the final paper.</p>
        <div className="row">
          <div><label htmlFor="f_name">Format name</label><input id="f_name" name="name" required placeholder="ETE-60 (BCA/MCA)" /></div>
          <div><label htmlFor="f_dur">Duration</label><input id="f_dur" name="duration" defaultValue="3 Hrs" /></div>
          <div><label htmlFor="f_deg">Degree programme</label><input id="f_deg" name="degree" placeholder="optional" /></div>
        </div>
        <label htmlFor="f_ins">Instructions printed on the paper</label>
        <textarea id="f_ins" name="instructions" rows={2} defaultValue="Attempt all questions." />
        <h3 style={{ marginTop: '1rem' }}>Sections</h3>
        {secs.map((s, i) => (
          <div className="sec-row" key={i}>
            <div><label>Section</label><input value={s.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="A" /></div>
            <div><label>Questions</label><input type="number" min="1" value={s.count} onChange={(e) => set(i, 'count', e.target.value)} /></div>
            <div><label>Marks each</label><input type="number" min="1" value={s.marks_each} onChange={(e) => set(i, 'marks_each', e.target.value)} /></div>
            <div><label>BT levels allowed</label><input value={s.levels} onChange={(e) => set(i, 'levels', e.target.value)} placeholder="1,2,3" /></div>
            <div><label>Exact mix (optional)</label><input value={s.mix} onChange={(e) => set(i, 'mix', e.target.value)} placeholder="1:1,2:2,3:1" /></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ margin: 0, fontWeight: 500 }}><input type="checkbox" checked={s.has_or} onChange={(e) => set(i, 'has_or', e.target.checked)} />OR</label>
              {secs.length > 1 && <button type="button" className="danger" onClick={() => setSecs(secs.filter((_, j) => j !== i))} aria-label={`Remove section ${s.name}`}>×</button>}
            </div>
          </div>
        ))}
        <p><button type="button" className="ghost" onClick={() => setSecs([...secs, blankSec()])}>Add section</button> <span className="muted">Total marks: {total}</span></p>
        <Msg m={msg} />
        <button>Save format</button>
      </form>

      <div className="card scroll">
        <h2>Saved formats</h2>
        <table>
          <thead><tr><th>Name</th><th>Sections</th><th>Marks</th><th></th></tr></thead>
          <tbody>{formats.map((f) => (
            <tr key={f.id}>
              <td>{f.name}</td>
              <td>{f.config.sections.map((s) => `${s.name}: ${s.count}×${s.marks_each}${s.has_or ? ' (OR)' : ''} · ${s.levels.map((l) => 'BT' + l).join('/')}`).join('  |  ')}</td>
              <td>{f.config.total_marks}</td>
              <td><button className="danger" onClick={() => remove(f.id)}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

function Subjects({ subjects, reload }) {
  const [msg, setMsg] = useState(null);
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api('/api/subjects', { method: 'POST', body: JSON.stringify(Object.fromEntries(f.entries())) });
    setMsg(res.ok ? { type: 'ok', text: 'Subject added.' } : { type: 'err', text: res.data.error });
    if (res.ok) { e.target.reset(); reload(); }
  }
  async function remove(s) {
    if (!confirm(`Delete ${s.code} and every question under it?`)) return;
    await api('/api/subjects?id=' + s.id, { method: 'DELETE' }); reload();
  }
  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>Add subject</h2>
        <div className="row">
          <div><label htmlFor="s_code">Subject code</label><input id="s_code" name="code" required placeholder="CAP1005" /></div>
          <div><label htmlFor="s_name">Subject name</label><input id="s_name" name="name" required placeholder="Programming and Problem Solving Using C" /></div>
          <div><label htmlFor="s_co">Number of COs</label><input id="s_co" name="co_count" type="number" min="1" max="10" defaultValue="5" /></div>
        </div>
        <Msg m={msg} />
        <button>Add subject</button>
      </form>
      <div className="card scroll">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>COs</th><th></th></tr></thead>
          <tbody>{subjects.map((s) => <tr key={s.id}><td>{s.code}</td><td>{s.name}</td><td>{s.co_count}</td><td><button className="danger" onClick={() => remove(s)}>Delete</button></td></tr>)}</tbody>
        </table>
        {subjects.length === 0 && <p className="muted">No subjects yet.</p>}
      </div>
    </>
  );
}

function Faculty({ faculty, subjects, reload }) {
  const [msg, setMsg] = useState(null);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState([]);

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const subject_ids = f.getAll('subject_ids').map(Number);
    const body = {
      name: f.get('name'),
      email: f.get('email'),
      password: f.get('password'),
      subject_ids,
    };
    const res = await api('/api/faculty', { method: 'POST', body: JSON.stringify(body) });
    setMsg(res.ok ? { type: 'ok', text: 'Faculty account created with assigned subjects. Share the password with them securely.' } : { type: 'err', text: res.data.error });
    if (res.ok) { e.target.reset(); reload(); }
  }

  function startEdit(u) {
    setEditingFaculty(u);
    setSelectedSubs((u.assigned_subjects || []).map((s) => s.id));
  }

  async function saveAssignments(e) {
    e.preventDefault();
    const res = await api('/api/faculty', {
      method: 'PUT',
      body: JSON.stringify({ faculty_id: editingFaculty.id, subject_ids: selectedSubs }),
    });
    setMsg(res.ok ? { type: 'ok', text: `Assigned subjects updated for ${editingFaculty.name}.` } : { type: 'err', text: res.data.error });
    if (res.ok) {
      setEditingFaculty(null);
      reload();
    }
  }

  async function remove(u) {
    if (!confirm(`Delete ${u.name} and all questions they uploaded?`)) return;
    await api('/api/faculty?id=' + u.id, { method: 'DELETE' }); reload();
  }

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>Add faculty</h2>
        <div className="row">
          <div><label htmlFor="u_name">Name</label><input id="u_name" name="name" required /></div>
          <div><label htmlFor="u_email">Email</label><input id="u_email" name="email" type="email" required /></div>
          <div><label htmlFor="u_pw">Temporary password</label><input id="u_pw" name="password" type="text" minLength={8} required /></div>
        </div>

        <label style={{ marginTop: '0.8rem', fontWeight: 600 }}>Assign subjects (optional):</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
          {subjects.map((s) => (
            <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', margin: 0, padding: '0.35rem 0.65rem', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
              <input type="checkbox" name="subject_ids" value={s.id} />
              {s.code} – {s.name}
            </label>
          ))}
          {subjects.length === 0 && <span className="muted">No subjects created yet. Add subjects in the Subjects tab first.</span>}
        </div>

        <Msg m={msg} />
        <button>Create account</button>
      </form>

      {editingFaculty && (
        <form className="card" onSubmit={saveAssignments} style={{ border: '2px solid var(--ink)' }}>
          <h3>Assign subjects to {editingFaculty.name}</h3>
          <p className="muted">Faculty can only submit 1 set of questions for subjects assigned to them.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.8rem 0' }}>
            {subjects.map((s) => {
              const checked = selectedSubs.includes(s.id);
              return (
                <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', margin: 0, padding: '0.35rem 0.65rem', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: checked ? '#eef8f2' : '#fff' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedSubs([...selectedSubs, s.id]);
                      else setSelectedSubs(selectedSubs.filter((id) => id !== s.id));
                    }}
                  />
                  <strong>{s.code}</strong> – {s.name}
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit">Save assignments</button>
            <button type="button" className="ghost" onClick={() => setEditingFaculty(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card scroll">
        <h2>Faculty accounts</h2>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Assigned Subjects</th><th></th></tr></thead>
          <tbody>{faculty.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                {(u.assigned_subjects || []).length === 0 ? (
                  <span className="muted">None assigned</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(u.assigned_subjects || []).map((s) => (
                      <span key={s.id} className="chip" title={s.name}>
                        {s.code}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="ghost" style={{ marginRight: 6 }} onClick={() => startEdit(u)}>Assign subjects</button>
                <button className="danger" onClick={() => remove(u)}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {faculty.length === 0 && <p className="muted">No faculty accounts yet.</p>}
      </div>
    </>
  );
}

function Uploads({ uploads }) {
  return (
    <div className="card scroll">
      <h2>Submissions</h2>
      <p className="muted">Counts only. Question text is not shown anywhere in the app.</p>
      <table>
        <thead><tr><th>Subject</th><th>Faculty</th><th>Set</th><th>Type</th><th>Questions</th><th>Notes</th></tr></thead>
        <tbody>{uploads.map((u) => (
          <tr key={u.id}>
            <td>{u.code}</td><td>{u.faculty}</td><td>{u.set_no}</td>
            <td>{u.kind === 'bank' ? 'Bank' : `Paper · ${u.format || '—'}`}</td><td>{u.question_count}</td>
            <td>{(u.warnings || []).length ? (u.warnings || []).join(' ') : ''}</td>
          </tr>
        ))}</tbody>
      </table>
      {uploads.length === 0 && <p className="muted">Nothing submitted yet.</p>}
    </div>
  );
}
