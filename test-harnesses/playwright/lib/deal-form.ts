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
/**
 * Waits for the Deal form to stop REBUILDING, not merely to paint.
 *
 * The form root mounts, renders fields, and then re-creates its panels as the record and its
 * metadata finish loading. A caller that reads a field in that window sees it satisfy
 * `toHaveCount(1)` and then be absent for the whole of the next assertion -- which reports as "the
 * field does not exist" and looks like a selector bug rather than a form still assembling itself.
 *
 * The settled signal is the field COUNT holding still across consecutive samples. A fixed sleep was
 * the obvious alternative and is a guess: too short on a slow run, wasted on every fast one, and
 * quietly wrong the next time startup changes.
 */
export async function WaitForFormSettled(page: Page, stableFor = 2, gapMs = 400): Promise<void> {
    const fields = DealForm(page).locator('[data-field]');
    await expect(fields.first(), 'the Deal form must render its fields, not just its shell').toBeVisible({
        timeout: 60_000,
    });

    const deadline = Date.now() + 60_000;
    let last = -1;
    let repeats = 0;
    while (Date.now() < deadline) {
        const n = await fields.count();
        // Zero means a rebuild is in flight: the previous panels are gone and the next are not up.
        repeats = n > 0 && n === last ? repeats + 1 : 0;
        last = n;
        if (repeats >= stableFor) {
            return;
        }
        await page.waitForTimeout(gapMs);
    }
    // Not fatal: the caller's own assertion is the one that should report what is missing, and with
    // a better message than this could give. Falling through leaves that intact.
}

