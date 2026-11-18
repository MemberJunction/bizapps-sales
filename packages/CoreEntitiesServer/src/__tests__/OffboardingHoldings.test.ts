/**
 * Offboarding (golive #297): who may move a leaver's sales items, which rows count as open versus
 * history, and that a refused save is reported as skipped rather than bypassed.
 *
 * Reads are stubbed at the `@memberjunction/core` boundary; entities are in-memory fakes, so what runs
 * for real is the rule set and the move loop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunViewParams, UserInfo } from '@memberjunction/core';

const runViews = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, LogError: () => undefined, RunView: class { public RunViews = runViews; } };
});

const {
    BuildSalesHoldings,
    CanReassignSalesHoldings,
    FilterRequestedHoldings,
    IsOpenDeal,
    OpenStatusIDs,
    ParseStringList,
    PreSaveSkipReason,
    ReassignSalesOffboardingHoldings,
    ListSalesOffboardingHoldings,
} = await import('../offboarding/OffboardingHoldings.js');
type Facts = Parameters<typeof BuildSalesHoldings>[0];

const LEAVER_USER = '11111111-0000-4000-8000-000000000001';
const LEAVER_EMP = '11111111-0000-4000-8000-0000000000E1';
const LEAVER_PERSON = '11111111-0000-4000-8000-0000000000F1';
const BOSS_EMP = '22222222-0000-4000-8000-0000000000E2';
const NEXT_USER = '33333333-0000-4000-8000-000000000003';
const NEXT_EMP = '33333333-0000-4000-8000-0000000000E3';
const NEXT_PERSON = '33333333-0000-4000-8000-0000000000F3';
const OPEN = 'aaaaaaaa-0000-4000-8000-00000000000a';
const WON = 'bbbbbbbb-0000-4000-8000-00000000000b';
const OWNER_ROLE = 'cccccccc-0000-4000-8000-00000000000c';
const SE_ROLE = 'dddddddd-0000-4000-8000-00000000000d';
const D_OPEN = 'd0000000-0000-4000-8000-000000000001';
const D_WON = 'd0000000-0000-4000-8000-000000000002';
const D_NOSTATUS = 'd0000000-0000-4000-8000-000000000003';
const TM_SE_OPEN = 'e0000000-0000-4000-8000-000000000001';

function caller(opts: { employeeID?: string | null; roles?: string[] } = {}): UserInfo {
    return { ID: 'caller', EmployeeID: opts.employeeID ?? null, UserRoles: (opts.roles ?? []).map((Role) => ({ Role })) } as unknown as UserInfo;
}

function facts(overrides: Partial<Facts> = {}): Facts {
    return {
        Statuses: [{ ID: OPEN.toUpperCase(), IsOpen: true }, { ID: WON, IsOpen: false }],
        OwnedDeals: [
            { ID: D_OPEN, DealNumber: 'D-1', Name: 'Open deal', DealStatusTypeID: OPEN },
            { ID: D_WON, DealNumber: 'D-2', Name: 'Won deal', DealStatusTypeID: WON },
            { ID: D_NOSTATUS, DealNumber: 'D-3', Name: 'No status', DealStatusTypeID: null },
        ],
        TeamRows: [
            { ID: 'tm-owner', DealID: D_OPEN, DealRoleID: OWNER_ROLE, DealRole: 'Owner', IsActive: true },
            { ID: TM_SE_OPEN, DealID: D_OPEN, DealRoleID: SE_ROLE, DealRole: 'SE', IsActive: true },
            { ID: 'tm-se-won', DealID: D_WON, DealRoleID: SE_ROLE, DealRole: 'SE', IsActive: true },
            { ID: 'tm-se-inactive', DealID: D_OPEN, DealRoleID: SE_ROLE, DealRole: 'SE', IsActive: false },
        ],
        TeamDeals: [
            { ID: D_OPEN, DealNumber: 'D-1', Name: 'Open deal', DealStatusTypeID: OPEN },
            { ID: D_WON, DealNumber: 'D-2', Name: 'Won deal', DealStatusTypeID: WON },
        ],
        OwnerRoleIDs: [OWNER_ROLE],
        Accounts: [{ ID: 'acct-1', Name: 'Acme' }],
        Contacts: [{ ID: 'ct-1', FirstName: 'Pat', LastName: 'Lee', Email: null }],
        Pipelines: [{ ID: 'pipe-1', Name: 'Main' }],
        ...overrides,
    };
}

describe('who may reassign (g297.5)', () => {
    const leaver = { SupervisorEmployeeID: BOSS_EMP };

    it("lets the leaver's supervisor reassign, comparing ids in any case", () => {
        expect(CanReassignSalesHoldings(caller({ employeeID: BOSS_EMP.toLowerCase() }), leaver)).toBe(true);
    });

    it('lets a Sales Admin reassign anyone\'s items', () => {
        expect(CanReassignSalesHoldings(caller({ roles: ['Sales Admin'] }), leaver)).toBe(true);
        expect(CanReassignSalesHoldings(caller({ roles: [' sales admin '] }), { SupervisorEmployeeID: null })).toBe(true);
    });

    it('refuses anyone else, including a Sales User and another employee', () => {
        expect(CanReassignSalesHoldings(caller({ employeeID: NEXT_EMP, roles: ['Sales User'] }), leaver)).toBe(false);
    });

    it('refuses the supervisor branch when the leaver has no supervisor, even for a caller with no Employee', () => {
        expect(CanReassignSalesHoldings(caller({ employeeID: null }), { SupervisorEmployeeID: null })).toBe(false);
        expect(CanReassignSalesHoldings(caller({ employeeID: BOSS_EMP }), { SupervisorEmployeeID: null })).toBe(false);
    });

    it('refuses with no caller', () => {
        expect(CanReassignSalesHoldings(null, leaver)).toBe(false);
    });
});

describe('open versus history', () => {
    it('reads open from the status type flag', () => {
        const open = OpenStatusIDs(facts().Statuses);
        expect(IsOpenDeal({ DealStatusTypeID: OPEN }, open)).toBe(true);
        expect(IsOpenDeal({ DealStatusTypeID: WON }, open)).toBe(false);
        expect(IsOpenDeal({ DealStatusTypeID: null }, open)).toBe(false);
        expect(IsOpenDeal({ DealStatusTypeID: 'eeeeeeee-0000-4000-8000-00000000000e' }, open)).toBe(false);
    });

    it('lists only open deals the leaver owns, and team seats on open deals other than the owner seat', () => {
        const rows = BuildSalesHoldings(facts(), { CanReassign: true, Note: null });
        const ids = (kind: string) => rows.filter((r) => r.Kind === kind).map((r) => r.RecordID);
        expect(ids('DEAL_OWNER')).toEqual([D_OPEN]);
        expect(ids('DEAL_TEAM_MEMBER')).toEqual([TM_SE_OPEN]);
        expect(ids('ACCOUNT_OWNER')).toEqual(['acct-1']);
        expect(ids('CONTACT_OWNER')).toEqual(['ct-1']);
        expect(ids('PIPELINE_CLOSE_WON_ASSIGNEE')).toEqual(['pipe-1']);
    });

    it('labels rows and carries the shared contract fields', () => {
        const rows = BuildSalesHoldings(facts(), { CanReassign: false, Note: 'why not' });
        const team = rows.find((r) => r.Kind === 'DEAL_TEAM_MEMBER');
        expect(team).toMatchObject({
            App: 'Sales',
            Domain: 'Sales',
            KindLabel: 'Deal team member',
            EntityName: 'MJ_BizApps_Sales: Deal Team Members',
            Label: 'D-1 Open deal (SE)',
            CanReassign: false,
            Note: 'why not',
        });
        expect(rows.find((r) => r.Kind === 'CONTACT_OWNER')?.Label).toBe('Pat Lee');
    });
});

describe('request filters', () => {
    const rows = BuildSalesHoldings(facts(), { CanReassign: true, Note: null });

    it('keeps everything with no filter, and narrows by kind and record id', () => {
        expect(FilterRequestedHoldings(rows, null, [])).toHaveLength(rows.length);
        expect(FilterRequestedHoldings(rows, ['deal_owner'], null).map((r) => r.RecordID)).toEqual([D_OPEN]);
        expect(FilterRequestedHoldings(rows, null, [D_OPEN.toUpperCase()]).map((r) => r.Kind)).toEqual(['DEAL_OWNER']);
    });

    it('parses JSON arrays, and rejects what is not one', () => {
        expect(ParseStringList('["A", " B "]')).toEqual(['A', 'B']);
        expect(ParseStringList(['A'])).toEqual(['A']);
        expect(ParseStringList('')).toBeNull();
        expect(ParseStringList(null)).toBeNull();
        expect(ParseStringList('not json')).toBeUndefined();
        expect(ParseStringList('{"a":1}')).toBeUndefined();
        expect(ParseStringList('[1]')).toBeUndefined();
    });

    it('skips before saving when the successor lacks what the kind needs', () => {
        const successor = { UserID: NEXT_USER, EmployeeID: NEXT_EMP, PersonID: null, SupervisorEmployeeID: null, UserIsActive: true, Name: 'Sam' };
        const pipeline = rows.find((r) => r.Kind === 'PIPELINE_CLOSE_WON_ASSIGNEE');
        const team = rows.find((r) => r.Kind === 'DEAL_TEAM_MEMBER');
        expect(PreSaveSkipReason(pipeline!, successor, new Set())).toMatch(/no Person record/);
        expect(PreSaveSkipReason(team!, successor, new Set([TM_SE_OPEN]))).toMatch(/already holds this role/);
        expect(PreSaveSkipReason(team!, successor, new Set())).toBeNull();
    });
});

/* ── The operations, end to end over stubbed reads ─────────────────────────────────────────── */

