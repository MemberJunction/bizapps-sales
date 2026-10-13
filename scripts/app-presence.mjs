/**
 * Which sibling apps a host HAS, judged the same way by the runner and by the coverage gate.
 *
 * ── LINKED IS NOT INSTALLED ─────────────────────────────────────────────────────────────────────
 *
 * The runner used to include a bundle when the sibling's package LOADED. In a joined workspace every
 * sibling's package loads, whether or not its schema was ever migrated into the database under test, so
 * `requires: "contracts"` passed on a host with no contracts tables and its checks failed as if the
 * product were broken (#89).
 *
 * An app is PRESENT when both hold:
 *   1. its probe package loaded (`downstream packages -> <pkg>: loaded`) -- the checks import its code;
 *   2. the host's metadata registers at least one entity in its schema (`manifest.schemas[app]`).
 *      Entity rows, not `sys.schemas`: a schema can exist and be empty, and an entity the provider does
 *      not know is unusable however many tables back it.
 *
 * A linked app whose schema is missing is treated exactly like an unlinked one: its bundles, and any
 * check that names it in `RequiresApp`, are left out and listed with the reason. They are not "skipped"
 * (that word is reserved for RequiresMutation checks the run chose not to execute).
 *
 * The runner prints one line, `sibling apps -> app: present | app: <reason> | ...`, and the gate reads
 * that line back. Both use this module, so the format cannot drift between them.
 */

export const PRESENCE_PREFIX = 'sibling apps ->';
const PRESENT = 'present';

/**
 * @param {{ probes: Record<string, string>, schemas: Record<string, string> }} manifest
 * @param {string[]} optionalLoads  the runner's `<pkg>: loaded | absent | FAILED (...)` entries
 * @param {{ SchemaName: string }[]} entities  the provider's entity metadata
 * @returns {Map<string, string>} app -> 'present' or the reason it is not
 */
export function judgeAppPresence(manifest, optionalLoads, entities) {
    const out = new Map();
    for (const [app, pkg] of Object.entries(manifest.probes)) {
        if (!optionalLoads.includes(`${pkg}: loaded`)) {
            out.set(app, `not linked (${pkg} did not load)`);
            continue;
        }
        const schema = manifest.schemas?.[app];
        if (!schema) {
            out.set(app, `no schema named for it in scripts/expected-check-counts.json`);
            continue;
        }
        const wanted = schema.toLowerCase();
        const registered = entities.filter((e) => String(e.SchemaName).toLowerCase() === wanted).length;
        out.set(app, registered > 0 ? PRESENT : `linked, but not installed (no entities registered in ${schema})`);
    }
    return out;
}

/** The single line the runner prints and the gate parses. */
export function formatAppPresence(presence) {
    return `  ${PRESENCE_PREFIX} ${[...presence].map(([app, state]) => `${app}: ${state}`).join(' | ')}`;
}

/** Apps judged present. */
export function presentApps(presence) {
    return new Set([...presence].filter(([, state]) => state === PRESENT).map(([app]) => app));
}

/**
 * Read the presence line back out of a runner log.
 *
 * @returns {{ presence: Map<string, string>, reported: boolean }}
 */
export function parseAppPresence(log) {
    const presence = new Map();
    const line = log.match(new RegExp(`${PRESENCE_PREFIX.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')} (.*)$`, 'm'));
    if (!line) {
        return { presence, reported: false };
    }
    for (const part of line[1].split(' | ')) {
        const colon = part.indexOf(': ');
        if (colon > 0) {
            presence.set(part.slice(0, colon).trim(), part.slice(colon + 2).trim());
        }
    }
    return { presence, reported: true };
}
