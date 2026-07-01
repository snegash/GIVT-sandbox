// server/routes.js — every GIVT endpoint. Mounted at /api by index.js.
import { Router } from "express";
import { pool, query, tx } from "./db.js";
import { requireAuth, hashPassword, checkPassword, signToken } from "./auth.js";
import { callAnthropic } from "./anthropic.js";

const router = Router();

/* ---------------- GIVT token economy (context.md §2) ---------------- */
const ACCOUNT_REWARD = 500;
const VERIFIER_START_WALLET = 5000;
const STARTING_WALLET = {
  Student: 0, Advisor: VERIFIER_START_WALLET, Professor: VERIFIER_START_WALLET,
  Employer: VERIFIER_START_WALLET, Peer: VERIFIER_START_WALLET,
};

/* ---------------- helpers ---------------- */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isDup = (e) => e && e.code === "23505"; // unique_violation

async function ownsSession(req, res) {
  const r = await query("select user_id from sessions where id=$1", [req.params.id]);
  if (!r.rows[0]) { res.status(404).json({ error: "Session not found" }); return false; }
  if (r.rows[0].user_id !== req.userId) { res.status(403).json({ error: "Forbidden" }); return false; }
  return true;
}
async function ownsAccount(accountId, userId) {
  if (!accountId) return false;
  const r = await query("select 1 from accounts where id=$1 and user_id=$2", [accountId, userId]);
  return r.rowCount > 0;
}
async function latest(table, sessionId) {
  const r = await query(
    `select * from ${table} where session_id=$1 order by created_at desc limit 1`, [sessionId]
  );
  return r.rows[0] || null;
}

/* ====================== AUTH ====================== */
router.post("/auth/signup", ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const hash = await hashPassword(password);
  try {
    const r = await query(
      "insert into app_users (email, password_hash) values ($1,$2) returning id, email",
      [String(email).toLowerCase().trim(), hash]
    );
    const user = r.rows[0];
    res.json({ token: signToken(user.id), user });
  } catch (e) {
    if (isDup(e)) return res.status(409).json({ error: "An account with that email already exists" });
    throw e;
  }
}));

router.post("/auth/login", ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const r = await query("select id, email, password_hash from app_users where email=$1",
    [String(email).toLowerCase().trim()]);
  const row = r.rows[0];
  if (!row || !(await checkPassword(password, row.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signToken(row.id), user: { id: row.id, email: row.email } });
}));

router.get("/auth/me", requireAuth, ah(async (req, res) => {
  const r = await query("select id, email from app_users where id=$1", [req.userId]);
  if (!r.rows[0]) return res.status(401).json({ error: "User not found" });
  res.json({ user: r.rows[0] });
}));

/* ====================== ACCOUNTS & LEDGER ====================== */
router.get("/accounts/me", requireAuth, ah(async (req, res) => {
  const r = await query("select * from accounts where user_id=$1", [req.userId]);
  res.json(r.rows[0] || null);
}));

router.post("/accounts", requireAuth, ah(async (req, res) => {
  const { role, name, hedera, profile } = req.body || {};
  if (!role || !name) return res.status(400).json({ error: "role and name required" });
  const opening = (STARTING_WALLET[role] ?? 0) + ACCOUNT_REWARD;
  try {
    const account = await tx(async (c) => {
      const ins = await c.query(
        `insert into accounts (user_id, role, full_name, hedera_address, profile, token_balance, verifier_points)
         values ($1,$2,$3,$4,$5,$6,0) returning *`,
        [req.userId, role, name, hedera || null, profile || null, opening]
      );
      const acct = ins.rows[0];
      await c.query(
        `insert into token_ledger (kind, amount, from_party, to_party, to_account, note)
         values ('account',$1,'GIVT treasury',$2,$3,$4)`,
        [ACCOUNT_REWARD, role, acct.id, "Account creation reward (" + role + ")"]
      );
      return acct;
    });
    res.json(account);
  } catch (e) {
    if (isDup(e)) return res.status(409).json({ error: "You already have an account" });
    throw e;
  }
}));

router.patch("/accounts/:id", requireAuth, ah(async (req, res) => {
  if (!(await ownsAccount(req.params.id, req.userId))) return res.status(403).json({ error: "Forbidden" });
  const { name, hedera, profile } = req.body || {};
  const r = await query(
    `update accounts set full_name=$1, hedera_address=$2, profile=$3 where id=$4 returning *`,
    [name, hedera || null, profile || null, req.params.id]
  );
  res.json(r.rows[0]);
}));

router.get("/ledger", requireAuth, ah(async (req, res) => {
  const r = await query("select * from token_ledger order by created_at desc limit 100");
  res.json(r.rows);
}));

/* ====================== SESSIONS ====================== */
router.get("/sessions", requireAuth, ah(async (req, res) => {
  const r = await query("select * from sessions where user_id=$1 order by updated_at desc", [req.userId]);
  res.json(r.rows);
}));

