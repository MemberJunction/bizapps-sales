#!/usr/bin/env node
/**
 * Every `var(--mj-…)` this repo uses must be a token MemberJunction defines.
 *
 * CSS gives no error for an unknown custom property. A declaration that reads one with no fallback is
 * dropped at computed-value time, so the element falls back to inherited or initial values. That is
 * how the deal activity form shipped with borderless, transparent inputs and a "Log it" button in
 * near-black text on a transparent background: four token names that MJ never defined, and nothing
 * that checked.
 *
 * A fallback does not make an unknown name acceptable either. `var(--mj-color-border, rgba(…))` always
 * renders the fallback, so the rule follows neither theme.
 *
 * The accepted names are `scripts/mj-tokens.json`, copied from the MJ release this repo builds against
 * by `scripts/refresh-mj-tokens.mjs`. The gate fails when that copy is for a different MJ version than
 * the `@memberjunction/core` anchor in `packages/Angular`, so a bump cannot leave it behind.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Packages that carry styles. A root that matches nothing fails the gate, so a moved path cannot shrink coverage unnoticed. */
const SEARCH_ROOTS = ['packages/Angular/src'];

const SKIP_DIR = new Set(['generated', 'node_modules', 'dist']);
const SOURCE_FILE = /\.(ts|css|scss|html)$/;
const TOKEN_USE = /var\(\s*(--mj-[a-z0-9-]+)/g;

function* walk(dir) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return;
    }
    for (const name of entries) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (!SKIP_DIR.has(name)) yield* walk(full);
        } else if (SOURCE_FILE.test(name) && !name.endsWith('.d.ts')) {
            yield full;
        }
    }
}

function readAllowlist() {
    const list = JSON.parse(readFileSync(join(ROOT, 'scripts/mj-tokens.json'), 'utf8'));
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/Angular/package.json'), 'utf8'));
    const anchor = pkg.devDependencies?.['@memberjunction/core'];
    if (list.mjVersion !== anchor) {
        console.error(`\nmj-tokens: ERROR — scripts/mj-tokens.json is for MJ ${list.mjVersion}, but packages/Angular builds against ${anchor}.`);
        console.error('Run `node scripts/refresh-mj-tokens.mjs` and commit the result.\n');
        process.exit(2);
    }
    return new Set(list.tokens);
}

function scanRoot(searchRoot, known, violations) {
    let files = 0;
    for (const file of walk(join(ROOT, searchRoot))) {
        files++;
        const rel = relative(ROOT, file).split(sep).join('/');
        readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
            for (const [, name] of line.matchAll(TOKEN_USE)) {
                if (!known.has(name)) violations.push({ file: rel, line: i + 1, name });
            }
        });
    }
    return files;
}

const known = readAllowlist();
const violations = [];
let scanned = 0;
const emptyRoots = [];
for (const searchRoot of SEARCH_ROOTS) {
    const files = scanRoot(searchRoot, known, violations);
    if (files === 0) emptyRoots.push(searchRoot);
    scanned += files;
}

if (emptyRoots.length > 0) {
    console.error(`\nmj-tokens: ERROR — declared root(s) matched no files: ${emptyRoots.join(', ')}.`);
    console.error('A gate that scans nothing must not report success. Fix the path or remove the root.\n');
    process.exit(2);
}

if (violations.length === 0) {
    console.log(`mj-tokens: clean — ${scanned} file(s) scanned, every --mj-* name is one of MJ's ${known.size} tokens.`);
    process.exit(0);
}

console.error(`\nmj-tokens: ${violations.length} use(s) of --mj-* names MemberJunction does not define:\n`);
for (const v of violations) console.error(`    ${v.file}:${v.line}  ${v.name}`);
console.error('\nUse a token from scripts/mj-tokens.json (for example --mj-border-default, --mj-bg-surface,');
console.error('--mj-brand-primary with --mj-brand-on-primary, --mj-text-primary, --mj-space-N).\n');
process.exit(1);
