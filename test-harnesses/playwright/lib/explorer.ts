/**
 * Explorer driving helpers for the bizapps-sales GUI harness.
 *
 * Two things live here:
 *
 *  1. `captureConsoleErrors` — THE KEYSTONE, adopted from the bizapps-accounting harness. A UI that
 *     renders but logs a console error is broken in a way presence assertions cannot see. Every spec
 *     asserts the collected list is empty, so silent UI bugs become test failures.
 *
 *  2. Navigation + grid readers. NOTE this app has **no custom application or navigation** yet
 *     (docs/KNOWN-ISSUES.md KI-4) — its Angular package ships only CodeGen-generated forms until S3.
 *     So unlike accounting's harness, which clicks an app-switcher entry, this one drives Explorer's
 *     GENERIC ENTITY BROWSER. `findEntityListRoute` resolves that route at runtime rather than
 *     hardcoding it, because the shell's route shape is an MJ-core concern that has moved between
 *     versions and a hardcoded guess is the most likely thing to rot.
 */
import { expect, type Page, type Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ARTIFACTS_DIR, EXPLORER_BASE_URL } from './env';
import { Db } from './db';

/**
 * Benign console.error substrings — known framework noise, not app bugs. KEEP THIS TIGHT: the value
 * of the keystone is entirely in what it refuses to ignore, and every entry here is a small hole.
 */
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  // The data provider logs this loading entities that carry virtual/extra fields — which every IsA
  // child does by construction (SalesAccount/SalesContact mirror their parent's fields). Documented
  // non-fatal noise in the sibling harness (harness-notes lesson #9).
  /MISSING FIELDS.*SetMany/i,
  // Angular dev-mode NG0100 from MJ CORE's own home-page widget, whose relative-time binding
  // ("12m ago") can tick across a change-detection pass. Scoped to that component ONLY, so a real
  // NG0100 anywhere in the sales UI still fails the keystone.
  /NG0100: ExpressionChangedAfterItHasBeenCheckedError[\s\S]*DataExplorerDashboardComponent/,
  // Font Awesome kit is allowlisted by domain and answers 403 on localhost; index.html loads v6 from
  // cdnjs as the working source. Cosmetic, and already explained in apps/MJExplorer/src/index.html.
  /kit\.fontawesome\.com/i,
  // MSAL asks Microsoft Graph for the signed-in user's profile photo; accounts without one answer
  // 404. Observed for this user, entirely cosmetic (the avatar falls back to an icon), and NOT an app
  // concern — narrowly scoped to that one Graph endpoint so any other Graph failure still fails.
  /graph\.microsoft\.com\/v1\.0\/me\/photo/i,
];

export interface ErrorSink {
  errors: string[];
}

/** Wire console.error + pageerror capture for the life of the page. */
export function captureConsoleErrors(page: Page): ErrorSink {
  const sink: ErrorSink = { errors: [] };
  /**
   * MATCH AGAINST TEXT **AND** URL. A resource-load failure's console text is only
   * "Failed to load resource: the server responded with a status of 404 (Not Found)" — the offending
   * URL lives in `m.location().url`, not in the text. An earlier version tested the text alone, so
   * every URL-based allowlist entry silently never matched and the keystone reported noise it had been
   * told to ignore.
   */
  const benign = (msg: string) => IGNORED_CONSOLE_PATTERNS.some((re) => re.test(msg));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const url = m.location()?.url ?? '';
    const subject = `${text} ${url}`;
    // A 404 on a STATIC/optional asset is noise. A 404 on anything else — an API, GraphQL or data
    // request — is a REAL signal and must not be suppressed; a blanket 404 filter would mask a
    // genuine backend failure, which is exactly the class of bug this harness exists to catch.
    const assetNoise =
      /status of 404/i.test(text) && /(favicon\.ico|\.(?:ico|png|svg|gif|woff2?|map))(?:\?|$)/i.test(url);
    if (!benign(subject) && !assetNoise) sink.errors.push(`console.error: ${text}${url ? ` [${url}]` : ''}`);
  });
  page.on('pageerror', (e) => {
    if (!benign(e.message)) sink.errors.push(`pageerror: ${e.message}`);
  });
  return sink;
}

