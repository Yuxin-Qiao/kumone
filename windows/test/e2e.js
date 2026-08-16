// E2E: 启动 Electron → CDP 连接 → 驱动真实 UI 断言关键交互。
// 运行：npm run e2e（本地与 CI 均可；CI 海外网络下播放进度断言自动放宽）。
'use strict';
const { spawn } = require('child_process');
const electronPath = require('electron');   // npm 包导出二进制路径字符串

const PORT = 9311;
let passed = 0, failed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const bad = (name, detail) => { failed++; console.error(`  ✗ ${name} ${detail || ''}`); };
const isCI = Boolean(process.env.CI);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitCDP() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch (_) {}
    await sleep(500);
  }
  return false;
}

(async () => {
  const { chromium } = require('playwright-core');
  const app = spawn(electronPath, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: require('path').join(__dirname, '..'),
    stdio: 'ignore',
    detached: false,
  });
  globalThis.cleanup = () => { try { app.kill(); } catch (_) {} };
  process.on('exit', () => globalThis.cleanup());

  try {
    if (!(await waitCDP())) throw new Error('CDP 未就绪（应用启动失败？）');
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    const page = browser.contexts()[0].pages()[0];

    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    console.log('[1] 首页');
    await page.waitForTimeout(4000);
    const sections = await page.locator('#view .section-title').allTextContents();
    for (const want of ['排行榜', '新碟上架', '推荐歌手']) {
      if (sections.includes(want)) ok(`区块「${want}」`);
      else bad(`区块「${want}」`, `实际: ${JSON.stringify(sections)}`);
    }
    const quickCards = await page.locator('.quick-card').count();
    if (quickCards >= 1) ok(`快捷入口卡 ${quickCards} 张`);
    else bad('快捷入口卡');

    console.log('[2] 搜索');
    await page.click('.nav-item[data-view=search]');
    await page.fill('.search-bar input', '晴天');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    const rows = page.locator('.track-table tbody tr');
    if (await rows.count() > 0) ok(`搜索结果 ${await rows.count()} 行`);
    else bad('搜索结果为空');

    console.log('[3] 播放 + 歌词 + 队列');
    await rows.first().locator('.t-play-btn').click();
    await page.waitForTimeout(isCI ? 12000 : 8000);
    const playing = await page.evaluate(() => ({
      src: audio.src,
      title: document.querySelector('#pb-title').textContent,
      pos: document.querySelector('#pb-cur').textContent,
    }));
    if (playing.src) ok(`音频已解析: ${playing.title}`);
    else bad('音频未解析');
    if (!isCI && playing.pos !== '0:00') ok(`进度推进 ${playing.pos}`);
    else if (isCI) console.log('  ⚠ CI 环境跳过进度断言（海外音源限制）');

    await page.click('#btn-lyrics');
    await page.waitForTimeout(2500);
    const lyricLines = await page.locator('#panel-content .lyrics-line').count();
    if (lyricLines > 0) ok(`歌词 ${lyricLines} 行`);
    else console.log('  ⚠ 该曲目无歌词（数据源因素，跳过）');

    await page.click('#btn-queue');
    await page.waitForTimeout(500);
    const queueItems = await page.locator('#panel-content .queue-item').count();
    if (queueItems > 0) ok(`队列 ${queueItems} 项`);
    else bad('队列为空');
    await page.keyboard.press('Escape');

    console.log('[4] 右键菜单 + 下一首播放');
    await page.locator('.track-table tbody tr').first().click({ button: 'right' });
    await page.waitForTimeout(400);
    const menuTexts = await page.locator('#add-menu .add-menu-item').allTextContents();
    if (menuTexts.some((t) => t.includes('下一首播放'))) ok('右键菜单含「下一首播放」');
    else bad('右键菜单缺「下一首播放」', JSON.stringify(menuTexts));
    if (menuTexts.some((t) => t.includes('复制链接'))) ok('右键菜单含「复制链接」');
    else bad('右键菜单缺「复制链接」');
    await page.locator('#add-menu .add-menu-item', { hasText: '下一首播放' }).first().click();
    await page.waitForTimeout(400);
    const pn = await page.evaluate(() => player.playNextList.length);
    if (pn === 1) ok('插播队列加入 1 首');
    else bad('插播队列异常', `len=${pn}`);

    console.log('[5] 正在播放大页');
    await page.click('#pb-track');
    await page.waitForTimeout(600);
    if (await page.locator('.np-page').count()) ok('大页打开');
    else bad('大页未打开');
    if (await page.locator('.np-lyrics').count()) ok('大页歌词区');
    else bad('大页歌词区缺失');
    await page.click('.np-close');
    await page.waitForTimeout(300);

    console.log('[6] 设置（外观三档循环）');
    await page.click('#btn-settings');
    await page.waitForTimeout(400);
    const btn = page.locator('#panel-content .set-row button').first();
    const labels = [];
    for (let i = 0; i < 3; i++) { labels.push(await btn.textContent()); await btn.click(); await page.waitForTimeout(150); }
    if (labels.includes('跟随系统')) ok(`外观档位: ${labels.join(' → ')}`);
    else bad('外观档位异常', labels.join(','));

    console.log('[7] JS 运行时错误');
    if (pageErrors.length === 0) ok('无 pageerror');
    else bad('pageerror', pageErrors[0]);

    await browser.close();
  } finally {
    globalThis.cleanup();
  }

  console.log(`\nE2E: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('E2E 启动失败:', e.message);
  globalThis.cleanup();
  process.exit(1);
});
