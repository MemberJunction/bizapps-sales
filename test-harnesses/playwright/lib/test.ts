/**
 * @fileoverview The harness's `test`, with the Explorer's workspace made EPHEMERAL.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────────────────
 *
 * Explorer persists the user's open tabs to `__mj.Workspace.Configuration` as JSON and restores them
 * on every boot. The suite shares one user with the human who owns the machine, so without this the
 * specs read and write that person's real tab state -- and they leak into each other through it.
 *
 * The concrete failure it caused, measured rather than guessed. `NavigationService.OpenNewEntityRecord`
 * builds a tab request whose `ResourceRecordId` is the empty string, because the record does not exist
 * yet. `WorkspaceStateManager.OpenTabForced` then dedups Records tabs on
 * (applicationId, resourceType, recordId, Entity) -- and for two NEW records of the same entity every
 * one of those is equal. So a leftover unsaved "New Deals Record" tab from an earlier spec matches the
 * next spec's "New deal" click, and the dedup branch takes it:
 *
 *     if (existingTab) {
 *       const updatedConfig = { ...config, activeTabId: existingTab.id };
 *       this.UpdateConfiguration(updatedConfig);
 *       return existingTab.id;      // focuses the stale tab. No new tab. No reset.
 *     }
 *
 * It returns a tab id, so the click reports success, and nothing opens. That is exactly the shape the
 * suite kept hitting: the Sales header renders, the click lands, the form root never appears. Retrying
 * cannot escape it either, because the next click matches the same stale tab -- which is why a retry
 * made the following render worse rather than better.
 *
 * The leftover tab was real and still in the database when this was written: one pinned tab, title
 * "New Deals Record", `resourceRecordId: ""`, Entity "MJ_BizApps_Sales: Deals", in a configuration of
 * 58 tabs and 116KB.
 *
 * ── WHY EPHEMERAL IS THE FIX AND A RETRY IS NOT ─────────────────────────────────────────────────
 *
 * This flag is MJ's own, not an invention here. `WorkspaceStateManager.isEphemeral()` gates BOTH
 * `loadWorkspace` and `persistConfiguration`, and its comment says why it exists: "so tab/workspace
 * state can never leak across regression tests sharing a user". MJ bakes it into its regression
 * Explorer image via Dockerfile.explorer. This harness runs against a local `ng serve` instead, so it
 * never got the protection MJ's own suite runs with -- it is turned on here, per BrowserContext.
 *
 * A retry would have papered over a cross-spec state leak by re-running the thing that leaks. This
 * removes the shared state instead, which is the actual fault, and it stops the suite writing tabs
 * into a real person's workspace as a side effect.
 */
import { test as base } from '@playwright/test';

export const test = base.extend({
    /**
     * Overridden on the CONTEXT, not the page: `page` derives from `context`, so this covers any
     * further page a spec opens, and `addInitScript` runs before the app's own scripts -- the flag is
     * therefore already set when `loadWorkspace` reads it during shell startup.
     */
    context: async ({ context }, use) => {
        await context.addInitScript(() => {
            (window as unknown as { __MJ_EPHEMERAL_WORKSPACE__?: boolean }).__MJ_EPHEMERAL_WORKSPACE__ = true;
        });
        await use(context);
    },
});

export { expect } from '@playwright/test';
