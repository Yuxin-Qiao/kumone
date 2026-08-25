#!/usr/bin/env python3
"""Generate web/latest.json from a GitHub downstream release API response."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("release_json", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    release = json.loads(args.release_json.read_text(encoding="utf-8"))
    tag = str(release["tag_name"])
    if not tag.startswith("downstream-v"):
        raise SystemExit(f"Expected downstream-v* release, got {tag}")
    if release.get("draft") or release.get("prerelease"):
        raise SystemExit(f"Expected published stable release, got draft/prerelease: {tag}")

    version = tag.removeprefix("downstream-v")
    assets: dict[str, str] = {}
    for asset in release.get("assets", []):
        name = asset.get("name")
        url = asset.get("browser_download_url")
        if name and url:
            assets[str(name)] = str(url)

    payload = {
        "version": version,
        "tag": tag,
        "releaseUrl": release.get("html_url"),
        "publishedAt": release.get("published_at"),
        "assets": assets,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {args.output} from {tag} with {len(assets)} asset(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
