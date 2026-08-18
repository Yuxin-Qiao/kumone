<div align="right">

**English** | [简体中文](README_CN.md)

</div>

<div align="center">

<img src="docs/icon.png" width="140" alt="Kumone" />

# Kumone

**雲の音 — NetEase Cloud Music client for macOS, Windows & Android**

Native SwiftUI on macOS · Electron port for Windows · Native Kotlin & Web for Android · Talks directly to NetEase's real API

[![Platform](https://img.shields.io/badge/platform-macOS%2015%2B-blue?logo=apple)](#building)
[![Windows](https://img.shields.io/badge/Windows-10%2F11%20x64-0078D6?logo=windows11)](#windowselectron-port)
[![Android](https://img.shields.io/badge/Android-7.0%2B%20(API%2024%2B)-3DDC84?logo=android&logoColor=white)](#android-native-port)
[![Swift](https://img.shields.io/badge/Swift-6.2-F05138?logo=swift&logoColor=white)](Package.swift)
[![Kotlin](https://img.shields.io/badge/Kotlin-2.1.10-7F52FF?logo=kotlin&logoColor=white)](android)
[![Electron](https://img.shields.io/badge/Electron-31-9FEAF9?logo=electron&logoColor=black)](windows)
[![License](https://img.shields.io/badge/license-LGPL--3.0--only-orange)](LICENSE)

<table>
  <tr>
    <td><img src="docs/screenshot-home.png" alt="Home" /></td>
    <td><img src="docs/screenshot-nowplaying.png" alt="Now Playing" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshot-daily.png" alt="Daily Recommendations" /></td>
    <td><img src="docs/screenshot-lyrics.png" alt="Lyrics Panel" /></td>
  </tr>
</table>

</div>

## About the Name

**Kumone** comes from the Japanese **雲の音** (*kumo no ne*, "the sound of clouds"), contracted into one word — **雲音** (くもね, *kumone*). It is a nod to the "cloud" in NetEase **Cloud** Music: the music drifting down to you from the cloud.

## Features

- 🔐 **QR code login** — scan with the NetEase Cloud Music app; cookies are persisted locally and auto-refreshed
- 🏠 **Home** — daily recommendations, Personal FM, Heartbeat Mode, recommended playlists, radar playlists (Personal Radar family, personalized per account), charts, new albums, recommended artists
- 🧭 **Explore** — category playlists (curated / official / charts / mood) with infinite scrolling
- 🎵 **Playback** — AVPlayer / MediaSession engine, Standard to Hi-Res quality (lossless with 黑胶 VIP, automatic fallback), shuffle / repeat one / repeat all, play-next queue, gray track detection
- 🔓 **Gray track unblocking** — native implementation of UnblockNeteaseMusic's core sources (pyncmd / Kuwo / Kugou); unavailable or trial-only tracks automatically resolve from third-party sources
- 🖼 **Immersive now-playing page** — artwork-tinted gradient backdrop, large artwork, big synced lyrics (click the player-bar artwork to open, Esc to close)
- 📻 **Personal FM** — immersive roaming page with trash / skip
- 📝 **Lyrics** — glass side panel with line-synced lyrics + translation + romanization, click to seek
- 🪟 **Desktop lyrics (macOS)** — LyricsX-style floating always-on-top lyric line with translation; draggable, persisted position, visible across Spaces and full-screen apps
- 📚 **Library** — liked songs, created / subscribed playlists, saved albums, followed artists, recently played, cloud disk
- ✏️ **Playlist management** — create / delete / subscribe playlists, add / remove tracks, heart songs
- 🔍 **Search** — aggregate / songs / artists / albums / playlists, trending keyword placeholder
- ⌨️ **System integration** — media keys / Control Center / Android MediaSession notification (Now Playing), scrobbling, playback queue restored across launches
- 🌐 **Localization** — English and Simplified Chinese, following the system language; bilingual release notes in Sparkle updates

## Android (Native Port)

This fork introduces a dedicated Android version located under [`android/`](android) — featuring a hybrid native architecture:
- **Foreground Service with MediaSessionCompat**: Full background playback, lock screen controls, system notification media controls, and audio focus management (e.g. pausing on headphone disconnect).
- **Mobile-Tailored UI**: Bottom 5-tab navigation (`Home`, `Search`, `Personal FM`, `Library`, `Settings`), floating collapsible mini-player, full-screen immersive now-playing view with dynamic blurred artwork backdrop, and interactive 3-line synced lyrics.
- **Crypto & API Parity**: Byte-identical AES-128-CBC/ECB + MD5 `weapi` and `eapi` implementation in Kotlin + JS.
- **UnblockNeteaseMusic Fallback**: Automatic multi-source unblocking via pyncmd, Kuwo, and Kugou.

**Download APK** — [Releases → android-v0.1.9](https://github.com/Yuxin-Qiao/kumone/releases/tag/android-v0.1.9) (Android 7.0+ / API 24+): `Kumone-v0.1.9.apk`. Built automatically by [CI](.github/workflows/build-android.yml).

```bash
# Smoke test (crypto parity & structural verification)
node android/test/smoke.js

# Build Android APK
cd android
./gradlew assembleDebug
./gradlew assembleRelease
```

Built automatically on push via [CI](.github/workflows/build-android.yml). Full documentation in [`android/README.md`](android/README.md).

## Windows (Electron port)

This fork adds a full Windows port under [`windows/`](windows) — the Swift
sources ported one-to-one: the weapi/eapi encryption layer is **byte-identical
to the Swift implementation** (verified against fixed vectors), the API client,
UnblockNeteaseMusic fallback chain and the whole UI are re-implemented in
Electron.

**Download** — [Releases → windows-v0.1.9](https://github.com/Yuxin-Qiao/kumone/releases/tag/windows-v0.1.9)
(Windows 10/11 x64): `Kumone-Setup-0.1.9-x64.exe` installer or the
portable zip. Built on a real Windows runner by
[CI](.github/workflows/build-windows.yml).

Feature parity with upstream v0.1.9: QR login, discovery / library / search,
playlist / album / artist pages, Personal FM, radar playlists, cloud disk, play records,
Heartbeat Mode, play-next queue, lyrics with translation + romanization,
dedicated now-playing page, track context menu, quality selection with served
badge, UnblockNeteaseMusic fallback, media keys / SMTC, keyboard shortcuts,
queue + position restore across launches.

```bash
cd windows
npm install
npm test             # crypto parity + live API smoke
npm run e2e          # CDP-driven UI tests (16 assertions)
npm run package:win  # NSIS installer (cross-built from macOS, no wine)
```

Known limitations: unsigned (SmartScreen prompt on first run), auto-update
scaffolding only (`latest.yml` is generated; updater not wired), and the
artist-subscribe endpoint is rejected server-side (code 250 — upstream's
macOS build is affected equally). Details in [`windows/README.md`](windows/README.md).

## Installation (macOS)

Requires an Apple Silicon Mac running macOS 15+.

### Homebrew

```bash
brew install owo-network/brew/kumone --cask
```

### Manual download

Download the latest `Kumone-x.y.z.zip` from
[Releases](https://github.com/missuo/kumone/releases/latest), unzip, and drag
it into Applications.

The app is signed with a Developer ID certificate and notarized by Apple, with
built-in Sparkle automatic updates (menu bar: Kumone → Check for Updates…).

## Building

Requires macOS 15+ and Xcode 26+.

```bash
swift build                    # compile
Scripts/build-app.sh           # package the .app (outputs .build/app/Kumone.app)
Scripts/compile_and_run.sh     # kill → repackage → relaunch
```

## Architecture

```
Kumone/
├── Sources/Kumone/     # macOS SwiftUI native implementation
├── windows/            # Windows Electron port
├── android/            # Android Kotlin + Web hybrid native app
└── .github/workflows/  # CI/CD pipelines for macOS, Windows & Android
```

No third-party API server involved: weapi (double AES-CBC + RSA) and eapi
(AES-ECB + MD5 digest) encryption are implemented natively, and
requests go straight to `music.163.com` / `interface.music.163.com`.

## Credits

Kumone is written from scratch in Swift. No code was copied from the projects
below, but their design and implementation ideas were referenced extensively:

- [YesPlayMusic](https://github.com/qier222/YesPlayMusic) (MIT, © qier222) — feature design, NetEase API endpoints and behavior
- [kaset](https://github.com/sozercan/kaset) (MIT, © sozercan) — UI design system, motion, and SwiftPM packaging approach
- [UnblockNeteaseMusic/server](https://github.com/UnblockNeteaseMusic/server) (LGPL-3.0-only) — third-party source endpoints and matching strategy for gray tracks (`UnblockService.swift` is an independent Swift reimplementation)
- [LyricsX](https://github.com/ddddxxx/LyricsX) (MPL-2.0, © ddddxxx) — desktop lyrics window design reference (window configuration, screen-factor positioning; `DesktopLyrics.swift` is an independent SwiftUI implementation)

## License

Licensed under [LGPL-3.0-only](LICENSE) (the [GPL-3.0](COPYING) text is
included alongside). For learning and personal use only — all music data and
rights belong to NetEase Cloud Music and the respective source platforms. No
downloading, no social features.
