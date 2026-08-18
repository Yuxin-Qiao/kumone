# Kumone for Android (雲の音 安卓版)

Kumone (雲の音) 的 Android 原生客户端移植版本。保持了与 macOS 原版及 Windows 版完全一致的纯粹、轻量、高音质网易云音乐体验，针对移动端进行了沉浸式与后台播放优化。

---

## 📱 核心功能与特性

1. **移动端深度适配 UI / UX**
   - 底部五栏直达导航：`发现`、`搜索`、`私人 FM`、`我的库`、`设置`。
   - 悬浮可伸缩 Mini 播放条与沉浸式全屏播放页（支持专辑动态模糊背景）。
   - 逐行滚动交互式三行歌词（原文 + 翻译 + 罗马音注音），支持点击歌词随时快进/快退播放。

2. **完整网易云音乐功能**
   - 每日推荐歌曲、心动模式、私人 FM、推荐歌单、新碟上架、官方排行榜。
   - 扫码一键登录（自动生成并在手机端轮询确认，无需手动抓包）。
   - 歌单创建/收藏、歌曲红心喜欢、云盘同步、播放记录。
   - 综合搜索（单曲、歌单、专辑、歌手）。

3. **Android 后台播放与系统级集成**
   - **Foreground Service**：结合 `MediaSessionCompat` 与 `NotificationCompat.MediaStyle`，常驻锁屏及通知栏，提供无缝切歌/播放/暂停控制。
   - **音频焦点管理 (Audio Focus)**：电话呼入/导航提示自动降音/暂停，耳机拔出自动暂停 (`ACTION_AUDIO_BECOMING_NOISY`)。
   - **唤醒锁 (WakeLock)**：保障熄屏与后台稳定切歌播放。

4. **灰色无版权歌曲多源解锁**
   - 自动回退与匹配三方音源：`pyncmd (GD Studio)` / `酷我音乐` / `酷狗音乐`。
   - 毫秒级音轨时长比对与精准匹配。

5. **音质与格式**
   - 最高支持无损 FLAC、极高 320kbps、较高 192kbps、标准 128kbps 及 Hi-Res。

---

## 🛠 技术架构

```
android/
├── app/
│   ├── build.gradle.kts                # Android 构建配置 (AGP 8.8.2 / Kotlin 2.1.10 / minSdk 24 / targetSdk 35)
│   └── src/main/
│       ├── AndroidManifest.xml         # 前台服务、通知及网络权限声明
│       ├── java/com/kumone/music/
│       │   ├── MainActivity.kt         # 主入口 Activity、WebView 容器与返回键栈管理
│       │   ├── KumoneAndroidBridge.kt  # JavascriptInterface 双向桥接 (音视频控制/剪贴板/偏好存储)
│       │   ├── crypto/
│       │   │   └── NeteaseCrypto.kt    # 原生 Kotlin AES-128-CBC/ECB + MD5 加密
│       │   └── service/
│       │       └── AudioPlayerService.kt # Android 前台服务、MediaSession 及通知控制
│       ├── assets/web/                 # 移动端 Web 容器 UI 与业务层
│       │   ├── index.html              # 移动端 DOM 结构
│       │   ├── style.css               # 深色系移动端响应式设计
│       │   ├── app.js                  # 状态管理、UI 渲染与事件路由
│       │   └── lib/
│       │       ├── crypto.js           # weapi / eapi 算法层
│       │       ├── client.js           # HTTP 传输与 Cookie 容器
│       │       ├── api.js              # 网易云接口全集
│       │       ├── unblock.js          # pyncmd / Kuwo / Kugou 解锁
│       │       └── qrcode.min.js       # 扫码登录二维码生成
│       └── res/                        # 矢量图标、主题、各分辨率 mipmap 图标
└── test/
    └── smoke.js                        # 加密算法对拍与完整性冒烟测试
```

---

## 🔨 构建与运行

### 1. 运行冒烟测试 (Crypto 对拍验证)
```bash
node android/test/smoke.js
```

### 2. 本地构建 APK
需要 JDK 17+ 和 Android SDK (API 35)：
```bash
cd android
./gradlew assembleDebug      # 输出在 app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # 输出在 app/build/outputs/apk/release/app-release-unsigned.apk
```

### 3. CI/CD 自动构建
每次推送或发布 release 时，GitHub Actions 流程（`.github/workflows/build-android.yml`）会自动触发构建并打包 APK 产物。
