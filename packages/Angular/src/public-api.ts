/**
 * BizApps Sales Angular Bootstrap
 *
 * Client-side bootstrap package for the BizApps Sales Open App. Imports the entity classes and the
 * generated form components so @RegisterClass decorators fire and the components are available to
 * MJ's class factory.
 *
 * AT S1 THIS IS THE GENERATED CRUD SURFACE AND NOTHING ELSE. That is the whole point of tonight's
 * milestone: MJ Explorer renders a working create/read/update/delete form for every Sales entity
 * straight from metadata, with no hand-written UI. The real surfaces from master plan §8 — the
 * kanban pipeline board, the deal workspace with its live-reprice line editor and deal-team panel,
 * the account/contact 360 — land at S3, built on MJ's Angular Generic components and authored
 * against the L0–L3 UX layering guide.
 */

// Import entity package to trigger @RegisterClass decorators for entity subclasses
import '@mj-biz-apps/sales-entities';

// Import generated form components (triggers @RegisterClass for form components)
import './lib/generated/generated-forms.module';

// Import generated class registrations manifest
import { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';

// Re-export for consumers
export { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';
export { GeneratedFormsModule } from './lib/generated/generated-forms.module';

/**
 * Bootstrap function called during MJExplorer startup — the `startupExport` named in mj-app.json.
 * The static imports above do the registering; this is the anchor that keeps them in the bundle.
 */
export function LoadBizAppsSalesClient(): void {
    void CLASS_REGISTRATIONS;
}
