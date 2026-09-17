import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { OwnerCoverage } from '../lib/pages/dashboard-inspect';
import type { DealRosterRow } from '../lib/workspace/deal-workspace.service';

/**
 * golive#207's copy, on the two surfaces that are NOT the deal form.
 *
 * #207 is written about the deal form, and every row of its replacement table landed there. The same
 * strings were still live on the pipeline board and the command-center dashboard, so the form read
 * "Entered manually" while the board said "Stated by a person" about the same number — which is the
 * complaint #207 was filed about, one screen over.
 *
 * ── ONE OF THESE WAS NOT A COPY PROBLEM ─────────────────────────────────────────────────────────
 *
 * The lock icon on a closing board column carried `title="Arriving here closes and locks the deal"`.
 * That is not developer voice, it is WRONG: `planStageDefaults` gates the stage-derived status on
 * `LocksDeal` and contributes nothing when it is set, so a deal moved into such a stage keeps the
 * status it had. And the move cannot happen anyway — `CanDropInto` refuses a closing column. A rep
 * reading the old text would have believed a drag closes a deal.
 */

const BOARD = readFileSync(new URL('../lib/board/deal-board.component.html', import.meta.url), 'utf8');

/**
 * Attribute values only, so a replacement quoted in an explanatory comment cannot satisfy a test
 * about the rendered tooltip. The board's comments now quote the old strings deliberately.
 */
const tooltips = [...BOARD.matchAll(/title="([^"]*)"/g)].map((m) => m[1]);

describe('the pipeline board speaks the same language as the deal form', () => {
    it('says "Priced by Orders", the wording #207 settled on', () => {
        expect(tooltips).toContain('Priced by Orders');
        expect(tooltips, 'the orders ENGINE is an implementation detail').not.toContain(
            'Priced by the orders engine',
        );
    });

    it('says a manual amount was entered manually, not "stated by a person"', () => {
        expect(tooltips).toContain('Entered manually rather than priced by Orders');
        expect(
            tooltips.filter((t) => t.includes('Stated by a person')),
            'the deal form dropped this phrase; the board kept it',
        ).toHaveLength(0);
    });
});

describe('the closing column says what the lock icon actually means', () => {
    it('no longer claims that arriving there closes the deal', () => {
        // The claim, not the phrasing, is the bug: the server refuses to derive a locking status from
        // a stage, so arriving changes nothing about the status.
        expect(
            tooltips.filter((t) => /Arriving here closes/i.test(t)),
            'a tooltip may not describe behaviour the server deliberately refuses',
        ).toHaveLength(0);
    });

    it('tells the user the column is not a destination, and where closing lives', () => {
        const lock = tooltips.find((t) => /cannot be moved here/i.test(t));
        expect(lock, `expected a closing-column tooltip, got ${JSON.stringify(tooltips)}`).toBeDefined();
        expect(lock).toBe('Deals cannot be moved here. Close a deal from the deal form.');
    });
});

/**
 * Only the four fields `OwnerCoverage` reads. `IsOpen` and `IncludeInCommit` are both true because
 * the function filters on them: a row missing either is dropped before the label is ever chosen, and
 * the test would then pass for the wrong reason.
 */
function row(over: Partial<DealRosterRow>): DealRosterRow {
    return {
        IsOpen: true,
        IncludeInCommit: true,
        Amount: 1000,
        OwnerEmployee: 'Dana Reyes',
        ...over,
    } as DealRosterRow;
}

describe('the dashboard labels an ownerless deal the way the deal form does', () => {
    // Behavioural, not source-level: `OwnerCoverage` is a pure function, so the label can be read off
    // the value it returns rather than off the file that produces it.
    it('buckets a deal with no owner under "No owner"', () => {
        const bars = OwnerCoverage([row({ OwnerEmployee: null, Amount: 5000 })]);
        expect(bars).toHaveLength(1);
        expect(bars[0].Name).toBe('No owner');
        expect(bars[0].Amount).toBe(5000);
    });

    it('treats a blank owner as no owner, not as an owner named ""', () => {
        // `?.trim() || fallback` is what makes this true; a `?? fallback` would produce an empty label.
        const bars = OwnerCoverage([row({ OwnerEmployee: '   ', Amount: 250 })]);
        expect(bars[0].Name).toBe('No owner');
    });

    it('still groups real owners by name, and sorts by amount', () => {
        const bars = OwnerCoverage([
            row({ OwnerEmployee: 'Dana Reyes', Amount: 100 }),
            row({ OwnerEmployee: null, Amount: 900 }),
            row({ OwnerEmployee: 'Dana Reyes', Amount: 300 }),
        ]);
        expect(bars.map((b) => [b.Name, b.Amount])).toEqual([
            ['No owner', 900],
            ['Dana Reyes', 400],
        ]);
    });
});
