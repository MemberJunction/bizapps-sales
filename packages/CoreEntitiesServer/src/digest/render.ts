import type { CalendarDay } from '@mj-biz-apps/common-entities';

import type { CompanyGroup, DigestAudience, LapsedDeal } from './audience.js';
import { CurrencyCodeFor, DEFAULT_DISPLAY_CURRENCY } from './currency.js';
import type { DigestRecipient } from './recipients.js';
import { DEAL_ENTITY } from './shared.js';

export interface RenderedDigest { Subject: string; BodyHtml: string }

export interface RenderContext {
    audience: DigestAudience; recipient: DigestRecipient;
    groups: readonly CompanyGroup[]; today: CalendarDay;
    /** Not configured arrives as null, undefined, "" or whitespace; all four mean "render no links". */
    explorerBaseUrl: string | null;
    /** How many deals THIS recipient's email lists (not the run's total). The one source for every count in the email. */
    dealsShown: number; truncated: boolean;
    /** Accounting's currency codes by upper-cased ID, read once per run. Absent or empty: every amount shows the default. */
    currencyCodes?: ReadonlyMap<string, string>;
}

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Display only. The figure of one deal is formatted in that deal's own currency; no two figures are ever
 * combined. A code Intl cannot format (a malformed row) falls back to the default rather than failing the email.
 */
