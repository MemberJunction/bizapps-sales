import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { DealCloseStampFields, type DealEntity } from '@mj-biz-apps/sales-entities';
import {
    MJSDealClosePanel,
    MJSDealCommercialPanel,
    MJSDealPipelinePanel,
} from '../lib/form-panels/deal-form.panels';
import { MJSDealHeroPanel } from '../lib/form-panels/deal-hero.panel';

/**
 * #252: on an open deal a rep looking for where to enter the expected close found Actual Close Date
 * in the Close panel, typed a future day, and the header then read "Closed".
 *
 * Three things together stop that: the close stamps are never editable (the server refuses them too,
 * from the same set), Expected Close Date sits beside stage and probability, and the header calls an
 * open deal's date what it is.
 */

type FieldPanel = { FieldEditable(n: string): boolean; Fields: { name: string }[] };

function openPanel(Ctor: new () => FieldPanel, record: Partial<Record<string, unknown>> = { IsSaved: true }): FieldPanel {
    const p = new Ctor();
    Object.defineProperty(p, 'FormComponent', { value: { IsLocked: false }, configurable: true, writable: true });
    Object.defineProperty(p, 'Record', { value: record as unknown as DealEntity, configurable: true, writable: true });
    return p;
}

describe('the close stamps on an OPEN deal', () => {
    it('are read-only, every one of them, from the set the server enforces', () => {
        const p = openPanel(MJSDealClosePanel);
        for (const field of DealCloseStampFields()) {
            expect(p.Fields.some((f) => f.name === field), `${field} is still shown on the Close panel`).toBe(true);
            expect(p.FieldEditable(field), `${field} is written by the close, never typed`).toBe(false);
        }
    });

    it('leave the Close panel\'s other fields editable', () => {
        // The complement: a blanket freeze would take the panel's real inputs with it.
        const p = openPanel(MJSDealClosePanel);
        for (const field of ['LossReasonID', 'StandardAgreementModified', 'LossNotes']) {
            expect(p.FieldEditable(field), `${field} is chosen by a person`).toBe(true);
        }
    });
});

describe('Expected Close Date', () => {
    it('is on the Pipeline panel, editable, and bound once', () => {
        const pipeline = openPanel(MJSDealPipelinePanel);
        expect(pipeline.Fields.map((f) => f.name)).toContain('ExpectedCloseDate');
        expect(pipeline.FieldEditable('ExpectedCloseDate')).toBe(true);
        expect(openPanel(MJSDealCommercialPanel).Fields.map((f) => f.name)).not.toContain('ExpectedCloseDate');
    });

    it('is offered while the deal is being created, as it was from Commercial', () => {
        const creating = openPanel(MJSDealPipelinePanel, { IsSaved: false });
        expect(creating.Fields.map((f) => f.name)).toContain('ExpectedCloseDate');
    });
});

describe('the hero on an open deal', () => {
    const hero = (over: Partial<Record<string, unknown>>) => {
        const p = Object.create(MJSDealHeroPanel.prototype) as MJSDealHeroPanel;
        Object.defineProperty(p, 'Record', {
            value: { ClosedAt: null, ActualCloseDate: null, ExpectedCloseDate: null, ...over } as unknown as DealEntity,
            configurable: true,
        });
        return p;
    };

    it('labels the date "Expected close", and "Closed" only once it has', () => {
        expect(hero({ ExpectedCloseDate: '2026-11-30' }).CloseStatLabel).toBe('Expected close');
        expect(hero({ ActualCloseDate: '2026-11-30' }).CloseStatLabel).toBe('Closed');
    });
});
