import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    DEAL_CLOSE_STAMPS,
    DEAL_FIELDS_EDITABLE_WHILE_LOCKED,
    IsDealCloseStamp,
} from '@mj-biz-apps/sales-entities';
import { MJSDealClosePanel, MJSDealPartyPanel } from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#206: "Clicking Edit opens every field for typing, and I only find out a field is
 * frozen when the save is refused."
 *
 * The Close panel was the sharpest instance of that. It offered `ActualCloseDate`, `ClosedAt`,
 * `ClosedByUserID` and `LossReasonID` as ordinary editable fields — server-written stamps that record
 * what a close actually did. A user could type a close date onto a deal nobody had closed, and since
 * every bookings report selects on `ActualCloseDate IS NOT NULL`, that deal would then have shown up in
 * the revenue figures.
 *
 * WHAT IS TESTED HERE is that the form and the server describe the same set. The server's refusal has
 * its own coverage (CD27/CD28); what can silently go wrong *here* is a stamp being added to
 * `DEAL_CLOSE_STAMPS` and left editable on the form, which puts the refusal back at the worst possible
 * moment — on save, after the user has typed.
 */
const closePanel = new MJSDealClosePanel();
const partyPanel = new MJSDealPartyPanel();

describe('the close stamps are frozen on the form, not merely refused by the server', () => {
    it('marks every close stamp it renders as server-written', () => {
        const rendered = closePanel.Fields.filter((f) => IsDealCloseStamp(f.name));
        // Guards the assertion below against passing because the panel renders none of them.
        expect(rendered.map((f) => f.name).sort()).toEqual([...DEAL_CLOSE_STAMPS].sort());
        for (const f of rendered) {
            expect(f.serverWritten, `${f.name} is a close stamp and must not be editable`).toBe(true);
        }
    });

    it('leaves Loss Notes editable, because it is the correction channel', () => {
        // The reason stays frozen so the close event stays honest; the notes are how someone says more
        // about it afterwards. #206 keeps Loss Notes editable on a locked Lost deal for exactly this.
        const notes = closePanel.Fields.find((f) => f.name === 'LossNotes');
        expect(notes, 'the Close panel no longer renders LossNotes').toBeDefined();
        expect(notes?.serverWritten).toBeFalsy();
        expect(IsDealCloseStamp('LossNotes')).toBe(false);
    });

    it('leaves the genuine commercial inputs on the panel editable', () => {
        // A blanket "freeze the Close panel" would have caught these, and they are the user's to set.
        for (const name of ['StandardAgreementModified', 'AnnualIncreasePctOverride', 'CancellationNoticeDaysOverride']) {
            expect(closePanel.Fields.find((f) => f.name === name)?.serverWritten, name).toBeFalsy();
        }
    });
});

describe('the other two columns the server owns are frozen too', () => {
    it('freezes CompanyID, which stampCompanyFromPipeline overwrites on every save', () => {
        // The damaging half is that it was SILENT: the save succeeded and the chosen value was gone.
        expect(partyPanel.Fields.find((f) => f.name === 'CompanyID')?.serverWritten).toBe(true);
    });

    it('freezes OwnerEmployeeID, which ownerStampEditRefusal refuses outright', () => {
        // Typing here could only ever end in a failed save. The owner changes on the Internal team panel.
        expect(partyPanel.Fields.find((f) => f.name === 'OwnerEmployeeID')?.serverWritten).toBe(true);
    });

    it('leaves the contacts and the account alone', () => {
        for (const name of ['AccountID', 'PrimaryContactID', 'BillingContactID']) {
            expect(partyPanel.Fields.find((f) => f.name === name)?.serverWritten, name).toBeFalsy();
        }
    });
});

describe('the two field rules do not contradict each other', () => {
    it('never calls a close stamp editable-while-locked', () => {
        // They answer different questions — "may anyone ever set this" versus "may it change after
        // close" — but a field in both sets would mean the lock invites an edit the stamp rule refuses.
        for (const stamp of DEAL_CLOSE_STAMPS) {
            expect(DEAL_FIELDS_EDITABLE_WHILE_LOCKED.has(stamp), stamp).toBe(false);
        }
    });
});

describe('the template actually honours the flag', () => {
    /**
     * The assertions above prove the LIST is right. They cannot prove the panels still read it — delete
     * `&& !f.serverWritten` from a template and every test above stays green while every frozen field
     * goes back to being editable. The binding lives in a template string, so the only way to hold it
     * is to read the source, which is what the repo's other gates do.
     */
    const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
    const fieldLoopBindings = source
        .split('\n')
        .filter((l) => l.includes('[EditMode]=') && l.includes('[LinkType]="f.link'));

    it('guards EditMode with serverWritten in every field loop', () => {
        // Pinned at five so a sixth panel added later cannot quietly opt out of the rule.
        expect(fieldLoopBindings).toHaveLength(5);
        for (const line of fieldLoopBindings) {
            expect(line, 'a field loop renders EditMode without the serverWritten guard')
                .toContain('!f.serverWritten');
        }
    });
});
