# Automated upstream maintenance

Kumone's downstream maintenance is intentionally fail-closed and serialized in
`.github/workflows/semantic-sync-upstream.yml`.

## Normal transaction

1. The scheduled health check discovers the current `missuo/kumone` commit and
   version.
2. Semantic Sync refreshes a candidate from the current `main` SHA. A stale
   candidate is superseded automatically; the old Draft PR and branch are
   removed only when its first-parent commits are proven to be Actions-owned.
3. The candidate is immutable while Core/Web, Windows, Android, Linux, CodeQL,
   Dependency Review, version, ownership, Apple boundary and package-budget
   gates run.
4. Only a candidate whose branch SHA and base SHA still match the policy is
   marked Ready and squash-merged with an expected-head SHA.
5. A successful merge dispatches the Windows NSIS, Linux AppImage/deb/rpm and
   Android APK/AAB release pipeline. Existing tags/releases are never
   overwritten. Windows signing is reported as either Authenticode-verified or
   an explicit unsigned fallback.
6. Web/PWA `latest.json` is generated from the latest published stable release,
   verified, and committed back with `[skip ci]`.

## Failure and recovery

Health checks rerun safe main CI failures, rebuild stale candidates, and retry
metadata publication. A single fixed automation issue is opened or updated
when a failure persists; it is closed automatically after recovery. User bug
reports are never closed by maintenance automation.

Apple/macOS/iOS/iPadOS sources remain upstream-owned. Ambiguous merge conflicts,
protected Apple changes, missing Android signing identity, an existing release
tag, or repeated CI failures stop the transaction and require a maintainer.
