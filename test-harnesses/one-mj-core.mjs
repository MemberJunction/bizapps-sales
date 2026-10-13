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
 * A module resolve hook, with a load hook that counts what it produced.
 *
 *   - `@memberjunction/*`, imported by a file OUTSIDE this checkout, always resolves from the packages
 *     that declare sales' dependencies (`packages/IntegrationTests` first), so a sibling gets the exact
 *     MJ copy sales' own code uses.
 *   - `@mj-biz-apps/*`, imported by ANY file, this checkout's included, resolves to the sibling checkout
 *     that builds the package whenever the importing package's declared range accepts that version
 *     (peerDependencies first, then dependencies, then devDependencies; a package that declares nothing
 *     takes it). Failing that, a sibling's import takes sales' copy if its range accepts that, and
 *     otherwise keeps its own.
 *
 * Why the building checkout and not sales' copy: it is the newest on the host, and the range is the
 * requester's own statement of what it works with. An equal-version rule (the first version of this
 * file) left three `accounting-engine-base` copies in one process (0.21.2 from accounting, 0.20.0 from
 * sales' install, 0.17.0 from orders' lockfile), and `BaseSingleton` keys its instance by class name in
 * a global store, so `AccountingEngineBase.Instance` returned whichever copy was created first. Orders'
 * 0.17.0 won and accounting's journal-entry server failed on `FiscalYearStartFor is not a function`
 * (sales#211). Sales' own imports go through the same rule so that its older copy of a package a
 * sibling builds is not loaded beside the sibling's.
 *
 * On a host where nothing lives outside this checkout (a single install, or a joined workspace) no
 * sibling builds anything, so resolution is unchanged.
 *
 * The hooks record every file `@memberjunction/core` resolved to, and every directory an
 * `@mj-biz-apps/*` package was loaded from, so a run can state what it loaded instead of a reader
 * inferring it from a crash.
 *
 * `module.registerHooks` runs in-thread and covers `import` and `require` alike. It needs Node 22.15
 * or 23.5+; on an older Node this reports that it could not install and the instance count says what
 * that cost.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import semver from 'semver';

const REPO_ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));

/** Sales' packages, in the order a downstream name is looked up. IntegrationTests owns the checks. */
const CONSUMERS = ['IntegrationTests', 'CoreEntitiesServer', 'Entities', 'Server', 'Actions', 'Angular'];

/** Every file `@memberjunction/core` resolved to in this process. */
const coreFiles = new Set();

/** For each `@mj-biz-apps/*` package loaded, the directories it was loaded from, with their versions. */
const bizAppsCopies = new Map();

/** package.json contents by directory, null where there is none. Read once per directory. */
const manifests = new Map();

/** The sibling build of each `@mj-biz-apps/*` package, found once per name. */
const siblingBuilds = new Map();

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

function manifestAt(dir) {
    if (!manifests.has(dir)) {
        let manifest = null;
        try {
            manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        } catch {
            // no package.json here, or an unreadable one
        }
        manifests.set(dir, manifest);
    }
    return manifests.get(dir);
}

/** The nearest named package above `file`: its directory and manifest, or null. */
function owningPackage(file) {
    let dir = dirname(file);
    while (dir !== dirname(dir)) {
        const manifest = manifestAt(dir);
        if (manifest?.name) return { dir, manifest };
        dir = dirname(dir);
    }
    return null;
}

/** The built entry and version of an `@mj-biz-apps/*` package in a sibling checkout, matched by name. */
function findSiblingBuild(name) {
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
            const manifest = manifestAt(join(pkgDir, sub.name));
            if (manifest?.name !== name) continue;
            const entry = join(pkgDir, sub.name, 'dist', 'index.js');
            return existsSync(entry) ? { url: pathToFileURL(entry).href, version: manifest.version } : null;
        }
    }
    return null;
}