// Get latest session or create one.
router.post("/sessions/current", requireAuth, ah(async (req, res) => {
  const existing = await query(
    "select * from sessions where user_id=$1 order by updated_at desc limit 1", [req.userId]);
  if (existing.rows[0]) return res.json(existing.rows[0]);
  const { accountId = null, title = "GIVT session" } = req.body || {};
  const r = await query(
    "insert into sessions (user_id, account_id, title) values ($1,$2,$3) returning *",
    [req.userId, accountId, title]);
  res.json(r.rows[0]);
}));

router.patch("/sessions/:id", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const { resume_text, jd_text, detected_company, resume_company, title } = req.body || {};
  const r = await query(
    `update sessions set
       resume_text      = coalesce($1, resume_text),
       jd_text          = coalesce($2, jd_text),
       detected_company = coalesce($3, detected_company),
       resume_company   = coalesce($4, resume_company),
       title            = coalesce($5, title)
     where id=$6 returning *`,
    [resume_text ?? null, jd_text ?? null, detected_company ?? null, resume_company ?? null, title ?? null, req.params.id]
  );
  res.json(r.rows[0]);
}));

router.post("/sessions/:id/files", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const { kind, name, words, sizeKb, url } = req.body || {};
  const r = await query(
    `insert into session_files (session_id, user_id, kind, name, words, size_kb, url)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [req.params.id, req.userId, kind, name, words ?? null, sizeKb ?? null, url ?? null]);
  res.json(r.rows[0]);
}));

router.get("/sessions/:id/files", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const r = await query("select * from session_files where session_id=$1 order by created_at", [req.params.id]);
  res.json(r.rows);
}));

/* ====================== AGENT 01 · TRANSLATOR ====================== */
router.post("/sessions/:id/translator", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const o = req.body || {};
  const r = await query(
    `insert into translator_outputs
       (session_id, user_id, resume_skills, jd_skills, gaps, met, translated_resume, jd_role, examples)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [req.params.id, req.userId, o.resumeSkills ?? [], o.jdSkills ?? [], o.gaps ?? [], o.met ?? [],
     o.translatedResume ?? null, o.role ?? null, JSON.stringify(o.examples ?? [])]);
  res.json(r.rows[0]);
}));
router.get("/sessions/:id/translator/latest", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  res.json(await latest("translator_outputs", req.params.id));
}));

