'use client';

import { useState } from 'react';

/**
 * Capture first, schedule second.
 *
 * Sending someone straight to a professional's Calendly means the lead lands
 * in that professional's calendar and nowhere else: Vesta never sees it, the
 * concierge cannot follow up, and nobody can chase it if it goes cold. So
 * every profile asks for a name and an email first, and the scheduler button
 * appears once that is done.
 *
 * The ask is small on purpose — two fields and an optional message. Anything
 * longer and people leave, and a lead you did not capture is worth nothing
 * however complete the form was.
 */
export default function LeadCapture({
  professionalId, firstName, schedulerHost, sourcePath, website, phone,
}: {
  professionalId: string;
  firstName: string;
  /** Absent when the professional has no booking link. */
  schedulerHost?: string;
  sourcePath: string;
  /** Shown only after the form is sent — linking earlier loses the lead. */
  website?: string;
  phone?: string;
}) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true); setErrors({});
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
      else setErrors({ _: body.message ?? 'Something went wrong. Please try again.' });
    } catch {
      setErrors({ _: 'We could not send that. Check your connection and try again.' });
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="capture done">
        <h3>{firstName} has your details.</h3>
        {schedulerHost ? (
          <>
            <p>
              {firstName} offers instant booking — pick a time now, or wait to be contacted.
              Either works; we have your details either way.
            </p>
            <a
              className="prof big"
              href={`/go/consult/${professionalId}?from=${encodeURIComponent(sourcePath)}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Instant Book
              <span className="host">{schedulerHost}</span>
            </a>
          </>
        ) : (
          <p>
            {firstName} will be in touch to arrange a time. If you have not heard back within a
            couple of days, Vesta’s concierge team will check in with them.
          </p>
        )}
        {(website || phone) && (
          <div className="capafter">
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer nofollow">
                Visit {firstName}’s website →
              </a>
            )}
            {phone && <a href={`tel:${phone}`}>Call {phone}</a>}
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="capture" onSubmit={onSubmit} noValidate>
      <h3>Schedule a free consult with {firstName}</h3>
      <p className="capintro">
        Leave your details and {firstName} will be in touch.
        {schedulerHost && ' If you would rather pick a time yourself, you can do that on the next step.'}
      </p>

      {errors._ && <div className="err">{errors._}</div>}

      <div className="caprow">
        <div className="field">
          <label htmlFor="cap-name">Your name</label>
          <input id="cap-name" name="name" autoComplete="name" required />
          {errors.name && <div className="err">{errors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="cap-email">Email</label>
          <input id="cap-email" name="email" type="email" autoComplete="email" required />
          {errors.email && <div className="err">{errors.email}</div>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="cap-phone">
          Phone <span className="opt">optional</span>
        </label>
        <input id="cap-phone" name="phone" type="tel" autoComplete="tel" />
      </div>

      <div className="field">
        <label htmlFor="cap-message">
          Anything you would like them to know <span className="opt">optional</span>
        </label>
        <textarea id="cap-message" name="message" rows={3} />
        <div className="hint">
          Please do not include anything you would not want in an email — this is sent to
          {' '}{firstName} directly.
        </div>
        {errors.message && <div className="err">{errors.message}</div>}
      </div>

      <button className="prof big" type="submit" disabled={sending}>
        {sending ? 'Sending…' : 'Request my free consult'}
      </button>
      <p className="capfoot">
        Your details go to {firstName} and to Vesta’s concierge team, who follow up if you do not
        hear back. We do not sell your information.
      </p>
    </form>
  );
}