function formatAmount(amount: number, currencyCode: string): string {
    let f = formatters.get(currencyCode);
    if (!f) {
        try {
            f = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 });
        } catch {
            f = new Intl.NumberFormat('en-US', { style: 'currency', currency: DEFAULT_DISPLAY_CURRENCY, maximumFractionDigits: 0 });
        }
        formatters.set(currencyCode, f);
    }
    return f.format(amount);
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Makes text safe in element content and in a double- or single-quoted attribute. */
function escapeHtml(text: string): string {
    return String(text ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Replaces each `{Name}` that has a value; an unknown placeholder survives literally. One pass, so a
 * value that itself contains `{Count}` is not expanded a second time.
 */
export function FillTemplate(template: string, values: Readonly<Record<string, string>>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match);
}

/** The Explorer route to one deal. `baseUrl` must be non-empty; the caller decides link versus text. */
export function DealRecordUrl(baseUrl: string, dealID: string): string {
    const base = baseUrl.trim().replace(/\/+$/, '');
    return `${base}/resource/record/${encodeURIComponent(DEAL_ENTITY)}/${encodeURIComponent(dealID)}`;
}

/** A template column holds NULL or "" when unset (a host adding a row in Explorer produces "" readily); both mean the default. */
const orDefault = (template: string | null | undefined, fallback: string): string =>
    template !== null && template !== undefined && template.trim() !== '' ? template : fallback;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

const TH = 'style="text-align:left;padding:6px 8px;border-bottom:2px solid #d0d5dd;font-size:12px;color:#475467;"';
const TD = 'style="padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;vertical-align:top;"';
const TD_RIGHT = 'style="padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;vertical-align:top;text-align:right;white-space:nowrap;"';

type Codes = ReadonlyMap<string, string>;

function dealNameCell(deal: LapsedDeal, baseUrl: string): string {
    const name = escapeHtml(deal.Name);
    if (baseUrl === '') return name;
    return `<a href="${escapeHtml(DealRecordUrl(baseUrl, deal.ID))}" style="color:#175cd3;">${name}</a>`;
}

function dealRow(deal: LapsedDeal, baseUrl: string, showCompany: boolean, codes: Codes): string {
    const closeDate = deal.ExpectedCloseDate === null || deal.ExpectedCloseDate === undefined
        ? 'Not set' : escapeHtml(deal.ExpectedCloseDate);
    const lapsed = deal.DaysLapsed === null || deal.DaysLapsed === undefined
        ? 'No close date' : plural(deal.DaysLapsed, 'day');
    const amount = deal.Amount === null || deal.Amount === undefined ? '&mdash;' : formatAmount(deal.Amount, CurrencyCodeFor(deal.CurrencyID, codes));
    return '<tr>'
        + `<td ${TD}>${dealNameCell(deal, baseUrl)}</td>`
        + (showCompany ? `<td ${TD}>${escapeHtml(deal.CompanyName)}</td>` : '')
        + `<td ${TD}>${escapeHtml(deal.OwnerName)}</td>`
        + `<td ${TD}>${escapeHtml(deal.StageName)}</td>`
        + `<td ${TD}>${closeDate}</td>`
        + `<td ${TD}>${lapsed}</td>`
        + `<td ${TD_RIGHT}>${amount}</td>`
        + '</tr>';
}

function dealTable(deals: readonly LapsedDeal[], baseUrl: string, showCompany: boolean, codes: Codes): string {
    const heads = ['Deal', showCompany ? 'Company' : null, 'Owner', 'Stage', 'Expected close', 'Lapsed', 'Amount']
        .filter((h): h is string => h !== null);
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px 0;">'
        + `<tr>${heads.map((h) => `<th ${TH}>${h}</th>`).join('')}</tr>`
        + deals.map((d) => dealRow(d, baseUrl, showCompany, codes)).join('')
        + '</table>';
}

/**
 * Subject and body for one recipient of one audience.
 *
 * TRUSTED VERSUS ESCAPED. `SubjectTemplate`, `IntroTemplate` and `EmptyMessage` are host-authored copy
 * and are inserted as written, so a host can put markup in its own intro. That is safe only because no
 * shipped audience row carries them (all four seeded rows leave them NULL, and the seed file's
 * `_comments` tells a host to add its own audience row rather than edit a shipped one). Do not escape
 * them, and do not extend that trust to anything else. Every value that originates in deal or employee
 * data (deal, company, owner and stage names, the close date, the recipient's first name) goes through
 * `escapeHtml`, including when it is substituted into a trusted template. The subject is a plain-text
 * header, not HTML, so it is not escaped, but line breaks are removed so a value cannot add a header.
 */
export function RenderDigest(ctx: RenderContext): RenderedDigest {
    const { audience, recipient, groups, today } = ctx;
    const baseUrl = (ctx.explorerBaseUrl ?? '').trim();
    const codes: Codes = ctx.currencyCodes ?? new Map();
    const company = groups.length === 1 ? groups[0].CompanyName : 'your companies';
    const values = {
        Company: company, Count: String(ctx.dealsShown), Today: today, RecipientFirstName: recipient.FirstName,
    };
    const escapedValues = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, escapeHtml(v)])) as Record<string, string>;

    const defaultSubject = `Lapsed close dates: ${plural(ctx.dealsShown, 'deal')} as of ${today}`;
    const subject = FillTemplate(orDefault(audience.SubjectTemplate, defaultSubject), values).replace(/[\r\n]+/g, ' ').trim();

    const defaultIntro = '<p style="margin:0 0 16px 0;">Hi {RecipientFirstName},</p>'
        + '<p style="margin:0 0 16px 0;">These open deals have an expected close date that has passed, or never had one set.</p>';
    const intro = FillTemplate(orDefault(audience.IntroTemplate, defaultIntro), escapedValues);

    let content: string;
    if (groups.length === 0) {
        const empty = orDefault(audience.EmptyMessage,
            '<p style="margin:0 0 16px 0;">No open deals have a lapsed close date as of {Today}.</p>');
        content = FillTemplate(empty, escapedValues);
    } else {
        const tables = audience.GroupByCompany
            ? groups.map((g) =>
                `<h2 style="font-size:16px;margin:16px 0 8px 0;color:#101828;">${escapeHtml(g.CompanyName)}</h2>`
                + dealTable(g.Deals, baseUrl, false, codes)).join('')
            : dealTable(groups.flatMap((g) => g.Deals), baseUrl, true, codes);
        content = intro + tables;
    }

    const footer = ctx.truncated
        ? `<p style="margin:0;font-size:12px;color:#475467;">This list is incomplete: there were too many lapsed deals to read in one run, so only ${plural(ctx.dealsShown, 'deal')} could be included here. Open the deals list in the app for the full picture.</p>`
        : '';

    const BodyHtml = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#101828;line-height:1.5;">'
        + content
        + footer + '</div>';
    return { Subject: subject, BodyHtml };
}
