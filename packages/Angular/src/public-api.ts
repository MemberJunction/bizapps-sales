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

// Hand-authored surfaces. The resource import is what registers the nav item's DriverClass.
import { LoadDealWorkspaceResource } from './lib/workspace/deal-workspace-resource.component';

// Re-export for consumers
export { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';
export { GeneratedFormsModule } from './lib/generated/generated-forms.module';

// The deal workspace and the pieces a host might legitimately reuse.
export { DealWorkspaceModule } from './lib/workspace/deal-workspace.module';
export { DealWorkspaceComponent } from './lib/workspace/deal-workspace.component';
export { DealWorkspaceResourceComponent, LoadDealWorkspaceResource } from './lib/workspace/deal-workspace-resource.component';
export { DealWorkspaceService } from './lib/workspace/deal-workspace.service';
export type { DealSaveOutcome } from './lib/workspace/deal-workspace.service';
export * from './lib/workspace/deal-workspace.types';

/**
 * Bootstrap function called during MJExplorer startup — the `startupExport` named in mj-app.json.
 * The static imports above do the registering; this is the anchor that keeps them in the bundle.
 *
 * `LoadDealWorkspaceResource()` is load-bearing, not decorative: nothing references
 * `DealWorkspaceResourceComponent` by name, so without this call a bundler correctly drops it, the
 * `DealWorkspaceResource` registration never happens, and the Sales nav item resolves to nothing —
 * with no error to explain why.
 */
export function LoadBizAppsSalesClient(): void {
    void CLASS_REGISTRATIONS;
    LoadDealWorkspaceResource();
}
