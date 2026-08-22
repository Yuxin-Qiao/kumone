# Kumone Downstream Refactor

## Goal

Refactor the downstream fork into a lightweight, high-performance Windows + Android product while preserving upstream compatibility with `missuo/kumone`.

The downstream must not become a one-off rewrite. It must remain continuously maintainable as upstream Swift evolves.

## Target architecture

```text
missuo/kumone (upstream Swift)
          |
          v
  upstream compatibility layer
          |
          v
+---------------------------+
| kumone-core (Rust)        |
| API / crypto / models     |
| lyrics / unblock / queue  |
+------------+--------------+
             |
      +------+------+
      |             |
      v             v
Windows           Android
Tauri 2           Kotlin
Rust backend      Compose
WebView2 UI       Media3 / ExoPlayer
SMTC              MediaSessionService
```

## Platform decisions

### Shared core

Use Rust for platform-neutral logic:

- NetEase API request construction and response models
- weapi/eapi cryptography
- authentication/session domain logic
- lyric parsing and synchronization data
- unblock source matching and fallback policy
- playlist/queue rules
- common validation and error types

Do not put platform playback engines or platform UI into the Rust core.

### Windows

Use Tauri 2 + Rust + the existing web UI as the migration path away from Electron.

Goals:

- no bundled Chromium
- use system WebView2
- preserve Windows SMTC/media-key integration
- target installer size <= 10 MB where practical
- target near-instant startup and low idle CPU
- remove the legacy `windows/` Electron implementation only after feature parity and release validation

### Android

Use Kotlin + Jetpack Compose + Media3/ExoPlayer.

Use Android-native media primitives for:

- background playback
- MediaSessionService
- lock-screen and notification controls
- audio focus and interruptions
- Bluetooth/headset controls
- lifecycle integration

Call the shared Rust core through a stable FFI boundary (prefer UniFFI unless JNI is required for a specific capability).

Target Play-delivered download size <= 15 MB, with <= 10 MB as a stretch goal.

## Ownership boundaries

### Upstream-owned

The following remain authoritative in `missuo/kumone` and are monitored for behavioral changes:

- Swift models and API behavior
- feature semantics
- player behavior and queue semantics
- lyrics behavior
- product-level UI/UX changes worth porting

### Downstream-owned

The following are owned by this fork and must not be overwritten by upstream sync:

- `crates/**`
- `apps/windows/**`
- `apps/android/**`
- downstream CI/CD
- compatibility reports and porting metadata
- Windows/Android packaging and release logic

## Upstream synchronization policy

Never merge upstream directly into `main` without downstream validation.

Required flow:

1. scheduled watcher detects a new upstream commit/tag;
2. create/update an `automation/upstream-sync` branch;
3. merge upstream changes on that branch;
4. generate a compatibility report;
5. run Rust Core, Windows and Android CI;
6. open/update a bot PR;
7. merge only after required checks pass and semantic downstream ports are complete;
8. create a downstream release only after release gates pass.

Changes should be classified automatically:

| Upstream change | Downstream action |
| --- | --- |
| `Core/API` | inspect/port to Rust core |
| models | inspect/port to Rust core |
| lyrics/parser behavior | inspect/port to Rust core |
| player/queue semantics | inspect Rust rules + native player adapters |
| SwiftUI-only layout | Android/Windows parity review |
| docs/assets only | usually no core port required |

## CI/CD target

Separate workflows by responsibility:

- `ci-core.yml` — Rust fmt, clippy and tests
- `ci-windows.yml` — Rust/Web regression, Tauri check/clippy and optimized EXE artifact
- `ci-android.yml` — Android lint/test/APK build plus downloadable debug APK artifact
- `sync-upstream.yml` — scheduled compatibility-gated upstream branch/PR generation
- `release-downstream.yml` — Windows NSIS + signed Android APK/AAB release orchestration
- legacy workflows — kept only while the Electron/Web/macOS release path is still production-relevant

## Release artifacts

Windows:

- Tauri NSIS installer built on a Windows GitHub-hosted runner
- optional future portable package
- future updater metadata/signatures

Android:

- signed APK for direct GitHub installation
- signed AAB for Google Play

Common:

