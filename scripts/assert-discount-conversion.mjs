/**
 * Gate: the discount conversion, in BOTH directions.
 *
 * Retiring `DealLine` moved every discount across a unit boundary — `DealLine.RequestedDiscountPct`
 * was `0..100`, `OrderLine.DiscountPct` is `0..1` (docs/DECISIONS.md D-DL1). This runs on the real
 * built module rather than a copy of its logic, so it fails if the conversion changes underneath it.
 *
 * A plain node script on purpose: it is the same shape as `assert-no-vocabulary-comparisons.mjs`, and
 * this repo has no unit-test runner installed (`test:unit` names vitest, which is not a dependency).
 * Adding one to assert two functions would be more infrastructure than the thing being asserted.
 *
 * Usage: node scripts/assert-discount-conversion.mjs
 */
import {
    DiscountPercentToFraction,
    DiscountFractionToPercent,
    DISCOUNT_PERCENT_DECIMALS,
    DISCOUNT_FRACTION_DECIMALS,
} from '../packages/Entities/dist/discount-conversion.js';

let failures = 0;

function ok(label, actual, expected) {
    const pass = actual === expected;
    if (!pass) failures++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : `  — expected ${expected}, got ${actual}`}`);
}

function refused(label, percent) {
    const r = DiscountPercentToFraction(percent);
    const pass = r.Ok === false && typeof r.Reason === 'string' && r.Reason.length > 0;
    if (!pass) failures++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : '  — it was ACCEPTED, or refused with no reason'}`);
}

