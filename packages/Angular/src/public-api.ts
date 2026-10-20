/**
 * BizApps Sales Angular Bootstrap
 *
 * Client-side bootstrap package for the BizApps Sales Open App. Imports the entity classes, the
 * generated form components and the hand-authored surfaces so `@RegisterClass` decorators fire and
 * everything is available to MJ's class factory.
 *
 * WHAT IS MOUNTED.
 *
 * - The **Deals section** (`SalesDealsSectionResource`, reached from the Sales application's nav by its
 *   `DriverClass`): the dashboard, the deal roster and the board. A deal click calls Explorer's
 *   `NavigationService.OpenEntityRecord`, so Explorer owns the record tab.
 * - The **custom Deal form** that tab renders: the generated form with the close lock
 *   (`DealFormComponentExtended`) and the hand-authored panels contributed onto it (hero, overview,
 *   pipeline, parties, commercial terms, lines, motion, close, team, activity, history, schedule).
 * - The **board** (`DealBoardComponent`), imported by the section as a standalone component.
 *
 * Deal Stage Event also has a custom form class (`DealStageEventFormComponentExtended`, for its
 * server-owned fields). Every other Sales entity renders MJ's generated form, straight from metadata.
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
import { MJSOrderRelatedPanel } from './lib/form-panels/order-related.panel';
import { MJSAccountContactsPanel } from './lib/form-panels/account-contacts.panel';

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

// The custom Deal form and the pieces a host might legitimately reuse. Explorer's record tab renders the
// form; the section owns the nav tab.
export { SalesCustomFormsModule } from './lib/custom/custom-forms.module';
export { DealFormComponentExtended } from './lib/custom/deal-form.component';
export { DealStageEventFormComponentExtended } from './lib/custom/deal-stage-event-form.component';
export { DirtyServerOwnedFields, RefuseServerOwnedEdits } from './lib/custom/server-owned-fields';

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
export { MJSOrderRelatedPanel } from './lib/form-panels/order-related.panel';
export { MJSAccountContactsPanel } from './lib/form-panels/account-contacts.panel';
export { AccountContactsWhere } from './lib/form-panels/account-contacts';
export {
    OrderRelatedLinks,
    OrderRelatedLinksKey,
    type OrderRelatedLinkState,
} from './lib/form-panels/order-related-links';
export * from './lib/data/entity-names';
export { DealBoardComponent } from './lib/board/deal-board.component';
export type { BoardColumn } from './lib/board/deal-board.component';
export * from './lib/pages/dashboard-inspect';
// Exported alongside dashboard-inspect for the same reason: these are the dashboard's measure
// definitions, and a second surface needing "the current fiscal quarter" must reach THIS one rather
// than reimplement the boundary arithmetic.
export * from './lib/pages/dashboard-period';
// The filter bar's rules (bc-aidp-next-golive#350), for the Board when it takes the same filters.
export * from './lib/pages/dashboard-filters';
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
    // the Deal form a GENERATED entity, which still saves correctly — the child collections are on the
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
    void MJSAccountContactsPanel;
    // The provenance row on the ORDER form. Contributed onto an entity this app does not own, so
    // nothing in orders imports it — this anchor is the only thing keeping it in the bundle.
    void MJSOrderRelatedPanel;

    void CLASS_REGISTRATIONS;
    void MJSSalesSectionComponent;
    void SalesDealsSectionResource;
}

/** S-US9 — the deal activity timeline. Standalone, so a host can drop it anywhere. */
export * from './lib/activities/deal-activity-timeline.component';
