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
- future `apps/windows/**`
- future `apps/android/**`
- downstream CI/CD
- compatibility reports and porting metadata
- Windows/Android packaging and release logic

## Upstream synchronization policy

Never merge upstream directly into `main` without downstream validation.

Required flow:

1. scheduled watcher detects a new upstream commit/tag;
2. create/update an `upstream-sync/*` branch;
3. merge or replay upstream changes on that branch;
4. generate a compatibility report;
5. run Rust Core, Windows and Android CI;
6. open/update a bot PR;
7. merge only after required checks pass;
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

- `ci-core.yml` — fmt, clippy, tests
- `ci-windows.yml` — Tauri build and Windows smoke tests
- `ci-android.yml` — Gradle lint/test/build and Rust Android bridge checks
- `upstream-watch.yml` — detect upstream changes
- `upstream-sync.yml` — create sync branch/PR and compatibility report
- `nightly.yml` — API/protocol smoke checks without formal release
- `release.yml` — orchestration only; publish signed downstream artifacts

The release workflow should not contain all platform build logic itself.

## Release artifacts

Windows:

- `Kumone-<version>-x64-setup.exe`
- optional `.msi`
- optional portable `.zip`
- updater metadata/signatures

Android:

- signed `arm64-v8a` APK for direct GitHub installation
- signed AAB for Google Play

Common:

- SHA256 checksums
- release notes
- upstream commit/tag provenance

## Versioning

Do not couple downstream fixes 1:1 to upstream tags.

Recommended pattern:

```text
upstream: v0.4.0
downstream: v0.4.0-kumone.1
hotfix: v0.4.0-kumone.2
next upstream: v0.4.1-kumone.1
```

## Migration phases

### Phase 0 — foundation

- create Rust workspace
- add `kumone-core`
- establish Rust CI
- document ownership and migration boundaries
- preserve all current production implementations

### Phase 1 — port deterministic core logic

Port in this order:

1. crypto test vectors
2. models
3. API client/request construction
4. lyrics parser
5. unblock matching/fallback logic
6. queue rules

Keep golden-vector tests against the existing Swift/JS behavior during migration.

### Phase 2 — Windows Electron to Tauri

- reuse existing web UI initially
- replace Electron main/preload IPC with Tauri commands
- connect Tauri commands to `kumone-core`
- restore SMTC/media key integration
- add package size/startup/memory benchmarks
- delete Electron only after feature parity

### Phase 3 — Android native app

- create Compose shell and navigation
- connect Rust core bridge
- add Media3/ExoPlayer playback
- add MediaSessionService/background playback
- add account/login, home, search, library, player and lyrics parity
- build signed APK/AAB in CI

### Phase 4 — automation hardening

- replace direct-to-main upstream merge with bot PR flow
- add compatibility report generation
- add nightly API smoke checks
- add downstream release orchestration
- add signing/updater secret handling

### Phase 5 — remove migration debt

Only after Windows + Android are stable:

- remove legacy Electron implementation
- remove duplicate JS crypto/API/unblock code
- simplify release workflows
- tighten bundle-size and performance budgets

## Non-goals

- rewriting SwiftUI/macOS UI in Rust
- using a Rust UI toolkit for Android
- creating a single cross-platform playback engine
- deleting working legacy code before parity exists
- auto-merging semantic upstream changes without CI gates

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