/** Assert no UI errors were captured; the failure message lists every one. */
export function expectNoConsoleErrors(sink: ErrorSink, context: string): void {
  expect(
    sink.errors,
    `Console/page errors captured while ${context}:\n  - ${sink.errors.join('\n  - ')}`,
  ).toEqual([]);
}

/** Drain the sink, returning what was in it. Use between steps so each step reports its own errors. */
export function drain(sink: ErrorSink): string[] {
  const out = [...sink.errors];
  sink.errors.length = 0;
  return out;
}

/**
 * Assert that every captured error matches one of `allowed` — used where a KNOWN, documented error is
 * expected and anything else must still fail.
 *
 * Preferred over adding entries to IGNORED_CONSOLE_PATTERNS when the error is only acceptable in a
 * specific window. A global allowlist entry would hide the same error everywhere, forever; this keeps
 * it scoped to the step that legitimately provokes it, and still prints what it tolerated.
 */
export function expectOnlyKnownErrors(sink: ErrorSink, allowed: RegExp[], context: string): string[] {
  const unexpected = sink.errors.filter((e) => !allowed.some((re) => re.test(e)));
  expect(
    unexpected,
    `Unexpected console/page errors while ${context}:\n  - ${unexpected.join('\n  - ')}`,
  ).toEqual([]);
  const tolerated = sink.errors.filter((e) => allowed.some((re) => re.test(e)));
  if (tolerated.length) {
    console.log(`  tolerated ${tolerated.length} KNOWN error(s) while ${context}:`);
    for (const t of [...new Set(tolerated)]) console.log(`    - ${t.slice(0, 160)}`);
  }
  return tolerated;
}

/**
 * KNOWN, DOCUMENTED post-delete error.
 *
 * Deleting a record whose tab is still open makes MJ Explorer's tab manager re-Load it by ID, which
 * now 404s: `Error in BaseEntity.Load(MJ_BizApps_Sales: Deals, Key: ID=...)`. Reproducible for every
 * entity, and an MJ-core tab-lifecycle concern rather than anything in this app's schema or forms —
 * the delete itself succeeds and the grid row goes. Recorded as a finding rather than swept into the
 * global allowlist, so it stays visible and stays scoped to the delete steps.
 */
