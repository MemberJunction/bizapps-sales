/**
 * CAUSE 2, SETTLED BY OBSERVATION: does `Add line` enable once a deal is actually saved?
 *
 * Eight spec failures share one shape -- a click timeout on `.dw-addbtn`, which reports its own title
 * "Save the deal first". That is consistent with two very different worlds:
 *
 *   the specs are stale     -- they add a line before saving, and each needs a save inserted
 *   the save path is broken -- one product bug wearing eight costumes
 *
 * Only saving a deal by hand and watching the button tells them apart. This does that and reports what
 * it saw. It is a PROBE, not a spec: it asserts nothing, it lives outside `specs/`, and the `crud`
 * project's testMatch cannot pick it up.
 *
 * PANE ORDER MATTERS, and getting it wrong cost two attempts. The workspace opens on Party info; the
 * fields live there and `.dw-addbtn` lives on Product lines. Switch panes before filling and the fill
 * times out on a control that is no longer visible -- which looks exactly like a broken form.
 *
 * Run:
 *   MJAPI_PORT=4143 MJAPI_URL=http://localhost:4143 node test-harnesses/playwright/probe-cause2.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPLORER = process.env.MJEXPLORER_URL ?? 'http://localhost:4341';
const TAG = `PW-CAUSE2-${Date.now().toString(36).toUpperCase()}`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    storageState: JSON.parse(readFileSync(join(HERE, '.auth', 'user.json'), 'utf8')),
});
const page = await ctx.newPage();
const log = (m) => console.log(`  ${m}`);
const clean = (t) => String(t).replace(/\s+/g, ' ').trim();

try {
    await page.goto(`${EXPLORER}/app/sales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await page.locator('mj-left-nav').getByRole('button', { name: /^Workspace/i }).first().click();
    await page.waitForTimeout(4000);

    const panes = async () => (await page.locator('.dw-panes__tab').allTextContents()).map(clean);
    log(`panes (badge = blocking issues): ${(await panes()).join(' | ')}`);


    // ── what does a NEW deal actually demand before it can be saved? ─────────────────────────────
    const issues = (await page.locator('.dw-issue, .dw-field-error, .dw-issues li, [class*="dw-issue"]')
        .allTextContents().catch(() => [])).map(clean).filter(Boolean);
    log(`blocking issues rendered (${issues.length}):`);
    for (const i of issues.slice(0, 8)) log(`    - ${i.slice(0, 92)}`);

    // ── fill everything on Party info that is empty and reachable ────────────────────────────────
    await page.locator('.dw-field input[type="text"]').first().fill(`${TAG} cause-2 probe`);
    /**
     * BY INDEX, NOT BY VALUE — and the first attempt got this wrong in a way worth recording.
     *
     * Angular renders `[ngValue]="null"` as the literal option value `"0: null"`, not as an empty
     * string. So `inputValue()` on an UNANSWERED select returns a truthy string, an "is it already
     * answered?" test reads it as answered, and the loop skips every control on the form. It reported
     * "filled 0 selects" while looking like it had done its job -- the same shape as a spec that
     * silently does nothing and then fails somewhere later.
     *
     * Index 1 is the first real option because index 0 is the placeholder in every one of these.
     */
    const selects = await page.locator('.dw-field select').all();
    let chosen = 0;
    for (const sel of selects) {
        const count = await sel.locator('option').count();
        if (count < 2) continue;
        await sel.selectOption({ index: 1 }).catch(() => {});
        chosen++;
        await page.waitForTimeout(400);   // pipeline drives company + stages; let it settle
    }
    log(`filled name + ${chosen} empty select(s)`);
    await page.waitForTimeout(1500);
    log(`panes after filling: ${(await panes()).join(' | ')}`);

    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    const enabled = await saveBtn.isEnabled().catch(() => false);
    log(`Save enabled: ${enabled}`);
    if (!enabled) {
        const left = (await page.locator('.dw-issue, .dw-field-error, .dw-issues li, [class*="dw-issue"]')
            .allTextContents().catch(() => [])).map(clean).filter(Boolean);
        log(`STILL BLOCKED by (${left.length}):`);
        for (const i of left.slice(0, 8)) log(`    - ${i.slice(0, 92)}`);
    } else {
        await saveBtn.click();
        await page.waitForTimeout(7000);
        // NOW the lines pane, because .dw-addbtn is only rendered there.
        const linesTab = page.locator('.dw-panes__tab').filter({ hasText: /line/i }).first();
        if (await linesTab.count()) { await linesTab.click(); await page.waitForTimeout(2000); }
        const addBtn = page.locator('.dw-addbtn').first();
        const present = await addBtn.count();
        log(`after save · message: ${clean(await page.locator('.dw-msg').first().innerText().catch(() => '(none)')).slice(0, 110)}`);
        log(`after save - Add line present: ${present}  enabled: ${present ? await addBtn.isEnabled().catch(() => 'n/a') : 'n/a'}`);
        log(`after save - title: ${present ? clean((await addBtn.getAttribute('title')) ?? '') : '(absent)'}`);
    }

    log(`deal name used: ${TAG} cause-2 probe   (PW- prefix, so the sweep removes it)`);
} catch (err) {
    log(`PROBE FAILED: ${String(err).slice(0, 200)}`);
} finally {
    await browser.close();
}
