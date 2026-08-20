/**
 * @fileoverview The REAL contracts handoff — what `StubDownstreamSeam` stood in for on the D-CF4 path.
 *
 * ── WHY THIS NO LONGER CALLS AN OPERATION ───────────────────────────────────────────────────────
 *
 * The previous version of this file dispatched `Contracts.SaveContract` through the ClassFactory, and
 * explained at length why calling contracts' operation beat driving its entity graph. That reasoning
 * was sound about a version of contracts that no longer exists.
 *
 * Contracts was rebuilt from scratch on 2026-08-18 — ten tables became seven — and `SaveContract` was
 * DELETED along with `ContractDraft` and the whole hydration layer. Verified against `origin/next`
 * (`d2f64e3`): contracts ships **no remote operations at all**. So the old seam dispatched a key that
 * nothing registers, and `run()` returned "…is not registered in this process" every single time.
 *
 * That is worth stating plainly because it explains a longer-running puzzle: this path could never be
 * proven end to end, and the failure was repeatedly read as a stack-configuration problem — contracts
 * not linked, the operation not imported, registration order. It was none of those. The operation was
 * gone, and a missing registration and a deleted class produce the identical symptom.
 *
 * ── WHAT REPLACES IT ────────────────────────────────────────────────────────────────────────────
 *
 * The plain entity path: `GetEntityObject` → set fields → `Save()`. This is now the SIMPLER option as
 * well as the only one, because v2's contract is a HEADER. `ContractTerm` and `ContractLine` are gone
 * entirely, so there is no composition left to re-implement — the concern that made the operation the
 * right call in v1 no longer has anything to be concerned about.
 *
 * `ContractEntityServer.Save()` mints `ContractNumber` itself, from a sequence taken under a lock, so
 * this never supplies one. It runs `ExecuteSQL` on the same provider, which means it joins whatever
 * transaction `Sales.CloseDeal` already opened and a rollback releases the number rather than burning
 * it. Contracts needs no `SkipRelatedCollections` dance either, unlike orders.
 *
 * ── THE MONEY BOUNDARY ──────────────────────────────────────────────────────────────────────────
 *
 * Nothing here multiplies, sums, rounds or converts. The one numeric that crosses — the negotiated
 * annual uplift — is passed through in the units it was stated in; see `annualIncrease()` for why a
 * unit conversion would be a computation and is therefore refused rather than guessed.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseEntity,
    LogError,
    Metadata,
    RunView,
    type EntityInfo,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import type {
    ContractsCreateFromDealSeamInput,
    ContractsRenewTermSeamInput,
    ContractsSeamResult,
} from '@mj-biz-apps/sales-entities';

/** Contracts' entity names — these strings are the whole dependency. Sales imports no contracts code. */
const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';
const E_CONTRACT_TYPE = 'MJ_BizApps_Contracts: Contract Types';

/** Sales' own, needed only to name the CREATING entity in contracts' polymorphic provenance pair. */
const E_DEAL = 'MJ_BizApps_Sales: Deals';

/**
 * The seam input plus the one field the shared type does not carry yet.
 *
 * Declared here rather than added to `downstream-seams.ts` because nothing supplies a template today
 * (see `templateID()`), so widening the shared contract would advertise a capability no caller has.
 * Every added member is optional, so a plain `ContractsCreateFromDealSeamInput` still satisfies this
 * and no caller changes.
 */
type CreateFromDealInput = ContractsCreateFromDealSeamInput & {
    ContractTemplateID?: string | null;
};

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

export class LiveContractsSeam {
    public readonly IsLive = true;

    public constructor(
        private readonly user: UserInfo,
        private readonly provider: IMetadataProvider,
    ) {}

