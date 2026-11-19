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
 * / rendering with only the edges stubbed: `RunView`, the three engines, and
 * `CommunicationEngine.SendSingleMessage`.
 *
 * The digest does NOT send through MJ's `__SendSingleMessage` action. That action has no HTML parameter
 * (MJ#6761), so the body arrived as `Message.Body`, every provider chose `contentType: 'Text'`, and the
 * reader saw raw markup. The send is therefore asserted to set `HTMLBody` and to leave `Body` unset:
 * that pair is the whole reason a provider picks HTML, so a regression to either half breaks a test.
 *
 * "Today" is pinned to Monday 2026-11-23, with closes on 2026-11-03 (20 days), 2026-11-20 (3 days) and
 * 2026-11-01 (22 days). Fixtures are fictional.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Metadata, RunView, type RunViewParams, type UserInfo } from '@memberjunction/core';
import { ApplicationSettingEngine } from '@memberjunction/core-entities';
import { CommunicationEngine } from '@memberjunction/communication-engine';
import type { Message } from '@memberjunction/communication-types';
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
    providers: Array<Record<string, unknown>>;
    /** Accounting's currencies; `'fail'` answers Success false, `'throw'` raises, absent means accounting is not installed. */
    currencies?: Array<Record<string, unknown>> | 'fail' | 'throw';
}

/** The configured provider as `CommunicationEngine.Providers` exposes it: a name, and its message types. */
const MAIL_PROVIDER = { Name: 'Test Mail Provider', MessageTypes: [{ ID: 'pmt-email', Name: 'Email' }] };

function emptyWorld(over: Partial<World> = {}): World {
    return {
        notClosedStatusIDs: ['st-open', 'st-hold'], excludedPipelineIDs: [], deals: [], employees: [],
        audiences: [], recipients: [], identities: [], providers: [MAIL_PROVIDER], ...over,
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
            case 'MJ_BizApps_Accounting: Currencies':
                if (world.currencies === 'throw') throw new Error('Entity not found');
                if (world.currencies === 'fail') return { Success: false, ErrorMessage: 'no permission', Results: [] };
                return ok(world.currencies ?? []);
            default:
                throw new Error(`unexpected RunView on ${p.EntityName}`);
        }
    }) as never);
    return calls;
}

/** Makes `new Metadata().Entities` say whether accounting is installed. */
const stubInstalledEntities = (names: string[]) =>
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue(names.map((Name) => ({ Name })) as never);

const callsOn = (calls: RunViewParams[], entity: string) => calls.filter((c) => c.EntityName === entity);

/** The engines and settings the run touches, stubbed at the edge. */
function stubEngines(settings: Record<string, string | undefined> = {}, providers: Array<Record<string, unknown>> = [MAIL_PROVIDER]) {
    vi.spyOn(Metadata.prototype, 'Applications', 'get').mockReturnValue([{ ID: SALES_APP_ID, Name: 'Sales' }] as never);
    const settingsConfig = vi.spyOn(ApplicationSettingEngine.Instance, 'Config').mockResolvedValue(undefined);
    const getSetting = vi.spyOn(ApplicationSettingEngine.Instance, 'GetSetting').mockImplementation(
        ((name: string, appId?: string) => (appId === SALES_APP_ID ? settings[name] : undefined)) as never);
    vi.spyOn(BusinessTimeZoneEngine.Instance, 'Config').mockResolvedValue(undefined);
    const today = vi.spyOn(BusinessTimeZoneEngine.Instance, 'Today').mockReturnValue(TODAY);
    const commConfig = vi.spyOn(CommunicationEngine.Instance, 'Config').mockResolvedValue(undefined);
    const providerList = vi.spyOn(CommunicationEngine.Instance, 'Providers', 'get').mockReturnValue(providers as never);
    // On MessageResult, `Error` carries the failure text; `Message` is the processed message object.
    const sendMessage = vi.spyOn(CommunicationEngine.Instance, 'SendSingleMessage')
        .mockResolvedValue({ Success: true, Error: '' } as never);
    return { settingsConfig, getSetting, today, commConfig, providerList, sendMessage };
}

