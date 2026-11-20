/**
 * Digest recipients: dedupe, and the save-time refusals.
 *
 * The premise of the digest is that an administrator can see a wrong recipient in Explorer and fix it.
 * Each refusal below stops a row that would silently never receive mail (a company-scoped audience with
 * no company, an employee with no address, a deactivated employee) from being created at all.
 *
 * DedupeByEmail keys on audience + company + lower-cased address. The two dedupe cases constrain each
 * other: one person with two employee records is mailed once per audience, but the same address under
 * two audiences is two sends, because each audience gets a different slice of deals.
 *
 * CompanyID in that key is right for a company audience and wrong for a portfolio-wide one, where the
 * company cannot change what the digest contains: (CEO, NULL, E1) and (CEO, CompanyA, E1) are the same
 * email, and keyed with the company they survive as two recipients. Both halves of the fix are tested
 * here — `Save()` refuses the row, and `LoadDigestRecipients` clears the company on the rows already in
 * the table, which is the half that matters, since nobody re-saves a seeded row.
 *
 * `MJ: Employees.Email` is NOT NULL, so "no email address" means blank or whitespace. The test uses
 * whitespace; a null check would never fire. Fixtures are fictional.
 *
 * `Object.create` holds the entity without standing up metadata (the DealStageEventEntityServer idiom);
 * it skips the constructor, so everything Save reads is shadowed. A refusal returns false and registers
 * a failed result, it does not throw: Explorer, GraphQL, Actions and agents all read `LatestResult`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseEntityResult, RunView, type RunViewParams, type UserInfo } from '@memberjunction/core';
import { mjBizAppsSalesDealDigestRecipientEntity } from '@mj-biz-apps/sales-entities';

import { DedupeByEmail, LoadDigestRecipients, type DigestRecipient } from '../digest/recipients.js';
import { DealDigestRecipientEntityServer } from '../DealDigestRecipientEntityServer.js';

function recipient(over: Partial<DigestRecipient>): DigestRecipient {
    return {
        AudienceTypeID: 'aud-leader', CompanyID: 'co-1', EmployeeID: 'emp-1',
        Email: 'pat.example@example.invalid', FirstName: 'Pat', FullName: 'Pat Example', ...over,
    };
}

describe('DedupeByEmail', () => {
    it('collapses two employee records sharing one address, keeping the first', () => {
        const out = DedupeByEmail([
            recipient({ EmployeeID: 'emp-1' }),
            recipient({ EmployeeID: 'emp-2' }),
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].EmployeeID).toBe('emp-1');
    });

    it('keeps the same address under two different audiences', () => {
        const out = DedupeByEmail([
            recipient({ AudienceTypeID: 'aud-leader', CompanyID: 'co-1' }),
            recipient({ AudienceTypeID: 'aud-ceo', CompanyID: null }),
        ]);
        expect(out.map((r) => r.AudienceTypeID)).toEqual(['aud-leader', 'aud-ceo']);
    });

    it('compares addresses case-insensitively, ignoring surrounding whitespace', () => {
        const out = DedupeByEmail([
            recipient({ EmployeeID: 'emp-1', Email: 'Pat@example.invalid' }),
            recipient({ EmployeeID: 'emp-2', Email: ' pat@EXAMPLE.invalid ' }),
        ]);
        expect(out).toHaveLength(1);
    });
});

interface Fixture {
    audience?: { Name: string; IsPortfolioWide: boolean } | null;
    employee?: { FirstName: string; LastName: string; Email: string; Active: boolean } | null;
}

/** A recipient row whose provider answers the audience and employee reads from the fixture. */
function row(fields: { audience: string; company: string | null; employee: string; active?: boolean }, fx: Fixture) {
    const history: BaseEntityResult[] = [];
    const reads: string[] = [];
    const r = Object.create(DealDigestRecipientEntityServer.prototype) as DealDigestRecipientEntityServer;
    const define = (name: string, value: unknown) => Object.defineProperty(r, name, { value, writable: true });
    define('DealDigestAudienceTypeID', fields.audience);
    define('CompanyID', fields.company);
    define('EmployeeID', fields.employee);
    define('IsActive', fields.active ?? true);
    define('Fields', []);
    define('ContextCurrentUser', {});
    define('RegisterResultHistoryEntry', (x: BaseEntityResult) => history.push(x));
    define('ProviderToUse', {
        RunView: async (p: { EntityName: string }) => {
            reads.push(p.EntityName);
            const one = p.EntityName.includes('Audience') ? fx.audience : fx.employee;
            return { Success: true, Results: one ? [one] : [] };
        },
    });
    return { r, history, reads };
}

const PORTFOLIO = { Name: 'CEO', IsPortfolioWide: true };
const SCOPED = { Name: 'Company Leader', IsPortfolioWide: false };
const GOOD_EMP = { FirstName: 'Pat', LastName: 'Example', Email: 'pat.example@example.invalid', Active: true };

