/**
 * @fileoverview Shared deal-workspace driving helpers.
 *
 * ── WHY THESE MOVED OUT OF A SPEC ───────────────────────────────────────────────────────────────
 *
 * `40-deal-workspace.spec.ts` grew them and they were right, but the lifecycle pass adds several more
 * specs that all have to open the workspace, switch panes and set the same labelled fields. Copying a
 * selector into six files is how five of them keep working after a class is renamed and the sixth
 * silently matches nothing — which in Playwright means a `.first()` that resolves to no element and a
 * timeout that names the wrong cause.
 *
 * So one copy, here. `40-deal-workspace.spec.ts` is deliberately left alone: it passes, and rewriting a
 * working spec to import from a new module is a change with no upside during a test pass.
 *
 * ── THE SELECTOR CONVENTIONS, AND WHY THEY ARE NOT `getByLabel` ─────────────────────────────────
 *
 * The panes reuse short labels on purpose — "Description" appears on the deal header AND on an order
 * line — so an unscoped label lookup is ambiguous exactly where the ambiguity would be hardest to
 * debug. Everything here scopes to `.dw-field` or `.dw-panes__tab` first.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { EXPLORER_BASE_URL } from './env';

/** The Sales app's route inside Explorer. */
export const SALES_APP_ROUTE = '/app/sales/Deals';

/** The workspace component's root element — the anchor for "did the custom surface render". */
export const WORKSPACE_ROOT = 'mjs-deal-workspace';

/**
 * Opens Explorer's Sales app and clicks through to the deal workspace.
 *
 * Waits on the workspace ROOT rather than on a field: a field appearing proves the form rendered, but
 * waiting on one couples every spec to whichever field happened to be first.
 */
export async function OpenWorkspace(page: Page): Promise<void> {
    await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });
    const nav = page.locator('mj-left-nav').getByRole('button', { name: /^Workspace/i });
    await expect(nav, 'the Sales left-nav must offer Workspace').toBeVisible({ timeout: 90_000 });
    await nav.click();
    await expect(page.locator(WORKSPACE_ROOT), 'the deal workspace must render').toBeVisible({
        timeout: 60_000,
    });
}

/** Clicks an inner pane tab and waits for its content to swap in. */
export async function OpenPane(page: Page, label: string): Promise<void> {
    const tab = page.locator('.dw-panes__tab', { hasText: label }).first();
    await expect(tab, `pane tab "${label}" must be present`).toBeVisible({ timeout: 20_000 });
    await tab.click();
    await page.waitForTimeout(600);
}

/** Sets a labelled field inside the workspace, handling both inputs and selects. */
export async function SetField(page: Page, label: string, value: string): Promise<void> {
    const field = page.locator('.dw-field', { hasText: label }).first();
    await expect(field, `field "${label}" must be visible`).toBeVisible({ timeout: 15_000 });
    const control = field.locator('input, textarea, select').first();
    const tag = await control.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
        await control.selectOption({ label: value });
    } else {
        await control.fill(value);
    }
    await page.waitForTimeout(250);
}

/** The `<select>` behind a labelled field. */
export function SelectFor(page: Page, label: string): Locator {
    return page.locator('.dw-field', { hasText: label }).first().locator('select').first();
}

/** The REAL option labels of a select, skipping the em-dash placeholder. */
export async function RealOptionLabels(select: Locator): Promise<string[]> {
    const labels: string[] = [];
    for (const option of await select.locator('option').all()) {
        const text = ((await option.textContent()) ?? '').trim();
        if (text && !text.startsWith('—')) {
            labels.push(text);
        }
    }
    return labels;
}

/**
 * Picks the first real option of a labelled select and returns its label.
 *
 * THROWS when a select offers nothing, and that is the point. A lookup that failed to load leaves an
 * empty select; selecting nothing from it and carrying on is how a spec passes while testing a form
 * that never received its data.
 */
export async function SelectFirstReal(page: Page, label: string): Promise<string> {
    const select = SelectFor(page, label);
    await expect(select, `select "${label}" must be visible`).toBeVisible({ timeout: 15_000 });
    const labels = await RealOptionLabels(select);
    if (labels.length === 0) {
        throw new Error(`select "${label}" offered no real options — its lookup did not load`);
    }
    await select.selectOption({ label: labels[0] });
    await page.waitForTimeout(300);
    return labels[0];
}

/** Selects a named option, failing loudly when it is absent rather than leaving the field untouched. */
export async function SelectByLabel(page: Page, field: string, option: string): Promise<void> {
    const select = SelectFor(page, field);
    await expect(select, `select "${field}" must be visible`).toBeVisible({ timeout: 15_000 });
    const labels = await RealOptionLabels(select);
    if (!labels.includes(option)) {
        throw new Error(
            `select "${field}" does not offer "${option}" — it offers: ${labels.join(', ') || '(nothing)'}`,
        );
    }
    await select.selectOption({ label: option });
    await page.waitForTimeout(300);
}

/**
 * Selects the option carrying a given record ID, by LABELLED field.
 *
 * ── WHY A RAW GUID CANNOT BE PASSED TO `selectOption` HERE ───────────────────────────────────────
 *
 * Every picker in this workspace binds `[ngValue]`, so Angular writes the option's DOM value as
 * `"<index>: <guid>"` — `"4: a0111111-…"`. `selectOption('a0111111-…')` therefore matches nothing and
 * times out after thirty seconds with "did not find some options", which is what it did in
 * `90-workspace-tab-state`. It is the same trap that made `72-inline-create` compare a picker's value
 * against a bare GUID and fail for a reason unrelated to what it was testing.
 *
 * So the option is found by its VALUE SUFFIX and selected by the value Angular actually wrote. Compared
 * case-insensitively: the client generates lowercase keys and the views return uppercase, which is a
 * documented defect class in this repo, not a hypothetical.
 */
export async function SelectByRecordID(page: Page, field: string, id: string): Promise<void> {
    const select = SelectFor(page, field);
    await expect(select, `select "${field}" must be visible`).toBeVisible({ timeout: 15_000 });
    const values = await select.locator('option').evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value),
    );
    const wanted = values.find((v) => v.toLowerCase().endsWith(id.toLowerCase()));
    if (!wanted) {
        throw new Error(
            `select "${field}" offers no option for ${id}. Its option values are: ` +
                `${values.join(' | ') || '(none)'}`,
        );
    }
    await select.selectOption(wanted);
    await page.waitForTimeout(300);
}

/** Clicks the workspace's save and waits for the button to settle. */
export async function SaveDeal(page: Page): Promise<void> {
    const save = page.getByRole('button', { name: /^Save deal/i }).first();
    await expect(save, 'the Save deal button must be present').toBeVisible({ timeout: 15_000 });
    await save.click();
    await page.waitForTimeout(2_500);
}

/**
 * Whether a labelled field's control is editable.
 *
 * Reads the DOM's own `disabled` rather than inferring from styling, because the lock is expressed as
 * `[disabled]` bindings and a CSS check would pass on a field that merely looks greyed.
 */
export async function FieldIsEditable(page: Page, label: string): Promise<boolean> {
    const control = page
        .locator('.dw-field', { hasText: label })
        .first()
        .locator('input, textarea, select')
        .first();
    await expect(control, `field "${label}" must exist to ask whether it is editable`).toHaveCount(1, {
        timeout: 15_000,
    });
    return control.isEnabled();
}
