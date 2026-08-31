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
import { LoadSalesDealEntities } from '@mj-biz-apps/sales-entities';

// Import generated form components (triggers @RegisterClass for form components)
import './lib/generated/generated-forms.module';

// Import generated class registrations manifest
import { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';

// Hand-authored surfaces. Importing the section is what registers the nav item's DriverClass.
import { MJSSalesSectionComponent, SalesDealsSectionResource } from './lib/sections/sales-section.component';

/**
 * PER-ENTITY FORMS (#89 P3). Each registers at explicit priority 2 against the same key its generated
 * form uses, so the custom one wins by declared precedence rather than by bundler import order.
 *
 * Only two entities have a form *class* replacement, and only because BEHAVIOUR required it: the close
 * lock, and the server-owned fields on stage events. Layout is panels + chrome (left-nav, Overview,
 * organized sections) contributed onto the generated Deal form.
 */
import './lib/custom/custom-forms.module';
import { DealFormComponentExtended } from './lib/custom/deal-form.component';
import { DealStageEventFormComponentExtended } from './lib/custom/deal-stage-event-form.component';
import { MJSDealHeroPanel } from './lib/form-panels/deal-hero.panel';
import { DealFormPolicy } from './lib/form-panels/deal-form.policy';
import {
    MJSDealActivityPanel,
    MJSDealBuyingTeamPanel,
    MJSDealClosePanel,
    MJSDealCommercialPanel,
    MJSDealHistoryPanel,
    MJSDealLinesPanel,
    MJSDealMotionPanel,
    MJSDealOverviewPanel,
    MJSDealPartyPanel,
    MJSDealPipelinePanel,
    MJSDealSchedulePanel,
    MJSDealTeamGridPanel,
} from './lib/form-panels/deal-form.panels';
import {
    MJSOrganizationDealsPanel,
    MJSPersonDealTeamPanel,
    MJSPersonDealsPanel,
} from './lib/form-panels/party-deals.panels';

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
export { SalesCustomFormsModule } from './lib/custom/custom-forms.module';
export { DealFormComponentExtended } from './lib/custom/deal-form.component';
export { DealStageEventFormComponentExtended } from './lib/custom/deal-stage-event-form.component';
export { DirtyServerOwnedFields, RefuseServerOwnedEdits } from './lib/custom/server-owned-fields';

export { DealWorkspaceComponent } from './lib/workspace/deal-workspace.component';

// The board. Exported for reuse and no more: it needs no resource shim and no anchor, because the section
// imports it directly as a standalone component rather than resolving it through the ClassFactory.
export { MJSDealHeroPanel } from './lib/form-panels/deal-hero.panel';
export { DealFormPolicy } from './lib/form-panels/deal-form.policy';
export {
    MJSDealOverviewPanel,
    MJSDealPipelinePanel,
    MJSDealPartyPanel,
    MJSDealCommercialPanel,
    MJSDealLinesPanel,
    MJSDealMotionPanel,
    MJSDealClosePanel,
    MJSDealTeamGridPanel,
    MJSDealBuyingTeamPanel,
    MJSDealActivityPanel,
    MJSDealHistoryPanel,
    MJSDealSchedulePanel,
} from './lib/form-panels/deal-form.panels';
export {
    MJSOrganizationDealsPanel,
    MJSPersonDealsPanel,
    MJSPersonDealTeamPanel,
} from './lib/form-panels/party-deals.panels';
export * from './lib/data/entity-names';
export { DealBoardComponent } from './lib/board/deal-board.component';
export type { BoardColumn } from './lib/board/deal-board.component';
export * from './lib/pages/dashboard-inspect';
export { DealWorkspaceService } from './lib/workspace/deal-workspace.service';
export type { DealSaveOutcome, DealRosterRow } from './lib/workspace/deal-workspace.service';
export * from './lib/workspace/deal-workspace.types';
export * from './lib/workspace/deal-workspace.validation';
export * from './lib/workspace/deal-workspace.dates';

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
    // The shared Deal / DealLine / DealPaymentSchedule subclasses. Without this the class factory hands
    // the workspace a GENERATED entity, which still saves correctly — the child collections are on the
    // generated class — but validates against nothing except the database's own constraints. The user
    // would then get a server rejection where the form should have marked the field.
    LoadSalesDealEntities();

    // One anchor PER custom form, for the reason given above: a production build drops an import that
    // nothing references, the priority-2 registration never fires, and the GENERATED form silently wins.
    // The symptom would be a Deal form that lets you edit a locked deal — a missing guard, not an error.
    void DealFormComponentExtended;
    void DealStageEventFormComponentExtended;
    void MJSDealHeroPanel;
    void DealFormPolicy;
    void MJSDealOverviewPanel;
    void MJSDealPipelinePanel;
    void MJSDealPartyPanel;
    void MJSDealCommercialPanel;
    void MJSDealLinesPanel;
    void MJSDealMotionPanel;
    void MJSDealClosePanel;
    void MJSDealTeamGridPanel;
    void MJSDealBuyingTeamPanel;
    void MJSDealActivityPanel;
    void MJSDealHistoryPanel;
    void MJSDealSchedulePanel;
    void MJSOrganizationDealsPanel;
    void MJSPersonDealsPanel;
    void MJSPersonDealTeamPanel;

    void CLASS_REGISTRATIONS;
    void MJSSalesSectionComponent;
    void SalesDealsSectionResource;
}

/** S-US9 — the deal activity timeline. Standalone, so a host can drop it anywhere. */
export * from './lib/activities/deal-activity-timeline.component';
