import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
const log = (...a) => console.log(...a);

// 1. boot state then ready
const booting = await page.evaluate(() => document.querySelectorAll('.skeleton').length > 0);
await new Promise((r) => setTimeout(r, 950));
const ready = await page.evaluate(() => ({
  panes: document.querySelectorAll('.pane').length,
  sets: document.querySelectorAll('.tensor-item').length,
  premises: document.querySelectorAll('.premise-row').length,
  cells: document.querySelectorAll('.cell-btn').length,
  footerHash: document.querySelector('.statusbar .sb-item:nth-child(2)').textContent.trim(),
  stateChip: document.querySelector('.hash-block .hash-value').textContent.trim(),
  skeletons: document.querySelectorAll('.skeleton').length,
}));
log('boot skeleton shown:', booting, '| ready:', JSON.stringify(ready));

// 2. preview a premise
const before = await page.evaluate(() => document.querySelector('.statusbar').textContent);
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.premise-row')].find((b) => b.textContent.includes('pm-02'));
  row.click();
});
const prev = await page.evaluate(() => ({
  affected: document.querySelectorAll('.cell-btn.affected').length,
  changed: document.querySelectorAll('.cell-btn.changed').length,
  beforeSpans: [...document.querySelectorAll('.cell-btn.changed .before')].map((e) => e.textContent),
  afterSpans: [...document.querySelectorAll('.cell-btn.changed .after')].map((e) => e.textContent),
  chip: document.querySelector('.topbar .chip').textContent.trim(),
  hashLabel: document.querySelector('.hash-block .hash-label').textContent.trim(),
  detail: document.querySelector('.detail-card h3')?.textContent,
  diffTable: document.querySelectorAll('.diff-table tbody tr').length,
}));
log('preview:', JSON.stringify(prev));
const afterPreview = await page.evaluate(() => document.querySelector('.statusbar').textContent);
log('committed hash unchanged during preview:', before.includes(JSON.parse(JSON.stringify(afterPreview.match(/state [0-9a-f ]+/)?.[0] || ''))) ? 'n/a' : (afterPreview.match(/state [0-9a-f ]+/)||[])[0], '|', (before.match(/state [0-9a-f ]+/)||[])[0]);

// 3. cell values return unchanged after exiting preview
await page.keyboard.press('Escape');
const exited = await page.evaluate(() => ({
  changed: document.querySelectorAll('.cell-btn.changed').length,
  affected: document.querySelectorAll('.cell-btn.affected').length,
  firstCells: [...document.querySelectorAll('.cell-btn')].slice(0, 6).map((e) => e.textContent),
  chip: document.querySelector('.topbar .chip').textContent.trim(),
}));
log('after exit:', JSON.stringify(exited));

// 4. search
async function search(q) {
  await page.click('#tensor-search', { clickCount: 3 });
  if (q) await page.type('#tensor-search', q); else await page.keyboard.press('Backspace');
  await new Promise((r) => setTimeout(r, 120));
  return page.evaluate(() => ({
    note: document.querySelector('#query-note').textContent.trim(),
    dimmed: document.querySelectorAll('.cell-btn.dimmed').length,
    empty: !!document.querySelector('.state-card h4'),
    emptyText: document.querySelector('.state-card h4')?.textContent,
    count: document.querySelector('.stats-row .stat .v')?.textContent,
  }));
}
for (const q of ['r3c5', '>0.5', 'zzz']) {
  log('search', JSON.stringify(q), '->', JSON.stringify(await search(q)));
}
await page.keyboard.press('Escape');

// 5. keyboard: j cycles premise, d toggles diff, cmd+z undo, / focuses search
await page.evaluate(() => document.body.focus());
await page.keyboard.press('j');
const afterJ = await page.evaluate(() => ({ selected: document.querySelector('.premise-row[aria-selected="true"] .pr-name')?.textContent, chip: document.querySelector('.topbar .chip').textContent.trim() }));
log('after j:', JSON.stringify(afterJ));
await page.keyboard.press('j');
const afterJ2 = await page.evaluate(() => document.querySelector('.premise-row[aria-selected="true"] .pr-name')?.textContent);
await page.keyboard.press('d');
const diffOff = await page.evaluate(() => ({ changed: document.querySelectorAll('.cell-btn.changed').length, diffBtn: document.querySelector('.inspector-bar .btn[aria-pressed]')?.textContent }));
await page.keyboard.press('d');
const diffOn = await page.evaluate(() => ({ changed: document.querySelectorAll('.cell-btn.changed').length, diffBtn: document.querySelector('.inspector-bar .btn[aria-pressed]')?.textContent }));
log('j:', afterJ.selected, '->', afterJ2, '| diff off:', JSON.stringify(diffOff), '| diff on:', JSON.stringify(diffOn));