function siblingBuild(name) {
    if (!siblingBuilds.has(name)) siblingBuilds.set(name, findSiblingBuild(name));
    return siblingBuilds.get(name);
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

/** The range the package owning `file` declares for `name`, or null when it declares none. */
function declaredRange(file, name) {
    const manifest = owningPackage(file)?.manifest;
    return manifest?.peerDependencies?.[name] ?? manifest?.dependencies?.[name] ?? manifest?.devDependencies?.[name] ?? null;
}

/**
 * Whether a requester that declared `range` can take `version`. No declaration accepts anything; a range
 * semver cannot read (`workspace:*`) accepts nothing, which leaves a package inside its own workspace on
 * its own resolution, the same file.
 */
function accepts(range, version) {
    if (range === null) return true;
    if (!version || !semver.validRange(range)) return false;
    return semver.satisfies(version, range, { includePrerelease: true });
}

function versionAt(url) {
    const file = realFile(url);
    return file ? owningPackage(file)?.manifest.version ?? null : null;
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
 * BizApps: the sibling checkout that builds the package when the requester's range accepts it; for a
 * sibling's import, sales' copy when its range accepts that; otherwise the requester's own. Subpath
 * imports keep their own resolution, and the copy count reports it if that loads a second copy.
 */
function resolveBizApps(specifier, context, nextResolve, parentFile, fromSibling) {
    const name = packageName(specifier);
    const range = declaredRange(parentFile, name);
    const built = specifier === name ? siblingBuild(name) : null;
    if (built && accepts(range, built.version)) return { url: built.url, shortCircuit: true };
    if (fromSibling) {
        const shared = resolveFromTestedCheckout(specifier, context, nextResolve);
        if (shared && accepts(range, versionAt(shared.url))) return shared;
    }
    return nextResolve(specifier, context);
}

function resolve(specifier, context, nextResolve) {
    const parentFile = realFile(context.parentURL);
    const fromSibling = !!parentFile && !insideRepo(parentFile);
    let result;
    if (fromSibling && specifier.startsWith('@memberjunction/')) {
        result = resolveMJ(specifier, context, nextResolve);
    } else if (parentFile && specifier.startsWith('@mj-biz-apps/')) {
        result = resolveBizApps(specifier, context, nextResolve, parentFile, fromSibling);
    } else {
        result = nextResolve(specifier, context);
    }
    if (specifier === '@memberjunction/core') {
        const file = realFile(result.url);
        if (file) coreFiles.add(file);
    }
    return result;
}

/** Records the directory and version of every `@mj-biz-apps/*` package a module is loaded from. */
function load(url, context, nextLoad) {
    const file = url.startsWith('file:') ? fileURLToPath(url) : null;
    const owner = file && owningPackage(file);
    if (owner?.manifest.name.startsWith('@mj-biz-apps/')) {
        const copies = bizAppsCopies.get(owner.manifest.name) ?? new Map();
        copies.set(owner.dir, owner.manifest.version);
        bizAppsCopies.set(owner.manifest.name, copies);
    }
    return nextLoad(url, context);
}

/**
 * Install the hooks once per process. Call it before the first sibling package is imported; files this
 * checkout has already loaded keep the copies they resolved, which are the ones siblings are pointed at.
 */
export function ShareTestedCheckoutPackages() {
    if (state !== 'not installed') return state;
    if (typeof nodeModule.registerHooks !== 'function') {
        state = `unavailable on Node ${process.versions.node} (module.registerHooks needs 22.15 or 23.5+)`;
        return state;
    }
    nodeModule.registerHooks({ resolve, load });
    state = 'installed';
    return state;
}

/** The files `@memberjunction/core` resolved to so far. More than one means more than one MJ core. */
export function MJCoreInstances() {
    return [...coreFiles];
}

/** Every `@mj-biz-apps/*` package loaded from more than one directory, with each copy's version and path. */
export function BizAppsDuplicates() {
    return [...bizAppsCopies]
        .filter(([, copies]) => copies.size > 1)
        .map(([name, copies]) => ({ name, copies: [...copies].map(([dir, version]) => `${version} ${dir}`) }));
}
