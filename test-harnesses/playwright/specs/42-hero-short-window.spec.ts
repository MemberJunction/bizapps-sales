/**
 * THE DEAL HEADER CARD IS NEVER CLIPPED ON A SHORT WINDOW (bc-aidp-next-golive#287).
 *
 * The form body is a fixed-height column. MJ mounts the header card through two `display: contents`
 * hosts, so the card itself is a flex item there, and with `overflow: hidden` its minimum height is 0.
 * Without `flex-shrink: 0` on the card, tall panels below squeezed it to its title row: in edit mode the
 * Name editor and summary were cut off, and so was the summary on the Overview right after a save.
 *
 * The window here is 1100 x 617 CSS px: a 1920 x 1080 screen at 175% scaling, where it was reported.
 * The default 1600 x 1100 harness window is tall enough that nothing shrinks, which is why no other
 * spec caught it.
 *
 * WHAT IT PROVES:
 *   1. After a new deal is saved (view mode, Overview), the card shows all of its content.
 *   2. In edit mode, the card shows all of its content, the Name editor included.
 */
import { expect, test, type Page } from '@playwright/test';

import { CloseDb, QueryAll } from '../lib/db';
import { ComposeDeal, PurgeDeal } from '../lib/deal-flow';
import { DealForm, EditDeal, InEditMode } from '../lib/deal-form';
import { shot } from '../lib/explorer';

const RUN_TAG = `PW-${Date.now().toString(36).toUpperCase()}`;
const DEAL_NAME = `Hero short window ${RUN_TAG}`;

test.use({ viewport: { width: 1100, height: 617 } });

/** By name, as in spec 40: a failure part-way leaves a row no variable here ever held. */
test.afterAll(async () => {
    const deals = await QueryAll<{ ID: string; OrderID: string | null }>(
        `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name = '${DEAL_NAME}'`,
    );
    for (const d of deals) {
        await PurgeDeal(d.ID, d.OrderID ? String(d.OrderID) : null);
    }
    await CloseDb();
});

/**
 * The card's rendered height against its content height. A clipped card has content it cannot show,
 * which is what the report saw; a 1px tolerance absorbs sub-pixel rounding.
 */
async function expectHeroNotClipped(page: Page, when: string): Promise<void> {
    const hero = DealForm(page).locator('.mjs-deal-hero:visible').first();
    await expect(hero, `the header card must render ${when}`).toBeVisible({ timeout: 20_000 });
    const size = await hero.evaluate((el) => ({ client: el.clientHeight, content: el.scrollHeight }));
    expect(size.client, `the header card must show all of its content ${when}`).toBeGreaterThanOrEqual(
        size.content - 1,
    );
}

test.describe('deal header card — short window', () => {
    test('is not clipped after save or in edit mode', async ({ page }) => {
        test.setTimeout(180_000);

        await test.step('after a new deal is saved', async () => {
            await ComposeDeal(page, DEAL_NAME);
            await expectHeroNotClipped(page, 'after save');
            await shot(page, '42-01-after-save');
        });

        await test.step('in edit mode', async () => {
            await EditDeal(page);
            expect(await InEditMode(page)).toBe(true);
            await expectHeroNotClipped(page, 'in edit mode');
            await shot(page, '42-02-edit-mode');
        });
    });
});
