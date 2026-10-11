import pg from 'pg';

const g = globalThis;

function createPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Go to Vercel Project Settings > Environment Variables and add DATABASE_URL (for Production).'
    );
  }

  const isLocal =
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

