#!/usr/bin/env python3
"""Regression tests for the semantic upstream Apple ownership boundary."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


VALIDATOR = Path(__file__).with_name("validate-upstream-candidate.py").resolve()


def run(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def git(cwd: Path, *args: str) -> str:
    return run(cwd, "git", *args).stdout.strip()


def commit_all(cwd: Path, message: str) -> str:
    git(cwd, "add", "-A")
    git(cwd, "commit", "-m", message)
    return git(cwd, "rev-parse", "HEAD")


def validate(cwd: Path, base: str, candidate: str, upstream: str) -> subprocess.CompletedProcess[str]:
    return run(
        cwd,
        sys.executable,
        str(VALIDATOR),
        "--base-sha",
        base,
        "--candidate-sha",
        candidate,
        "--upstream-sha",
        upstream,
        check=False,
    )


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="kumone-upstream-boundary-") as tmp:
        repo = Path(tmp)
        git(repo, "init", "-b", "main")
        git(repo, "config", "user.name", "Kumone CI")
        git(repo, "config", "user.email", "ci@example.invalid")

        apple = repo / "Sources/Kumone/Core/Models/LyricsParser.swift"
        apple.parent.mkdir(parents=True)
        apple.write_text("let version = 1\n", encoding="utf-8")
        ios = repo / "ios/UpstreamMarker.txt"
        ios.parent.mkdir(parents=True)
        ios.write_text("base\n", encoding="utf-8")
        (repo / "README.md").write_text("base\n", encoding="utf-8")
        base = commit_all(repo, "base")

        git(repo, "checkout", "-b", "upstream")
        apple.write_text("let version = 2 // upstream\n", encoding="utf-8")
        ios.write_text("upstream\n", encoding="utf-8")
        upstream = commit_all(repo, "upstream changes Apple code")

        git(repo, "checkout", "-b", "candidate-good", base)
        apple.write_text("let version = 2 // upstream\n", encoding="utf-8")
        ios.write_text("upstream\n", encoding="utf-8")
        (repo / "downstream.txt").write_text("adapter change\n", encoding="utf-8")
        candidate_good = commit_all(repo, "candidate preserves upstream Apple tree")
        good = validate(repo, base, candidate_good, upstream)
        if good.returncode != 0:
            raise SystemExit(
                "upstream-origin Apple changes should be accepted:\n"
                + good.stdout
                + good.stderr
            )
        payload = json.loads(good.stdout)
        if payload["merge_base"] != base:
            raise SystemExit("validator did not report the shared merge base")
        expected_upstream_delta = {
            "Sources/Kumone/Core/Models/LyricsParser.swift",
            "ios/UpstreamMarker.txt",
        }
        if set(payload["upstream_apple_delta"]) != expected_upstream_delta:
            raise SystemExit("upstream Apple delta was not reported separately")
        if payload["downstream_added_apple_delta"] != []:
            raise SystemExit("clean candidate reported downstream Apple additions")

        git(repo, "checkout", "-b", "candidate-bad", base)
        apple.write_text("let version = 999 // downstream mutation\n", encoding="utf-8")
        (repo / "downstream.txt").write_text("adapter change\n", encoding="utf-8")
        candidate_bad = commit_all(repo, "candidate mutates Apple tree")
        bad = validate(repo, base, candidate_bad, upstream)
        if bad.returncode == 0:
            raise SystemExit("downstream Apple mutation was incorrectly accepted")
        combined = bad.stdout + bad.stderr
        if "diverges from upstream on protected Apple/iOS paths" not in combined or \
            "downstream-added delta" not in combined:
            raise SystemExit("unexpected validator failure:\n" + combined)

    print("upstream Apple pass-through boundary regression tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
