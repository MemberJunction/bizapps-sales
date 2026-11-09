/**
 * Proves `one-mj-core.mjs` gives a sibling the copy its range and sales' overrides call for, and never
 * sales' copy by accident (sales#231).
 *
 * Every test builds a TEMP host with three checkouts side by side and nothing else: a stand-in for sales
 * (its own copy of `@mj-biz-apps/x` 1.0.0 and a copy of `one-mj-core.mjs`), a sibling that builds x
 * 1.0.0, and a sibling whose package pins x to 0.9.0 and installs its own 0.9.0. That last one is the
 * shape of orders 5.30.0 pinning common-entities 5.49.0 while the common checkout builds 5.50.1. No
 * database, no real packages.
 *
 * Without an override the pinned sibling must get its OWN copy. Before sales#231 it got sales' copy:
 * the hook probed sales' copy with a substituted parent, and on Node 24 the follow-up resolution with
 * the real parent returned that probe's result. With an override covering x, every requester must get
 * the build, and the pinned sibling must be reported as set aside.
 *
 * Run: node --test test-harnesses/one-mj-core.spec.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

function writeJson(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value, null, 2));
}

function writeText(file, text) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** One copy of `@mj-biz-apps/x` in `dir`, exporting where it was loaded from. */
function packageX(dir, version, where) {
    writeJson(join(dir, 'package.json'), { name: '@mj-biz-apps/x', version, type: 'module', main: 'dist/index.js' });
    writeText(join(dir, 'dist', 'index.js'), `export const where = '${where}';\n`);
}

/**
 * The temp host. `overrides` is the text of sales' `pnpm-workspace.yaml` overrides block, or ''.
 * `salesRange`/`salesVersion` are what sales' IntegrationTests declares for x and installs; `builds` are
 * the checkouts beside sales that build x, by folder and version; `env` is passed to the run.
 */
function buildHost({ overrides = '', salesRange = '^1.0.0', salesVersion = '1.0.0', builds = { common: '1.0.0' } } = {}) {
    const host = realpathSync(mkdtempSync(join(tmpdir(), 'one-mj-core-')));
    const sales = join(host, 'sales');
    writeJson(join(sales, 'package.json'), { name: 'fixture-sales', private: true, type: 'module' });
    writeText(join(sales, 'pnpm-workspace.yaml'), `packages:\n  - 'packages/*'\n${overrides}`);
    cpSync(join(HERE, 'one-mj-core.mjs'), join(sales, 'test-harnesses', 'one-mj-core.mjs'));
    mkdirSync(join(sales, 'node_modules'), { recursive: true });
    symlinkSync(realpathSync(join(REPO, 'node_modules', 'semver')), join(sales, 'node_modules', 'semver'), 'dir');

    const tests = join(sales, 'packages', 'IntegrationTests');
    writeJson(join(tests, 'package.json'), { name: 'fixture-sales-tests', version: '1.0.0', type: 'module', dependencies: { '@mj-biz-apps/x': salesRange } });
    writeText(join(tests, 'index.js'), "export { where } from '@mj-biz-apps/x';\n");
    packageX(join(tests, 'node_modules', '@mj-biz-apps', 'x'), salesVersion, 'sales');

    for (const [checkout, version] of Object.entries(builds)) {
        packageX(join(host, checkout, 'packages', 'X'), version, `build:${checkout}`);
    }

    const pinned = join(host, 'orders', 'packages', 'O');
    writeJson(join(pinned, 'package.json'), { name: '@mj-biz-apps/o', version: '5.30.0', type: 'module', dependencies: { '@mj-biz-apps/x': '0.9.0' } });
    writeText(join(pinned, 'dist', 'index.js'), "export { where } from '@mj-biz-apps/x';\n");
    packageX(join(pinned, 'node_modules', '@mj-biz-apps', 'x'), '0.9.0', 'orders-own');

    // The runner's shape: a file of sales whose own package (the root) declares nothing for x.
    writeText(join(sales, 'test-harnesses', 'drive.mjs'), `
import { pathToFileURL } from 'node:url';
import { AmbiguousSiblings, BizAppsDuplicates, OverriddenRanges, SetAsideSiblingBuilds, ShareTestedCheckoutPackages } from './one-mj-core.mjs';
ShareTestedCheckoutPackages();
const rootSide = await import('@mj-biz-apps/x');
const salesSide = await import(pathToFileURL(${JSON.stringify(join(tests, 'index.js'))}).href);
const pinnedSide = await import(pathToFileURL(${JSON.stringify(join(pinned, 'dist', 'index.js'))}).href);
console.log(JSON.stringify({
    root: rootSide.where, sales: salesSide.where, pinned: pinnedSide.where, duplicates: BizAppsDuplicates(),
    overridden: OverriddenRanges(), ambiguous: AmbiguousSiblings(), setAside: SetAsideSiblingBuilds().map((b) => b.name),
}));
`);
    return { host, sales, drive: join(sales, 'test-harnesses', 'drive.mjs') };
}

