/**
 * A pipeline keeps its last active won stage and its last active lost stage (bc-aidp-next-golive#345).
 *
 * `PipelineStageEntityServer` refuses a stage save or delete that would take away the pipeline's last
 * active stage for an outcome, and lets everything else through, including edits on a pipeline that
 * never had such a stage. The reads go through the provider's `RunView`, answered here from in-memory
 * rows so each case states the pipeline it depends on.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mjBizAppsSalesPipelineStageEntity } from '@mj-biz-apps/sales-entities';

import { PipelineStageEntityServer } from '../PipelineStageEntityServer.js';

interface Stage {
    ID: string;
    PipelineID: string;
    DealStatusTypeID: string | null;
    IsActive: boolean;
}

const STATUSES = [
    { ID: 'st-open', IsWon: false, IsLost: false },
    { ID: 'st-won', IsWon: true, IsLost: false },
    { ID: 'st-lost', IsWon: false, IsLost: true },
    { ID: 'st-abandoned', IsWon: false, IsLost: true },
];

/** The rows a `RunView` filter selects. Handles exactly the filters the class writes. */
function select(entity: string, filter: string, stages: Stage[]): Record<string, unknown>[] {
    if (entity.endsWith('Deal Status Types')) {
        if (filter === 'IsWon = 1') return STATUSES.filter((s) => s.IsWon);
        if (filter === 'IsLost = 1') return STATUSES.filter((s) => s.IsLost);
        const ids = [...filter.matchAll(/'([^']+)'/g)].map((m) => m[1]);
        return STATUSES.filter((s) => ids.includes(s.ID));
    }
    const pipeline = /PipelineID = '([^']+)'/.exec(filter)?.[1];
    const notID = /ID <> '([^']+)'/.exec(filter)?.[1];
    const statusIDs = [...(/DealStatusTypeID IN \(([^)]*)\)/.exec(filter)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
        (m) => m[1],
    );
    return stages.filter(
        (s) => s.PipelineID === pipeline && s.IsActive && s.ID !== notID && statusIDs.includes(s.DealStatusTypeID ?? ''),
    );
}

/** A persisted stage row, as it was loaded (`was`) and as the caller has edited it (`now`). */
function stageRow(was: Stage, now: Partial<Stage>, others: Stage[]) {
    const all = [was, ...others];
    const current = { ...was, ...now };
    const row = Object.create(PipelineStageEntityServer.prototype) as PipelineStageEntityServer;
    const define = (name: string, value: unknown) => Object.defineProperty(row, name, { value, writable: true });
    define('ID', was.ID);
    define('PipelineID', current.PipelineID);
    define('DealStatusTypeID', current.DealStatusTypeID);
    define('IsActive', current.IsActive);
    define('Pipeline', 'Direct');
    define('IsSaved', true);
    define('ContextCurrentUser', { ID: 'u1' });
    define('Fields', []);
    define('RegisterResultHistoryEntry', () => undefined);
    define('GetFieldByName', (name: string) => ({ OldValue: (was as unknown as Record<string, unknown>)[name] }));
    define('ProviderToUse', {
        RunView: async (p: { EntityName: string; ExtraFilter: string }) => ({
            Success: true,
            Results: select(p.EntityName, p.ExtraFilter, all),
        }),
    });
    return row;
}

const WON = { ID: 'won', PipelineID: 'p1', DealStatusTypeID: 'st-won', IsActive: true };
const LOST = { ID: 'lost', PipelineID: 'p1', DealStatusTypeID: 'st-lost', IsActive: true };
const OPEN = { ID: 'open', PipelineID: 'p1', DealStatusTypeID: 'st-open', IsActive: true };

describe('a stage save that would take away the pipeline\'s last closing stage', () => {
    afterEach(() => vi.restoreAllMocks());

    function spySave() {
        return vi.spyOn(mjBizAppsSalesPipelineStageEntity.prototype, 'Save').mockResolvedValue(true);
    }

    it('refuses deactivating the only won stage, and names the pipeline and the outcome', async () => {
        const save = spySave();
        const row = stageRow(WON, { IsActive: false }, [LOST, OPEN]);
        expect(await row.Save()).toBe(false);
        expect(save).not.toHaveBeenCalled();
        const message = await row.closingStageRefusal(
            { PipelineID: 'p1', DealStatusTypeID: 'st-won', IsActive: true },
            { PipelineID: 'p1', DealStatusTypeID: 'st-won', IsActive: false },
        );
        expect(message).toContain('Direct pipeline with no active won stage');
    });

    it('refuses giving the only lost stage an open status', async () => {
        spySave();
        expect(await stageRow(LOST, { DealStatusTypeID: 'st-open' }, [WON, OPEN]).Save()).toBe(false);
    });

    it('refuses moving the only won stage to another pipeline', async () => {
        spySave();
        expect(await stageRow(WON, { PipelineID: 'p2' }, [LOST, OPEN]).Save()).toBe(false);
    });

    it('allows it when another active stage declares the same outcome, even under another status', async () => {
        const save = spySave();
        const abandoned = { ID: 'abandoned', PipelineID: 'p1', DealStatusTypeID: 'st-abandoned', IsActive: true };
        expect(await stageRow(LOST, { IsActive: false }, [WON, abandoned]).Save()).toBe(true);
        expect(save).toHaveBeenCalledOnce();
    });

    it('does not count an INACTIVE second stage as the replacement', async () => {
        spySave();
        const retired = { ID: 'won-2', PipelineID: 'p1', DealStatusTypeID: 'st-won', IsActive: false };
        expect(await stageRow(WON, { IsActive: false }, [retired, LOST]).Save()).toBe(false);
    });

    it('does not count a won stage on ANOTHER pipeline', async () => {
        spySave();
        const elsewhere = { ID: 'won-p2', PipelineID: 'p2', DealStatusTypeID: 'st-won', IsActive: true };
        expect(await stageRow(WON, { IsActive: false }, [elsewhere, LOST]).Save()).toBe(false);
    });

    it('allows switching a won stage between two won statuses', async () => {
        spySave();
        const otherWon = { ID: 'st-won-2', IsWon: true, IsLost: false };
        STATUSES.push(otherWon);
        try {
            expect(await stageRow(WON, { DealStatusTypeID: 'st-won-2' }, [LOST]).Save()).toBe(true);
        } finally {
            STATUSES.pop();
        }
    });

    it('lets every edit through on a pipeline that never had a won or lost stage', async () => {
        spySave();
        expect(await stageRow(OPEN, { IsActive: false }, []).Save()).toBe(true);
    });

    it('lets an edit through that keeps the stage a closing stage (renaming, guidance, probability)', async () => {
        spySave();
        expect(await stageRow(WON, {}, [LOST]).Save()).toBe(true);
    });

    it('refuses deleting the only lost stage', async () => {
        const del = vi.spyOn(mjBizAppsSalesPipelineStageEntity.prototype, 'Delete').mockResolvedValue(true);
        expect(await stageRow(LOST, {}, [WON]).Delete()).toBe(false);
        expect(del).not.toHaveBeenCalled();
    });

    it('fails closed, with a message about the check, when a read fails', async () => {
        spySave();
        const row = stageRow(WON, { IsActive: false }, [LOST]);
        Object.defineProperty(row, 'ProviderToUse', {
            value: { RunView: async () => ({ Success: false, ErrorMessage: 'timeout', Results: [] }) },
        });
        expect(await row.Save()).toBe(false);
    });
});