export async function OpenNewDeal(page: Page): Promise<void> {
    await page.goto(`${EXPLORER_BASE_URL}${SALES_DEALS_ROUTE}`, { waitUntil: 'domcontentloaded' });
    const primary = page.locator('[data-testid="sales-primary"]:visible').first();
    await expect(primary, 'the Sales header must offer New deal').toBeVisible({ timeout: 90_000 });
    await primary.click();
    await expect(DealForm(page), 'a new deal must open as a Deal record form').toBeVisible({ timeout: 60_000 });
    /**
     * PRESENT IS NOT READY. The form root mounts before its panels render their fields, and every
     * caller's next line addresses a field -- so returning here on the root alone loses a race
     * intermittently, and it surfaces as "must render field Name" with a count of 0, which reads
     * like the field does not exist rather than like a form still building itself.
     */
    await WaitForFormSettled(page);
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

/**
 * Activates a form section from MJ's chrome RAIL, by the title it shows.
 *
 * The rail displays one section at a time, so a control in another section is rendered and HIDDEN.
 * `Field` expands a collapsed panel and `OpenSection` addresses the older stacked-panel form; neither
 * can activate a rail section, and both return quietly when there is nothing to expand -- so a spec
 * that needs another section fails on visibility with no hint as to why.
 *
 * Reads `is-active` before clicking, for the same reason `expandPanelHolding` reads the collapsed
 * class: clicking a section that is already showing is not guaranteed to be a no-op. Returns quietly
 * when the form has no rail, so this is safe to call on either layout.
 */
export async function ShowSection(page: Page, title: string): Promise<void> {
    const rail = page.locator('.mj-forms-chrome-rail').first();
    if ((await rail.count()) === 0) {
        return; // Older layout: sections are stacked panels, and `Field` can reach them.
    }
    // A collapsed rail shows a spine instead of its items; expand it before looking for one.
    if (await rail.evaluate((el) => el.classList.contains('is-collapsed')).catch(() => false)) {
        await rail.locator('.mj-forms-chrome-rail-spine').first().click();
        await page.waitForTimeout(300);
    }
    /**
     * Matched on the LABEL SPAN, and on the whole of it.
     *
     * `hasText: 'Pipeline'` would also match a "Pipeline History" section and silently activate the
     * wrong one, reporting a missing field somewhere else entirely. Anchoring against the ITEM does
     * not work either: a rail item also carries error, warning and row-count badges that render
     * NUMBERS, so its text can be "Internal team2" and an anchored match would find nothing exactly
     * where a section has a count. The label span holds the title and nothing else.
     *
     * The title is escaped because a section name is data, not a pattern.
     */
    const exact = new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    const item = rail
        .locator('.mj-forms-chrome-rail-item')
        .filter({ has: page.locator('.mj-forms-chrome-rail-label').filter({ hasText: exact }) })
        .first();
    await expect(item, `the form rail must offer a "${title}" section`).toBeVisible({ timeout: 30_000 });
    if (await item.evaluate((el) => el.classList.contains('is-active')).catch(() => false)) {
        return;
    }
    await item.click();
    await expect(item, `the "${title}" section must become active`).toHaveClass(/\bis-active\b/, {
        timeout: 15_000,
    });
    await page.waitForTimeout(300);
}

/** Expands a form panel by its `SectionKey` (`pipeline`, `party`, `lines`, `close`, ...). */
export async function OpenSection(page: Page, sectionKey: string): Promise<void> {
    const panel = DealForm(page).locator(`.mj-forms-panel[data-section-key="${sectionKey}"]`).first();
    await expect(panel, `the Deal form must have a "${sectionKey}" panel`).toHaveCount(1, { timeout: 30_000 });
    await expandPanelHolding(page, `[data-section-key="${sectionKey}"]`);
    await panel.scrollIntoViewIfNeeded().catch(() => undefined);
}

/**
 * Brings a control into view by activating whichever form section owns it.
 *
 * The Deal form shows ONE section at a time from MJ's chrome rail, and an inactive section is not
 * merely hidden -- its markup is absent, so a locator reports count 0 and the failure reads like the
 * control was removed from the app. Nothing in the markup maps a control to its section, so this
 * walks the rail: activate a section, look again, stop when the control appears.
 *
 * Leaves the form on whichever section revealed it, which is where the caller wants to be. If none
 * does, it returns quietly and leaves the form on the last one tried -- the caller's own assertion
 * names what it wanted and reports it better than a generic "not here either" could, and a run that
 * gets this far is failing regardless.
 */
export async function RevealInForm(page: Page, target: Locator): Promise<void> {
    if (await target.isVisible().catch(() => false)) {
        return;
    }
    const rail = page.locator('.mj-forms-chrome-rail').first();
    if ((await rail.count()) === 0) {
        return; // Older stacked-panel form: every section is on the page already.
    }
    // A collapsed rail shows a spine instead of its items.
    if (await rail.evaluate((el) => el.classList.contains('is-collapsed')).catch(() => false)) {
        await rail.locator('.mj-forms-chrome-rail-spine').first().click().catch(() => undefined);
        await page.waitForTimeout(250);
    }

    const items = rail.locator('.mj-forms-chrome-rail-item');
    const count = await items.count();
    for (let i = 0; i < count; i += 1) {
        const item = items.nth(i);
        // The active one is where we already are, and clicking it again is not guaranteed a no-op.
        if (await item.evaluate((el) => el.classList.contains('is-active')).catch(() => false)) {
            continue;
        }
        await item.click().catch(() => undefined);
        await page.waitForTimeout(250);
        if (await target.isVisible().catch(() => false)) {
            return;
        }
    }
}

/** A field's wrapper, with its panel expanded, and its section showing. */
export async function Field(page: Page, fieldName: string): Promise<Locator> {
    const selector = `[data-field="${fieldName}"]`;
    const field = DealForm(page).locator(selector).first();
    await expandPanelHolding(page, selector);
    // Before the count assertion, not after: a section the rail is not showing has no markup at all,
    // so `toHaveCount(1)` would fail describing a field that is simply elsewhere.
    await RevealInForm(page, field);
    await expect(field, `the Deal form must render field ${fieldName}`).toHaveCount(1, { timeout: 30_000 });
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

    /**
     * THE RESULT LIST IS NOT INSIDE THE FIELD. MJ renders the dropdown in an overlay, so scoping the
     * row search to `[data-field]` finds nothing however well the lookup is working -- and then says
     * "its entity did not load", which is a statement about where we looked rather than about the
     * entity. That message cost a long time: it reads as a broken lookup, and the lookup is fine.
     *
     * Measured on a running Explorer: 3 rows in the document, 0 inside the field element.
     * `lib/explorer.ts`'s `setLookup` already says the popup lives outside the container; this is the
     * caller that never got the memo.
     *
     * `:visible` because a closed dropdown's markup can linger, and only the open one is offering.
     */
    const rows = page.locator('.mj-fk-grid-row:not(.mj-fk-grid-row--header):visible');
    const row = search ? rows.filter({ hasText: search }).first() : rows.first();
    const offered = await row
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
    if (!offered) {
        const anywhere = await page.locator('.mj-fk-grid-row:not(.mj-fk-grid-row--header)').count();
        throw new Error(
            `lookup ${fieldName} offered no row${search ? ` containing "${search}"` : ''}. `
                + `${anywhere} row(s) exist in the document, so ${anywhere > 0
                    ? 'the list rendered and the filter did not match'
                    : 'the list never rendered'}.`,
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
 * The Pipeline panel's Pipeline control.
 *
 * A dedicated `<select>` since golive#291 rather than an MJ lookup, because choosing a pipeline also
 * chooses which stages exist. `PickLookup` targets `.mj-fk-search` and no longer reaches this.
 */
export async function PipelineSelect(page: Page): Promise<Locator> {
    await Field(page, 'PipelineID');
    return ByTestId(page, 'deal-pipeline');
}

/**
 * Selects a pipeline by the ID of its row (see `SelectOptionByID`).
 *
 * Choosing a pipeline CLEARS a stage that does not belong to it -- the point of golive#291 -- so a
 * stage is picked AFTER this, never before.
 */
export async function SetPipelineByID(page: Page, pipelineID: string): Promise<void> {
    await SelectOptionByID(await PipelineSelect(page), pipelineID, 'Pipeline');
    await page.waitForTimeout(300);
}

/**
 * The Pipeline panel's Stage control.
 *
 * Offers only the CURRENT pipeline's stages. It was an MJ type-ahead over every stage in the system
 * -- the defect golive#291 reports -- so a spec picking a stage by its text is picking from a list
 * that no longer exists.
 */
export async function StageSelect(page: Page): Promise<Locator> {
    await Field(page, 'PipelineStageID');
    return ByTestId(page, 'deal-stage');
}

/** Selects a stage by the ID of its row (see `SelectOptionByID`). */
export async function SetStageByID(page: Page, stageID: string): Promise<void> {
    await SelectOptionByID(await StageSelect(page), stageID, 'Stage');
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

/**
 * The first active pipeline by name -- the one the Pipeline select offers first.
 *
 * `LoadPipelines` filters `IsActive = 1` and orders by `Name`, so this row is guaranteed to BE in the
 * dropdown. A spec needing "any pipeline" takes this rather than whichever option rendered first.
 */
export async function PipelineByName(name?: string): Promise<{ ID: string; Name: string }> {
    if (!name) return FirstPipeline();
    const row = await QueryOne<{ ID: string; Name: string }>(
        `SELECT TOP 1 ID, Name FROM __mj_BizAppsSales.Pipeline
          WHERE IsActive = 1 AND Name = '${name.replace(/'/g, "''")}' ORDER BY Name`,
    );
    expect(row?.ID, `the host needs an active pipeline named "${name}"`).toBeTruthy();
    return { ID: String(row!.ID), Name: String(row!.Name) };
}

export async function FirstPipeline(): Promise<{ ID: string; Name: string }> {
    const row = await QueryOne<{ ID: string; Name: string }>(
        `SELECT TOP 1 ID, Name FROM __mj_BizAppsSales.Pipeline
          WHERE IsActive = 1 ORDER BY Name`,
    );
    expect(row?.ID, 'the host needs an active pipeline for a deal to be created in').toBeTruthy();
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
