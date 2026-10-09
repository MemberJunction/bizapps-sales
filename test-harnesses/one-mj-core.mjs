/**
 * @fileoverview Make every sibling checkout share THIS checkout's MemberJunction and BizApps packages.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The harnesses reach downstream apps sales does not declare (accounting, orders' server packages,
 * contracts) through `sibling-resolve.mjs`: a built checkout of each app beside this one. Each of those
 * checkouts has its own `node_modules`, so a file loaded from it resolves `@memberjunction/core` to its
 * own copy. Node keys modules by path, so the process ends up with one MJ core per checkout, even when
 * every lockfile names the same version. Measured on 2026-10-09 with accounting 0.21.2, orders 5.29.0
 * and contracts 0.7.2 beside sales, all locking core 6.1.5: four instances of `@memberjunction/core`,
 * four of `@memberjunction/global`, three of `@mj-biz-apps/common-entities`.
 *
 * When the copies differ in version the suite crashes (`IsFieldReadableByUser is not a function`,
 * `BindProvider is not a function`). When they match, each copy still has its own classes, so an
 * `instanceof` across copies is false and a registration can land in a copy the caller never reads.
 * Hosts used to be repaired by pointing each sibling's links at this checkout's copies by hand
 * (sales#161, sales#200).
 *
 * ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────────
 *
 * A module resolve hook. When a file OUTSIDE this checkout imports `@memberjunction/*` or
 * `@mj-biz-apps/*`, the specifier resolves as follows:
 *
 *   - `@memberjunction/*` always resolves from the packages that declare sales' dependencies
 *     (`packages/IntegrationTests` first), so a sibling gets the exact MJ copy sales' own code uses;
 *   - `@mj-biz-apps/*` resolves to sales' copy, or for a package sales does not install to the sibling
 *     checkout that builds it, but ONLY when that copy is the same version the sibling would have
 *     loaded. A sibling built against a newer BizApps package than sales installs keeps its own copy,
 *     because the older one can lack exports it imports (measured: orders 5.29.0 against sales'
 *     orders-entities 5.26.0).
 *
 * Files inside this checkout resolve normally, so a host where nothing lives outside it (a single
 * install, or a joined workspace) behaves exactly as before.
 *
 * The hook also records every file `@memberjunction/core` resolved to, so a run can state how many
 * instances it loaded instead of a reader inferring it from a crash.
 *
 * `module.registerHooks` runs in-thread and covers `import` and `require` alike. It needs Node 22.15
 * or 23.5+; on an older Node this reports that it could not install and the instance count says what
 * that cost.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));

/** Sales' packages, in the order a downstream name is looked up. IntegrationTests owns the checks. */
const CONSUMERS = ['IntegrationTests', 'CoreEntitiesServer', 'Entities', 'Server', 'Actions', 'Angular'];

/** Every file `@memberjunction/core` resolved to in this process. */
const coreFiles = new Set();

let state = 'not installed';

function realFile(url) {
    if (!url?.startsWith('file:')) return null;
    try {
        return realpathSync(fileURLToPath(url));
    } catch {
        return null;
    }
}

function insideRepo(file) {
    return file === REPO_ROOT || file.startsWith(REPO_ROOT + sep);
}

