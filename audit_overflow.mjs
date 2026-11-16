import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
for (const [w, h, tag] of [[1500, 1000, 'desktop'], [1024, 900, 'tablet'], [390, 844, 'phone']]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 900));
  const res = await p.evaluate(() => {
    const out = { sw: document.documentElement.scrollWidth, iw: window.innerWidth, offenders: [] };
    document.querySelectorAll('body *').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.right > window.innerWidth + 1) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return;
        out.offenders.push(el.tagName + '.' + String(el.className).slice(0, 40) + ' r=' + Math.round(b.right) + ' w=' + Math.round(b.width));
      }
    });
    out.offenders = out.offenders.slice(0, 6);
    return out;
  });
  console.log(tag, w, '->', JSON.stringify(res));
  await p.close();
}
// keyboard nav with settle time
const p = await browser.newPage();
await p.setViewport({ width: 1500, height: 1000 });
await p.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));
await p.evaluate(() => document.getElementById('cell-0-0').focus());
const seq = [];
for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'End', 'Home']) {
  await p.keyboard.press(key);
  await new Promise((r) => setTimeout(r, 60));
  seq.push(await p.evaluate(() => document.activeElement?.id));
}
console.log('cell nav:', seq.join(' > '));
await p.keyboard.press('Enter');
console.log('selected:', await p.evaluate(() => document.querySelector('.cell-btn.selected')?.getAttribute('aria-label')));
await browser.close();
