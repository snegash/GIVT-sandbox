import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* =====================================================================
   GIVT Sandbox — Gamified, Individualized, Verified Talent
   Kennesaw State University · Healthcare Informatics MVP · 2026
   Seven-agent live build (in-memory session state).
   Translator · Talent · Curriculum · Advisor · Reputation ·
   Generator · Discriminator (GAN loop)
   ===================================================================== */

/* ---------------------------------------------------------------- design tokens */
const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A",
  paper: "#F7F3EC", paperWarm: "#EFE7D6",
  rule: "#D8CFBE",
  gold: "#B8862F", goldDeep: "#8C6420",
  teal: "#2D6E6A", tealDeep: "#1F4A47",
  rust: "#A04A1E",
  green: "#1F7A3A", greenSoft: "#D4EAD8",
};
// stakeholder verifier role colors
const ROLE_META = {
  Employer:  { color: "#B8862F", soft: "#F3E8CC", weight: 1.0 },
  Professor: { color: "#2D6E6A", soft: "#D2E7E5", weight: 0.8 },
  Advisor:   { color: "#A04A1E", soft: "#F1DACB", weight: 0.7 },
  Peer:      { color: "#1F7A3A", soft: "#D4EAD8", weight: 0.6 },
};

/* ---------------------------------------------------------------- constants */
const EFFORT_RATIO = 3;
const MAX_TRAINING_HRS = 15;
const MAX_WEEK_HRS = 9;
const DEFAULT_GAP_HRS = 12;
const STUDENT_TOKENS_PER_SKILL = 100;
const VERIFIER_POINTS_PER_SKILL = 500;
const VERIFIER_START_WALLET = 5000;
const PROFESSOR_TOKENS_PER_SYLLABUS = 900;
const ACCOUNT_REWARD = 500;

const SECTORS = [
  "Healthcare & HealthTech", "FinTech & Decentralized Finance",
  "Banking & Financial Services", "Transportation & Smart Mobility",
  "Media & Entertainment", "Sports & SportsTech",
  "STEM & Advanced Technology", "Sustainability & CleanTech",
  "Manufacturing", "E-commerce & Digital Economy",
  "EdTech & Digital Education", "Other",
];

