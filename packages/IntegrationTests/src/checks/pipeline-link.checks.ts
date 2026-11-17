/**
 * @fileoverview `pipeline-link` — PL1–PL2. Every company is linked to the default pipeline (#327).
 *
 * Runs `LinkDefaultPipelineToCompanies` against the live host inside a rolled-back transaction, and
 * reads what it wrote with raw SQL rather than trusting the tallies it returned.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, type IMetadataProvider } from '@memberjunction/core';
import { Assert, AssertEqual, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';
import { LinkDefaultPipelineToCompanies } from '@mj-biz-apps/sales-core-entities-server';

import { InRolledBackTransaction, SALES_SCHEMA, TxOne } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

interface Coverage {
    Companies: number;
    Linked: number;
    Links: number;
    Pipelines: number;
    Defaults: number;
}

/** How many companies are linked to the default pipeline, and how many links, pipelines and defaults exist. */
async function coverage(ctx: Ctx): Promise<Coverage> {
    return TxOne<Coverage & Record<string, unknown>>(ctx, `
        WITH d AS (SELECT TOP 1 ID FROM ${SALES_SCHEMA}.Pipeline WHERE IsDefault = 1 AND IsActive = 1)
        SELECT
            (SELECT COUNT(*) FROM __mj.Company) AS Companies,
            (SELECT COUNT(DISTINCT pc.CompanyID) FROM ${SALES_SCHEMA}.PipelineCompany pc JOIN d ON pc.PipelineID = d.ID) AS Linked,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.PipelineCompany) AS Links,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.Pipeline) AS Pipelines,
            (SELECT COUNT(*) FROM ${SALES_SCHEMA}.Pipeline WHERE IsDefault = 1) AS Defaults`);
}

export const PipelineLinkChecks: NamedCheck[] = [
    {
        Id: 'pipeline-link.PL1',
        Name: 'PL1: every company ends linked to the default pipeline, and no pipeline is created',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const before = await coverage(ctx);
                Assert(Number(before.Defaults) > 0, 'the host needs an active default pipeline — push metadata/');

                const result = await LinkDefaultPipelineToCompanies(ctx.Provider as IMetadataProvider, ctx.User);
                Assert(result.Success, `the link run failed: ${result.Issues.join(' | ')}`);

                const after = await coverage(ctx);
                AssertEqual(Number(after.Linked), Number(after.Companies), 'every company is linked to the default pipeline');
                AssertEqual(Number(after.Pipelines), Number(before.Pipelines), 'no pipeline is created');
                AssertEqual(Number(after.Defaults), Number(before.Defaults), 'the default is unchanged');
                AssertEqual(result.Linked, Number(after.Companies) - Number(before.Linked), 'it reports what it linked');
            }),
    },
    {
        Id: 'pipeline-link.PL2',
        Name: 'PL2: a second run links nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const first = await LinkDefaultPipelineToCompanies(ctx.Provider as IMetadataProvider, ctx.User);
                Assert(first.Success, `the first run failed: ${first.Issues.join(' | ')}`);
                const links = await coverage(ctx);

                const second = await LinkDefaultPipelineToCompanies(ctx.Provider as IMetadataProvider, ctx.User);
                AssertEqual(second.Outcome, 'NOTHING_TO_LINK', 'the second run finds every company already linked');
                const again = await coverage(ctx);
                AssertEqual(Number(again.Links), Number(links.Links), 'and writes no link');
            }),
    },
];

for (const check of PipelineLinkChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('pipeline-link', {
    Setup: async () => {
        // Nothing to create: the default pipeline and the companies are the host's.
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadPipelineLinkChecks(): void {
    void Metadata;
}
