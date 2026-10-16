/**
 * @fileoverview `pipeline-copy` — PC1–PC2. Every company gets its own copy of the default pipeline (#327).
 *
 * Runs `CopyDefaultPipelineToCompanies` against the live host inside a rolled-back transaction, and
 * reads what it wrote with raw SQL rather than trusting the tallies it returned. The job's own
 * per-company transactions nest inside the check's, so nothing it writes survives the check.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, type IMetadataProvider } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { CopyDefaultPipelineToCompanies } from '@mj-biz-apps/sales-core-entities-server';

import { InRolledBackTransaction, SALES_SCHEMA, TxOne } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

interface Coverage {
    Companies: number;
    WithCode: number;
    DefaultStages: number;
    ShortCopies: number;
    Defaults: number;
}

/**
 * How many companies have a pipeline with the default pipeline's Code, how many stages the default
 * has, how many such pipelines carry fewer stages than it, and how many pipelines are marked default.
 */
async function coverage(ctx: Ctx): Promise<Coverage> {
    return TxOne<Coverage & Record<string, unknown>>(ctx, `
        WITH d AS (SELECT TOP 1 ID, Code FROM ${SALES_SCHEMA}.Pipeline WHERE IsDefault = 1 AND IsActive = 1),
             copies AS (SELECT p.ID FROM ${SALES_SCHEMA}.Pipeline p JOIN d ON p.Code = d.Code)
        SELECT
            (SELECT COUNT(*) FROM __mj.Company) AS Companies,
            (SELECT COUNT(DISTINCT p.CompanyID) FROM ${SALES_SCHEMA}.Pipeline p JOIN d ON p.Code = d.Code) AS WithCode,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.PipelineStage s JOIN d ON s.PipelineID = d.ID) AS DefaultStages,
            (SELECT COUNT(*) FROM copies c
              WHERE (SELECT COUNT(*) FROM ${SALES_SCHEMA}.PipelineStage s WHERE s.PipelineID = c.ID)
                  < (SELECT COUNT(*) FROM ${SALES_SCHEMA}.PipelineStage s JOIN d ON s.PipelineID = d.ID)) AS ShortCopies,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.Pipeline WHERE IsDefault = 1) AS Defaults`);
}

export const PipelineCopyChecks: NamedCheck[] = [
    {
        Id: 'pipeline-copy.PC1',
        Name: 'PC1: every company ends with the default pipeline\'s Code and all of its stages, and one default remains',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const before = await coverage(ctx);
                Assert(before.DefaultStages > 0, 'the host needs an active default pipeline with stages — push metadata/');

                const result = await CopyDefaultPipelineToCompanies(ctx.Provider as IMetadataProvider, ctx.User);
                Assert(result.Success, `the copy failed: ${result.Issues.join(' | ')}`);

                const after = await coverage(ctx);
                AssertEqual(Number(after.WithCode), Number(after.Companies), 'every company has the default pipeline\'s Code');
                AssertEqual(Number(after.ShortCopies), 0, 'no copy is missing a stage');
                AssertEqual(Number(after.Defaults), Number(before.Defaults), 'the copies are not marked default');
                AssertEqual(result.Created, Number(after.Companies) - Number(before.WithCode), 'it reports what it created');
            }),
    },
    {
        Id: 'pipeline-copy.PC2',
        Name: 'PC2: a second run copies nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const first = await CopyDefaultPipelineToCompanies(ctx.Provider as IMetadataProvider, ctx.User);
                Assert(first.Success, `the first run failed: ${first.Issues.join(' | ')}`);
                const pipelines = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Pipeline`);

                const second = await CopyDefaultPipelineToCompanies(ctx.Provider as IMetadataProvider, ctx.User);
                AssertEqual(second.Outcome, 'NOTHING_TO_COPY', 'the second run finds every company already has it');
                const again = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Pipeline`);
                AssertEqual(Number(again.N), Number(pipelines.N), 'and writes no pipeline');
            }),
    },
];

for (const check of PipelineCopyChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('pipeline-copy', {
    Setup: async () => {
        // Nothing to create: the default pipeline and the companies are the host's.
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadPipelineCopyChecks(): void {
    void Metadata;
}
