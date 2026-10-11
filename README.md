# Question Paper Generator

Faculty submit questions (Excel bank or a ready ETE paper in Word). The admin builds a final paper from a format
(sections, BT levels, marks). The paper is picked at random on the server, encrypted, and sealed until an unlock time.
Nobody can read it before then, including the admin who made it.

## Deploy on Vercel with Supabase

### 1. Set Up Supabase Database
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > Database**.
3. Under **Connection string**, select **URI** and choose **Transaction Pooler** (recommended for Vercel serverless, port 6543) or **Session Pooler** (port 5432).
4. Copy the connection string. Replace `[YOUR-PASSWORD]` with your actual database password.
   Example:
   `postgresql://postgres.yourprojectref:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`

### 2. Configure Environment Variables in Vercel
1. In your Vercel project dashboard, go to **Settings > Environment Variables**.
2. Add the following variables:
   - `DATABASE_URL`: Your Supabase connection string from above.
   - `AUTH_SECRET`: A random 32+ character string (e.g. run `openssl rand -base64 32`).
   - `PAPER_ENC_KEY`: 64 hex characters (32 bytes) for AES-256-GCM paper encryption. Run `openssl rand -hex 32`. **Back this up securely** (without it, generated papers cannot be decrypted).
   - `SETUP_TOKEN`: A secret token of your choice to protect `/api/setup` (e.g. `setup_sec_98765`).
   - `ADMIN_NAME`: Your exam cell administrator name (e.g. `Exam Controller`).
   - `ADMIN_EMAIL`: Admin login email (e.g. `admin@college.edu`).
   - `ADMIN_PASSWORD`: Admin login password (at least 8 characters).
   - `INSTITUTE_NAME`: Name of your university / institution printed on question papers.
   - `REQUIRED_APPROVALS`: Number of other admins required to approve a paper before download (`0` for none, `1` for 1 approval).

### 3. Deploy & Initialize Database
1. Deploy the project on Vercel.
2. Once deployed, open the setup endpoint in your browser:
   `https://YOUR-APP.vercel.app/api/setup?token=YOUR_SETUP_TOKEN`
3. You will receive a JSON response: `{"ok":true,"tables":"ready","admin":"created: admin@college.edu"}`.
   This automatically creates all required tables (`users`, `subjects`, `formats`, `uploads`, `questions`, `generated_papers`, `paper_approvals`, `audit_log`) and the default `ETE-60 (BCA/MCA)` paper format in your Supabase database.
4. **Security step**: Go back to Vercel **Settings > Environment Variables**, delete `SETUP_TOKEN`, and redeploy. This deactivates the setup endpoint.
5. Log in at `https://YOUR-APP.vercel.app` using your admin credentials.


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
