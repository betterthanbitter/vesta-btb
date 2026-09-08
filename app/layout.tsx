import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Vesta — Find a Divorce Professional',
  description: 'Interviewed and vetted divorce professionals, by city and speciality.',
};

const SCREENS = [
  { href: '/', label: '1 · Directory' },
  { href: '/profile', label: '2 · Public profile' },
  { href: '/hub/leads', label: '3 · Lead dashboard' },
  { href: '/central', label: '4 · Central content hub' },
  { href: '/hub/content', label: '5 · Professional content hub' },
  { href: '/admin', label: '6 · Back office' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="buildbar">
          <div className="in">
            <b>Vesta build</b>
            <nav>
              {SCREENS.map((s) => (
                <a key={s.href} href={s.href}>{s.label}</a>
              ))}
            </nav>
            <span className="spacer" />
            <span style={{ color: '#9892ad' }}>real data · 38 professionals</span>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
