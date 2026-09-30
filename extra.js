/** Supplementary lab check: total main-thread blocking (all long tasks) and bytes after scrolling the whole page. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright'); const path = require('path'); const { start } = require('./serve');
(async () => {
  const browser = await chromium.launch(); const root = path.join(__dirname, '..');
  for (const [name, mode, port] of [['before', 'naive', 8111], ['after', 'optimised', 8112]]) {
    const srv = await start(path.join(root, name), port, mode);
    const ctx = await browser.newContext({ viewport: { width: 412, height: 823 } }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 500 * 1024, uploadThroughput: 250 * 1024 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => { window.__t = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__t.push(e.duration))).observe({ type: 'longtask', buffered: true }); });
    let bytes = 0, reqs = 0; cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; reqs++; });
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load', timeout: 180000 });
    const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < fullH; y += 400) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => ({ blocking: window.__t.reduce((s, d) => s + Math.max(0, d - 50), 0), longTasks: window.__t.length, dom: document.getElementsByTagName('*').length }));
    console.log(name, JSON.stringify({ ...r, kbAfterFullScroll: Math.round(bytes / 1024), reqs }));
    await ctx.close(); srv.close();
  }
  await browser.close();
})();
