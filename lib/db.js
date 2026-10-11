import pg from 'pg';

const g = globalThis;
export const pool =
  g.__qpgPool ||
  (g.__qpgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 }));

export const q = (text, params) => pool.query(text, params);
