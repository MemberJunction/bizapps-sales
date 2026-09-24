import { expect } from 'vitest';

/**
 * `before` happened, `after` happened, and every `before` happened first.
 *
 * ── TWO VACUOUS SHAPES THIS AVOIDS, BOTH FOUND IN THIS REPO ────────────────────────────────────
 *
 * NOT a bare `indexOf(a) < indexOf(b)`: a call that never happened indexes to -1, and -1 is less than
 * everything, so that shape passes LOUDEST exactly when the step it guards has been deleted. Both
 * positions are proved present first.
 *
 * And NOT `indexOf` for the `before` position either, which is the subtler one. Comparing the FIRST
 * occurrence of each says nothing about a `before` that also happens AFTERWARDS: the sequence
 * `[Save, Reopen, Save]` satisfies `indexOf('Save') < indexOf('Reopen')` while containing the very bug
 * these suites exist to catch — a save landing on a row the operation has already moved. `lastIndexOf`
 * asks the question the callers actually mean: did ALL of `before` finish before `after` began?
 *
 * Shared by the form-side and workspace-side reopen suites, which had a copy each. Fixing one copy and
 * not the other is how the weaker version survives.
 */
export function expectOrder(calls: readonly string[], before: string, after: string): void {
    expect(calls, `${before} must have happened`).toContain(before);
    expect(calls, `${after} must have happened`).toContain(after);
    expect(
        calls.lastIndexOf(before),
        `every ${before} must come before ${after} — got ${JSON.stringify(calls)}`,
    ).toBeLessThan(calls.indexOf(after));
}
