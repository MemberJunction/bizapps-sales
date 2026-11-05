import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseEntity, type AuthorizationInfo, type UserInfo } from '@memberjunction/core';
import { DealEntityServer } from '../DealEntityServer.js';
import {
    DEAL_DELETE_AUTH,
    DealDeleteRefusal,
    UserDealDeleteScope,
    type DealDeleteFacts,
} from '../deal-delete.js';

/**
 * WHO MAY DELETE A DEAL, AND WHAT GOES WITH IT (golive#429).
 *
 * A Sales User deletes only an open deal they own; a Sales Admin (and Developer) any open deal; nobody
 * deletes a deal that is closed, was ever closed, or carries a Confirmed order. A delete that passes
 * removes the deal's child rows, the deal and its order in one transaction, and a refusal anywhere in
 * it rolls the whole thing back.
 *
 * `Object.create` holds the server entity without standing up metadata, as the other tests here do.
 */

const ME = 'eeeeeeee-0000-4000-8000-000000000001';
const SOMEONE_ELSE = 'eeeeeeee-0000-4000-8000-000000000002';
const DEAL = 'dddddddd-0000-4000-8000-000000000001';
const ORDER = 'oooooooo-0000-4000-8000-000000000001'.replace(/o/g, 'a');
const OPEN = 'ssssssss-0000-4000-8000-000000000001'.replace(/s/g, 'b');
const WON = 'ssssssss-0000-4000-8000-000000000002'.replace(/s/g, 'b');

function facts(over: Partial<DealDeleteFacts> = {}): DealDeleteFacts {
    return {
        Scope: 'own',
        UserEmployeeID: ME,
        OwnerEmployeeID: ME,
        ClosedNow: false,
        ClosedBefore: false,
        OrderStatus: 'Draft',
        ...over,
    };
}

describe('DealDeleteRefusal', () => {
    it('lets a Sales User delete an open deal they own', () => {
        expect(DealDeleteRefusal(facts(), 'Acme renewal')).toBeNull();
    });

    it("refuses a Sales User on someone else's deal, and names the role that can", () => {
        const refusal = DealDeleteRefusal(facts({ OwnerEmployeeID: SOMEONE_ELSE }), 'Acme renewal');
        expect(refusal).toContain('only deals you own');
        expect(refusal).toContain('Sales Admin');
    });

    it('refuses a Sales User on a deal with no owner, rather than treating no owner as theirs', () => {
        expect(DealDeleteRefusal(facts({ OwnerEmployeeID: null }), 'x')).toContain('only deals you own');
    });

    it('refuses a Sales User who has no Employee, rather than matching null to null', () => {
        expect(DealDeleteRefusal(facts({ UserEmployeeID: null, OwnerEmployeeID: null }), 'x')).toContain('only deals you own');
    });

    it("lets a Sales Admin delete someone else's open deal", () => {
        expect(DealDeleteRefusal(facts({ Scope: 'any', OwnerEmployeeID: SOMEONE_ELSE }), 'x')).toBeNull();
    });

    it('refuses a user with neither grant', () => {
        expect(DealDeleteRefusal(facts({ Scope: 'none' }), 'x')).toContain('Sales User or Sales Admin role');
    });

    it('refuses a closed deal, even for a Sales Admin', () => {
        expect(DealDeleteRefusal(facts({ Scope: 'any', ClosedNow: true }), 'x')).toContain('it is closed');
    });

    it('refuses a deal that was closed and reopened', () => {
        expect(DealDeleteRefusal(facts({ Scope: 'any', ClosedBefore: true }), 'x')).toContain('closed before and reopened');
    });

    it('refuses a deal whose order is Confirmed', () => {
        expect(DealDeleteRefusal(facts({ Scope: 'any', OrderStatus: 'Confirmed' }), 'x')).toContain('order is Confirmed');
    });

    it('allows a deal with no order', () => {
        expect(DealDeleteRefusal(facts({ OrderStatus: null }), 'x')).toBeNull();
    });
});

describe('UserDealDeleteScope', () => {
    const ADMIN_ROLE = 'rrrrrrrr-0000-4000-8000-000000000001'.replace(/r/g, 'c');
    const USER_ROLE = 'rrrrrrrr-0000-4000-8000-000000000002'.replace(/r/g, 'c');
    const ANY_ID = 'aaaaaaaa-1111-4000-8000-000000000001';
    const OWN_ID = 'aaaaaaaa-1111-4000-8000-000000000002';

    /** An authorization granted to exactly the roles listed. */
    function auth(id: string, name: string, parentID: string | null, roles: string[]): AuthorizationInfo {
        return {
            ID: id,
            Name: name,
            ParentID: parentID,
            IsActive: true,
            UserCanExecute: (u: UserInfo) => (u.UserRoles ?? []).some((r) => roles.includes(r.RoleID)),
        } as unknown as AuthorizationInfo;
    }
    const catalog = [
        auth(ANY_ID, DEAL_DELETE_AUTH.Any, null, [ADMIN_ROLE]),
        auth(OWN_ID, DEAL_DELETE_AUTH.Own, ANY_ID, [USER_ROLE]),
    ];
    const user = (...roles: string[]) => ({ UserRoles: roles.map((RoleID) => ({ RoleID })) }) as unknown as UserInfo;

    it('gives a Sales Admin any', () => expect(UserDealDeleteScope(user(ADMIN_ROLE), catalog)).toBe('any'));
    it('gives a Sales User own', () => expect(UserDealDeleteScope(user(USER_ROLE), catalog)).toBe('own'));
    it('gives a user with both roles any', () => expect(UserDealDeleteScope(user(USER_ROLE, ADMIN_ROLE), catalog)).toBe('any'));
    it('gives everyone else none', () => expect(UserDealDeleteScope(user(), catalog)).toBe('none'));
    it('fails closed when the authorizations are not installed', () => {
        expect(UserDealDeleteScope(user(ADMIN_ROLE, USER_ROLE), [])).toBe('none');
    });
});

