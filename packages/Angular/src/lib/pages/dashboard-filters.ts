/**
 * @fileoverview The dashboard's filter bar: selling company, product company, deal owner, pipeline
 * (bc-aidp-next-golive#350), stage (bc-aidp-next-golive#488).
 *
 * Pure, like the other dashboard modules, so the rules can be tested without a provider.
 *
 * ── THE FILTERS ARE APPLIED BY THE QUERIES ──────────────────────────────────────────────────────
 *
 * Every list goes to `Sales: Dashboard Summary`, `Sales: Win Rate by Count and Value` and
 * `Sales: Deal Roster` as a query parameter, and each query narrows its rows with it. The browser never
 * re-filters what a query returned. The Inspect grid reads the same lists through `InspectCriteriaWhere`,
 * so a tile and the deals listed under it are narrowed by the same rule.
 *
 * An empty list is "All". It is left out of the parameters rather than sent empty, because the queries
 * test each list with `{% if %}` and `sqlIn` renders an empty list as `(NULL)`, which matches nothing.
 *
 * ── PRODUCT COMPANY IS A DIFFERENT QUESTION FROM SELLING COMPANY ────────────────────────────────
 *
 * A deal's selling company is `Deal.CompanyID`. Its product companies are the companies stamped on the
 * lines of its order (`OrderLine.CompanyID`, which orders copies from the product). One company sells
 * products that belong to others, so both filters exist. A deal matches the product filter when at
 * least one of its lines belongs to a selected company, and then counts once at its full amount. A deal
 * with no lines cannot match, so it drops out when a product company is chosen; the summary reports how
 * many did (`NoLinesDealCount`) so the filter chip can say so.
 *
 * ── STAGES ARE PICKED BY ID, PER PIPELINE (bc-aidp-next-golive#488) ─────────────────────────────
 *
 * Two pipelines may name a stage the same, so the Stage list holds stage IDs, grouped under the
 * pipeline each belongs to. A deal with no stage is picked through its pipeline's "No stage" entry,
 * `unstaged:<pipeline ID>`, the key the stage card already uses. The queries take the two kinds as
 * separate parameters, `StageIDs` and `UnstagedPipelineIDs`; a deal matches either.
 *
 * @module @mj-biz-apps/sales-ng
 */

export interface DashboardFilters {
    /** Selling companies, `Deal.CompanyID`. Empty is every company. */
    CompanyIDs: readonly string[];
    /** Companies that own a product on the deal's lines, `OrderLine.CompanyID`. Empty is every deal. */
    ProductCompanyIDs: readonly string[];
    /** Deal owners, `Deal.OwnerEmployeeID`. Empty is every owner. */
    OwnerEmployeeIDs: readonly string[];
    /** Pipelines, `Deal.PipelineID`. Empty is every pipeline that counts toward the forecast. */
    PipelineIDs: readonly string[];
    /**
     * Stages, `Deal.PipelineStageID`, and `unstaged:<pipeline ID>` for that pipeline's deals with no
     * stage. Empty is every stage.
     */
    StageIDs: readonly string[];
}

/** No filter: every figure spans the whole book, as the dashboard did before the filter bar. */
export const NO_FILTERS: DashboardFilters = { CompanyIDs: [], ProductCompanyIDs: [], OwnerEmployeeIDs: [], PipelineIDs: [], StageIDs: [] };

/**
 * The query parameter each list is sent as. The three queries declare the same names. `StageIDs` is
 * split in two by {@link SplitStageIDs}; its entry here names the stage half.
 */
const PARAMETER: Record<keyof DashboardFilters, string> = {
    CompanyIDs: 'CompanyIDs',
    ProductCompanyIDs: 'ProductCompanyIDs',
    OwnerEmployeeIDs: 'OwnerEmployeeIDs',
    PipelineIDs: 'PipelineIDs',
    StageIDs: 'StageIDs',
};

/** The query parameter for the pipelines whose deals with no stage are picked. */
const UNSTAGED_PARAMETER = 'UnstagedPipelineIDs';

const FILTER_KEYS = Object.keys(PARAMETER) as (keyof DashboardFilters)[];

/** Ids round-trip through JSON and SQL in different cases. */
const idKey = (id: string): string => id.trim().toLowerCase();

