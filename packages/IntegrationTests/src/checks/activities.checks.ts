/**
 * @fileoverview `activities` — AC1–AC11. S-US9 (#119) and the ingest pipeline behind S-US10 (#120).
 *
 * Every assertion reads what COMMON wrote, through common's entities, rather than trusting the result
 * object a service returned. A writer that reports `Success: true` and writes nothing is the failure
 * these exist for.
 *
 * ── WHAT THESE PROVE, AND THE ONE THING THEY CANNOT ─────────────────────────────────────────────
 *
 * The ingest is written against `IActivitySource`, so a fixture source hands over exactly the type the
 * Graph source hands over. That means these checks drive the REAL filter, the REAL deal matcher, the REAL
 * writer and the REAL dedupe — not a parallel path. The single claim left unproven is whether Graph's
 * payload maps onto `NormalizedItem` correctly, which lives in `MSGraphActivitySource.mapMessage` and
 * needs a scoped mailbox to settle.
 *
 * ⚠️ **REQUIRES bizapps-common**, and refuses to run without it rather than passing vacuously.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView, type IMetadataProvider } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import {
    ActivityIngestService,
    ActivityReader,
    ActivityWriterService,
    FixtureActivitySource,
    MSGraphActivitySource,
    RelevanceFilter,
    type NormalizedItem,
} from '@mj-biz-apps/sales-core-entities-server';
import type {
    mjBizAppsCommonActivitySyncConnectionEntity,
    mjBizAppsCommonActivityTypeEntity,
    mjBizAppsCommonContactMethodEntity,
} from '@mj-biz-apps/common-entities';

import { InRolledBackTransaction, ProviderOf, TxOne } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_ACTIVITY = 'MJ_BizApps_Common: Activities';
const E_ACTIVITY_LINK = 'MJ_BizApps_Common: Activity Links';
const E_ACTIVITY_TYPE = 'MJ_BizApps_Common: Activity Types';
const E_CONTACT_METHOD = 'MJ_BizApps_Common: Contact Methods';
const E_CONTACT_TYPE = 'MJ_BizApps_Common: Contact Types';
const E_SYNC_CONNECTION = 'MJ_BizApps_Common: Activity Sync Connections';
const E_PERSON = 'MJ_BizApps_Common: People';
const E_ORGANIZATION = 'MJ_BizApps_Common: Organizations';
const E_DEAL = 'MJ_BizApps_Sales: Deals';

/** A fixed address, so a leaked row is traceable to this bundle rather than mistaken for real mail. */
const FIXTURE_ADDRESS = 'ac-fixture-contact@example.invalid';
const STRANGER_ADDRESS = 'ac-fixture-stranger@example.invalid';

function requireCommon(ctx: Ctx): void {
    Assert(
        !!ProviderOf(ctx).Entities.find((e) => e.Name === E_ACTIVITY),
        'bizapps-common activity entities are NOT registered on this host, so these checks cannot prove '
            + 'anything. (Reporting a pass here would be a vacuous one.)',
    );
}

async function rows(ctx: Ctx, entity: string, filter: string): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple' }, ctx.User);
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

function entityID(ctx: Ctx, name: string): string {
    const e = ProviderOf(ctx).Entities.find((x) => x.Name === name);
    Assert(!!e, `setup: entity '${name}' is not registered on this host`);
    return e!.ID;
}

interface DealFixture {
    DealID: string;
    AccountID: string;
    ContactID: string;
}

/**
 * An OPEN deal carrying both an account and a primary contact.
 *
 * Openness comes from the `IsOpen` FLAG, never a status name — and it has to be open because
 * `DealMatcher` deliberately refuses closed deals, so a closed fixture would make the attribution checks
 * fail for a reason they are not about.
 */
/** The open, active `DealStatusType` IDs as a quoted list. By FLAG, never by status name. */
async function openStatusList(ctx: Ctx): Promise<string> {
    const statuses = await rows(ctx, 'MJ_BizApps_Sales: Deal Status Types', 'IsOpen = 1 AND IsActive = 1');
    Assert(statuses.length > 0, 'setup: no open deal status on this host');
    return statuses.map((row) => `'${String(row['ID'])}'`).join(', ');
}

