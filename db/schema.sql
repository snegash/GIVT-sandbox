-- ============================================================================
-- GIVT Sandbox — PostgreSQL schema (standard Postgres, no vendor extensions)
-- Gamified · Individualized · Verified Talent
--
-- Runs on local PostgreSQL now and on Supabase's Postgres later — unchanged.
-- Authentication is handled by the Node/Express API (app_users + bcrypt + JWT);
-- there is no Row Level Security here because the API enforces authorization.
--
-- RUN IT
--   createdb givt
--   psql -d givt -f db/schema.sql
-- (or open it in pgAdmin's Query Tool and Execute). Safe to re-run.
--
-- CONTENTS
--   1. Extensions
--   2. Enums + updated_at helper
--   3. Lookup tables   : skills, sectors
--   4. Auth + identity  : app_users, accounts, token_ledger
--   5. Workspace        : sessions, session_files
--   6. Agent outputs    : translator_outputs, talent_profiles, curriculum_plans,
--                         syllabi, supervision, skill_verifications,
--                         gan_runs, gan_loops
--   7. Reputation       : reputation_scores, leaderboard (view)
--   8. Indexes
--   9. updated_at triggers
--   10. Seed data       : skills, sectors, leaderboard fixture
-- ============================================================================


-- 1. EXTENSIONS -------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()


-- 2. ENUMS + HELPER ---------------------------------------------------------
do $$ begin
  create type givt_participant_role as enum ('Student','Advisor','Professor','Employer','Peer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type givt_ledger_kind as enum ('account','supervise','award','transfer');
exception when duplicate_object then null; end $$;

create or replace function public.givt_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;


-- 3. LOOKUP TABLES ----------------------------------------------------------
create table if not exists public.skills (
  name        text primary key,
  aliases     text[]      not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.sectors (
  name        text primary key,
  sort_order  integer,
  created_at  timestamptz not null default now()
);


-- 4. AUTH + IDENTITY --------------------------------------------------------

-- Application user (login identity). Passwords are bcrypt hashes, set by the API.
create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- One GIVT participant per app_user.
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.app_users(id) on delete cascade,
  role            givt_participant_role not null,
  full_name       text not null,
  hedera_address  text check (hedera_address is null or hedera_address ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  profile         text,
  token_balance   integer not null default 0 check (token_balance   >= 0),
  verifier_points integer not null default 0 check (verifier_points >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Append-only audit log of token movements.
create table if not exists public.token_ledger (
  id           uuid primary key default gen_random_uuid(),
  kind         givt_ledger_kind not null,
  amount       integer not null check (amount > 0),
  from_party   text,
  to_party     text,
  from_account uuid references public.accounts(id) on delete set null,
  to_account   uuid references public.accounts(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);


-- 5. WORKSPACE --------------------------------------------------------------
create table if not exists public.sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.app_users(id) on delete cascade,
  account_id       uuid references public.accounts(id) on delete set null,
  title            text not null default 'Untitled session',
  resume_text      text,
  jd_text          text,
  detected_company text,
  resume_company   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.session_files (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid not null references public.app_users(id) on delete cascade,
  kind        text not null check (kind in ('resume','jd','open_jd','profile')),
  name        text not null,
  words       integer       check (words   >= 0),
  size_kb     numeric(10,2) check (size_kb >= 0),
  url         text,
  created_at  timestamptz not null default now()
);


-- 6. AGENT OUTPUTS ----------------------------------------------------------

-- 01 · Translator
create table if not exists public.translator_outputs (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions(id) on delete cascade,
  user_id           uuid not null references public.app_users(id) on delete cascade,
  resume_skills     text[] not null default '{}',
  jd_skills         text[] not null default '{}',
  gaps              text[] not null default '{}',
  met               text[] not null default '{}',
  translated_resume text,
  jd_role           text,
  examples          jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

-- 02 · Talent
create table if not exists public.talent_profiles (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  user_id       uuid not null references public.app_users(id) on delete cascade,
  company_name  text,
  profile_text  text,
  locked        boolean not null default false,
  use_cases     jsonb not null default '[]'::jsonb,
  talent_demand jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 03 · Curriculum
create table if not exists public.curriculum_plans (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions(id) on delete cascade,
  user_id           uuid not null references public.app_users(id) on delete cascade,
  catalog_text      text,
  enhanced_courses  jsonb not null default '[]'::jsonb,
  future_curriculum jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 04 · Advisor — syllabi (≤15 training hrs)
create table if not exists public.syllabi (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  user_id         uuid not null references public.app_users(id) on delete cascade,
  syllabus_index  integer not null check (syllabus_index >= 0),
  title           text not null,
  credit_hours    integer check (credit_hours   >= 0),
  training_hours  integer check (training_hours >= 0 and training_hours <= 15),
  objectives      jsonb not null default '[]'::jsonb,
  outcomes        jsonb not null default '[]'::jsonb,
  gaps_addressed  jsonb not null default '[]'::jsonb,
  weekly_schedule jsonb not null default '[]'::jsonb,
  tasks           jsonb not null default '[]'::jsonb,
  assessment      text,
  created_at      timestamptz not null default now(),
  unique (session_id, syllabus_index)
);

-- 04 · Advisor — supervision (+900 professor)
create table if not exists public.supervision (
  id                   uuid primary key default gen_random_uuid(),
  syllabus_id          uuid references public.syllabi(id)  on delete cascade,
  session_id           uuid references public.sessions(id) on delete cascade,
  syllabus_index       integer,
  professor_account_id uuid references public.accounts(id) on delete set null,
  tokens_awarded       integer not null default 900 check (tokens_awarded >= 0),
  note                 text,
  created_at           timestamptz not null default now(),
  unique (syllabus_id, professor_account_id)
);

-- 05 · Reputation — one verification per role per skill
create table if not exists public.skill_verifications (
  id                      uuid primary key default gen_random_uuid(),
  session_id              uuid references public.sessions(id) on delete cascade,
  student_account_id      uuid references public.accounts(id) on delete set null,
  skill_name              text not null references public.skills(name) on update cascade,
  verifier_role           givt_participant_role not null check (verifier_role <> 'Student'),
  verifier_account_id     uuid references public.accounts(id) on delete set null,
  confidence              smallint not null check (confidence in (1, 2)),
  comment                 text,
  hedera_address          text check (hedera_address is null or hedera_address ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  student_tokens_awarded  integer not null default 100 check (student_tokens_awarded  >= 0),
  verifier_points_awarded integer not null default 500 check (verifier_points_awarded >= 0),
  created_at              timestamptz not null default now(),
  unique (session_id, skill_name, verifier_role)
);

-- 06/07 · Generator + Discriminator GAN loop
create table if not exists public.gan_runs (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid references public.sessions(id) on delete cascade,
  user_id            uuid not null references public.app_users(id) on delete cascade,
  sector             text,
  seed_modules       jsonb not null default '[]'::jsonb,
  recommendation_doc text,
  guideline_doc      text,
  published          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.gan_loops (
  id                uuid primary key default gen_random_uuid(),
  gan_run_id        uuid not null references public.gan_runs(id) on delete cascade,
  user_id           uuid not null references public.app_users(id) on delete cascade,
  loop_number       integer not null check (loop_number >= 1),
  mean_coverage     numeric(5,2) check (mean_coverage >= 0 and mean_coverage <= 100),
  flags_count       integer not null default 0 check (flags_count >= 0),
  equilibrium_ready boolean not null default false,
  step1             jsonb not null default '{}'::jsonb,
  critique          jsonb not null default '{}'::jsonb,
  step3             jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  unique (gan_run_id, loop_number)
);


-- 7. REPUTATION + LEADERBOARD ----------------------------------------------
create table if not exists public.reputation_scores (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid references public.accounts(id) on delete cascade,
  display_name        text,
  reputation          integer not null default 0 check (reputation          between 0 and 100),
  verification_status integer not null default 0 check (verification_status between 0 and 100),
  composite           integer not null default 0 check (composite           between 0 and 100),
  level               text check (level in ('L1','L2','L3','L4','L5','L6')),
  is_fixture          boolean not null default false,
  updated_at          timestamptz not null default now(),
  unique (account_id)
);

create or replace view public.leaderboard as
select
  coalesce(a.full_name, rs.display_name) as name,
  rs.reputation,
  rs.verification_status,
  rs.composite,
  rs.level,
  rs.is_fixture,
  rs.account_id
from public.reputation_scores rs
left join public.accounts a on a.id = rs.account_id
order by rs.composite desc, rs.reputation desc, name asc;


-- 8. INDEXES ----------------------------------------------------------------
create index if not exists idx_accounts_user        on public.accounts(user_id);
create index if not exists idx_accounts_role        on public.accounts(role);
create index if not exists idx_ledger_created       on public.token_ledger(created_at desc);
create index if not exists idx_ledger_kind          on public.token_ledger(kind);
create index if not exists idx_ledger_from          on public.token_ledger(from_account);
create index if not exists idx_ledger_to            on public.token_ledger(to_account);
create index if not exists idx_sessions_user        on public.sessions(user_id);
create index if not exists idx_sessions_account     on public.sessions(account_id);
create index if not exists idx_session_files_sess   on public.session_files(session_id);
create index if not exists idx_translator_session   on public.translator_outputs(session_id);
create index if not exists idx_talent_session       on public.talent_profiles(session_id);
create index if not exists idx_curriculum_session   on public.curriculum_plans(session_id);
create index if not exists idx_syllabi_session      on public.syllabi(session_id);
create index if not exists idx_supervision_prof     on public.supervision(professor_account_id);
create index if not exists idx_supervision_syllabus on public.supervision(syllabus_id);
create index if not exists idx_verif_session        on public.skill_verifications(session_id);
create index if not exists idx_verif_student        on public.skill_verifications(student_account_id);
create index if not exists idx_verif_skill          on public.skill_verifications(skill_name);
create index if not exists idx_verif_verifier       on public.skill_verifications(verifier_account_id);
create index if not exists idx_gan_runs_session     on public.gan_runs(session_id);
create index if not exists idx_gan_loops_run        on public.gan_loops(gan_run_id);
create index if not exists idx_scores_composite     on public.reputation_scores(composite desc);
create unique index if not exists uq_scores_fixture_name
  on public.reputation_scores(display_name) where is_fixture;


-- 9. updated_at TRIGGERS ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','sessions','talent_profiles','curriculum_plans',
    'gan_runs','reputation_scores'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.givt_set_updated_at();', t);
  end loop;
end $$;


-- 10. SEED DATA -------------------------------------------------------------

insert into public.sectors (name, sort_order) values
  ('Healthcare & HealthTech',            1),
  ('FinTech & Decentralized Finance',    2),
  ('Banking & Financial Services',       3),
  ('Transportation & Smart Mobility',    4),
  ('Media & Entertainment',              5),
  ('Sports & SportsTech',                6),
  ('STEM & Advanced Technology',         7),
  ('Sustainability & CleanTech',         8),
  ('Manufacturing',                      9),
  ('E-commerce & Digital Economy',      10),
  ('EdTech & Digital Education',        11),
  ('Other',                             12)
on conflict (name) do nothing;

insert into public.skills (name, aliases) values
  ('Python', '{}'), ('R', '{}'), ('SQL', '{}'), ('Java', '{}'), ('JavaScript', '{}'),
  ('Machine Learning', '{ML}'), ('Deep Learning', '{DL}'), ('Data Analysis', '{}'),
  ('Data Visualization', '{dashboards}'), ('Statistics', '{}'),
  ('HL7', '{}'), ('FHIR', '{}'), ('HIPAA', '{}'),
  ('EHR/EMR', '{EHR,EMR,"electronic health record"}'),
  ('Epic', '{}'), ('Cerner', '{}'), ('Clinical Informatics', '{}'),
  ('Health Information Management', '{HIM}'), ('Project Management', '{}'),
  ('Agile/Scrum', '{Agile,Scrum}'), ('Cloud', '{AWS,Azure,GCP}'), ('ETL', '{}'),
  ('Data Governance', '{}'), ('Cybersecurity', '{}'), ('NLP', '{"natural language processing"}'),
  ('Excel', '{}'), ('Power BI', '{PowerBI}'), ('Tableau', '{}'),
  ('Communication', '{}'), ('Leadership', '{}'), ('Interoperability', '{}'),
  ('Regulatory Compliance', '{}'), ('Databases', '{database}'), ('Version Control', '{Git}')
on conflict (name) do nothing;

insert into public.reputation_scores (display_name, reputation, verification_status, composite, level, is_fixture) values
  ('Maya Osei',    91, 91, 91, 'L1', true),
  ('Jordan Liu',   87, 87, 87, 'L1', true),
  ('Aisha Patel',  83, 83, 83, 'L1', true),
  ('Devon Marsh',  78, 78, 78, 'L1', true),
  ('Riley Tanaka', 74, 74, 74, 'L1', true)
on conflict (display_name) where is_fixture do nothing;

-- Done. Standard PostgreSQL — runs locally and on Supabase unchanged.
