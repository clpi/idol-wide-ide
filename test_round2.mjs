import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const errs = [];
const page = await browser.newPage();
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.setViewport({ width: 1500, height: 1000 });
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));

const hash = () => page.evaluate(() => document.querySelector('.hash-block .hash-value').textContent.trim());
const footerState = () => page.evaluate(() => (document.querySelector('.statusbar').textContent.match(/state [0-9a-f]+/) || [])[0]);
const previewState = () => page.evaluate(() => (document.querySelector('.statusbar').textContent.match(/preview [0-9a-f]+/) || [])[0]);

const h0 = await hash(); const f0 = await footerState();
await page.evaluate(() => { [...document.querySelectorAll('.premise-row')].find((b) => b.textContent.includes('pm-01')).click(); });
const h1 = await hash(); const p1 = await previewState();
const valsDuring = await page.evaluate(() => [...document.querySelectorAll('.cell-btn')].slice(0, 4).map((e) => e.textContent));
await page.keyboard.press('Escape');
const h2 = await hash(); const f2 = await footerState();
const valsAfter = await page.evaluate(() => [...document.querySelectorAll('.cell-btn')].slice(0, 4).map((e) => e.textContent));
console.log('HASH INVARIANCE');
console.log('  committed:', h0, '| during preview:', h1, p1, '| after exit:', h2);
console.log('  footer state:', f0, '==', f2, '?', f0 === f2);
console.log('  cells during:', valsDuring, 'after:', valsAfter, '| identical:', JSON.stringify(valsDuring.filter(v => !v.includes('\n'))) === JSON.stringify(valsAfter));

// toggle premise off by clicking again
await page.evaluate(() => { [...document.querySelectorAll('.premise-row')].find((b) => b.textContent.includes('pm-01')).click(); });
const chipA = await page.evaluate(() => document.querySelector('.topbar .chip').textContent.trim());
await page.evaluate(() => { [...document.querySelectorAll('.premise-row')].find((b) => b.textContent.includes('pm-01')).click(); });
const chipB = await page.evaluate(() => document.querySelector('.topbar .chip').textContent.trim());
console.log('same-premise toggle:', chipA, '->', chipB);

// copy hash button
await page.evaluate(() => { [...document.querySelectorAll('.topbar .btn')].find((b) => b.textContent.trim() === 'Copy').click(); });
await new Promise((r) => setTimeout(r, 200));
console.log('copy announce:', await page.evaluate(() => document.querySelector('[role="status"].sr-only')?.textContent));

// shortcuts dialog from a non-input focus
await page.evaluate(() => document.body.focus());
await page.keyboard.press('?');
await new Promise((r) => setTimeout(r, 150));
const dlg = await page.evaluate(() => ({ open: !!document.querySelector('.dialog'), title: document.querySelector('#shortcuts-title')?.textContent, rows: document.querySelectorAll('.shortcut-grid dt').length, focus: document.activeElement?.getAttribute('aria-label') }));
console.log('dialog:', JSON.stringify(dlg));
await page.keyboard.press('Escape');
console.log('esc closed:', await page.evaluate(() => !document.querySelector('.dialog')));

// empty branch of premise filter (router has no premises)
await page.evaluate(() => { [...document.querySelectorAll('.tensor-item')].find((b) => b.textContent.includes('moe.router')).click(); });
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => { const b = [...document.querySelectorAll('.pane-lineage .btn')].find((x) => x.textContent.includes('All surfaces')); b.click(); });
const lineageEmpty = await page.evaluate(() => ({ card: document.querySelector('.pane-lineage .state-card h4')?.textContent, rows: document.querySelectorAll('.premise-row').length }));
console.log('lineage on empty tensor:', JSON.stringify(lineageEmpty));
await page.evaluate(() => { const b = [...document.querySelectorAll('.pane-lineage .btn')].find((x) => x.textContent.includes('Show all')); b.click(); });

// error tensor log toggle
await page.evaluate(() => { [...document.querySelectorAll('.tensor-item')].find((b) => b.textContent.includes('mlp.fc2')).click(); });
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => { const b = [...document.querySelectorAll('.notice.red .btn')].find((x) => x.textContent.includes('transport')); b.click(); });
console.log('transport log lines:', await page.evaluate(() => document.querySelectorAll('#error-log .code-line').length));
await page.evaluate(() => { const b = [...document.querySelectorAll('.notice.red .btn')].find((x) => x.textContent.includes('Hide')); b.click(); });
console.log('log hidden:', await page.evaluate(() => !document.querySelector('#error-log')));

// keyboard cell nav within the grid
await page.evaluate(() => { [...document.querySelectorAll('.tensor-item')].find((b) => b.textContent.includes('lm_head')).click(); });
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => document.getElementById('cell-0-0').focus());
const seq = [];
for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'End', 'Home']) {
  await page.keyboard.press(key);
  seq.push(await page.evaluate(() => document.activeElement?.id));
}
await page.keyboard.press('Enter');
console.log('cell nav:', seq.join(' > '), '| selected:', await page.evaluate(() => document.querySelector('.cell-btn.selected')?.getAttribute('aria-label')));
await page.screenshot({ path: 'ide-head.png', fullPage: false });

// narrow layout
const m = await browser.newPage();
m.on('pageerror', (e) => errs.push('mobile pageerror: ' + e.message));
await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await m.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));
const narrow = await m.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth, inner: window.innerWidth,
  tabsVisible: getComputedStyle(document.querySelector('.pane-tabs')).display,
  visiblePanes: [...document.querySelectorAll('.pane')].filter((p) => getComputedStyle(p).display !== 'none').length,
  tabNames: [...document.querySelectorAll('.pane-tab')].map((t) => t.textContent),
}));
console.log('narrow:', JSON.stringify(narrow));
await m.evaluate(() => { [...document.querySelectorAll('.pane-tab')].find((t) => t.textContent === 'Lineage').click(); });
await new Promise((r) => setTimeout(r, 150));
console.log('after tab switch:', await m.evaluate(() => ({ visible: [...document.querySelectorAll('.pane')].filter((p) => getComputedStyle(p).display !== 'none').map((p) => p.className) })));
await m.screenshot({ path: 'ide-mobile.png', fullPage: true });

// tablet
const t = await browser.newPage();
t.on('pageerror', (e) => errs.push('tablet pageerror: ' + e.message));
await t.setViewport({ width: 1024, height: 900 });
await t.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));
const tablet = await t.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, inner: window.innerWidth, panes: [...document.querySelectorAll('.pane')].map((p) => Math.round(p.getBoundingClientRect().width)) }));
console.log('tablet:', JSON.stringify(tablet));
await t.screenshot({ path: 'ide-tablet.png', fullPage: true });

console.log('errors:', errs.length ? errs : 'none');
await browser.close();
