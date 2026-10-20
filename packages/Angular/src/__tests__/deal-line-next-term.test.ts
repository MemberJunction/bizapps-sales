import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * "ADD AS NEXT TERM" STARTS WHERE ORDERS SAYS, AND THE DIALOG SHOWS THAT START.
 *
 * Orders starts an added term the day after the existing coverage ends, over any start the line
 * states. The dialog still offered an editable Term start for it, a date orders would ignore, and
 * printed the prompt's dates as raw `yyyy-MM-dd` beside a date field in the browser's format.
 */
const EDITOR = readFileSync(
    join(__dirname, '..', 'lib', 'form-panels', 'deal-line-editor.component.ts'),
    'utf8',
);

function editorTemplate(): string {
    const at = EDITOR.indexOf('template: `');
    const end = EDITOR.indexOf('styles: [', at);
    expect(at).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(at);
    return EDITOR.slice(at, end);
}

function editor(action: 'ExtendExisting' | 'CreateNew' | null, holdingEnd: string | null) {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    const start = new Date('2026-03-01T00:00:00Z');
    Object.defineProperty(e, 'Working', {
        value: { ProductID: 'prod-1', SubscriptionAction: action, ServicePeriodStart: start },
        writable: true, configurable: true,
    });
    e.Holding = holdingEnd
        ? { SubscriptionID: 'sub-1', SubscriptionNumber: 'SUB-0001', Status: 'Active', LatestTermEnd: new Date(`${holdingEnd}T00:00:00Z`) } as typeof e.Holding
        : null;
    return e;
}

describe('the Term start field when the line adds a term to a held subscription', () => {
    it('shows the continuation start instead of an input once "Add as next term" is chosen', () => {
        const e = editor('ExtendExisting', '2026-12-31');
        expect(e.TermStartFollowsHolding).toBe(true);
        expect(e.HoldingContinuationStart).toBe('2027-01-01');
    });

    it('keeps the input for a new subscription or an unanswered prompt', () => {
        expect(editor('CreateNew', '2026-12-31').TermStartFollowsHolding).toBe(false);
        expect(editor(null, '2026-12-31').TermStartFollowsHolding).toBe(false);
    });

    it('keeps the input when the continuation start is not known', () => {
        expect(editor('ExtendExisting', null).TermStartFollowsHolding).toBe(false);
    });

    /** Switching back to "New subscription" restores the rep's date, so it is never cleared. */
    it('leaves the line\'s own start alone', () => {
        const e = editor('ExtendExisting', '2026-12-31');
        e.SetSubscriptionAction('CreateNew');
        expect(e.Working?.ServicePeriodStart).toEqual(new Date('2026-03-01T00:00:00Z'));
        expect(e.TermStartFollowsHolding).toBe(false);
    });

    it('renders the read-only start inside the Term start gate, in place of the input', () => {
        const t = editorTemplate();
        const gate = t.indexOf('@if (ShowTermStart)');
        const readOnly = t.indexOf('data-testid="line-term-start-continuation"');
        const input = t.indexOf('data-testid="line-term-start"');
        expect(gate).toBeGreaterThan(-1);
        expect(readOnly).toBeGreaterThan(gate);
        expect(input).toBeGreaterThan(readOnly);
        expect(t.slice(gate, readOnly)).toMatch(/@if \(TermStartFollowsHolding/);
        expect(t.slice(readOnly, input)).toMatch(/HoldingContinuationStart \| mjoDate/);
        expect(t.slice(readOnly, input)).toMatch(/next term of \{\{ holding\.SubscriptionNumber \}\}/);
    });
});

describe('the subscription prompt dates', () => {
    it('render through orders\' mjoDate pipe, the format the line cards use', () => {
        const t = editorTemplate();
        expect(t).toContain('covered through {{ HoldingCoverageEnd | mjoDate }}');
        expect(t).toContain('starts {{ HoldingContinuationStart | mjoDate }}');
        expect(t).not.toMatch(/\{\{ Holding(CoverageEnd|ContinuationStart) \}\}/);
        expect(EDITOR).toMatch(/imports: \[[^\]]*MJODatePipe[^\]]*\]/);
    });
});
