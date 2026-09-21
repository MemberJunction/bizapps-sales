/**
 * @fileoverview Resolve which migration the database ACTUALLY runs last for a layered view.
 *
 * WHY THIS EXISTS. CodeGen owns `vw<X>Generated` and regenerates it wholesale on any schema change.
 * `vw<X>` is hand-written on top, so every schema change forces a human to re-type it — and
 * hand-added logic is exactly what goes missing when they start from a stale copy.
 *
 * THAT IS NOT HYPOTHETICAL. bizapps-contracts PR #59 (2026-09-20) re-created `vwContracts` and its
 * `IsAwaitingDocument` lost the File/FileCategory joins and the `fc.Name = 'Executed Agreement'`
 * predicate that a migration three weeks earlier existed to add. Any attached file — an exhibit, a
 * draft, the wrong PDF — has cleared the "awaiting paper" warning ever since.
 *
 * AND THE GUARD THAT SHOULD HAVE CAUGHT IT WENT GREEN. It resolved the newest definer with a regex
 * requiring `CREATE OR ALTER VIEW`. #59 used `DROP VIEW` + `CREATE VIEW`, so it was filtered OUT of
 * the candidate list, `.pop()` fell back to the older file, and the suite went on asserting —
 * truthfully — about a migration the database no longer runs last.
 *
 * So the selector here matches ANY DDL that names the view, and separately asserts that nothing
 * after the resolved file redefines it in a form this regex has not been taught yet.
 *
 * Comments are stripped before any matching. A required predicate must be satisfied by executable
 * SQL, never by prose that happens to quote it — copying a comment block forward is precisely how a
 * stale retype looks.
 *
 * ---------------------------------------------------------------------------------------------
 * THREE DELIBERATE DIFFERENCES FROM THE bizapps-orders ORIGINAL, each forced by real SQL here.
 *
 * 1. THE "MENTIONED LATER" CHECK IS SCOPED TO A BATCH, NOT A FILE. Orders' version threw when any
 *    later migration mentioned the view at all. Here that fires on correct history: CodeGen
 *    regenerates `spCreatePerson` / `spUpdatePerson`, whose bodies `SELECT * FROM [vwPeople]`, and
 *    re-issues `GRANT SELECT ON [vwPeople]`, in migrations long after the newest definer. Reading
 *    a view is not redefining it. So a later file only fails the check when a single GO batch both
 *    names the view AND contains view DDL — which is exactly "a definer form the selector cannot
 *    see", the thing worth throwing over.
 *
 * 2. COLUMNS ARE READ FROM ONE VIEW BODY, NOT THE WHOLE FILE, AND BARE ALIASES COUNT. Orders'
 *    previous definer happened to be a small single-view migration, so scanning the file worked.
 *    Here a definer can be a 38,000-line CodeGen dump defining dozens of views, and the alias sets
 *    of unrelated views would swamp the comparison. Aliases are also written bare here
 *    (`END AS AnomalyOutcome`, not `AS [AnomalyOutcome]`), which a bracket-only regex scores as
 *    zero columns — a column check that silently asserts nothing. Both are fixed by extracting the
 *    SELECT list of the specific view and taking aliases at parenthesis depth 0, which is what
 *    keeps `[Address] AS addr` and `CAST(x AS date)` out of the column set.
 *
 * 3. INHERITED COLUMNS COUNT AS PRESENT. A layered outer view projects `g.*` from
 *    `vw<X>Generated`, so every column the flat pre-layering view used to alias by hand still
 *    exists — through the inner view, under the same name. A text-level diff of the two bodies
 *    cannot see that and reports each one as lost. `producedColumns` follows the `*` into the
 *    inner view's own newest definer, so the assertion compares what the database actually
 *    projects instead of what one file happens to spell.
 */
import { readdirSync, readFileSync } from 'node:fs';

