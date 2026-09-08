#!/usr/bin/env python3
"""
Audit the live vestadivorce.com directory.

Pulls the WP Store Locator records straight from the site and reports on the
things that decide whether the city x category page model is viable: how many
professionals there really are, where they are, and how many pages would be
empty. Re-run it any time to see whether the picture has moved.

    python3 scripts/audit-directory.py
"""
import collections
import html
import json
import re
import urllib.parse
import urllib.request

SITE = "https://vestadivorce.com"

# Geographic centres to sweep. WP Store Locator only answers proximity
# queries, so we ask from many points to be sure we see everyone.
CENTRES = [
    (42.36, -71.06), (41.82, -71.41), (34.05, -118.24), (32.72, -117.16),
    (41.88, -87.63), (40.71, -74.01), (39.29, -76.61), (35.78, -78.64),
    (33.49, -111.93), (39.74, -104.99), (30.27, -97.74), (35.47, -97.52),
    (27.95, -82.46), (40.44, -79.99), (34.75, -92.29),
]

STATE_ALIASES = {
    "massachusetts": "MA", "california": "CA", "califronia": "CA",  # sic
    "new york": "NY", "oklahoma": "OK", "maryland": "MD", "connecticut": "CT",
}

# The six consumer-facing categories, and which of the site's 19 taxonomy
# terms roll up into each.
CATEGORY_ROLLUP = {
    "family-law": ["Legal", "Mediation", "Elder Law Attorney"],
    "financial-cdfa": ["Financial", "Business Valuation", "College Planning"],
    "accounting-tax": ["Forensic CPA", "Estate Planning"],
    "real-estate": ["Realtor", "Home Organization"],
    "mortgage": ["Mortgage"],
    "coaching-therapy": [
        "Divorce Coach", "Life Coach", "Therapist", "Health & Wellness",
        "Parenting Coach", "Parent Coordinator", "Career Coach", "Business Coach",
    ],
}
TERM_TO_CATEGORY = {t: c for c, ts in CATEGORY_ROLLUP.items() for t in ts}


def get_json(path, **params):
    url = f"{SITE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def normalise_state(s):
    s = (s or "").strip()
    return STATE_ALIASES.get(s.lower(), s.upper())


def normalise_city(c):
    return re.sub(r"\s+", " ", (c or "").strip()).title()


def strip_markup(text):
    text = html.unescape(text or "")
    text = re.sub(r"<br\s*/?>", " — ", text)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text)).strip()


def fetch():
    """Returns (all_posts, geocoded_by_id, term_names)."""
    posts = get_json("/wp-json/wp/v2/wpsl_stores", per_page=100,
                     _fields="id,slug,title,content,wpsl_store_category")
    terms = {t["id"]: html.unescape(t["name"])
             for t in get_json("/wp-json/wp/v2/wpsl_store_category", per_page=100,
                               _fields="id,name")}
    geo = {}
    for lat, lng in CENTRES:
        try:
            rows = get_json("/wp-admin/admin-ajax.php", action="store_search",
                            lat=lat, lng=lng, max_results=500,
                            search_radius=12000, autoload=1)
        except Exception:
            continue
        for row in rows:
            geo[int(row["id"])] = row
    return posts, geo, terms


def main():
    posts, geo, terms = fetch()
    print(f"{len(posts)} professionals listed; {len(geo)} of them have coordinates.\n")

    invisible = [p for p in posts if p["id"] not in geo]
    if invisible:
        print(f"NOT FINDABLE ON THE MAP ({len(invisible)}) — listed but no consumer can reach them:")
        for p in invisible:
            print("   ", strip_markup(p["title"]["rendered"]))
        print()

    missing_phone = sum(1 for g in geo.values() if not g.get("phone"))
    print(f"Records with no phone number: {missing_phone} of {len(geo)}")

    raw_states = collections.Counter(g["state"] for g in geo.values() if g.get("state"))
    inconsistent = [s for s in raw_states if s != normalise_state(s)]
    print(f"State written inconsistently: {sorted(inconsistent)}\n")

    grid = collections.Counter()
    unmapped = set()
    for p in posts:
        g = geo.get(p["id"])
        if not g:
            continue
        place = f"{normalise_city(g['city'])}, {normalise_state(g['state'])}"
        for tid in p.get("wpsl_store_category") or []:
            name = terms.get(tid, "?")
            cat = TERM_TO_CATEGORY.get(name)
            if cat is None:
                unmapped.add(name)
            else:
                grid[(place, cat)] += 1

    cats = list(CATEGORY_ROLLUP)
    places = sorted({k[0] for k in grid})
    possible = len(places) * len(cats)
    filled = sum(1 for pl in places for c in cats if grid[(pl, c)])
    print(f"{len(places)} places x {len(cats)} categories = {possible} possible pages")
    print(f"  with at least one professional: {filled}")
    print(f"  empty:                          {possible - filled} "
          f"({(possible - filled) * 100 // possible}%)\n")

    head = f"{'':<22}" + "".join(f"{c.split('-')[0][:7]:>9}" for c in cats)
    print(head)
    print("-" * len(head))
    for pl in places:
        print(f"{pl:<22}" + "".join(f"{(grid[(pl, c)] or '·'):>9}" for c in cats))

    barren = [c for c in cats if not any(grid[(pl, c)] for pl in places)]
    if barren:
        print(f"\nCategories with nobody anywhere: {barren}")
    if unmapped:
        print(f"Taxonomy terms not rolled up: {sorted(unmapped)}")


if __name__ == "__main__":
    main()
