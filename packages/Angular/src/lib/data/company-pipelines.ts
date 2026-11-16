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

/**
 * The order `PipelineCompany` rows are read in: oldest link first. {@link DefaultCompanyID} takes the
 * default pipeline's first row, so once that pipeline is linked to every company the company it was
 * first linked to stays the one a new deal starts in, rather than whichever link the database returns
 * first.
 */
export const PIPELINE_LINK_ORDER = '__mj_CreatedAt ASC, ID ASC';

/**
 * The first company the default pipeline serves: the company a new deal starts in. Relies on the links
 * being read in {@link PIPELINE_LINK_ORDER}.
 */
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

/**
 * The company's default pipeline: the first of its pipelines in picker order, so the `IsDefault`
 * pipeline when it is linked to the company, else the lowest `DisplayRank`. Null when none is linked.
 */
export function CompanyDefaultPipeline<T extends CompanyPipeline>(pipelines: readonly T[], companyID: string | null): T | null {
    return companyID ? (PipelinesForCompany(pipelines, companyID)[0] ?? null) : null;
}

/**
 * The names of the companies a pipeline is linked to, joined: what names a pipeline where pipelines are
 * hidden. Falls back to the pipeline's own name when it has no named company.
 */
export function PipelineCompanyNames(pipelines: readonly CompanyPipeline[], pipeline: Pick<CompanyPipeline, 'ID' | 'Name'>): string {
    const names = OrderPipelinesByCompany(pipelines.filter((p) => sameID(p.ID, pipeline.ID)))
        .map((p) => p.CompanyName)
        .filter((name): name is string => !!name);
    return names.length ? [...new Set(names)].join(', ') : pipeline.Name;
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

/** Whether `companyID` has at least one pipeline linked to it. */
export function CompanyHasPipeline(pipelines: readonly CompanyPipeline[], companyID: string | null): boolean {
    return !!companyID && pipelines.some((p) => sameID(p.CompanyID, companyID));
}

/** What {@link NoPipelineMessage} needs to say why a deal has no pipeline. */
export interface NoPipelineState {
    /** The `HidePipelines` setting: the rep cannot choose a pipeline, only a company. */
    HidePipelines: boolean;
    /** The deal's company, or null when it has none. */
    CompanyID: string | null;
    /** The company's name, or null when it is not known. */
    CompanyName: string | null;
    /** Whether the deal's company has a pipeline linked to it. */
    CompanyHasPipeline: boolean;
    /** Whether any company other than the deal's has a pipeline linked to it. */
    OtherCompanyHasPipeline: boolean;
}

/** The generic refusal, for a rep who can see the Pipeline field and has a pipeline to choose. */
export const CHOOSE_PIPELINE_MESSAGE = 'Choose a pipeline. It determines the stages and the selling company.';

/**
 * Why a deal with no pipeline cannot be saved, and what to do about it.
 *
 * `Deal.PipelineID` is NOT NULL, and a deal can only sit in a pipeline linked to its company. A company
 * with no linked pipeline therefore leaves the deal unsaveable, and "Choose a pipeline" names a choice
 * that does not exist — with pipelines hidden, a field the rep cannot even see. This names the company
 * and the fix: another company, or an admin linking a pipeline to this one.
 */
export function NoPipelineMessage(state: NoPipelineState): string {
    if (state.CompanyID && !state.CompanyHasPipeline) {
        const name = state.CompanyName?.trim() || 'This company';
        const subject = state.CompanyName?.trim() || 'this company';
        const fix = state.OtherCompanyHasPipeline
            ? `Choose another company, or ask a Sales admin to link a pipeline to ${subject}.`
            : `Ask a Sales admin to link a pipeline to ${subject}.`;
        return `${name} has no pipeline, so this deal can't be saved. ${fix}`;
    }
    if (!state.CompanyHasPipeline && !state.OtherCompanyHasPipeline) {
        return 'No company has a pipeline, so deals can\'t be saved. Ask a Sales admin to link a pipeline to a company.';
    }
    if (!state.CompanyID && state.HidePipelines) {
        return 'Choose a company. Its pipeline decides the deal\'s stages.';
    }
    return CHOOSE_PIPELINE_MESSAGE;
}
