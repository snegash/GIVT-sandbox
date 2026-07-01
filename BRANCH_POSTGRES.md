# GIVT Sandbox — PostgreSQL backend (branch `AAU-Berihun`)

Persistence using **local PostgreSQL** now, designed to **migrate to Supabase**
later by changing one connection string.

A browser app can't talk to PostgreSQL directly, so this adds a small backend:

```
React (Vite, :5173)  →  Express API (:3001)  →  PostgreSQL (:5432)
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ installed and running (postgresql.org/download). During the
  Windows install you set a password for the `postgres` user — remember it.

## If you already added the earlier Supabase files, delete them first

```
src/supabaseClient.js
supabase/          (the whole folder: schema.sql, rpc.sql, functions/)
```

This version replaces them with `db/`, `server/`, and `src/api.js`.

## What's in this bundle

```
GIVT-sandbox/
├── .env.example            ← frontend env (VITE_API_URL)
├── BRANCH_POSTGRES.md       ← this file
├── package.json            ← frontend deps (no supabase)
├── db/
│   └── schema.sql          ← PostgreSQL schema (runs on Supabase too)
├── server/                 ← Express API (its OWN package.json)
│   ├── .env.example
│   ├── package.json
│   ├── index.js            ← entry
│   ├── db.js               ← pg pool + tx()
│   ├── auth.js             ← bcrypt + JWT + requireAuth
│   ├── anthropic.js        ← server-side AI call
│   └── routes.js           ← all endpoints
└── src/
    ├── api.js              ← fetch client (adds JWT)
    ├── db.js               ← data layer (same names as before)
    ├── auth.js             ← email/password
    ├── AuthGate.jsx        ← login screen (wraps app)
    └── main.jsx            ← wraps <App/> in <AuthGate>
```

`src/App.jsx` is unchanged; you add a few optional calls (section “Wire into App.jsx”).

---

## Setup — simple steps

**1. Unzip into the repo root** (Windows cmd, from your project folder):
```
tar -xf givt-postgres-files.zip
```

**2. Create the database and load the schema.**
Using the terminal (psql on PATH):
```
createdb givt
psql -d givt -f db/schema.sql
```
Or with pgAdmin: right-click Databases → Create → Database `givt`; then open
`db/schema.sql` in the Query Tool and click Execute. You should get 15 tables
and 12 rows in `sectors`.

**3. Start the backend.**
```
cd server
npm install
copy .env.example .env        (macOS/Linux: cp .env.example .env)
```
Edit `server/.env`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/givt
JWT_SECRET=any-long-random-string
ANTHROPIC_API_KEY=sk-ant-xxxx
```
Then:
```
npm start
```
You should see `GIVT API listening on http://localhost:3001`. Test it:
open http://localhost:3001/health → `{"ok":true}`.

**4. Start the frontend** (new terminal, in the repo root):
```
npm install
copy .env.example .env.local   (macOS/Linux: cp .env.example .env.local)
npm run dev
```
`.env.local` just needs `VITE_API_URL=http://localhost:3001`.

**5. Use it.** Open http://localhost:5173 → create an account → you're in.
Keep both terminals running (backend + frontend).

---

## Wire into App.jsx (optional, minimal)

Add once near the top of `src/App.jsx`:
```js
import * as db from "./db";
```
Function names match the earlier version, so the same insertion points apply:

- **Hydrate on load** (top-level `App` effect):
  ```js
  useEffect(() => { (async () => {
    const acct = await db.getMyAccount();
    if (acct) setAccount(acct);
    const s = await db.getOrCreateSession(acct?.id);
    setSessionId(s.id);                       // keep sessionId in state
  })().catch(console.error); }, []);
  ```
- **Account create/update** — in `AccountModal`'s `submit`, after building `acct`:
  ```js
  const saved = existing
    ? await db.updateAccount(existing.id, { name: acct.name, hedera: acct.hedera, profile: acct.profile })
    : await db.createAccount({ role: acct.role, name: acct.name, hedera: acct.hedera, profile: acct.profile });
  S.setAccount(saved);
  ```
- **Swap the two Anthropic calls** (Talent ≈ line 889, AccountModal ≈ line 1896):
  replace each `fetch(...)`+`res.json()` with `const data = await db.callAnthropic(body);`
- **Token actions** — `db.verifySkill({ sessionId, studentAccountId: S.account?.id, skill, verifierRole: role, verifierAccountId: S.account?.id, confidence, comment, hedera })`,
  `db.superviseSyllabus({ syllabusIndex: i, professorAccountId: S.account?.id })`,
  `db.awardTokens({ fromProfessorAccountId: S.account?.id, toStudentAccountId: S.account?.id, amount })`.
- **Persist agent output** after each agent runs: `db.saveTranslatorOutput(sessionId, out)`,
  `db.saveTalentProfile`, `db.saveCurriculumPlan`, `db.saveSyllabus`, `db.saveGanRun` → `db.addGanLoop` → `db.publishGanRun`.

Keep your existing in-memory state updates for instant UI; the DB calls persist alongside them.

---

## Migrate to Supabase later (one connection string)

The schema is plain PostgreSQL, so nothing in your code changes:

1. Create a Supabase project. SQL Editor → paste `db/schema.sql` → Run.
2. Supabase → Project Settings → Database → copy the **connection string (URI)**.
3. In `server/.env`, set `DATABASE_URL` to that URI and `DATABASE_SSL=true`.
4. Restart the backend. Your data now lives in Supabase's cloud Postgres.

(If you later want to drop the Express server and use Supabase's built-in
API/Auth/Edge Functions instead, that's the alternative version — ask and I'll
hand it back.)

---

## Republish on Replit

Run both processes:
- Backend: a Node Repl (or the same Repl) running `cd server && npm install && npm start`.
  Add Replit **Secrets**: `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`,
  `ANTHROPIC_API_KEY`. Point `DATABASE_URL` at your Supabase Postgres.
- Frontend: set Secret `VITE_API_URL` to the backend's public URL, then `npm run dev`.

---

## Git workflow (your branch → snegash/main)

```
git checkout AAU-Berihun
git pull origin AAU-Berihun
git rm -r --cached supabase 2>NUL          (only if the Supabase folder was committed before)
git add db server src package.json .env.example BRANCH_POSTGRES.md
git commit -m "Add PostgreSQL backend: schema, Express API, auth, AI proxy"
git push origin AAU-Berihun
```
Open a Pull Request `AAU-Berihun` → `main` for snegash to review and merge.
Never commit `server/.env` or `.env.local` (both are gitignored / not staged).

---

## Security notes

- Authorization is enforced in the API (every write checks the JWT user owns the
  row). The token economy runs inside SQL transactions, so balances can't drift.
- The Anthropic key lives only in `server/.env` (server-side); the browser calls
  `/api/ai/anthropic`, never Anthropic directly.
- Use a strong `JWT_SECRET` and, in production, serve the API over HTTPS.
```
