/**
 * Rendering for the Lapsed Close Date Digest: the HTML a recipient actually opens.
 *
 * THE ESCAPING TESTS ASSERT BOTH HALVES. Deal names, company names, owner names, stage names and the
 * recipient's first name all come from data people typed, and they flow into an email. Each test asserts
 * that the escaped form is present AND that the raw markup is absent from the whole body: a check on
 * `&lt;script&gt;` alone stays green if the raw tag also leaks through some other cell or attribute.
 *
 * AN UNCONFIGURED BASE URL ARRIVES AS null, "" OR WHITESPACE. The ExplorerBaseUrl Application Setting
 * ships with an empty Value so a host sees the row and fills it in, and `GetSetting` returns
 * `string | undefined`; `"" ?? null` is `""`, so nullish coalescing does not collapse these. A digest sent
 * before the host fills it in would otherwise carry `href="/resource/record/..."`, a relative URL that
 * resolves against nothing in a mail client: a dead link for every recipient. `strict` is off, so the
 * compiler cannot tell a test that covers only null from one that covers all three; this file does.
 *
 * THE TRAILING-SLASH CASE is pinned on `DealRecordUrl` and again through `RenderDigest`, because the
 * slash in a pasted setting value is the ordinary way `//resource/record/...` happens.
 *
 * Amounts are displayed with Intl formatting only. Nothing here sums or totals a figure; the digest
 * deliberately has no portfolio total.
 */
import { describe, expect, it } from 'vitest';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';

import type { CompanyGroup, DigestAudience, LapsedDeal } from '../digest/audience.js';
import type { DigestRecipient } from '../digest/recipients.js';
import { DealRecordUrl, FillTemplate, RenderDigest, type RenderContext } from '../digest/render.js';

const TODAY = ToCalendarDay('2026-11-23')!;

function audience(overrides: Partial<DigestAudience> = {}): DigestAudience {
    return {
        ID: 'aaaaaaaa-0000-4000-8000-000000000001', Code: 'TEST', Name: 'Test audience',
        IsPortfolioWide: true, MinDaysLapsed: null, IncludeMissingCloseDate: true,
        SendWhenEmpty: false, GroupByCompany: true,
        SubjectTemplate: null, IntroTemplate: null, EmptyMessage: null, DisplayRank: 1,
        ...overrides,
    };
}

function recipient(overrides: Partial<DigestRecipient> = {}): DigestRecipient {
    return {
        AudienceTypeID: 'aaaaaaaa-0000-4000-8000-000000000001', CompanyID: null,
        EmployeeID: 'eeeeeeee-0000-4000-8000-000000000001', Email: 'pat@example.test',
        FirstName: 'Pat', FullName: 'Pat Example', ...overrides,
    };
}

function deal(overrides: Partial<LapsedDeal> = {}): LapsedDeal {
    return {
        ID: 'dddddddd-0000-4000-8000-000000000001', Name: 'Widget renewal',
        CompanyID: 'cccccccc-0000-4000-8000-000000000001', CompanyName: 'Acme Test Co',
        OwnerName: 'Olive Owner', Amount: 12500, CurrencyID: null,
        ExpectedCloseDate: ToCalendarDay('2026-11-09')!, DaysLapsed: 14, StageName: 'Proposal',
        ...overrides,
    };
}

function group(deals: LapsedDeal[]): CompanyGroup {
    return { CompanyID: deals[0].CompanyID, CompanyName: deals[0].CompanyName, Deals: deals };
}

function ctx(overrides: Partial<RenderContext> = {}): RenderContext {
    const groups = overrides.groups ?? [group([deal()])];
    const count = groups.reduce((n, g) => n + g.Deals.length, 0);
    return {
        audience: audience(), recipient: recipient(), groups, today: TODAY,
        explorerBaseUrl: 'https://explorer.example.test', dealsShown: count, truncated: false,
        ...overrides,
    };
}

