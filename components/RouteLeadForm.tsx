'use client';

import { useMemo, useState } from 'react';
import { routeLead } from '../app/actions.ts';
import {
  ASSET_RANGE, CHILDREN_AGES, HOME_STATUS, LEAD_SOURCE,
  LENGTH_OF_MARRIAGE, PROFESSIONALS_WANTED, STAGE_OF_DIVORCE,
} from '../src/leads/consumerProfile.ts';

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

      <div className="row">
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" />
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" name="city" />
        </div>
        <div className="field" style={{ maxWidth: 120 }}>
          <label htmlFor="state">State</label>
          <input id="state" name="state" maxLength={20} />
        </div>
      </div>

      <fieldset className="qgroup">
        <legend>Their situation</legend>
        <p className="qhint">
          The concierge questionnaire. Every field is optional — a half-captured lead beats one
          abandoned because a question could not be answered on the call.
        </p>

        <div className="row">
          <Select name="stageOfDivorce" label="Stage of divorce" options={STAGE_OF_DIVORCE} />
          <Select name="lengthOfMarriage" label="Length of marriage" options={LENGTH_OF_MARRIAGE} />
        </div>

        <div className="row">
          <Select name="hasChildren" label="Children" options={['Yes', 'No']} />
          <Multi name="childrenAges" label="Children’s ages" options={CHILDREN_AGES} />
        </div>

        <div className="row">
          <Select name="homeStatus" label="Home" options={HOME_STATUS} />
          <Select name="ownsBusiness" label="Owns a business" options={['Yes', 'No']} />
          <Select name="assetRange" label="Assets" options={ASSET_RANGE} />
        </div>

        <Multi name="professionalsWanted" label="Professionals they want to speak to"
          options={PROFESSIONALS_WANTED} wide />

        <div className="row">
          <Select name="leadSource" label="Where they came from" options={LEAD_SOURCE} />
        </div>

        <div className="field">
          <label htmlFor="questions">What they asked</label>
          <textarea id="questions" name="questions" rows={2}
            placeholder="Their question in their own words — this is what the professional answers." />
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="notes">Call notes for the professional</label>
        <textarea id="notes" name="notes" rows={4}
          placeholder="The context they need before picking up the phone." />
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


/** A plain dropdown with a blank first option, because nothing is required. */
function Select({
  name, label, options,
}: { name: string; label: string; options: readonly string[] }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue="">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/**
 * Tick-boxes joined into one comma-separated value.
 *
 * A hidden empty field goes first so that unticking everything clears the
 * answer rather than leaving the previous one in place.
 */
function Multi({
  name, label, options, wide,
}: { name: string; label: string; options: readonly string[]; wide?: boolean }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="field" style={wide ? undefined : { flex: 1, minWidth: 240 }}>
      <label>{label}</label>
      <input type="hidden" name={name} value={picked.join(', ')} />
      <div className={wide ? 'ticks wide' : 'ticks'}>
        {options.map((o) => (
          <label key={o} className={picked.includes(o) ? 'tick on' : 'tick'}>
            <input
              type="checkbox"
              checked={picked.includes(o)}
              onChange={(e) => setPicked(
                e.target.checked ? [...picked, o] : picked.filter((x) => x !== o),
              )}
            />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}
