import { advanceLead } from '../app/actions.ts';
import type { LeadView } from '../src/db/leadRepository.ts';
import type { Stage } from '../src/referral/types.ts';

const NEXT_STAGES: Partial<Record<Stage, { to: Stage; label: string }[]>> = {
  routed: [
    { to: 'contacted', label: 'I’ve contacted them' },
    { to: 'declined', label: 'Not for me' },
  ],
  viewed: [
    { to: 'contacted', label: 'I’ve contacted them' },
    { to: 'declined', label: 'Not for me' },
  ],
  contacted: [
    { to: 'consulted', label: 'We’ve met' },
    { to: 'no_response', label: 'No reply' },
  ],
  consulted: [
    { to: 'retained', label: 'They hired me' },
    { to: 'no_response', label: 'Went quiet' },
  ],
};

const STAGE_LABEL: Record<Stage, string> = {
  routed: 'New', viewed: 'Viewed', contacted: 'Contacted', consulted: 'Consulted',
  retained: 'Retained', declined: 'Declined', no_response: 'No response',
  withdrawn: 'Withdrawn',
};

export default function LeadCard({ lead, showWho }: { lead: LeadView; showWho?: string }) {
  const actions = NEXT_STAGES[lead.stage] ?? [];
  const isNew = lead.stage === 'routed';
  const cold = lead.daysSinceActivity >= 7 && actions.length > 0;

  return (
    <div className="lead" data-cold={cold ? '1' : undefined}>
      <div className="leadmain">
        <div className="leadtop">
          <span className="leadname">{lead.consumer.name}</span>
          <span className={`pill pill-${lead.stage}`}>{STAGE_LABEL[lead.stage]}</span>
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

        {lead.message && <p className="leadmsg">{lead.message}</p>}
      </div>

      {actions.length > 0 && (
        <div className="leadactions">
          {actions.map((a) => (
            <form action={advanceLead} key={a.to}>
              <input type="hidden" name="referralId" value={lead.referralId} />
              <input type="hidden" name="professionalId" value={lead.professionalId} />
              <input type="hidden" name="stage" value={a.to} />
              <button type="submit" className={a.to === 'retained' ? 'won' : undefined}>
                {a.label}
              </button>
            </form>
          ))}
        </div>
      )}
      {isNew && <div className="leadnudge">Respond quickly — this person is talking to others.</div>}
    </div>
  );
}
