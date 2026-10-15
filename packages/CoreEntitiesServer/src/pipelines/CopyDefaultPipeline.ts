/**
 * @fileoverview Gives every company its own copy of the default pipeline and its stages (#327).
 *
 * A deal sells as its pipeline's company (`stampCompanyFromPipeline`), and the app seeds one default
 * pipeline on one placeholder company. A deal for any other company then has no pipeline with the
 * current stages. Companies are the deployment's data, not this app's, so the copies cannot ship as
 * metadata: this job reads whatever companies exist and copies the `IsDefault` pipeline onto each one
 * that has no pipeline with the same Code yet.
 *
 * RE-RUNNABLE. A company that already has the Code is skipped, so running it again after a company is
 * added copies onto the new company only. `Pipeline` is unique on (CompanyID, Code), so the skip is
 * also what the database would enforce.
 *
 * ONE TRANSACTION PER COMPANY. A pipeline without its stages is a pipeline no deal can sit in, so a
 * failed stage rolls the company's pipeline back with it. One company failing does not undo the others.
 *
 * WHAT IS COPIED is every stored column except the key, the company, `IsDefault` (one default pipeline,
 * not one per company) and the audit stamps, so a column added later is copied without an edit here.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    LogError,
    RunView,
    type BaseEntity,
    type DatabaseProviderBase,
    type IMetadataProvider,
    type RunViewParams,
    type UserInfo,
} from '@memberjunction/core';

const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
const E_STAGE = 'MJ_BizApps_Sales: Pipeline Stages';
const E_COMPANY = 'MJ: Companies';

/** Columns a copy sets itself rather than taking from the source row. */
const PIPELINE_OWN_COLUMNS = ['CompanyID', 'IsDefault'];
const STAGE_OWN_COLUMNS = ['PipelineID'];

export type PipelineCopyOutcome = 'COPIED' | 'NOTHING_TO_COPY' | 'NO_DEFAULT' | 'AMBIGUOUS_DEFAULT' | 'PARTIAL';

export interface PipelineCopyResult {
    Success: boolean;
    Outcome: PipelineCopyOutcome;
    /** Companies read. */
    Companies: number;
    /** Companies that got a copy in this run. */
    Created: number;
    /** Companies that already had a pipeline with the default pipeline's Code. */
    AlreadyHad: number;
    /** Stages copied, across every company. */
    StagesCopied: number;
    Issues: string[];
}

/** The two facts the plan needs about a pipeline. */
export interface PipelineKey {
    CompanyID: string;
    Code: string;
}

export interface PipelineCopyPlan {
    /** Companies with no pipeline carrying the default's Code. */
    CopyTo: string[];
    /** Companies that already have one, the default pipeline's own company included. */
    AlreadyHave: string[];
}

const lower = (value: string | null | undefined): string => String(value ?? '').toLowerCase();

/**
 * Which companies get a copy. Ids compare case-insensitively (SQL Server returns them upper case,
 * PostgreSQL lower); Codes too, matching the database collation the unique constraint uses.
 */
export function PlanPipelineCopies(
    defaultPipeline: PipelineKey,
    companyIDs: readonly string[],
    existing: readonly PipelineKey[],
): PipelineCopyPlan {
    const code = lower(defaultPipeline.Code);
    const owners = new Set(existing.filter((p) => lower(p.Code) === code).map((p) => lower(p.CompanyID)));
    owners.add(lower(defaultPipeline.CompanyID));
    const plan: PipelineCopyPlan = { CopyTo: [], AlreadyHave: [] };
    for (const id of companyIDs) {
        (owners.has(lower(id)) ? plan.AlreadyHave : plan.CopyTo).push(id);
    }
    return plan;
}

/** The field shape `CopyableFieldNames` reads; `EntityFieldInfo` satisfies it. */
export interface CopyableField {
    Name: string;
    IsPrimaryKey: boolean;
    IsVirtual: boolean;
}

/** Every stored, non-key, non-audit column, minus the ones the copy sets itself. */
export function CopyableFieldNames(fields: readonly CopyableField[], ownColumns: readonly string[]): string[] {
    const own = new Set(ownColumns.map(lower));
    return fields
        .filter((f) => !f.IsPrimaryKey && !f.IsVirtual && !f.Name.startsWith('__mj_') && !own.has(lower(f.Name)))
        .map((f) => f.Name);
}

function copyFields(source: BaseEntity, target: BaseEntity, ownColumns: readonly string[]): void {
    for (const name of CopyableFieldNames(source.EntityInfo.Fields, ownColumns)) {
        target.Set(name, source.Get(name));
    }
}

interface CopySource {
    Pipeline: BaseEntity;
    Stages: BaseEntity[];
    CompanyIDs: string[];
    Existing: PipelineKey[];
}

type SourceRead = { Source: CopySource } | { Refusal: PipelineCopyResult };

function refusal(outcome: PipelineCopyOutcome, issue: string): { Refusal: PipelineCopyResult } {
    return {
        Refusal: { Success: false, Outcome: outcome, Companies: 0, Created: 0, AlreadyHad: 0, StagesCopied: 0, Issues: [issue] },
    };
}