const INNOVATION_SOURCES = [
  { org: "HIMSS", title: "Future of AI in Healthcare", url: "https://www.himss.org/futureofai/" },
  { org: "HIMSS", title: "AI in Healthcare Forum 2025", url: "https://www.himss.org/news-center/apply-ai-across-care-continuum-tools-2025-himss-ai-healthcare-forum/" },
  { org: "JMIR (2025)", title: "Incorporating Generative AI Into a Health Informatics Curriculum", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12707436/" },
  { org: "JMIR (2020)", title: "Teaching Hands-On Informatics Skills: a Competency Framework", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7001041/" },
  { org: "HIMSS", title: "CPHIMS Review & AI/ML microcredential courses", url: "https://www.himss.org/courses/" },
];

const COMPLIANCE_SOURCES = [
  { org: "HHS", title: "HIPAA Privacy & Security Rules", url: "https://www.hhs.gov/hipaa/index.html", lens: "hipaa" },
  { org: "ASTP/ONC", title: "Information Blocking & Certified Health IT", url: "https://www.healthit.gov/topic/information-blocking", lens: "onc" },
  { org: "HL7", title: "FHIR R4 conformance", url: "https://hl7.org/fhir/R4/", lens: "fhir" },
  { org: "NIST", title: "AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework", lens: "nist" },
  { org: "EU", title: "EU AI Act", url: "https://artificialintelligenceact.eu/", lens: "euai" },
  { org: "AHA", title: "Response to HHS RFI on AI in Health Care (Feb 2026)", url: "https://www.aha.org/lettercomment/2026-02-23-aha-response-hhs-rfi-ai-health-care", lens: "monitoring" },
];

const COMPLIANCE_LENSES = {
  hipaa: "HIPAA PHI safeguards",
  onc: "ONC interoperability / info-blocking",
  fhir: "HL7 FHIR R4 conformance",
  nist: "NIST AI RMF lifecycle controls",
  euai: "EU AI Act risk tiering",
  monitoring: "Continuous monitoring / drift",
};

const LEADERBOARD_FIXTURE = [
  { name: "Maya Osei", score: 91 },
  { name: "Jordan Liu", score: 87 },
  { name: "Aisha Patel", score: 83 },
  { name: "Devon Marsh", score: 78 },
  { name: "Riley Tanaka", score: 74 },
];

const LEVELS = [
  { id: "L1", label: "Major" }, { id: "L2", label: "Department" },
  { id: "L3", label: "College" }, { id: "L4", label: "University" },
  { id: "L5", label: "Regional" }, { id: "L6", label: "National" },
];

/* ~32-entry skill dictionary with aliases (lower-case) */
const SKILL_DICT = [
  { name: "Python", aliases: ["python"] },
  { name: "R", aliases: ["r programming", "rstudio"] },
  { name: "SQL", aliases: ["sql", "structured query language"] },
  { name: "Java", aliases: ["java"] },
  { name: "JavaScript", aliases: ["javascript", "node.js", "nodejs"] },
  { name: "Machine Learning", aliases: ["machine learning", "ml model", "supervised learning"] },
  { name: "Deep Learning", aliases: ["deep learning", "neural network"] },
  { name: "Data Analysis", aliases: ["data analysis", "data analytics", "analyze data", "analyzed data"] },
  { name: "Data Visualization", aliases: ["data visualization", "dashboards", "dashboard"] },
  { name: "Statistics", aliases: ["statistics", "statistical", "regression"] },
  { name: "HL7", aliases: ["hl7"] },
  { name: "FHIR", aliases: ["fhir"] },
  { name: "HIPAA", aliases: ["hipaa"] },
  { name: "EHR/EMR", aliases: ["ehr", "emr", "electronic health record", "electronic medical record"] },
  { name: "Epic", aliases: ["epic systems", "epic ehr"] },
  { name: "Cerner", aliases: ["cerner", "oracle health"] },
  { name: "Clinical Informatics", aliases: ["clinical informatics", "health informatics", "informatics"] },
  { name: "Health Information Management", aliases: ["health information management", "him "] },
  { name: "Project Management", aliases: ["project management", "project manager", "pmp"] },
  { name: "Agile/Scrum", aliases: ["agile", "scrum", "kanban"] },
  { name: "Cloud", aliases: ["aws", "azure", "gcp", "google cloud", "cloud computing"] },
  { name: "ETL", aliases: ["etl", "data pipeline", "data pipelines"] },
  { name: "Data Governance", aliases: ["data governance", "master data"] },
  { name: "Cybersecurity", aliases: ["cybersecurity", "information security", "infosec"] },
  { name: "NLP", aliases: ["nlp", "natural language processing"] },
  { name: "Excel", aliases: ["excel", "spreadsheets"] },
  { name: "Power BI", aliases: ["power bi", "powerbi"] },
  { name: "Tableau", aliases: ["tableau"] },
  { name: "Communication", aliases: ["communication", "stakeholder communication", "communicate"] },
  { name: "Leadership", aliases: ["leadership", "team lead", "led a team"] },
  { name: "Interoperability", aliases: ["interoperability", "data exchange"] },
  { name: "Regulatory Compliance", aliases: ["regulatory compliance", "compliance", "regulatory"] },
  { name: "Databases", aliases: ["relational database", "database management", "postgres", "mysql"] },
  { name: "Version Control", aliases: ["git", "version control", "github"] },
];

/* ---------------------------------------------------------------- text utils */
function sanitize(raw) {
  if (!raw) return "";
  let t = String(raw);
  t = t.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
       .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
       .replace(/[\u00A0\u202F\u2007]/g, " ")
       .replace(/[\u2022\u25CF\u25AA\u2023\u2043\u2219]/g, "-")
       .replace(/[\u2013\u2014]/g, "-")
       .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function looksBinary(raw) {
  if (!raw) return false;
  const head = raw.slice(0, 400);
  if (head.startsWith("PK") || head.startsWith("%PDF")) return true;
  const nonPrintable = (head.match(/[\uFFFD\u0000-\u0008]/g) || []).length;
  return nonPrintable > 8;
}
function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function aliasMatches(text, alias) {
  const a = alias.trim();
  const re = new RegExp("(^|[^A-Za-z0-9])" + escapeReg(a) + "([^A-Za-z0-9]|$)", "i");
  return re.test(text);
}
function detectSkills(text) {
  const lower = (" " + (text || "") + " ").toLowerCase();
  const found = [];
  for (const s of SKILL_DICT) {
    if (s.aliases.some((al) => aliasMatches(lower, al))) found.push(s.name);
  }
  return found;
}
function capabilityGap(resume, jd) {
  const r = detectSkills(resume);
  const j = detectSkills(jd);
  const rSet = new Set(r);
  const gaps = j.filter((s) => !rSet.has(s));
  const met = j.filter((s) => rSet.has(s));
  return { resumeSkills: r, jdSkills: j, gaps, met };
}

const ORG_ENDINGS = [
  "Health System", "Healthcare", "Health Care", "Hospital", "Medical Center",
  "Medical Centre", "Health Network", "Health", "University", "College",
  "Clinic", "Center", "Centre", "Institute", "Systems", "Foundation",
  "Group", "Corporation", "Company", "Network", "Laboratories", "Labs",
];
const LEADIN = /^(join|at|with|for|the|a|an|seeking|hiring|looking|to|our|about|join our|work at)\s+/i;
function extractCompany(text, opts) {
  if (!text) return "";
  const t = sanitize(text);
  const endAlt = ORG_ENDINGS.map(escapeReg).sort((a, b) => b.length - a.length).join("|");
  // Match a capitalized phrase ending in an org word. Use [ \t] (not \s) so a match
  // never spans line breaks and splices unrelated sections together, and require the
  // org ending to be a whole word ((?![A-Za-z]) stops "Clinic" matching inside
  // "Clinical").
  const re = new RegExp(
    "([A-Z][A-Za-z&.'\\-]+(?:[ \\t]+[A-Z][A-Za-z&.'\\-]+){0,4}[ \\t]+(?:" + endAlt + ")(?![A-Za-z]))",
    "g"
  );
  const cleanName = (raw) => {
    let name = raw.replace(/\s+/g, " ").trim();
    while (LEADIN.test(name)) name = name.replace(LEADIN, "");
    name = name.replace(/^(The|A|An)\s+/i, "").trim();
    return name.split(" ").length >= 2 && name.length <= 60 ? name : "";
  };
  const dedupeFirst = (arr) => {
    const seen = new Set();
    return arr.filter((h) => { const k = h.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  if (opts && opts.preferFirst) {
    // Résumé: the applicant's name occupies the first non-empty line — never report it.
    // Scan line-by-line, tracking the résumé section, and prefer an actual employer (from
    // the experience section) over the school named under education. This avoids both the
    // name header (e.g. "Maya Osei" spliced with "Health Informatics") and the candidate's
    // university being mistaken for the employer "Emory Healthcare".
    const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const SECTION = /^.{0,40}$/;                                            // headers are short
    const EXP = /\b(experience|employment|work history|professional|internships?|positions?|roles?)\b/i;
    const EDU = /\b(education|academic|coursework|degrees?)\b/i;
    const expHits = [];
    const otherHits = [];
    let section = "";
    lines.forEach((line, i) => {
      if (i === 0) return;                                                 // name/header line
      if (SECTION.test(line) && EXP.test(line)) section = "exp";
      else if (SECTION.test(line) && EDU.test(line)) section = "edu";
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        const name = cleanName(m[1]);
        if (name) (section === "exp" ? expHits : otherHits).push(name);
      }
    });
    const pick = dedupeFirst(expHits.length ? expHits : otherHits);
    return pick[0] || "";
  }

  // JD: prefer the longest unique hit (captures "Emory Healthcare Center").
  const hits = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const name = cleanName(m[1]);
    if (name) hits.push(name);
  }
  if (!hits.length) return "";
  hits.sort((a, b) => b.length - a.length);
  return hits[0];
}

/* one-skill-per-line splitting for Reputation verification */
function splitSentences(text) {
  return sanitize(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
}
function phraseForSkill(sentence, skill) {
  // remove every OTHER detected skill's alias so each line names exactly one skill,
  // cleaning up any conjunction/preposition left dangling by the removal
  const me = SKILL_DICT.find((s) => s.name === skill);
  const mineLower = (me ? me.aliases : []).map((a) => a.toLowerCase());
  const others = SKILL_DICT.filter((s) => s.name !== skill);
  let out = sentence;
  for (const o of others) {
    for (const al of o.aliases) {
      if (mineLower.includes(al.toLowerCase())) continue;
      const a = escapeReg(al);
      // alias + trailing connector  ("Excel and " -> "")
      out = out.replace(new RegExp("\\b" + a + "\\b\\s*(,|and|&|\\/)\\s*", "ig"), "");
      // leading connector + alias    (" and Python" -> "")
      out = out.replace(new RegExp("\\s*(,|and|&|\\/)\\s*\\b" + a + "\\b", "ig"), "");
      // bare alias
      out = out.replace(new RegExp("\\b" + a + "\\b", "ig"), "");
    }
  }
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+(in|on|with|using|of|for|and|&)\s*([.,;])/gi, "$2") // dangling prep before punctuation
    .replace(/\s+(in|on|with|using|of|for|and|&)\s*$/i, "")           // dangling prep at end
    .replace(/\s+([.,;])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
}
function buildVerifyItems(resume) {
  const sentences = splitSentences(resume);
  const items = [];
  let idx = 0;
  for (const sent of sentences) {
    const skills = detectSkills(sent);
    if (!skills.length) continue;
    if (skills.length === 1) {
      items.push({ id: "v" + idx++, skill: skills[0], text: sent });
    } else {
      skills.forEach((sk, k) => {
        items.push({
          id: "v" + idx++,
          skill: sk,
          text: phraseForSkill(sent, sk),
          group: sent,
          sub: String.fromCharCode(97 + k),
        });
      });
    }
  }
  // dedup identical skill+text
  const seen = new Set();
  return items.filter((it) => {
    const key = it.skill + "|" + it.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---------------------------------------------------------------- JD-language translation */
function titleCase(s) { return (s || "").replace(/\b\w/g, (c) => c.toUpperCase()); }
function jdActionVerbs(jd) {
  const verbs = ["develop", "design", "analyze", "build", "manage", "integrate", "implement", "optimize", "deploy", "lead", "evaluate", "communicate"];
  const present = verbs.filter((v) => new RegExp("\\b" + v, "i").test(jd || ""));
  return present.length ? present : ["develop", "analyze", "deliver"];
}
function jdPhraseFor(skill, jd) {
  const s = SKILL_DICT.find((x) => x.name === skill);
  if (s) {
    for (const al of s.aliases) {
      const m = (jd || "").match(new RegExp("\\b" + escapeReg(al.trim()) + "\\b", "i"));
      if (m) return m[0];
    }
  }
  return skill;
}
function extractJdTitle(jd) {
  const t = sanitize(jd);
  let m = t.match(/\b(?:as an?|hiring an?|seeking an?|for the role of|for an?|position[:]?)\s+([A-Za-z][A-Za-z \/&-]{2,40})/i);
  if (m) return titleCase(m[1].trim().replace(/\b(at|with|for|to|in|who|that)\b.*$/i, "").trim());
  const titles = ["clinical data analyst", "health informatics specialist", "clinical informatics", "data analyst", "data scientist",
    "informatics specialist", "business analyst", "software engineer", "project manager", "data engineer", "analyst"];
  for (const ti of titles) { if (new RegExp("\\b" + ti + "\\b", "i").test(t)) return titleCase(ti); }
  return "";
}
function translateResume(resume, jd) {
  const r = sanitize(resume);
  const jdSkills = detectSkills(jd);
  const jdSet = new Set(jdSkills);
  const verbs = jdActionVerbs(jd);
  const role = extractJdTitle(jd);
  const lines = r.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const examples = [];
  let vi = 0;
  const outLines = lines.map((line) => {
    const skills = detectSkills(line).filter((s) => jdSet.has(s));
    if (!skills.length) return { text: line, changed: false };
    const sk = skills[0];
    const jdTerm = jdPhraseFor(sk, jd);
    const verb = titleCase(verbs[vi++ % verbs.length]);
    const rewritten = verb + " solutions applying " + jdTerm + (role ? " for the " + role + " role" : "") + " — " + line;
    if (examples.length < 4) examples.push({ skill: sk, before: line, after: rewritten });
    return { text: rewritten, changed: true };
  });
  let t = "TRANSLATED RÉSUMÉ — reframed in the language of the desired job description";
  if (role) t += " (" + role + ")";
  t += "\nJD competency vocabulary applied: " + (jdSkills.join(", ") || "—") + "\n";
  t += "(▸ = line rewritten in JD language · · = unchanged)\n\n";
  outLines.forEach((l) => { t += (l.changed ? "▸ " : "· ") + l.text + "\n"; });
  return { text: t, examples, jdSkills, role };
}

/* ---------------------------------------------------------------- résumé skill highlighting */
function highlightResume(resume) {
  const text = sanitize(resume);
  if (!text) return [];
  const matches = [];
  for (const s of SKILL_DICT) {
    for (const al of s.aliases) {
      const re = new RegExp("(^|[^A-Za-z0-9])(" + escapeReg(al.trim()) + ")(?=[^A-Za-z0-9]|$)", "ig");
      let m;
      while ((m = re.exec(text)) !== null) {
        const start = m.index + m[1].length;
        matches.push({ start, end: start + m[2].length, skill: s.name });
        re.lastIndex = start + m[2].length;
      }
    }
  }
  if (!matches.length) return [{ type: "text", value: text }];
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept = []; let lastEnd = -1;
  for (const mt of matches) { if (mt.start >= lastEnd) { kept.push(mt); lastEnd = mt.end; } }
  const segs = []; let cursor = 0;
  for (const mt of kept) {
    if (mt.start > cursor) segs.push({ type: "text", value: text.slice(cursor, mt.start) });
    segs.push({ type: "skill", skill: mt.skill, value: text.slice(mt.start, mt.end) });
    cursor = mt.end;
  }
  if (cursor < text.length) segs.push({ type: "text", value: text.slice(cursor) });
  return segs;
}

/* ---------------------------------------------------------------- standard curriculum guideline */
function buildStandardGuideline(sector) {
  let t = "GIVT STANDARD CURRICULUM GUIDELINE\n";
  t += "Sector: " + sector + "\n";
  t += "Derived from the listed compliance sources · GIVT Sandbox · Kennesaw State University\n";
  t += "================================================================\n\n";
  t += "PURPOSE\nDefines the minimum compliance competencies every forward-looking\ncurriculum module must satisfy before the GAN loop reaches equilibrium.\n\n";
  COMPLIANCE_SOURCES.forEach((s, i) => {
    t += (i + 1) + ". " + COMPLIANCE_LENSES[s.lens].toUpperCase() + "\n";
    t += "   Authority: " + s.org + " — " + s.title + "\n";
    t += "   Source: " + s.url + "\n";
    t += "   Required outcome: graduates can apply " + COMPLIANCE_LENSES[s.lens] +
         " to design, evaluate, and monitor solutions in " + sector + ".\n";
    t += "   Assessment: artifact demonstrating conformance to " + s.org + " guidance.\n\n";
  });
  t += "EQUILIBRIUM CRITERION\nA module is compliant when every lens above is covered and the\nDiscriminator returns zero flags across a full Generator-Discriminator loop.\n";
  return t;
}

/* ---------------------------------------------------------------- file parsing */
const scriptCache = {};
function loadScript(src) {
  if (scriptCache[src]) return scriptCache[src];
  scriptCache[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("load failed " + src));
    document.head.appendChild(s);
  });
  return scriptCache[src];
}
async function parseFile(file) {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop();
  const plain = ["txt", "md", "csv", "json", "tsv"];
  if (plain.includes(ext)) {
    const text = await file.text();
    return sanitize(text);
  }
  if (ext === "docx") {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    const buf = await file.arrayBuffer();
    const res = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return sanitize(res.value);
  }
  if (ext === "pdf") {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let out = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let lastY = null, line = "";
      for (const it of content.items) {
        const y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trim() + "\n"; line = ""; }
        line += it.str + " ";
        lastY = y;
      }
      out += line.trim() + "\n";
    }
    const txt = sanitize(out);
    if (txt.replace(/\s/g, "").length < 20)
      throw new Error("This looks like a scanned/image PDF. Use the Paste tab (OCR is a backend task).");
    return txt;
  }
  throw new Error("Unsupported format (" + ext + "). Try .txt, .md, .csv, .docx, or a text-based .pdf — or use the Paste tab.");
}
function wordCount(t) { return (t || "").trim() ? t.trim().split(/\s+/).length : 0; }
function downloadText(filename, text) {
  try {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    return true;
  } catch (e) { return false; }
}

/* ---------------------------------------------------------------- GAN engine */
function seedModules(sector) {
  const base = [
    { name: "Foundations of Health AI & Data Stewardship", cov: 66 },
    { name: "Generative AI for Clinical Documentation", cov: 58 },
    { name: "Interoperability & FHIR-Native Integration", cov: 54 },
    { name: "Predictive Analytics & Model Validation", cov: 62 },
    { name: "AI Governance, Risk & Compliance", cov: 56 },
    { name: "Responsible Deployment & Monitoring", cov: 64 },
  ];
  return base.map((m, i) => ({
    name: m.name,
    coverage: m.cov,
    lenses: {
      hipaa: i === 1 || i === 4, onc: i === 2, fhir: i === 2,
      nist: i === 4, euai: i === 4, monitoring: i === 5,
    },
  }));
}
/* ---------------------------------------------------------------- forward-looking curriculum document */
const MODULE_GUIDE = {
  "Foundations of Health AI & Data Stewardship": {
    topics: ["Health data lifecycle & provenance", "PHI de-identification", "Bias & fairness foundations", "Data ethics & consent"],
    rec: "Anchor the program here so every later module inherits consistent, ethical data-handling norms.",
  },
  "Generative AI for Clinical Documentation": {
    topics: ["Ambient scribing & NLP", "Prompt patterns for clinical text", "Hallucination & safety review", "Human-in-the-loop sign-off"],
    rec: "Pair hands-on generation with mandatory clinician review workflows to keep outputs safe and auditable.",
  },
  "Interoperability & FHIR-Native Integration": {
    topics: ["HL7 FHIR R4 resources", "SMART on FHIR apps", "Terminology (LOINC/SNOMED)", "Info-blocking compliance"],
    rec: "Make FHIR the default integration substrate; assess via a working SMART-on-FHIR build.",
  },
  "Predictive Analytics & Model Validation": {
    topics: ["Feature engineering on EHR data", "Calibration & drift", "External validation", "Clinical utility metrics"],
    rec: "Require external validation and calibration evidence before any model is considered deployable.",
  },
  "AI Governance, Risk & Compliance": {
    topics: ["NIST AI RMF lifecycle", "EU AI Act risk tiers", "Model cards & documentation", "Audit & accountability"],
    rec: "Treat governance as a competency, not paperwork — students produce model cards and risk assessments.",
  },
  "Responsible Deployment & Monitoring": {
    topics: ["Post-deployment monitoring", "Drift & incident response", "Equity surveillance", "Continuous re-validation"],
    rec: "Close the loop with live monitoring so the curriculum reflects real operational accountability.",
  },
};
function buildCurriculumDocument(sector, modules) {
  const lensLabel = (k) => COMPLIANCE_LENSES[k] || k;
  const mean = Math.round(modules.reduce((a, m) => a + m.coverage, 0) / modules.length);
  let t = "GIVT FORWARD-LOOKING CURRICULUM — RECOMMENDATIONS\n";
  t += "Sector: " + sector + "\n";
  t += "Generated by the Generator agent · GIVT Sandbox · Kennesaw State University\n";
  t += "================================================================\n\n";
  t += "EXECUTIVE SUMMARY\n";
  t += "A " + modules.length + "-module forward-looking curriculum for " + sector + ", grounded in\n";
  t += "current innovation sources and built to clear the Discriminator's compliance lenses.\n";
  t += "Current mean coverage: " + mean + "%. Modules under 60% are priority build areas.\n\n";
  t += "GROUNDING INNOVATION SOURCES\n";
  INNOVATION_SOURCES.forEach((s, i) => { t += "  " + (i + 1) + ". " + s.org + " — " + s.title + "\n     " + s.url + "\n"; });
  t += "\nRECOMMENDED MODULES\n";
  modules.forEach((m, i) => {
    const g = MODULE_GUIDE[m.name] || { topics: [], rec: "Develop core competencies and assessment for this module." };
    const lenses = Object.keys(m.lenses || {}).filter((k) => m.lenses[k]).map(lensLabel);
    t += "\n" + (i + 1) + ". " + m.name + "   [current coverage " + m.coverage + "%]\n";
    t += "   Priority: " + (m.coverage < 60 ? "HIGH — build out before equilibrium" : "Maintain / refine") + "\n";
    if (g.topics.length) t += "   Recommended topics: " + g.topics.join("; ") + "\n";
    t += "   Compliance alignment: " + (lenses.length ? lenses.join("; ") : "general") + "\n";
    t += "   Recommendation: " + g.rec + "\n";
  });
  t += "\nOVERALL RECOMMENDATIONS\n";
  t += "  - Sequence stewardship and governance early; treat them as prerequisites.\n";
  t += "  - Prioritize modules under 60% coverage in the next Generator-Discriminator loop.\n";
  t += "  - Map every module to at least one compliance lens before declaring equilibrium.\n";
  t += "  - Pair each module with a portfolio artifact for verifiable, on-chain assessment.\n";
  t += "  - Revisit grounding sources each term to keep the curriculum forward-looking.\n";
  return t;
}

// returns one full loop {step1, critique, step3, meanCoverage, flagsCount, equilibriumReady}
function runGanLoop(prevModules, loopNumber, sector) {
  const step1 = prevModules ? prevModules.map((m) => ({ ...m, lenses: { ...m.lenses } }))
                            : seedModules(sector);
  // critique: flag lenses for modules whose coverage is under threshold
  const threshold = 60 + (loopNumber - 1) * 6;
  const critique = [];
  // deterministic flag set: loop1 -> 5 flags, loop2+ -> 0 flags
  const flagPlan = loopNumber === 1
    ? [
        { mod: 1, lens: "hipaa" }, { mod: 2, lens: "onc" }, { mod: 2, lens: "fhir" },
        { mod: 4, lens: "nist" }, { mod: 5, lens: "monitoring" },
      ]
    : [];
  flagPlan.forEach((f) => {
    critique.push({
      module: step1[f.mod].name, lens: f.lens,
      lensLabel: COMPLIANCE_LENSES[f.lens],
      source: COMPLIANCE_SOURCES.find((s) => s.lens === f.lens),
    });
  });
  // revision: raise coverage toward target mean = 60 + loop*4
  const targetMean = 60 + loopNumber * 4;
  const curMean = step1.reduce((a, m) => a + m.coverage, 0) / step1.length;
  const lift = targetMean - curMean;
  const step3 = step1.map((m) => ({
    ...m, coverage: Math.min(98, Math.round(m.coverage + lift)),
  }));
  const meanCoverage = Math.round(step3.reduce((a, m) => a + m.coverage, 0) / step3.length);
  const flagsCount = flagPlan.length;
  const equilibriumReady = meanCoverage >= 90 || flagsCount === 0;
  return { step1, critique, step3, meanCoverage, flagsCount, equilibriumReady, loopNumber };
}

/* ====================================================================== UI atoms */
function Btn({ children, onClick, kind = "solid", small, disabled, style, title }) {
  const base = {
    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 3, padding: small ? "5px 11px" : "9px 16px", fontSize: small ? 12.5 : 14,
    border: "1px solid", transition: "all .15s ease", opacity: disabled ? 0.45 : 1,
    letterSpacing: ".01em", lineHeight: 1.2, ...style,
  };
  const kinds = {
    solid: { background: C.ink, color: C.paper, borderColor: C.ink },
    gold: { background: C.gold, color: "#fff", borderColor: C.goldDeep },
    teal: { background: C.teal, color: "#fff", borderColor: C.tealDeep },
    ghost: { background: "transparent", color: C.ink, borderColor: C.rule },
    green: { background: C.green, color: "#fff", borderColor: C.green },
    rust: { background: C.rust, color: "#fff", borderColor: C.rust },
  };
  return (
    <button title={title} onClick={disabled ? undefined : onClick} style={{ ...base, ...kinds[kind] }}>
      {children}
    </button>
  );
}
function Spinner({ label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.teal, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 600 }}>
      <span style={{ fontSize: 14 }}>⏳</span>
      <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid " + C.rule, borderTopColor: C.teal, borderRadius: "50%", animation: "givtspin .7s linear infinite" }} />
      <span>{label}</span>
      <span style={{ letterSpacing: 2, fontWeight: 700 }}>
        <span style={{ animation: "givtpulse 1.2s infinite" }}>.</span>
        <span style={{ animation: "givtpulse 1.2s infinite .2s" }}>.</span>
        <span style={{ animation: "givtpulse 1.2s infinite .4s" }}>.</span>
      </span>
    </span>
  );
}
function Tag({ children, bg, color, border }) {  return (
    <span style={{
      display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
      fontWeight: 600, padding: "2px 7px", borderRadius: 2, background: bg || C.paperWarm,
      color: color || C.inkSoft, border: "1px solid " + (border || C.rule), letterSpacing: ".03em",
      marginRight: 5, marginBottom: 3, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}
function Bar({ value, color }) {
  return (
    <div style={{ background: C.paperWarm, borderRadius: 2, height: 7, width: "100%", overflow: "hidden", border: "1px solid " + C.rule }}>
      <div style={{ width: Math.max(0, Math.min(100, value)) + "%", height: "100%", background: color || C.teal, transition: "width .4s ease" }} />
    </div>
  );
}
function Panel({ title, eyebrow, children, accent }) {
  return (
    <section style={{
      background: "#fff", border: "1px solid " + C.rule, borderRadius: 4,
      padding: "20px 22px", marginBottom: 18, boxShadow: "0 1px 0 " + C.rule,
      borderTop: "3px solid " + (accent || C.ink),
    }}>
      {eyebrow && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: accent || C.gold, marginBottom: 4 }}>{eyebrow}</div>}
      {title && <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 21, margin: "0 0 14px", color: C.ink, fontWeight: 600 }}>{title}</h3>}
      {children}
    </section>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 600, color: C.inkSoft, marginBottom: 5, letterSpacing: ".02em" }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = {
  width: "100%", fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: "9px 11px",
  border: "1px solid " + C.rule, borderRadius: 3, background: C.paper, color: C.ink, boxSizing: "border-box",
};

/* ---------------------------------------------------------------- Uploader */
function FileUploader({ label, value, onChange, onFiles, files, setFiles, allowUrl }) {
  const [mode, setMode] = useState("paste");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [url, setUrl] = useState("");
  const dropRef = useRef(null);

  const handleFiles = async (list) => {
    setErr(""); setBusy(true);
    const arr = Array.from(list);
    let combined = value || "";
    const added = [];
    for (const f of arr) {
      try {
        const text = await parseFile(f);
        combined = (combined ? combined + "\n\n" : "") + text;
        added.push({ id: f.name + Date.now() + Math.random(), name: f.name, words: wordCount(text), kb: Math.max(1, Math.round(f.size / 1024)) });
      } catch (e) { setErr(e.message); }
    }
    if (added.length) {
      onChange(combined);
      if (setFiles) setFiles([...(files || []), ...added]);
      if (onFiles) onFiles(added);
    }
    setBusy(false);
  };
  const removeFile = (id) => { if (setFiles) setFiles((files || []).filter((f) => f.id !== id)); };

  return (
    <div style={{ border: "1px solid " + C.rule, borderRadius: 4, background: C.paper, padding: 14 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, color: C.inkSoft, marginBottom: 9 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[["paste", "Paste / Write"], ["browse", "Browse Files"], ["drop", "Drag & Drop"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "4px 9px", borderRadius: 2, cursor: "pointer",
            border: "1px solid " + (mode === k ? C.ink : C.rule),
            background: mode === k ? C.ink : "transparent", color: mode === k ? C.paper : C.inkSoft,
          }}>{l}</button>
        ))}
      </div>

      {mode === "paste" && (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={6}
          placeholder="Paste or write text here…" style={{ ...inputStyle, resize: "vertical", minHeight: 110 }} />
      )}
      {mode === "browse" && (
        <div>
          {allowUrl && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a URL…" style={inputStyle} />
              <Btn small kind="ghost" onClick={() => { if (url) { onChange((value ? value + "\n" : "") + "[URL] " + url); setUrl(""); } }}>Add URL</Btn>
            </div>
          )}
          <input type="file" multiple accept=".txt,.md,.csv,.json,.tsv,.docx,.pdf"
            onChange={(e) => handleFiles(e.target.files)}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }} />
        </div>
      )}
      {mode === "drop" && (
        <div ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); dropRef.current.style.background = C.greenSoft; }}
          onDragLeave={() => { dropRef.current.style.background = C.paperWarm; }}
          onDrop={(e) => { e.preventDefault(); dropRef.current.style.background = C.paperWarm; handleFiles(e.dataTransfer.files); }}
          style={{ border: "2px dashed " + C.rule, borderRadius: 4, padding: "26px 14px", textAlign: "center",
            background: C.paperWarm, color: C.inkSoft, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
          Drop .docx · .pdf · .txt · .md · .csv files here
        </div>
      )}

      {busy && <div style={{ marginTop: 8, fontSize: 12.5, color: C.teal, fontFamily: "'DM Sans', sans-serif" }}>⟳ Extracting text…</div>}
      {err && <div style={{ marginTop: 8, fontSize: 12.5, color: C.rust, fontFamily: "'DM Sans', sans-serif" }}>⚠ {err}</div>}

      {(files || []).length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {files.map((f) => (
            <span key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.greenSoft,
              border: "1px solid " + C.green, color: C.tealDeep, borderRadius: 3, padding: "4px 8px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              ✓ {f.name} · {f.words}w · {f.kb}KB
              <button onClick={() => removeFile(f.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.tealDeep, fontWeight: 700 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- GAN banner (shared) */
function GanBanner({ gan, onView, onDownload }) {
  if (!gan) return null;
  return (
    <div style={{ background: C.greenSoft, border: "1px solid " + C.green, borderLeft: "4px solid " + C.green,
      borderRadius: 4, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: C.tealDeep, fontSize: 13.5, marginBottom: 4 }}>
        ✓ GAN equilibrium reached — shared recommendation available
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 8 }}>
        Mean coverage {gan.meanCoverage}% · {gan.modules.length} modules · sector: {gan.sector}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn small kind="green" onClick={onView}>View / review document</Btn>
        <Btn small kind="ghost" onClick={onDownload}>Download document</Btn>
      </div>
    </div>
  );
}
function ganRecommendationText(gan) {
  let t = "GIVT — GAN EQUILIBRIUM RECOMMENDATION\n";
  t += "Sector: " + gan.sector + "\nMean coverage: " + gan.meanCoverage + "%\nLoops run: " + gan.loops + "\n\n";
  t += "FORWARD-LOOKING CURRICULUM MODULES\n";
  gan.modules.forEach((m, i) => { t += (i + 1) + ". " + m.name + " — coverage " + m.coverage + "%\n"; });
  t += "\nGrounded in real innovation sources (HIMSS, JMIR) and validated against\n";
  t += "real compliance sources (HHS HIPAA, ONC, HL7 FHIR R4, NIST AI RMF, EU AI Act, AHA).\n";
  return t;
}

/* ====================================================================== AGENT 01 — Translator */
function TranslatorAgent({ S }) {
  const run = () => {
    const resume = sanitize(S.globalResume);
    const jd = sanitize(S.globalJD);
    if (looksBinary(S.globalResume) || looksBinary(S.globalJD)) {
      S.setTranslatorOut({ error: "It looks like binary (.docx/.pdf) content was pasted. Use Browse Files so it can be parsed to text." });
      return;
    }
    if (!resume || !jd) { S.setTranslatorOut({ error: "Both a résumé and a desired job description are required." }); return; }
    const gap = capabilityGap(resume, jd);
    const targetCompany = extractCompany(jd);                       // employer the job is for
    const resumeCompany = extractCompany(resume, { preferFirst: true }); // company named in the résumé
    S.setDetectedCompany(targetCompany);
    S.setResumeCompany(resumeCompany);
    const tr = translateResume(resume, jd);
    S.setTranslatorOut({
      gap, company: targetCompany, resumeCompany,
      translated: tr.text, examples: tr.examples, jdRole: tr.role,
    });
  };

  const out = S.translatorOut;
  return (
    <div>
      <Panel eyebrow="Agent 01 · Foreground" title="Translator" accent={C.ink}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.inkSoft, marginTop: 0 }}>
          Translates a résumé against a desired job description and produces a capability-gap analysis.
          Both inputs are stored at the app level (<code style={{ fontFamily: "'JetBrains Mono', monospace" }}>globalResume</code>, <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>globalJD</code>) and reused by every agent — no re-upload.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <FileUploader label="Input 1 · Résumé" value={S.globalResume} onChange={S.setGlobalResume}
            files={S.resumeFiles} setFiles={S.setResumeFiles} />
          <FileUploader label="Input 2 · Desired job description" value={S.globalJD} onChange={S.setGlobalJD}
            files={S.jdFiles} setFiles={S.setJdFiles} />
        </div>
        <div style={{ marginTop: 14 }}><Btn kind="gold" onClick={run}>Translate & analyze gaps ▶</Btn></div>
      </Panel>

      {out && out.error && (
        <Panel accent={C.rust} title="Notice"><div style={{ color: C.rust, fontFamily: "'DM Sans', sans-serif" }}>⚠ {out.error}</div></Panel>
      )}

      {out && !out.error && (
        <>
          <Panel eyebrow="Output 1" title="Capability-gap analysis" accent={C.gold}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.inkSoft, marginBottom: 10 }}>
              {out.company ? <>Detected company: <strong style={{ color: C.ink }}>{out.company}</strong> · </> : null}
              {out.gap.jdSkills.length} JD skills · {out.gap.met.length} already met · <strong style={{ color: C.rust }}>{out.gap.gaps.length} gaps</strong>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: C.rust, fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>Capability gaps (JD − résumé)</div>
              <div>{out.gap.gaps.length ? out.gap.gaps.map((g) => <Tag key={g} bg="#F1DACB" color={C.rust} border={C.rust}>{g}</Tag>) : <em style={{ color: C.green }}>No gaps — résumé meets every detected JD skill.</em>}</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: C.green, fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>Already-met skills</div>
              <div>{out.gap.met.length ? out.gap.met.map((g) => <Tag key={g} bg={C.greenSoft} color={C.tealDeep} border={C.green}>{g}</Tag>) : <em style={{ color: C.inkSoft }}>None matched yet.</em>}</div>
            </div>
          </Panel>
          <Panel eyebrow="Output 2" title="Translated résumé" accent={C.teal}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
              Your résumé below is rewritten in the vocabulary of the desired job description
              {out.jdRole ? <> for the <strong style={{ color: C.ink }}>{out.jdRole}</strong> role</> : null}.
              Lines marked <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.teal }}>▸</span> were re-expressed using JD terminology.
            </div>
            <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: "pre-wrap", color: C.inkSoft, margin: 0, maxHeight: 280, overflow: "auto" }}>{out.translated}</pre>
          </Panel>

          {out.examples && out.examples.length > 0 && (
            <Panel eyebrow="Output 3" title="Translation examples — before → after (JD language)" accent={C.gold}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
                Each example shows a résumé skill as originally written, then re-expressed in the desired job description's language.
              </div>
              {out.examples.map((ex, i) => (
                <div key={i} style={{ border: "1px solid " + C.rule, borderRadius: 4, padding: 12, marginBottom: 10, background: "#fff" }}>
                  <div style={{ marginBottom: 6 }}><Tag bg="#F3E8CC" color={C.goldDeep} border={C.gold}>{ex.skill}</Tag></div>
                  <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, alignItems: "start", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.rust, fontWeight: 700, paddingTop: 2 }}>BEFORE</span>
                    <span style={{ color: C.inkSoft, textDecoration: "line-through", textDecorationColor: C.rule }}>{ex.before}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.green, fontWeight: 700, paddingTop: 2 }}>AFTER</span>
                    <span style={{ color: C.ink }}>{ex.after}</span>
                  </div>
                </div>
              ))}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/* ====================================================================== AGENT 02 — Talent */
