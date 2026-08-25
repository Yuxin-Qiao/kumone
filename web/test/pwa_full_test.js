// Comprehensive PWA & Web Functionality Test
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  isKnownExternalChallenge,
  describeExternalChallenge,
} = require('./live-service');

const allowKnownExternalChallenge = process.argv.includes('--allow-known-external-challenge')
  || process.env.KUMONE_ALLOW_KNOWN_EXTERNAL_CHALLENGE === '1';
const liveStatusFile = process.env.KUMONE_LIVE_STATUS_FILE;

function writeLiveStatus(status, details = {}) {
  if (!liveStatusFile) return;
  fs.writeFileSync(liveStatusFile, `${JSON.stringify({ status, ...details }, null, 2)}\n`);
}

const webDir = path.resolve(__dirname, '..');

let totalPassed = 0;
function pass(title) {
  totalPassed++;
  console.log(`  ✓ ${title}`);
}

(async () => {
  console.log('\n=== [1] PWA 规范与 Manifest 检验 ===');
  const manifestPath = path.join(webDir, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json 必须存在');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.name, 'manifest.name 必须存在');
  assert.ok(manifest.short_name, 'manifest.short_name 必须存在');
  assert.strictEqual(manifest.display, 'standalone', 'display 必须为 standalone');
  assert.ok(manifest.start_url, 'start_url 必须存在');
  assert.ok(manifest.icons && manifest.icons.length >= 2, '必须提供至少 2 种尺寸的图标');
  
  for (const icon of manifest.icons) {
    const iconFile = path.join(webDir, icon.src);
    assert.ok(fs.existsSync(iconFile), `图标文件不存在: ${icon.src}`);
  }
  pass('PWA Manifest 结构及图标资源完整合规');

  console.log('\n=== [2] Service Worker & HTML 基础配置检验 ===');
  const swPath = path.join(webDir, 'sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js 必须存在');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert.ok(swContent.includes('install'), 'sw.js 包含 install 声明');
  assert.ok(swContent.includes('fetch'), 'sw.js 包含 fetch 拦截');
  pass('Service Worker 脚本就绪');

  const htmlPath = path.join(webDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('rel="manifest" href="manifest.json"'), 'index.html 必须声明 manifest');
  assert.ok(html.includes('name="viewport"'), 'index.html 必须声明 viewport');
  assert.ok(html.includes('apple-mobile-web-app-capable'), 'index.html 包含 iOS Web App 全屏声明');
  assert.ok(html.includes('serviceWorker.register'), 'index.html 包含 SW 自动注册');
  pass('index.html PWA 移动端与全屏 meta 标签配置完整');

  console.log('\n=== [3] DOM 与 JS 挂载 ID 一致性校验 ===');
  const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
  const requiredIds = [
    'view-container',
    'bottom-player-bar',
    'bp-btn-play',
    'bp-title',
    'bp-artist',
    'bp-cover',
    'fs-lyrics-view',
    'fs-lyrics-content',
    'queue-sheet',
    'login-sheet',
    'toast-container',
    'btn-account',
    'bottom-nav',
    'fullscreen-player'
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `index.html 中缺少必需的 ID 元素: ${id}`);
  }
  pass(`前端 UI 挂载点 (${requiredIds.length} 项) 与 index.html 100% 对应`);

  console.log('\n=== [4] 纯 JavaScript 离线加密对拍（无 Node 依赖模拟） ===');
  // 测试 lib/crypto.js 在浏览器环境（不走 Node crypto）下的纯 JS 运算
  const cryptoCode = fs.readFileSync(path.join(webDir, 'lib/crypto.js'), 'utf8');
  const mockWindow = {};
  const mockGlobal = {};
  const browserCryptoFactory = new Function('module', 'exports', 'window', 'globalThis', `
    let require = undefined;
    ${cryptoCode}
  `);
  browserCryptoFactory(undefined, undefined, mockWindow, mockGlobal);
  const browserCrypto = mockWindow.NeteaseCrypto || mockGlobal.NeteaseCrypto;

  const testPayload = String.raw`{"a":1,"中文":"x","csrf_token":""}`;
  const weapiRes = browserCrypto.weapi(testPayload);
  assert.strictEqual(weapiRes.params,
    '/l1h2jkQoD4EUEIqo0GV8iPAF/ELo5N5dtabFdU9AXjIo6UqTRXg7VbIGmg3IpMTxeVaQbzzC3Qj3a6UpPQGwAbuUNQ7EeMTAFotyNZtxgA=',
    '纯 JS weapi 算法计算值必须与标准对拍一致'
  );
  assert.strictEqual(weapiRes.encSecKey.slice(0, 64),
    '38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d'
  );

  const eapiRes = browserCrypto.eapi('/api/test', testPayload);
  assert.strictEqual(eapiRes.params,
    '4DC723619A991588865191FD2F319BADEE9D82DED756FAF81718E6CE08BB71F2C4601D07128D00DB9BD72874C343B530930B71BB58E3ECC222F1E26BC6ABC97E1F900BDA20E3392CD422873B10E676D73FF8662A89B1101642C72A6BB91B2D151301E8A009DA24A4D62DDFB070D282AE',
    '纯 JS eapi 算法计算值必须与标准对拍一致'
  );
  pass('纯 JS (浏览器模式) AES-128-CBC/ECB 加密与 MD5 计算准确无误');

  console.log('\n=== [5] 真实网易云接口联通性与数据解析验证 ===');
  const api = require('../lib/api');

  // 1. 测试榜单接口
  const toplists = await api.toplists();
  assert.ok(Array.isArray(toplists) && toplists.length > 0, '应该能够获取官方排行榜');
  pass(`排行榜接口正常（获取到 ${toplists.length} 个官方榜单）`);

  // 2. 测试推荐歌单接口
  const playlists = await api.personalizedPlaylists();
  assert.ok(Array.isArray(playlists) && playlists.length > 0, '应该能够获取推荐歌单');
  pass(`推荐歌单接口正常（获取到 ${playlists.length} 个推荐歌单）`);

  // 3. 测试搜索接口
  const searchRes = await api.search('周杰伦', 1, 5, 0);
  assert.ok(searchRes && Array.isArray(searchRes.songs) && searchRes.songs.length > 0, '搜索单曲接口正常');
  pass(`单曲搜索接口正常（搜索返回 ${searchRes.songs.length} 首歌曲）`);

  // 4. 测试歌词接口
  const testSongId = searchRes.songs[0].id;
  const lyricRes = await api.lyric(testSongId);
  assert.ok(lyricRes && lyricRes.lrc && lyricRes.lrc.lyric, '歌词接口应该返回歌词文本');
  pass(`歌词获取接口正常 (Song ID: ${testSongId})`);

  // 5. 测试歌曲播放 URL 解析
  const songUrlRes = await api.songURL([testSongId], 'standard');
  assert.ok(Array.isArray(songUrlRes) && songUrlRes.length > 0, '歌曲直链解析接口应该返回数据');
  const songUrl = songUrlRes[0].url;
  pass(`音频数据解析正常 (格式: ${songUrlRes[0].type || 'mp3'}, 码率: ${songUrlRes[0].br || 'standard'})`);

  // 6. 二维码生成测试
  const unikey = await api.qrKey();
  assert.ok(unikey && typeof unikey === 'string', '应成功获取二维码 unikey');
  const qrUrl = api.qrLoginURL(unikey);
  assert.ok(qrUrl.includes(unikey), '二维码登录链接生成正确');
  pass(`扫码登录密钥与授权链接生成正常 (Unikey: ${unikey.slice(0, 8)}...)`);

  console.log('\n=== [6] 内置 Node.js / Docker 反向代理端点验证 ===');
  const server = require('../server');
  const TEST_PORT = 3128;
  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, '127.0.0.1', async () => {
      try {
        const cryptoMod = require('../lib/crypto');
        const payload = JSON.stringify({ limit: 3, total: true, n: 1000, csrf_token: '' });
        const form = cryptoMod.weapi(payload);
        const bodyStr = Object.entries(form).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const targetUrl = 'https://music.163.com/weapi/personalized/playlist';
        const proxyUrl = `http://127.0.0.1:${TEST_PORT}/api/netease?target=${encodeURIComponent(targetUrl)}`;

        const res = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Netease-Cookie': 'os=web; appver=2.9.7',
          },
          body: bodyStr,
        });
        assert.strictEqual(res.status, 200, '代理状态码必须为 200');
        const json = await res.json();
        assert.strictEqual(json.code, 200, '代理返回 code 必须为 200');
        assert.ok(json.result && json.result.length > 0, '代理应正常返回歌单数据');
        pass('Node.js / Docker /api/netease 反向代理与 Cookie 透传完全正常');
        server.close(resolve);
      } catch (e) {
        server.close(() => reject(e));
      }
    });
  });

  console.log(`\n🎉 全部 Web & PWA 测试顺利通过 (共 ${totalPassed} 项测试全部 PASS)！\n`);
  writeLiveStatus('all_passed', { passed: totalPassed });
  process.exit(0);
})().catch((err) => {
  if (isKnownExternalChallenge(err)) {
    const description = describeExternalChallenge(err);
    writeLiveStatus('known_external_challenge', {
      signal: description,
      passed: totalPassed,
    });
    console.warn(`\n⚠️ KNOWN_EXTERNAL_CHALLENGE: ${description}`);
    console.warn('Live NetEase probing stopped; deterministic Web/PWA gates remain authoritative.');
    if (allowKnownExternalChallenge) {
      process.exit(0);
    }
  }
  writeLiveStatus('failed', {
    error: err && err.message ? err.message : String(err),
    kind: err && err.kind,
    code: err && err.code,
    httpStatus: err && err.httpStatus,
    passed: totalPassed,
  });
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
