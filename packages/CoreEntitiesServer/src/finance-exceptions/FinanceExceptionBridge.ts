/**
 * The one place sales reaches into accounting's finance exception operations (golive #279).
 *
 * Accounting owns the exception tables and the operations that read and write them. Sales resolves
 * those operations BY NAME through the class factory, with no build-time dependency on the accounting
 * server package, the same way bizapps-orders reaches `Accounting.CreateJournalEntries`. The input and
 * output shapes below are the agreed contract, declared here structurally; they are not imported.
 *
 * An unregistered operation throws: a detector that quietly did nothing because accounting was not
 * loaded would look exactly like a night with no exceptions.
 */
import { BaseRemotableOperation, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';

export const OP_GET_FINANCE_EXCEPTION_TYPES = 'Accounting.GetFinanceExceptionTypes';
export const OP_RAISE_FINANCE_EXCEPTIONS = 'Accounting.RaiseFinanceExceptions';

export interface FinanceExceptionError {
    Index?: number;
    Code: string;
    Message: string;
}

export interface GetFinanceExceptionTypesInput {
    Codes?: string[];
}

export interface FinanceExceptionTypeInfo {
    Code: string;
    IsActive: boolean;
    Configuration: Record<string, unknown>;
}

export interface GetFinanceExceptionTypesOutput {
    Success: boolean;
    Types: FinanceExceptionTypeInfo[];
    Errors?: FinanceExceptionError[];
}

export interface FinanceExceptionToRaise {
    TypeCode: string;
    /** MJ entity name; accounting resolves it to SourceEntityID. */
    SourceEntityName: string;
    SourceRecordID: string;
    CompanyID: string;
    Amount?: number | null;
    /** YYYY-MM-DD. */
    ExceptionDate: string;
    Summary: string;
    DedupeKey: string;
    SourceCreatedByUserID?: string | null;
    /** True when a creator exists but no single login is linked to it. */
    CreatorUnresolved?: boolean;
}

export interface RaiseFinanceExceptionsInput {
    Exceptions: FinanceExceptionToRaise[];
}

export interface RaiseFinanceExceptionResult {
    Index: number;
    FinanceExceptionID?: string;
    Created: boolean;
    Skipped?: boolean;
}

export interface RaiseFinanceExceptionsOutput {
    Success: boolean;
    Results: RaiseFinanceExceptionResult[];
    Errors?: FinanceExceptionError[];
}

/**
 * Resolve an accounting operation by key, throwing when accounting's server package is not loaded.
 *
 * `TryCreateInstance`, not `CreateInstance`: `BaseRemotableOperation` is not marked as requiring a
 * subclass, so `CreateInstance` for an unregistered key returns a hollow base instance rather than
 * null, and a null check never fires.
 */
function resolveOperation<I, O>(key: string): BaseRemotableOperation<I, O> {
    const res = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseRemotableOperation<I, O>>(
        BaseRemotableOperation,
        key,
    );
    if (!res.Resolved || !res.Instance) {
        throw new Error(
            `The '${key}' operation is not registered. The BizApps Accounting server package must be `
                + 'loaded before sales can read or raise finance exceptions.',
        );
    }
    return res.Instance;
}

/**
 * Run an accounting operation and return its payload.
 *
 * The envelope reports transport and authorization failure and is thrown. The payload's own
 * `Success` is the accounting-domain outcome and is returned for the caller to judge, because a
 * nightly detector reports a refused raise rather than dying on it.
 */
async function executeOperation<I, O>(
    key: string,
    input: I,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<O> {
    const op = resolveOperation<I, O>(key);
    const result = await op.Execute(input, { provider, user });
    if (!result.Success) {
        throw new Error(`${key} did not execute: ${result.ErrorMessage ?? result.ResultCode ?? 'unknown error'}`);
    }
    if (!result.Output) {
        throw new Error(`${key} returned no payload.`);
    }
    return result.Output;
}

export function GetFinanceExceptionTypes(
    input: GetFinanceExceptionTypesInput,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<GetFinanceExceptionTypesOutput> {
    return executeOperation<GetFinanceExceptionTypesInput, GetFinanceExceptionTypesOutput>(
        OP_GET_FINANCE_EXCEPTION_TYPES,
        input,
        provider,
        user,
    );
}

export function RaiseFinanceExceptions(
    input: RaiseFinanceExceptionsInput,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<RaiseFinanceExceptionsOutput> {
    return executeOperation<RaiseFinanceExceptionsInput, RaiseFinanceExceptionsOutput>(
        OP_RAISE_FINANCE_EXCEPTIONS,
        input,
        provider,
        user,
    );
}

/** One line per payload error, for a job log. */
export function DescribeFinanceExceptionErrors(errors: FinanceExceptionError[] | undefined): string {
    return (errors ?? [])
        .map((e) => `${e.Index === undefined ? '' : `[${e.Index}] `}${e.Code}: ${e.Message}`)
        .join('; ');
}
