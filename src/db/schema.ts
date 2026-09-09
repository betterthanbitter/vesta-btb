/**
 * The database schema, as a string rather than a .sql file.
 *
 * It was a file, briefly. Reading it at runtime broke under Next's bundler,
 * which replaces the global URL, and would have broken again in a serverless
 * bundle that did not include the file. A module has neither problem: it is
 * traced, bundled and type-checked like any other import.
 *
 * Written in the intersection of SQLite and Postgres so one definition serves
 * both — TEXT and INTEGER only, ids generated in the application, times stored
 * as ISO-8601 strings which sort correctly as text in both engines.
 */
export const SCHEMA_SQL = `
-- Vesta / BTB schema.
--
-- Written in the intersection of SQLite and Postgres so one file serves both:
-- SQLite for local development and the test suite, Postgres in production.
-- That means TEXT and INTEGER only, no SERIAL, no native timestamps — ids are
-- generated in the application and times are stored as ISO-8601 strings, which
-- sort correctly as text in both engines.

CREATE TABLE IF NOT EXISTS consumers (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL DEFAULT '',
  hub              TEXT NOT NULL,
  category_needed  TEXT NOT NULL,
  stage_of_divorce TEXT,
  created_at       TEXT NOT NULL
);
-- One consumer per email. Two rows for the same person means two contacts in
-- the CRM and two sequences chasing them.
CREATE UNIQUE INDEX IF NOT EXISTS consumers_email ON consumers (email);

CREATE TABLE IF NOT EXISTS referrals (
  id           TEXT PRIMARY KEY,
  consumer_id  TEXT NOT NULL REFERENCES consumers (id),
  hub          TEXT NOT NULL,
  category     TEXT NOT NULL,
  mode         TEXT NOT NULL,
  routed_at    TEXT NOT NULL,
  closed_at    TEXT,
  -- What the consumer wrote in the form, if anything.
  message      TEXT
);
CREATE INDEX IF NOT EXISTS referrals_consumer ON referrals (consumer_id);

CREATE TABLE IF NOT EXISTS referral_assignments (
  referral_id      TEXT NOT NULL REFERENCES referrals (id),
  professional_id  TEXT NOT NULL,
  stage            TEXT NOT NULL,
  stage_changed_at TEXT NOT NULL,
  PRIMARY KEY (referral_id, professional_id)
);
-- The lead dashboard reads by professional; the cold sweep reads by staleness.
CREATE INDEX IF NOT EXISTS assignments_professional
  ON referral_assignments (professional_id, stage_changed_at);

-- Intents waiting to reach the delivery engine.
CREATE TABLE IF NOT EXISTS outbox (
  dedup_key     TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  payload       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  dispatched_at TEXT
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox (dispatched_at, created_at);

-- What has already been sent.
--
-- This table IS the no-double-send guarantee. While the ledger lived in memory
-- the guarantee lasted until the next restart or the next serverless cold
-- start — which on Netlify is minutes. A unique primary key here is what makes
-- it real: two concurrent workers cannot both claim the same key.
CREATE TABLE IF NOT EXISTS sent_ledger (
  key        TEXT PRIMARY KEY,
  state      TEXT NOT NULL,     -- claimed | confirmed | needs_review
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_review ON sent_ledger (state);

-- Someone clicked through to a professional's own scheduler.
CREATE TABLE IF NOT EXISTS consult_intents (
  id               TEXT PRIMARY KEY,
  professional_id  TEXT NOT NULL,
  source_path      TEXT NOT NULL,
  destination_host TEXT NOT NULL,
  visitor_key      TEXT NOT NULL,
  at               TEXT NOT NULL
);
-- Supports both the dashboard read and the dedup check.
CREATE INDEX IF NOT EXISTS intents_professional ON consult_intents (professional_id, at);
CREATE INDEX IF NOT EXISTS intents_dedup ON consult_intents (professional_id, visitor_key, at);

-- Someone filled in the form, so we have contact details.
CREATE TABLE IF NOT EXISTS consult_requests (
  id              TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  message         TEXT,
  source_path     TEXT NOT NULL,
  at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_professional ON consult_requests (professional_id, at);
`;
