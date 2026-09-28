#!/usr/bin/env node
/**
 * Release-readiness: does every primaryKey UUID declared under metadata/ appear in some
 * shipped migrations/*.sql?
 *
 * NOT a PR gate. PRs contribute JSON only; the build engineer generates one Metadata_Sync
 * per release. Run this when cutting that seed — it should be loud at release and silent
 * the rest of the time. `lint:distribution` does not invoke it.
 *
 *   node scripts/check-release-seed-coverage.mjs
 *
 * Exit 1 lists the JSON files whose IDs are in no migration. That is the table
 * docs/PUBLISHING.md used to maintain by hand.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METADATA = join(ROOT, 'metadata');
const MIGRATIONS = join(ROOT, 'migrations');
const IGNORED_DIRS = new Set(['sql_logging', '.backups']);

function walkJson(dir, acc = []) {
    for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (!IGNORED_DIRS.has(name)) walkJson(full, acc);
        } else if (name.endsWith('.json') && name !== '.mj-sync.json') {
            acc.push(full);
        }
    }
    return acc;
}

const UUID =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * A primaryKey this check CANNOT follow.
 *
 * `@lookup:MJ: Entity Fields.Entity=...&Name=DealStatusType` addresses a row this app does not own
 * and did not mint, so there is no UUID to grep a migration for. Such an entry is an UPDATE to an
 * existing row rather than a seed of a new one -- which is exactly why it slipped through: the
 * scan below tested `UUID.test(...)` and silently dropped everything that failed it, then the
 * summary announced that EVERY primaryKey was covered.
 *
 * It still ships the same way (the release `mj sync push --dir metadata --ci` emits updates as well
 * as inserts -- the last one reported "2 created, 12 updated"), and it can still be left out of
 * that push with nothing to catch it. Reported as uncovered rather than counted as passing.
 */
function isLookup(id) {
    return typeof id === 'string' && id.trim().startsWith('@lookup:');
}

function collectIds(node, acc, unfollowable) {
    if (Array.isArray(node)) {
        for (const item of node) collectIds(item, acc, unfollowable);
        return;
    }
    if (!node || typeof node !== 'object') return;
    const pk = node.primaryKey;
    if (pk && typeof pk.ID === 'string') {
        const id = pk.ID.trim();
        if (UUID.test(id)) acc.push(id);
        else if (isLookup(id)) unfollowable.push(id);
    }
    for (const value of Object.values(node)) collectIds(value, acc, unfollowable);
}

const sql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
    .toLowerCase();

const missing = [];
const unchecked = [];
let checkedIds = 0;
for (const file of walkJson(METADATA)) {
    const ids = [];
    const unfollowable = [];
    collectIds(JSON.parse(readFileSync(file, 'utf8')), ids, unfollowable);
    const distinct = [...new Set(ids)];
    checkedIds += distinct.length;
    const unseen = distinct.filter((id) => !sql.includes(id.toLowerCase()));
    if (unseen.length) {
        missing.push({
            file: relative(ROOT, file).split(sep).join('/'),
            unseen,
        });
    }
    if (unfollowable.length) {
        unchecked.push({
            file: relative(ROOT, file).split(sep).join('/'),
            count: [...new Set(unfollowable)].length,
            example: unfollowable[0],
        });
    }
}

/** What this run could not follow, printed whether it passes or fails. */
function reportUnchecked(log) {
    if (!unchecked.length) return;
    const rows = unchecked.reduce((n, r) => n + r.count, 0);
    log('');
    log(`NOT CHECKED: ${rows} lookup-addressed primaryKey(s) in ${unchecked.length} file(s).`);
    log('These name a row by lookup rather than by an ID this app minted, so there is nothing to');
    log('grep a migration for. They still have to reach every environment through the release');
    log('metadata push, and nothing here verifies that they did.');
    for (const row of unchecked) {
        log(`  ?  ${row.file}: ${row.count}`);
        log(`       e.g. ${row.example}`);
    }
}