const dealRow = (over: Record<string, unknown> = {}) => ({
    ID: 'deal-1', Name: 'Widget renewal', CompanyID: 'co-1', Company: 'Acme Test Co',
    OwnerEmployeeID: 'emp-owner', Amount: 12000, CurrencyID: null, ExpectedCloseDate: '2026-11-03', PipelineStage: 'Proposal', ...over,
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
        // Never-set close dates LAST: SQL Server sorts NULLs first, and a dated deal is actionable by its age.
        expect(p.OrderBy).toBe('Company, CASE WHEN ExpectedCloseDate IS NULL THEN 1 ELSE 0 END, ExpectedCloseDate');
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
                OwnerName: 'Olive Owner', Amount: 12000, CurrencyID: null, ExpectedCloseDate: '2026-11-03', DaysLapsed: 20, StageName: 'Proposal',
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
    ID: 'aud-cto', Code: 'CTO', Name: 'CTO', IsPortfolioWide: true, MinDaysLapsed: 14, SendWhenEmpty: true,
    GroupByCompany: true, DisplayRank: 30,
});
/**
 * A portfolio-wide audience with SendWhenEmpty off. No shipped row looks like this — all three
 * portfolio audiences send their all-clear, and COMPANY_LEADER is the only one that stays quiet — so
 * the skip path on a portfolio audience needs an audience of its own to exercise it. A host adding
 * its own quiet portfolio row is exactly the case this covers.
 */
