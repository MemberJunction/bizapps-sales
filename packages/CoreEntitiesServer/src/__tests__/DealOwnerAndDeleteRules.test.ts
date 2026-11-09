import { describe, expect, it, vi } from 'vitest';
import { DealEntity } from '@mj-biz-apps/sales-entities';
import { DealEntityServer } from '../DealEntityServer.js';

const ROLE_OWNER_UPPER = 'AAAAAAAA-0000-4000-8000-000000000001';
const ROLE_OWNER_LOWER = 'aaaaaaaa-0000-4000-8000-000000000001';
const ROLE_SE = 'bbbbbbbb-0000-4000-8000-000000000002';
const EMP_1 = 'eeeeeeee-0000-4000-8000-000000000001';
const EMP_2 = 'eeeeeeee-0000-4000-8000-000000000002';
const DEAL_ID = 'dddddddd-0000-4000-8000-000000000001';
const ORDER_ID = 'ffffffff-0000-4000-8000-000000000001';

describe('stampOwnerFromTeam (#409 + #355 item 4)', () => {
    function makeDeal(
        items: Array<{ DealRoleID: string | null; EmployeeID: string | null; IsActive?: boolean | null }>,
        resolvedRoleID = ROLE_OWNER_UPPER,
    ) {
        const instance = Object.create(DealEntityServer.prototype) as {
            OwnerEmployeeID: string | null;
            stampOwnerFromTeam(): Promise<void>;
        };
        Object.defineProperty(instance, 'OwnerEmployeeID', { value: EMP_1, writable: true });
        Object.defineProperty(instance, 'RosterDrivesThisSave', { get: () => true });
        Object.defineProperty(instance, 'ResolveOwnerRoleID', { value: async () => resolvedRoleID });
        Object.defineProperty(instance, 'Team', { value: { Items: items } });
        return instance;
    }

    it('matches DealRoleID case-insensitively with UUIDsEqual', async () => {
        const d = makeDeal([{ DealRoleID: ROLE_OWNER_LOWER, EmployeeID: EMP_2, IsActive: true }]);
        await d.stampOwnerFromTeam();
        expect(d.OwnerEmployeeID).toBe(EMP_2);
    });

    it('ignores inactive Owner/AE rows and picks the active Owner/AE row', async () => {
        const d = makeDeal([
            { DealRoleID: ROLE_OWNER_UPPER, EmployeeID: EMP_1, IsActive: false },
            { DealRoleID: ROLE_OWNER_LOWER, EmployeeID: EMP_2, IsActive: true },
        ]);
        await d.stampOwnerFromTeam();
        expect(d.OwnerEmployeeID).toBe(EMP_2);
    });

    it('clears OwnerEmployeeID to null when no active Owner/AE row remains', async () => {
        const d = makeDeal([{ DealRoleID: ROLE_OWNER_UPPER, EmployeeID: EMP_1, IsActive: false }]);
        await d.stampOwnerFromTeam();
        expect(d.OwnerEmployeeID).toBeNull();
    });
});

describe('DealEntity.SetOwner (#409 + #355 item 4)', () => {
    type TeamRow = {
        DealRoleID: string | null;
        EmployeeID: string | null;
        PersonID: string | null;
        IsActive: boolean;
    };

    function makeSharedDeal(initialItems: TeamRow[], resolvedRoleID = ROLE_OWNER_UPPER) {
        const items = [...initialItems];
        const removed: TeamRow[] = [];
        const created: TeamRow[] = [];
        const instance = Object.create(DealEntity.prototype) as {
            OwnerEmployeeID: string | null;
            SetOwner(employeeID: string | null): Promise<void>;
        };
        Object.defineProperty(instance, 'OwnerEmployeeID', { value: null, writable: true });
        Object.defineProperty(instance, 'ResolveOwnerRoleID', { value: async () => resolvedRoleID });
        Object.defineProperty(instance, 'Team', {
            value: {
                Items: items,
                Load: async () => true,
                Remove: (m: TeamRow) => {
                    removed.push(m);
                    const idx = items.indexOf(m);
                    if (idx >= 0) items.splice(idx, 1);
                },
                Create: async () => {
                    const row: TeamRow = { DealRoleID: null, EmployeeID: null, PersonID: null, IsActive: true };
                    items.push(row);
                    created.push(row);
                    return row;
                },
            },
        });
        return { instance, items, removed, created };
    }

    it('treats an already-active owner with a differently-cased DealRoleID or EmployeeID as a no-op', async () => {
        const { instance, removed, created } = makeSharedDeal([
            { DealRoleID: ROLE_OWNER_LOWER, EmployeeID: EMP_1.toUpperCase(), PersonID: null, IsActive: true },
        ]);
        await instance.SetOwner(EMP_1.toLowerCase());
        expect(removed).toEqual([]);
        expect(created).toEqual([]);
        expect(instance.OwnerEmployeeID).toBe(EMP_1.toLowerCase());
    });

    it('replaces an inactive owner row even when it holds the same EmployeeID', async () => {
        const inactiveRow: TeamRow = {
            DealRoleID: ROLE_OWNER_LOWER,
            EmployeeID: EMP_1,
            PersonID: null,
            IsActive: false,
        };
        const { instance, removed, created } = makeSharedDeal([inactiveRow]);
        await instance.SetOwner(EMP_1);
        expect(removed).toEqual([inactiveRow]);
        expect(created).toHaveLength(1);
        expect(created[0]).toMatchObject({
            DealRoleID: ROLE_OWNER_UPPER,
            EmployeeID: EMP_1,
            IsActive: true,
        });
        expect(instance.OwnerEmployeeID).toBe(EMP_1);
    });
});