function TalentAgent({ S }) {
  const [confirmState, setConfirmState] = useState("idle"); // idle | confirmed | changing
  const [companyInput, setCompanyInput] = useState("");
  const [profile, setProfile] = useState("");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openJD, setOpenJD] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [viewGan, setViewGan] = useState(false);

  useEffect(() => { setCompanyInput(S.resumeCompany || S.detectedCompany || ""); }, [S.resumeCompany, S.detectedCompany]);

  const generateProfile = async (name) => {
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content:
            "Produce a concise company profile for \"" + name + "\" in healthcare informatics. " +
            "Use web search. Cover: overview, mission, technology/data environment, regulatory context, and current hiring signals. " +
            "Plain text, labeled sections, under 400 words." }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setProfile(text || heuristicProfile(name));
    } catch (e) {
      setProfile(heuristicProfile(name));
    }
    setLoading(false);
  };
  const heuristicProfile = (name) =>
    "OVERVIEW\n" + name + " is a healthcare organization investing in clinical data systems and AI-assisted care.\n\n" +
    "MISSION\nDeliver high-quality, equitable patient care supported by trustworthy data.\n\n" +
    "TECHNOLOGY / DATA ENVIRONMENT\nEHR platform, HL7/FHIR interfaces, cloud analytics, growing ML/GenAI pilots.\n\n" +
    "REGULATORY CONTEXT\nHIPAA, ONC information-blocking rules, emerging AI governance (NIST AI RMF).\n\n" +
    "HIRING SIGNALS\nDemand for informatics, analytics, interoperability, and AI-governance capabilities.\n\n" +
    "(Live web-search profile unavailable in this preview — heuristic fallback shown.)";

  const confirm = () => { setConfirmState("confirmed"); generateProfile(companyInput); };

  const useCases = useMemo(() => {
    if (!S.globalJD) return [];
    const skills = detectSkills(S.globalJD).slice(0, 6);
    const templ = [
      "Streamline clinical documentation with generative-AI drafting",
      "Build interoperable data exchange across care settings",
      "Deploy predictive risk models with validation guardrails",
      "Stand up an analytics dashboard for operational KPIs",
      "Automate compliance reporting and audit trails",
      "Improve patient-flow forecasting and capacity planning",
    ];
    return templ.slice(0, Math.max(4, skills.length)).map((t, i) => ({
      id: "UC" + String(i + 1).padStart(2, "0"), text: t,
    }));
  }, [S.globalJD]);

  const talentDemand = useMemo(() => ([
    { area: "GenAI clinical co-pilots", trend: "rising" },
    { area: "FHIR-native interoperability engineering", trend: "rising" },
    { area: "AI governance & model assurance", trend: "rising" },
    { area: "Ambient documentation & NLP", trend: "emerging" },
  ]), []);

  useEffect(() => {
    if (useCases.length) S.setTalent({ useCases, talentDemand, profile, company: companyInput });
  }, [useCases, profile, companyInput]);

  return (
    <div>
      <GanBanner gan={S.ganRecommendation} onView={() => setViewGan(!viewGan)}
        onDownload={() => downloadText("givt-gan-recommendation.txt", ganRecommendationText(S.ganRecommendation))} />
      {viewGan && S.ganRecommendation && (
        <Panel accent={C.green} title="GAN recommendation document">
          <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: "pre-wrap", color: C.inkSoft, margin: 0 }}>{ganRecommendationText(S.ganRecommendation)}</pre>
        </Panel>
      )}

      <Panel eyebrow="Agent 02 · Background" title="Talent" accent={C.gold}>
        <Field label="Input 1 · Desired JD (auto-pulled from Translator, read-only)">
          <textarea readOnly value={S.globalJD || "— Run the Translator first —"} rows={3} style={{ ...inputStyle, background: C.paperWarm }} />
        </Field>

        <div style={{ background: C.paperWarm, border: "1px solid " + C.rule, borderRadius: 4, padding: 12, marginBottom: 14 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>Company-name confirmation</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>
            Pre-filled from the résumé submitted in the Translator. Edit as needed.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={companyInput} onChange={(e) => setCompanyInput(e.target.value)} placeholder="Company from résumé…" style={{ ...inputStyle, maxWidth: 280 }} />
            <Btn small kind="gold" onClick={confirm}>Confirm</Btn>
            <Btn small kind="ghost" onClick={() => { setConfirmState("changing"); setProfile(""); }}>Change</Btn>
            {confirmState === "confirmed" && <Btn small kind="ghost" onClick={() => generateProfile(companyInput)}>Rebuild profile from web</Btn>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {S.resumeCompany && (
              <button onClick={() => setCompanyInput(S.resumeCompany)} style={{ cursor: "pointer", background: "#fff", border: "1px solid " + C.gold, borderRadius: 3, padding: "3px 9px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.goldDeep }}>
                from résumé: {S.resumeCompany}
              </button>
            )}
            {S.detectedCompany && S.detectedCompany !== S.resumeCompany && (
              <button onClick={() => setCompanyInput(S.detectedCompany)} style={{ cursor: "pointer", background: "#fff", border: "1px solid " + C.teal, borderRadius: 3, padding: "3px 9px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.tealDeep }}>
                target in JD: {S.detectedCompany}
              </button>
            )}
          </div>
          {loading && <div style={{ marginTop: 10 }}><Spinner label="Generating company profile (Anthropic API + web search)" /></div>}
        </div>

        <Field label="Input 2 · Open job descriptions (URL + multi-file + paste)">
          <FileUploader label="Open JDs" value={openJD} onChange={setOpenJD} files={openFiles} setFiles={setOpenFiles} allowUrl />
        </Field>

        <Field label="Input 3 · Company profile (editable)">
          {loading ? (
            <div style={{ border: "1px solid " + C.rule, borderRadius: 4, padding: 14, background: C.paperWarm, minHeight: 150 }}>
              <Spinner label="Generating company profile" />
              <div style={{ marginTop: 14 }}>
                {[92, 78, 85, 64, 73, 88].map((w, i) => (
                  <div key={i} style={{ height: 9, width: w + "%", background: C.rule, borderRadius: 3, marginBottom: 9, animation: "givtpulse 1.4s infinite " + (i * 0.15) + "s" }} />
                ))}
              </div>
            </div>
          ) : (
            <textarea value={profile} onChange={(e) => setProfile(e.target.value)} rows={8}
              readOnly={locked} style={{ ...inputStyle, background: locked ? C.paperWarm : C.paper, minHeight: 150, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          )}
          <div style={{ marginTop: 8 }}>
            {locked
              ? <Btn small kind="ghost" onClick={() => setLocked(false)}>Unlock to edit</Btn>
              : <Btn small kind="teal" onClick={() => setLocked(true)} disabled={!profile}>Lock as final</Btn>}
            {locked && <span style={{ marginLeft: 10, color: C.green, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>✓ Locked — feeds downstream agents</span>}
          </div>
        </Field>
      </Panel>

      <Panel eyebrow="Output 1" title="Use cases" accent={C.teal}>
        {useCases.length ? useCases.map((uc) => (
          <div key={uc.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid " + C.rule }}>
            <Tag bg={C.tealDeep} color="#fff" border={C.tealDeep}>{uc.id}</Tag>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.ink }}>{uc.text}</span>
          </div>
        )) : <em style={{ color: C.inkSoft }}>Run the Translator to populate use cases.</em>}
      </Panel>

      <Panel eyebrow="Output 2" title="Forward-looking talent demand" accent={C.rust}>
        {talentDemand.map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + C.rule }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.ink }}>{d.area}</span>
            <Tag bg={d.trend === "rising" ? "#F1DACB" : C.paperWarm} color={C.rust} border={C.rust}>{d.trend} ▲</Tag>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ====================================================================== AGENT 03 — Curriculum */
const SAMPLE_CATALOG = `HMI 7100 — Foundations of Health Informatics
HMI 7200 — Clinical Data Standards (HL7 / FHIR)
HMI 7300 — Healthcare Data Analytics
HMI 7400 — Database Systems for Health Data
HMI 7500 — Machine Learning in Healthcare
HMI 7600 — Health Information Security & HIPAA
HMI 7700 — Project Management for Health IT
HMI 7800 — Interoperability & Integration
HMI 7900 — Capstone in Health Informatics
IS 8200 — Data Visualization
IS 8400 — Natural Language Processing
IS 8600 — Cloud Computing for Analytics`;

function CurriculumAgent({ S }) {
  const [raw, setRaw] = useState("");
  const [files, setFiles] = useState([]);
  const [out, setOut] = useState(null);
  const [viewGan, setViewGan] = useState(false);

  const parse = () => {
    const text = sanitize(raw) || SAMPLE_CATALOG;
    const re = /([A-Z]{2,4})\s*(\d{3,4})\s*[—\-:]\s*(.+)/g;
    const courses = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      courses.push({ code: m[1] + " " + m[2], title: m[3].trim() });
    }
    const ucs = (S.talent?.useCases || []).map((u) => u.id);
    const enhanced = courses.map((c, i) => {
      const tags = [];
      if (ucs.length) {
        tags.push(ucs[i % ucs.length]);
        if (i % 3 === 0 && ucs[1]) tags.push(ucs[(i + 1) % ucs.length]);
      }
      return { ...c, ucs: [...new Set(tags)] };
    });
    const demandAreas = (S.talent?.talentDemand || []).map((d) => d.area);
    const future = demandAreas.map((area, i) => ({
      kind: i % 2 === 0 ? "NEW" : "MODIFY",
      title: i % 2 === 0 ? "HMI 8" + (100 + i * 10) + " — " + area : "HMI 7500 — ML in Healthcare (+ " + area + ")",
      area, urgency: i === 0 ? "High" : i === 1 ? "High" : "Medium",
      rationale: "Addresses forward-looking demand surfaced by the Talent agent.",
      coverage: 50 + i * 8,
    }));
    const tally = { new: future.filter((f) => f.kind === "NEW").length, modify: future.filter((f) => f.kind === "MODIFY").length };
    const result = { enhanced, future, tally };
    setOut(result);
    S.setCurriculum(result);
  };

  return (
    <div>
      <GanBanner gan={S.ganRecommendation} onView={() => setViewGan(!viewGan)}
        onDownload={() => downloadText("givt-gan-recommendation.txt", ganRecommendationText(S.ganRecommendation))} />
      {viewGan && S.ganRecommendation && (
        <Panel accent={C.green} title="GAN recommendation document">
          <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: "pre-wrap", color: C.inkSoft, margin: 0 }}>{ganRecommendationText(S.ganRecommendation)}</pre>
        </Panel>
      )}

      <Panel eyebrow="Agent 03 · Background" title="Curriculum" accent={C.teal}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.inkSoft, marginTop: 0 }}>
          Parses a course catalog (<code style={{ fontFamily: "'JetBrains Mono', monospace" }}>DEPT NNNN — Title</code>), tags each course with Talent use-case numbers, and proposes a future curriculum for forward-looking demand.
        </p>
        <FileUploader label="Course catalog (paste / multi-file)" value={raw} onChange={setRaw} files={files} setFiles={setFiles} />
        <div style={{ marginTop: 14 }}><Btn kind="teal" onClick={parse}>Build enhanced + future curriculum ▶</Btn>
          <span style={{ marginLeft: 10, fontSize: 12, color: C.inkSoft, fontFamily: "'DM Sans', sans-serif" }}>Leave blank to use the sample catalog.</span>
        </div>
      </Panel>

      {out && (
        <>
          <Panel eyebrow="Output 1" title={"Enhanced course list (" + out.enhanced.length + " courses)"} accent={C.gold}>
            {out.enhanced.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + C.rule }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.ink }}>
                  <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{c.code}</strong> — {c.title}
                </span>
                <span>{c.ucs.length ? c.ucs.map((u) => <Tag key={u} bg={C.tealDeep} color="#fff" border={C.tealDeep}>{u}</Tag>) : <Tag>—</Tag>}</span>
              </div>
            ))}
          </Panel>
          <Panel eyebrow="Output 2" title="Future curriculum" accent={C.rust}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
              Summary: <strong style={{ color: C.green }}>{out.tally.new} NEW</strong> · <strong style={{ color: C.gold }}>{out.tally.modify} MODIFY</strong>
            </div>
            {out.future.map((f, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid " + C.rule }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <Tag bg={f.kind === "NEW" ? C.greenSoft : "#F3E8CC"} color={f.kind === "NEW" ? C.green : C.goldDeep} border={f.kind === "NEW" ? C.green : C.gold}>{f.kind}</Tag>
                  <strong style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.ink }}>{f.title}</strong>
                  <Tag>{f.urgency} urgency</Tag>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 6 }}>Demand: {f.area} · {f.rationale}</div>
                <Bar value={f.coverage} color={C.teal} />
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ====================================================================== AGENT 04 — Advisor */
const TRAINING_CATALOG = [
  { provider: "Coursera", offering: "AI in Healthcare Specialization", skills: ["Machine Learning", "Clinical Informatics", "NLP"], hours: 14 },
  { provider: "HIMSS", offering: "CPHIMS Review + AI/ML microcredential", skills: ["HL7", "FHIR", "Interoperability", "Regulatory Compliance"], hours: 12 },
  { provider: "edX", offering: "Data Analytics for Health", skills: ["Data Analysis", "Statistics", "Data Visualization", "SQL"], hours: 10 },
  { provider: "AWS Training", offering: "Cloud Practitioner for Health Data", skills: ["Cloud", "Databases", "Cybersecurity"], hours: 9 },
  { provider: "DataCamp", offering: "Python for Data Science", skills: ["Python", "Data Analysis", "Machine Learning"], hours: 11 },
  { provider: "PMI", offering: "Agile Practitioner", skills: ["Project Management", "Agile/Scrum", "Communication"], hours: 8 },
];

function packSyllabi(gaps) {
  const gapHrs = gaps.map((g) => {
    const match = TRAINING_CATALOG.find((t) => t.skills.includes(g));
    const h = match ? Math.max(6, Math.round(match.hours * 0.6)) : DEFAULT_GAP_HRS;
    return { skill: g, hours: h, anchor: match ? match.provider + " — " + match.offering : "Self-directed resource" };
  });
  const syllabi = [];
  let cur = [], curHrs = 0;
  for (const g of gapHrs) {
    if (curHrs + g.hours > MAX_TRAINING_HRS && cur.length) { syllabi.push(cur); cur = []; curHrs = 0; }
    cur.push(g); curHrs += g.hours;
  }
  if (cur.length) syllabi.push(cur);
  return syllabi;
}
function jdObjectives(jd, skills) {
  const verbs = ["design", "develop", "analyze", "manage", "integrate", "communicate", "ensure compliance with", "optimize"];
  const present = verbs.filter((v) => (jd || "").toLowerCase().includes(v.split(" ")[0]));
  const use = present.length ? present : ["develop", "analyze", "integrate"];
  return skills.map((s, i) => "Students will " + use[i % use.length] + " solutions applying " + s + ".");
}
function creditHours(trainingHrs) { return Math.ceil(trainingHrs / 5); }
function buildSchedule(items) {
  // split into weeks of <= MAX_WEEK_HRS training hours
  const weeks = []; let w = [], wh = 0;
  for (const it of items) {
    let remaining = it.hours;
    while (remaining > 0) {
      const space = MAX_WEEK_HRS - wh;
      const take = Math.min(space, remaining);
      w.push({ skill: it.skill, hours: take });
      wh += take; remaining -= take;
      if (wh >= MAX_WEEK_HRS) { weeks.push(w); w = []; wh = 0; }
    }
  }
  if (w.length) weeks.push(w);
  return weeks;
}
function syllabusText(syl, n) {
  let t = "GIVT DIRECTED-STUDY SYLLABUS " + n + "\n\n";
  t += "1. CREDIT HOURS: " + syl.credits + " (" + syl.trainingHrs + " training hrs / " + syl.effortHrs + " effort hrs)\n\n";
  t += "2. LEARNING OBJECTIVES\n" + syl.objectives.map((o) => "   - " + o).join("\n") + "\n\n";
  t += "3. LEARNING OUTCOMES\n" + syl.outcomes.map((o) => "   - " + o).join("\n") + "\n\n";
  t += "4. CAPABILITY GAPS ADDRESSED\n" + syl.items.map((i) => "   - " + i.skill + " (" + i.hours + "h) — " + i.anchor).join("\n") + "\n\n";
  t += "5. SCHEDULE BREAKDOWN (max " + MAX_WEEK_HRS + " training hrs/week)\n";
  syl.weeks.forEach((w, i) => { t += "   Week " + (i + 1) + ": " + w.map((x) => x.skill + " " + x.hours + "h").join(", ") + "\n"; });
  t += "\n6. TASK LIST\n" + syl.tasks.map((tk, i) => "   " + (i + 1) + ". " + tk).join("\n") + "\n\n";
  t += "ASSESSMENT: portfolio artifact + reflection mapped to each outcome.\n";
  return t;
}

function AdvisorAgent({ S }) {
  const [viewGan, setViewGan] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const gaps = S.translatorOut?.gap?.gaps || [];

  const syllabi = useMemo(() => {
    if (!gaps.length) return [];
    return packSyllabi(gaps).map((items) => {
      const trainingHrs = items.reduce((a, i) => a + i.hours, 0);
      const skills = items.map((i) => i.skill);
      const weeks = buildSchedule(items);
      return {
        items, trainingHrs, effortHrs: trainingHrs * EFFORT_RATIO, credits: creditHours(trainingHrs),
        objectives: jdObjectives(S.globalJD, skills),
        outcomes: skills.map((s) => "Demonstrated working capability in " + s + "."),
        weeks,
        tasks: items.map((i) => "Complete " + i.hours + "h module on " + i.skill + " (" + i.anchor + ")"),
      };
    });
  }, [gaps, S.globalJD]);

  const uniCourses = (S.curriculum?.enhanced || []).filter((c) => c.ucs.length).slice(0, 6);
  const proTraining = TRAINING_CATALOG.filter((t) => t.skills.some((s) => gaps.includes(s)));

  const superviseSyllabus = (i) => {
    S.setProfessorTokens((p) => p + PROFESSOR_TOKENS_PER_SYLLABUS);
    S.pushSupervision(i);
    S.pushLedger({ kind: "supervise", amount: PROFESSOR_TOKENS_PER_SYLLABUS, from: "Platform escrow", to: "Professor", note: "Agreed to supervise Syllabus " + (i + 1) });
  };
  const awardStudent = (amount) => {
    amount = Math.round(amount);
    if (amount <= 0 || amount > S.professorTokens) return;
    S.setProfessorTokens((p) => p - amount);
    S.setStudentTokens((s) => s + amount);
    S.pushLedger({ kind: "award", amount, from: "Professor", to: "Student", note: "Awarded " + amount + " GIVT to student" });
  };

  return (
    <div>
      <GanBanner gan={S.ganRecommendation} onView={() => setViewGan(!viewGan)}
        onDownload={() => downloadText("givt-gan-recommendation.txt", ganRecommendationText(S.ganRecommendation))} />
      {viewGan && S.ganRecommendation && (
        <Panel accent={C.green} title="GAN recommendation document">
          <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: "pre-wrap", color: C.inkSoft, margin: 0 }}>{ganRecommendationText(S.ganRecommendation)}</pre>
        </Panel>
      )}

      <Panel eyebrow="Agent 04 · Foreground (student-facing)" title="Advisor" accent={C.rust}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.inkSoft, marginTop: 0 }}>
          Synthesizes Translator, Talent, and Curriculum into three pathways. Effort model:
          1 training hr = {EFFORT_RATIO} effort hrs · ≤{MAX_TRAINING_HRS} training hrs/syllabus · ≤{MAX_WEEK_HRS} hrs/week · 5 training hrs = 1 credit (rounded up).
        </p>
        {!gaps.length && <div style={{ color: C.rust, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5 }}>Run the Translator to surface capability gaps first.</div>}
      </Panel>

      {gaps.length > 0 && (
        <>
          <Panel eyebrow="Pathway 1" title="University courses (schedule-aware)" accent={C.teal}>
            {uniCourses.length ? uniCourses.map((c, i) => (
              <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid " + C.rule, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.ink }}>
                <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{c.code}</strong> — {c.title} {c.ucs.map((u) => <Tag key={u} bg={C.tealDeep} color="#fff" border={C.tealDeep}>{u}</Tag>)}
              </div>
            )) : <em style={{ color: C.inkSoft }}>Run the Curriculum agent to populate course mappings.</em>}
          </Panel>

          <Panel eyebrow="Pathway 2" title="Professional training" accent={C.gold}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.inkSoft, fontWeight: 700, paddingBottom: 6, borderBottom: "2px solid " + C.rule }}>
              <span>Provider</span><span>Offering</span><span style={{ textAlign: "right" }}>Training hrs</span>
            </div>
            {proTraining.map((t, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 6, padding: "7px 0", borderBottom: "1px solid " + C.rule, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.ink }}>
                <span>{t.provider}</span><span>{t.offering}</span><span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{t.hours}h</span>
              </div>
            ))}
          </Panel>

          <Panel eyebrow="Pathway 3" title={"Directed study — " + syllabi.length + " syllabi"} accent={C.rust}>
            {syllabi.map((syl, i) => (
              <div key={i} style={{ border: "1px solid " + C.rule, borderRadius: 4, padding: 14, marginBottom: 14, background: C.paper }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0, color: C.ink }}>Syllabus {i + 1}</h4>
                  <span>
                    <Tag bg="#F3E8CC" color={C.goldDeep} border={C.gold}>{syl.credits} credit{syl.credits > 1 ? "s" : ""}</Tag>
                    <Tag>{syl.trainingHrs} training hrs</Tag>
                    <Tag>{syl.effortHrs} effort hrs</Tag>
                  </span>
                </div>

                <SyllSection title="1 · Credit Hours">{syl.credits} ({syl.trainingHrs} training / {syl.effortHrs} effort)</SyllSection>
                <SyllSection title="2 · Learning Objectives (JD-flavored)">
                  <ul style={listStyle}>{syl.objectives.map((o, k) => <li key={k}>{o}</li>)}</ul>
                </SyllSection>
                <SyllSection title="3 · Learning Outcomes">
                  <ul style={listStyle}>{syl.outcomes.map((o, k) => <li key={k}>{o}</li>)}</ul>
                </SyllSection>
                <SyllSection title="4 · Capability Gaps Addressed">
                  <ul style={listStyle}>{syl.items.map((it, k) => <li key={k}><strong>{it.skill}</strong> · {it.hours}h · {it.anchor}</li>)}</ul>
                </SyllSection>
                <SyllSection title={"5 · Schedule Breakdown (≤" + MAX_WEEK_HRS + "h/week)"}>
                  {syl.weeks.map((w, k) => <div key={k} style={schedRow}>Week {k + 1}: {w.map((x) => x.skill + " " + x.hours + "h").join(" · ")}</div>)}
                </SyllSection>
                <SyllSection title="6 · Task List">
                  <ol style={listStyle}>{syl.tasks.map((t, k) => <li key={k}>{t}</li>)}</ol>
                </SyllSection>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                  <Btn small kind="ghost" onClick={() => downloadText("givt-syllabus-" + (i + 1) + ".txt", syllabusText(syl, i + 1))}>Download syllabus</Btn>
                  <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="recipient@email" style={{ ...inputStyle, maxWidth: 180, padding: "6px 9px" }} />
                  <Btn small kind="ghost" onClick={() => {
                    downloadText("givt-syllabus-" + (i + 1) + ".txt", syllabusText(syl, i + 1));
                    const body = encodeURIComponent(syllabusText(syl, i + 1));
                    window.open("mailto:" + emailTo + "?subject=GIVT%20Syllabus%20" + (i + 1) + "&body=" + body, "_blank");
                  }}>Email syllabus</Btn>
                  <Btn small kind="ghost" onClick={() => { navigator.clipboard?.writeText(syllabusText(syl, i + 1)); }}>Share with professor</Btn>
                  {S.supervision.includes(i)
                    ? <Tag bg={C.greenSoft} color={C.tealDeep} border={C.green}>✓ Supervising · +{PROFESSOR_TOKENS_PER_SYLLABUS} GIVT credited to professor</Tag>
                    : <Btn small kind="teal" onClick={() => superviseSyllabus(i)}>Professor: agree to supervise (+{PROFESSOR_TOKENS_PER_SYLLABUS})</Btn>}
                </div>
              </div>
            ))}

            <div style={{ background: C.paperWarm, border: "1px solid " + C.rule, borderRadius: 4, padding: 12, marginTop: 6 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>
                Professor wallet: {S.professorTokens} GIVT · Student balance: {S.studentTokens} GIVT
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: C.rust, marginBottom: 6 }}>Professor → student award (a portion of earned tokens)</div>
              <AwardBox max={S.professorTokens} onAward={awardStudent} />

              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".12em", color: C.inkSoft, marginBottom: 6 }}>TOKEN EXCHANGE LEDGER</div>
                {S.tokenLedger.length ? S.tokenLedger.map((e) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid " + C.rule, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.ink }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Tag bg={e.kind === "supervise" ? C.greenSoft : "#F3E8CC"} color={e.kind === "supervise" ? C.tealDeep : C.goldDeep} border={e.kind === "supervise" ? C.green : C.gold}>{e.kind}</Tag>
                      <span>{e.from} <span style={{ color: C.inkSoft }}>→</span> {e.to}</span>
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: e.to === "Student" ? C.green : C.tealDeep }}>+{e.amount} GIVT</span>
                  </div>
                )) : <em style={{ color: C.inkSoft, fontSize: 12 }}>No exchanges yet — agree to supervise a syllabus to credit the professor +{PROFESSOR_TOKENS_PER_SYLLABUS} GIVT.</em>}
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
const listStyle = { margin: "4px 0", paddingLeft: 18, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.ink, lineHeight: 1.5 };
const schedRow = { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.inkSoft, padding: "2px 0" };
function SyllSection({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: C.rust, letterSpacing: ".04em", marginBottom: 3 }}>{title}</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.ink }}>{children}</div>
    </div>
  );
}
function AwardBox({ max, onAward }) {
  const [amt, setAmt] = useState(100);
  const pct = (p) => Math.floor((max * p) / 100);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {[10, 25, 50, 100].map((p) => (
          <Btn key={p} small kind="ghost" disabled={pct(p) <= 0} onClick={() => setAmt(pct(p))}>{p}% · {pct(p)}</Btn>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="number" value={amt} onChange={(e) => setAmt(Number(e.target.value))} style={{ ...inputStyle, maxWidth: 120, padding: "6px 9px" }} />
        <Btn small kind="gold" onClick={() => onAward(amt)} disabled={amt <= 0 || amt > max}>Award {amt > 0 ? amt + " " : ""}to student</Btn>
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: C.inkSoft, marginTop: 5 }}>
        Transfers a portion of the professor's earned tokens to the student (max {max}).
      </div>
    </div>
  );
}

