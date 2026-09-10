import TestimonialForm from '../../../components/TestimonialForm.tsx';
import { getDb } from '../../../src/leads/store.ts';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { TestimonialRepository } from '../../../src/testimonials/repository.ts';
import { displayName } from '../../../src/testimonials/testimonial.ts';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Share your experience — Vesta',
  robots: { index: false, follow: false },
};

/**
 * Where a hired client's testimonial email lands.
 *
 * Deliberately a dead end: no links into the rest of the site, because while
 * the preview is locked this is the only page the client can open.
 */
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const request = await new TestimonialRepository(db).findRequest(token);
  const pro = request
    ? (await loadPublishedDirectory(db)).find((d) => d.id === request.professionalId)
    : undefined;

  const name = pro?.name ?? 'your professional';
  const first = pro ? pro.name.split(' ')[0] : 'them';
  const where = pro ? [pro.city, pro.state].filter(Boolean).join(', ') : '';

  return (
    <>
      <header className="ptop">
        <div className="in"><span className="logo">VESTA</span></div>
      </header>

      <div className="capturepage">
        {!request ? (
          <div className="capture done">
            <h3>This link is not valid.</h3>
            <p>Please use the link in the email Vesta sent you. If it still does not work, reply to
              that email and the concierge team will help.</p>
          </div>
        ) : request.submitted ? (
          <div className="capture done">
            <h3>Thank you — we already have your testimonial.</h3>
            <p>Each link can be used once. If you would like to change what you wrote, reply to
              the email Vesta sent you.</p>
          </div>
        ) : (
          <>
            <div className="capwho">
              <div>
                <div className="capname">{name}</div>
                {pro?.roleLabel && <div className="caprole">{pro.roleLabel}</div>}
                {where && <div className="capwhere">{pro?.firm ? `${pro.firm} · ` : ''}{where}</div>}
              </div>
            </div>
            <TestimonialForm
              token={token}
              first={first}
              names={{
                initial: displayName(request.consumerFirstName, request.consumerLastName, 'initial'),
                first: displayName(request.consumerFirstName, request.consumerLastName, 'first'),
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
