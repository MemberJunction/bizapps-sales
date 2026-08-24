/**
 * CAUSE 3: why does the entity panel list nothing?
 *
 * Three specs (10, 20, 30) fail on `entity "..." must be listed in the app`, and the three probe specs
 * skip because that route is their subject. `openAllEntities` carries a docblock describing this exact
 * symptom: the "All Entities" / "My Favorites" toggle PERSISTS per user, and left on Favorites with none
 * set the panel reads "0 entities · No entities found" -- "as though the app had broken". Its forcing
 * logic only clicks the toggle when the toggle is VISIBLE, which it would not be if the panel rendered
 * nothing at all.
 *
 * So: harness before product. This looks at what the panel actually renders and says which it is.
 *
 * Already known from the database, before opening a browser at all:
 *   - the user has ZERO favourites, and so does every other user on this host
 *   - all four `DataExplorer.State` rows carry `navigationPanelCollapsed: true`
 * The first satisfies the docblock's precondition exactly. The second is a different persisted key with
 * the same symptom, so both are worth ruling on rather than assuming which one bit.
 *
 * Run:
 *   MJAPI_PORT=4143 MJAPI_URL=http://localhost:4143 node test-harnesses/playwright/probe-cause3.mjs
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
    // The route openSalesApp uses, and it asserts it lands here, so this part is known-good.
    await page.goto(`${EXPLORER}/app/mjbizappssales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    log(`url: ${page.url()}`);

    const body = clean(await page.locator('body').innerText().catch(() => ''));
    log(`"No entities found" on screen: ${/no entities found/i.test(body)}`);
    log(`"0 entities" on screen:        ${/\b0 entities\b/i.test(body)}`);

    for (const label of ['All Entities', 'My Favorites', 'Favorites', 'Entities']) {
        const loc = page.getByText(new RegExp(`^\\s*${label}\\s*$`, 'i')).first();
        const n = await loc.count();
        log(`toggle/link "${label}": count=${n} visible=${n ? await loc.isVisible().catch(() => 'n/a') : 'n/a'}`);
    }

    for (const ent of ['Deals', 'Pipelines']) {
        const loc = page.getByText(new RegExp(`^\\s*${ent}\\s*$`, 'i')).first();
        const n = await loc.count();
        log(`entity "${ent}": count=${n} visible=${n ? await loc.isVisible().catch(() => 'n/a') : 'n/a'}`);
    }

    // Is the navigation panel collapsed? That is the OTHER persisted key, and it produces the same
    // "nothing is listed" symptom without any Favorites toggle being involved.
    for (const sel of ['[class*="collapsed"]', '.nav-panel', '[class*="navigation-panel"]', 'mj-left-nav']) {
        const n = await page.locator(sel).count();
        if (n) log(`selector ${sel}: ${n} node(s)`);
    }

    log(`--- first 400 chars of what the page actually shows ---`);
    log(body.slice(0, 400));
} catch (err) {
    log(`PROBE FAILED: ${String(err).slice(0, 200)}`);
} finally {
    await browser.close();
}
