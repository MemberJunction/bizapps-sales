/**
 * The nightly won-deal finance exception check (golive #279, type 3).
 *
 * Accounting's two operations are FAKES REGISTERED UNDER THE REAL KEYS, so the detector resolves them
 * through the class factory exactly as it does in a host. The saved query and the user lookup are
 * stubbed at the `@memberjunction/core` boundary; the business zone is pinned by spy. Everything
 * between (row reading, creator resolution, the request sent to accounting and the tallies) is real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseRemotableOperation, type RemoteOpResult, type RemoteOpExecMode } from '@memberjunction/core';
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

const runQuery = vi.fn();
const runViews = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogStatus: () => undefined,
        RunQuery: class { public RunQuery = runQuery; },
        RunView: class { public RunViews = runViews; },
    };
});

const {
    DetectWonDealsWithUnconfirmedOrders,
    WON_DEAL_ORDER_NOT_CONFIRMED,
    WON_DEALS_QUERY_NAME,
    DEAL_ENTITY_NAME,
} = await import('../finance-exceptions/WonDealOrderDetector.js');
type Bridge = typeof import('../finance-exceptions/FinanceExceptionBridge.js');
type TypesOutput = Awaited<ReturnType<Bridge['GetFinanceExceptionTypes']>>;
type RaiseInput = Parameters<Bridge['RaiseFinanceExceptions']>[0];
type RaiseOutput = Awaited<ReturnType<Bridge['RaiseFinanceExceptions']>>;

const USER = { ID: 'user-1' } as never;
const PROVIDER = {} as never;
const COMPANY = 'CCCCCCCC-0000-4000-8000-000000000001';
const DEAL_A = 'DDDDDDDD-0000-4000-8000-00000000000A';
const DEAL_B = 'DDDDDDDD-0000-4000-8000-00000000000B';
const DEAL_C = 'DDDDDDDD-0000-4000-8000-00000000000C';
const DEAL_D = 'DDDDDDDD-0000-4000-8000-00000000000D';
const EMP_ONE_LOGIN = 'EEEEEEEE-0000-4000-8000-000000000001';
const EMP_NO_LOGIN = 'EEEEEEEE-0000-4000-8000-000000000002';
const EMP_TWO_LOGINS = 'EEEEEEEE-0000-4000-8000-000000000003';
const LOGIN_1 = 'AAAAAAAA-0000-4000-8000-000000000001';
const BUSINESS_TODAY = '2026-09-27';

/** What the fakes answer and what they were asked. Reset per test. */
const accounting: {
    Types: RemoteOpResult<TypesOutput>;
    Raise: (input: RaiseInput) => RemoteOpResult<RaiseOutput>;
    TypesCalls: unknown[];
    RaiseCalls: RaiseInput[];
} = { Types: { Success: false }, Raise: () => ({ Success: false }), TypesCalls: [], RaiseCalls: [] };

@RegisterClass(BaseRemotableOperation, 'Accounting.GetFinanceExceptionTypes')
class FakeGetFinanceExceptionTypes extends BaseRemotableOperation<unknown, TypesOutput> {
    public readonly OperationKey = 'Accounting.GetFinanceExceptionTypes';
    public override readonly ExecutionMode: RemoteOpExecMode = 'Sync';
    public override async Execute(input: unknown): Promise<RemoteOpResult<TypesOutput>> {
        accounting.TypesCalls.push(input);
        return accounting.Types;
    }
}

@RegisterClass(BaseRemotableOperation, 'Accounting.RaiseFinanceExceptions')
class FakeRaiseFinanceExceptions extends BaseRemotableOperation<RaiseInput, RaiseOutput> {
    public readonly OperationKey = 'Accounting.RaiseFinanceExceptions';
    public override readonly ExecutionMode: RemoteOpExecMode = 'Sync';
    public override async Execute(input: RaiseInput): Promise<RemoteOpResult<RaiseOutput>> {
        accounting.RaiseCalls.push(input);
        return accounting.Raise(input);
    }
}
void FakeGetFinanceExceptionTypes;
void FakeRaiseFinanceExceptions;

function activeType(configuration: Record<string, unknown> = { MinDaysSinceClose: 7 }): void {
    accounting.Types = {
        Success: true,
        Output: { Success: true, Types: [{ Code: WON_DEAL_ORDER_NOT_CONFIRMED, IsActive: true, Configuration: configuration }] },
    };
}

function row(dealID: string, owner: string | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        DealID: dealID,
        DealNumber: `D-${dealID.slice(-1)}`,
        CompanyID: COMPANY,
        OwnerEmployeeID: owner,
        CloseDate: '2026-09-10',
        DaysSinceClose: 17,
        DealAmount: '1250.5000',
        OrderID: 'OOOOOOOO-0000-4000-8000-000000000001',
        OrderStatus: 'Draft',
        ...extra,
    };
}

