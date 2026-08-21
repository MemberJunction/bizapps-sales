/**
 * Gate: the workspace's validation projection — pane attribution, and what blocks a save.
 *
 * ── WHY THIS GATE EXISTS, AND WHY BOTH DEFECTS IT COVERS WERE INVISIBLE ─────────────────────────
 *
 * Two confirmed defects lived here, and neither was reachable by any integration check, because both
 * are in code that only a BROWSER path exercises:
 *
 *   1. `parseChildSource` anchored the collection on `[A-Za-z]+`, and `EmbeddedRecord.prefixError` now
 *      emits `OrderID_Object.Lines[3].Quantity`. Neither `_` nor `.` matches, so every order-line error
 *      fell through to the default pane with a null row index: Save disabled, the Lines badge reading 0,
 *      no row marked, and the message shown on Party info.
 *
 *   2. A refused discount did not block the save. The refusal lived in a map the template read and
 *      `CanSave` never consulted, so a rep typed `0.5`, saw the refusal, and saved a line still holding
 *      `0.10`.
 *
 * ── RUN ON THE BUILT MODULE, NOT A COPY OF ITS LOGIC ────────────────────────────────────────────
 *
 * Same shape as `assert-discount-conversion.mjs`, and for the same reason: importing the real
 * `dist/lib/workspace/deal-workspace.validation.js` means this gate fails if the projection changes
 * underneath it. A gate that re-implements the thing it checks agrees with itself forever.
 *
 * A plain node script because this repo has no unit-test runner installed — `test:unit` names vitest,
 * which is not a dependency. Adding one to assert three functions would be more infrastructure than the
 * thing being asserted.
 *
 * Usage: node scripts/assert-workspace-validation.mjs
 */
import {
    DiscountRefusalIssues,
    MergeValidation,
    ProjectValidation,
} from '../packages/Angular/dist/lib/workspace/deal-workspace.validation.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join as joinPath } from 'node:path';

let failures = 0;

