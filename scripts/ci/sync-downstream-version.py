#!/usr/bin/env python3
"""Synchronize downstream package defaults with the latest CHANGELOG version."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHANGELOG = ROOT / "CHANGELOG.md"
CARGO = ROOT / "Cargo.toml"
TAURI = ROOT / "apps/windows/src-tauri/tauri.conf.json"
ANDROID = ROOT / "apps/android/app/build.gradle.kts"

VERSION_RE = re.compile(r"^## ([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?) - ", re.MULTILINE)


def latest_version() -> str:
    match = VERSION_RE.search(CHANGELOG.read_text(encoding="utf-8"))
    if not match:
        raise SystemExit("Could not resolve latest version from CHANGELOG.md")
    return match.group(1)


def desired_contents(version: str) -> dict[Path, str]:
    cargo = CARGO.read_text(encoding="utf-8")
    cargo_new, n = re.subn(
        r'(\[workspace\.package\]\s*\nversion = ")[^"]+("\s*\n)',
        rf"\g<1>{version}\g<2>",
        cargo,
        count=1,
    )
    if n != 1:
        raise SystemExit("Could not update [workspace.package] version in Cargo.toml")

    tauri_data = json.loads(TAURI.read_text(encoding="utf-8"))
    tauri_data["version"] = version
    tauri_new = json.dumps(tauri_data, ensure_ascii=False, indent=2) + "\n"

    android = ANDROID.read_text(encoding="utf-8")
    android_new, n = re.subn(
        r'(val kumoneVersionName = providers\.gradleProperty\("kumoneVersion"\)\.orElse\(")[^"]+("\))',
        rf"\g<1>{version}\g<2>",
        android,
        count=1,
    )
    if n != 1:
        raise SystemExit("Could not update Android default version")

    return {CARGO: cargo_new, TAURI: tauri_new, ANDROID: android_new}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail instead of rewriting drifted files")
    args = parser.parse_args()

    version = latest_version()
    desired = desired_contents(version)
    drifted: list[Path] = []

    for path, content in desired.items():
        current = path.read_text(encoding="utf-8")
        if current != content:
            drifted.append(path)
            if not args.check:
                path.write_text(content, encoding="utf-8")

    if drifted and args.check:
        print(f"Downstream version must be {version}; drift detected in:")
        for path in drifted:
            print(f"- {path.relative_to(ROOT)}")
        print("Run: python3 scripts/ci/sync-downstream-version.py")
        return 1

    action = "verified" if args.check else "synchronized"
    print(f"Downstream version {action}: {version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