type Row = Record<string, unknown>;

/** Answer each RunViews call by entity and filter, so the test states the world, not the call order. */
function world(opts: { supervisor?: string | null; successorActive?: boolean; successorEmployee?: string | null; successorHoldsSE?: boolean } = {}) {
    const f = facts();
    const answer = (p: RunViewParams): Row[] => {
        const filter = p.ExtraFilter ?? '';
        switch (p.EntityName) {
            case 'MJ: Users':
                if (filter.includes(LEAVER_USER) || filter.includes(LEAVER_EMP)) return [{ ID: LEAVER_USER, Name: 'Lee', EmployeeID: LEAVER_EMP, IsActive: false }];
                if (filter.includes(NEXT_USER)) {
                    return [{ ID: NEXT_USER, Name: 'Sam', EmployeeID: opts.successorEmployee === undefined ? NEXT_EMP : opts.successorEmployee, IsActive: opts.successorActive ?? true }];
                }
                return [];
            case 'MJ: Employees':
                if (filter.includes(LEAVER_EMP)) return [{ ID: LEAVER_EMP, FirstName: 'Lee', LastName: 'Leaver', SupervisorID: opts.supervisor === undefined ? BOSS_EMP : opts.supervisor }];
                if (filter.includes(NEXT_EMP)) return [{ ID: NEXT_EMP, FirstName: 'Sam', LastName: 'Next', SupervisorID: null }];
                return [];
            case 'MJ_BizApps_Common: People':
                if (filter.includes(LEAVER_USER)) return [{ ID: LEAVER_PERSON }];
                if (filter.includes(NEXT_USER)) return [{ ID: NEXT_PERSON }];
                return [];
            case 'MJ_BizApps_Sales: Deal Status Types': return f.Statuses;
            case 'MJ_BizApps_Sales: Deals': return filter.startsWith('OwnerEmployeeID') ? f.OwnedDeals : f.TeamDeals;
            case 'MJ_BizApps_Sales: Deal Team Members':
                if (filter.startsWith('EmployeeID') && filter.includes(LEAVER_EMP)) return f.TeamRows;
                if (filter.startsWith('ID IN')) return f.TeamRows.filter((t) => filter.includes(t.ID));
                if (filter.startsWith('EmployeeID') && filter.includes(NEXT_EMP) && opts.successorHoldsSE) {
                    return [{ ID: 'tm-successor', DealID: D_OPEN, DealRoleID: SE_ROLE }];
                }
                return [];
            case 'MJ_BizApps_Sales: Deal Roles': return [{ ID: OWNER_ROLE }];
            case 'MJ_BizApps_Sales: Sales Accounts': return f.Accounts;
            case 'MJ_BizApps_Sales: Sales Contacts': return f.Contacts;
            case 'MJ_BizApps_Sales: Pipelines': return filter.includes(LEAVER_PERSON) ? f.Pipelines : [];
            default: return [];
        }
    };
    runViews.mockImplementation(async (params: RunViewParams[]) => params.map((p) => ({ Success: true, Results: answer(p) })));
}

