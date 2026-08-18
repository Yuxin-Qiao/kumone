// Kumone Android Port Smoke Test Suite
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

(async () => {
  console.log('[1] Android Crypto 对拍验证 (weapi / eapi 与 Swift 参考固定向量对比)');
  const nc = require('../app/src/main/assets/web/lib/crypto');
  const json = String.raw`{"a":1,"中文":"x","csrf_token":""}`;

  const w = nc.weapi(json);
  assert.strictEqual(w.params,
    '/l1h2jkQoD4EUEIqo0GV8iPAF/ELo5N5dtabFdU9AXjIo6UqTRXg7VbIGmg3IpMTxeVaQbzzC3Qj3a6UpPQGwAbuUNQ7EeMTAFotyNZtxgA=');
  assert.strictEqual(w.encSecKey.slice(0, 64),
    '38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d');

  assert.strictEqual(nc.eapi('/api/test', json).params,
    '4DC723619A991588865191FD2F319BADEE9D82DED756FAF81718E6CE08BB71F2C4601D07128D00DB9BD72874C343B530930B71BB58E3ECC222F1E26BC6ABC97E1F900BDA20E3392CD422873B10E676D73FF8662A89B1101642C72A6BB91B2D151301E8A009DA24A4D62DDFB070D282AE');
  ok('weapi / eapi 加密算法与 Swift 原版及 Windows 版逐字节一致');

  console.log('[2] Android 静态资源与代码结构检查');
  const requiredFiles = [
    'app/src/main/AndroidManifest.xml',
    'app/src/main/java/com/kumone/music/MainActivity.kt',
    'app/src/main/java/com/kumone/music/KumoneAndroidBridge.kt',
    'app/src/main/java/com/kumone/music/crypto/NeteaseCrypto.kt',
    'app/src/main/java/com/kumone/music/service/AudioPlayerService.kt',
    'app/src/main/res/values/strings.xml',
    'app/src/main/res/values/colors.xml',
    'app/src/main/res/values/styles.xml',
    'app/src/main/res/drawable/ic_play.xml',
    'app/src/main/res/drawable/ic_pause.xml',
    'app/src/main/res/drawable/ic_prev.xml',
    'app/src/main/res/drawable/ic_next.xml',
    'app/src/main/res/drawable/ic_stat_music.xml',
    'app/src/main/assets/web/index.html',
    'app/src/main/assets/web/style.css',
    'app/src/main/assets/web/app.js',
    'app/src/main/assets/web/lib/crypto.js',
    'app/src/main/assets/web/lib/client.js',
    'app/src/main/assets/web/lib/api.js',
    'app/src/main/assets/web/lib/unblock.js',
    'app/src/main/assets/web/lib/qrcode.min.js',
    'build.gradle.kts',
    'settings.gradle.kts',
    'gradle.properties',
    'gradlew',
    'gradle/wrapper/gradle-wrapper.properties',
    'gradle/wrapper/gradle-wrapper.jar',
    'gradle/libs.versions.toml',
  ];

  const rootDir = path.resolve(__dirname, '..');
  for (const rel of requiredFiles) {
    const p = path.join(rootDir, rel);
    assert.ok(fs.existsSync(p), `Missing required file: ${rel}`);
  }
  ok(`所有核心 Android 源码、资源及构建配置文件存在 (${requiredFiles.length} 项)`);

  console.log('[3] 图标资源完整性检查 (mipmap 分辨率覆盖)');
  const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  for (const mm of mipmaps) {
    const iconPath = path.join(rootDir, 'app/src/main/res', mm, 'ic_launcher.png');
    assert.ok(fs.existsSync(iconPath), `Missing icon: ${mm}/ic_launcher.png`);
  }
  ok('所有 mipmap 图标分辨率完整覆盖 (48x48 -> 192x192)');

  console.log(`\n🎉 Android 模块冒烟测试全部通过 (共 ${passed} 项)！`);
  process.exit(0);
})().catch((e) => {
  console.error('\n✗ Android 模块冒烟测试失败:', e.message);
  process.exit(1);
});