describe('DealEntityServer.teamRoleRulesRefusal (#355 item 5)', () => {
    function makeGraphDeal(opts: {
        dealIsSaved?: boolean;
        teamIsLoaded?: boolean;
        items: Array<{
            ID?: string;
            IsSaved?: boolean;
            Dirty?: boolean;
            DealRoleID?: string | null;
            EmployeeID?: string | null;
            Employee?: string | null;
        }>;
        persistedHolder?: string | null;
    }) {
        const instance = Object.create(DealEntityServer.prototype) as {
            teamRoleRulesRefusal(): Promise<string | null>;
        };
        Object.defineProperty(instance, 'ID', { value: DEAL_ID });
        Object.defineProperty(instance, 'IsSaved', { value: opts.dealIsSaved ?? false });
        Object.defineProperty(instance, 'RosterDrivesThisSave', { get: () => true });
        Object.defineProperty(instance, 'ContextCurrentUser', { value: { ID: 'u1' } });
        Object.defineProperty(instance, 'Team', {
            value: {
                IsLoaded: opts.teamIsLoaded ?? true,
                Count: opts.items.length,
                Items: opts.items,
            },
        });
        Object.defineProperty(instance, 'ProviderToUse', {
            value: {
                RunView: async ({ EntityName, ExtraFilter }: { EntityName: string; ExtraFilter: string }) => {
                    if (EntityName === 'MJ_BizApps_Sales: Deal Roles') {
                        const isOwner = ExtraFilter.toLowerCase().includes(ROLE_OWNER_LOWER);
                        return {
                            Success: true,
                            Results: [
                                {
                                    Name: isOwner ? 'Owner / AE' : 'Solutions Engineer',
                                    AllowsMultiplePerDeal: !isOwner,
                                    IsOwnerRole: isOwner,
                                },
                            ],
                        };
                    }
                    return {
                        Success: true,
                        Results: opts.persistedHolder ? [{ Employee: opts.persistedHolder }] : [],
                    };
                },
            },
        });
        return instance;
    }

    it('refuses a deal graph containing two rows in a single-holder role', async () => {
        const d = makeGraphDeal({
            items: [
                { IsSaved: false, DealRoleID: ROLE_OWNER_UPPER, EmployeeID: EMP_1, Employee: 'First Rep' },
                { IsSaved: false, DealRoleID: ROLE_OWNER_LOWER, EmployeeID: EMP_2, Employee: 'Second Rep' },
            ],
        });
        await expect(d.teamRoleRulesRefusal()).resolves.toBe(
            "This deal already has someone in the Owner / AE role (First Rep). Change that row's employee "
                + 'instead of adding a second one.',
        );
    });

    it('refuses an owner-role row in a deal graph when EmployeeID is missing', async () => {
        const d = makeGraphDeal({
            items: [{ IsSaved: false, DealRoleID: ROLE_OWNER_UPPER, EmployeeID: null }],
        });
        await expect(d.teamRoleRulesRefusal()).resolves.toContain(
            'The Owner / AE must be an employee, because the deal\'s owner is read from the Employee field.',
        );
    });

    it('checks persisted team rows when staging onto a saved deal whose team was not loaded', async () => {
        const d = makeGraphDeal({
            dealIsSaved: true,
            teamIsLoaded: false,
            persistedHolder: 'Existing Rep',
            items: [{ IsSaved: false, DealRoleID: ROLE_OWNER_UPPER, EmployeeID: EMP_2 }],
        });
        await expect(d.teamRoleRulesRefusal()).resolves.toContain('Existing Rep');
    });

    it('allows multiple holders for a role with AllowsMultiplePerDeal = true', async () => {
        const d = makeGraphDeal({
            items: [
                { IsSaved: false, DealRoleID: ROLE_SE, EmployeeID: EMP_1 },
                { IsSaved: false, DealRoleID: ROLE_SE, EmployeeID: EMP_2 },
            ],
        });
        await expect(d.teamRoleRulesRefusal()).resolves.toBeNull();
    });
});

