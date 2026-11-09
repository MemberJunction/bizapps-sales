import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealMotionPanel, MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * Lead source sits on the Pipeline panel, with its detail beside it, and nowhere else: one binding per
 * column. The Pipeline panel trims its list while a deal is unsaved, so the saved list is the one read.
 */
function savedPipeline(): MJSDealPipelinePanel {
    const p = new MJSDealPipelinePanel();
    Object.defineProperty(p, 'Record', { value: { IsSaved: true } as unknown, configurable: true });
    return p;
}

describe('Deal form: lead source on Pipeline', () => {
    it('lists the lead source and its detail on a saved deal, detail after source', () => {
        const names = savedPipeline().Fields.map((f) => f.name);
        const source = names.indexOf('LeadSourceTypeID');
        expect(source).toBeGreaterThan(-1);
        expect(names[source + 1]).toBe('LeadSourceDetail');
    });

    it('links the lead source to its type record', () => {
        const source = savedPipeline().Fields.find((f) => f.name === 'LeadSourceTypeID');
        expect(source?.link).toBe('Record');
    });

    it('no longer lists the lead source on Motion', () => {
        const names = new MJSDealMotionPanel().Fields.map((f) => f.name);
        expect(names).not.toContain('LeadSourceTypeID');
        expect(names).not.toContain('LeadSourceDetail');
    });
});