/** The slice of BaseEntity / DealEntity the moves touch. */
class FakeEntity {
    public static Saved: Array<{ Entity: string; ID: string; Values: Row; Owner?: string | null }> = [];
    public static Refuse = new Set<string>();
    public Values: Row = {};
    public Owner: string | null | undefined;
    private id = '';
    public LatestResult = { CompleteMessage: '', Message: '' };
    constructor(private readonly entity: string) {}
    public async InnerLoad(key: { Values(): string }): Promise<boolean> { this.id = key.Values(); return true; }
    public Set(name: string, value: unknown): void { this.Values[name] = value; }
    public async SetOwner(employeeID: string | null): Promise<void> { this.Owner = employeeID; }
    public async Save(): Promise<boolean> {
        if (FakeEntity.Refuse.has(this.id)) {
            this.LatestResult = { CompleteMessage: 'You do not have permission to update this record.', Message: '' };
            return false;
        }
        FakeEntity.Saved.push({ Entity: this.entity, ID: this.id, Values: this.Values, Owner: this.Owner });
        return true;
    }
}

const PROVIDER = { GetEntityObject: async (name: string) => new FakeEntity(name) } as never;

beforeEach(() => {
    runViews.mockReset();
    FakeEntity.Saved = [];
    FakeEntity.Refuse = new Set();
});

