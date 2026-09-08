'use client';

import { useEffect, useState } from 'react';

/**
 * The two paths a consumer can take to reach a professional.
 *
 *  - The professional has a scheduler: send them there. If they come back
 *    without having found a time, offer the form.
 *  - No scheduler: the form is the only path, and it is the primary button.
 *
 * The "came back" detection is deliberately soft. We cannot know whether they
 * booked — that happened on someone else's site — so the prompt asks rather
 * than asserts, and never nags: it appears once and can be dismissed.
 */
export default function ConsultCta({
  professionalId, firstName, schedulerHost, sourcePath, variant = 'ghost',
}: {
  professionalId: string;
  firstName: string;
  /** Absent when the professional has no scheduler. */
  schedulerHost?: string;
  sourcePath: string;
  variant?: 'ghost' | 'primary';
}) {
  const [wentToScheduler, setWentToScheduler] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // When the tab regains focus after they left for the scheduler, ask.
  useEffect(() => {
    if (!wentToScheduler || dismissed) return;
    const onFocus = () => setWentToScheduler(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [wentToScheduler, dismissed]);

  const formHref = `/consult/${professionalId}?from=${encodeURIComponent(sourcePath)}`;

  if (!schedulerHost) {
    return (
      <a className={variant === 'primary' ? 'prof' : 'ghost'} href={formHref}>
        Request a free consult
      </a>
    );
  }

  return (
    <>
      <a
        className={variant === 'primary' ? 'prof' : 'ghost'}
        href={`/go/consult/${professionalId}?from=${encodeURIComponent(sourcePath)}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => setWentToScheduler(true)}
      >
        Schedule free consult
        <span style={{ opacity: .6, marginLeft: 7, fontSize: 12 }}>{schedulerHost}</span>
      </a>

      {wentToScheduler && !dismissed && (
        <span className="fallback" role="status">
          Didn’t find a time that works?{' '}
          <a href={formHref}>Ask {firstName} for one →</a>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
          >×</button>
        </span>
      )}
    </>
  );
}
