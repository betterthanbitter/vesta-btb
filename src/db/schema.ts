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
  phone            TEXT,
  city             TEXT,
  state            TEXT,

  -- The concierge questionnaire. These are the questions Vesta already asks;
  -- field names follow the wording on the live form so the two do not drift.
  stage_of_divorce      TEXT,   -- Considering | Separated | Recently filed | Filed, not complete | Divorced
  length_of_marriage    TEXT,
  has_children          TEXT,   -- yes | no
  children_ages         TEXT,   -- comma separated bands: 1-5, 6-10, 11-17, 18-22, 23+
  home_status           TEXT,   -- own | rent | staying with family
  owns_business         TEXT,   -- yes | no
  asset_range           TEXT,
  professionals_wanted  TEXT,   -- comma separated, from the questionnaire's list
  lead_source           TEXT,   -- event code, Facebook lead ad, referral, search
  questions             TEXT,   -- what they asked at the event or on the call

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

-- Professionals.
--
-- Fed by the application form at btbresellerapplication.netlify.app, and
-- seeded from the legacy WP Store Locator export. Nothing reaches the public
-- directory until status = 'published', because every application is reviewed
-- and vetted — an approval step that must exist in the data, not only in
-- somebody's inbox.
CREATE TABLE IF NOT EXISTS professionals (
  id             TEXT PRIMARY KEY,
  status         TEXT NOT NULL,   -- applied | approved | published | declined
  tier           TEXT NOT NULL,   -- standard | premium | platinum

  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL,
  phone          TEXT,
  credentials    TEXT,            -- JD, CDFA®, CDLP — its own field at last
  company        TEXT,            -- the firm the live directory never captured
  bio            TEXT,
  photo_url      TEXT,
  website        TEXT,
  linkedin       TEXT,
  social         TEXT,
  social_channel TEXT,

  street         TEXT,
  city           TEXT,
  state          TEXT,
  zip            TEXT,
  hub            TEXT,            -- derived from city + state
  states_licensed TEXT,           -- comma separated; a professional may cover many

  occupation     TEXT,            -- as chosen on the application
  category       TEXT NOT NULL,   -- the consumer-facing category it rolls up to
  -- Finer than either: an attorney who also mediates ticks across groups.
  specialties      TEXT,
  specialty_other  TEXT,

  -- Where the application came from, and what it was for.
  signup_path    TEXT,            -- reseller | direct
  partner_name   TEXT,            -- the reseller who placed them, for commission
  program        TEXT,            -- PAC.MP | CCMP
  group_slots    TEXT,            -- CCMP: the three timeslots offered
  group_timezone TEXT,
  -- Affiliate program, from the same application. A professional who also
  -- recommends the consumer products earns on them; keeping it on one form
  -- means they are not asked for their name twice.
  affiliate_optin TEXT,
  paypal_email    TEXT,
  channel_type    TEXT,
  channel_url     TEXT,
  audience        TEXT,

  scheduler_url  TEXT,

  -- One line for the top of their profile, in their own words.
  headline       TEXT,
  -- Social channels as JSON: the list changes, nothing queries inside it, and
  -- a migration per network would be churn.
  social_links   TEXT,
  -- The old vestadivorce.com page this professional's copy came from. Never
  -- linked to; kept so a redirect map can send that URL to the new profile.
  legacy_url     TEXT,
  -- The content that makes a profile worth reading: answered questions, a
  -- quote, the library, the story. Produced by PAC.MP and stored as JSON
  -- because the shape is editorial and will keep changing; nothing queries
  -- inside it, so a column per field would be churn for nothing.
  profile_content TEXT,

  applied_at     TEXT,
  published_at   TEXT,
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS professionals_email ON professionals (email);
CREATE INDEX IF NOT EXISTS professionals_listing ON professionals (status, hub, category);

-- Headshots, stored as bytes.
--
-- In the database rather than object storage, deliberately. At a few hundred
-- professionals and a couple of hundred kilobytes each this is tens of
-- megabytes, and it removes a whole service to configure, a second set of
-- credentials, and a class of "the image 404s" bug. Move it to Supabase
-- Storage if the directory ever runs to thousands.
CREATE TABLE IF NOT EXISTS professional_photos (
  professional_id TEXT PRIMARY KEY,
  mime            TEXT NOT NULL,
  bytes           TEXT NOT NULL,   -- base64
  byte_size       INTEGER NOT NULL,
  width           INTEGER,
  height          INTEGER,
  uploaded_at     TEXT NOT NULL
);

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
