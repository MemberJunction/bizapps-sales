import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BuildLeftNavSections, PrimaryActionFor, SubPagesFor } from '../lib/nav/sales-nav.model';
import { DefaultCompanyID, OrderPipelinesByCompany, type CompanyPipeline } from '../lib/data/company-pipelines';

/**
 * The Settings page, where an administrator turns Hide pipelines on or off for everyone.
 *
 * Before it, the setting could only be changed in Data Explorer's Application Settings grid. The page
 * is listed only for users who may write that entity, since the server refuses anyone else's save.
 */

const section = readFileSync(new URL('../lib/sections/sales-section.component.html', import.meta.url), 'utf8');
const board = readFileSync(new URL('../lib/board/deal-board.component.html', import.meta.url), 'utf8');

describe('the Settings rail page', () => {
    it('is listed, under Admin, only for users who may change the settings', () => {
        expect(SubPagesFor('deals').map((p) => p.Id)).not.toContain('settings');
        const admin = BuildLeftNavSections(SubPagesFor('deals', { CanChangeSettings: true }));
        expect(admin.at(-1)).toMatchObject({ label: 'Admin', items: [{ id: 'settings' }] });
    });

    it('offers no create action', () => {
        expect(PrimaryActionFor('settings')).toBeNull();
    });

    it('is mounted by the section and re-reads the dashboard on a change', () => {
        expect(section).toMatch(/@if \(Page === 'settings'\)/);
        expect(section).toContain('(HidePipelinesChange)="OnHidePipelinesChanged()"');
    });
});

/** The body of the `@if (...) {` block that opens at `opener`, up to its matching closing brace. */
function blockBody(template: string, opener: string): string {
    const start = template.indexOf(opener);
    expect(start, `${opener} is in the template`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = start + opener.length - 1; i < template.length; i++) {
        if (template[i] === '{' && template[i + 1] !== '{' && template[i - 1] !== '{') depth++;
        if (template[i] === '}' && template[i + 1] !== '}' && template[i - 1] !== '}' && --depth === 0) {
            return template.slice(start + opener.length, i);
        }
    }
    throw new Error(`${opener} is never closed`);
}

describe('the board with pipelines hidden', () => {
    it('shows no pipeline tabs, pipeline name or company name in its bar', () => {
        const guarded = blockBody(board, '@if (!HidePipelines) {');
        const rest = board.replace(guarded, '');
        for (const part of ['db-bar__label', 'db-pipeline-tabs', 'db-pipeline-all', 'db-pipeline-one', 'TabLabel(']) {
            expect(guarded, `${part} sits inside the HidePipelines guard`).toContain(part);
            expect(rest, `${part} is drawn nowhere outside it`).not.toContain(part);
        }
    });
});

describe('the dashboard stage card with pipelines hidden', () => {
    it('names its tabs through the shared rule, so one company never reads twice alike', () => {
        expect(section).toContain('@for (pipeline of FunnelTabs; track pipeline.ID) {');
        expect(section).toContain('{{ pipeline.Label }}');
        expect(section).not.toContain('FunnelTabLabel(');
    });
});

describe('the default company once the default pipeline serves every company', () => {
    const row = (companyID: string, companyName: string): CompanyPipeline => ({
        ID: 'p-one',
        Name: 'B2B',
        Code: 'B2B',
        CompanyID: companyID,
        CompanyName: companyName,
        IsDefault: true,
        DisplayRank: 10,
    });

    it('is the company the pipeline was first linked to, not the first by name', () => {
        // Links read oldest first: Home was linked before Acme and Zeta were added.
        const links = [row('c-home', 'Home'), row('c-zeta', 'Zeta'), row('c-acme', 'Acme')];
        expect(DefaultCompanyID(links)).toBe('c-home');
        expect(OrderPipelinesByCompany(links)[0].CompanyID).toBe('c-home');
    });
});