const QUIET = audienceRow({
    ID: 'aud-quiet', Code: 'QUIET', Name: 'Quiet portfolio', IsPortfolioWide: true, MinDaysLapsed: 14,
    SendWhenEmpty: false, GroupByCompany: true, DisplayRank: 40,
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

const PORTFOLIO = { DigestFromAddress: 'portfolio@example.invalid', DigestProvider: 'Test Mail Provider' };
/** One recorded send: SendSingleMessage(providerName, messageTypeName, message, ...). */
type SendCall = Parameters<typeof CommunicationEngine.Instance.SendSingleMessage>;
const msgOf = (c: SendCall): Message => c[2];
const toOf = (c: SendCall): string => String(c[2].To);

describe('RunLapsedCloseDateDigest', () => {
    afterEach(() => vi.restoreAllMocks());

    function setup(world: World = runWorld(), settings: Record<string, string | undefined> = PORTFOLIO) {
        const calls = stubRunView(world);
        return { calls, ...stubEngines(settings, world.providers) };
    }

    it('resolves today with BusinessTimeZoneEngine.Today() and no company, once for the whole run', async () => {
        const { today } = setup();
        await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(today).toHaveBeenCalledTimes(1);
        expect(today).toHaveBeenCalledWith();
    });

    it('sends nothing and reports failure when no sender resolves, naming the recipient', async () => {
        const { sendMessage } = setup(runWorld({ identities: [] }), { ...PORTFOLIO, DigestFromAddress: '' });
        const out = await RunLapsedCloseDateDigest(user);
        expect(sendMessage).not.toHaveBeenCalled();
        expect(out.Success).toBe(false);
        expect(out.Sent).toBe(0);
        expect(out.Errors.some((e) => e.includes('lee@example.invalid'))).toBe(true);
        expect(out.Errors.some((e) => e.includes('cleo@example.invalid'))).toBe(true);
    });

    it('treats a blank-after-trim DigestFromAddress as unset: the portfolio digests fail, the company ones still send', async () => {
        const { sendMessage } = setup(runWorld(), { ...PORTFOLIO, DigestFromAddress: '   ' });
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(false);
        // Leaders have a company mailbox; the CEO and CTO have deals but nothing to send from.
        expect(out.Sent).toBe(2);
        expect(sendMessage).toHaveBeenCalledTimes(2);
        expect(out.Errors).toHaveLength(2);
        expect(out.Errors.join('\n')).toContain('cleo@example.invalid');
        expect(out.Errors.join('\n')).toContain('cato@example.invalid');
    });

    it('skips a company-leader digest when that company has nothing lapsed', async () => {
        const { sendMessage } = setup(runWorld({ deals: [dealRow({ ID: 'd-20' })] })); // co-1 only
        const out = await RunLapsedCloseDateDigest(user);
        // co-2's leader is skipped; co-1's leader, the CEO and the CTO each have the 20-day deal.
        expect(out.SkippedEmpty).toBe(1);
        expect(out.Sent).toBe(3);
        expect(sendMessage).toHaveBeenCalledTimes(3);
        expect(out.Success).toBe(true);
    });

    it('sends an all-clear when the audience has SendWhenEmpty', async () => {
        // 3 days lapsed is under the 14-day floor, so the CEO has nothing.
        const { sendMessage } = setup(runWorld({ deals: [dealRow({ ExpectedCloseDate: '2026-11-20' })] }));
        const out = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        const ceo = out.RenderedEmails.find((e) => e.AudienceCode === 'CEO');
        expect(ceo).toBeDefined();
        expect(ceo.BodyHtml).toContain('No open deals have a lapsed close date');
        expect(sendMessage.mock.calls.map((c) => toOf(c))).toContain('cleo@example.invalid');
    });

    it('sends nothing for an empty portfolio audience without SendWhenEmpty', async () => {
        // 3 days lapsed is under the 14-day floor, so the quiet audience has nothing and is skipped
        // where the CEO, on the same deals, sends its all-clear.
        const { sendMessage } = setup(runWorld({
            audiences: [LEADER, CEO, QUIET],
            recipients: [
                recipientRow('aud-leader', 'co-1', 'emp-l1'),
                recipientRow('aud-leader', 'co-2', 'emp-l2'),
                recipientRow('aud-ceo', null, 'emp-ceo'),
                recipientRow('aud-quiet', null, 'emp-cto'),
            ],
            deals: [dealRow({ ExpectedCloseDate: '2026-11-20' })],
        }));
        const out = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        expect(out.RenderedEmails.some((e) => e.AudienceCode === 'QUIET')).toBe(false);
        expect(out.RenderedEmails.some((e) => e.AudienceCode === 'CEO')).toBe(true);
        expect(sendMessage.mock.calls.map((c) => toOf(c))).not.toContain('cato@example.invalid');
        expect(out.SkippedEmpty).toBe(2); // the quiet audience, and co-2's leader
    });

    it('sends the CTO an all-clear when nothing qualifies, as the shipped row does', async () => {
        const { sendMessage } = setup(runWorld({ deals: [dealRow({ ExpectedCloseDate: '2026-11-20' })] }));
        const out = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        const cto = out.RenderedEmails.find((e) => e.AudienceCode === 'CTO');
        expect(cto).toBeDefined();
        expect(cto.BodyHtml).toContain('No open deals have a lapsed close date');
        expect(sendMessage.mock.calls.map((c) => toOf(c))).toContain('cato@example.invalid');
    });

    it('continues after one failed send and reports both', async () => {
        const { sendMessage } = setup();
        sendMessage
            .mockResolvedValueOnce({ Success: true, Error: '' } as never)
            .mockResolvedValueOnce({ Success: false, Error: 'mailbox unavailable' } as never)
            .mockResolvedValue({ Success: true, Error: '' } as never);
        const out = await RunLapsedCloseDateDigest(user);
        expect(sendMessage).toHaveBeenCalledTimes(4);
        expect(out.Sent).toBe(3);
        expect(out.Success).toBe(false);
        expect(out.Errors).toHaveLength(1);
        expect(out.Errors[0]).toContain('lou@example.invalid');
        expect(out.Errors[0]).toContain('mailbox unavailable');
    });

    it('treats a send that throws as a failed send, and carries on', async () => {
        const { sendMessage } = setup();
        sendMessage.mockRejectedValueOnce(new Error('socket hang up')).mockResolvedValue({ Success: true } as never);
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Sent).toBe(3);
        expect(out.Errors).toHaveLength(1);
        expect(out.Errors[0]).toContain('socket hang up');
    });

    it('configures the communication engine and resolves the provider once per run', async () => {
        const { commConfig, providerList, sendMessage } = setup();
        await RunLapsedCloseDateDigest(user);
        expect(commConfig).toHaveBeenCalledTimes(1);
        expect(commConfig).toHaveBeenCalledWith(false, user);
        expect(providerList).toHaveBeenCalled();
        expect(sendMessage).toHaveBeenCalledTimes(4);
    });

    it('sends both parts: the digest as HTMLBody, its text rendition as Body, never markup in Body', async () => {
        const { sendMessage } = setup();
        await RunLapsedCloseDateDigest(user);
        expect(sendMessage).toHaveBeenCalledTimes(4);
        for (const c of sendMessage.mock.calls) {
            const m = msgOf(c);
            // The regression this guards: markup in `Body` goes out as plain text (MJ#6761).
            expect(m.HTMLBody).toContain('<table');
            // The text part is the same digest, not the markup: a provider that builds a
            // multipart/alternative (SendGrid, Gmail) must not put tags in its text half.
            expect(m.Body).toBeTruthy();
            expect(m.Body).not.toContain('<');
            expect(m.Body).not.toContain('style=');
            expect(m.MessageType).toEqual({ ID: 'pmt-email', Name: 'Email' });
            expect(String(m.To).trim()).not.toBe('');
            expect(String(m.From).trim()).not.toBe('');
            expect(String(m.Subject).trim()).not.toBe('');
            // provider name, message type, then the message; the context user travels last.
            expect(c[0]).toBe('Test Mail Provider');
            expect(c[1]).toBe('Email');
            expect(c[6]).toBe(user);
        }
    });

    it.each([['an empty string (what the row ships with)', ''], ['whitespace', '  '], ['undefined', undefined]])(
        'fails once up front, naming DigestProvider, and sends nothing when it is %s',
        async (_label, value) => {
            const { sendMessage, commConfig } = setup(runWorld(), { ...PORTFOLIO, DigestProvider: value });
            const out = await RunLapsedCloseDateDigest(user);
            expect(out.Success).toBe(false);
            expect(out.Sent).toBe(0);
            expect(sendMessage).not.toHaveBeenCalled();
            expect(out.Errors).toHaveLength(1);
            expect(out.Errors[0]).toContain('DigestProvider');
            expect(commConfig).not.toHaveBeenCalled();
        });

    it('does not need DigestProvider for a dry run, which sends nothing', async () => {
        setup(runWorld(), { DigestFromAddress: 'portfolio@example.invalid' });
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(out.Success).toBe(true);
        expect(out.RenderedEmails).toHaveLength(4);
    });

    it('trims the DigestProvider value before resolving it', async () => {
        const { sendMessage } = setup(runWorld(), { ...PORTFOLIO, DigestProvider: '  Test Mail Provider  ' });
        await RunLapsedCloseDateDigest(user);
        expect(sendMessage.mock.calls[0][0]).toBe('Test Mail Provider');
    });

    it('puts the incomplete-list notice in every email of a truncated run', async () => {
        const { sendMessage } = setup(runWorld({ dealsTotalRowCount: 9999 }));
        const out = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        expect(out.Truncated).toBe(true);
        expect(out.RenderedEmails.length).toBeGreaterThan(0);
        for (const e of out.RenderedEmails) expect(e.BodyHtml).toContain('This list is incomplete');
        expect(sendMessage).toHaveBeenCalled();
    });

    it('sends From the mapped, non-empty address: the company mailbox for a leader, the setting for the CEO', async () => {
        const { sendMessage } = setup();
        await RunLapsedCloseDateDigest(user);
        const fromByTo = new Map(sendMessage.mock.calls.map((c) => [toOf(c), String(msgOf(c).From)]));
        expect(fromByTo.get('lee@example.invalid')).toBe('digest@acme.example.invalid');
        expect(fromByTo.get('lou@example.invalid')).toBe('digest@zed.example.invalid');
        expect(fromByTo.get('cleo@example.invalid')).toBe('portfolio@example.invalid');
        for (const from of fromByTo.values()) expect(from).toBeTruthy();
    });

    it('dryRun renders everything and sends zero times, without reaching the provider at all', async () => {
        const { sendMessage, commConfig } = setup();
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(sendMessage).not.toHaveBeenCalled();
        expect(commConfig).not.toHaveBeenCalled();
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
        setup(runWorld({ identities: [] }), { ...PORTFOLIO, DigestFromAddress: '' });
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
        const { sendMessage } = setup(runWorld({
            audiences: [{ ...LEADER, SubjectTemplate: '{Company}: {Count} lapsed' }, CEO, CTO],
        }));
        const out = await RunLapsedCloseDateDigest(user, {
            captureRenderedEmails: true, recipientOverride: { name: 'Tess Tester', email: 'tess@example.invalid' },
        });
        expect(sendMessage).toHaveBeenCalledTimes(4);
        for (const c of sendMessage.mock.calls) expect(toOf(c)).toBe('tess@example.invalid');
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

    it('reports Success false on a truncated run even when every send succeeded', async () => {
        // The point of the combination: zero send failures, yet the run must still alert someone.
        const { sendMessage } = setup(runWorld({ dealsTotalRowCount: 9999 }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(sendMessage).toHaveBeenCalledTimes(4);
        expect(out.Sent).toBe(4);
        expect(out.Truncated).toBe(true);
        expect(out.Success).toBe(false);
    });

    it('adds one error on a truncated run, naming the cap, the company ordering and the skipped leaders', async () => {
        setup(runWorld({ dealsTotalRowCount: 9999 }));
        const out = await RunLapsedCloseDateDigest(user);
        const truncation = out.Errors.filter((e) => e.includes('hit its cap'));
        expect(truncation).toHaveLength(1);
        expect(truncation[0]).toContain(String(MAX_DEALS_PER_RUN));
        expect(truncation[0]).toContain('ordered by company');
        expect(truncation[0]).toContain('company-leader');
        expect(out.Errors).toHaveLength(1);
    });

    it('adds no truncation error and stays successful when the read was complete', async () => {
        setup();
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Errors).toEqual([]);
        expect(out.Success).toBe(true);
    });

    it('reports failure and sends nothing when the deal read fails, naming the reason', async () => {
        const { sendMessage } = setup(runWorld({ dealsFail: true }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(false);
        expect(out.Sent).toBe(0);
        expect(sendMessage).not.toHaveBeenCalled();
        expect(out.Errors.join('\n')).toContain('deadlock victim');
    });

    it('reports failure and sends nothing when DigestProvider names no configured provider', async () => {
        const { sendMessage } = setup(runWorld({ providers: [{ Name: 'Some Other Provider', MessageTypes: [] }] }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(false);
        expect(out.Sent).toBe(0);
        expect(sendMessage).not.toHaveBeenCalled();
        expect(out.Errors.join('\n')).toContain('Test Mail Provider');
        expect(out.Errors.join('\n')).toContain('Some Other Provider');
    });

    it('reports failure and sends nothing when the provider has no Email message type', async () => {
        const { sendMessage } = setup(runWorld({ providers: [{ Name: 'Test Mail Provider', MessageTypes: [{ ID: 'pmt-sms', Name: 'SMS' }] }] }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(false);
        expect(out.Sent).toBe(0);
        expect(sendMessage).not.toHaveBeenCalled();
        expect(out.Errors.join('\n')).toContain("no 'Email' message type");
    });

    it('does not reach for the provider when there is nothing to send', async () => {
        const { commConfig } = setup(runWorld({
            deals: [], audiences: [QUIET], recipients: [recipientRow('aud-quiet', null, 'emp-cto')],
        }));
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Success).toBe(true);
        expect(out.SkippedEmpty).toBe(1);
        expect(commConfig).not.toHaveBeenCalled();
    });

    it('orders audiences by DisplayRank, whatever order they are read in', async () => {
        const { sendMessage } = setup(runWorld({ audiences: [CTO, CEO, LEADER] }));
        await RunLapsedCloseDateDigest(user);
        expect(sendMessage.mock.calls.map((c) => toOf(c))).toEqual(
            ['lee@example.invalid', 'lou@example.invalid', 'cleo@example.invalid', 'cato@example.invalid']);
    });
});

// ── Finding fixes from the final review ──────────────────────────────────────────────────────────────

const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const EUR_ID = 'EEEEEEEE-0000-4000-8000-0000000000EE';

describe('amounts are shown in the deal\'s own currency', () => {
    afterEach(() => vi.restoreAllMocks());

    const withEuroDeal = (over: Partial<World> = {}) => runWorld({
        deals: [dealRow({ ID: 'd-eur', Name: 'Euro deal', CurrencyID: EUR_ID.toLowerCase(), Amount: 12500 })],
        currencies: [{ ID: EUR_ID, Code: 'EUR' }], ...over,
    });

    it('renders a non-USD deal in its currency, reading the codes once for the whole run', async () => {
        const calls = stubRunView(withEuroDeal());
        stubEngines(PORTFOLIO);
        stubInstalledEntities([CURRENCY_ENTITY]);
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(out.RenderedEmails.length).toBeGreaterThan(0);
        for (const e of out.RenderedEmails) {
            expect(e.BodyHtml).toContain('\u20AC12,500');
            expect(e.BodyHtml).not.toContain('$');
        }
        expect(callsOn(calls, CURRENCY_ENTITY)).toHaveLength(1);
        expect(callsOn(calls, 'MJ_BizApps_Sales: Deals')[0].Fields).toContain('CurrencyID');
    });

    it('renders the default for a deal with a null CurrencyID', async () => {
        stubRunView(withEuroDeal({ deals: [dealRow({ CurrencyID: null })] }));
        stubEngines(PORTFOLIO);
        stubInstalledEntities([CURRENCY_ENTITY]);
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(out.RenderedEmails[0].BodyHtml).toContain('$12,000');
    });

    it.each([
        ['the accounting app is not installed (no read is even attempted)', [], undefined],
        ['the read reports failure', [CURRENCY_ENTITY], 'fail' as const],
        ['the read throws', [CURRENCY_ENTITY], 'throw' as const],
    ])('renders the default, and still sends, when %s', async (_label, installed, mode) => {
        const calls = stubRunView(withEuroDeal({ currencies: mode }));
        const { sendMessage } = stubEngines(PORTFOLIO);
        stubInstalledEntities(installed);
        const out = await RunLapsedCloseDateDigest(user, { captureRenderedEmails: true });
        expect(out.Errors).toEqual([]);
        expect(out.Success).toBe(true);
        expect(sendMessage).toHaveBeenCalledTimes(3); // co-2's leader has nothing lapsed
        for (const e of out.RenderedEmails) expect(e.BodyHtml).toContain('$12,500');
        if (installed.length === 0) expect(callsOn(calls, CURRENCY_ENTITY)).toHaveLength(0);
    });
});

describe('a failed company digest names its company', () => {
    afterEach(() => vi.restoreAllMocks());

    /** One person leads both companies, so dedupe (audience AND company) keeps two rows for him. */
    const twoCompanyLeader = (over: Partial<World> = {}) => runWorld({
        audiences: [LEADER],
        recipients: [recipientRow('aud-leader', 'co-1', 'emp-l1'), recipientRow('aud-leader', 'co-2', 'emp-l1')],
        ...over,
    });

    it('gives two failed sends to one person at two companies two distinguishable messages', async () => {
        const { sendMessage } = (() => { stubRunView(twoCompanyLeader()); return stubEngines(PORTFOLIO); })();
        sendMessage.mockResolvedValue({ Success: false, Error: 'mailbox unavailable' } as never);
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Errors).toHaveLength(2);
        expect(new Set(out.Errors).size).toBe(2);
        expect(out.Errors[0]).toContain('Acme Test Co');
        expect(out.Errors[1]).toContain('Zed Test Co');
    });

    it('names the company in the no-sender error', async () => {
        stubRunView(twoCompanyLeader({ identities: [] }));
        stubEngines({ ...PORTFOLIO, DigestFromAddress: '' });
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Errors).toHaveLength(2);
        expect(out.Errors[0]).toContain('company Acme Test Co has no default Mailbox sender identity');
        expect(out.Errors[1]).toContain('company Zed Test Co has no default Mailbox sender identity');
    });

    it('falls back to the company ID when the company has no lapsed deal to take a name from', async () => {
        stubRunView(runWorld({
            audiences: [{ ...LEADER, SendWhenEmpty: true }], deals: [],
            recipients: [recipientRow('aud-leader', 'co-9', 'emp-l1')], identities: [],
        }));
        stubEngines({ ...PORTFOLIO, DigestFromAddress: '' });
        const out = await RunLapsedCloseDateDigest(user);
        expect(out.Errors[0]).toContain('company co-9');
    });

    it('leaves a portfolio audience unchanged: no company in its failure', async () => {
        stubRunView(runWorld({ identities: [] }));
        stubEngines({ ...PORTFOLIO, DigestFromAddress: '' });
        const out = await RunLapsedCloseDateDigest(user);
        const ceo = out.Errors.find((e) => e.includes('cleo@example.invalid'));
        expect(ceo).not.toContain('(company');
    });
});

describe('the audience table is the configuration', () => {
    afterEach(() => vi.restoreAllMocks());

    it('a new audience row with MinDaysLapsed = 30 produces a 30-day digest, with no code change', async () => {
        stubRunView(runWorld({
            audiences: [audienceRow({
                ID: 'aud-30', Code: 'THIRTY', IsPortfolioWide: true, MinDaysLapsed: 30, IncludeMissingCloseDate: false, DisplayRank: 5,
            })],
            recipients: [recipientRow('aud-30', null, 'emp-ceo')],
            deals: [
                dealRow({ ID: 'd-20', Name: 'Twenty days', ExpectedCloseDate: '2026-11-03' }),
                dealRow({ ID: 'd-31', Name: 'Thirty-one days', ExpectedCloseDate: '2026-10-23' }),
                dealRow({ ID: 'd-30', Name: 'Exactly thirty', ExpectedCloseDate: '2026-10-24' }),
            ],
        }));
        stubEngines(PORTFOLIO);
        const out = await RunLapsedCloseDateDigest(user, { dryRun: true });
        expect(out.RenderedEmails).toHaveLength(1);
        const body = out.RenderedEmails[0].BodyHtml;
        expect(body).toContain('Thirty-one days');
        expect(body).not.toContain('Exactly thirty'); // the floor is strict
        expect(body).not.toContain('Twenty days');
    });
});
