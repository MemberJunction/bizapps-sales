import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A DEAL'S COMPANY MUST BE ONE ITS PIPELINE SERVES.
 *
 * A pipeline serves every company it is actively linked to through `PipelineCompany`, so the deal's
 * company is the rep's choice and can no longer be copied from the pipeline. What stays checkable is
 * that the choice is one the pipeline offers. The form only offers linked companies, but imports and
 * Actions reach `Save()` without passing through any form, and a CHECK constraint cannot reach across
 * the link — so `companyLinkedToPipelineRefusal` checks it on the write path.
 *
 * Modelled on `StageBelongsToPipeline.test.ts`: `Object.create` holds the server entity without
 * standing up metadata. It does NOT run the constructor, so everything the method reads is shadowed
 * explicitly below — a field left undefined here fails as a passing test rather than a failing one.
 */

const PIPELINE = 'aaaaaaaa-0000-4000-8000-00000000b2b0';
const COMPANY = 'cccccccc-0000-4000-8000-0000000000c1';

type Opts = {
    PipelineID?: string | null;
    CompanyID?: string | null;
    IsSaved?: boolean;
    companyDirty?: boolean;
    pipelineDirty?: boolean;
    /** Whether an active link row comes back for the pair. */
    linked?: boolean;
    readSucceeds?: boolean;
};

type ViewCall = { EntityName: string; ExtraFilter?: string; Fields?: string[] };

function deal(opts: Opts) {
    const views: ViewCall[] = [];

    const instance = Object.create(DealEntityServer.prototype) as {
        companyLinkedToPipelineRefusal(): Promise<string | null>;
        Views: ViewCall[];
    };

    // `??` would fall through on an EXPLICIT null, which is exactly the case two tests below pin.
    Object.defineProperty(instance, 'PipelineID', { value: 'PipelineID' in opts ? opts.PipelineID : PIPELINE, writable: true });
    Object.defineProperty(instance, 'CompanyID', { value: 'CompanyID' in opts ? opts.CompanyID : COMPANY, writable: true });
    Object.defineProperty(instance, 'IsSaved', { value: opts.IsSaved ?? false, writable: true });
    Object.defineProperty(instance, 'ContextCurrentUser', { value: { ID: 'user' }, writable: true });

    Object.defineProperty(instance, 'GetFieldByName', {
        value: (name: string) => {
            if (name === 'CompanyID') return { Dirty: opts.companyDirty ?? false };
            if (name === 'PipelineID') return { Dirty: opts.pipelineDirty ?? false };
            return undefined;
        },
        writable: true,
    });

    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            RunView: async (params: ViewCall) => {
                views.push(params);
                if (opts.readSucceeds === false) {
                    return { Success: false, ErrorMessage: 'boom', Results: [] };
                }
                return { Success: true, Results: opts.linked === false ? [] : [{ ID: 'link-1' }] };
            },
        },
        writable: true,
    });

    Object.defineProperty(instance, 'Views', { get: () => views });
    return instance;
}