describe('FillTemplate', () => {
    it('substitutes {Company}, {Count}, {Today} and {RecipientFirstName}', () => {
        const out = FillTemplate('{RecipientFirstName}: {Count} deals at {Company} on {Today}', {
            Company: 'Acme Test Co', Count: '3', Today: '2026-11-23', RecipientFirstName: 'Pat',
        });
        expect(out).toBe('Pat: 3 deals at Acme Test Co on 2026-11-23');
    });

    it('substitutes a repeated placeholder every time it appears', () => {
        expect(FillTemplate('{Count} of {Count}', { Count: '2' })).toBe('2 of 2');
    });

    it('leaves an unknown placeholder literally rather than throwing', () => {
        expect(FillTemplate('Hello {Nope} and {Count}', { Count: '1' })).toBe('Hello {Nope} and 1');
    });

    it('does not treat a value as a template, so a value containing a placeholder is not re-expanded', () => {
        expect(FillTemplate('{RecipientFirstName}', { RecipientFirstName: '{Count}', Count: '9' })).toBe('{Count}');
    });
});

describe('DealRecordUrl', () => {
    it('builds the Explorer route with the entity name encoded', () => {
        expect(DealRecordUrl('https://x.io', 'ABC')).toBe('https://x.io/resource/record/MJ_BizApps_Sales%3A%20Deals/ABC');
    });

    it('does not double the slash when the base URL ends in one', () => {
        expect(DealRecordUrl('https://x.io/', 'ABC')).toBe('https://x.io/resource/record/MJ_BizApps_Sales%3A%20Deals/ABC');
    });

    it('strips several trailing slashes, not only one', () => {
        expect(DealRecordUrl('https://x.io///', 'ABC')).toBe('https://x.io/resource/record/MJ_BizApps_Sales%3A%20Deals/ABC');
    });
});

describe('RenderDigest: escaping', () => {
    const HOSTILE = `<script>alert("x")</script> & "Q" 'r'`;

    it('escapes HTML in a deal name and never emits the raw tag', () => {
        const { BodyHtml } = RenderDigest(ctx({ groups: [group([deal({ Name: HOSTILE })])] }));
        expect(BodyHtml).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;Q&quot; &#39;r&#39;');
        expect(BodyHtml).not.toContain('<script');
        expect(BodyHtml).not.toContain('</script>');
    });

    it('escapes the deal name when it is rendered as a link too', () => {
        const { BodyHtml } = RenderDigest(ctx({ groups: [group([deal({ Name: '<b>bold</b>' })])] }));
        expect(BodyHtml).toContain('&lt;b&gt;bold&lt;/b&gt;');
        expect(BodyHtml).not.toContain('<b>bold');
    });

    it.each([['an empty string', ''], ['null', null]])(
        'escapes a deal name on the plain-text path too, when explorerBaseUrl is %s', (_l, base) => {
            const { BodyHtml } = RenderDigest(ctx({
                explorerBaseUrl: base as string | null, groups: [group([deal({ Name: HOSTILE })])],
            }));
            expect(BodyHtml).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;Q&quot; &#39;r&#39;');
            expect(BodyHtml).not.toContain('<script');
            expect(BodyHtml).not.toContain('</script>');
            expect(BodyHtml).not.toContain('href=');
        });

    it('escapes the company, owner and stage names', () => {
        const { BodyHtml } = RenderDigest(ctx({
            audience: audience({ GroupByCompany: false }),
            groups: [group([deal({ CompanyName: '<i>Co</i>', OwnerName: '<u>Own</u>', StageName: '<s>Stg</s>' })])],
        }));
        for (const [raw, escaped] of [['<i>Co', '&lt;i&gt;Co'], ['<u>Own', '&lt;u&gt;Own'], ['<s>Stg', '&lt;s&gt;Stg']]) {
            expect(BodyHtml).toContain(escaped);
            expect(BodyHtml).not.toContain(raw);
        }
    });

    it('escapes a company name in the section header when grouping by company', () => {
        const { BodyHtml } = RenderDigest(ctx({ groups: [group([deal({ CompanyName: '<i>Co</i>' })])] }));
        expect(BodyHtml).toContain('&lt;i&gt;Co');
        expect(BodyHtml).not.toContain('<i>Co');
    });

    it('escapes the recipient first name when it is substituted into the intro', () => {
        const { BodyHtml } = RenderDigest(ctx({
            audience: audience({ IntroTemplate: '<p>Hi {RecipientFirstName}</p>' }),
            recipient: recipient({ FirstName: '<img src=x>' }),
        }));
        expect(BodyHtml).toContain('Hi &lt;img src=x&gt;');
        expect(BodyHtml).not.toContain('<img');
    });

    it('inserts a host-authored IntroTemplate as markup, unescaped', () => {
        const { BodyHtml } = RenderDigest(ctx({ audience: audience({ IntroTemplate: '<p class="host">Hello</p>' }) }));
        expect(BodyHtml).toContain('<p class="host">Hello</p>');
    });

    it('keeps a line break out of the subject so a template or value cannot inject a header', () => {
        const { Subject } = RenderDigest(ctx({
            audience: audience({ SubjectTemplate: 'Hi {RecipientFirstName}' }),
            recipient: recipient({ FirstName: 'Pat\r\nBcc: x@example.test' }),
        }));
        expect(Subject).not.toMatch(/[\r\n]/);
        expect(Subject).toBe('Hi Pat Bcc: x@example.test');
    });
});

