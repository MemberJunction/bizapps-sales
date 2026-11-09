/**
 * WHAT A SAVE WILL WRITE FROM THE STAGE, SAID BEFORE IT DOES — AND NEVER WRITTEN HERE (sales#247).
 *
 * `DealEntityServer.applyStageDefaults` is the one writer of a deal's Probability and forecast category
 * from its stage; `SetStage` records why the form does not write them. That left a rep who moved a saved
 * deal to another stage looking at the old probability, with nothing saying a save was about to replace
 * it. This returns the sentence to show instead. The deal is not touched, so the server still sees an
 * untouched field and still decides.
 *
 * The rule mirrors the server's for a SAVED deal: an untouched field takes the stage's value, null
 * included, but only when the stage moved in this save. A NEW deal needs nothing — the Pipeline panel
 * does not show either field until the deal is saved.
 */

/** The stage's defaults, as `LoadPipelineStages` reads them. */
export interface StageDefaults {
    ID: string;
    Name: string;
    Probability?: number | null;
    ForecastCategoryTypeID?: string | null;
    /** The forecast category's name, from the stage view. */
    ForecastCategoryType?: string | null;
}

/** The parts of the deal the rule reads. Plain values, so the rule tests without an entity. */
export interface StageMoveState {
    IsSaved: boolean;
    PipelineStageID: string | null;
    /** The stage the deal had when loaded. */
    LoadedStageID: string | null;
    ProbabilityEdited: boolean;
    ForecastCategoryEdited: boolean;
    Probability: number | null;
    ForecastCategoryTypeID: string | null;
}

export interface StageMoveHints {
    Probability: string | null;
    ForecastCategoryTypeID: string | null;
}

const NONE: StageMoveHints = { Probability: null, ForecastCategoryTypeID: null };

function sameID(a: string | null | undefined, b: string | null | undefined): boolean {
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

function sameNumber(a: number | null | undefined, b: number | null | undefined): boolean {
    if (a == null || b == null) return a == null && b == null;
    return Number(a) === Number(b);
}

export function StageMoveHintsFor(state: StageMoveState, stages: readonly StageDefaults[]): StageMoveHints {
    if (!state.IsSaved || !state.PipelineStageID) return NONE;
    if (sameID(state.LoadedStageID, state.PipelineStageID)) return NONE;
    const stage = stages.find((s) => sameID(s.ID, state.PipelineStageID));
    if (!stage) return NONE;

    const stageProbability = stage.Probability ?? null;
    const probabilityChanges = !state.ProbabilityEdited && !sameNumber(state.Probability, stageProbability);
    const forecastChanges = !state.ForecastCategoryEdited && !sameID(state.ForecastCategoryTypeID, stage.ForecastCategoryTypeID);
    return {
        Probability: probabilityChanges
            ? `Becomes ${stageProbability == null ? 'empty' : `${Number(stageProbability)}%`} on save, from ${stage.Name}. Type a value to keep your own.`
            : null,
        ForecastCategoryTypeID: forecastChanges
            ? `Becomes ${stage.ForecastCategoryType || 'empty'} on save, from ${stage.Name}. Pick one to keep your own.`
            : null,
    };
}
