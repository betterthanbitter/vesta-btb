import Link from 'next/link';

/**
 * The one call to action, worded the same everywhere.
 *
 * It always goes to the capture page, never straight to a professional's
 * booking link. A booking made on someone else's calendar is invisible to
 * Vesta: no lead, nothing for the concierge to follow up, nothing to chase
 * when it goes quiet. Instant booking is offered after the form instead, to
 * the professionals who have a link — so the consumer still gets the fast
 * path, one step later.
 */
export default function ScheduleCta({
  professionalId, from, variant = 'primary',
}: { professionalId: string; from: string; variant?: 'primary' | 'ghost' | 'link' }) {
  const href = `/consult/${professionalId}?from=${encodeURIComponent(from)}`;
  const className = variant === 'primary' ? 'prof' : variant === 'ghost' ? 'ghost' : 'llink';
  return <Link className={className} href={href}>Schedule Free Consult</Link>;
}