/** The built entry of an `@mj-biz-apps/*` package in a sibling checkout, matched by package.json name. */
function siblingEntry(name) {
    const parent = dirname(REPO_ROOT);
    let repos = [];
    try {
        repos = readdirSync(parent, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
        return null;
    }
    for (const repo of repos) {
        const pkgDir = join(parent, repo, 'packages');
        if (join(parent, repo) === REPO_ROOT || !existsSync(pkgDir)) continue;
        for (const sub of readdirSync(pkgDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
            const manifest = join(pkgDir, sub.name, 'package.json');
            try {
                if (JSON.parse(readFileSync(manifest, 'utf8')).name !== name) continue;
            } catch {
                continue;
            }
            const entry = join(pkgDir, sub.name, 'dist', 'index.js');
            return existsSync(entry) ? pathToFileURL(entry).href : null;
        }
    }
    return null;
}

/** `@scope/name` of a specifier that may carry a subpath. */
function packageName(specifier) {
    return specifier.split('/').slice(0, 2).join('/');
}

/**
 * The first of sales' packages that can see `specifier`'s package, or null.
 *
 * Checked on disk rather than by calling the next resolver and catching its failure: on Node 24 a
 * failed `nextResolve` with a substituted parent poisons the later call with the original parent, which
 * then fails naming sales' anchor. Only a resolution known to succeed is delegated.
 */
function anchorFor(specifier) {
    const name = packageName(specifier);
    for (const consumer of CONSUMERS) {
        const pkgDir = join(REPO_ROOT, 'packages', consumer);
        if (!existsSync(join(pkgDir, 'package.json'))) continue;
        if (existsSync(join(pkgDir, 'node_modules', name, 'package.json'))
            || existsSync(join(REPO_ROOT, 'node_modules', name, 'package.json'))) {
            return pathToFileURL(join(pkgDir, 'package.json')).href;
        }
    }
    return null;
}

/** Resolve `specifier` as one of sales' own packages would, or null when none of them can. */
function resolveFromTestedCheckout(specifier, context, nextResolve) {
    const anchor = anchorFor(specifier);
    return anchor ? nextResolve(specifier, { ...context, parentURL: anchor }) : null;
}

/** The version of the package that owns `file`, found by walking up to its package.json. */
function versionOf(file, name) {
    let dir = dirname(file);
    while (dir !== dirname(dir)) {
        const manifest = join(dir, 'package.json');
        if (existsSync(manifest)) {
            try {
                const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
                if (pkg.name === name) return pkg.version ?? null;
            } catch {
                return null;
            }
        }
        dir = dirname(dir);
    }
    return null;
}

/**
 * MJ: always this checkout's copy. Every app floors MJ at the same LTS release, and one core is what the
 * checks need; a sibling that needs a newer MJ than this checkout installs is a host to rebuild, not
 * one to run with two cores.
 */
function resolveMJ(specifier, context, nextResolve) {
    return resolveFromTestedCheckout(specifier, context, nextResolve) ?? nextResolve(specifier, context);
}

/**
 * BizApps: the shared copy only when it is the SAME VERSION the sibling would load. Measured: orders
 * 5.29.0's server classes import an export orders-entities 5.26.0 does not have, so pointing them at
 * sales' older copy breaks the load. A sibling newer than what sales installs keeps its own copy.
 */
function resolveBizApps(specifier, context, nextResolve) {
    const own = nextResolve(specifier, context);
    const ownFile = realFile(own.url);
    const name = packageName(specifier);
    if (!ownFile) return own;
    let shared = resolveFromTestedCheckout(specifier, context, nextResolve);
    if (!shared && specifier === name) {
        const url = siblingEntry(name);
        if (url) shared = { url, shortCircuit: true };
    }
    const sharedFile = shared && realFile(shared.url);
    if (!sharedFile || sharedFile === ownFile) return own;
    const ownVersion = versionOf(ownFile, name);
    return ownVersion && ownVersion === versionOf(sharedFile, name) ? shared : own;
}

function resolve(specifier, context, nextResolve) {
    const parentFile = realFile(context.parentURL);
    const fromSibling = !!parentFile && !insideRepo(parentFile);
    let result;
    if (fromSibling && specifier.startsWith('@memberjunction/')) {
        result = resolveMJ(specifier, context, nextResolve);
    } else if (fromSibling && specifier.startsWith('@mj-biz-apps/')) {
        result = resolveBizApps(specifier, context, nextResolve);
    } else {
        result = nextResolve(specifier, context);
    }
    if (specifier === '@memberjunction/core') {
        const file = realFile(result.url);
        if (file) coreFiles.add(file);
    }
    return result;
}

/**
 * Install the hook once per process. Call it before the first sibling package is imported; files this
 * checkout has already loaded keep the copies they resolved, which are the ones siblings are pointed at.
 */
export function ShareTestedCheckoutPackages() {
    if (state !== 'not installed') return state;
    if (typeof nodeModule.registerHooks !== 'function') {
        state = `unavailable on Node ${process.versions.node} (module.registerHooks needs 22.15 or 23.5+)`;
        return state;
    }
    nodeModule.registerHooks({ resolve });
    state = 'installed';
    return state;
}

/** The files `@memberjunction/core` resolved to so far. More than one means more than one MJ core. */
export function MJCoreInstances() {
    return [...coreFiles];
}