function accepted(label, percent, fraction) {
    const r = DiscountPercentToFraction(percent);
    const pass = r.Ok === true && Math.abs(r.Fraction - fraction) < 1e-12;
    if (!pass) failures++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : `  — expected ${fraction}, got ${r.Ok ? r.Fraction : 'REFUSED: ' + r.Reason}`}`);
}

console.log('\n  percent -> fraction (the write path)\n');
accepted('0 means no discount',                          0,    0);
accepted('1 percent becomes 0.01',                       1,    0.01);
accepted('10 percent becomes 0.1',                       10,   0.1);
accepted('12.5 percent becomes 0.125',                   12.5, 0.125);
accepted('100 percent becomes 1',                        100,  1);
accepted('not stated is treated as no discount',         null, 0);
accepted('undefined is treated as no discount',          undefined, 0);

console.log('\n  the refusals — the whole reason this module exists\n');
refused('0.5 is AMBIGUOUS and must not be guessed',      0.5);
refused('0.1 is ambiguous too',                          0.1);
refused('0.999 is ambiguous',                            0.999);
refused('101 is not a percentage',                       101);
refused('a negative discount is refused',                -5);
refused('NaN is refused',                                Number.NaN);
refused('Infinity is refused',                           Number.POSITIVE_INFINITY);

console.log('\n  fraction -> percent (the display path)\n');
ok('0 shows as 0',        DiscountFractionToPercent(0),    0);
ok('0.01 shows as 1',     DiscountFractionToPercent(0.01), 1);
ok('0.1 shows as 10',     DiscountFractionToPercent(0.1),  10);
ok('1 shows as 100',      DiscountFractionToPercent(1),    100);
ok('null shows as 0',     DiscountFractionToPercent(null), 0);

/**
 * ── THE ROUND TRIP USED TO ROUND BEFORE IT COMPARED, WHICH IS WHY IT PASSED ─────
 *
 * The assertion was `ok(..., Math.round(back * 1e9) / 1e9, p)`. Nine decimals of slack absorbs
 * the entire defect: `29` came back as `28.999999999999996` and the gate rounded it to `29`
 * before looking. A gate that normalises the thing it is checking is checking something else.
 *
 * The samples hid it too. `[0, 1, 10, 12.5, 25, 100]` are all exact in binary floating point.
 * Exactly 8 of the 101 whole percents are not, and none of the 8 was in the list. Both defences
 * had to fail together for this to stay green, and they did.
 *
 * Compared exactly now, and the dirty 8 are named rather than sampled.
 */
console.log('\n  round trip: percent -> fraction -> percent, compared EXACTLY\n');
for (const p of [0, 1, 10, 12.5, 25, 100]) {
    const f = DiscountPercentToFraction(p);
    const back = f.Ok ? DiscountFractionToPercent(f.Fraction) : NaN;
    ok(`${p}% survives percent -> fraction -> percent`, back, p);
}

console.log('\n  the 8 whole percents that binary floating point does NOT round-trip\n');
for (const p of [7, 14, 28, 29, 55, 56, 57, 58]) {
    const f = DiscountPercentToFraction(p);
    const back = f.Ok ? DiscountFractionToPercent(f.Fraction) : NaN;
    ok(`${p}% comes back as ${p}, not ${p - 1}.999...`, back, p);
}

/**
 * ── THE DIRECTION NOBODY TESTED: STORAGE FIRST ──────────────────────────────
 *
 * Every case above starts with a rep typing. The workspace's actual sequence starts with a
 * STORED fraction: it reads `OrderLine.DiscountPct`, renders it as a percent, and the number
 * input hands that percent straight back on the next change. So the trip that matters is
 * fraction -> percent -> fraction, and it was not tested at all.
 *
 * `DECIMAL(7,4)` bounds the domain exactly -- 10,001 storable fractions from 0.0000 to 1.0000 --
 * so every one of them is checked. A defect covering 15% of that domain survived for want of one
 * sample in the right place; a sweep is cheap enough that sampling has no excuse.
 */
console.log('\n  round trip: fraction -> percent -> fraction, over EVERY storable value\n');
{
    const step = 10 ** -DISCOUNT_FRACTION_DECIMALS;
    const total = Math.round(1 / step) + 1;
    const drifted = [];
    const wronglyRefused = [];
    for (let i = 0; i < total; i++) {
        const stored = Number((i * step).toFixed(DISCOUNT_FRACTION_DECIMALS));
        const shown = DiscountFractionToPercent(stored);
        // The sub-one-percent band is refused on re-entry BY DESIGN; asserted separately below.
        if (shown > 0 && shown < 1) continue;
        const back = DiscountPercentToFraction(shown);
        if (!back.Ok) wronglyRefused.push(`${stored} -> ${shown}`);
        else if (back.Fraction !== stored) drifted.push(`${stored} -> ${shown} -> ${back.Fraction}`);
    }
    ok(`no storable fraction is refused outside the ambiguous band (of ${total})`,
       wronglyRefused.length, 0);
    if (wronglyRefused.length) console.log(`        e.g. ${wronglyRefused.slice(0, 3).join(' | ')}`);
    ok(`no storable fraction comes back as a different number (of ${total})`, drifted.length, 0);
    if (drifted.length) console.log(`        e.g. ${drifted.slice(0, 3).join(' | ')}`);
}

/**
 * ── THE SUB-ONE-PERCENT DISCOUNT, WHICH IS REAL DATA ──────────────────────────
 *
 * `DECIMAL(7,4)` holds `0.0050` exactly, so half a percent is a storable, legitimately
 * negotiated discount rather than a rounding artefact. It renders as `0.5`, which the entry
 * guard refuses as ambiguous -- and that refusal is CORRECT: a human typing `0.5` into a percent
 * box could mean either reading, and the fraction reading passes every constraint downstream.
 *
 * What the module owes is that the number it DISPLAYS is exact. `0.0099` used to render as
 * `0.9900000000000001`, so the figure on screen was wrong and the refusal quoted the noise back
 * at the rep. Pinned here so the display path cannot regress into arithmetic nobody can read.
 *
 * The saving half of the fix is not in this module and cannot be reached from here: the
 * workspace stops feeding its own output back through the entry guard, so an untouched
 * sub-percent discount saves. See `SetDiscountPercent` in `deal-workspace.component.ts`.
 */
console.log('\n  sub-one-percent: displayed exactly, still refused on re-entry\n');
ok('0.005 displays as exactly 0.5',    DiscountFractionToPercent(0.005),  0.5);
ok('0.0025 displays as exactly 0.25',  DiscountFractionToPercent(0.0025), 0.25);
ok('0.0075 displays as exactly 0.75',  DiscountFractionToPercent(0.0075), 0.75);
ok('0.0099 displays as exactly 0.99, not 0.9900000000000001',
   DiscountFractionToPercent(0.0099), 0.99);
refused('a TYPED 0.5 is still ambiguous and still refused', 0.5);
refused('a TYPED 0.99 is still refused',                    0.99);

console.log('\n  the stated precision is the one the column can hold\n');
ok('percent carries 2 decimals',  DISCOUNT_PERCENT_DECIMALS,  2);
ok('fraction carries 4 decimals', DISCOUNT_FRACTION_DECIMALS, 4);
ok('12.345 is stored at the precision that exists, not the one typed',
   DiscountPercentToFraction(12.345).Fraction, 0.1235);
/**
 * ROUNDING MUST NOT PROMOTE AN AMBIGUOUS ENTRY INTO AN ACCEPTED ONE. `0.996` rounds to `1.00`,
 * which the guard accepts as one percent -- so had the rounding been applied before the band
 * check, the step meant to make the answer exact would manufacture a confident answer out of an
 * ambiguous question. The order of those two steps is load-bearing, so it is asserted.
 */
refused('0.996 is refused, NOT rounded up into an accepted 1%', 0.996);
refused('0.999 stays refused now that rounding exists',        0.999);

console.log(`\n  ${failures === 0 ? 'discount-conversion: clean' : `discount-conversion: ${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
