#!/usr/bin/env node
/**
 * Distribution gate — placeholders `mj app install` cannot resolve.
 *
 * MJ and this app agree that `mj-app.json`'s `metadata.directory` is a dev-time pointer: the
 * install engine NEVER reads it, and seeding happens exclusively through `migrations/` generated
 * by the build engineer at release (`mj sync push` against a clean DB). PRs contribute
 * declarative JSON only. There is no per-PR Metadata_Sync, no hash manifest, and no CI gate
 * pretending a file list is current with the seed. The guard that metadata reached a host is
 * the release process — a clean install from migrations — not a proxy in every PR.
 *
 * What this file still checks, because MJ has no equivalent and the failure is silent:
 *
 *   `mj migrate` builds Skyway's placeholder map from THIS repo's mj.config.cjs, but
 *   `mj app install` builds it from the HOST's (MJCLI's open-app-context.ts ->
 *   openApps.migrationPlaceholders). Only `${flyway:defaultSchema}` and `${mjSchema}` are supplied
 *   by the install engine itself. Skyway deliberately leaves an unknown `${...}` UNTOUCHED rather
 *   than failing, so a third placeholder does not error — it survives as a literal string into
 *   whatever SQL contained it. bizapps-forms had `${commonSchema}` do exactly that in two migrations,
 *   silently disabling the bizapps-common exclusion in five CodeGen sweeps.
 *
 * Read-only. No --fix. Exits non-zero on any violation. Node stdlib only, so it runs in CI
 * without an install step.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/**
 * The only placeholders `mj app install` resolves. `flyway:defaultSchema` is the app schema and
 * `mjSchema` the core schema; everything else is the host's to define, and the host has never
 * heard of us.
 */
const INSTALL_SUPPLIED_PLACEHOLDERS = new Set(['flyway:defaultSchema', 'mjSchema']);

function checkPlaceholders(repoRoot, violations) {
    const dirs = [join(repoRoot, 'migrations'), join(repoRoot, 'migrations-teardown')];
    for (const dir of dirs) {
        if (!existsSync(dir)) continue;
        // Teardown scripts get an even smaller map — MJ substitutes ONLY ${mjSchema} there, with a
        // literal string split, no Skyway involved.
        const allowed = dir.endsWith('migrations-teardown') ? new Set(['mjSchema']) : INSTALL_SUPPLIED_PLACEHOLDERS;
        for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
            const sql = readFileSync(join(dir, file), 'utf-8');
            const seen = new Set();
            for (const match of sql.matchAll(/\$\{([^}]+)\}/g)) {
                const name = match[1];
                if (!allowed.has(name) && !seen.has(name)) {
                    seen.add(name);
                    violations.push(
                        `${relative(repoRoot, join(dir, file))} uses \${${name}}, which \`mj app install\` does not ` +
                            `supply (it resolves only ${[...allowed].map((p) => '${' + p + '}').join(' and ')}). Skyway leaves ` +
                            'unknown placeholders untouched, so this would ship as a literal string. Use a literal schema name instead.',
                    );
                }
            }
        }
    }
}

/** Runs the placeholder check against a repo root and returns the violations found. */
export function runChecks(repoRoot = REPO_ROOT) {
    const violations = [];
    checkPlaceholders(repoRoot, violations);
    return violations;
}

if (process.argv[1] && process.argv[1].endsWith('check-distribution-seed.mjs')) {
    const violations = runChecks();

    if (violations.length > 0) {
        console.error('\n❌ Distribution gate failed — shipped SQL uses a placeholder `mj app install` cannot resolve:\n');
        for (const v of violations) console.error(`  • ${v}`);
        console.error('');
        process.exit(1);
    }
    console.log('✅ Distribution gate passed — shipped SQL uses only install-supplied placeholders.');
}
