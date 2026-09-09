import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { expectedColumns, addMissingColumns } from '../src/db/columns.ts';
import { SqliteDb } from '../src/db/sqlite.ts';
import { migrate } from '../src/db/index.ts';

describe('reading the schema', () => {
  test('finds every table', () => {
    const tables = new Set(expectedColumns().map((c) => c.table));
    for (const t of ['consumers', 'referrals', 'referral_assignments', 'outbox',
      'sent_ledger', 'consult_intents', 'consult_requests', 'professionals',
      'professional_photos']) {
      assert.ok(tables.has(t), `${t} was not found in the schema`);
    }
  });

  test('table-level constraints are not mistaken for columns', () => {
    // referral_assignments ends with PRIMARY KEY (referral_id, professional_id)
    const names = expectedColumns()
      .filter((c) => c.table === 'referral_assignments')
      .map((c) => c.name);
    assert.deepEqual(names, ['referral_id', 'professional_id', 'stage', 'stage_changed_at']);
  });

  test('a column with a bracketed type is read whole', () => {
    const sql = `CREATE TABLE IF NOT EXISTS t (
      a TEXT,
      b NUMERIC(10, 2),
      c TEXT NOT NULL DEFAULT ''
    );`;
    assert.deepEqual(expectedColumns(sql).map((c) => c.name), ['a', 'b', 'c']);
  });
});

describe('backfilling an older database', () => {
  test('columns added to the schema later are added to an existing table', async () => {
    const db = new SqliteDb(':memory:');
    // A referrals table from before `message` existed.
    await db.exec(`CREATE TABLE referrals (
      id TEXT PRIMARY KEY, consumer_id TEXT NOT NULL, hub TEXT NOT NULL,
      category TEXT NOT NULL, mode TEXT NOT NULL, routed_at TEXT NOT NULL, closed_at TEXT)`);
    await migrate(db);
    assert.ok((await db.tableColumns('referrals')).includes('message'),
      'this is the bug that made the consult form return 503 in production');
    await db.close();
  });

  test('existing rows survive the backfill', async () => {
    const db = new SqliteDb(':memory:');
    await db.exec(`CREATE TABLE referrals (
      id TEXT PRIMARY KEY, consumer_id TEXT NOT NULL, hub TEXT NOT NULL,
      category TEXT NOT NULL, mode TEXT NOT NULL, routed_at TEXT NOT NULL, closed_at TEXT)`);
    await db.run('INSERT INTO referrals VALUES (?,?,?,?,?,?,?)',
      ['R1', 'C1', 'boston-ma', 'family-law', 'direct', '2026-09-01T00:00:00Z', null]);
    await migrate(db);
    const rows = await db.query<{ id: string; message: string | null }>('SELECT * FROM referrals');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'R1');
    assert.equal(rows[0].message, null, 'the new column is null on old rows, not a failure');
    await db.close();
  });

  test('running it twice adds nothing the second time', async () => {
    const db = new SqliteDb(':memory:');
    await migrate(db);
    assert.deepEqual(await addMissingColumns(db), []);
    await db.close();
  });

  test('a fresh database needs no backfill at all', async () => {
    const db = new SqliteDb(':memory:');
    await migrate(db);
    const added = await addMissingColumns(db);
    assert.equal(added.length, 0);
    await db.close();
  });
});

describe('the professional write list', () => {
  test('every field on the record is actually persisted', async () => {
    // A field can be added to the type and to the read mapping and silently
    // left out of the write list, in which case it is accepted, discarded, and
    // reads back empty. That happened to headline and profile_content.
    const { openTestDb } = await import('../src/db/index.ts');
    const { ProfessionalRepository } = await import('../src/professionals/repository.ts');
    const db = await openTestDb();
    const repo = new ProfessionalRepository(db);

    const record = {
      status: 'published' as const, tier: 'platinum' as const,
      firstName: 'Test', lastName: 'Person', email: 'roundtrip@example.com',
      phone: '1', credentials: 'JD', company: 'Firm', bio: 'Bio',
      photoUrl: '/p.png', website: 'https://w.test', linkedin: 'li',
      social: 's', socialChannel: 'sc',
      street: 'St', city: 'Boston', state: 'MA', zip: '02108',
      hub: 'boston-ma', statesLicensed: 'MA, RI',
      occupation: 'Attorney', category: 'family-law',
      specialties: 'Divorce Mediation', specialtyOther: 'Other thing',
      signupPath: 'direct', partnerName: 'P', program: 'X',
      groupSlots: 'Tue', groupTimezone: 'ET', affiliateOptin: 'yes',
      schedulerUrl: 'https://calendly.com/x',
      headline: 'A headline',
      profileContent: '{"lede":"a lede"}',
      appliedAt: '2026-09-09T00:00:00Z',
    };
    const { id } = await repo.receiveApplication(record as any);
    const [back] = (await repo.published()).filter((p) => p.id === id);

    for (const key of Object.keys(record) as (keyof typeof record)[]) {
      if (key === 'appliedAt') continue;
      assert.equal((back as any)[key], record[key], `${key} did not survive the round trip`);
    }
    await db.close();
  });
});