function ok(label, actual, expected) {
    const pass = actual === expected;
    if (!pass) failures += 1;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : `  — expected ${expected}, got ${actual}`}`);
}

/** A minimal stand-in for what `DealEntity.Validate()` hands back. */
function result(errors) {
    return { Success: errors.length === 0, Errors: errors };
}

/** One field error as MJ shapes it — `Source` is the part that carries the path. */
function fieldError(source, message) {
    return { Source: source, Message: message, Type: 'Failure', Value: null };
}

console.log('\n  pane attribution — where a child error lands\n');

/**
 * THE DEFECT, DIRECTLY. An embedded-record path must land on the LINES pane, on the row that carries
 * it. Before the fix this produced `party` and a null index.
 */
{
    const projected = ProjectValidation(result([
        fieldError('OrderID_Object.Lines[3].Quantity', 'Quantity must be greater than zero'),
    ]));
    const issue = projected.Issues[0];
    ok('an embedded-record line error lands on the LINES pane', issue?.Section, 'lines');
    ok('and carries the row index from the path', issue?.RowIndex, 3);
    ok('and names the field', issue?.Field, 'Quantity');
    ok('and it is an error, so it blocks', projected.IsValid, false);
}

/**
 * THE OLD SHAPE MUST STILL WORK. A regex that only understood the prefixed form would move the bug
 * rather than fix it — a direct child of the deal still emits the bare form.
 */
{
    const projected = ProjectValidation(result([
        fieldError('PaymentSchedule[1].Amount', 'Amount is required'),
    ]));
    const issue = projected.Issues[0];
    ok('an UN-prefixed child error still lands on its own pane', issue?.Section, 'schedule');
    ok('and still carries its row index', issue?.RowIndex, 1);
}

/**
 * A HEADER ERROR MUST NOT BE MISREAD AS A CHILD. `[A-Za-z0-9_.]+` is looser than what it replaced, so
 * this is the case that would break if it were loosened too far — a field name containing a dot must
 * not be parsed as a collection path.
 */
{
    const projected = ProjectValidation(result([fieldError('Name', 'Name cannot be null')]));
    ok('a plain field error is not treated as a child', projected.Issues[0]?.RowIndex, null);
}

console.log('\n  what blocks a save\n');

{
    const clean = { IsValid: true, Issues: [] };
    const warning = [{ Section: 'lines', Field: null, RowIndex: null, Severity: 'warning', Message: 'fyi' }];
    const refusal = DiscountRefusalIssues([{ RowIndex: 2, Reason: 'Is 0.5 half a percent or fifty?' }]);

    ok('a refusal is produced as an ERROR', refusal[0]?.Severity, 'error');
    ok('on the lines pane', refusal[0]?.Section, 'lines');
    ok('against the row that caused it', refusal[0]?.RowIndex, 2);

    ok('warnings alone leave the deal saveable', MergeValidation(clean, warning, []).IsValid, true);

    /**
     * THE ASSERTION THAT WOULD HAVE CAUGHT DEFECT 2. A refused discount must make the deal unsaveable.
     * Before the fix this read `true`, and the quote went out at the wrong number.
     */
    ok('a REFUSED DISCOUNT makes it unsaveable', MergeValidation(clean, warning, refusal).IsValid, false);

    ok(
        'and an already-invalid deal stays invalid',
        MergeValidation({ IsValid: false, Issues: [] }, [], []).IsValid,
        false,
    );

    // Blocking issues come first: `SaveBlockedReason` shows the first error, and a rep reading a
    // disabled Save wants the reason it is disabled rather than an unrelated advisory.
    const merged = MergeValidation(clean, warning, refusal);
    ok('blocking issues are ordered before warnings', merged.Issues[0]?.Severity, 'error');

    // A refusal whose row has since been removed still blocks. Losing the marker is acceptable;
    // letting the save through is not.
    ok(
        'a refusal with no row still blocks',
        MergeValidation(clean, [], DiscountRefusalIssues([{ RowIndex: null, Reason: 'x' }])).IsValid,
        false,
    );
}

console.log('\n  one writer for the stage defaults\n');

/**
 * ── A SOURCE-LEVEL GUARD, BECAUSE THE DEFECT WAS A SECOND WRITER ────────────────────────────────
 *
 * Two Angular components used to assign a stage's `Probability` onto the deal UNCONDITIONALLY — the
 * workspace's stage picker and the board's drag. Both destroyed a rep-typed value before the server's
 * fill-but-don't-overwrite rule could see it, and `board-move.BD6` stayed green throughout because it
 * drives the entity layer and never touches either.
 *
 * `BD6` pins the server's rule. Nothing pinned the ABSENCE of a second writer, and that absence is the
 * actual fix — so it is asserted here by reading the source, the same way the vocabulary gate does. No
 * behavioural check can see this: the moment a component starts writing the field again, every
 * server-side check still passes.
 */
{
    const offenders = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            if (name === 'node_modules' || name === 'dist' || name === 'generated') continue;
            const full = joinPath(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (name.endsWith('.ts')) {
                readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, i) => {
                    // Writes only. A comment or a read of these fields is fine; an assignment sourced
                    // from a stage is the thing that reinstates the defect.
                    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) return;
                    if (/\.(Probability|ForecastCategoryTypeID)\s*=\s*.*stage/i.test(line)) {
                        offenders.push(`${full}:${i + 1}  ${line.trim()}`);
                    }
                });
            }
        }
    };
    walk('packages/Angular/src');

    const pass = offenders.length === 0;
    if (!pass) failures += 1;
    console.log(
        `  ${pass ? 'PASS' : 'FAIL'}  no Angular component writes a stage's probability or forecast category`,
    );
    for (const o of offenders) console.log(`          ${o}`);
    if (!pass) {
        console.log(
            [
                '',
                '        The server applies these inside the save — same trigger, same transaction — and',
                "        respects a value the caller stated. A component cannot answer \"is this the rep's",
                '        number or mine to fill?\" because it has no save boundary, so writing them here',
                '        reinstates the defect BD6 could not see.',
                '',
            ].join('\n'),
        );
    }
}

console.log(
    `\n  ${failures === 0 ? 'workspace-validation: clean' : `workspace-validation: ${failures} FAILURE(S)`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
