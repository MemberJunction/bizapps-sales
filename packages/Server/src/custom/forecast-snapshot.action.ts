/**
 * @fileoverview `Sales.CaptureForecastSnapshot` — the daily snapshot Action (#40).
 *
 * Read the params, call the snapshot job, report tallies as outputs, never throw at the caller.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { RunForecastSnapshot, type ForecastPeriod } from '@mj-biz-apps/sales-core-entities-server';

const P_PERIOD_START = 'PeriodStart';
const P_PERIOD_END = 'PeriodEnd';

function readParam(params: RunActionParams, name: string): unknown {
    return params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase())?.Value;
}

function setOutput(params: RunActionParams, name: string, value: unknown): void {
    const existing = params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.Value = value;
        return;
    }
    params.Params = params.Params ?? [];
    params.Params.push({ Name: name, Value: value, Type: 'Output' } as ActionParam);
}

/** A supplied date, or null. Refuses a value it cannot parse rather than substituting today. */
function readDate(params: RunActionParams, name: string): Date | null {
    const raw = readParam(params, name);
    if (raw === null || raw === undefined || raw === '') {
        return null;
    }
    const parsed = new Date(String(raw));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

@RegisterClass(BaseAction, 'Sales.CaptureForecastSnapshot')
export class CaptureForecastSnapshotAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            return await this.capture(params);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'ERROR',
                Message: `The forecast snapshot failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    private async capture(params: RunActionParams): Promise<ActionResultSimple> {
        /**
         * BOTH DATES OR NEITHER. A start with no end (or the reverse) is an incomplete instruction, and
         * filling in the missing half from the current month would silently snapshot a window nobody asked
         * for — attributing measures to the wrong period, which is exactly what a forecast series cannot
         * survive. Omitting both is the ordinary case and means "the current month".
         */
        const start = readDate(params, P_PERIOD_START);
        const end = readDate(params, P_PERIOD_END);
        if ((start && !end) || (!start && end)) {
            return {
                Success: false,
                ResultCode: 'BAD_PERIOD',
                Message:
                    `Supply both ${P_PERIOD_START} and ${P_PERIOD_END}, or neither. One alone would have to be `
                    + 'paired with an invented boundary, and the snapshot would be filed against a period '
                    + 'nobody chose.',
            };
        }

        const period: ForecastPeriod | undefined =
            start && end ? { PeriodStart: start, PeriodEnd: end } : undefined;

        const result = await RunForecastSnapshot(Metadata.Provider, params.ContextUser, new Date(), period);

        setOutput(params, 'Measured', result.Measured);
        setOutput(params, 'Written', result.Written);
        setOutput(params, 'SkippedAsAlreadyCaptured', result.SkippedAsAlreadyCaptured);
        setOutput(params, 'PeriodStart', result.Period?.PeriodStart ?? null);
        setOutput(params, 'PeriodEnd', result.Period?.PeriodEnd ?? null);
        setOutput(params, 'Issues', JSON.stringify(result.Issues));

        /**
         * NO SOURCE IS A SUCCESS, and says so. Until the forecast queries land there is nothing to read,
         * and a daily job reporting failure for that would be red from the day it shipped — which is how a
         * job log stops being read before it ever has anything to say.
         */
        if (!result.Period) {
            return {
                Success: true,
                ResultCode: 'NO_SOURCE',
                Message:
                    'No forecast source is registered, so nothing was captured. The chain is wired; the MJ '
                    + 'Queries it reads from do not exist yet.',
            };
        }

        return {
            Success: result.Success,
            ResultCode: result.Success ? 'SUCCESS' : 'PARTIAL',
            Message:
                `Period ${result.Period.PeriodStart} to ${result.Period.PeriodEnd}: measured `
                + `${result.Measured}, wrote ${result.Written}, skipped `
                + `${result.SkippedAsAlreadyCaptured} already captured today.`
                + (result.Issues.length ? ` Issues: ${result.Issues.join(' | ')}` : ''),
        };
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadCaptureForecastSnapshotAction(): void {
    void CaptureForecastSnapshotAction;
}
