import { advanceLead } from '../app/actions.ts';
import type { LeadView } from '../src/db/leadRepository.ts';
import { STAGE_LABELS, type Stage } from '../src/referral/types.ts';
import { nextStages } from '../src/referral/stateMachine.ts';

/**
 * What each button says. Derived from the state machine rather than a second
 * list, so a stage can never be legal in one place and missing in the other.
 */
const ACTION_LABELS: Record<Stage, string> = {
  new: 'New',
  contacted: 'I’ve contacted them',
  responded: 'They responded',
  did_not_respond: 'No response',
  followed_up: 'I followed up',
  interested: 'They’re interested',
  hired: 'They hired me',
  dead_lead: 'Dead lead',
};

/**
 * What the concierge learned, laid out for the professional.
 *
 * Only answered questions appear. A grid of "—" tells a professional nothing
 * and makes the useful answers harder to find.
 */
function Brief({ lead }: { lead: LeadView }) {
  const c = lead.consumer;
  const facts: Array<[string, string | undefined]> = [
    ['Stage', c.stageOfDivorce],
    ['Married', c.lengthOfMarriage],
    ['Children', c.hasChildren === 'Yes' && c.childrenAges ? `Yes — ${c.childrenAges}` : c.hasChildren],
    ['Home', c.homeStatus],
    ['Business', c.ownsBusiness],
    ['Assets', c.assetRange],
    ['Location', [c.city, c.state].filter(Boolean).join(', ') || undefined],
    ['Came from', c.leadSource],
  ].filter((f): f is [string, string] => Boolean(f[1]));

  if (!facts.length && !c.questions && !c.professionalsWanted) return null;

  return (
    <div className="brief">
      {facts.length > 0 && (
        <dl>
          {facts.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      {c.professionalsWanted && (
        <p className="briefwanted">
          <b>Also looking for:</b> {c.professionalsWanted}
        </p>
      )}
      {c.questions && (
        <p className="briefq">“{c.questions}”</p>
      )}
    </div>
  );
}

export default function LeadCard({ lead, showWho }: { lead: LeadView; showWho?: string }) {
  const actions = nextStages(lead.stage);
  const isNew = lead.stage === 'new';
  const cold = lead.daysSinceActivity >= 7 && actions.length > 0;

  return (
    <div className="lead" data-cold={cold ? '1' : undefined}>
      <div className="leadmain">
        <div className="leadtop">
          <span className="leadname">{lead.consumer.name}</span>
          <span className={`pill pill-${lead.stage}`}>{STAGE_LABELS[lead.stage]}</span>
          {lead.shortlistSize > 1 && (
            <span className="pill pill-shared" title="This consumer was shown a shortlist">
              Shortlisted with {lead.shortlistSize - 1} other{lead.shortlistSize > 2 ? 's' : ''}
            </span>
          )}
          {cold && <span className="pill pill-cold">No activity for {lead.daysSinceActivity} days</span>}
        </div>

        <div className="leadmeta">
          <a href={`mailto:${lead.consumer.email}`}>{lead.consumer.email}</a>
          {' · '}{new Date(lead.routedAt).toLocaleDateString('en-US', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
          {showWho && <> · <b>{showWho}</b></>}
        </div>

        <Brief lead={lead} />

        {lead.message && (
          <p className="leadmsg">
            <span className="leadmsglabel">From the concierge</span>
            {lead.message}
          </p>
        )}
      </div>

      {actions.length > 0 && (
        <div className="leadactions">
          {actions.map((to) => (
            <form action={advanceLead} key={to}>
              <input type="hidden" name="referralId" value={lead.referralId} />
              <input type="hidden" name="professionalId" value={lead.professionalId} />
              <input type="hidden" name="stage" value={to} />
              <button
                type="submit"
                className={to === 'hired' ? 'won' : to === 'dead_lead' ? 'dead' : undefined}
              >
                {ACTION_LABELS[to]}
              </button>
            </form>
          ))}
        </div>
      )}
      {isNew && <div className="leadnudge">Respond quickly — this person is talking to others.</div>}
    </div>
  );
}