describe('RenderDigest: links', () => {
    it('links the deal name to the Explorer record when a base URL is set', () => {
        const { BodyHtml } = RenderDigest(ctx());
        expect(BodyHtml).toContain(
            'href="https://explorer.example.test/resource/record/MJ_BizApps_Sales%3A%20Deals/dddddddd-0000-4000-8000-000000000001"');
    });

    it('does not produce a double slash when the base URL ends in one', () => {
        const { BodyHtml } = RenderDigest(ctx({ explorerBaseUrl: 'https://explorer.example.test/' }));
        expect(BodyHtml).toContain('https://explorer.example.test/resource/record/');
        expect(BodyHtml).not.toContain('test//resource');
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty string', ''],
        ['a whitespace-only string', '   '],
    ])('renders the deal name as plain text when explorerBaseUrl is %s', (_label, base) => {
        const { BodyHtml } = RenderDigest(ctx({ explorerBaseUrl: base as string | null }));
        expect(BodyHtml).not.toContain('<a ');
        expect(BodyHtml).not.toContain('href=');
        expect(BodyHtml).not.toContain('/resource/record/');
        expect(BodyHtml).toContain('Widget renewal');
    });
});

describe('RenderDigest: row content', () => {
    it('renders "Not set" and "No close date" for a null close date', () => {
        const { BodyHtml } = RenderDigest(ctx({
            groups: [group([deal({ ExpectedCloseDate: null, DaysLapsed: null })])],
        }));
        expect(BodyHtml).toContain('Not set');
        expect(BodyHtml).toContain('No close date');
    });

    it('renders the close date and day count for a lapsed deal', () => {
        const { BodyHtml } = RenderDigest(ctx());
        expect(BodyHtml).toContain('2026-11-09');
        expect(BodyHtml).toContain('14 days');
        expect(BodyHtml).not.toContain('Not set');
    });

    it('says "1 day" rather than "1 days"', () => {
        const { BodyHtml } = RenderDigest(ctx({ groups: [group([deal({ DaysLapsed: 1 })])] }));
        expect(BodyHtml).toContain('1 day<');
        expect(BodyHtml).not.toContain('1 days');
    });

    it('formats the deal amount in whole dollars and shows a dash for a null amount', () => {
        const withAmount = RenderDigest(ctx({ groups: [group([deal({ Amount: 12500 })])] })).BodyHtml;
        expect(withAmount).toContain('$12,500');
        const noAmount = RenderDigest(ctx({ groups: [group([deal({ Amount: null })])] })).BodyHtml;
        expect(noAmount).toContain('&mdash;');
        expect(noAmount).not.toContain('$');
        expect(noAmount).not.toContain('null');
        expect(noAmount).not.toContain('NaN');
    });

    describe('currency', () => {
        const EUR_ID = 'EEEEEEEE-0000-4000-8000-0000000000EE';
        const codes = new Map([[EUR_ID, 'EUR']]);
        const render = (d: Partial<LapsedDeal>, currencyCodes?: ReadonlyMap<string, string>) =>
            RenderDigest(ctx({ groups: [group([deal({ Amount: 12500, ...d })])], currencyCodes })).BodyHtml;

        it("shows a deal in its own currency, whatever case the ID arrives in", () => {
            expect(render({ CurrencyID: EUR_ID.toLowerCase() }, codes)).toContain('\u20AC12,500');
            expect(render({ CurrencyID: EUR_ID.toLowerCase() }, codes)).not.toContain('$');
        });
        it('shows the default currency for a deal with no CurrencyID', () => {
            expect(render({ CurrencyID: null }, codes)).toContain('$12,500');
        });
        it('shows the default for a currency the host cannot resolve, or when no codes were read', () => {
            expect(render({ CurrencyID: 'ffffffff-0000-4000-8000-000000000000' }, codes)).toContain('$12,500');
            expect(render({ CurrencyID: EUR_ID }, new Map())).toContain('$12,500');
            expect(render({ CurrencyID: EUR_ID }, undefined)).toContain('$12,500');
        });
        it('falls back to the default rather than failing the email on a code Intl rejects', () => {
            const bad = new Map([[EUR_ID, 'not-a-code']]);
            expect(render({ CurrencyID: EUR_ID }, bad)).toContain('$12,500');
        });
        it('formats two deals in two currencies without combining them', () => {
            const body = RenderDigest(ctx({
                groups: [group([deal({ Amount: 1000, CurrencyID: EUR_ID }), deal({ ID: 'dddddddd-0000-4000-8000-000000000009', Amount: 2000 })])],
                currencyCodes: codes,
            })).BodyHtml;
            expect(body).toContain('\u20AC1,000');
            expect(body).toContain('$2,000');
        });
    });

    it('shows each deal\'s own figure and never a combined one', () => {
        const { BodyHtml } = RenderDigest(ctx({
            groups: [group([deal({ Amount: 1000 }), deal({ ID: 'dddddddd-0000-4000-8000-000000000002', Amount: 2000 })])],
        }));
        expect(BodyHtml).toContain('$1,000');
        expect(BodyHtml).toContain('$2,000');
        expect(BodyHtml).not.toContain('$3,000');
    });

    it('has no remote images or scripts', () => {
        const { BodyHtml } = RenderDigest(ctx());
        expect(BodyHtml).not.toMatch(/<img|<script|<link|@import/i);
    });
});

