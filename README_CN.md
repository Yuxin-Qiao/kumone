<div align="right">

[English](README.md) | **简体中文**

</div>

<div align="center">

<img src="docs/icon.png" width="140" alt="Kumone" />

# Kumone

**雲の音 — 网易云音乐客户端（macOS、Windows & Android）**

macOS 原生 SwiftUI · Windows Electron 移植版 · Android Kotlin 原生后台与移动端移植版 · 直连网易云真实 API

[![Platform](https://img.shields.io/badge/platform-macOS%2015%2B-blue?logo=apple)](#构建)
[![Windows](https://img.shields.io/badge/Windows-10%2F11%20x64-0078D6?logo=windows11)](#windowselectron-移植版)
[![Android](https://img.shields.io/badge/Android-7.0%2B%20(API%2024%2B)-3DDC84?logo=android&logoColor=white)](#android-安卓原生移植版)
[![Swift](https://img.shields.io/badge/Swift-6.2-F05138?logo=swift&logoColor=white)](Package.swift)
[![Kotlin](https://img.shields.io/badge/Kotlin-2.1.10-7F52FF?logo=kotlin&logoColor=white)](android)
[![Electron](https://img.shields.io/badge/Electron-31-9FEAF9?logo=electron&logoColor=black)](windows)
[![License](https://img.shields.io/badge/license-LGPL--3.0--only-orange)](LICENSE)

<table>
  <tr>
    <td><img src="docs/screenshot-home.png" alt="推荐" /></td>
    <td><img src="docs/screenshot-nowplaying.png" alt="沉浸播放页" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshot-daily.png" alt="每日推荐" /></td>
    <td><img src="docs/screenshot-lyrics.png" alt="歌词面板" /></td>
  </tr>
</table>

</div>

## 名字由来

**Kumone** 取自日语 **雲の音**（*kumo no ne*，「云的声音」），缩合为一个词 —— **雲音**（假名写作 くもね，读作 *kumone*）。呼应网易「云」音乐的「云」字：从云端飘落到你耳边的音乐。

## 功能

- 🔐 **扫码登录** — 网易云 App 扫码，Cookie 本地持久化，自动续期
- 🏠 **推荐** — 每日推荐、私人漫游、心动模式、推荐歌单、雷达歌单（私人雷达系列，按账号个性化）、排行榜、新碟上架、推荐歌手
- 🧭 **精选** — 分类歌单（精品 / 官方 / 排行榜 / 场景分类）无限滚动
- 🎵 **播放** — AVPlayer / MediaSession 引擎，标准 ~ Hi-Res 音质可选（黑胶 VIP 可播无损，自动回落），随机 / 单曲循环 / 列表循环，下一首播放队列，灰色歌曲识别
- 🔓 **灰色歌曲解锁** — 原生实现 UnblockNeteaseMusic 核心音源（pyncmd / 酷我 / 酷狗），无版权或试听歌曲自动匹配第三方音源
- 🖼 **沉浸播放页** — 封面取色渐变背景 + 大封面 + 大字同步歌词（点击播放条封面进入，Esc 退出）
- 📻 **私人漫游** — 沉浸式 FM 页面，不喜欢 / 切歌
- 📝 **歌词** — 侧边面板 / 全屏滚动，逐行同步 + 翻译 + 罗马音注音，点击跳转
- 🪟 **桌面歌词 (macOS)** — LyricsX 风格悬浮置顶歌词（含翻译），可拖动、位置持久化，所有空间与全屏应用上可见
- 📚 **音乐库** — 我喜欢的音乐、创建 / 收藏的歌单、收藏专辑、关注歌手、最近播放、音乐云盘
- ✏️ **歌单管理** — 新建 / 删除 / 收藏歌单、添加 / 移除歌曲、红心
- 🔍 **搜索** — 综合 / 单曲 / 歌手 / 专辑 / 歌单，热搜词占位
- ⌨️ **系统集成** — 媒体键 / 控制中心 / Android MediaSession 通知（Now Playing）、听歌打卡、退出后恢复播放队列
- 🌐 **多语言** — 简体中文与英文界面，跟随系统语言；Sparkle 更新说明双语

## Android (安卓原生移植版)

本仓库新增了针对移动端的 Android 移植版本（位于 [`android/`](android)）：
- **原生后台播放服务**：基于 Android Foreground Service、`MediaSessionCompat` 与 `NotificationCompat.MediaStyle`，支持锁屏与系统通知栏常驻播放控制，支持完整的音频焦点处理（如电话呼入、耳机拔出自动暂停）。
- **移动端沉浸式体验**：底部五栏直达导航（`发现`、`搜索`、`私人 FM`、`我的`、`设置`）、悬浮可伸缩 Mini 播放条、沉浸式全屏播放页与动态模糊封面背景、逐行滚动三行歌词（原文 + 翻译 + 罗马音）。
- **算法与接口一致性**：weapi / eapi 加密算法与 macOS 原版逐字节一致。
- **灰色无版权歌曲解锁**：自动回落 pyncmd / 酷我 / 酷狗音源。

```bash
# 运行冒烟测试（加密算法对拍与完整性检查）
node android/test/smoke.js

# 本地构建 APK
cd android
./gradlew assembleDebug
./gradlew assembleRelease
```

通过 [CI](.github/workflows/build-android.yml) 自动构建并在发布 release 时产出 APK 安装包。详细说明见 [`android/README.md`](android/README.md)。

## Windows（Electron 移植版）

本仓库在 [`windows/`](windows) 目录下新增了完整的 Windows 移植版——Swift 源码逐文件对等移植：
weapi/eapi 加密层与 Swift 实现**逐字节一致**（固定向量对拍验证），API 客户端、
UnblockNeteaseMusic 解锁链与全部 UI 均以 Electron 重新实现。

**下载** — [Releases → windows-v0.1.9](https://github.com/Yuxin-Qiao/kumone/releases/tag/windows-v0.1.9)
（Windows 10/11 x64）：安装包 `Kumone-Setup-0.1.9-x64.exe` 或便携版 zip。
由 [CI](.github/workflows/build-windows.yml) 在真实 Windows runner 上构建并通过全部测试。

Feature parity with upstream v0.1.9: 扫码登录、发现/音乐库/搜索、歌单/专辑/歌手详情、私人 FM、雷达歌单、
云盘音乐、听歌排行、心动模式、下一首播放插播队列、歌词（原文+翻译+罗马音）、
独立正在播放大页、曲目右键菜单、音质选择与实际音质徽标、灰色歌曲解锁、
媒体键/系统 SMTC、键盘快捷键、重启恢复播放队列与进度。

```bash
cd windows
npm install
npm test             # 加密对拍 + 真实 API 冒烟
npm run e2e          # CDP 驱动的 UI 端到端测试（16 项断言）
npm run package:win  # NSIS 安装包（macOS 上交叉构建，无需 wine）
```

已知限制：未签名（首次运行 SmartScreen 提示「仍要运行」）、自动更新仅生成骨架
（latest.yml 已产出，更新器未接线）、关注歌手接口被服务端拒绝（code 250，
上游 macOS 版同样受影响）。详见 [`windows/README.md`](windows/README.md)。

## 安装（macOS）

要求 Apple Silicon Mac、macOS 15+。

### Homebrew

```bash
brew install owo-network/brew/kumone --cask
```

### 手动下载

从 [Releases](https://github.com/missuo/kumone/releases/latest) 下载最新的
`Kumone-x.y.z.zip`，解压后拖入「应用程序」。

应用已使用 Developer ID 签名并通过 Apple 公证，内置 Sparkle 自动更新
（菜单栏 Kumone → 检查更新…）。

## 构建

要求 macOS 15+、Xcode 26+。

```bash
swift build                    # 编译
Scripts/build-app.sh           # 打包 .app（输出 .build/app/Kumone.app）
Scripts/compile_and_run.sh     # 杀进程 → 重新打包 → 启动
```

## 架构

```
Kumone/
├── Sources/Kumone/     # macOS SwiftUI 原生实现
├── windows/            # Windows Electron 移植版
├── android/            # Android Kotlin + Web 混合原生应用
└── .github/workflows/  # macOS, Windows & Android CI/CD 自动化流水线
```

不依赖任何第三方 API 服务器：weapi（AES-CBC 双层 + RSA）与 eapi（AES-ECB + MD5 摘要）加密为原生实现，请求直达 `music.163.com` / `interface.music.163.com`。

## Credits

Kumone 是从零编写的 Swift 实现，未复制以下项目的代码，但深度参考了它们的设计与实现思路，在此致谢：

- [YesPlayMusic](https://github.com/qier222/YesPlayMusic)（MIT，© qier222）— 功能设计、网易云 API 端点与行为逻辑的参考
- [kaset](https://github.com/sozercan/kaset)（MIT，© sozercan）— UI 设计系统、动效与 SwiftPM 打包方案的参考
- [UnblockNeteaseMusic/server](https://github.com/UnblockNeteaseMusic/server)（LGPL-3.0-only）— 灰色歌曲第三方音源的接口与匹配策略参考（`UnblockService.swift` 为独立的 Swift 重新实现）
- [LyricsX](https://github.com/ddddxxx/LyricsX)（MPL-2.0，© ddddxxx）— 桌面歌词窗口的设计参考（窗口配置、屏幕比例定位；`DesktopLyrics.swift` 为独立的 SwiftUI 实现）

## 协议与说明

本项目以 [LGPL-3.0-only](LICENSE) 协议开源（随附 [GPL-3.0](COPYING) 文本）。仅供学习交流，音乐数据与版权归网易云音乐及各音源平台所有。不支持下载、无社交功能。
