// @vitest-environment jsdom
import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';

import { DealActivityTimelineComponent } from '../lib/activities/deal-activity-timeline.component';

/**
 * New on the deal form's Activity grid goes to the compose form above it, the only path that links the
 * new activity to the deal. Built with `Object.create`: the subject is one method, not the template.
 */
function timeline(adding: boolean) {
    const host = document.createElement('div');
    const c = Object.create(DealActivityTimelineComponent.prototype) as DealActivityTimelineComponent;
    Object.assign(c, { Adding: adding, host: { nativeElement: host }, cdr: { detectChanges: vi.fn() } });
    const render = (): HTMLInputElement => {
        host.innerHTML = '<form class="dat__form"><input name="title" /></form>';
        const form = host.querySelector('form') as HTMLFormElement;
        form.scrollIntoView = vi.fn();
        return host.querySelector('input') as HTMLInputElement;
    };
    return { c, host, render };
}

describe('FocusCompose', () => {
    it('opens a closed compose form', () => {
        const { c } = timeline(false);
        const start = vi.spyOn(c, 'StartAdd').mockImplementation(() => undefined);
        c.FocusCompose();
        expect(start).toHaveBeenCalledOnce();
    });

    it('keeps a draft in progress, scrolls to the form and focuses its title', () => {
        const { c, render } = timeline(true);
        const title = render();
        document.body.appendChild(title.closest('div') as HTMLElement);
        const start = vi.spyOn(c, 'StartAdd');

        c.FocusCompose();

        expect(start).not.toHaveBeenCalled();
        expect((title.form as HTMLFormElement).scrollIntoView).toHaveBeenCalled();
        expect(document.activeElement).toBe(title);
    });
});
