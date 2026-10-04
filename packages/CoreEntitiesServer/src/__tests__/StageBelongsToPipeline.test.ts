import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A DEAL COULD SIT IN ANOTHER PIPELINE'S STAGE, AND THE MISMATCH DID NOT SIT INERT.
 *
 * bc-aidp-next-golive#291: the Deal form's Stage control is MJ's standard foreign-key dropdown, which
 * lists every stage in the system and does not narrow when the pipeline changes. Nothing on the server
 * checked the pair either, so a B2B deal saved with a D2C stage was accepted — and `applyStageDefaults`
 * then took that stage's `Probability`, `ForecastCategoryTypeID` and `DealStatusTypeID`. The deal's
 * forecast numbers came from a pipeline it does not belong to.
 *
 * The form fix is one caller. This is the rule: imports and Actions reach `Save()` without passing
 * through any form, and a CHECK constraint cannot express it — it cannot reach across the foreign key
 * to compare the stage's pipeline with the deal's.
 *
 * WHY A REFUSAL RATHER THAN A CORRECTION, when `stampCompanyFromPipeline` beside it overwrites: a
 * wrong company has exactly one right answer and it is derivable from the pipeline. A wrong stage has
 * none. Moving the deal to the pipeline's first stage would invent a position in a sales process
 * nobody chose.
 *
 * `Object.create` holds the server entity without standing up metadata, the way `SeedOwnerOnCreate`
 * and `StatusReadFailure` do. It does NOT run the constructor, so everything the method reads is
 * shadowed explicitly below — a field left undefined here fails as a passing test rather than a
 * failing one.
 */

const B2B = 'aaaaaaaa-0000-4000-8000-00000000b2b0';
const D2C = 'bbbbbbbb-0000-4000-8000-00000000d2c0';
const STAGE = 'cccccccc-0000-4000-8000-000000005748';

type Opts = {
    PipelineID?: string | null;
    PipelineStageID?: string | null;
    IsSaved?: boolean;
    stageDirty?: boolean;
    pipelineDirty?: boolean;
    /** The pipeline the STAGE belongs to. `undefined` means the stage row was not found. */
    stageOwnerPipelineID?: string | null;
    stageOwnerName?: string | null;
    stageName?: string | null;
    readSucceeds?: boolean;
};

function deal(opts: Opts) {
    const views: string[] = [];

    const instance = Object.create(DealEntityServer.prototype) as {
        stageBelongsToPipelineRefusal(): Promise<string | null>;
        Views: string[];
    };

    // `??` would fall through on an EXPLICIT null, which is exactly the case two tests below pin.
    Object.defineProperty(instance, 'PipelineID', { value: 'PipelineID' in opts ? opts.PipelineID : B2B, writable: true });
    Object.defineProperty(instance, 'PipelineStageID', { value: 'PipelineStageID' in opts ? opts.PipelineStageID : STAGE, writable: true });
    Object.defineProperty(instance, 'IsSaved', { value: opts.IsSaved ?? false, writable: true });
    Object.defineProperty(instance, 'ContextCurrentUser', { value: { ID: 'user' }, writable: true });

    Object.defineProperty(instance, 'GetFieldByName', {
        value: (name: string) => {
            if (name === 'PipelineStageID') return { Dirty: opts.stageDirty ?? false };
            if (name === 'PipelineID') return { Dirty: opts.pipelineDirty ?? false };
            return undefined;
        },
        writable: true,
    });

    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            RunView: async (params: { EntityName: string }) => {
                views.push(params.EntityName);
                if (opts.readSucceeds === false) {
                    return { Success: false, ErrorMessage: 'boom', Results: [] };
                }
                if (opts.stageOwnerPipelineID === undefined) {
                    return { Success: true, Results: [] }; // stage row not found
                }
                return {
                    Success: true,
                    Results: [
                        {
                            Name: opts.stageName ?? 'Introduced',
                            PipelineID: opts.stageOwnerPipelineID,
                            Pipeline: opts.stageOwnerName ?? 'D2C',
                        },
                    ],
                };
            },
        },
        writable: true,
    });

    Object.defineProperty(instance, 'Views', { get: () => views });
    return instance;
}

