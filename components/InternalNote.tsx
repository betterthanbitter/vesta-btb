import type { ReactNode } from 'react';

/**
 * Wraps anything that is for us and not for a consumer — data-quality
 * warnings, SEO diagnostics, notes about the state of the build.
 *
 * Renders only when REVIEW_NAV=1. Anything a consumer must never read goes
 * inside one of these rather than being written straight onto the page.
 */
export default function InternalNote({
  children, tone = 'note',
}: { children: ReactNode; tone?: 'note' | 'warn' }) {
  if (process.env.REVIEW_NAV !== '1') return null;
  return (
    <div
      className="notice"
      style={tone === 'warn'
        ? { borderColor: '#e3b8b8', background: '#fdf2f2', color: '#7a2f2f' }
        : undefined}
    >
      <span style={{
        display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
        textTransform: 'uppercase', opacity: .65, marginRight: 8,
      }}>Internal</span>
      {children}
    </div>
  );
}
