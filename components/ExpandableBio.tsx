'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The same eight-line description as the directory card, and "More…" here
 * opens the rest in place rather than going anywhere.
 *
 * "More…" only appears when the text is actually cut off — measured in the
 * browser, since how many words fit in eight lines depends on the screen.
 */
export default function ExpandableBio({ text }: { text: string; name?: string }) {
  const [open, setOpen] = useState(false);
  // A guess for the first paint; corrected by measuring below.
  const [clipped, setClipped] = useState(text.length > 600);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, open]);

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  if (open) {
    return (
      <div className="biowrap">
        {paragraphs.map((p, i) => <p className="plede" key={i}>{p}</p>)}
        <button type="button" className="biomore" onClick={() => setOpen(false)}>Show less</button>
      </div>
    );
  }

  return (
    <div className="biowrap">
      <p ref={ref} className="plede clamp8">{paragraphs.join(' ')}</p>
      {clipped && (
        <button type="button" className="biomore" onClick={() => setOpen(true)}>More…</button>
      )}
    </div>
  );
}
