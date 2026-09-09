'use client';

import { useState } from 'react';

export default function EnterForm({ next, wrong }: { next: string; wrong: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="gate">
      <form
        className="gatecard"
        method="POST"
        action="/api/enter"
        onSubmit={() => setBusy(true)}
      >
        <div className="gatelogo">VESTA</div>
        <h1>This preview is private</h1>
        <p>
          A work-in-progress build of the new directory. Enter the password you were given.
        </p>

        <input type="hidden" name="next" value={next} />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          required
        />
        {wrong && <div className="gateerr">That password is not right. Try again.</div>}

        <button type="submit" disabled={busy}>{busy ? 'Checking…' : 'View the preview'}</button>

        <p className="gatefoot">
          It holds real professional listings and pricing that are not public. Please don’t
          share the link or the password.
        </p>
      </form>
    </div>
  );
}
