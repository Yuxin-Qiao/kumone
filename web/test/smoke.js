// Kumone Web Smoke Test
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

(async () => {
  console.log('[1] Web Crypto 对拍验证');
  const nc = require('../lib/crypto');
  const json = String.raw`{"a":1,"中文":"x","csrf_token":""}`;

  const w = nc.weapi(json);
  assert.strictEqual(w.params,
    '/l1h2jkQoD4EUEIqo0GV8iPAF/ELo5N5dtabFdU9AXjIo6UqTRXg7VbIGmg3IpMTxeVaQbzzC3Qj3a6UpPQGwAbuUNQ7EeMTAFotyNZtxgA=');
  assert.strictEqual(w.encSecKey.slice(0, 64),
    '38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d');

  assert.strictEqual(nc.eapi('/api/test', json).params,
    '4DC723619A991588865191FD2F319BADEE9D82DED756FAF81718E6CE08BB71F2C4601D07128D00DB9BD72874C343B530930B71BB58E3ECC222F1E26BC6ABC97E1F900BDA20E3392CD422873B10E676D73FF8662A89B1101642C72A6BB91B2D151301E8A009DA24A4D62DDFB070D282AE');
  ok('weapi / eapi 算法一致性校验通过');

  console.log('[2] Web / PWA 核心文件存在性校验');
  const requiredFiles = [
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'sw.js',
    'server.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png',
    'icons/favicon.png',
    'lib/crypto.js',
    'lib/client.js',
    'lib/api.js',
    'lib/unblock.js',
    'lib/qrcode.min.js',
  ];

  const rootDir = path.resolve(__dirname, '..');
  for (const rel of requiredFiles) {
    const p = path.join(rootDir, rel);
    assert.ok(fs.existsSync(p), `Missing required file: ${rel}`);
    if (rel.endsWith('.js')) {
      const { execSync } = require('child_process');
      execSync(`node -c "${p}"`);
    }
  }
  ok(`所有 Web / PWA 核心文件与 JS 语法校验通过 (${requiredFiles.length} 项)`);

  console.log(`\n🎉 Web / PWA 模块冒烟测试全部通过 (共 ${passed} 项)！`);
  process.exit(0);
})().catch((e) => {
  console.error('\n✗ Web 模块冒烟测试失败:', e.message);
  process.exit(1);
});
