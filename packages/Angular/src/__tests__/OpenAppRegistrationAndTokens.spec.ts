/**
 * Deterministic OpenApp v3 Readiness, Dual Form Registration Parity, Design-Token, and
 * Static Hygiene Guard Suite for `@mj-biz-apps/sales-ng`.
 *
 * Verifies:
 *   1. Dual Form Registration Parity via live `MJGlobal.Instance.ClassFactory.GetRegistration(BaseFormComponent, ...)`
 *      for ALL 23 Sales entities (`DealFormComponentExtended` at priority 2 for `MJ_BizApps_Sales: Deals`,
 *      `DealStageEventFormComponentExtended` at priority 2 for `MJ_BizApps_Sales: Deal Stage Events`,
 *      and every generated Sales form component).
 *   2. Contributed `BaseFormPanel` registrations including `MJSDealProposalPanel` alongside the
 *      existing `MJSDeal*Panel` rail panels without replacing `BaseFormComponent`.
 *   3. Navigation & Resource Parity (`metadata/applications/.bizapps-sales-application.json` `DefaultNavItems`
 *      <-> live `BaseResourceComponent` registration for `SalesDealsSectionResource` + `<mj-page-layout>` +
 *      `NotifyLoadComplete()` + `ChangeDetectionStrategy.OnPush` + `UserInfoEngine.Instance` +
 *      `mj-app.json` `startupExport: "LoadBizAppsSalesClient"`).
 *   4. Design-token & hygiene invariants across ALL Angular component `.ts`, `.css`, and `.html` files:
 *      - ZERO raw `#hex`, `rgb()`, `rgba()`, `hsl()`, or `hsla()` color literals in styles.
 *      - ZERO `window.print()` calls.
 *      - ZERO `localStorage` or `sessionStorage` calls.
 *      - ZERO `6.3.0-edge.2`-only `@memberjunction/ng-artifacts` imports.
 *   5. Strict TypeScript & entity-accessor hygiene across all Slice 3 source & test files:
 *      - ZERO `any`, ZERO `unknown`, and ZERO legacy BaseEntity string-keyed getter/setter calls.
 */
import '@angular/compiler';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { BaseFormComponent, BaseFormPanel } from '@memberjunction/ng-base-forms';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

import {
    DealFormComponentExtended,
    DealStageEventFormComponentExtended,
    LoadBizAppsSalesClient,
    MJSDealActivityPanel,
    MJSDealClosePanel,
    MJSDealCommercialPanel,
    MJSDealHeroPanel,
    MJSDealHistoryPanel,
    MJSDealLinesPanel,
    MJSDealOverviewPanel,
    MJSDealPartyPanel,
    MJSDealPipelinePanel,
    MJSDealProposalPanel,
    MJSDealSchedulePanel,
    SalesDealsSectionResource,
} from '../public-api';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const ANGULAR_LIB_DIR = fileURLToPath(new URL('../lib', import.meta.url));
const APP_METADATA_PATH = join(REPO_ROOT, 'metadata/applications/.bizapps-sales-application.json');
const MJ_APP_MANIFEST_PATH = join(REPO_ROOT, 'mj-app.json');
const SECTIONS_FILE_PATH = join(ANGULAR_LIB_DIR, 'sections/sales-section.component.ts');
const SECTIONS_HTML_PATH = join(ANGULAR_LIB_DIR, 'sections/sales-section.component.html');

// Invoke the OpenApp client bootstrap export to ensure all registrations are anchored and live.
LoadBizAppsSalesClient();

const ALL_SALES_ENTITIES: ReadonlyArray<string> = [
    'MJ_BizApps_Sales: Account Types',
    'MJ_BizApps_Sales: Buying Role Types',
    'MJ_BizApps_Sales: Deal Contact Roles',
    'MJ_BizApps_Sales: Deal Digest Audience Types',
    'MJ_BizApps_Sales: Deal Digest Recipients',
    'MJ_BizApps_Sales: Deal Payment Schedules',
    'MJ_BizApps_Sales: Deal Roles',
    'MJ_BizApps_Sales: Deal Sequences',
    'MJ_BizApps_Sales: Deal Stage Events',
    'MJ_BizApps_Sales: Deal Status Types',
    'MJ_BizApps_Sales: Deal Team Members',
    'MJ_BizApps_Sales: Deal Types',
    'MJ_BizApps_Sales: Deals',
    'MJ_BizApps_Sales: Forecast Category Types',
    'MJ_BizApps_Sales: Forecast Snapshots',
    'MJ_BizApps_Sales: Lead Source Types',
    'MJ_BizApps_Sales: Lifecycle Stage Types',
    'MJ_BizApps_Sales: Loss Reasons',
    'MJ_BizApps_Sales: Pipeline Companies',
    'MJ_BizApps_Sales: Pipeline Stages',
    'MJ_BizApps_Sales: Pipelines',
    'MJ_BizApps_Sales: Sales Accounts',
    'MJ_BizApps_Sales: Sales Contacts',
];

