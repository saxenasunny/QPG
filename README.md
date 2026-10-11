# Question Paper Generator

Faculty submit questions (Excel bank or a ready ETE paper in Word). The admin builds a final paper from a format
(sections, BT levels, marks). The paper is picked at random on the server, encrypted, and sealed until an unlock time.
Nobody can read it before then, including the admin who made it.

## Deploy on Vercel with Neon (Serverless Postgres)

### Option A: 1-Click via Vercel Storage (Easiest)
1. Push this repository to GitHub and import it into [Vercel](https://vercel.com).
2. In your Vercel project dashboard, go to the **Storage** tab.
3. Click **Create Database** and choose **Neon (Serverless Postgres)**.
4. Follow the prompt to connect. Vercel automatically creates a free Neon database and injects `DATABASE_URL` / `POSTGRES_URL` directly into your environment variables!

### Option B: Standalone Neon Account
1. Go to [neon.tech](https://neon.tech) and sign up for a free account.
2. Create a new project (e.g. `question-paper-gen`).
3. On the Neon Dashboard under **Connection Details**:
   - Check the **Pooled connection** checkbox (strongly recommended for Vercel serverless).
   - Copy the connection string.
   - Example: `postgresql://neondb_owner:xyz123@ep-cool-fog-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. In your Vercel project dashboard, go to **Settings > Environment Variables** and add:
   - `DATABASE_URL`: Your Neon pooled connection string.

### Configure Environment Variables in Vercel
In Vercel **Settings > Environment Variables**, ensure these variables are added:
- `DATABASE_URL`: Your Neon connection string (auto-added if using Option A).
- `AUTH_SECRET`: A random 32+ character string (e.g., run `openssl rand -base64 32`).
- `PAPER_ENC_KEY`: 64 hex characters (32 bytes) for AES-256-GCM paper encryption. Run `openssl rand -hex 32`. **Back this up securely** (without it, generated papers cannot be decrypted).
- `SETUP_TOKEN`: A secret token of your choice to protect `/api/setup` (e.g., `setup_token_98234`).
- `ADMIN_NAME`: Your exam cell administrator name (e.g., `Exam Controller`).
- `ADMIN_EMAIL`: Admin login email (e.g., `admin@college.edu`).
- `ADMIN_PASSWORD`: Admin login password (at least 8 characters).
- `INSTITUTE_NAME`: Name of your university / institution printed on question papers.
- `REQUIRED_APPROVALS`: Number of other admins required to approve a paper before download (`0` for none, `1` for 1 approval).

### Initialize Database
1. Deploy or redeploy the project on Vercel.
2. Once deployed, open the setup endpoint once in your browser:
   `https://YOUR-APP.vercel.app/api/setup?token=YOUR_SETUP_TOKEN`
3. You will receive: `{"ok":true,"tables":"ready","admin":"created: admin@college.edu"}`.
   This automatically creates all required tables and default exam format in Neon.
4. **Security step**: Go back to Vercel **Settings > Environment Variables**, delete `SETUP_TOKEN`, and redeploy. This turns off the setup endpoint.
5. Sign in at `https://YOUR-APP.vercel.app` using your admin credentials.



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
