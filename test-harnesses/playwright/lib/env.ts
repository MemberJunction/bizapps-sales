/**
 * Environment for the bizapps-sales Explorer GUI harness.
 *
 * Everything here is env-overridable so the harness follows the ports rather than dictating them.
 * Defaults match master plan §2 (MJAPI 4141 / MJExplorer 4341) and the repo's `.env`.
 *
 * NOTE ON PORT DISCOVERY. The sibling bizapps-accounting harness reads live ports from
 * `mjdev ps <slug> --json`, because it runs inside an mjdev workspace that assigns them. This repo
 * is a standalone checkout with fixed ports in `.env` and `package.json`, so there is nothing to
 * discover — hardcoded defaults plus env overrides are the honest equivalent here.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** test-harnesses/playwright */
export const HARNESS_DIR = path.resolve(HERE, '..');
/** Repo root. */
export const REPO_ROOT = path.resolve(HARNESS_DIR, '..', '..');

export const API_PORT = Number(process.env.MJAPI_PORT ?? 4141);
export const EXPLORER_PORT = Number(process.env.MJEXPLORER_PORT ?? 4341);

export const API_BASE_URL = process.env.MJAPI_URL ?? `http://localhost:${API_PORT}`;
export const EXPLORER_BASE_URL = process.env.MJEXPLORER_URL ?? `http://localhost:${EXPLORER_PORT}`;

/**
 * Where the captured browser session lives.
 *
 * THIS WORKS HERE AND DOES NOT WORK IN THE ACCOUNTING HARNESS, and the difference is worth stating
 * because it is the single design decision this harness turns on. Accounting authenticates with an
 * MJ magic-link token, which lives in sessionStorage / in-memory — `storageState` cannot capture it,
 * so every one of its specs re-consumes the link. Explorer's MSAL and Auth0 providers both configure
 * `cacheLocation: 'localStorage'` (verified in
 * @memberjunction/ng-auth-services/dist/lib/providers/mjexplorer-{msal,auth0}-provider.service.js),
 * and `storageState` DOES capture localStorage. So a human logs in ONCE and every later run reuses it.
 *
 * GITIGNORED. This file is a live credential — it is a bearer token for a real account.
 */
export const AUTH_DIR = path.join(HARNESS_DIR, '.auth');
export const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'user.json');

/** Screenshots, one per CRUD step, for the demo. */
export const ARTIFACTS_DIR = path.join(HARNESS_DIR, 'artifacts');

/** How long the setup project waits for a human to complete the interactive login. */
export const LOGIN_TIMEOUT_MS = Number(process.env.PW_LOGIN_TIMEOUT_MS ?? 300_000);

/**
 * MJ entity names for this app. These are what CodeGen registered — verified against `__mj.Entity`,
 * not guessed. The prefix comes from `__mj.SchemaInfo.EntityNamePrefix` / `mj.config.cjs`.
 */
export const ENTITY = {
  Deals: 'MJ_BizApps_Sales: Deals',
  Pipelines: 'MJ_BizApps_Sales: Pipelines',
  PipelineStages: 'MJ_BizApps_Sales: Pipeline Stages',
  SalesAccounts: 'MJ_BizApps_Sales: Sales Accounts',
  SalesContacts: 'MJ_BizApps_Sales: Sales Contacts',
  DealStatusTypes: 'MJ_BizApps_Sales: Deal Status Types',
  DealTypes: 'MJ_BizApps_Sales: Deal Types',
  ForecastCategoryTypes: 'MJ_BizApps_Sales: Forecast Category Types',
} as const;

/**
 * Prefix for every record this harness creates, so cleanup is unambiguous and a half-failed run
 * leaves obviously-disposable rows rather than plausible-looking data. Deliberately loud.
 */
export const TEST_PREFIX = 'PW-VERIFY';

/** The dev Company seeded by scripts/seed-dev-data.sh — Pipeline.CompanyID is NOT NULL. */
export const DEV_COMPANY_ID = 'C0A5E100-0001-4A01-9E11-5B7C3D2F8A01';
export const DEV_COMPANY_NAME = 'Blue Cypress (Local Dev)';
