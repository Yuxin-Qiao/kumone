<div align="right">

**English** | [简体中文](README_CN.md)

</div>

<div align="center">

<img src="docs/icon.png" width="140" alt="Kumone" />

# Kumone

**雲の音 — lightweight NetEase Cloud Music client across macOS, Windows, Linux, Android and Web/PWA**

Upstream Apple SwiftUI · shared Rust core · Tauri 2 desktop · Jetpack Compose Android · Web/PWA

[![macOS](https://img.shields.io/badge/macOS-15%2B-blue?logo=apple)](#platforms)
[![Windows](https://img.shields.io/badge/Windows-Tauri%202-0078D4?logo=windows11)](#platforms)
[![Linux](https://img.shields.io/badge/Linux-Tauri%202-FCC624?logo=linux&logoColor=black)](#platforms)
[![Android](https://img.shields.io/badge/Android-8%2B-3DDC84?logo=android&logoColor=white)](#platforms)
[![Rust](https://img.shields.io/badge/shared%20core-Rust-000000?logo=rust)](Cargo.toml)
[![License](https://img.shields.io/badge/license-LGPL--3.0--only-orange)](LICENSE)

</div>

## What this repository is

This fork keeps the upstream Apple implementation intact while maintaining downstream Windows, Linux, Android and Web/PWA clients plus automated synchronization, compatibility feedback, validation and publication infrastructure.

Protocol/domain behavior that benefits from sharing lives in Rust; platform media/UI layers remain native where appropriate. Apple/iOS code remains upstream-owned and is intentionally not reimplemented by the downstream project.

Upstream: [`missuo/kumone`](https://github.com/missuo/kumone)

## Platforms

| Platform | UI/runtime | Downstream status |
| --- | --- | --- |
| macOS 15+ | SwiftUI / AVPlayer | Upstream-owned native application retained |
| iOS / iPadOS | Upstream SwiftUI implementation | Upstream-owned; excluded from downstream build/release work |
| Windows x64 | Tauri 2 + shared Rust core + Web UI | Automated CI/release; NSIS |
| Linux x86_64 | Same Tauri 2 + Rust + Web desktop shell | Automated CI/release; AppImage + deb + rpm |
| Android 8+ / API 26+ | Jetpack Compose + Media3 + UniFFI/Rust | Automated CI/release; signed APK + AAB |
| Web / PWA | HTML/CSS/JavaScript + service worker | Automated smoke/PWA/protocol tests |

The legacy Electron desktop implementation has been retired. Windows and Linux now use the same Tauri/Rust desktop code path.

### Version and release status

The currently published stable downstream release is **Kumone 0.2.5**, tagged `downstream-v0.2.5`, from exact source commit `c5f4749fc63af2d45000f7aebafccb504cea6775`.

That already-published 0.2.5 release predates the Linux/Tauri Phase 2 integration, so its published assets remain Windows + Android. The automated release workflow now includes Linux; the first official Linux packages will be produced by the next upstream-aligned downstream release rather than retroactively mixing newer source into the existing 0.2.5 tag.

Package version defaults are synchronized from the latest `CHANGELOG.md` version by `scripts/ci/sync-downstream-version.py`. CI fails on version drift, and upstream automation normalizes the downstream package versions automatically.

## Features

- QR-code login with persisted account cookies
- Daily recommendations, Personal FM, playlists, charts, albums and artists
- Playback queue, shuffle/repeat modes and quality selection
- Synced lyrics and translation support
- Search, library and playlist operations
- Gray-track fallback through the shared unblock implementation
- Shared NetEase `weapi` / `eapi` protocol behavior across downstream native clients
- Shared language-neutral protocol contract vectors across Rust and Web
- Web/PWA support with offline-capable service worker
- Automated upstream sync, package-version normalization, compatibility gates and publication
- Structured post-release compatibility feedback through GitHub Issues

## Installation

### macOS / iOS / iPadOS

Apple platform builds are upstream-owned. For the signed/notarized macOS build:

```bash
brew install owo-network/brew/kumone --cask
```

See [`missuo/kumone`](https://github.com/missuo/kumone/releases/latest) for upstream Apple releases. This downstream repository deliberately does not create a separate iOS build/release pipeline.

### Downstream releases

Use this repository's **Releases** page for downstream packages.

The currently published 0.2.5 stable release contains:

- `Kumone-0.2.5-windows-x64-setup.exe`
- `Kumone-0.2.5-android.apk`
- `Kumone-0.2.5-android.aab`
- SHA-256 checksum files

Stable releases remain pinned to the current upstream version. When upstream advances
before a previously verified main commit is published, the release workflows allow
that historical source only as an explicit `downstream-v<version>-rc.*` prerelease;
the source SHA remains immutable and the stable release is never replaced.

Future upstream-aligned releases built by the Phase 2 pipeline additionally produce:

- `Kumone-<version>-linux-x86_64.AppImage`
- `Kumone-<version>-linux-x86_64.deb`
- `Kumone-<version>-linux-x86_64.rpm`
- `SHA256SUMS-linux`

## Building

### Shared Rust core and contracts

```bash
python3 scripts/ci/sync-downstream-version.py --check
cargo test --workspace --all-targets
npm test --prefix web
```

Rust and Web consume shared fixtures under `contracts/` for duplicated wire-protocol semantics.
`npm test` is the deterministic Web/PWA gate and does not depend on the live NetEase service.
The separate live probe is opt-in: `npm run test:live --prefix web -- --allow-known-external-challenge`.
NetEase anti-bot/rate-limit responses such as `code: -462` are recorded as
`known_external_challenge`; decoding, protocol, and unknown business errors still fail.

### Windows

Requires Rust, Node.js 22+ and Tauri CLI v2.

```bash
npm install --global @tauri-apps/cli@v2
cd apps/windows
tauri build --bundles nsis
```

### Linux

The same Tauri desktop shell builds Linux packages. Install the Tauri Linux prerequisites for your distribution, then:

```bash
npm install --global @tauri-apps/cli@v2
cd apps/windows
tauri build --bundles appimage,deb,rpm
```

GitHub Actions uses Ubuntu and installs the required WebKitGTK/system libraries automatically.

### Android

Requires JDK 17, Android SDK 36, NDK `29.0.14206865`, Gradle 9.5 and the Android Rust target. Release signing is supplied through CI secrets.

```bash
gradle -p apps/android :app:testDebugUnitTest :app:assembleDebug
```

### Web / PWA

```bash
npm test --prefix web
```

For the optional live NetEase probe (not a deterministic CI gate):

```bash
npm run test:live --prefix web -- --allow-known-external-challenge
```

## Architecture

```text
contracts/                 # language-neutral protocol compatibility vectors
crates/
├── kumone-core/           # crypto, requests, account, search, lyrics, queue, playback state, unblock
└── kumone-ffi/            # UniFFI API used by Android

apps/
├── windows/src-tauri/     # shared Tauri 2 desktop shell for Windows + Linux
└── android/               # Jetpack Compose / Media3 Android client

web/                       # Web/PWA UI, also used by Tauri desktop
Sources/Kumone/            # upstream-owned Apple SwiftUI implementation
scripts/ci/                # deterministic CI helpers
.github/workflows/         # sync, validation, feedback and release automation
```

See [`docs/architecture/shared-contracts.md`](docs/architecture/shared-contracts.md) for the ownership boundary.

## Automated release policy

- Downstream package versions must match the latest upstream version; CI rejects drift.
- Upstream synchronization runs every 3 hours, creates a candidate branch, normalizes downstream versions and removes retired Electron desktop files automatically.
- Candidate upstream PRs are opened only after Core/Web, Android, Windows and Linux compatibility gates pass.
- Windows NSIS and Android APK use a 15 MiB hard package budget; Linux deb/rpm packages use a 25 MiB hard budget and the self-contained AppImage uses an 80 MiB hard budget. The AppImage report explains the unavoidable WebKitGTK runtime portion.
- Android releases require the pinned signing identity and embedded arm64 Rust library.
- Windows Authenticode signing is automatic when `WINDOWS_CERTIFICATE_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD` are configured; otherwise releases are explicitly marked unsigned and publication is not falsely blocked as "signed".
- Every downstream release publishes a checksum-backed `latest.json` update manifest. Tauri auto-install remains fail-safe/disabled until trusted updater signatures and a public key are configured; Android only checks Releases and opens the system download flow.
- Windows/Linux desktop settings can export local redacted diagnostics; no crash or account data is uploaded by default.
- Windows, Linux and Android packages receive SHA-256 checksums and provenance attestations.
- GitHub Releases publish automatically after automated gates pass; there is no maintainer-side real-device approval gate.
- Community device feedback is captured through structured Issues and summarized automatically in [`docs/compatibility.md`](docs/compatibility.md).
- Automation may label/summarize compatibility reports but does not automatically close bugs solely from model judgment.
- Apple/iOS implementation remains upstream-owned and outside downstream release automation.

## Credits

Kumone's Apple application is from [`missuo/kumone`](https://github.com/missuo/kumone). The upstream project also references YesPlayMusic, kaset, UnblockNeteaseMusic/server and LyricsX.

The downstream Rust/Windows/Linux/Android/Web and automation work in this fork is maintained separately while staying upstream-version aligned.

## License

Licensed under [LGPL-3.0-only](LICENSE); the [GPL-3.0](COPYING) text is included alongside. Music data and rights belong to NetEase Cloud Music and the respective source platforms. For learning and personal use only.
