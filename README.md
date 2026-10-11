# Question Paper Generator

Faculty submit questions (Excel bank or a ready ETE paper in Word). The admin builds a final paper from a format
(sections, BT levels, marks). The paper is picked at random on the server, encrypted, and sealed until an unlock time.
Nobody can read it before then, including the admin who made it.

## Deploy on Vercel

1. Push this folder to a GitHub repository and import it in Vercel (framework: Next.js, no build settings to change).
2. In the Vercel project, open **Storage** and add **Neon (Postgres)**. It adds `DATABASE_URL` for you.
   Supabase or any Postgres connection string also works; set it as `DATABASE_URL`.
3. In **Settings > Environment Variables** add the values from `.env.example`:
   - `AUTH_SECRET`: any long random string
   - `PAPER_ENC_KEY`: run `openssl rand -hex 32`. **Back this up.** Without it, sealed papers cannot be opened.
   - `SETUP_TOKEN`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `INSTITUTE_NAME`
   - `REQUIRED_APPROVALS`: `0` for none, `1` to need one other admin's approval before download
4. Deploy, then open `https://YOUR-APP.vercel.app/api/setup?token=YOUR_SETUP_TOKEN` once.
   This creates the tables, your admin account and the sample format `ETE-60 (BCA/MCA)`.
5. Delete `SETUP_TOKEN` from the environment variables afterwards (this switches the setup page off), then sign in.

## First use

1. Admin > **Subjects**: add the subject code, name and number of COs.
2. Admin > **Faculty**: create faculty accounts.
3. Admin > **Formats**: check or add paper formats (section, questions, marks, allowed BT levels, OR, optional exact mix such as `1:1,2:2,3:1`).
4. Faculty upload a question bank (.xlsx: Qno, Question, Question Level, CO) or a ready paper (.docx, standard ETE layout) and pick the format name.
5. Admin > **Generate**: choose subject, format, source, number of sets and unlock time. Papers appear under **Papers** and can be downloaded as Word once unlocked.

## Rules built in

- Max 3 sets per faculty per subject (enforced by a database constraint).
- Excel and Word uploads are checked before saving: BT level 1 to 6, CO within the subject's COs, section and question counts against the chosen format, course code against the chosen subject. Errors list the exact row or question.
- Exact duplicate questions are skipped; near-duplicates are flagged.
- Random selection uses a cryptographic random generator. It prefers questions not used before, spreads questions across faculty, tries to cover every CO, and never puts near-identical questions in one paper.
- OR options are built from two questions with the same BT level and CO.
- Several sets (A/B/C) share no questions.
- Questions with images are left out unless the admin ticks the option. Images inside uploaded Word papers are kept and placed in the final paper.
- Every login, upload, generation, approval and download is recorded in `audit_log`.

## Limits to know

- The final selection is stored only as an encrypted blob, but the question pool itself is stored as plain text in the database, and anyone holding both the database and `PAPER_ENC_KEY` can decrypt papers. Keep the Vercel project and database access to a very small group.
- Vercel limits a request body to about 4.5 MB, which is plenty for question files.
- Run `node scripts/selftest.mjs path/to/paper.docx` to check how a Word paper is read without the database.
