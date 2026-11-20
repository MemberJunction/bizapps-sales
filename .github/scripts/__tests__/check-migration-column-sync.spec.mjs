import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { problems } from '../check-migration-column-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'check-migration-column-sync.mjs');

const ALTER = 'ALTER TABLE [s].[Deal] ALTER COLUMN [Name] NVARCHAR(400) NOT NULL;\n';
const SCOPED = "EXEC [__mj].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';\n";

/** A repo whose first commit holds `before` and second adds `added`; returns the two SHAs. */
function repo(before, added) {
    const dir = mkdtempSync(join(tmpdir(), 'column-sync-'));
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('config', 'user.email', 'test@test.com');
    git('config', 'user.name', 'Test');
    mkdirSync(join(dir, 'migrations'));
    for (const [name, sql] of Object.entries(before)) writeFileSync(join(dir, 'migrations', name), sql);
    git('add', '.');
    git('commit', '-q', '--allow-empty', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    for (const [name, sql] of Object.entries(added)) writeFileSync(join(dir, 'migrations', name), sql);
    git('add', '.');
    git('commit', '-q', '-m', 'change');
    return { dir, base, head: git('rev-parse', 'HEAD') };
}

function run(r) {
    return spawnSync(process.execPath, [SCRIPT, r.base, r.head], { cwd: r.dir, encoding: 'utf8' });
}

test('fixtures pass the self-test', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
});

test('names the line of the ALTER COLUMN that has no field sync', () => {
    assert.deepEqual(problems(`GO\n${ALTER}`).map((p) => p.split(':')[0]), ['line 2']);
});

test('fails CI on an added migration that alters a column without a scoped sync', () => {
    const r = repo({}, { 'V202610191200__v6.18.x__Widen.sql': ALTER });
    try {
        const out = run(r);
        assert.equal(out.status, 1);
        assert.match(out.stderr, /V202610191200__v6\.18\.x__Widen\.sql/);
    } finally {
        rmSync(r.dir, { recursive: true, force: true });
    }
});

test('passes an added migration that carries the scoped sync', () => {
    const r = repo({}, { 'V202610191200__v6.18.x__Widen.sql': ALTER + SCOPED });
    try {
        assert.equal(run(r).status, 0);
    } finally {
        rmSync(r.dir, { recursive: true, force: true });
    }
});

test('does not re-judge a migration that was already applied', () => {
    const r = repo({ 'V202609010000__v6.1.x__Old.sql': ALTER }, { 'V202609010000__v6.1.x__Old.sql': `${ALTER}-- touched\n` });
    try {
        assert.equal(run(r).status, 0);
    } finally {
        rmSync(r.dir, { recursive: true, force: true });
    }
});