await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
const afterUndo = await page.evaluate(() => ({ chip: document.querySelector('.topbar .chip').textContent.trim(), undoCount: document.querySelector('.topbar .btn[aria-label^="Undo"]')?.textContent.trim() }));
log('after ctrl+z:', JSON.stringify(afterUndo));

await page.keyboard.press('/');
const focusedId = await page.evaluate(() => document.activeElement?.id);
log('slash focuses:', focusedId);
await page.keyboard.press('Escape');

// 6. stage
await page.evaluate(() => { const r = [...document.querySelectorAll('.premise-row')].find((b) => b.textContent.includes('pm-09')); r.click(); });
await page.evaluate(() => { const b = [...document.querySelectorAll('.detail-card .btn')].find((x) => x.textContent.includes('Stage')); b.click(); });
const staged = await page.evaluate(() => ({
  chip: document.querySelector('.topbar .chip').textContent.trim(),
  notice: document.querySelector('.notice.amber .notice-title')?.textContent,
  stagedBtn: [...document.querySelectorAll('.detail-card .btn')].map((b) => b.textContent.trim()),
}));
log('staged:', JSON.stringify(staged));

// 7. timeline
await page.evaluate(() => { [...document.querySelectorAll('.timeline-item')].find((b) => b.textContent.includes('v43')).click(); });
const tl = await page.evaluate(() => ({
  current: document.querySelector('.timeline-item[aria-current="true"]')?.textContent.trim(),
  outside: document.querySelectorAll('.premise-row.outside-version').length,
  note: document.querySelector('.timeline-note')?.textContent.trim(),
}));
log('timeline v43:', JSON.stringify(tl));

// 8. error tensor + retry
await page.evaluate(() => { [...document.querySelectorAll('.tensor-item')].find((b) => b.textContent.includes('mlp.fc2')).click(); });
await new Promise((r) => setTimeout(r, 620));
const errState = await page.evaluate(() => ({ alert: document.querySelector('.notice.red .notice-title')?.textContent, buttons: [...document.querySelectorAll('.notice.red .btn')].map((b) => b.textContent.trim()), cells: document.querySelectorAll('.cell-btn').length }));
log('error state:', JSON.stringify(errState));
await page.evaluate(() => { [...document.querySelectorAll('.notice.red .btn')].find((b) => b.textContent.includes('Retry')).click(); });
await new Promise((r) => setTimeout(r, 1400));
const recovered = await page.evaluate(() => ({ cells: document.querySelectorAll('.cell-btn').length, chip: document.querySelector('.pane-program .tensor-item[aria-selected="true"] .ti-sub')?.textContent, alert: !!document.querySelector('.notice.red') }));
log('after retry:', JSON.stringify(recovered));

// 9. empty tensor
await page.evaluate(() => { [...document.querySelectorAll('.tensor-item')].find((b) => b.textContent.includes('moe.router')).click(); });
await new Promise((r) => setTimeout(r, 620));
log('empty tensor:', JSON.stringify(await page.evaluate(() => ({ card: document.querySelector('.state-card h4')?.textContent, cells: document.querySelectorAll('.cell-btn').length }))));

// 10. weight set filter
await page.evaluate(() => { [...document.querySelectorAll('.tensor-item')].find((b) => b.textContent.includes('attn.q_proj')).click(); });
await new Promise((r) => setTimeout(r, 620));
await page.type('.list-search input', 'mlp');
log('filter mlp ->', await page.evaluate(() => document.querySelectorAll('.tensor-item').length), 'sets');
await page.evaluate(() => { document.querySelector('.list-search input').value = ''; });

// 11. cell selection detail
await page.evaluate(() => document.querySelector('.cell-btn').click());
log('cell detail:', JSON.stringify(await page.evaluate(() => document.querySelector('.cell-detail')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160))));

// 12. shortcuts dialog
await page.keyboard.press('?');
const dlg = await page.evaluate(() => ({ open: !!document.querySelector('.dialog'), focused: document.activeElement?.getAttribute('aria-label') }));
await page.keyboard.press('Escape');
const dlgClosed = await page.evaluate(() => !document.querySelector('.dialog'));
log('dialog:', JSON.stringify(dlg), 'closed:', dlgClosed);

// 13. accessibility sweep: unnamed interactive elements
const unnamed = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, a, input, [role="gridcell"], [role="option"]')];
  return els.filter((el) => {
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
    return name.length === 0;
  }).map((el) => el.tagName + '.' + el.className);
});
log('unnamed interactive elements:', unnamed.length ? unnamed.slice(0, 8) : 'none');

console.log('console errors:', errs.length ? errs : 'none');
await page.screenshot({ path: 'ide-desktop.png', fullPage: true });
await browser.close();
