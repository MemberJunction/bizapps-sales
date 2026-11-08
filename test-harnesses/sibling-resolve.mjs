/**
 * @fileoverview Import a sibling BizApps package by NAME: a plain import, then the copy
 * `packages/IntegrationTests` declares, then a built sibling checkout.
 *
 * ── WHY A PLAIN `import` DOES NOT WORK FROM HERE ────────────────────────────────────────────────
 *
 * pnpm gives sales no `node_modules` entry for a package it does not declare, and the cross-repo
 * workspace does not hoist `@mj-biz-apps/*` to its root either — they live in a virtual store. So
 * `import('@mj-biz-apps/contracts-core-entities-server')` throws `ERR_MODULE_NOT_FOUND` from a script in
 * this folder, no matter that the package is built and sitting one directory up.
 *
 * The scan itself lives in `one-mj-core.mjs`, so this helper, the runner and the resolve hook agree on
 * which checkout a package comes from: the one `BIZAPPS_<APP>_REPO` names, else the only one carrying
 * it. When several carry it and none is named, nothing is picked (sales#456).
 *
 * FOLDER NAMES ARE NEVER ASSUMED (`EngineBase` vs `engine-base` vs `Entities`) — the `name` in
 * package.json is the only thing matched, so this keeps working when a sibling reorganises.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { AmbiguousSiblings, ShareTestedCheckoutPackages, SiblingBuildEntry } from './one-mj-core.mjs';

/** The built entry point of a sibling package, or null when it is absent, unbuilt or ambiguous. */
export function resolveSiblingPackage(name) {
    return SiblingBuildEntry(name);
}

/** Why `name` has no sibling build when several checkouts carry it, or null. */
export function AmbiguityMessage(name) {
    const hit = AmbiguousSiblings().find((a) => a.name === name);
    if (!hit) return null;
    if (hit.checkouts.length === 0) {
        return `${hit.variable}=${process.env[hit.variable]} names a checkout that does not carry ${name}.`;
    }
    return (
        `${name} is carried by ${hit.checkouts.length} checkouts beside this one (${hit.checkouts.join(', ')}). ` +
        `Set ${hit.variable} to the one this run should use.`
    );
}

/**
 * The copy `packages/IntegrationTests` declares, when a plain import cannot see it. The harnesses' sibling
 * packages are devDependencies there, so a clone with no sibling checkouts still resolves them, at the
 * version the lockfile records. Null when it is not declared or not installed.
 */
function resolveDeclared(name) {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    try {
        return createRequire(join(repoRoot, 'packages', 'IntegrationTests', 'package.json')).resolve(name);
    } catch {
        return null;
    }
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
    // A sibling checkout must load THIS checkout's MJ core, not its own (sales#200).
    ShareTestedCheckoutPackages();
    let mod = null;
    try {
        mod = await import(name);
    } catch (err) {
        if (err?.code !== 'ERR_MODULE_NOT_FOUND') {
            throw err;
        }
    }
    // Several checkouts carry it and none was chosen: whatever loaded is not a checkout anyone picked.
    const ambiguity = AmbiguityMessage(name);
    if (ambiguity) throw new Error(ambiguity);
    if (mod) return mod;
    const entry = resolveDeclared(name) ?? resolveSiblingPackage(name);
    if (!entry) {
        throw new Error(
            `${name} is neither resolvable nor built in a sibling repo. Check it out beside this one and ` +
                'build it — see docs/WORKSPACE-SETUP.md.',
        );
    }
    return import(pathToFileURL(entry).href);
}