/* ====================== AGENT 02 · TALENT ====================== */
router.post("/sessions/:id/talent", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const t = req.body || {};
  const r = await query(
    `insert into talent_profiles (session_id, user_id, company_name, profile_text, locked, use_cases, talent_demand)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [req.params.id, req.userId, t.companyName ?? null, t.profile ?? null, !!t.locked,
     JSON.stringify(t.useCases ?? []), JSON.stringify(t.talentDemand ?? [])]);
  res.json(r.rows[0]);
}));
router.patch("/talent/:tid", requireAuth, ah(async (req, res) => {
  const own = await query("select user_id from talent_profiles where id=$1", [req.params.tid]);
  if (!own.rows[0]) return res.status(404).json({ error: "Not found" });
  if (own.rows[0].user_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const f = req.body || {};
  const r = await query(
    `update talent_profiles set
       company_name  = coalesce($1, company_name),
       profile_text  = coalesce($2, profile_text),
       locked        = coalesce($3, locked)
     where id=$4 returning *`,
    [f.companyName ?? null, f.profile ?? null, typeof f.locked === "boolean" ? f.locked : null, req.params.tid]);
  res.json(r.rows[0]);
}));
router.get("/sessions/:id/talent/latest", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  res.json(await latest("talent_profiles", req.params.id));
}));

/* ====================== AGENT 03 · CURRICULUM ====================== */
router.post("/sessions/:id/curriculum", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const c = req.body || {};
  const r = await query(
    `insert into curriculum_plans (session_id, user_id, catalog_text, enhanced_courses, future_curriculum)
     values ($1,$2,$3,$4,$5) returning *`,
    [req.params.id, req.userId, c.catalogText ?? null,
     JSON.stringify(c.enhancedCourses ?? []), JSON.stringify(c.futureCurriculum ?? [])]);
  res.json(r.rows[0]);
}));
router.get("/sessions/:id/curriculum/latest", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  res.json(await latest("curriculum_plans", req.params.id));
}));

/* ====================== AGENT 04 · ADVISOR (syllabi) ====================== */
router.post("/sessions/:id/syllabi", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const s = req.body || {};
  const r = await query(
    `insert into syllabi
       (session_id, user_id, syllabus_index, title, credit_hours, training_hours,
        objectives, outcomes, gaps_addressed, weekly_schedule, tasks, assessment)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (session_id, syllabus_index) do update set
       title=excluded.title, credit_hours=excluded.credit_hours, training_hours=excluded.training_hours,
       objectives=excluded.objectives, outcomes=excluded.outcomes, gaps_addressed=excluded.gaps_addressed,
       weekly_schedule=excluded.weekly_schedule, tasks=excluded.tasks, assessment=excluded.assessment
     returning *`,
    [req.params.id, req.userId, s.index, s.title, s.creditHours ?? null, s.trainingHours ?? null,
     JSON.stringify(s.objectives ?? []), JSON.stringify(s.outcomes ?? []), JSON.stringify(s.gapsAddressed ?? []),
     JSON.stringify(s.weeklySchedule ?? []), JSON.stringify(s.tasks ?? []), s.assessment ?? null]);
  res.json(r.rows[0]);
}));
router.get("/sessions/:id/syllabi", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const r = await query("select * from syllabi where session_id=$1 order by syllabus_index", [req.params.id]);
  res.json(r.rows);
}));

/* ====================== AGENTS 06/07 · GAN ====================== */
router.post("/sessions/:id/gan-runs", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const g = req.body || {};
  const r = await query(
    `insert into gan_runs (session_id, user_id, sector, seed_modules, recommendation_doc, guideline_doc, published)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [req.params.id, req.userId, g.sector ?? null, JSON.stringify(g.seedModules ?? []),
     g.recommendationDoc ?? null, g.guidelineDoc ?? null, !!g.published]);
  res.json(r.rows[0]);
}));
router.get("/sessions/:id/gan-runs/latest", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  res.json(await latest("gan_runs", req.params.id));
}));
router.post("/gan-runs/:rid/loops", requireAuth, ah(async (req, res) => {
  const own = await query("select user_id from gan_runs where id=$1", [req.params.rid]);
  if (!own.rows[0]) return res.status(404).json({ error: "GAN run not found" });
  if (own.rows[0].user_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const l = req.body || {};
  const r = await query(
    `insert into gan_loops
       (gan_run_id, user_id, loop_number, mean_coverage, flags_count, equilibrium_ready, step1, critique, step3)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (gan_run_id, loop_number) do update set
       mean_coverage=excluded.mean_coverage, flags_count=excluded.flags_count,
       equilibrium_ready=excluded.equilibrium_ready, step1=excluded.step1,
       critique=excluded.critique, step3=excluded.step3
     returning *`,
    [req.params.rid, req.userId, l.loopNumber, l.meanCoverage ?? null, l.flagsCount ?? 0,
     !!l.equilibriumReady, JSON.stringify(l.step1 ?? {}), JSON.stringify(l.critique ?? {}), JSON.stringify(l.step3 ?? {})]);
  res.json(r.rows[0]);
}));
router.get("/gan-runs/:rid/loops", requireAuth, ah(async (req, res) => {
  const own = await query("select user_id from gan_runs where id=$1", [req.params.rid]);
  if (!own.rows[0]) return res.status(404).json({ error: "GAN run not found" });
  if (own.rows[0].user_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const r = await query("select * from gan_loops where gan_run_id=$1 order by loop_number", [req.params.rid]);
  res.json(r.rows);
}));
router.patch("/gan-runs/:rid/publish", requireAuth, ah(async (req, res) => {
  const own = await query("select user_id from gan_runs where id=$1", [req.params.rid]);
  if (!own.rows[0]) return res.status(404).json({ error: "GAN run not found" });
  if (own.rows[0].user_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const r = await query("update gan_runs set published=true where id=$1 returning *", [req.params.rid]);
  res.json(r.rows[0]);
}));

/* ====================== TOKEN ECONOMY (transactions) ====================== */

// Verify a skill: +100 student tokens, +500 verifier points. One per role/skill.
router.post("/economy/verify", requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.sessionId || !b.skill || !b.verifierRole) {
    return res.status(400).json({ error: "sessionId, skill and verifierRole are required" });
  }
  if (b.verifierRole === "Student") return res.status(400).json({ error: "Students cannot verify" });
  // caller must own the session and (if given) the verifier account
  const so = await query("select user_id from sessions where id=$1", [b.sessionId]);
  if (!so.rows[0]) return res.status(404).json({ error: "Session not found" });
  if (so.rows[0].user_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  if (b.verifierAccountId && !(await ownsAccount(b.verifierAccountId, req.userId))) {
    return res.status(403).json({ error: "verifier account must belong to you" });
  }
  try {
    const result = await tx(async (c) => {
      const ins = await c.query(
        `insert into skill_verifications
           (session_id, student_account_id, skill_name, verifier_role, verifier_account_id, confidence, comment, hedera_address)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [b.sessionId, b.studentAccountId ?? null, b.skill, b.verifierRole,
         b.verifierAccountId ?? null, b.confidence ?? 1, b.comment ?? null, b.hedera ?? null]);
      if (b.studentAccountId) {
        await c.query("update accounts set token_balance = token_balance + 100 where id=$1", [b.studentAccountId]);
      }
      if (b.verifierAccountId) {
        await c.query("update accounts set verifier_points = verifier_points + 500 where id=$1", [b.verifierAccountId]);
      }
      return ins.rows[0];
    });
    res.json(result);
  } catch (e) {
    if (isDup(e)) return res.status(409).json({ error: "This skill is already verified for that role" });
    throw e;
  }
}));

// Professor supervises a syllabus: +900 professor tokens + ledger.
router.post("/economy/supervise", requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.professorAccountId) return res.status(400).json({ error: "professorAccountId required" });
  try {
    const result = await tx(async (c) => {
      const ins = await c.query(
        `insert into supervision (syllabus_id, session_id, syllabus_index, professor_account_id, tokens_awarded, note)
         values ($1,$2,$3,$4,900,$5) returning *`,
        [b.syllabusId ?? null, b.sessionId ?? null, b.syllabusIndex ?? null, b.professorAccountId,
         "Agreed to supervise syllabus " + (b.syllabusIndex ?? "")]);
      await c.query("update accounts set token_balance = token_balance + 900 where id=$1", [b.professorAccountId]);
      await c.query(
        `insert into token_ledger (kind, amount, from_party, to_party, to_account, note)
         values ('supervise',900,'Platform escrow','Professor',$1,'Supervision reward (+900)')`,
        [b.professorAccountId]);
      return ins.rows[0];
    });
    res.json(result);
  } catch (e) {
    if (isDup(e)) return res.status(409).json({ error: "Already supervised by that professor" });
    throw e;
  }
}));

// Professor awards tokens to a student.
router.post("/economy/award", requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  const amount = Math.round(Number(b.amount));
  if (!b.fromProfessorAccountId || !b.toStudentAccountId) {
    return res.status(400).json({ error: "fromProfessorAccountId and toStudentAccountId required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "amount must be positive" });
  if (!(await ownsAccount(b.fromProfessorAccountId, req.userId))) {
    return res.status(403).json({ error: "You can only award from your own account" });
  }
  const result = await tx(async (c) => {
    const bal = await c.query("select token_balance from accounts where id=$1 for update", [b.fromProfessorAccountId]);
    if (!bal.rows[0]) throw Object.assign(new Error("Professor account not found"), { status: 404 });
    if (amount > bal.rows[0].token_balance) throw Object.assign(new Error("Amount exceeds balance"), { status: 400 });
    await c.query("update accounts set token_balance = token_balance - $1 where id=$2", [amount, b.fromProfessorAccountId]);
    await c.query("update accounts set token_balance = token_balance + $1 where id=$2", [amount, b.toStudentAccountId]);
    const led = await c.query(
      `insert into token_ledger (kind, amount, from_party, to_party, from_account, to_account, note)
       values ('award',$1,'Professor','Student',$2,$3,$4) returning *`,
      [amount, b.fromProfessorAccountId, b.toStudentAccountId, "Awarded " + amount + " GIVT to student"]);
    return led.rows[0];
  });
  res.json(result);
}));

/* ====================== REPUTATION & LEADERBOARD ====================== */
router.get("/sessions/:id/verifications", requireAuth, ah(async (req, res) => {
  if (!(await ownsSession(req, res))) return;
  const r = await query(
    "select * from skill_verifications where session_id=$1 order by created_at", [req.params.id]);
  res.json(r.rows);
}));

router.post("/reputation/score", requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  if (!(await ownsAccount(b.accountId, req.userId))) return res.status(403).json({ error: "Forbidden" });
  const r = await query(
    `insert into reputation_scores (account_id, reputation, verification_status, composite, level)
     values ($1,$2,$3,$4,$5)
     on conflict (account_id) do update set
       reputation=excluded.reputation, verification_status=excluded.verification_status,
       composite=excluded.composite, level=excluded.level
     returning *`,
    [b.accountId, b.reputation ?? 0, b.verificationStatus ?? 0, b.composite ?? 0, b.level ?? null]);
  res.json(r.rows[0]);
}));

router.get("/leaderboard", ah(async (_req, res) => {
  const r = await query("select * from leaderboard");
  res.json(r.rows);
}));

/* ====================== LOOKUPS ====================== */
router.get("/skills", ah(async (_req, res) => {
  res.json((await query("select * from skills order by name")).rows);
}));
router.get("/sectors", ah(async (_req, res) => {
  res.json((await query("select * from sectors order by sort_order")).rows);
}));

/* ====================== AI PROXY ====================== */
router.post("/ai/anthropic", requireAuth, ah(async (req, res) => {
  const { status, data } = await callAnthropic(req.body || {});
  res.status(status).json(data);
}));

export default router;
