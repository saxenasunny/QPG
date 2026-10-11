import fs from 'fs';
import { parseExamDocx } from '../lib/parseDocx.js';
import { generatePapers, coverage } from '../lib/generator.js';
import { buildDocx } from '../lib/paperDoc.js';
import { encryptJSON, decryptJSON } from '../lib/crypto.js';
import { DEFAULT_FORMAT } from '../lib/schema.js';
import { checkFormat } from '../lib/formatConfig.js';

process.env.PAPER_ENC_KEY = 'a'.repeat(64);
const file = process.argv[2];
const { config } = checkFormat(DEFAULT_FORMAT.config);
const format = { name: DEFAULT_FORMAT.name, ...config };

if (file) {
  const r = await parseExamDocx(fs.readFileSync(file), { format, subjectCode: 'CAP1005', coCount: 5 });
  console.log('META', r.meta);
  console.log('ERRORS', r.errors);
  console.log('WARNINGS', r.warnings);
  console.log('QUESTIONS', r.questions.length);
  for (const q of r.questions) console.log(q.section, q.qno, 'BT' + q.level, 'CO' + q.co, q.image ? '[img]' : '', q.text.slice(0, 60));
}

// synthetic pool: 3 faculty, many questions
const pool = [];
let id = 1;
const words = 'array pointer loop string matrix function recursion structure file stack queue sort search memory union enum macro switch branch scope compile link debug input output buffer index address integer float char operator bitwise header library'.split(' ');
const w = () => words[Math.floor(Math.random() * words.length)];
for (let i = 0; i < 400; i++) pool.push({ id: id++, text: `${w()} ${w()} ${w()} ${w()} ${w()} ${w()} ${w()} ${w()} case ${i}`, level: 1 + (i % 6), co: 1 + (i % 5), times_used: i % 3 === 0 ? 1 : 0, faculty_id: 1 + (i % 3), image: null });
const papers = generatePapers(pool, format, 3);
const all = papers.flatMap((p) => p.ids);
console.log('3 sets, overlap =', all.length - new Set(all).size, '| coverage', JSON.stringify(coverage({ sections: papers[0].sections })));
const first = papers[0];
for (const s of first.sections) for (const it of s.items) { if (s.has_or && (it.alts[0].level !== it.alts[1].level || it.alts[0].co !== it.alts[1].co)) throw new Error('OR pair mismatch'); }
console.log('OR pairs share level+CO: ok');
const enc = encryptJSON({ a: 1, s: first.sections });
console.log('crypto roundtrip:', decryptJSON(enc).a === 1);
const buf = await buildDocx({ meta: { institute: 'Test Univ', examTitle: 'End Term Examination – December 2026', courseCode: 'CAP1005', courseTitle: 'Programming in C', degree: 'BCA/MCA', semester: 'I', time: '3 Hrs', maxMarks: 60, instructions: 'Attempt all questions.', label: 'Set A' }, paper: { sections: first.sections }, ref: 'QP-TEST' });
fs.writeFileSync('/tmp/test_paper.docx', buf);
console.log('docx bytes', buf.length);
// infeasible case
try { generatePapers(pool.slice(0, 6), format, 1); } catch (e) { console.log('shortage message:', e.message.slice(0, 120)); }
