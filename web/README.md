# Kumone Web & PWA

**Kumone** 的现代轻量 Web / PWA / Docker 实现，支持桌面端与移动端（iOS Safari / Android Chrome / iPadOS / 车机等）免安装即开即用。

---

## 特性

- ⚡ **轻量纯净**：原生 JavaScript + CSS 实现，无庞大前端框架运行时，秒开加载。
- 📱 **移动端与全端适配**：
  - **iOS Safari**：支持「分享 → 添加到主屏幕」，全屏沉浸运行，自动隐藏地址栏与导航条。
  - **Android Chrome / Edge**：支持 PWA 一键「安装应用」或「添加到主屏幕」。
  - **车机 / 平板 / 电视**：响应式布局自适应各类屏幕尺寸与车载中控屏幕。
- 🔐 **多模式安全登录**：
  - 网易云 App 扫码登录（二维码本地生成与轮询状态）。
  - Cookie / `MUSIC_U` 直接导入。
  - 手机验证码登录 / 账号密码登录。
- 🎵 **完整播放与歌词**：
  - 沉浸式全屏播放页、动态模糊背景。
  - 逐行同步歌词 + 翻译 + 罗马音。
  - 灰色无版权歌曲多源自动解锁（pyncmd / 酷我 / 酷狗）。
- 🐳 **Docker / Docker Compose**：一键私有化部署。

---

## 在线体验

直接访问：[https://yuxin-qiao.github.io/kumone](https://yuxin-qiao.github.io/kumone)

---

## 本地开发与运行

```bash
cd web

# 1. 运行冒烟测试（加密算法与静态文件校验）
node test/smoke.js

# 2. 启动本地轻量 HTTP 服务器
node server.js
# 访问 http://localhost:3000
```

---

## Docker 部署

### 一键启动
```bash
docker run -d --name kumone-web -p 3000:3000 ghcr.io/yuxin-qiao/kumone-web:latest
```

### Docker Compose
```yaml
version: '3.8'
services:
  kumone-web:
    image: ghcr.io/yuxin-qiao/kumone-web:latest
    container_name: kumone-web
    restart: unless-stopped
    ports:
      - "3000:3000"
```
