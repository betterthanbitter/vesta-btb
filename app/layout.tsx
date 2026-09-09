import './globals.css';
import type { ReactNode } from 'react';
import ReviewNav from '../components/ReviewNav.tsx';

export const metadata = {
  title: 'Vesta — Find a Divorce Professional',
  description: 'Interviewed and vetted divorce professionals, by city and specialty.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          The screen-switcher bar is a review device, not part of the product.
          It renders only when REVIEW_NAV=1 is set in the environment, so it can
          never appear on a page a consumer sees. The review index at /internal
          is the normal way to move between screens.
        */}
        <ReviewNav />
        {children}
      </body>
    </html>
  );
}