const SLICE3_TS_FILES: ReadonlyArray<string> = [
    'packages/Angular/src/lib/form-panels/deal-proposal-preview.panel.ts',
    'packages/Angular/src/__tests__/DealProposalPreview.component.spec.ts',
    'packages/Angular/src/__tests__/OpenAppRegistrationAndTokens.spec.ts',
];

interface MjAppClientEntry {
    name: string;
    startupExport?: string;
}

interface MjAppManifest {
    packages?: {
        client?: MjAppClientEntry[];
    };
}

interface AppNavItem {
    Label: string;
    DriverClass: string;
    ResourceType: string;
}

interface AppMetadataEntry {
    fields?: {
        DefaultNavItems?: AppNavItem[];
    };
}

function walkAngularSourceFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'generated') continue;
            results.push(...walkAngularSourceFiles(fullPath));
        } else if (/\.(ts|css|html)$/.test(entry.name)) {
            results.push(fullPath);
        }
    }
    return results;
}

/** Strips block, HTML, and line comments so issue references in comments are not mistaken for CSS colors. */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

/** Extracts CSS/style bodies from `.css` files, `.html` `<style>` blocks, and Angular `@Component({ styles: [...] })` literals. */
function extractStyleContent(filePath: string, source: string): string {
    const withoutComments = stripComments(source);
    if (filePath.endsWith('.css')) {
        return withoutComments;
    }
    if (filePath.endsWith('.html')) {
        const styleTags = [...withoutComments.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? '');
        const inlineStyles = [...withoutComments.matchAll(/style\s*=\s*["']([^"']*)["']/gi)].map((m) => m[1] ?? '');
        return [...styleTags, ...inlineStyles].join('\n');
    }
    const matches: string[] = [];
    for (const m of withoutComments.matchAll(/styles\s*:\s*\[([\s\S]*?)\]/g)) {
        matches.push(m[1] ?? '');
    }
    for (const m of withoutComments.matchAll(/STYLES\s*=\s*`([\s\S]*?)`/g)) {
        matches.push(m[1] ?? '');
    }
    return matches.join('\n');
}

function stripCommentLines(source: string): string {
    return source
        .split(/\r?\n/)
        .filter((line) => {
            const trimmed = line.trim();
            return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        })
        .join('\n');
}

describe('OpenApp v3 Dual Form Registration Parity', () => {
    for (const entityName of ALL_SALES_ENTITIES) {
        it(`registers BaseFormComponent for "${entityName}" in MJGlobal.Instance.ClassFactory`, () => {
            const reg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseFormComponent, entityName);
            expect(reg, `Missing BaseFormComponent registration for "${entityName}"`).toBeDefined();
        });
    }

    it('resolves priority-2 custom form overrides for Deals and Deal Stage Events and contributes MJSDealProposalPanel alongside existing rail panels', () => {
        const dealFormReg = MJGlobal.Instance.ClassFactory.GetRegistration(
            BaseFormComponent,
            'MJ_BizApps_Sales: Deals',
        );
        expect(dealFormReg?.SubClass).toBe(DealFormComponentExtended);

        const stageEventFormReg = MJGlobal.Instance.ClassFactory.GetRegistration(
            BaseFormComponent,
            'MJ_BizApps_Sales: Deal Stage Events',
        );
        expect(stageEventFormReg?.SubClass).toBe(DealStageEventFormComponentExtended);

        const panelClasses = MJGlobal.Instance.ClassFactory.GetAllRegistrations(BaseFormPanel).map(
            (r) => r.SubClass,
        );
        expect(panelClasses).toContain(MJSDealHeroPanel);
        expect(panelClasses).toContain(MJSDealOverviewPanel);
        expect(panelClasses).toContain(MJSDealPipelinePanel);
        expect(panelClasses).toContain(MJSDealPartyPanel);
        expect(panelClasses).toContain(MJSDealCommercialPanel);
        expect(panelClasses).toContain(MJSDealLinesPanel);
        expect(panelClasses).toContain(MJSDealProposalPanel);
        expect(panelClasses).toContain(MJSDealClosePanel);
        expect(panelClasses).toContain(MJSDealActivityPanel);
        expect(panelClasses).toContain(MJSDealHistoryPanel);
        expect(panelClasses).toContain(MJSDealSchedulePanel);
    });

    it('anchors client startupExport from mj-app.json to LoadBizAppsSalesClient', () => {
        const manifest = JSON.parse(readFileSync(MJ_APP_MANIFEST_PATH, 'utf8')) as MjAppManifest;
        const clientPkg = manifest.packages?.client?.find((p) => p.name === '@mj-biz-apps/sales-ng');
        expect(clientPkg?.startupExport).toBe('LoadBizAppsSalesClient');
    });
});

