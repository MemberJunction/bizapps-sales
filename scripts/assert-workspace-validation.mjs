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
    UnlinkedLineIssues,
    ShouldRefuseLineRemoval,
    LineRemovalRefusedIssues,
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


/**
 * ── A LINE WITH NO PRODUCT: THE THIRD DEFECT OF THE SAME SHAPE ──────────────────────────────────
 *
 * `OrderLine.ProductID` is `UNIQUEIDENTIFIER NOT NULL` with a real FK — verified in orders' migration
 * and on the host, where 0 of 63 lines carry a null. `AddLine()` calls `order.Lines.Create()`, sets
 * `CompanyID`, and never touches `ProductID`. So the most ordinary gesture in the pane — click Add,
 * click Save — put a null into a NOT NULL column and answered the rep with a database constraint name.
 *
 * That is the KI-20 shape exactly: a normal action, a raw SQL error, and nothing on screen that says
 * which row or why. It blocks now, attributed to the line.
 *
 * WHY THESE ASSERTIONS AND NOT A REMOVED PICKER OPTION. Removing `— not linked —` would assert the
 * state was never legal. It is: a new line is unlinked before the picker is ever opened, so removing
 * the option only removes the LABEL for a state the rep is already in, leaving a blank select on an
 * unsaveable row. The option stays (relabelled to an instruction) and the save is refused instead.
 *
 * These assertions still matter if somebody removes the option later — they are about the refusal, not
 * about the dropdown, and they would go red the day the block is dropped either way.
 */
console.log('\n  a line with no product blocks the save, on its own row\n');
{
    const issues = UnlinkedLineIssues([{ ProductID: null }]);
    ok('one unlinked line yields exactly one issue', issues.length, 1);
    ok('attributed to the LINES pane, not the default one', issues[0]?.Section, 'lines');
    ok('and to the field that owns it', issues[0]?.Field, 'ProductID');
    ok('and to the ROW, so the grid can mark it', issues[0]?.RowIndex, 0);
    ok('as an ERROR — a NOT NULL column is not an advisory', issues[0]?.Severity, 'error');
    // The message is what a rep reads INSTEAD of a constraint name, so it is asserted for content
    // rather than mere presence: it must say what to do and must not leak SQL.
    const msg = String(issues[0]?.Message ?? '');
    ok('the message tells the rep what to do', /choose a product/i.test(msg), true);
    ok('and names no constraint, table or column', /FK_|NOT NULL|OrderLine|ProductID/.test(msg), false);
}

{
    // The row index is the whole point of attribution: the SECOND line's issue must not land on the first.
    const issues = UnlinkedLineIssues([{ ProductID: 'p1' }, { ProductID: null }, { ProductID: 'p3' }]);
    ok('only the unlinked line is flagged', issues.length, 1);
    ok('and it is flagged at ITS index, not the first', issues[0]?.RowIndex, 1);
}

{
    const issues = UnlinkedLineIssues([{ ProductID: 'p1' }, { ProductID: 'p2' }]);
    ok('a fully linked order raises nothing', issues.length, 0);
    // Empty string and undefined are the same absence as null -- a picker that writes '' would
    // otherwise slip through and hit the same constraint.
    ok('an empty-string product is still unlinked', UnlinkedLineIssues([{ ProductID: '' }]).length, 1);
    ok('an absent product key is still unlinked', UnlinkedLineIssues([{}]).length, 1);
}

{
    // And that it actually reaches IsValid, which is what CanSave reads. The refused-discount defect
    // was exactly this: an issue the template rendered and the save never consulted.
    const merged = MergeValidation(
        { IsValid: true, Issues: [] }, [], UnlinkedLineIssues([{ ProductID: null }]),
    );
    ok('an unlinked line makes the projection invalid', merged.IsValid, false);
    ok('and the issue survives the merge', merged.Issues.length, 1);
    const clean = MergeValidation({ IsValid: true, Issues: [] }, [], UnlinkedLineIssues([{ ProductID: 'p' }]));
    ok('a linked line leaves it valid', clean.IsValid, true);
}

/**
 * ──── KI-20: A DECLINED LINE REMOVAL ────
 *
 * Two claims that pull in opposite directions, so both are asserted.
 *
 * A saved line must REFUSE removal, because staging it costs the rep the entire save rather than just the
 * removal. A line that was never saved must NOT refuse: it has no row to delete and nothing for orders'
 * renumbering to collide with, so refusing it would invent a limitation the defect does not impose.
 *
 * THE DISTINCTION THAT MATTERS IS SHOWN VERSUS ACTUALLY REFUSED. A version that rendered this message and
 * removed the line anyway would look identical on screen and lose the row silently. That is why the
 * decision is its own pure function rather than a branch inside a click handler: ShouldRefuseLineRemoval
 * is the half that has to be true, and it is asserted directly instead of inferred from a message.
 */
console.log(`\n  KI-20: a saved line refuses removal; an unsaved one does not\n`);
{
    ok('a SAVED line refuses removal', ShouldRefuseLineRemoval({ IsSaved: true }), true);
    ok('an UNSAVED line does NOT — nothing to delete, nothing to collide',
       ShouldRefuseLineRemoval({ IsSaved: false }), false);
    // Absent state must not silently refuse -- that would block a legal removal on bad input.
    ok('a null line does not refuse', ShouldRefuseLineRemoval(null), false);
    ok('an undefined line does not refuse', ShouldRefuseLineRemoval(undefined), false);
}

{
    const issues = LineRemovalRefusedIssues([{ RowIndex: 2 }]);
    ok('one declined removal yields exactly one issue', issues.length, 1);
    ok('attributed to the LINES pane', issues[0]?.Section, 'lines');
    ok('and to the ROW, so the grid can mark it', issues[0]?.RowIndex, 2);
    ok('with no single field blamed — the row is the subject', issues[0]?.Field, null);

    // THE SEVERITY IS THE POINT. An error would disable Save and cost the rep every other edit, which is
    // the outcome this refusal exists to avoid rather than reproduce.
    ok('severity is WARNING, not error', issues[0]?.Severity, 'warning');

    const msg = String(issues[0]?.Message ?? '');
    ok('the message says what the rep CAN do instead', /change its product or quantity/i.test(msg), true);
    ok('and that a newly added line can still be removed', /just added/i.test(msg), true);
    ok(
        'and it leaks no constraint, table or column name',
        /UQ_|UNIQUE|constraint|OrderLine|LineNumber|OrderHeaderID|violation/i.test(msg),
        false,
    );
}

{
    // And it must NOT block the save, asserted through the projection CanSave actually reads.
    const merged = MergeValidation(
        { IsValid: true, Issues: [] }, LineRemovalRefusedIssues([{ RowIndex: 0 }]), [],
    );
    ok('a declined removal leaves the deal SAVEABLE', merged.IsValid, true);
    ok('while still reporting the reason', merged.Issues.length, 1);
}

console.log(
    `\n  ${failures === 0 ? 'workspace-validation: clean' : `workspace-validation: ${failures} FAILURE(S)`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