describe('RenderDigest: structure and copy', () => {
    it('uses the audience EmptyMessage when there are no groups', () => {
        const out = RenderDigest(ctx({
            audience: audience({ EmptyMessage: 'Nothing lapsed this week.' }), groups: [], dealsShown: 0,
        }));
        expect(out.BodyHtml).toContain('Nothing lapsed this week.');
        expect(out.BodyHtml).not.toContain('<table');
    });

    it('falls back to neutral copy for an empty digest with no EmptyMessage', () => {
        const out = RenderDigest(ctx({ groups: [], dealsShown: 0 }));
        expect(out.Subject).toBe('Lapsed close dates: No lapsed deals as of 2026-11-23');
        expect(out.BodyHtml).toContain('No open deals have a lapsed close date as of 2026-11-23.');
        expect(out.BodyHtml).not.toContain('Pat');
        expect(out.BodyHtml).not.toContain('Hi ');
    });

    it('resolves {Company} to the single group\'s name, and to "your companies" for several', () => {
        const a = audience({ SubjectTemplate: 'For {Company}' });
        expect(RenderDigest(ctx({ audience: a })).Subject).toBe('For Acme Test Co');
        const other = deal({ ID: 'dddddddd-0000-4000-8000-000000000002', CompanyID: 'cccccccc-0000-4000-8000-000000000002', CompanyName: 'Beta Test Co' });
        expect(RenderDigest(ctx({ audience: a, groups: [group([deal()]), group([other])] })).Subject).toBe('For your companies');
    });

    it.each([['an empty string', ''], ['whitespace', '  \n ']])(
        'falls back to the defaults when the template columns hold %s rather than NULL', (_l, blank) => {
            const out = RenderDigest(ctx({
                audience: audience({ SubjectTemplate: blank, IntroTemplate: blank }),
            }));
            expect(out.Subject).toBe('Lapsed close dates: 1 deal as of 2026-11-23');
            expect(out.BodyHtml).toContain('Hi Pat');
            const empty = RenderDigest(ctx({ audience: audience({ EmptyMessage: blank }), groups: [], dealsShown: 0 }));
            expect(empty.BodyHtml).toContain('No open deals');
        });

    it('falls back to neutral default copy when SubjectTemplate and IntroTemplate are null', () => {
        const out = RenderDigest(ctx({
            groups: [group([deal(), deal({ ID: 'dddddddd-0000-4000-8000-000000000002' })])],
        }));
        expect(out.Subject).toContain('2 deals');
        expect(out.Subject).toContain('2026-11-23');
        expect(out.BodyHtml).toContain('Hi Pat');
    });

    it('says "1 deal" in the default subject for a single deal', () => {
        expect(RenderDigest(ctx()).Subject).toContain('1 deal ');
    });

    it('uses SubjectTemplate when the audience has one', () => {
        const out = RenderDigest(ctx({ audience: audience({ SubjectTemplate: '{Count} lapsed on {Today}' }) }));
        expect(out.Subject).toBe('1 lapsed on 2026-11-23');
    });

    it('renders a company section header per group when GroupByCompany is true', () => {
        const other = deal({ ID: 'dddddddd-0000-4000-8000-000000000002', CompanyID: 'cccccccc-0000-4000-8000-000000000002', CompanyName: 'Beta Test Co' });
        const { BodyHtml } = RenderDigest(ctx({ groups: [group([deal()]), group([other])] }));
        expect(BodyHtml).toContain('>Acme Test Co</h2>');
        expect(BodyHtml).toContain('>Beta Test Co</h2>');
        expect(BodyHtml.match(/<h2/g)).toHaveLength(2);
    });

    it('omits company section headers when GroupByCompany is false', () => {
        const { BodyHtml } = RenderDigest(ctx({ audience: audience({ GroupByCompany: false }) }));
        expect(BodyHtml).not.toContain('<h2');
        expect(BodyHtml).toContain('Widget renewal');
    });

    it('says the list is incomplete when truncated, and never claims a complete count', () => {
        // The old footer read "Showing N of N" because the true total is unknowable once the read is
        // capped; that sat beside a truncation notice and said nothing was cut.
        const { BodyHtml } = RenderDigest(ctx({ truncated: true, dealsShown: 1 }));
        expect(BodyHtml).toContain('This list is incomplete');
        expect(BodyHtml).toContain('only 1 deal could be included');
        expect(BodyHtml).not.toMatch(/Showing \d+ of \d+/);
    });

    it('says nothing about truncation when truncated is false', () => {
        expect(RenderDigest(ctx({ truncated: false })).BodyHtml).not.toContain('incomplete');
    });
});

