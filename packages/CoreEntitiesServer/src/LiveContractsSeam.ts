/**
 * @fileoverview The REAL contracts handoff — what `StubDownstreamSeam` stood in for on the D-CF4 path.
 *
 * ── WHY THIS CALLS AN OPERATION AND NOT THE ENTITY GRAPH ────────────────────────────────────────
 *
 * Worth stating plainly, because it is the OPPOSITE of the decision made for orders and the difference
 * is not arbitrary.
 *
 * Orders ships **no** create-order operation, so `LiveOrdersSeam` drives orders' entity graph by hand —
 * that graph IS orders' canonical creation path. Contracts is the mirror image: it ships
 * `Contracts.SaveContract`, whose `SaveContractOperation` performs the whole composition internally
 * (`MarkTermsAuthoritative` -> `CreateTerm` -> `term.CreateLine` -> one atomic `Save`). Driving those
 * methods from here would not be "using contracts' canonical path" — it would be re-implementing the
 * operation outside its own transaction.
 *
 * `Contracts.RenewTerm` exists too, so the D-CF4 stub retires COMPLETELY rather than by half.
 *
 * ── DEVIATION FROM CONTRACTS' OWN GUIDANCE, DELIBERATE ──────────────────────────────────────────
 *
 * Contracts' guidance says server-side callers should use `ContractEntityServer.Save()`. This does not,
 * for three reasons worth recording for the contracts team:
 *
 *   1. Those composition methods live on the SERVER SUBCLASS. An import-free caller can only reach them
 *      structurally — describing another app's class shape by hand and hoping it stays true.
 *   2. `SaveContractOperation` is the transaction. Calling it is using contracts' composition; calling
 *      its parts is copying it.
 *   3. The guidance assumes a TYPED caller. Sales must not import `@mj-biz-apps/contracts-*` at all, so
 *      the premise does not hold here — the operation key is a string, which is exactly the coupling
 *      Sales can afford.
 *
 * ── THE MONEY BOUNDARY ──────────────────────────────────────────────────────────────────────────
 *
 * Sales sends `ProductID`, quantity and term structure. It sets NO per-line unit price — contracts
 * prices each line from the product inside `SaveContract`. A negotiated `CommittedAmount` rides on the
 * TERM as stated intent, never as a computed line total, and nothing in this file multiplies, sums or
 * rounds anything.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseRemotableOperation,
    Metadata,
    RunView,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import type {
    ContractsCreateFromDealSeamInput,
    ContractsRenewTermSeamInput,
    ContractsSeamResult,
} from '@mj-biz-apps/sales-entities';

/** Contracts' entity name — the string is the whole dependency. */
const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';

/** ClassFactory registration keys, not display names ("Save Contract" is the metadata label). */
const OP_SAVE_CONTRACT = 'Contracts.SaveContract';
const OP_RENEW_TERM = 'Contracts.RenewTerm';

/** Contracts' own type table — sales names a CODE and lets contracts own the vocabulary. */
const E_CONTRACT_TYPE = 'MJ_BizApps_Contracts: Contract Types';

/**
 * True when contracts is actually installed here.
 *
 * Checked against METADATA rather than by catching an error, for the same reason `OrdersIsInstalled`
 * is: asking for an unregistered entity does not fail cleanly. Sales runs standalone by design, so
 * contracts being absent is a supported state, not a fault.
 */
export function ContractsIsInstalled(): boolean {
    return new Metadata().Entities.some((e) => e.Name === E_CONTRACT);
}

/** The subset of `SaveContractInput` Sales can honestly state. */
interface SaveContractPayload {
    Contract: {
        ContractTypeID: string;
        CompanyID: string;
        CustomerOrganizationID?: string | null;
        CustomerPersonID?: string | null;
        OwnerUserID?: string | null;
        Status: string;
        Description?: string | null;
        EffectiveDate?: string | null;
        AutoRenew?: boolean;
        Terms: Array<{
            StartDate: string;
            EndDate: string;
            Status: string;
            BillingFrequency: string;
            CommittedAmount?: number | null;
            Lines: Array<{ ProductID: string; Quantity: number; LineType: string; Description?: string | null }>;
        }>;
    };
}

