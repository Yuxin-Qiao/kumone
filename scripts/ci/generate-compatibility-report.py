#!/usr/bin/env python3
"""Generate a deterministic community compatibility report from GitHub Issues JSON."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHANGELOG = ROOT / "CHANGELOG.md"
PLATFORMS = [
    ("platform:windows", "Windows", "Tauri 2 + Rust"),
    ("platform:android", "Android", "Jetpack Compose + Rust"),
    ("platform:linux", "Linux", "Tauri 2 + Rust"),
    ("platform:web", "Web / PWA / Docker", "Web/PWA"),
    ("platform:macos", "macOS", "Upstream-aligned SwiftUI"),
]


def latest_version() -> str:
    text = CHANGELOG.read_text(encoding="utf-8")
    match = re.search(r"^## ([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?) - ", text, re.MULTILINE)
    return match.group(1) if match else "unknown"


def label_names(issue: dict) -> set[str]:
    labels = issue.get("labels", [])
    result: set[str] = set()
    for label in labels:
        if isinstance(label, dict):
            name = label.get("name")
        else:
            name = str(label)
        if name:
            result.add(name)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("issues_json", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    issues = json.loads(args.issues_json.read_text(encoding="utf-8"))
    bugs = [issue for issue in issues if "bug" in label_names(issue)]
    version = latest_version()

    lines = [
        "# Community Compatibility Feedback",
        "",
        "This report is generated automatically from structured GitHub bug reports. It is a community feedback signal, **not a certification matrix** and not a manual release gate.",
        "",
        f"Current upstream-aligned downstream version: **{version}**.",
        "",
        "| Platform | Runtime | Open bug reports | Closed bug reports | Signal |",
        "| --- | --- | ---: | ---: | --- |",
    ]

    for label, platform, runtime in PLATFORMS:
        platform_bugs = [issue for issue in bugs if label in label_names(issue)]
        open_count = sum(issue.get("state") == "OPEN" for issue in platform_bugs)
        closed_count = sum(issue.get("state") == "CLOSED" for issue in platform_bugs)
        signal = "No open reports" if open_count == 0 else f"{open_count} open report(s)"
        lines.append(f"| {platform} | {runtime} | {open_count} | {closed_count} | {signal} |")

    open_bugs = [issue for issue in bugs if issue.get("state") == "OPEN"]
    open_bugs.sort(key=lambda item: item.get("createdAt", ""), reverse=True)

    lines.extend(["", "## Recent open compatibility reports", ""])
    if not open_bugs:
        lines.append("No open structured compatibility bug reports.")
    else:
        lines.extend([
            "| Issue | Platform | Version | Title |",
            "| --- | --- | --- | --- |",
        ])
        for issue in open_bugs[:25]:
            labels = label_names(issue)
            platform = next((name for label, name, _ in PLATFORMS if label in labels), "Unclassified")
            version_label = next((name.removeprefix("version:") for name in labels if name.startswith("version:")), "unknown")
            title = str(issue.get("title", "")).replace("|", "\\|")
            number = issue.get("number", "?")
            url = issue.get("url", "")
            lines.append(f"| [#{number}]({url}) | {platform} | {version_label} | {title} |")

    lines.extend([
        "",
        "## Policy",
        "",
        "- Releases are gated by automated tests, package validation, signing where configured, checksums, and provenance.",
        "- Real-device approval is not required before publication.",
        "- Community reports are automatically classified by platform, version, architecture, package type, affected area, and severity when those fields are present.",
        "- Automation may summarize and label reports, but it must not automatically close a bug solely from a model-generated judgment.",
        "- iOS/iPadOS remains upstream-owned and is intentionally outside the downstream release matrix.",
        "",
    ])

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