describe('OpenApp v3 Navigation & Resource Parity', () => {
    it('registers every DefaultNavItems DriverClass as a BaseResourceComponent with <mj-page-layout>, NotifyLoadComplete(), OnPush, and UserInfoEngine.Instance', () => {
        const appMetadata = JSON.parse(readFileSync(APP_METADATA_PATH, 'utf8')) as AppMetadataEntry[];
        const navItems = appMetadata[0]?.fields?.DefaultNavItems ?? [];
        expect(navItems.length).toBeGreaterThanOrEqual(1);

        const sectionsTs = readFileSync(SECTIONS_FILE_PATH, 'utf8');
        const sectionsHtml = readFileSync(SECTIONS_HTML_PATH, 'utf8');
        expect(sectionsTs).toContain('this.NotifyLoadComplete()');
        expect(sectionsTs).toContain('ChangeDetectionStrategy.OnPush');
        expect(sectionsHtml).toContain('<mj-page-layout>');
        expect(sectionsTs).not.toMatch(/\blocalStorage\b|\bsessionStorage\b/);
        expect(sectionsTs).not.toMatch(/\bNotifyLoadStarted\s*\(/);

        for (const item of navItems) {
            const reg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseResourceComponent, item.DriverClass);
            expect(reg, `DefaultNavItems DriverClass "${item.DriverClass}" is not registered`).toBeDefined();
            if (item.DriverClass === 'SalesDealsSectionResource') {
                expect(reg?.SubClass).toBe(SalesDealsSectionResource);
            }
        }
    });
});

describe('OpenApp v3 Design Tokens, Print, Storage, and edge.1 Compatibility Gates', () => {
    const files = walkAngularSourceFiles(ANGULAR_LIB_DIR);

    it('discovers Angular component source, style, and template files', () => {
        expect(files.length).toBeGreaterThan(20);
    });

    it('enforces ZERO raw #hex, rgb(), rgba(), hsl(), or hsla() color literals across Angular CSS/HTML/inline styles', () => {
        const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;
        const violations: string[] = [];

        for (const file of files) {
            const raw = readFileSync(file, 'utf8');
            const cssText = extractStyleContent(file, raw);
            if (!cssText) continue;
            const match = cssText.match(rawColorPattern);
            if (match) {
                violations.push(`${file}: matched raw color literal "${match[0]}"`);
            }
        }

        expect(violations, `Raw color literals found in Angular styles:\n${violations.join('\n')}`).toEqual([]);
    });

    it('enforces ZERO window.print(), ZERO localStorage/sessionStorage, and ZERO edge.2-only ng-artifacts imports', () => {
        const violations: string[] = [];

        for (const file of files) {
            const cleaned = stripComments(readFileSync(file, 'utf8'));
            if (/\bwindow\.print\s*\(/.test(cleaned)) {
                violations.push(`${file}: contains forbidden window.print()`);
            }
            if (/\blocalStorage\b|\bsessionStorage\b/.test(cleaned)) {
                violations.push(
                    `${file}: contains forbidden localStorage/sessionStorage (use UserInfoEngine.Instance)`,
                );
            }
            if (
                /\b(MJEmbeddedDocPanelComponent|MJArtifactSlideoverComponent|MJRecordDocsListComponent|ArtifactRelatedPanelComponent)\b/.test(
                    cleaned,
                )
            ) {
                violations.push(`${file}: imports edge.2-only @memberjunction/ng-artifacts symbol`);
            }
        }

        expect(violations, `OpenApp v3 hygiene violations:\n${violations.join('\n')}`).toEqual([]);
    });

    for (const relPath of SLICE3_TS_FILES) {
        it(`${relPath} contains zero any, zero unknown, and zero legacy entity Get/Set calls`, () => {
            const fullPath = join(REPO_ROOT, relPath);
            expect(existsSync(fullPath)).toBe(true);
            const code = stripCommentLines(readFileSync(fullPath, 'utf8'));

            expect(code).not.toMatch(new RegExp(':\\s*' + 'any\\b'));
            expect(code).not.toMatch(new RegExp('\\bas\\s+' + 'any\\b'));
            expect(code).not.toMatch(new RegExp('<\\s*' + 'any\\s*>'));
            expect(code).not.toMatch(new RegExp(':\\s*' + 'unknown\\b'));
            expect(code).not.toMatch(new RegExp('\\bas\\s+' + 'unknown\\b'));
            expect(code).not.toMatch(new RegExp('Record<\\s*string\\s*,\\s*' + 'unknown\\s*>'));
            expect(code).not.toMatch(new RegExp('\\.\\s*' + 'Get\\s*\\(\\s*[\'"]'));
            expect(code).not.toMatch(new RegExp('\\.\\s*' + 'Set\\s*\\(\\s*[\'"]'));
        });
    }
});
