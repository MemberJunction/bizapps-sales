/**
 * @fileoverview Driving the Deal record form — the surface that replaced the deal workspace (#88).
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────────────────
 *
 * Deals became Explorer record tabs: "New deal" is `OpenNewEntityRecord`, a list row is
 * `OpenEntityRecord`, and both render `mjs-deal-form`. `lib/workspace.ts` still drives
 * `mjs-deal-workspace`, which no template has mounted since the Workspace rail was removed, so every
 * spec reaching it failed in setup before any assertion ran. These helpers drive the live form.
 *
 * ── THE SELECTOR CONVENTIONS ────────────────────────────────────────────────────────────────────
 *
 * - **Fields by `data-field`, never by label.** Every field wrapper in the Deal form panels carries
 *   `data-field="<column>"`. Labels come from `EntityField.DisplayName`, which is metadata and changes
 *   without a code change; the column name is the contract.
 * - **Actions by `data-testid`**, the same way the workspace exposed them. Found by role in the flow,
 *   never by button text or by a status NAME (the vocabulary rule).
 * - **Scoped to the VISIBLE form.** Explorer keeps every open tab's form in the DOM and hides the
 *   inactive ones, so an unscoped `.first()` can match a hidden tab.
 * - **A field in a collapsed panel is expanded first.** Collapsed content stays in the DOM at zero
 *   height, so it exists but is not visible, and a fill against it times out naming the wrong cause.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { QueryOne } from './db';
import { EXPLORER_BASE_URL } from './env';

/** The hand-built Sales app's route inside Explorer (not the CodeGen app in `explorer.ts`). */
export const SALES_DEALS_ROUTE = '/app/sales/Deals';

/** The Deal form's host element — the anchor for "did the record tab render". */
export const DEAL_FORM_ROOT = 'mjs-deal-form';

/** The Deal form on the ACTIVE tab. */
export function DealForm(page: Page): Locator {
    return page.locator(`${DEAL_FORM_ROOT}:visible`).first();
}

/** An element inside the active Deal form by `data-testid`. */
export function ByTestId(page: Page, testId: string): Locator {
    return DealForm(page).locator(`[data-testid="${testId}"]:visible`).first();
}

/**
 * Opens the Sales app and starts a new deal from the header's primary action.
 *
 * Waits on the FORM ROOT rather than on a field, so no spec is coupled to whichever field renders first.
 */
export async function OpenNewDeal(page: Page): Promise<void> {
    await page.goto(`${EXPLORER_BASE_URL}${SALES_DEALS_ROUTE}`, { waitUntil: 'domcontentloaded' });
    const primary = page.locator('[data-testid="sales-primary"]:visible').first();
    await expect(primary, 'the Sales header must offer New deal').toBeVisible({ timeout: 90_000 });
    await primary.click();
    await expect(DealForm(page), 'a new deal must open as a Deal record form').toBeVisible({ timeout: 60_000 });
}

/**
 * Expands the collapsible panel that holds `inner`, when it is collapsed.
 *
 * Reads the collapsed class rather than toggling blindly: a click on an expanded panel collapses it.
 */
async function expandPanelHolding(page: Page, inner: string): Promise<void> {
    const panel = DealForm(page).locator(`.mj-forms-panel:has(${inner})`).last();
    if ((await panel.count()) === 0) {
        return; // Not inside a panel (the hero's Name field).
    }
    const collapsed = panel.locator(':scope > .mj-forms-panel-body--collapsed');
    if ((await collapsed.count()) > 0) {
        await panel.locator(':scope > .mj-forms-panel-header').click();
        await expect(collapsed, 'the panel must expand').toHaveCount(0, { timeout: 10_000 });
        await page.waitForTimeout(300);
    }
}

/** Expands a form panel by its `SectionKey` (`pipeline`, `party`, `lines`, `close`, ...). */
export async function OpenSection(page: Page, sectionKey: string): Promise<void> {
    const panel = DealForm(page).locator(`.mj-forms-panel[data-section-key="${sectionKey}"]`).first();
    await expect(panel, `the Deal form must have a "${sectionKey}" panel`).toHaveCount(1, { timeout: 30_000 });
    await expandPanelHolding(page, `[data-section-key="${sectionKey}"]`);
    await panel.scrollIntoViewIfNeeded().catch(() => undefined);
}

/** A field's wrapper, with its panel expanded. */
export async function Field(page: Page, fieldName: string): Promise<Locator> {
    const selector = `[data-field="${fieldName}"]`;
    const field = DealForm(page).locator(selector).first();
    await expect(field, `the Deal form must render field ${fieldName}`).toHaveCount(1, { timeout: 30_000 });
    await expandPanelHolding(page, selector);
    await field.scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(field, `field ${fieldName} must be visible`).toBeVisible({ timeout: 15_000 });
    return field;
}

/** Types into a text, number, date or textarea field. */
export async function SetText(page: Page, fieldName: string, value: string): Promise<void> {
    const input = (await Field(page, fieldName)).locator('.mj-forms-field--editing').locator('input, textarea').first();
    await expect(input, `field ${fieldName} must be editable`).toBeVisible({ timeout: 15_000 });
    await input.fill(value);
    await input.blur().catch(() => undefined);
    await page.waitForTimeout(300);
}

/**
 * Picks a foreign-key value from MJ's type-ahead and returns the picked row's text.
 *
 * With `search`, types it and picks the row containing it. Without, picks the first row offered.
 *
 * THROWS when the lookup offers nothing. A lookup that failed to load and a lookup that was never
 * touched both leave the field empty, and carrying on from either tests a form that got no data.
 */
