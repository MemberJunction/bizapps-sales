import { afterEach, describe, expect, it } from 'vitest';
import { BaseEntity, BaseEntityEvent } from '@memberjunction/core';
import { MJEventType, MJGlobal, type MJEvent } from '@memberjunction/global';

import { DealSaveOf, SameDealID, WatchDealSaves, type DealSave } from '../lib/data/deal-saves';
import { MJS_ENTITIES } from '../lib/data/entity-names';

/**
 * A SAVED DEAL STAYED STALE EVERYWHERE BUT WHERE IT WAS SAVED (bc-aidp-next-golive#419).
 *
 * Each surface holds its own copy of a deal, so the board and a reopened deal tab kept showing the
 * owner and stage they had read before the save. `deal-saves.ts` turns MJ's app-wide save broadcast
 * into "this deal was saved", which those surfaces now re-read on. These tests pin the filter: the
 * events it lets through and the ones it must not.
 */

function entity(name: string, fields: Record<string, string>): BaseEntity {
    return { EntityInfo: { Name: name }, Get: (field: string) => fields[field] ?? null } as unknown as BaseEntity;
}

function saveEvent(record: BaseEntity, type: BaseEntityEvent['type'] = 'save'): MJEvent {
    const args = new BaseEntityEvent();
    args.type = type;
    args.baseEntity = record;
    return { component: record, event: MJEventType.ComponentEvent, eventCode: BaseEntity.BaseEventCode, args };
}

describe('DealSaveOf', () => {
    it("names the deal a deal save belongs to, and the instance that saved it", () => {
        const deal = entity(MJS_ENTITIES.Deal, { ID: 'DEAL-1' });
        expect(DealSaveOf(saveEvent(deal))).toEqual({ EntityName: MJS_ENTITIES.Deal, DealID: 'DEAL-1', Record: deal });
    });

    it("names a team row's deal, not the row: an owner change saves the team", () => {
        const member = entity(MJS_ENTITIES.DealTeamMember, { ID: 'MEMBER-1', DealID: 'DEAL-1' });
        expect(DealSaveOf(saveEvent(member))?.DealID).toBe('DEAL-1');
    });

    it('ignores a save that has only started, since it may still fail', () => {
        expect(DealSaveOf(saveEvent(entity(MJS_ENTITIES.Deal, { ID: 'DEAL-1' }), 'save_started'))).toBeNull();
    });

    it('ignores a load and a delete', () => {
        const deal = entity(MJS_ENTITIES.Deal, { ID: 'DEAL-1' });
        expect(DealSaveOf(saveEvent(deal, 'load_complete'))).toBeNull();
        expect(DealSaveOf(saveEvent(deal, 'delete'))).toBeNull();
    });

    it('ignores saves of entities that do not change a deal', () => {
        expect(DealSaveOf(saveEvent(entity(MJS_ENTITIES.SalesAccount, { ID: 'ACCOUNT-1' })))).toBeNull();
    });

    it('ignores events that are not entity events', () => {
        const deal = entity(MJS_ENTITIES.Deal, { ID: 'DEAL-1' });
        expect(DealSaveOf({ ...saveEvent(deal), eventCode: 'SomethingElse' })).toBeNull();
        expect(DealSaveOf({ ...saveEvent(deal), event: MJEventType.LoggedIn })).toBeNull();
    });
});

describe('SameDealID', () => {
    it('matches across case, which differs between the database and a URL', () => {
        expect(SameDealID('ABC-1', 'abc-1')).toBe(true);
    });

    it('never matches a missing ID, even to another missing ID', () => {
        expect(SameDealID(null, null)).toBe(false);
        expect(SameDealID('ABC-1', undefined)).toBe(false);
    });
});

describe('WatchDealSaves', () => {
    let stop: (() => void) | null = null;
    afterEach(() => stop?.());

    it('hears a deal save raised through MJGlobal, and nothing after it stops', () => {
        const heard: DealSave[] = [];
        stop = WatchDealSaves((save) => heard.push(save));
        const deal = entity(MJS_ENTITIES.Deal, { ID: 'DEAL-1' });

        MJGlobal.Instance.RaiseEvent(saveEvent(deal));
        expect(heard.map((s) => s.DealID)).toEqual(['DEAL-1']);

        stop();
        MJGlobal.Instance.RaiseEvent(saveEvent(deal));
        expect(heard, 'a destroyed surface must not keep re-reading').toHaveLength(1);
    });
});
