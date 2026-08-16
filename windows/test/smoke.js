// 可复现冒烟测试：crypto 对拍（与 Swift 原版固定向量比对）+ 真实 API 冒烟。
// 运行：npm test（无需 Electron，纯 Node）。
'use strict';
const assert = require('assert');
const nc = require('../lib/crypto');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

(async () => {
  console.log('[1] crypto 对拍（Swift NeteaseCrypto 参考输出）');
  const json = String.raw`{"a":1,"中文":"x","csrf_token":""}`;
  const w = nc.weapi(json);
  assert.strictEqual(w.params,
    '/l1h2jkQoD4EUEIqo0GV8iPAF/ELo5N5dtabFdU9AXjIo6UqTRXg7VbIGmg3IpMTxeVaQbzzC3Qj3a6UpPQGwAbuUNQ7EeMTAFotyNZtxgA=');
  assert.strictEqual(w.encSecKey.slice(0, 64),
    '38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d');
  assert.strictEqual(nc.eapi('/api/test', json).params,
    '4DC723619A991588865191FD2F319BADEE9D82DED756FAF81718E6CE08BB71F2C4601D07128D00DB9BD72874C343B530930B71BB58E3ECC222F1E26BC6ABC97E1F900BDA20E3392CD422873B10E676D73FF8662A89B1101642C72A6BB91B2D151301E8A009DA24A4D62DDFB070D282AE');
  ok('weapi/eapi 输出与 Swift 原版逐字节一致');

  console.log('[2] API 冒烟（真实接口，无需登录）');
  const api = require('../lib/api');
  const pls = await api.personalizedPlaylists(6);
  assert.ok(Array.isArray(pls) && pls.length > 0, 'personalizedPlaylists');
  ok(`weapi 个性化歌单 ${pls.length} 个`);

  const tops = await api.toplists();
  assert.ok(Array.isArray(tops) && tops.length > 0, 'toplists');
  ok(`eapi 排行榜 ${tops.length} 个`);

  const sr = await api.search('周杰伦', 1, 3);
  assert.ok((sr.songs || []).length > 0, 'search');
  ok(`eapi cloudsearch ${sr.songCount} 首命中`);

  const track = sr.songs[0];
  const urlList = await api.songURL([track.id], 'standard');
  assert.ok(Array.isArray(urlList) && urlList[0] && urlList[0].id === track.id, 'songURL');
  if (urlList[0].url) {
    ok(`songURL 解析成功 level=${urlList[0].level}`);
  } else {
    // 海外 IP（如 CI runner）+ 未登录时网易可能不派发 URL，接口结构正确即视为通过
    console.log(`  ⚠ songURL 未派发 URL（海外 IP 限制），接口结构正常 level=${urlList[0].level || 'n/a'}`);
    passed++;
  }

  const lyric = await api.lyric(track.id);
  assert.ok(lyric && lyric.lrc, 'lyric');
  ok(`歌词获取成功 ${(lyric.lrc.lyric || '').length} 字符`);

  console.log(`\n全部通过（${passed} 项）`);
  process.exit(0);
})().catch((e) => {
  console.error('\n✗ 测试失败:', e.message);
  process.exit(1);
});
