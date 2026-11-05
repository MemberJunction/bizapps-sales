/**
 * Pipelines grouped, ordered and labelled by their selling company (#327).
 *
 * A pipeline serves every company it is actively linked to through `PipelineCompany`. The rep picks
 * the deal's company first and is offered that company's pipelines; `DealEntityServer` refuses a deal
 * whose company is not linked to its pipeline. The deal form, the deal workspace and the board all pick
 * from the same list, so the ordering and the label live here once rather than three times.
 *
 * A `CompanyPipeline` is one pipeline AS SERVED BY one company: a pipeline linked to three companies
 * appears three times, once per company ({@link ExpandPipelinesByCompany}). Lists that are not scoped
 * to a company take one row per pipeline ({@link DistinctPipelines}).
 *
 * ORDER: the default pipeline's company first, then the other companies by name. Within a company, the
 * pipeline sharing the default pipeline's Code first (its copy of the current stages), then
 * `DisplayRank`, then name. Legacy pipelines stay active and sort after it.
 */

/** What grouping, ordering and labelling a pipeline by company needs. */
export interface CompanyPipeline {
    ID: string;
    Name: string;
    Code: string;
    CompanyID: string;
    CompanyName: string | null;
    IsDefault: boolean;
    DisplayRank: number;
}

/** A pipeline row as loaded, before it is paired with its companies. */
export type PipelineRecord = Omit<CompanyPipeline, 'CompanyID' | 'CompanyName'>;

/** One active `PipelineCompany` link, with the company's name from the link view. */
export interface PipelineCompanyLink {
    PipelineID: string;
    CompanyID: string;
    Company: string | null;
}

/** One selling company with at least one pipeline linked to it. */
export interface PipelineCompany {
    CompanyID: string;
    CompanyName: string | null;
}

/** Ids round-trip through JSON and SQL in different cases. */
function sameID(a: string | null | undefined, b: string | null | undefined): boolean {
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

/**
 * One row per (pipeline, linked company). A pipeline with no active link has no company to sell as,
 * so it is left out: no deal could be saved on it.
 */
export function ExpandPipelinesByCompany<T extends PipelineRecord>(
    pipelines: readonly T[],
    links: readonly PipelineCompanyLink[],
): (T & Pick<CompanyPipeline, 'CompanyID' | 'CompanyName'>)[] {
    const rows: (T & Pick<CompanyPipeline, 'CompanyID' | 'CompanyName'>)[] = [];
    for (const pipeline of pipelines) {
        for (const link of links.filter((l) => sameID(l.PipelineID, pipeline.ID))) {
            rows.push({ ...pipeline, CompanyID: link.CompanyID, CompanyName: link.Company });
        }
    }
    return rows;
}

/** The first row for each pipeline, in the order given: for a list not scoped to one company. */
export function DistinctPipelines<T extends CompanyPipeline>(pipelines: readonly T[]): T[] {
    return pipelines.filter((p, i) => pipelines.findIndex((q) => sameID(q.ID, p.ID)) === i);
}

/** The pipeline marked `IsDefault`, or null when none is. */
export function DefaultPipeline<T extends CompanyPipeline>(pipelines: readonly T[]): T | null {
    return pipelines.find((p) => p.IsDefault) ?? null;
}

/** The first company the default pipeline serves: the company a new deal starts in. */
export function DefaultCompanyID(pipelines: readonly CompanyPipeline[]): string | null {
    return DefaultPipeline(pipelines)?.CompanyID ?? OrderPipelinesByCompany(pipelines)[0]?.CompanyID ?? null;
}

/** Names compare case-insensitively; a company with no name sorts last. */
function compareNames(a: string | null, b: string | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/** Every pipeline in picker order. See the module note for the order. */
export function OrderPipelinesByCompany<T extends CompanyPipeline>(pipelines: readonly T[]): T[] {
    const defaultPipeline = DefaultPipeline(pipelines);
    const defaultCompany = defaultPipeline?.CompanyID ?? null;
    const defaultCode = (defaultPipeline?.Code ?? '').toLowerCase();
    const companyRank = (p: T): number => (sameID(p.CompanyID, defaultCompany) ? 0 : 1);
    const codeRank = (p: T): number => (defaultCode && p.Code?.toLowerCase() === defaultCode ? 0 : 1);

    return [...pipelines].sort((a, b) =>
        companyRank(a) - companyRank(b)
        || compareNames(a.CompanyName, b.CompanyName)
        || String(a.CompanyID).localeCompare(String(b.CompanyID))
        || codeRank(a) - codeRank(b)
        || a.DisplayRank - b.DisplayRank
        || compareNames(a.Name, b.Name));
}

/** The companies with a pipeline linked to them, default company first. */
export function PipelineCompanies(pipelines: readonly CompanyPipeline[]): PipelineCompany[] {
    const companies: PipelineCompany[] = [];
    for (const p of OrderPipelinesByCompany(pipelines)) {
        if (!companies.some((c) => sameID(c.CompanyID, p.CompanyID))) {
            companies.push({ CompanyID: p.CompanyID, CompanyName: p.CompanyName });
        }
    }
    return companies;
}

/** One company's pipelines in picker order; every pipeline, once each, when `companyID` is null. */
export function PipelinesForCompany<T extends CompanyPipeline>(pipelines: readonly T[], companyID: string | null): T[] {
    const ordered = OrderPipelinesByCompany(pipelines);
    return companyID ? ordered.filter((p) => sameID(p.CompanyID, companyID)) : DistinctPipelines(ordered);
}

/** Whether `pipelineID` is linked to `companyID`. */
export function PipelineServesCompany(
    pipelines: readonly CompanyPipeline[],
    pipelineID: string | null,
    companyID: string | null,
): boolean {
    return !!pipelineID && !!companyID && pipelines.some((p) => sameID(p.ID, pipelineID) && sameID(p.CompanyID, companyID));
}

/**
 * The company a deal's company picker starts on: the deal's own company when it has one, else the
 * default company. A pipeline serves several companies, so it cannot answer this on its own.
 */
export function InitialCompanyID(pipelines: readonly CompanyPipeline[], dealCompanyID: string | null): string | null {
    return dealCompanyID || DefaultCompanyID(pipelines);
}

/** "B2B (Acme)": the pipeline with its company, so the choice says who is selling. */
export function PipelineLabel(pipeline: Pick<CompanyPipeline, 'Name' | 'CompanyName'>): string {
    return pipeline.CompanyName ? `${pipeline.Name} (${pipeline.CompanyName})` : pipeline.Name;
}

/** The company's display name, falling back to a placeholder rather than an id. */
export function CompanyLabel(company: PipelineCompany): string {
    return company.CompanyName ?? 'Unnamed company';
}