/** A list without blanks or repeats, in the order it was given. */
export function CleanIDs(ids: readonly (string | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of ids) {
        const id = String(raw ?? '').trim();
        if (id && !seen.has(idKey(id))) {
            seen.add(idKey(id));
            out.push(id);
        }
    }
    return out;
}

/** True when any filter narrows the book. */
export function HasFilters(filters: DashboardFilters): boolean {
    return FILTER_KEYS.some((k) => filters[k].length > 0);
}

/** True when two filter sets select the same deals. Order and case do not matter. */
export function SameFilters(a: DashboardFilters, b: DashboardFilters): boolean {
    return FILTER_KEYS.every((k) => {
        const x = new Set(a[k].map(idKey));
        const y = new Set(b[k].map(idKey));
        return x.size === y.size && [...x].every((id) => y.has(id));
    });
}

/**
 * The filters as query parameters: one array per list that narrows anything, nothing for a list that
 * is "All". Pass the result alongside the period parameters.
 */
export function FilterParameters(filters: DashboardFilters): Record<string, string[]> {
    const parameters: Record<string, string[]> = {};
    for (const key of FILTER_KEYS) {
        const ids = CleanIDs(filters[key]);
        if (key === 'StageIDs') {
            const split = SplitStageIDs(ids);
            if (split.StageIDs.length) parameters[PARAMETER.StageIDs] = split.StageIDs;
            if (split.UnstagedPipelineIDs.length) parameters[UNSTAGED_PARAMETER] = split.UnstagedPipelineIDs;
        } else if (ids.length) {
            parameters[PARAMETER[key]] = ids;
        }
    }
    return parameters;
}

/** The Stage list's prefix for a pipeline's deals with no stage. */
const UNSTAGED_PREFIX = 'unstaged:';

/** The Stage list entry for `pipelineID`'s deals with no stage. */
export function UnstagedKey(pipelineID: string): string {
    return `${UNSTAGED_PREFIX}${pipelineID}`;
}

/** The pipeline an `unstaged:<pipeline ID>` entry names, or null for a stage ID. */
export function UnstagedPipelineOf(id: string): string | null {
    return id.toLowerCase().startsWith(UNSTAGED_PREFIX) ? id.slice(UNSTAGED_PREFIX.length) || null : null;
}

/** The Stage list as the two query parameters: picked stage IDs, and pipelines whose unstaged deals are picked. */
export function SplitStageIDs(ids: readonly string[]): { StageIDs: string[]; UnstagedPipelineIDs: string[] } {
    const StageIDs: string[] = [];
    const UnstagedPipelineIDs: string[] = [];
    for (const id of CleanIDs(ids)) {
        const pipeline = UnstagedPipelineOf(id);
        if (pipeline) {
            UnstagedPipelineIDs.push(pipeline);
        } else if (!id.toLowerCase().startsWith(UNSTAGED_PREFIX)) {
            StageIDs.push(id);
        }
    }
    return { StageIDs, UnstagedPipelineIDs };
}

/** True when `id` is in `ids`, ignoring case. */
export function HasID(ids: readonly string[], id: string | null | undefined): boolean {
    return !!id && ids.some((x) => idKey(x) === idKey(id));
}

/** `ids` with `id` added, or removed when it is already there. */
export function ToggleID(ids: readonly string[], id: string): string[] {
    return HasID(ids, id) ? ids.filter((x) => idKey(x) !== idKey(id)) : [...ids, id];
}

/** One choice in a filter list. */
export interface FilterOption {
    ID: string;
    Name: string;
    /** The heading the choice sits under, for a grouped list (the Stage list's pipeline). */
    Group?: string;
}

/** Options with duplicates removed, sorted by name, so each list reads the same way every load. */
export function SortedOptions(options: readonly FilterOption[]): FilterOption[] {
    const byID = new Map<string, FilterOption>();
    for (const o of options) {
        if (o.ID && !byID.has(idKey(o.ID))) {
            byID.set(idKey(o.ID), o);
        }
    }
    return [...byID.values()].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' }));
}

/**
 * The pipelines the Pipeline filter offers: those of the selected selling companies, or every pipeline
 * when no company is selected. A selected pipeline outside the companies is dropped by
 * {@link PipelinesWithinCompanies} rather than kept as a filter the list no longer shows.
 */
