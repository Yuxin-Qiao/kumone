#!/usr/bin/env python3
"""One-shot repair for semantic-sync shell metadata and release dispatch auth."""

from __future__ import annotations

import re
from pathlib import Path


WORKFLOW = Path(".github/workflows/semantic-sync-upstream.yml")


def main() -> int:
    text = WORKFLOW.read_text(encoding="utf-8")

    # Markdown code ticks inside double-quoted shell strings and unquoted
    # heredocs were being treated as command substitutions. There are no
    # intentional legacy backtick command substitutions in this workflow;
    # modern shell substitutions use $(). Preserve Markdown by escaping only
    # ticks that are not already escaped.
    text, tick_count = re.subn(r"(?<!\\)`", r"\\`", text)
    if tick_count == 0:
        print("semantic metadata backticks already safe")

    marker = """      - id: merge\n        name: Revalidate every merge condition and dispatch release\n        env:\n          GH_TOKEN: ${{ secrets.RELEASE_TOKEN || github.token }}\n"""
    replacement = """      - id: merge\n        name: Revalidate every merge condition and dispatch release\n        env:\n          GH_TOKEN: ${{ secrets.RELEASE_TOKEN || github.token }}\n          ACTIONS_TOKEN: ${{ github.token }}\n"""
    if marker in text:
        text = text.replace(marker, replacement, 1)
    elif replacement not in text:
        raise SystemExit("could not locate auto-merge environment block")

    dispatch = """          gh workflow run release-downstream.yml --repo \"$GITHUB_REPOSITORY\" --ref main \\\n            -f source_ref=\"$MERGED_SHA\" -f version=\"$VERSION\" \\\n            -f tag_suffix=\"$UPSTREAM_TAG_SUFFIX\" -f prerelease=\"$UPSTREAM_PRERELEASE\"\n"""
    safe_dispatch = """          GH_TOKEN=\"$ACTIONS_TOKEN\" gh workflow run release-downstream.yml --repo \"$GITHUB_REPOSITORY\" --ref main \\\n            -f source_ref=\"$MERGED_SHA\" -f version=\"$VERSION\" \\\n            -f tag_suffix=\"$UPSTREAM_TAG_SUFFIX\" -f prerelease=\"$UPSTREAM_PRERELEASE\"\n"""
    if dispatch in text:
        text = text.replace(dispatch, safe_dispatch, 1)
    elif safe_dispatch not in text:
        raise SystemExit("could not locate downstream release dispatch")

    # Fail the repair itself if any raw backtick remains. This protects future
    # Markdown summary/body edits from silently becoming shell commands.
    raw_ticks = [
        (idx, line)
        for idx, line in enumerate(text.splitlines(), start=1)
        if re.search(r"(?<!\\)`", line)
    ]
    if raw_ticks:
        preview = "; ".join(f"{n}:{line.strip()}" for n, line in raw_ticks[:10])
        raise SystemExit("unescaped shell backticks remain: " + preview)

    if 'GH_TOKEN="$ACTIONS_TOKEN" gh workflow run release-downstream.yml' not in text:
        raise SystemExit("release dispatch is not using the job-scoped Actions token")

    WORKFLOW.write_text(text, encoding="utf-8")
    print(f"semantic sync metadata repaired; escaped {tick_count} Markdown backticks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