describe('Sales.ListOffboardingHoldings', () => {
    it('lists by employee id alone, resolving the user and person, with CanReassign for the supervisor', async () => {
        world();
        const result = await ListSalesOffboardingHoldings({ LeaverEmployeeID: LEAVER_EMP }, caller({ employeeID: BOSS_EMP }));
        expect(result.Outcome).toBe('SUCCESS');
        expect(result.Holdings.map((h) => h.Kind)).toEqual(['DEAL_OWNER', 'DEAL_TEAM_MEMBER', 'ACCOUNT_OWNER', 'CONTACT_OWNER', 'PIPELINE_CLOSE_WON_ASSIGNEE']);
        expect(result.Holdings.every((h) => h.CanReassign && h.Note === null)).toBe(true);
    });

    it('lists for anyone, with CanReassign false and a note for a caller who may not move them', async () => {
        world();
        const result = await ListSalesOffboardingHoldings({ LeaverUserID: LEAVER_USER }, caller({ employeeID: NEXT_EMP }));
        expect(result.Holdings.length).toBeGreaterThan(0);
        expect(result.Holdings.every((h) => !h.CanReassign)).toBe(true);
        expect(result.Holdings[0].Note).toMatch(/supervisor or a Sales Admin/);
    });

    it('is INVALID_INPUT when neither id resolves', async () => {
        world();
        expect((await ListSalesOffboardingHoldings({}, caller())).Outcome).toBe('INVALID_INPUT');
        expect((await ListSalesOffboardingHoldings({ LeaverUserID: '99999999-0000-4000-8000-000000000009' }, caller())).Outcome).toBe('INVALID_INPUT');
        expect((await ListSalesOffboardingHoldings({ LeaverUserID: "x' OR 1=1 --" }, caller())).Outcome).toBe('INVALID_INPUT');
    });
});

