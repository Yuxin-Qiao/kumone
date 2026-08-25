<div align="right">

[English](README.md) | **简体中文**

</div>

<div align="center">

<img src="docs/icon.png" width="140" alt="Kumone" />

# Kumone

**雲の音 — 覆盖 macOS、Windows、Linux、Android 与 Web/PWA 的轻量网易云音乐客户端**

Apple SwiftUI 上游 · Rust 共享核心 · Tauri 2 桌面端 · Android Jetpack Compose · Web/PWA

[![macOS](https://img.shields.io/badge/macOS-15%2B-blue?logo=apple)](#平台)
[![Windows](https://img.shields.io/badge/Windows-Tauri%202-0078D4?logo=windows11)](#平台)
[![Linux](https://img.shields.io/badge/Linux-Tauri%202-FCC624?logo=linux&logoColor=black)](#平台)
[![Android](https://img.shields.io/badge/Android-8%2B-3DDC84?logo=android&logoColor=white)](#平台)
[![Rust](https://img.shields.io/badge/共享核心-Rust-000000?logo=rust)](Cargo.toml)
[![License](https://img.shields.io/badge/license-LGPL--3.0--only-orange)](LICENSE)

</div>

## 这个仓库是什么

这个 fork 保留上游 Apple 平台实现，同时维护 Windows、Linux、Android 与 Web/PWA 下游客户端，以及自动同步、兼容性反馈、验证、构建和发布体系。

适合共享的协议与领域逻辑放进 Rust；各平台 UI 和媒体播放层继续使用合适的原生技术。Apple/iOS 代码保持上游所有权，本下游不重新实现 iOS。

上游：[`missuo/kumone`](https://github.com/missuo/kumone)

## 平台

| 平台 | UI / 运行时 | 下游状态 |
| --- | --- | --- |
| macOS 15+ | SwiftUI / AVPlayer | 保留上游原生实现 |
| iOS / iPadOS | 上游 SwiftUI 实现 | 上游维护；不进入下游构建/发布工作 |
| Windows x64 | Tauri 2 + Rust 共享核心 + Web UI | 自动 CI / Release；NSIS |
| Linux x86_64 | 与 Windows 共用 Tauri 2 + Rust + Web 桌面壳 | 自动 CI / Release；AppImage + deb + rpm |
| Android 8+ / API 26+ | Jetpack Compose + Media3 + UniFFI/Rust | 自动 CI / Release；签名 APK + AAB |
| Web / PWA | HTML/CSS/JavaScript + Service Worker | 自动冒烟/PWA/协议契约测试 |

旧 Electron 桌面实现已经退役；Windows 与 Linux 共用同一套 Tauri/Rust 桌面代码路径。

### 版本与发布状态

当前已经发布的正式下游版本是 **Kumone 0.2.5**，标签 `downstream-v0.2.5`，精确源码提交为 `c5f4749fc63af2d45000f7aebafccb504cea6775`。

已发布的 0.2.5 早于本次 Linux/Tauri Phase 2 集成，因此它仍只包含 Windows + Android 产物。新的自动发布流水线已经加入 Linux；首个正式 Linux 包会随下一次上游对齐版本发布，而不会把新源码产物倒灌进旧的 0.2.5 tag，避免源码与产物不一致。

`scripts/ci` 中的版本同步器从 `CHANGELOG.md` 最新版本统一同步 Cargo、Tauri 与 Android 本地默认版本；CI 会阻止任何版本漂移，上游自动同步候选也会自动修正版本。

## 功能

- 网易云扫码登录与 Cookie 持久化
- 每日推荐、私人漫游、歌单、排行榜、专辑与歌手
- 播放队列、随机 / 循环与音质选择
- 同步歌词与翻译
- 搜索、音乐库与歌单操作
- 基于共享实现的灰色歌曲回退
- 下游原生客户端共享 NetEase `weapi` / `eapi` 协议行为
- Rust 与 Web 使用同一份语言无关协议契约向量
- Web/PWA 与 Service Worker
- 上游自动同步、版本归一、兼容性门禁与自动发布
- 通过 GitHub Issues 结构化收集发布后的实机兼容性反馈

## 安装

### macOS / iOS / iPadOS

Apple 平台由上游维护。macOS 已签名并公证版本：

```bash
brew install owo-network/brew/kumone --cask
```

Apple 平台发布请查看 [`missuo/kumone`](https://github.com/missuo/kumone/releases/latest)。本下游仓库不另建 iOS 构建/发布链。

### 下游 Release

请从本仓库 **Releases** 下载下游产物。

当前已发布的 0.2.5 stable 包含：

- `Kumone-0.2.5-windows-x64-setup.exe`
- `Kumone-0.2.5-android.apk`
- `Kumone-0.2.5-android.aab`
- SHA-256 校验文件

Phase 2 合并后，后续上游对齐 Release 还会自动生成：

- `Kumone-<version>-linux-x86_64.AppImage`
- `Kumone-<version>-linux-x86_64.deb`
- `Kumone-<version>-linux-x86_64.rpm`
- `SHA256SUMS-linux`

## 构建

### Rust 共享核心与契约

```bash
python3 scripts/ci/sync-downstream-version.py --check
cargo test --workspace --all-targets
npm test --prefix web
```

Rust 与 Web 对仍存在多实现的协议行为共享 `contracts/` 中的固定 fixture。
`npm test` 是不依赖网易云在线服务的确定性 Web/PWA gate。
真实联网探测单独运行：`npm run test:live --prefix web -- --allow-known-external-challenge`。
网易云反爬/限流响应（例如 `code: -462`）会记录为
`known_external_challenge`；解析、协议和未知业务错误仍然严格失败。

### Windows

```bash
npm install --global @tauri-apps/cli@v2
cd apps/windows
tauri build --bundles nsis
```

### Linux

Windows 与 Linux 共用同一个 Tauri 桌面壳。安装所在发行版需要的 Tauri Linux 依赖后：

```bash
npm install --global @tauri-apps/cli@v2
cd apps/windows
tauri build --bundles appimage,deb,rpm
```

GitHub Actions 会在 Ubuntu runner 自动安装 WebKitGTK 等系统依赖。

### Android

需要 JDK 17、Android SDK 36、NDK `29.0.14206865`、Gradle 9.5 与 Android Rust target。正式签名由 CI Secret 提供。

```bash
gradle -p apps/android :app:testDebugUnitTest :app:assembleDebug
```

### Web / PWA

```bash
npm test --prefix web
```

如需运行可选的网易云 live smoke（它不是确定性 CI gate）：

```bash
npm run test:live --prefix web -- --allow-known-external-challenge
```

## 架构

```text
contracts/                 # 语言无关协议兼容性向量
crates/
├── kumone-core/           # 加密、请求、账号、搜索、歌词、队列、播放状态、Unblock
└── kumone-ffi/            # Android 使用的 UniFFI API

apps/
├── windows/src-tauri/     # Windows + Linux 共用的 Tauri 2 桌面壳
└── android/               # Jetpack Compose / Media3 Android 客户端

web/                       # Web/PWA UI，同时供 Tauri 桌面复用
Sources/Kumone/            # 上游维护的 Apple SwiftUI 实现
scripts/ci/                # 可重复执行的 CI 辅助脚本
.github/workflows/         # 同步、验证、反馈与发布自动化
```

共享边界见 [`docs/architecture/shared-contracts.md`](docs/architecture/shared-contracts.md)。

## 自动发布策略

- 下游包版本必须与最新上游版本一致，CI 会拒绝版本漂移。
- 上游同步每 3 小时运行一次：生成候选分支、自动同步下游版本，并自动移除已经退役的 Electron 桌面文件。
- 只有 Core/Web、Android、Windows、Linux 四组兼容性 gate 全部通过，才会自动创建上游同步 Draft PR。
- Windows NSIS 与 Android APK 硬上限 15 MiB；Linux deb/rpm 硬上限 25 MiB，自包含 AppImage 硬上限 90 MiB。
- Android 正式产物必须使用固定签名身份并包含 arm64 Rust 动态库。
- 配置 `WINDOWS_CERTIFICATE_BASE64` 与 `WINDOWS_CERTIFICATE_PASSWORD` 后，Windows 会自动 Authenticode 签名并验证；没配置证书时会明确标记 unsigned，不会伪装成“已签名”。
- Windows、Linux 与 Android 产物自动生成 SHA-256 和 provenance attestation。
- 自动门禁通过后自动发布 GitHub Release，不设置维护者人工实机审批门槛。
- 实机反馈通过结构化 Issues 收集，并自动汇总到 [`docs/compatibility.md`](docs/compatibility.md)。
- 自动化可分类和汇总反馈，但不会仅凭模型判断自动关闭 Bug。
- Apple/iOS 实现始终归上游维护，不进入本下游发布自动化。

## Credits

Kumone Apple 平台应用来自 [`missuo/kumone`](https://github.com/missuo/kumone)。上游还参考了 YesPlayMusic、kaset、UnblockNeteaseMusic/server 与 LyricsX。

本 fork 的 Rust / Windows / Linux / Android / Web 与自动化体系独立维护，并持续保持上游版本对齐。

## 协议与说明

本项目以 [LGPL-3.0-only](LICENSE) 协议开源，并随附 [GPL-3.0](COPYING) 文本。音乐数据与版权归网易云音乐及相关音源平台所有，仅供学习交流与个人使用。
