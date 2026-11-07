import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE DEAL'S ACTIVITY GRID LISTED EVERY ACTIVITY UNTIL REFRESH (bc-aidp-next-golive#432).
 *
 * The panel mounted `<mj-entity-viewer>` as soon as the Activities entity was known, while the deal's
 * view was still being read from Activity Links. With no view the viewer loads the whole entity, and the
 * view bound a moment later is dropped because the viewer is still busy with that first load. Asserted
 * on the template source, as `deal-lines-panel-empty-states.test.ts` does for the same reason.
 */

const PANEL = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'form-panels', 'deal-form.panels.ts'),
    'utf8',
);

function activityPanelTemplate(): string {
    const start = PANEL.indexOf('SectionKey="activity"');
    expect(start, 'the activity panel must still be findable').toBeGreaterThan(-1);
    const end = PANEL.indexOf('</mj-collapsible-panel>', start);
    expect(end).toBeGreaterThan(start);
    return PANEL.slice(start, end);
}

describe('the deal Activity grid', () => {
    it('mounts the viewer only once the deal-filtered view exists', () => {
        const t = activityPanelTemplate();
        const guard = t.indexOf('@if (ActivityEntity && ActivityView) {');
        expect(guard, 'the viewer must be gated on the view as well as the entity').toBeGreaterThan(-1);
        expect(t.indexOf('<mj-entity-viewer')).toBeGreaterThan(guard);
    });

    it('has no other branch that mounts the viewer without the view', () => {
        expect(activityPanelTemplate().match(/<mj-entity-viewer/g)).toHaveLength(1);
    });
});
