import { describe, expect, it, vi } from 'vitest';
import {
    type EntityInfo,
    EntityLifecyclePolicyEngine,
    type IMetadataProvider,
    ServerOperationScopeManager,
    type UserInfo,
} from '@memberjunction/core';
import { DealCloseStampFields, DealFieldsEditableWhileLocked } from '@mj-biz-apps/sales-entities';
import { CloseDealOperation } from '../CloseDealOperation.js';
import {
    DEAL_CLOSE_OPERATION_KEY,
    DEAL_LIFECYCLE_POLICY,
    DEAL_REOPEN_OPERATION_KEY,
    DealEntityServer,
    RegisterDealLifecyclePolicy,
} from '../DealEntityServer.js';

/**
 * THE CLOSE STAMPS ARE WRITTEN BY THE CLOSE AND THE REOPEN, AND BY NOTHING ELSE (#252).
 *
 * Every surface that asks "has this deal closed?" reads `ClosedAt` / `ActualCloseDate`. A rep who
 * typed a future day into Actual Close Date on an open deal made the header read "Closed", and the
 * save went through because nothing refused it on a deal that was not yet locked.
 *
 * `Object.create` holds the server entity without standing up metadata, as `MissingPartyRefusal` does.
 */

type Harness = {
    closeStampEditRefusal(): string | null;
    BeginClose<T>(body: () => Promise<T>): Promise<T>;
    BeginReopen<T>(body: () => Promise<T>): Promise<T>;
};

