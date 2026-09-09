# Vesta / Better Than Bitter

Directory, professional hubs, lead routing and content distribution for the
Vesta + Better Than Bitter merger. Six screens; see `docs/`.

## Running it

```bash
npm run dev          # http://localhost:3100
npm test             # 70-odd tests, no services required
npm run plan:pages   # which directory pages the live data justifies
npm run audit:directory
```

Set `REVIEW_NAV=1` to show internal notes, SEO diagnostics and the screen
switcher. **Never set it in a deployed environment** — those notes name real
professionals and expose pricing.

## Conventions that bite if you miss them

**No TypeScript parameter properties.** The test suite runs under Node's
built-in type stripping, which rejects `constructor(private readonly x: T) {}`.
Declare the field and assign it in the constructor body. This has broken the
build three times.

**Imports carry the `.ts` extension.** Same reason — `node --test` resolves
real paths, with no build step.

**Never run `npm run build` while `npm run dev` is running.** The production
build overwrites `.next` underneath the dev server and it fails afterwards with
a baffling `Cannot find module './xxx.js'`. Stop the server, `rm -rf .next`,
restart.

**Anything a consumer must not read goes in `<InternalNote>`.** Not a comment,
not a conditional — the component, so it is gated in one place.

**User-supplied URLs never reach an `href` unvalidated.** Use
`parseSchedulerLink`. A `javascript:` URL in an href executes on click.

## Shape of it

- `src/` — domain logic, framework-free, no React or Next imports
- `app/`, `components/` — the Next.js application
- `data/` — the live Vesta directory export, plus `tiers.json`, a stand-in for
  the back office until tiers are assigned there for real
- `scripts/` — analysis tools that read the live site
- `docs/` — the directory audit and the reconciliation of the four source
  documents, including where they contradict each other

## Database

SQLite locally via `node:sqlite` (no install), Postgres in production when
`DATABASE_URL` is set. One schema in `src/db/schema.sql`, written in the
intersection of both dialects. All SQL uses `?` placeholders; the Postgres
driver rewrites them.