async function openDeal(ctx: Ctx): Promise<DealFixture> {
    const openIDs = await openStatusList(ctx);

    const deals = await rows(
        ctx,
        E_DEAL,
        `PrimaryContactID IS NOT NULL AND AccountID IS NOT NULL AND DealStatusTypeID IN (${openIDs})`,
    );
    Assert(deals.length > 0, 'setup: no OPEN deal with both an account and a primary contact on this host');
    return {
        DealID: String(deals[0]['ID']),
        AccountID: String(deals[0]['AccountID']),
        ContactID: String(deals[0]['PrimaryContactID']),
    };
}

/**
 * Gives the deal's contact a known email address, inside the transaction.
 *
 * `ContactMethod` is EMPTY on this host, so the relevance filter would match nothing and every ingest
 * check would pass for the wrong reason — a filter that rejects everything looks identical to a filter
 * that works. Creating the row is what makes the positive case testable.
 *
 * The `ContactType` is chosen arbitrarily and that is sound: `RelevanceFilter` matches on `Value` alone
 * and never reads the type. Picking "the Email one" by name would be a vocabulary comparison in service
 * of a value nothing reads.
 */
async function giveContactAnAddress(ctx: Ctx, personID: string): Promise<void> {
    const types = await rows(ctx, E_CONTACT_TYPE, 'ID IS NOT NULL');
    Assert(types.length > 0, 'setup: no ContactType rows on this host');

    const row = await ProviderOf(ctx).GetEntityObject<mjBizAppsCommonContactMethodEntity>(E_CONTACT_METHOD, ctx.User);
    row.NewRecord();
    row.PersonID = personID;
    row.ContactTypeID = String(types[0]['ID']);
    row.Value = FIXTURE_ADDRESS;
    row.IsPrimary = false;
    Assert(await row.Save(), `setup: the fixture contact method would not save — ${row.LatestResult?.CompleteMessage}`);
}

/** An `ActivitySyncConnection` the ingest can run against, inside the transaction. */
async function makeConnection(ctx: Ctx, lastSyncAt: Date | null): Promise<string> {
    const row = await ProviderOf(ctx).GetEntityObject<mjBizAppsCommonActivitySyncConnectionEntity>(
        E_SYNC_CONNECTION,
        ctx.User,
    );
    row.NewRecord();
    row.Name = 'AC fixture connection';
    row.Provider = 'Microsoft365';
    row.Status = 'Active';
    row.Direction = 'Inbound';
    row.OwnerUserID = ctx.User.ID;
    row.Mailbox = 'ac-fixture-mailbox@example.invalid';
    row.LastSyncAt = lastSyncAt;
    Assert(await row.Save(), `setup: the fixture connection would not save — ${row.LatestResult?.CompleteMessage}`);
    return row.ID;
}

/** One normalized item, as a source would hand it over. */
function item(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
    return {
        ExternalID: 'ac-fixture-msg-1',
        ExternalThreadID: 'ac-fixture-thread-1',
        TypeCode: 'Email',
        Subject: 'Re: the renewal numbers',
        Body: 'Fixture body. Never sent, never received.',
        StartedAt: new Date('2026-08-19T10:00:00.000Z'),
        EndedAt: null,
        Location: null,
        Direction: 'Inbound',
        Participants: [
            { Address: FIXTURE_ADDRESS, Name: 'Fixture Contact', Role: 'From' },
            { Address: STRANGER_ADDRESS, Name: null, Role: 'To' },
        ],
        Raw: { fixture: true },
        ...overrides,
    };
}

const writer = new ActivityWriterService();
const reader = new ActivityReader();
const ingest = new ActivityIngestService();

/** How many activities exist for a deal right now — the count idempotency is asserted against. */
async function activityCountForDeal(ctx: Ctx, dealID: string, provider: IMetadataProvider): Promise<number> {
    const dealEntity = provider.Entities.find((e) => e.Name === E_DEAL)?.ID ?? '';
    const links = await rows(ctx, E_ACTIVITY_LINK, `EntityID = '${dealEntity}' AND RecordID = '${dealID}'`);
    return new Set(links.map((l) => String(l['ActivityID']).toLowerCase())).size;
}

