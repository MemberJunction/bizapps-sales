/**
 * @fileoverview `Sales.RelinkWonDealOrdersToContracts` — the daily relink of won deals' orders to their
 * contracts (contracts#77).
 *
 * Call the relink, report tallies as outputs, never throw at the caller. A refused link is a failed run,
 * so the job log shows it.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    RelinkWonDealOrdersToContracts,
    type ContractOrderRelinkResult,
} from '@mj-biz-apps/sales-core-entities-server';

function setOutput(params: RunActionParams, name: string, value: unknown): void {
    const existing = params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.Value = value;
        return;
    }
    params.Params = params.Params ?? [];
    params.Params.push({ Name: name, Value: value, Type: 'Output' } as ActionParam);
}

function describe(result: ContractOrderRelinkResult): string {
    const tallies =
        `Found ${result.Found} won deal(s) with a contract and an order: already linked ${result.AlreadyLinked}, `
        + `linked ${result.Linked}, failed ${result.Failed}.`;
    return result.Issues.length ? `${tallies} Issues: ${result.Issues.join(' | ')}` : tallies;
}

@RegisterClass(BaseAction, 'Sales.RelinkWonDealOrdersToContracts')
export class RelinkWonDealOrdersToContractsAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            return await this.relink(params);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'ERROR',
                Message: `The contract order relink failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    private async relink(params: RunActionParams): Promise<ActionResultSimple> {
        const result = await RelinkWonDealOrdersToContracts(Metadata.Provider, params.ContextUser);

        setOutput(params, 'Found', result.Found);
        setOutput(params, 'AlreadyLinked', result.AlreadyLinked);
        setOutput(params, 'Linked', result.Linked);
        setOutput(params, 'Failed', result.Failed);
        setOutput(params, 'Issues', JSON.stringify(result.Issues));

        return {
            Success: result.Success,
            ResultCode: result.Outcome,
            Message: result.Outcome === 'SKIPPED' || result.Outcome === 'QUERY_FAILED' ? result.Issues.join(' ') : describe(result),
        };
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadRelinkWonDealOrdersToContractsAction(): void {
    void RelinkWonDealOrdersToContractsAction;
}
