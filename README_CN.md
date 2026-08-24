<div align="right">

[English](README.md) | **简体中文**

</div>

<div align="center">

<img src="docs/icon.png" width="140" alt="Kumone" />

# Kumone

**雲の音 — 覆盖 macOS、Windows、Android 与 Web/PWA 的轻量网易云音乐客户端**

macOS 原生 SwiftUI 上游 · Rust 共享核心 · Windows Tauri · Android Jetpack Compose · Web/PWA

[![macOS](https://img.shields.io/badge/macOS-15%2B-blue?logo=apple)](#平台)
[![Windows](https://img.shields.io/badge/Windows-NSIS-0078D4?logo=windows11)](#平台)
[![Android](https://img.shields.io/badge/Android-8%2B-3DDC84?logo=android&logoColor=white)](#平台)
[![Rust](https://img.shields.io/badge/共享核心-Rust-000000?logo=rust)](Cargo.toml)
[![License](https://img.shields.io/badge/license-LGPL--3.0--only-orange)](LICENSE)

</div>

## 这个仓库是什么

这个 fork 保留上游原生 macOS 应用，同时增加 Windows、Android 与 Web/PWA 下游客户端和自动化发布链。跨平台部分通过 Rust 共享网易云协议、加密、播放、队列、搜索、账号与灰色歌曲解锁逻辑，避免每个平台重复实现核心业务。

上游：[`missuo/kumone`](https://github.com/missuo/kumone)

## 平台

| 平台 | UI / 运行时 | 当前状态 |
| --- | --- | --- |
| macOS 15+ | SwiftUI / AVPlayer | 保留上游原生应用 |
| Windows x64 | Tauri 2 + Rust 共享核心 + Web UI | RC 已验证，NSIS 安装包已成功产出 |
| Android 8+ / API 26+ | Jetpack Compose + Media3 + UniFFI/Rust | RC 已验证，已产出签名 APK + AAB |
| Web / PWA | HTML/CSS/JavaScript + Service Worker | 已接入冒烟、PWA 与真实 API 联通测试 |
| Linux | 共享核心 / Web/PWA 方向 CI | 实验性支持，暂不是主要打包发布目标 |

### 当前下游候选版本

`v0.2.3-rc.1` 已针对精确源码提交 `8822b36e15fd5f5846749cca32a80d5075216283` 完成验证。

RC 验证流水线会同时构建 Windows 与 Android，检查安装包体积、Android 签名身份与 APK 内 Rust 动态库，并生成 provenance attestation。构建验证和 GitHub Release 发布被视为两个独立阶段，因此发布权限问题不会否定已经通过的平台构建。

## 功能

- 网易云 App 扫码登录与 Cookie 持久化
- 每日推荐、私人漫游、歌单、排行榜、专辑与歌手
- 播放队列、随机 / 循环与音质选择
- 同步歌词与翻译
- 搜索、音乐库与歌单操作
- 基于共享实现的灰色歌曲回退
- 跨下游客户端共享 `weapi` / `eapi` 加密与请求行为
- Web/PWA 与 Service Worker
- 上游版本对齐校验与自动 RC 验证

macOS 原生版本继续保留媒体键、控制中心、桌面歌词与 Sparkle 自动更新等平台专属能力。

## 安装

### macOS

签名并通过公证的上游 macOS 版本：

```bash
brew install owo-network/brew/kumone --cask
```

上游发布页：[`missuo/kumone`](https://github.com/missuo/kumone/releases/latest)。

### Windows / Android 下游版本

Windows 与 Android 包由本仓库的 GitHub Actions RC / Release 流水线生成。请使用**本仓库**的 Actions 或 Releases 获取下游产物，不要把上游 macOS Release 当成 Windows/Android 下载入口。

下游应用版本保持与上游一致（当前 `0.2.3`），`rc.1` 只体现在候选版本标签 / artifact 名称中，不修改应用自身版本号。

### iOS / iPadOS（侧载）

每次发版都会附带**无签名**的 `Kumone-iOS-x.y.z.ipa`（iOS 17+）。Kumone 是非官方客户端，不会上架 App Store 或 TestFlight，请用侧载工具以自己的 Apple ID 签名安装 —— [AltStore](https://altstore.io)、[SideStore](https://sidestore.io)、[Sideloadly](https://sideloadly.io) 或 Xcode 均可。

更新：iOS 应用无法自我替换。设置 → 关于 → **检查更新** 会提示是否有新版本并给出下载链接，下载新 IPA 后用同一工具重新安装即可，登录状态与设置会保留。AltStore / SideStore 也可通过 source 自动追踪发布。

## 构建

### Rust 共享核心

```bash
cargo test --workspace --all-targets
```

### macOS

需要 macOS 15+、Xcode 26+。

```bash
swift build
Scripts/build-app.sh
Scripts/compile_and_run.sh
```

### Windows

需要 Rust、Node.js 22+ 与 Tauri CLI v2。

```bash
npm install --global @tauri-apps/cli@v2
cd apps/windows
tauri build --bundles nsis
```

### Android

需要 JDK 17、Android SDK 36、NDK `29.0.14206865`、Gradle 9.5 与 Android Rust target。正式签名由 CI secret 提供；本地可正常执行 debug / unsigned 构建。

```bash
gradle -p apps/android :app:testDebugUnitTest :app:assembleDebug
```

### Web / PWA

```bash
npm test --prefix web
```

## 架构

```text
crates/
├── kumone-core/        # 平台无关的加密、API、模型、搜索、播放、队列与解锁逻辑
└── kumone-ffi/         # 提供给平台客户端的 UniFFI 共享接口

apps/
├── windows/src-tauri/  # Tauri 2 Windows 外壳与 Rust bridge
└── android/            # Jetpack Compose / Media3 Android 客户端

web/                    # Web/PWA UI，同时供 Windows 下游复用
Sources/Kumone/         # 上游原生 macOS SwiftUI 应用
.github/workflows/      # CI、RC 验证与下游发布自动化
```

## 发布策略

- 下游应用版本必须与最新上游版本一致。
- Windows NSIS 与 Android APK 设有 15 MiB 硬上限、10 MiB 优化目标。
- Android 正式产物必须使用固定签名身份，并包含 arm64 Rust 动态库。
- 下游发布前先执行 exact-source RC 验证。
- 打包产物生成 provenance attestation。

## Credits

Kumone 原生 macOS 应用来自 [`missuo/kumone`](https://github.com/missuo/kumone)。原项目还参考了 YesPlayMusic、kaset、UnblockNeteaseMusic/server 与 LyricsX；完整原始致谢请见上游仓库。

本 fork 的 Rust / Windows / Android / Web 下游工作独立维护，并持续保持与上游版本对齐。

## 协议与说明

本项目以 [LGPL-3.0-only](LICENSE) 协议开源，并随附 [GPL-3.0](COPYING) 文本。音乐数据与版权归网易云音乐及相关音源平台所有，仅供学习交流与个人使用。
