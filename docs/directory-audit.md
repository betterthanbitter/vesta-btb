# Directory audit — vestadivorce.com

Run `python3 scripts/audit-directory.py` to regenerate. First run: 8 September 2026.

## What is there today

44 professionals, held in the WP Store Locator plugin, on a WordPress site
hosted by Automattic (OceanWP + Elementor). Consumers reach them through a map
and through ~19 city hub pages.

Individual listings live at query-string URLs — `?wpsl_stores=janet-carson…` —
which search engines largely ignore. **The listings therefore have almost no
search ranking to lose in a migration.** The ~19 hub pages and ~17 state pages
do have real URLs and are the ones that need careful redirects.

## Problems worth fixing before anything is migrated

1. **Six professionals are invisible.** They have no coordinates, so the map
   cannot place them and no consumer can find them: Janice Virginia Berner,
   Marc Fitzgerald, David Kellem, Renee Guidaboni Coleman, Molly Wilson Chung,
   Susan Trotter. If any of them are paying, they are paying for nothing.

2. **No phone numbers at all.** 0 of 38 geocoded records have one.

3. **Eight hub pages have nobody to show:** central-ma, hingham,
   lexington-winchester, new-hampshire, chicago, colorado, scottsdale,
   south-bay.

4. **Two places have professionals but no hub page:** Oklahoma City (4) and
   Baltimore (1). Oklahoma City is the third-densest location in the whole
   directory and has no page.

5. **State is written inconsistently** — `CA` and `California` and `Califronia`
   (typo) all appear, splitting Pasadena and San Diego into duplicate places.
   Name and role are jammed into one field as markup:
   `Janet Carson<br><span>Family Law Attorney and Mediator</span>`.

6. **The taxonomy is 19 terms, 10 of which nobody uses.** In use: Legal (21),
   Financial (9), Mediation (5), Divorce Coach (4), Mortgage (4), Life Coach
   (3), Realtor (2), Business Coach (1), Health & Wellness (1).

## The finding that affects the business model

Rolling the 19 terms up into the six consumer-facing categories, against the
17 real places:

**102 possible city × category pages. 32 have anyone in them. 70 — 68% — are empty.**

`accounting-tax` has **nobody, anywhere**, despite being one of the six.

Only five places have three or more categories covered: Newton, Carlsbad,
Boston, Pasadena, Oklahoma City. Most places have exactly one professional in
exactly one category.

### Why this matters for Platinum

Platinum is sold as exclusivity: one professional per category per city hub, at
$750/month. Exclusivity is only worth paying for where there is someone to be
exclusive against. In Newton, with four family-law professionals, being the
only one above the fold is worth real money. In Baltimore, where there is one
professional in total, the Platinum seat confers nothing they do not already
have — and a buyer will work that out.

The same density problem is an SEO problem. Google demotes thin pages, and 70
near-empty pages published at once is the pattern that attracts it.

### Recommendation

Do not launch 102 pages. Launch city × category pages only where density
justifies them — Newton, Carlsbad, Boston, Pasadena, Westborough, San Diego,
Oklahoma City — and let everywhere else stay at state level until it fills up.
The page structure should be driven by the data, generated as coverage grows,
rather than published as a fixed grid on day one.

This also gives the sales team a truthful target list: the gaps in the dense
cities are the seats actually worth selling.