describe('the deal\'s company must be linked to its pipeline', () => {
    it('accepts a company the pipeline is linked to', async () => {
        const d = deal({ linked: true });
        expect(await d.companyLinkedToPipelineRefusal()).toBeNull();
        expect(d.Views).toHaveLength(1);
    });

    it('refuses a company the pipeline is not linked to, and says what to do', async () => {
        const d = deal({ linked: false });
        const refusal = await d.companyLinkedToPipelineRefusal();
        expect(refusal).toContain('not available to its company');
        expect(refusal).toMatch(/pick a pipeline linked to the company|link the company to the pipeline/i);
    });

    /**
     * A retired link (`IsActive = 0`) must not count. The read is what decides it: the stub answers
     * whatever it is asked, so the filter is asserted rather than the stub's answer.
     */
    it('asks only for an ACTIVE link of this exact pair', async () => {
        const d = deal({ linked: true });
        await d.companyLinkedToPipelineRefusal();
        const [read] = d.Views;
        expect(read.EntityName).toBe('MJ_BizApps_Sales: Pipeline Companies');
        expect(read.ExtraFilter).toBe(`PipelineID = '${PIPELINE}' AND CompanyID = '${COMPANY}' AND IsActive = 1`);
    });

    it('refuses an inactive link, which the active-only read does not return', async () => {
        const d = deal({ linked: false, IsSaved: true, companyDirty: true });
        expect(await d.companyLinkedToPipelineRefusal()).toContain('not available to its company');
        expect(d.Views[0].ExtraFilter).toContain('IsActive = 1');
    });

    it('throws when the read itself fails, rather than passing', async () => {
        const d = deal({ readSucceeds: false });
        await expect(d.companyLinkedToPipelineRefusal()).rejects.toThrow(/could not read the pipeline's companies/i);
    });

    /** Both ids are pasted into a filter string; anything that is not GUID-shaped is refused before it. */
    it('refuses an id that is not GUID-shaped without reading', async () => {
        const badPipeline = deal({ PipelineID: "x' OR 1=1 --" });
        expect(await badPipeline.companyLinkedToPipelineRefusal()).toContain('pipeline on this deal is not a valid ID');
        const badCompany = deal({ CompanyID: "x' OR 1=1 --" });
        expect(await badCompany.companyLinkedToPipelineRefusal()).toContain('company on this deal is not a valid ID');
        expect([...badPipeline.Views, ...badCompany.Views]).toEqual([]);
    });
});

describe('what it declines to police', () => {
    it('says nothing about a deal with no pipeline or no company — Validate() already names those', async () => {
        for (const d of [deal({ PipelineID: null }), deal({ CompanyID: null })]) {
            expect(await d.companyLinkedToPipelineRefusal()).toBeNull();
            expect(d.Views).toEqual([]);
        }
    });

    /**
     * A deal whose link was later retired keeps saving ordinary edits: the rule arrives with the edit
     * that states the pair, not with an unrelated note on an old deal.
     */
    it('skips the read on a saved deal when neither half changes', async () => {
        const d = deal({ IsSaved: true, companyDirty: false, pipelineDirty: false, linked: false });
        expect(await d.companyLinkedToPipelineRefusal()).toBeNull();
        expect(d.Views).toEqual([]);
    });
});

describe('what counts as stating the pair', () => {
    it('checks when the COMPANY moves on an existing deal', async () => {
        const d = deal({ IsSaved: true, companyDirty: true, linked: false });
        expect(await d.companyLinkedToPipelineRefusal()).toContain('not available');
    });

    it('checks when the PIPELINE moves and the company stays put', async () => {
        const d = deal({ IsSaved: true, pipelineDirty: true, linked: false });
        expect(await d.companyLinkedToPipelineRefusal()).toContain('not available');
    });

    it('checks a new deal even though nothing is dirty yet', async () => {
        const d = deal({ IsSaved: false, linked: false });
        expect(await d.companyLinkedToPipelineRefusal()).toContain('not available');
    });
});

/**
 * FAIL CLOSED, AND SAY WHICH FAILURE IT WAS. `Save()` turns a failed read into a refusal naming the
 * lookup, so a transient failure reads as one instead of as "your company is wrong". `Save()` needs
 * the whole provider to run, so the wiring is asserted on the source, the way the stage check's is
 * pinned by its comment block.
 */
describe('how Save() uses it', () => {
    const source = readFileSync(new URL('../DealEntityServer.ts', import.meta.url), 'utf8');
    const call = source.indexOf('await this.companyLinkedToPipelineRefusal()');

    it('refuses the save when the read fails, naming the check', () => {
        expect(call, 'Save() must call the check').toBeGreaterThan(-1);
        const after = source.slice(call, call + 400);
        expect(after).toMatch(/catch \(err\) \{\s*return this\.refuseSave\(\s*`The deal's company could not be checked against its pipeline, so nothing was saved\. Try again\. ` \+\s*`Details: \$\{err\}`,\s*\);/);
        expect(after).toMatch(/if \(companyRefusal\) \{\s*return this\.refuseSave\(companyRefusal\);/);
    });

    /** The company decides the currency, so the currency default comes after the check. */
    it('runs before the currency default', () => {
        const currency = source.indexOf('await this.defaultCurrencyOnCreate();');
        expect(currency).toBeGreaterThan(call);
    });

    it('no longer copies the company from the pipeline', () => {
        expect(source).not.toContain('stampCompanyFromPipeline');
    });
});
