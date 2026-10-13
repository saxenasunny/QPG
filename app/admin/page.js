'use client';
import { useEffect, useState } from 'react';
import {
  api,
  logout,
  fmtDate,
  Msg,
  ShieldIcon,
  DownloadIcon,
  UploadIcon,
  LockIcon,
  UnlockIcon,
  TrashIcon,
  LogOutIcon,
} from '@/lib/client';

const TABS = [
  { id: 'Generate', label: 'Generate Paper', icon: '⚡' },
  { id: 'Papers', label: 'Sealed Papers', icon: '🔒' },
  { id: 'Formats', label: 'Exam Formats', icon: '📐' },
  { id: 'Subjects', label: 'Subjects', icon: '📚' },
  { id: 'Faculty', label: 'Faculty', icon: '👥' },
  { id: 'Uploads', label: 'Submissions', icon: '📤' },
];

export default function Admin() {
  const [tab, setTab] = useState('Generate');
  const [me, setMe] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [formats, setFormats] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [papers, setPapers] = useState([]);

  async function load() {
    const [m, s, f, fa, u, p] = await Promise.all([
      api('/api/me'),
      api('/api/subjects'),
      api('/api/formats'),
      api('/api/faculty'),
      api('/api/uploads'),
      api('/api/papers'),
    ]);
    if (m.ok) {
      if (m.data.role !== 'admin') window.location.href = '/faculty';
      setMe(m.data);
    }
    setSubjects(s.data || []);
    setFormats(f.data || []);
    setFaculty(fa.data || []);
    setUploads(u.data || []);
    setPapers(p.data || []);
  }

  useEffect(() => {
    load();
  }, []);

  const props = { subjects, formats, faculty, uploads, papers, reload: load, me };

  return (
    <>
      <header className="top-nav">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <ShieldIcon size={20} color="#ffffff" />
          </div>
          <div className="brand-title">
            QPG <span className="brand-badge">Exam Cell Admin</span>
          </div>
        </div>

        <div className="user-nav-box">
          <div className="user-profile-badge">
            <span className="avatar-circle">
              {me?.name ? me.name.charAt(0).toUpperCase() : 'A'}
            </span>
            <span>{me?.name}</span>
          </div>
          <button className="btn-signout" onClick={logout} title="Sign out">
            <LogOutIcon size={14} /> Sign out
          </button>
        </div>
      </header>

      <main className="main-wrapper">
        <div className="tabs-nav" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="tab-btn"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.id === 'Papers' && papers.length > 0 && (
                <span className="chip" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>{papers.length}</span>
              )}
              {t.id === 'Subjects' && subjects.length > 0 && (
                <span className="chip" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>{subjects.length}</span>
              )}
              {t.id === 'Faculty' && faculty.length > 0 && (
                <span className="chip" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>{faculty.length}</span>
              )}
            </button>
          ))}
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
    setBusy(true);
    setMsg(null);
    const f = new FormData(e.target);
    const body = Object.fromEntries(f.entries());
    body.allow_images = f.get('allow_images') === 'on';
    body.release_at = new Date(body.release_at).toISOString();
    const res = await api('/api/generate', { method: 'POST', body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setMsg({ type: 'err', text: res.data.error });
    setMsg({
      type: 'ok',
      text: `Paper generated & sealed. It is locked with AES-256-GCM encryption and cannot be opened before ${fmtDate(res.data.release_at)}.`,
      list: res.data.papers.map(
        (p) => `${p.ref}${p.label ? ' (' + p.label + ')' : ''} &bull; Covers Course Outcomes: CO ${p.coverage.cos.join(', ')}`
      ),
    });
    reload();
  }

  return (
    <form className="card-box" onSubmit={submit}>
      <div className="card-header-flex">
        <div>
          <h2>Generate &amp; Seal Question Paper</h2>
          <p className="muted">
            The server algorithm selects questions with weighted randomness, balances Course Outcomes, and seals the result under AES-256-GCM encryption.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label htmlFor="g_subject">Subject Code &amp; Title</label>
          <select
            id="g_subject"
            name="subject_id"
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="" disabled>Select course subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} &ndash; {s.name}
              </option>
            ))}
          </select>
          {subj && (
            <div style={{ marginTop: '0.4rem' }}>
              <span className="chip primary">
                📊 {poolSize(uploads, subj.code)} questions in pool
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="g_format">Exam Paper Format</label>
          <select id="g_format" name="format_id" required defaultValue="">
            <option value="" disabled>Choose paper format</option>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.config?.total_marks} Marks, {f.config?.duration})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="g_source">Question Source Pool</label>
          <select id="g_source" name="source" defaultValue="both">
            <option value="both">Both Question Banks &amp; Uploaded Papers</option>
            <option value="bank">Question Banks only</option>
            <option value="paper">Uploaded Papers only</option>
          </select>
        </div>

        <div>
          <label htmlFor="g_versions">Number of Distinct Sets</label>
          <select id="g_versions" name="versions" defaultValue="1">
            <option value="1">1 Paper</option>
            <option value="2">2 Sets (Set A, Set B &bull; Zero overlap)</option>
            <option value="3">3 Sets (Set A, Set B, Set C &bull; Zero overlap)</option>
          </select>
        </div>

        <div>
          <label htmlFor="g_release">Timelock Unlock Date &amp; Time</label>
          <input id="g_release" name="release_at" type="datetime-local" required />
        </div>

        <div>
          <label htmlFor="g_title">Exam Title (Header)</label>
          <input
            id="g_title"
            name="exam_title"
            defaultValue="End Term Examination – December 2026"
          />
        </div>

        <div>
          <label htmlFor="g_degree">Degree Programme</label>
          <input id="g_degree" name="degree" placeholder="e.g. BCA / MCA / B.Tech" />
        </div>

        <div>
          <label htmlFor="g_sem">Semester</label>
          <input id="g_sem" name="semester" placeholder="e.g. I, III, V" />
        </div>
      </div>

      <div style={{ margin: '0.85rem 0 1.25rem' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, cursor: 'pointer' }}>
          <input type="checkbox" name="allow_images" />
          <span>Allow questions with diagrams / figures (images are embedded into final Word paper)</span>
        </label>
      </div>

      <Msg m={msg} />

      <button disabled={busy} style={{ minWidth: 180 }}>
        <LockIcon size={16} /> {busy ? 'Generating & Sealing…' : 'Build & Seal Question Paper'}
      </button>
    </form>
  );
}

