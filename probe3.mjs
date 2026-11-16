import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await browser.newPage();
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));
const tryCss = async (label, cssText) => {
  const v = await p.evaluate((t) => {
    const s = document.getElementById('probe3') || Object.assign(document.createElement('style'), { id: 'probe3' });
    s.textContent = t;
    document.head.appendChild(s);
    void document.body.offsetWidth;
    const wrap = document.querySelector('.grid-wrap');
    return {
      docSW: document.documentElement.scrollWidth,
      bodySW: document.body.scrollWidth,
      wrapScrollable: wrap.scrollWidth > wrap.clientWidth,
      wrapSW: wrap.scrollWidth, wrapCW: wrap.clientWidth,
      scrollY: (() => { window.scrollTo(0, 300); const y = window.scrollY; window.scrollTo(0, 0); return y; })(),
      colHeaderSticky: getComputedStyle(document.querySelector('table.tensor th')).position,
    };
  }, cssText);
  console.log(label, JSON.stringify(v));
};
await tryCss('baseline', '');
await tryCss('html,body overflow-x clip', 'html,body{overflow-x:clip}');
await tryCss('html,body overflow-x hidden', 'html,body{overflow-x:hidden}');
await tryCss('grid-wrap contain:paint', 'html,body{overflow-x:clip} .grid-wrap{contain:paint}');
await browser.close();
