/**
 * Additive column migration.
 *
 * `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists, so
 * every column added to the schema after a database was first created is
 * simply absent there. Locally that is invisible, because the file is deleted
 * constantly. In production it shows up as a 503 the first time someone uses
 * the feature — which is exactly how this was found: a consumer typing a
 * message into the consult form and being told "we could not save that".
 *
 * The expected columns are parsed out of the schema itself rather than kept in
 * a second list, so the two cannot drift.
 */

import type { Db } from './client.ts';
import { SCHEMA_SQL } from './schema.ts';

export interface ColumnSpec {
  table: string;
  name: string;
  /** The type and modifiers exactly as written in the schema. */
  definition: string;
}

/** Pull every table's columns out of the CREATE TABLE statements. */
export function expectedColumns(sql = SCHEMA_SQL): ColumnSpec[] {
  const out: ColumnSpec[] = [];
  const stripped = sql
    .split('\n')
    .map((l) => {
      const c = l.indexOf('--');
      return c === -1 ? l : l.slice(0, c);
    })
    .join('\n');

  const tableRe = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\s*\);/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(stripped)) !== null) {
    const [, table, body] = m;
    for (const line of splitTopLevel(body)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Skip table-level constraints — PRIMARY KEY (a, b), FOREIGN KEY …
      if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) continue;
      const name = trimmed.split(/\s+/)[0];
      if (!/^\w+$/.test(name)) continue;
      out.push({ table, name, definition: trimmed.slice(name.length).trim() });
    }
  }
  return out;
}

/** Split a column list on commas that are not inside brackets. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  parts.push(current);
  return parts;
}

export interface AddedColumn { table: string; name: string }

/**
 * Add any column the schema declares and the database does not have.
 *
 * Only nullable columns are added. A NOT NULL column cannot be added to a
 * table that already has rows without a default, and silently inventing one
 * would be worse than saying so — those need a hand-written migration.
 */
export async function addMissingColumns(db: Db): Promise<AddedColumn[]> {
  const wanted = expectedColumns();
  const byTable = new Map<string, ColumnSpec[]>();
  for (const c of wanted) {
    byTable.set(c.table, [...(byTable.get(c.table) ?? []), c]);
  }

  const added: AddedColumn[] = [];
  for (const [table, specs] of byTable) {
    const existing = new Set((await db.tableColumns(table)).map((c) => c.toLowerCase()));
    // A table that does not exist yet was just created by the schema run; if
    // introspection still shows nothing, there is nothing to add to.
    if (existing.size === 0) continue;

    for (const spec of specs) {
      if (existing.has(spec.name.toLowerCase())) continue;

      if (/\bNOT NULL\b/i.test(spec.definition) && !/\bDEFAULT\b/i.test(spec.definition)) {
        console.warn(
          `[db] ${table}.${spec.name} is NOT NULL with no default and cannot be added ` +
          'to an existing table automatically. It needs a hand-written migration.',
        );
        continue;
      }

      // PRIMARY KEY cannot be added after the fact either.
      const definition = spec.definition.replace(/\bPRIMARY KEY\b/i, '').trim();
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${spec.name} ${definition}`);
      added.push({ table, name: spec.name });
    }
  }
  return added;
}
