// Kumone Web Smoke Test
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

(async () => {
  console.log('[1] Shared crypto contract vectors');
  const nc = require('../lib/crypto');
  const contractPath = path.resolve(__dirname, '../../contracts/crypto-vectors.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert.strictEqual(contract.schema_version, 1);
  assert.ok(contract.cases.length > 0, 'crypto contract must contain cases');

  for (const vector of contract.cases) {
    const w = nc.weapi(vector.json);
    assert.strictEqual(w.params, vector.weapi_params, `${vector.name}: weapi params`);
    assert.strictEqual(w.encSecKey, vector.weapi_enc_sec_key, `${vector.name}: encSecKey`);
    assert.strictEqual(nc.eapi(vector.eapi_path, vector.json).params,
      vector.eapi_params, `${vector.name}: eapi params`);
  }
  ok(`Rust/Web 共享加密契约向量通过 (${contract.cases.length} 组)`);

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
    'lib/tauri-bridge.js',
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