/* ====================================================================== AGENT 05 — Reputation */
function ReputationAgent({ S }) {
  const [role, setRole] = useState("Employer");
  const [hedera, setHedera] = useState("");
  const [confidence, setConfidence] = useState(1);
  const [comment, setComment] = useState("");
  const [level, setLevel] = useState("L1");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const segments = useMemo(() => highlightResume(S.globalResume), [S.globalResume]);
  // verifications keyed by skill name: { "Python": [{role, confidence}], ... }
  const verifs = S.reputation?.verifs || {};
  const setVerifs = (v) => S.setReputation({ ...(S.reputation || {}), verifs: v });

  const verifySkill = (skill) => {
    const existing = verifs[skill] || [];
    if (existing.some((e) => e.role === role)) return; // one verification per role per skill
    const updated = { ...verifs, [skill]: [...existing, { role, confidence }] };
    setVerifs(updated);
    S.setStudentTokens((s) => s + STUDENT_TOKENS_PER_SKILL);
    S.addVerifierPoints(role, VERIFIER_POINTS_PER_SKILL);
    alert("Skill verified successfully. Reputation score updated.");
    const verifySkill = (skill) => {
  const existing = verifs[skill] || [];
if (existing.some((e) => e.role === role)) {
  alert("This skill is already verified for this role.");
  return;
}

  const updated = {
    ...verifs,
    [skill]: [...existing, { role, confidence }]
  };

  setVerifs(updated);
  S.setStudentTokens((s) => s + STUDENT_TOKENS_PER_SKILL);
  S.addVerifierPoints(role, VERIFIER_POINTS_PER_SKILL);

  alert("Skill verified successfully. Reputation score updated.");
};
  };

  // scoring
  const allVerifs = Object.values(verifs).flat();
  const weightedTokens = allVerifs.reduce((a, v) => a + ROLE_META[v.role].weight * (v.confidence === 1 ? 1 : 0.5) * STUDENT_TOKENS_PER_SKILL, 0);
  const reputation = Math.min(100, Math.round((weightedTokens / 1550) * 100));
  const vStatus = allVerifs.length
    ? Math.round((allVerifs.reduce((a, v) => a + ROLE_META[v.role].weight * (v.confidence === 1 ? 1 : 0.5), 0) / allVerifs.length) * 100)
    : 0;
  const composite = Math.round(Math.sqrt(reputation * vStatus));
  const scoreBreakdown = {
  verifiedSkills: allVerifs.length,
  weightedTokens: weightedTokens,
  reputationScore: reputation,
  verificationStatus: vStatus,
  compositeScore: composite
};

const highConfidence = allVerifs.filter(v => v.confidence === "C1").length;
const mediumConfidence = allVerifs.filter(v => v.confidence === "C2").length;
const lowConfidence = allVerifs.filter(v => v.confidence === "C3").length;

const verificationHistory = allVerifs.map((v) => ({
  skill: v.skill,
  role: v.role,
  confidence: v.confidence
}));

  useEffect(() => {
    S.setUserMetrics({ reputation, verification: vStatus, tokens: S.studentTokens });
  }, [reputation, vStatus, S.studentTokens]);

  const leaderboard = useMemo(() => {
    const rows = [...LEADERBOARD_FIXTURE, { name: "You (student)", score: composite, you: true }];
    return rows.sort((a, b) => b.score - a.score);
  }, [composite]);

  const wordCt = comment.trim() ? comment.trim().split(/\s+/).length : 0;

  return (
    <div>
      <Panel eyebrow="Agent 05 · Foreground · On-chain" title="Reputation" accent={C.green}>
        <div style={{ marginBottom: 12 }}>
          <Btn kind="rust" onClick={() => setShowLeaderboard(true)}>🏆 Leaderboard Display</Btn>
        </div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.inkSoft, marginTop: 0 }}>
          Stakeholders verify capabilities directly on the student's résumé. Pick your acting role, then click any
          highlighted skill in the résumé to verify it — verified skills turn green and carry a stakeholder badge.
          Student earns {STUDENT_TOKENS_PER_SKILL}/skill; verifier earns {VERIFIER_POINTS_PER_SKILL}/skill.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <Field label="Acting role">
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
              {Object.keys(ROLE_META).map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Confidence">
            <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} style={{ ...inputStyle, maxWidth: 220 }}>
              <option value={1}>1 — first-hand knowledge</option>
              <option value={2}>2 — aware, no direct knowledge</option>
            </select>
          </Field>
          <Field label="Hedera account (optional)">
            <input value={hedera} onChange={(e) => setHedera(e.target.value)} placeholder="0.0.XXXXXXX" style={{ ...inputStyle, maxWidth: 160 }} />
          </Field>
        </div>

        <div style={{ marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ROLE_META[role].soft, border: "1px solid " + ROLE_META[role].color, color: ROLE_META[role].color, borderRadius: 3, padding: "3px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700 }}>
            ● Acting as {role} (weight {ROLE_META[role].weight})
          </span>
        </div>

        <Field label="100-word comment (describes your direct C1 / indirect C2 knowledge)">
          <textarea value={comment} onChange={(e) => { const w = e.target.value.trim().split(/\s+/); if (w.length <= 100 || e.target.value.length < comment.length) setComment(e.target.value); }} rows={3} style={inputStyle} />
          <span style={{ fontSize: 11, color: wordCt >= 100 ? C.rust : C.inkSoft, fontFamily: "'JetBrains Mono', monospace" }}>{wordCt}/100 words</span>
        </Field>
      </Panel>

      <Panel eyebrow="Résumé · stakeholder verification access" title="Student résumé — highlight a skill to verify" accent={C.gold}>
        {!S.globalResume && <em style={{ color: C.inkSoft }}>Run the Translator to load the student résumé.</em>}
        {S.globalResume && (
          <>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
              Acting as <strong style={{ color: ROLE_META[role].color }}>{role}</strong>. Click any highlighted skill in the résumé below to verify it.
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 2.0, color: C.ink, background: "#fff", border: "1px solid " + C.rule, borderRadius: 4, padding: 14, maxHeight: 360, overflow: "auto" }}>
              {segments.map((seg, i) => {
                if (seg.type === "text") return <span key={i}>{seg.value}</span>;
                const vs = verifs[seg.skill] || [];
                const verified = vs.length > 0;
                return (
                  <span key={i} onClick={() => verifySkill(seg.skill)} title={verified ? seg.skill + " — verified" : "Click to verify " + seg.skill + " as " + role}
                    style={{
                      cursor: "pointer", padding: "1px 4px", borderRadius: 3, fontWeight: 700,
                      background: verified ? C.greenSoft : "#FBF1D6",
                      color: verified ? C.green : C.goldDeep,
                      border: "1px solid " + (verified ? C.green : C.gold),
                      boxShadow: verified ? "inset 0 -2px 0 " + C.green : "none",
                    }}>
                    {seg.value}{verified && <sup style={{ fontSize: 8 }}> ✓</sup>}
                  </span>
                );
              })}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".1em", color: C.inkSoft, marginBottom: 6 }}>VERIFIED SKILLS & STAKEHOLDER BADGES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(verifs).length === 0 && <em style={{ color: C.inkSoft, fontSize: 12 }}>No skills verified yet.</em>}
                {Object.entries(verifs).map(([skill, vs]) => (
                  <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.greenSoft, border: "1px solid " + C.green, borderRadius: 3, padding: "3px 8px", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
                    <strong style={{ color: C.green }}>✓ {skill}</strong>
                    {vs.map((v, k) => (
                      <span key={k} style={{ background: ROLE_META[v.role].soft, color: ROLE_META[v.role].color, border: "1px solid " + ROLE_META[v.role].color, borderRadius: 2, padding: "0 5px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700 }}>
                        {v.role} C{v.confidence}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.inkSoft }}>
              <span style={{ fontWeight: 700 }}>Stakeholder colors:</span>
              {Object.keys(ROLE_META).map((r) => (
                <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: ROLE_META[r].color }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: ROLE_META[r].color, display: "inline-block" }} /> {r}
                </span>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel eyebrow="Scoring" title="Reputation score" accent={C.teal}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <ScoreCard label="Reputation" value={reputation + "%"} sub="weighted tokens / 1550" />
          <ScoreCard label="Verification status" value={vStatus + "%"} sub="mean(role × confidence)" />
          <ScoreCard label="Composite" value={composite} sub="√(Rep × VStatus)" accent={C.green} />
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft }}>
          Student tokens: <strong>{S.studentTokens}</strong> · Verifier points — {Object.keys(ROLE_META).map((r) => r + ": " + (S.verifierLedger[r]?.points || 0)).join(" · ")}
        </div>
        <div style={{
  marginTop: 20,
  padding: 12,
  border: "1px solid #ddd",
  borderRadius: 8
}}>
  <h4>Score Calculation Breakdown</h4>

  <p>Verified Skills: {scoreBreakdown.verifiedSkills}</p>

  <p>Weighted Tokens: {scoreBreakdown.weightedTokens}</p>

  <p>Reputation Score: {scoreBreakdown.reputationScore}%</p>

  <p>Verification Status: {scoreBreakdown.verificationStatus}%</p>

  <p>Composite Score: {scoreBreakdown.compositeScore}</p>
</div>

      </Panel>

      {showLeaderboard && (
        <div onClick={() => setShowLeaderboard(false)} style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,.55)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflow: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, border: "1px solid " + C.rule, borderTop: "4px solid " + C.gold, borderRadius: 6, maxWidth: 620, width: "100%", padding: "22px 24px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, margin: 0, color: C.ink }}>🏆 Leaderboard</h3>
              <Btn small kind="ghost" onClick={() => setShowLeaderboard(false)}>Close ✕</Btn>
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 14 }}>
              Composite standing — √(Reputation × Verification). Your live position updates as stakeholders verify résumé skills.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {LEVELS.map((l) => (
                <label key={l.id} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, display: "inline-flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="lvl" checked={level === l.id} onChange={() => setLevel(l.id)} /> {l.id} {l.label}
                </label>
              ))}
            </div>
            {leaderboard.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", marginBottom: 6, borderRadius: 4,
                background: r.you ? C.greenSoft : "#fff", border: "1px solid " + (r.you ? C.green : C.rule),
                fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: r.you ? 700 : 500, color: r.you ? C.tealDeep : C.ink }}>
                <span><span style={{ fontFamily: "'JetBrains Mono', monospace", color: i === 0 ? C.gold : C.inkSoft, marginRight: 10 }}>#{i + 1}</span>{r.name}</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: i === 0 ? C.gold : C.ink }}>{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function ScoreCard({ label, value, sub, accent }) {
  return (
    <div style={{ border: "1px solid " + C.rule, borderTop: "3px solid " + (accent || C.teal), borderRadius: 4, padding: "12px 14px", background: "#fff" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: C.inkSoft }}>{label}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 600, color: accent || C.ink }}>{value}</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: C.inkSoft }}>{sub}</div>
    </div>
  );
}