describe('DealEntityServer.Delete', () => {
    afterEach(() => vi.restoreAllMocks());

    interface World {
        lockingStatuses: string[];
        historyTo: string[];
        orderStatus: string | null;
        orderDeletes?: boolean;
        scope?: 'any' | 'own';
        failRead?: boolean;
    }

    function deal(world: World) {
        const log: string[] = [];
        const instance = Object.create(DealEntityServer.prototype) as DealEntityServer;
        const persisted: Record<string, string | null> = {
            DealStatusTypeID: OPEN,
            OwnerEmployeeID: ME,
            OrderID: world.orderStatus ? ORDER : null,
        };
        const results: Array<{ Success: boolean; Message: string }> = [];
        const roles = world.scope === 'any' ? ['admin'] : ['user'];
        const define = (name: string, value: unknown) => Object.defineProperty(instance, name, { value, writable: true });
        define('IsSaved', true);
        define('ID', DEAL);
        define('Name', 'Acme renewal');
        define('Fields', []);
        define('ContextCurrentUser', { ID: 'u1', EmployeeID: ME, UserRoles: roles.map((RoleID) => ({ RoleID })) });
        define('GetFieldByName', (f: string) => ({ OldValue: persisted[f] }));
        define('CheckPermissions', () => true);
        define('RegisterResultHistoryEntry', (r: { Success: boolean; Message: string }) => results.push(r));
        define('Results', results);
        define('ProviderToUse', {
            Authorizations: [
                { ID: 'any', Name: DEAL_DELETE_AUTH.Any, ParentID: null, IsActive: true, UserCanExecute: (u: UserInfo) => u.UserRoles.some((r) => r.RoleID === 'admin') },
                { ID: 'own', Name: DEAL_DELETE_AUTH.Own, ParentID: 'any', IsActive: true, UserCanExecute: (u: UserInfo) => u.UserRoles.some((r) => r.RoleID === 'user') },
            ],
            RunViews: async (params: Array<{ EntityName: string }>) => {
                if (world.failRead) return params.map(() => ({ Success: false, ErrorMessage: 'connection reset' }));
                return params.map((p) => {
                    if (p.EntityName.endsWith('Deal Status Types')) return { Success: true, Results: world.lockingStatuses.map((ID) => ({ ID })) };
                    if (p.EntityName.endsWith('Deal Stage Events')) return { Success: true, Results: world.historyTo.map((ToDealStatusTypeID) => ({ ToDealStatusTypeID })) };
                    return { Success: true, Results: [{ Status: world.orderStatus }] };
                });
            },
            ExecuteSQL: async (sql: string) => {
                log.push(`sql:${(sql.match(/DELETE FROM/g) ?? []).length}`);
                return [];
            },
            BeginEntityTransaction: async () => {
                log.push('begin');
                return { Commit: async () => log.push('commit'), Rollback: async () => log.push('rollback') };
            },
            GetEntityObject: async () => ({
                Load: async () => true,
                Delete: async () => {
                    log.push('order');
                    return world.orderDeletes !== false;
                },
                LatestResult: { CompleteMessage: 'Order is locked' },
            }),
        });
        vi.spyOn(BaseEntity.prototype, 'Delete').mockImplementation(async () => {
            log.push('deal');
            return true;
        });
        return { instance, log, results };
    }

    it('deletes children, the deal and its order in one transaction, in that order', async () => {
        const { instance, log } = deal({ lockingStatuses: [WON], historyTo: [OPEN], orderStatus: 'Draft' });
        expect(await instance.Delete()).toBe(true);
        expect(log).toEqual(['begin', 'sql:4', 'deal', 'order', 'commit']);
    });

    it('skips the order when the deal has none', async () => {
        const { instance, log } = deal({ lockingStatuses: [WON], historyTo: [], orderStatus: null });
        expect(await instance.Delete()).toBe(true);
        expect(log).toEqual(['begin', 'sql:4', 'deal', 'commit']);
    });

    it('rolls everything back when the order refuses, and says why', async () => {
        const { instance, log, results } = deal({ lockingStatuses: [WON], historyTo: [], orderStatus: 'Draft', orderDeletes: false });
        expect(await instance.Delete()).toBe(false);
        expect(log).toEqual(['begin', 'sql:4', 'deal', 'order', 'rollback']);
        expect(results.at(-1)?.Message).toContain('Order is locked');
    });

    it('refuses a deal reopened after a close before touching anything', async () => {
        const { instance, log, results } = deal({ lockingStatuses: [WON], historyTo: [OPEN, WON, OPEN], orderStatus: 'Draft', scope: 'any' });
        expect(await instance.Delete()).toBe(false);
        expect(log).toEqual([]);
        expect(results.at(-1)?.Message).toContain('closed before and reopened');
    });

    it('refuses when a read fails, rather than guessing', async () => {
        const { instance, log, results } = deal({ lockingStatuses: [], historyTo: [], orderStatus: 'Draft', failRead: true });
        expect(await instance.Delete()).toBe(false);
        expect(log).toEqual([]);
        expect(results.at(-1)?.Message).toContain('could not be checked');
    });
});