    /**
     * Create the agreement a won deal earned.
     *
     * ── WHAT IS DELIBERATELY NOT SET, AND WHY EACH ABSENCE IS THE POINT ─────────────────────────
     *
     * **No `Status`.** v2's contract has no status column at all; its lifecycle is DERIVED from the
     * dates. The old seam sent `'Draft'`, which is now simply not a field.
     *
     * **No `EffectiveDate`.** This is the one that would do real damage. With lifecycle derived from
     * dates, stamping an effective date makes the contract read as ACTIVE the moment it is created —
     * so every contract auto-created at Closed Won would announce itself as live and in force before
     * a human had read the paper. §7.2 wants precisely the opposite: nothing fires until someone
     * approves. A contract with no dates is one that has not started, which is the truth.
     *
     * **No `ExecutedDate`.** Sales does not know whether anything was signed. `Deal.ExecutionDate` is
     * when the DEAL was executed, and reading it as "the document is executed" would be a claim about
     * paper nobody has seen — the same misreport as `EffectiveDate`, one field over.
     *
     * **No `ContractNumber`.** Minted by `ContractEntityServer.Save()` under a lock. Supplying one
     * would either collide or bypass the sequence.
     *
     * **No `ContractTemplateID`.** Not merely unimplemented: contracts' own column description says a
     * contract created automatically at Closed Won HAS none "until finance reads the PDF". Selection
     * is honoured if a caller ever supplies one, and is not attempted here. See `templateID()`.
     *
     * **No `CustomerPersonID`, no `OwnerUserID`.** Neither column exists in v2, and
     * `CK_Contract_CustomerXor` — the constraint the old seam bent itself around — is gone with them.
     */
    public async CreateContractFromDeal(input: CreateFromDealInput): Promise<ContractsSeamResult> {
        if (!ContractsIsInstalled()) {
            return { Success: false, Message: 'bizapps-contracts is not installed in this deployment.' };
        }

        /**
         * `CustomerOrganizationID` is NOT NULL in v2. Refusing here beats letting the database refuse:
         * the message names the deal field that is actually missing, which a constraint violation
         * cannot do.
         */
        if (!input.AccountID) {
            return {
                Success: false,
                Message:
                    'A contract needs the buying organisation (Deal.AccountID). Contracts stores it as ' +
                    'CustomerOrganizationID, which is required — v2 has no person-customer alternative.',
            };
        }
        if (!input.CompanyID) {
            return { Success: false, Message: 'A contract needs the selling company (Deal.CompanyID).' };
        }

        const resolved = await this.resolveContractType(input.ContractTypeCode);
        if (!resolved.ID) {
            return {
                Success: false,
                Message: `No contract type matches '${input.ContractTypeCode ?? '(none)'}' in contracts${resolved.By}.`,
            };
        }

        try {
            const contract = await this.provider.GetEntityObject<BaseEntity>(E_CONTRACT, this.user);
            contract.NewRecord();

            contract.Set('ContractTypeID', resolved.ID);
            contract.Set('CompanyID', input.CompanyID);
            contract.Set('CustomerOrganizationID', input.AccountID);

            /**
             * The contact is not a second customer; it is the person to talk to about this one.
             * Nullable, and null is an ordinary answer for a deal that named nobody.
             */
            contract.Set('PrimaryContactPersonID', input.PrimaryContactID ?? null);

            /** The AD's red-lines travel with the agreement — a human reviewer would otherwise go in blind. */
            contract.Set('Description', input.ContractVariances ?? null);

            /**
             * Sales creates no `ContractTemplateModification` rows: it has no template, so it has
             * nothing to record a modification AGAINST. False is therefore the honest value rather
             * than a default — and `ContractEntityServer.ValidateAsync()` only refuses a false flag
             * when modification rows actually exist, which for a contract created this second they
             * cannot.
             */
            contract.Set('HasModifications', false);

            this.setProvenance(contract, input.DealID);
            this.setNegotiatedTerms(contract, input);

            const template = this.templateID(input);
            if (template) {
                contract.Set('ContractTemplateID', template);
            }

            if (!(await contract.Save())) {
                return {
                    Success: false,
                    Message: `Could not save the contract: ${contract.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                };
            }

            const id = String(contract.Get('ID') ?? '');
            const number = String(contract.Get('ContractNumber') ?? '');
            return {
                Success: true,
                ContractID: id || null,
                /**
                 * NULL, not `'Draft'`. There is no status column to report, and inventing a label the
                 * database does not hold would put sales back in the business of narrating contracts'
                 * lifecycle — which is exactly what deriving it from dates was meant to stop.
                 */
                Status: null,
                Message: `Contract ${number || id} created by Sales.CloseDeal${resolved.By}.`.trim(),
            };
        } catch (err) {
            LogError(`LiveContractsSeam.CreateContractFromDeal failed for deal ${input.DealID}: ${err}`);
            return { Success: false, Message: `Could not create the contract: ${String(err)}` };
        }
    }

    /**
     * Stamp contracts' polymorphic provenance pair with the deal that caused this.
     *
     * `CK_Contract_CreatingPairBothOrNeither` requires both or neither, so a deal whose entity cannot
     * be resolved leaves BOTH null rather than half a reference. `IX_Contract_CreatingRecord` exists
     * for the reverse lookup — "which contract came from this deal" — so this is the field that makes
     * the handoff traceable in the direction a person actually asks about it.
     */
    private setProvenance(contract: BaseEntity, dealID: string | null | undefined): void {
        const dealEntity: EntityInfo | undefined = this.provider.Entities.find((e) => e.Name === E_DEAL);
        if (!dealEntity?.ID || !dealID) {
            return;
        }
        contract.Set('CreatingEntityID', dealEntity.ID);
        contract.Set('CreatingRecordID', dealID);
    }

    /**
     * The renewal terms the DEAL actually negotiated — and only those.
     *
     * ── THE OVERRIDE/DEFAULT SPLIT, WHICH IS LOAD-BEARING ──────────────────────────────────────
     *
     * Sales' columns are named `…Override` on purpose, and their own descriptions say why: NULL means
     * "use the standard", which is a DIFFERENT FACT from "we negotiated a number that happens to equal
     * today's standard". Only the NULL survives a later change to policy. So a null override is passed
     * through as null and never filled in here.
     *
     * ── THE DEFAULTS THAT DO NOT EXIST YET ──────────────────────────────────────────────────────
     *
     * Sales' descriptions say the standards (5% uplift, 90 days' notice) are "owned by the contracts
     * ContractType". As of `origin/next` @ `d2f64e3` **they are not**: `ContractType` carries only
     * Name, Description, RequiresExecutedDocument, ParentStatusRequirement and Status. Nothing applies
     * a default anywhere — `applyContractTypeDefaults()` went with the v1 rebuild.
     *
     * This seam therefore populates NOTHING it was not told, so that when the columns arrive the
     * defaults land where they belong — in contracts, applied once, rather than being pre-empted here
     * by a value sales invented. See D-9.
     */
    private setNegotiatedTerms(contract: BaseEntity, input: CreateFromDealInput): void {
        /** Stated on the deal as a fact about the paper, and stated the same way on the contract. */
        contract.Set('AutoRenew', input.AutoRenew === true);

        /**
         * `CancellationNoticeDaysOverride` → `CancellationWindowDays`, and the names differing is not
         * a reason to hesitate: contracts defines its column as "days of notice the customer owes to
         * cancel without renewing", which is exactly what sales' override overrides.
         *
         * `RenewalNoticeDays` is deliberately left alone. Contracts' own description warns that it is
         * "NOT the same field as CancellationWindowDays even though many agreements set them equal —
         * conflating them silently is how a notice obligation gets missed". Sales holds no equivalent,
         * so it says nothing rather than reusing the number it does have.
         */
        if (input.CancellationNoticeDaysOverride != null) {
            contract.Set('CancellationWindowDays', input.CancellationNoticeDaysOverride);
        }

        const uplift = this.annualIncrease(input.AnnualIncreasePctOverride);
        if (uplift != null) {
            contract.Set('AnnualIncreasePercent', uplift);
        }
    }

    /**
     * The negotiated year-over-year uplift, PASSED THROUGH UNCONVERTED.
     *
     * Both sides call this a percent and both mean the same thing by it: sales bounds the column
     * `>= 0 AND <= 100`, contracts calls it "the negotiated year-over-year uplift". So 5 means five
     * per cent on both sides and this moves a number without touching it.
     *
     * The precision differs — `DECIMAL(5,2)` here, `DECIMAL(7,4)` there — and that direction is
     * widening, so nothing is lost and nothing is rounded. Had the units differed, the right answer
     * would have been to refuse rather than divide: scaling a rate is a computation, and sales does
     * not compute money or the rates that move it.
     */
    private annualIncrease(pct: number | null | undefined): number | null {
        return pct == null ? null : pct;
    }

    /**
     * The template to incorporate, when a caller supplies one — and it is nobody's job to guess.
     *
     * Two independent reasons, either sufficient on its own:
     *
     *   1. Contracts says so. `ContractTemplateID` is "nullable because a contract created
     *      automatically at Closed Won has none until finance reads the PDF". That describes exactly
     *      this call site. A template arrives when a human establishes which one was signed.
     *
     *   2. There is no way to pick one that is not a guess. `ContractTemplate` carries Name,
     *      VersionLabel, `IntroducedDate` and SourceURL — and no `Status`. Choosing the newest by
     *      `IntroducedDate` is precisely the date-guessing that the `Status` column Andrew asked for
     *      exists to eliminate, and it would silently attach next year's paper to this year's deal
     *      the day someone loads a draft template.
     *
     * So: honoured if supplied, never selected. Nothing in sales supplies one today. See D-10.
     */
    private templateID(input: CreateFromDealInput): string | null {
        return input.ContractTemplateID ?? null;
    }

    /**
     * The contract type the policy named.
     *
     * ── WHY THIS PROBES FOR A COLUMN ────────────────────────────────────────────────────────────
     *
     * Sales' policy field is `ContractTypeCode`, and resolving a CODE is the right shape: sales does
     * not know contracts' vocabulary and must not bake its UUIDs. But `ContractType` has no `Code`
     * column — it is identified by `Name` (unique) and a fixed seeded UUID. Filtering on `Code`, as
     * the previous version did, ran against a column that does not exist, so the lookup could only
     * ever fail.
     *
     * Rather than fail the whole route over a missing column, this asks the METADATA which identifier
     * contracts actually offers, uses that, and reports which one it used so the answer is never
     * ambiguous. When contracts adds `Code` — as tasks just did on `TaskType`, for the same reason —
     * this starts preferring it with no change here. See D-12.
     *
     * ── THIS IS NOT A VOCABULARY COMPARISON ─────────────────────────────────────────────────────
     *
     * No behaviour branches on the value. The string arrives from configuration, is looked up, and
     * yields an ID; nothing in this app asks whether the type is an Order Form or an SOW. `'Code'`
     * and `'Name'` are COLUMN names, not vocabulary — which is the distinction the gate cares about.
     */
    private async resolveContractType(code?: string | null): Promise<{ ID: string | null; By: string }> {
        if (!code) {
            return { ID: null, By: '' };
        }

        const info: EntityInfo | undefined = this.provider.Entities.find((e) => e.Name === E_CONTRACT_TYPE);
        const hasCode = info?.Fields?.some((f) => f.Name === 'Code') === true;
        const column = hasCode ? 'Code' : 'Name';
        const by = hasCode ? '' : ' (matched on Name — contracts has no Code column on ContractType)';

        const r = await new RunView().RunView<{ ID: string }>(
            {
                EntityName: E_CONTRACT_TYPE,
                ExtraFilter: `${column} = '${String(code).replace(/'/g, "''")}'`,
                ResultType: 'simple',
                Fields: ['ID'],
            },
            this.user,
        );
        if (!r?.Success) {
            LogError(`LiveContractsSeam could not read contract types: ${r?.ErrorMessage ?? 'unknown error'}`);
            return { ID: null, By: by };
        }
        return { ID: (r.Results ?? [])[0]?.ID ?? null, By: by };
    }

    /**
     * The renewal door, which v2 has closed and not yet reopened.
     *
     * `Contracts.RenewTerm` is gone with `SaveContract`, and it did not simply move: `ContractTerm`
     * was DELETED as a table, so "add a term to an existing contract" no longer describes anything
     * that exists. There is nothing to call and nothing to call it on.
     *
     * REPORTED, NOT INVENTED. Two shapes could express a renewal on the v2 header — a new contract
     * carrying `ParentContractID`, or the existing one stamped `SupersededByContractID` — and they
     * are not equivalent: the first keeps both agreements in the lineage, the second retires one.
     * Which is right is contracts' modelling decision, not sales'. Guessing would produce contract
     * records that look correct and mean the wrong thing, so this returns a plan that honestly did
     * not execute and says why, which is the same shape every other unroutable target uses. See D-11.
     */
    public async RenewContractTerm(input: ContractsRenewTermSeamInput): Promise<ContractsSeamResult> {
        if (!ContractsIsInstalled()) {
            return { Success: false, Message: 'bizapps-contracts is not installed in this deployment.' };
        }
        if (!input.ContractID) {
            return { Success: false, Message: 'A renewal needs the contract being renewed (Deal.RenewsContractID).' };
        }
        return {
            Success: false,
            ContractID: input.ContractID,
            Message:
                'Renewal was planned but not executed: the contracts rebuild removed ContractTerm and ' +
                'Contracts.RenewTerm, so a term cannot be added to an existing contract. Whether a renewal ' +
                'becomes a child contract (ParentContractID) or supersedes the original ' +
                '(SupersededByContractID) is a contracts modelling decision that has not been made.',
        };
    }
}

/** Anti-tree-shaking anchor. */
export function LoadLiveContractsSeam(): void {
    /* keeps the registration alive */
}