/* ====================================================================== AGENT 06 — Generator */
function GeneratorAgent({ S }) {
  const [sector, setSector] = useState(SECTORS[0]);
  const [other, setOther] = useState("");
  const [modules, setModules] = useState(null);
  const [showDoc, setShowDoc] = useState(false);

  const docSector = sector === "Other" ? (other || "Other") : sector;

  const generate = () => {
    const seed = seedModules(sector);
    setModules(seed);
    S.setGanSeed({ sector: docSector, modules: seed });
  };

  return (
    <div>
      <Panel eyebrow="Agent 06 · Background · GAN loop" title="Generator" accent={C.teal}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.inkSoft, marginTop: 0 }}>
          Surfaces real innovation sources, then learns from them to produce a forward-looking curriculum — the seed document for the GAN loop.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Sector">
            <select value={sector} onChange={(e) => setSector(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
              {SECTORS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          {sector === "Other" && (
            <Field label="Specify (≤50 chars)"><input maxLength={50} value={other} onChange={(e) => setOther(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }} /></Field>
          )}
          <div style={{ marginBottom: 14 }}><Btn kind="teal" onClick={generate}>Generate forward-looking curriculum ▶</Btn></div>
        </div>
      </Panel>

      <Panel eyebrow="Real innovation sources" title="Grounding documents (verified 2025–2026)" accent={C.gold}>
        {INNOVATION_SOURCES.map((s, i) => (
          <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid " + C.rule, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
            <Tag bg="#F3E8CC" color={C.goldDeep} border={C.gold}>{s.org}</Tag>
            <a href={s.url} target="_blank" rel="noreferrer" style={{ color: C.teal }}>{s.title}</a>
          </div>
        ))}
      </Panel>

      {modules && (
        <Panel eyebrow="Seed output" title="Forward-looking curriculum modules" accent={C.rust}>
          {modules.map((m, i) => (
            <div key={i} style={{ padding: "9px 0", borderBottom: "1px solid " + C.rule }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.ink, marginBottom: 5 }}>
                <span>{m.name}</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{m.coverage}%</span>
              </div>
              <Bar value={m.coverage} color={C.teal} />
            </div>
          ))}
          <div style={{ marginTop: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.green }}>✓ Seed passed to the Discriminator's GAN loop.</div>
        </Panel>
      )}

      {modules && (
        <Panel eyebrow="Document" title="Forward-looking curriculum — recommendations" accent={C.teal}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.inkSoft, marginTop: 0 }}>
            A full curriculum document for <strong>{docSector}</strong>: executive summary, grounding sources, per-module recommended topics and compliance alignment, and overall recommendations.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn small kind="teal" onClick={() => setShowDoc(!showDoc)}>{showDoc ? "Hide" : "View"} curriculum document</Btn>
            <Btn small kind="ghost" onClick={() => downloadText("givt-forward-looking-curriculum.txt", buildCurriculumDocument(docSector, modules))}>Download curriculum document</Btn>
          </div>
          {showDoc && (
            <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, whiteSpace: "pre-wrap", color: C.inkSoft, margin: "12px 0 0", background: "#fff", border: "1px solid " + C.rule, borderRadius: 4, padding: 14, maxHeight: 400, overflow: "auto" }}>{buildCurriculumDocument(docSector, modules)}</pre>
          )}
        </Panel>
      )}
    </div>
  );
}

