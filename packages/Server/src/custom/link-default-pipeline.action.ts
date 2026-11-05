/**
 * @fileoverview `Sales.LinkDefaultPipelineToCompanies` — links the default pipeline to every company
 * that has no link to it (#327).
 *
 * Call the link job, report tallies as outputs, never throw at the caller. Re-runnable: a company that
 * already has a link is skipped, so an admin runs it again after adding a company.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { LinkDefaultPipelineToCompanies, type PipelineLinkResult } from '@mj-biz-apps/sales-core-entities-server';

function setOutput(params: RunActionParams, name: string, value: unknown): void {
    const existing = params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.Value = value;
        return;
    }
    params.Params = params.Params ?? [];
    params.Params.push({ Name: name, Value: value, Type: 'Output' } as ActionParam);
}

function describe(result: PipelineLinkResult): string {
    const tallies =
        `Linked the default pipeline to ${result.Linked} of ${result.Companies} company(ies); `
        + `${result.AlreadyLinked} already had a link.`;
    return result.Issues.length ? `${tallies} Issues: ${result.Issues.join(' | ')}` : tallies;
}

@RegisterClass(BaseAction, 'Sales.LinkDefaultPipelineToCompanies')
export class LinkDefaultPipelineToCompaniesAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            return await this.link(params);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'ERROR',
                Message: `Linking the default pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    private async link(params: RunActionParams): Promise<ActionResultSimple> {
        const result = await LinkDefaultPipelineToCompanies(Metadata.Provider, params.ContextUser);

        setOutput(params, 'Companies', result.Companies);
        setOutput(params, 'Linked', result.Linked);
        setOutput(params, 'AlreadyLinked', result.AlreadyLinked);
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
export function LoadLinkDefaultPipelineToCompaniesAction(): void {
    void LinkDefaultPipelineToCompaniesAction;
}
