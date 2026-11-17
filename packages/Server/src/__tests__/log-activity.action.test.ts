/**
 * `Sales.LogActivity` runs for any signed-in user through `RunAction`, so it makes its own access
 * decision: the caller must be able to read the deal before anything is written.
 *
 * The writer and the deal read are stubbed; the writer's own behaviour is proved in
 * sales-core-entities-server.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunActionParams } from '@memberjunction/actions-base';

const logActivity = vi.fn();
const runView = vi.fn();
const runViews = vi.fn();
vi.mock('@mj-biz-apps/sales-core-entities-server', () => ({
    ActivityWriterService: class {
        LogActivity = logActivity;
    },
}));
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        Metadata: { Provider: {} },
        RunView: class {
            RunView = runView;
            RunViews = runViews;
        },
    };
});

const { LogActivityAction } = await import('../custom/log-activity.action.js');

const DEAL_ID = '11111111-2222-4333-8444-555555555555';

/** Exposes the protected entry point without widening the class. */
class Harness extends LogActivityAction {
    public Run(params: RunActionParams) {
        return this.InternalRunAction(params);
    }
}

function params(dealID: string = DEAL_ID): RunActionParams {
    return {
        Params: [
            { Name: 'DealID', Value: dealID, Type: 'Input' },
            { Name: 'TypeCode', Value: 'Note', Type: 'Input' },
            { Name: 'Title', Value: 'Confirmed intent to move', Type: 'Input' },
        ],
        ContextUser: { ID: 'user-1' },
    } as never;
}

afterEach(() => {
    logActivity.mockReset();
    runView.mockReset();
    runViews.mockReset();
});

describe('who may run it', () => {
    it('authorizes its caller itself, so RunAction does not limit it to Owners', () => {
        expect(LogActivityAction.AuthorizesCaller).toBe(true);
    });

    it('refuses a deal the caller cannot see, and writes nothing', async () => {
        runView.mockResolvedValue({ Success: true, Results: [] });
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'NOT_FOUND' });
        expect(logActivity).not.toHaveBeenCalled();
    });

    it('refuses when the deal read fails', async () => {
        runView.mockResolvedValue({ Success: false, Results: [] });
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'NOT_FOUND' });
        expect(logActivity).not.toHaveBeenCalled();
    });

    it('refuses a deal ID that is not a UUID, before reading anything', async () => {
        const result = await new Harness().Run(params("x' OR 1=1 --"));
        expect(result).toMatchObject({ Success: false, ResultCode: 'BAD_INPUT' });
        expect(runView).not.toHaveBeenCalled();
    });

    it('reads the deal as the caller and logs the activity', async () => {
        runView.mockResolvedValue({ Success: true, Results: [{ ID: DEAL_ID }] });
        logActivity.mockResolvedValue({ Success: true, ActivityID: 'a-1', LinkCount: 3, Issues: [] });
        const p = params();
        const result = await new Harness().Run(p);
        expect(result).toMatchObject({ Success: true, ResultCode: 'SUCCESS' });
        expect(runView.mock.calls[0][1]).toBe(p.ContextUser);
        expect(logActivity.mock.calls[0][2]).toBe(p.ContextUser);
    });
});

const PERSON = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORG = 'bbbbbbbb-0000-4000-8000-000000000002';

function withParties(value: unknown): RunActionParams {
    const p = params();
    p.Params.push({ Name: 'Parties', Value: value, Type: 'Input' } as never);
    return p;
}

/** The deal is readable, and the people/organizations read returns these IDs. */
function readable(people: string[], orgs: string[]): void {
    runView.mockResolvedValue({ Success: true, Results: [{ ID: DEAL_ID }] });
    runViews.mockResolvedValue([
        { Success: true, Results: people.map((ID) => ({ ID: ID.toUpperCase() })) },
        { Success: true, Results: orgs.map((ID) => ({ ID })) },
    ]);
    logActivity.mockResolvedValue({ Success: true, ActivityID: 'a-1', LinkCount: 2, Issues: [] });
}

describe('who gets linked (#408)', () => {
    it('with no Parties param, the service picks the deal parties exactly as before', async () => {
        readable([], []);
        await new Harness().Run(params());
        expect(logActivity.mock.calls[0][0]).toMatchObject({ IncludeDealParties: true, Parties: undefined });
        expect(runViews).not.toHaveBeenCalled();
    });

    it('with Parties, links exactly those, so an unticked primary contact is not linked', async () => {
        readable([PERSON], [ORG]);
        const parties = [{ Kind: 'Person', RecordID: PERSON }, { Kind: 'Organization', RecordID: ORG }];
        const result = await new Harness().Run(withParties(JSON.stringify(parties)));
        expect(result).toMatchObject({ Success: true });
        expect(logActivity.mock.calls[0][0]).toMatchObject({
            IncludeDealParties: false,
            Parties: parties.map((p) => ({ ...p, Role: 'Participant' })),
        });
    });

    it('an empty list is a choice: only the deal is linked', async () => {
        readable([], []);
        await new Harness().Run(withParties('[]'));
        expect(logActivity.mock.calls[0][0]).toMatchObject({ IncludeDealParties: false, Parties: [] });
    });

    it.each([
        ['not JSON', '{oops'],
        ['not a list', '{"Kind":"Person"}'],
        ['an unknown kind', JSON.stringify([{ Kind: 'Deal', RecordID: PERSON }])],
        ['a malformed ID', JSON.stringify([{ Kind: 'Person', RecordID: "x' OR 1=1 --" }])],
        ['too many entries', JSON.stringify(Array.from({ length: 51 }, () => ({ Kind: 'Person', RecordID: PERSON })))],
    ])('refuses %s as BAD_INPUT before reading anything', async (_label, value) => {
        const result = await new Harness().Run(withParties(value));
        expect(result).toMatchObject({ Success: false, ResultCode: 'BAD_INPUT' });
        expect(runView).not.toHaveBeenCalled();
        expect(logActivity).not.toHaveBeenCalled();
    });

    it('refuses a party the caller cannot read, naming it, and writes nothing', async () => {
        readable([PERSON], []);
        const result = await new Harness().Run(withParties(JSON.stringify([
            { Kind: 'Person', RecordID: PERSON },
            { Kind: 'Organization', RecordID: ORG },
        ])));
        expect(result).toMatchObject({ Success: false, ResultCode: 'NOT_FOUND' });
        expect(result.Message).toContain(ORG);
        expect(logActivity).not.toHaveBeenCalled();
    });

    it('does not accept a person ID sent as an organization', async () => {
        readable([PERSON], []);
        const result = await new Harness().Run(withParties(JSON.stringify([{ Kind: 'Organization', RecordID: PERSON }])));
        expect(result).toMatchObject({ Success: false, ResultCode: 'NOT_FOUND' });
        expect(logActivity).not.toHaveBeenCalled();
    });
});
