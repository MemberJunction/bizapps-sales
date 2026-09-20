import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * SERVER-MAINTAINED STAMPS MUST NOT BE EDITABLE, and the reason is not the close lock.
 *
 * `DealEntityServer` derives both values and will not accept a supplied one:
 *   · stampCompanyFromPipeline() OVERWRITES CompanyID from the pipeline's company
 *   · ownerStampEditRefusal()    REFUSES a supplied OwnerEmployeeID; the owner comes from the
 *                               deal team via stampOwnerFromTeam()
 *
 * CLAUDE.md: "Deal.OwnerEmployeeID and DealLine.CompanyID are written by entity-server code.
 * Never hand-set them."
 *
 * Rendering them as editable invites a rep to choose a value the save then discards or rejects --
 * the "accepts typing, refuses on save" behaviour golive#206 item 3 exists to delete.
 */
const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');

/**
 * The field-spec block the Account & people panel renders, so a match elsewhere cannot satisfy these.
 *
 * FOUND BY ITS OWN NAME, not by slicing forward from the class. The specs moved to module scope when
 * the Overview began borrowing the settable ones during creation — instance initializers do not run
 * under `Object.create`, which is how these panels are built in tests — and a locator anchored to
 * `export class MJSDealPartyPanel` then silently found nothing. It failed saying CompanyID was not
 * declared, which was not true and not what this test is about.
 *
 * The panel still has to be the thing that renders them, so that is asserted rather than assumed.
 */
function partyPanelFields(): string {
    expect(source, 'the party panel must render the shared spec list')
        .toMatch(/export class MJSDealPartyPanel[\s\S]*?PARTY_FIELDS/);
    const from = source.indexOf('const PARTY_FIELDS: readonly DealFieldSpec[] = [');
    expect(from, 'PARTY_FIELDS must exist — this test is scoped to it').toBeGreaterThan(-1);
    return source.slice(from, source.indexOf('];', from));
}

describe('the deal form does not offer fields the server will refuse', () => {
    it('flags CompanyID and OwnerEmployeeID as server-maintained', () => {
        const block = partyPanelFields();
        for (const field of ['CompanyID', 'OwnerEmployeeID']) {
            const line = block.split('\n').find((l) => l.includes(`name: '${field}'`));
            expect(line, `${field} must be declared on the Account & people panel`).toBeTruthy();
            expect(line, `${field} is a server-maintained stamp and must not be editable`).toContain(
                'serverMaintained: true',
            );
        }
    });

    it('does NOT flag the fields a rep genuinely chooses', () => {
        // The complement matters: a blanket freeze would take the panel's real inputs with it.
        // BillingContactID in particular stays editable even on a LOCKED deal (golive#206).
        const block = partyPanelFields();
        for (const field of ['AccountID', 'PrimaryContactID', 'BillingContactID']) {
            const line = block.split('\n').find((l) => l.includes(`name: '${field}'`));
            expect(line, `${field} must be declared`).toBeTruthy();
            expect(line, `${field} is chosen by a person and must stay editable`).not.toContain(
                'serverMaintained',
            );
        }
    });

    it('FieldEditable consults the flag BEFORE the lock, because the lock is not the reason', () => {
        const at = source.indexOf('public FieldEditable(');
        const body = source.slice(at, source.indexOf('\n    }', at));
        const flagAt = body.indexOf('serverMaintained');
        const lockAt = body.indexOf('IsLocked');
        expect(flagAt, 'FieldEditable must consult serverMaintained').toBeGreaterThan(-1);
        expect(lockAt, 'FieldEditable must still consult the lock').toBeGreaterThan(-1);
        expect(flagAt, 'a server stamp is frozen on an OPEN deal too, so the flag is checked first')
            .toBeLessThan(lockAt);
    });
});
