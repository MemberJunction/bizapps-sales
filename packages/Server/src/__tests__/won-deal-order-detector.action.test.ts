/**
 * `Sales.DetectWonDealsWithUnconfirmedOrders` reports the detector's outcome as the Action result.
 *
 * The detector is stubbed; its own behaviour is proved in sales-core-entities-server. What is pinned
 * here is the mapping a scheduled-job log reads: a refused raise and a thrown error are failed runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunActionParams } from '@memberjunction/actions-base';

const detect = vi.fn();
vi.mock('@mj-biz-apps/sales-core-entities-server', () => ({ DetectWonDealsWithUnconfirmedOrders: detect }));
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, Metadata: { Provider: {} } };
});

const { DetectWonDealsWithUnconfirmedOrdersAction } = await import('../custom/won-deal-order-detector.action.js');

/** Exposes the protected entry point without widening the class. */
class Harness extends DetectWonDealsWithUnconfirmedOrdersAction {
    public Run(params: RunActionParams) {
        return this.InternalRunAction(params);
    }
}

function params(): RunActionParams {
    return { Params: [], ContextUser: { ID: 'user-1' } } as never;
}

function outcome(overrides: Record<string, unknown>) {
    return {
        Success: true,
        Outcome: 'RAISED',
        Found: 2,
        Created: 1,
        AlreadyRaised: 1,
        SkippedByAccounting: 0,
        CreatorUnresolved: 1,
        Issues: [],
        ...overrides,
    };
}

afterEach(() => detect.mockReset());

describe('the Action result', () => {
    it('reports a raised run with its tallies as outputs', async () => {
        detect.mockResolvedValue(outcome({}));
        const p = params();
        const result = await new Harness().Run(p);
        expect(result).toMatchObject({ Success: true, ResultCode: 'RAISED' });
        expect(result.Message).toMatch(/created 1, already raised 1/);
        expect(p.Params.find((x) => x.Name === 'CreatorUnresolved')?.Value).toBe(1);
    });

    it('fails when accounting refused the raise', async () => {
        detect.mockResolvedValue(
            outcome({ Success: false, Outcome: 'RAISE_FAILED', Created: 0, AlreadyRaised: 0, Issues: ['refused: X'] }),
        );
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'RAISE_FAILED' });
        expect(result.Message).toMatch(/refused: X/);
    });

    it('fails, without throwing, when the detector throws', async () => {
        detect.mockRejectedValue(new Error("The 'Accounting.RaiseFinanceExceptions' operation is not registered."));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'ERROR' });
        expect(result.Message).toMatch(/not registered/);
    });

    it('reports a skip as a success with the reason', async () => {
        detect.mockResolvedValue(outcome({ Outcome: 'SKIPPED', Found: 0, Created: 0, AlreadyRaised: 0, CreatorUnresolved: 0, Issues: ['type is inactive'] }));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: true, ResultCode: 'SKIPPED', Message: 'type is inactive' });
    });
});
