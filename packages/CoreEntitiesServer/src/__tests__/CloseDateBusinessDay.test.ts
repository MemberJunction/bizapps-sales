/**
 * A close stamps the BUSINESS day it happened on, not the UTC day (bc-aidp-next-golive#168).
 *
 * `stampClose` used to build `ActualCloseDate` from `now`'s UTC parts. `ActualCloseDate` is a `DATE` —
 * the day a win lands in, which is what bookings, win rate and every period window key on — and "what
 * day is it" is the one question the business zone answers. From 19:00 Central the UTC day is already
 * tomorrow, so a deal won on the evening of 30 September was stamped 1 October and counted in
 * October's figures.
 *
 * THE PINNED INSTANT IS WEST OF GREENWICH: `2026-10-01T02:30:00Z` is 21:30 on 30 September in
 * America/Chicago, and the last evening of a month, which is where the wrong day also moves the win
 * into the wrong period. An instant where the zones agree would leave this file green through the
 * defect it exists for.
 *
 * `Object.create` holds the operation without standing up metadata, the same way `AbsentStatusLock`
 * holds the entity. `stampClose` is synchronous and touches only the deal it is handed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { CloseDealOperation } from '../CloseDealOperation.js';
import { CloseWonTaskService, type CloseWonTaskInput } from '../CloseWonTaskService.js';

const BUSINESS_ZONE = 'America/Chicago';
const COMPANY = 'cccccccc-0000-4000-8000-000000000001';

/** 21:30 on 30 September in Chicago; already 1 October in UTC. */
const EVENING_ON_MONTH_END = new Date('2026-10-01T02:30:00.000Z');

/** The slice of the deal `stampClose` writes, plus the two things it reads. */
interface StampedDeal {
    CompanyID: string;
    DealStatusTypeID: string | null;
    PipelineStageID: string | null;
    LossReasonID: string | null;
    LossNotes: string | null;
    ClosedAt: Date | null;
    ClosedByUserID: string | null;
    ActualCloseDate: Date | null;
    DeclareTransition(kind: string, note: string): void;
}

type Stamp = {
    stampClose(
        deal: StampedDeal,
        input: { DealID: string; DealStatusTypeID: string },
        target: { ID: string },
        routing: never[],
        user: { ID: string },
        derivedClosingStageID: string | null,
        lossReasonName: string | null,
    ): void;
};

function close(): StampedDeal {
    const deal: StampedDeal = {
        CompanyID: COMPANY,
        DealStatusTypeID: null,
        PipelineStageID: null,
        LossReasonID: null,
        LossNotes: null,
        ClosedAt: null,
        ClosedByUserID: null,
        ActualCloseDate: null,
        DeclareTransition: () => undefined,
    };
    const op = Object.create(CloseDealOperation.prototype) as Stamp;
    op.stampClose(deal, { DealID: 'd1', DealStatusTypeID: 'won' }, { ID: 'won' }, [], { ID: 'u1' }, null, null);
    return deal;
}

describe('stampClose stamps ActualCloseDate on the business day', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(EVENING_ON_MONTH_END);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('is 30 SEPTEMBER at 9:30 PM Central, though UTC has already rolled to 1 October', () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);

        const deal = close();

        expect(deal.ActualCloseDate?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    });

    /**
     * The premise, asserted rather than assumed — CLAUDE.md rule 8. Unconfigured, the engine fails open
     * to UTC; if that ever stopped being so, the test above could pass while proving nothing.
     */
    it('is 1 October at the same instant when the zone is UTC, which was the old behaviour everywhere', () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue('UTC');

        expect(close().ActualCloseDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it("asks for the deal's own company, so a per-company zone needs no change here when it lands", () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);
        const today = vi.spyOn(BusinessTimeZoneEngine.prototype, 'Today');

        close();

        expect(today).toHaveBeenCalledWith(COMPANY);
    });

    /**
     * The DAY moves to the business zone; the shape does not. A `DATE` round-trips as UTC midnight and
     * every reader takes its UTC parts, so the instant 30 September began in Chicago
     * (`2026-09-30T05:00:00Z`) would be the wrong value even though it is "the right day".
     */
    it('stores UTC midnight of that day, and leaves ClosedAt as the real instant', () => {
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);

        const deal = close();

        expect(deal.ActualCloseDate?.getUTCHours()).toBe(0);
        expect(deal.ClosedAt?.toISOString()).toBe(EVENING_ON_MONTH_END.toISOString());
    });
});