describe('DealDigestRecipientEntityServer.Save', () => {
    afterEach(() => vi.restoreAllMocks());

    it('refuses a non-portfolio audience row with no CompanyID, naming the audience', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealDigestRecipientEntity.prototype, 'Save').mockResolvedValue(true);
        const { r, history } = row({ audience: 'a', company: null, employee: 'e' }, { audience: SCOPED, employee: GOOD_EMP });
        expect(await r.Save()).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(history).toHaveLength(1);
        expect(history[0].Success).toBe(false);
        expect(history[0].Message).toContain('Company Leader');
        expect(history[0].Message).toContain('Nothing was changed');
    });

    it('refuses an employee whose address is only whitespace, naming the employee', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealDigestRecipientEntity.prototype, 'Save').mockResolvedValue(true);
        const { r, history } = row(
            { audience: 'a', company: null, employee: 'e' },
            { audience: PORTFOLIO, employee: { ...GOOD_EMP, Email: '   ' } },
        );
        expect(await r.Save()).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(history[0].Message).toContain('Pat Example');
        expect(history[0].Message).toContain('email');
    });

    it('refuses an inactive employee, naming the employee', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealDigestRecipientEntity.prototype, 'Save').mockResolvedValue(true);
        const { r, history } = row(
            { audience: 'a', company: null, employee: 'e' },
            { audience: PORTFOLIO, employee: { ...GOOD_EMP, Active: false } },
        );
        expect(await r.Save()).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(history[0].Message).toContain('Pat Example');
        expect(history[0].Message).toContain('inactive');
    });

    it('refuses a row whose employee cannot be found', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealDigestRecipientEntity.prototype, 'Save').mockResolvedValue(true);
        const { r, history } = row({ audience: 'a', company: null, employee: 'e' }, { audience: PORTFOLIO, employee: null });
        expect(await r.Save()).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(history[0].Message).toContain('no longer exists');
    });

    it('refuses a portfolio-wide audience row that names a company, naming the audience', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealDigestRecipientEntity.prototype, 'Save').mockResolvedValue(true);
        const { r, history } = row({ audience: 'a', company: 'co-1', employee: 'e' }, { audience: PORTFOLIO, employee: GOOD_EMP });
        expect(await r.Save()).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(history).toHaveLength(1);
        expect(history[0].Success).toBe(false);
        expect(history[0].Message).toContain('CEO');
        expect(history[0].Message).toContain('Nothing was changed');
    });

    it('accepts a portfolio-wide row with a null CompanyID', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealDigestRecipientEntity.prototype, 'Save').mockResolvedValue(true);
        const { r, history } = row({ audience: 'a', company: null, employee: 'e' }, { audience: PORTFOLIO, employee: GOOD_EMP });
        expect(await r.Save()).toBe(true);
        expect(save).toHaveBeenCalledOnce();
        expect(history).toHaveLength(0);
    });

    it('lets a row be deactivated even when its employee is already inactive', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealDigestRecipientEntity.prototype, 'Save').mockResolvedValue(true);
        const { r, reads } = row(
            { audience: 'a', company: null, employee: 'e', active: false },
            { audience: PORTFOLIO, employee: { ...GOOD_EMP, Active: false } },
        );
        expect(await r.Save()).toBe(true);
        expect(save).toHaveBeenCalledOnce();
        expect(reads).toHaveLength(0);
    });
});

/**
 * LoadDigestRecipients is the only place a row that was valid when saved and has since gone bad can be
 * caught: nobody re-saves the row, so Save() never runs. An employee deactivated, or whose address was
 * blanked, after being seeded must stop receiving the digest without anyone editing recipient rows.
 * A stub cannot run SQL, so the employee read's ExtraFilter is asserted too: without that, a filter that
 * lost `Active = 1` would still pass the in-memory-drop test.
 */
