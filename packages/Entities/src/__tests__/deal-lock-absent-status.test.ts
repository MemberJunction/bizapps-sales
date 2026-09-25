import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * bizapps-sales#103 — the form's answer for a deal whose status row is absent.
 *
 * `DealEntityServer.checkCloseLock` locks that deal with the ordinary editable set of a deal that is
 * not lost. `ResolveDealLockState` must say the same, or every surface built on it offers fields the
 * server then refuses.
 */

let results: { Success: boolean; Results: unknown[] };

vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        RunView: class {
            async RunView() {
                return results;
            }
        },
    };
});

const { ResolveDealLockState } = await import('../close-lock');

describe('ResolveDealLockState on a status row that is absent', () => {
    beforeEach(() => {
        results = { Success: true, Results: [] };
    });

    it('reports the deal as locked, as the server does', async () => {
        const lock = await ResolveDealLockState('aaaaaaaa-0000-4000-8000-00000000dead');

        expect(lock.IsLocked).toBe(true);
        expect(lock.IsLost, 'nothing says the deal was lost, so Loss Notes stays frozen').toBe(false);
        expect(lock.IsWon).toBe(false);
    });

    it('says why, and names the way out', async () => {
        const lock = await ResolveDealLockState('aaaaaaaa-0000-4000-8000-00000000dead');

        expect(lock.Notice).toContain('could not be found');
        expect(lock.Notice).toContain('Deal Status');
        expect(lock.Notice).toContain('set the status to an open one');
    });

    it('still reports a status row that exists and does not lock as open', async () => {
        results = { Success: true, Results: [{ LocksDeal: false, Name: 'Open', IsLost: false, IsWon: false }] };
        expect((await ResolveDealLockState('aaaaaaaa-0000-4000-8000-000000000001')).IsLocked).toBe(false);
    });
});