/**
 * HAS metadata/ MOVED SINCE THE LAST RELEASE SEED?
 *
 * The scan above greps migrations for UUIDs, which a `@lookup:`-addressed row does not have -- so
 * those get reported as NOT CHECKED and the question stops there. This asks a different one that
 * covers both kinds: was this file's content in the seed at all?
 *
 * It is answerable without guessing. `Metadata_Sync` migrations are generated one per release from
 * the whole `metadata/` directory, so anything committed there AFTER the newest one was committed is
 * necessarily absent from it. Anchored to that migration's own commit rather than its filename
 * timestamp, because the filename encodes when the build engineer generated it and the commit is
 * when it actually entered the history the comparison runs against.
 *
 * Reported rather than failed. Metadata changing between releases is the NORMAL state -- the seed is
 * cut at release time, not per PR, and `check:release-seed` is explicitly not a PR gate. The point is
 * that whoever cuts the next release can see what is waiting, instead of finding out when a database
 * built from migrations comes up missing a label.
 */
function metadataChangedSinceSeed() {
    const seeds = readdirSync(MIGRATIONS)
        .filter((f) => /Metadata_Sync.*\.sql$/i.test(f))
        .sort();
    if (!seeds.length) return { seed: null, files: [], ok: true };
    const seed = seeds[seeds.length - 1];

    const git = (args) => {
        try {
            return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        } catch {
            return null;
        }
    };

    const path = join('migrations', seed).replace(/\\/g, '/');
    const sha = git(['log', '-1', '--format=%H', '--', path]);
    if (!sha || !sha.trim()) return { seed, files: [], ok: false };

    /**
     * A COMMIT RANGE, NOT `--since=<date>`.
     *
     * `--since` includes commits AT that timestamp, so the seed's own commit counted -- and a release
     * commit normally carries the metadata the seed was generated FROM, which then showed up as
     * "changed since the seed" on the very run that sealed it. Measured: it reported
     * `metadata/actions/.sales-actions.json`, committed in the same commit as the seed.
     */
    const changed = git(['log', `${sha.trim()}..HEAD`, '--name-only', '--format=', '--', 'metadata/']);
    if (changed === null) return { seed, files: [], ok: false };

    const when = git(['log', '-1', '--format=%cI', '--', path]) ?? '';

    const files = [...new Set(
        changed
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.endsWith('.json') && l.startsWith('metadata/')),
    )].sort();

    return { seed, files, ok: true, since: when.trim().slice(0, 16) };
}

const staleness = metadataChangedSinceSeed();

/** Printed on both paths: it qualifies a pass at least as much as it qualifies a failure. */
function reportStaleness(log) {
    if (!staleness.seed) {
        log('');
        log('NO Metadata_Sync MIGRATION EXISTS, so nothing under metadata/ has ever been sealed into');
        log('one. Every file below reaches a database only through a manual push.');
        return;
    }
    if (!staleness.ok) {
        log('');
        log(`Could not read git history, so whether metadata/ has moved since ${staleness.seed}`);
        log('is unknown. Not the same as unchanged.');
        return;
    }
    if (!staleness.files.length) return;
    log('');
    log(`${staleness.files.length} metadata file(s) changed since the newest release seed`);
    log(`(${staleness.seed}, committed ${staleness.since}). None of that content is in any`);
    log('migration, so a database built from migrations alone does not have it:');
    for (const f of staleness.files.slice(0, 15)) log(`  ~  ${f}`);
    if (staleness.files.length > 15) log(`  ... and ${staleness.files.length - 15} more`);
    log('Generating the next Metadata_Sync picks all of them up.');
}

if (missing.length) {
    console.error('Release seed coverage — these metadata primaryKeys appear in no migration:\n');
    for (const row of missing) {
        console.error(`  ❌ ${row.file}: ${row.unseen.length} undeclared in SQL`);
        console.error(`       e.g. ${row.unseen[0]}`);
    }
    reportUnchecked(console.error);
    reportStaleness(console.error);
    console.error('\nGenerate the release Metadata_Sync, then re-run.');
    process.exit(1);
}

/**
 * COUNT WHAT WAS CHECKED. This said "every metadata primaryKey appears in migrations/", which was
 * true only of the ones it could follow -- the lookup-addressed entries were dropped before the
 * comparison and then covered by the word "every".
 */
console.log(`Release seed coverage — ${checkedIds} ID-addressed primaryKey(s) appear in migrations/.`);
reportUnchecked(console.log);
reportStaleness(console.log);
