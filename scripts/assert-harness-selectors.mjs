#!/usr/bin/env node
/**
 * THE EXPLORER HARNESS MAY ONLY TARGET MARKUP THE APP STILL RENDERS. This is the gate for that (#88).
 *
 * `test:spec-gate` type-checks the specs, and a spec that waits for a component nothing mounts compiles
 * perfectly. That is how 26 of 33 specs came to fail in setup against `mjs-deal-workspace` long after
 * the Workspace rail was removed: the harness is out of CI because it needs a live host and a human
 * login, so nothing ran it, and nothing that did run could see the problem.
 *
 * This checks the one thing that needs neither: every app hook a harness file names must be declared
 * in a template that is actually MOUNTED.
 *
 *   - `data-testid`   — `data-testid="x"` literals and `ByTestId(page, 'x')` calls
 *   - `data-field`    — `data-field="x"` literals and `Field` / `SetText` / `PickLookup` /
 *                       `FieldIsEditable(page, 'x')` calls
 *   - component tags  — an `mjs-*` token that is some component's selector must be a LIVE one
 *   - app CSS classes — a `.mjs-*` / `.dw-*` class the harness selects on must appear in a live file
 *
 * ── WHAT "LIVE" MEANS, AND WHY IT IS COMPUTED RATHER THAN LISTED ────────────────────────────────
 *
 * A component is live when it is registered for dynamic mounting (`@RegisterClass` / `@RegisterClassEx`
 * — forms, form panels, the section resource) or when its selector appears as a tag in a live template.
 * Computed to a fixpoint, so a component used only by a dead one is dead too. A hand-kept list of dead
 * components would be right until the next removal, which is the failure this gate exists to catch.
 *
 * Declarations in a dead component's files do not count. The workspace's own templates still declare
 * `close-open` and `.dw-field`; counting them would certify the exact references that broke.
 *
 * Comments in harness files are stripped before scanning, so prose about the removed UI is allowed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(ROOT, 'packages', 'Angular', 'src', 'lib');
const HARNESS_DIR = join(ROOT, 'test-harnesses', 'playwright');

function walk(dir, keep) {
    const out = [];
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.') || name === '__tests__') continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...walk(full, keep));
        else if (keep(full)) out.push(full);
    }
    return out;
}

// ── The app: components, their templates, and which are live ───────────────────────────────────

function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
        .replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/**
 * App sources with comments stripped: a comment naming a removed class (the panels file has one for
 * `dw-field__hint`) is not a declaration of it.
 */
const appFiles = walk(APP_DIR, (f) => /\.(ts|html)$/.test(f) && !/\.test\.ts$/.test(f));
const text = new Map(appFiles.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));

