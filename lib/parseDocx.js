import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { normLevel, normCO, normCode } from './normalize.js';

const cellText = ($, td) => {
  const ps = $(td).find('p').map((_, p) => $(p).text().trim()).get().filter(Boolean);
  return (ps.length ? ps.join(' ') : $(td).text()).replace(/\s+/g, ' ').trim();
};

/**
 * Reads an ETE paper in the standard table layout:
 * header rows, "SECTION X" rows, then rows of  Q.n | question (OR alternatives) | BT n | [COn].
 */
export async function parseExamDocx(buffer, { format, subjectCode, coCount } = {}) {
  const errors = [], warnings = [];
  let html;
  try {
    ({ value: html } = await mammoth.convertToHtml({ buffer }));
  } catch {
    return { meta: {}, questions: [], errors: ['Could not read the file. Upload a .docx Word file.'], warnings };
  }
  const $ = cheerio.load(html);
  const rows = $('tr').toArray();
  if (!rows.length) return { meta: {}, questions: [], errors: ['No table found. Use the standard ETE paper layout.'], warnings };

  let section = null, headText = '';
  const found = []; // {qno, section, alts:[{text,image}], level, co}
  for (const tr of rows) {
    const cells = $(tr).children('td,th').toArray().map((td) => cellText($, td));
    const joined = cells.join(' ');
    const sec = cells.map((c) => c.match(/^SECTION\s+([A-Z])$/i)).find(Boolean);
    const first = cells[0] || '';
    const qm = first.match(/^Q\.?\s*(\d+)/i);
    if (!qm) {
      if (sec) section = sec[1].toUpperCase();
      else if (!section) headText += ' ' + joined;
      continue;
    }
    const rest = cells.slice(1);
    const rawText = rest[0] || '';
    const tail = rest.slice(1).join(' ');
    const level = normLevel((tail.match(/BT\s*(\d)/i) || [])[1]);
    const co = normCO((tail.match(/CO\s*(\d+)/i) || [])[1]);
    const img = $(tr).find('img').first().attr('src') || null;
    const parts = rawText.split(/\s+OR\s+/).map((s) => s.trim()).filter(Boolean);
    found.push({ qno: 'Q' + qm[1], section, parts, level, co, image: img });
  }

  const meta = {
    courseCode: (headText.match(/Course\s*Code\s*:?\s*([A-Za-z]{2,5}\s?-?\d{3,5})/i) || [])[1] || null,
    maxMarks: Number((headText.match(/Max\.?\s*Marks\s*:?\s*(\d+)/i) || [])[1]) || null,
  };
  if (subjectCode && meta.courseCode && normCode(meta.courseCode) !== normCode(subjectCode)) {
    errors.push(`This paper is for ${meta.courseCode}, but you selected ${subjectCode}.`);
  }

  const questions = [];
  for (const f of found) {
    if (!f.section) { errors.push(`${f.qno}: no SECTION heading found above it.`); continue; }
    if (!f.level) errors.push(`${f.qno}: BT level is missing or not between 1 and 6.`);
    if (!f.co) errors.push(`${f.qno}: CO is missing.`);
    else if (coCount && f.co > coCount) errors.push(`${f.qno}: CO${f.co} is above this subject's ${coCount} COs.`);
    if (!f.parts.length) errors.push(`${f.qno}: question text is empty.`);
    if (!(f.level && f.co && f.parts.length)) continue;
    f.parts.forEach((text, i) =>
      questions.push({ qno: f.qno + (f.parts.length > 1 ? 'ab'[i] || '' : ''), text, level: f.level, co: f.co, section: f.section, image: i === 0 ? f.image : null })
    );
  }

  if (format) {
    for (const sec of format.sections) {
      const mine = found.filter((f) => f.section === sec.name);
      if (mine.length !== sec.count) errors.push(`Section ${sec.name} has ${mine.length} question(s); the format "${format.name}" needs ${sec.count}.`);
      const orCount = mine.filter((f) => f.parts.length > 1).length;
      if (sec.has_or && orCount < mine.length) warnings.push(`Section ${sec.name}: ${mine.length - orCount} question(s) have no OR option.`);
      if (!sec.has_or && orCount) warnings.push(`Section ${sec.name}: format has no OR, but ${orCount} question(s) include one. Both options were saved.`);
      for (const f of mine) if (f.level && !sec.levels.includes(f.level)) warnings.push(`${f.qno}: BT${f.level} is outside the levels set for Section ${sec.name} (${sec.levels.map((l) => 'BT' + l).join(', ')}).`);
    }
    const known = new Set(format.sections.map((s) => s.name));
    for (const f of found) if (f.section && !known.has(f.section)) errors.push(`${f.qno}: Section ${f.section} is not part of format "${format.name}".`);
    if (meta.maxMarks && meta.maxMarks !== format.total_marks) warnings.push(`Paper says ${meta.maxMarks} marks; format total is ${format.total_marks}.`);
  }
  if (!found.length) errors.push('No questions found. Rows must start with Q.1, Q.2, ...');
  return { meta, questions, errors, warnings };
}
