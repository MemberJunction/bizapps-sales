import { describe, expect, it } from 'vitest';
import { CloseDealOperation } from '../CloseDealOperation.js';

/**
 * A WON CLOSE IS REFUSED WHEN THE PAYMENT SCHEDULE DOES NOT TIE (bc-aidp-next-golive#290).
 *
 * The Deal form accepted instalment rows and compared them with nothing, so a schedule a penny short
 * of the deal saved silently — and the rows never reached the order, which booked and invoiced its
 * full value in one amount. The panel now shows a running total, but a total only helps a rep who is
 * looking at the panel. This is the half that cannot be skipped.
 *
 * `ReadDealScheduleTie` has its own suite in sales-entities, which is where the arithmetic and the
 * wording are pinned. What is pinned HERE is the wiring: that the operation reads the schedule at
 * all, only for a Won close, and that an unreadable schedule does not refuse.
 *
 * `Object.create` holds the operation without standing up metadata, as `AbsentStatusLock` does.
 */

const DEAL = 'dddddddd-0000-4000-8000-000000000001';

type Row = { Amount: number | null; PaymentDate: string | null };

type Opts = {
    rows?: Row[];
    /** Make the schedule read FAIL, which must not refuse the close. */
    readFails?: boolean;
    dealAmount?: number | null;
};

/** Runs `validate` with everything it touches shadowed, and returns the issues it raised. */
async function validateWonClose(opts: Opts, target = { IsWon: true, IsLost: false, LocksDeal: true }) {
    const op = Object.create(CloseDealOperation.prototype) as {
        validate(deal: unknown, input: unknown, target: unknown, provider: unknown, user: unknown): Promise<{ Issues: Array<{ Message: string }> }>;
    };

    const reads: string[] = [];
    const provider = {
        RunView: async ({ EntityName, ExtraFilter }: { EntityName: string; ExtraFilter: string }) => {
            reads.push(EntityName);
            if (EntityName.includes('Payment Schedule')) {
                return opts.readFails ? { Success: false, Results: [] } : { Success: true, Results: opts.rows ?? [] };
            }
            // Loss reasons and anything else this method may consult: successful and empty.
            void ExtraFilter;
            return { Success: true, Results: [] };
        },
    };

    const deal = { ID: DEAL, Amount: opts.dealAmount === undefined ? 24000 : opts.dealAmount, AccountID: 'acct', LossReasonID: null, LossNotes: null };
    const result = await op.validate(deal, {}, target, provider, { ID: 'user' });
    return { issues: result.Issues, reads };
}

const scheduleMessages = (issues: Array<{ Message: string }>): string[] =>
    issues.map((i) => i.Message).filter((m) => /schedule/i.test(m));

describe('closing a deal Won reads its payment schedule', () => {
    it('refuses when the rows do not add up to the deal amount', async () => {
        const { issues } = await validateWonClose({
            rows: [
                { Amount: 6000, PaymentDate: '2026-10-01' },
                { Amount: 6000, PaymentDate: '2027-01-01' },
                { Amount: 6000, PaymentDate: '2027-04-01' },
                { Amount: 5999.99, PaymentDate: '2027-07-01' },
            ],
        });
        const said = scheduleMessages(issues);
        expect(said, 'the close must be refused').toHaveLength(1);
        expect(said[0], 'and must name the gap').toContain('0.01 unscheduled');
    });

    it('allows a schedule that ties', async () => {
        const { issues } = await validateWonClose({
            rows: [
                { Amount: 12000, PaymentDate: '2026-10-01' },
                { Amount: 12000, PaymentDate: '2027-01-01' },
            ],
        });
        expect(scheduleMessages(issues)).toHaveLength(0);
    });

    /** No schedule is the implicit single instalment, which is how every deal behaves today. */
    it('allows a deal with no schedule at all', async () => {
        const { issues } = await validateWonClose({ rows: [] });
        expect(scheduleMessages(issues)).toHaveLength(0);
    });

    it('refuses a row that could never become an order row', async () => {
        const { issues } = await validateWonClose({ rows: [{ Amount: 24000, PaymentDate: null }] });
        expect(scheduleMessages(issues)[0]).toContain('missing a date or an amount');
    });
});

describe('what the schedule check does NOT do', () => {
    /**
     * A lost deal mints no order, so its schedule governs nothing. Refusing on it would block a close
     * that has no money consequence at all.
     */
    it('does not read the schedule for a LOST close', async () => {
        const { issues, reads } = await validateWonClose(
            { rows: [{ Amount: 1, PaymentDate: '2026-10-01' }] },
            { IsWon: false, IsLost: true, LocksDeal: true },
        );
        expect(reads.some((e) => e.includes('Payment Schedule')), 'the schedule is not its business').toBe(false);
        expect(scheduleMessages(issues)).toHaveLength(0);
    });

    /**
     * FAILING OPEN IS DELIBERATE. Treating an unreadable schedule as broken would make a transient view
     * failure block every close — a worse failure than the one this guards against.
     */
    it('does not refuse when the schedule cannot be read', async () => {
        const { issues } = await validateWonClose({ readFails: true });
        expect(scheduleMessages(issues)).toHaveLength(0);
    });

    /** A schedule entered before the order prices the deal is premature, not wrong. */
    it('does not refuse when the deal has no amount yet', async () => {
        const { issues } = await validateWonClose({
            rows: [{ Amount: 6000, PaymentDate: '2026-10-01' }],
            dealAmount: null,
        });
        expect(scheduleMessages(issues)).toHaveLength(0);
    });
});