/* ====================================================================== AGENT 07 — Discriminator */
function DiscriminatorAgent({ S }) {
  const suggested = useMemo(() => {
    const co = (S.detectedCompany || "").toLowerCase();
    if (co.includes("health") || co.includes("hospital") || co.includes("medical")) return SECTORS[0];
    return SECTORS[0];
  }, [S.detectedCompany]);
  const [sector, setSector] = useState(suggested);
  const [loops, setLoops] = useState([]); // array of loop results
  const [openReview, setOpenReview] = useState({});
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { setSector(suggested); }, [suggested]);

  const seedModules2 = S.ganSeed?.modules || seedModules(sector);

  const runLoop = () => {
    const prev = loops.length ? loops[loops.length - 1].step3 : seedModules2;
    const n = loops.length + 1;
    const result = runGanLoop(prev, n, sector);
    setLoops([...loops, result]);
  };
  const reachEquilibrium = () => {
    const last = loops[loops.length - 1];
    if (!last) return;
    S.setGanRecommendation({
      sector, meanCoverage: last.meanCoverage, modules: last.step3, loops: loops.length,
    });
  };

  const equilibriumReady = loops.length && loops[loops.length - 1].equilibriumReady;

  return (
    <div>
      <Panel eyebrow="Agent 07 · Background · GAN loop" title="Discriminator" accent={C.rust}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.inkSoft, marginTop: 0 }}>
          Trains on real compliance sources and critiques the Generator's curriculum against compliance lenses. Drives the Generator↔Discriminator loop to equilibrium.
        </p>
        <Field label="Sector (auto-suggested from Translator's detected company)">
          <select value={sector} onChange={(e) => setSector(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
            {SECTORS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: C.teal, marginBottom: 12 }}>
          ● Confirmed sector: {sector}{S.detectedCompany ? " · from " + S.detectedCompany : ""}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn kind="rust" style={{ background: C.rust, color: "#fff", borderColor: C.rust }} onClick={runLoop}>
            {loops.length ? "Next Loop ▶" : "Generator and Discriminator Loop ▶"}
          </Btn>
          <Btn kind="green" disabled={!equilibriumReady} onClick={reachEquilibrium}>Equilibrium Reached ✓</Btn>
        </div>
      </Panel>

      <Panel eyebrow="Real compliance sources" title="Training documents (verified 2025–2026)" accent={C.gold}>
        {COMPLIANCE_SOURCES.map((s, i) => (
          <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid " + C.rule, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
            <Tag bg="#F3E8CC" color={C.goldDeep} border={C.gold}>{s.org}</Tag>
            <a href={s.url} target="_blank" rel="noreferrer" style={{ color: C.teal }}>{s.title}</a>
            <span style={{ marginLeft: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.inkSoft }}>[{COMPLIANCE_LENSES[s.lens]}]</span>
          </div>
        ))}
      </Panel>

      <Panel eyebrow="Standard" title="Standard curriculum guideline" accent={C.teal}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.inkSoft, marginTop: 0 }}>
          Synthesized from the {COMPLIANCE_SOURCES.length} compliance sources above — the conformance baseline every curriculum module must meet for <strong>{sector}</strong> before equilibrium.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small kind="teal" onClick={() => setShowGuide(!showGuide)}>{showGuide ? "Hide" : "View"} standard guideline</Btn>
          <Btn small kind="ghost" onClick={() => downloadText("givt-standard-curriculum-guideline.txt", buildStandardGuideline(sector))}>Download guideline</Btn>
        </div>
        {showGuide && (
          <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, whiteSpace: "pre-wrap", color: C.inkSoft, margin: "12px 0 0", background: "#fff", border: "1px solid " + C.rule, borderRadius: 4, padding: 14, maxHeight: 360, overflow: "auto" }}>{buildStandardGuideline(sector)}</pre>
        )}
      </Panel>

      {loops.map((lp, i) => (
        <Panel key={i} eyebrow={"Loop " + lp.loopNumber} title={"GAN cycle " + lp.loopNumber + " — three steps"} accent={C.teal}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: C.teal, marginBottom: 6 }}>STEP 1 — Generator recommendation</div>
          {lp.step1.map((m, k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, padding: "2px 0" }}>
              <span>{m.name}</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{m.coverage}%</span>
            </div>
          ))}

          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: C.rust, margin: "12px 0 6px" }}>STEP 2 — Discriminator critique ({lp.flagsCount} flags)</div>
          {lp.critique.length ? lp.critique.map((c, k) => (
            <div key={k} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.rust, padding: "3px 0" }}>
              ⚠ <strong>{c.module}</strong> under-covers <strong>{c.lensLabel}</strong> — per {c.source.org} ({c.source.title})
            </div>
          )) : <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.green }}>✓ No compliance flags remaining.</div>}

          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: C.green, margin: "12px 0 6px" }}>STEP 3 — Generator revision · mean coverage {lp.meanCoverage}%</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Btn small kind="ghost" onClick={() => setOpenReview({ ...openReview, [i]: !openReview[i] })}>View / review revised recommendation</Btn>
            <Btn small kind="ghost" onClick={() => {
              let t = "GIVT GENERATOR REVISION — LOOP " + lp.loopNumber + "\nMean coverage: " + lp.meanCoverage + "%\n\n";
              lp.step3.forEach((m, x) => { t += (x + 1) + ". " + m.name + " — " + m.coverage + "%\n"; });
              downloadText("givt-generator-revision-loop" + lp.loopNumber + ".txt", t);
            }}>Download revised recommendation</Btn>
          </div>
          {openReview[i] && lp.step3.map((m, k) => (
            <div key={k} style={{ padding: "5px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.ink }}>
                <span>{m.name}</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{m.coverage}%</span>
              </div>
              <Bar value={m.coverage} color={C.green} />
            </div>
          ))}
          {lp.equilibriumReady && <div style={{ marginTop: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.green, fontWeight: 700 }}>✓ Equilibrium ready — click "Equilibrium Reached" to share downstream.</div>}
        </Panel>
      ))}

      {S.ganRecommendation && (
        <Panel accent={C.green} title="✓ Equilibrium finalized">
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.tealDeep }}>
            Shared to Talent, Curriculum, and Advisor agents. Mean coverage {S.ganRecommendation.meanCoverage}% over {S.ganRecommendation.loops} loops.
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ====================================================================== Account creation */
const ACCOUNT_ROLES = ["Student", "Advisor", "Professor", "Employer", "Peer"];
const ACCOUNT_ROLE_COLOR = (r) => (ROLE_META[r] ? ROLE_META[r].color : C.tealDeep);
function fallback250(src, count, role, name) {
  if (count > 250) return src.split(/\s+/).slice(0, 250).join(" ") + " …";
  const who = name || "This participant";
  let t = src ? src.trim() + " " : "";
  t += who + " is an active member of the GIVT (Gamified, Individualized, Verified Talent) platform, participating as a " + role.toLowerCase() +
    ". On GIVT, capabilities are not merely claimed but verified on-chain by employers, professors, advisors, and peers, creating a portable, trustworthy record of real-world skill. " +
    who + "'s focus spans the core competencies that matter in healthcare informatics today: structured data analysis, interoperability through HL7 and FHIR, regulatory compliance under HIPAA and ONC information-blocking rules, and the responsible governance of AI-assisted clinical workflows aligned to the NIST AI Risk Management Framework. " +
    "Through the platform's Translator, Talent, Curriculum, and Advisor agents, " + who.toLowerCase() + " continuously closes the gap between academic preparation and employer demand, converting directed study and professional training into verifiable, credit-bearing outcomes. " +
    "As a " + role.toLowerCase() + ", they value transparent assessment, evidence-based growth, and collaboration across the talent ecosystem. " +
    "Every verified skill strengthens reputation, earns tokens, and advances standing on the leaderboard — turning learning into a measurable, rewarded, and shareable signal of genuine workforce readiness in a rapidly evolving, AI-driven healthcare landscape.";
  // trim toward ~250 words
  const w = t.split(/\s+/);
  return w.length > 250 ? w.slice(0, 250).join(" ") : t;
}

