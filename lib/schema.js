export const SCHEMA = `
create table if not exists users(
  id serial primary key, name text not null, email text unique not null,
  password_hash text not null, role text not null check (role in ('admin','faculty')),
  created_at timestamptz default now());

create table if not exists subjects(
  id serial primary key, code text unique not null, name text not null,
  co_count int not null default 5, created_at timestamptz default now());

create table if not exists formats(
  id serial primary key, name text unique not null, config jsonb not null,
  created_at timestamptz default now());

create table if not exists uploads(
  id serial primary key,
  faculty_id int not null references users(id) on delete cascade,
  subject_id int not null references subjects(id) on delete cascade,
  set_no int not null check (set_no between 1 and 3),
  kind text not null check (kind in ('bank','paper')),
  format_id int references formats(id) on delete set null,
  filename text, question_count int default 0, warnings jsonb default '[]',
  created_at timestamptz default now(),
  unique (faculty_id, subject_id, set_no));

create table if not exists questions(
  id serial primary key,
  upload_id int not null references uploads(id) on delete cascade,
  subject_id int not null references subjects(id) on delete cascade,
  faculty_id int not null references users(id) on delete cascade,
  qno text, text text not null, level int not null check (level between 1 and 6),
  co int not null, section text, image text, text_hash text not null,
  times_used int not null default 0, created_at timestamptz default now());
create index if not exists q_subject_idx on questions(subject_id);
create unique index if not exists q_unique_text on questions(subject_id, text_hash);

create table if not exists generated_papers(
  id serial primary key,
  subject_id int not null references subjects(id),
  format_id int references formats(id) on delete set null,
  label text, paper_ref text not null,
  created_by int references users(id),
  release_at timestamptz not null,
  payload text not null,
  downloads int not null default 0,
  created_at timestamptz default now());

create table if not exists paper_approvals(
  paper_id int references generated_papers(id) on delete cascade,
  admin_id int references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (paper_id, admin_id));

create table if not exists audit_log(
  id serial primary key, user_id int, action text not null, detail jsonb,
  created_at timestamptz default now());
`;

export const DEFAULT_FORMAT = {
  name: 'ETE-60 (BCA/MCA)',
  config: {
    total_marks: 60,
    duration: '3 Hrs',
    sections: [
      { name: 'A', count: 4, marks_each: 6, has_or: false, levels: [1, 2, 3] },
      { name: 'B', count: 2, marks_each: 10, has_or: true, levels: [3, 4] },
      { name: 'C', count: 1, marks_each: 16, has_or: true, levels: [5, 6] },
    ],
  },
};
