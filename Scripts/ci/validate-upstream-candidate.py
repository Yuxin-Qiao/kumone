#!/usr/bin/env python3
"""Fail-closed checks for an immutable upstream compatibility candidate.

The workflow performs the merge and ownership resolution.  This small,
dependency-free verifier is intentionally deterministic so it can be run in
CI and in a local dry-run without GitHub credentials.

Apple/iOS paths are upstream-owned, but they are not immutable across an
upstream sync: an upstream release is allowed to change them.  The important
invariant is that the candidate's protected tree is byte-for-byte identical to
the upstream tree.  Comparing ``base..candidate`` would reject legitimate
upstream changes, so the verifier reports the upstream delta separately and
only rejects the candidate-to-upstream drift introduced by downstream work.
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
    args = ["diff", "--no-renames", "--name-only", left, right, "--"]
    args.extend(pathspec)
    output = git(*args)
    return [line for line in output.splitlines() if line]


def apple_delta(
    merge_base: str, base_sha: str, candidate_sha: str, upstream_sha: str
) -> dict[str, list[str]]:
    """Classify protected-path changes without treating upstream changes as violations."""

    return {
        # This is the allowed upstream-owned change set.
        "upstream_apple_delta": changed_paths(merge_base, upstream_sha, PROTECTED_APPLE_PATHS),
        # Useful evidence about protected changes already present on main.
        "preexisting_downstream_apple_delta": changed_paths(merge_base, base_sha, PROTECTED_APPLE_PATHS),
        # Any final drift means the candidate does not carry upstream's tree
        # verbatim and therefore contains downstream-added Apple content.
        "downstream_added_apple_delta": changed_paths(upstream_sha, candidate_sha, PROTECTED_APPLE_PATHS),
    }


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

    merge_base = git("merge-base", base_sha, upstream_sha)
    deltas = apple_delta(merge_base, base_sha, candidate_sha, upstream_sha)
    downstream_added = deltas["downstream_added_apple_delta"]
    if downstream_added:
        details = ", ".join(downstream_added[:20])
        raise SystemExit(
            "candidate protected Apple/iOS tree differs from upstream; "
            "downstream-added Apple content is forbidden: "
            + details
        )

    payload = {
        "base_sha": base_sha,
        "candidate_sha": candidate_sha,
        "upstream_sha": upstream_sha,
        "merge_base": merge_base,
        "ownership_conflict_count": args.conflict_count,
        "ambiguous_conflicts": False,
        # Preserve the historical field name for the forbidden/violation set;
        # the allowed upstream set is exposed explicitly below.
        "protected_apple_changes": downstream_added,
        "upstream_apple_delta": deltas["upstream_apple_delta"],
        "preexisting_downstream_apple_delta": deltas["preexisting_downstream_apple_delta"],
        "downstream_added_apple_delta": downstream_added,
        "candidate_is_based_on_base": True,
    }
    print(json.dumps(payload, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