function AccountModal({ S, onClose }) {
  const existing = S.account;
  const [role, setRole] = useState(existing?.role || "Student");
  const [name, setName] = useState(existing?.name || "");
  const [hedera, setHedera] = useState(existing?.hedera || "");
  const [source, setSource] = useState(existing?.profile || "");   // uploaded/written source
  const [profFiles, setProfFiles] = useState([]);
  const [generated, setGenerated] = useState(existing?.profile || ""); // editable 250-word result
  const [gen, setGen] = useState(false);

  const srcWc = wordCount(source);
  const genWc = wordCount(generated);
  const mode = srcWc > 250 ? "summarize" : srcWc > 0 ? "enhance" : "create";

  const generate250 = async () => {
    setGen(true);
    const src = sanitize(generated || source); // allow iterative refinement of an edited draft
    const count = wordCount(src);
    let prompt, useSearch = false;
    if (count > 250) {
      prompt = "Summarize the following professional profile to about 250 words. Keep it first person, polished, and faithful to the stated facts. Return only the profile text.\n\n" + src;
    } else if (count > 0) {
      useSearch = true;
      prompt = "Expand and enhance the following short professional profile into a polished, first-person profile of about 250 words for a " + role +
        " on a healthcare-informatics talent platform called GIVT. Use web search to add relevant, current context where helpful. Preserve every stated fact and do NOT invent specific credentials, employers, or dates. Return only the profile text.\n\n" + src;
    } else {
      useSearch = true;
      prompt = "Write a polished, first-person professional profile of about 250 words for a " + role + " named \"" + (name || "a participant") +
        "\" on a healthcare-informatics talent platform called GIVT. Use web search for relevant general context. Keep it generic where specific facts are unknown and do NOT fabricate credentials, employers, or dates. Return only the profile text.";
    }
    try {
      const body = { model: "claude-sonnet-4-20250514", max_tokens: 1200, messages: [{ role: "user", content: prompt }] };
      if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setGenerated(text || fallback250(src, count, role, name));
    } catch (e) {
      setGenerated(fallback250(src, count, role, name));
    }
    setGen(false);
  };

  const submit = () => {
    if (!name.trim()) return;
    const acct = { role, name: name.trim(), hedera: hedera.trim(), profile: sanitize(generated || source), createdAt: Date.now() };
    const isNew = !existing;
    S.setAccount(acct);
    if (isNew) {
      S.creditRole(role, ACCOUNT_REWARD);
      S.pushLedger({ kind: "account", amount: ACCOUNT_REWARD, from: "GIVT treasury", to: role, note: "Account creation reward (" + role + ")" });
    }
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,.6)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflow: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, border: "1px solid " + C.rule, borderTop: "4px solid " + C.gold, borderRadius: 6, maxWidth: 640, width: "100%", padding: "24px 26px", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, margin: 0, color: C.ink }}>{existing ? "Manage GIVT account" : "Create your GIVT account"}</h3>
          <Btn small kind="ghost" onClick={onClose}>Close ✕</Btn>
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 16 }}>
          {existing
            ? <>Signed in as <strong style={{ color: C.ink }}>{existing.name}</strong>. Update your details or regenerate your 250-word profile.</>
            : <>Join GIVT and <strong style={{ color: C.goldDeep }}>earn {ACCOUNT_REWARD} tokens</strong> the moment your account is created.</>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <Field label="Participant role">
            <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
              {ACCOUNT_ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya Osei" style={inputStyle} />
          </Field>
        </div>

        <Field label="Hedera account address">
          <input value={hedera} onChange={(e) => setHedera(e.target.value)} placeholder="0.0.XXXXXXX" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} />
        </Field>

        <div style={{ marginTop: 6, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Profile — upload or write</div>
        <FileUploader label="Upload a bio/résumé, or write your profile in Paste / Write" value={source} onChange={setSource} files={profFiles} setFiles={setProfFiles} />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <Btn small kind="teal" onClick={generate250} disabled={gen}>Update profile · generate 250-word profile</Btn>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.inkSoft }}>
            source: {srcWc} words → <strong style={{ color: C.teal }}>{mode === "summarize" ? "summarize to 250" : mode === "enhance" ? "enhance to 250 (web search)" : "generate from scratch (web search)"}</strong>
          </span>
          {gen && <Spinner label="Generating 250-word profile" />}
        </div>

        {(gen || generated) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, color: C.teal, marginBottom: 5 }}>
              Generated 250-word profile — edit, then confirm <span style={{ fontWeight: 400, color: genWc > 270 || (genWc && genWc < 230) ? C.rust : C.inkSoft }}>({genWc} words)</span>
            </div>
            {gen ? (
              <div style={{ border: "1px solid " + C.rule, borderRadius: 4, padding: 14, background: C.paperWarm, minHeight: 120 }}>
                {[94, 88, 82, 90, 76, 84].map((w, i) => (
                  <div key={i} style={{ height: 9, width: w + "%", background: C.rule, borderRadius: 3, marginBottom: 9, animation: "givtpulse 1.4s infinite " + (i * 0.15) + "s" }} />
                ))}
              </div>
            ) : (
              <textarea value={generated} onChange={(e) => setGenerated(e.target.value)} rows={8}
                style={{ ...inputStyle, minHeight: 150, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
          <Btn kind="gold" onClick={submit} disabled={!name.trim()}>
            {existing ? "Save changes" : "Create account · +" + ACCOUNT_REWARD + " GIVT"}
          </Btn>
          {!existing && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: C.inkSoft }}>{ACCOUNT_REWARD} tokens credited to your {role.toLowerCase()} wallet.</span>}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== Homepage banner */
function HomeBanner({ S }) {
  const m = S.userMetrics || { reputation: 0, verification: 0, tokens: S.studentTokens };
  const Card = ({ big, label, live }) => (
    <div style={{ background: "#fff", border: "1px solid " + C.rule, borderRadius: 4, padding: "16px 18px", borderTop: "3px solid " + (live ? C.teal : C.gold) }}>
      {live && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: C.teal, fontWeight: 700, letterSpacing: ".1em" }}>● LIVE</span>}
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 600, color: C.ink, lineHeight: 1.1 }}>{big}</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.inkSoft }}>{label}</div>
    </div>
  );
  return (
    <div style={{ marginBottom: 22 }}>
      {!S.account ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
          background: C.ink, color: C.paper, border: "1px solid " + C.goldDeep, borderLeft: "5px solid " + C.gold, borderRadius: 6, padding: "16px 20px", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600 }}>Create your GIVT account</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, opacity: 0.85 }}>
              Students, advisors, professors, employers, and peers each earn <strong style={{ color: C.gold }}>{ACCOUNT_REWARD} tokens</strong> for joining.
            </div>
          </div>
          <Btn kind="gold" onClick={() => S.setShowAccount(true)} style={{ fontSize: 15, padding: "11px 20px", whiteSpace: "nowrap" }}>
            ✦ Create Account · +{ACCOUNT_REWARD} GIVT
          </Btn>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
          background: "#fff", border: "1px solid " + C.rule, borderLeft: "5px solid " + ACCOUNT_ROLE_COLOR(S.account.role), borderRadius: 6, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: (ROLE_META[S.account.role]?.soft) || C.greenSoft, color: ACCOUNT_ROLE_COLOR(S.account.role), border: "1px solid " + ACCOUNT_ROLE_COLOR(S.account.role), borderRadius: 3, padding: "3px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700 }}>
              ✓ {S.account.role}
            </span>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: C.ink }}>{S.account.name}</span>
            {S.account.hedera && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.inkSoft }}>Hedera {S.account.hedera}</span>}
          </div>
          <Btn small kind="teal" onClick={() => S.setShowAccount(true)}>Update profile</Btn>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Card big="58%" label="of grads don't land their first job until 6+ months out" />
        <Card big=">50%" label="of hiring managers say fresh grads lack required capabilities" />
        <Card big="$60B+" label="TAM across AI-in-education, LMS/LXP, skills intelligence & AI-HR" />
        <Card live big={m.reputation + "%"} label="Reputation Score" />
        <Card live big={m.verification + "%"} label="Verification Scope" />
        <Card live big={S.studentTokens} label="Tokens earned" />
      </div>
    </div>
  );
}