/**
 * THE PLAIN-TEXT PART. SendGrid (`text:` + `html:`) and Gmail build a real multipart/alternative from
 * both bodies, so a recipient on a text-only client reads THIS. It is rendered from the same groups as
 * the HTML, never derived from `BodyHtml`, so these tests assert the two stay the same digest while the
 * text half carries no markup — the defect that started this was markup arriving as plain text.
 */
describe('RenderDigest — the plain-text part', () => {
    const tagLike = /<[a-z/!]/i;

    it('carries no markup, entities or inline styles', () => {
        const { BodyText } = RenderDigest(ctx());
        expect(BodyText).not.toMatch(tagLike);
        expect(BodyText).not.toContain('style=');
        expect(BodyText).not.toContain('&lt;');
        expect(BodyText).not.toContain('&amp;');
        expect(BodyText).not.toContain('&nbsp;');
    });

    it('lists the same deal with its company, owner, stage, close date, lapse and amount', () => {
        const { BodyText } = RenderDigest(ctx());
        expect(BodyText).toContain('Widget renewal');
        expect(BodyText).toContain('Olive Owner');
        expect(BodyText).toContain('Proposal');
        expect(BodyText).toContain('close 2026-11-09');
        expect(BodyText).toContain('14 days lapsed');
        expect(BodyText).toContain('$12,500');
        expect(BodyText).toContain('Hi Pat,');
    });

    it('names the company as a heading when the audience groups by company', () => {
        const { BodyText } = RenderDigest(ctx({ audience: audience({ GroupByCompany: true }) }));
        expect(BodyText).toContain('Acme Test Co:');
    });

    it('puts the company on each deal line when the audience does not group', () => {
        const { BodyText } = RenderDigest(ctx({ audience: audience({ GroupByCompany: false }) }));
        expect(BodyText).not.toContain('Acme Test Co:');
        expect(BodyText).toMatch(/Widget renewal \| Acme Test Co \| Olive Owner/);
    });

    it('writes a hostile deal name literally, since nothing in a text part is escaped or executed', () => {
        const HOSTILE = `<script>alert("x")</script> & "Q" 'r'`;
        const { BodyText } = RenderDigest(ctx({ groups: [group([deal({ Name: HOSTILE })])] }));
        // Raw, not entities: the tag strip would have eaten it if the text came from the HTML.
        expect(BodyText).toContain('alert("x")');
        expect(BodyText).toContain('& "Q" \'r\'');
    });

    it('includes the deal link when a base URL is set, and no link at all when it is not', () => {
        const linked = RenderDigest(ctx()).BodyText;
        expect(linked).toContain('https://explorer.example.test/resource/record/');
        for (const base of [null, '', '   ']) {
            const bare = RenderDigest(ctx({ explorerBaseUrl: base as string | null })).BodyText;
            expect(bare).not.toContain('resource/record');
            expect(bare).not.toContain('http');
        }
    });

    it('shows the empty message, and no deal lines, for an audience with nothing lapsed', () => {
        const { BodyText } = RenderDigest(ctx({ groups: [], dealsShown: 0 }));
        expect(BodyText).toContain('No open deals have a lapsed close date as of 2026-11-23.');
        expect(BodyText).not.toContain('Widget renewal');
        expect(BodyText).not.toMatch(tagLike);
    });

    it('strips the tags out of a host-authored HTML intro rather than passing them through', () => {
        const { BodyText } = RenderDigest(ctx({
            audience: audience({ IntroTemplate: '<p>Morning <b>{RecipientFirstName}</b> &amp; team &mdash; {Count} to review:</p>' }),
        }));
        expect(BodyText).toContain('Morning Pat & team \u2014 1 to review:');
        expect(BodyText).not.toMatch(tagLike);
    });

    it('carries the incomplete-list notice when the run was truncated, and not otherwise', () => {
        expect(RenderDigest(ctx({ truncated: true, dealsShown: 1 })).BodyText).toContain('This list is incomplete');
        expect(RenderDigest(ctx({ truncated: false })).BodyText).not.toContain('incomplete');
    });

    it('shows a deal that never had a close date without inventing one', () => {
        const { BodyText } = RenderDigest(ctx({
            groups: [group([deal({ ExpectedCloseDate: null, DaysLapsed: null })])],
        }));
        expect(BodyText).toContain('close date not set');
        expect(BodyText).toContain('never had one');
    });
});
