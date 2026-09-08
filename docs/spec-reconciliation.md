# Reconciling four sources

Read 8 September 2026, in this order of recency:

1. **Price table** — supplied in chat, 8 Sep 2026. Five pricing bands, 78 in network.
2. **Vesta merger model** — `vesta-merger-model_7.html`, 2 Sep 2026.
3. **Strategy document** — `dnp-btb-strategy-2way_6.html`, 27 Aug 2026. 24 parts.
4. **Six-screen prototype** — Claude artifact `ac440d68`.

They contradict each other in eight places. None is fatal; all need a decision
before anything bills a customer.

## 1. How many professionals are there?

| Source | Count |
|---|---|
| Live vestadivorce.com directory | 44 listed, **38 findable** |
| Price table | 78 in network |
| Merger model | 75 warm professionals |
| Strategy doc, DNP side | 174 at $25/mo |

**Only 38 of the 78 in-network Vesta professionals can be found by a consumer
today.** Whether the other 40 are unlisted, lapsed, or listed somewhere the
directory does not reach is the first thing to establish — it changes both the
migration and the revenue baseline.

## 2. Tier names

- Prototype: Platinum / Premium / **Listing**
- Strategy doc Part 7: Standard / **Premier** / Platinum / Wholesale
- Price table: Standard / **Premium** / Platinum

Pick three names and use them everywhere. The code uses
`standard | premium | platinum`.

## 3. Prices, and the structure underneath them

The prototype's flat $750 / $500 / $250 is superseded by per-band pricing.

**Platinum is not a new price.** In four bands of five it is exactly what the
professional pays Vesta today plus the Premier/PAC.MP content price:

| Band | Current | + content | = Platinum | Table says |
|---|---|---|---|---|
| Attorneys | 500 | 295 | 795 | **795** ✓ |
| CDFAs & Mediators | 375 | 195 | 570 | **570** ✓ |
| Lending, Realty, Accounting | 250 | 99 | 349 | **349** ✓ |
| Therapists, Wellness & Other | 250 | 99 | 349 | **349** ✓ |
| Divorce Coaches | 250 | 249 | 499 | **474** ✗ |

Divorce Coaches are $25 short of the formula. Deliberate concession or a slip —
confirm before billing. Enforced by a test in `test/pricing.test.ts`.

This structure is the strongest thing in the pricing, and it should be said out
loud in the sales conversation: **Platinum is "keep everything you have and add
content". Premium is "give up the concierge and the events, keep only content"**
— which is why Premium costs less than today rather than more.

## 4. Other unresolved figures

- **Standard**: $25 flat (strategy) vs $29–$49 by band (table).
- **Content hub**: $2,995 setup + $99/mo (strategy Part 16) vs $2,999 once +
  $19/mo, free at Platinum (prototype screen 4).
- **Content programme**: $177/mo (prototype screen 4) vs $295/$195/$99/$249
  (strategy and table).

## 5. The exclusivity ceiling

The prototype sells Platinum as one seat per category per city hub. The merger
model counts 30 such seats. The live data gives **32 occupied cells across 17
places** — the two agree.

Applied to the 38 findable professionals:

| | Monthly | Annual | vs today |
|---|---|---|---|
| What they pay today | $15,000 | $180,000 | — |
| Every seat-holder takes Platinum | $21,208 | $254,496 | **+41%** |
| Everyone takes Premium | $9,108 | $109,296 | **−39%** |

Across the whole 78-person network the same swing is +55% / −44%, breaking even
at 44% Platinum uptake.

**The catch: 27 of the 32 cells contain exactly one professional.** In 84% of
cases "the only family law partner in this city" is true because nobody else is
there. Exclusivity that excludes nobody is hard to charge for, and a consumer
may read the ribbon as evidence the directory is thin rather than that the
professional is chosen.

Exclusivity becomes sellable at roughly three to five professionals per cell.
Today five cells clear that bar.

## 6. Where the prototype's demo data diverges from reality

Screen 1 offers five locations. In the live data:

| Prototype hub | Professionals actually there |
|---|---|
| Boston | 4 |
| Westborough | 3 |
| Lexington / Winchester | **0** |
| Worcester | **0** |
| Providence | **0** |

And of the six categories, **Accounting & Tax has nobody anywhere**.

## 7. The listing table does not survive the growth plan

Screen 1 renders Standard members as a table under the Platinum and Premium
cards. That works for the eight shown. Standard at $29–$49 is explicitly a
national volume play — the strategy doc targets the 174 DNP listings climbing
into it. At a few hundred per city the table becomes the page. It needs
pagination, search and filtering, and a deliberate answer to how a Standard
member is displayed without making the page look like a phone book.

## 8. SEO: the strategy doc is right and it sharpens the audit's conclusion

Part 13 argues that ranking is decaying and citation is appreciating, that AI
answer engines cite directories and comparison sites rather than individual firm
sites, and that the canonical should therefore sit on the network domain to
build one entity with subject depth.

That reasoning strengthens the directory audit's recommendation rather than
competing with it. A corpus earns citation through depth. Seventy empty
city × category pages published at once are the opposite of depth, and dilute
exactly the entity signal Part 13 is trying to concentrate.

**The synthesis:** page density should be driven by *content*, not by
professional headcount. A city × category page with one professional who has a
full content library is a legitimate page. A page with no professional and no
content should not exist. That makes the content programme the fix for the
thin-page problem — and ties the SEO case directly to the thing being sold.
