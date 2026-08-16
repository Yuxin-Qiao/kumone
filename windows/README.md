# Kumone for Windows

基于上游 [missuo/kumone](https://github.com/missuo/kumone)（macOS 原生 SwiftUI 应用）的
Electron 移植版。上游代码 100% 依赖 SwiftUI/AppKit/Sparkle，无法在 Windows 上编译，
因此此处为等价功能移植：API/加密层从 Swift 逐文件移植（weapi/eapi 加密与原版逐字节一致），
UI 重写为 HTML/CSS/JS。

## 功能

- 扫码登录（网易云音乐账号）、账号信息、退出、登录态自动刷新、过期自动引导重新登录
- 发现页：快捷入口卡（每日推荐/私人漫游/心动模式，未登录显示登录卡）、精选/推荐歌单、
  精品歌单、排行榜、**推荐歌手**、新碟上架、最新音乐、每日推荐（登录后）
- 歌单/专辑/歌手详情页，歌单导航侧栏
- 私人 FM（播完自动续、扔进垃圾桶）、云盘音乐（列表/播放/删除/容量统计）、听歌排行（周/全部）
- 心动模式播放、相似歌曲页、歌手页相似歌手（登录）
- 搜索：单曲/专辑/歌手/歌单 + 实时联想 + 默认搜索词
- **曲目右键菜单**：下一首播放（插播队列）、我喜欢、收藏到歌单、查看专辑/歌手、复制链接
- **"下一首播放"插播队列**：优先播放、去重、队列面板分组显示、随播放状态持久化
- 播放器：队列、上一首/下一首、进度拖拽、音量、三种循环模式、**实际音质徽标**
- **独立"正在播放"大页**：大图封面 + 歌词主体（点击播放栏左侧进入）
- 歌词面板：原文 + 翻译 + **罗马音**三行、当前行高亮、点击跳转
- 喜欢（红心）、音质选择（标准/较高/极高/无损/Hi-Res）
- 第三方音源解锁：网易无版权/试听片段时自动回落 pyncmd → 酷我 → 酷狗，可在设置中开关
- 设置面板：**跟随系统/浅色/深色**三档外观、解锁开关、检查更新
- 键盘快捷键：空格播放/暂停、←/→ 快进退 5 秒、Ctrl+←/→ 切歌、↑/↓ 音量、L 歌词、Q 队列
- MediaSession 集成（Windows 上接入系统 SMTC：任务栏媒体控制/硬件媒体键）
- 重启后恢复播放队列与进度（含插播队列）

## 产物

- `dist/Kumone-win32-x64.zip` — 便携版（解压双击 `Kumone.exe`），exe 已嵌入图标与版本元数据
- `dist-installer/Kumone-Setup-<version>-x64.exe` — NSIS 安装包（可选安装目录、桌面快捷方式）
- `dist-installer/latest.yml` + `.blockmap` — 自动更新清单。把 `build/eb-config.json` 里的
  generic URL 换成你自己的托管地址并上传这三件套，客户端接入 electron-updater 即可实现全量更新
  （差量更新需要代码签名）

## 测试与 CI

```bash
npm test            # crypto 对拍（与 Swift 原版固定向量）+ 真实 API 冒烟，纯 Node 可跑
npm run e2e         # 启动应用 → CDP 驱动真实 UI 的端到端测试（16 项断言）
npm run package:win # 构建 NSIS 安装包 + latest.yml（配置在 build/eb-config.json）
```

仓库根目录的 `.github/workflows/build-windows.yml` 会在真实 Windows runner 上
跑同样的测试、构建安装包、校验 exe 品牌信息与图标、并做 10 秒启动冒烟，
产物上传为 Actions Artifacts——推送到你自己的 GitHub 仓库即可获得真机验证。

## 与上游的已知差距

- **关注歌手（sub）被网易服务端拒绝**：`/artist/sub` 恒返回 code 250「参数错误」——payload 与
  NeteaseCloudMusicApi 及上游 Swift 完全一致，weapi/eapi 双通道均试；取关（unsub）正常。
  属服务端限制/接口变更（上游 macOS 版同样受影响），值得关注上游后续动向
- 歌单收藏/取消有服务端限频（code 405，窗口约数分钟），连续操作会被暂时拦截
- 自动更新未接线（latest.yml 骨架已生成，需要发布服务器 + electron-updater 接入）
- 无代码签名（需要证书，未签名时 Windows SmartScreen 会提示「仍要运行」）
- 云盘删除、FM 垃圾桶未做登录态实测（避免不可逆地改动用户数据）

## 运行（开发）

```bash
cd windows
npm install
node node_modules/electron/install.js   # 若二进制缺失/被 Gatekeeper 拦截，重装后
codesign --force --deep --sign - node_modules/electron/dist/Electron.app  # 仅 macOS 需要重签
npm start
```

## 打包 Windows 版（在 macOS 上交叉打包，无需 wine/Windows 机器）

`electron-packager` 在非 Windows 平台嵌入 exe 元数据需要 wine，故采用手动流程
（与其内部步骤一致，仅省去 rcedit）：

```bash
npm install
# 1. staging：仅生产依赖
rm -rf /tmp/kumone-stage && mkdir /tmp/kumone-stage
cp -r lib renderer main.js preload.js package.json /tmp/kumone-stage/
cd /tmp/kumone-stage
npm install --omit=dev
cd -
# 2. app.asar
npx asar pack /tmp/kumone-stage dist-build/app.asar
# 3. Electron 官方 win32-x64 预编译包
curl -sL -o /tmp/electron-win32.zip \
  https://github.com/electron/electron/releases/download/v31.7.7/electron-v31.7.7-win32-x64.zip
unzip -q /tmp/electron-win32.zip -d dist/Kumone-win32-x64
# 4. 组装
cd dist/Kumone-win32-x64
mv electron.exe Kumone.exe
rm resources/default_app.asar
cp ../../dist-build/app.asar resources/app.asar
```

产物：`windows/dist/Kumone-win32-x64.zip`（解压后双击 `Kumone.exe`，免安装）。

## 架构对应关系

| 上游 (Swift) | 本目录 |
| --- | --- |
| `NeteaseCrypto.swift` | `lib/crypto.js`（输出与原版逐字节一致） |
| `NeteaseClient.swift` | `lib/client.js` |
| `NeteaseAPI.swift` | `lib/api.js` |
| `UnblockService.swift` | `lib/unblock.js` |
| SwiftUI 界面 | `renderer/`（main.js 为 Electron 主进程，代理 API 避开 CORS） |
