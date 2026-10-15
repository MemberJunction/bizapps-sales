/**
 * @fileoverview The append-only notice on the Deal Stage Event form.
 *
 * Pattern 1 (`BaseFormPanel` in `before-fields`), the same slot `order-related.panel.ts` uses. The form
 * itself has no Edit button (`DealStageEventFormComponentExtended.UserCanEdit` is false), so this line
 * is the only place a person learns WHY the record cannot be changed and what to do instead. It is
 * always shown rather than shown on a refused click: a refusal nobody can trigger explains nothing.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component, ViewEncapsulation } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import { MJS_ENTITIES } from '../data/entity-names';

/**
 * The one statement of why a stage event is read-only. The form's `ReadOnlyNotice` returns this same
 * constant, so the two cannot drift.
 */
export const STAGE_EVENT_APPEND_ONLY_NOTICE =
    'Stage events are append-only. This row records what the deal looked like at a transition, ' +
    'and editing it would rewrite the history the forecast is checked against. To change the ' +
    'deal, change the deal — a new event will be recorded.';

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-stage-event-notice',
    skipNullKeyWarning: true,
    metadata: {
        entity: MJS_ENTITIES.DealStageEvent,
        slot: 'before-fields',
        sortKey: 100,
        contributionKey: 'append-only-notice',
    },
})
@Component({
    selector: 'mjs-deal-stage-event-notice-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    template: `
        <p class="mjs-stage-event-notice" data-testid="stage-event-append-only-notice">
            <i class="fa-solid fa-lock" aria-hidden="true"></i>
            <span>{{ Notice }}</span>
        </p>
    `,
    styles: [
        `
            .mjs-stage-event-notice {
                display: flex;
                align-items: flex-start;
                gap: var(--mj-space-2);
                margin: 0 0 var(--mj-space-3);
                padding: var(--mj-space-3);
                border: 1px solid var(--mj-border-default);
                border-radius: var(--mj-radius-md, 8px);
                background: var(--mj-bg-surface-sunken);
                color: var(--mj-text-secondary);
                font-size: var(--mj-text-sm);
            }
            .mjs-stage-event-notice > i {
                margin-top: 2px;
                color: var(--mj-text-muted);
            }
        `,
    ],
})
export class MJSDealStageEventNoticePanel extends BaseFormPanel {
    public get Notice(): string {
        return STAGE_EVENT_APPEND_ONLY_NOTICE;
    }
}
