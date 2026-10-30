/**
 * A stage event is appended once and never changed or deleted (#348).
 *
 * `DealStageEventEntityServer` lets an insert through, refuses an update and refuses a delete, each with
 * the shared append-only message. The insert case is the one `DealEntityServer.appendStageEvent` takes:
 * a new record saved once.
 *
 * `Object.create` holds the server entity without standing up metadata, the way
 * `PipelineKeepsClosingStages` does. It does not run the constructor, so everything the class reads is
 * shadowed below.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseEntity, BaseEntityResult } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE,
    mjBizAppsSalesDealStageEventEntity,
} from '@mj-biz-apps/sales-entities';

import { DealStageEventEntityServer } from '../DealStageEventEntityServer.js';

/** A stage event row, persisted (`IsSaved`) or new, recording the result history it registers. */
function eventRow(isSaved: boolean) {
    const history: BaseEntityResult[] = [];
    const row = Object.create(DealStageEventEntityServer.prototype) as DealStageEventEntityServer;
    const define = (name: string, value: unknown) => Object.defineProperty(row, name, { value, writable: true });
    define('IsSaved', isSaved);
    define('Fields', []);
    define('RegisterResultHistoryEntry', (r: BaseEntityResult) => history.push(r));
    return { row, history };
}

describe('a deal stage event', () => {
    afterEach(() => vi.restoreAllMocks());

    it('is inserted: a new record goes through to the base save', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealStageEventEntity.prototype, 'Save').mockResolvedValue(true);
        const { row, history } = eventRow(false);
        expect(await row.Save()).toBe(true);
        expect(save).toHaveBeenCalledOnce();
        expect(history).toHaveLength(0);
    });

    it('refuses an update, with the append-only message, without reaching the base save', async () => {
        const save = vi.spyOn(mjBizAppsSalesDealStageEventEntity.prototype, 'Save').mockResolvedValue(true);
        const { row, history } = eventRow(true);
        expect(await row.Save()).toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(history).toHaveLength(1);
        expect(history[0].Success).toBe(false);
        expect(history[0].Type).toBe('update');
        expect(history[0].Message).toBe(DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE);
    });

    it('refuses a delete, with the append-only message, without reaching the base delete', async () => {
        const del = vi.spyOn(mjBizAppsSalesDealStageEventEntity.prototype, 'Delete').mockResolvedValue(true);
        const { row, history } = eventRow(true);
        expect(await row.Delete()).toBe(false);
        expect(del).not.toHaveBeenCalled();
        expect(history).toHaveLength(1);
        expect(history[0].Type).toBe('delete');
        expect(history[0].Message).toBe(DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE);
    });

    it('is the class ClassFactory resolves for the entity', () => {
        const registration = MJGlobal.Instance.ClassFactory.GetRegistration(
            BaseEntity,
            'MJ_BizApps_Sales: Deal Stage Events',
        );
        expect(registration?.SubClass).toBe(DealStageEventEntityServer);
    });
});
