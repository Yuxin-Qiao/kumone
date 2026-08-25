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
    'test/live-service.js',
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
  const tauriBridge = fs.readFileSync(path.join(rootDir, 'lib/tauri-bridge.js'), 'utf8');
  assert.ok(tauriBridge.includes("checkForUpdate: () => call('check_for_update')"),
    'Tauri bridge must expose the update check command to the settings view');
  assert.ok(tauriBridge.includes("exportDiagnostics: () => call('diagnostics_export')"),
    'Tauri bridge must expose local diagnostics export to the settings view');
  ok(`所有 Web / PWA 核心文件与 JS 语法校验通过 (${requiredFiles.length} 项)`);

  console.log('[3] Live smoke 外部服务风控分类契约');
  const liveService = require('./live-service');
  assert.ok(liveService.isKnownExternalChallenge({ kind: 'business', code: -462 }),
    'NetEase -462 verification responses must be classified as external challenges');
  assert.ok(liveService.isKnownExternalChallenge({ kind: 'business', code: -460 }),
    'NetEase -460 rate-limit responses must be classified as external challenges');
  assert.ok(liveService.isKnownExternalChallenge({ kind: 'http', httpStatus: 403 }),
    'HTTP 403 edge challenges must be classified as external challenges');
  assert.ok(liveService.isKnownExternalChallenge({ kind: 'http', httpStatus: 429 }),
    'HTTP 429 edge throttling must be classified as external challenges');
  assert.ok(!liveService.isKnownExternalChallenge({ kind: 'decoding', message: '数据解析失败' }),
    'response decoding errors must remain deterministic failures');
  assert.ok(!liveService.isKnownExternalChallenge({ kind: 'business', code: 500 }),
    'unknown business errors must remain deterministic failures');
  ok('已知外部风控状态与真正解析/业务错误严格区分');

  console.log(`\n🎉 Web / PWA 模块冒烟测试全部通过 (共 ${passed} 项)！`);
  process.exit(0);
})().catch((e) => {
  console.error('\n✗ Web 模块冒烟测试失败:', e.message);
  process.exit(1);
});
