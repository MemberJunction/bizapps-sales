import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Metadata, RunQuery, RunView, type EntityInfo } from '@memberjunction/core';

import { SingleCurrencyOf } from '../lib/board/deal-board.component';
import { DEAL_ROSTER_COLUMNS } from '../lib/workspace/deal-roster.columns';
import {
    CurrencyCodeFor,
    DealWorkspaceService,
    type DealRosterRow,
} from '../lib/workspace/deal-workspace.service';

/**
 * THE BOARD PRINTED THE CURRENCY'S RECORD ID AS ITS SYMBOL.
 *
 * Every deal created in the app carries a `CurrencyID`, a soft reference to accounting's Currency. The
 * board handed that ID to the currency pipe, which prints any code it does not know verbatim, so column
 * totals and card amounts read as a GUID. A column mixing those deals with older ones (no currency) also
 * refused to total, though both mean dollars. The roster now resolves the ID to its code.
 */

const USD_ID = 'A1B2C3D4-0000-0000-0000-000000000001';
const EUR_ID = 'A1B2C3D4-0000-0000-0000-000000000002';
const CODES = new Map([
    [USD_ID, 'USD'],
    [EUR_ID, 'EUR'],
]);

afterEach(() => vi.restoreAllMocks());

function card(code: string): DealRosterRow {
    return { CurrencyCode: code } as DealRosterRow;
}

describe('CurrencyCodeFor', () => {
    it('resolves an ID to its code, whatever case the ID arrives in', () => {
        expect(CurrencyCodeFor(EUR_ID, CODES)).toBe('EUR');
        expect(CurrencyCodeFor(EUR_ID.toLowerCase(), CODES)).toBe('EUR');
    });

    it('reads a deal with no currency as the display default', () => {
        expect(CurrencyCodeFor(null, CODES)).toBe('USD');
    });

    it('reads an ID this host cannot resolve as the display default, never as the ID', () => {
        expect(CurrencyCodeFor('FFFFFFFF-0000-0000-0000-000000000009', CODES)).toBe('USD');
        expect(CurrencyCodeFor(EUR_ID, new Map())).toBe('USD');
    });
});

describe('a board column total', () => {
    it('totals a column mixing deals with no currency and deals stamped USD', () => {
        const cards = [card(CurrencyCodeFor(null, CODES)), card(CurrencyCodeFor(USD_ID, CODES))];
        expect(SingleCurrencyOf(cards)).toBe('USD');
    });

    it('stays mixed when a column holds EUR and USD deals', () => {
        expect(SingleCurrencyOf([card('EUR'), card('USD')])).toBeNull();
    });

    it('labels a single-currency column with the code, not the ID', () => {
        expect(SingleCurrencyOf([card(CurrencyCodeFor(EUR_ID, CODES))])).toBe('EUR');
    });
});

describe('the roster, on a host with and without accounting', () => {
    const rosterRow = (currencyID: string | null): Record<string, unknown> => ({
        ...Object.fromEntries(DEAL_ROSTER_COLUMNS.map((c) => [c, null])),
        DealID: 'deal-1',
        DealName: 'Placeholder deal',
        CurrencyID: currencyID,
    });

    function stubRoster(currencyID: string | null): void {
        vi.spyOn(RunQuery.prototype, 'RunQuery').mockResolvedValue({
            Success: true,
            Results: [rosterRow(currencyID)],
        } as Awaited<ReturnType<RunQuery['RunQuery']>>);
    }

    it('shows the display default when accounting is not installed, and does not read currencies', async () => {
        vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([]);
        const view = vi.spyOn(RunView.prototype, 'RunView');
        stubRoster(EUR_ID);

        const [row] = await new DealWorkspaceService().LoadRoster();

        expect(row.CurrencyCode).toBe('USD');
        expect(view).not.toHaveBeenCalled();
    });

    it("resolves the code from accounting's currencies when installed, reading them once", async () => {
        vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([
            { Name: 'MJ_BizApps_Accounting: Currencies' } as EntityInfo,
        ]);
        const view = vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
            Success: true,
            Results: [{ ID: EUR_ID.toLowerCase(), Code: 'EUR' }],
        } as Awaited<ReturnType<RunView['RunView']>>);
        stubRoster(EUR_ID);
        const service = new DealWorkspaceService();

        const [row] = await service.LoadRoster();
        await service.LoadRoster();

        expect(row.CurrencyCode).toBe('EUR');
        expect(view).toHaveBeenCalledTimes(1);
    });
});
