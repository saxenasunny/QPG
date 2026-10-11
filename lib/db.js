import pg from 'pg';

const g = globalThis;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  const isLocal =
    !connectionString ||
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  return new pg.Pool({
    connectionString,
    max: 3,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
}

export const pool = g.__qpgPool || (g.__qpgPool = createPool());

export const q = (text, params) => pool.query(text, params);

