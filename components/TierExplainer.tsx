import { BANDS, PRICING } from '../src/pricing/catalog.ts';

/**
 * The prototype's explainer table, with the real per-band prices rather than
 * the flat $750 / $500 / $250 the prototype showed. Prices come from the
 * pricing catalog, so this table cannot drift from what is billed.
 */
export default function TierExplainer() {
  const money = (n: number) => '$' + n.toLocaleString('en-US');
  const range = (key: 'standard' | 'premium' | 'platinum') => {
    const values = BANDS.map((b) => PRICING[b][key]);
    return `${money(Math.min(...values))}–${money(Math.max(...values))}`;
  };

  return (
    <div className="exp">
      <h3>Why the listings on this page look different</h3>
      <p className="s">
        The tier is not a badge — <b>it changes what a consumer can actually do on the page.</b>{' '}
        That is what makes the price defensible, and it is why a professional upgrades: not for a
        bigger logo, but because their content is what a stranger reads before deciding who to call.
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '14%' }}>Tier</th>
            <th style={{ width: '15%' }}>Price / month</th>
            <th style={{ width: '36%' }}>What the consumer sees here</th>
            <th>Why anyone pays for it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <b>Platinum</b><br />
              <span style={{ fontSize: 11.6, color: 'var(--ink3)' }}>1 per category, per hub</span>
            </td>
            <td>
              <b>{range('platinum')}</b><br />
              <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>by profession</span>
            </td>
            <td>
              Video introduction, bio, and the full content library — webinars, podcasts and
              articles, all playable from the listing
            </td>
            <td>
              <b>Exclusivity plus proof.</b> No competitor appears above them, and a stranger can
              spend twenty minutes with them before making contact
            </td>
          </tr>
          <tr>
            <td>
              <b>Premium</b><br />
              <span style={{ fontSize: 11.6, color: 'var(--ink3)' }}>unlimited per hub</span>
            </td>
            <td>
              <b>{range('premium')}</b><br />
              <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>PAC.MP / CCMP</span>
            </td>
            <td>Photo, bio and their content library — but no video and no live events</td>
            <td>
              Content still does the selling.{' '}
              <b>The gap they feel is the video and the event stage above them</b>
            </td>
          </tr>
          <tr>
            <td>
              <b>Standard</b><br />
              <span style={{ fontSize: 11.6, color: 'var(--ink3)' }}>unlimited per hub</span>
            </td>
            <td>
              <b>{range('standard')}</b><br />
              <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>directory listing</span>
            </td>
            <td>Name, credential, firm and a contact link</td>
            <td>
              Presence in every state not built out yet —{' '}
              <b>and a visible reason to upgrade every time they look at their own page</b>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="note">
        <b>Note on SEO.</b> The address bar shows the URL this view is served at —{' '}
        <b>one indexable page per city per category</b>, with real content on it rather than an
        empty template. Combinations with nobody in them are never created as URLs at all, so the
        directory cannot fill up with thin pages as it grows.
      </p>
    </div>
  );
}