function Papers({ papers, reload }) {
  const [msg, setMsg] = useState(null);

  async function approve(id) {
    const r = await api(`/api/papers/${id}/approve`, { method: 'POST' });
    setMsg(r.ok ? { type: 'ok', text: 'Paper approved successfully.' } : { type: 'err', text: r.data.error });
    reload();
  }

  async function download(p) {
    const r = await fetch(`/api/papers/${p.id}/download`);
    if (!r.ok) {
      const d = await r.json();
      return setMsg({ type: 'err', text: d.error });
    }
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.code}_${p.paper_ref}${p.label ? '_' + p.label.replace(' ', '') : ''}.docx`;
    a.click();
    reload();
  }

  return (
    <div className="card-box">
      <div className="card-header-flex">
        <div>
          <h2>Sealed Question Papers ({papers.length})</h2>
          <p className="muted">
            Generated papers are encrypted. They cannot be decrypted or downloaded until the unlock time and required approvals are met.
          </p>
        </div>
      </div>

      <Msg m={msg} />

      {papers.length === 0 ? (
        <div className="empty-state">
          <LockIcon size={38} color="#94a3b8" />
          <p>No sealed papers created yet. Switch to the <strong>Generate Paper</strong> tab to build one.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Paper Reference</th>
                <th>Subject &amp; Format</th>
                <th>Unlock Time</th>
                <th>Security Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((p) => {
                const timeOpen = new Date(p.release_at) <= new Date();
                const needsApproval = p.approvals < p.required;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.paper_ref}</strong>
                      {p.label && <span className="chip primary" style={{ marginLeft: 6 }}>{p.label}</span>}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>by {p.creator}</div>
                    </td>
                    <td>
                      <strong>{p.code}</strong>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>{p.format}</div>
                    </td>
                    <td>{fmtDate(p.release_at)}</td>
                    <td>
                      {!timeOpen ? (
                        <span className="chip sealed">
                          <LockIcon size={12} /> Sealed until release
                        </span>
                      ) : needsApproval ? (
                        <span className="chip wait">
                          ⏳ Approval required ({p.approvals}/{p.required})
                        </span>
                      ) : (
                        <span className="chip open">
                          <UnlockIcon size={12} /> Unlocked &amp; Ready
                        </span>
                      )}
                      {p.downloads > 0 && (
                        <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                          Downloaded {p.downloads}&times;
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.released && (
                        <button className="btn-pill" onClick={() => download(p)} title="Download ready Word document">
                          <DownloadIcon size={13} /> Download .docx
                        </button>
                      )}
                      {timeOpen && needsApproval && !p.approved_by_me && (
                        <button className="btn-secondary btn-pill" onClick={() => approve(p.id)}>
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const blankSec = () => ({ name: '', count: 1, marks_each: 5, levels: '1,2,3', has_or: false, mix: '' });

function Formats({ formats, reload }) {
  const [msg, setMsg] = useState(null);
  const [secs, setSecs] = useState([
    { name: 'A', count: 4, marks_each: 6, levels: '1,2,3', has_or: false, mix: '' },
    { name: 'B', count: 2, marks_each: 10, levels: '3,4', has_or: true, mix: '' },
    { name: 'C', count: 1, marks_each: 16, levels: '5,6', has_or: true, mix: '' },
  ]);
  const total = secs.reduce((a, s) => a + (Number(s.count) || 0) * (Number(s.marks_each) || 0), 0);
  const set = (i, k, v) => setSecs(secs.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const sections = secs.map((s) => ({
      name: s.name,
      count: Number(s.count),
      marks_each: Number(s.marks_each),
      has_or: s.has_or,
      levels: s.levels.split(',').map((x) => Number(x.trim())).filter(Boolean),
      level_mix: Object.fromEntries(
        s.mix
          .split(',')
          .map((p) => p.split(':').map((x) => x.trim()))
          .filter((p) => p.length === 2 && p[0] && p[1])
      ),
    }));
    const res = await api('/api/formats', {
      method: 'POST',
      body: JSON.stringify({
        name: f.get('name'),
        config: {
          total_marks: total,
          duration: f.get('duration'),
          degree: f.get('degree'),
          instructions: f.get('instructions'),
          sections,
        },
      }),
    });
    setMsg(res.ok ? { type: 'ok', text: 'Format saved successfully.' } : { type: 'err', text: res.data.error });
    if (res.ok) reload();
  }

  async function remove(id) {
    if (!confirm('Delete this examination format?')) return;
    await api('/api/formats?id=' + id, { method: 'DELETE' });
    reload();
  }

  return (
    <>
      <form className="card-box" onSubmit={submit}>
        <div className="card-header-flex">
          <div>
            <h2>Create Paper Format Template</h2>
            <p className="muted">
              Define the blueprint: sections, questions count, Bloom&apos;s Taxonomy levels, marks, and optional OR pairings.
            </p>
          </div>
          <span className="chip primary" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
            Calculated Total Marks: <strong>{total}</strong>
          </span>
        </div>

        <div className="form-grid">
          <div>
            <label htmlFor="f_name">Format Name</label>
            <input id="f_name" name="name" required placeholder="e.g. ETE-60 (BCA/MCA)" />
          </div>
          <div>
            <label htmlFor="f_dur">Exam Duration</label>
            <input id="f_dur" name="duration" defaultValue="3 Hrs" />
          </div>
          <div>
            <label htmlFor="f_deg">Degree Programme</label>
            <input id="f_deg" name="degree" placeholder="e.g. BCA/MCA (optional)" />
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="f_ins">Instructions Printed on Paper Header</label>
          <textarea id="f_ins" name="instructions" rows={2} defaultValue="Attempt all questions." />
        </div>

        <h3 style={{ marginBottom: '0.75rem' }}>Sections Blueprint</h3>
        {secs.map((s, i) => (
          <div className="sec-row" key={i}>
            <div>
              <label>Section</label>
              <input value={s.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="A" />
            </div>
            <div>
              <label>Questions</label>
              <input type="number" min="1" value={s.count} onChange={(e) => set(i, 'count', e.target.value)} />
            </div>
            <div>
              <label>Marks Each</label>
              <input type="number" min="1" value={s.marks_each} onChange={(e) => set(i, 'marks_each', e.target.value)} />
            </div>
            <div>
              <label>BT Levels (1–6)</label>
              <input value={s.levels} onChange={(e) => set(i, 'levels', e.target.value)} placeholder="1,2,3" />
            </div>
            <div>
              <label>Exact Mix (optional)</label>
              <input value={s.mix} onChange={(e) => set(i, 'mix', e.target.value)} placeholder="1:1,2:2,3:1" />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ margin: 0, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={s.has_or} onChange={(e) => set(i, 'has_or', e.target.checked)} />
                OR
              </label>
              {secs.length > 1 && (
                <button
                  type="button"
                  className="btn-danger btn-pill"
                  onClick={() => setSecs(secs.filter((_, j) => j !== i))}
                  aria-label={`Remove section ${s.name}`}
                  style={{ padding: '0.3rem 0.6rem' }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={{ margin: '1rem 0' }}>
          <button type="button" className="btn-secondary btn-pill" onClick={() => setSecs([...secs, blankSec()])}>
            + Add Section
          </button>
        </div>

        <Msg m={msg} />
        <button>Save Format Template</button>
      </form>

      <div className="card-box">
        <h2>Saved Format Templates ({formats.length})</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Format Name</th>
                <th>Sections Breakdown</th>
                <th>Total Marks</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formats.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.name}</strong></td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {f.config?.sections?.map((s) => (
                        <span key={s.name} className="chip">
                          Sec {s.name}: {s.count}&times;{s.marks_each}m {s.has_or ? '(OR)' : ''} &bull; {s.levels?.map((l) => 'BT' + l).join('/')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td><strong>{f.config?.total_marks}</strong> Marks</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-danger btn-pill" onClick={() => remove(f.id)}>
                      <TrashIcon size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Subjects({ subjects, reload }) {
  const [msg, setMsg] = useState(null);
  const [bulkMsg, setBulkMsg] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mode, setMode] = useState('single');

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api('/api/subjects', { method: 'POST', body: JSON.stringify(Object.fromEntries(f.entries())) });
    setMsg(res.ok ? { type: 'ok', text: 'Subject added successfully.' } : { type: 'err', text: res.data.error });
    if (res.ok) {
      e.target.reset();
      reload();
    }
  }

  async function submitBulk(e) {
    e.preventDefault();
    setBulkBusy(true);
    setBulkMsg(null);
    const form = e.target;
    const res = await api('/api/subjects/bulk', { method: 'POST', body: new FormData(form) });
    setBulkBusy(false);
    if (!res.ok) return setBulkMsg({ type: 'err', text: res.data.error, list: res.data.details });
    setBulkMsg({
      type: res.data.warnings?.length ? 'warn' : 'ok',
      text: `Import complete: ${res.data.inserted} subject(s) added, ${res.data.skipped} skipped.`,
      list: res.data.warnings,
    });
    form.reset();
    reload();
  }

  async function remove(s) {
    if (!confirm(`Delete ${s.code} and every question under it?`)) return;
    await api('/api/subjects?id=' + s.id, { method: 'DELETE' });
    reload();
  }

  return (
    <>
      <div className="card-box">
        <div className="card-header-flex">
          <div>
            <h2>Add Subject Curriculum</h2>
            <p className="muted">Register course subjects or import multiple subjects using an Excel/CSV spreadsheet.</p>
          </div>
          <div className="seg-radio-group" style={{ margin: 0 }}>
            <label className={`seg-radio-label ${mode === 'single' ? 'active' : ''}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
              <input type="radio" checked={mode === 'single'} onChange={() => setMode('single')} />
              + Single Subject
            </label>
            <label className={`seg-radio-label ${mode === 'bulk' ? 'active' : ''}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
              <input type="radio" checked={mode === 'bulk'} onChange={() => setMode('bulk')} />
              📂 Bulk Import (.xlsx)
            </label>
          </div>
        </div>

        {mode === 'single' ? (
          <form onSubmit={submit}>
            <div className="form-grid">
              <div>
                <label htmlFor="s_code">Subject Code</label>
                <input id="s_code" name="code" required placeholder="e.g. CAP1005" />
              </div>
              <div>
                <label htmlFor="s_name">Subject Name</label>
                <input id="s_name" name="name" required placeholder="e.g. Programming in C" />
              </div>
              <div>
                <label htmlFor="s_co">Number of Course Outcomes (COs)</label>
                <input id="s_co" name="co_count" type="number" min="1" max="10" defaultValue="5" />
              </div>
            </div>
            <Msg m={msg} />
            <button>Add Subject</button>
          </form>
        ) : (
          <form onSubmit={submitBulk}>
            <div className="card-header-flex">
              <p className="muted">
                First row must contain: <code>Subject Code</code>, <code>Subject Name</code>, and <code>CO Count</code>.
              </p>
              <a href="/subjects-template.xlsx" download className="btn btn-secondary btn-pill">
                <DownloadIcon size={13} /> Download Template (.xlsx)
              </a>
            </div>
            <div className="dropzone-box">
              <label htmlFor="bulk_sub_file" style={{ cursor: 'pointer' }}>
                <UploadIcon size={24} color="#6366f1" />
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>Choose Excel (.xlsx) or CSV file</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Drag &amp; drop or click to browse</div>
              </label>
              <input
                id="bulk_sub_file"
                name="file"
                type="file"
                required
                accept=".xlsx, .csv"
                style={{ maxWidth: 320, margin: '0.75rem auto 0', display: 'block' }}
              />
            </div>
            <Msg m={bulkMsg} />
            <button disabled={bulkBusy}>
              <UploadIcon size={16} /> {bulkBusy ? 'Importing subjects…' : 'Upload & Import Subjects'}
            </button>
          </form>
        )}
      </div>

      <div className="card-box">
        <h2>Registered Subjects ({subjects.length})</h2>
        {subjects.length === 0 ? (
          <div className="empty-state">
            <p>No subjects registered yet. Add a subject above to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Subject Name</th>
                  <th>Course Outcomes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.code}</strong></td>
                    <td>{s.name}</td>
                    <td>
                      <span className="chip primary">{s.co_count} COs</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-danger btn-pill" onClick={() => remove(s)}>
                        <TrashIcon size={12} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Faculty({ faculty, subjects, reload }) {
  const [msg, setMsg] = useState(null);
  const [bulkMsg, setBulkMsg] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mode, setMode] = useState('single');
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
    setMsg(
      res.ok
        ? { type: 'ok', text: 'Faculty account created and assigned subjects. Share credentials securely.' }
        : { type: 'err', text: res.data.error }
    );
    if (res.ok) {
      e.target.reset();
      reload();
    }
  }

  async function submitBulk(e) {
    e.preventDefault();
    setBulkBusy(true);
    setBulkMsg(null);
    const form = e.target;
    const res = await api('/api/faculty/bulk', { method: 'POST', body: new FormData(form) });
    setBulkBusy(false);
    if (!res.ok) return setBulkMsg({ type: 'err', text: res.data.error, list: res.data.details });
    setBulkMsg({
      type: res.data.warnings?.length ? 'warn' : 'ok',
      text: `Import complete: ${res.data.inserted} faculty added, ${res.data.skipped} skipped.`,
      list: res.data.warnings,
    });
    form.reset();
    reload();
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
    setMsg(
      res.ok
        ? { type: 'ok', text: `Subject assignments updated for ${editingFaculty.name}.` }
        : { type: 'err', text: res.data.error }
    );
    if (res.ok) {
      setEditingFaculty(null);
      reload();
    }
  }

  async function remove(u) {
    if (!confirm(`Delete ${u.name} and all questions they uploaded?`)) return;
    await api('/api/faculty?id=' + u.id, { method: 'DELETE' });
    reload();
  }

  return (
    <>
      <div className="card-box">
        <div className="card-header-flex">
          <div>
            <h2>Manage Faculty Accounts</h2>
            <p className="muted">Create faculty credentials and assign designated course codes to each faculty member.</p>
          </div>
          <div className="seg-radio-group" style={{ margin: 0 }}>
            <label className={`seg-radio-label ${mode === 'single' ? 'active' : ''}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
              <input type="radio" checked={mode === 'single'} onChange={() => setMode('single')} />
              + Single Faculty
            </label>
            <label className={`seg-radio-label ${mode === 'bulk' ? 'active' : ''}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
              <input type="radio" checked={mode === 'bulk'} onChange={() => setMode('bulk')} />
              📂 Bulk Import (.xlsx)
            </label>
          </div>
        </div>

        {mode === 'single' ? (
          <form onSubmit={submit}>
            <div className="form-grid">
              <div>
                <label htmlFor="u_name">Full Name</label>
                <input id="u_name" name="name" required placeholder="Dr. Alan Turing" />
              </div>
              <div>
                <label htmlFor="u_email">Email Address</label>
                <input id="u_email" name="email" type="email" required placeholder="alan@college.edu" />
              </div>
              <div>
                <label htmlFor="u_pw">Temporary Password</label>
                <input id="u_pw" name="password" type="text" minLength={8} required placeholder="Min 8 characters" />
              </div>
            </div>

            <label style={{ marginTop: '0.75rem', fontWeight: 600 }}>Assign Course Subjects:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {subjects.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    margin: 0,
                    padding: '0.35rem 0.65rem',
                    border: '1px solid var(--slate-200)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: '#fff',
                    fontSize: '0.82rem',
                  }}
                >
                  <input type="checkbox" name="subject_ids" value={s.id} />
                  <strong>{s.code}</strong> &ndash; {s.name}
                </label>
              ))}
              {subjects.length === 0 && <span className="muted">No subjects available yet. Add subjects first.</span>}
            </div>

            <Msg m={msg} />
            <button>Create Faculty Account</button>
          </form>
        ) : (
          <form onSubmit={submitBulk}>
            <div className="card-header-flex">
              <p className="muted">
                Excel columns: <code>Faculty Name</code>, <code>Email</code>, <code>Temporary Password</code>, and optional comma-separated <code>Assigned Subject Codes</code>.
              </p>
              <a href="/faculty-template.xlsx" download className="btn btn-secondary btn-pill">
                <DownloadIcon size={13} /> Download Template (.xlsx)
              </a>
            </div>
            <div className="dropzone-box">
              <label htmlFor="bulk_fac_file" style={{ cursor: 'pointer' }}>
                <UploadIcon size={24} color="#6366f1" />
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>Choose Excel (.xlsx) or CSV file</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Drag &amp; drop or click to browse</div>
              </label>
              <input
                id="bulk_fac_file"
                name="file"
                type="file"
                required
                accept=".xlsx, .csv"
                style={{ maxWidth: 320, margin: '0.75rem auto 0', display: 'block' }}
              />
            </div>
            <Msg m={bulkMsg} />
            <button disabled={bulkBusy}>
              <UploadIcon size={16} /> {bulkBusy ? 'Importing faculty…' : 'Upload & Import Faculty'}
            </button>
          </form>
        )}
      </div>

      {editingFaculty && (
        <form className="card-box" onSubmit={saveAssignments} style={{ border: '2px solid var(--primary)' }}>
          <h3>Edit Subject Assignments for {editingFaculty.name}</h3>
          <p className="muted">Faculty can only submit question banks and papers for the subjects checked below.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1rem 0' }}>
            {subjects.map((s) => {
              const checked = selectedSubs.includes(s.id);
              return (
                <label
                  key={s.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    margin: 0,
                    padding: '0.4rem 0.75rem',
                    border: '1px solid',
                    borderColor: checked ? 'var(--primary)' : 'var(--slate-200)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: checked ? 'var(--primary-light)' : '#fff',
                    color: checked ? 'var(--primary)' : 'var(--slate-800)',
                    fontWeight: checked ? 600 : 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedSubs([...selectedSubs, s.id]);
                      else setSelectedSubs(selectedSubs.filter((id) => id !== s.id));
                    }}
                  />
                  <span>{s.code}</span> &ndash; <span className="muted">{s.name}</span>
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit">Save Assignments</button>
            <button type="button" className="btn-secondary" onClick={() => setEditingFaculty(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card-box">
        <h2>Faculty Directory ({faculty.length})</h2>
        {faculty.length === 0 ? (
          <div className="empty-state">
            <p>No faculty accounts registered yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Faculty Name</th>
                  <th>Email</th>
                  <th>Assigned Subjects</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td className="muted">{u.email}</td>
                    <td>
                      {(u.assigned_subjects || []).length === 0 ? (
                        <span className="muted" style={{ fontStyle: 'italic' }}>None assigned</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(u.assigned_subjects || []).map((s) => (
                            <span key={s.id} className="chip primary" title={s.name}>
                              {s.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-secondary btn-pill" style={{ marginRight: 6 }} onClick={() => startEdit(u)}>
                        Assign Subjects
                      </button>
                      <button className="btn-danger btn-pill" onClick={() => remove(u)}>
                        <TrashIcon size={12} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Uploads({ uploads }) {
  return (
    <div className="card-box">
      <div className="card-header-flex">
        <div>
          <h2>Question Pool Submissions ({uploads.length})</h2>
          <p className="muted">
            Submission metrics and question counts. In accordance with exam cell security policy, raw question text is never exposed in the dashboard.
          </p>
        </div>
      </div>

      {uploads.length === 0 ? (
        <div className="empty-state">
          <p>No question sets submitted yet by faculty.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Submitted By</th>
                <th>Type &amp; Batch</th>
                <th>Questions In Pool</th>
                <th>Notes / Warnings</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.code}</strong></td>
                  <td>{u.faculty}</td>
                  <td>
                    {u.kind === 'bank' ? (
                      <span className="chip primary">Question Bank &bull; Batch #{u.set_no}</span>
                    ) : (
                      <span className="chip open">Ready Paper (Set 1) &bull; {u.format || '—'}</span>
                    )}
                  </td>
                  <td><strong>{u.question_count}</strong> questions</td>
                  <td className="muted" style={{ fontSize: '0.8rem' }}>
                    {(u.warnings || []).length ? (u.warnings || []).join(' ') : '✓ Valid'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
