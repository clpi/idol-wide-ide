import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await browser.newPage();
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));
const step = async (label, css) => {
  const v = await p.evaluate((cssText) => {
    const style = document.getElementById('probe') || Object.assign(document.createElement('style'), { id: 'probe' });
    style.textContent = cssText;
    document.head.appendChild(style);
    void document.body.offsetWidth;
    return { sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth };
  }, css);
  console.log(label, JSON.stringify(v));
};
await step('baseline', '');
await step('grid-wrap display none', '.grid-wrap{display:none!important}');
await step('table display none', 'table.tensor{display:none!important}');
await step('cells min-width 0', '.cell-btn{min-width:0!important}');
await step('table margin 0 + cells 0', 'table.tensor{margin:0!important} .cell-btn{min-width:0!important}');
await step('nothing', '');
// which descendants have right > 390
const far = await p.evaluate(() => {
  return [...document.querySelectorAll('body *')].map((el) => {
    const b = el.getBoundingClientRect();
    return { tag: el.tagName, cls: String(el.className).slice(0, 30), right: Math.round(b.right), pos: getComputedStyle(el).position };
  }).filter((x) => x.right > 400).slice(0, 10);
});
console.log('elements beyond viewport:', JSON.stringify(far));
await browser.close();