export const ActivitiesChecks: NamedCheck[] = [
    {
        Id: 'activities.AC1',
        Name: 'AC1: logging an activity writes ONE Activity and links it to the deal as Regarding',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);

                const out = await writer.LogActivity(
                    {
                        DealID: deal.DealID,
                        TypeCode: 'Call',
                        Title: 'AC1 discovery call',
                        StartedAt: new Date('2026-08-19T09:00:00.000Z'),
                    },
                    ProviderOf(ctx),
                    ctx.User,
                );
                Assert(out.Success, `the writer reported failure — ${out.Issues.join(' | ')}`);
                Assert(!!out.ActivityID, 'no activity ID was returned');

                // Read the ROW, not the result object.
                const [activity] = await rows(ctx, E_ACTIVITY, `ID = '${out.ActivityID}'`);
                Assert(!!activity, 'the reported activity ID does not resolve to a row');
                AssertEqual(String(activity['Title']), 'AC1 discovery call', 'the title round-trips');
                AssertEqual(String(activity['Source']), 'Manual', 'a hand-logged activity is Manual');
                Assert(
                    activity['ExternalID'] === null && activity['SourceSystem'] === null,
                    'a manual activity carries NEITHER half of the external key — CK_Activity_External',
                );

                const links = await rows(ctx, E_ACTIVITY_LINK, `ActivityID = '${out.ActivityID}'`);
                const anchor = links.find((l) => String(l['Role']) === 'Regarding');
                Assert(!!anchor, 'no Regarding link to the deal — the activity would be unreachable');
                AssertEqual(
                    String(anchor!['EntityID']).toLowerCase(),
                    entityID(ctx, E_DEAL).toLowerCase(),
                    'the anchor points at the DEAL entity',
                );
                AssertEqual(String(anchor!['RecordID']).toLowerCase(), deal.DealID.toLowerCase(), 'and at that deal');
            }),
    },
    {
        Id: 'activities.AC2',
        Name: 'AC2: the activity type is resolved by CODE — renaming the type does not break it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);

                /**
                 * THE VOCABULARY CLAIM, MADE TESTABLE. `Code` and `Name` are identical strings in the
                 * seed, so a lookup written against `Name` passes every ordinary test. Renaming the row
                 * inside the transaction separates them: a Code lookup still finds it, a Name lookup
                 * cannot.
                 */
                const [type] = await rows(ctx, E_ACTIVITY_TYPE, "Code = 'Note'");
                Assert(!!type, "setup: no ActivityType with Code 'Note' — bizapps-common seeds six");
                /**
                 * Renamed through the ENTITY, not raw SQL. `TxOne` reads a single row and an UPDATE
                 * returns none, so the raw route reported "TxOne returned no rows" — a helper misuse
                 * that looked exactly like a failed rename.
                 */
                const typeRow = await ProviderOf(ctx).GetEntityObject<mjBizAppsCommonActivityTypeEntity>(
                    E_ACTIVITY_TYPE,
                    ctx.User,
                );
                Assert(await typeRow.Load(String(type["ID"])), "setup: the activity type would not load");
                typeRow.Name = "renamed-by-AC2";
                Assert(await typeRow.Save(), `setup: the rename would not save — ${typeRow.LatestResult?.CompleteMessage}`);
                const out = await writer.LogActivity(
                    {
                        DealID: deal.DealID,
                        TypeCode: 'Note',
                        Title: 'AC2 note',
                        StartedAt: new Date('2026-08-19T09:30:00.000Z'),
                    },
                    ProviderOf(ctx),
                    ctx.User,
                );
                Assert(
                    out.Success,
                    'the type must still resolve after its display Name changed — this is what "by code" '
                        + `means. Issues: ${out.Issues.join(' | ')}`,
                );
                const [activity] = await rows(ctx, E_ACTIVITY, `ID = '${out.ActivityID}'`);
                AssertEqual(
                    String(activity['ActivityTypeID']).toLowerCase(),
                    String(type['ID']).toLowerCase(),
                    'and it is the row whose CODE was asked for',
                );
            }),
    },
    {
        Id: 'activities.AC3',
        Name: 'AC3: the deal parties are linked under COMMON entities, with the shared-PK ID unchanged',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);

                const out = await writer.LogActivity(
                    {
                        DealID: deal.DealID,
                        TypeCode: 'Call',
                        Title: 'AC3 call',
                        StartedAt: new Date('2026-08-19T11:00:00.000Z'),
                    },
                    ProviderOf(ctx),
                    ctx.User,
                );
                Assert(out.Success, `the writer reported failure — ${out.Issues.join(' | ')}`);

                const links = await rows(ctx, E_ACTIVITY_LINK, `ActivityID = '${out.ActivityID}'`);
                const person = links.find(
                    (l) => String(l['EntityID']).toLowerCase() === entityID(ctx, E_PERSON).toLowerCase(),
                );
                const org = links.find(
                    (l) => String(l['EntityID']).toLowerCase() === entityID(ctx, E_ORGANIZATION).toLowerCase(),
                );

                Assert(
                    !!person,
                    'the deal contact must be linked under MJ_BizApps_Common: People, not Sales Contacts — '
                        + 'the convention in activity-vocabulary.ts',
                );
                Assert(!!org, 'and the account under MJ_BizApps_Common: Organizations, not Sales Accounts');

                /**
                 * THE SHARED-PK CLAIM, ASSERTED RATHER THAN ASSUMED. `Deal.PrimaryContactID` is a
                 * `SalesContact` ID, and it is used VERBATIM as a `RecordID` under the People entity. If
                 * the PK were not shared this would point at nothing.
                 */
                AssertEqual(
                    String(person!['RecordID']).toLowerCase(),
                    deal.ContactID.toLowerCase(),
                    'Deal.PrimaryContactID crosses over unchanged — SalesContact.ID IS Person.ID',
                );
                AssertEqual(
                    String(org!['RecordID']).toLowerCase(),
                    deal.AccountID.toLowerCase(),
                    'and Deal.AccountID IS Organization.ID',
                );

                const people = await rows(ctx, E_PERSON, `ID = '${deal.ContactID}'`);
                AssertEqual(people.length, 1, 'and that ID really does resolve to a Person row');
            }),
    },
    {
        Id: 'activities.AC4',
        Name: 'AC4: an unknown participant becomes an identity link, not a stub Person',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);
                const peopleBefore = (await rows(ctx, E_PERSON, 'ID IS NOT NULL')).length;

                const out = await writer.LogActivity(
                    {
                        DealID: deal.DealID,
                        TypeCode: 'Email',
                        Title: 'AC4 mail with a stranger on it',
                        StartedAt: new Date('2026-08-19T12:00:00.000Z'),
                        IncludeDealParties: false,
                        UnresolvedParties: [{ Kind: 'Email', Value: STRANGER_ADDRESS, Role: 'To' }],
                    },
                    ProviderOf(ctx),
                    ctx.User,
                );
                Assert(out.Success, `the writer reported failure — ${out.Issues.join(' | ')}`);

                const links = await rows(ctx, E_ACTIVITY_LINK, `ActivityID = '${out.ActivityID}'`);
                const identity = links.find((l) => l['IdentityValue'] !== null);
                Assert(!!identity, 'the unknown address must be recorded as an identity link');
                AssertEqual(String(identity!['IdentityKind']), 'Email', 'as an Email identity');
                AssertEqual(String(identity!['IdentityValue']), STRANGER_ADDRESS, 'carrying the address');
                Assert(
                    identity!['EntityID'] === null && identity!['RecordID'] === null,
                    'and NEITHER record column — CK_ActivityLink_Target is an exclusive or',
                );

                const peopleAfter = (await rows(ctx, E_PERSON, 'ID IS NOT NULL')).length;
                AssertEqual(
                    peopleAfter,
                    peopleBefore,
                    'and NO Person was created — the common migration forbids auto-creating stubs',
                );
            }),
    },
    {
        Id: 'activities.AC5',
        Name: 'AC5: the reader returns a deal timeline newest-first, without the deal anchor as a party',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);

                const older = await writer.LogActivity(
                    { DealID: deal.DealID, TypeCode: 'Call', Title: 'AC5 older', StartedAt: new Date('2026-08-01T09:00:00.000Z') },
                    ProviderOf(ctx), ctx.User,
                );
                const newer = await writer.LogActivity(
                    { DealID: deal.DealID, TypeCode: 'Note', Title: 'AC5 newer', StartedAt: new Date('2026-08-18T09:00:00.000Z') },
                    ProviderOf(ctx), ctx.User,
                );
                Assert(older.Success && newer.Success, 'setup: both activities must be written');

                const timeline = await reader.TimelineForDeal(deal.DealID, ProviderOf(ctx), ctx.User);
                Assert(timeline.Success, `the reader failed — ${timeline.Issues.join(' | ')}`);

                const mine = timeline.Entries.filter((e) => e.Title.startsWith('AC5 '));
                AssertEqual(mine.length, 2, 'both activities appear on the deal');
                AssertEqual(mine[0].Title, 'AC5 newer', 'ordered by StartedAt DESCENDING — newest first');

                const entry = mine[0];
                Assert(
                    entry.Parties.every((p) => p.Kind !== 'Deal'),
                    'the Regarding link to the deal is NOT repeated as a party — it is how the row was found',
                );
                Assert(
                    entry.Parties.some((p) => p.Kind === 'Person'),
                    'and the deal contact does appear, as a Person',
                );
                AssertEqual(entry.TypeName, 'Note', 'the type NAME is resolved for display');
            }),
    },
    {
        Id: 'activities.AC6',
        Name: 'AC6: relevance is decided by an exact ContactMethod match, never by domain',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);
                await giveContactAnAddress(ctx, deal.ContactID);

                const verdicts = await new RelevanceFilter().Apply(
                    [
                        item({ ExternalID: 'ac6-known' }),
                        item({
                            ExternalID: 'ac6-unknown',
                            Participants: [
                                { Address: 'someone@example.invalid', Name: null, Role: 'From' },
                                { Address: STRANGER_ADDRESS, Name: null, Role: 'To' },
                            ],
                        }),
                    ],
                    ctx.User,
                );

                const known = verdicts.find((v) => v.Item.ExternalID === 'ac6-known');
                const unknown = verdicts.find((v) => v.Item.ExternalID === 'ac6-unknown');
                Assert(!!known?.IsRelevant, 'an item involving a stored contact method IS relevant');
                AssertEqual(known!.Matches.length, 1, 'exactly the one address that matched');
                AssertEqual(
                    String(known!.Matches[0].PersonID).toLowerCase(),
                    deal.ContactID.toLowerCase(),
                    'and it resolved to the person behind it',
                );
                Assert(
                    known!.Unmatched.includes(STRANGER_ADDRESS),
                    'while the unknown co-recipient is reported as unmatched rather than dropped',
                );

                Assert(
                    unknown!.IsRelevant === false,
                    'an item involving NOBODY known is not relevant — and both fixtures share the '
                        + 'example.invalid domain, so a domain rule would have captured this one too',
                );
            }),
    },
    {
        Id: 'activities.AC7',
        Name: 'AC7: an irrelevant batch writes NOTHING — the filter runs before any write',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);
                // Deliberately NO contact method: nothing in the batch is known.
                const connectionID = await makeConnection(ctx, null);
                const before = (await rows(ctx, E_ACTIVITY, 'ID IS NOT NULL')).length;

                const source = new FixtureActivitySource([item({ ExternalID: 'ac7-a' }), item({ ExternalID: 'ac7-b' })]);
                const run = await ingest.RunSync(connectionID, source, ProviderOf(ctx), ctx.User);

                Assert(run.Success, `the run failed — ${run.Issues.join(' | ')}`);
                AssertEqual(run.Fetched, 2, 'both items were fetched');
                AssertEqual(run.Relevant, 0, 'and neither was relevant');
                AssertEqual(run.Irrelevant, 2, 'both were discarded by the filter');
                AssertEqual(run.Written, 0, 'and nothing was written');

                const after = (await rows(ctx, E_ACTIVITY, 'ID IS NOT NULL')).length;
                AssertEqual(after, before, 'the Activity table did not move — personal mail never lands');
                AssertEqual(
                    await activityCountForDeal(ctx, deal.DealID, ProviderOf(ctx)),
                    0,
                    'and the deal gained no timeline entries',
                );
            }),
    },
    {
        Id: 'activities.AC8',
        Name: 'AC8: running the SAME batch twice writes once — idempotency on (SourceSystem, ExternalID)',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);
                await giveContactAnAddress(ctx, deal.ContactID);
                const connectionID = await makeConnection(ctx, null);

                const batch = [item({ ExternalID: 'ac8-msg-1' }), item({ ExternalID: 'ac8-msg-2', Subject: 'Second' })];

                const first = await ingest.RunSync(connectionID, new FixtureActivitySource(batch), ProviderOf(ctx), ctx.User);
                Assert(first.Success, `first run failed — ${first.Issues.join(' | ')}`);
                AssertEqual(first.Written, 2, 'the first run writes both items');
                AssertEqual(first.Duplicates, 0, 'and finds no duplicates');

                const countAfterFirst = await activityCountForDeal(ctx, deal.DealID, ProviderOf(ctx));
                AssertEqual(countAfterFirst, 2, 'two activities on the deal');

                /**
                 * THE SAME BATCH AGAIN, with the watermark deliberately reset to null so the source
                 * re-delivers everything. Otherwise the watermark would do the deduping and the unique key
                 * would never be exercised — a green check proving the wrong mechanism.
                 */
                const reset = await ProviderOf(ctx).GetEntityObject<mjBizAppsCommonActivitySyncConnectionEntity>(
                    E_SYNC_CONNECTION,
                    ctx.User,
                );
                Assert(await reset.Load(connectionID), 'setup: the connection would not reload');
                reset.LastSyncAt = null;
                Assert(await reset.Save(), 'setup: the watermark would not reset');

                const second = await ingest.RunSync(connectionID, new FixtureActivitySource(batch), ProviderOf(ctx), ctx.User);
                Assert(second.Success, `second run failed — ${second.Issues.join(' | ')}`);
                AssertEqual(second.Fetched, 2, 'the source re-delivered both items');
                AssertEqual(second.Written, 0, 'and NOTHING new was written');
                AssertEqual(second.Duplicates, 2, 'both were recognised as already present');

                AssertEqual(
                    await activityCountForDeal(ctx, deal.DealID, ProviderOf(ctx)),
                    countAfterFirst,
                    'THE ROW COUNT DID NOT MOVE — the claim S-US10 makes about repeated sync runs',
                );
            }),
    },
    {
        Id: 'activities.AC9',
        Name: 'AC9: the watermark advances to the newest item, and the next run fetches nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);
                await giveContactAnAddress(ctx, deal.ContactID);
                const connectionID = await makeConnection(ctx, null);

                const newest = new Date('2026-08-19T10:00:00.000Z');
                const batch = [
                    item({ ExternalID: 'ac9-old', StartedAt: new Date('2026-08-17T10:00:00.000Z') }),
                    item({ ExternalID: 'ac9-new', StartedAt: newest }),
                ];

                const first = await ingest.RunSync(connectionID, new FixtureActivitySource(batch), ProviderOf(ctx), ctx.User);
                Assert(first.Success, `first run failed — ${first.Issues.join(' | ')}`);
                Assert(!!first.WatermarkAdvancedTo, 'the watermark must advance on a successful run');
                AssertEqual(
                    first.WatermarkAdvancedTo!.toISOString(),
                    newest.toISOString(),
                    'to the newest item the SOURCE reported, not to the clock',
                );

                const [stored] = await rows(ctx, E_SYNC_CONNECTION, `ID = '${connectionID}'`);
                Assert(!!stored['LastSyncAt'], 'and it is persisted on the connection row');

                // A second run with the watermark in place: the source has nothing newer to give.
                const source = new FixtureActivitySource(batch);
                const second = await ingest.RunSync(connectionID, source, ProviderOf(ctx), ctx.User);
                Assert(second.Success, `second run failed — ${second.Issues.join(' | ')}`);
                AssertEqual(second.Fetched, 0, 'nothing was re-fetched — the watermark was passed down');
                AssertEqual(
                    source.Calls[0].Since?.toISOString(),
                    newest.toISOString(),
                    'and the source was asked for items strictly after it',
                );
            }),
    },
    {
        Id: 'activities.AC10',
        Name: 'AC10: a known contact on no open deal is reported, not filed and not invented',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                requireCommon(ctx);
                const deal = await openDeal(ctx);
                const connectionID = await makeConnection(ctx, null);

                /**
                 * A CONTACT METHOD ON SOMEBODY WHO IS ON NO OPEN DEAL. Built by pointing the fixture
                 * address at a Person the deal does not name, so the filter matches and the matcher does
                 * not — which is exactly the S-US10 no-deal-match case.
                 */
                /**
                 * A PERSON ON NO OPEN DEAL, which needs stating rather than assuming. Picking "any
                 * other Person" failed: this host has five open deals with contacts, so an arbitrary
                 * person is very likely to BE one of them, and the matcher correctly found a deal. The
                 * fixture has to exclude every party of every open deal for the no-match case to be the
                 * thing under test.
                 */
                const openIDs = await openStatusList(ctx);
                const openDeals = await rows(
                    ctx,
                    E_DEAL,
                    `DealStatusTypeID IN (${openIDs})`,
                );
                const taken = new Set(
                    openDeals
                        .flatMap((d) => [d["PrimaryContactID"], d["AccountID"]])
                        .filter(Boolean)
                        .map((v) => String(v).toLowerCase()),
                );
                const candidates = (await rows(ctx, E_PERSON, "ID IS NOT NULL")).filter(
                    (person) => !taken.has(String(person["ID"]).toLowerCase()),
                );
                Assert(
                    candidates.length > 0,
                    "setup: every Person on this host is a party to an open deal, so the no-match case "
                        + "cannot be constructed here",
                );
                await giveContactAnAddress(ctx, String(candidates[0]["ID"]));
                const before = (await rows(ctx, E_ACTIVITY, 'ID IS NOT NULL')).length;
                const run = await ingest.RunSync(
                    connectionID,
                    new FixtureActivitySource([item({ ExternalID: 'ac10-msg' })]),
                    ProviderOf(ctx),
                    ctx.User,
                );

                Assert(run.Success, `the run failed — ${run.Issues.join(' | ')}`);
                AssertEqual(run.Relevant, 1, 'the item IS relevant — a known contact is on it');
                AssertEqual(run.Unattributed, 1, 'but it matched no open deal');
                AssertEqual(run.Written, 0, 'so nothing was filed against a deal');
                AssertEqual(
                    (await rows(ctx, E_ACTIVITY, 'ID IS NOT NULL')).length,
                    before,
                    'and no activity row was invented to hold it',
                );
                Assert(
                    run.Issues.some((i) => i.includes('matches no open deal')),
                    `the run must SAY the item went unattributed — got ${JSON.stringify(run.Issues)}`,
                );
            }),
    },
    {
        Id: 'activities.AC11',
        Name: 'AC11: the Graph source refuses to read a mailbox unless explicitly allowed',
        RequiresMutation: false,
        Fn: async () => {
            /**
             * THE TENANT GATE, ASSERTED. `MSGraphProvider` uses app-only auth, so `Mail.Read` reaches every
             * mailbox in the tenant until an Exchange Application Access Policy scopes it. This check
             * exists so that removing the default-off gate breaks a test rather than reading a tenant.
             */
            const fetcher = {
                calls: 0,
                async GetMessages() {
                    this.calls++;
                    return { Success: true, Messages: [] };
                },
            };
            const source = new MSGraphActivitySource(fetcher);
            const batch = await source.Fetch({ Mailbox: 'anyone@example.invalid', Since: null, Limit: 10 });

            AssertEqual(fetcher.calls, 0, 'the provider must NOT be called while the gate is closed');
            AssertEqual(batch.Items.length, 0, 'and no items are returned');
            Assert(
                batch.Issues.some((i) => i.includes('Application Access Policy')),
                `the refusal must name the tenant policy, not a missing credential — got ${JSON.stringify(batch.Issues)}`,
            );
            Assert(source.IsLive, 'the Graph source still declares itself LIVE — the gate is not a fixture');
        },
    },
];

for (const check of ActivitiesChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('activities', {
    Setup: async () => {
        /* every check builds its own fixture inside a rolled-back transaction */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
