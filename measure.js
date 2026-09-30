/**
 * Lab measurement with Playwright + Chrome DevTools Protocol.
 * Emulates a mid-range mobile on "regular 4G" (4 Mbps, 100 ms RTT, 4x CPU slowdown).
 * Reports median of N cold loads, plus a warm (cached) reload.
 * Usage: node tools/measure.js [runs]
 */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path'), fs = require('fs'), { start } = require('./serve');
const RUNS = +process.argv[2] || 3;
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

async function once(browser, url, warm) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 500 * 1024, uploadThroughput: 250 * 1024 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__m = { lcp: 0, cls: 0, tasks: [] };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.tasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  });
  const go = async cacheOff => {
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: cacheOff });
    let bytes = 0, reqs = 0; const onFin = e => { bytes += e.encodedDataLength; reqs++; }; cdp.on('Network.loadingFinished', onFin);
    await page.goto(url, { waitUntil: 'load', timeout: 180000 }); await page.waitForTimeout(1500);
    cdp.off('Network.loadingFinished', onFin);
    const m = await page.evaluate(() => {
      const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0;
      const nav = performance.getEntriesByType('navigation')[0];
      const tbt = window.__m.tasks.filter(t => t[0] >= fcp).reduce((s, t) => s + Math.max(0, t[1] - 50), 0);
      return { fcp, lcp: window.__m.lcp, cls: window.__m.cls, tbt, load: nav.loadEventEnd, dom: document.getElementsByTagName('*').length };
    });
    return { ...m, kb: bytes / 1024, reqs };
  };
  const cold = await go(true); let hot = null;
  if (warm) { hot = await go(false); }
  await ctx.close(); return { cold, hot };
}

(async () => {
  const root = path.join(__dirname, '..');
  const targets = [['before', path.join(root, 'before'), 'naive', 8101], ['after', path.join(root, 'after'), 'optimised', 8102]];
  const browser = await chromium.launch(); const results = {};
  for (const [name, dir, mode, port] of targets) {
    const srv = await start(dir, port, mode); const runs = [];
    for (let i = 0; i < RUNS; i++) { runs.push(await once(browser, `http://localhost:${port}/`, i === 0)); process.stderr.write(`${name} run ${i + 1}/${RUNS} done\n`); }
    const pick = k => median(runs.map(r => r.cold[k]));
    results[name] = { fcp: pick('fcp'), lcp: pick('lcp'), tbt: pick('tbt'), cls: pick('cls'), load: pick('load'), kb: pick('kb'), reqs: pick('reqs'), dom: pick('dom'), warmKb: runs[0].hot.kb, warmReqs: runs[0].hot.reqs };
    srv.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(root, 'tools/results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})();
