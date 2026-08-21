/**
 * @fileoverview `forecast` — FS1–FS8. The ForecastSnapshot scheduled job (#40).
 *
 * The measures come from MJ Queries another session is building; nothing named `%Forecast%` exists in
 * `MJ: Queries` yet. So these drive the REAL writer, the REAL re-run guard and the REAL period arithmetic
 * through a fixture source, exactly as the activity checks do for the mailbox. The one thing left
 * unproven is whether `QueryForecastSource.readRow` maps a real query's columns — which one run against a
 * landed query settles.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import {
    CurrentForecastSourceFactory,
    CurrentMonthPeriod,
    FixtureForecastSource,
    ForecastSnapshotJob,
    QueryForecastSource,
    RunForecastSnapshot,
    SetForecastSourceFactory,
    type ForecastMeasureRow,
} from '@mj-biz-apps/sales-core-entities-server';

import { InRolledBackTransaction, ProviderOf } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_SNAPSHOT = 'MJ_BizApps_Sales: Forecast Snapshots';
const E_DEAL = 'MJ_BizApps_Sales: Deals';

/** The seeded rows, from `metadata/`. Fixed there, so fixed here. */
const ID_FORECAST_ACTION = '5A1E5000-0000-4000-8000-000000000111';
const ID_FORECAST_JOB = '5A1E5000-0000-4000-8000-000000000202';

async function rows(ctx: Ctx, entity: string, filter: string): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple' }, ctx.User);
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** A real selling company. `ForecastSnapshot.CompanyID` is NOT NULL, so a fixture cannot invent one. */
async function anyCompanyID(ctx: Ctx): Promise<string> {
    const deals = await rows(ctx, E_DEAL, 'CompanyID IS NOT NULL');
    Assert(deals.length > 0, 'setup: no deal with a company on this host, so no snapshot can be filed');
    return String(deals[0]['CompanyID']);
}

/** A period well clear of any real data, so a leaked row is obviously this bundle's. */
const TEST_PERIOD = {
    PeriodStart: new Date(Date.UTC(2031, 0, 1)),
    PeriodEnd: new Date(Date.UTC(2031, 0, 31)),
};

function measure(companyID: string, overrides: Partial<ForecastMeasureRow> = {}): ForecastMeasureRow {
    return {
        CompanyID: companyID,
        PipelineID: null,
        OwnerEmployeeID: null,
        CommitAmount: 120000,
        BestCaseAmount: 180000,
        PipelineAmount: 400000,
        ClosedAmount: 65000,
        ...overrides,
    };
}

async function snapshotsFor(ctx: Ctx): Promise<Record<string, unknown>[]> {
    return rows(ctx, E_SNAPSHOT, `PeriodStart = '2031-01-01' AND PeriodEnd = '2031-01-31'`);
}

/**
 * A DATE column read back, as its UTC day.
 *
 * The provider returns a DATE as a `Date`, and `String(date).slice(0, 10)` gives LOCAL calendar text --
 * on a host at UTC-4 that renders 2031-01-01T00:00Z as "Tue Dec 31". The first version of FS2 did
 * exactly that and failed against a correctly-stored row: the assertion made the local-time mistake the
 * product code is careful to avoid. Worth keeping the note, because the check looked like it had found a
 * date-shift bug and had found its own.
 */
function utcDay(value: unknown): string {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
}

const job = new ForecastSnapshotJob();