/** The default pipeline, its stages, every company and every pipeline's (company, Code), in one batch. */
async function readSource(user: UserInfo): Promise<SourceRead> {
    const params: RunViewParams[] = [
        { EntityName: E_PIPELINE, ExtraFilter: 'IsDefault = 1 AND IsActive = 1', ResultType: 'entity_object' },
        { EntityName: E_PIPELINE, ResultType: 'simple', Fields: ['CompanyID', 'Code'] },
        { EntityName: E_COMPANY, ResultType: 'simple', Fields: ['ID'], OrderBy: 'Name ASC' },
    ];
    const [defaults, all, companies] = await new RunView().RunViews(params, user);
    const failed = [defaults, all, companies].find((r) => !r?.Success);
    if (failed) {
        return refusal('PARTIAL', `Could not read pipelines or companies: ${failed?.ErrorMessage ?? 'no result'}`);
    }
    if (defaults.Results.length === 0) {
        return refusal('NO_DEFAULT', 'No active pipeline is marked IsDefault, so there is nothing to copy.');
    }
    if (defaults.Results.length > 1) {
        return refusal('AMBIGUOUS_DEFAULT', `${defaults.Results.length} active pipelines are marked IsDefault; mark one.`);
    }
    const pipeline = defaults.Results[0] as BaseEntity;
    const stages = await readStages(String(pipeline.Get('ID')), user);
    if (!stages) {
        return refusal('PARTIAL', 'Could not read the default pipeline\'s stages.');
    }
    return {
        Source: {
            Pipeline: pipeline,
            Stages: stages,
            CompanyIDs: (companies.Results as Array<{ ID: string }>).map((c) => String(c.ID)),
            Existing: (all.Results as PipelineKey[]).map((p) => ({ CompanyID: String(p.CompanyID), Code: String(p.Code) })),
        },
    };
}

async function readStages(pipelineID: string, user: UserInfo): Promise<BaseEntity[] | null> {
    const result = await new RunView().RunView<BaseEntity>({
        EntityName: E_STAGE,
        ExtraFilter: `PipelineID = '${pipelineID}'`,
        OrderBy: 'DisplayOrder ASC',
        ResultType: 'entity_object',
    }, user);
    return result.Success ? result.Results : null;
}

/** Saves one company's pipeline and stages inside one transaction. Returns an issue, or null. */
async function copyToCompany(
    source: CopySource,
    companyID: string,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<string | null> {
    const scope = await (provider as unknown as DatabaseProviderBase).BeginEntityTransaction();
    try {
        const issue = await saveCopy(source, companyID, provider, user);
        if (issue) {
            await scope.Rollback();
            return issue;
        }
        await scope.Commit();
        return null;
    } catch (error) {
        await scope.Rollback();
        return `Company ${companyID}: ${error instanceof Error ? error.message : String(error)}`;
    }
}

async function saveCopy(source: CopySource, companyID: string, provider: IMetadataProvider, user: UserInfo): Promise<string | null> {
    const pipeline = await provider.GetEntityObject<BaseEntity>(E_PIPELINE, user);
    pipeline.NewRecord();
    copyFields(source.Pipeline, pipeline, PIPELINE_OWN_COLUMNS);
    pipeline.Set('CompanyID', companyID);
    pipeline.Set('IsDefault', false);
    if (!(await pipeline.Save())) {
        return `Company ${companyID}: the pipeline did not save: ${pipeline.LatestResult?.Message ?? 'no reason given'}`;
    }
    for (const sourceStage of source.Stages) {
        const stage = await provider.GetEntityObject<BaseEntity>(E_STAGE, user);
        stage.NewRecord();
        copyFields(sourceStage, stage, STAGE_OWN_COLUMNS);
        stage.Set('PipelineID', pipeline.Get('ID'));
        if (!(await stage.Save())) {
            return `Company ${companyID}: stage "${String(sourceStage.Get('Name'))}" did not save: `
                + `${stage.LatestResult?.Message ?? 'no reason given'}`;
        }
    }
    return null;
}

/**
 * Copies the default pipeline and its stages onto every company that has no pipeline with its Code.
 * Never throws for a company that fails: that company's issue is reported and the rest carry on.
 */
export async function CopyDefaultPipelineToCompanies(provider: IMetadataProvider, user: UserInfo): Promise<PipelineCopyResult> {
    const read = await readSource(user);
    if ('Refusal' in read) {
        return read.Refusal;
    }
    const { Source: source } = read;
    const plan = PlanPipelineCopies(
        { CompanyID: String(source.Pipeline.Get('CompanyID')), Code: String(source.Pipeline.Get('Code')) },
        source.CompanyIDs,
        source.Existing,
    );

    const issues: string[] = [];
    let created = 0;
    for (const companyID of plan.CopyTo) {
        const issue = await copyToCompany(source, companyID, provider, user);
        if (issue) {
            LogError(`CopyDefaultPipelineToCompanies: ${issue}`);
            issues.push(issue);
        } else {
            created++;
        }
    }

    const outcome: PipelineCopyOutcome = issues.length ? 'PARTIAL' : created ? 'COPIED' : 'NOTHING_TO_COPY';
    return {
        Success: issues.length === 0,
        Outcome: outcome,
        Companies: source.CompanyIDs.length,
        Created: created,
        AlreadyHad: plan.AlreadyHave.length,
        StagesCopied: created * source.Stages.length,
        Issues: issues,
    };
}