function queryReturns(rows: Record<string, unknown>[]): void {
    runQuery.mockResolvedValue({ Success: true, Results: rows });
}

/** Users as SQL Server returns them: upper-case GUIDs, one employee with two logins. */
function usersReturn(): void {
    runViews.mockResolvedValue([
        {
            Success: true,
            Results: [
                { ID: LOGIN_1, EmployeeID: EMP_ONE_LOGIN },
                { ID: 'AAAAAAAA-0000-4000-8000-000000000002', EmployeeID: EMP_TWO_LOGINS },
                { ID: 'AAAAAAAA-0000-4000-8000-000000000003', EmployeeID: EMP_TWO_LOGINS },
            ],
        },
    ]);
}

function allCreated(input: RaiseInput): RemoteOpResult<RaiseOutput> {
    return {
        Success: true,
        Output: { Success: true, Results: input.Exceptions.map((_, i) => ({ Index: i, Created: true, FinanceExceptionID: `fe-${i}` })) },
    };
}

beforeEach(() => {
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Today').mockReturnValue(BUSINESS_TODAY);
    accounting.TypesCalls = [];
    accounting.RaiseCalls = [];
    accounting.Raise = allCreated;
});

afterEach(() => {
    vi.restoreAllMocks();
    runQuery.mockReset();
    runViews.mockReset();
});

describe('the fakes are what the detector resolves', () => {
    it('resolves the registered operation by its contract key', () => {
        const op = MJGlobal.Instance.ClassFactory.CreateInstance(BaseRemotableOperation, 'Accounting.RaiseFinanceExceptions');
        expect(op).toBeInstanceOf(FakeRaiseFinanceExceptions);
    });
});

describe('reading the exception type', () => {
    it('asks accounting for its own type code only', async () => {
        activeType();
        queryReturns([]);
        await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(accounting.TypesCalls).toEqual([{ Codes: [WON_DEAL_ORDER_NOT_CONFIRMED] }]);
    });

    it('skips, successfully, when the type does not exist', async () => {
        accounting.Types = { Success: true, Output: { Success: true, Types: [] } };
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: true, Outcome: 'SKIPPED' });
        expect(result.Issues[0]).toMatch(/does not exist/);
        expect(runQuery).not.toHaveBeenCalled();
        expect(accounting.RaiseCalls).toHaveLength(0);
    });

    it('skips when the type is inactive', async () => {
        accounting.Types = {
            Success: true,
            Output: { Success: true, Types: [{ Code: WON_DEAL_ORDER_NOT_CONFIRMED, IsActive: false, Configuration: { MinDaysSinceClose: 7 } }] },
        };
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: true, Outcome: 'SKIPPED' });
        expect(result.Issues[0]).toMatch(/inactive/);
        expect(runQuery).not.toHaveBeenCalled();
    });

    it('does not invent a threshold when the configuration has none', async () => {
        activeType({});
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'CONFIG_INVALID' });
        expect(runQuery).not.toHaveBeenCalled();
    });

    it('fails when accounting reports it could not read the types', async () => {
        accounting.Types = { Success: true, Output: { Success: false, Types: [], Errors: [{ Code: 'X', Message: 'no' }] } };
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'TYPES_UNREADABLE' });
    });

    it('throws when the envelope fails', async () => {
        accounting.Types = { Success: false, ErrorMessage: 'forbidden' };
        await expect(DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER)).rejects.toThrow(/forbidden/);
    });
});

describe('running the saved query', () => {
    it('runs the named query with the configured threshold', async () => {
        activeType({ MinDaysSinceClose: 7 });
        queryReturns([]);
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(runQuery).toHaveBeenCalledWith(
            expect.objectContaining({ QueryName: WON_DEALS_QUERY_NAME, Parameters: { MinDaysSinceClose: 7 } }),
            USER,
        );
        expect(result).toMatchObject({ Success: true, Outcome: 'NONE_FOUND', Found: 0 });
        expect(accounting.RaiseCalls).toHaveLength(0);
    });

    it('fails when the query does not run', async () => {
        activeType();
        runQuery.mockResolvedValue({ Success: false, ErrorMessage: 'no such query' });
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'QUERY_FAILED' });
        expect(result.Issues[0]).toMatch(/no such query/);
    });
});

