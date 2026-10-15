import { describe, expect, it } from 'vitest';
import {
    CompanyLabel,
    DefaultCompanyID,
    InitialCompanyID,
    OrderPipelinesByCompany,
    PipelineCompanies,
    PipelineLabel,
    PipelinesForCompany,
    type CompanyPipeline,
} from '../lib/data/company-pipelines';

/**
 * #327: every company can carry its own copy of the default pipeline, so the pickers group pipelines
 * by company, put the default company first, and say which company each option sells as.
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
        expect(InitialCompanyID(PIPELINES, 'ACME-B2B'.toLowerCase())).toBe(ACME);
    });

    it('opens on the default company for a deal with no pipeline yet', () => {
        expect(InitialCompanyID(PIPELINES, null)).toBe(HOME);
    });

    it('opens on the default company when the deal\'s pipeline is not offered', () => {
        expect(InitialCompanyID(PIPELINES, 'inactive-pipeline')).toBe(HOME);
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