export class LiveContractsSeam {
    public readonly IsLive = true;

    public constructor(
        private readonly user: UserInfo,
        private readonly provider: IMetadataProvider,
    ) {}

    /** Runs one of contracts' operations by key, or explains why it could not. */
    private async run(key: string, input: unknown): Promise<{ ok: boolean; output?: unknown; message?: string }> {
        const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation>(BaseRemotableOperation, key);
        if (!op) {
            return { ok: false, message: `${key} is not registered in this process.` };
        }
        const result = await op.ExecuteServer(input, {
            provider: this.provider,
            user: this.user,
            // Required by the context and unused by a Sync operation.
            emitProgress: () => undefined,
        });
        if (!result?.Success) {
            return { ok: false, message: result?.ErrorMessage ?? `${key} failed.` };
        }
        /**
         * THE ENVELOPE IS NOT THE ANSWER, and trusting it silently reports success on a failure.
         *
         * `RemoteOpResult.Success` means "the operation ran". Contracts' operations carry their OWN
         * `Success` + `Message` in the payload, and a refused save comes back as
         * `{ Success: true, Output: { Success: false, Message: "Could not save contract: …" } }`.
         * An earlier version of this seam checked only the envelope and cheerfully returned
         * `Success: true` with a null ContractID for a contract that was never written.
         */
        const inner = (result.Output ?? {}) as { Success?: boolean; Message?: string };
        if (inner.Success === false) {
            return { ok: false, message: inner.Message ?? `${key} reported failure.` };
        }
        return { ok: true, output: result.Output };
    }

    /**
     * Create the agreement a won deal earned.
     *
     * Status is `Pending` on purpose: §7.2 wants nothing to fire until a human approves, so a close can
     * never start billing by itself. The term carries the deal's dates and any negotiated committed
     * amount; the lines carry only product and quantity.
     */
    public async CreateContractFromDeal(input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult> {
        if (!ContractsIsInstalled()) {
            return { Success: false, Message: 'bizapps-contracts is not installed in this deployment.' };
        }
        /**
         * Resolve the type CODE to an ID here, not in Sales.
         *
         * The policy names a code (`CloseWonPolicy.ContractTypeCode`) because sales does not know
         * contracts' type vocabulary and must not hardcode its UUIDs — the same reason every other
         * lookup in this app resolves by flag or code rather than by a baked identifier.
         */
        const contractTypeID = await this.resolveContractTypeID(input.ContractTypeCode);
        if (!contractTypeID) {
            return {
                Success: false,
                Message: `No contract type matches code '${input.ContractTypeCode ?? '(none)'}' in contracts.`,
            };
        }

        const start = input.StartDate ?? new Date().toISOString().slice(0, 10);
        const months = input.TermMonths ?? 12;
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + months);

        const payload: SaveContractPayload = {
            Contract: {
                ContractTypeID: contractTypeID,
                CompanyID: input.CompanyID,
                CustomerOrganizationID: input.AccountID ?? null,
                CustomerPersonID: input.PrimaryContactID ?? null,
                // No OwnerUserID: sales holds an EMPLOYEE (Deal.OwnerEmployeeID), and guessing a
                // user from it would be a mapping sales cannot make correctly. Left for contracts.
                OwnerUserID: null,
                /**
                 * `Draft`, not `Pending` — `CK_Contract_Status` allows Draft / PendingSignature /
                 * Active / Expired / Terminated / Superseded, and `Pending` is a TERM status, not a
                 * contract one. Draft is the §7.2 intent: the agreement exists, nothing fires, and a
                 * human moves it on.
                 */
                Status: 'Draft',
                Description: input.ContractVariances ?? null,
                EffectiveDate: input.ExecutionDate ?? null,
                AutoRenew: input.AutoRenew ?? false,
                Terms: [
                    {
                        StartDate: start,
                        EndDate: end.toISOString().slice(0, 10),
                        Status: 'Pending',
                        BillingFrequency: input.BillingFrequency ?? 'Monthly',
                        /**
                         * ZERO MEANS "NOTHING WAS COMMITTED", AND THAT IS A STATEMENT, NOT A PRICE.
                         *
                         * Contracts requires this and says why in its own validation: "State the amount
                         * committed for this term. Zero is a valid answer; blank is not." So
                         * `CommittedAmount` is a NEGOTIATED COMMITMENT — what the customer undertakes to
                         * spend — not a computed value. Contracts still prices the lines from ProductID.
                         *
                         * Sales does not compute it and must not pass `Deal.Amount`: that is ORDERS'
                         * cached figure for the WHOLE deal, including one-time lines routed to an order,
                         * so using it here would both overstate the contract and launder an orders number
                         * into a contracts field. A deal that negotiated no minimum commits nothing, and
                         * 0 says exactly that. A real negotiated commitment would be captured on the deal
                         * as its own intent field — which does not exist yet.
                         */
                        CommittedAmount: input.CommittedAmount ?? 0,
                        Lines: (input.Lines ?? []).map((l) => ({
                            ProductID: String(l.ProductID ?? ''),
                            Quantity: Number(l.Quantity ?? 1),
                            /**
                             * `Minimum`, and NOT `Subscription`, for a reason worth recording.
                             *
                             * `CK_ContractLine_LineType` allows Minimum / Usage / Milestone / OneTime /
                             * Subscription, and a second constraint requires `SubscriptionTypeID` to be
                             * set whenever the type IS `Subscription`. Sales does not hold a
                             * subscription type — that is orders' vocabulary and no deal field carries
                             * it — so claiming `Subscription` would either violate the constraint or
                             * make sales invent an instrument it knows nothing about.
                             *
                             * `Minimum` says what sales actually knows: a committed recurring line.
                             * When the deal one day carries a subscription type, pass it through and
                             * this becomes `Subscription` honestly.
                             */
                            LineType: 'Minimum',
                            Description: l.Description ?? null,
                        })),
                    },
                ],
            },
        };

        const r = await this.run(OP_SAVE_CONTRACT, payload);
        if (!r.ok) {
            return { Success: false, Message: r.message };
        }
        // `SaveContractOutput` nests the record under `Contract` — not flat, as an earlier guess had it.
        const out = (r.output ?? {}) as { Contract?: { ID?: string; ContractNumber?: string; Status?: string } };
        const c = out.Contract ?? {};
        return {
            Success: true,
            ContractID: c.ID ?? null,
            Status: c.Status ?? 'Draft',
            Message: `Contract ${c.ContractNumber ?? c.ID ?? ''} created by Sales.CloseDeal.`.trim(),
        };
    }

