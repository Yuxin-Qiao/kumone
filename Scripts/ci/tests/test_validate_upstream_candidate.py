#!/usr/bin/env python3
"""Regression tests for the upstream-owned Apple/iOS candidate boundary."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
VALIDATOR = ROOT / "Scripts/ci/validate-upstream-candidate.py"


def run_git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout.strip()


def write(repo: Path, relative: str, contents: str) -> None:
    path = repo / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents, encoding="utf-8")


class UpstreamCandidateBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.repo = Path(self.tempdir.name)
        run_git(self.repo, "init", "-q")
        run_git(self.repo, "config", "user.name", "Boundary Test")
        run_git(self.repo, "config", "user.email", "boundary@example.invalid")
        write(self.repo, "Sources/Kumone/Player.swift", "let player = \"base\"\n")
        write(self.repo, "Package.swift", "// base package\n")
        run_git(self.repo, "add", ".")
        run_git(self.repo, "commit", "-qm", "base")
        self.base_sha = run_git(self.repo, "rev-parse", "HEAD")

        run_git(self.repo, "checkout", "-qb", "upstream")
        write(self.repo, "Sources/Kumone/Player.swift", "let player = \"upstream\"\n")
        write(self.repo, "Sources/Kumone/UpstreamOnly.swift", "let upstreamOnly = true\n")
        write(self.repo, "Package.swift", "// upstream package\n")
        run_git(self.repo, "add", ".")
        run_git(self.repo, "commit", "-qm", "upstream Apple changes")
        self.upstream_sha = run_git(self.repo, "rev-parse", "HEAD")

        run_git(self.repo, "checkout", "-qb", "candidate", self.base_sha)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def make_candidate(self, *, downstream_apple_edit: bool = False) -> str:
        run_git(self.repo, "merge", "--no-commit", "--no-ff", self.upstream_sha)
        if downstream_apple_edit:
            write(self.repo, "Sources/Kumone/Player.swift", "let player = \"downstream\"\n")
        write(self.repo, ".github/maintenance/upstream.json", "{}\n")
        run_git(self.repo, "add", ".")
        run_git(self.repo, "commit", "-qm", "candidate")
        return run_git(self.repo, "rev-parse", "HEAD")

    def run_validator(self, candidate_sha: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(VALIDATOR),
                "--base-sha",
                self.base_sha,
                "--candidate-sha",
                candidate_sha,
                "--upstream-sha",
                self.upstream_sha,
            ],
            cwd=self.repo,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def test_upstream_apple_delta_is_allowed_and_reported_separately(self) -> None:
        candidate_sha = self.make_candidate()
        result = self.run_validator(candidate_sha)
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(
            payload["upstream_apple_delta"],
            [
                "Package.swift",
                "Sources/Kumone/Player.swift",
                "Sources/Kumone/UpstreamOnly.swift",
            ],
        )
        self.assertEqual(payload["downstream_added_apple_delta"], [])
        self.assertEqual(payload["preexisting_downstream_apple_delta"], [])

    def test_downstream_apple_edit_is_fail_closed(self) -> None:
        candidate_sha = self.make_candidate(downstream_apple_edit=True)
        result = self.run_validator(candidate_sha)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("downstream-added Apple content is forbidden", result.stderr)
        self.assertIn("Sources/Kumone/Player.swift", result.stderr)

    def test_non_apple_downstream_normalization_remains_allowed(self) -> None:
        run_git(self.repo, "merge", "--no-commit", "--no-ff", self.upstream_sha)
        write(self.repo, "Cargo.toml", "[workspace.package]\nversion = \"0.3.5\"\n")
        run_git(self.repo, "add", ".")
        run_git(self.repo, "commit", "-qm", "candidate normalization")
        candidate_sha = run_git(self.repo, "rev-parse", "HEAD")
        result = self.run_validator(candidate_sha)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_preexisting_unrelated_apple_content_is_not_silently_carried(self) -> None:
        run_git(self.repo, "merge", "--no-commit", "--no-ff", self.upstream_sha)
        write(self.repo, "Sources/Kumone/DownstreamOnly.swift", "let downstreamOnly = true\n")
        run_git(self.repo, "add", ".")
        run_git(self.repo, "commit", "-qm", "candidate with extra Apple content")
        candidate_sha = run_git(self.repo, "rev-parse", "HEAD")
        result = self.run_validator(candidate_sha)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Sources/Kumone/DownstreamOnly.swift", result.stderr)


if __name__ == "__main__":
    unittest.main()
