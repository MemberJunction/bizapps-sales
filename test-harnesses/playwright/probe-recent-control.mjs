import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: JSON.parse(readFileSync(new URL('.auth/user.json', import.meta.url),'utf8')) });
const page = await ctx.newPage();
const log=(m)=>console.log('  '+m); const clean=(t)=>String(t).replace(/\s+/g,' ').trim();
try {
  await page.goto('http://localhost:4341/', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(7000);
  const rec = page.getByText(/^\s*Records\s*\d*\s*$/i).first();
  log('Records control count: ' + await rec.count());
  if (await rec.count()) {
    await rec.click().catch(()=>{});
    await page.waitForTimeout(2500);
    const panel = clean(await page.locator('body').innerText().catch(()=>''));
    log('after opening, panel mentions the dead id: ' + /14FDE6FC/i.test(panel));
    for (const re of [/clear/i, /remove/i, /forget/i]) {
      const b = page.getByRole('button', { name: re }).first();
      if (await b.count()) log('  offers button matching ' + re + ' : visible=' + await b.isVisible().catch(()=>'n/a'));
    }
    const idx = panel.search(/Recent/i);
    log('recent section text: ' + (idx>=0 ? panel.slice(idx, idx+220) : '(not found)'));
  }
} catch(e){ log('FAILED: '+String(e).slice(0,140)); } finally { await browser.close(); }