/** @type {{ selector: string, files: string[], registered: boolean }[]} */
const components = [];
for (const [file, src] of text) {
    if (!file.endsWith('.ts') || !src.includes('@Component(')) continue;
    const registered = /@RegisterClass(Ex)?\(/.test(src);
    const urls = [...src.matchAll(/templateUrl:\s*'([^']+)'/g)].map((m) => resolve(dirname(file), m[1]));
    for (const m of src.matchAll(/selector:\s*'([a-z][a-z0-9-]*)'/g)) {
        components.push({ selector: m[1], files: [file, ...urls.filter((u) => text.has(u))], registered });
    }
}

const tagIn = (src, selector) => new RegExp(`<${selector}[\\s>/]`).test(src);
const live = new Set(components.filter((c) => c.registered));
for (let grew = true; grew; ) {
    grew = false;
    const liveSrc = [...live].flatMap((c) => c.files.map((f) => text.get(f))).join('\n');
    for (const c of components) {
        if (!live.has(c) && tagIn(liveSrc, c.selector)) {
            live.add(c);
            grew = true;
        }
    }
}

const liveFiles = new Set([...live].flatMap((c) => c.files));
const deadSelectors = new Set(components.filter((c) => !live.has(c)).map((c) => c.selector));
const allSelectors = new Set(components.map((c) => c.selector));
const liveSrc = [...liveFiles].map((f) => text.get(f)).join('\n');

const testIds = new Set();
const fields = new Set();
for (const file of liveFiles) {
    const src = text.get(file);
    for (const m of src.matchAll(/data-testid="([^"]+)"/g)) testIds.add(m[1]);
    for (const m of src.matchAll(/data-field="([^"]+)"/g)) fields.add(m[1]);
    // `[attr.data-field]="f.name"` binds each spec in the file's field lists.
    if (src.includes('[attr.data-field]')) {
        for (const m of src.matchAll(/\bname:\s*'([A-Za-z0-9_]+)'/g)) fields.add(m[1]);
    }
}

/** A class token, not a substring: `dw-field` must not be satisfied by `dw-field__hint`. */
const classDeclared = (name) => new RegExp(`(^|[\\s"'.])${name.replace(/[-]/g, '\\-')}(?![\\w-])`, 'm').test(liveSrc);

// ── The harness: what it references ────────────────────────────────────────────────────────────

const harnessFiles = walk(HARNESS_DIR, (f) => /\.(ts|mjs)$/.test(f) && !f.includes('playwright-report'));
const failures = [];
let checked = 0;

const FIELD_CALLS = /\b(?:Field|SetText|PickLookup|FieldIsEditable)\(\s*\w+\s*,\s*'([^']+)'/g;

for (const file of harnessFiles) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const at = (index) => `${relative(ROOT, file)}:${src.slice(0, index).split('\n').length}`;
    const need = (ok, index, what) => {
        checked += 1;
        if (!ok) failures.push(`${at(index)}  ${what}`);
    };

    for (const m of src.matchAll(/data-testid="([^"$]+)"/g)) {
        need(testIds.has(m[1]), m.index, `data-testid "${m[1]}" is declared in no mounted template`);
    }
    for (const m of src.matchAll(/\bByTestId\(\s*\w+\s*,\s*'([^']+)'/g)) {
        need(testIds.has(m[1]), m.index, `data-testid "${m[1]}" is declared in no mounted template`);
    }
    for (const m of src.matchAll(/data-field="([^"$]+)"/g)) {
        need(fields.has(m[1]), m.index, `data-field "${m[1]}" is rendered by no mounted panel`);
    }
    for (const m of src.matchAll(FIELD_CALLS)) {
        need(fields.has(m[1]), m.index, `data-field "${m[1]}" is rendered by no mounted panel`);
    }
    for (const m of src.matchAll(/\bmjs-[a-z0-9-]+\b(?![_-])/g)) {
        if (!allSelectors.has(m[0])) continue; // A class name, checked below.
        need(!deadSelectors.has(m[0]), m.index, `<${m[0]}> is a component nothing mounts`);
    }
    for (const m of src.matchAll(/\.((?:mjs|dw)-[A-Za-z0-9_-]+)/g)) {
        need(classDeclared(m[1]), m.index, `class "${m[1]}" appears in no mounted template`);
    }
}

if (checked === 0) {
    // A scanner that found nothing to check has stopped scanning, not found the harness clean.
    console.error('harness-selectors: checked 0 references — the scanner no longer matches the harness');
    process.exit(1);
}
if (failures.length) {
    console.error(`harness-selectors: ${failures.length} reference(s) to markup the app no longer renders:\n`);
    for (const f of failures) console.error(`  ${f}`);
    console.error(`\nDead components: ${[...deadSelectors].sort().join(', ') || '(none)'}`);
    process.exit(1);
}
console.log(
    `harness-selectors: clean — ${checked} reference(s) in ${harnessFiles.length} harness file(s) resolve to ` +
        `${live.size} mounted component(s); dead: ${[...deadSelectors].sort().join(', ') || '(none)'}.`,
);
