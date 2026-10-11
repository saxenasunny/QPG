import bcrypt from 'bcryptjs';
import { q } from './db.js';
import { SCHEMA, DEFAULT_FORMAT } from './schema.js';

let initialized = false;

export async function ensureDatabase() {
  if (initialized) return;
  try {
    // Quick probe: do tables exist?
    await q('select 1 from users limit 1');
    await q(`create table if not exists faculty_subjects(
      faculty_id int not null references users(id) on delete cascade,
      subject_id int not null references subjects(id) on delete cascade,
      created_at timestamptz default now(),
      primary key (faculty_id, subject_id))`);
    initialized = true;
  } catch (err) {
    console.log('[QPG] Initializing database tables...');
    await q(SCHEMA);
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const email = ADMIN_EMAIL.toLowerCase().trim();
      const has = await q('select 1 from users where email=$1', [email]);
      if (!has.rowCount) {
        await q('insert into users(name,email,password_hash,role) values($1,$2,$3,$4)', [
          ADMIN_NAME || 'Admin',
          email,
          await bcrypt.hash(ADMIN_PASSWORD.trim(), 10),
          'admin',
        ]);
        console.log('[QPG] Auto-created admin user:', email);
      }
    }
    await q(
      'insert into formats(name, config) values($1,$2) on conflict (name) do nothing',
      [DEFAULT_FORMAT.name, JSON.stringify(DEFAULT_FORMAT.config)]
    );
    initialized = true;
  }
}
