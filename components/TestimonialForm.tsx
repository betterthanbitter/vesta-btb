'use client';

import { useState } from 'react';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * The testimonial form a hired client reaches from their email.
 *
 * Publication is a box the client ticks, not one they have to find and
 * untick: this is someone's divorce, and a testimonial appearing that they
 * did not expect to be public is not something an apology fixes.
 */
export default function TestimonialForm({
  token, first, names,
}: {
  token: string;
  first: string;
  /** Worked out on the server, so the client sees exactly what will be shown. */
  names: { initial: string; first: string };
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [sent, setSent] = useState<null | 'public' | 'private'>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true); setErrors({});
    const form = new FormData(e.currentTarget);
    const publish = form.get('publish') === 'yes';
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token, rating, publish,
          liked: form.get('liked'),
          displayAs: form.get('displayAs'),
        }),
      });
      const body = await res.json();
      if (res.ok) setSent(publish ? 'public' : 'private');
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
        <h3>Thank you.</h3>
        <p>
          {sent === 'public'
            ? `Vesta reads every testimonial before it appears on ${first}’s profile. Yours will be there once it has been approved.`
            : 'Only Vesta will see what you wrote. It helps us make sure the professionals we recommend look after people well.'}
        </p>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <form className="capture" onSubmit={onSubmit} noValidate>
      <h3>How was working with {first}?</h3>
      <p className="capintro">
        You hired {first} through Vesta. A few honest words from you help the next person decide
        whether to call.
      </p>

      {errors._ && <div className="err">{errors._}</div>}

      <div className="field">
        <label id="rate-label">Your rating</label>
        <div className="starrow">
          <div
            className="starpick" role="radiogroup" aria-labelledby="rate-label"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n} type="button" role="radio" aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className={shown >= n ? 'on' : undefined}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
              >
                ★
              </button>
            ))}
          </div>
          {shown > 0 && <span className="starword">{WORDS[shown]}</span>}
        </div>
        {errors.rating && <div className="err">{errors.rating}</div>}
      </div>

      <div className="field">
        <label htmlFor="rev-liked">What did you particularly like about working with {first}?</label>
        <textarea id="rev-liked" name="liked" rows={5} maxLength={1500} />
        <div className="hint">
          What would be helpful for someone considering hiring them? Please leave out other
          people’s names and the details of your case.
        </div>
        {errors.liked && <div className="err">{errors.liked}</div>}
      </div>

      <fieldset>
        <legend>How should your name appear?</legend>
        <label className="choice">
          <input type="radio" name="displayAs" value="initial" defaultChecked /> {names.initial}
        </label>
        <label className="choice">
          <input type="radio" name="displayAs" value="first" /> {names.first}
        </label>
        <label className="choice">
          <input type="radio" name="displayAs" value="anonymous" /> Anonymous — “A Vesta client”
        </label>
      </fieldset>

      <label className="choice consent">
        <input type="checkbox" name="publish" value="yes" />
        <span>
          Vesta may publish this on {first}’s public profile.
          <span className="hint">Leave this unticked and only Vesta will see what you wrote.</span>
        </span>
      </label>

      <button className="prof big" type="submit" disabled={sending}>
        {sending ? 'Sending…' : 'Send my testimonial'}
      </button>
      <p className="capfoot">
        Your email address is never shown. Vesta reads every testimonial before it is published.
      </p>
    </form>
  );
}
