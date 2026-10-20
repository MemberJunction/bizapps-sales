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
    CompositeKey,
    LogError,
    LogStatus,
    Metadata,
    RunView,
    type EntityInfo,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import type {
    ContractsCreateFromDealSeamInput,
    ContractsLinkOrderSeamInput,
    ContractsRenewTermSeamInput,
    ContractsSeamResult,
    ContractsUpdateFromDealSeamInput,
    ContractsUpdateSeamResult,
} from '@mj-biz-apps/sales-entities';

/** Contracts' entity names — these strings are the whole dependency. Sales imports no contracts code. */
const E_CONTRACT = 'MJ_BizApps_Contracts: Contracts';
const E_CONTRACT_TYPE = 'MJ_BizApps_Contracts: Contract Types';
const E_CONTRACT_ORDER = 'MJ_BizApps_Contracts: Contract Orders';

/** The renewal fields a deal can state (`setNegotiatedTerms`). `RenewalNoticeDays` is not one of them. */
const DEAL_RENEWAL_FIELDS = ['AutoRenew', 'CancellationWindowDays', 'AnnualIncreasePercent'] as const;

/** Sales' own, needed only to name the CREATING entity in contracts' polymorphic provenance pair. */
const E_DEAL = 'MJ_BizApps_Sales: Deals';

/** One candidate row from the contract-type lookup. `Code` is absent on a contracts with no such column. */
type ContractTypeMatch = { ID: string; Code?: string | null; Name: string };

/** The `By` note when contracts has no `Code` column, so Name is the only identifier on offer. */
const NAME_ONLY = ' (matched on Name — contracts has no Code column on ContractType)';

/**
 * Choose the contract type a policy value names: a `Code` match first, then a `Name` match.
 *
 * Exported for the unit test; the seam is its only caller.
 */
