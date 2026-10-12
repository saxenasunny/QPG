import readXlsxFile from 'read-excel-file/node';

const clean = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    // Basic CSV splitting handling quotes
    const cells = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}

async function extractRows(buffer, filename = '') {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  if (isCsv) {
    try {
      return parseCsv(buffer.toString('utf8'));
    } catch {
      return null;
    }
  }
  try {
    return await readXlsxFile(buffer);
  } catch {
    // Fallback: try parsing as CSV in case file was renamed or mislabeled
    try {
      return parseCsv(buffer.toString('utf8'));
    } catch {
      return null;
    }
  }
}

export async function parseSubjectsFile(buffer, filename = '') {
  const rows = await extractRows(buffer, filename);
  if (!rows || !rows.length) {
    return { items: [], errors: ['Could not read the file. Please upload an .xlsx or .csv file.'] };
  }
  if (rows.length < 2) {
    return { items: [], errors: ['The sheet contains no data rows.'] };
  }

  const head = rows[0].map(clean);
  const find = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));

  const idx = {
    code: find('subjectcode', 'subcode', 'coursecode', 'code'),
    name: find('subjectname', 'subname', 'coursename', 'title', 'name'),
    co: find('cocount', 'numberofcos', 'co', 'cos'),
  };

  const missing = [];
  if (idx.code < 0) missing.push('Subject Code');
  if (idx.name < 0) missing.push('Subject Name');
  if (missing.length) {
    return { items: [], errors: [`Missing required column(s): ${missing.join(', ')}. First row must include: Subject Code, Subject Name, CO Count.`] };
  }

  const items = [];
  const errors = [];
  const seenCodes = new Set();

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (r.every((c) => c === null || String(c).trim() === '')) return;

    const rawCode = String(r[idx.code] ?? '').trim().toUpperCase();
    const rawName = String(r[idx.name] ?? '').trim();
    let coCount = 5;
    if (idx.co >= 0 && r[idx.co] !== null && String(r[idx.co]).trim() !== '') {
      const parsedCo = Number(r[idx.co]);
      if (parsedCo >= 1 && parsedCo <= 10) {
        coCount = parsedCo;
      } else {
        errors.push(`Row ${line} (${rawCode || 'Subject'}): CO count must be a number between 1 and 10.`);
      }
    }

    if (!rawCode) {
      errors.push(`Row ${line}: Subject code is missing.`);
      return;
    }
    if (!rawName) {
      errors.push(`Row ${line} (${rawCode}): Subject name is missing.`);
      return;
    }

    if (seenCodes.has(rawCode)) {
      errors.push(`Row ${line}: Duplicate subject code "${rawCode}" in the uploaded file.`);
      return;
    }
    seenCodes.add(rawCode);

    items.push({ code: rawCode, name: rawName, co_count: coCount });
  });

  if (!items.length && !errors.length) {
    errors.push('No valid subject rows found.');
  }

  return { items, errors };
}

export async function parseFacultyFile(buffer, filename = '') {
  const rows = await extractRows(buffer, filename);
  if (!rows || !rows.length) {
    return { items: [], errors: ['Could not read the file. Please upload an .xlsx or .csv file.'] };
  }
  if (rows.length < 2) {
    return { items: [], errors: ['The sheet contains no data rows.'] };
  }

  const head = rows[0].map(clean);
  const find = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));

  const idx = {
    name: find('facultyname', 'fullname', 'name', 'faculty'),
    email: find('emailaddress', 'email', 'mail'),
    password: find('temporarypassword', 'temppassword', 'temppass', 'password', 'pass'),
    subjects: find('assignedsubjectcodes', 'assignedsubjects', 'subjectcodes', 'subjects', 'assigned'),
  };

  const missing = [];
  if (idx.name < 0) missing.push('Faculty Name');
  if (idx.email < 0) missing.push('Email');
  if (missing.length) {
    return { items: [], errors: [`Missing required column(s): ${missing.join(', ')}. First row must include: Faculty Name, Email, Temporary Password, Assigned Subject Codes.`] };
  }

  const items = [];
  const errors = [];
  const seenEmails = new Set();

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (r.every((c) => c === null || String(c).trim() === '')) return;

    const name = String(r[idx.name] ?? '').trim();
    const email = String(r[idx.email] ?? '').toLowerCase().trim();
    const pw = idx.password >= 0 && r[idx.password] ? String(r[idx.password]).trim() : '';

    if (!name) {
      errors.push(`Row ${line}: Faculty name is missing.`);
      return;
    }
    if (!email || !email.includes('@')) {
      errors.push(`Row ${line}: Invalid email address "${r[idx.email] ?? ''}".`);
      return;
    }
    if (!pw || pw.length < 8) {
      errors.push(`Row ${line} (${email}): Password must be at least 8 characters.`);
      return;
    }

    if (seenEmails.has(email)) {
      errors.push(`Row ${line}: Duplicate email "${email}" in the uploaded file.`);
      return;
    }
    seenEmails.add(email);

    let subjectCodes = [];
    if (idx.subjects >= 0 && r[idx.subjects]) {
      subjectCodes = String(r[idx.subjects])
        .split(/[,;\/]/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    }

    items.push({ name, email, password: pw, subjectCodes });
  });

  if (!items.length && !errors.length) {
    errors.push('No valid faculty rows found.');
  }

  return { items, errors };
}
