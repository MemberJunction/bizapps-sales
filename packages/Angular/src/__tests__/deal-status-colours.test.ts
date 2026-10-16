/**
 * @fileoverview The deal grids colour the Status column from the status FLAGS, not its name.
 *
 * The rules used to match "Won", "Lost" and "Open" by name, so Abandoned (lost) and On Hold (no
 * flag) got no colour, and a renamed won status lost its green.
 */
import { describe, expect, it } from 'vitest';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';

import { DealPipelineGridState, DealPipelineViewWith, DealStatusColourRules } from '../lib/pages/deal-views';
import type { DealStatusLookup } from '../lib/workspace/deal-workspace.types';

const status = (Name: string, flags: Partial<DealStatusLookup>): DealStatusLookup => ({
    ID: Name, Name, IsOpen: false, IsClosed: false, IsWon: false, IsLost: false, LocksDeal: false, ...flags,
});

const STATUSES = [
    status('Open', { IsOpen: true }),
    status('Signed', { IsWon: true, IsClosed: true }),
    status('Lost', { IsLost: true, IsClosed: true }),
    status('Abandoned', { IsLost: true, IsClosed: true }),
    status('On Hold', {}),
];

const styleOf = (name: string) => DealStatusColourRules(STATUSES).find((r) => r.value === name)?.style;

describe('DealStatusColourRules', () => {
    it('gives every status one equals rule', () => {
        const rules = DealStatusColourRules(STATUSES);
        expect(rules.map((r) => r.value)).toEqual(STATUSES.map((s) => s.Name));
        expect(rules.every((r) => r.condition === 'equals')).toBe(true);
    });

    it('styles Abandoned as lost, because its flag says lost', () => {
        expect(styleOf('Abandoned')).toEqual(styleOf('Lost'));
    });

    it('keeps green on a won status whatever it is called', () => {
        expect(styleOf('Signed')?.color).toBe('#047857');
    });

    it('gives a status with no flag the neutral style', () => {
        const neutral = styleOf('On Hold');
        expect(neutral).toBeDefined();
        expect(neutral).not.toEqual(styleOf('Open'));
        expect(neutral).not.toEqual(styleOf('Lost'));
    });
});

describe('DealPipelineViewWith', () => {
    const grid = DealPipelineGridState();
    const template = {
        WhereClause: '',
        GridState: JSON.stringify(grid),
        GridStateObject: grid,
    } as unknown as MJUserViewEntityExtended;

    it("writes the rules into the copy's Status column and leaves the template alone", async () => {
        const copy = await DealPipelineViewWith(template, 'ID IN (1)', DealStatusColourRules(STATUSES));
        const column = JSON.parse(copy.GridState!).columnSettings.find((c: { Name: string }) => c.Name === 'DealStatusType');
        expect(column.format.conditionalRules).toHaveLength(STATUSES.length);
        expect(copy.WhereClause).toBe('ID IN (1)');
        expect(template.GridState).toBe(JSON.stringify(grid));
    });

    it('keeps the template GridState when no rules are given', async () => {
        expect((await DealPipelineViewWith(template)).GridState).toBe(template.GridState);
    });
});
