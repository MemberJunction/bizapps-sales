/**
 * Every declared dependency is in the lockfile.
 *
 * WHY THIS IS HERE. On 2026-08-30 `next` was left unbuildable: `packages/CoreEntitiesServer` gained
 * `@mj-biz-apps/common-activity-sync@5.36.0` and `pnpm-lock.yaml` never gained the matching entry, so
 * CI died at `pnpm install --frozen-lockfile` before it compiled a line —
 *
 *     ERR_PNPM_OUTDATED_LOCKFILE ... * 1 dependencies were added: @mj-biz-apps/common-activity-sync@5.36.0
 *
 * — and took every open PR down with it, including two that had touched neither file. The failure is
 * invisible on the machine that makes it: this repo is usually developed inside a joined pnpm
 * workspace where the sibling repos are LINKED, so everything resolves, builds and tests locally
 * while a clean install anywhere else cannot even start.
 *
 * Ported from `bizapps-contracts`, where it exists because the same mistake was made twice in one
 * branch. It caught a third instance in contracts the same afternoon this one broke sales.
 *
 * ⚠ WHAT THIS TEST CANNOT DO. It runs AFTER `pnpm install` in CI (`.github/workflows/ci.yml`: the
 * install is step one, the gates come after), so on a broken lockfile CI is already dead before
 * vitest starts. Its value is entirely LOCAL — `pnpm run test:unit` names the problem, in a sentence,
 * on the machine that can still fix it cheaply. Do not read a green CI as this test having passed.
 *
 * Scope: `dependencies`, `devDependencies` AND `peerDependencies`.
 *
 * PEERS WERE EXCLUDED HERE AND THAT WAS WRONG. The original note argued pnpm does not install a peer
 * into the declaring package's importer, so a peer legitimately has no importer entry. That is not
 * true under this workspace's `.npmrc`, which sets `auto-install-peers=true`: measured 2026-09-03,
 * all 37 peerDependencies across these packages HAVE an importer entry, with no exceptions.
 *
 * The exclusion was not academic. It is precisely the case that broke `bizapps-common#98` — two
 * peerDependencies were added to `packages/Server/package.json`, the lockfile was not refreshed, and
 * CI died on `ERR_PNPM_OUTDATED_LOCKFILE`. The check that exists to pre-empt that error would have
 * skipped the very fields that caused it.
 *
 * IF THIS EVER GOES NOISY, read it before deleting it: a peer with no importer entry means
 * `auto-install-peers` is no longer in effect for the install that produced the lockfile. That is a
 * real change in how this repo resolves dependencies, and the right response is to confirm the
 * setting rather than to narrow this assertion back.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const LOCKFILE = ROOT + 'pnpm-lock.yaml';

/**
 * Parse the lockfile's `importers:` section into `{ importerPath: Set<dependencyName> }`.
 *
 * Hand-parsed rather than pulled through a YAML library on purpose: the shape being read is two
 * levels of a known, machine-generated file, and adding a parser dependency to make one assertion is
 * a worse trade than twenty lines that fail loudly if the format moves. `expect(importers.size)`
 * below is what catches a format change — an empty parse would otherwise make this test vacuous,
 * which is the failure mode of every hand-rolled parser in a test.
 */
function parseImporters(lock: string): Map<string, Set<string>> {
    const lines = lock.split('\n');
    const importers = new Map<string, Set<string>>();
    let inImporters = false;
    let current: string | null = null;

    for (const line of lines) {
        if (/^importers:\s*$/.test(line)) {
            inImporters = true;
            continue;
        }
        if (!inImporters) continue;
        // A new top-level key ends the importers section.
        if (/^\S/.test(line)) break;

        // Importer paths sit at exactly two spaces: "  .:" or "  packages/Angular:"
        const importer = line.match(/^ {2}(\S.*):\s*$/);
        if (importer) {
            current = importer[1].replace(/^['"]|['"]$/g, '');
            importers.set(current, new Set());
            continue;
        }
        // Dependency names sit at exactly six spaces under a dependencies/devDependencies block.
        const dep = line.match(/^ {6}('?[@\w][^:']*'?):\s*$/);
        if (dep && current) {
            importers.get(current)!.add(dep[1].replace(/^'|'$/g, ''));
        }
    }
    return importers;
}

const lock = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : '';
const importers = parseImporters(lock);

/** Every package.json that pnpm treats as a workspace importer: the root plus each packages/* dir. */
function manifests(): Array<{ importer: string; path: string }> {
    const out = [{ importer: '.', path: ROOT + 'package.json' }];
    for (const dir of readdirSync(ROOT + 'packages')) {
        const p = `${ROOT}packages/${dir}/package.json`;
        if (existsSync(p)) out.push({ importer: `packages/${dir}`, path: p });
    }
    return out;
}

describe('pnpm-lock.yaml covers every declared dependency', () => {
    it('the lockfile parsed at all', () => {
        // Guards the whole suite against becoming vacuous if the lockfile format changes.
        expect(lock.length, 'pnpm-lock.yaml is missing or empty').toBeGreaterThan(0);
        expect(importers.size, 'parsed no importers — the lockfile format may have changed').toBeGreaterThan(1);
        expect(importers.has('.'), 'no root importer found').toBe(true);
    });

    for (const { importer, path } of manifests()) {
        it(`${importer}: every dependency, devDependency and peerDependency is locked`, () => {
            const pkg = JSON.parse(readFileSync(path, 'utf8')) as {
                dependencies?: Record<string, string>;
                devDependencies?: Record<string, string>;
                peerDependencies?: Record<string, string>;
            };
            const declared = [
                ...Object.keys(pkg.dependencies ?? {}),
                ...Object.keys(pkg.devDependencies ?? {}),
                ...Object.keys(pkg.peerDependencies ?? {}),
            ];
            const locked = importers.get(importer);

            expect(locked, `lockfile has no importer entry for "${importer}"`).toBeDefined();
            const missing = declared.filter((d) => !locked!.has(d));
            expect(
                missing,
                `${importer}/package.json declares ${missing.length} dependency(ies) absent from the ` +
                    `lockfile: ${missing.join(', ')}.\n\n` +
                    `TWO CAUSES, and they need different fixes:\n` +
                    `  (a) The package IS published and the lockfile was simply not refreshed. Run ` +
                    `\`pnpm install --lockfile-only\` in a THROWAWAY CLONE of the manifests — never inside ` +
                    `the joined instance workspace, which resolves sibling repos as links and would write a ` +
                    `lockfile that cannot install anywhere else — then COPY THE RESULT BACK.\n` +
                    `  (b) The package is NOT published yet, and the refresh in (a) will fail with a 404. ` +
                    `Nobody can fix the lockfile until it is published; the fix belongs to whoever owns ` +
                    `that package's release. Check with \`npm view <name> version\` before assuming (a).`,
            ).toEqual([]);
        });
    }
});
