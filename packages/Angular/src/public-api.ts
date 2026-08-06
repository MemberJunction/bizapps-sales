/**
 * BizApps Sales Angular Bootstrap
 *
 * Client-side bootstrap package for the BizApps Sales Open App. Imports the entity classes, the
 * generated form components and the hand-authored surfaces so `@RegisterClass` decorators fire and
 * everything is available to MJ's class factory.
 *
 * WHAT IS HERE, AND WHAT IS STILL GENERATED-ONLY.
 *
 * S1 shipped the generated CRUD surface and nothing else: MJ Explorer renders a working
 * create/read/update/delete form for every Sales entity straight from metadata, with no hand-written
 * UI. That still exists and still works — it is how the entity browser is reached.
 *
 * Phase 1 adds the first HAND-AUTHORED surface: the **deal workspace**, one tabbed screen for viewing,
 * editing and creating a deal together with its lines and its payment schedule. It is reached from the
 * Sales application's nav via `DriverClass: 'DealWorkspaceResource'`. It is deliberately BASIC —
 * standard chrome, semantic tokens, no polish — because the point of Phase 1 is that an account
 * director can complete a deal through it, not that it looks finished.
 *
 * Still to come from master plan §8: the kanban pipeline board, the live-reprice line editor once
 * `Orders.PreviewOrder` is wired in, the deal-team panel, the activity timeline, and the
 * account/contact 360. Those land at S3.
 */

// Import entity package to trigger @RegisterClass decorators for entity subclasses
import '@mj-biz-apps/sales-entities';

// Import generated form components (triggers @RegisterClass for form components)
import './lib/generated/generated-forms.module';

// Import generated class registrations manifest
import { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';

// Hand-authored surfaces. Importing the section is what registers the nav item's DriverClass.
import { MJSSalesSectionComponent, SalesDealsSectionResource } from './lib/sections/sales-section.component';

// Re-export for consumers
export { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';
export { GeneratedFormsModule } from './lib/generated/generated-forms.module';

/*
 * THE EXPLORER TAB. `SalesDealsSectionResource`'s @RegisterClass key must match the `DriverClass` in
 * metadata/applications/.bizapps-sales-application.json — that pairing is the entire wiring, and both
 * halves are required: metadata naming an unregistered class renders a dead tab, and a registered class
 * with no metadata never appears. `MJSSalesSectionComponent` is the implementation it mounts; it is
 * exported for reuse but is NOT itself a nav item.
 */
export { MJSSalesSectionComponent, SalesDealsSectionResource, LoadSalesSection } from './lib/sections/sales-section.component';
export * from './lib/nav/sales-nav.model';

// The deal workspace and the pieces a host might legitimately reuse. The workspace is a standalone
// component the section mounts; it has no resource shim of its own any more — the section owns the tab.
export { DealWorkspaceComponent } from './lib/workspace/deal-workspace.component';
export { DealWorkspaceService } from './lib/workspace/deal-workspace.service';
export type { DealSaveOutcome, DealRosterRow } from './lib/workspace/deal-workspace.service';
export * from './lib/workspace/deal-workspace.types';

/**
 * Bootstrap function called during MJExplorer startup — the `startupExport` named in mj-app.json.
 * The static imports above do the registering; this is the anchor that keeps them in the bundle.
 *
 * The `void` references below are load-bearing, not decorative: nothing references these classes by
 * name, so without them a production build correctly drops the imports, the registrations never fire,
 * and the Sales nav item mounts nothing — with no error anywhere to explain why. One anchor PER
 * registered class, for the same reason contracts keeps one per resource.
 */
export function LoadBizAppsSalesClient(): void {
    void CLASS_REGISTRATIONS;
    void MJSSalesSectionComponent;
    void SalesDealsSectionResource;
}
