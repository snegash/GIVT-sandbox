// src/db.js — all GIVT reads/writes, talking to the Express API.
// Same function names/signatures as the Supabase version, so App.jsx wiring is
// identical: `import * as db from "./db";  await db.getMyAccount();`
import { request } from "./api";

/* token economy constants (context.md §2) — handy on the client too */
export const ACCOUNT_REWARD = 500;
export const STUDENT_TOKENS_PER_SKILL = 100;
export const VERIFIER_POINTS_PER_SKILL = 500;
export const PROFESSOR_TOKENS_PER_SYLLABUS = 900;

/* ----- Account & identity ----- */
export const getMyAccount = () => request("/accounts/me");
export const createAccount = ({ role, name, hedera, profile }) =>
  request("/accounts", { method: "POST", body: { role, name, hedera, profile } });
export const updateAccount = (accountId, { name, hedera, profile }) =>
  request("/accounts/" + accountId, { method: "PATCH", body: { name, hedera, profile } });
export const getLedger = () => request("/ledger");

/* ----- Sessions ----- */
export const getMySessions = () => request("/sessions");
export const getOrCreateSession = (accountId = null, title = "GIVT session") =>
  request("/sessions/current", { method: "POST", body: { accountId, title } });
export const updateSession = (sessionId, fields) =>
  request("/sessions/" + sessionId, { method: "PATCH", body: fields });
export const addSessionFile = (sessionId, file) =>
  request("/sessions/" + sessionId + "/files", { method: "POST", body: file });
export const listSessionFiles = (sessionId) =>
  request("/sessions/" + sessionId + "/files");

/* ----- 01 Translator ----- */
export const saveTranslatorOutput = (sessionId, o) =>
  request("/sessions/" + sessionId + "/translator", { method: "POST", body: o });
export const getTranslatorOutput = (sessionId) =>
  request("/sessions/" + sessionId + "/translator/latest");

/* ----- 02 Talent ----- */
export const saveTalentProfile = (sessionId, t) =>
  request("/sessions/" + sessionId + "/talent", { method: "POST", body: t });
export const updateTalentProfile = (id, fields) =>
  request("/talent/" + id, { method: "PATCH", body: fields });
export const getTalentProfile = (sessionId) =>
  request("/sessions/" + sessionId + "/talent/latest");

/* ----- 03 Curriculum ----- */
export const saveCurriculumPlan = (sessionId, c) =>
  request("/sessions/" + sessionId + "/curriculum", { method: "POST", body: c });
export const getCurriculumPlan = (sessionId) =>
  request("/sessions/" + sessionId + "/curriculum/latest");

/* ----- 04 Advisor ----- */
export const saveSyllabus = (sessionId, s) =>
  request("/sessions/" + sessionId + "/syllabi", { method: "POST", body: s });
export const listSyllabi = (sessionId) =>
  request("/sessions/" + sessionId + "/syllabi");
export const superviseSyllabus = ({ syllabusId = null, sessionId = null, syllabusIndex = null, professorAccountId }) =>
  request("/economy/supervise", { method: "POST", body: { syllabusId, sessionId, syllabusIndex, professorAccountId } });
export const awardTokens = ({ fromProfessorAccountId, toStudentAccountId, amount }) =>
  request("/economy/award", { method: "POST", body: { fromProfessorAccountId, toStudentAccountId, amount } });

/* ----- 05 Reputation ----- */
export const verifySkill = ({ sessionId, studentAccountId, skill, verifierRole, verifierAccountId = null, confidence = 1, comment = null, hedera = null }) =>
  request("/economy/verify", { method: "POST", body: { sessionId, studentAccountId, skill, verifierRole, verifierAccountId, confidence, comment, hedera } });
export const listVerifications = (sessionId) =>
  request("/sessions/" + sessionId + "/verifications");
export const upsertMyScore = (accountId, { reputation, verificationStatus, composite, level = null }) =>
  request("/reputation/score", { method: "POST", body: { accountId, reputation, verificationStatus, composite, level } });
export const getLeaderboard = () => request("/leaderboard");

/* ----- 06/07 GAN ----- */
export const saveGanRun = (sessionId, g) =>
  request("/sessions/" + sessionId + "/gan-runs", { method: "POST", body: g });
export const getGanRun = (sessionId) =>
  request("/sessions/" + sessionId + "/gan-runs/latest");
export const addGanLoop = (ganRunId, l) =>
  request("/gan-runs/" + ganRunId + "/loops", { method: "POST", body: l });
export const listGanLoops = (ganRunId) =>
  request("/gan-runs/" + ganRunId + "/loops");
export const publishGanRun = (id) =>
  request("/gan-runs/" + id + "/publish", { method: "PATCH" });

/* ----- Lookups ----- */
export const listSkills = () => request("/skills");
export const listSectors = () => request("/sectors");

/* ----- AI (server proxy) ----- */
// Pass the SAME body the app used to send to api.anthropic.com.
export const callAnthropic = (body) => request("/ai/anthropic", { method: "POST", body });
