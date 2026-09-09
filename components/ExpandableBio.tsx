'use client';

import { useState } from 'react';

/**
 * A short opening paragraph, with the rest behind "More".
 *
 * The biographies imported from the old site run to two thousand characters.
 * All of it at the top of the page pushes the content — the thing the content
 * program actually produces, and the reason a consumer stays — below the fold.
 * The words are still there for anyone who wants them, one click away.
 */
export default function ExpandableBio({ text, name }: { text: string; name: string }) {
  const [open, setOpen] = useState(false);

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const first = paragraphs[0] ?? text;
  const rest = paragraphs.slice(1);

  // Nothing to hide: one short paragraph is just a paragraph.
  if (rest.length === 0 && first.length <= 320) {
    return <p className="plede">{first}</p>;
  }

  // A single very long paragraph still needs cutting, at a sentence.
  let opening = first;
  let tail: string[] = rest;
  if (rest.length === 0) {
    const cut = findSentenceBreak(first, 300);
    opening = first.slice(0, cut).trim();
    tail = [first.slice(cut).trim()];
  }

  return (
    <div className="biowrap">
      <p className="plede">
        {opening}
        {!open && <>{' '}<button type="button" className="biomore" onClick={() => setOpen(true)}>
          More…
        </button></>}
      </p>
      {open && (
        <>
          {tail.map((p, i) => <p className="biorest" key={i}>{p}</p>)}
          <button type="button" className="biomore" onClick={() => setOpen(false)}>
            Show less
          </button>
        </>
      )}
    </div>
  );
}

/** Cut at the end of a sentence near `target`, so the break reads naturally. */
function findSentenceBreak(text: string, target: number): number {
  if (text.length <= target) return text.length;
  const window = text.slice(0, target + 120);
  const matches = [...window.matchAll(/[.!?]\s/g)];
  const best = matches.reverse().find((m) => (m.index ?? 0) >= target * 0.5);
  return best ? (best.index ?? 0) + 1 : target;
}
