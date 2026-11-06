/**
 * @fileoverview Links the default pipeline to every company that has no link to it (#327).
 *
 * A pipeline serves every company it is actively linked to through `PipelineCompany`, and a deal's
 * company must be one of them. The app seeds one default pipeline linked to one placeholder company, so
 * a deal for any other company has no pipeline to sit in. Companies are the deployment's data, not this
 * app's, so the links cannot ship as metadata: this job reads whatever companies exist and links the
 * `IsDefault` pipeline to each one that has no link to it yet.
 *
 * This replaced copying the pipeline and its stages onto each company. A shared pipeline keeps one set
 * of stages, so a change to the sales process is made once.
 *
 * RE-RUNNABLE. A company already linked to the default pipeline is skipped, active or not: a link an
 * admin retired (`IsActive = 0`) stays retired. `PipelineCompany` is unique on (PipelineID, CompanyID),
 * so the skip is also what the database would enforce.
 *
 * ONE SAVE PER COMPANY. One company failing does not undo the others.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    LogError,
    RunView,
    type BaseEntity,
    type IMetadataProvider,
    type RunViewParams,
    type UserInfo,
} from '@memberjunction/core';

const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
const E_PIPELINE_COMPANY = 'MJ_BizApps_Sales: Pipeline Companies';
const E_COMPANY = 'MJ: Companies';

/**
 * `NO_DEFAULT`, `AMBIGUOUS_DEFAULT` and `READ_FAILED` stop before any link is attempted; `PARTIAL` means
 * some companies were linked and some failed.
 */
export type PipelineLinkOutcome = 'LINKED' | 'NOTHING_TO_LINK' | 'NO_DEFAULT' | 'AMBIGUOUS_DEFAULT' | 'READ_FAILED' | 'PARTIAL';

export interface PipelineLinkResult {
    Success: boolean;
    Outcome: PipelineLinkOutcome;
    /** Companies read. */
    Companies: number;
    /** Companies linked to the default pipeline in this run. */
    Linked: number;
    /** Companies that already had a link to it, active or not. */
    AlreadyLinked: number;
    Issues: string[];
}

export interface PipelineLinkPlan {
    /** Companies with no link to the default pipeline. */
    LinkTo: string[];
    /** Companies that already have one. */
    AlreadyLinked: string[];
}

const lower = (value: string | null | undefined): string => String(value ?? '').toLowerCase();

/**
 * Which companies get a link. Ids compare case-insensitively (SQL Server returns them upper case,
 * PostgreSQL lower).
 */
export function PlanPipelineLinks(companyIDs: readonly string[], linkedCompanyIDs: readonly string[]): PipelineLinkPlan {
    const linked = new Set(linkedCompanyIDs.map(lower));
    const plan: PipelineLinkPlan = { LinkTo: [], AlreadyLinked: [] };
    for (const id of companyIDs) {
        (linked.has(lower(id)) ? plan.AlreadyLinked : plan.LinkTo).push(id);
    }
    return plan;
}

interface LinkSource {
    PipelineID: string;
    CompanyIDs: string[];
    LinkedCompanyIDs: string[];
}

type SourceRead = { Source: LinkSource } | { Refusal: PipelineLinkResult };

function refusal(outcome: PipelineLinkOutcome, issue: string): { Refusal: PipelineLinkResult } {
    return {
        Refusal: { Success: false, Outcome: outcome, Companies: 0, Linked: 0, AlreadyLinked: 0, Issues: [issue] },
    };
}

/** The default pipeline, every company and every link, in one batch. */
async function readSource(user: UserInfo): Promise<SourceRead> {
    const params: RunViewParams[] = [
        { EntityName: E_PIPELINE, ExtraFilter: 'IsDefault = 1 AND IsActive = 1', ResultType: 'simple', Fields: ['ID'] },
        { EntityName: E_COMPANY, ResultType: 'simple', Fields: ['ID'], OrderBy: 'Name ASC' },
        { EntityName: E_PIPELINE_COMPANY, ResultType: 'simple', Fields: ['PipelineID', 'CompanyID'] },
    ];
    const [defaults, companies, links] = await new RunView().RunViews(params, user);
    const failed = [defaults, companies, links].find((r) => !r?.Success);
    if (failed) {
        return refusal('READ_FAILED', `Could not read pipelines, companies or links: ${failed?.ErrorMessage ?? 'no result'}`);
    }
    if (defaults.Results.length === 0) {
        return refusal('NO_DEFAULT', 'No active pipeline is marked IsDefault, so there is nothing to link.');
    }
    if (defaults.Results.length > 1) {
        return refusal('AMBIGUOUS_DEFAULT', `${defaults.Results.length} active pipelines are marked IsDefault; mark one.`);
    }
    const pipelineID = String((defaults.Results[0] as { ID: string }).ID);
    const linkRows = links.Results as Array<{ PipelineID: string; CompanyID: string }>;
    return {
        Source: {
            PipelineID: pipelineID,
            CompanyIDs: (companies.Results as Array<{ ID: string }>).map((c) => String(c.ID)),
            LinkedCompanyIDs: linkRows.filter((l) => lower(l.PipelineID) === lower(pipelineID)).map((l) => String(l.CompanyID)),
        },
    };
}

/** Saves one company's link. Returns an issue, or null. */
async function linkCompany(pipelineID: string, companyID: string, provider: IMetadataProvider, user: UserInfo): Promise<string | null> {
    try {
        const link = await provider.GetEntityObject<BaseEntity>(E_PIPELINE_COMPANY, user);
        link.NewRecord();
        link.Set('PipelineID', pipelineID);
        link.Set('CompanyID', companyID);
        link.Set('IsActive', true);
        if (!(await link.Save())) {
            return `Company ${companyID}: the link did not save: ${link.LatestResult?.Message ?? 'no reason given'}`;
        }
        return null;
    } catch (error) {
        return `Company ${companyID}: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * Links the default pipeline to every company that has no link to it.
 * Never throws for a company that fails: that company's issue is reported and the rest carry on.
 */
export async function LinkDefaultPipelineToCompanies(provider: IMetadataProvider, user: UserInfo): Promise<PipelineLinkResult> {
    const read = await readSource(user);
    if ('Refusal' in read) {
        return read.Refusal;
    }
    const { Source: source } = read;
    const plan = PlanPipelineLinks(source.CompanyIDs, source.LinkedCompanyIDs);

    const issues: string[] = [];
    let linked = 0;
    for (const companyID of plan.LinkTo) {
        const issue = await linkCompany(source.PipelineID, companyID, provider, user);
        if (issue) {
            LogError(`LinkDefaultPipelineToCompanies: ${issue}`);
            issues.push(issue);
        } else {
            linked++;
        }
    }

    const outcome: PipelineLinkOutcome = issues.length ? 'PARTIAL' : linked ? 'LINKED' : 'NOTHING_TO_LINK';
    return {
        Success: issues.length === 0,
        Outcome: outcome,
        Companies: source.CompanyIDs.length,
        Linked: linked,
        AlreadyLinked: plan.AlreadyLinked.length,
        Issues: issues,
    };
}
