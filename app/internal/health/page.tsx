import { getDb } from '../../../src/leads/store.ts';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

/**
 * "Is the database actually connected?" — answered in plain language.
 *
 * The whole site sits behind the password gate, so this is safe to reach, but
 * it deliberately reports no connection details, only whether things work.
 */
export default async function Health() {
  const usingPostgres = Boolean(process.env.DATABASE_URL);
  let connected = false;
  let leads = 0;
  let intents = 0;
  let error: string | null = null;

  try {
    const db = await getDb();
    const a = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM consult_requests');
    const b = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM consult_intents');
    leads = Number(a[0]?.n ?? 0);
    intents = Number(b[0]?.n ?? 0);
    connected = true;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const good = usingPostgres && connected;

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, letterSpacing: '-.025em', marginBottom: 4 }}>
        Is the database working?
      </h1>
      <p style={{ color: 'var(--ink3)', fontSize: 13.5, marginTop: 0 }}>
        Internal page. Reload after changing anything on the host.
      </p>

      <div style={{
        border: `1px solid ${good ? 'var(--ok-br)' : 'var(--gold-br)'}`,
        background: good ? 'var(--ok-bg)' : 'var(--gold-bg)',
        borderRadius: 14, padding: '20px 24px', marginTop: 18,
      }}>
        <div style={{
          fontSize: 20, fontWeight: 750, color: good ? 'var(--ok)' : 'var(--gold)',
          marginBottom: 8,
        }}>
          {good ? 'Yes — leads are being kept.' : 'No — leads are being lost.'}
        </div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink2)' }}>
          {good ? (
            <>Connected to Postgres. Anything a consumer submits is stored and will still be
            here tomorrow.</>
          ) : !usingPostgres ? (
            <><b>DATABASE_URL is not set on this host.</b> The site works and forms accept
            submissions, but every lead disappears the next time the server restarts — which on
            Netlify is a matter of minutes. Add the variable and redeploy.</>
          ) : (
            <><b>DATABASE_URL is set, but the database could not be reached.</b> The address is
            probably mistyped or incomplete — the most common cause is copying only part of it.</>
          )}
        </p>
      </div>

      <table style={{
        width: '100%', marginTop: 20, borderCollapse: 'collapse', fontSize: 14,
        background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12,
      }}>
        <tbody>
          {[
            ['Storage', usingPostgres ? 'Postgres (permanent)' : 'Temporary — lost on restart'],
            ['Reachable', connected ? 'Yes' : 'No'],
            ['Consult requests stored', String(leads)],
            ['Scheduler clicks stored', String(intents)],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--line)',
                color: 'var(--ink3)', width: 220 }}>{k}</td>
              <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--line)',
                fontWeight: 650 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && (
        <pre style={{
          marginTop: 16, background: '#fdf2f2', border: '1px solid #e3b8b8', color: '#7a2f2f',
          borderRadius: 10, padding: 14, fontSize: 12.5, whiteSpace: 'pre-wrap',
        }}>{error}</pre>
      )}
    </div>
  );
}
