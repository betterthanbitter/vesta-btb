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
  dbPromise ??= openDb();
  return dbPromise;
}

export async function getConsultIntentStore(): Promise<ConsultIntentStore> {
  return new SqlConsultIntentStore(await getDb());
}

export async function getConsultRequestStore(): Promise<ConsultRequestStore> {
  return new SqlConsultRequestStore(await getDb());
}
