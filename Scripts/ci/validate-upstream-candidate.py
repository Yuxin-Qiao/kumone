#!/usr/bin/env python3
"""Fail-closed checks for an immutable upstream compatibility candidate.

The workflow performs the merge and ownership resolution. This small,
dependency-free verifier is intentionally deterministic so it can be run in
CI and in a local dry-run without GitHub credentials. Apple/iOS is
upstream-owned: upstream changes pass through exactly, while any downstream
candidate divergence on protected Apple paths is rejected.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess


SHA_RE = re.compile(r"^[0-9a-f]{40}$")
PROTECTED_APPLE_PATHS = (
    "Sources/Kumone/",
    "Sources/KumoneLauncher/",
    "Package.swift",
    "Package.resolved",
    "AppIcon.icon/",
    "ios/",
)


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout.strip()


def require_sha(name: str, value: str) -> str:
    if not SHA_RE.fullmatch(value):
        raise SystemExit(f"{name} must be a full 40-character lowercase commit SHA")
    try:
        git("cat-file", "-e", f"{value}^{{commit}}")
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"{name} is not available as a commit in this checkout") from exc
    return value


def changed_paths(left: str, right: str, pathspec: tuple[str, ...] = ()) -> list[str]:
    args = ["diff", "--name-only", left, right, "--"]
    args.extend(pathspec)
    output = git(*args)
    return [line for line in output.splitlines() if line]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-sha", required=True)
    parser.add_argument("--candidate-sha", required=True)
    parser.add_argument("--upstream-sha", required=True)
    parser.add_argument("--conflict-count", type=int, default=0)
    parser.add_argument("--ambiguous-conflicts", action="store_true")
    args = parser.parse_args()

    base_sha = require_sha("base-sha", args.base_sha)
    candidate_sha = require_sha("candidate-sha", args.candidate_sha)
    upstream_sha = require_sha("upstream-sha", args.upstream_sha)
    if args.conflict_count < 0:
        raise SystemExit("conflict-count cannot be negative")
    if args.ambiguous_conflicts:
        raise SystemExit("candidate has ambiguous ownership conflicts")

    try:
        git("merge-base", "--is-ancestor", base_sha, candidate_sha)
    except subprocess.CalledProcessError as exc:
        raise SystemExit("candidate is not based on the current main SHA") from exc

    # Apple/iOS is upstream-owned, not frozen. Upstream releases are allowed to
    # add, modify, rename or delete protected Apple files. The downstream
    # candidate must carry the upstream tree byte-for-byte on those paths,
    # which prevents automation or adapters from adding their own Apple edits.
    apple_divergence = changed_paths(upstream_sha, candidate_sha, PROTECTED_APPLE_PATHS)
    if apple_divergence:
        details = ", ".join(apple_divergence[:20])
        raise SystemExit(
            "candidate diverges from upstream on protected Apple/iOS paths: " + details
        )

    upstream_apple_changes = changed_paths(base_sha, upstream_sha, PROTECTED_APPLE_PATHS)
    payload = {
        "base_sha": base_sha,
        "candidate_sha": candidate_sha,
        "upstream_sha": upstream_sha,
        "ownership_conflict_count": args.conflict_count,
        "ambiguous_conflicts": False,
        "protected_apple_changes": [],
        "upstream_apple_changes": upstream_apple_changes,
        "candidate_apple_tree_matches_upstream": True,
        "candidate_is_based_on_base": True,
    }
    print(json.dumps(payload, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
