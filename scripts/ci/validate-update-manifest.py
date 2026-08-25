#!/usr/bin/env python3
"""Validate generated update metadata and its local checksums."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("asset_dir", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1 or manifest.get("product") != "kumone":
        raise SystemExit("invalid update manifest identity")
    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        raise SystemExit("update manifest has no assets")
    signatures = [item.get("signature") for item in assets]
    if manifest.get("signed") and (not manifest.get("public_key_id") or not all(signatures)):
        raise SystemExit("signed update manifest is missing public key or asset signatures")
    for asset in assets:
        parsed = urlparse(asset.get("url", ""))
        if parsed.scheme != "https":
            raise SystemExit("update asset URL must use HTTPS")
        name = Path(parsed.path).name
        path = args.asset_dir / name
        if not path.is_file() or sha256(path) != asset.get("sha256"):
            raise SystemExit(f"checksum mismatch for update asset {name}")
    print(f"update manifest: {len(assets)} assets validated; signed={bool(manifest.get('signed'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
