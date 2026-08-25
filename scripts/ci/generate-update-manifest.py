#!/usr/bin/env python3
"""Create a deterministic, checksum-backed update manifest.

The manifest is intentionally fail-safe: assets are marked installable only
when an external trusted signature is supplied.  Missing signing secrets never
turn into an unsigned auto-install path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urljoin


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--channel", choices=("stable", "prerelease"), required=True)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--asset", action="append", default=[], metavar="PLATFORM=PATH")
    parser.add_argument("--signature", action="append", default=[], metavar="PLATFORM=SIGNATURE")
    parser.add_argument("--public-key-id")
    args = parser.parse_args()

    signatures = dict(value.split("=", 1) for value in args.signature)
    assets = []
    for spec in args.asset:
        platform, raw_path = spec.split("=", 1)
        path = Path(raw_path)
        if not path.is_file():
            raise SystemExit(f"missing update asset: {path}")
        name = path.name
        assets.append({
            "platform": platform,
            "url": urljoin(args.base_url.rstrip("/") + "/", name),
            "sha256": digest(path),
            "signature": signatures.get(platform),
        })

    signed = bool(args.public_key_id and assets and all(item["signature"] for item in assets))
    payload = {
        "schema_version": 1,
        "product": "kumone",
        "version": args.version,
        "channel": args.channel,
        "signed": signed,
        "public_key_id": args.public_key_id if signed else None,
        "assets": assets,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"version": args.version, "signed": signed, "assets": len(assets)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
