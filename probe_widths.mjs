import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await browser.newPage();
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));
const info = await p.evaluate(() => {
  const q = (s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: Math.round(b.width), sw: el.scrollWidth, cw: el.clientWidth, ox: cs.overflowX, disp: cs.display, grid: cs.gridTemplateColumns };
  };
  return {
    doc: { sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth },
    shell: q('.shell'), panes: q('.panes'), tensorPane: q('.pane-tensor'),
    gridWrap: q('.grid-wrap'), table: q('table.tensor'), inspectorBar: q('.inspector-bar'),
    stats: q('.stats-row'), head: q('.pane-head'), topbar: q('.topbar'), timeline: q('.timeline'), statusbar: q('.statusbar'),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
