import readXlsxFile from 'read-excel-file/node';
import { normLevel, normCO } from './normalize.js';

const clean = (h) => String(h ?? '').toLowerCase().replace(/[^a-z]/g, '');

export async function parseBank(buffer, coCount) {
  let rows;
  try {
    rows = await readXlsxFile(buffer);
  } catch {
    return { questions: [], errors: ['Could not read the file. Upload a .xlsx Excel file.'] };
  }
  if (rows.length < 2) return { questions: [], errors: ['The sheet is empty.'] };
  const head = rows[0].map(clean);
  const find = (...names) => head.findIndex((h) => names.includes(h));
  const idx = {
    qno: find('qno', 'qn', 'questionno', 'questionnumber', 'sno'),
    text: find('question', 'questiontext'),
    level: find('questionlevel', 'level', 'btlevel', 'bt'),
    co: find('co', 'cos', 'courseoutcome'),
  };
  const missing = [];
  if (idx.qno < 0) missing.push('Qno');
  if (idx.text < 0) missing.push('Question');
  if (idx.level < 0) missing.push('Question Level');
  if (idx.co < 0) missing.push('CO');
  if (missing.length) return { questions: [], errors: [`Missing column(s): ${missing.join(', ')}. First row must be: Qno, Question, Question Level, CO.`] };

  const questions = [], errors = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (r.every((c) => c === null || String(c).trim() === '')) return;
    const text = String(r[idx.text] ?? '').trim();
    const level = normLevel(r[idx.level]);
    const co = normCO(r[idx.co]);
    if (!text) errors.push(`Row ${line}: question is empty.`);
    if (!level) errors.push(`Row ${line}: question level "${r[idx.level] ?? ''}" is not a BT level from 1 to 6.`);
    if (!co) errors.push(`Row ${line}: CO "${r[idx.co] ?? ''}" is not valid.`);
    else if (coCount && co > coCount) errors.push(`Row ${line}: CO${co} is above this subject's ${coCount} COs.`);
    if (text && level && co) questions.push({ qno: String(r[idx.qno] ?? '').trim(), text, level, co, section: null, image: null });
  });
  if (!questions.length && !errors.length) errors.push('No questions found.');
  return { questions, errors };
}
