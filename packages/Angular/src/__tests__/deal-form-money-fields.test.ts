import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealCommercialPanel } from '../lib/form-panels/deal-form.panels';

/**
 * MRR AND ARR READ AS BARE NUMBERS (bc-aidp-next-golive#259 item 5).
 *
 * They are `DECIMAL(19,4)` and `mj-form-field` has no currency to offer: its `FormatValue()` is
 * `String(value)`, `ExtendedType` has no currency member, and core's formatter only handles the `money`
 * SQL types. So `12500.0000` rendered as `12500` with nothing saying it was money. The panel now draws
 * the READ side itself, which means it also inherits the three questions the shared control answers
 * first -- and those are what this file is really about.
 *
 * `Object.create` holds the panel without standing up Angular, the way the other panel tests do.
 */

type RecordOpts = {
    values?: Record<string, unknown>;
    displayNames?: Record<string, string>;
    /** Fields field-level security denies the viewer. Reading one throws, as `BaseEntity.Get()` does. */
    deniedRead?: string[];
};

function panel(opts: { editMode?: boolean; locked?: boolean; record?: RecordOpts } = {}) {
    const r = opts.record ?? {};
    const values = r.values ?? {};

    const p = Object.create(MJSDealCommercialPanel.prototype) as MJSDealCommercialPanel;

    Object.defineProperty(p, 'EditMode', { value: opts.editMode ?? false, configurable: true });
    const denied = new Set(r.deniedRead ?? []);
    const viewer = { Name: 'someone' };
    Object.defineProperty(p, 'FormComponent', {
        value: { IsLocked: opts.locked ?? false, IsLost: false, ProviderToUse: { CurrentUser: viewer } },
        configurable: true,
    });
    Object.defineProperty(p, 'Record', {
        value: {
            Get: (name: string) => {
                if (denied.has(name)) throw new Error(`Field ${name} is not readable`);
                return values[name] ?? null;
            },
            EntityInfo: {
                Fields: Object.entries(r.displayNames ?? {}).map(([Name, DisplayNameOrName]) => ({
                    Name, DisplayNameOrName,
                })),
                IsFieldReadableByUser: (name: string, user: unknown) => user !== viewer || !denied.has(name),
            },
            ProviderToUse: { CurrentUser: { Name: 'someone' } },
        },
        configurable: true,
    });
    return p;
}

const MRR = { name: 'MRR', type: 'number' as const, currency: true };
const TERM = { name: 'TermMonths', type: 'number' as const };

describe('which control draws a money field', () => {
    it('draws it itself while reading', () => {
        expect(panel().DrawsOwnMoney(MRR)).toBe(true);
    });

    it('hands it back to the shared control the moment it is editable', () => {
        expect(panel({ editMode: true }).DrawsOwnMoney(MRR)).toBe(false);
    });

    it('keeps drawing it in edit mode on a LOCKED deal, where the field is not editable', () => {
        // The close lock makes MRR read-only even in edit mode, so the formatted read row is still
        // the right thing to show -- not an input the server would refuse.
        expect(panel({ editMode: true, locked: true }).DrawsOwnMoney(MRR)).toBe(true);
    });

    it('never claims a field that is not money', () => {
        expect(panel().DrawsOwnMoney(TERM)).toBe(false);
        expect(panel({ editMode: true }).DrawsOwnMoney(TERM)).toBe(false);
    });
});

describe('what a self-drawn money field shows', () => {
    it('formats as currency, with cents', () => {
        const p = panel({ record: { values: { MRR: 12500 } } });
        expect(p.MoneyValue(MRR)).toBe('$12,500.00');
    });

    it('keeps the cents a rounded headline figure would drop', () => {
        const p = panel({ record: { values: { MRR: 1234.56 } } });
        expect(p.MoneyValue(MRR)).toBe('$1,234.56');
    });

    it('reads its label from metadata, so it tracks the same rows every other label does', () => {
        const p = panel({ record: { values: { MRR: 1 }, displayNames: { MRR: 'MRR' } } });
        expect(p.MoneyLabel(MRR)).toBe('MRR');
    });

    it('falls back to the field name when metadata has no display name', () => {
        expect(panel().MoneyLabel(MRR)).toBe('MRR');
    });
});

describe('the responsibilities inherited from the control it replaced', () => {
    /**
     * FIELD SECURITY (#403). The shared control asks whether the viewer may read a field before it
     * reads one; a row drawn here inherits that duty. The fixture's `Get` throws for a denied field,
     * as `BaseEntity.Get()` does, so these also prove the check runs BEFORE the read.
     */
    it('never prints a field the viewer may not read, and never reads it', () => {
        const p = panel({ record: { values: { MRR: 12500 }, deniedRead: ['MRR'] } });
        expect(p.ShowsMoney(MRR)).toBe(false);
        expect(p.MoneyValue(MRR)).toBe('');
    });

    it('hides only the denied field, not its neighbours', () => {
        const ARR = { name: 'ARR', type: 'number' as const, currency: true };
        const p = panel({ record: { values: { MRR: 1, ARR: 12 }, deniedRead: ['MRR'] } });
        expect(p.ShowsMoney(MRR)).toBe(false);
        expect(p.ShowsMoney(ARR)).toBe(true);
    });

    it('shows a readable field that has a value', () => {
        const p = panel({ record: { values: { MRR: 12500 } } });
        expect(p.ShowsMoney(MRR)).toBe(true);
    });

    it('hides an empty field while reading, exactly as every other empty field hides', () => {
        expect(panel({ record: { values: { MRR: null } } }).ShowsMoney(MRR)).toBe(false);
    });

    it('treats zero as a value rather than as emptiness', () => {
        // A deal with no recurring revenue is a fact about the deal. Hiding it would read as
        // "nobody filled this in", which is a different statement.
        const p = panel({ record: { values: { MRR: 0 } } });
        expect(p.MoneyValue(MRR)).toBe('$0.00');
        expect(p.ShowsMoney(MRR)).toBe(true);
    });
});

describe('the fields the Commercial section treats as money', () => {
    it('marks Amount, MRR and ARR and nothing else', () => {
        const p = panel();
        const money = p.Fields.filter((f) => f.currency).map((f) => f.name);
        expect(money).toEqual(['Amount', 'MRR', 'ARR']);
    });

    it('gives Currency a record link now that it resolves to one', () => {
        const p = panel();
        expect(p.Fields.find((f) => f.name === 'CurrencyID')?.link).toBe('Record');
    });
});
