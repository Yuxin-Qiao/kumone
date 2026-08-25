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

这个 fork 保留上游原生 macOS 应用，同时增加 Windows、Android 与 Web/PWA 下游客户端，以及自动化同步、校验、构建和发布链。跨平台部分通过 Rust 共享网易云协议、加密、播放、队列、搜索、账号与灰色歌曲解锁逻辑，避免每个平台重复实现核心业务。

上游：[`missuo/kumone`](https://github.com/missuo/kumone)

## 平台

| 平台 | UI / 运行时 | 当前状态 |
| --- | --- | --- |
| macOS 15+ | SwiftUI / AVPlayer | 保留上游原生应用 |
| Windows x64 | Tauri 2 + Rust 共享核心 + Web UI | 自动 CI / Release；输出 NSIS 安装包 |
| Android 8+ / API 26+ | Jetpack Compose + Media3 + UniFFI/Rust | 自动 CI / Release；输出签名 APK + AAB |
| Web / PWA | HTML/CSS/JavaScript + Service Worker | 已接入冒烟、PWA 与真实 API 联通测试 |
| Linux | 共享核心 / Web/PWA 方向 CI | 实验性支持，暂不是主要打包发布目标 |

### 当前下游版本

下游已对齐 **Kumone 0.2.5**，精确源码提交为 `c5f4749fc63af2d45000f7aebafccb504cea6775`。

正式版标签采用 `downstream-v0.2.5`，候选版使用 `downstream-v0.2.5-rc.1` 这类后缀；应用自身版本号始终保持与上游一致，即 `0.2.5`。

Windows 与 Android 发布流水线会自动执行共享核心 / Web / FFI 测试、构建安装包、校验包体积、验证 Android 固定签名身份与 APK 内 arm64 Rust 动态库、生成 provenance attestation，并自动发布 GitHub Release。维护者不设置人工实机测试发布门槛；实机兼容性问题通过发布后的用户反馈继续修复。

## 功能

- 网易云 App 扫码登录与 Cookie 持久化
- 每日推荐、私人漫游、歌单、排行榜、专辑与歌手
- 播放队列、随机 / 循环与音质选择
- 同步歌词与翻译
- 搜索、音乐库与歌单操作
- 基于共享实现的灰色歌曲回退
- 跨下游客户端共享 `weapi` / `eapi` 加密与请求行为
- Web/PWA 与 Service Worker
- 上游版本对齐校验、精确源码验证与自动下游发布

macOS 原生版本继续保留媒体键、控制中心、桌面歌词与 Sparkle 自动更新等平台专属能力。

## 安装

### macOS

签名并通过公证的上游 macOS 版本：

```bash
brew install owo-network/brew/kumone --cask
```

上游发布页：[`missuo/kumone`](https://github.com/missuo/kumone/releases/latest)。

### Windows / Android 下游版本

请直接从**本仓库 Releases** 获取 Windows / Android 下游产物。自动发布包包含：

- `Kumone-0.2.5-windows-x64-setup.exe`
- `Kumone-0.2.5-android.apk`
- `Kumone-0.2.5-android.aab`
- SHA-256 校验文件

不要把上游 macOS Release 当成 Windows / Android 下载入口。

### iOS / iPadOS

上游源码树包含 iOS 相关实现与侧载支持，但当前**下游 Windows + Android 自动发布流程不会生成或上传 IPA**。因此不要假设每个下游 Release 都包含 iOS 安装包。

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
.github/workflows/      # CI、验证与下游发布自动化
```

## 发布策略

- 下游应用版本必须与最新上游版本一致。
- Windows NSIS 与 Android APK 设有 15 MiB 硬上限、10 MiB 优化目标。
- Android 正式产物必须使用固定签名身份，并包含 arm64 Rust 动态库。
- 发布前执行精确源码自动校验，并在发布流程中再次执行自动测试与构建门禁。
- 打包产物生成 provenance attestation。
- 自动门禁通过后直接发布 GitHub Release，不设置维护者人工实机审批门槛。
- `.github/release-status/` 记录 dispatcher 和最近一次 release 结果，避免状态长期停留在旧版本。

## Credits

Kumone 原生 macOS 应用来自 [`missuo/kumone`](https://github.com/missuo/kumone)。原项目还参考了 YesPlayMusic、kaset、UnblockNeteaseMusic/server 与 LyricsX；完整原始致谢请见上游仓库。

本 fork 的 Rust / Windows / Android / Web 下游工作独立维护，并持续保持与上游版本对齐。

## 协议与说明

本项目以 [LGPL-3.0-only](LICENSE) 协议开源，并随附 [GPL-3.0](COPYING) 文本。音乐数据与版权归网易云音乐及相关音源平台所有，仅供学习交流与个人使用。
