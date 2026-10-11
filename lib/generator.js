import crypto from 'crypto';
import { tokenSet, jaccard } from './normalize.js';

const rnd = () => crypto.randomBytes(6).readUIntBE(0, 6) / 2 ** 48;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWeighted(items, wFn) {
  const ws = items.map(wFn);
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Levels required per question slot; null = any allowed level for the section. */
function slotsFor(sec) {
  if (sec.level_mix && Object.keys(sec.level_mix).length) {
    const arr = [];
    for (const [l, n] of Object.entries(sec.level_mix)) for (let i = 0; i < n; i++) arr.push(Number(l));
    return arr;
  }
  return Array.from({ length: sec.count }, () => null);
}

/** Quick check before generating, so the admin sees exactly what is missing. */
export function feasibility(pool, format, versions = 1) {
  const problems = [];
  const per = (levels) => pool.filter((x) => levels.includes(x.level)).length;
  for (const sec of format.sections) {
    const need = sec.count * (sec.has_or ? 2 : 1) * versions;
    if (sec.level_mix) {
      for (const [l, n] of Object.entries(sec.level_mix)) {
        const needL = n * (sec.has_or ? 2 : 1) * versions;
        const have = per([Number(l)]);
        if (have < needL) problems.push(`Section ${sec.name} needs ${needL} question(s) at BT${l}, but only ${have} are available.`);
      }
    } else if (per(sec.levels) < need) {
      problems.push(`Section ${sec.name} needs ${need} question(s) from ${sec.levels.map((l) => 'BT' + l).join('/')}, but only ${per(sec.levels)} are available.`);
    }
  }
  return problems;
}

function buildOne(pool, format, used) {
  const coUsed = {}, facUsed = {}, taken = [];
  const local = new Set();
  const free = (x) => !used.has(x.id) && !local.has(x.id) && !taken.some((t) => jaccard(t, x._tok) >= 0.8);
  const weight = (x) =>
    (1 / (1 + 3 * x.times_used)) * (1 / (1 + 0.5 * (facUsed[x.faculty_id] || 0))) * (coUsed[x.co] ? 1 : 3);
  const take = (x) => {
    local.add(x.id);
    taken.push(x._tok);
    coUsed[x.co] = (coUsed[x.co] || 0) + 1;
    facUsed[x.faculty_id] = (facUsed[x.faculty_id] || 0) + 1;
  };

  let no = 0;
  const sections = [];
  for (const sec of format.sections) {
    const items = [];
    for (const lvl of shuffle(slotsFor(sec))) {
      const allowed = lvl ? [lvl] : sec.levels;
      const cands = pool.filter((x) => allowed.includes(x.level) && free(x));
      let alts;
      if (sec.has_or) {
        const groups = new Map();
        for (const c of cands) {
          const k = c.level + '-' + c.co;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(c);
        }
        const ok = [...groups.values()].filter((g) => g.length >= 2);
        if (!ok.length) throw new Error(`Section ${sec.name}: no two questions share the same BT level and CO for an OR pair.`);
        const g = pickWeighted(ok, (grp) => grp.reduce((s, x) => s + weight(x), 0));
        const a = pickWeighted(g, weight);
        const rest = g.filter((x) => x !== a && jaccard(a._tok, x._tok) < 0.8);
        if (!rest.length) throw new Error(`Section ${sec.name}: could not find a distinct OR partner.`);
        const b = pickWeighted(rest, weight);
        take(a); take(b);
        alts = [a, b];
      } else {
        if (!cands.length) throw new Error(`Section ${sec.name}: ran out of questions for ${allowed.map((l) => 'BT' + l).join('/')}.`);
        const a = pickWeighted(cands, weight);
        take(a);
        alts = [a];
      }
      items.push({ alts });
    }
    // present lower BT levels first inside a section
    items.sort((x, y) => x.alts[0].level - y.alts[0].level || x.alts[0].co - y.alts[0].co);
    sections.push({
      name: sec.name, marks_each: sec.marks_each, has_or: sec.has_or,
      items: items.map((it) => ({
        no: ++no,
        alts: it.alts.map((a) => ({ id: a.id, text: a.text, level: a.level, co: a.co, image: a.image || null })),
      })),
    });
  }
  return { sections, ids: [...local] };
}

/** Builds `versions` papers that share no question. Throws a readable Error if impossible. */
export function generatePapers(pool, format, versions = 1) {
  const prepared = pool.map((x) => ({ ...x, _tok: tokenSet(x.text) }));
  const problems = feasibility(prepared, format, versions);
  if (problems.length) throw new Error(problems.join(' '));
  const used = new Set();
  const papers = [];
  for (let v = 0; v < versions; v++) {
    let built = null, lastErr = null;
    for (let attempt = 0; attempt < 40 && !built; attempt++) {
      try { built = buildOne(prepared, format, used); } catch (e) { lastErr = e; }
    }
    if (!built) throw new Error(lastErr?.message || 'Could not build a paper from the available questions.');
    built.ids.forEach((id) => used.add(id));
    papers.push(built);
  }
  return papers;
}

export function coverage(paper) {
  const cos = new Set(), levels = {};
  for (const s of paper.sections) for (const it of s.items) for (const a of it.alts) {
    cos.add(a.co);
    levels['BT' + a.level] = (levels['BT' + a.level] || 0) + 1;
  }
  return { cos: [...cos].sort((a, b) => a - b), levels };
}
