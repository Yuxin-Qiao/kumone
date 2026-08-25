#!/usr/bin/env python3
"""Validate the small cross-platform contracts without external dependencies."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load(name: str) -> dict:
    path = ROOT / "contracts" / name
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    return value


def main() -> int:
    ui = load("ui-state.json")
    if ui.get("schema_version") != 1 or not ui.get("operations"):
        raise ValueError("ui-state contract is incomplete")
    colors = ui.get("tokens", {}).get("colors", {})
    required_colors = {"background", "surface", "accent", "text_primary", "text_secondary", "error"}
    if not required_colors <= colors.keys():
        raise ValueError("ui-state contract is missing required colors")
    if any(not re.fullmatch(r"#[0-9a-fA-F]{6}", value) for value in colors.values()):
        raise ValueError("ui-state colors must be six-digit hex values")

    update = load("update-manifest.schema.json")
    if update.get("properties", {}).get("schema_version", {}).get("const") != 1:
        raise ValueError("update manifest schema version must be 1")
    platforms = update["properties"]["assets"]["items"]["properties"]["platform"]["enum"]
    if set(platforms) != {"windows-x64", "linux-x86_64", "android"}:
        raise ValueError("update manifest platform set drifted")

    diagnostics = load("diagnostics.schema.json")
    if diagnostics.get("properties", {}).get("privacy", {}).get("const") != {
        "redacted": True,
        "network_upload": False,
    }:
        raise ValueError("diagnostics contract must remain local and redacted")
    budgets = load("package-budgets.json")
    expected_budgets = {
        "windows_installer": 15,
        "linux_appimage": 80,
        "linux_deb": 25,
        "linux_rpm": 25,
        "android_apk": 15,
    }
    if budgets.get("schema_version") != 1 or budgets.get("budgets_mib") != expected_budgets:
        raise ValueError("package budgets drifted from the release policy")
    print("contracts: ui-state, update-manifest and diagnostics are valid")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"contracts: invalid: {error}", file=sys.stderr)
        raise SystemExit(1)