export function pickContractType(
    rows: ContractTypeMatch[],
    value: string,
    hasCode: boolean,
): { ID: string | null; By: string } {
    // The database compared case-insensitively to return these rows, so the pick does too; an exact
    // comparison here would drop a row SQL Server already matched.
    const same = (a: string | null | undefined): boolean => (a ?? '').toLowerCase() === value.toLowerCase();
    const byCode = hasCode ? rows.find((row) => same(row.Code)) : undefined;
    if (byCode) {
        return { ID: byCode.ID, By: '' };
    }
    const byName = rows.find((row) => same(row.Name));
    if (!byName) {
        return { ID: null, By: hasCode ? '' : NAME_ONLY };
    }
    return { ID: byName.ID, By: hasCode ? ' (matched on Name — no contract type has that Code)' : NAME_ONLY };
}

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
     * **No `ContractTemplateID`.** Contracts owns which template is current: `ContractEntityServer.Save()`
     * fills an empty one with the newest Published, usable template when the type requires one
     * (golive #269). A template a caller supplies is honoured. See `templateID()`.
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

            this.setProvenance(contract, input.DealID);
            const stated = this.applyDealTerms(contract, input);
            await this.seedTypeDefaults(contract, stated);

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
     * Reuse the contract a re-closed deal already names, instead of creating a second one (#278).
     *
     * A deal that was closed Won, reopened and closed Won again used to get a fresh contract each time,
     * and the first was left with nothing pointing at it. The deal's `ContractID` is now the answer to
     * "which agreement is this deal's", and this keeps that agreement in step with the deal:
     *
     *   · UNSIGNED (`ExecutedDate` null): the deal-sourced fields are rewritten through
     *     `applyDealTerms`, the same mapping a create uses. Type, company, customer and provenance are
     *     left alone; they identify the agreement.
     *   · SIGNED: nothing is written. Paper someone has signed is not sales' to edit, so the result
     *     carries a warning that the deal and the signed contract may now differ.
     *   · UNREADABLE or gone: `Unreadable`, so the close refuses rather than guessing.
     *
     * A renewal field the deal no longer states goes back to what a create would give it, the contract
     * type's default, rather than keeping the number the previous close wrote. Otherwise a rep who
     * cleared a 9% uplift to mean "use the standard" would re-close onto a contract still saying 9%.
     * See `reseedUnstatedTerms()`.
     */
    public async UpdateContractFromDeal(input: ContractsUpdateFromDealSeamInput): Promise<ContractsUpdateSeamResult> {
        if (!ContractsIsInstalled()) {
            return { Success: false, Message: 'bizapps-contracts is not installed in this deployment.' };
        }
        const contract = await this.loadContract(input.ContractID);
        if (!contract) {
            return {
                Success: false,
                Unreadable: true,
                ContractID: input.ContractID,
                Message:
                    `This deal already names contract ${input.ContractID}, which could not be read or no longer ` +
                    'exists, so whether to reuse it cannot be told. Correct or clear the deal\'s contract, then ' +
                    'close the deal again.',
            };
        }

        const number = String(contract.Get('ContractNumber') ?? '') || input.ContractID;
        const executed = contract.Get('ExecutedDate');
        if (executed != null) {
            return {
                Success: true,
                Signed: true,
                ContractID: input.ContractID,
                ContractNumber: number,
                Message:
                    `Contract ${number} is signed, so the close reused it unchanged. The deal's terms may now ` +
                    'differ from the signed contract; compare them and amend the contract in contracts if needed.',
            };
        }

        try {
            const stated = this.applyDealTerms(contract, input);
            await this.reseedUnstatedTerms(contract, stated);
            if (!(await contract.Save())) {
                return {
                    Success: false,
                    ContractID: input.ContractID,
                    Message: `Could not refresh contract ${number}: ${contract.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                };
            }
            return { Success: true, ContractID: input.ContractID, ContractNumber: number, Status: null };
        } catch (err) {
            LogError(`LiveContractsSeam.UpdateContractFromDeal failed for deal ${input.DealID}: ${err}`);
            return { Success: false, ContractID: input.ContractID, Message: `Could not refresh contract ${number}: ${String(err)}` };
        }
    }

    /**
     * On a refresh, give each deal-sourced renewal field the deal no longer states the value a create
     * would have given it (#278).
     *
     * Contracts seeds unsaved records only (`SeedRenewalDefaultsFromType` returns early on a saved one),
     * so the seed runs on a scratch, never-saved contract of the same type with the same fields marked
     * as stated, and the unstated fields are copied across. Contracts still decides every default;
     * sales copies its answer, as the create keeps it. Where this contracts build cannot seed, the
     * scratch holds null and so does the refreshed field, which is also what a create saves there.
     *
     * `RenewalNoticeDays` is left alone: the deal never sources it, so a value on the contract was put
     * there by contracts or by someone reading the paper.
     */
    private async reseedUnstatedTerms(contract: BaseEntity, stated: readonly string[]): Promise<void> {
        const unstated = DEAL_RENEWAL_FIELDS.filter((field) => !stated.includes(field));
        if (unstated.length === 0) {
            return;
        }
        const scratch = await this.provider.GetEntityObject<BaseEntity>(E_CONTRACT, this.user);
        scratch.NewRecord();
        scratch.Set('ContractTypeID', contract.Get('ContractTypeID'));
        await this.seedTypeDefaults(scratch, stated);
        for (const field of unstated) {
            contract.Set(field, scratch.Get(field) ?? null);
        }
    }

    /** The contract by ID, or null when it cannot be read or does not exist. */
    private async loadContract(contractID: string): Promise<BaseEntity | null> {
        try {
            const contract = await this.provider.GetEntityObject<BaseEntity>(E_CONTRACT, this.user);
            const key = new CompositeKey();
            key.KeyValuePairs.push({ FieldName: 'ID', Value: contractID });
            return (await contract.InnerLoad(key)) ? contract : null;
        } catch (err) {
            LogError(`LiveContractsSeam could not load contract ${contractID}: ${err}`);
            return null;
        }
    }

    /**
     * Every field the DEAL supplies to its contract, in one place, so a create and a refresh after a
     * re-close (#278) cannot drift apart. The contract's identity (type, company, customer, provenance,
     * template) is set by the create alone: a refresh rewrites the deal's terms, not which agreement
     * this is.
     *
     * @returns the renewal fields this deal stated, which seeding must not overwrite.
     */
    private applyDealTerms(contract: BaseEntity, input: ContractsCreateFromDealSeamInput): string[] {
        /**
         * The contact is not a second customer; it is the person to talk to about this one.
         * Nullable, and null is an ordinary answer for a deal that named nobody.
         */
        contract.Set('PrimaryContactPersonID', input.PrimaryContactID ?? null);

        /** The AD's red-lines travel with the agreement — a human reviewer would otherwise go in blind. */
        contract.Set('Description', input.ContractVariances ?? null);

        /**
         * THE REP'S ANSWER, carried through — S-US1 asks the question, S-US2 copies it here.
         *
         * It used to be hardcoded `false`, and the reasoning was sound as far as it went: sales
         * creates no `ContractTemplateModification` rows, because it has no template to record a
         * modification against, and `ContractEntityServer.ValidateAsync()` only refuses a false
         * flag when such rows exist — which for a contract created this second they cannot.
         *
         * What that argument missed is that the flag is not a count of rows. It is the INSTRUCTION
         * to go and create them: a true flag sends finance to the paper to capture each deviation,
         * a false one sends them to confirm nothing was negotiated. Hardcoding false made every
         * contract claim the standard agreement was untouched, including the negotiated ones, so
         * the only signal distinguishing them was lost at the boundary.
         *
         * Absent (an older caller, or the stub) still means false — the column is NOT NULL in
         * contracts and S-US1 defaults the deal's flag to no, so false is the honest default at
         * both ends rather than a shrug.
         */
        contract.Set('HasModifications', input.StandardAgreementModified === true);
        return this.setNegotiatedTerms(contract, input);
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
     * ── WHERE THE STANDARD COMES FROM ───────────────────────────────────────────────────────────
     *
     * The standard lives on contracts' `ContractType` (`DefaultAutoRenew`, `DefaultRenewalNoticeDays`,
     * `DefaultCancellationWindowDays`, `DefaultAnnualIncreasePercent`). This method writes only what the
     * deal states and returns those field names; `seedTypeDefaults()` then has contracts fill the rest
     * from the type. Sales never copies a default value itself. See D-9.
     *
     * @returns the renewal fields this deal stated, which seeding must not overwrite.
     */
    private setNegotiatedTerms(contract: BaseEntity, input: CreateFromDealInput): string[] {
        const stated: string[] = [];


        /** Stated on the deal as a fact about the paper, and stated the same way on the contract. */
        contract.Set('AutoRenew', input.AutoRenew === true);
        stated.push('AutoRenew');

        /**
         * `CancellationNoticeDaysOverride` → `CancellationWindowDays`, and the names differing is not
         * a reason to hesitate: contracts defines its column as "days of notice the customer owes to
         * cancel without renewing", which is exactly what sales' override overrides.
         *
         * `RenewalNoticeDays` is deliberately left alone. Contracts' own description warns that it is
         * "NOT the same field as CancellationWindowDays even though many agreements set them equal —
         * conflating them silently is how a notice obligation gets missed". Sales holds no equivalent,
         * so it says nothing rather than reusing the number it does have, and the type's default fills it.
         */
        if (input.CancellationNoticeDaysOverride != null) {
            contract.Set('CancellationWindowDays', input.CancellationNoticeDaysOverride);
            stated.push('CancellationWindowDays');
        }

        const uplift = this.annualIncrease(input.AnnualIncreasePctOverride);
        if (uplift != null) {
            contract.Set('AnnualIncreasePercent', uplift);
            stated.push('AnnualIncreasePercent');
        }
        return stated;
    }

    /**
     * Have contracts fill the renewal fields the deal left unset from the contract's type.
     *
     * Contracts applies its type defaults only when the creator asks: its form does it on a type pick,
     * and nothing does it at save time (bizapps-contracts#97). The documented order for a caller outside
     * the form is: set the type and the known fields, mark each known field as edited, seed, save.
     *
     * `AutoRenew` is always marked. The deal's checkbox is a statement about the paper, and a No from it
     * is an answer, not a gap for the type's default to fill.
     *
     * The methods are reached by name, not by import: sales reads contracts through entity names only,
     * so it still installs where contracts is absent or older. If they are missing or the seed fails, the
     * contract saves with the deal's terms alone, which is what it did before this call existed.
     */
    private async seedTypeDefaults(contract: BaseEntity, stated: readonly string[]): Promise<void> {
        const seedable = contract as BaseEntity & {
            MarkRenewalFieldEdited?: (field: string) => void;
            SeedRenewalDefaultsFromType?: () => Promise<boolean>;
        };
        if (
            typeof seedable.MarkRenewalFieldEdited !== 'function' ||
            typeof seedable.SeedRenewalDefaultsFromType !== 'function'
        ) {
            LogStatus('LiveContractsSeam: this contracts build has no renewal-default seeding; saving the deal terms only.');
            return;
        }
        try {
            for (const field of stated) {
                seedable.MarkRenewalFieldEdited(field);
            }
            await seedable.SeedRenewalDefaultsFromType();
        } catch (err) {
            LogError(`LiveContractsSeam: seeding renewal defaults from the contract type failed; saving the deal terms only: ${err}`);
        }
    }

    /**
     * The negotiated year-over-year uplift, PASSED THROUGH UNCONVERTED.
     *
     * -- WHY PASS-THROUGH IS RIGHT, WHICH IS NOT THE SAME AS THE TWO SIDES AGREEING --
     *
     * The reason is the OVERRIDE semantics, not a matching domain. Sales names this column
     * `AnnualIncreasePctOverride` and its own description is explicit: NULL means use the standard,
     * whose default lives on the contracts ContractType, and copying that default in at write time
     * would freeze this year terms into next year renewals silently. So a stated number travels and a
     * null stays a null. Nothing here converts, scales or substitutes, because each of those would be
     * a computation and sales does not compute money or the rates that move it.
     *
     * -- AND THE TWO SCHEMAS DO NOT AGREE ON THE DOMAIN --
     *
     * Sales bounds this 0 to 100 (`CK_Deal_AnnualIncreasePctOverride`). Contracts bounds only `>= 0`
     * (`CK_Contract_AnnualIncrease`) with no upper limit, at `DECIMAL(7,4)` against sales
     * `DECIMAL(5,2)`. Both call it a percent and 5 means five per cent on both sides today, so the
     * handoff is correct -- but the wider column will accept a value sales would have refused, and
     * nothing on either side states the unit as a rule rather than as a habit.
     *
     * That is the same shape as the discount-unit trap recorded in `docs/DECISIONS.md`, where 0-100
     * became 0-1 across a boundary and would have been a silent hundred-fold bug. It has not bitten
     * here and it is not this file to settle: see D-14. Flagged rather than defended, because a
     * conversion added on suspicion is exactly the computation this app must not perform.
     */
    private annualIncrease(pct: number | null | undefined): number | null {
        return pct == null ? null : pct;
    }

    /**
     * The template to incorporate, when a caller supplies one — otherwise contracts chooses.
     *
     * Order Form and Payment Link carry `TemplateRequired = 1`, so a contract saved with no template
     * would be refused. Contracts defaults it on the server, using the same rule as its Agreement panel
     * (the newest `Published` template with `IsUsable = 1`). Selecting here instead would copy that rule
     * into sales, which reads contracts through entity names only. Nothing in sales supplies one today.
     */
    private templateID(input: CreateFromDealInput): string | null {
        return input.ContractTemplateID ?? null;
    }

    /**
     * The contract type the policy named.
     *
     * ── CODE FIRST, NAME AS A FALLBACK ──────────────────────────────────────────────────────────
     *
     * Sales' policy field is `ContractTypeCode`, and resolving a CODE is the right shape: sales does
     * not know contracts' vocabulary and must not bake its UUIDs. A code also survives a rename, which
     * a display name does not.
     *
     * Contracts did not always have a `Code` on `ContractType` (bizapps-contracts#96 added one), and the
     * two apps release separately. So the value is matched against `Code` when the column exists, and
     * against `Name` when no `Code` matches. That keeps every combination working: an older contracts
     * with no `Code`, a newer one where the policy already names the code (`ORDER_FORM`), and a newer
     * one where the policy still names the label (`Order Form`). A Code match always wins over a Name
     * match, and a Name match is reported in `By`, so the answer is never ambiguous about which
     * identifier it used.
     *
     * One query, not two: both columns are read for the candidate rows and the winner is picked here.
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
        const literal = `'${String(code).replace(/'/g, "''")}'`;
        const filter = hasCode ? `Code = ${literal} OR Name = ${literal}` : `Name = ${literal}`;

        const r = await new RunView().RunView<ContractTypeMatch>(
            {
                EntityName: E_CONTRACT_TYPE,
                ExtraFilter: filter,
                ResultType: 'simple',
                Fields: hasCode ? ['ID', 'Code', 'Name'] : ['ID', 'Name'],
            },
            this.user,
        );
        if (!r?.Success) {
            LogError(`LiveContractsSeam could not read contract types: ${r?.ErrorMessage ?? 'unknown error'}`);
            return { ID: null, By: '' };
        }
        return pickContractType(r.Results ?? [], code, hasCode);
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

    public async LinkOrderToContract(input: ContractsLinkOrderSeamInput): Promise<ContractsSeamResult> {
        if (!ContractsIsInstalled()) {
            return { Success: false, Message: 'bizapps-contracts is not installed in this deployment.' };
        }
        return LinkOrderToContract(input, this.provider, this.user);
    }
}

/**
 * Record that the contract governs the order (contracts#77). Contracts' own save copies the contract's
 * renewal terms to the subscriptions the order creates, so this only writes the link.
 *
 * A contracts release older than the link has no such entity. That comes back `Pending`, not as a
 * failure of the close: the contract and order both exist, and the daily relink links them once
 * contracts is upgraded.
 *
 * An existing link is left alone, so closing the same deal twice (reopen, close again) does not trip
 * the unique pair.
 */
export async function LinkOrderToContract(
    input: ContractsLinkOrderSeamInput,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<ContractsSeamResult> {
    if (!new Metadata().Entities.some((e) => e.Name === E_CONTRACT_ORDER)) {
        return {
            Success: false,
            Pending: true,
            ContractID: input.ContractID,
            Message:
                'Contract link pending: the installed bizapps-contracts has no order links yet. The order is ' +
                'linked to its contract automatically once contracts is upgraded.',
        };
    }
    const existing = await new RunView().RunView<{ ID: string }>(
        {
            EntityName: E_CONTRACT_ORDER,
            ExtraFilter: `ContractID='${input.ContractID}' AND OrderID='${input.OrderID}'`,
            Fields: ['ID'],
            ResultType: 'simple',
        },
        user,
    );
    if (!existing.Success) {
        return { Success: false, ContractID: input.ContractID, Message: `Could not check the order link: ${existing.ErrorMessage}` };
    }
    if (existing.Results.length > 0) {
        return { Success: true, ContractID: input.ContractID };
    }
    const link = await provider.GetEntityObject<BaseEntity>(E_CONTRACT_ORDER, user);
    link.NewRecord();
    link.Set('ContractID', input.ContractID);
    link.Set('OrderID', input.OrderID);
    if (!(await link.Save())) {
        return {
            Success: false,
            ContractID: input.ContractID,
            Message: `The order was not linked to the contract: ${link.LatestResult?.CompleteMessage ?? 'unknown error'}`,
        };
    }
    return { Success: true, ContractID: input.ContractID };
}

/** Anti-tree-shaking anchor. */
export function LoadLiveContractsSeam(): void {
    /* keeps the registration alive */
}
