#!/usr/bin/env python3
"""
Pull each professional's real profile copy off the old WordPress site.

The store-locator export holds a one-line excerpt and, in the "url" field, a
link back to a vestadivorce.com blog post. Those posts are where the actual
biography lives — several paragraphs, well written — along with the
professional's own website, which the export does not have at all.

So the new directory was linking every professional back to the old site
instead of carrying their words across. This brings the copy over and records
the old URL, which is what a redirect map will need so nothing that ranks today
is lost.

    python3 scripts/import-legacy-profiles.py
"""
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

SITE = "https://vestadivorce.com"
DATA = Path(__file__).resolve().parent.parent / "data"

# Hosts that are the old site or generic, not a professional's own presence.
NOT_THEIR_SITE = re.compile(
    r"(vestadivorce\.com|betterthanbitter|facebook\.com|linkedin\.com|twitter\.com|x\.com"
    r"|instagram\.com|youtube\.com|calendly\.com|google\.com|wordpress|gravatar)",
    re.I,
)


def get_json(url: str, attempts: int = 3):
    """Retry: someone else's WordPress drops connections under a burst."""
    last = None
    for i in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=45) as r:
                return json.load(r)
        except Exception as err:
            last = err
            time.sleep(1.5 * (i + 1))
    raise last


def find_post(slug: str):
    """By slug, then by name — several posts are filed under a fuller name."""
    posts = get_json(f"{SITE}/wp-json/wp/v2/posts?slug={slug}"
                     "&_fields=id,slug,link,title,content")
    if posts:
        return posts[0]

    name = slug.replace("-", " ")
    query = urllib.parse.urlencode(
        {"search": name, "per_page": 5, "_fields": "id,slug,link,title,content"})
    for candidate in get_json(f"{SITE}/wp-json/wp/v2/posts?{query}"):
        title = re.sub(r"<[^>]+>", "", html.unescape(candidate["title"]["rendered"])).lower()
        # Every word of the slug must appear in the title, so a post that
        # merely mentions somebody is not mistaken for their profile.
        if all(word in title for word in name.split()):
            return candidate
    return None


def to_text(raw_html: str) -> str:
    """Readable paragraphs, in order, with the markup stripped."""
    text = re.sub(r"<(br|/p|/h[1-6]|/li|/div)[^>]*>", "\n", raw_html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    paragraphs = [p.strip() for p in text.split("\n")]
    return "\n\n".join(p for p in paragraphs if p)


def main() -> None:
    stores = json.loads((DATA / "wpsl_all.json").read_text())
    out: dict[str, dict] = {}
    missing: list[str] = []

    for store in stores:
        url = (store.get("url") or "").strip()
        if not url or "vestadivorce.com" not in url:
            continue
        slug = url.rstrip("/").rsplit("/", 1)[-1]

        try:
            post = find_post(slug)
        except Exception as err:
            missing.append(f"{slug}: {err}")
            continue

        if post is None:
            missing.append(f"{slug}: no post")
            continue
        raw = post["content"]["rendered"]
        bio = to_text(raw)

        # Their own site is the first outbound link that is not the old site
        # or a social network — those are handled separately.
        own_site = None
        for href in re.findall(r'href="(https?://[^"]+)"', raw):
            if not NOT_THEIR_SITE.search(href):
                own_site = href
                break

        out[str(store["id"])] = {
            "legacyUrl": post["link"],
            "bio": bio,
            "website": own_site,
        }
        time.sleep(0.15)  # be gentle with someone else's WordPress

    (DATA / "legacy-profiles.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")

    with_site = sum(1 for v in out.values() if v["website"])
    lengths = sorted(len(v["bio"]) for v in out.values())
    print(f"  imported: {len(out)}")
    print(f"  with their own website found: {with_site}")
    if lengths:
        print(f"  bio length: shortest {lengths[0]}, median {lengths[len(lengths)//2]}, "
              f"longest {lengths[-1]} chars")
    if missing:
        print(f"  could not fetch ({len(missing)}):")
        for m in missing[:10]:
            print(f"    {m}")


if __name__ == "__main__":
    main()