export async function PickLookup(page: Page, fieldName: string, search?: string): Promise<string> {
    const field = await Field(page, fieldName);
    const input = field.locator('.mj-fk-search input').first();
    await expect(input, `lookup ${fieldName} must be editable`).toBeVisible({ timeout: 15_000 });
    await input.click();
    if (search) {
        await input.fill('');
        await input.pressSequentially(search, { delay: 40 });
    }

    const rows = field.locator('.mj-fk-grid-row:not(.mj-fk-grid-row--header)');
    const row = search ? rows.filter({ hasText: search }).first() : rows.first();
    const offered = await row
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
    if (!offered) {
        throw new Error(
            `lookup ${fieldName} offered no row${search ? ` containing "${search}"` : ''} — its entity did not load`,
        );
    }
    const text = ((await row.innerText()) ?? '').trim();
    // MJ selects on mousedown so the input's blur cannot close the list first; click() fires it.
    await row.click();
    await page.waitForTimeout(500);
    return text;
}

/** The Pipeline panel's Status control — the one door to a status change on the form. */
export async function StatusSelect(page: Page): Promise<Locator> {
    await Field(page, 'DealStatusTypeID');
    return ByTestId(page, 'deal-status');
}

/** Selects a status by the ID of its row, matched case-insensitively (see `SelectOptionByID`). */
export async function SetStatusByID(page: Page, statusID: string): Promise<void> {
    await SelectOptionByID(await StatusSelect(page), statusID, 'Status');
    await page.waitForTimeout(300);
}

/**
 * Selects the option carrying a record ID in a `[ngValue]` select.
 *
 * Angular writes the DOM value as `"<index>: <guid>"`, so a bare GUID matches nothing. The option is
 * found by value SUFFIX, case-insensitively: the client generates lowercase keys and views return
 * uppercase.
 */
export async function SelectOptionByID(select: Locator, id: string, what: string): Promise<void> {
    await expect(select, `${what} must be visible`).toBeVisible({ timeout: 15_000 });
    const values = await select
        .locator('option')
        .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    const wanted = values.find((v) => v.toLowerCase().endsWith(id.toLowerCase()));
    if (!wanted) {
        throw new Error(`${what} offers no option for ${id}. Its option values are: ${values.join(' | ') || '(none)'}`);
    }
    await select.selectOption(wanted);
}

/** The first active OPEN status, by rank — where a new deal starts. */
export async function FirstOpenStatus(): Promise<{ ID: string; Name: string }> {
    const row = await QueryOne<{ ID: string; Name: string }>(
        `SELECT TOP 1 ID, Name FROM __mj_BizAppsSales.DealStatusType
          WHERE IsActive = 1 AND IsOpen = 1 ORDER BY DisplayRank`,
    );
    expect(row?.ID, 'the host needs an active OPEN status for a deal to start in').toBeTruthy();
    return { ID: String(row!.ID), Name: String(row!.Name) };
}

/** Whether the form is in edit mode — MJ marks every editable field while it is. */
export async function InEditMode(page: Page): Promise<boolean> {
    return (await DealForm(page).locator('.mj-forms-field--editing').count()) > 0;
}

/** Puts a saved deal into edit mode through the form toolbar. No-op when already editing. */
export async function EditDeal(page: Page): Promise<void> {
    if (await InEditMode(page)) return;
    // Icon-only: the built-in item has no text, only its title.
    const edit = page.locator('.mj-forms-btn[title="Edit this Record"]:visible').first();
    await expect(edit, 'a saved deal must offer Edit').toBeVisible({ timeout: 15_000 });
    await edit.click();
    await expect
        .poll(() => InEditMode(page), { message: 'the form must enter edit mode', timeout: 15_000 })
        .toBe(true);
}

/**
 * Saves through the form toolbar and waits for the form to leave edit mode.
 *
 * Leaving edit mode is the signal because a refused save stays in it — so a timeout here means the
 * save was refused, and the form's own validation text is attached to the failure.
 */
export async function SaveDeal(page: Page): Promise<void> {
    const save = page.locator('.mj-forms-btn--primary[title="Save Changes"]:visible').first();
    await expect(save, 'the form toolbar must offer Save Changes').toBeVisible({ timeout: 15_000 });
    await save.click();
    const left = await expect
        .poll(() => InEditMode(page), { timeout: 30_000 })
        .toBe(false)
        .then(() => true)
        .catch(() => false);
    if (!left) {
        const errors = await DealForm(page)
            .locator('.mj-forms-field--has-error, .mj-forms-validation, [class*="error"]:visible')
            .allInnerTexts()
            .catch(() => []);
        throw new Error(
            `the deal did not save — the form is still in edit mode. On screen: ${
                errors.map((e) => e.trim()).filter(Boolean).join(' | ') || '(no error text)'
            }`,
        );
    }
    await page.waitForTimeout(1_000);
}

/**
 * Whether a field can be edited right now.
 *
 * A locked field renders in its READ form even in edit mode (`EditMode && FieldEditable(...)`), so the
 * `--editing` marker is the DOM's own answer. Call in edit mode; outside it every field is read-only.
 */
export async function FieldIsEditable(page: Page, fieldName: string): Promise<boolean> {
    const field = await Field(page, fieldName);
    const editing = field.locator('.mj-forms-field--editing');
    if ((await editing.count()) === 0) return false;
    return editing.locator('input, textarea, select').first().isEnabled();
}
