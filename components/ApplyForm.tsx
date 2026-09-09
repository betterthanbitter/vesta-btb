'use client';

import { useState } from 'react';
import type { TierKey, TierSummary } from '../src/professionals/tiers.ts';

type Prices = Record<string, Record<TierKey, number>>;

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC',
  'ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function ApplyForm({
  tiers, professions, prices,
}: { tiers: TierSummary[]; professions: string[]; prices: Prices }) {
  const [profession, setProfession] = useState('');
  const [tier, setTier] = useState<TierKey | ''>('');
  const [affiliate, setAffiliate] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const priceFor = (t: TierKey) => (profession ? prices[profession]?.[t] : undefined);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true); setErrors({});
    const fd = new FormData(e.currentTarget);
    const payload = {
      ...Object.fromEntries(fd),
      profession, tier,
      statesLicensed: states.join(', '),
      affiliateOptin: affiliate ? 'on' : '',
    };
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (res.ok) setDone(true);
      else if (body.errors) {
        setErrors(body.errors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else setErrors({ _: body.message ?? 'Something went wrong.' });
    } catch {
      setErrors({ _: 'We could not send that. Check your connection and try again.' });
    } finally { setSending(false); }
  }

  if (done) {
    return (
      <div className="applywrap">
        <div className="applycard">
          <h1>Thank you — your application is with us.</h1>
          <p className="lede">
            Every professional in the Vesta network is reviewed and interviewed before they
            appear. We will be in touch within two business days, either to confirm you are in or
            to arrange a short call.
          </p>
          <p className="lede">
            <b>Nothing is charged yet.</b> If you applied for Platinum and the seat for your
            speciality in your city has already gone, we will tell you before you pay anything.
          </p>
        </div>
      </div>
    );
  }

  const Err = ({ k }: { k: string }) => errors[k] ? <div className="err">{errors[k]}</div> : null;

  return (
    <div className="applywrap">
      <form className="applycard" onSubmit={onSubmit} noValidate>
        <div className="applylogo">VESTA</div>
        <h1>Join the network.</h1>
        <p className="lede">
          Vesta is a directory of interviewed, vetted divorce professionals — and the content
          programme that puts your expertise in front of the people looking for it. Every
          application is reviewed; nothing is charged until you are accepted.
        </p>

        {errors._ && <div className="err banner">{errors._}</div>}

        <h2>1 · What you do</h2>
        <p className="hint">This sets your prices and the directory pages you appear on.</p>
        <div className="field">
          <label htmlFor="profession">Profession</label>
          <select id="profession" value={profession}
            onChange={(e) => setProfession(e.target.value)}>
            <option value="">Select your profession…</option>
            {professions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Err k="profession" />
        </div>

        <h2>2 · Choose your level</h2>
        {!profession && (
          <p className="hint">Choose your profession above and the prices will appear here.</p>
        )}
        <div className="tiers">
          {tiers.map((t) => {
            const price = priceFor(t.key);
            const chosen = tier === t.key;
            return (
              <button
                type="button"
                key={t.key}
                className={`tiercard t-${t.key}${chosen ? ' on' : ''}`}
                onClick={() => setTier(t.key)}
                aria-pressed={chosen}
              >
                <div className="tiername">{t.name}</div>
                <div className="tiertag">{t.tagline}</div>
                <div className="tierprice">
                  {price !== undefined
                    ? <><b>${price}</b><span>/month</span></>
                    : <span className="muted">choose a profession</span>}
                </div>
                <ul>{t.includes.map((i) => <li key={i}>{i}</li>)}</ul>
                {t.notIncluded && (
                  <ul className="not">{t.notIncluded.map((i) => <li key={i}>{i}</li>)}</ul>
                )}
                {t.scarcity && <p className="scarcity">{t.scarcity}</p>}
                <span className="pickme">{chosen ? '✓ Selected' : 'Choose this level'}</span>
              </button>
            );
          })}
        </div>
        <Err k="tier" />

        <h2>3 · About you</h2>
        <div className="row">
          <div className="field"><label htmlFor="firstName">First name</label>
            <input id="firstName" name="firstName" autoComplete="given-name" /><Err k="firstName" /></div>
          <div className="field"><label htmlFor="lastName">Last name</label>
            <input id="lastName" name="lastName" autoComplete="family-name" /><Err k="lastName" /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" /><Err k="email" /></div>
          <div className="field"><label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" />
            <div className="hint">The concierge desk calls you about leads.</div>
            <Err k="phone" /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="credentials">Credentials</label>
            <input id="credentials" name="credentials" placeholder="JD, CDFA®, LMHC…" /></div>
          <div className="field"><label htmlFor="company">Practice or firm</label>
            <input id="company" name="company" /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="website">Website</label>
            <input id="website" name="website" placeholder="https://" /></div>
          <div className="field"><label htmlFor="linkedin">LinkedIn</label>
            <input id="linkedin" name="linkedin" /></div>
        </div>

        <h2>4 · Where you practise</h2>
        <div className="row">
          <div className="field"><label htmlFor="street">Street</label>
            <input id="street" name="street" autoComplete="street-address" /></div>
          <div className="field"><label htmlFor="city">City</label>
            <input id="city" name="city" autoComplete="address-level2" />
            <div className="hint">Decides which directory page you appear on.</div>
            <Err k="city" /></div>
          <div className="field" style={{ maxWidth: 110 }}><label htmlFor="state">State</label>
            <input id="state" name="state" maxLength={2} placeholder="MA" /><Err k="state" /></div>
          <div className="field" style={{ maxWidth: 130 }}><label htmlFor="zip">ZIP</label>
            <input id="zip" name="zip" /></div>
        </div>
        <div className="field">
          <label>States you can practise in</label>
          <div className="ticks">
            {US_STATES.map((s) => (
              <label key={s} className={states.includes(s) ? 'tick on' : 'tick'}>
                <input type="checkbox" checked={states.includes(s)}
                  onChange={(e) => setStates(
                    e.target.checked ? [...states, s] : states.filter((x) => x !== s))} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <h2>5 · Your listing</h2>
        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" name="bio" rows={4}
            placeholder="Two to four sentences. This is what a stranger reads before deciding whether to call you." />
        </div>
        <div className="row">
          <div className="field"><label htmlFor="photoUrl">Headshot URL</label>
            <input id="photoUrl" name="photoUrl" placeholder="https://" />
            <div className="hint">Or reply to our email with a file. 800px or larger, please.</div></div>
          <div className="field"><label htmlFor="schedulerUrl">Your booking link</label>
            <input id="schedulerUrl" name="schedulerUrl" placeholder="https://calendly.com/you/30min" />
            <div className="hint">
              Calendly, Acuity, or your own. Puts a “Schedule free consult” button on your
              listing, and every click reaches your lead dashboard.
            </div>
            <Err k="schedulerUrl" /></div>
        </div>

        <h2>6 · Earn on our consumer products <span className="opt">optional</span></h2>
        <p className="hint">
          Free to join. Recommend the Better Than Bitter™ products to your own clients and earn
          20% — recurring on Divorce Companion ($9.99/mo) and Companion+ ($147/mo), and $45.40
          on every Legal LaunchPad. Paid monthly by PayPal.
        </p>
        <label className="bigcheck">
          <input type="checkbox" checked={affiliate} onChange={(e) => setAffiliate(e.target.checked)} />
          Yes, sign me up as a product affiliate too
        </label>

        {affiliate && (
          <div className="affbox">
            <div className="row">
              <div className="field"><label htmlFor="paypalEmail">PayPal email</label>
                <input id="paypalEmail" name="paypalEmail" type="email" />
                <div className="hint">We send a $1 test payout — yours to keep — before your links go live.</div>
                <Err k="paypalEmail" /></div>
              <div className="field"><label htmlFor="channelType">Where you will share</label>
                <select id="channelType" name="channelType" defaultValue="">
                  <option value="">Select one…</option>
                  {['Website / blog', 'Social media', 'Email list / newsletter',
                    'Podcast / YouTube', 'My professional practice & clients',
                    'Community or membership group', 'Other']
                    .map((o) => <option key={o} value={o}>{o}</option>)}
                </select></div>
            </div>
            <div className="field"><label htmlFor="channelUrl">Link to that channel</label>
              <input id="channelUrl" name="channelUrl" placeholder="https://" /></div>
            <div className="field"><label htmlFor="audience">Your audience</label>
              <textarea id="audience" name="audience" rows={2}
                placeholder="Who they are and roughly how many." /></div>
          </div>
        )}

        <h2>7 · How you found us</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="signupPath">Referred by a partner?</label>
            <select id="signupPath" name="signupPath" defaultValue="direct">
              <option value="direct">No — I came directly</option>
              <option value="reseller">Yes — a network or partner referred me</option>
            </select>
          </div>
          <div className="field"><label htmlFor="partnerName">Partner name or referral code</label>
            <input id="partnerName" name="partnerName" /></div>
        </div>

        <button className="submit" type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Submit application'}
        </button>
        <p className="privacy">
          Every application is reviewed and every professional interviewed. Nothing is charged
          until you are accepted, and if the Platinum seat for your speciality in your city has
          gone we will tell you before you pay.
        </p>
      </form>
    </div>
  );
}
