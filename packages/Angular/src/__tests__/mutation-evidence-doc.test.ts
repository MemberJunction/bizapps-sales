import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    LoadRegisteredChecks,
    RenderMutationEvidenceDoc,
    VerifyMutationAnchors,
} from '../../../../scripts/write-mutation-evidence.mjs';

const REPO = join(__dirname, '../../../..');

describe('write-mutation-evidence (#384, #385, #393, #429)', () => {
    it('matches every mutant anchor in test-harnesses/mutate-checks.mjs exactly once', () => {
        const { mutations, drifted } = VerifyMutationAnchors(REPO);
        expect(drifted).toEqual([]);
        expect(mutations.some((m: { id: string; expect: string[] }) => m.id === 'M-SD40' && m.expect.includes('SD40'))).toBe(true);
        expect(mutations.some((m: { id: string; expect: string[] }) => m.id === 'M-CD40' && m.expect.includes('CD40'))).toBe(true);
    });

    it('matches expected-check-counts.json across all 14 bundles', () => {
        const { expectedCounts, bundles } = LoadRegisteredChecks(REPO);
        const actualCounts = Object.fromEntries(bundles.map((b: { bundle: string; ids: string[] }) => [b.bundle, b.ids.length]));
        expect(actualCounts).toEqual(expectedCounts);
    });

    it('keeps docs/CHECK-MUTATION-EVIDENCE.md in sync with the generator', () => {
        const current = readFileSync(join(REPO, 'docs/CHECK-MUTATION-EVIDENCE.md'), 'utf8');
        expect(current).toBe(RenderMutationEvidenceDoc(REPO));
    });
});
