import type { TestimonialView } from '../src/testimonials/repository.ts';
import { AVERAGE_SHOWN_FROM, summarize } from '../src/testimonials/testimonial.ts';

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" role="img" aria-label={`Rated ${n} out of 5`}>
      {'★'.repeat(n)}<span className="off">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

/**
 * Client testimonials on the public profile.
 *
 * Absent until there is one: an empty "no reviews yet" says something about
 * the professional that is not true. Every one shown was written by someone
 * who hired them through Vesta, approved by Vesta, and shared with permission.
 */
export default function Testimonials({ first, items }: { first: string; items: TestimonialView[] }) {
  if (!items.length) return null;
  const { count, average } = summarize(items.map((t) => t.rating));

  return (
    <section id="testimonials" className="pblock">
      <div className="in">
        <div className="stitle">Client testimonials</div>
        <h2>What clients say about working with {first}.</h2>
        <p className="ssub">
          Every testimonial here comes from someone who hired {first} through Vesta, and is shared
          with their permission.
        </p>

        {count >= AVERAGE_SHOWN_FROM && average !== null && (
          <div className="tsummary">
            <Stars n={Math.round(average)} />
            <b>{average.toFixed(1)}</b>
            <span>from {count} clients</span>
          </div>
        )}

        <div className="tgrid">
          {items.map((t) => (
            <figure className="tcard" key={t.id}>
              <Stars n={t.rating} />
              <blockquote>{t.liked}</blockquote>
              <figcaption>
                <b>{t.displayName}</b>
                <span>
                  Verified client · {new Date(t.submittedAt).toLocaleDateString('en-US', {
                    month: 'long', year: 'numeric',
                  })}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="tnote">
          Testimonials describe one client’s experience and are not a guarantee of any outcome.
        </p>
      </div>
    </section>
  );
}
