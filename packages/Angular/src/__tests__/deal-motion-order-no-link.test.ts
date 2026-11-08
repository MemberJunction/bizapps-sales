import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FormContext } from '@memberjunction/ng-base-forms';
import { MJSDealMotionPanel } from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#331: the Motion panel's Order field opened the draft order on an OPEN deal.
 *
 * #226 item 4 made the order unreachable from an open deal, and the Motion row was meant to stop
 * linking by omitting `link`. It did not: `mj-form-field` links any foreign key with a mapped name
 * field whatever `LinkType` says, and only `FormContext.enableRecordLinks` turns that off. These pin
 * the field to a context with links off, and pin the template to actually use it.
 */
const FORM_CONTEXT: FormContext = { sectionFilter: '', showEmptyFields: false, enableRecordLinks: true };

function panel(locked = false): MJSDealMotionPanel {
    const p = new MJSDealMotionPanel();
    p.FormContext = FORM_CONTEXT;
    Object.defineProperty(p, 'FormComponent', { value: { IsLocked: locked } as unknown, configurable: true });
    return p;
}

function spec(p: MJSDealMotionPanel, name: string) {
    const f = p.Fields.find((x) => x.name === name);
    if (!f) throw new Error(`Motion has no ${name} field`);
    return f;
}

describe('Motion: the Order field is not a way into the order', () => {
    it('renders OrderID with record links off', () => {
        const p = panel();
        expect(p.FieldFormContext(spec(p, 'OrderID'))?.enableRecordLinks).toBe(false);
    });

    it('leaves the contract fields linking', () => {
        const p = panel();
        expect(p.FieldFormContext(spec(p, 'ContractID'))).toBe(FORM_CONTEXT);
        expect(p.FieldFormContext(spec(p, 'RenewsContractID'))).toBe(FORM_CONTEXT);
    });

    it('keeps every other setting of the form context', () => {
        const p = panel();
        const ctx = p.FieldFormContext(spec(p, 'OrderID'));
        expect({ ...ctx, enableRecordLinks: true }).toEqual(FORM_CONTEXT);
    });

    it('returns the same object on every read until the form context changes', () => {
        const p = panel();
        const order = spec(p, 'OrderID');
        const first = p.FieldFormContext(order);
        expect(p.FieldFormContext(order)).toBe(first);

        p.FormContext = { ...FORM_CONTEXT, sectionFilter: 'order' };
        const next = p.FieldFormContext(order);
        expect(next).not.toBe(first);
        expect(next?.sectionFilter).toBe('order');
        expect(next?.enableRecordLinks).toBe(false);
    });

    it('never offers OrderID for editing, on an open deal or a locked one', () => {
        expect(panel(false).FieldEditable('OrderID')).toBe(false);
        expect(panel(true).FieldEditable('OrderID')).toBe(false);
    });

    it('binds the Motion fields to FieldFormContext, not the bare form context', () => {
        const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
        const motion = source.slice(source.indexOf("selector: 'mjs-deal-motion-panel'"));
        const template = motion.slice(0, motion.indexOf('export class MJSDealMotionPanel'));
        expect(template).toContain('<mj-form-field');
        expect(template).toContain('[FormContext]="FieldFormContext(f)"');
    });
});
