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
import { DiscountPercentToFraction, DiscountFractionToPercent } from '../packages/Entities/dist/discount-conversion.js';

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

console.log('\n  round trip\n');
for (const p of [0, 1, 10, 12.5, 25, 100]) {
    const f = DiscountPercentToFraction(p);
    const back = f.Ok ? DiscountFractionToPercent(f.Fraction) : NaN;
    ok(`${p}% survives percent -> fraction -> percent`, Math.round(back * 1e9) / 1e9, p);
}

console.log(`\n  ${failures === 0 ? 'discount-conversion: clean' : `discount-conversion: ${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
