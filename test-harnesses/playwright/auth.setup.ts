/**
 * ONE-TIME INTERACTIVE AUTH CAPTURE.
 *
 * Runs headed. Opens Explorer, then waits — up to PW_LOGIN_TIMEOUT_MS (default 5 min) — for a HUMAN
 * to complete the identity-provider login in the visible browser window. As soon as the authenticated
 * shell is detected it saves the session to .auth/user.json and exits.
 *
 * THE HARNESS NEVER HANDLES CREDENTIALS. It types nothing into the login form, reads nothing from it,
 * and stores no username or password. It waits for a state and captures the resulting session cookie
 * / localStorage, exactly as a browser would. `.auth/` is gitignored because the captured state IS a
 * bearer token for a real account.
 *
 * PROVIDER-AGNOSTIC BY DESIGN. Which identity provider you see depends on the Angular configuration
 * `ng serve` used: `environment.ts` selects MSAL (the Blue Cypress tenant), and
 * `environment.development.ts` selects Auth0 (the automation tenant) — and `ng serve` defaults to
 * `development`. This file does not care; it waits for the shell, not for a particular login form.
 *
 * It also writes a RECON REPORT (.auth/recon.json) on the way through, because the entity-browser
 * route is the one thing that cannot be discovered without an authenticated session — so the same
 * single login that captures the session also tells the CRUD spec where to go.
 */
import { test as setup, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  AUTH_DIR,
  ENTITY,
  EXPLORER_BASE_URL,
  LOGIN_TIMEOUT_MS,
  STORAGE_STATE_PATH,
} from './lib/env';
import { captureConsoleErrors, isAuthenticated, probeEntityRoutes, shot, waitForAuthenticatedShell } from './lib/explorer';

setup('capture an authenticated Explorer session (human logs in)', async ({ page, context }) => {
  const sink = captureConsoleErrors(page);

  await page.goto(EXPLORER_BASE_URL, { waitUntil: 'domcontentloaded' });

  if (await isAuthenticated(page)) {
    console.log('\n  Already authenticated (an existing session was reused).\n');
  } else {
    const mins = Math.round(LOGIN_TIMEOUT_MS / 60_000);
    console.log(
      [
        '',
        '  ' + '='.repeat(74),
        '  ACTION REQUIRED — complete the login in the browser window that just opened.',
        '',
        `    Explorer:  ${EXPLORER_BASE_URL}`,
        '    Click "Log in" and authenticate as yourself.',
        '',
        '    This harness will NOT touch your credentials. It is only watching for the',
        '    authenticated app shell to appear, and will continue automatically when it does.',
        '',
        `    Waiting up to ${mins} minutes...`,
        '  ' + '='.repeat(74),
        '',
      ].join('\n'),
    );
    await shot(page, '00-login-screen');
    await waitForAuthenticatedShell(page, LOGIN_TIMEOUT_MS);
    console.log('  Authenticated shell detected — capturing session.\n');
  }

  await shot(page, '01-authenticated-shell');

  // Persist the session. This is what lets every later run skip the login entirely.
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`  session saved -> ${STORAGE_STATE_PATH}`);

  // ---------------------------------------------------------------------------------------------
  // RECON. Only possible with a session, so it happens here rather than costing a second login.
  // ---------------------------------------------------------------------------------------------
  const recon: Record<string, unknown> = {
    capturedAt: new Date().toISOString(),
    explorerUrl: EXPLORER_BASE_URL,
    landedUrl: page.url(),
  };

  // What the shell actually offers: app switcher entries and any nav labels.
  recon.pageTitle = await page.title();
  recon.appSwitcherPresent =
    (await page.locator('.app-switcher-button, [aria-label="Switch application"]').count()) > 0;

  // Which entity-browser route shape this MJ build uses.
  const dealRoutes = await probeEntityRoutes(page, ENTITY.Deals);
  recon.dealsEntityRoutesThatRendered = dealRoutes;

  // A broad text sample of the shell, to identify how to reach the generic entity browser.
  const bodyText = await page.locator('body').innerText().catch(() => '');
  recon.shellTextSample = bodyText.slice(0, 4000);

  // Every link/button label on the shell — the cheapest way to find the entity-browser entry point.
  const labels = await page
    .locator('a, button, [role="button"], [role="menuitem"], [role="tab"]')
    .evaluateAll((els) =>
      els
        .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length > 0 && t.length < 60),
    )
    .catch(() => [] as string[]);
  recon.shellInteractiveLabels = [...new Set(labels)].slice(0, 200);

  recon.consoleErrorsDuringAuth = sink.errors;

  writeFileSync(path.join(AUTH_DIR, 'recon.json'), JSON.stringify(recon, null, 2), 'utf8');
  console.log(`  recon written -> ${path.join(AUTH_DIR, 'recon.json')}`);
  if (dealRoutes.length) {
    console.log(`  entity-browser route(s) that rendered a grid:\n    - ${dealRoutes.join('\n    - ')}`);
  } else {
    console.log('  NOTE: none of the probed entity-browser routes rendered a grid — see recon.json.');
  }

  // Sanity: we really do have a usable session on disk.
  expect(await isAuthenticated(page), 'must end this setup authenticated').toBe(true);
});
