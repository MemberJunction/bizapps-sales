/**
 * @fileoverview Is bizapps-orders installed on this host?
 *
 * ── WHY THIS IS ITS OWN FILE NOW ────────────────────────────────────────────────────────────────
 *
 * It used to live in `LiveOrdersSeam.ts`, which is gone. That class ended its life as a 128-line
 * pass-through: close-won stopped creating orders when the order became embedded on the deal at
 * creation, so `CreateOrder` and `PreviewOrderMoney` described a route that no longer exists, and once
 * they were deleted the remainder did nothing but forward two contract calls to the contracts seam it
 * had been handed. `CloseDealOperation.resolveSeam` now returns that contracts seam directly.
 *
 * This one function was the only thing in the file still doing work, and it is not about a seam at all —
 * it answers a question about the HOST. Keeping it in a file named for a deleted delegation pattern is
 * how the next person concludes there is still an orders seam to find.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { Metadata } from '@memberjunction/core';

/**
 * BOTH entities, not one, and that is the behaviour being preserved rather than a new idea.
 *
 * The original checked headers AND lines. A host carrying one without the other is a broken install, and
 * reporting it as "orders is installed" would send a deal down the live path to fail on the missing half.
 * Narrowing this to a single probe while moving the function would have been a silent behaviour change.
 */
const ORDER_HEADER_ENTITY = 'MJ_BizApps_Orders: Order Headers';
const ORDER_LINE_ENTITY = 'MJ_BizApps_Orders: Order Lines';

/**
 * True when this host has bizapps-orders registered.
 *
 * ── CHECKED AGAINST METADATA, NOT BY CATCHING AN ERROR ──────────────────────────────────────────
 *
 * `GetEntityObject` on an unregistered entity throws, and a `try/catch` around it would work — once. It
 * would also swallow a genuine failure (a provider that is not ready, a permission refusal) and report it
 * as "orders is not installed", which routes a deal down the stub path and records a stubbed outcome for a
 * deployment that has orders and is simply mid-startup. Reading the entity list cannot confuse those two.
 *
 * `Metadata.Entities` is the in-memory list the provider loaded at startup, so this costs nothing and is
 * safe to call per close.
 */
export function OrdersIsInstalled(): boolean {
    const md = new Metadata();
    const entities = md.Entities ?? [];
    return (
        entities.some((e) => e.Name === ORDER_HEADER_ENTITY) &&
        entities.some((e) => e.Name === ORDER_LINE_ENTITY)
    );
}
