'use client';

import { useState } from 'react';
import type { FieldErrors } from '../src/leads/consultRequest.ts';

export default function ConsultForm({
  professionalId, firstName, sourcePath, hadScheduler,
}: {
  professionalId: string; firstName: string; sourcePath: string; hadScheduler: boolean;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true); setFailed(null); setErrors({});
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, professionalId, sourcePath }),
      });
      const body = await res.json();
      if (res.ok) setSent(true);
      else if (body.errors) setErrors(body.errors);
      else setFailed(body.message ?? 'Something went wrong. Please try again.');
    } catch {
      setFailed('We could not send that. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="formwrap">
        <h1>Thank you — that’s on its way.</h1>
        <p className="lede">
          {firstName} has your details and will be in touch to arrange a time.
          If you haven’t heard back within a couple of days, we’ll check in with them.
        </p>
        <a className="prof" href={sourcePath}>← Back to the directory</a>
      </div>
    );
  }

  return (
    <form className="formwrap" onSubmit={onSubmit} noValidate>
      <h1>Ask {firstName} for a time</h1>
      <p className="lede">
        {hadScheduler
          ? <>Nothing on the calendar suited you — that’s common. Leave your details and {firstName} will
             find a time that does.</>
          : <>{firstName} arranges consultations directly. Leave your details and they’ll be in touch.</>}
      </p>

      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="name" required />
        {errors.name && <div className="err">{errors.name}</div>}
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        {errors.email && <div className="err">{errors.email}</div>}
      </div>

      <div className="field">
        <label htmlFor="phone">Phone <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" />
        {errors.phone && <div className="err">{errors.phone}</div>}
      </div>

      <div className="field">
        <label htmlFor="message">
          Anything you’d like them to know <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span>
        </label>
        <textarea id="message" name="message" rows={4} />
        <div className="hint">
          Please don’t include anything you wouldn’t want in an email — this is sent to {firstName} directly.
        </div>
        {errors.message && <div className="err">{errors.message}</div>}
      </div>

      {failed && <div className="err" style={{ marginBottom: 10 }}>{failed}</div>}

      <button className="submit" type="submit" disabled={sending}>
        {sending ? 'Sending…' : `Send to ${firstName}`}
      </button>

      <p className="privacy">
        Your details go to {firstName} and to Vesta’s concierge team, who will follow up if you
        don’t hear back. We don’t sell your information.
      </p>
    </form>
  );
}