describe('raising one exception per deal', () => {
    it('sends the contract fields for type 3', async () => {
        activeType();
        queryReturns([row(DEAL_A, EMP_ONE_LOGIN.toLowerCase())]);
        usersReturn();
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);

        expect(accounting.RaiseCalls).toHaveLength(1);
        expect(accounting.RaiseCalls[0].Exceptions).toEqual([
            {
                TypeCode: WON_DEAL_ORDER_NOT_CONFIRMED,
                SourceEntityName: DEAL_ENTITY_NAME,
                SourceRecordID: DEAL_A,
                CompanyID: COMPANY,
                Amount: 1250.5,
                ExceptionDate: BUSINESS_TODAY,
                Summary: expect.stringMatching(/^Deal D-A closed Won on 2026-09-10 \(17 days ago\) and has an order that is Draft/),
                DedupeKey: DEAL_A,
                SourceCreatedByUserID: LOGIN_1,
                CreatorUnresolved: false,
            },
        ]);
        expect(result).toMatchObject({ Success: true, Outcome: 'RAISED', Found: 1, Created: 1, CreatorUnresolved: 0 });
    });

    it('judges the exception date by the deal company’s business day', async () => {
        activeType();
        queryReturns([row(DEAL_A, null)]);
        usersReturn();
        await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(BusinessTimeZoneEngine.prototype.Today).toHaveBeenCalledWith(COMPANY);
    });

    it('resolves creators in one batched lookup, not one per deal', async () => {
        activeType();
        queryReturns([row(DEAL_A, EMP_ONE_LOGIN), row(DEAL_B, EMP_ONE_LOGIN), row(DEAL_C, EMP_NO_LOGIN)]);
        usersReturn();
        await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);

        expect(runViews).toHaveBeenCalledTimes(1);
        const params = runViews.mock.calls[0][0] as Array<{ EntityName: string; ExtraFilter: string }>;
        expect(params).toHaveLength(1);
        expect(params[0].EntityName).toBe('MJ: Users');
        expect(params[0].ExtraFilter).toBe(`EmployeeID IN ('${EMP_ONE_LOGIN}','${EMP_NO_LOGIN}')`);
    });

    it('marks an owner with no linked login as unresolved', async () => {
        activeType();
        queryReturns([row(DEAL_C, EMP_NO_LOGIN)]);
        usersReturn();
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        const sent = accounting.RaiseCalls[0].Exceptions[0];
        expect(sent).toMatchObject({ SourceCreatedByUserID: null, CreatorUnresolved: true });
        expect(sent.Summary).toMatch(/owner has no linked login/);
        expect(result.CreatorUnresolved).toBe(1);
    });

    it('treats an owner linked to more than one login as unresolved, and says so', async () => {
        activeType();
        queryReturns([row(DEAL_D, EMP_TWO_LOGINS)]);
        usersReturn();
        await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        const sent = accounting.RaiseCalls[0].Exceptions[0];
        expect(sent).toMatchObject({ SourceCreatedByUserID: null, CreatorUnresolved: true });
        expect(sent.Summary).toMatch(/linked to 2 logins/);
    });

    it('sends no creator and no unresolved flag for a deal with no owner, and skips the lookup', async () => {
        activeType();
        queryReturns([row(DEAL_A, null, { OrderID: null, OrderStatus: null })]);
        await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        const sent = accounting.RaiseCalls[0].Exceptions[0];
        expect(sent).toMatchObject({ SourceCreatedByUserID: null, CreatorUnresolved: false });
        expect(sent.Summary).toMatch(/has no order/);
        expect(runViews).not.toHaveBeenCalled();
    });

    it('does not raise when the owner lookup fails', async () => {
        activeType();
        queryReturns([row(DEAL_A, EMP_ONE_LOGIN)]);
        runViews.mockResolvedValue([{ Success: false, ErrorMessage: 'denied' }]);
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'USER_LOOKUP_FAILED' });
        expect(accounting.RaiseCalls).toHaveLength(0);
    });

    it('counts created, already raised and skipped separately', async () => {
        activeType();
        queryReturns([row(DEAL_A, null), row(DEAL_B, null), row(DEAL_C, null)]);
        accounting.Raise = () => ({
            Success: true,
            Output: {
                Success: true,
                Results: [
                    { Index: 0, Created: true, FinanceExceptionID: 'fe-0' },
                    { Index: 1, Created: false, FinanceExceptionID: 'fe-existing' },
                    { Index: 2, Created: false, Skipped: true },
                ],
            },
        });
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: true, Found: 3, Created: 1, AlreadyRaised: 1, SkippedByAccounting: 1 });
    });
});

describe('a failed raise is reported, not swallowed', () => {
    it('fails the run and names the deal behind each error', async () => {
        activeType();
        queryReturns([row(DEAL_A, null), row(DEAL_B, null)]);
        accounting.Raise = () => ({
            Success: true,
            Output: { Success: false, Results: [], Errors: [{ Index: 1, Code: 'UNKNOWN_ENTITY', Message: 'no such entity' }] },
        });
        const result = await DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'RAISE_FAILED', Created: 0 });
        expect(result.Issues.join(' ')).toMatch(/deal D-B: UNKNOWN_ENTITY: no such entity/);
    });

    it('throws when the raise envelope fails', async () => {
        activeType();
        queryReturns([row(DEAL_A, null)]);
        accounting.Raise = () => ({ Success: false, ErrorMessage: 'transport down' });
        await expect(DetectWonDealsWithUnconfirmedOrders(PROVIDER, USER)).rejects.toThrow(/transport down/);
    });
});