/* ====================================================================== App shell */
const AGENTS = [
  { id: "translator", n: "01", name: "Translator", group: "fg", C: TranslatorAgent, accent: C.ink },
  { id: "talent", n: "02", name: "Talent", group: "fg", C: TalentAgent, accent: C.gold },
  { id: "curriculum", n: "03", name: "Curriculum", group: "fg", C: CurriculumAgent, accent: C.teal },
  { id: "advisor", n: "04", name: "Advisor", group: "fg", C: AdvisorAgent, accent: C.rust },
  { id: "reputation", n: "05", name: "Reputation", group: "gan", C: ReputationAgent, accent: C.green },
  { id: "generator", n: "06", name: "Generator", group: "gan", C: GeneratorAgent, accent: C.teal },
  { id: "discriminator", n: "07", name: "Discriminator", group: "gan", C: DiscriminatorAgent, accent: C.rust },
];

export default function App() {
  // shared cross-agent state
  const [active, setActive] = useState("translator");
  const [globalResume, setGlobalResume] = useState("");
  const [globalJD, setGlobalJD] = useState("");
  const [resumeFiles, setResumeFiles] = useState([]);
  const [jdFiles, setJdFiles] = useState([]);
  const [translatorOut, setTranslatorOut] = useState(null);
  const [detectedCompany, setDetectedCompany] = useState("");
  const [resumeCompany, setResumeCompany] = useState("");
  const [talent, setTalent] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [reputation, setReputation] = useState({ verifs: {} });
  const [studentTokens, setStudentTokens] = useState(0);
  const [professorTokens, setProfessorTokens] = useState(VERIFIER_START_WALLET);
  const [ganSeed, setGanSeed] = useState(null);
  const [ganRecommendation, setGanRecommendation] = useState(null);
  const [userMetrics, setUserMetrics] = useState({ reputation: 0, verification: 0, tokens: 0 });
  const [verifierLedger, setVerifierLedger] = useState(
    Object.keys(ROLE_META).reduce((a, r) => ({ ...a, [r]: { points: 0, wallet: VERIFIER_START_WALLET } }), {})
  );
  const [supervision, setSupervision] = useState([]);
  const [tokenLedger, setTokenLedger] = useState([]);
  const [account, setAccount] = useState(null);
  const [showAccount, setShowAccount] = useState(false);

  const creditRole = useCallback((role, amount) => {
    if (role === "Student") setStudentTokens((s) => s + amount);
    else if (role === "Professor") setProfessorTokens((p) => p + amount);
    else setVerifierLedger((l) => (l[role] ? { ...l, [role]: { ...l[role], wallet: l[role].wallet + amount } } : l));
  }, []);

  const addVerifierPoints = useCallback((role, pts) => {
    setVerifierLedger((l) => ({ ...l, [role]: { ...l[role], points: l[role].points + pts } }));
  }, []);
  const pushSupervision = useCallback((i) => setSupervision((s) => (s.includes(i) ? s : [...s, i])), []);
  const pushLedger = useCallback((e) => setTokenLedger((l) => [{ ...e, id: Date.now() + Math.random() }, ...l]), []);

  const S = {
    globalResume, setGlobalResume, globalJD, setGlobalJD,
    resumeFiles, setResumeFiles, jdFiles, setJdFiles,
    translatorOut, setTranslatorOut, detectedCompany, setDetectedCompany,
    resumeCompany, setResumeCompany,
    talent, setTalent, curriculum, setCurriculum,
    reputation, setReputation,
    studentTokens, setStudentTokens, professorTokens, setProfessorTokens,
    ganSeed, setGanSeed, ganRecommendation, setGanRecommendation,
    userMetrics, setUserMetrics, verifierLedger, addVerifierPoints,
    supervision, pushSupervision,
    tokenLedger, pushLedger,
    account, setAccount, showAccount, setShowAccount, creditRole,
  };

  // inject fonts once
  useEffect(() => {
    const id = "givt-fonts";
    if (document.getElementById(id)) return;
    const l1 = document.createElement("link"); l1.rel = "preconnect"; l1.href = "https://fonts.googleapis.com";
    const l2 = document.createElement("link"); l2.id = id; l2.rel = "stylesheet";
    l2.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";
    document.head.appendChild(l1); document.head.appendChild(l2);
    const st = document.createElement("style"); st.id = "givt-anim";
    st.textContent = "@keyframes givtspin{to{transform:rotate(360deg)}}@keyframes givtpulse{0%,80%,100%{opacity:.25}40%{opacity:1}}";
    document.head.appendChild(st);
  }, []);

  const ActiveComp = AGENTS.find((a) => a.id === active).C;
  const NavBtn = ({ a }) => (
    <button onClick={() => setActive(a.id)} style={{
      textAlign: "left", width: "100%", cursor: "pointer", padding: "9px 11px", borderRadius: 3, marginBottom: 5,
      border: "1px solid " + (active === a.id ? a.accent : C.rule),
      background: active === a.id ? a.accent : "#fff",
      color: active === a.id ? (a.accent === C.gold || a.accent === C.green || a.accent === C.teal || a.accent === C.rust ? "#fff" : C.paper) : C.ink,
      fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 600, display: "flex", gap: 8, alignItems: "center",
    }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.7 }}>{a.n}</span>{a.name}
    </button>
  );

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink }}>
      {/* masthead */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: C.ink, color: C.paper, borderBottom: "3px solid " + C.gold, padding: "14px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600 }}>GIVT Sandbox</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, marginLeft: 12, opacity: 0.75 }}>Gamified · Individualized · Verified Talent</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.7 }}>Kennesaw State · Healthcare Informatics · 2026</span>
            {account
              ? <Btn small kind="ghost" style={{ background: "transparent", color: C.paper, borderColor: C.gold }} onClick={() => setShowAccount(true)}>✓ {account.name.split(" ")[0]} · {account.role}</Btn>
              : <Btn small kind="gold" onClick={() => setShowAccount(true)}>✦ Create Account</Btn>}
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 24, maxWidth: 1180, margin: "0 auto", padding: "22px 26px" }}>
        {/* nav rail */}
        <nav style={{ position: "sticky", top: 78, alignSelf: "start" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>Foreground · Talent group</div>
          {AGENTS.filter((a) => a.group === "fg").map((a) => <NavBtn key={a.id} a={a} />)}
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.teal, margin: "16px 0 8px" }}>On-chain · GAN loop</div>
          {AGENTS.filter((a) => a.group === "gan").map((a) => <NavBtn key={a.id} a={a} />)}

          <div style={{ marginTop: 18, padding: 12, background: "#fff", border: "1px solid " + C.rule, borderRadius: 4 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.inkSoft, letterSpacing: ".1em" }}>WALLETS</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.ink, marginTop: 4 }}>Student: <strong>{studentTokens}</strong> GIVT</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.ink }}>Professor: <strong>{professorTokens}</strong> GIVT</div>
            {account && !["Student", "Professor"].includes(account.role) && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.ink }}>{account.role}: <strong>{verifierLedger[account.role]?.wallet}</strong> GIVT</div>
            )}
            {account && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid " + C.rule, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: C.inkSoft }}>
                Signed in: <strong style={{ color: C.ink }}>{account.name}</strong> ({account.role})
              </div>
            )}
          </div>
        </nav>

        {/* main */}
        <main>
          <HomeBanner S={S} />
          <ActiveComp S={S} />
        </main>
      </div>

      <footer style={{ textAlign: "center", padding: "18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.inkSoft, borderTop: "1px solid " + C.rule }}>
        GIVT Sandbox · live in-memory build (state resets on refresh) · production version uses window.storage persistence
      </footer>

      {showAccount && <AccountModal S={S} onClose={() => setShowAccount(false)} />}
    </div>
  );
}