describe('DealEntityServer.Delete (#411)', () => {
    const parentProto = Object.getPrototypeOf(DealEntityServer.prototype) as {
        Delete: () => Promise<boolean>;
    };

    function makeDeletableDeal(opts: {
        orderID?: string | null;
        locksDeal?: boolean;
        childDeleteFails?: boolean;
        superDeleteFails?: boolean;
    }) {
        const refusals: string[] = [];
        const deletedChildren: string[] = [];
        const scope = {
            Commit: vi.fn(async () => undefined),
            Rollback: vi.fn(async () => undefined),
        };

        const instance = Object.create(DealEntityServer.prototype) as {
            Delete(): Promise<boolean>;
        };
        Object.defineProperty(instance, 'ID', { value: DEAL_ID });
        Object.defineProperty(instance, 'OrderID', { value: opts.orderID ?? null });
        Object.defineProperty(instance, 'DealStatusTypeID', { value: 'aaaaaaaa-0000-4000-8000-0000000000c1' });
        Object.defineProperty(instance, 'ContextCurrentUser', { value: { ID: 'u1' } });
        Object.defineProperty(instance, 'Fields', { value: [] });
        Object.defineProperty(instance, 'GetFieldByName', {
            value: () => ({ OldValue: 'aaaaaaaa-0000-4000-8000-0000000000c1', Dirty: false }),
        });
        Object.defineProperty(instance, 'RegisterResultHistoryEntry', {
            value: (entry: { Message: string }) => refusals.push(entry.Message),
        });
        Object.defineProperty(instance, 'LatestResult', {
            get: () =>
                refusals.length > 0
                    ? { Success: false, Message: refusals[refusals.length - 1], CompleteMessage: refusals[refusals.length - 1] }
                    : null,
        });
        Object.defineProperty(instance, 'ProviderToUse', {
            value: {
                BeginEntityTransaction: async () => scope,
                RunView: async ({ EntityName }: { EntityName: string }) => {
                    if (EntityName === 'MJ_BizApps_Sales: Deal Status Types') {
                        return {
                            Success: true,
                            Results: [{ LocksDeal: opts.locksDeal ?? false, IsLost: false }],
                        };
                    }
                    if (EntityName === 'MJ_BizApps_Sales: Deal Team Members') {
                        return {
                            Success: true,
                            Results: [
                                {
                                    DeleteWithoutRestamp: async () => {
                                        if (opts.childDeleteFails) return false;
                                        deletedChildren.push('team-without-restamp');
                                        return true;
                                    },
                                    Delete: async () => {
                                        deletedChildren.push('team-with-restamp');
                                        return true;
                                    },
                                    LatestResult: { Message: 'child delete refused' },
                                },
                            ],
                        };
                    }
                    if (EntityName === 'MJ_BizApps_Sales: Deal Payment Schedules') {
                        return {
                            Success: true,
                            Results: [
                                {
                                    Delete: async () => {
                                        deletedChildren.push('schedule');
                                        return true;
                                    },
                                },
                            ],
                        };
                    }
                    return {
                        Success: true,
                        Results: [
                            {
                                Delete: async () => {
                                    deletedChildren.push('contact-role');
                                    return true;
                                },
                            },
                        ],
                    };
                },
            },
        });

        return { instance, refusals, deletedChildren, scope };
    }

    it('refuses to delete a deal that has an order', async () => {
        const { instance, refusals, deletedChildren } = makeDeletableDeal({ orderID: ORDER_ID });
        expect(await instance.Delete()).toBe(false);
        expect(refusals).toEqual(['This deal has an order. Abandon the deal instead.']);
        expect(deletedChildren).toEqual([]);
    });

    it('refuses to delete a closed deal even when it has no order', async () => {
        const { instance, refusals, deletedChildren } = makeDeletableDeal({ orderID: null, locksDeal: true });
        expect(await instance.Delete()).toBe(false);
        expect(refusals).toEqual(['This deal is closed and cannot be deleted.']);
        expect(deletedChildren).toEqual([]);
    });

    it('deletes team, schedule, and contact-role children without restamping, then deletes the deal in one transaction', async () => {
        const spy = vi.spyOn(parentProto, 'Delete').mockResolvedValue(true);
        try {
            const { instance, refusals, deletedChildren, scope } = makeDeletableDeal({ orderID: null });
            expect(await instance.Delete()).toBe(true);
            expect(refusals).toEqual([]);
            expect(deletedChildren).toEqual(['team-without-restamp', 'schedule', 'contact-role']);
            expect(scope.Commit).toHaveBeenCalledTimes(1);
            expect(scope.Rollback).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it('rolls back the transaction and records the refusal when a child delete fails', async () => {
        const spy = vi.spyOn(parentProto, 'Delete').mockResolvedValue(true);
        try {
            const { instance, refusals, scope } = makeDeletableDeal({
                orderID: null,
                childDeleteFails: true,
            });
            expect(await instance.Delete()).toBe(false);
            expect(scope.Rollback).toHaveBeenCalledTimes(1);
            expect(scope.Commit).not.toHaveBeenCalled();
            expect(refusals).toEqual(['child delete refused']);
        } finally {
            spy.mockRestore();
        }
    });
});