describe('a stage must belong to the deal\'s pipeline', () => {
    it('refuses a stage owned by another pipeline, naming both', async () => {
        const d = deal({ PipelineID: B2B, stageOwnerPipelineID: D2C, stageName: 'Introduced', stageOwnerName: 'D2C' });
        const refusal = await d.stageBelongsToPipelineRefusal();
        expect(refusal).toContain('Introduced');
        expect(refusal).toContain('D2C');
        // The message has to say what to do, not only what is wrong.
        expect(refusal).toMatch(/pick a stage|change the pipeline/i);
    });

    it('accepts a stage owned by the deal\'s own pipeline', async () => {
        const d = deal({ PipelineID: B2B, stageOwnerPipelineID: B2B });
        expect(await d.stageBelongsToPipelineRefusal()).toBeNull();
    });

    /**
     * SQL Server hands back uppercase GUIDs and client code generates lowercase. The stage-event writer
     * carried exactly this bug and recorded self-transitions because of it, so it is pinned here rather
     * than left to the next person to rediscover.
     */
    it('compares ids case-insensitively', async () => {
        const d = deal({ PipelineID: B2B.toUpperCase(), stageOwnerPipelineID: B2B.toLowerCase() });
        expect(await d.stageBelongsToPipelineRefusal()).toBeNull();
    });

    it('refuses when the stage row cannot be found', async () => {
        const d = deal({ stageOwnerPipelineID: undefined });
        expect(await d.stageBelongsToPipelineRefusal()).toContain('could not be read');
    });

    it('throws when the read itself fails, rather than passing', async () => {
        const d = deal({ readSucceeds: false });
        await expect(d.stageBelongsToPipelineRefusal()).rejects.toThrow(/could not read the stage/i);
    });
});

describe('what it declines to police', () => {
    it('says nothing about a deal with no stage — a deal may exist before anyone positions it', async () => {
        const d = deal({ PipelineStageID: null });
        expect(await d.stageBelongsToPipelineRefusal()).toBeNull();
        expect(d.Views).toEqual([]); // and does not read to find that out
    });

    it('says nothing about a deal with no pipeline — Validate() already refuses that', async () => {
        const d = deal({ PipelineID: null });
        expect(await d.stageBelongsToPipelineRefusal()).toBeNull();
        expect(d.Views).toEqual([]);
    });

    /**
     * Converted deals sit in legacy pipelines (#257) and some may already be inconsistent. Refusing a
     * rename or a note on one of those would be a rule arriving nowhere near the edit that triggered
     * it — and it would make an unrelated field uneditable on rows nobody can fix from the form.
     */
    it('leaves an existing mismatch alone when this save touches neither half', async () => {
        const d = deal({ IsSaved: true, stageDirty: false, pipelineDirty: false, stageOwnerPipelineID: D2C });
        expect(await d.stageBelongsToPipelineRefusal()).toBeNull();
        expect(d.Views).toEqual([]); // no read at all: the cheap exit is the point
    });
});

describe('what counts as stating the pair', () => {
    it('checks when the STAGE moves on an existing deal', async () => {
        const d = deal({ IsSaved: true, stageDirty: true, stageOwnerPipelineID: D2C });
        expect(await d.stageBelongsToPipelineRefusal()).toContain('belongs to');
    });

    /**
     * The half the form bug actually produces. Changing Pipeline leaves the old stage in place, so a
     * check keyed only on the stage moving would miss the exact case golive#291 reported.
     */
    it('checks when the PIPELINE moves and the stage stays put', async () => {
        const d = deal({ IsSaved: true, stageDirty: false, pipelineDirty: true, stageOwnerPipelineID: D2C });
        expect(await d.stageBelongsToPipelineRefusal()).toContain('belongs to');
    });

    it('checks a new deal even though nothing is dirty yet', async () => {
        const d = deal({ IsSaved: false, stageDirty: false, pipelineDirty: false, stageOwnerPipelineID: D2C });
        expect(await d.stageBelongsToPipelineRefusal()).toContain('belongs to');
    });
});
