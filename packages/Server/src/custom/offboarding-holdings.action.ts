/**
 * @fileoverview `Sales.ListOffboardingHoldings` and `Sales.ReassignOffboardingHoldings` — sales' half of
 * the offboarding screen (golive #297).
 *
 * Both sit in common's "Offboarding Holdings" Action category, which the screen runs by category, so
 * neither app depends on the other at compile time. The work is in
 * `sales-core-entities-server`'s `OffboardingHoldings`; these classes read the params, call it, and
 * write the outputs. Neither throws at the caller.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    ListSalesOffboardingHoldings,
    ParseStringList,
    ReassignSalesOffboardingHoldings,
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

function inputValue(params: RunActionParams, name: string): unknown {
    return params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase() && p.Type !== 'Output')?.Value;
}

function inputString(params: RunActionParams, name: string): string | null {
    const value = inputValue(params, name);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function failure(error: unknown, what: string): ActionResultSimple {
    return {
        Success: false,
        ResultCode: 'ERROR',
        Message: `${what} failed: ${error instanceof Error ? error.message : String(error)}`,
    };
}

@RegisterClass(BaseAction, 'Sales.ListOffboardingHoldings')
export class ListOffboardingHoldingsAction extends BaseAction {
    /**
     * This class checks its caller itself: every read runs as the caller, so their entity permissions
     * decide what is listed, and `CanReassign` reflects the supervisor / Sales Admin rule. MJ reads this
     * as an OWN static property, so each class declares it.
     */
    public static override readonly AuthorizesCaller = true;

    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            const result = await ListSalesOffboardingHoldings(
                { LeaverUserID: inputString(params, 'LeaverUserID'), LeaverEmployeeID: inputString(params, 'LeaverEmployeeID') },
                params.ContextUser,
                Metadata.Provider,
            );
            setOutput(params, 'Holdings', JSON.stringify(result.Holdings));
            return { Success: result.Outcome === 'SUCCESS', ResultCode: result.Outcome, Message: result.Message };
        } catch (error) {
            return failure(error, 'Listing sales holdings');
        }
    }
}

@RegisterClass(BaseAction, 'Sales.ReassignOffboardingHoldings')
export class ReassignOffboardingHoldingsAction extends BaseAction {
    /**
     * This class checks its caller itself: each item is re-checked on the server against the
     * supervisor / Sales Admin rule, and saves run as the caller so entity permissions apply. MJ reads
     * this as an OWN static property, so each class declares it.
     */
    public static override readonly AuthorizesCaller = true;

    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            const kinds = ParseStringList(inputValue(params, 'Kinds'));
            const recordIDs = ParseStringList(inputValue(params, 'RecordIDs'));
            if (kinds === undefined || recordIDs === undefined) {
                setOutput(params, 'Moved', 0);
                setOutput(params, 'Skipped', '[]');
                return { Success: false, ResultCode: 'INVALID_INPUT', Message: 'Kinds and RecordIDs must be JSON arrays of strings.' };
            }
            const result = await ReassignSalesOffboardingHoldings(
                {
                    LeaverUserID: inputString(params, 'LeaverUserID'),
                    LeaverEmployeeID: inputString(params, 'LeaverEmployeeID'),
                    SuccessorUserID: inputString(params, 'SuccessorUserID'),
                    Kinds: kinds,
                    RecordIDs: recordIDs,
                },
                Metadata.Provider,
                params.ContextUser,
            );
            setOutput(params, 'Moved', result.Moved);
            setOutput(params, 'Skipped', JSON.stringify(result.Skipped));
            return { Success: result.Outcome === 'SUCCESS', ResultCode: result.Outcome, Message: result.Message };
        } catch (error) {
            return failure(error, 'Reassigning sales holdings');
        }
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadOffboardingHoldingsActions(): void {
    void ListOffboardingHoldingsAction;
    void ReassignOffboardingHoldingsAction;
}
