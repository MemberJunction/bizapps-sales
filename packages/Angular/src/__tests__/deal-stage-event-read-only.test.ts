import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { DealStageEventFormComponentExtended } from '../lib/custom/deal-stage-event-form.component';
import {
    MJSDealStageEventNoticePanel,
    STAGE_EVENT_APPEND_ONLY_NOTICE,
} from '../lib/form-panels/deal-stage-event-notice.panel';

/**
 * bizapps-sales#284 — Edit on a stage event did nothing and said nothing.
 *
 * The form refused edit mode and wrote its reason into a property no template rendered, while the
 * toolbar kept offering Edit because the base `UserCanEdit` answers from the entity's Update permission.
 * Now the form offers no Edit, still refuses edit mode, and a `before-fields` panel states the reason.
 *
 * `Object.create` holds the form and the panel without standing up Angular, as the other form tests do.
 */
describe('the stage event form is read-only and says so', () => {
    /** A form whose record GRANTS Update, so the base getter alone would offer Edit. */
    const form = (): DealStageEventFormComponentExtended => {
        const f = Object.create(DealStageEventFormComponentExtended.prototype) as DealStageEventFormComponentExtended;
        f.EditMode = false;
        Object.defineProperty(f, 'record', { value: { CheckPermissions: (): boolean => true }, writable: true });
        Object.defineProperty(f, '_userPermissions', { value: [], writable: true });
        return f;
    };

    it('offers no Edit button, whatever the Update permission says', () => {
        const f = form();
        // Control: the same setup through the BASE getter offers Edit, so the false below is the override's.
        const base = Object.getOwnPropertyDescriptor(BaseFormComponent.prototype, 'UserCanEdit')!.get!;
        expect(base.call(f), 'the fixture must grant Update or this test proves nothing').toBe(true);
        expect(f.UserCanEdit).toBe(false);
    });

    it('still refuses edit mode for a caller that skips the toolbar', () => {
        const f = form();
        f.StartEditMode();
        expect(f.EditMode).toBe(false);
    });

    it('renders the reason on the record, from the one sentence the form also exposes', () => {
        const p = Object.create(MJSDealStageEventNoticePanel.prototype) as MJSDealStageEventNoticePanel;
        expect(p.Notice).toContain('append-only');
        expect(form().ReadOnlyNotice).toBe(STAGE_EVENT_APPEND_ONLY_NOTICE);
    });

    it('registers the panel for stage events in the before-fields slot, and binds the notice', () => {
        const source = readFileSync(new URL('../lib/form-panels/deal-stage-event-notice.panel.ts', import.meta.url), 'utf8');
        expect(source).toMatch(/entity:\s*MJS_ENTITIES\.DealStageEvent/);
        expect(source).toMatch(/slot:\s*'before-fields'/);
        expect(source).toContain('{{ Notice }}');
    });
});
