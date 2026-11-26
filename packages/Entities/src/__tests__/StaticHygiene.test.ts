import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const SLICE2_TS_FILES: readonly string[] = [
    'packages/Entities/src/__tests__/DealProposalArtifact.test.ts',
    'packages/Entities/src/__tests__/StaticHygiene.test.ts',
    'packages/CoreEntitiesServer/src/DealArtifactPermissionDelegate.ts',
    'packages/CoreEntitiesServer/src/__tests__/DealArtifactPermissionDelegate.test.ts',
    'packages/IntegrationTests/src/checks/deal-proposal-artifact.checks.ts',
];

interface WorldSummary {
    dealsCount: number;
    linkedDealsCount: number;
    unlinkedLegacyDealsCount: number;
    artifactsCount: number;
    artifactVersionsCount: number;
    artifactPermissionsCount: number;
    magicLinkInvitesCount: number;
    guestShareLinksCount: number;
}

interface WorldDealEntry {
    id: string;
    dealNumber: string;
    proposalArtifactId: string | null;
}

interface WorldManifest {
    summary: WorldSummary;
    deals: WorldDealEntry[];
}

function stripCommentsAndStringsForTypeScan(source: string): string {
    return source
        .split(/\r?\n/)
        .filter((line) => {
            const trimmed = line.trim();
            return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        })
        .join('\n');
}

describe('Slice 2 strict TypeScript & entity accessor hygiene', () => {
    for (const relPath of SLICE2_TS_FILES) {
        it(`${relPath} contains zero any, zero unknown, and zero legacy .Get()/.Set() calls`, () => {
            const fullPath = `${REPO_ROOT}${relPath}`;
            expect(existsSync(fullPath)).toBe(true);
            const raw = readFileSync(fullPath, 'utf8');
            const code = stripCommentsAndStringsForTypeScan(raw);

            // Disallow explicit `any` type annotations / casts
            expect(code).not.toMatch(/:\s*any\b/);
            expect(code).not.toMatch(/\bas\s+any\b/);
            expect(code).not.toMatch(/<\s*any\s*>/);

            // Disallow lazy `unknown` type annotations / casts
            expect(code).not.toMatch(/:\s*unknown\b/);
            expect(code).not.toMatch(/\bas\s+unknown\b/);
            expect(code).not.toMatch(/Record<\s*string\s*,\s*unknown\s*>/);

            // Disallow legacy BaseEntity.Get()/Set() calls
            expect(code).not.toMatch(/\.\s*Get\s*\(\s*['"]/);
            expect(code).not.toMatch(/\.\s*Set\s*\(\s*['"]/);
        });
    }
});

describe('Dual-DBMS seed fixture density and SQL Server <-> PostgreSQL lockstep parity', () => {
    it('maintains >= 20 realistic deals with linked artifacts, pinned versions, and guest share links identically across SQL Server and PostgreSQL', () => {
        const worldPath = `${REPO_ROOT}packages/IntegrationTests/world/deal-proposal-world.json`;
        const sqlSeedPath = `${REPO_ROOT}scripts/seed-sales-deals.sql`;
        const pgSeedPath = `${REPO_ROOT}scripts/seed-sales-deals.pg.sql`;

        expect(existsSync(worldPath)).toBe(true);
        expect(existsSync(sqlSeedPath)).toBe(true);
        expect(existsSync(pgSeedPath)).toBe(true);

        const world = JSON.parse(readFileSync(worldPath, 'utf8')) as WorldManifest;
        const sqlSeed = readFileSync(sqlSeedPath, 'utf8');
        const pgSeed = readFileSync(pgSeedPath, 'utf8');

        expect(world.summary.dealsCount).toBeGreaterThanOrEqual(20);
        expect(world.summary.linkedDealsCount).toBeGreaterThanOrEqual(10);
        expect(world.summary.unlinkedLegacyDealsCount).toBeGreaterThanOrEqual(5);
        expect(world.summary.artifactsCount).toBe(world.summary.linkedDealsCount);
        expect(world.summary.artifactVersionsCount).toBeGreaterThanOrEqual(world.summary.artifactsCount);
        expect(world.summary.guestShareLinksCount).toBeGreaterThanOrEqual(4);
        expect(world.summary.magicLinkInvitesCount).toBe(world.summary.guestShareLinksCount);

        for (const deal of world.deals) {
            expect(sqlSeed).toContain(deal.id);
            expect(pgSeed).toContain(deal.id);
            expect(sqlSeed).toContain(deal.dealNumber);
            expect(pgSeed).toContain(deal.dealNumber);
            if (deal.proposalArtifactId !== null) {
                expect(sqlSeed).toContain(deal.proposalArtifactId);
                expect(pgSeed).toContain(deal.proposalArtifactId);
            }
        }
    });
});
