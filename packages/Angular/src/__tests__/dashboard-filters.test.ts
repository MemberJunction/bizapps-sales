/**
 * @fileoverview The dashboard's filter bar rules (bc-aidp-next-golive#350).
 *
 * An empty list is "All" and must reach no query as a parameter: `sqlIn` renders an empty list as
 * `(NULL)`, which matches nothing, so sending one would zero every figure.
 */
import { describe, expect, it } from 'vitest';

import {
    CleanIDs,
    FilterParameters,
    HasFilters,
    NO_FILTERS,
    PipelineOptionsFor,
    PipelinesWithinCompanies,
    SameFilters,
    SelectionLabel,
    ToggleID,
} from '../lib/pages/dashboard-filters';
import { FilterInspect, OpenInPeriod } from '../lib/pages/dashboard-inspect';
import { RosterRow } from './helpers/roster-row';

const PIPELINES = [
    { ID: 'P1', CompanyID: 'C1' },
    { ID: 'P2', CompanyID: 'C1' },
    { ID: 'P3', CompanyID: 'C2' },
];

describe('FilterParameters', () => {
    it('sends nothing for "All", so no query receives an empty list', () => {
        expect(FilterParameters(NO_FILTERS)).toEqual({});
        expect(HasFilters(NO_FILTERS)).toBe(false);
    });

    it('sends each list that narrows, as the parameter the queries declare', () => {
        expect(FilterParameters({ ...NO_FILTERS, CompanyIDs: ['C1', ' ', 'c1'], ProductCompanyIDs: ['PC1'] })).toEqual({
            CompanyIDs: ['C1'],
            ProductCompanyIDs: ['PC1'],
        });
    });
});

describe('the lists', () => {
    it('drop blanks and repeats, ignoring case', () => {
        expect(CleanIDs(['a', 'A', '', null, ' b '])).toEqual(['a', 'b']);
    });

    it('toggle a choice on and off', () => {
        expect(ToggleID(['a'], 'b')).toEqual(['a', 'b']);
        expect(ToggleID(['a', 'b'], 'A')).toEqual(['b']);
    });

    it('compare as sets', () => {
        expect(SameFilters({ ...NO_FILTERS, OwnerEmployeeIDs: ['e1', 'e2'] }, { ...NO_FILTERS, OwnerEmployeeIDs: ['E2', 'e1'] })).toBe(true);
        expect(SameFilters({ ...NO_FILTERS, OwnerEmployeeIDs: ['e1'] }, NO_FILTERS)).toBe(false);
    });

    it('label a button with what is picked', () => {
        const options = [{ ID: 'C1', Name: 'Acme' }, { ID: 'C2', Name: 'Birch' }];
        expect(SelectionLabel([], options)).toBe('All');
        expect(SelectionLabel(['C1'], options)).toBe('Acme');
        expect(SelectionLabel(['C2', 'C1'], options)).toBe('Birch +1');
    });
});

describe('pipeline choices follow the selling companies', () => {
    it('offer only the selected companies\' pipelines, or all with none selected', () => {
        expect(PipelineOptionsFor(PIPELINES, ['C2']).map((p) => p.ID)).toEqual(['P3']);
        expect(PipelineOptionsFor(PIPELINES, []).map((p) => p.ID)).toEqual(['P1', 'P2', 'P3']);
    });

    it('drop a selected pipeline whose company is no longer selected', () => {
        expect(PipelinesWithinCompanies(['P1', 'P3'], PIPELINES, ['C1'])).toEqual(['P1']);
        expect(PipelinesWithinCompanies(['P1', 'P3'], PIPELINES, [])).toEqual(['P1', 'P3']);
    });
});

describe('the lists a filtered dashboard draws from', () => {
    const Q4 = { Key: 'quarter' as const, Label: 'This quarter', Start: '2026-10-01', End: '2026-12-31' };

    it('a stage column lists the open deals in that stage and the period', () => {
        const rows = [
            RosterRow({ ID: 'in', IsOpen: true, PipelineStageID: 'S1', ExpectedCloseDate: '2026-11-01' }),
            RosterRow({ ID: 'later', IsOpen: true, PipelineStageID: 'S1', ExpectedCloseDate: '2027-02-01' }),
            RosterRow({ ID: 'other', IsOpen: true, PipelineStageID: 'S2', ExpectedCloseDate: '2026-11-01' }),
            RosterRow({ ID: 'unstaged', IsOpen: true, PipelineID: 'P1', ExpectedCloseDate: '2026-11-01' }),
        ];
        expect(FilterInspect(rows, 'stage', '2026-10-10', Q4, 's1').map((d) => d.ID)).toEqual(['in']);
        expect(FilterInspect(rows, 'stage', '2026-10-10', Q4, 'unstaged:p1').map((d) => d.ID)).toEqual(['unstaged']);
    });

    it('an owner row lists that owner\'s Commit deals in the period, and "none" the ownerless ones', () => {
        const rows = [
            RosterRow({ ID: 'mine', IsOpen: true, IncludeInCommit: true, OwnerEmployeeID: 'E1', ExpectedCloseDate: '2026-11-01' }),
            RosterRow({ ID: 'not-commit', IsOpen: true, OwnerEmployeeID: 'E1', ExpectedCloseDate: '2026-11-01' }),
            RosterRow({ ID: 'nobody', IsOpen: true, IncludeInCommit: true, ExpectedCloseDate: '2026-11-01' }),
        ];
        expect(FilterInspect(rows, 'owner', '2026-10-10', Q4, 'e1').map((d) => d.ID)).toEqual(['mine']);
        expect(FilterInspect(rows, 'owner', '2026-10-10', Q4, 'none').map((d) => d.ID)).toEqual(['nobody']);
    });

    it('idle lists the open deals whose IDs it is given', () => {
        const rows = [RosterRow({ ID: 'D1', IsOpen: true }), RosterRow({ ID: 'D2', IsOpen: true })];
        expect(FilterInspect(rows, 'idle', '2026-10-10', undefined, null, new Set(['d2'])).map((d) => d.ID)).toEqual(['D2']);
    });

    it('an open deal with no expected close date is in no bounded period, and in All time', () => {
        const undated = RosterRow({ ID: 'u', IsOpen: true });
        expect(OpenInPeriod(undated, Q4)).toBe(false);
        expect(OpenInPeriod(undated)).toBe(true);
    });
});
