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
 *     (peerDependencies first, then dependencies, then devDependencies). A file of this checkout whose
 *     package declares nothing (the runner, the scripts) is held to the range sales' packages declare; a
 *     sibling's package that declares nothing takes the build. Failing that, a sibling's import, or a
 *     file of this checkout that declares nothing, takes sales' copy if the range accepts that, and
 *     otherwise keeps its own resolution (sales#372).
 *   - The sibling checkout is the one `BIZAPPS_<APP>_REPO` names (as in `scripts/rebuild-db.sh`), else
 *     the only checkout beside this one that carries the package. When several carry it and none is
 *     named, no sibling build is used and `AmbiguousSiblings` names them (sales#456). Another checkout
 *     of THIS app is never a sibling.
 *   - A package `pnpm-workspace.yaml` overrides is checked against the OVERRIDE's range, not the
 *     requester's, for every requester. That is what pnpm does in sales' own install: the override
 *     replaces every request for the package in the graph, so one copy serves them all. A sibling whose
 *     own range the override replaced and whose range refuses the build is recorded, and the runner
 *     prints it as a warning (sales#231).
 *
 * ── ONE `nextResolve` PER HOOK CALL ─────────────────────────────────────────────────────────────
 *
 * On Node 24.19, a `nextResolve` call with a substituted `parentURL` followed by a second call with the
 * real one returns the FIRST call's result for the second (ESM; measured with two folders that each
 * hold a different copy of one package). The first version of the sibling rule probed sales' copy that
 * way and then fell back to the requester's own resolution, so a requester whose range refused both
 * the build and sales' copy got sales' copy anyway: orders 5.30.0 (common-entities `5.49.0`) and
 * accounting 0.21.2 (`^5.50.2`) loaded sales' common-entities 5.50.1 beside common's build of 5.50.1
 * (sales#231). Sales' copy is therefore probed on disk, and each path below calls `nextResolve` once.
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
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, join, resolve as resolvePath, sep } from 'node:path';
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

/** Each requester whose own range refused the sibling build but was replaced by sales' override. */
const overriddenRefusals = new Map();

/** Each package more than one sibling checkout carries, with those checkouts and the variable that picks one. */
const ambiguousSiblings = new Map();

/** Each sibling build a file of this checkout refused under sales' declared range, and the range. */
const setAsideBuilds = new Map();

let state = 'not installed';

/**
 * The `@mj-biz-apps/*` entries of the `overrides:` block in sales' `pnpm-workspace.yaml`, by name.
 * Read from the file rather than listed here, so the harness follows the install when the override set
 * changes. Only the flat `'name': 'range'` lines that block uses are read.
 */
function readBizAppsOverrides() {
    const overrides = new Map();
    let text = '';
    try {
        text = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8');
    } catch {
        return overrides;
    }
    let inBlock = false;
    for (const line of text.split(/\r?\n/)) {
        if (/^overrides:\s*$/.test(line)) {
            inBlock = true;
            continue;
        }
        if (!inBlock || /^\s*(#|$)/.test(line)) continue;
        if (!/^\s/.test(line)) break;
        const entry = line.match(/^\s+['"]?(@mj-biz-apps\/[^'":\s]+)['"]?\s*:\s*['"]?([^'"#]+?)['"]?\s*(#.*)?$/);
        if (entry) overrides.set(entry[1], entry[2]);
    }
    return overrides;
}

const OVERRIDES = readBizAppsOverrides();

const OWN_PACKAGES = ownPackageNames();

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

/**
 * Entries of `dir` that are directories, FOLLOWING SYMLINKS.
 *
 * `Dirent.isDirectory()` is false for a symlink, so a sibling linked into the parent (one real checkout
 * shared by several worktrees, or a per-ref sibling set swapped in by link) was skipped as if absent.
 */
export function listDirs(dir) {
    return readdirSync(dir, { withFileTypes: true })
        .filter((d) => {
            if (d.isDirectory()) return true;
            if (!d.isSymbolicLink()) return false;
            try {
                return statSync(join(dir, d.name)).isDirectory();
            } catch {
                return false; // a dangling link is not a sibling
            }
        })
        .map((d) => d.name);
}

/**
 * The variable that names the checkout a run takes `name` from: `BIZAPPS_COMMON_REPO` for
 * `@mj-biz-apps/common-entities`. The same names `scripts/rebuild-db.sh` migrates siblings from.
 */
export function CheckoutVariable(name) {
    const app = packageName(name).replace(/^@mj-biz-apps\//, '').split('-')[0];
    return `BIZAPPS_${app.toUpperCase()}_REPO`;
}

/**
 * This checkout's own package names. Another checkout that builds one of them is another worktree of
 * THIS app, never a sibling to load.
 */
function ownPackageNames() {
    const names = new Set();
    let subs = [];
    try {
        subs = listDirs(join(REPO_ROOT, 'packages'));
    } catch {
        return names;
    }
    for (const sub of subs) {
        const name = manifestAt(join(REPO_ROOT, 'packages', sub))?.name;
        if (name) names.add(name);
    }
    return names;
}

/** The package directories under `checkout/packages` whose package.json names `name`. */
function packageDirsIn(checkout, name) {
    const pkgDir = join(checkout, 'packages');
    let subs = [];
    try {
        subs = listDirs(pkgDir);
    } catch {
        return [];
    }
    return subs.map((sub) => join(pkgDir, sub)).filter((dir) => manifestAt(dir)?.name === name);
}

/**
 * Every package directory carrying `name`: in the checkout its `BIZAPPS_<APP>_REPO` names (relative to
 * this checkout), or else in every checkout beside this one. Deduplicated by real path, so links to one
 * checkout count once.
 */
function siblingPackageDirs(name) {
    const chosen = process.env[CheckoutVariable(name)];
    if (chosen) return packageDirsIn(resolvePath(REPO_ROOT, chosen), name);
    const parent = dirname(REPO_ROOT);
    let repos = [];
    try {
        repos = listDirs(parent);
    } catch {
        return [];
    }
    const dirs = new Map();
    for (const repo of repos) {
        if (join(parent, repo) === REPO_ROOT) continue;
        for (const dir of packageDirsIn(join(parent, repo), name)) {
            let real = dir;
            try {
                real = realpathSync(dir);
            } catch {
                // keep the path as listed
            }
            if (real !== REPO_ROOT && !real.startsWith(REPO_ROOT + sep)) dirs.set(real, dir);
        }
    }
    return [...dirs.values()];
}

/**
 * The built entry and version of an `@mj-biz-apps/*` package in a sibling checkout, matched by name, or
 * null.
 *
 * NEVER THE FIRST OF SEVERAL. In a folder holding several worktrees of one repo, directory order picked
 * a checkout per package, so two packages of one app could load from two worktrees and the run stopped
 * on duplicates before any check (sales#456). When more than one checkout carries the package and no
 * `BIZAPPS_<APP>_REPO` names one, no sibling build is used and the ambiguity is recorded for the run to
 * report.
 */
function findSiblingBuild(name) {
    if (OWN_PACKAGES.has(name)) return null;
    const variable = CheckoutVariable(name);
    const dirs = siblingPackageDirs(name);
    // A named checkout that does not carry the package is a wrong path, not an absent app.
    const wrongChoice = dirs.length === 0 && !!process.env[variable];
    if (dirs.length > 1 || wrongChoice) {
        ambiguousSiblings.set(name, { variable, checkouts: dirs.map((d) => dirname(dirname(d))) });
        return null;
    }
    if (dirs.length === 0) return null;
    const entry = join(dirs[0], 'dist', 'index.js');
    return existsSync(entry) ? { url: pathToFileURL(entry).href, entry, version: manifestAt(dirs[0]).version } : null;
}

function siblingBuild(name) {
    if (!siblingBuilds.has(name)) siblingBuilds.set(name, findSiblingBuild(name));
    return siblingBuilds.get(name);
}

/**
 * The built entry file of a sibling package, or null when it is absent, unbuilt, or carried by more than
 * one checkout with none chosen (`AmbiguousSiblings` then names them).
 */
export function SiblingBuildEntry(name) {
    return siblingBuild(name)?.entry ?? null;
}

/** `@scope/name` of a specifier that may carry a subpath. */
function packageName(specifier) {
    return specifier.split('/').slice(0, 2).join('/');
}

/**
 * The first of sales' packages that can see `specifier`'s package, with the version of the copy it sees,
 * or null.
 *
 * Checked on disk rather than by calling the next resolver: on Node 24 a `nextResolve` with a
 * substituted parent carries over to the hook's next `nextResolve` (see "ONE `nextResolve` PER HOOK
 * CALL"), whether the first call failed or succeeded. Only a resolution that will be returned is
 * delegated.
 */
function testedCopy(specifier) {
    const name = packageName(specifier);
    for (const consumer of CONSUMERS) {
        const pkgDir = join(REPO_ROOT, 'packages', consumer);
        if (!existsSync(join(pkgDir, 'package.json'))) continue;
        const copyDir = [join(pkgDir, 'node_modules', name), join(REPO_ROOT, 'node_modules', name)]
            .find((dir) => existsSync(join(dir, 'package.json')));
        if (copyDir) {
            return { anchor: pathToFileURL(join(pkgDir, 'package.json')).href, version: manifestAt(copyDir)?.version ?? null };
        }
    }
    return null;
}

/** Resolve `specifier` as one of sales' own packages would, or null when none of them can. */
function resolveFromTestedCheckout(specifier, context, nextResolve) {
    const copy = testedCopy(specifier);
    return copy ? nextResolve(specifier, { ...context, parentURL: copy.anchor }) : null;
}

/** The range `manifest` declares for `name`, or null when it declares none. */
function rangeIn(manifest, name) {
    return manifest?.peerDependencies?.[name] ?? manifest?.dependencies?.[name] ?? manifest?.devDependencies?.[name] ?? null;
}

/** The range the first of sales' packages that declares `name` gives it, or null when none does. */
function salesRange(name) {
    for (const consumer of CONSUMERS) {
        const range = rangeIn(manifestAt(join(REPO_ROOT, 'packages', consumer)), name);
        if (range !== null) return range;
    }
    return null;
}

/**
 * The range the package owning `file` declares for `name`, or null when it declares none.
 *
 * A file of this checkout whose package declares nothing for `name` (the runner and the scripts, owned
 * by the root package.json) is held to the range sales' packages declare. Unheld, it took any sibling
 * build, so in a joined workspace the runner loaded a sibling's tasks 1.6.2 while sales' packages loaded
 * their declared 1.7 copy, and the run stopped on duplicates (sales#372).
 */
function declaredRange(file, name) {
    const own = rangeIn(owningPackage(file)?.manifest, name);
    return own === null && insideRepo(file) ? salesRange(name) : own;
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

/**
 * MJ: always this checkout's copy. Every app floors MJ at the same LTS release, and one core is what the
 * checks need; a sibling that needs a newer MJ than this checkout installs is a host to rebuild, not
 * one to run with two cores.
 */
function resolveMJ(specifier, context, nextResolve) {
    return resolveFromTestedCheckout(specifier, context, nextResolve) ?? nextResolve(specifier, context);
}

/**
 * The range a requester is held to: sales' override for the package when there is one, as pnpm applies
 * it in sales' install, otherwise the requester's own. A requester whose own range would have refused
 * the build is recorded, so the run can say whose range the override set aside.
 */
function effectiveRange(parentFile, name, built) {
    const own = declaredRange(parentFile, name);
    const override = OVERRIDES.get(name);
    if (override === undefined) return own;
    // A range semver cannot read (`workspace:*`) is the build's own workspace asking for itself; the
    // build is that same file, so nothing was set aside.
    if (built && semver.validRange(own) && !accepts(own, built.version) && accepts(override, built.version)) {
        const requester = owningPackage(parentFile);
        const refusals = overriddenRefusals.get(name) ?? new Map();
        refusals.set(`${requester?.manifest.name ?? parentFile}@${requester?.manifest.version ?? '?'}`, own);
        overriddenRefusals.set(name, refusals);
    }
    return override;
}

/**
 * BizApps: the sibling checkout that builds the package when the requester's range accepts it; for a
 * sibling's import, sales' copy when its range accepts that; otherwise the requester's own. Subpath
 * imports keep their own resolution, and the copy count reports it if that loads a second copy.
 * Every path calls `nextResolve` at most once.
 */
function resolveBizApps(specifier, context, nextResolve, parentFile, fromSibling) {
    const name = packageName(specifier);
    const built = specifier === name ? siblingBuild(name) : null;
    const range = effectiveRange(parentFile, name, built);
    if (built && accepts(range, built.version)) return { url: built.url, shortCircuit: true };
    // A file of this checkout that declares nothing itself takes the copy sales' packages resolve, as a
    // sibling does: its own plain resolution can reach a workspace-linked sibling build (sales#372).
    const heldToSales = !fromSibling && rangeIn(owningPackage(parentFile)?.manifest, name) === null;
    if (built && heldToSales) setAsideBuilds.set(name, { version: built.version, range, entry: built.entry });
    if (fromSibling || heldToSales) {
        const shared = testedCopy(specifier);
        if (shared && accepts(range, shared.version)) return nextResolve(specifier, { ...context, parentURL: shared.anchor });
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

/**
 * Each package more than one sibling checkout carries while no `BIZAPPS_<APP>_REPO` picks one, with the
 * checkouts and the variable to set; or whose `BIZAPPS_<APP>_REPO` names a checkout that does not carry
 * it (`checkouts` is then empty). No sibling build of these was used.
 */
export function AmbiguousSiblings() {
    return [...ambiguousSiblings].map(([name, { variable, checkouts }]) => ({ name, variable, checkouts }));
}

/**
 * Each sibling build this checkout's own files did not take because sales' declared range refuses its
 * version, with that range. Sales' copy was loaded instead.
 */
export function SetAsideSiblingBuilds() {
    return [...setAsideBuilds].map(([name, { version, range, entry }]) => ({ name, version, range, entry }));
}

/**
 * For each overridden `@mj-biz-apps/*` package, the requesters whose own range refused the sibling build
 * and were given it because sales' override replaced that range, as `name@version (range)`.
 */
export function OverriddenRanges() {
    return [...overriddenRefusals]
        .map(([name, refusals]) => ({ name, override: OVERRIDES.get(name), requesters: [...refusals].map(([who, range]) => `${who} (${range})`) }));
}
