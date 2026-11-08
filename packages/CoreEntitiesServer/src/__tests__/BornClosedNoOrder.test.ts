import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A DEAL CREATED ALREADY WON OR LOST GETS NO EMPTY ORDER (bizapps-sales#152).
 *
 * The close lock reads the persisted status, which a create does not have, so a deal born closed used
 * to pass as unlocked and get an empty Draft order. The incoming status now decides, on a create only.
 *
 * `Object.create` holds the server entity without standing up metadata, as `AbsentStatusLock` does.
 */

const OPEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const WON = 'aaaaaaaa-0000-4000-8000-000000000002';
const LOST = 'aaaaaaaa-0000-4000-8000-000000000003';

type Row = { LocksDeal: boolean; IsLost: boolean };
const ROWS: Record<string, Row> = {
    [OPEN]: { LocksDeal: false, IsLost: false },
    [WON]: { LocksDeal: true, IsLost: false },
    [LOST]: { LocksDeal: true, IsLost: true },
};

type Harness = { isBornClosedWithoutOrder(): Promise<boolean>; Reads: number };

function deal(opts: { saved: boolean; status: string | null; order?: object; readFails?: boolean }): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    let reads = 0;
    const provider = {
        RunView: async ({ ExtraFilter }: { ExtraFilter: string }) => {
            reads++;
            if (opts.readFails) {
                return { Success: false, ErrorMessage: 'connection reset', Results: [] };
            }
            const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
            const row = ROWS[id];
            return { Success: true, Results: row ? [{ ID: id, ...row }] : [] };
        },
    };
    for (const [k, v] of Object.entries({
        IsSaved: opts.saved,
        DealStatusTypeID: opts.status,
        OrderID_Object: opts.order ?? null,
        ContextCurrentUser: { ID: 'u1' },
        ProviderToUse: provider,
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    Object.defineProperty(instance, 'Reads', { get: () => reads });
    return instance;
}

describe('provisioning on a deal created in a locking status', () => {
    it('skips the order for a deal created Won', async () => {
        expect(await deal({ saved: false, status: WON }).isBornClosedWithoutOrder()).toBe(true);
    });

    it('skips the order for a deal created Lost', async () => {
        expect(await deal({ saved: false, status: LOST }).isBornClosedWithoutOrder()).toBe(true);
    });

    it('keeps the order for a deal created Open', async () => {
        expect(await deal({ saved: false, status: OPEN }).isBornClosedWithoutOrder()).toBe(false);
    });

    it('keeps the order for a create with no status, which defaults to an open one', async () => {
        const d = deal({ saved: false, status: null });
        expect(await d.isBornClosedWithoutOrder()).toBe(false);
        expect(d.Reads).toBe(0);
    });

    it('still provisions an order the caller built before the first save', async () => {
        // Lines added for this save reach the order first; skipping its stamps would fail the insert.
        const d = deal({ saved: false, status: WON, order: { IsSaved: false } });
        expect(await d.isBornClosedWithoutOrder()).toBe(false);
        expect(d.Reads).toBe(0);
    });

    it('leaves an update to the close lock, without reading the status', async () => {
        const d = deal({ saved: true, status: WON });
        expect(await d.isBornClosedWithoutOrder()).toBe(false);
        expect(d.Reads).toBe(0);
    });

    it('skips the order when the status cannot be read', async () => {
        expect(await deal({ saved: false, status: WON, readFails: true }).isBornClosedWithoutOrder()).toBe(true);
    });
});
