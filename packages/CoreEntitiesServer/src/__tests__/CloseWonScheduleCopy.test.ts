import { describe, expect, it } from 'vitest';
import { CloseDealOperation } from '../CloseDealOperation.js';

/**
 * THE DEAL'S PAYMENT SCHEDULE REACHES ITS ORDER (bc-aidp-next-golive#290).
 *
 * The rows a rep entered on the deal never reached the order, so the order booked and invoiced its
 * full value in one amount while the deal showed four instalments. QA re-confirmed it on 6 Oct:
 * ORD-002313 had zero schedule rows and booked the full 10,000.03, while the renewal job — which
 * writes order rows directly — produced them correctly. The order side works; only the copy was absent.
 *
 * What is pinned here is the copy's contract, not the arithmetic: the tie check has its own suite in
 * sales-entities, and by the time this runs it has already passed.
 *
 * `Object.create` holds the operation without standing up metadata, as `AbsentStatusLock` does.
 */

const DEAL = 'dddddddd-0000-4000-8000-000000000001';
const ORDER = 'eeeeeeee-0000-4000-8000-000000000001';
const COMPANY = 'cccccccc-0000-4000-8000-000000000001';

type DealRow = { PaymentDate: string | null; Amount: number | null; Description?: string | null };

type Opts = {
    schedule?: DealRow[];
    /** Rows the ORDER already carries — a reopened deal closed a second time. */
    orderRows?: Array<{ ID: string }>;
    orderID?: string | null;
    companyID?: string | null;
    scheduleReadFails?: boolean;
    existingReadFails?: boolean;
    orderReadFails?: boolean;
    saveFails?: boolean;
};

/** Runs the copy with every collaborator shadowed; returns what it wrote and what it said. */
async function copy(opts: Opts) {
    const op = Object.create(CloseDealOperation.prototype) as {
        copyScheduleToOrder(deal: unknown, provider: unknown, user: unknown): Promise<string[]>;
    };
    const written: Array<Record<string, unknown>> = [];

    const provider = {
        RunView: async ({ EntityName }: { EntityName: string }) => {
            if (EntityName.includes('Deal Payment Schedule')) {
                return opts.scheduleReadFails ? { Success: false, Results: [] } : { Success: true, Results: opts.schedule ?? [] };
            }
            if (EntityName.includes('Order Header Payment Schedules')) {
                return opts.existingReadFails ? { Success: false, Results: [] } : { Success: true, Results: opts.orderRows ?? [] };
            }
            if (EntityName.includes('Order Headers')) {
                return opts.orderReadFails
                    ? { Success: false, Results: [] }
                    : { Success: true, Results: [{ CompanyID: opts.companyID === undefined ? COMPANY : opts.companyID }] };
            }
            return { Success: true, Results: [] };
        },
        GetEntityObject: async () => {
            const fields: Record<string, unknown> = {};
            return {
                NewRecord: () => undefined,
                Set: (k: string, v: unknown) => { fields[k] = v; },
                Save: async () => { if (!opts.saveFails) written.push(fields); return !opts.saveFails; },
                LatestResult: { Message: 'the database said no' },
            };
        },
    };

    const deal = { ID: DEAL, OrderID: opts.orderID === undefined ? ORDER : opts.orderID };
    const warnings = await op.copyScheduleToOrder(deal, provider, { ID: 'user' });
    return { warnings, written };
}

const ROWS: DealRow[] = [
    { PaymentDate: '2026-10-01', Amount: 6000, Description: 'Q1' },
    { PaymentDate: '2027-01-01', Amount: 6000 },
];

