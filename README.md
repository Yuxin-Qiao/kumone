<div align="right">

**English** | [简体中文](README_CN.md)

</div>

<div align="center">

<img src="docs/icon.png" width="140" alt="Kumone" />

# Kumone

**雲の音 — lightweight NetEase Cloud Music client across macOS, Windows, Android and Web/PWA**

Native macOS SwiftUI upstream · Rust shared core · Tauri on Windows · Jetpack Compose on Android · Web/PWA

[![macOS](https://img.shields.io/badge/macOS-15%2B-blue?logo=apple)](#platforms)
[![Windows](https://img.shields.io/badge/Windows-NSIS-0078D4?logo=windows11)](#platforms)
[![Android](https://img.shields.io/badge/Android-8%2B-3DDC84?logo=android&logoColor=white)](#platforms)
[![Rust](https://img.shields.io/badge/shared%20core-Rust-000000?logo=rust)](Cargo.toml)
[![License](https://img.shields.io/badge/license-LGPL--3.0--only-orange)](LICENSE)

</div>

## What this repository is

This fork keeps the upstream native macOS application while adding downstream platform clients and release automation. The cross-platform work intentionally shares protocol, crypto, playback, queue, search, account and unblock behavior through a Rust core instead of duplicating business logic in every UI.

Upstream: [`missuo/kumone`](https://github.com/missuo/kumone)

## Platforms

| Platform | UI/runtime | Status |
| --- | --- | --- |
| macOS 15+ | SwiftUI / AVPlayer | Upstream-native application retained |
| Windows x64 | Tauri 2 + shared Rust core + Web UI | RC build verified; NSIS installer produced |
| Android 8+ / API 26+ | Jetpack Compose + Media3 + UniFFI/Rust | RC build verified; signed APK + AAB produced |
| Web / PWA | HTML/CSS/JavaScript + service worker | Smoke, PWA and live API tests wired into CI |
| Linux | Shared core / Web/PWA-oriented downstream CI | Experimental, not a primary packaged release target yet |

### Current downstream candidate

`v0.2.3-rc.1` is verified from exact source commit `8822b36e15fd5f5846749cca32a80d5075216283`.

The RC verification pipeline successfully builds both Windows and Android artifacts, checks package size budgets, verifies the Android signing identity and embedded Rust library, and emits provenance attestations. GitHub Release publication is kept separate from build verification so a release-permission failure cannot invalidate an otherwise good platform build.

## Features

- QR-code login with persisted account cookies
- Daily recommendations, Personal FM, playlists, charts, albums and artists
- Playback queue, shuffle / repeat modes and quality selection
- Synced lyrics and translation support
- Search, library and playlist operations
- Gray-track fallback through the shared unblock implementation
- Shared NetEase `weapi` / `eapi` crypto and request behavior across downstream clients
- Web/PWA support with offline-capable service worker
- Automated upstream-version gating and downstream RC verification

The macOS app retains additional native-only integrations such as media keys, Control Center, desktop lyrics and Sparkle updates.

## Installation

### macOS

For the signed/notarized upstream macOS build:

```bash
brew install owo-network/brew/kumone --cask
```

Upstream releases remain available at [`missuo/kumone`](https://github.com/missuo/kumone/releases/latest).

### Windows / Android downstream builds

Windows and Android downstream packages are produced by this repository's GitHub Actions release/RC pipelines. Use this repository's **Actions** or **Releases** pages for downstream artifacts; do not use the upstream macOS release as a Windows/Android download source.

RC artifacts are version-aligned with upstream (`0.2.3`); the downstream candidate marker is encoded in the release/artifact label (`rc.1`) rather than changing the application version.

## Building

### Shared Rust core

```bash
cargo test --workspace --all-targets
```

### macOS

Requires macOS 15+ and Xcode 26+.

```bash
swift build
Scripts/build-app.sh
Scripts/compile_and_run.sh
```

### Windows

Requires Rust, Node.js 22+ and Tauri CLI v2.

```bash
npm install --global @tauri-apps/cli@v2
cd apps/windows
tauri build --bundles nsis
```

### Android

Requires JDK 17, Android SDK 36, NDK `29.0.14206865`, Gradle 9.5 and the Android Rust target. Release signing is supplied through CI secrets; local unsigned/debug builds can use the normal Gradle tasks.

```bash
gradle -p apps/android :app:testDebugUnitTest :app:assembleDebug
```

### Web / PWA

```bash
npm test --prefix web
```

## Architecture

```text
crates/
├── kumone-core/        # platform-neutral crypto, API contracts, models, search, playback, queue and unblock logic
└── kumone-ffi/         # UniFFI-facing shared API for platform clients

apps/
├── windows/src-tauri/  # Tauri 2 Windows shell and Rust bridge
└── android/            # Jetpack Compose / Media3 Android client

web/                    # Web/PWA UI reused by the Windows downstream
Sources/Kumone/         # native upstream macOS SwiftUI application
.github/workflows/      # CI, RC verification and downstream release automation
```

## Release policy

- Downstream application versions must match the latest upstream version.
- Windows NSIS and Android APK releases have a 15 MiB hard package budget (10 MiB stretch target).
- Android release artifacts must use the pinned signing identity and contain the arm64 Rust library.
- Exact-source RC verification runs before downstream publication.
- Provenance attestations are generated for packaged release artifacts.

## Credits

Kumone's original macOS application is from [`missuo/kumone`](https://github.com/missuo/kumone). The project also references ideas from YesPlayMusic, kaset, UnblockNeteaseMusic/server and LyricsX; see the upstream project for the original detailed credits.

The downstream Rust/Windows/Android/Web work in this fork is maintained separately while staying upstream-version aligned.

## License

Licensed under [LGPL-3.0-only](LICENSE); the [GPL-3.0](COPYING) text is included alongside. Music data and rights belong to NetEase Cloud Music and the respective source platforms. For learning and personal use only.
