# Kumone for iOS (雲の音 iOS 原生版)

Kumone (雲の音) 的 iOS 原生客户端版本。保持了与 macOS 原版、Windows/Linux 及 Android 版完全一致的纯粹、轻量、高音质网易云音乐体验，针对 iPhone / iPad 移动端进行了系统级后台播放与锁屏深度集成。

---

## 📱 核心功能与特性

1. **iOS 原生后台音频与锁屏控制**
   - **后台播放 (`UIBackgroundModes: audio`)**：结合 `AVAudioSession (.playback)`，熄屏与切换到其他 App 后持续播放。
   - **锁屏 / 控制中心媒体信息 (`MPNowPlayingInfoCenter`)**：锁屏大封面图、歌曲名、歌手、专辑与毫秒级进度条同步。
   - **全局线控与远程指令 (`MPRemoteCommandCenter`)**：支持锁屏、控制中心、AirPods / 耳机线控（播放、暂停、切歌、进度拖动）。
   - **智能音频打断与耳机拔出响应**：电话呼入自动暂停、通话结束自动恢复；拔出耳机或断开蓝牙自动暂停 (`routeChangeNotification`)。

2. **原生异步网络穿透层 (`URLSession`)**
   - 通过原生 Swift `URLSession` 异步隧道处理网易云全量接口与音频流请求，彻底突破 iOS WebKit CORS 跨域限制与 Cookie/User-Agent 鉴权壁垒。

3. **移动端深度交互与触感反馈**
   - 适配 iPhone 灵动岛、刘海屏及底部 Home Indicator 安全区（Safe Area）。
   - 集成 `UIImpactFeedbackGenerator`，在切歌、点击按钮与长按操作时提供原生细腻触感振动。

4. **一键唤起官方 App 授权登录**
   - 支持通过 `orpheus://` URL Scheme 一键拉起手机已安装的网易云音乐 App 确认授权，单机免扫码秒级登录。

5. **灰色无版权歌曲多源解锁**
   - 自动匹配与回退三方音源：`pyncmd (GD Studio)` / `酷我音乐` / `酷狗音乐`。

---

## 🛠 技术架构

```
ios/
├── Kumone.xcodeproj/
│   └── project.pbxproj             # Xcode 15/16 跨版本工程配置 (Deployment Target: iOS 16.0+)
├── Kumone/
│   ├── App/
│   │   ├── KumoneApp.swift         # SwiftUI 应用程序入口与声明周期
│   │   └── ContentView.swift       # 主界面容器与 Safe Area 适配
│   ├── Bridge/
│   │   └── KumoneIOSBridge.swift   # WKScriptMessageHandler 原生双向交互桥接
│   ├── Audio/
│   │   └── AudioPlayerManager.swift# AVPlayer 后台播放、锁屏控制与音频打断监听
│   └── Resources/
│       ├── Info.plist              # 后台音频权限、ATS 与 URL Scheme 查询声明
│       ├── Assets.xcassets/        # AppIcon (1024x1024) 与主题色
│       └── web/                    # 移动端 Web UI 与 API / 加解密层
└── test/
    └── smoke.js                    # 架构与文件完整性冒烟测试
```

---

## 🚀 本地编译与运行

### 方式一：使用 Xcode 打开
1. 在 Mac 上双击打开 `ios/Kumone.xcodeproj`。
2. 选择你的真机设备或 iOS Simulator（如 iPhone 16 Pro）。
3. 点击 **Run (⌘ + R)** 即可一键编译并在设备上运行。

### 方式二：命令行编译与打包 IPA
```bash
# 1. 使用 xcodebuild 编译 Release 版本
xcodebuild -project ios/Kumone.xcodeproj \
  -scheme Kumone \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath .build/ios \
  -configuration Release \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

# 2. 打包为未签名 .ipa 安装包 (可用于 TrollStore / AltStore / Sideloadly 侧载)
mkdir -p dist-ios/Payload
APP_PATH=$(find .build/ios/Build/Products -name "Kumone.app" -type d | head -n 1)
cp -R "$APP_PATH" dist-ios/Payload/
cd dist-ios && zip -r "Kumone.ipa" Payload
```

---

## 📦 安装与侧载方式

- **TrollStore (巨魔)**：直接将 `Kumone.ipa` 导入即可实现永久免重签运行。
- **AltStore / Sideloadly / 个人免费开发者证书**：通过电脑或手机端工具自签名后安装到 iPhone / iPad。
- **Xcode 真机调试**：登录 Apple ID 开启自动签名直接安装至设备。
