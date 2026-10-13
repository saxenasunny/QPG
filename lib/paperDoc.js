import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ImageRun, Footer, VerticalAlign,
} from 'docx';

const FONT = 'Times New Roman';
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: 22, ...o });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...o });
const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };

function imageRun(dataUri) {
  try {
    const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/.exec(dataUri || '');
    if (!m) return null;
    return new ImageRun({ type: m[1].startsWith('jp') ? 'jpg' : m[1], data: Buffer.from(m[2], 'base64'), transformation: { width: 260, height: 170 } });
  } catch { return null; }
}

function questionCell(alts) {
  const out = [];
  alts.forEach((a, i) => {
    if (i > 0) out.push(para(run('OR', { bold: true }), { alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 } }));
    out.push(para(run(a.text)));
    const img = imageRun(a.image);
    if (img) out.push(para(img));
  });
  return out;
}

const cell = (children, width, o = {}) =>
  new TableCell({ children, width: { size: width, type: WidthType.PERCENTAGE }, borders, verticalAlign: VerticalAlign.TOP, margins: { top: 60, bottom: 60, left: 100, right: 100 }, ...o });

export async function buildDocx({ meta, paper, ref }) {
  const kids = [];
  const center = (t, o = {}) => para(run(t, { bold: true, ...o }), { alignment: AlignmentType.CENTER, spacing: { after: 60 } });
  if (meta.institute) kids.push(center(meta.institute, { size: 28 }));
  kids.push(center(`${meta.examTitle || 'End Term Examination'}`, { size: 24 }));
  if (meta.department) kids.push(center(`Department / School: ${meta.department}`, { size: 22 }));
  kids.push(center(`Course Code: ${meta.courseCode} – Course Title: ${meta.courseTitle}`));
  const progLine = [
    meta.degree && `Degree Programme: ${meta.degree}`,
    meta.batch && `Batch: ${meta.batch}`,
    meta.semester && `Semester: ${meta.semester}`,
  ].filter(Boolean).join('     ');
  if (progLine) kids.push(center(progLine));
  kids.push(para([run(`Time: ${meta.time}`, { bold: true }), run(`\t\t\tMax. Marks: ${meta.maxMarks}`, { bold: true })], { spacing: { before: 120, after: 120 } }));
  if (meta.label) kids.push(center(meta.label));
  kids.push(para([run('Instructions: ', { bold: true }), run(meta.instructions)], { spacing: { after: 200 } }));

  for (const s of paper.sections) {
    kids.push(para(run(`SECTION ${s.name}`, { bold: true }), { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } }));
    const head = new TableRow({
      tableHeader: true,
      children: [
        cell([para(run('Q.No', { bold: true }))], 9),
        cell([para(run(`Question (${s.marks_each} marks each)`, { bold: true }))], 70),
        cell([para(run('BT Level', { bold: true }))], 11),
        cell([para(run('COs', { bold: true }))], 10),
      ],
    });
    const rows = s.items.map((it) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell([para(run(`Q.${it.no}`))], 9),
          cell(questionCell(it.alts), 70),
          cell([para(run(`BT ${it.alts[0].level}`))], 11),
          cell([para(run(`[CO${it.alts[0].co}]`))], 10),
        ],
      })
    );
    kids.push(new Table({ rows: [head, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
      footers: { default: new Footer({ children: [para(run(`Paper ID: ${ref}`, { size: 16, color: '666666' }), { alignment: AlignmentType.RIGHT })] }) },
      children: kids,
    }],
  });
  return Packer.toBuffer(doc);
}
