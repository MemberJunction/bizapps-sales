#!/usr/bin/env node
/**
 * Proves the placeholder gate FIRES. A gate nobody has seen fail is indistinguishable from a
 * gate that returns "pass" unconditionally — and this one guards a defect class whose whole
 * character is that everything looks fine from inside.
 *
 * Plain Node rather than Vitest on purpose: the gate is stdlib-only so it can run in CI without
 * `npm ci`, and its test should not reintroduce the dependency it was designed to avoid.
 *
 * The hash-manifest CHECK 1 (metadata ↔ seed currency) was removed: it answered a proxy
 * ("did someone last run seed:manifest?") rather than "does the seed contain this record?",
 * and it went green while DealLinker was in no migration. MJ's model is JSON-only PRs and
 * one Metadata_Sync per release. The remaining check is the one MJ has no equivalent for.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runChecks } from './check-distribution-seed.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(name, condition, detail) {
    if (condition) {
        console.log(`  ✓ ${name}`);
    } else {
        console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
        failures++;
    }
}

function fixture(build) {
    const root = mkdtempSync(join(tmpdir(), 'dist-gate-'));
    mkdirSync(join(root, 'migrations'), { recursive: true });
    build(root);
    return root;
}

function withFixture(build, assert) {
    const root = fixture(build);
    try {
        assert(runChecks(root), root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

console.log('distribution gate:');

withFixture(
    (root) => {
        writeFileSync(
            join(root, 'migrations', 'V2__Leak.sql'),
            "EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,${commonSchema}';\n",
        );
    },
    (violations) => {
        check(
            'flags a placeholder the install engine cannot resolve',
            violations.some((v) => v.includes('commonSchema')),
            JSON.stringify(violations),
        );
    },
);

withFixture(
    (root) => {
        writeFileSync(join(root, 'migrations', 'V1__Ok.sql'), 'SELECT 1;\n');
        mkdirSync(join(root, 'migrations-teardown'), { recursive: true });
        writeFileSync(
            join(root, 'migrations-teardown', 'V001__Teardown.sql'),
            'DELETE FROM [${flyway:defaultSchema}].[Thing];\n',
        );
    },
    (violations) => {
        check(
            'flags the app-schema placeholder in a teardown script, where MJ does not substitute it',
            violations.some((v) => v.includes('migrations-teardown') && v.includes('flyway:defaultSchema')),
            JSON.stringify(violations),
        );
    },
);

withFixture(
    (root) => {
        writeFileSync(
            join(root, 'migrations', 'V1__Ok.sql'),
            'EXEC [${mjSchema}].[spCreateAction] @Name=N\'x\';\n',
        );
    },
    (violations) => {
        check(
            'accepts the two placeholders the install engine supplies',
            violations.length === 0,
            JSON.stringify(violations),
        );
    },
);

check('the repository itself passes', runChecks(REPO_ROOT).length === 0, JSON.stringify(runChecks(REPO_ROOT)));

if (failures > 0) {
    console.error(`\n${failures} gate self-test(s) failed.`);
    process.exit(1);
}
console.log('\nAll distribution-gate self-tests passed.');
