/**
 * BizApps Sales Server Bootstrap
 *
 * Server-side bootstrap package for the BizApps Sales Open App. Ensures the
 * entity subclasses, action subclasses, and GraphQL resolvers are registered
 * with the MJ class factory.
 */

// Import entity and action packages to trigger @RegisterClass decorators
import '@mj-biz-apps/sales-entities';
import '@mj-biz-apps/sales-actions';
import { LoadSalesDealEntities } from '@mj-biz-apps/sales-entities';

// Server-side entity subclasses — MUST come after sales-entities so @RegisterClass auto-increment gives
// these higher priority. This carries DealEntityServer: deal numbering inside the save's transaction and
// the OwnerEmployeeID stamp derived from the team roster. The deal's own child collections are Related
// Record Collections now, so no hand-rolled tree lives here any more. The close lock lands at S4.
import '@mj-biz-apps/sales-core-entities-server';
import { LoadSalesCoreEntitiesServer } from '@mj-biz-apps/sales-core-entities-server';
/** Sales' first hand-written Action. Anchored below for the same reason the entities are. */
import { LoadSyncActivitiesAction } from './custom/sync-activities.action.js';
import { LoadCaptureForecastSnapshotAction } from './custom/forecast-snapshot.action.js';

// Import generated GraphQL resolvers
import './generated/generated.js';

// Import generated class registrations manifest
import { CLASS_REGISTRATIONS } from './generated/class-registrations-manifest.js';

// Re-export for consumers
export { CLASS_REGISTRATIONS } from './generated/class-registrations-manifest.js';

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Absolute paths to the resolver files (generated + custom), for use with createMJServer().
 * Globbed rather than listed so a new custom resolver needs no edit here.
 */
export const RESOLVER_PATHS = [
    resolve(__dirname, 'generated/generated.{js,ts}'),
    resolve(__dirname, 'resolvers/*Resolver.{js,ts}'),
];

/**
 * Bootstrap function called by DynamicPackageLoader during MJAPI startup.
 * The static imports above handle all registration; this function is the
 * startupExport entry point named in mj-app.json.
 */
export function LoadBizAppsSalesServer(): void {
    // The SHARED subclasses (DealEntity / DealLineEntity / DealPaymentScheduleEntity) carry the
    // validation rules that must hold on both tiers. Anchored explicitly, and BEFORE the server-only
    // anchor below, because DealEntityServer extends DealEntity — dropping this import would leave the
    // server enforcing nothing but the database's own constraints.
    LoadSalesDealEntities();

    // Static imports above ensure the generated classes are registered; this anchors the
    // server-only subclasses against tree-shaking. Load-bearing: without it a bundler is right to drop
    // the imports, ClassFactory then resolves a less-derived Deal class instead of DealEntityServer,
    // and deal numbering plus the owner stamp silently stop applying.
    LoadSalesCoreEntitiesServer();

    /**
     * THE ACTION, and it needs the same anchoring as the entity classes for the same reason: its
     * `@RegisterClass` runs as a side effect of the import, so a tree-shaken import leaves
     * `Sales.SyncActivities` present in metadata, scheduled, firing, and resolving to nothing.
     */
    LoadSyncActivitiesAction();
    LoadCaptureForecastSnapshotAction();

    // Referenced so the manifest import is not elided; MJ reads it during registration.
    void CLASS_REGISTRATIONS;
}

export { SyncActivitiesAction, LoadSyncActivitiesAction } from './custom/sync-activities.action.js';
export {
    CaptureForecastSnapshotAction,
    LoadCaptureForecastSnapshotAction,
} from './custom/forecast-snapshot.action.js';
