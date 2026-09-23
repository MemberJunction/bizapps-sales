import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Metadata, type IMetadataProvider } from '@memberjunction/core';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { MJSDealClosePanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * WHAT THE OPERATION SAID MUST REACH THE SCREEN (bc-aidp-next-golive#205, last sentence of the
 * close paragraph): *"Any downstream step that did not happen (contract refused, task not routed)
 * should show on the form after the save."*
 *
 * ── THE HOLE THIS FILLS, AND WHY IT SURVIVED TWO PASSES OF COVERAGE ─────────────────────────────
 *
 * The chain has three links and only two were pinned:
 *
 *   1. the operation RETURNS the warnings   -> `close-deal.CD23` (integration), mutation-proven
 *   2. the panel POPULATES its list         -> NOTHING ASSERTED THIS
 *   3. the template RENDERS that list       -> `deal-close-action` asserts the source contains
 *                                              `@if (Message || Issues.length)` and `@for (i of Issues…)`
 *
 * Link 2 is the one that matters, because a template bound to a field nothing ever fills satisfies
 * BOTH existing assertions perfectly. That is this repo's recurring defect class stated backwards --
 * not a correct value nothing consumes, but a consumer of a value nothing produces -- and the
 * observable result is the one golive#205 was filed about: a close that half-worked and said so to
 * nobody.
 *
 * ── WHY THE SUCCESS PATH IS THE INTERESTING ONE ────────────────────────────────────────────────
 *
 * `Sales.CloseDeal` returns `Success: true` WITH warnings attached: a contract the seam refused, a
 * finance task that could not be routed, an order status orders would not take. A handler that only
 * populated the list on `!Success` would look right, pass a failure-path test, and drop every warning
 * on the closes that actually happen. Both panels had exactly that bug once -- `ApplyCloseIssues` ran
 * only on the failure branch -- which is recorded in `deal-workspace.component.ts`.
 *
 * So every check here drives a SUCCESSFUL operation carrying a warning, and the failure path is
 * covered alongside it rather than instead of it.
 *
 * ── BOTH PANELS, BECAUSE #205 NAMES BOTH DOORS ─────────────────────────────────────────────────
 *
 * The Pipeline panel is the status field the issue was filed against and keeps its list in
 * `ActionIssues`; the Close panel is the Close section's own action and keeps its in `Issues`. Two
 * fields, two templates, one requirement.
 */

const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true, IsWon: true, IsLost: false },
];

/** The shape a half-done close really returns: committed, and carrying what did not happen. */
const CONTRACT_REFUSED = 'Contract was planned but not created: the seam declined.';
const TASK_UNROUTED = 'The OrderReview task was created but not routed: no finance assignee.';

function providerStub(opts: { operationSucceeds?: boolean; issues?: string[] } = {}): IMetadataProvider {
    const { operationSucceeds = true, issues = [] } = opts;
    return {
        RouteOperation: async () => ({
            Success: true,
            Output: {
                Success: operationSucceeds,
                Issues: issues.map((Message) => ({ Message, Section: 'deal', Field: null, Severity: 'warning' })),
                Routing: [],
            },
        }),
    } as unknown as IMetadataProvider;
}

function recordStub(over: Record<string, unknown> = {}): DealEntity {
    return { ID: 'deal-1', IsSaved: true, DealStatusTypeID: 'open-1', Dirty: false, ...over } as unknown as DealEntity;
}

/** A host form that saves cleanly, so nothing before the operation can explain a missing warning. */
function formStub() {
    return {
        EditMode: false,
        SaveRecord: async (): Promise<boolean> => true,
        EndEditMode: (): void => undefined,
        RefreshRecord: async (): Promise<boolean> => true,
    };
}

function pipelinePanel(): MJSDealPipelinePanel {
    const panel = new MJSDealPipelinePanel();
    panel.Record = recordStub();
    panel.FormComponent = formStub() as unknown as MJSDealPipelinePanel['FormComponent'];
    (panel as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set(STATUSES);
    // Through the real door: picking a closing status on an open deal is what arms the close.
    panel.SetStatus('won-1');
    expect(panel.PendingCloseStatusID, 'the pick must have been held as a close').toBe('won-1');
    return panel;
}

function closePanel(): MJSDealClosePanel {
    const panel = new MJSDealClosePanel();
    panel.Record = recordStub();
    panel.FormComponent = formStub() as unknown as MJSDealClosePanel['FormComponent'];
    (panel as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set(STATUSES);
    panel.TargetStatusID = 'won-1';
    panel.OnTargetChange();
    expect(panel.CanConfirm, 'a won target with no loss reason must be confirmable').toBe(true);
    return panel;
}

let savedProvider: IMetadataProvider;
beforeEach(() => {
    savedProvider = Metadata.Provider;
});
afterEach(() => {
    // The provider is a global; leaving a stub behind makes an unrelated suite's first read return
    // this fixture's close.
    Metadata.Provider = savedProvider;
});

describe('the Pipeline status field surfaces what the close could not do', () => {
    it('keeps the warnings from a close that SUCCEEDED', async () => {
        Metadata.Provider = providerStub({ issues: [CONTRACT_REFUSED, TASK_UNROUTED] });
        const panel = pipelinePanel();

        await panel.ConfirmClose();

        expect(panel.ActionIssues).toContain(CONTRACT_REFUSED);
        expect(panel.ActionIssues).toContain(TASK_UNROUTED);
    });

    it('does not call a half-done close clean', async () => {
        // The whole point: the deal DID close, so the message is a success, and the warnings still
        // have to be on screen beside it.
        Metadata.Provider = providerStub({ issues: [CONTRACT_REFUSED] });
        const panel = pipelinePanel();

        await panel.ConfirmClose();

        expect(panel.ActionFailed, 'a close that committed is not a failure').toBe(false);
        expect(panel.ActionIssues.length, 'and it still owes the user its warnings').toBeGreaterThan(0);
    });

    it('reports a REFUSED close through the same channel', async () => {
        Metadata.Provider = providerStub({ operationSucceeds: false, issues: [CONTRACT_REFUSED] });
        const panel = pipelinePanel();

        await panel.ConfirmClose();

        expect(panel.ActionFailed).toBe(true);
        expect(panel.ActionIssues).toContain(CONTRACT_REFUSED);
    });

    it('starts each attempt from a clean list', async () => {
        // Otherwise a warning from a previous attempt reads as a warning about this one.
        Metadata.Provider = providerStub({ issues: [] });
        const panel = pipelinePanel();
        panel.ActionIssues = ['stale warning from an earlier attempt'];

        await panel.ConfirmClose();

        expect(panel.ActionIssues).not.toContain('stale warning from an earlier attempt');
    });
});

describe('the Close panel surfaces them too', () => {
    it('keeps the warnings from a close that SUCCEEDED', async () => {
        Metadata.Provider = providerStub({ issues: [CONTRACT_REFUSED, TASK_UNROUTED] });
        const panel = closePanel();

        await panel.ConfirmClose();

        expect(panel.Issues).toContain(CONTRACT_REFUSED);
        expect(panel.Issues).toContain(TASK_UNROUTED);
        expect(panel.MessageIsError, 'the close committed').toBe(false);
    });

    it('reports a REFUSED close through the same channel', async () => {
        Metadata.Provider = providerStub({ operationSucceeds: false, issues: [CONTRACT_REFUSED] });
        const panel = closePanel();

        await panel.ConfirmClose();

        expect(panel.MessageIsError).toBe(true);
        expect(panel.Issues).toContain(CONTRACT_REFUSED);
    });
});
