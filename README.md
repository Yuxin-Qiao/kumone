<div align="right">

**English** | [简体中文](README_CN.md)

</div>

<div align="center">

<img src="docs/icon.png" width="140" alt="Kumone" />

# Kumone

**雲の音 — NetEase Cloud Music client for macOS, Windows, Linux & Web / PWA**

Native SwiftUI on macOS · Electron for Windows & Linux · PWA & Docker for Web (Mobile & Desktop)

[![Platform](https://img.shields.io/badge/platform-macOS%2015%2B-blue?logo=apple)](#building)
[![Windows](https://img.shields.io/badge/Windows-10%2F11%20x64-0078D6?logo=windows11)](#windowselectron-port)
[![Linux](https://img.shields.io/badge/Linux-AppImage%20%7C%20Deb-FCC624?logo=linux&logoColor=black)](#linux-desktop-appimage--deb)
[![Web/PWA](https://img.shields.io/badge/Web%2FPWA-Online%20%26%20Docker-512BD4?logo=pwa&logoColor=white)](#web--pwa--docker-mobile--cross-platform)
[![License](https://img.shields.io/badge/license-LGPL--3.0--only-orange)](LICENSE)

[![Windows CI](https://github.com/Yuxin-Qiao/kumone/actions/workflows/build-windows.yml/badge.svg)](https://github.com/Yuxin-Qiao/kumone/actions/workflows/build-windows.yml)
[![Linux CI](https://github.com/Yuxin-Qiao/kumone/actions/workflows/build-linux.yml/badge.svg)](https://github.com/Yuxin-Qiao/kumone/actions/workflows/build-linux.yml)
[![Web CI](https://github.com/Yuxin-Qiao/kumone/actions/workflows/build-web.yml/badge.svg)](https://github.com/Yuxin-Qiao/kumone/actions/workflows/build-web.yml)
[![Sync Upstream](https://github.com/Yuxin-Qiao/kumone/actions/workflows/sync-upstream.yml/badge.svg)](https://github.com/Yuxin-Qiao/kumone/actions/workflows/sync-upstream.yml)

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
- 🪟 **Desktop lyrics (macOS / Desktop)** — LyricsX-style floating always-on-top lyric line with translation; draggable, persisted position, visible across Spaces and full-screen apps
- 📚 **Library** — liked songs, created / subscribed playlists, saved albums, followed artists, recently played, cloud disk
- ✏️ **Playlist management** — create / delete / subscribe playlists, add / remove tracks, heart songs
- 🔍 **Search** — aggregate / songs / artists / albums / playlists, trending keyword placeholder
- ⌨️ **System integration** — media keys / Control Center / SMTC / MPRIS / MediaSession notification (Now Playing), scrobbling, playback queue restored across launches
- 🌐 **Localization** — English and Simplified Chinese, following the system language; bilingual release notes in Sparkle updates

## Web / PWA / Docker (Mobile & Cross-Platform)

Run Kumone instantly in any modern browser without installation — including **iOS Safari, Android Chrome, iPadOS, Chrome, Edge, smart TVs, in-car infotainment**, or self-hosted via Docker:

- 🌐 **Live Demo & PWA**: [https://yuxin-qiao.github.io/kumone](https://yuxin-qiao.github.io/kumone)
  - 📱 **iOS**: In Safari, tap *Share → Add to Home Screen* for a full-screen, standalone app experience with no URL bars.
  - 🤖 **Android**: In Chrome / Edge, tap *Menu → Install App / Add to Home screen*.
- 🐳 **Run with Docker**:
  ```bash
  docker run -d --name kumone-web -p 3000:3000 ghcr.io/yuxin-qiao/kumone-web:latest
  ```
- 📦 **Docker Compose**:
  ```yaml
  version: '3.8'
  services:
    kumone-web:
      image: ghcr.io/yuxin-qiao/kumone-web:latest
      restart: unless-stopped
      ports:
        - "3000:3000"
  ```

## Windows (Electron port)

This fork adds a full Windows port under [`windows/`](windows) — the Swift
sources ported one-to-one: the weapi/eapi encryption layer is **byte-identical
to the Swift implementation** (verified against fixed vectors), the API client,
UnblockNeteaseMusic fallback chain and the whole UI are re-implemented in
Electron.

**Download** — [Releases → v0.2.0](https://github.com/Yuxin-Qiao/kumone/releases/tag/v0.2.0) (Windows 10/11 x64): `Kumone-Setup-0.2.0-x64.exe` installer or the
portable zip. Built on a real Windows runner by
[CI](.github/workflows/build-windows.yml).

```bash
cd windows
npm install
npm test             # crypto parity + live API smoke
npm run e2e          # CDP-driven UI tests (16 assertions)
npm run package:win  # NSIS installer
```

## Linux Desktop (AppImage & Deb)

Native Linux desktop client with MPRIS media control support and system notifications.

**Download** — [Releases](https://github.com/Yuxin-Qiao/kumone/releases) (x86_64): `Kumone-0.2.0-x86_64.AppImage` or `Kumone_0.2.0_amd64.deb`. Built automatically by [CI](.github/workflows/build-linux.yml).

```bash
# Run AppImage
chmod +x Kumone-0.1.9.1-x86_64.AppImage
./Kumone-0.2.0-x86_64.AppImage

# Or install Deb on Ubuntu/Debian
sudo dpkg -i Kumone_0.2.0_amd64.deb
```

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
├── windows/            # Windows & Linux Electron desktop ports
├── web/                # Web / PWA / Docker portable & mobile player
└── .github/workflows/  # Automated multi-platform CI/CD & Upstream sync
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

## Maintainers

- **Original Author**: [@missuo](https://github.com/missuo) (macOS Native Client)
- **Maintainers**: [@Yuxin-Qiao](https://github.com/Yuxin-Qiao), [@ksingir](https://github.com/ksingir) (Windows, Linux & Web/PWA Ports)

See [MAINTAINERS.md](MAINTAINERS.md) for more information.

## License

Kumone is licensed under [LGPL-3.0-only](LICENSE) (with accompanying [GPL-3.0](COPYING) text). For educational and personal use only. Music data and copyrights belong to NetEase Cloud Music and respective copyright holders. No download support, no social features.