function deal(opts: { saved: boolean; values?: Record<string, unknown>; dirty?: string[] }): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const values = opts.values ?? {};
    const dirty = new Set(opts.dirty ?? []);
    for (const [k, v] of Object.entries({
        IsSaved: opts.saved,
        GetFieldByName: (name: string) => ({ Dirty: dirty.has(name), Value: values[name] ?? null }),
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    return instance;
}

describe('a save that writes a close stamp outside the close or the reopen', () => {
    it('refuses Actual Close Date typed onto an open deal, and points at Expected Close Date', () => {
        const d = deal({ saved: true, values: { ActualCloseDate: '2026-11-30' }, dirty: ['ActualCloseDate'] });
        const refusal = d.closeStampEditRefusal();

        expect(refusal).toContain('Actual Close Date');
        expect(refusal).toContain('Expected Close Date');
        expect(refusal).toContain('Nothing was changed');
    });

    it('names every stamp the save touched, by its on-screen label', () => {
        const d = deal({
            saved: true,
            values: { ClosedAt: '2026-11-30T15:00:00Z', ClosedByUserID: 'u1' },
            dirty: ['ClosedAt', 'ClosedByUserID'],
        });
        const refusal = d.closeStampEditRefusal();

        expect(refusal).toContain('Closed At and Closed By');
        expect(refusal).not.toContain('ClosedByUserID');
    });

    it('refuses a CLEARED stamp too: wiping a close is as much a rewrite as inventing one', () => {
        const d = deal({ saved: true, values: { ActualCloseDate: null }, dirty: ['ActualCloseDate'] });
        expect(d.closeStampEditRefusal()).toContain('Actual Close Date');
    });

    it('refuses a deal CREATED with a stamp, where Dirty would say nothing was supplied', () => {
        const d = deal({ saved: false, values: { ActualCloseDate: '2026-11-30' } });
        expect(d.closeStampEditRefusal()).toContain('Actual Close Date');
    });

    it('lets a stamp already on disk ride along with an unrelated edit', () => {
        const d = deal({ saved: true, values: { ActualCloseDate: '2026-09-30' }, dirty: ['NextStep'] });
        expect(d.closeStampEditRefusal()).toBeNull();
    });

    it('lets a new deal with no stamps through', () => {
        expect(deal({ saved: false }).closeStampEditRefusal()).toBeNull();
    });
});

describe('the two paths that may write the stamps', () => {
    const stamped = (): Harness =>
        deal({ saved: true, values: { ActualCloseDate: '2026-11-30' }, dirty: ['ActualCloseDate'] });

    it('the close may write them, and only for the length of the call', async () => {
        const d = stamped();
        const inside = await d.BeginClose(async () => d.closeStampEditRefusal());

        expect(inside).toBeNull();
        expect(d.closeStampEditRefusal(), 'the permission must not outlive the close').not.toBeNull();
    });

    it('the reopen may clear them', async () => {
        const d = stamped();
        expect(await d.BeginReopen(async () => d.closeStampEditRefusal())).toBeNull();
    });

    it('a close that throws still takes the permission away', async () => {
        const d = stamped();
        await expect(d.BeginClose(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
        expect(d.closeStampEditRefusal()).not.toBeNull();
    });

    it('registers the deal lifecycle & field-freeze policy on EntityLifecyclePolicyEngine and scopes BeginClose / BeginReopen via ServerOperationScopeManager', async () => {
        RegisterDealLifecyclePolicy();
        const entityInfo = { Name: 'MJ_BizApps_Sales: Deals' } as EntityInfo;
        const policy = EntityLifecyclePolicyEngine.Instance.ResolvePolicy(entityInfo);
        expect(policy?.stateMachine).toEqual(DEAL_LIFECYCLE_POLICY.stateMachine);
        expect(policy?.stateMachine?.editableFieldsByState?.['LockedWon']).toEqual([
            ...DealFieldsEditableWhileLocked(false),
        ]);
        expect(policy?.stateMachine?.editableFieldsByState?.['LockedLost']).toEqual([
            ...DealFieldsEditableWhileLocked(true),
        ]);
        expect(policy?.stateMachine?.frozenFieldsByState?.['Open']).toEqual([...DealCloseStampFields()]);

        const d = stamped();
        await d.BeginClose(async () => {
            expect(
                ServerOperationScopeManager.Instance.IsOperationActive(
                    [DEAL_CLOSE_OPERATION_KEY],
                    'MJ_BizApps_Sales: Deals',
                ),
            ).toBe(true);
        });
        expect(
            ServerOperationScopeManager.Instance.IsOperationActive(
                [DEAL_CLOSE_OPERATION_KEY],
                'MJ_BizApps_Sales: Deals',
            ),
        ).toBe(false);

        await d.BeginReopen(async () => {
            expect(
                ServerOperationScopeManager.Instance.IsOperationActive(
                    [DEAL_REOPEN_OPERATION_KEY],
                    'MJ_BizApps_Sales: Deals',
                ),
            ).toBe(true);
        });
        expect(
            ServerOperationScopeManager.Instance.IsOperationActive(
                [DEAL_REOPEN_OPERATION_KEY],
                'MJ_BizApps_Sales: Deals',
            ),
        ).toBe(false);
    });
});

describe('golive#387 — already-Won refusal on re-close or stale pre-close save', () => {
    const DEAL_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
    const WON_STATUS_ID = 'aaaaaaaa-0000-4000-8000-000000000002';
    const CONTRACT_ID = 'aaaaaaaa-0000-4000-8000-000000000003';
    const USER = { ID: 'aaaaaaaa-0000-4000-8000-000000000099' } as UserInfo;

    it('Sales.CloseDeal tells the caller the deal is already Won and names the contract', async () => {
        const provider = {
            GetEntityObject: vi.fn(async () => ({
                Load: async () => true,
                ID: DEAL_ID,
                DealNumber: 'DEAL-0042',
                Name: 'Renewal',
                DealStatusTypeID: WON_STATUS_ID,
                ContractID: CONTRACT_ID,
            })),
            RunView: vi.fn(async (params: { EntityName: string }) => {
                if (params.EntityName === 'MJ_BizApps_Sales: Deal Status Types') {
                    return {
                        Success: true,
                        Results: [{ ID: WON_STATUS_ID, IsWon: true, IsLost: false, IsClosed: true, LocksDeal: true }],
                    };
                }
                if (params.EntityName === 'MJ_BizApps_Contracts: Contracts') {
                    return {
                        Success: true,
                        Results: [{ ContractNumber: 'CON-0019' }],
                    };
                }
                return { Success: true, Results: [] };
            }),
        } as unknown as IMetadataProvider;

        const op = new CloseDealOperation() as unknown as {
            InternalExecute(
                input: { DealID: string; DealStatusTypeID: string },
                p: IMetadataProvider,
                u: UserInfo,
            ): Promise<{ Success: boolean; Issues: Array<{ Message: string }> }>;
        };
        const out = await op.InternalExecute({ DealID: DEAL_ID, DealStatusTypeID: WON_STATUS_ID }, provider, USER);

        expect(out.Success).toBe(false);
        expect(out.Issues[0]?.Message).toBe('DEAL-0042 is already Won; contract CON-0019 was created.');
    });

    it('DealEntityServer.staleWonSaveRefusal names the deal and contract when a stale pre-close save hits a Won deal', async () => {
        const instance = Object.create(DealEntityServer.prototype) as {
            staleWonSaveRefusal(): Promise<string | null>;
        };
        for (const [k, v] of Object.entries({
            IsSaved: true,
            DealNumber: 'DEAL-0042',
            Name: 'Renewal',
            ContractID: null,
            ContextCurrentUser: USER,
            GetFieldByName: (name: string) => {
                if (name === 'DealStatusTypeID') return { OldValue: WON_STATUS_ID, Value: 'open', Dirty: true };
                if (name === 'ContractID') return { OldValue: CONTRACT_ID, Value: null, Dirty: true };
                return { OldValue: null, Value: null, Dirty: false };
            },
            ProviderToUse: {
                RunView: vi.fn(async (params: { EntityName: string }) => {
                    if (params.EntityName === 'MJ_BizApps_Sales: Deal Status Types') {
                        return {
                            Success: true,
                            Results: [{ LocksDeal: true, IsLost: false, IsWon: true }],
                        };
                    }
                    if (params.EntityName === 'MJ_BizApps_Contracts: Contracts') {
                        return {
                            Success: true,
                            Results: [{ ContractNumber: 'CON-0019' }],
                        };
                    }
                    return { Success: true, Results: [] };
                }),
            },
        })) {
            Object.defineProperty(instance, k, { value: v, writable: true });
        }

        expect(await instance.staleWonSaveRefusal()).toBe(
            'DEAL-0042 is already Won; contract CON-0019 was created.',
        );
    });
});

describe('golive#306 — filling a blank AccountID on a closed deal', () => {
    const LOST_STATUS_ID = 'aaaaaaaa-0000-4000-8000-000000000006';
    const ACCOUNT_A = 'aaaaaaaa-0000-4000-8000-000000000010';
    const ACCOUNT_B = 'aaaaaaaa-0000-4000-8000-000000000011';

    function closedDeal(oldAccount: string | null, newAccount: string | null) {
        const instance = Object.create(DealEntityServer.prototype) as {
            checkCloseLock(reopening?: boolean): Promise<string | null>;
            _orderStatusWarnings: string[];
        };
        const fields = [
            { Name: 'DealStatusTypeID', OldValue: LOST_STATUS_ID, Value: LOST_STATUS_ID, Dirty: false },
            { Name: 'AccountID', OldValue: oldAccount, Value: newAccount, Dirty: oldAccount !== newAccount },
        ];
        for (const [k, v] of Object.entries({
            IsSaved: true,
            AccountID: newAccount,
            Fields: fields,
            Companions: [],
            RosterDrivesThisSave: false,
            _orderStatusWarnings: [] as string[],
            GetFieldByName: (name: string) => fields.find((f) => f.Name === name),
            ProviderToUse: {
                RunView: vi.fn(async () => ({
                    Success: true,
                    Results: [{ LocksDeal: true, IsLost: true, IsWon: false }],
                })),
            },
        })) {
            Object.defineProperty(instance, k, { value: v, writable: true });
        }
        return instance;
    }

    it('allows setting AccountID when the persisted account was blank, and records a warning', async () => {
        const d = closedDeal(null, ACCOUNT_A);
        expect(await d.checkCloseLock()).toBeNull();
        expect(d._orderStatusWarnings).toContain(
            "Account was set on this closed deal; its order's bill-to and any contract were left unchanged.",
        );
    });

    it('refuses changing a non-blank AccountID on a closed deal', async () => {
        const d = closedDeal(ACCOUNT_A, ACCOUNT_B);
        expect(await d.checkCloseLock()).toContain('Account cannot be changed until the status is set back to Open.');
    });

    it('refuses clearing a non-blank AccountID on a closed deal', async () => {
        const d = closedDeal(ACCOUNT_A, null);
        expect(await d.checkCloseLock()).toContain('Account cannot be changed until the status is set back to Open.');
    });
});
