#!/usr/bin/env python3
"""
Bring each professional's headshot across from the old site.

The export links photos at vestadivorce.com, so every listing depends on that
site staying up — and links the 150x150 crop, which is soft at the 250px the
cards render. This takes the largest sensible version and stores the bytes
locally, resizing anything oversized rather than carrying megabytes for an
image shown small.

    python3 scripts/import-legacy-photos.py
"""
from __future__ import annotations

import base64
import json
import re
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
MAX_BYTES = 5 * 1024 * 1024
# Above this, look for a smaller crop and then resize.
PREFERRED_BYTES = 400 * 1024
LONGEST_EDGE = 800


def fetch(url, attempts=2):
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "vesta-migration"})
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read(MAX_BYTES + 1)
        except Exception:
            if i + 1 < attempts:
                time.sleep(1.0 * (i + 1))
    return None


def sniff(data):
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"\x89PNG":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def downscale(data, mime):
    """Resize with sips, which ships with macOS, so there is no dependency."""
    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(mime, ".jpg")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"image{suffix}"
        path.write_bytes(data)
        try:
            subprocess.run(["sips", "--resampleHeightWidthMax", str(LONGEST_EDGE), str(path)],
                           check=True, capture_output=True)
        except Exception:
            return None
        out = path.read_bytes()
    return out if 0 < len(out) < len(data) else None


def main():
    stores = json.loads((DATA / "wpsl_all.json").read_text())
    out, failed, resized_count = {}, [], 0

    for store in stores:
        thumb = (store.get("thumb") or "").replace("&quot;", '"')
        match = re.search(r'src="([^"]+)"', thumb)
        if not match:
            continue
        url = match.group(1).replace("&#038;", "&")

        # WordPress keeps several crops beside the one the export links.
        base = re.sub(r"-\d+x\d+(\.\w+)$", r"\1", url)
        stem, _, ext = base.rpartition(".")
        candidates = [f"{stem}-768x768.{ext}", f"{stem}-600x600.{ext}", base,
                      f"{stem}-300x300.{ext}", url]

        data = source = None
        for candidate in candidates:
            attempt = fetch(candidate, attempts=1)
            if attempt is None or sniff(attempt) is None:
                continue
            if len(attempt) <= PREFERRED_BYTES:
                data, source = attempt, candidate
                break
            if data is None:      # keep the heavy one only as a fallback
                data, source = attempt, candidate

        if data is None:
            failed.append(f"{store['id']}: could not fetch")
            continue

        mime = sniff(data)
        if len(data) > PREFERRED_BYTES:
            smaller = downscale(data, mime)
            if smaller is not None:
                data, mime, resized_count = smaller, sniff(smaller) or mime, resized_count + 1

        out[str(store["id"])] = {
            "mime": mime,
            "bytes": base64.b64encode(data).decode(),
            "byteSize": len(data),
            "source": source,
        }
        time.sleep(0.1)

    (DATA / "legacy-photos.json").write_text(json.dumps(out) + "\n")
    sizes = sorted(v["byteSize"] for v in out.values())
    upgraded = sum(1 for v in out.values() if not re.search(r"-150x150\.", v["source"]))
    print(f"  imported: {len(out)}")
    print(f"  better than the 150px thumbnail: {upgraded}")
    print(f"  resized locally: {resized_count}")
    if sizes:
        print(f"  size: smallest {sizes[0]//1024}KB, median {sizes[len(sizes)//2]//1024}KB, "
              f"largest {sizes[-1]//1024}KB")
    if failed:
        print(f"  failed ({len(failed)}): {failed[:5]}")


if __name__ == "__main__":
    main()
