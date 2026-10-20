import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Metadata, type IMetadataProvider } from '@memberjunction/core';
import type { DealEntity, DealStatusOption } from '@mj-biz-apps/sales-entities';
import { MJSDealClosePanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * A refused close or reopen names each reason once (#268).
 *
 * Every failure path set the first reason as the red headline AND handed the full list to the issue
 * rows under it, so the first reason appeared twice. The headline is now the first PROBLEM and the list
 * holds the rest. An info note never becomes the headline: the Close panel's close used to take the
 * first issue before info notes were split off.
 */

const STATUSES: DealStatusOption[] = [
    { ID: 'open-1', Name: 'Open', LocksDeal: false, IsWon: false, IsLost: false },
    { ID: 'won-1', Name: 'Won', LocksDeal: true, IsWon: true, IsLost: false },
];

const NO_CUSTOMER = 'The deal has no customer.';
const NO_PRODUCTS = 'The deal has no products.';
const LINK_PENDING = 'Contract link pending.';

/** An operation that refuses, with the given problems and info notes, in the order given. */
function refusingProvider(issues: string[], notes: string[] = [], notesFirst = false): IMetadataProvider {
    const problemRows = issues.map((Message) => ({ Message, Section: 'deal', Field: null, Severity: 'error' }));
    const noteRows = notes.map((Message) => ({ Message, Section: 'deal', Field: null, Severity: 'info' }));
    return {
        RouteOperation: async () => ({
            Success: true,
            Output: {
                Success: false,
                Issues: notesFirst ? [...noteRows, ...problemRows] : [...problemRows, ...noteRows],
                Routing: [],
            },
        }),
    } as unknown as IMetadataProvider;
}

function formStub() {
    return {
        EditMode: false,
        SaveRecord: async (): Promise<boolean> => true,
        EndEditMode: (): void => undefined,
        RefreshRecord: async (): Promise<boolean> => true,
    };
}

function withStatuses<T extends MJSDealPipelinePanel | MJSDealClosePanel>(panel: T, statusID: string): T {
    panel.Record = { ID: 'deal-1', IsSaved: true, DealStatusTypeID: statusID, Dirty: false } as unknown as DealEntity;
    panel.FormComponent = formStub() as unknown as T['FormComponent'];
    (panel as unknown as { statuses: { set(v: DealStatusOption[]): void } }).statuses.set(STATUSES);
    return panel;
}

let savedProvider: IMetadataProvider;
beforeEach(() => {
    savedProvider = Metadata.Provider;
});
afterEach(() => {
    Metadata.Provider = savedProvider;
});

describe('the Pipeline panel names each refusal reason once', () => {
    it('on a refused close', async () => {
        Metadata.Provider = refusingProvider([NO_CUSTOMER, NO_PRODUCTS]);
        const panel = withStatuses(new MJSDealPipelinePanel(), 'open-1');
        panel.SetStatus('won-1');

        await panel.ConfirmClose();

        expect(panel.ActionMessage).toBe(NO_CUSTOMER);
        expect(panel.ActionIssues).toEqual([NO_PRODUCTS]);
    });

    it('on a refused reopen', async () => {
        Metadata.Provider = refusingProvider([NO_CUSTOMER, NO_PRODUCTS]);
        const panel = withStatuses(new MJSDealPipelinePanel(), 'won-1');
        panel.SetStatus('open-1');

        await panel.ConfirmReopen();

        expect(panel.ActionMessage).toBe(NO_CUSTOMER);
        expect(panel.ActionIssues).toEqual([NO_PRODUCTS]);
    });
});

describe('the Close panel names each refusal reason once', () => {
    it('on a refused close', async () => {
        Metadata.Provider = refusingProvider([NO_CUSTOMER, NO_PRODUCTS]);
        const panel = withStatuses(new MJSDealClosePanel(), 'open-1');
        panel.TargetStatusID = 'won-1';
        panel.OnTargetChange();

        await panel.ConfirmClose();

        expect(panel.Message).toBe(NO_CUSTOMER);
        expect(panel.Issues).toEqual([NO_PRODUCTS]);
    });

    it('on a refused reopen', async () => {
        Metadata.Provider = refusingProvider([NO_CUSTOMER, NO_PRODUCTS]);
        const panel = withStatuses(new MJSDealClosePanel(), 'won-1');

        await panel.ConfirmReopen();

        expect(panel.Message).toBe(NO_CUSTOMER);
        expect(panel.Issues).toEqual([NO_PRODUCTS]);
    });

    it('never makes an info note the headline', async () => {
        Metadata.Provider = refusingProvider([NO_CUSTOMER], [LINK_PENDING], true);
        const panel = withStatuses(new MJSDealClosePanel(), 'open-1');
        panel.TargetStatusID = 'won-1';
        panel.OnTargetChange();

        await panel.ConfirmClose();

        expect(panel.Message).toBe(NO_CUSTOMER);
        expect(panel.Issues).toEqual([]);
        expect(panel.InfoNotes).toEqual([LINK_PENDING]);
    });
});
