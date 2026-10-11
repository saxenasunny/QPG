import crypto from 'crypto';

/** "BT 2", "BT2", "L2", 2  ->  2   (only 1..6 accepted) */
export function normLevel(v) {
  const m = String(v ?? '').match(/(\d)/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 6 ? n : null;
}

/** "[CO1]", "CO 3", 3  ->  number */
export function normCO(v) {
  const m = String(v ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export const normText = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const hashText = (s) => crypto.createHash('sha1').update(normText(s)).digest('hex');

export const tokenSet = (s) => new Set(normText(s).split(' ').filter((w) => w.length > 2));

export function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export const normCode = (s) => String(s || '').replace(/[\s-]/g, '').toUpperCase();
