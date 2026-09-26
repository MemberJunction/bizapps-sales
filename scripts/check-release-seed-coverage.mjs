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

if (missing.length) {
    console.error('Release seed coverage — these metadata primaryKeys appear in no migration:\n');
    for (const row of missing) {
        console.error(`  ❌ ${row.file}: ${row.unseen.length} undeclared in SQL`);
        console.error(`       e.g. ${row.unseen[0]}`);
    }
    reportUnchecked(console.error);
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
