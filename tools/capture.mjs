import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.aleximas.com/';
const OUT = 'reference/aleximas';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
const links = await p.$$eval('a[href]', as => [...new Set(as.map(a => a.href))]);
const pages = [BASE, ...links.filter(h => h.startsWith('https://www.aleximas.com/') && !h.includes('/s/') && !h.includes('#') && h !== 'https://www.aleximas.com/')].slice(0, 6);
const info = {};
for (const [i, url] of pages.entries()) {
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(1500);
  const name = i === 0 ? 'home' : new URL(url).pathname.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'p' + i;
  await p.screenshot({ path: `${OUT}/${name}-desktop.png`, fullPage: true });
  fs.writeFileSync(`${OUT}/${name}.html`, await p.content());
  info[url] = await p.evaluate(() => {
    const pick = (sel) => [...document.querySelectorAll(sel)].slice(0, 4).map(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { sel, text: el.innerText.slice(0, 80), font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, ls: s.letterSpacing, tt: s.textTransform, color: s.color, bg: s.backgroundColor, deco: s.textDecorationLine, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      title: document.title,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      text: document.body.innerText.slice(0, 4000),
      els: ['header', 'nav a', 'h1', 'h2', 'h3', 'h4', 'p', 'main a', 'footer', '.site-title, [class*=title]', 'strong', 'li'].flatMap(pick),
    };
  });
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await m.waitForTimeout(1000);
  await m.screenshot({ path: `${OUT}/${name}-mobile.png`, fullPage: true });
  await m.close();
}
fs.writeFileSync(`${OUT}/info.json`, JSON.stringify(info, null, 1));
await b.close();