/** SQL with `--` line comments and block comments removed, so prose can never satisfy an assertion. */
export function sqlCode(sql: string): string {
    return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Any DDL naming the view: `CREATE VIEW`, `CREATE OR ALTER VIEW`, `ALTER VIEW`, or `DROP VIEW`. */
function ddlFor(view: string): RegExp {
    return new RegExp(
        String.raw`\b(?:CREATE\s+(?:OR\s+ALTER\s+)?VIEW|ALTER\s+VIEW|DROP\s+VIEW)\s+\[[^\]]+\]\.\[${view}\]`,
        'i',
    );
}

/** Anything that could redefine or rename a view. Its presence is what makes a mention suspicious. */
const VIEW_DDL_VERB = /\b(?:CREATE\s+(?:OR\s+ALTER\s+)?VIEW|ALTER\s+VIEW|DROP\s+VIEW|sp_rename)\b/i;

/** Statement batches, which is the scope SQL Server applies a single DDL statement in. */
function batches(code: string): string[] {
    return code.split(/^[ \t]*GO[ \t]*$/im);
}

/**
 * True when some batch both names the view and carries view DDL, yet `ddlFor` did not match the
 * file — i.e. a definer form exists that this helper cannot see. A batch that merely reads the view
 * (`SELECT * FROM`, `GRANT SELECT ON`, an `OBJECT_ID` probe) is not that, and CodeGen emits those
 * constantly.
 */
function mayRedefineUnseen(code: string, view: string): boolean {
    const names = new RegExp(String.raw`\[${view}\]`);
    return batches(code).some((batch) => names.test(batch) && VIEW_DDL_VERB.test(batch));
}

export interface ViewDefiner {
    /** The migration the database runs last for this view. */
    file: string;
    /** That file's SQL, comments stripped. */
    code: string;
    /** Every migration that has ever defined the view, in apply order. */
    chain: string[];
}

/** The `.sql` migrations in apply order — filename order, which the naming convention keeps monotonic. */
function migrationFiles(migrationsDir: string): string[] {
    return readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
}

/** Every migration defining `view`, in apply order. Empty when none does. */
function definerChain(migrationsDir: string, view: string): string[] {
    const ddl = ddlFor(view);
    return migrationFiles(migrationsDir).filter((f) => ddl.test(readMigration(migrationsDir, f)));
}

/** One migration's SQL with comments stripped. */
export function readMigration(migrationsDir: string, file: string): string {
    return sqlCode(readFileSync(`${migrationsDir}/${file}`, 'utf8'));
}

/**
 * The newest migration defining `view`, by filename order — which is apply order, because the
 * repo's migration-filename convention makes the timestamp prefix monotonic.
 *
 * @throws if no migration defines the view, or if a later migration carries view DDL naming it
 *   without matching the patterns above — that means a definer form exists which this helper
 *   cannot see, and failing loudly is the only safe answer.
 */
export function newestViewDefiner(migrationsDir: string, view: string): ViewDefiner {
    const chain = definerChain(migrationsDir, view);
    if (chain.length === 0) {
        throw new Error(`No migration defines [${view}] — a guard over it would assert against nothing.`);
    }
    const file = chain[chain.length - 1];

    const redefinedAfter = migrationFiles(migrationsDir)
        .filter((f) => f > file && mayRedefineUnseen(readMigration(migrationsDir, f), view));
    if (redefinedAfter.length > 0) {
        throw new Error(
            `[${view}] carries view DDL in migrations AFTER its newest recognised definer ${file}: ` +
            `${redefinedAfter.join(', ')}. Either they redefine it in a form newestViewDefiner does ` +
            `not match — in which case teach it that form — or the guard is now pointed at stale SQL.`,
        );
    }
    return { file, code: readMigration(migrationsDir, file), chain };
}

/**
 * The LAST `CREATE VIEW <view>` batch in `code`. Last, not first: a CodeGen dump can define the
 * same view several times in one file and the final one is what the database is left holding.
 */
export function viewBody(code: string, view: string): string {
    const ddl = new RegExp(String.raw`\bCREATE\s+(?:OR\s+ALTER\s+)?VIEW\s+\[[^\]]+\]\.\[${view}\]`, 'gi');
    let start = -1;
    for (const match of code.matchAll(ddl)) start = match.index;
    if (start < 0) return '';
    const rest = code.slice(start);
    const end = rest.search(/^[ \t]*GO[ \t]*$/im);
    return end < 0 ? rest : rest.slice(0, end);
}

function isIdentifierChar(character: string | undefined): boolean {
    return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

/** True when `word` stands as its own keyword at `index`. */
function keywordAt(sql: string, index: number, word: string): boolean {
    if (sql.slice(index, index + word.length).toUpperCase() !== word) return false;
    return !isIdentifierChar(sql[index - 1]) && !isIdentifierChar(sql[index + word.length]);
}

export interface ViewProjection {
    /** Everything between `SELECT` and the `FROM` at parenthesis depth 0 — the output columns. */
    select: string;
    /** That `FROM` onward: joins, ON clauses, and the derived tables the columns are built from. */
    from: string;
}

/**
 * Split a view body at its top-level `FROM`. Depth matters: a scalar subquery in the SELECT list
 * has a `FROM` of its own (`(SELECT COUNT(*) FROM [Relationship] AS r ...) AS [ActivePersonCount]`),
 * and splitting on the first one would cut the projection in half.
 */
export function splitProjection(body: string): ViewProjection {
    const selectAt = body.search(/\bSELECT\b/i);
    if (selectAt < 0) return { select: '', from: '' };
    const start = selectAt + 'SELECT'.length;
    let depth = 0;
    for (let i = start; i < body.length; i++) {
        const character = body[i];
        if (character === '(') depth++;
        else if (character === ')') depth--;
        else if (depth === 0 && keywordAt(body, i, 'FROM')) {
            return { select: body.slice(start, i), from: body.slice(i) };
        }
    }
    return { select: body.slice(start), from: '' };
}

/** `AS [Name]` or a bare `AS Name`, anchored so it can be applied at one position at a time. */
const ALIAS = /\bAS\s+(?:\[([A-Za-z_][A-Za-z0-9_]*)\]|([A-Za-z_][A-Za-z0-9_]*))/iy;

/**
 * The columns a view body aliases itself, in order.
 *
 * Only at parenthesis depth 0 of the SELECT list, which is what separates a column alias from a
 * table alias or a cast: `[AddressLink] AS al` and `CAST(g.[ID] AS NVARCHAR(MAX))` live in the FROM
 * clause or inside parentheses, while `(SELECT COUNT(*) ...) AS [ChildOrgCount]` lands back at
 * depth 0 after its closing bracket and is correctly counted.
 */
export function derivedColumns(body: string): string[] {
    const { select } = splitProjection(body);
    const columns: string[] = [];
    let depth = 0;
    for (let i = 0; i < select.length; i++) {
        const character = select[i];
        if (character === '(') { depth++; continue; }
        if (character === ')') { depth--; continue; }
        if (depth !== 0 || isIdentifierChar(select[i - 1])) continue;
        ALIAS.lastIndex = i;
        const match = ALIAS.exec(select);
        if (match === null) continue;
        columns.push(match[1] ?? match[2]);
        i = ALIAS.lastIndex - 1;
    }
    return columns;
}

/**
 * The view this body inherits columns from — the source of a `g.*` projection. That star is why a
 * layered wrapper can be nine lines long and still expose everything the flat view used to.
 */
function inheritedView(body: string): string | undefined {
    const { select, from } = splitProjection(body);
    if (!/(?:^|[\s,])(?:[A-Za-z_][A-Za-z0-9_]*\.)?\*/.test(select)) return undefined;
    return /^FROM\s+\[[^\]]+\]\.\[([A-Za-z0-9_]+)\]/i.exec(from)?.[1];
}

/** How far to follow `*` through nested views before giving up. Layering here is two deep. */
const MAX_INHERITANCE_DEPTH = 4;

/**
 * Every column the view projects under a name: the ones it aliases itself, plus the ones it
 * inherits through `g.*` from the generated inner view (and so on inward). A source that is a
 * TABLE rather than a view contributes nothing, because a table's columns are not aliases.
 */
export function producedColumns(migrationsDir: string, view: string, depth = 0): string[] {
    const chain = definerChain(migrationsDir, view);
    if (chain.length === 0) return [];
    const body = viewBody(readMigration(migrationsDir, chain[chain.length - 1]), view);
    const own = derivedColumns(body);
    const inner = inheritedView(body);
    if (inner === undefined || inner === view || depth >= MAX_INHERITANCE_DEPTH) return own;
    return [...own, ...producedColumns(migrationsDir, inner, depth + 1)];
}
