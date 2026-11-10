import { chromium } from 'playwright-core';
import fs from 'fs';

const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const tabs = ['study', 'mock-exam', 'dictionary', 'quiz', 'materials', 'sensei', 'method'];

async function run(width, height, prefix) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // first viewport only = what the user sees on load
  await page.screenshot({ path: `${out}/${prefix}-00-landing-fold.png` });
  const h = await page.evaluate(() => document.body.scrollHeight);
  console.log(`${prefix} landing scrollHeight=${h}`);
  for (const t of tabs) {
    const sel = prefix === 'mobile' ? `[data-testid="mobile-nav-tab-${t}"]` : `[data-testid="nav-tab-${t}"]`;
    const el = await page.$(sel);
    if (!el) { console.log('missing', sel); continue; }
    await el.click();
    await page.waitForTimeout(1200);
    const sh = await page.evaluate(() => document.body.scrollHeight);
    console.log(`${prefix} ${t} scrollHeight=${sh}`);
    await page.screenshot({ path: `${out}/${prefix}-${t}.png`, fullPage: true });
  }
  console.log(`${prefix} errors:`, errors.slice(0, 10));
  await ctx.close();
}

await run(1440, 900, 'desktop');
await run(390, 844, 'mobile');
await browser.close();
