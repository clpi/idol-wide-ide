import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
for (const [w, h, tag] of [[1500, 1000, 'desktop'], [1280, 900, 'laptop'], [1024, 900, 'tablet'], [768, 1024, 'small-tablet'], [390, 844, 'phone']]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 900));
  const res = await p.evaluate(() => {
    const wrap = document.querySelector('.grid-wrap');
    const th = document.querySelector('table.tensor th');
    const wrapRect = wrap.getBoundingClientRect();
    wrap.scrollTop = 40; wrap.scrollLeft = 80;
    const thAfter = th ? th.getBoundingClientRect() : null;
    const stickyOk = thAfter ? Math.abs(thAfter.top - wrapRect.top) < 40 : null;
    return {
      docSW: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      wrapScrolls: wrap.scrollWidth > wrap.clientWidth,
      stickyOk,
      panesVisible: [...document.querySelectorAll('.pane')].filter((x) => getComputedStyle(x).display !== 'none').length,
    };
  });
  console.log(tag.padEnd(13), JSON.stringify(res));
  await p.close();
}
await browser.close();