describe('LoadDigestRecipients', () => {
    afterEach(() => vi.restoreAllMocks());

    const user = {} as UserInfo;
    /** Every row below is on `aud-leader`, a COMPANY audience, unless a test says otherwise. */
    const NO_PORTFOLIO: ReadonlySet<string> = new Set<string>();
    const recRow = (employee: string, audience = 'aud-leader') =>
        ({ DealDigestAudienceTypeID: audience, CompanyID: 'co-1', EmployeeID: employee });
    const empRow = (id: string, over: Record<string, unknown> = {}) =>
        ({ ID: id, Email: `${id}@example.invalid`, FirstName: 'Pat', LastName: id, ...over });

    /** Stubs RunView: the first read answers `recipients`, the second `employees`. */
    function stub(recipients: unknown, employees?: unknown) {
        const calls: RunViewParams[] = [];
        vi.spyOn(RunView.prototype, 'RunView').mockImplementation((async (p: RunViewParams) => {
            calls.push(p);
            return calls.length === 1 ? recipients : employees;
        }) as never);
        return calls;
    }

    it('drops a recipient whose employee read no longer returns them, and pins the Active filter', async () => {
        const calls = stub(
            { Success: true, Results: [recRow('emp-1'), recRow('emp-2')] },
            { Success: true, Results: [empRow('emp-2')] },
        );
        const out = await LoadDigestRecipients(user, NO_PORTFOLIO);
        expect(out.map((r) => r.EmployeeID)).toEqual(['emp-2']);
        expect(calls).toHaveLength(2);
        expect(calls[0].EntityName).toBe('MJ_BizApps_Sales: Deal Digest Recipients');
        expect(calls[0].ExtraFilter).toContain('IsActive = 1');
        expect(calls[1].EntityName).toBe('MJ: Employees');
        expect(calls[1].ExtraFilter).toContain('Active = 1');
        expect(calls[1].ExtraFilter).toContain("IN ('emp-1', 'emp-2')");
    });

    it('escapes the employee IDs with the library routine: a quote is doubled and a NUL is stripped', async () => {
        const calls = stub({ Success: true, Results: [recRow("emp'1"), recRow('emp\u00002')] }, { Success: true, Results: [] });
        await LoadDigestRecipients(user, NO_PORTFOLIO);
        expect(calls[1].ExtraFilter).toContain("IN ('emp''1', 'emp2')");
    });

    it('drops a recipient whose employee address has since been blanked', async () => {
        stub(
            { Success: true, Results: [recRow('emp-1'), recRow('emp-2')] },
            { Success: true, Results: [empRow('emp-1', { Email: '  ' }), empRow('emp-2')] },
        );
        const out = await LoadDigestRecipients(user, NO_PORTFOLIO);
        expect(out.map((r) => r.EmployeeID)).toEqual(['emp-2']);
    });

    it('joins in memory regardless of ID case, and shapes the recipient', async () => {
        stub(
            { Success: true, Results: [recRow('EMP-1')] },
            { Success: true, Results: [empRow('emp-1', { Email: ' pat@example.invalid ', FirstName: 'Pat', LastName: 'Example' })] },
        );
        const out = await LoadDigestRecipients(user, NO_PORTFOLIO);
        expect(out).toEqual([{
            AudienceTypeID: 'aud-leader', CompanyID: 'co-1', EmployeeID: 'EMP-1',
            Email: 'pat@example.invalid', FirstName: 'Pat', FullName: 'Pat Example',
        }]);
    });

    it('returns an empty list without a second read when there are no recipient rows', async () => {
        const calls = stub({ Success: true, Results: [] });
        expect(await LoadDigestRecipients(user, NO_PORTFOLIO)).toEqual([]);
        expect(calls).toHaveLength(1);
    });

    it('throws when the recipient read fails, so a broken read is not "nobody to mail"', async () => {
        stub({ Success: false, ErrorMessage: 'boom', Results: [] });
        await expect(LoadDigestRecipients(user, NO_PORTFOLIO)).rejects.toThrow('boom');
    });

    it('throws when the employee read fails', async () => {
        stub({ Success: true, Results: [recRow('emp-1')] }, { Success: false, ErrorMessage: 'bang', Results: [] });
        await expect(LoadDigestRecipients(user, NO_PORTFOLIO)).rejects.toThrow('bang');
    });

    it('clears the company on a portfolio-wide row, so one person is not mailed the same digest twice', async () => {
        // The exact pair the unique key cannot catch, because CompanyID differs.
        stub(
            {
                Success: true,
                Results: [
                    { DealDigestAudienceTypeID: 'aud-ceo', CompanyID: null, EmployeeID: 'emp-1' },
                    { DealDigestAudienceTypeID: 'aud-ceo', CompanyID: 'co-1', EmployeeID: 'emp-1' },
                ],
            },
            { Success: true, Results: [empRow('emp-1')] },
        );
        const out = await LoadDigestRecipients(user, new Set(['aud-ceo']));
        expect(out).toHaveLength(1);
        expect(out[0].CompanyID).toBeNull();
    });

    it('matches the portfolio-wide audience whatever the case of its ID', async () => {
        // `NormalizeUUID` lower-cases and trims (it does NOT strip braces); the caller normalizes the
        // set with the same routine, so the two sides agree. SQL Server returns a uniqueidentifier
        // upper-cased, and these IDs reach the set and the row by different reads.
        stub(
            {
                Success: true,
                Results: [{ DealDigestAudienceTypeID: ' 3F2504E0-4F89-11D3-9A0C-0305E82C3301 ', CompanyID: 'co-1', EmployeeID: 'emp-1' }],
            },
            { Success: true, Results: [empRow('emp-1')] },
        );
        const out = await LoadDigestRecipients(user, new Set(['3f2504e0-4f89-11d3-9a0c-0305e82c3301']));
        expect(out[0].CompanyID).toBeNull();
    });

    it('keeps the company on a company audience, so one leader at two companies gets both emails', async () => {
        stub(
            {
                Success: true,
                Results: [
                    { DealDigestAudienceTypeID: 'aud-leader', CompanyID: 'co-1', EmployeeID: 'emp-1' },
                    { DealDigestAudienceTypeID: 'aud-leader', CompanyID: 'co-2', EmployeeID: 'emp-1' },
                ],
            },
            { Success: true, Results: [empRow('emp-1')] },
        );
        const out = await LoadDigestRecipients(user, new Set(['aud-ceo']));
        expect(out.map((r) => r.CompanyID)).toEqual(['co-1', 'co-2']);
    });
});
