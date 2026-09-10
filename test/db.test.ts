import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../src/db/index.ts';
import { toPostgresPlaceholders } from '../src/db/client.ts';

describe('the SQL placeholder rewrite for Postgres', () => {
  test('numbers placeholders in order', () => {
    assert.equal(
      toPostgresPlaceholders('INSERT INTO t (a, b) VALUES (?, ?)'),
      'INSERT INTO t (a, b) VALUES ($1, $2)',
    );
  });

  test('leaves a question mark inside a string literal alone', () => {
    // A consumer writing "Can we mediate?" in the form must not shift every
    // parameter after it by one.
    assert.equal(
      toPostgresPlaceholders("SELECT ? WHERE m = 'Can we mediate?' AND n = ?"),
      "SELECT $1 WHERE m = 'Can we mediate?' AND n = $2",
    );
  });

  test('handles an escaped quote inside a literal', () => {
    assert.equal(
      toPostgresPlaceholders("SELECT ? WHERE s = 'O''Brien? yes'"),
      "SELECT $1 WHERE s = 'O''Brien? yes'",
    );
  });
});

describe('the database layer', () => {
  test('the schema applies, and applies twice without complaint', async () => {
    const db = await openTestDb();
    const { migrate } = await import('../src/db/index.ts');
    await migrate(db); // a second boot
    const rows = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const tables = rows.map((r) => r.name).filter((n) => !n.startsWith('sqlite_'));
    assert.deepEqual(tables, [
      'consult_intents', 'consult_requests', 'consumers', 'outbox',
      'professional_photos', 'professionals', 'referral_assignments',
      'referrals', 'review_requests', 'sent_ledger', 'testimonials',
    ]);
    await db.close();
  });

  test('a failed transaction leaves nothing behind', async () => {
    const db = await openTestDb();
    await assert.rejects(async () => {
      await db.transaction(async (tx) => {
        await tx.run(
          'INSERT INTO consumers (id, email, first_name, hub, category_needed, created_at)' +
          ' VALUES (?, ?, ?, ?, ?, ?)',
          ['c1', 'a@b.co', 'A', 'boston-ma', 'family-law', '2026-09-08T00:00:00Z'],
        );
        throw new Error('something went wrong halfway');
      });
    });
    assert.equal((await db.query('SELECT * FROM consumers')).length, 0);
    await db.close();
  });

  test('two consumers cannot share an email — one person, one CRM contact', async () => {
    const db = await openTestDb();
    const insert = (id: string, email: string) => db.run(
      'INSERT INTO consumers (id, email, first_name, hub, category_needed, created_at)' +
      ' VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, 'A', 'boston-ma', 'family-law', '2026-09-08T00:00:00Z'],
    );
    await insert('c1', 'sarah@example.com');
    await assert.rejects(() => insert('c2', 'sarah@example.com'));
    await db.close();
  });

  test('an assignment cannot point at a referral that does not exist', async () => {
    const db = await openTestDb();
    await assert.rejects(() => db.run(
      'INSERT INTO referral_assignments (referral_id, professional_id, stage, stage_changed_at)' +
      ' VALUES (?, ?, ?, ?)',
      ['nope', 'marcus', 'new', '2026-09-08T00:00:00Z'],
    ), 'foreign keys must be enforced');
    await db.close();
  });
});

describe('splitting the schema into statements', () => {
  test('a semicolon inside a trailing comment does not cut a statement in half', async () => {
    const { splitStatements } = await import('../src/db/index.ts');
    const sql = `
      CREATE TABLE t (
        a TEXT,   -- comma separated; a professional may cover many
        b TEXT
      );
      CREATE INDEX i ON t (a);
    `;
    const stmts = splitStatements(sql);
    assert.equal(stmts.length, 2);
    for (const s of stmts) {
      const opens = (s.match(/\(/g) ?? []).length;
      const closes = (s.match(/\)/g) ?? []).length;
      assert.equal(opens, closes, `unbalanced brackets in: ${s}`);
    }
  });

  test('every statement in the real schema has balanced brackets', async () => {
    const { splitStatements } = await import('../src/db/index.ts');
    const { SCHEMA_SQL } = await import('../src/db/schema.ts');
    for (const s of splitStatements(SCHEMA_SQL)) {
      const opens = (s.match(/\(/g) ?? []).length;
      const closes = (s.match(/\)/g) ?? []).length;
      assert.equal(opens, closes, `unbalanced: ${s.slice(0, 80)}`);
    }
  });
});
