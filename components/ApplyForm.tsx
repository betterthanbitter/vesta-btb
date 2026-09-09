'use client';

import { useState } from 'react';
import type { TierKey, TierSummary } from '../src/professionals/tiers.ts';
import {
  SPECIALTY_GROUPS, SPECIALTY_NEEDING_DETAIL, groupsForProfession,
} from '../src/professionals/specialties.ts';
import { PHOTO_RULES } from '../src/professionals/photo.ts';
import { SOCIAL_PLATFORMS } from '../src/professionals/social.ts';

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
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [photo, setPhoto] = useState<
    { dataUrl: string; width: number; height: number; name: string; size: number } | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const priceFor = (t: TierKey) => (profession ? prices[profession]?.[t] : undefined);

  function chooseProfession(value: string) {
    setProfession(value);
    // Open the group they are most likely to need. The rest stay available —
    // an attorney who also mediates ticks across groups.
    if (value) setOpenGroups(groupsForProfession(value));
  }

  /**
   * Read the file, measure it, and say what is wrong before they submit.
   * The server checks all of this again; this only saves them a round trip.
   */
  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhotoNote(null);
    if (!file) { setPhoto(null); return; }

    if (file.size > PHOTO_RULES.maxBytes) {
      setPhoto(null);
      setPhotoNote(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. Please keep it under 5MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const short = Math.min(img.width, img.height);
        if (short < PHOTO_RULES.minShortSide) {
          setPhoto(null);
          setPhotoNote(
            `That image is ${img.width}×${img.height}. We need at least ` +
            `${PHOTO_RULES.minShortSide}px on the shorter side, or it looks blurred on your listing.`,
          );
          return;
        }
        setPhoto({ dataUrl, width: img.width, height: img.height, name: file.name, size: file.size });
      };
      img.onerror = () => { setPhoto(null); setPhotoNote('That file could not be read as an image.'); };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true); setErrors({});
    const fd = new FormData(e.currentTarget);
    const payload = {
      ...Object.fromEntries(fd),
      profession, tier,
      statesLicensed: states.join(', '),
      specialties,
      social,
      photoDataUrl: photo?.dataUrl ?? '',
      photoWidth: photo?.width,
      photoHeight: photo?.height,
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
            specialty in your city has already gone, we will tell you before you pay anything.
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
          program that puts your expertise in front of the people looking for it. Every
          application is reviewed; nothing is charged until you are accepted.
        </p>

        {errors._ && <div className="err banner">{errors._}</div>}

        <h2>1 · What you do</h2>
        <p className="hint">This sets your prices and the directory pages you appear on.</p>
        <div className="field">
          <label htmlFor="profession">Profession</label>
          <select id="profession" value={profession}
            onChange={(e) => chooseProfession(e.target.value)}>
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

        <h2>4 · What you do</h2>
        <p className="hint">
          Tick everything that applies — across groups if that is the truth. This is what a
          consumer searches by, and it is the difference between your listing saying
          “{profession || 'Attorney'}” and saying what you actually handle.
        </p>
        <Err k="specialties" />
        <div className="specgroups">
          {SPECIALTY_GROUPS.map((g) => {
            const open = openGroups.includes(g.name);
            const chosen = g.items.filter((i) => specialties.includes(i)).length;
            return (
              <div key={g.name} className={open ? 'specgroup open' : 'specgroup'}>
                <button type="button" className="spechead"
                  onClick={() => setOpenGroups(open
                    ? openGroups.filter((n) => n !== g.name)
                    : [...openGroups, g.name])}>
                  <span className="chev">{open ? '−' : '+'}</span>
                  {g.name}
                  {chosen > 0 && <span className="count">{chosen}</span>}
                </button>
                {open && (
                  <div className="ticks wide">
                    {g.items.map((i) => (
                      <label key={i} className={specialties.includes(i) ? 'tick on' : 'tick'}>
                        <input type="checkbox" checked={specialties.includes(i)}
                          onChange={(e) => setSpecialties(e.target.checked
                            ? [...specialties, i]
                            : specialties.filter((x) => x !== i))} />
                        {i}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {specialties.includes(SPECIALTY_NEEDING_DETAIL) && (
          <div className="field">
            <label htmlFor="specialtyOther">Please say what “Other” is</label>
            <input id="specialtyOther" name="specialtyOther" />
            <Err k="specialtyOther" />
          </div>
        )}
        {specialties.length > 0 && (
          <p className="hint"><b>{specialties.length} selected.</b> These appear on your listing
            and are how consumers filter.</p>
        )}

        <h2>5 · Where you practice</h2>
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
          <label>States you can practice in</label>
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

        <h2>6 · Your listing</h2>
        <div className="field">
          <label htmlFor="headline">Headline <span className="opt">optional</span></label>
          <input id="headline" name="headline"
            placeholder="One line at the top of your page — what you do for people" />
          <div className="hint">
            Not your job title. “The money questions, answered before you have to ask them.”
          </div>
        </div>

        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" name="bio" rows={4}
            placeholder="Two to four sentences. This is what a stranger reads before deciding whether to call you." />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="photoFile">Headshot</label>
            <input id="photoFile" type="file" accept="image/jpeg,image/png,image/webp"
              onChange={onPhoto} />
            <div className="hint">
              JPG, PNG or WebP · at least {PHOTO_RULES.minShortSide}px on the shorter side ·
              under 5MB. It is shown at 250px on your listing, so a small file looks soft.
            </div>
            {photo && (
              <div className="photook">
                <img src={photo.dataUrl} alt="" />
                <div>
                  <b>{photo.name}</b><br />
                  {photo.width}×{photo.height} · {(photo.size / 1024).toFixed(0)}KB
                </div>
              </div>
            )}
            {photoNote && <div className="err">{photoNote}</div>}
            <Err k="photoDataUrl" />
          </div>
          <div className="field"><label htmlFor="schedulerUrl">Your booking link</label>
            <input id="schedulerUrl" name="schedulerUrl" placeholder="https://calendly.com/you/30min" />
            <div className="hint">
              Calendly, Acuity, or your own. Puts a “Schedule free consult” button on your
              listing, and every click reaches your lead dashboard.
            </div>
            <Err k="schedulerUrl" /></div>
        </div>

        <div className="field">
          <label>Where people can follow you <span className="opt">optional</span></label>
          <div className="hint" style={{ marginBottom: 10 }}>
            These become links on your profile. Paste the address or just the page —
            “linkedin.com/in/you” is fine.
          </div>
          <div className="sociallist">
            {SOCIAL_PLATFORMS.map((p) => (
              <div className="socialfield" key={p.key}>
                <span>{p.name}</span>
                <input
                  value={social[p.key] ?? ''}
                  placeholder={p.placeholder}
                  onChange={(e) => setSocial({ ...social, [p.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <h2>7 · Earn on our consumer products <span className="opt">optional</span></h2>
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

        <h2>8 · How you found us</h2>
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
          until you are accepted, and if the Platinum seat for your specialty in your city has
          gone we will tell you before you pay.
        </p>
      </form>
    </div>
  );
}
