/**
 * @fileoverview `Sales.CopyDefaultPipelineToCompanies` — gives every company its own copy of the
 * default pipeline and its stages (#327).
 *
 * Call the copy job, report tallies as outputs, never throw at the caller. Re-runnable: a company that
 * already has the pipeline is skipped, so an admin runs it again after adding a company.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { CopyDefaultPipelineToCompanies, type PipelineCopyResult } from '@mj-biz-apps/sales-core-entities-server';

function setOutput(params: RunActionParams, name: string, value: unknown): void {
    const existing = params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.Value = value;
        return;
    }
    params.Params = params.Params ?? [];
    params.Params.push({ Name: name, Value: value, Type: 'Output' } as ActionParam);
}

function describe(result: PipelineCopyResult): string {
    const tallies =
        `Copied the default pipeline to ${result.Created} of ${result.Companies} company(ies) `
        + `(${result.StagesCopied} stages); ${result.AlreadyHad} already had it.`;
    return result.Issues.length ? `${tallies} Issues: ${result.Issues.join(' | ')}` : tallies;
}

@RegisterClass(BaseAction, 'Sales.CopyDefaultPipelineToCompanies')
export class CopyDefaultPipelineToCompaniesAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            return await this.copy(params);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'ERROR',
                Message: `Copying the default pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    private async copy(params: RunActionParams): Promise<ActionResultSimple> {
        const result = await CopyDefaultPipelineToCompanies(Metadata.Provider, params.ContextUser);

        setOutput(params, 'Companies', result.Companies);
        setOutput(params, 'Created', result.Created);
        setOutput(params, 'AlreadyHad', result.AlreadyHad);
        setOutput(params, 'StagesCopied', result.StagesCopied);
        setOutput(params, 'Issues', JSON.stringify(result.Issues));

        const refused = result.Outcome === 'NO_DEFAULT' || result.Outcome === 'AMBIGUOUS_DEFAULT';
        return {
            Success: result.Success,
            ResultCode: result.Outcome,
            Message: refused ? result.Issues.join(' ') : describe(result),
        };
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadCopyDefaultPipelineToCompaniesAction(): void {
    void CopyDefaultPipelineToCompaniesAction;
}
