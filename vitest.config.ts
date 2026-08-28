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
        include: ['packages/*/src/**/*.test.ts'],
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
