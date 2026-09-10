import { openDb, type Db } from '../db/index.ts';
import { SqlConsultIntentStore, SqlConsultRequestStore } from '../db/repositories.ts';
import type { ConsultIntentStore } from './consultIntent.ts';
import type { ConsultRequest } from './consultRequest.ts';

export interface ConsultRequestStore {
  record(request: ConsultRequest): Promise<void>;
  forProfessional(professionalId: string): Promise<ConsultRequest[]>;
  all(): Promise<ConsultRequest[]>;
}

/**
 * One database connection per process, reused across requests.
 *
 * Serverless instances are reused between invocations, so opening a pool once
 * and holding it is right; opening one per request exhausts the server's
 * connection limit under any real traffic.
 */
let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= openDb().then(async (db) => {
    // First boot on an empty database: bring the legacy listings across so the
    // directory has something to show. Skips anyone already present.
    const { seedLegacyProfessionals } = await import('../professionals/seed.ts');
    const { added } = await seedLegacyProfessionals(db);
    if (added) console.log(`[db] seeded ${added} legacy professionals`);

    // A database seeded before the legacy import keeps the old values unless
    // they are brought forward — which is exactly the production database.
    const { backfillLegacyProfessionals } = await import('../professionals/backfill.ts');
    const { updated } = await backfillLegacyProfessionals(db);
    if (updated) console.log(`[db] brought ${updated} legacy professionals up to date`);

    const { seedDemoProfile } = await import('../professionals/demoSeed.ts');
    if (await seedDemoProfile(db)) console.log('[db] seeded the sample profile');
    return db;
  });
  return dbPromise;
}

export async function getConsultIntentStore(): Promise<ConsultIntentStore> {
  return new SqlConsultIntentStore(await getDb());
}

export async function getConsultRequestStore(): Promise<ConsultRequestStore> {
  return new SqlConsultRequestStore(await getDb());
}
