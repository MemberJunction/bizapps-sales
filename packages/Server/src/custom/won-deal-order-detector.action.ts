/**
 * @fileoverview `Sales.DetectWonDealsWithUnconfirmedOrders` — the nightly finance exception check for
 * won deals whose order was never confirmed (golive #279, type 3).
 *
 * Call the detector, report tallies as outputs, never throw at the caller. A refused raise is a failed
 * run, so the job log shows it rather than a green night with nothing written.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    DetectWonDealsWithUnconfirmedOrders,
    type WonDealDetectionResult,
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

function describe(result: WonDealDetectionResult): string {
    const tallies =
        `Found ${result.Found} won deal(s) with an unconfirmed order: created ${result.Created}, `
        + `already raised ${result.AlreadyRaised}, skipped by accounting ${result.SkippedByAccounting}, `
        + `creator unresolved ${result.CreatorUnresolved}.`;
    return result.Issues.length ? `${tallies} Issues: ${result.Issues.join(' | ')}` : tallies;
}

@RegisterClass(BaseAction, 'Sales.DetectWonDealsWithUnconfirmedOrders')
export class DetectWonDealsWithUnconfirmedOrdersAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            return await this.detect(params);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'ERROR',
                Message: `The won-deal finance exception check failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    private async detect(params: RunActionParams): Promise<ActionResultSimple> {
        const result = await DetectWonDealsWithUnconfirmedOrders(Metadata.Provider, params.ContextUser);

        setOutput(params, 'Found', result.Found);
        setOutput(params, 'Created', result.Created);
        setOutput(params, 'AlreadyRaised', result.AlreadyRaised);
        setOutput(params, 'SkippedByAccounting', result.SkippedByAccounting);
        setOutput(params, 'CreatorUnresolved', result.CreatorUnresolved);
        setOutput(params, 'Issues', JSON.stringify(result.Issues));

        return {
            Success: result.Success,
            ResultCode: result.Outcome,
            Message: result.Outcome === 'SKIPPED' ? result.Issues.join(' ') : describe(result),
        };
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadDetectWonDealsWithUnconfirmedOrdersAction(): void {
    void DetectWonDealsWithUnconfirmedOrdersAction;
}