export function PipelineOptionsFor<T extends { ID: string; CompanyID: string }>(pipelines: readonly T[], companyIDs: readonly string[]): T[] {
    const inCompanies = companyIDs.length ? pipelines.filter((p) => HasID(companyIDs, p.CompanyID)) : pipelines;
    // A pipeline appears once per linked company; offer it once.
    return inCompanies.filter((p, i) => inCompanies.findIndex((q) => idKey(q.ID) === idKey(p.ID)) === i);
}

/** The selected pipelines that still belong to one of the selected companies. */
export function PipelinesWithinCompanies(
    pipelineIDs: readonly string[],
    pipelines: readonly { ID: string; CompanyID: string }[],
    companyIDs: readonly string[],
): string[] {
    if (!companyIDs.length || !pipelines.length) {
        return [...pipelineIDs];
    }
    const allowed = PipelineOptionsFor(pipelines, companyIDs).map((p) => p.ID);
    return pipelineIDs.filter((id) => HasID(allowed, id));
}

/** "Acme" for one, "Acme +2" for three, "All" for none: a filter button's label. */
export function SelectionLabel(ids: readonly string[], options: readonly FilterOption[]): string {
    if (!ids.length) {
        return 'All';
    }
    const first = options.find((o) => HasID([o.ID], ids[0]))?.Name ?? '1 selected';
    return ids.length === 1 ? first : `${first} +${ids.length - 1}`;
}

/** What the Stage list needs to know about a stage. */
export interface StageChoice {
    ID: string;
    Name: string;
    PipelineID: string;
    DisplayOrder: number;
    DealStatusTypeID: string | null;
}

/**
 * The Stage list (bc-aidp-next-golive#488): each allowed pipeline's stages in its own order, under a
 * heading for the pipeline, each followed by a "No stage" entry for its deals with none.
 *
 * @param pipelines The pipelines the Selling company and Pipeline filters allow, one each, in the order
 * the list shows them.
 * @param heading A pipeline's heading: its name, or with pipelines hidden the companies it serves.
 */
export function StageOptionsFor<P extends { ID: string }>(
    pipelines: readonly P[],
    stages: readonly StageChoice[],
    heading: (pipeline: P) => string,
): FilterOption[] {
    const options: FilterOption[] = [];
    for (const p of pipelines) {
        const group = heading(p);
        const own = stages.filter((s) => HasID([p.ID], s.PipelineID)).sort((a, b) => a.DisplayOrder - b.DisplayOrder);
        options.push(...own.map((s) => ({ ID: s.ID, Name: s.Name, Group: group })));
        options.push({ ID: UnstagedKey(p.ID), Name: 'No stage', Group: group });
    }
    return options;
}

/** The pipeline a Stage list entry belongs to, or null for a stage that is not loaded. */
export function StagePipelineOf(id: string, stages: readonly StageChoice[]): string | null {
    return UnstagedPipelineOf(id) ?? stages.find((s) => HasID([s.ID], id))?.PipelineID ?? null;
}

/**
 * The picked stages that still belong to an allowed pipeline. A stage not loaded yet is kept, as
 * {@link PipelinesWithinCompanies} keeps a pipeline before the pipelines load.
 */
export function StagesWithinPipelines(
    stageIDs: readonly string[],
    stages: readonly StageChoice[],
    pipelineIDs: readonly string[],
): string[] {
    return stageIDs.filter((id) => {
        const pipeline = StagePipelineOf(id, stages);
        return pipeline === null ? !stages.length : HasID(pipelineIDs, pipeline);
    });
}

/**
 * The "Open stages" choice: the stages of the allowed pipelines whose status is open, read from the
 * status's `IsOpen` flag. "No stage" entries are left out: a deal with no stage has no stage status.
 */
export function OpenStageIDs(
    stages: readonly StageChoice[],
    statuses: readonly { ID: string; IsOpen: boolean }[],
    pipelineIDs: readonly string[],
): string[] {
    const open = statuses.filter((s) => s.IsOpen).map((s) => s.ID);
    return stages
        .filter((s) => HasID(pipelineIDs, s.PipelineID) && HasID(open, s.DealStatusTypeID))
        .map((s) => s.ID);
}
