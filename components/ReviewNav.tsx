const SCREENS = [
  { href: '/', label: '1 · Directory' },
  { href: '/profile', label: '2 · Public profile' },
  { href: '/hub/leads', label: '3 · Lead dashboard' },
  { href: '/central', label: '4 · Central content hub' },
  { href: '/hub/content', label: '5 · Professional content hub' },
  { href: '/admin', label: '6 · Back office' },
];

/**
 * Internal screen switcher. Off unless REVIEW_NAV=1, because it is scaffolding
 * for reviewing the build, not something a consumer should ever see.
 */
export default function ReviewNav() {
  if (process.env.REVIEW_NAV !== '1') return null;
  return (
    <div className="buildbar">
      <div className="in">
        <b>Internal — review only</b>
        <nav>
          {SCREENS.map((s) => <a key={s.href} href={s.href}>{s.label}</a>)}
        </nav>
        <span className="sp" />
        <a href="/internal" style={{ color: '#9892ad', fontSize: 12.2 }}>Review index →</a>
      </div>
    </div>
  );
}