export const ForecastChecks: NamedCheck[] = [
    {
        Id: 'forecast.FS1',
        Name: 'FS1: with NO source registered the run is a success that writes nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE DEFAULT, ASSERTED. The daily job ships Active, so the default factory returning null
                 * is what makes that safe. If somebody registers a real source as the default this goes red
                 * rather than the job quietly writing forecast numbers nobody asked for.
                 */
                const before = (await snapshotsFor(ctx)).length;
                const result = await RunForecastSnapshot(ProviderOf(ctx), ctx.User, new Date());

                Assert(result.Success, `the no-source run must succeed — ${result.Issues.join(' | ')}`);
                AssertEqual(result.Written, 0, 'and write nothing');
                AssertEqual(result.Period, null, 'and report no period, because it measured none');
                Assert(
                    result.Issues.some((i) => i.includes('no forecast source') || i.includes('No forecast source')),
                    `it must SAY why nothing happened — got ${JSON.stringify(result.Issues)}`,
                );
                AssertEqual((await snapshotsFor(ctx)).length, before, 'the table did not move');
            }),
    },
    {
        Id: 'forecast.FS2',
        Name: 'FS2: one snapshot per measure row, with the four amounts and the period stored verbatim',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const companyID = await anyCompanyID(ctx);
                const source = new FixtureForecastSource([measure(companyID)], 'FS2-fixture');

                const result = await job.Capture(TEST_PERIOD, source, ProviderOf(ctx), ctx.User);
                Assert(result.Success, `the capture failed — ${result.Issues.join(' | ')}`);
                AssertEqual(result.Measured, 1, 'one row was measured');
                AssertEqual(result.Written, 1, 'and one was written');

                const stored = await snapshotsFor(ctx);
                AssertEqual(stored.length, 1, 'exactly one snapshot row');
                const row = stored[0];

                AssertEqual(String(row['CompanyID']).toLowerCase(), companyID.toLowerCase(), 'the company');
                AssertEqual(Number(row['CommitAmount']), 120000, 'CommitAmount stored verbatim');
                AssertEqual(Number(row['BestCaseAmount']), 180000, 'BestCaseAmount');
                AssertEqual(Number(row['PipelineAmount']), 400000, 'PipelineAmount');
                AssertEqual(Number(row['ClosedAmount']), 65000, 'ClosedAmount');
                Assert(!!row['CapturedAt'], 'and CapturedAt is stamped — it is what makes this a series');

                /** The period is what the CALLER asked for, not derived from the clock. */
                AssertEqual(utcDay(row['PeriodStart']), '2031-01-01', 'the period start');
                AssertEqual(utcDay(row['PeriodEnd']), '2031-01-31', 'and end');
                AssertEqual(
                    source.Calls[0].PeriodStart.toISOString(),
                    TEST_PERIOD.PeriodStart.toISOString(),
                    'and the source was asked for that same window',
                );
            }),
    },
    {
        Id: 'forecast.FS3',
        Name: 'FS3: a second run the same day SKIPS rather than duplicating or overwriting',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const companyID = await anyCompanyID(ctx);

                const first = await job.Capture(
                    TEST_PERIOD,
                    new FixtureForecastSource([measure(companyID)], 'FS3-first'),
                    ProviderOf(ctx),
                    ctx.User,
                );
                AssertEqual(first.Written, 1, 'the first capture writes');

                /**
                 * A DIFFERENT FIGURE ON THE SECOND RUN, so the check can tell skipping from overwriting.
                 * Both look like "one row" from a count; only the stored amount distinguishes them, and
                 * overwriting a capture would be editing provenance.
                 */
                const second = await job.Capture(
                    TEST_PERIOD,
                    new FixtureForecastSource([measure(companyID, { CommitAmount: 999999 })], 'FS3-second'),
                    ProviderOf(ctx),
                    ctx.User,
                );
                Assert(second.Success, `the second capture failed — ${second.Issues.join(' | ')}`);
                AssertEqual(second.Measured, 1, 'it measured again');
                AssertEqual(second.Written, 0, 'but wrote nothing');
                AssertEqual(second.SkippedAsAlreadyCaptured, 1, 'reporting the grain as already captured');

                const stored = await snapshotsFor(ctx);
                AssertEqual(stored.length, 1, 'still exactly one row — no duplicate capture');
                AssertEqual(
                    Number(stored[0]['CommitAmount']),
                    120000,
                    'and the ORIGINAL figure survives — a capture is never overwritten, which is rule 3',
                );
            }),
    },
    {
        Id: 'forecast.FS4',
        Name: 'FS4: a different grain in the same period IS captured — the guard is per grain',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const companyID = await anyCompanyID(ctx);
                const pipelines = await rows(ctx, 'MJ_BizApps_Sales: Pipelines', 'IsActive = 1');
                Assert(pipelines.length > 0, 'setup: no active pipeline on this host');
                const pipelineID = String(pipelines[0]['ID']);

                /**
                 * COMPANY-WIDE AND PER-PIPELINE ARE DIFFERENT ROWS, not a duplicate. `PipelineID` is
                 * nullable and null means "across all pipelines" rather than "unknown", so both are
                 * meaningful for the same period — and a guard keyed on period alone would have thrown the
                 * second one away.
                 */
                const result = await job.Capture(
                    TEST_PERIOD,
                    new FixtureForecastSource(
                        [measure(companyID), measure(companyID, { PipelineID: pipelineID })],
                        'FS4-fixture',
                    ),
                    ProviderOf(ctx),
                    ctx.User,
                );
                Assert(result.Success, `the capture failed — ${result.Issues.join(' | ')}`);
                AssertEqual(result.Written, 2, 'both grains were captured');
                AssertEqual(result.SkippedAsAlreadyCaptured, 0, 'neither was mistaken for the other');

                const stored = await snapshotsFor(ctx);
                AssertEqual(stored.length, 2, 'two rows');
                Assert(
                    stored.some((r) => r['PipelineID'] === null),
                    'one company-wide',
                );
                Assert(
                    stored.some((r) => String(r['PipelineID'] ?? '').toLowerCase() === pipelineID.toLowerCase()),
                    'and one for the pipeline',
                );
            }),
    },
    {
        Id: 'forecast.FS5',
        Name: 'FS5: SnapshotJSON records which source produced the numbers, and whether it was live',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const companyID = await anyCompanyID(ctx);
                const result = await job.Capture(
                    TEST_PERIOD,
                    new FixtureForecastSource([measure(companyID)], 'FS5-named-fixture'),
                    ProviderOf(ctx),
                    ctx.User,
                );
                AssertEqual(result.Written, 1, 'one snapshot');

                const [row] = await snapshotsFor(ctx);
                Assert(!!row['SnapshotJSON'], 'SnapshotJSON must be populated');
                const provenance = JSON.parse(String(row['SnapshotJSON'])) as {
                    Source?: string;
                    SourceIsLive?: boolean;
                };

                AssertEqual(provenance.Source, 'FS5-named-fixture', 'naming the source');
                AssertEqual(
                    provenance.SourceIsLive,
                    false,
                    'and recording that it was NOT live — four amounts look identical whether a real query or '
                        + 'a fixture produced them, so this is the only thing that can tell them apart later',
                );
            }),
    },
    {
        Id: 'forecast.FS6',
        Name: 'FS6: a reversed period is refused by the job, before the CHECK constraint sees it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const companyID = await anyCompanyID(ctx);
                const source = new FixtureForecastSource([measure(companyID)], 'FS6-fixture');

                const result = await job.Capture(
                    { PeriodStart: TEST_PERIOD.PeriodEnd, PeriodEnd: TEST_PERIOD.PeriodStart },
                    source,
                    ProviderOf(ctx),
                    ctx.User,
                );

                Assert(result.Success === false, 'a reversed period must be refused');
                AssertEqual(result.Written, 0, 'and nothing written');
                AssertEqual(
                    source.Calls.length,
                    0,
                    'the SOURCE was never even asked — refusing before measuring means a bad window costs no '
                        + 'query',
                );
                Assert(
                    result.Issues.some((i) => i.includes('ends before it starts')),
                    `the reason must name the caller mistake, not the constraint — got ${JSON.stringify(result.Issues)}`,
                );
            }),
    },
    {
        Id: 'forecast.FS7',
        Name: 'FS7: the default period is the current calendar month, in UTC',
        RequiresMutation: false,
        Fn: async () => {
            /**
             * A UTC BOUNDARY, ASSERTED WITH A FIXED INSTANT. Using `new Date()` would make this pass or fail
             * depending on when it ran; a fixed one makes the claim testable. The instant chosen is late on
             * the last day of a month in UTC, which is ALREADY the next month for anyone east of Greenwich —
             * the exact case a local-time getter gets wrong.
             */
            const lateOnMonthEnd = new Date('2026-03-31T23:30:00.000Z');
            const period = CurrentMonthPeriod(lateOnMonthEnd);

            AssertEqual(period.PeriodStart.toISOString().slice(0, 10), '2026-03-01', 'first day of the month');
            AssertEqual(period.PeriodEnd.toISOString().slice(0, 10), '2026-03-31', 'and the last');

            /** February in a leap year — the case a hand-written day count gets wrong. */
            const leap = CurrentMonthPeriod(new Date('2028-02-10T12:00:00.000Z'));
            AssertEqual(leap.PeriodEnd.toISOString().slice(0, 10), '2028-02-29', 'a leap February ends on the 29th');

            const nonLeap = CurrentMonthPeriod(new Date('2026-02-10T12:00:00.000Z'));
            AssertEqual(nonLeap.PeriodEnd.toISOString().slice(0, 10), '2026-02-28', 'and a common one on the 28th');
        },
    },
    {
        Id: 'forecast.FS8',
        Name: 'FS8: a missing forecast query refuses by NAME rather than writing a row of nulls',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE SHAPE THAT MATTERS MOST HERE. A query that does not exist and a quarter with no deals
                 * both produce no numbers, and they are completely different facts. Writing a row of nulls
                 * for the first would put a measured zero in a forecast series.
                 *
                 * Uses a name nothing could plausibly define, so this cannot start passing for the wrong
                 * reason when the real forecast queries land.
                 */
                const missing = 'FS8 — no such forecast query exists';
                const source = new QueryForecastSource(missing, ctx.User);
                const before = (await snapshotsFor(ctx)).length;

                const result = await job.Capture(TEST_PERIOD, source, ProviderOf(ctx), ctx.User);

                AssertEqual(result.Measured, 0, 'nothing was measured');
                AssertEqual(result.Written, 0, 'and nothing written — no row of nulls');
                AssertEqual((await snapshotsFor(ctx)).length, before, 'the table did not move');
                Assert(
                    result.Issues.some((i) => i.includes(missing)),
                    `the refusal must name the query — got ${JSON.stringify(result.Issues)}`,
                );
                Assert(
                    result.Issues.some((i) => i.includes('measured zero') || i.includes('does not exist')),
                    'and say why nothing was written, so a quiet quarter is never confused with a missing query',
                );
            }),
    },
    {
        Id: 'forecast.FS9',
        Name: 'FS9: the seeded daily job points at the seeded forecast Action',
        RequiresMutation: false,
        Fn: async (ctx) => {
            const jobs = await rows(ctx, 'MJ: Scheduled Jobs', `ID = '${ID_FORECAST_JOB}'`);
            Assert(
                jobs.length === 1,
                'the forecast ScheduledJob is not in this database. Run `mj sync push --dir metadata`; the row '
                    + 'is seeded from metadata/scheduled-jobs/.',
            );
            const row = jobs[0];

            AssertEqual(String(row['CronExpression']), '0 0 2 * * *', 'daily at 02:00, six-field');
            AssertEqual(String(row['Status']), 'Active', 'Active — safe because the source factory is null');
            AssertEqual(String(row['ConcurrencyMode']), 'Skip', 'concurrent captures would both pass the guard');
            AssertEqual(
                String(row['MissedRunPolicy']),
                'RunOnce',
                'RunAll would capture TODAY N times and label it as N days',
            );

            const config = JSON.parse(String(row['Configuration'] ?? '{}')) as { ActionID?: string };
            AssertEqual(config.ActionID, ID_FORECAST_ACTION, 'and it names the forecast action');

            const actions = await rows(ctx, 'MJ: Actions', `ID = '${ID_FORECAST_ACTION}'`);
            AssertEqual(actions.length, 1, 'which must resolve — a dangling ActionID fires and does nothing');
            AssertEqual(String(actions[0]['DriverClass']), 'Sales.CaptureForecastSnapshot', 'to this driver');
            AssertEqual(String(actions[0]['Status']), 'Active', 'and be Active itself');
        },
    },
    {
        Id: 'forecast.FS10',
        Name: 'FS10: the source factory is swappable — the one line a landed query changes',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const companyID = await anyCompanyID(ctx);

                const previous = SetForecastSourceFactory(
                    () => new FixtureForecastSource([measure(companyID)], 'FS10-swapped'),
                );
                try {
                    const result = await RunForecastSnapshot(
                        ProviderOf(ctx),
                        ctx.User,
                        new Date(),
                        TEST_PERIOD,
                    );
                    Assert(result.Success, `the swapped run failed — ${result.Issues.join(' | ')}`);
                    AssertEqual(result.Written, 1, 'the registered source was used, with no other change');

                    const [row] = await snapshotsFor(ctx);
                    const provenance = JSON.parse(String(row['SnapshotJSON'])) as { Source?: string };
                    AssertEqual(provenance.Source, 'FS10-swapped', 'and the snapshot records which source');
                } finally {
                    SetForecastSourceFactory(previous);
                }

                /** Restored, so FS1's assertion about the default is not left depending on run order. */
                Assert(
                    CurrentForecastSourceFactory()(ctx.User) === null,
                    'the default factory must be restored — otherwise FS1 passes or fails by ordering',
                );
            }),
    },
];

for (const check of ForecastChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('forecast', {
    Setup: async () => {
        /* every check builds its own fixture inside a rolled-back transaction */
    },
    Teardown: async () => {
        /* nothing survives the rollback */
    },
});
