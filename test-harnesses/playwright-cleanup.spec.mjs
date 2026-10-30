/**
 * Proves the Playwright teardown's sqlcmd call turns QUOTED_IDENTIFIER on (`-I`).
 *
 * Without it SQL Server refuses any delete from a table with a filtered index (Msg 1934), the sweep
 * is skipped and test rows accumulate across runs (sales#433). No database: this checks the arguments
 * the sweep hands sqlcmd.
 *
 * Run: node --test test-harnesses/playwright-cleanup.spec.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlcmdArgs } from './playwright/lib/cleanup.mjs';

const ENV = { DB_HOST: 'db.test', DB_PORT: '1444', DB_USERNAME: 'u', DB_PASSWORD: 'p', DB_DATABASE: 'D' };

test('the sweep runs with QUOTED_IDENTIFIER on', () => {
    assert.ok(sqlcmdArgs(ENV, 'SELECT 1').includes('-I'));
});

test('the sweep still aborts on the first error and sends its SQL as the query', () => {
    const args = sqlcmdArgs(ENV, 'SELECT 1');
    assert.ok(args.includes('-b'));
    assert.equal(args[args.indexOf('-Q') + 1], 'SELECT 1');
    assert.equal(args[args.indexOf('-S') + 1], 'db.test,1444');
    assert.equal(args[args.indexOf('-d') + 1], 'D');
});
