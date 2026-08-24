/**
 * ONE ATTEMPT AT DOING THIS THROUGH THE PRODUCT, before falling back to SQL.
 *
 * The orphaned reference is restored from `__mj.UserRecordLog`. If Explorer exposes a "clear recent
 * records" affordance, using it beats a DELETE: it goes through whatever bookkeeping the app does, and
 * it is a gesture a human could repeat without a database client.
 *
 * The known obstacle is that the failing restore happens BEFORE the shell is usable, so the affordance
 * may not be reachable at all. That is the thing this establishes rather than assumes.
 *
 * Navigates somewhere the dead record is NOT restored -- a bare `/` rather than the sales app -- on the
 * chance the shell comes up clean there and the recent list is reachable from the home screen.
 *
 * Run:
 *   MJEXPLORER_URL=http://localhost:4341 node test-harnesses/playwright/probe-clear-recent.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPLORER = process.env.MJEXPLORER_URL ?? 'http://localhost:4341';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    storageState: JSON.parse(readFileSync(join(HERE, '.auth', 'user.json'), 'utf8')),
});
const page = await ctx.newPage();
const log = (m) => console.log(`  ${m}`);
const clean = (t) => String(t).replace(/\s+/g, ' ').trim();

try {
    await page.goto(`${EXPLORER}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    log(`landed on: ${page.url()}`);

    const body = clean(await page.locator('body').innerText().catch(() => ''));
    log(`shell usable here: ${body.length > 80}`);
    log(`dead-record error on this screen: ${/InnerLoad returned false|Could not load/i.test(body)}`);

    // Anything that looks like a recent-records control.
    const candidates = [
        /clear recent/i, /clear history/i, /recent records/i, /recently viewed/i, /clear all/i,
    ];
    let found = 0;
    for (const re of candidates) {
        const byRole = page.getByRole('button', { name: re }).first();
        const byText = page.getByText(re).first();
        const nr = await byRole.count();
        const nt = await byText.count();
        if (nr || nt) {
            found++;
            log(`candidate ${re}: button=${nr} text=${nt} visible=${nr ? await byRole.isVisible().catch(() => 'n/a') : await byText.isVisible().catch(() => 'n/a')}`);
        }
    }
    if (!found) log('no clear-recent affordance found by any of the usual labels');

    log(`--- first 300 chars of the home screen ---`);
    log(body.slice(0, 300));
} catch (err) {
    log(`PROBE FAILED: ${String(err).slice(0, 200)}`);
} finally {
    await browser.close();
}