describe('closing a deal Won copies its schedule onto the order', () => {
    it('writes one order row per deal row', async () => {
        const { written, warnings } = await copy({ schedule: ROWS });
        expect(warnings, 'a clean copy says nothing').toEqual([]);
        expect(written).toHaveLength(2);
    });

    it('carries each row\'s own date and amount across unchanged', async () => {
        const { written } = await copy({ schedule: ROWS });
        expect(written[0].DueDate).toBe('2026-10-01');
        expect(written[0].Amount).toBe(6000);
        expect(written[1].DueDate).toBe('2027-01-01');
    });

    /** golive#311: the rows belong to the order, under the ORDER's company — never the product's. */
    it('puts every row under the order\'s company', async () => {
        const { written } = await copy({ schedule: ROWS });
        expect(written.map((r) => r.CompanyID)).toEqual([COMPANY, COMPANY]);
    });

    it('numbers the instalments from one, in the rep\'s order', async () => {
        const { written } = await copy({ schedule: ROWS });
        expect(written.map((r) => r.InstallmentNumber)).toEqual([1, 2]);
    });

    /**
     * `Scheduled` is the only status an unbilled instalment may carry — the others each assert
     * something that has not happened — and it is what orders' own tie check counts as live.
     */
    it('writes them as Scheduled and unpaid', async () => {
        const { written } = await copy({ schedule: ROWS });
        expect(written[0].Status).toBe('Scheduled');
        expect(written[0].AmountPaid).toBe(0);
    });

    it('carries a description when the row has one, and omits it when not', async () => {
        const { written } = await copy({ schedule: ROWS });
        expect(written[0].Description).toBe('Q1');
        expect('Description' in written[1]).toBe(false);
    });
});

/**
 * IDEMPOTENCE IS THE POINT, NOT A NICETY.
 *
 * A won deal can be reopened and closed again (S-US8), and this runs on every Won close. Without the
 * guard the order would carry the schedule twice over — and golive#324 is a report of exactly that
 * second close.
 */
describe('a second Won close does not double the order\'s schedule', () => {
    it('writes nothing when the order already carries rows', async () => {
        const { written, warnings } = await copy({ schedule: ROWS, orderRows: [{ ID: 'already-there' }] });
        expect(written).toEqual([]);
        expect(warnings, 'and says nothing — this is the normal path, not a problem').toEqual([]);
    });
});

describe('what the copy declines to do', () => {
    /** A header-only deal mints no order. Nothing to copy to, and nothing wrong. */
    it('does nothing for a deal with no order', async () => {
        const { written, warnings } = await copy({ schedule: ROWS, orderID: null });
        expect(written).toEqual([]);
        expect(warnings).toEqual([]);
    });

    /** No schedule is the implicit single instalment, which is how every deal behaved before this. */
    it('does nothing for a deal with no schedule', async () => {
        const { written, warnings } = await copy({ schedule: [] });
        expect(written).toEqual([]);
        expect(warnings).toEqual([]);
    });
});

/**
 * EVERY FAILURE WARNS RATHER THAN THROWS.
 *
 * The deal is already closed and the order already exists by the time this runs. Failing the close
 * over a derived schedule would roll back a correct close for something the next close can redo.
 */
describe('when the copy cannot be made', () => {
    it('warns when the deal schedule cannot be read', async () => {
        const { written, warnings } = await copy({ scheduleReadFails: true });
        expect(written).toEqual([]);
        expect(warnings[0]).toContain('payment schedule could not be read');
    });

    it('warns when the order\'s existing schedule cannot be read, and writes nothing', async () => {
        const { written, warnings } = await copy({ schedule: ROWS, existingReadFails: true });
        expect(written, 'guessing here would be how it doubles').toEqual([]);
        expect(warnings).toHaveLength(1);
    });

    it('warns when the order\'s company cannot be read', async () => {
        const { written, warnings } = await copy({ schedule: ROWS, companyID: null });
        expect(written).toEqual([]);
        expect(warnings[0]).toContain('company could not be read');
    });

    it('names which instalment failed, and stops there', async () => {
        const { warnings } = await copy({ schedule: ROWS, saveFails: true });
        expect(warnings[0]).toContain('instalment 1');
        expect(warnings[0]).toContain('the database said no');
    });
});
