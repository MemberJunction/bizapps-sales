import { describe, expect, it } from 'vitest';
import {
    CompanyLabel,
    DefaultCompanyID,
    DistinctPipelines,
    ExpandPipelinesByCompany,
    InitialCompanyID,
    OrderPipelinesByCompany,
    PipelineCompanies,
    PipelineLabel,
    PipelineServesCompany,
    PipelinesForCompany,
    type CompanyPipeline,
    type PipelineCompanyLink,
    type PipelineRecord,
} from '../lib/data/company-pipelines';

/**
 * #327: the pickers group pipelines by the companies they serve, put the default company first, and
 * say which company each option sells as.
 */

const HOME = 'C-HOME';
const ACME = 'c-acme';
const BETA = 'C-BETA';

function pipeline(overrides: Partial<CompanyPipeline> & Pick<CompanyPipeline, 'ID'>): CompanyPipeline {
    return { Name: 'B2B', Code: 'B2B', CompanyID: HOME, CompanyName: 'Home Co', IsDefault: false, DisplayRank: 10, ...overrides };
}

const PIPELINES: CompanyPipeline[] = [
    pipeline({ ID: 'beta-b2b', CompanyID: BETA, CompanyName: 'Beta' }),
    pipeline({ ID: 'acme-legacy', Name: 'Acme Legacy', Code: 'ACME-OLD', CompanyID: ACME, CompanyName: 'Acme', DisplayRank: 0 }),
    pipeline({ ID: 'home-d2c', Name: 'D2C', Code: 'D2C', DisplayRank: 20 }),
    pipeline({ ID: 'acme-b2b', CompanyID: ACME, CompanyName: 'Acme' }),
    pipeline({ ID: 'home-b2b', IsDefault: true }),
];

describe('pipeline order', () => {
    it('puts the default company first, then the others by name', () => {
        const ids = OrderPipelinesByCompany(PIPELINES).map((p) => p.ID);
        expect(ids).toEqual(['home-b2b', 'home-d2c', 'acme-b2b', 'acme-legacy', 'beta-b2b']);
    });

    it('puts a company\'s copy of the default pipeline before its legacy pipelines, whatever their rank', () => {
        const acme = PipelinesForCompany(PIPELINES, ACME).map((p) => p.ID);
        expect(acme).toEqual(['acme-b2b', 'acme-legacy']);
    });

    it('does not reorder its input', () => {
        const input = [...PIPELINES];
        OrderPipelinesByCompany(input);
        expect(input).toEqual(PIPELINES);
    });

    it('falls back to company name order when no pipeline is the default', () => {
        const noDefault = PIPELINES.map((p) => ({ ...p, IsDefault: false }));
        expect(PipelineCompanies(noDefault).map((c) => c.CompanyName)).toEqual(['Acme', 'Beta', 'Home Co']);
        expect(DefaultCompanyID(noDefault)).toBe(ACME);
    });
});

describe('the company filter', () => {
    it('lists each company once, default company first', () => {
        expect(PipelineCompanies(PIPELINES).map((c) => c.CompanyID)).toEqual([HOME, ACME, BETA]);
    });

    it('offers only the chosen company\'s pipelines, matching ids in any case', () => {
        expect(PipelinesForCompany(PIPELINES, 'C-ACME').map((p) => p.ID)).toEqual(['acme-b2b', 'acme-legacy']);
    });

    it('offers every pipeline when no company is chosen', () => {
        expect(PipelinesForCompany(PIPELINES, null)).toHaveLength(PIPELINES.length);
    });

    it('opens on the deal\'s own company, not the default one', () => {
        expect(InitialCompanyID(PIPELINES, ACME)).toBe(ACME);
    });

    it('opens on the default company for a deal with no company yet', () => {
        expect(InitialCompanyID(PIPELINES, null)).toBe(HOME);
        expect(InitialCompanyID(PIPELINES, '')).toBe(HOME);
    });
});

/**
 * A pipeline serves every company it is actively linked to (`PipelineCompany`), so a shared pipeline
 * becomes one `CompanyPipeline` row per company.
 */
describe('a pipeline shared by several companies', () => {
    const SHARED = 'shared-b2b';
    const RECORDS: PipelineRecord[] = [
        { ID: SHARED, Name: 'B2B', Code: 'B2B', IsDefault: true, DisplayRank: 10 },
        { ID: 'acme-only', Name: 'Acme Only', Code: 'ACME', IsDefault: false, DisplayRank: 20 },
        { ID: 'unlinked', Name: 'Orphan', Code: 'ORPHAN', IsDefault: false, DisplayRank: 30 },
    ];
    const LINKS: PipelineCompanyLink[] = [
        { PipelineID: SHARED, CompanyID: HOME, Company: 'Home Co' },
        { PipelineID: 'SHARED-B2B', CompanyID: ACME, Company: 'Acme' },
        { PipelineID: 'acme-only', CompanyID: ACME, Company: 'Acme' },
    ];
    const rows = ExpandPipelinesByCompany(RECORDS, LINKS);

    it('expands to one row per linked company, matching ids in any case', () => {
        expect(rows.map((r) => `${r.ID}/${r.CompanyID}/${r.CompanyName}`)).toEqual([
            `${SHARED}/${HOME}/Home Co`,
            `${SHARED}/${ACME}/Acme`,
            `acme-only/${ACME}/Acme`,
        ]);
    });

    it('leaves out a pipeline with no link, since no deal could be saved on it', () => {
        expect(rows.find((r) => r.ID === 'unlinked')).toBeUndefined();
    });

    it('offers the shared pipeline under each company it serves', () => {
        expect(PipelinesForCompany(rows, HOME).map((p) => p.ID)).toEqual([SHARED]);
        expect(PipelinesForCompany(rows, ACME).map((p) => p.ID)).toEqual([SHARED, 'acme-only']);
    });

    it('lists it once when no company is chosen', () => {
        expect(PipelinesForCompany(rows, null).map((p) => p.ID)).toEqual([SHARED, 'acme-only']);
    });

    it('keeps the first row of each pipeline, in the order given', () => {
        const distinct = DistinctPipelines(rows);
        expect(distinct.map((p) => `${p.ID}/${p.CompanyID}`)).toEqual([`${SHARED}/${HOME}`, `acme-only/${ACME}`]);
    });

    it('says which companies a pipeline serves', () => {
        expect(PipelineServesCompany(rows, SHARED, HOME)).toBe(true);
        expect(PipelineServesCompany(rows, SHARED, ACME.toUpperCase())).toBe(true);
        expect(PipelineServesCompany(rows, 'acme-only', HOME)).toBe(false);
        expect(PipelineServesCompany(rows, null, HOME)).toBe(false);
        expect(PipelineServesCompany(rows, SHARED, null)).toBe(false);
    });

    it('starts a new deal on the default pipeline\'s first company', () => {
        expect(DefaultCompanyID(rows)).toBe(HOME);
    });
});

describe('labels', () => {
    it('names the company in each pipeline option', () => {
        expect(PipelineLabel(PIPELINES[0])).toBe('B2B (Beta)');
    });

    it('shows the bare name when the company has none', () => {
        expect(PipelineLabel({ Name: 'B2B', CompanyName: null })).toBe('B2B');
        expect(CompanyLabel({ CompanyID: 'x', CompanyName: null })).toBe('Unnamed company');
    });
});
