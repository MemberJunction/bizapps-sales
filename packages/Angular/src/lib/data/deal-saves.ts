/**
 * @fileoverview Deal saves made anywhere in this browser, as one stream (bc-aidp-next-golive#419).
 *
 * A deal can be saved from several places that hold their OWN copy of it: the board's stage move loads
 * and saves a fresh `DealEntity`, the deal form saves the one it opened, and an owner change saves the
 * deal through its team. None of those copies knows about the others, so a surface showing a deal kept
 * the values it read before the save -- a reopened deal tab showed the old stage, and the board showed
 * the old owner -- until the browser was refreshed.
 *
 * MJ already broadcasts every `BaseEntity` save through `MJGlobal`'s event stream. This module filters
 * that stream down to the saves Sales cares about, so a surface subscribes to "a deal changed" rather
 * than re-deriving the event shape. Saves made in another browser or by the server do not pass through
 * here; a refresh still picks those up.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { BaseEntity, type BaseEntityEvent } from '@memberjunction/core';
import { MJEventType, MJGlobal, type MJEvent } from '@memberjunction/global';

import { MJS_ENTITIES } from './entity-names';

/** One saved deal, or one saved row of a deal's team, and the instance that saved it. */
export interface DealSave {
    EntityName: string;
    /** The deal the save belongs to: the deal's own ID, or a team row's `DealID`. */
    DealID: string;
    /** The instance that ran the save, so a surface can ignore its own. */
    Record: BaseEntity;
}

/** Where each watched entity keeps the ID of the deal it belongs to. */
const DEAL_ID_FIELD: Readonly<Record<string, string>> = {
    [MJS_ENTITIES.Deal]: 'ID',
    [MJS_ENTITIES.DealTeamMember]: 'DealID',
};

/**
 * The deal save an MJ event carries, or null when it carries none.
 *
 * Only a completed save counts: `save_started` fires before the write and the save may still fail.
 */
export function DealSaveOf(event: MJEvent): DealSave | null {
    if (event.event !== MJEventType.ComponentEvent || event.eventCode !== BaseEntity.BaseEventCode) {
        return null;
    }
    const args = event.args as BaseEntityEvent | null | undefined;
    const record = args?.baseEntity;
    if (args?.type !== 'save' || !record) {
        return null;
    }
    const entityName = record.EntityInfo?.Name ?? '';
    const idField = DEAL_ID_FIELD[entityName];
    const dealID = idField ? record.Get(idField) : null;
    return dealID ? { EntityName: entityName, DealID: String(dealID), Record: record } : null;
}

/** Whether two IDs name the same row; SQL Server returns GUIDs upper-case, the URL may not. */
export function SameDealID(a: string | null | undefined, b: string | null | undefined): boolean {
    return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/**
 * Calls `onSave` for every deal save from now on. Returns the unsubscribe, which the caller must run
 * when it is destroyed: the stream is app-wide and would otherwise keep a closed tab alive.
 */
export function WatchDealSaves(onSave: (save: DealSave) => void): () => void {
    const subscription = MJGlobal.Instance.GetEventListener(false).subscribe((event) => {
        const save = DealSaveOf(event);
        if (save) {
            onSave(save);
        }
    });
    return () => subscription.unsubscribe();
}
