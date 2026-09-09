'use client';

import { useMemo, useState } from 'react';
import { routeLead } from '../app/actions.ts';

export interface ProOption {
  id: string; label: string; hub: string; hubLabel: string;
  category: string; categoryLabel: string; tier: string;
}

/**
 * The concierge takes a call and routes it.
 *
 * Shortlisting several professionals is the normal case — the consumer picks.
 * One is a direct introduction. The distinction is recorded on the referral,
 * because the follow-up differs.
 */
export default function RouteLeadForm({
  professionals, hubs,
}: { professionals: ProOption[]; hubs: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [hub, setHub] = useState('');
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const shown = useMemo(
    () => professionals.filter(
      (p) => (!hub || p.hub === hub) && (!category || p.category === category),
    ),
    [professionals, hub, category],
  );
  const categories = useMemo(
    () => [...new Map(professionals.map((p) => [p.category, p.categoryLabel])).entries()],
    [professionals],
  );

  if (!open) {
    return (
      <button className="prof" onClick={() => setOpen(true)} style={{ marginBottom: 8 }}>
        + Take a call and route it
      </button>
    );
  }

  return (
    <form action={routeLead} className="routeform">
      <h2>New lead from the concierge desk</h2>

      <div className="row">
        <div className="field">
          <label htmlFor="name">Their name</label>
          <input id="name" name="name" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
      </div>

      <div className="field">
        <label htmlFor="stageOfDivorce">Where they are</label>
        <input id="stageOfDivorce" name="stageOfDivorce"
          placeholder="Considering · Filed · Post-decree" />
      </div>

      <div className="field">
        <label htmlFor="notes">What they said</label>
        <textarea id="notes" name="notes" rows={3}
          placeholder="The context the professional needs before calling." />
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="fhub">Filter by location</label>
          <select id="fhub" value={hub} onChange={(e) => setHub(e.target.value)}>
            <option value="">Anywhere</option>
            {hubs.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fcat">Filter by speciality</label>
          <select id="fcat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Any</option>
            {categories.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Send to — tick as many as they should choose from</label>
        <div className="prolist">
          {shown.length === 0 && <div className="none">Nobody matches that filter.</div>}
          {shown.map((p) => (
            <label key={p.id} className="prorow">
              <input
                type="checkbox" name="professionalId" value={p.id}
                checked={picked.includes(p.id)}
                onChange={(e) => setPicked(
                  e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id),
                )}
              />
              <span className="proname">{p.label}</span>
              <span className="prometa">{p.hubLabel} · {p.categoryLabel}</span>
              <span className={`tierbadge t-${p.tier}`} style={{ background: 'var(--soft)',
                color: 'var(--acc2)', borderColor: 'var(--br)' }}>{p.tier}</span>
            </label>
          ))}
        </div>
        <div className="hint">
          {picked.length === 0 && 'Pick at least one.'}
          {picked.length === 1 && 'One professional — a direct introduction.'}
          {picked.length > 1 && `${picked.length} professionals — the consumer chooses.`}
        </div>
      </div>

      <div className="row">
        <button className="submit" type="submit" disabled={picked.length === 0}>
          Route to {picked.length || 'no one'} professional{picked.length === 1 ? '' : 's'}
        </button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
