/**
 * The digest run: the deal query, the From address, and the orchestration that ties them to selection
 * and rendering.
 *
 * WHAT EACH AREA GUARDS.
 *
 * LoadLapsedDeals owns the one rule the whole feature turns on: which deals are "lapsed". Four of its
 * tests pin a clause of the filter string because a `RunView` double cannot evaluate SQL, so the string
 * IS the behaviour.
 *   - `IsClosed = 0`, never `IsOpen = 1`. On Hold is neither open nor closed, and an `IsOpen = 1` filter
 *     would drop every On Hold deal, the ones most likely to carry a stale close date.
 *   - `IS NULL OR` on the status, so a deal with no status at all is not silently excluded by an `IN`.
 *   - `<`, never `<=`. A deal whose close date IS today is not lapsed; it appearing in Monday's digest
 *     is the single most likely user-visible defect here. (ComputeDaysLapsed clamps to 0 for a date in
 *     the future but cannot rescue a row the query already returned.)
 *   - Excluded pipelines. Both dev pipelines have IncludeInForecast = 1, so no dev row would ever
 *     exercise the exclusion; the test constructs the excluded case.
 * Truncation is checked two ways, because a `RunView` is also capped by the entity's UserViewMaxRows
 * (1000 by default): a request for 5000 rows can come back as 1000 with no error. Asking for MaxRows and
 * comparing the count to it would never notice, so `TotalRowCount` is compared as well.
 *
 * ResolveSender has two shapes to keep apart. `DefaultSenderForCompany` returns `{ from, fromName }`;
 * the digest's own type is `{ From, FromName }`. With `strict` off, handing one over as the other
 * compiles and yields `undefined` for From, and the first symptom would be a send with no From address.
 * The mapped From is asserted non-empty. `DigestFromAddress` ships with an EMPTY value, so "not
 * configured" arrives as "" or undefined, and `"" ?? null` is "": blank-after-trim is unset (the same
 * trap was a confirmed bug twice on this branch, in the Explorer base URL and in the audience templates).
 *
 * RunLapsedCloseDateDigest is tested through the real LoadLapsedDeals / LoadDigestRecipients / selection
 * / rendering with only the edges stubbed: `RunView`, the three engines, and `RunAction`. The call to
 * `RunAction` is asserted as a `RunActionParams` INSTANCE (it is a class, not an interface), with
 * `Filters: []` (declared non-optional though documented optional) and `SkipActionLog` unset (the
 * execution log is how anyone later answers "did Monday's run actually send").
 *
 * "Today" is pinned to Monday 2026-11-23, with closes on 2026-11-03 (20 days), 2026-11-20 (3 days) and
 * 2026-11-01 (22 days). Fixtures are fictional.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Metadata, RunView, type RunViewParams, type UserInfo } from '@memberjunction/core';
import { ApplicationSettingEngine } from '@memberjunction/core-entities';
import { ActionEngineServer } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { LoadLapsedDeals, MAX_DEALS_PER_RUN } from '../digest/lapsed-deals.js';
import { ResolveSender } from '../digest/sender.js';
import { RunLapsedCloseDateDigest } from '../digest/run.js';

const TODAY = '2026-11-23';
const user = { ID: 'user-1', Name: 'Test User' } as unknown as UserInfo;
const SALES_APP_ID = 'app-sales';

// ── RunView double ───────────────────────────────────────────────────────────────────────────────────

interface World {
    notClosedStatusIDs: string[];
    excludedPipelineIDs: string[];
    deals: Array<Record<string, unknown>>;
    dealsTotalRowCount?: number;
    dealsFail?: boolean;
    employees: Array<Record<string, unknown>>;
    audiences: Array<Record<string, unknown>>;
    recipients: Array<Record<string, unknown>>;
    identities: Array<Record<string, unknown>>;
    actions: Array<Record<string, unknown>>;
}

function emptyWorld(over: Partial<World> = {}): World {
    return {
        notClosedStatusIDs: ['st-open', 'st-hold'], excludedPipelineIDs: [], deals: [], employees: [],
        audiences: [], recipients: [], identities: [], actions: [{ ID: 'act-send' }], ...over,
    };
}

/** The IDs named in an `ID IN ('a', 'b''c')` filter, unescaped. */
function idsIn(filter: string): string[] {
    return [...filter.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
}

/** Answers each entity from the world and records every call, so a test can read exactly what was asked. */
function stubRunView(world: World): RunViewParams[] {
    const calls: RunViewParams[] = [];
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation((async (p: RunViewParams) => {
        calls.push(p);
        const ok = (Results: unknown[], extra: Record<string, unknown> = {}) =>
            ({ Success: true, Results, TotalRowCount: Results.length, ...extra });
        switch (p.EntityName) {
            case 'MJ_BizApps_Sales: Deal Status Types':
                return ok(world.notClosedStatusIDs.map((ID) => ({ ID })));
            case 'MJ_BizApps_Sales: Pipelines':
                return ok(world.excludedPipelineIDs.map((ID) => ({ ID })));
            case 'MJ_BizApps_Sales: Deals':
                if (world.dealsFail) return { Success: false, ErrorMessage: 'deadlock victim', Results: [] };
                return ok(world.deals, world.dealsTotalRowCount === undefined ? {} : { TotalRowCount: world.dealsTotalRowCount });
            case 'MJ: Employees': {
                // Both the recipient join and the owner lookup read employees by ID list.
                const wanted = idsIn(p.ExtraFilter ?? '');
                return ok(world.employees.filter((e) => wanted.includes(String(e.ID))));
            }
            case 'MJ_BizApps_Sales: Deal Digest Audience Types':
                return ok(world.audiences);
            case 'MJ_BizApps_Sales: Deal Digest Recipients':
                return ok(world.recipients);
            case 'MJ_BizApps_Common: Company Sender Identities':
                return ok(world.identities);
            case 'MJ: Actions':
                return ok(world.actions);
            default:
                throw new Error(`unexpected RunView on ${p.EntityName}`);
        }
    }) as never);
    return calls;
}

const callsOn = (calls: RunViewParams[], entity: string) => calls.filter((c) => c.EntityName === entity);

/** The engines and settings the run touches, stubbed at the edge. */
function stubEngines(settings: Record<string, string | undefined> = {}) {
    vi.spyOn(Metadata.prototype, 'Applications', 'get').mockReturnValue([{ ID: SALES_APP_ID, Name: 'Sales' }] as never);
    const settingsConfig = vi.spyOn(ApplicationSettingEngine.Instance, 'Config').mockResolvedValue(undefined);
    const getSetting = vi.spyOn(ApplicationSettingEngine.Instance, 'GetSetting').mockImplementation(
        ((name: string, appId?: string) => (appId === SALES_APP_ID ? settings[name] : undefined)) as never);
    vi.spyOn(BusinessTimeZoneEngine.Instance, 'Config').mockResolvedValue(undefined);
    const today = vi.spyOn(BusinessTimeZoneEngine.Instance, 'Today').mockReturnValue(TODAY);
    const actionConfig = vi.spyOn(ActionEngineServer.Instance, 'Config').mockResolvedValue(undefined);
    const runAction = vi.spyOn(ActionEngineServer.Instance, 'RunAction')
        .mockResolvedValue({ Success: true, Message: 'sent' } as never);
    return { settingsConfig, getSetting, today, actionConfig, runAction };
}

const dealRow = (over: Record<string, unknown> = {}) => ({
    ID: 'deal-1', Name: 'Widget renewal', CompanyID: 'co-1', Company: 'Acme Test Co',
    OwnerEmployeeID: 'emp-owner', Amount: 12000, ExpectedCloseDate: '2026-11-03', PipelineStage: 'Proposal', ...over,
});

const ownerRow = (over: Record<string, unknown> = {}) =>
    ({ ID: 'emp-owner', FirstName: 'Olive', LastName: 'Owner', Email: 'olive@example.invalid', ...over });

// ── LoadLapsedDeals ──────────────────────────────────────────────────────────────────────────────────

describe('LoadLapsedDeals', () => {
    afterEach(() => vi.restoreAllMocks());

    const dealsFilter = (calls: RunViewParams[]): string => callsOn(calls, 'MJ_BizApps_Sales: Deals')[0].ExtraFilter;

    it('asks for not-closed status types with IsClosed = 0, never IsOpen = 1, so On Hold deals are included', async () => {
        const calls = stubRunView(emptyWorld());
        await LoadLapsedDeals(user, TODAY);
        const status = callsOn(calls, 'MJ_BizApps_Sales: Deal Status Types');
        expect(status).toHaveLength(1);
        expect(status[0].ExtraFilter).toBe('IsClosed = 0');
        expect(JSON.stringify(calls)).not.toContain('IsOpen');
        expect(dealsFilter(calls)).toContain("DealStatusTypeID IN ('st-open', 'st-hold')");
    });

    it('treats a null DealStatusTypeID as not closed', async () => {
        const calls = stubRunView(emptyWorld());
        await LoadLapsedDeals(user, TODAY);
        expect(dealsFilter(calls)).toContain('(DealStatusTypeID IS NULL OR DealStatusTypeID IN (');
    });

    it('still builds a valid filter when no status type is open (only the null branch remains)', async () => {
        const calls = stubRunView(emptyWorld({ notClosedStatusIDs: [] }));
        await LoadLapsedDeals(user, TODAY);
        const filter = dealsFilter(calls);
        expect(filter).toContain('DealStatusTypeID IS NULL');
        expect(filter).not.toContain('IN ()');
    });

    it('excludes pipelines with IncludeInForecast = 0', async () => {
        const calls = stubRunView(emptyWorld({ excludedPipelineIDs: ['pl-sandbox', 'pl-archive'] }));
        await LoadLapsedDeals(user, TODAY);
        expect(callsOn(calls, 'MJ_BizApps_Sales: Pipelines')[0].ExtraFilter).toBe('IncludeInForecast = 0');
        expect(dealsFilter(calls)).toContain("PipelineID NOT IN ('pl-sandbox', 'pl-archive')");
    });

    it('adds no pipeline clause when nothing is excluded', async () => {
        const calls = stubRunView(emptyWorld());
        await LoadLapsedDeals(user, TODAY);
        expect(dealsFilter(calls)).not.toContain('PipelineID');
    });

    it('compares the close date with < and not <=, so a deal closing today is not lapsed', async () => {
        const calls = stubRunView(emptyWorld());
        await LoadLapsedDeals(user, TODAY);
        const filter = dealsFilter(calls);
        expect(filter).toContain(`ExpectedCloseDate < '${TODAY}'`);
        expect(filter).not.toContain('<=');
    });

    it('also takes a deal whose close date was never set', async () => {
        const calls = stubRunView(emptyWorld());
        await LoadLapsedDeals(user, TODAY);
        expect(dealsFilter(calls)).toContain(`(ExpectedCloseDate IS NULL OR ExpectedCloseDate < '${TODAY}')`);
    });

    it('builds exactly this filter, so a reviewer can read the SQL', async () => {
        const calls = stubRunView(emptyWorld({ excludedPipelineIDs: ['pl-sandbox'] }));
        await LoadLapsedDeals(user, TODAY);
        expect(dealsFilter(calls)).toBe(
            "(DealStatusTypeID IS NULL OR DealStatusTypeID IN ('st-open', 'st-hold'))"
            + " AND PipelineID NOT IN ('pl-sandbox')"
            + ` AND (ExpectedCloseDate IS NULL OR ExpectedCloseDate < '${TODAY}')`);
    });

    it('escapes every interpolated value, including IDs read from the database', async () => {
        const calls = stubRunView(emptyWorld({
            notClosedStatusIDs: ["st'1"], excludedPipelineIDs: ["pl'1"], deals: [dealRow({ OwnerEmployeeID: "emp'1" })],
        }));
        await LoadLapsedDeals(user, TODAY);
        const filter = dealsFilter(calls);
        expect(filter).toContain("'st''1'");
        expect(filter).toContain("'pl''1'");
        expect(callsOn(calls, 'MJ: Employees')[0].ExtraFilter).toContain("'emp''1'");
    });

    it('escapes the date too, though a real CalendarDay never needs it', async () => {
        const calls = stubRunView(emptyWorld()); // no deals, so the odd "day" is never parsed
        await LoadLapsedDeals(user, "2026-11-23' OR 1=1 --");
        expect(dealsFilter(calls)).toContain("ExpectedCloseDate < '2026-11-23'' OR 1=1 --'");
    });

    it('requests MAX_DEALS_PER_RUN rows, ordered by company then close date, and never skips the row count', async () => {
        const calls = stubRunView(emptyWorld());
        await LoadLapsedDeals(user, TODAY);
        const p = callsOn(calls, 'MJ_BizApps_Sales: Deals')[0];
        expect(MAX_DEALS_PER_RUN).toBe(5000);
        expect(p.MaxRows).toBe(MAX_DEALS_PER_RUN);
        expect(p.OrderBy).toBe('Company, ExpectedCloseDate');
        expect(p.ResultType).toBe('simple');
        // TotalRowCount is what detects the entity's own row cap; skipping it would blind that check.
        expect(p.SkipTotalRowCount).toBeUndefined();
    });

    it('never reads DealTeamMember: the owner is Deal.OwnerEmployeeID, and a join triple-counts', async () => {
        const calls = stubRunView(emptyWorld({ deals: [dealRow()], employees: [ownerRow()] }));
        await LoadLapsedDeals(user, TODAY);
        expect(JSON.stringify(calls)).not.toContain('Team');
    });

    it('maps a row, taking the owner name from one batched employee read', async () => {
        const calls = stubRunView(emptyWorld({
            deals: [dealRow(), dealRow({ ID: 'deal-2', Name: 'Gadget', ExpectedCloseDate: '2026-11-20' })],
            employees: [ownerRow()],
        }));
        const { Deals, Truncated } = await LoadLapsedDeals(user, TODAY);
        expect(Truncated).toBe(false);
        expect(Deals).toEqual([
            {
                ID: 'deal-1', Name: 'Widget renewal', CompanyID: 'co-1', CompanyName: 'Acme Test Co',
                OwnerName: 'Olive Owner', Amount: 12000, ExpectedCloseDate: '2026-11-03', DaysLapsed: 20, StageName: 'Proposal',
            },
            expect.objectContaining({ ID: 'deal-2', ExpectedCloseDate: '2026-11-20', DaysLapsed: 3 }),
        ]);
        expect(callsOn(calls, 'MJ: Employees')).toHaveLength(1);
    });

    it('keeps a deal with no close date, with a null date and a null DaysLapsed', async () => {
        stubRunView(emptyWorld({ deals: [dealRow({ ExpectedCloseDate: null })], employees: [ownerRow()] }));
        const { Deals } = await LoadLapsedDeals(user, TODAY);
        expect(Deals[0].ExpectedCloseDate).toBeNull();
        expect(Deals[0].DaysLapsed).toBeNull();
    });

    it('keeps a null amount null rather than turning it into zero', async () => {
        stubRunView(emptyWorld({ deals: [dealRow({ Amount: null })], employees: [ownerRow()] }));
        expect((await LoadLapsedDeals(user, TODAY)).Deals[0].Amount).toBeNull();
    });

    it('reads a close date that arrives as a Date, as a DATE column can', async () => {
        stubRunView(emptyWorld({
            deals: [dealRow({ ExpectedCloseDate: new Date(Date.UTC(2026, 10, 3)) })], employees: [ownerRow()],
        }));
        const { Deals } = await LoadLapsedDeals(user, TODAY);
        expect(Deals[0].ExpectedCloseDate).toBe('2026-11-03');
        expect(Deals[0].DaysLapsed).toBe(20);
    });

    it('shows an unowned deal, or one whose owner is not found, as Unassigned', async () => {
        stubRunView(emptyWorld({
            deals: [dealRow({ OwnerEmployeeID: null }), dealRow({ ID: 'deal-2', OwnerEmployeeID: 'emp-gone' })],
            employees: [ownerRow()],
        }));
        const { Deals } = await LoadLapsedDeals(user, TODAY);
        expect(Deals.map((d) => d.OwnerName)).toEqual(['Unassigned', 'Unassigned']);
    });

    it('reads no employees when there are no deals', async () => {
        const calls = stubRunView(emptyWorld());
        expect(await LoadLapsedDeals(user, TODAY)).toEqual({ Deals: [], Truncated: false });
        expect(callsOn(calls, 'MJ: Employees')).toHaveLength(0);
    });

    it('reports Truncated when the result count reaches MAX_DEALS_PER_RUN', async () => {
        const rows = Array.from({ length: MAX_DEALS_PER_RUN }, (_, i) => dealRow({ ID: `deal-${i}` }));
        stubRunView(emptyWorld({ deals: rows, employees: [ownerRow()] }));
        const out = await LoadLapsedDeals(user, TODAY);
        expect(out.Deals).toHaveLength(MAX_DEALS_PER_RUN);
        expect(out.Truncated).toBe(true);
    });

    it('reports Truncated when TotalRowCount exceeds the returned count, even far below MAX_DEALS_PER_RUN', async () => {
        // The entity's own UserViewMaxRows capped the read at 1000: no error, and a count nowhere near 5000.
        const rows = Array.from({ length: 1000 }, (_, i) => dealRow({ ID: `deal-${i}` }));
        stubRunView(emptyWorld({ deals: rows, dealsTotalRowCount: 1340, employees: [ownerRow()] }));
        const out = await LoadLapsedDeals(user, TODAY);
        expect(out.Deals).toHaveLength(1000);
        expect(out.Truncated).toBe(true);
    });

    it('is not truncated when the count is below the cap and equals TotalRowCount', async () => {
        stubRunView(emptyWorld({ deals: [dealRow()], dealsTotalRowCount: 1, employees: [ownerRow()] }));
        expect((await LoadLapsedDeals(user, TODAY)).Truncated).toBe(false);
    });

    it('throws, naming the reason, when the deal read fails, so a broken read cannot pass for "nothing lapsed"', async () => {
        stubRunView(emptyWorld({ dealsFail: true }));
        await expect(LoadLapsedDeals(user, TODAY)).rejects.toThrow(/deadlock victim/);
    });
});

// ── ResolveSender ────────────────────────────────────────────────────────────────────────────────────

describe('ResolveSender', () => {
    afterEach(() => vi.restoreAllMocks());

    const mailbox = (over: Record<string, unknown> = {}) => ({
        CompanyID: 'co-1', Kind: 'Mailbox', Address: 'digest@acme.example.invalid', DisplayName: 'Acme Digest', IsDefault: true, ...over,
    });

    it('prefers the company Mailbox identity, mapping the lowercase pair to the PascalCase one', async () => {
        stubRunView(emptyWorld({ identities: [mailbox()] }));
        stubEngines({ DigestFromAddress: 'fallback@example.invalid' });
        const sender = await ResolveSender('co-1', user);
        expect(sender).toEqual({ From: 'digest@acme.example.invalid', FromName: 'Acme Digest' });
        // The failure this guards: passing { from } through yields From === undefined, and it compiles.
        expect(sender.From).toBeTruthy();
    });

    it("reads only that company's identities, with the ID escaped", async () => {
        const calls = stubRunView(emptyWorld({ identities: [mailbox({ CompanyID: "co'1" })] }));
        stubEngines();
        await ResolveSender("co'1", user);
        expect(callsOn(calls, 'MJ_BizApps_Common: Company Sender Identities')[0].ExtraFilter).toBe("CompanyID = 'co''1'");
    });

    it('falls back to the DigestFromAddress setting when the company has no default mailbox', async () => {
        stubRunView(emptyWorld({ identities: [mailbox({ IsDefault: false })] }));
        stubEngines({ DigestFromAddress: 'fallback@example.invalid' });
        expect(await ResolveSender('co-1', user)).toEqual({ From: 'fallback@example.invalid', FromName: null });
    });

    it('uses the DigestFromAddress setting for a portfolio audience, without reading any identity', async () => {
        const calls = stubRunView(emptyWorld({ identities: [mailbox()] }));
        stubEngines({ DigestFromAddress: '  portfolio@example.invalid  ' });
        expect(await ResolveSender(null, user)).toEqual({ From: 'portfolio@example.invalid', FromName: null });
        expect(callsOn(calls, 'MJ_BizApps_Common: Company Sender Identities')).toHaveLength(0);
    });

    it('returns null when neither a mailbox nor a setting resolves', async () => {
        stubRunView(emptyWorld());
        stubEngines();
        expect(await ResolveSender('co-1', user)).toBeNull();
        expect(await ResolveSender(null, user)).toBeNull();
    });

    it.each([['an empty string (what the row ships with)', ''], ['whitespace', '   \t'], ['undefined', undefined]])(
        'treats DigestFromAddress as unset when it is %s',
        async (_label, value) => {
            stubRunView(emptyWorld());
            stubEngines({ DigestFromAddress: value });
            expect(await ResolveSender(null, user)).toBeNull();
        });

    it('reads the setting scoped to the Sales application, after loading the engine', async () => {
        stubRunView(emptyWorld());
        const { settingsConfig, getSetting } = stubEngines({ DigestFromAddress: 'x@example.invalid' });
        await ResolveSender(null, user);
        expect(settingsConfig).toHaveBeenCalled();
        expect(getSetting).toHaveBeenCalledWith('DigestFromAddress', SALES_APP_ID);
    });

    it('throws when the identity read fails, rather than falling back past a broken read', async () => {
        vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({ Success: false, ErrorMessage: 'timeout', Results: [] } as never);
        stubEngines({ DigestFromAddress: 'fallback@example.invalid' });
        await expect(ResolveSender('co-1', user)).rejects.toThrow(/timeout/);
    });
});

// ── RunLapsedCloseDateDigest ─────────────────────────────────────────────────────────────────────────

const audienceRow = (over: Record<string, unknown>) => ({
    ID: 'aud-x', Code: 'X', Name: 'X', IsPortfolioWide: false, MinDaysLapsed: null, IncludeMissingCloseDate: true,
    SendWhenEmpty: false, GroupByCompany: false, SubjectTemplate: null, IntroTemplate: null, EmptyMessage: null,
    DisplayRank: 10, ...over,
});

const LEADER = audienceRow({ ID: 'aud-leader', Code: 'COMPANY_LEADER', Name: 'Company Leader', DisplayRank: 10 });
const CEO = audienceRow({
    ID: 'aud-ceo', Code: 'CEO', Name: 'CEO', IsPortfolioWide: true, MinDaysLapsed: 14, SendWhenEmpty: true,
    GroupByCompany: true, DisplayRank: 20,
});
const CTO = audienceRow({
    ID: 'aud-cto', Code: 'CTO', Name: 'CTO', IsPortfolioWide: true, MinDaysLapsed: 14, SendWhenEmpty: false,
    GroupByCompany: true, DisplayRank: 30,
});

const recipientRow = (audience: string, company: string | null, employee: string) =>
    ({ DealDigestAudienceTypeID: audience, CompanyID: company, EmployeeID: employee });
const employeeRow = (id: string, first: string, email: string) =>
    ({ ID: id, FirstName: first, LastName: 'Example', Email: email });
const mailboxFor = (company: string, address: string) =>
    ({ CompanyID: company, Kind: 'Mailbox', Address: address, DisplayName: `${company} sender`, IsDefault: true });

/** Two companies: co-1 has a 20-day and a 3-day deal, co-2 a 22-day one. Four recipients, one per audience row. */
function runWorld(over: Partial<World> = {}): World {
    return emptyWorld({
        audiences: [LEADER, CEO, CTO],
        recipients: [
            recipientRow('aud-leader', 'co-1', 'emp-l1'),
            recipientRow('aud-leader', 'co-2', 'emp-l2'),
            recipientRow('aud-ceo', null, 'emp-ceo'),
            recipientRow('aud-cto', null, 'emp-cto'),
        ],
        employees: [
            employeeRow('emp-l1', 'Lee', 'lee@example.invalid'),
            employeeRow('emp-l2', 'Lou', 'lou@example.invalid'),
            employeeRow('emp-ceo', 'Cleo', 'cleo@example.invalid'),
            employeeRow('emp-cto', 'Cato', 'cato@example.invalid'),
            ownerRow(),
        ],
        deals: [
            dealRow({ ID: 'd-20', Name: 'Twenty days', ExpectedCloseDate: '2026-11-03' }),
            dealRow({ ID: 'd-3', Name: 'Three days', ExpectedCloseDate: '2026-11-20' }),
            dealRow({ ID: 'd-22', Name: 'Other company', CompanyID: 'co-2', Company: 'Zed Test Co', ExpectedCloseDate: '2026-11-01' }),
        ],
        identities: [mailboxFor('co-1', 'digest@acme.example.invalid'), mailboxFor('co-2', 'digest@zed.example.invalid')],
        ...over,
    });
}

const PORTFOLIO = { DigestFromAddress: 'portfolio@example.invalid' };
const toOf = (p: RunActionParams): string => String(p.Params.find((x) => x.Name === 'To').Value);
const paramOf = (p: RunActionParams, name: string): unknown => p.Params.find((x) => x.Name === name).Value;

describe('RunLapsedCloseDateDigest', () => {
    afterEach(() => vi.restoreAllMocks());

    function setup(world: World = runWorld(), settings: Record<string, string | undefined> = PORTFOLIO) {
        const calls = stubRunView(world);
        return { calls, ...stubEngines(settings) };
    }

    it('resolves today with BusinessTimeZoneEngine.Today() and no company, once for the whole run', async () => {
        const { today } = setup();
        await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(today).toHaveBeenCalledTimes(1);
        expect(today).toHaveBeenCalledWith();
    });

    it('sends nothing and reports failure when no sender resolves, naming the recipient', async () => {
        const { runAction } = setup(runWorld({ identities: [] }), { DigestFromAddress: '' });
        const out = await RunLapsedCloseDateDigest(user);
        expect(runAction).not.toHaveBeenCalled();
        expect(out.Success).toBe(false);
        expect(out.Sent).toBe(0);
        expect(out.Errors.some((e) => e.includes('lee@example.invalid'))).toBe(true);
        expect(out.Errors.some((e) => e.includes('cleo@example.invalid'))).toBe(true);
    });

    it('treats a blank-after-trim DigestFromAddress as unset: the portfolio digests fail, the company ones still send', async () => {
        const { runAction } = setup(runWorld(), { DigestFromAddress: '   ' });
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(false);
        // Leaders have a company mailbox; the CEO and CTO have deals but nothing to send from.
        expect(out.Sent).toBe(2);
        expect(runAction).toHaveBeenCalledTimes(2);
        expect(out.Errors).toHaveLength(2);
        expect(out.Errors.join('\n')).toContain('cleo@example.invalid');
        expect(out.Errors.join('\n')).toContain('cato@example.invalid');
    });

    it('skips a company-leader digest when that company has nothing lapsed', async () => {
        const { runAction } = setup(runWorld({ deals: [dealRow({ ID: 'd-20' })] })); // co-1 only
        const out = await RunLapsedCloseDateDigest(user);
        // co-2's leader is skipped; co-1's leader, the CEO and the CTO each have the 20-day deal.
        expect(out.SkippedEmpty).toBe(1);
        expect(out.Sent).toBe(3);
        expect(runAction).toHaveBeenCalledTimes(3);
        expect(out.Success).toBe(true);
    });

    it('sends an all-clear when the audience has SendWhenEmpty', async () => {
        // 3 days lapsed is under the 14-day floor, so the CEO has nothing.
        const { runAction } = setup(runWorld({ deals: [dealRow({ ExpectedCloseDate: '2026-11-20' })] }));
        const out = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        const ceo = out.RenderedEmails.find((e) => e.AudienceCode === 'CEO');
        expect(ceo).toBeDefined();
        expect(ceo.BodyHtml).toContain('No open deals have a lapsed close date');
        expect(runAction.mock.calls.map(([p]) => toOf(p))).toContain('cleo@example.invalid');
    });

    it('sends nothing for an empty audience without SendWhenEmpty (the CTO case)', async () => {
        const { runAction } = setup(runWorld({ deals: [dealRow({ ExpectedCloseDate: '2026-11-20' })] }));
        const out = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        expect(out.RenderedEmails.some((e) => e.AudienceCode === 'CTO')).toBe(false);
        expect(runAction.mock.calls.map(([p]) => toOf(p))).not.toContain('cato@example.invalid');
        expect(out.SkippedEmpty).toBe(2); // the CTO, and co-2's leader
    });

    it('continues after one failed send and reports both', async () => {
        const { runAction } = setup();
        runAction
            .mockResolvedValueOnce({ Success: true, Message: 'ok' } as never)
            .mockResolvedValueOnce({ Success: false, Message: 'mailbox unavailable' } as never)
            .mockResolvedValue({ Success: true, Message: 'ok' } as never);
        const out = await RunLapsedCloseDateDigest(user);
        expect(runAction).toHaveBeenCalledTimes(4);
        expect(out.Sent).toBe(3);
        expect(out.Success).toBe(false);
        expect(out.Errors).toHaveLength(1);
        expect(out.Errors[0]).toContain('lou@example.invalid');
        expect(out.Errors[0]).toContain('mailbox unavailable');
    });

    it('treats a send that throws as a failed send, and carries on', async () => {
        const { runAction } = setup();
        runAction.mockRejectedValueOnce(new Error('socket hang up')).mockResolvedValue({ Success: true } as never);
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Sent).toBe(3);
        expect(out.Errors).toHaveLength(1);
        expect(out.Errors[0]).toContain('socket hang up');
    });

    it('looks the send action up once per run by DriverClass __SendSingleMessage', async () => {
        const { calls, actionConfig } = setup();
        await RunLapsedCloseDateDigest(user);
        const lookups = callsOn(calls, 'MJ: Actions');
        expect(lookups).toHaveLength(1);
        expect(lookups[0].ExtraFilter).toContain("DriverClass = '__SendSingleMessage'");
        expect(actionConfig).toHaveBeenCalledTimes(1);
    });

    it('passes To, From, Subject, Body, Provider and MessageType on every call, as a RunActionParams', async () => {
        const { runAction } = setup();
        await RunLapsedCloseDateDigest(user);
        expect(runAction).toHaveBeenCalledTimes(4);
        for (const [p] of runAction.mock.calls) {
            // RunActionParams is a class: an object literal would compile and still not be one.
            expect(p).toBeInstanceOf(RunActionParams);
            expect(p.Action).toEqual({ ID: 'act-send' });
            expect(p.ContextUser).toBe(user);
            expect(p.Filters).toEqual([]);
            expect(p.SkipActionLog).toBeUndefined();
            expect(p.Params.map((x) => x.Name).sort()).toEqual(['Body', 'From', 'MessageType', 'Provider', 'Subject', 'To']);
            for (const x of p.Params) {
                expect(x.Type).toBe('Input');
                expect(String(x.Value).trim()).not.toBe('');
            }
            expect(paramOf(p, 'MessageType')).toBe('Email');
        }
    });

    it('sends From the mapped, non-empty address: the company mailbox for a leader, the setting for the CEO', async () => {
        const { runAction } = setup();
        await RunLapsedCloseDateDigest(user);
        const fromByTo = new Map(runAction.mock.calls.map(([p]) => [toOf(p), String(paramOf(p, 'From'))]));
        expect(fromByTo.get('lee@example.invalid')).toBe('digest@acme.example.invalid');
        expect(fromByTo.get('lou@example.invalid')).toBe('digest@zed.example.invalid');
        expect(fromByTo.get('cleo@example.invalid')).toBe('portfolio@example.invalid');
        for (const from of fromByTo.values()) expect(from).toBeTruthy();
    });

    it('dryRun renders everything and calls RunAction zero times, without loading the action at all', async () => {
        const { calls, runAction, actionConfig } = setup();
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(runAction).not.toHaveBeenCalled();
        expect(actionConfig).not.toHaveBeenCalled();
        expect(callsOn(calls, 'MJ: Actions')).toHaveLength(0);
        expect(out.Success).toBe(true);
        expect(out.Sent).toBe(0);
        expect(out.RenderedEmails.map((e) => e.To).sort()).toEqual(
            ['cato@example.invalid', 'cleo@example.invalid', 'lee@example.invalid', 'lou@example.invalid']);
        for (const e of out.RenderedEmails) {
            expect(e.From).toBeTruthy();
            expect(e.Subject).toBeTruthy();
            expect(e.BodyHtml).toContain('<table');
        }
    });

    it('dryRun still reports a missing From, so a setup problem shows before anything is sent', async () => {
        setup(runWorld({ identities: [] }), { DigestFromAddress: '' });
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(out.Success).toBe(false);
        expect(out.RenderedEmails).toHaveLength(0);
        expect(out.Errors.length).toBeGreaterThan(0);
    });

    it('captures rendered emails on a real send only when asked', async () => {
        setup();
        const quiet = await RunLapsedCloseDateDigest(user);
        expect(quiet.RenderedEmails).toHaveLength(0);
        vi.restoreAllMocks();
        setup();
        const loud = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        expect(loud.RenderedEmails).toHaveLength(4);
        expect(loud.Sent).toBe(4);
    });

    it('describes each rendered email by audience code and company name', async () => {
        setup();
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        const lee = out.RenderedEmails.find((e) => e.To === 'lee@example.invalid');
        expect(lee.AudienceCode).toBe('COMPANY_LEADER');
        expect(lee.CompanyName).toBe('Acme Test Co');
        expect(out.RenderedEmails.find((e) => e.To === 'cleo@example.invalid').AudienceCode).toBe('CEO');
    });

    it('recipientOverride reroutes every send while subjects still name the real audience and company', async () => {
        const { runAction } = setup(runWorld({
            audiences: [{ ...LEADER, SubjectTemplate: '{Company}: {Count} lapsed' }, CEO, CTO],
        }));
        const out = await RunLapsedCloseDateDigest(user, {
            captureRenderedEmails: true, recipientOverride: { name: 'Tess Tester', email: 'tess@example.invalid' },
        });
        expect(runAction).toHaveBeenCalledTimes(4);
        for (const [p] of runAction.mock.calls) expect(toOf(p)).toBe('tess@example.invalid');
        expect(out.RenderedEmails.every((e) => e.To === 'tess@example.invalid')).toBe(true);
        const acmeLeader = out.RenderedEmails.find((e) => e.AudienceCode === 'COMPANY_LEADER' && e.CompanyName === 'Acme Test Co');
        expect(acmeLeader.Subject).toBe('Acme Test Co: 2 lapsed');
        expect(acmeLeader.BodyHtml).toContain('Hi Tess Tester,');
        // The override changes who receives, not who it is from.
        expect(acmeLeader.From).toBe('digest@acme.example.invalid');
    });

    it('judges a deal closing today as not lapsed: the run asks the query for strictly earlier dates', async () => {
        const { calls } = setup();
        await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(callsOn(calls, 'MJ_BizApps_Sales: Deals')[0].ExtraFilter).toContain(`ExpectedCloseDate < '${TODAY}'`);
    });

    it('renders no links when ExplorerBaseUrl is blank-after-trim, and links when it is set', async () => {
        setup(runWorld(), { ...PORTFOLIO, ExplorerBaseUrl: '  ' });
        const blank = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(blank.RenderedEmails.length).toBeGreaterThan(0);
        expect(blank.RenderedEmails.every((e) => !e.BodyHtml.includes('href='))).toBe(true);
        vi.restoreAllMocks();
        setup(runWorld(), { ...PORTFOLIO, ExplorerBaseUrl: ' https://explorer.example.test/ ' });
        const set = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(set.RenderedEmails[0].BodyHtml).toContain('href="https://explorer.example.test/resource/record/');
    });

    it('reports the lapsed count and Truncated, from the one deal read', async () => {
        const { calls } = setup(runWorld({ dealsTotalRowCount: 9999 }));
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(out.TotalLapsedDeals).toBe(3);
        expect(out.Truncated).toBe(true);
        expect(callsOn(calls, 'MJ_BizApps_Sales: Deals')).toHaveLength(1);
    });

    it('reports failure and sends nothing when the deal read fails, naming the reason', async () => {
        const { runAction } = setup(runWorld({ dealsFail: true }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(false);
        expect(out.Sent).toBe(0);
        expect(runAction).not.toHaveBeenCalled();
        expect(out.Errors.join('\n')).toContain('deadlock victim');
    });

    it('reports failure and sends nothing when the send action cannot be found', async () => {
        const { runAction } = setup(runWorld({ actions: [] }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(false);
        expect(out.Sent).toBe(0);
        expect(runAction).not.toHaveBeenCalled();
        expect(out.Errors.join('\n')).toContain('__SendSingleMessage');
    });

    it('does not look the action up when there is nothing to send', async () => {
        const { calls } = setup(runWorld({
            deals: [], audiences: [CTO], recipients: [recipientRow('aud-cto', null, 'emp-cto')],
        }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(true);
        expect(out.SkippedEmpty).toBe(1);
        expect(callsOn(calls, 'MJ: Actions')).toHaveLength(0);
    });

    it('orders audiences by DisplayRank, whatever order they are read in', async () => {
        const { runAction } = setup(runWorld({ audiences: [CTO, CEO, LEADER] }));
        await RunLapsedCloseDateDigest(user);
        expect(runAction.mock.calls.map(([p]) => toOf(p))).toEqual(
            ['lee@example.invalid', 'lou@example.invalid', 'cleo@example.invalid', 'cato@example.invalid']);
    });
});
