import '@angular/compiler';
import { afterAll, describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * The line editor's term start shows the stored day in every time zone (bizapps-sales#392).
 *
 * `OrderHeader.OrderDate` and `OrderLine.ServicePeriodStart` are `DATE` columns. MJ's SQL Server
 * provider leaves `date` values as the driver returns them, UTC midnight, and the editor formats them
 * from their UTC parts. Explorer spec 82 compares that rendering with `CONVERT(varchar(10), OrderDate,
 * 23)`, a zone-free string, so the two agree on any host.
 *
 * THE ZONE IS PINNED to both extremes because CI runs `TZ=UTC`, where local and UTC getters agree and
 * this file would pass through the defect it guards. UTC midnight read with LOCAL getters is the day
 * before west of Greenwich; a bare `YYYY-MM-DD` parsed as LOCAL midnight is the day before in UTC
 * east of it. Node re-reads `process.env.TZ` on assignment.
 */

/** Put the process zone back; assigning `undefined` would store the string "undefined". */
function restoreTZ(original: string | undefined): void {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
}

/** An editor showing a line with `stored` as its own term start, on an order dated `orderDate`. */
function editor(stored: Date | string | null, orderDate: Date | string | null): MJSDealLineEditorComponent {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    Object.assign(e, {
        Working: { ServicePeriodStart: stored },
        Deal: { OrderID_Object: { OrderDate: orderDate } },
    });
    return e;
}

const ZONES = ['Pacific/Kiritimati', 'Etc/GMT+12'];   // UTC+14 and UTC-12 (POSIX signs are inverted)
const DAY = '2026-09-30';
const SHAPES: Array<[string, Date | string]> = [
    ['a Date at UTC midnight, as MJ delivers a DATE column', new Date(`${DAY}T00:00:00.000Z`)],
    ['a full ISO string', `${DAY}T00:00:00.000Z`],
    ['a bare day string', DAY],
];

describe('the term start control shows the stored day in any zone', () => {
    const original = process.env.TZ;
    afterAll(() => {
        restoreTZ(original);
    });

    it('premise: UTC midnight read with local getters is the day before at UTC-12', () => {
        process.env.TZ = 'Etc/GMT+12';
        expect(new Date(`${DAY}T00:00:00.000Z`).getDate()).toBe(29);
    });

    for (const zone of ZONES) {
        for (const [label, value] of SHAPES) {
            it(`shows the order date from ${label} as ${DAY} in ${zone}`, () => {
                process.env.TZ = zone;
                expect(editor(null, value).TermStartInput).toBe(DAY);
            });

            it(`shows a stored term start from ${label} as ${DAY} in ${zone}`, () => {
                process.env.TZ = zone;
                expect(editor(value, '2026-01-15').TermStartInput).toBe(DAY);
            });
        }
    }
});
