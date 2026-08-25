/**
 * @fileoverview Import a sibling BizApps package by NAME, without declaring a dependency on it.
 *
 * ── WHY A PLAIN `import` DOES NOT WORK FROM HERE ────────────────────────────────────────────────
 *
 * pnpm gives sales no `node_modules` entry for a package it does not declare, and the cross-repo
 * workspace does not hoist `@mj-biz-apps/*` to its root either — they live in a virtual store. So
 * `import('@mj-biz-apps/contracts-core-entities-server')` throws `ERR_MODULE_NOT_FOUND` from a script in
 * this folder, no matter that the package is built and sitting one directory up.
 *
 * `test-harnesses/integration.mjs` has carried this scan for a while. It is extracted here because two
 * standalone proof harnesses arrived with plain imports and neither could run —
 * `prove-close-won-route.mjs` and `prove-contracts-seam.mjs`, both of which pass on the branch they were
 * written on and fail the moment they are merged into a tree whose links differ. A harness that only runs
 * where it was written proves something about that checkout, not about the app.
 *
 * The runner keeps its own copy for now, deliberately: it is green, it is the thing every check depends
 * on, and swapping its resolution out as a side effect of a merge is not a trade worth making. Two copies
 * of thirty lines, with this comment naming the other, beats risking the suite.
 *
 * FOLDER NAMES ARE NEVER ASSUMED (`EngineBase` vs `engine-base` vs `Entities`) — the `name` in
 * package.json is the only thing matched, so this keeps working when a sibling reorganises.
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The built entry point of a sibling package, or null when it is absent or unbuilt. */
export function resolveSiblingPackage(name, from = process.cwd()) {
    const parent = join(from, '..');
    let repos = [];
    try {
        repos = readdirSync(parent, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
        return null;
    }
    for (const repo of repos) {
        const pkgDir = join(parent, repo, 'packages');
        if (!existsSync(pkgDir)) continue;
        let subs = [];
        try {
            subs = readdirSync(pkgDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
        } catch {
            continue;
        }
        for (const sub of subs) {
            const manifest = join(pkgDir, sub, 'package.json');
            if (!existsSync(manifest)) continue;
            try {
                if (JSON.parse(readFileSync(manifest, 'utf8')).name !== name) continue;
            } catch {
                continue;
            }
            const entry = join(pkgDir, sub, 'dist', 'index.js');
            return existsSync(entry) ? entry : null;
        }
    }
    return null;
}

/**
 * Import a sibling, trying the ordinary specifier FIRST.
 *
 * That order matters: on a host where the package IS declared and linked, the normal specifier gives
 * node its own module cache entry, and resolving to a file path instead would load a SECOND copy of the
 * module. For anything carrying `@RegisterClass` registrations — which is all of these — two copies means
 * two registries and a last-one-wins race that is invisible until something resolves the wrong class.
 */
export async function importSibling(name) {
    try {
        return await import(name);
    } catch (err) {
        if (err?.code !== 'ERR_MODULE_NOT_FOUND') {
            throw err;
        }
    }
    const entry = resolveSiblingPackage(name);
    if (!entry) {
        throw new Error(
            `${name} is neither resolvable nor built in a sibling repo. Check it out beside this one and ` +
                'build it — see docs/WORKSPACE-SETUP.md.',
        );
    }
    return import(pathToFileURL(entry).href);
}