- SHA256 checksums for Android release assets
- release notes
- upstream/downstream provenance through Git history and the compatibility report

## Required GitHub Secrets

Android production releases intentionally fail closed if signing material is missing. Configure these repository Actions secrets before running `release-downstream.yml`:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

`ANDROID_KEYSTORE_BASE64` is the Base64 representation of the release/upload keystore. The keystore and passwords must never be committed to the repository.

Windows package signing is intentionally separate from the first Tauri migration milestone. Add a trusted Windows code-signing certificate in GitHub Secrets before treating the Windows release channel as production-grade; unsigned CI/preview builds may trigger SmartScreen warnings.

## Versioning

Do not couple downstream fixes 1:1 to upstream tags. Formal downstream delivery uses tags such as:

```text
upstream: v0.4.0
downstream: downstream-v0.4.0-kumone.1
hotfix: downstream-v0.4.0-kumone.2
next upstream: downstream-v0.4.1-kumone.1
```

`release-downstream.yml` can also be triggered manually with an explicit downstream version. Tag-triggered releases are formal releases; manually dispatched releases default to prerelease.

## Migration phases

### Phase 0 — foundation

Status: implemented on the refactor branch.

- Rust workspace and `kumone-core`
- Rust CI
- ownership/migration contract
- current production implementations preserved

### Phase 1 — port deterministic core logic

Status: in progress.

Completed:

- weapi/eapi Rust implementation
- fixed byte-for-byte golden vectors against the existing Swift/Node behavior

Next order:

1. models
2. API client/request construction
3. lyrics parser
4. unblock matching/fallback logic
5. queue rules

Keep golden-vector and fixture tests against existing Swift/JS behavior during migration.

### Phase 2 — Windows Electron to Tauri

Status: shell and CI established.

Completed:

- Tauri 2 application skeleton
- existing Web/PWA UI wired as the migration frontend
- Tauri commands wired directly to Rust `weapi`/`eapi`
- Windows CI validates Rust Core, Web regression, Tauri check/clippy and optimized build
- NSIS bundle enabled for downstream releases

Remaining:

- migrate remaining Electron IPC/backend behavior to Rust commands
- restore SMTC/media key integration
- add package size/startup/memory benchmarks
- delete Electron only after feature parity

### Phase 3 — Android native app

Status: native shell and CI established.

Completed:

- Kotlin/Compose native app shell
- stable API 36 release baseline
- Media3/ExoPlayer `MediaSessionService`
- lint, unit test and APK build CI
- release version/signing hooks

Remaining:

- Rust Core bridge
- account/login, home, search, library, player and lyrics parity
- playback UI/controller integration
- production signing secrets and Play delivery

### Phase 4 — automation hardening

Status: partially implemented.

Completed:

- direct-to-main upstream merge replaced by compatibility-gated bot PR flow
- compatibility report generation
- explicit Core/Windows/Android CI dispatch for bot-created sync PRs
- Cargo/Tauri/Gradle/npm/GitHub Actions Dependabot coverage
- Windows + Android downstream release workflow

Remaining:

- nightly live API/protocol smoke workflow
- semantic porting assistance for upstream Core/API changes
- Windows code signing and updater channel
- release provenance metadata automation

### Phase 5 — remove migration debt

Only after Windows + Android are stable:

- remove legacy Electron implementation
- remove duplicate JS crypto/API/unblock code where no longer required by Web
- simplify legacy release workflows
- tighten bundle-size and performance budgets

## Non-goals

- rewriting SwiftUI/macOS UI in Rust
- using a Rust UI toolkit for Android
- creating a single cross-platform playback engine
- deleting working legacy code before parity exists
- auto-merging semantic upstream changes merely because a textual merge succeeded

## Performance budgets

Initial targets, to be measured rather than assumed:

| Metric | Target |
| --- | --- |
| Windows installer | <= 10 MB where practical |
| Windows cold start | < 500 ms target on representative hardware |
| Windows idle CPU | approximately 0% |
| Windows idle memory | < 100 MB target |
| Android Play-delivered download | <= 15 MB hard target; <= 10 MB stretch |
| Android cold start | < 1 s target on representative hardware |

Every size/performance claim must eventually be backed by CI or benchmark measurements.
