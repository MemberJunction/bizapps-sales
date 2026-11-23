/**
 * @fileoverview "No executed agreement" — the contract lookup and the warning rule, shared by the
 * order header and the deal hero (golive #443, #490).
 *
 * The order header warned since #443; a won deal said nothing, so the person who closed the deal never
 * learned the signed agreement still had to be uploaded and marked on the contract. Both surfaces now
 * find the deal's contract the same way and decide the warning with the same rule, so they cannot
 * disagree about the same contract.
 *
 * The two differ in one place, on purpose: the order also warns when a won deal has NO contract, the
 * deal does not. On the order that gap means an invoice is about to go out with no agreement behind
 * it. On the deal, a missing contract is usually a pipeline that creates none, and the deal prompt
 * exists to send someone to a contract's executed-agreement section, which needs a contract.
 *
 * Plain functions, as in `order-related-links.ts`, so the rule is tested without Angular.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { RunViewParams, RunViewResult } from '@memberjunction/core';
import { EscapeSQLString } from '@memberjunction/global';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

/** The columns of `vwContracts` the warning and the order header's contract chip read. */
export interface OrderContractRow {
    ID: string;
    ContractNumber: string | null;
    /** `vwContracts.State`: Draft, Executed, Active, Expired, Superseded or Terminated. */
    State: string | null;
    /**
     * `vwContracts.IsAwaitingDocument`: the contract's type requires executed paper and no file in the
     * Executed Agreement category is linked. Always false for a type that needs no paper (Payment Link).
     */
    IsAwaitingDocument: boolean | null;
}

/** The warning chip's text and its longer explanation. */
export interface OrderAgreementWarning {
    Label: string;
    Detail: string;
}

/** What the warning needs to know. The order header's state carries all of it; the deal's carries the first four. */
export interface ExecutedAgreementWarningState {
    /** The deal behind the order, or the deal being shown. */
    DealID?: string | null;
    /** `DealStatusType.IsWon` of the PERSISTED status. Unknown (absent) when it could not be read. */
    DealIsWon?: boolean | null;
    /**
     * `true` once the contract lookup ANSWERED, found or not. A refused or thrown read leaves it unset,
     * and the warning then stays silent rather than claiming a contract is missing.
     */
    ContractRead?: boolean;
    /** The contract the lookup found, or null when it answered with none. */
    Contract?: OrderContractRow | null;
    /** Order only: the deal was reached through the order this one reverses. */
    ViaReversedOrder?: boolean;
    /** Order only: the order is voided. */
    OrderVoided?: boolean;
}

/** Which form is asking: the order header or the deal hero. */
export type ExecutedAgreementSurface = 'order' | 'deal';

/** The entity name contracts stamps in `CreatingEntityID` for a contract a deal's close created. */
const DEAL_ENTITY_NAME = MJS_ENTITIES.Deal;

/** `true` for a value that actually names a record. */
function holds(id: string | null | undefined): id is string {
    return id != null && String(id).trim().length > 0;
}

/**
 * The filter that finds the contract behind a deal (golive#445).
 *
 * `Deal.ContractID` first: it is the link the close wrote. When it is empty, the contract the deal's
 * close created is still findable by its polymorphic provenance pair, `CreatingEntity` = Deals and
 * `CreatingRecordID` = the deal (`LiveContractsSeam` stamps both). An empty `ContractID` with a contract
 * behind it is a deal whose link was never written. `null` when there is no deal to look by.
 */
export function ContractLookupFilter(deal: { DealID?: string | null; ContractID?: string | null }): string | null {
    if (holds(deal.ContractID)) {
        return `ID = '${EscapeSQLString(deal.ContractID)}'`;
    }
    if (!holds(deal.DealID)) {
        return null;
    }
    return `CreatingEntity = '${EscapeSQLString(DEAL_ENTITY_NAME)}' AND CreatingRecordID = '${EscapeSQLString(deal.DealID)}'`;
}

/**
 * The read that finds a deal's contract, newest first so a deal whose close was re-run shows its
 * latest. `null` when there is no deal to look by. A caller may batch it with other reads.
 */
export function ContractLookupParams(deal: { DealID?: string | null; ContractID?: string | null }): RunViewParams | null {
    const filter = ContractLookupFilter(deal);
    if (!filter) return null;
    return {
        EntityName: MJS_FOREIGN_ENTITIES.Contract,
        Fields: ['ID', 'ContractNumber', 'State', 'IsAwaitingDocument'],
        ExtraFilter: filter,
        OrderBy: '__mj_CreatedAt DESC',
        MaxRows: 1,
        ResultType: 'simple',
    };
}

/**
 * What a contract lookup learned. `ContractRead` is true only when the read answered, so a refusal
 * (contracts not installed, no read permission) never reads as "no contract".
 */
export function ContractLookupResult(result: RunViewResult | null | undefined): Pick<ExecutedAgreementWarningState, 'Contract' | 'ContractRead'> {
    const contract = (result?.Success ? (result.Results?.[0] as OrderContractRow | undefined) : undefined) ?? null;
    return { Contract: contract, ContractRead: result?.Success === true };
}

/**
 * The "No executed agreement" warning (golive #443 for the order, #490 for the deal; warn only, nothing
 * is blocked).
 *
 * - ONLY FOR A WON DEAL. An open or lost deal has no agreement to expect yet.
 * - THE GAP is a contract `vwContracts` reports as awaiting its executed agreement. A contract type that
 *   needs no paper (`RequiresExecutedDocument = 0`, Payment Link) never reports awaiting, so it counts
 *   as covered. On the ORDER only, no contract at all is a gap too (see the file header).
 * - SILENT WHEN UNSURE. A deal status or contract lookup that did not answer produces no warning: a
 *   chip saying "no contract" because a read was refused would be a false alarm people learn to skip.
 * - ORDER ONLY: a reversal reaches the deal through the order it reverses and is skipped, since the
 *   deal names the original order; a voided order sends no invoice, so "Invoices still send" would be
 *   untrue. Apart from voided, the order's status is not consulted: a draft order of a won deal warns,
 *   which is when the gap can still be closed before sending.
 */
export function NoExecutedAgreementWarning(
    state: ExecutedAgreementWarningState,
    surface: ExecutedAgreementSurface = 'order',
): OrderAgreementWarning | null {
    if (!holds(state.DealID) || state.DealIsWon !== true || state.ContractRead !== true) {
        return null;
    }
    if (surface === 'order' && (state.ViaReversedOrder === true || state.OrderVoided === true)) {
        return null;
    }
    const contract = state.Contract;
    if (!contract) {
        if (surface === 'deal') return null;
        return { Label: 'No executed agreement', Detail: 'This order comes from a won deal with no contract. Invoices still send.' };
    }
    if (contract.IsAwaitingDocument !== true) {
        return null;
    }
    if (surface === 'deal') {
        return {
            Label: 'No executed agreement',
            Detail: 'The contract has no file marked as its executed agreement. Open the contract and upload and mark the signed agreement in its Executed agreement section.',
        };
    }
    return { Label: 'No executed agreement', Detail: 'The contract has no file marked as its executed agreement. Invoices still send.' };
}
