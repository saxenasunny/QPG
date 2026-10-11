/** Validates and normalises a paper-format config. Returns { config, errors }. */
export function checkFormat(raw) {
  const errors = [];
  const sections = (raw.sections || []).map((s) => {
    const name = String(s.name || '').trim().toUpperCase();
    const count = Number(s.count);
    const marks_each = Number(s.marks_each);
    const levels = (s.levels || []).map(Number).filter((n) => n >= 1 && n <= 6);
    const level_mix = {};
    for (const [k, v] of Object.entries(s.level_mix || {})) {
      if (Number(v) > 0 && Number(k) >= 1 && Number(k) <= 6) level_mix[Number(k)] = Number(v);
    }
    if (!name) errors.push('Every section needs a name (A, B, C...).');
    if (!(count >= 1)) errors.push(`Section ${name}: question count must be at least 1.`);
    if (!(marks_each > 0)) errors.push(`Section ${name}: marks per question must be above 0.`);
    const mixTotal = Object.values(level_mix).reduce((a, b) => a + b, 0);
    if (mixTotal && mixTotal !== count) errors.push(`Section ${name}: level mix adds up to ${mixTotal}, but the section has ${count} questions.`);
    const effLevels = mixTotal ? Object.keys(level_mix).map(Number) : levels;
    if (!effLevels.length) errors.push(`Section ${name}: choose at least one BT level.`);
    return { name, count, marks_each, has_or: !!s.has_or, levels: effLevels, level_mix: mixTotal ? level_mix : undefined };
  });
  if (!sections.length) errors.push('Add at least one section.');
  const names = sections.map((s) => s.name);
  if (new Set(names).size !== names.length) errors.push('Section names must be unique.');
  const computed = sections.reduce((a, s) => a + s.count * s.marks_each, 0);
  const total_marks = Number(raw.total_marks) || computed;
  if (total_marks !== computed) errors.push(`Sections add up to ${computed} marks, but total marks is ${total_marks}.`);
  return {
    errors,
    config: { total_marks, duration: raw.duration || '3 Hrs', degree: raw.degree || '', instructions: raw.instructions || '', sections },
  };
}
