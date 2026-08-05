import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { EXPLORER_BASE_URL, LOGIN_TIMEOUT_MS, STORAGE_STATE_PATH } from './lib/env';

/**
 * Does a captured session already exist?
 *
 * THIS IS WHAT STOPS THE SETUP PROJECT ASKING FOR A LOGIN IT DOES NOT NEED. The `crud` project
 * DEPENDS on `auth-setup`, so `auth-setup` runs on every invocation — and if it starts in a fresh
 * context it always sees the login page and always demands a human, even when a perfectly good
 * session is sitting on disk. Seeding it with the saved state lets `auth.setup.ts` detect "already
 * authenticated" and exit in seconds.
 *
 * Checked at config-load time on purpose: `storageState` cannot be conditional per-run, and pointing
 * a project at a non-existent state file is a hard error rather than a graceful miss.
 */
const HAVE_SESSION = existsSync(STORAGE_STATE_PATH);

/**
 * Playwright config for the bizapps-sales Explorer GUI harness.
 *
 * TWO PROJECTS, and the split is the whole point:
 *
 *   `auth-setup`  runs HEADED, opens Explorer, and waits (up to 5 minutes) for a HUMAN to complete
 *                 the interactive identity-provider login. It then writes the browser session to
 *                 .auth/user.json. Runs once; nobody's credentials are ever seen by the harness or
 *                 typed by anything other than the human at the keyboard.
 *
 *   `crud`        depends on `auth-setup`, loads that saved state, and needs no login at all. This
 *                 is what gets re-run on every change.
 *
 * WHY THIS DESIGN IS AVAILABLE HERE. `storageState` only captures cookies + localStorage. Explorer's
 * MSAL and Auth0 providers BOTH configure `cacheLocation: 'localStorage'` (verified in
 * @memberjunction/ng-auth-services/dist/lib/providers/mjexplorer-{msal,auth0}-provider.service.js),
 * so the session survives. The sibling bizapps-accounting harness cannot do this — it authenticates
 * with an MJ magic-link token that lives in sessionStorage, so every one of its specs re-consumes the
 * link. Same family, different auth mechanics, different correct design.
 *
 * OTHER DECISIONS, following the accounting harness:
 *   - serial, ONE worker — these are live e2e tests sharing one Explorer and one database
 *   - generous timeouts — the dev Explorer (Vite + Angular) is slow to first render
 *   - NO webServer — MJAPI and MJExplorer are started out of band; global-setup asserts they are up
 *     and fails with the exact fix command, rather than racing a server it started itself
 */
export default defineConfig({
  testDir: '.',
  globalSetup: './lib/global-setup.ts',
  globalTeardown: './lib/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: EXPLORER_BASE_URL,
    viewport: { width: 1600, height: 1100 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      // HEADED and long-running on purpose: a human is completing an interactive login in this
      // window. `timeout` must exceed LOGIN_TIMEOUT_MS or Playwright kills the test mid-login.
      timeout: LOGIN_TIMEOUT_MS + 120_000,
      use: {
        ...devices['Desktop Chrome'],
        // Reuse an existing session so this project becomes a no-op once captured. Only headed when
        // it actually has to ask for a login — an unattended re-run should never pop a window.
        headless: HAVE_SESSION,
        ...(HAVE_SESSION ? { storageState: STORAGE_STATE_PATH } : {}),
      },
    },
    {
      name: 'crud',
      testMatch: /specs\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
      // The full create→read→update→delete walk for TWO entities, each step waiting on a dev-mode
      // Angular re-render, genuinely takes several minutes. 180s was not a hung test — it was an
      // honest 200-second one, which is a different problem with a different fix.
      timeout: 480_000,
      use: {
        ...devices['Desktop Chrome'],
        // Headed by default: this harness's job tonight is to be WATCHED proving the UI works.
        // Set PW_HEADLESS=1 for unattended regression runs.
        headless: process.env.PW_HEADLESS === '1',
        storageState: STORAGE_STATE_PATH,
      },
    },
  ],
});