    /** The contract type whose code the policy named, or null when contracts has no such code. */
    private async resolveContractTypeID(code?: string | null): Promise<string | null> {
        if (!code) {
            return null;
        }
        const r = await new RunView().RunView<{ ID: string }>(
            {
                EntityName: E_CONTRACT_TYPE,
                ExtraFilter: `Code = '${String(code).replace(/'/g, "''")}'`,
                ResultType: 'simple',
                Fields: ['ID'],
            },
            this.user,
        );
        return r?.Success ? ((r.Results ?? [])[0]?.ID ?? null) : null;
    }

    /** The renewal door: an existing contract gains a term rather than a new agreement being written. */
    public async RenewContractTerm(input: ContractsRenewTermSeamInput): Promise<ContractsSeamResult> {
        if (!ContractsIsInstalled()) {
            return { Success: false, Message: 'bizapps-contracts is not installed in this deployment.' };
        }
        if (!input.ContractID) {
            return { Success: false, Message: 'A renewal needs the contract being renewed (Deal.RenewsContractID).' };
        }

        const r = await this.run(OP_RENEW_TERM, {
            ContractID: input.ContractID,
            TermMonths: input.TermMonths ?? null,
        });
        if (!r.ok) {
            return { Success: false, Message: r.message };
        }
        const out = (r.output ?? {}) as { Contract?: { ID?: string; ContractNumber?: string; Status?: string } };
        const c = out.Contract ?? {};
        return {
            Success: true,
            ContractID: c.ID ?? input.ContractID,
            Status: c.Status ?? null,
            Message: `Term renewed on contract ${c.ContractNumber ?? input.ContractID}.`,
        };
    }
}

/** Anti-tree-shaking anchor. */
export function LoadLiveContractsSeam(): void {
    /* keeps the registration alive */
}
