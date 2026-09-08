import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  type ConsultIntent, type ConsultIntentStore, MemoryConsultIntentStore,
} from './consultIntent.ts';

/**
 * Where consult intents are kept.
 *
 * A file, for now, so the lead dashboard has something real to read while it
 * is being built. THIS DOES NOT SURVIVE A DEPLOY on Netlify or any other
 * serverless host — each request may run on a fresh filesystem, so writes are
 * lost. It is a development stand-in and nothing more; the first thing the
 * lead dashboard needs is a real database behind this same interface.
 */
class FileConsultIntentStore implements ConsultIntentStore {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
  }

  private readAll(): ConsultIntent[] {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try { return [JSON.parse(line) as ConsultIntent]; } catch { return []; }
      });
  }

  async record(intent: ConsultIntent): Promise<void> {
    appendFileSync(this.path, JSON.stringify(intent) + '\n', 'utf8');
  }

  async forProfessional(professionalId: string): Promise<ConsultIntent[]> {
    return this.readAll()
      .filter((r) => r.professionalId === professionalId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  async recentlySeen(professionalId: string, visitorKey: string, withinMs: number): Promise<boolean> {
    const cutoff = Date.now() - withinMs;
    return this.readAll().some(
      (r) => r.professionalId === professionalId
        && r.visitorKey === visitorKey
        && Date.parse(r.at) >= cutoff,
    );
  }
}

let instance: ConsultIntentStore | null = null;

export function getConsultIntentStore(): ConsultIntentStore {
  if (instance) return instance;
  instance = process.env.NETLIFY
    // Nothing durable available yet on the host; keep it in memory so the
    // redirect still works and no consumer is blocked.
    ? new MemoryConsultIntentStore()
    : new FileConsultIntentStore(join(process.cwd(), 'data', 'consult-intents.jsonl'));
  return instance;
}
