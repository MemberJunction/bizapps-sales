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
 * `MJ: Employees.Email` is NOT NULL, so "no email address" means blank or whitespace. The test uses
 * whitespace; a null check would never fire. Fixtures are fictional.
 *
 * `Object.create` holds the entity without standing up metadata (the DealStageEventEntityServer idiom);
 * it skips the constructor, so everything Save reads is shadowed. A refusal returns false and registers
 * a failed result, it does not throw: Explorer, GraphQL, Actions and agents all read `LatestResult`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseEntityResult } from '@memberjunction/core';
import { mjBizAppsSalesDealDigestRecipientEntity } from '@mj-biz-apps/sales-entities';

import { DedupeByEmail, type DigestRecipient } from '../digest/recipients.js';
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
            recipient({ EmployeeID: 'emp-1', Email: 'Rob@example.invalid' }),
            recipient({ EmployeeID: 'emp-2', Email: ' rob@EXAMPLE.invalid ' }),
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
