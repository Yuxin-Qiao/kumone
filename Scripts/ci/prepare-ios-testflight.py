#!/usr/bin/env python3
"""Apply the small downstream patch needed for an upstream iOS archive.

The iOS source is checked out from missuo/kumone by the TestFlight workflow.
Only build identity and version settings are changed here; the upstream Swift
sources, project structure, and resources remain untouched.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:\.\d+)?$")


def set_xcconfig_value(text: str, key: str, value: str) -> str:
    pattern = re.compile(rf"(?m)^{re.escape(key)}\s*=.*$")
    replacement = f"{key} = {value}"
    text, count = pattern.subn(replacement, text, count=1)
    if count == 0:
        suffix = "" if text.endswith("\n") else "\n"
        text += f"{suffix}{replacement}\n"
    return text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--team-id")
    args = parser.parse_args()

    if not SEMVER_RE.fullmatch(args.version):
        raise SystemExit(f"invalid marketing version: {args.version}")
    if not args.build_number.isdigit() or int(args.build_number) < 1:
        raise SystemExit(f"invalid build number: {args.build_number}")
    if not re.fullmatch(r"[A-Za-z0-9.-]+", args.bundle_id):
        raise SystemExit("bundle ID contains unsupported characters")
    if args.team_id and not re.fullmatch(r"[A-Z0-9]{10}", args.team_id):
        raise SystemExit("Apple team ID must be a 10-character alphanumeric value")

    config_path = args.root / "ios/Config/Shared.xcconfig"
    if not config_path.is_file():
        raise SystemExit(f"missing upstream iOS config: {config_path}")
    text = config_path.read_text(encoding="utf-8")
    text = set_xcconfig_value(text, "PRODUCT_BUNDLE_IDENTIFIER", args.bundle_id)
    text = set_xcconfig_value(text, "MARKETING_VERSION", args.version)
    text = set_xcconfig_value(text, "CURRENT_PROJECT_VERSION", args.build_number)
    if args.team_id:
        text = set_xcconfig_value(text, "DEVELOPMENT_TEAM", args.team_id)
    config_path.write_text(text, encoding="utf-8")

    print(
        json.dumps(
            {
                "config": str(config_path),
                "bundle_id": args.bundle_id,
                "marketing_version": args.version,
                "current_project_version": args.build_number,
                "team_id_configured": bool(args.team_id),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