export const KNOWN_POST_DELETE_ERRORS: RegExp[] = [/Error in BaseEntity\.Load\(MJ_BizApps_Sales:/];

/**
 * True once the authenticated Explorer shell is up.
 *
 * Deliberately provider-agnostic: it does not care whether the human got here through MSAL, Auth0,
 * Okta or a magic link, only that MJ has a session and the shell rendered. That matters because the
 * ACTIVE provider depends on which Angular configuration `ng serve` used — `environment.ts` selects
 * MSAL, `environment.development.ts` selects Auth0 — and the harness should not break when that
 * changes.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // The login screen shows a single "Log in" button and no app chrome. The authenticated shell
  // routes into /app/ and renders the nav/user chrome.
  if (/\/app\//i.test(page.url())) return true;
  const chrome = page.locator('mj-nav, .app-switcher-button, [aria-label="Switch application"], mj-user-profile');
  return (await chrome.count()) > 0 && (await chrome.first().isVisible().catch(() => false));
}

/** Wait for the authenticated shell, however the human got there. */
export async function waitForAuthenticatedShell(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAuthenticated(page)) {
      // Let metadata + user bootstrap settle before anyone navigates.
      await page.waitForTimeout(3000);
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(
      [
        `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the authenticated Explorer shell at ${EXPLORER_BASE_URL}.`,
        '',
        'MOST LIKELY CAUSE: the saved MSAL session expired. The stored file still EXISTS, so the config',
        'ran this HEADLESS — the browser is sitting on the Microsoft account picker and no window was',
        'ever shown for you to log into. The timeout says nothing about that, which is why this note',
        'exists.',
        '',
        'Fix it by forcing a headed re-login, which ignores the stored state:',
        '    PW_FORCE_LOGIN=1 npm run test:explorer:auth',
      ].join(String.fromCharCode(10)),
  );
}

/** Save a named screenshot into artifacts/ and return its path. */
export async function shot(page: Page, name: string): Promise<string> {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const file = path.join(ARTIFACTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/**
 * Ask the RUNNING CLIENT what routes and entities it knows about.
 *
 * WHY THIS IS RUNTIME INTROSPECTION RATHER THAN A HARDCODED PATH. Explorer's entity-browser route
 * has changed shape across MJ versions, and this app pins MJ 5.51 today and will not tomorrow. Kept
 * as a DIAGNOSTIC only — the real navigation path is `openSalesApp` + `openAllEntities` below, which
 * recon established. When those break, run this to see what the shell answers now.
 */
export async function probeEntityRoutes(page: Page, entityName: string): Promise<string[]> {
  const encoded = encodeURIComponent(entityName);
  const candidates = [
    `/app/mjbizappssales`,
    `/app/entity/${encoded}`,
    `/entity/${encoded}`,
    `/app/data/${encoded}`,
  ];
  const worked: string[] = [];
  for (const route of candidates) {
    try {
      await page.goto(`${EXPLORER_BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForTimeout(2500);
      const settled = page.url();
      if (/\/app\/home/i.test(settled) && !/home/i.test(route)) continue;
      const grid = page.locator('mj-entity-grid, .ag-root, kendo-grid, mj-user-view-grid, table');
      if ((await grid.count()) > 0) worked.push(`${route}  ->  ${settled}`);
    } catch {
      /* candidate simply does not resolve; keep probing */
    }
  }
  return worked;
}

/**
 * THE APP ROUTE, established by recon rather than guessed.
 *
 * CodeGen auto-creates one MJ Application per schema, so `__mj_BizAppsSalesGenerated` exists and
 * lives at /app/mjbizappssales — which means this app IS reachable in Explorer today, before any of
 * the hand-built S3 surfaces. (docs/KNOWN-ISSUES.md KI-4 originally claimed no Application was
 * registered; that was wrong about the generated one and has been corrected.)
 */
export const SALES_APP_ROUTE = '/app/mjbizappssales';

/**
 * Close every record tab the shell restored, and return how many were closed.
 *
 * THE SHELL REOPENS WHAT YOU LOOKED AT LAST, AND THAT MAKES THE SUITE ORDER-DEPENDENT.
 *
 * MJ's v6 shell keeps a server-side list of recently-opened records (`__mj.UserRecordLog`) and restores
 * them as tabs on load — so navigating to `/app/mjbizappssales` can land on a RECORD rather than the
 * app, and even the direct `/app/entity/...` routes redirect into the restored tab. Nothing about that
 * is client state: a brand-new browser context with a fresh profile lands on it too.
 *
 * The failure this produces is genuinely misleading. Run specs 40/41/50 alone and they pass; run the
 * full suite and 40 fails, because the earlier specs opened three records and the last step then reads
 * a pipeline record's text while asserting a deal name is in the Deals grid. The spec looks flaky and
 * is not — it is reading a different screen than it thinks.
 *
 * So every entry point closes the restored tabs FIRST. Bounded, never throwing: a shell with no tabs is
 * the normal case, and failing to close one must not fail the caller's test.
 */
export async function closeRestoredRecordTabs(page: Page): Promise<number> {
  let closed = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const closer = page.getByRole('button', { name: /^Close\s+.+/i }).first();
    if (!(await closer.count().catch(() => 0))) break;
    if (!(await closer.isVisible().catch(() => false))) break;
    await closer.click().catch(() => undefined);
    await page.waitForTimeout(400);
    closed++;
  }
  if (closed) await page.waitForTimeout(1200);
  return closed;
}

/** Navigate into the generated Sales application. */
/**
 * Waits for the app to have actually RENDERED, rather than for a number of seconds.
 *
 * ── THE ORDER-DEPENDENCE THIS FIXES, MEASURED ───────────────────────────────────────────────────
 *
 * `openSalesApp` slept a fixed 4000ms. On a COLD app that is not enough: measured on this host, at 4s
 * the entity panel has not rendered at all — `Deals` matches ZERO nodes — and by 8s it is there and
 * visible. `openAllEntities` then found no panel, fell through to its chevron fallback, clicked
 * whatever that matched, and the entity was never listed. The spec reported
 * `entity "Deals" must be listed in the app`, which points at the app rather than at the clock.
 *
 * In-suite the app is warm from earlier specs, so 4s was enough and the same specs got past the list.
 * That is a LARGE PART of the standalone-versus-in-suite divergence in 10, 20 and 30 — one fixed sleep
 * sitting where a condition belonged — but it is NOT the whole of it. The rest is `resetEntityPanel`
 * below: which screen the app lands on is decided by persisted state, and in-suite that state is left
 * behind by whichever spec ran before. Timing and leftover state were two causes wearing one symptom.
 *
 * A fixed sleep is always either too short somewhere or wasted everywhere; this waits for the thing
 * itself and returns as soon as it appears, so the warm case does not pay for the cold one.
 */
async function waitForSalesAppShell(page: Page): Promise<void> {
  // Either the entity panel (the usual landing) or a grid heading — the landing screen VARIES with
  // what was last visited, which is why this accepts both rather than demanding one.
  const panel = page.getByText(/entities available|All Entities|My Favorites/i).first();
  const grid = page.locator('h1, h2, .entity-title').first();
  await expect
    .poll(async () => (await panel.count()) > 0 || (await grid.count()) > 0, {
      timeout: 30_000,
      message:
        'the generated Sales application never rendered its landing — neither the entity panel nor a '
        + 'grid heading appeared within 30s',
    })
    .toBe(true);
}

/**
 * Put the app's landing back to the ENTITY LIST, by clearing the one field that decides it.
 *
 * ── WHERE THE LANDING IS ACTUALLY DECIDED, MEASURED ──────────────────────────────────────────────
 *
 * The generated app's landing screen is MJ's **DataExplorer dashboard**, and which screen that shows
 * comes down to a single persisted field: `selectedEntityName`, inside the user setting
 * `DataExplorer.State.<applicationId>` in `__mj.UserSetting`. Null means the entity LIST; set means
 * that entity's GRID, with no `.entity-item` anywhere on the page.
 *
 * The field is written whenever ANYTHING opens an entity — the previous spec, the previous run, or a
 * human clicking around before the suite starts. So the screen a spec gets handed depends on what the
 * last thing to touch this app happened to do, which is why the same commit failed on `Deals` one run
 * and on `Pipeline Stages` the next, and why a spec passed alone and failed in the suite.
 *
 * What the old code did about it made things worse rather than better. With a leftover selection the
 * entity list is absent, so all three text-matched branches missed and it fell through to clicking
 * `.k-icon, [class*="chevron"], [class*="expand"]` — an arbitrary control, chosen by DOM order, that
 * decided where the app ended up. The "All" breadcrumb it also tried is not a way back to the list at
 * all: clicking it navigates to `/app/home/Home` and leaves the Sales app entirely (measured).
 *
 * So the panel is not something to hunt for in the DOM. It is something to ASK for, before navigating.
 *
 * Deliberately every `DataExplorer.State%` row, not just this app's: a spec that wanders into another
 * app's explorer leaves the same crumb there, and clearing one row while leaving the rest is the kind
 * of half-fix that comes back as an intermittent failure. `ISJSON` guards a row that is null or was
 * written by hand; `JSON_MODIFY(..., NULL)` drops the property, which reads back as "nothing selected".
 */
export async function resetEntityPanel(): Promise<void> {
  const pool = await Db();
  await pool.request().query(
    `UPDATE __mj.UserSetting
        SET Value = JSON_MODIFY(Value, '$.selectedEntityName', NULL)
      WHERE Setting LIKE 'DataExplorer.State%'
        AND ISJSON(Value) = 1`,
  );
}

export async function openSalesApp(page: Page): Promise<void> {
  // BEFORE the navigation, not after: the dashboard reads this setting while it boots.
  await resetEntityPanel();

  await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });
  await waitForSalesAppShell(page);
  // Restored tabs hijack the landing — see closeRestoredRecordTabs. Clear them, then re-enter the app.
  if (await closeRestoredRecordTabs(page)) {
    await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });
    await waitForSalesAppShell(page);
  }
  expect(page.url(), 'should be inside the generated Sales application').toContain('mjbizappssales');
}

/**
 * Make sure the app is showing its entity list, and that the list is showing ALL entities.
 *
 * `openSalesApp` has already cleared the one field that decides the landing (see `resetEntityPanel`),
 * so by the time this runs the list is what the app is rendering. This no longer hunts for it through
 * text-matched branches and a blind chevron click; it asserts the list is there and fixes the one
 * piece of panel state that survives the reset — the All Entities / My Favorites toggle.
 */
export async function openAllEntities(page: Page): Promise<void> {
  /**
   * THE PANEL REMEMBERS ITS TOGGLE, AND THAT IS A TRAP — for tests and for a live demo alike.
   *
   * The entity panel has an "All Entities" / "My Favorites" pair, and the selection PERSISTS across
   * navigations and sessions. Leave it on "My Favorites" while favourites are empty and the panel shows
   * "0 entities · No entities found" — every card gone. That is exactly what happened here: a favourites
   * experiment left the toggle flipped, and the next run failed with a click timeout on "Deals" and a
   * missing "Sales Accounts", as though the app had broken.
   *
   * So this always forces the toggle back to All Entities rather than trusting whatever state it was in.
   * If a demo ever shows an empty entity panel, this is why — click "All Entities".
   */
  const allToggle = page.getByText(/^\s*All Entities\s*$/i).first();
  if ((await allToggle.count()) && (await allToggle.isVisible().catch(() => false))) {
    await allToggle.click().catch(() => undefined);
    await page.waitForTimeout(1500);
  }

  // `.entity-item` is the panel's own card class. Measured on this host: 20 of them, one per entity in
  // the application, and ZERO whenever a leftover selection has put a grid on the landing instead.
  await expect
    .poll(async () => page.locator('.entity-item').count(), {
      timeout: 30_000,
      message:
        'the app never rendered its entity list — with the landing state cleared this means the app '
        + 'itself failed to load, rather than the harness looking at the wrong screen',
    })
    .toBeGreaterThan(0);
}

/**
 * Open one entity's list from the All-Entities panel by its DISPLAY name (the plural label Explorer
 * shows, e.g. "Deals" for `MJ_BizApps_Sales: Deals`).
 */
export async function openEntity(page: Page, displayName: string): Promise<void> {
  // `.entity-item-name` is the card's own label element. A bare text match also hits the breadcrumb and
  // the recent-items list, which are not the card and do not open the grid when clicked.
  const target = page
    .locator('.entity-item')
    .filter({ has: page.locator('.entity-item-name', { hasText: new RegExp(`^\\s*${displayName}\\s*$`, 'i') }) })
    .first();
  await expect(target, `entity "${displayName}" must be listed in the app`).toBeVisible({ timeout: 20_000 });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click();

  // The grid announces itself in the breadcrumb bar; wait for that rather than for a number of seconds.
  await expect(
    page.locator('.breadcrumb-label').filter({ hasText: new RegExp(displayName, 'i') }).first(),
    `the breadcrumb should become "${displayName}" once its grid is open`,
  ).toBeVisible({ timeout: 25_000 });
}

/** Rows currently rendered in whatever grid the page is showing. */
export function gridRows(page: Page): Locator {
  return page.locator('.ag-center-cols-container .ag-row, kendo-grid tbody tr, mj-user-view-grid .ag-row');
}

// =================================================================================================
// GENERATED-FORM HELPERS
//
// Selectors below come from an observed DOM dump (specs/01-probe-form-dom.spec.ts), not from
// guesswork. MJ's generated forms use a consistent, pleasantly stable shape:
//
//   <div class="mj-forms-field mj-forms-field--editing [mj-forms-field--required-empty]">
//     <label class="mj-forms-field-label">Amount</label>
//     <div class="mj-forms-field-control">
//       <input type="number" class="mj-forms-field-input mj-forms-field-input--number">
//     </div>
//   </div>
//
// A foreign-key field wraps its input in `.mj-fk-search` with a magnifier icon and a "Search..."
// placeholder — a type-ahead lookup rather than a plain select.
//
// `--required-empty` is a gift: the form MARKS which fields are required and unfilled, so a test can
// assert that NOT NULL columns actually surface as required in the UI rather than failing on save.
// =================================================================================================

/**
 * The field container for a given visible label.
 *
 * `visible=true` IS LOAD-BEARING, and leaving it off produced one of the more confusing failures this
 * harness has had. MJ's shell keeps every open tab's form in the DOM and merely HIDES the inactive ones.
 * So while spec 10 was partway through its Pipelines walk — with a "New Deals Record" tab still open —
 * a plain `.first()` matched the DEAL form's `Name` input, which is in the DOM and hidden, rather than
 * the Pipeline form's, which is the one on screen.
 *
 * The failure then read `field "Name" must be editable … Received: hidden`, which sounds like the field
 * is disabled or the form is read-only. It is neither: the form is fine, and the locator was pointed at
 * a different form entirely. Filtering to visible elements first makes the match follow the active tab.
 */
export function formField(page: Page, label: string): Locator {
  return page
    .locator(`.mj-forms-field:has(> label.mj-forms-field-label:text-is("${label}"))`)
    .locator('visible=true')
    .first();
}

/** True when the form marks this field required-and-empty. */
export async function isRequiredEmpty(page: Page, label: string): Promise<boolean> {
  const cls = (await formField(page, label).getAttribute('class').catch(() => '')) ?? '';
  return /mj-forms-field--required-empty/.test(cls);
}

/** Type into a plain text / number / date input. */
export async function setField(page: Page, label: string, value: string): Promise<void> {
  const input = formField(page, label).locator('input.mj-forms-field-input, textarea.mj-forms-field-input').first();
  await expect(input, `field "${label}" must be editable`).toBeVisible({ timeout: 15_000 });
  await input.click();
  await input.fill('');
  await input.fill(value);
  await input.blur().catch(() => undefined);
  await page.waitForTimeout(400);
}

/** Read a field's current value. */
export async function readField(page: Page, label: string): Promise<string> {
  const input = formField(page, label).locator('input, textarea').first();
  if (await input.count()) return (await input.inputValue().catch(() => '')) || '';
  return (await formField(page, label).locator('.mj-forms-field-control').first().innerText().catch(() => '')).trim();
}

/**
 * Fill a foreign-key lookup: type into the type-ahead, then choose the offered match.
 *
 * The result list's markup is not part of the field container, so this tries the likely popup shapes
 * in order and falls back to keyboard selection. Written defensively on purpose — a type-ahead is the
 * single most brittle thing in a generated form, and a flaky lookup would make the whole harness
 * untrustworthy rather than merely failing loudly.
 */
export async function setLookup(page: Page, label: string, searchText: string): Promise<void> {
  const input = formField(page, label).locator('.mj-fk-search input, input.mj-forms-field-input').first();
  await expect(input, `lookup "${label}" must be present`).toBeVisible({ timeout: 15_000 });
  await input.click();
  await input.fill('');
  await input.type(searchText, { delay: 60 });
  await page.waitForTimeout(1800);

  // Preferred: click the offered option by its text, wherever the popup rendered.
  const option = page
    .locator(
      `.mj-fk-search-results *, .mj-fk-result, .k-list-item, [role="option"], .dropdown-item, li`,
    )
    .filter({ hasText: searchText })
    .first();
  if ((await option.count()) && (await option.isVisible().catch(() => false))) {
    await option.click();
  } else {
    // Fallback: keyboard-select the first suggestion.
    await input.press('ArrowDown').catch(() => undefined);
    await input.press('Enter').catch(() => undefined);
  }
  await page.waitForTimeout(1200);
}

/** Click "Save Changes" and let the save settle. */
export async function saveForm(page: Page): Promise<void> {
  const save = page.getByRole('button', { name: /Save Changes|^Save$/i }).first();
  await expect(save, 'a Save control must be present').toBeVisible({ timeout: 15_000 });
  await save.click();
  await page.waitForTimeout(4500);
}

/** Click "+ New" on an entity grid. */
export async function clickNew(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /^\s*\+?\s*New\s*$/i }).first();
  await expect(btn, 'the grid must offer a New button').toBeVisible({ timeout: 20_000 });
  await btn.click();
  await page.waitForTimeout(5000);
}

/**
 * A saved record opens in VIEW mode, and view mode OMITS NULL FIELDS ENTIRELY — it is not a read-only
 * copy of the edit form. That is correct MJ behaviour and a trap for tests: asserting that a nullable
 * field "renders" only works in edit mode. Use this before any setField/readField on a saved record.
 */
export async function enterEditMode(page: Page): Promise<void> {
  if ((await page.locator('.mj-forms-field--editing').count()) > 0) return; // already editing

  const candidates = [
    page.getByRole('button', { name: /^\s*Edit\s*$/i }),
    page.locator('button[title*="Edit" i], [aria-label*="Edit" i]'),
    page.locator('button:has(i.fa-pen-to-square), button:has(i.fa-pen), button:has(i.fa-edit)'),
    page.locator('i.fa-pen-to-square, i.fa-pen').locator('..'),
  ];
  for (const c of candidates) {
    const el = c.first();
    if ((await el.count()) && (await el.isVisible().catch(() => false))) {
      await el.click().catch(() => undefined);
      await page.waitForTimeout(3000);
      if ((await page.locator('.mj-forms-field--editing').count()) > 0) return;
    }
  }
  throw new Error('Could not switch the record form into edit mode — no Edit control matched.');
}

/**
 * How many records the entity grid says it is showing, read from its "N records" heading.
 * Returns -1 when the indicator is not present.
 *
 * This is the assertion that actually survives: whole-page text is unreliable because open record
 * TABS keep the record's name in the DOM after it is deleted, and a naive `body.innerText().includes`
 * would report a deleted record as still present.
 */
export async function gridRecordCount(page: Page): Promise<number> {
  const txt = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  const m = /(\d+)\s+records?/i.exec(txt);
  return m ? Number(m[1]) : -1;
}

/**
 * Delete a record by opening it and using the record toolbar's "Delete this Record" control, then
 * confirming in the danger dialog.
 *
 * THIS SELECTOR WAS FOUND BY PROBE, AFTER THREE WRONG GUESSES — the wrong turns are worth recording
 * because each looked right:
 *   1. `getByRole('button', {name:'Delete'})` matches a **pre-rendered, hidden confirmation dialog**
 *      button (`.btn.btn-confirm.btn-danger`). It reports a non-zero bounding box, so "is it visible
 *      and sized?" heuristics accept it — and the click then times out because it is not actually
 *      reachable. Geometry is not reachability.
 *   2. The grid toolbar has NO Delete, even with a row selected: only Create · Export · view settings
 *      and a "More actions" (⋮) overflow, which does not contain one either.
 *   3. An early attempt swallowed its click error and set a `clicked` flag anyway, so it reported
 *      success while the record survived. Never treat "a selector matched" as "the action happened".
 *
 * The record view, by contrast, exposes `button[title="Delete this Record"]` — explicit and stable.
 *
 * NOTE ON SEMANTICS: MJ delete is a SOFT delete. The grid gains a "Recycle Bin · N deleted records"
 * chip afterwards, so the row leaving the grid is the correct UI-level assertion — not the absence of
 * the row from the database.
 */
export async function deleteRecordViaRecordView(page: Page, recordName: string): Promise<void> {
  // Open the record from the grid.
  const row = page.locator('tr, .ag-row, [role="row"]').filter({ hasText: recordName }).first();
  await expect(row, `a grid row for "${recordName}" must exist to open it`).toBeVisible({ timeout: 20_000 });
  const link = row.locator('a').first();
  if (await link.count()) {
    await link.click({ timeout: 15_000 });
  } else {
    await row.dblclick({ timeout: 15_000 });
  }
  await page.waitForTimeout(5500);

  // The explicit record-level delete control.
  const del = page.locator('button[title="Delete this Record"]').first();
  await expect(del, 'the record view must expose "Delete this Record"').toBeVisible({ timeout: 20_000 });
  await del.click({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  // The "Confirm Deletion" dialog: "Are you sure you want to delete this record? This action cannot be
  // undone." with Delete / Cancel.
  await expect(
    page.getByText(/Confirm Deletion/i).first(),
    'a "Confirm Deletion" dialog must appear',
  ).toBeVisible({ timeout: 15_000 });

  // DISCRIMINATING THE REAL BUTTON FROM THE DECOY. There are two "Delete" buttons in the DOM: this
  // dialog's (which carries a trash icon) and a hidden pre-rendered one (no icon at all — see the note
  // on this function). Requiring the icon picks the right one deterministically instead of relying on
  // DOM order or geometry, both of which already misled us once.
  const confirm = page
    .locator('button')
    .filter({ hasText: /^\s*Delete\s*$/i })
    .filter({ has: page.locator('i[class*="trash"]') })
    .first();

  if ((await confirm.count()) && (await confirm.isVisible().catch(() => false))) {
    await confirm.click({ timeout: 15_000 });
  } else {
    // Fallback: scope to whatever container holds the confirmation copy.
    const dialog = page
      .locator('[role="dialog"], .modal, .k-dialog, .dialog, div')
      .filter({ hasText: /Are you sure you want to delete this record/i })
      .last();
    await dialog.getByRole('button', { name: /^\s*Delete\s*$/i }).first().click({ timeout: 15_000 });
  }
  await page.waitForTimeout(5500);
}

/**
 * Delete a record from the entity grid: tick its row checkbox, press Delete, confirm.
 *
 * SUPERSEDED by deleteRecordViaRecordView — kept because the grid path is the one a bulk delete would
 * use, and when MJ adds a grid-level Delete this is where it goes.
 */
export async function deleteGridRow(page: Page, recordName: string): Promise<void> {
  const before = await gridRecordCount(page);

  // The row, and the checkbox that belongs to it.
  const row = page.locator('tr, .ag-row, [role="row"]').filter({ hasText: recordName }).first();
  await expect(row, `a grid row for "${recordName}" must be present to delete it`).toBeVisible({ timeout: 20_000 });
  const box = row.locator('input[type="checkbox"], .ag-selection-checkbox').first();
  if (await box.count()) {
    await box.click({ timeout: 10_000 });
  } else {
    await row.click({ timeout: 10_000 });
  }
  await page.waitForTimeout(1500);

  /**
   * FIND A DELETE CONTROL THAT IS ACTUALLY CLICKABLE.
   *
   * Two earlier attempts failed here for instructive reasons, both now guarded against:
   *   1. `getByRole('button', {name:'Delete'})` matched a Delete belonging to the VIEW-MANAGEMENT
   *      panel (Create View / Save / Cancel / Delete), which is rendered but sits behind the grid —
   *      so the click was intercepted by `.ag-viewport` rather than doing anything.
   *   2. Selecting a row does NOT reveal a Delete in the visible toolbar (+ New · Refresh · Export ·
   *      Add to List · ⋮). It lives in the ⋮ overflow menu.
   * So: open the overflow first, then take only a Delete that is genuinely visible in the viewport.
   */
  const clickableDelete = async () => {
    const all = page.getByRole('button', { name: /^\s*Delete\s*$/i });
    const n = await all.count();
    for (let i = 0; i < n; i++) {
      const el = all.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const box = await el.boundingBox().catch(() => null);
      if (box && box.width > 0 && box.height > 0) return el;
    }
    return null;
  };

  let del = await clickableDelete();
  if (!del) {
    // Open the ⋮ overflow.
    const kebab = page
      .locator('button:has(i[class*="ellipsis"]), button[title*="More" i], [aria-label*="More" i]')
      .last();
    if ((await kebab.count()) && (await kebab.isVisible().catch(() => false))) {
      await kebab.click({ timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(1800);
    }
    del = await clickableDelete();
  }

  if (!del) {
    // Fail with something actionable rather than a bare timeout.
    const menuItems = await page
      .locator('[role="menuitem"], .k-menu-item, .dropdown-item, button')
      .evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter((t) => t && t.length < 40),
      )
      .catch(() => [] as string[]);
    throw new Error(
      `No clickable Delete control found after selecting "${recordName}".\n` +
        `Visible controls were: ${JSON.stringify([...new Set(menuItems)])}`,
    );
  }

  await del.click({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  // Confirm if asked. Tolerant about whether a dialog appears, strict about the outcome below.
  for (const name of [/^\s*Yes\s*$/i, /^\s*Confirm\s*$/i, /^\s*OK\s*$/i, /^\s*Delete\s*$/i]) {
    const btn = page.getByRole('button', { name }).last();
    if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
      await btn.click({ timeout: 8000 }).catch(() => undefined);
      break;
    }
  }
  await page.waitForTimeout(4000);

  // Refresh the grid so the assertion reads server state, not a stale client list.
  const refresh = page.getByRole('button', { name: /^\s*Refresh\s*$/i }).first();
  if ((await refresh.count()) && (await refresh.isVisible().catch(() => false))) {
    await refresh.click({ timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(3500);
  }

  const after = await gridRecordCount(page);
  expect(
    after,
    `deleting "${recordName}" must reduce the grid's record count (was ${before}, now ${after})`,
  ).toBeLessThan(before === -1 ? Number.MAX_SAFE_INTEGER : before);
}

/** True when a label is rendered at all (either mode). */
export async function fieldLabelVisible(page: Page, label: string): Promise<boolean> {
  const l = page.locator(`label.mj-forms-field-label:text-is("${label}"), .mj-forms-field-label:text-is("${label}")`);
  if ((await l.count()) > 0) return true;
  // View mode renders label/value pairs that may not carry the editing class.
  return (await page.getByText(label, { exact: true }).count()) > 0;
}
