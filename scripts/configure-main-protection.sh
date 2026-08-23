#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
BRANCH="${2:-main}"

cat <<'JSON' | gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input -
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Rust core",
      "Windows Tauri shell",
      "Android Compose + Media3 + Rust",
      "Dependency Review",
      "CodeQL (rust)",
      "CodeQL (java-kotlin)",
      "CodeQL (javascript-typescript)",
      "CodeQL (actions)"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

echo "Protected ${REPO}:${BRANCH} with required PR + CI gates."
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --jq '{required_status_checks: .required_status_checks.contexts, enforce_admins: .enforce_admins.enabled, required_pull_request_reviews: (.required_pull_request_reviews != null), required_conversation_resolution: .required_conversation_resolution.enabled, allow_force_pushes: .allow_force_pushes.enabled, allow_deletions: .allow_deletions.enabled}'