describe('Sales.ReassignOffboardingHoldings', () => {
    const admin = caller({ roles: ['Sales Admin'] });

    it('moves every open item to the successor through each entity, the deal owner through SetOwner', async () => {
        world();
        const result = await ReassignSalesOffboardingHoldings({ LeaverUserID: LEAVER_USER, SuccessorUserID: NEXT_USER }, PROVIDER, admin);
        expect(result).toMatchObject({ Outcome: 'SUCCESS', Moved: 5, Skipped: [] });
        const saved = (entity: string) => FakeEntity.Saved.find((s) => s.Entity === entity);
        expect(saved('MJ_BizApps_Sales: Deals')).toMatchObject({ ID: D_OPEN, Owner: NEXT_EMP, Values: {} });
        expect(saved('MJ_BizApps_Sales: Deal Team Members')).toMatchObject({ ID: TM_SE_OPEN, Values: { EmployeeID: NEXT_EMP } });
        expect(saved('MJ_BizApps_Sales: Sales Accounts')?.Values).toEqual({ OwnerEmployeeID: NEXT_EMP });
        expect(saved('MJ_BizApps_Sales: Sales Contacts')?.Values).toEqual({ OwnerEmployeeID: NEXT_EMP });
        expect(saved('MJ_BizApps_Sales: Pipelines')?.Values).toEqual({ CloseWonAssigneePersonID: NEXT_PERSON });
        expect(FakeEntity.Saved.some((s) => s.ID === D_WON || s.ID === 'tm-se-won')).toBe(false);
    });

    it('reports a refused save as skipped with the entity\'s message, and moves the rest', async () => {
        world();
        FakeEntity.Refuse.add('acct-1');
        const result = await ReassignSalesOffboardingHoldings({ LeaverUserID: LEAVER_USER, SuccessorUserID: NEXT_USER }, PROVIDER, admin);
        expect(result.Outcome).toBe('SUCCESS');
        expect(result.Moved).toBe(4);
        expect(result.Skipped).toEqual([
            { Kind: 'ACCOUNT_OWNER', EntityName: 'MJ_BizApps_Sales: Sales Accounts', RecordID: 'acct-1', Reason: 'You do not have permission to update this record.' },
        ]);
    });

    it('skips a team seat the successor already holds on that deal, instead of colliding in the database', async () => {
        world({ successorHoldsSE: true });
        const result = await ReassignSalesOffboardingHoldings({ LeaverUserID: LEAVER_USER, SuccessorUserID: NEXT_USER }, PROVIDER, admin);
        expect(result.Moved).toBe(4);
        expect(result.Skipped).toEqual([expect.objectContaining({ Kind: 'DEAL_TEAM_MEMBER', RecordID: TM_SE_OPEN, Reason: expect.stringMatching(/already holds this role/) })]);
    });

    it('moves only the requested kinds and records', async () => {
        world();
        const result = await ReassignSalesOffboardingHoldings(
            { LeaverUserID: LEAVER_USER, SuccessorUserID: NEXT_USER, Kinds: ['CONTACT_OWNER', 'ACCOUNT_OWNER'], RecordIDs: ['ct-1'] },
            PROVIDER,
            admin,
        );
        expect(result.Moved).toBe(1);
        expect(FakeEntity.Saved.map((s) => s.ID)).toEqual(['ct-1']);
    });

    it('is NOT_AUTHORIZED for a caller who is neither the supervisor nor a Sales Admin, and saves nothing', async () => {
        world();
        const result = await ReassignSalesOffboardingHoldings({ LeaverUserID: LEAVER_USER, SuccessorUserID: NEXT_USER }, PROVIDER, caller({ employeeID: NEXT_EMP }));
        expect(result.Outcome).toBe('NOT_AUTHORIZED');
        expect(FakeEntity.Saved).toHaveLength(0);
    });

    it('lets the supervisor move them', async () => {
        world();
        const result = await ReassignSalesOffboardingHoldings({ LeaverEmployeeID: LEAVER_EMP, SuccessorUserID: NEXT_USER }, PROVIDER, caller({ employeeID: BOSS_EMP }));
        expect(result).toMatchObject({ Outcome: 'SUCCESS', Moved: 5 });
    });

    it.each([
        ['no successor', {}, /required/],
        ['an inactive successor', { successorActive: false }, /not an active user/],
        ['a successor with no Employee', { successorEmployee: null }, /no Employee record/],
    ])('is INVALID_INPUT for %s', async (_label, opts, message) => {
        world(opts);
        const successor = _label === 'no successor' ? null : NEXT_USER;
        const result = await ReassignSalesOffboardingHoldings({ LeaverUserID: LEAVER_USER, SuccessorUserID: successor }, PROVIDER, admin);
        expect(result.Outcome).toBe('INVALID_INPUT');
        expect(result.Message).toMatch(message);
        expect(FakeEntity.Saved).toHaveLength(0);
    });

    it('is INVALID_INPUT when the successor is the leaver', async () => {
        world();
        const result = await ReassignSalesOffboardingHoldings({ LeaverUserID: LEAVER_USER, SuccessorUserID: LEAVER_USER }, PROVIDER, admin);
        expect(result).toMatchObject({ Outcome: 'INVALID_INPUT', Message: 'The successor is the leaver.' });
    });
});
