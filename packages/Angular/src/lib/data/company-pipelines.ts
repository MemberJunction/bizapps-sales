/**
 * Pipelines grouped, ordered and labelled by their selling company (#327).
 *
 * A pipeline names the company a deal sells as (`DealEntityServer.stampCompanyFromPipeline`), so a
 * rep choosing a pipeline is choosing a company. Every company can carry its own copy of the default
 * pipeline (`Sales.CopyDefaultPipelineToCompanies`), which makes a flat list of names unreadable: five
 * options all called "B2B". The deal form, the deal workspace and the board all pick from the same
 * list, so the ordering and the label live here once rather than three times.
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

/** One selling company that owns at least one pipeline. */
export interface PipelineCompany {
    CompanyID: string;
    CompanyName: string | null;
}

/** Ids round-trip through JSON and SQL in different cases. */
function sameID(a: string | null | undefined, b: string | null | undefined): boolean {
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

/** The pipeline marked `IsDefault`, or null when none is. */
export function DefaultPipeline<T extends CompanyPipeline>(pipelines: readonly T[]): T | null {
    return pipelines.find((p) => p.IsDefault) ?? null;
}

/** The company of the default pipeline: the company a new deal starts in. */
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

/** The companies that own a pipeline, default company first. */
export function PipelineCompanies(pipelines: readonly CompanyPipeline[]): PipelineCompany[] {
    const companies: PipelineCompany[] = [];
    for (const p of OrderPipelinesByCompany(pipelines)) {
        if (!companies.some((c) => sameID(c.CompanyID, p.CompanyID))) {
            companies.push({ CompanyID: p.CompanyID, CompanyName: p.CompanyName });
        }
    }
    return companies;
}

/** One company's pipelines in picker order; every pipeline when `companyID` is null. */
export function PipelinesForCompany<T extends CompanyPipeline>(pipelines: readonly T[], companyID: string | null): T[] {
    const ordered = OrderPipelinesByCompany(pipelines);
    return companyID ? ordered.filter((p) => sameID(p.CompanyID, companyID)) : ordered;
}

/** The company that owns `pipelineID`, or null when the pipeline is not in the list. */
export function CompanyOfPipeline(pipelines: readonly CompanyPipeline[], pipelineID: string | null): string | null {
    if (!pipelineID) return null;
    return pipelines.find((p) => sameID(p.ID, pipelineID))?.CompanyID ?? null;
}

/**
 * The company to show in a company filter: the current pipeline's when it has one, else the default
 * company. A saved deal therefore opens on its own company rather than on one it is not in.
 */
export function InitialCompanyID(pipelines: readonly CompanyPipeline[], pipelineID: string | null): string | null {
    return CompanyOfPipeline(pipelines, pipelineID) ?? DefaultCompanyID(pipelines);
}

/** "B2B (Acme)": the pipeline with its company, so the choice says who is selling. */
export function PipelineLabel(pipeline: Pick<CompanyPipeline, 'Name' | 'CompanyName'>): string {
    return pipeline.CompanyName ? `${pipeline.Name} (${pipeline.CompanyName})` : pipeline.Name;
}

/** The company's display name, falling back to a placeholder rather than an id. */
export function CompanyLabel(company: PipelineCompany): string {
    return company.CompanyName ?? 'Unnamed company';
}
