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

/**
 * OPT-IN ASSIST, OFF BY DEFAULT: `PW_AUTH_ASSIST_PICK_ACCOUNT=1`.
 *
 * WHAT IT DOES AND DOES NOT DO. When the identity provider is already showing an account tile marked
 * "Signed in" — the "Pick an account" screen you get when an SSO session already exists — this clicks
 * that tile. It types NOTHING, reads NOTHING from any field, and cannot create an account or supply a
 * password: if there is no already-signed-in tile it does nothing at all and the human still logs in.
 *
 * WHY IT EXISTS. The default flow expects a person to click in the browser window Playwright opened.
 * When the run is launched from a non-interactive/background process that window does not reliably
 * surface, and the setup then times out on a page that is one click from done — which is exactly what
 * happened twice on 2026-08-06.
 *
 * REQUIRES EXPLICIT OPT-IN, and the default is unchanged, because "the harness never touches the
 * login" is a property worth keeping true unless someone deliberately says otherwise for one run.
 */
const ASSIST_PICK_ACCOUNT = process.env.PW_AUTH_ASSIST_PICK_ACCOUNT === '1';

/**
 * Clicks an ALREADY-AUTHENTICATED account tile, and answers the "Stay signed in?" prompt with **No**.
 *
 * "No" rather than "Yes" on purpose: it completes the login without adding a persistent-session cookie
 * to the account. The harness saves `storageState` itself, so persistence buys nothing here and the
 * more conservative answer is free.
 */
async function pickAlreadySignedInAccount(page: import('@playwright/test').Page): Promise<void> {
    /**
     * MUST POLL, NOT CHECK ONCE. The first version looked exactly once, immediately after
     * `page.goto`, and found nothing — because MSAL had not redirected yet. The run then timed out
     * four minutes later on a "Pick an account" page that had appeared a second after the check.
     * The states below arrive in sequence and each takes a network round trip, so the only correct
     * shape is a loop.
     */
    /**
     * SEARCHES EVERY FRAME, and every open page in the context, not just the top document.
     *
     * The previous version used `page.locator(...)` and reported "no tile on screen" for two minutes
     * while the failure screenshot plainly showed one. Two reasons that can happen and both are real
     * here: identity providers commonly render inside an IFRAME (and Playwright locators do not pierce
     * frames), and MSAL can open the login in a POPUP page rather than navigating the top page. The
     * error-context a11y snapshot traverses frames, which is exactly why the snapshot and the locator
     * disagreed.
     */
    const deadline = Date.now() + 150_000;
    let clickedTile = false;
    let lastSeen = '';

    /** Every frame of every page in the context — the full surface a click could be waiting on. */
    const allFrames = (): import('@playwright/test').Frame[] =>
        page.context().pages().flatMap((p) => p.frames());

    /** First visible match for a selector across all frames, or null. */
    const findAcross = async (
        build: (f: import('@playwright/test').Frame) => import('@playwright/test').Locator,
    ): Promise<import('@playwright/test').Locator | null> => {
        for (const frame of allFrames()) {
            const loc = build(frame).first();
            const count = await loc.count().catch(() => 0);
            if (count && (await loc.isVisible().catch(() => false))) {
                return loc;
            }
        }
        return null;
    };

    while (Date.now() < deadline) {
        if (await isAuthenticated(page)) {
            console.log('  assist: authenticated shell reached.');
            return;
        }

        // Log what we are looking at, once per change. Guessing cost two failed runs; this is cheap.
        const where = page.context().pages().map((p) => p.url()).join(' | ');
        if (where !== lastSeen) {
            console.log(`  assist: pages -> ${where}`);
            lastSeen = where;
        }

        // 1. An already-signed-in account tile — the one thing this assist exists to click.
        if (!clickedTile) {
            const tile = await findAcross((f) => f.locator('button, div[role="button"]').filter({ hasText: /Signed in/i }));
            if (tile) {
                const label = ((await tile.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
                console.log(`  assist: clicking the already-signed-in account tile [${label}]`);
                await tile.click().catch(() => undefined);
                clickedTile = true;
                await page.waitForTimeout(3000);
                continue;
            }
        }

        // 2. "Stay signed in?" — a convenience prompt, not consent or terms. Answered NO: it completes
        //    the login without adding a persistent-session cookie to the account, and the harness saves
        //    storageState itself so persistence buys nothing.
        const stayPrompt = await findAcross((f) => f.getByText(/Stay signed in\?/i));
        if (stayPrompt) {
            const no = await findAcross((f) => f.locator('input#idBtn_Back, button').filter({ hasText: /^\s*No\s*$/ }));
            if (no) {
                console.log('  assist: answering "Stay signed in?" with No');
                await no.click().catch(() => undefined);
                await page.waitForTimeout(3000);
                continue;
            }
        }

        // 3. Explorer's OWN "Log in" button, which precedes any redirect to the provider. Clicking it
        //    starts the flow; it is not a credential prompt.
        const login = await findAcross((f) =>
            f.locator('button, a').filter({ hasText: /^\s*(Log ?in|Sign ?in|Sign in with Microsoft)\s*$/i }),
        );
        if (login) {
            console.log('  assist: clicking a "Log in" control to start the flow');
            await login.click().catch(() => undefined);
            await page.waitForTimeout(4000);
            continue;
        }

        await page.waitForTimeout(2000);
    }
    console.log(`  assist: gave up. Last pages seen -> ${lastSeen}`);
}

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
    if (ASSIST_PICK_ACCOUNT) {
      await pickAlreadySignedInAccount(page);
    }
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
