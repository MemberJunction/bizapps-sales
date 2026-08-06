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

// Server-side entity subclasses and remote operations — MUST come after sales-entities so
// @RegisterClass auto-increment gives these higher priority than the generated classes. As of
// Phase 1 this carries DealEntityServer (header + lines + payment schedule in one transaction,
// and the OwnerEmployeeID stamp) and Sales.SaveDeal. The close lock lands at S4.
import '@mj-biz-apps/sales-core-entities-server';
import { LoadSalesCoreEntitiesServer } from '@mj-biz-apps/sales-core-entities-server';

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
    // Static imports above ensure the generated classes are registered; this anchors the
    // server-only subclasses against tree-shaking. Load-bearing as of Phase 1: without it a bundler
    // is right to drop the imports, ClassFactory then resolves the GENERATED Deal entity instead of
    // DealEntityServer, and the whole transaction/owner-stamp layer silently stops applying.
    LoadSalesCoreEntitiesServer();

    // Referenced so the manifest import is not elided; MJ reads it during registration.
    void CLASS_REGISTRATIONS;
}
