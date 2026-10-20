import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * THE CLOSE STAMPS ARE WRITTEN BY THE CLOSE AND THE REOPEN, AND BY NOTHING ELSE (#252).
 *
 * Every surface that asks "has this deal closed?" reads `ClosedAt` / `ActualCloseDate`. A rep who
 * typed a future day into Actual Close Date on an open deal made the header read "Closed", and the
 * save went through because nothing refused it on a deal that was not yet locked.
 *
 * `Object.create` holds the server entity without standing up metadata, as `MissingPartyRefusal` does.
 */

type Harness = {
    closeStampEditRefusal(): string | null;
    BeginClose<T>(body: () => Promise<T>): Promise<T>;
    BeginReopen<T>(body: () => Promise<T>): Promise<T>;
};

function deal(opts: { saved: boolean; values?: Record<string, unknown>; dirty?: string[] }): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const values = opts.values ?? {};
    const dirty = new Set(opts.dirty ?? []);
    for (const [k, v] of Object.entries({
        IsSaved: opts.saved,
        GetFieldByName: (name: string) => ({ Dirty: dirty.has(name), Value: values[name] ?? null }),
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    return instance;
}

describe('a save that writes a close stamp outside the close or the reopen', () => {
    it('refuses Actual Close Date typed onto an open deal, and points at Expected Close Date', () => {
        const d = deal({ saved: true, values: { ActualCloseDate: '2026-11-30' }, dirty: ['ActualCloseDate'] });
        const refusal = d.closeStampEditRefusal();

        expect(refusal).toContain('Actual Close Date');
        expect(refusal).toContain('Expected Close Date');
        expect(refusal).toContain('Nothing was changed');
    });

    it('names every stamp the save touched, by its on-screen label', () => {
        const d = deal({
            saved: true,
            values: { ClosedAt: '2026-11-30T15:00:00Z', ClosedByUserID: 'u1' },
            dirty: ['ClosedAt', 'ClosedByUserID'],
        });
        const refusal = d.closeStampEditRefusal();

        expect(refusal).toContain('Closed At and Closed By');
        expect(refusal).not.toContain('ClosedByUserID');
    });

    it('refuses a CLEARED stamp too: wiping a close is as much a rewrite as inventing one', () => {
        const d = deal({ saved: true, values: { ActualCloseDate: null }, dirty: ['ActualCloseDate'] });
        expect(d.closeStampEditRefusal()).toContain('Actual Close Date');
    });

    it('refuses a deal CREATED with a stamp, where Dirty would say nothing was supplied', () => {
        const d = deal({ saved: false, values: { ActualCloseDate: '2026-11-30' } });
        expect(d.closeStampEditRefusal()).toContain('Actual Close Date');
    });

    it('lets a stamp already on disk ride along with an unrelated edit', () => {
        const d = deal({ saved: true, values: { ActualCloseDate: '2026-09-30' }, dirty: ['NextStep'] });
        expect(d.closeStampEditRefusal()).toBeNull();
    });

    it('lets a new deal with no stamps through', () => {
        expect(deal({ saved: false }).closeStampEditRefusal()).toBeNull();
    });
});

describe('the two paths that may write the stamps', () => {
    const stamped = (): Harness =>
        deal({ saved: true, values: { ActualCloseDate: '2026-11-30' }, dirty: ['ActualCloseDate'] });

    it('the close may write them, and only for the length of the call', async () => {
        const d = stamped();
        const inside = await d.BeginClose(async () => d.closeStampEditRefusal());

        expect(inside).toBeNull();
        expect(d.closeStampEditRefusal(), 'the permission must not outlive the close').not.toBeNull();
    });

    it('the reopen may clear them', async () => {
        const d = stamped();
        expect(await d.BeginReopen(async () => d.closeStampEditRefusal())).toBeNull();
    });

    it('a close that throws still takes the permission away', async () => {
        const d = stamped();
        await expect(d.BeginClose(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
        expect(d.closeStampEditRefusal()).not.toBeNull();
    });
});