function run(options, env = {}) {
    const { host, drive } = buildHost(options);
    try {
        const result = spawnSync(process.execPath, [drive], { encoding: 'utf8', env: { ...process.env, ...env } });
        assert.equal(result.status, 0, result.stderr);
        return JSON.parse(result.stdout.trim().split('\n').at(-1));
    } finally {
        rmSync(host, { recursive: true, force: true });
    }
}

test('a sibling whose range refuses the build keeps its own copy, not sales\'', () => {
    const loaded = run();
    assert.equal(loaded.root, 'build:common');
    assert.equal(loaded.sales, 'build:common');
    assert.equal(loaded.pinned, 'orders-own');
    const x = loaded.duplicates.find((d) => d.name === '@mj-biz-apps/x');
    assert.ok(x, 'the two versions are reported as a duplicate');
    assert.ok(x.copies.every((c) => !c.includes(join('sales', 'packages'))), `sales' copy was loaded: ${x.copies.join(', ')}`);
    assert.deepEqual(loaded.overridden, []);
});

test('an override sales declares gives every requester the build, and names the range it set aside', () => {
    const loaded = run({ overrides: "overrides:\n  '@mj-biz-apps/x': '^1.0.0'\n" });
    assert.equal(loaded.sales, 'build:common');
    assert.equal(loaded.pinned, 'build:common');
    assert.deepEqual(loaded.duplicates, []);
    assert.deepEqual(loaded.overridden, [{ name: '@mj-biz-apps/x', override: '^1.0.0', requesters: ['@mj-biz-apps/o@5.30.0 (0.9.0)'] }]);
});

test('a file of sales that declares nothing is held to sales\' range, not handed an older sibling build (sales#372)', () => {
    const loaded = run({ salesRange: '^1.7.0', salesVersion: '1.7.0', builds: { common: '1.6.2' } });
    assert.equal(loaded.root, 'sales');
    assert.equal(loaded.sales, 'sales');
    assert.ok(!loaded.duplicates.some((d) => d.name === '@mj-biz-apps/x' && d.copies.some((c) => c.startsWith('1.6.2'))), JSON.stringify(loaded.duplicates));
    assert.deepEqual(loaded.setAside, ['@mj-biz-apps/x']);
});

test('several checkouts carrying a package: none is picked, and the run is told which (sales#456)', () => {
    const loaded = run({ builds: { common: '1.0.0', 'common-wt2': '1.0.0' } });
    assert.equal(loaded.root, 'sales');
    assert.equal(loaded.sales, 'sales');
    assert.equal(loaded.ambiguous.length, 1);
    assert.equal(loaded.ambiguous[0].variable, 'BIZAPPS_X_REPO');
    assert.deepEqual(loaded.ambiguous[0].checkouts.map((c) => c.split(/[\\/]/).at(-1)).sort(), ['common', 'common-wt2']);
});

test('BIZAPPS_<APP>_REPO picks the checkout among several (sales#456)', () => {
    const loaded = run({ builds: { common: '1.0.0', 'common-wt2': '1.0.0' } }, { BIZAPPS_X_REPO: '../common-wt2' });
    assert.equal(loaded.root, 'build:common-wt2');
    assert.equal(loaded.sales, 'build:common-wt2');
    assert.deepEqual(loaded.ambiguous, []);
});

test('a BIZAPPS_<APP>_REPO that names a checkout without the package is reported, not read as absent (sales#456)', () => {
    const loaded = run({ builds: { common: '1.0.0' } }, { BIZAPPS_X_REPO: '../nowhere' });
    assert.equal(loaded.root, 'sales');
    assert.deepEqual(loaded.ambiguous, [{ name: '@mj-biz-apps/x', variable: 'BIZAPPS_X_REPO', checkouts: [] }]);
});
