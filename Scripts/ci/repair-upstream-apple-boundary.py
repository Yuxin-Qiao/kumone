#!/usr/bin/env python3
"""One-shot exact repair for the semantic upstream Apple ownership boundary."""

from __future__ import annotations

from pathlib import Path


WORKFLOW = Path(".github/workflows/semantic-sync-upstream.yml")

OLD_BOUNDARY = r'''          # The Apple/iOS boundary is immutable for downstream maintenance:
          # neither an upstream Apple change nor an adapter-side change may be
          # carried into an automated candidate. Compare with current main,
          # rather than only comparing with upstream, so an upstream release
          # cannot silently modify iOS/iPadOS as a side effect of a sync.
          APPLE_DIFF=$(git diff --name-only "$BASE_SHA" "$CANDIDATE_SHA" -- \
            Sources/Kumone Sources/KumoneLauncher Package.swift Package.resolved AppIcon.icon ios)
          [[ -z "$APPLE_DIFF" ]] || {
            PROTECTED_APPLE_CHANGES=1
            echo "::error::Candidate modifies protected Apple/iOS paths; manual review is required: $APPLE_DIFF"
            exit 1
          }
'''

NEW_BOUNDARY = r'''          # Apple/iOS is upstream-owned, not frozen. Upstream releases may
          # change protected Apple paths, but the downstream candidate must
          # reproduce the upstream tree exactly there. Any adapter-side or
          # automation-added Apple mutation therefore fails closed.
          APPLE_DIFF=$(git diff --name-only "$UPSTREAM_SHA" "$CANDIDATE_SHA" -- \
            Sources/Kumone Sources/KumoneLauncher Package.swift Package.resolved AppIcon.icon ios)
          [[ -z "$APPLE_DIFF" ]] || {
            PROTECTED_APPLE_CHANGES=1
            echo "::error::Candidate diverges from upstream on protected Apple/iOS paths: $APPLE_DIFF"
            exit 1
          }
'''

OLD_UPSTREAM_CONFLICT = r'''                  echo "upstream owns conflict: $path"
                  git checkout --theirs -- "$path"
                  git add -- "$path"
'''

NEW_UPSTREAM_CONFLICT = r'''                  echo "upstream owns conflict: $path"
                  if git cat-file -e "$UPSTREAM_SHA:$path" 2>/dev/null; then
                    git checkout "$UPSTREAM_SHA" -- "$path"
                  else
                    git rm -f --ignore-unmatch -- "$path"
                  fi
                  git add -A -- "$path"
'''


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0 and new in text:
        return text
    if count != 1:
        raise SystemExit(f"expected exactly one {label} block, found {count}")
    return text.replace(old, new, 1)


def main() -> int:
    text = WORKFLOW.read_text(encoding="utf-8")
    text = replace_exact(text, OLD_BOUNDARY, NEW_BOUNDARY, "Apple boundary")
    text = replace_exact(
        text,
        OLD_UPSTREAM_CONFLICT,
        NEW_UPSTREAM_CONFLICT,
        "upstream conflict resolution",
    )
    WORKFLOW.write_text(text, encoding="utf-8")
    print("semantic upstream Apple ownership boundary repaired")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
