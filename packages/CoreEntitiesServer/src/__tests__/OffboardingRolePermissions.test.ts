/**
 * The Sales Offboarding role (golive #297, g297.8) supplies the entity rights the offboarding reassign's
 * saves need, and nothing more. This pins its metadata against `SALES_OFFBOARDING_RIGHTS`, and that a
 * caller who may move an item but lacks the rights is told which role supplies them.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    MissingRightsNote,
    NoteMissingRights,
    SALES_OFFBOARDING_RIGHTS,
    SALES_OFFBOARDING_ROLE,
    type EntityRights,
    type OffboardingHolding,
} from '../offboarding/OffboardingHoldings.js';

const METADATA_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'metadata');

interface MetadataRecord { fields: Record<string, string | boolean | null> }

function readRecords(folder: string): MetadataRecord[] {
    const dir = join(METADATA_DIR, folder);
    return readdirSync(dir)
        .filter((f) => f.endsWith('.json') && f !== '.mj-sync.json')
        .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as MetadataRecord[]);
}

const ROLE_LOOKUP = `@lookup:MJ: Roles.Name=${SALES_OFFBOARDING_ROLE}`;
const ENTITY_PREFIX = '@lookup:MJ: Entities.Name=';

describe('the Sales Offboarding role metadata', () => {
    it('ships the role, and says it grants entity rights only', () => {
        const role = readRecords('roles').find((r) => r.fields.Name === SALES_OFFBOARDING_ROLE);
        expect(role).toBeDefined();
        expect(String(role?.fields.Description)).toMatch(/does not authorize a move/);
    });

    it('grants exactly the rights the reassign needs, on exactly the entities it saves', () => {
        const rows = readRecords('entity-permissions').filter((r) => r.fields.RoleID === ROLE_LOOKUP);
        const granted = Object.fromEntries(
            rows.map((r) => [
                String(r.fields.EntityID).replace(ENTITY_PREFIX, ''),
                { CanCreate: r.fields.CanCreate, CanRead: r.fields.CanRead, CanUpdate: r.fields.CanUpdate, CanDelete: r.fields.CanDelete },
            ]),
        );
        expect(rows).toHaveLength(Object.keys(SALES_OFFBOARDING_RIGHTS).length);
        expect(granted).toEqual(SALES_OFFBOARDING_RIGHTS);
    });

    it('grants nothing on sales accounts or contacts, which are Sales Admin only (g297.9)', () => {
        const rows = readRecords('entity-permissions').filter((r) => r.fields.RoleID === ROLE_LOOKUP);
        expect(rows.some((r) => /Sales (Accounts|Contacts)$/.test(String(r.fields.EntityID)))).toBe(false);
        expect(MissingRightsNote('ACCOUNT_OWNER', () => null)).toBeNull();
        expect(MissingRightsNote('CONTACT_OWNER', () => null)).toBeNull();
    });

    it('never grants delete except on team rows, and never create elsewhere', () => {
        for (const [entity, rights] of Object.entries(SALES_OFFBOARDING_RIGHTS)) {
            const teamRows = entity === 'MJ_BizApps_Sales: Deal Team Members';
            expect(rights.CanDelete).toBe(teamRows);
            expect(rights.CanCreate).toBe(teamRows);
        }
    });
});

describe('the missing-rights note', () => {
    const all: EntityRights = { CanCreate: true, CanRead: true, CanUpdate: true, CanDelete: true };
    const readOnly: EntityRights = { CanCreate: false, CanRead: true, CanUpdate: false, CanDelete: false };
    const updateOnly: EntityRights = { CanCreate: false, CanRead: true, CanUpdate: true, CanDelete: false };

    it('is null when the caller holds every right the kind needs', () => {
        expect(MissingRightsNote('DEAL_OWNER', () => all)).toBeNull();
        expect(MissingRightsNote('PIPELINE_CLOSE_WON_ASSIGNEE', () => updateOnly)).toBeNull();
    });

    it('names the role when update is missing, or when the owner swap lacks create/delete on team rows', () => {
        expect(MissingRightsNote('DEAL_TEAM_MEMBER', () => readOnly)).toContain('Sales Offboarding');
        expect(MissingRightsNote('DEAL_OWNER', () => updateOnly)).toContain('Sales Offboarding');
        expect(MissingRightsNote('PIPELINE_CLOSE_WON_ASSIGNEE', () => null)).toContain('Sales Offboarding');
    });

    it('notes only rows the caller may move; the role never turns CanReassign on', () => {
        const row = (CanReassign: boolean): OffboardingHolding => ({
            App: 'Sales', Domain: 'Sales', Kind: 'PIPELINE_CLOSE_WON_ASSIGNEE', KindLabel: 'Close-won task assignee', EntityName: 'MJ_BizApps_Sales: Pipelines',
            RecordID: 'a', Label: 'Acme', CanReassign, Note: CanReassign ? null : 'Only the supervisor or a Sales Admin',
        });
        const [movable, notMovable] = NoteMissingRights([row(true), row(false)], () => readOnly);
        expect(movable).toMatchObject({ CanReassign: true, Note: expect.stringContaining('Sales Offboarding') });
        expect(notMovable).toMatchObject({ CanReassign: false, Note: 'Only the supervisor or a Sales Admin' });
    });
});
