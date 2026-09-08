import {
  type ContactUpsert,
  type DeliveryEngine,
  DeliveryTransientError,
} from './port.ts';

interface Call {
  op: 'upsertContact' | 'setFields' | 'startSequence' | 'stopSequence';
  args: unknown;
}

/**
 * A stand-in for the delivery engine used in tests and local development.
 *
 * It records every call so tests can assert on exactly what would have been
 * sent, and it can be told to fail on demand so we can prove that a retry
 * after a network blip does not double-send.
 */
export class FakeDeliveryEngine implements DeliveryEngine {
  readonly calls: Call[] = [];
  private contacts = new Map<string, string>(); // email -> contactId
  private nextId = 1;

  /** Number of upcoming calls that should fail with a transient error. */
  failNextCalls = 0;

  private record(op: Call['op'], args: unknown): void {
    if (this.failNextCalls > 0) {
      this.failNextCalls--;
      throw new DeliveryTransientError(`simulated network failure during ${op}`);
    }
    this.calls.push({ op, args });
  }

  async upsertContact(contact: ContactUpsert): Promise<{ contactId: string }> {
    this.record('upsertContact', contact);
    let id = this.contacts.get(contact.email);
    if (!id) {
      id = `C${this.nextId++}`;
      this.contacts.set(contact.email, id);
    }
    return { contactId: id };
  }

  async setFields(contactId: string, fields: Record<string, string | number>): Promise<void> {
    this.record('setFields', { contactId, fields });
  }

  async startSequence(contactId: string, sequenceId: string): Promise<void> {
    this.record('startSequence', { contactId, sequenceId });
  }

  async stopSequence(contactId: string, sequenceId: string): Promise<void> {
    this.record('stopSequence', { contactId, sequenceId });
  }

  /* ---- test helpers ---- */

  callsOf(op: Call['op']): Call[] {
    return this.calls.filter((c) => c.op === op);
  }

  /** Every (contactId, sequenceId) pair we were asked to enrol. */
  sequenceStarts(): string[] {
    return this.callsOf('startSequence').map((c) => {
      const a = c.args as { contactId: string; sequenceId: string };
      return `${a.contactId}:${a.sequenceId}`;
    });
  }

  reset(): void {
    this.calls.length = 0;
    this.failNextCalls = 0;
  }
}
