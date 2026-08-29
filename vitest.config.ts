import { defineConfig } from 'vitest/config';

/**
 * Root vitest config, so `npx vitest run` means the same thing here as in the sibling apps.
 *
 * WHY THIS REPO HAD NONE. Sales' proof has lived at two tiers: integration checks against a real
 * database, and Playwright specs against a real browser. Both are excellent and neither can reach a
 * component method — so anything that is pure logic on `DealWorkspaceComponent` could only be proved by
 * driving a browser, and when the browser is unavailable it could not be proved at all.
 *
 * That gap was not theoretical. bizapps-sales#29 has an acceptance criterion — "ProductLabel still
 * resolves names for lines whose product is no longer offered" — with no coverage anywhere, and its
 * line-company stamp was covered only by spec 80, which is blocked on unrelated metadata drift. Both
 * are three-line methods that a unit test settles in milliseconds.
 *
 * The shape is copied from bizapps-orders deliberately, down to the `inline` rule, so `npx vitest run`
 * behaves identically across the family rather than becoming a per-repo dialect.
 */
export default defineConfig({
    test: {
        /**
         * BOTH SUFFIXES, because three files disagreed about what a unit test is and the gap was silent.
         *
         * CI enables its unit step when it finds a .test.ts OR a .spec.ts under a package source tree,
         * while this glob matched only the first. Measured: a `probe-collect.spec.ts` containing a
         * deliberately failing assertion turned CI's step ON, vitest collected the other file, reported
         * everything green and exited 0 — the failing test never ran and nothing said so.
         *
         * Playwright's specs live under test-harnesses/, not a package source tree, so widening here does
         * not pull them in. `packages/Angular/tsconfig.json` should exclude `*.spec.ts` alongside
         * `*.test.ts` for the same reason — otherwise ngc compiles one into `dist` and publishes it with
         * a runtime `vitest` import.
         */
        include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.spec.ts'],
        passWithNoTests: false,
        server: {
            deps: {
                /**
                 * Every BizApps `*-ng` package is `"type": "module"` but ngc emits extensionless
                 * relative specifiers, which Node's ESM resolver rejects. Bundlers resolve them, which
                 * is why the Angular build is fine and only the Node-side runner trips. Inlining routes
                 * them through Vite's resolver so the real modules stay in the graph — nothing is
                 * stubbed away.
                 */
                inline: [/@mj-biz-apps[\\/][^\\/]+-ng[\\/]/],
            },
        },
    },
});