/**
 * THE WHOLE OPERATION, on a won close, with every database read stubbed at its private seam
 * (bc-aidp-next-golive#168 review follow-ups).
 *
 * Two things here can only be seen from `InternalExecute`, not from `stampClose` alone:
 *
 * 1. The engine is CONFIGURED before the stamp. `stampClose` is synchronous and reads
 *    `BusinessTimeZoneEngine` without loading it; the operation's `await ...Config(...)` is what makes
 *    the zone real. Delete it and the engine fails open to UTC with one log line — and every other test
 *    in this file still passes, because they mock the zone directly. So here the zone is Chicago ONLY
 *    once `Config` has finished, and `Config` finishes on a later macrotask: a missing call, or one
 *    that is not awaited, stamps the UTC day.
 * 2. The close-won task's `DueAt` is counted from the BUSINESS close day. It used to be counted from
 *    `ClosedAt`'s UTC day, so at 9:30 PM CDT on 30 September a five-day task fell due 6 October while
 *    `ActualCloseDate` said 30 September.
 *
 * Only `Date` is faked, so `setImmediate` stays real and can model a configuration read that has not
 * finished yet.
 */
describe('Sales.CloseDeal configures the zone, then stamps and dates its tasks from the business day', () => {
    const WON = { ID: 'won', IsWon: true, IsLost: false, IsClosed: true, LocksDeal: true };
    const DUE_IN_DAYS = 5;

    interface Harness {
        configured: boolean;
        calls: string[];
        deal: StampedDeal & Record<string, unknown>;
        taskInput: CloseWonTaskInput | null;
        result: { Success: boolean; Issues: { Message: string }[] };
        configArgs: unknown[] | null;
        user: { ID: string };
        provider: Record<string, unknown>;
    }

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(EVENING_ON_MONTH_END);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    async function runWonClose(): Promise<Harness> {
        const calls: string[] = [];
        const h = { configured: false, calls, taskInput: null, configArgs: null } as unknown as Harness;

        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockImplementation(() =>
            h.configured ? BUSINESS_ZONE : 'UTC',
        );
        vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockImplementation(async (...args: unknown[]) => {
            calls.push('Config');
            h.configArgs = args;
            // Finishes on a LATER macrotask, so only an awaited call is finished before the stamp.
            await new Promise<void>((resolve) => setImmediate(resolve));
            h.configured = true;
            return undefined;
        });
        vi.spyOn(CloseWonTaskService.prototype, 'CreateCloseWonTasks').mockImplementation(async (input) => {
            h.taskInput = input;
            return { Success: true, Tasks: [], Issues: [] };
        });

        h.deal = {
            ID: 'd1',
            Name: 'Evening win',
            DealNumber: 'D-1',
            CompanyID: COMPANY,
            PipelineID: 'p1',
            OrderID: 'o1',
            ContractID: null,
            AccountID: 'a1',
            DealStatusTypeID: null,
            PipelineStageID: null,
            LossReasonID: null,
            LossNotes: null,
            ClosedAt: null,
            ClosedByUserID: null,
            ActualCloseDate: null,
            OrderStatusWarnings: [],
            LastStageEventID: 'e1',
            DeclareTransition: () => undefined,
            Load: async () => true,
            Save: async () => {
                calls.push('Save');
                return true;
            },
        };
        h.user = { ID: 'u1' };
        h.provider = {
            GetEntityObject: async () => h.deal,
            BeginTransaction: async () => {
                calls.push('BeginTransaction');
            },
            CommitTransaction: async () => {
                calls.push('CommitTransaction');
            },
            RollbackTransaction: async () => {
                calls.push('RollbackTransaction');
            },
        };

        const op = new CloseDealOperation() as unknown as Record<string, unknown> & {
            InternalExecute(input: unknown, provider: unknown, user: unknown): Promise<Harness['result']>;
        };
        // The reads, stubbed at the operation's own private seams.
        op.loadStatusFlags = async () => WON;
        op.validate = async () => ({ Issues: [], LossReasonName: null });
        op.resolvePolicy = async () => ({ CloseWonTasks: { DueInDays: DUE_IN_DAYS } });
        op.planRouting = async () => [];
        op.closingStageForOutcome = async () => null;

        h.result = await op.InternalExecute({ DealID: 'd1', DealStatusTypeID: WON.ID }, h.provider, h.user);
        return h;
    }

    it('succeeds, so the assertions below are about a close that ran', async () => {
        const h = await runWonClose();
        expect(h.result.Issues).toEqual([]);
        expect(h.result.Success).toBe(true);
        expect(h.calls).toContain('CommitTransaction');
    });

    it('awaits the engine configuration before the transaction, with the caller\'s user and provider', async () => {
        const h = await runWonClose();
        expect(h.calls.indexOf('Config')).toBeGreaterThanOrEqual(0);
        expect(h.calls.indexOf('Config')).toBeLessThan(h.calls.indexOf('BeginTransaction'));
        expect(h.configArgs).toEqual([false, h.user, h.provider]);
    });

    it('stamps 30 September, which it can only know once the engine is configured', async () => {
        const h = await runWonClose();
        expect(h.deal.ActualCloseDate?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    });

    it('dates the close-won task DueInDays after the BUSINESS close day: 5 October, not 6', async () => {
        const h = await runWonClose();
        expect(h.taskInput?.DueAt?.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    });
});

