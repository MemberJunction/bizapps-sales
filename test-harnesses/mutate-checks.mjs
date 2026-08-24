/**
 * @fileoverview The mutation driver — proves each integration check can FAIL.
 *
 * A green suite is not evidence. A check can be green because the behaviour it names is correct, or
 * because it asserts something true no matter what the code does, and from the outside those look
 * identical. This runs the experiment that tells them apart: break the PRODUCT code, confirm the check
 * that names that behaviour goes red, put the code back.
 *
 * It has caught four vacuous passes so far — `close-deal.CD4` asserting `'AmountAtTransition' in row`
 * (always true of a RunView row naming the column), and three checks whose targets could only be
 * falsified by ADDING behaviour. `docs/CHECK-MUTATION-EVIDENCE.md` is its output.
 *
 * ── WHY IT RESTORES FROM A COPY AND NOT FROM GIT ────────────────────────────────────────────────
 *
 * The first version restored with `git checkout -- <path>`. That restores to **HEAD**, so running it
 * over UNCOMMITTED work deletes the work rather than the mutation. It ate an entire unfinished feature
 * on 2026-08-20 (`DECISIONS-NEEDED.md` DN-13); recovery was cheap only because the edit happened to
 * have been applied by a script that could be re-run.
 *
 * So: the file is copied aside BEFORE the mutation and restored from that copy, byte for byte, and the
 * restore is VERIFIED. A tool whose job is to break things on purpose must not be able to break the
 * thing it is testing. It now runs safely against a dirty tree, which is also when you most want it —
 * the moment a check is written is the moment to ask whether it can fail.
 *
 * USAGE
 *   node test-harnesses/mutate-checks.mjs                 # every mutation
 *   node test-harnesses/mutate-checks.mjs M-OS1 M-CD4     # only these
 *   node test-harnesses/mutate-checks.mjs --list          # the table, no runs
 *
 * ── AIM AT WHAT THE CHECK ASSERTS, NOT AT WHAT PRODUCES IT ─────────────────────────────────────
 *
 * This has now mis-aimed twice, the same way both times, and both times the mutant felled plenty
 * while never reaching its declared target:
 *
 *   M-WT5F  aimed at WT5 ("with no contract yet, the task falls back to the DEAL"). It disabled the
 *           branch that OVERRIDES the fallback, which forces the fallback ALWAYS -- so WT5 stayed
 *           green and WT4 and WT14 fell instead. The fallback is the DEFAULT VALUE of `target`, not
 *           the branch that replaces it.
 *   M-WT6T  aimed at WT6 ("a missing contract task type is REFUSED WITH A REASON, and the order
 *           review still lands"). It skipped the branch that CREATES the contract task, so the task
 *           vanished wholesale and five checks that assert its existence fell -- while the refusal
 *           path WT6 is about was never reached at all.
 *
 * THE PATTERN: breaking the code that PRODUCES a thing is not the same as breaking the code that
 * REPORTS on it, GUARDS it, or CHOOSES it. A check that asserts "X is refused with a reason" is not
 * felled by removing X -- it is felled by removing the reason. A check that asserts a FALLBACK is not
 * felled by forcing the fallback.
 *
 * Read the check's own sentence and mutate the clause it turns on. If the mutant fells five checks
 * and not its target, that is the shape, not bad luck.
 *
 * Each mutation runs the WHOLE suite, not one bundle, so a mutation that breaks something unintended
 * shows up instead of hiding. Budget roughly 70 seconds each.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const DES = 'packages/CoreEntitiesServer/src/DealEntityServer.ts';
const CDO = 'packages/CoreEntitiesServer/src/CloseDealOperation.ts';
const PF = 'packages/Entities/src/product-filter.ts';
const DE = 'packages/Entities/src/deal-entity.ts';
const SEQ = 'packages/CoreEntitiesServer/src/SequenceService.ts';
const CWT = 'packages/CoreEntitiesServer/src/CloseWonTaskService.ts';
const SEAM = 'packages/Entities/src/downstream-seams.ts';
const LCS = 'packages/CoreEntitiesServer/src/LiveContractsSeam.ts';

/**
 * ── THE ACTIVITIES AND FORECAST SOURCES, ABSENT FROM THIS FILE UNTIL NOW ────────────────────────
 *
 * 35 checks -- `AC1`-`AC22` and `FS1`-`FS13`, near 30% of the suite -- had NO mutant here, while
 * `docs/CHECK-MUTATION-EVIDENCE.md` reported their bundles at zero and the file's own title claimed
 * every check had been proven able to fail.
 *
 * The campaign that produced these was real and found four checks that could not fail. It was applied
 * BY HAND, one edit at a time, so the findings landed in the source and the EXPERIMENT did not land
 * anywhere. Commit `1352b2c` is titled "mutants for activities and forecast" and does not touch this
 * driver: it added four checks and repaired four. Two successive versions of the evidence doc then
 * inherited their claim from that commit's title rather than from this file, which is the mechanism
 * worth remembering -- a title is not a test, and neither is a commit message.
 */
const AIS = 'packages/CoreEntitiesServer/src/activities/ActivityIngestService.ts';
const AR = 'packages/CoreEntitiesServer/src/activities/ActivityReader.ts';
const DM = 'packages/CoreEntitiesServer/src/activities/DealMatcher.ts';
const ASJ = 'packages/CoreEntitiesServer/src/activities/ActivitySyncJob.ts';
const AWS = 'packages/CoreEntitiesServer/src/activities/ActivityWriterService.ts';
const RF = 'packages/CoreEntitiesServer/src/activities/RelevanceFilter.ts';
const MGC = 'packages/CoreEntitiesServer/src/activities/MSGraphCalendarSource.ts';
const MGA = 'packages/CoreEntitiesServer/src/activities/MSGraphActivitySource.ts';
const FAS = 'packages/CoreEntitiesServer/src/activities/FixtureActivitySource.ts';
const AV = 'packages/Entities/src/activities/activity-vocabulary.ts';
const FSJ = 'packages/CoreEntitiesServer/src/forecast/ForecastSnapshotJob.ts';
const QFS = 'packages/CoreEntitiesServer/src/forecast/QueryForecastSource.ts';

/**
 * id · file · the exact text to replace · its replacement · which checks SHOULD go red.
 *
 * `expect` is not a prediction to be defended — a mutation that fails checks nobody expected is the
 * interesting result, and the run prints both. Anchors are matched EXACTLY and must appear once; an
 * anchor that has drifted is reported as a skip rather than guessed at.
 */
const MUTATIONS = [
    { id: 'M-PP1', file: PF, expect: ['PP1'],
      from: "AND Status = 'Active' ", to: "AND Status <> 'not-a-status' " },
    { id: 'M-PP2', file: PF, expect: ['PP2'],
      from: "`CompanyID = '${company}' AND Status", to: '`Status' },
    { id: 'M-PP3', file: PF, expect: ['PP3', 'PP4'],
      from: "AND (AvailableTo IS NULL OR AvailableTo >= '${day}')",
      to: "AND (AvailableTo IS NULL OR AvailableTo >= '1900-01-01')" },

    { id: 'M-SD2', file: DES, expect: ['SD2'],
      from: '    private async stampCompanyFromPipeline(): Promise<void> {\n        if (!this.PipelineID) {',
      to: '    private async stampCompanyFromPipeline(): Promise<void> {\n        if (true) { return; }\n        if (!this.PipelineID) {' },
    { id: 'M-SD3', file: DES, expect: ['SD3'],
      from: '        this.OwnerEmployeeID = owner?.EmployeeID ?? null;',
      to: '        this.OwnerEmployeeID = null;' },
    { id: 'M-SD8', file: DE, expect: ['SD8'],
      from: '        if (!this.Name || !this.Name.trim()) {',
      to: '        if (false && (!this.Name || !this.Name.trim())) {' },
    { id: 'M-SD9', file: SEQ, expect: ['SD9'],
      from: '    return value;\n}', to: "    return value.replace('DEAL-', 'DEAL-0');\n}" },
    // RETARGETED. This named `saveApplyingStageOrderStatus` and `saveWithNewDealNumber`, two methods that
    // were merged into `saveWithinScope` rounds ago. The anchor therefore matched ZERO times, the driver
    // reported a SKIP and exited 1 — so the one script whose job is to prove checks can fail was itself
    // failing to run, quietly, on every invocation. Now aimed at the routing decision that survived.
    { id: 'M-SD10', file: DES, expect: ['SD10'],
      from: 'assignNumber: false,',
      to: 'assignNumber: true,',
      note: 'an existing deal is renumbered on every save, which is what SD10 forbids' },
    { id: 'M-SD11', file: SEQ, expect: ['SD11'],
      from: '    const rows = await sqlProvider.ExecuteSQL(',
      to: "    await sqlProvider.ExecuteSQL(sql, {}, { isMutation: true, description: 'MUTANT double-take' }, contextUser);\n    const rows = await sqlProvider.ExecuteSQL(" },
    { id: 'M-SD15', file: DES, expect: ['SD15'],
      from: '        this.provisionEmbeddedOrder();',
      to: '        this.provisionEmbeddedOrder();\n        this.PaymentMethod = null;' },
    { id: 'M-SD18', file: DES, expect: ['SD18'],
      from: "        order.OrderType = 'Sale';", to: "        order.OrderType = 'Return';" },

    { id: 'M-CD1', file: CDO, expect: ['CD1'],
      from: '        if (policy.CreateContract === true) {', to: '        if (false) {' },
    { id: 'M-CD2', file: CDO, expect: ['CD2', 'CO1'],
      from: '        if (policy.CreateContract === true) {', to: '        if (true) {' },
    { id: 'M-CD4', file: DES, expect: ['CD4'],
      from: '        event.AmountAtTransition = prior.Amount;',
      to: '        event.AmountAtTransition = null;',
      note: 'the stage event stamps no amount -- the CD4 defect, re-aimed after the stamping moved to DealEntityServer' },
    { id: 'M-CD5', file: DES, expect: ['CD5', 'CD13', 'CD14'],
      from: '        if (!(await this.statusLocksDeal(persistedStatusID))) {\n            return null;\n        }',
      to: '        if (true) {\n            return null;\n        }' },
    { id: 'M-CD6', file: DES, expect: ['CD6', 'CD14'],
      from: '    private static readonly LOCK_EDITABLE_FIELDS = DEAL_FIELDS_EDITABLE_WHILE_LOCKED;',
      to: "    private static readonly LOCK_EDITABLE_FIELDS = new Set<string>(['NextStep']);" },
    { id: 'M-CD7', file: SEAM, expect: ['CD7'],
      from: "    public async CreateContractFromDeal(input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult> {\n        this.Attempts.push({ Target: 'Contract', Payload: input });\n        return {\n            Success: false,",
      to: "    public async CreateContractFromDeal(input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult> {\n        this.Attempts.push({ Target: 'Contract', Payload: input });\n        return {\n            Success: true," },
    { id: 'M-CD8', file: CDO, expect: ['CD8'],
      from: "            if (!lossReasonID) {\n                issues.push(issue('deal', 'A loss reason is required to close a deal as lost.', 'LossReasonID'));",
      to: "            if (false) {\n                issues.push(issue('deal', 'A loss reason is required to close a deal as lost.', 'LossReasonID'));" },
    { id: 'M-CD9', file: CDO, expect: ['CD9'],
      from: '                if (r.Success && row?.RequiresNotes === true && !notes?.trim()) {',
      to: '                if (r.Success && row?.RequiresNotes === false && !notes?.trim()) {' },
    { id: 'M-CD10', file: CDO, expect: ['CD10'],
      from: "        if (!input.Reason?.trim()) {\n            return { ...empty, Issues: [issue('deal', 'A reason is required to reopen a closed deal.', 'Reason')] };\n        }",
      to: "        if (false) {\n            return { ...empty, Issues: [issue('deal', 'A reason is required to reopen a closed deal.', 'Reason')] };\n        }" },
    { id: 'M-CD11', file: CDO, expect: ['CD11'],
      from: '            deal.ClosedAt = null;\n            deal.ClosedByUserID = null;\n            deal.ActualCloseDate = null;',
      to: '            deal.ClosedByUserID = null;\n            deal.ActualCloseDate = null;' },
    { id: 'M-CD13', file: DES, expect: ['CD13'],
      from: '        const dirtyCollections = this.Companions\n            .filter((c) => c.Dirty)\n            .map((c) => c.Name);',
      to: '        const dirtyCollections: string[] = [];' },
    { id: 'M-CD14', file: DES, expect: ['CD14'],
      from: '    private static readonly LOCK_EDITABLE_FIELDS = DEAL_FIELDS_EDITABLE_WHILE_LOCKED;',
      to: "    private static readonly LOCK_EDITABLE_FIELDS = new Set<string>(['Description']);" },

    // The stage → order-status writer (D-OS1).
    { id: 'M-OS1', file: DES, expect: ['CO3', 'CO5'],
      from: '        const stageOrder = this._lockedAtSave ? null : await this.planStageOrderStatus();',
      to: '        const stageOrder: StageOrderPlan | null = null;\n        void this.planStageOrderStatus;',
      note: 'the provisioned order never consults the stage, so it takes Draft whatever the stage declares' },
    { id: 'M-OS2', file: DES, expect: ['CO3'],
      from: '        const target = (result.Results ?? [])[0]?.OrderStatusOnEntry;\n        if (!target) {',
      to: "        const target = (result.Results ?? [])[0]?.OrderStatusOnEntry ?? 'Draft';\n        if (false) {" },
    // The Deal.Amount cache (item 2).
    { id: 'M-AM1', file: DES, expect: ['SD21'],
      from: '            await this.refreshAmountFromOrder();',
      to: '            void this.refreshAmountFromOrder;',
      note: 'the cache is never refreshed — the defect SD21 exists for' },
    { id: 'M-AM2', file: DES, expect: ['SD22'],
      from: '        if (this.AmountIsComputed === false && this.Amount !== null && this.Amount !== undefined) {\n            return;\n        }',
      to: '        if (false) {\n            return;\n        }',
      note: 'a hand-typed amount is overwritten — the rule that must not drift' },
    { id: 'M-AM3', file: DES, expect: ['SD23'],
      from: '        if (total === null || !Number.isFinite(total)) {',
      to: '        if (false) {',
      note: '"nothing priced" becomes a computed amount of nothing -- the SD23 defect' },

    { id: 'M-OS3', file: DES, expect: ['CO5'],
      from: '        if (!verdict.Allowed) {\n            this._orderStatusWarnings.push(',
      to: '        if (!verdict.Allowed) {\n            const swallowed: string[] = [];\n            swallowed.push(',
      note: 'swallows the warning; `swallowed` is unused on purpose and tsc must still accept it' },

    // THE ONE MUTANT THAT IS A REAL DEFECT REPLAYED, not an invented one. This WAS the code, and it
    // meant an already-saved deal with no order could never acquire one -- every SQL-seeded deal and
    // everything created before S-US4. It failed two apps away, on `CompanyID cannot be null` inside
    // orders, which is why SD24 asks the question from the sales side, where the cause is.
    { id: 'M-PV1', file: DES, expect: ['SD24'],
      from: '        if (this.OrderID_Object?.IsSaved) {\n            return;',
      to: '        if (this.IsSaved) {\n            return;',
      note: 'provisioning reachable only on a first save — the original bug, verbatim' },

    // The other half of the same question. M-PV1 asks whether an existing deal can GET an order; this
    // asks whether the order it gets is in the right state. Reverting the gate is the DEAL-9003 defect.
    { id: 'M-PV2', file: DES, expect: ['SD25'],
      from: 'if (this.IsSaved && !this._orderJustProvisioned) {',
      to: 'if (this.IsSaved) {',
      note: 'a provisioned order never asks the stage, so it stays Draft' },

    // FINDING (b) FROM THE STORY AUDIT, replayed. Removing the guard restores the state the audit proved
    // against the database: a header-only save keeps a hand-set stamp, so the owner column and the
    // owner-role team row name different people, with no error anywhere.
    { id: 'M-OW1', file: DES, expect: ['SD26'],
      from: '        const ownerRefusal = this.ownerStampEditRefusal();',
      to: '        const ownerRefusal: string | null = null;   void this.ownerStampEditRefusal;',
      note: 'the owner stamp is writable again' },

    // S-US7's negative, which had no check until the story audit went looking and no mutant until now.
    // Ungating the task step makes a LOST deal raise an order-review task: finance works a review for a
    // deal nobody won, finds nothing to review, and no error was ever raised.
    { id: 'M-WT1', file: CDO, expect: ['WT11'],
      from: '            if (target.IsWon) {\n                const cfg = ReadCloseWonTaskConfig(policy);',
      to: '            if (true) {\n                const cfg = ReadCloseWonTaskConfig(policy);',
      note: 'a lost close raises the won deal\'s tasks' },

    // ── ID PREFIXES FOLLOW THE TARGET BUNDLE, and this comment exists because I broke that ──────────
    //
    // The three below were first written as M-SD1/2/3 -- and `M-SD2` and `M-SD3` ALREADY EXISTED, aimed
    // at save-deal's SD2 and SD3. Two mutants per id, five hundred lines apart, in the file whose whole
    // job is to tell you which check caught which defect. `--list` showed the duplicates immediately,
    // which is the only reason it was a minute's work rather than a wrong conclusion later.
    //
    // So: the prefix names the BUNDLE the mutant is aimed at. M-SD* for save-deal, M-CD* for close-deal,
    // M-BD* for board-move, M-CT* for close-won-contract, M-WT* for close-won-tasks, and so on. Check
    // `--list` before adding one; it is the same lesson the WT11/WT12 rename taught one merge earlier.

    // #33's last criterion that was ours. Skipping the apply puts the defaults back where they were --
    // working in the browser and nowhere else -- which is the state BD5 exists to forbid.
    { id: 'M-BD1', file: DES, expect: ['BD5'],
      from: 'if (work.stageDefaults) {\n                this.applyStageDefaults(work.stageDefaults);',
      to: 'if (false && work.stageDefaults) {\n                this.applyStageDefaults(work.stageDefaults);',
      note: 'the write path stops applying the stage defaults' },

    // THE ORIGINAL BUG, REPLAYED — and it is not what I first labelled it. Mutating the ternary's
    // CONDITION leaves `(false && creating) ? A : B`, so creation falls through to the `Dirty` branch,
    // which is exactly the first version of this code. BD2 catches it, because a deal created with a
    // probability has it overwritten and the stage event then stamps the wrong departure value. Expecting
    // BD6 here was my mistake; the driver reported BD2 and the driver was right.
    { id: 'M-BD2', file: DES, expect: ['BD2'],
      from: '        if (!this.IsSaved) {\n            return current !== null && current !== undefined && current !== \'\';\n        }',
      to: '        if (false) {\n            return current !== null && current !== undefined && current !== \'\';\n        }',
      note: 'creation asks Dirty again -- the defect BD2 found the first time, now living in callerSuppliedValue' },

    // OVERWRITE INSTEAD OF FILL, which is the version a reasonable person writes first: the stage always
    // wins and a probability somebody typed is discarded. BD6 is the only check that forbids it.
    { id: 'M-BD3', file: DES, expect: ['BD6'],
      from: '        if (!this.callerSuppliedValue(\'Probability\', this.Probability)) {',
      to: '        if (true) {',
      note: 'the stage default always overwrites a stated probability' },

    // DEFECT 1, REPLAYED. Reading OrderID before the save is the state the code shipped in: provisioning
    // moved into Save() and the task call stayed twenty lines above it. Every seeded, legacy and imported
    // deal then closed with a warning saying it had no order, while the save created one.
    { id: 'M-TK1', file: CDO, expect: ['WT13'],
      from: "                        // Read AFTER the save: provisioning happens inside it. See the note above.\n                        OrderID: String(deal.OrderID ?? ''),",
      to: "                        OrderID: String(''),",
      note: 'the task service sees an empty OrderID. A PROXY, not an exact replay: the real defect only emptied it for deals that had no order YET, whereas this empties it always, which is why WT10 falls too. The driver takes one from/to pair, and moving a 30-line block is not expressible as one' },

    // DEFECT 2, REPLAYED. Dropping ContractID from the input literal makes the service's contract branch
    // unreachable again, so every contract-processing task links the deal.
    { id: 'M-TK2', file: CDO, expect: ['WT14'],
      from: '                        ContractID: deal.ContractID ?? undefined,',
      to: '                        ContractID: undefined,',
      note: 'the contract task links the deal, and the service cannot know otherwise' },

    // DEFECT 5. Un-gate provisioning and a permitted edit to a frozen deal mints an order again.
    { id: 'M-LK1', file: DES, expect: ['SD27'],
      from: '        if (!this._lockedAtSave) {\n            this.provisionEmbeddedOrder();',
      to: '        if (true) {\n            this.provisionEmbeddedOrder();',
      note: 'a locked deal provisions an order from a description edit' },


    // DEFECT 7. Leave the number in memory and the retry re-inserts a re-issued one.
    { id: 'M-DN1', file: DES, expect: ['SD29'],
      from: '                if (work.assignNumber) {\n                    this.DealNumber = null;',
      to: '                if (false && work.assignNumber) {\n                    this.DealNumber = null;',
      note: 'a rolled-back deal number survives, and the deal becomes unsaveable' },

    // ── THE FOUR-WRITERS ROUND. One mechanism replaced four special cases, so these five prove the
    // five distinct things it now decides. Every one of them was a live defect a week ago.

    // TWO ROWS FOR ONE TRANSITION, which is what a close that moved the stage actually produced: the
    // operation wrote its event and then moved the stage, so the save wrote a second. Reproduced by
    // calling the single writer twice -- appendStageEvent builds a NEW entity per call, so this really
    // does insert two rows. CD4 counts events on a close that does not move the stage; CD15 counts them
    // on one that does, which is the case nothing covered while the defect was live.
    { id: 'M-ST1', file: DES, expect: ['CD4', 'CD15', 'BD2'],
      from: 'await this.appendStageEvent(work.stageMove);',
      to: 'await this.appendStageEvent(work.stageMove); await this.appendStageEvent(work.stageMove);',
      note: 'one transition, two append-only rows. BROAD BY NATURE: it doubles EVERY event, so seven count-based checks fall (BD1, BD2, BD4, CD4, CD11, CD15, CD16). The three named above are the ones that must, and CD15 is the one that could not before it existed' },

    // THE CASE-SENSITIVE COMPARE. Three writers on one trigger and only this one used ===, so a caller
    // that lowercased its ids was recorded as moving the deal to the stage it was already in.
    { id: 'M-ST2', file: DES, expect: ['SD32'],
      from: "priorStageID.toLowerCase() !== String(this.PipelineStageID ?? '').toLowerCase()",
      to: "priorStageID !== String(this.PipelineStageID ?? '')",
      note: 'a normalised id reads as a stage move, and a self-transition is logged' },

    // THE DEFAULTS WRITER RUNNING ON A DECLARED TRANSITION. A reopen naming a stage had its probability
    // re-derived from that stage, AFTER its own event had stamped the figure being left behind.
    { id: 'M-ST3', file: DES, expect: ['CD16'],
      from: 'this._lockedAtSave || this._declaredTransition ? null : await this.planStageDefaults()',
      to: 'this._lockedAtSave ? null : await this.planStageDefaults()',
      note: 'a reopen loses the probability a human set, and disagrees with its own provenance row' },

    // THE CREATE GUARD ON THE STAGE LOG. A new deal whose stage is set twice -- what NewDeal() plus a
    // rep's choice does -- looked like a MOVE, because the first assignment becomes the OldValue.
    { id: 'M-ST4', file: DES, expect: ['SD30'],
      from: 'if (!this.IsSaved) {\n            return null;\n        }\n\n        const priorStageID',
      to: 'if (false) {\n            return null;\n        }\n\n        const priorStageID',
      note: 'a deal being created logs a transition out of a stage it was never in' },

    // THE SAME QUESTION ON THE OWNER STAMP. Dirty is the right question on an update and useless on a
    // create, so an importer set the column directly and walked past the refusal SD26 pins.
    { id: 'M-OW2', file: DES, expect: ['SD31'],
      from: "if (!this.callerSuppliedValue('OwnerEmployeeID', this.OwnerEmployeeID)) {",
      to: "if (!this.GetFieldByName('OwnerEmployeeID')?.Dirty) {",
      note: 'a created deal keeps a hand-set owner column, disagreeing with its own roster' },

    // ── THE STATUS COMES FROM THE STAGE (item 1), AND THE REOPEN RESTORES IT (item 2) ────────────

    // The derivation itself. Without it a deal created with no status keeps NULL and every IsOpen/IsWon
    // rollup skips it -- which is the state that made it invisible to every surface in the app.
    { id: 'M-ST5', file: DES, expect: ['SD33'],
      from: 'if (plan.DealStatusTypeID) {',
      to: 'if (false && plan.DealStatusTypeID) {',
      note: 'a deal created with no status stays NULL and is counted by nothing' },

    // The fill-but-don't-overwrite half. Dropping the guard makes the stage overwrite a status the
    // caller stated in the same save -- a second writer, which is what this design exists to avoid.
    { id: 'M-ST6', file: DES, expect: ['SD34'],
      from: "if (!this.callerSuppliedValue('DealStatusTypeID', this.DealStatusTypeID)) {",
      to: "if (true) {",
      note: 'the arriving stage overwrites a status the caller stated' },

    // The reopen's derivation. Without it no stage is re-entered, OrderStatusOnEntry never fires, and a
    // reopened deal keeps pointing at an order nothing asked to come back -- DN-18, verbatim.
    { id: 'M-RO1', file: CDO, expect: ['CD18'],
      from: 'const landingStage = input.StageID ?? (await this.priorStageFromCloseEvent(deal.ID, provider, user));',
      to: 'const landingStage = input.StageID ?? null;',
      note: 'a reopen leaves the deal in the closing stage, so nothing asks the order back' },

    // And the other direction: if the derivation returned the stage the deal moved TO rather than the one
    // it came FROM, a stage-moving close would reopen into the closing stage (CD18) while a status-only
    // close would still look correct -- which is exactly why CD19 alone is not enough.
    { id: 'M-RO2', file: CDO, expect: ['CD18'],
      from: "Fields: ['FromStageID', 'ChangedAt'],",
      to: "Fields: ['ToStageID' + ' AS FromStageID', 'ChangedAt'],",
      note: 'the reopen restores the stage the close moved TO, not the one it came from' },

    // THE GATE THAT KEEPS A STAGE FROM CLOSING A DEAL. Without it an ordinary save into a winning or
    // losing stage locks the deal, sets IsWon, and skips everything a close owes -- a board drag books
    // revenue. This is the mutation that reproduces the bug SD33 introduced and SD35 now forbids.
    { id: 'M-ST8', file: DES, expect: ['SD35'],
      from: 'if (status.Success && flags && flags.LocksDeal !== true) {',
      to: 'if (status.Success && flags) {',
      note: 'a stage whose status locks closes the deal on an ordinary save, with no close event, no routing and no contract' },

    // ── THE THREE FIXES OF 2026-08-21 (post-merge) ───────────────────────────────────────────────

    // The amount's provenance. Without the stamp the column is NULL on every new close and Finance is
    // back to joining Deal.AmountIsComputed -- a mutable row -- to classify a historical booking.
    { id: 'M-AP1', file: DES, expect: ['CD20'],
      from: "event.Set('AmountAtTransitionIsComputed', prior.AmountIsComputed);",
      to: "event.Set('AmountAtTransitionIsComputed', null);",
      note: 'a close records no provenance, so the amount is unclassifiable the moment the deal is repriced' },

    // And that it is stamped from the value BEFORE the transition, not after. Reading the current value
    // would make the stamp describe what the deal acquired by arriving.
    { id: 'M-AP2', file: DES, expect: ['CD20'],
      from: "(this.GetFieldByName('AmountIsComputed')?.OldValue as boolean | null | undefined) ?? null,",
      to: "this.AmountIsComputed ?? null,",
      note: 'the stamp follows the deal instead of freezing it. A STANDING MISS, documented rather than removed: CD20 sets AmountIsComputed and SAVES before closing, so at the close OldValue === current and the two readings are indistinguishable. Catching it needs a close whose OWN save changes the flag -- i.e. a deal with priced order lines, where refreshAmountFromOrder flips it inside the closing save -- and this bundle deliberately avoids the orders catalogue (see its header). Kept because the day CD20 gains a priced line it starts working' },

    // The due date. Tasks ships DueAt, IsOverdue, an Overdue KPI and an OnOverdue hook; a null makes all
    // of it inert, which is how orders' own overdue arithmetic stayed wrong for months.
    { id: 'M-DA1', file: CDO, expect: ['CD21'],
      from: 'DueAt: CloseWonTaskDueAt(deal.ClosedAt ?? new Date(), cfg.DueInDays),',
      to: 'DueAt: undefined,',
      note: 'every close-won task goes back to a null due date' },

    // And that the arithmetic is a DATE offset rather than milliseconds-as-days -- the 46,264-day shape.
    { id: 'M-DA2', file: CWT, expect: ['CD21'],
      from: 'Date.UTC(closedAt.getUTCFullYear(), closedAt.getUTCMonth(), closedAt.getUTCDate() + days),',
      to: 'closedAt.getTime() + days,',
      note: 'days are added as MILLISECONDS, so the due date lands microscopically after the close' },

    // The derived closing stage. Without it no close driven from a browser moves the stage, so no reopen
    // driven from a browser can restore one -- DN-18, verbatim.
    { id: 'M-CS1', file: CDO, expect: ['CD22'],
      from: 'const closingStage = input.ClosingStageID ?? derivedClosingStageID;',
      to: 'const closingStage = input.ClosingStageID;',
      note: 'a close with no ClosingStageID leaves the stage alone, and the reopen has nothing to restore' },

    // And that the stage is chosen by the OUTCOME's flag rather than by display order alone: swapping the
    // predicate sends a won close into the losing stage.
    { id: 'M-CS2', file: CDO, expect: ['CD22'],
      from: "ExtraFilter: target.IsWon ? 'IsWon = 1' : 'IsLost = 1',",
      to: "ExtraFilter: target.IsWon ? 'IsLost = 1' : 'IsWon = 1',",
      note: 'a won close lands in the stage that declares LOST' },

    // CD17 CANNOT BE FELLED BY A SINGLE EDIT TO THE STATUS WRITER, and that is a finding rather than a
    // gap. Measured: M-ST3 removes the declared-transition suppression so the defaults writer DOES run on
    // a close, and CD17 stays green -- because the closing status also arrives dirty, so
    // callerSuppliedValue answers "theirs" anyway. Two independent mechanisms protect it. This mutant
    // therefore proves the check is not VACUOUS rather than isolating one guard: it stops the close
        /**
         * M-WT3P -- aimed at WT3.
         *
         * WT3 is "a policy that creates NO contract raises ONLY the order-review task". Forcing the branch
         * true raises a second task the policy never asked for.
         */
        { id: 'M-WT3P', file: CWT, expect: ['WT3'],
          from: '        if (await this.policyRaisesContractTask(input.PipelineID, contextUser, result)) {',
          to: '        if (true) {',
          note: 'every policy raises the contract task, including the ones that create no contract' },

        /**
         * -- UNPROVEN, AND SAYING SO IS THE POINT ------------------------------------------------
         *
         * CORRECTED: this block once claimed six mutants below. Only THREE existed -- M-WT6T, M-WT8O
         * and M-WT12C were named in a run command but never authored, and the driver's silent id filter
         * hid it. All six exist now, and the driver errors on an unknown id rather than skipping it.
         *
         * The mutants below were AUTHORED but
         * NOT MEASURED. Their anchors were read from source and M-WT2R's is confirmed to apply -- a
         * killed run left its `if (true) {` in the working tree, which is proof the replacement
         * matched. What has not happened is a completed run, so nothing here claims they fell
         * anything.
         *
         * An unproven mutant that quietly SKIPS is the failure mode this driver exists to prevent, so
         * it is labelled rather than left to look like the proven ones above it. Run them before
         * quoting them, and re-check the anchors first: this was written against a tree that was
         * about to take a merge moving the Explorer spec map.
         */
        /**
         * M-WT2R -- aimed at WT2.
         *
         * WT2 asserts an assignment EXISTS with the role it was given. Making route() decline for every
         * task removes the assignment while leaving the task, which is exactly the half WT2 owns. WT7
         * still passes, because an unrouted task is what WT7 wants.
         */
        { id: 'M-WT2R', file: CWT, expect: ['WT2'],
          from: '        if (!input.Assignee?.RecordID || !input.Assignee?.EntityName) {',
          to: '        if (true) {',
          note: 'routing always declines, so the task is raised with no assignment at all' },

        /**
         * M-WT7S -- aimed at WT7.
         *
         * WT7 is "created but UNROUTED and SAYS SO". The task and the missing assignment are unchanged;
         * only the report is removed, so this isolates the half WT7 actually owns rather than re-testing
         * WT2.
         */
        { id: 'M-WT7S', file: CWT, expect: ['WT7'],
          from: '            result.Issues.push(\n                `The ${kind} task was created but NOT routed: no finance assignee is configured on the `\n                    + \'pipeline\\\'\\\'s CloseWonPolicy (CloseWonTasks.AssigneeRecordID).\',\n            );',
          to: '',
          note: 'the unrouted task no longer SAYS it is unrouted -- it just quietly has no assignee' },

        /**
         * M-WT5F -- aimed at WT5.
         *
         * WT5 is "with no contract yet, the contract task falls back to the DEAL rather than going
         * missing". The fallback is the DEFAULT value of `target`, not the branch that overrides it -- an
         * earlier attempt disabled the override instead and forced the fallback ALWAYS, which fells WT4
         * and WT14 and leaves WT5 green. Emptying the default is what makes the task go missing.
         */
        { id: 'M-WT5F', file: CWT, expect: ['WT5'],
          from: '                let target: CloseWonTaskTarget = { EntityName: E_DEAL, RecordID: input.DealID };',
          to: '                let target: CloseWonTaskTarget = { EntityName: E_DEAL, RecordID: \'\' };',
          note: 'the deal fallback carries no record id, so a contract task with no contract links nothing' },

        /**
         * M-WT6T -- aimed at WT6.
         *
         * WT6 asserts the refusal is REPORTED and the order review still lands. Skipping the branch drops
         * the reason.
         */
        { id: 'M-WT6T', file: CWT, expect: ['WT6'],
          from: '            if (contractTypeID) {',
          to: '            if (false) {',
          note: 'a missing contract task type is skipped silently instead of refused with a reason' },

        /**
         * M-WT8O -- aimed at WT8.
         *
         * WT8 is "raises NO order-review task, AND SAYS WHY". The task is still not raised (line 309
         * guards that independently), so this isolates the explanation.
         */
        { id: 'M-WT8O', file: CWT, expect: ['WT8'],
          from: '        if (!input.OrderID) {',
          to: '        if (false) {',
          note: 'a deal with no order stops saying why it raised no order-review task' },

        /**
         * M-WT12C -- aimed at WT12.
         *
         * WT12 is "Code where the column exists, Name only where it does not". Collapsing the ternary
         * removes the first half.
         */
        { id: 'M-WT12C', file: CWT, expect: ['WT12'],
          from: '     return info?.Fields?.some((f) => f.Name === \'Code\') === true ? \'Code\' : \'Name\';',
          to: '     return \'Name\';',
          note: 'the lookup always uses Name, even where a Code column exists' },

        /**
         * -- DN-20: THE TWO DIRECTIONS OF THE BOOKED-ORDER REFUSAL --------------------------------
         *
         * `close-deal.CD24` asserts both halves of one rule: a BOOKED order refuses the reopen, and a
         * confirmed-then-VOIDED one does not. The two mutants below break one direction each, because
         * the plausible future edit here is a "simplification" that looks tidier and is wrong twice.
         *
         * `IsBooked` is `Confirmed | Posted | Fulfilled`. The two things someone would write instead:
         *
         *   `orderStatus === 'Confirmed'` UNDER-blocks -- the lifecycle runs on to Posted and Fulfilled,
         *   where the ledger has moved furthest. It is also a string comparison against ANOTHER APP'S
         *   vocabulary, which is the shape the vocabulary gate exists to catch.
         *
         *   anything timestamp-shaped (`ConfirmedAt IS NOT NULL`, here modelled as "any status at all")
         *   OVER-blocks -- a confirmed-then-voided order keeps ConfirmedAt forever, and refusing there
         *   blocks the one case where the ledger has been SETTLED.
         *
         * One mutant per direction, so a future edit cannot satisfy the check by breaking the half it
         * was not aimed at.
         */
        { id: 'M-RB1', file: CDO, expect: ['CD24'],
          from: '            if (orderStatus && IsBooked(orderStatus)) {',
          to: "            if (orderStatus && orderStatus === 'Confirmed') {",
          note: 'the refusal narrows to an equality test, so a POSTED order reopens behind a moved ledger' },

        { id: 'M-RB2', file: CDO, expect: ['CD24'],
          from: '            if (orderStatus && IsBooked(orderStatus)) {',
          to: '            if (orderStatus) {',
          note: 'the refusal widens to any status, so a confirmed-then-VOIDED order is refused a reopen it should get' },


    // setting the status at all, which naturally fells everything that asserts a close outcome.
    { id: 'M-ST7', file: CDO, expect: ['CD17'],
      from: '        const now = new Date();\n        deal.DealStatusTypeID = target.ID;',
      to: '        const now = new Date();\n        deal.DealStatusTypeID = deal.DealStatusTypeID;',
      note: 'the close stops setting the status. BROAD BY DESIGN -- every check asserting a close outcome falls with it' },

    // The task NAME. Reverting it to the id reproduces a finance queue rendered as rows of hex -- the
    // defect exactly, and the reason WT15 asserts from both ends rather than just looking for the name.
    { id: 'M-TN1', file: CWT, expect: ['WT15'],
      from: 'Name: `Review order for ${input.DealName}`,',
      to: 'Name: `Review order for deal ${input.DealID}`,',
      note: 'the order-review task is named after a UUID again' },

    // And the DEAL LINK. Without it neither task is reachable from the deal that caused it, which is the
    // first navigation a rep tries and the one no other check looked for.
    { id: 'M-TL1', file: CWT, expect: ['WT16'],
      from: '                { EntityName: E_DEAL, RecordID: input.DealID },',
      to: '',
      note: 'the order-review task drops its deal link, so the work is unreachable from the deal' },

    // WT1 had NO mutant, and WT1 is the check that read green while guessing -- it indexed an unfiltered
    // link list, so it passed or failed on whichever row the database returned first. A check with that
    // history is the last one that should be trusted on an unproven green. This points the review task's
    // primary at the deal instead of the order, which is precisely what WT1 claims cannot happen: finance
    // opens the review task and there is no order on it.
    { id: 'M-WT1O', file: CWT, expect: ['WT1'],
      from: "                { EntityName: 'MJ_BizApps_Orders: Order Headers', RecordID: input.OrderID },",
      to: '                { EntityName: E_DEAL, RecordID: input.DealID },',
      note: 'the review task points at the deal instead of the order, so nothing links to the order' },

    // WT4 had no mutant either. Its claim is that the contract task is never STRANDED, which is a
    // different statement from WT14's (that it does not fall back to the deal INSTEAD of the contract) --
    // so it needs its own. This drops the contract task's own target and leaves only the deal link, which
    // is the shape where the task exists, looks linked, and cannot reach the contract it is about.
    { id: 'M-WT4L', file: CWT, expect: ['WT4'],
      from: '                    [target, { EntityName: E_DEAL, RecordID: input.DealID }],',
      to: '                    [{ EntityName: E_DEAL, RecordID: input.DealID }],',
      note: 'the contract task keeps only its deal link, stranding it from the contract' },

    // CT4's mutant. A downstream that reports success without writing is the worst of the three
    // possible failures -- worse than throwing, because nothing looks wrong until somebody asks where
    // the agreement went. This flips exactly that bit and nothing else.
    { id: 'M-CT1', file: LCS, expect: ['CT4'],
      from: "        if (!resolved.ID) {\n            return {\n                Success: false,",
      to: "        if (!resolved.ID) {\n            return {\n                Success: true,",
      note: 'an unresolvable contract type is reported as a successful create' },

    // CT5's mutant: back to the hardcoded false the deal had no column to replace. Every contract then
    // claims the standard agreement was untouched, including the negotiated ones.
    { id: 'M-CT2', file: LCS, expect: ['CT5'],
      from: "contract.Set('HasModifications', input.StandardAgreementModified === true);",
      to: "contract.Set('HasModifications', false);",
      note: 'the rep answered and the contract ignores it' },

    // THE SECOND HOP of the same wiring, and a different question: does anything notice if the close
    // stops REPORTING the flag? First time it was asked, NOTHING DID -- fifty checks green while a
    // negotiated agreement reached finance marked standard. CT6 was written for this mutant.
    { id: 'M-CT3', file: CDO, expect: ['CT6'],
      from: 'StandardAgreementModified: deal.StandardAgreementModified,',
      to: 'StandardAgreementModified: false,',
      note: 'the close reports the flag as false regardless of what the deal says' },

    // CD23's two mutants, one per half, because the check makes two independent claims and a single
    // mutant that felled both would not tell you which one was load-bearing.

    // Half one: the warning stops reaching Issues. Routing still carries the reason, the workspace still
    // renders it, and a programmatic caller is blind again -- which is exactly the state before the fix.
    { id: 'M-RI1', file: CDO, expect: ['CD23'],
      from: 'Issues: [...taskIssues, ...orderStatusIssues(deal), ...routingIssues(routing)],',
      to: 'Issues: [...taskIssues, ...orderStatusIssues(deal)],',
      note: 'a refused downstream route is reported in Routing only, so a caller reading Success and Issues sees unqualified success' },

    // Half two: THE ONE THAT MATTERS. Somebody reads a warning-severity Issue as a defect and "fixes" it
    // by failing the close. The deal is won, the status is written, the order is intact -- and the whole
    // thing rolls back over a contract that legitimately could not be derived. CD23 asserts Success as
    // loudly as it asserts the warning, and this proves that half is live rather than decorative.
    { id: 'M-RI2', file: CDO, expect: ['CD23'],
      from: '                Success: true,\n                /**\n                 * TWO SOURCES OF NON-FATAL WARNINGS, ONE FIELD, AND A STATED ORDER.',
      to: '                Success: routingIssues(routing).length === 0,\n                /**\n                 * TWO SOURCES OF NON-FATAL WARNINGS, ONE FIELD, AND A STATED ORDER.',
      note: 'a refused route now FAILS the close -- the regression CD23 exists to catch, not the warning going missing' },

    // ══ activities · AC1-AC22 ═════════════════════════════════════════════════════════════════
    //
    // The ingest is a four-stage pipeline behind a source seam -- fetch, filter for relevance, match a
    // deal, write -- and every mutant below breaks exactly one stage. Naming follows the check family
    // it targets, as M-CD*/M-CT* do, so a red assertion and the mutant that felled it share a prefix.

    // Idempotency. The ingest re-reads a window on every run by design (D-17: GetMessages has no date
    // filter), so without the external-key lookup a second sync duplicates every activity it already
    // wrote. `if (false && ...)` rather than deleting the read, so nothing becomes unused and the
    // mutation is a behaviour change rather than a compile change.
    { id: 'M-AC1', file: AWS, expect: ['AC8', 'AC13'],
      from: '        if (existing) {\n            result.Success = true;\n            result.ActivityID = existing;',
      to: '        if (false && existing) {\n            result.Success = true;\n            result.ActivityID = existing;',
      note: 'the dedupe read still happens and its answer is ignored, so a re-run writes everything twice' },

    // The party links go under COMMON's entities, because `SalesContact.ID` IS `Person.ID` (shared-PK
    // IsA) -- so a link under the sales child resolves for a sales-extended person and silently fails
    // to resolve for everyone else, which is the worst version of this bug: it works in the demo.
    { id: 'M-AC2', file: AV, expect: ['AC3', 'AC13'],
      from: "export const E_PERSON = 'MJ_BizApps_Common: People';",
      to: "export const E_PERSON = 'MJ_BizApps_Sales: Sales Contacts';",
      note: 'contact links land under the sales child instead of the common parent' },

    // Relevance fails OPEN: every fetched item is judged relevant, so a tenant-wide mailbox read files
    // the entire tenant's mail against deals.
    { id: 'M-AC3', file: RF, expect: ['AC6', 'AC7'],
      from: '            return { Item: item, IsRelevant: matches.length > 0, Matches: matches, Unmatched: unmatched };',
      to: '            return { Item: item, IsRelevant: true, Matches: matches, Unmatched: unmatched };',
      note: 'nothing is irrelevant, which is how a mailbox read becomes a data-protection incident' },

    // A STANDING MISS, kept rather than removed -- same shape as M-AP2 above.
    //
    // This reverts `RelevanceFilter.lookup`'s failure report from `failed: true` to `failed: false`, so
    // a ContactMethod read that BLIPPED is filed as "nothing was relevant". The watermark then advances
    // over a batch of real mail that can never be fetched again, because GetMessages has no date filter
    // to re-fetch it with (D-17).
    //
    // Nothing in this repository can kill it, and that is a measured conclusion rather than an untried
    // one. Provoking a real `RunView` failure against a registered entity means revoking a permission,
    // dropping a view or killing the connection -- none available inside a rolled-back transaction, and
    // all of which would take the rest of the suite with them. AC22 covers the CONSEQUENCE by INJECTING
    // a filter that reports a failed lookup, which is why AC22 cannot fall to this mutant: it never
    // calls the real `lookup` at all.
    //
    // So the handling is proven and the reporting is not. `expect` names AC22 deliberately, so this
    // reports MISS on every run and the gap stays visible instead of being implied by an absence.
    { id: 'M-AC4', file: RF, expect: ['AC22'],
      from: '            return { known, failed: true };',
      to: '            return { known, failed: false };',
      note: 'A STANDING MISS. A failed contact-method read is reported as a successful one, so a transient error is filed as a batch of irrelevant mail and the watermark advances over it permanently. AC22 asserts the HANDLING through an injected filter and therefore cannot fall to this mutant; killing it would need a real read failure, which cannot be provoked without breaking the database for every other check. Retained so the gap is stated rather than absent' },

    // A cancelled meeting is an activity that DID NOT HAPPEN. Storing it Completed makes "did we meet
    // them" unanswerable from the record (D-25).
    { id: 'M-AC5', file: AIS, expect: ['AC18'],
      from: "                    Status: item.Cancelled ? 'Cancelled' : 'Completed',",
      to: "                    Status: 'Completed',",
      note: 'a cancelled meeting is recorded as one that took place' },

    // The watermark must not pass items that were never written. Failed and discarded are different
    // facts, and only one of them is safe to advance over.
    { id: 'M-AC6', file: AIS, expect: ['AC20'],
      from: '            if (batch.HighWatermark && result.Failed === 0) {',
      to: '            if (batch.HighWatermark) {',
      note: 'the watermark advances past items whose write failed, so they are lost silently' },

        /**
         * -- AIMED AT AC22'S CONSUMER, BECAUSE AC22 INJECTS ITS COLLABORATOR ------------------------
         *
         * AC22 was the only check in the suite no mutation could fell, which made it read like the
         * strongest vacuous-pass candidate in the campaign. It is the opposite: six assertions, and it
         * pins the distinction the branch exists for -- `Failed: 2`, not `Irrelevant: 2`, because a
         * failed lookup means the items were never JUDGED, which is a different fact from being judged
         * irrelevant.
         *
         * It was unreachable because it substitutes its collaborator: it subclasses `RelevanceFilter`
         * inline and overrides `Apply` outright, so every mutation of the real filter is invisible to
         * it. Its docblock says so deliberately -- it is the one check that injects rather than drives,
         * to reach a branch no arrangement of real data can produce.
         *
         * So this aims at the CONSUMER of that signal instead. `result.Failed += allowed.length` is the
         * line that holds the watermark: `Success` is `Failed === 0`, and the watermark only moves on a
         * successful run. Booking the batch as Irrelevant instead makes a transient database blip look
         * exactly like a mailbox of personal mail -- the original defect, restored in one token.
         *
         * THE IRONY IS WORTH RECORDING: AC22 exists because a mutation found this gap, and it had since
         * become unreachable by the same tool. A check that cannot be falsified is indistinguishable
         * from one that asserts nothing, however good it is -- so the fix is a mutation that can reach
         * it, not a rewrite of a check that was right all along.
         */
        { id: 'M-AC11', file: AIS, expect: ['AC22'],
          from: '                result.Failed += allowed.length;',
          to: '                result.Irrelevant += allowed.length;',
          note: 'a failed lookup is booked as an irrelevant batch -- what used to discard real mail' },

    // And that the run SAYS it failed. Without this the scheduled job reports success over a sync that
    // wrote nothing, which is the state the source seam exists to keep distinguishable.
    { id: 'M-AC7', file: AIS, expect: ['AC20'],
      from: '            result.Success = result.Failed === 0;',
      to: '            result.Success = true;',
      note: 'a sync with failures in it reports success' },

    // THE FIXTURE'S OWN SEMANTICS, which is the mutant that matters most in this bundle.
    //
    // A calendar's watermark is the INGEST INSTANT, not the newest event start -- a meeting booked for
    // next year would otherwise push the watermark into the future and every event created afterwards
    // for an earlier date would never be seen again. The fixture mirrors that rule on purpose. When it
    // did NOT, `AC14` asserted the broken value and passed for a day: a fixture that reproduces a bug
    // cannot detect it.
    { id: 'M-AC8', file: FAS, expect: ['AC14', 'AC19'],
      from: "        const watermark = this.Kind === 'Calendar'\n            ? this.fetchedAt\n            : new Date(Math.max(...eligible.map((i) => i.StartedAt.getTime())));",
      to: '        const watermark = new Date(Math.max(...eligible.map((i) => i.StartedAt.getTime())));',
      note: 'the fixture stops mirroring each surface real rule and reports a calendar watermark from the event start' },

    // The same rule in the REAL Graph source, which for a day was upheld only by the fixture. AC21
    // drives this class with a stub fetcher, because no arrangement of fixture data can reach it.
    { id: 'M-AC9', file: MGC, expect: ['AC21'],
      from: '                HighWatermark: items.length ? fetchedAt : null,',
      to: '                HighWatermark: items.length ? new Date(Math.max(...items.map((i) => i.StartedAt.getTime()))) : null,',
      note: 'was M-CAL-WATERMARK. The live calendar source reports the newest event start as its watermark, so one meeting booked far ahead blinds the sync from then on' },

    // The tenant gate. Mail.Read under app-only auth reads EVERY mailbox in the tenant until an Exchange
    // Application Access Policy scopes it, and no such policy has been applied. Default-false is the
    // only thing standing between wiring this class up and reading the whole tenant.
    { id: 'M-AC10', file: MGA, expect: ['AC11'],
      from: '        if (!this.AllowLiveFetch) {',
      to: '        if (false) {',
      note: 'the tenant-admin gate is removed and a live fetch is attempted by default' },

    // ══ forecast · FS1-FS13 ══════════════════════════════════════════════════════════════════

    // Zero rows WITH issues is a failure, not a quiet quarter. Before this guard the two were
    // indistinguishable -- and `FS8` asserted only that nothing was WRITTEN, which is equally true of a
    // quarter with no deals, so removing the guard changed no observable. FS8 was rewritten for it.
    { id: 'M-FS1', file: FSJ, expect: ['FS8'],
      from: '        if (batch.Rows.length === 0 && batch.Issues.length > 0) {',
      to: '        if (false) {',
      note: 'a forecast query that could not run reports the same result as a period with no deals' },

    // The column mapping. `Sales: Forecast by Owner` projects `ClosedWonAmount`; the storage column is
    // `ClosedAmount` (D6, because COMMIT is reserved in Postgres). Drop the translation and the amount
    // reads as zero -- silently, since a missing key and a zero total look the same downstream.
    { id: 'M-FS2', file: QFS, expect: ['FS11', 'FS12'],
      from: "    ClosedAmount: ['ClosedWonAmount', 'ClosedAmount'],",
      to: "    ClosedAmount: ['ClosedAmount'],",
      note: 'the real query name is no longer accepted, so every closed amount maps to zero' },

    // Same-day re-run SKIPS. Overwriting a capture would edit history, which is what a snapshot exists
    // to prevent; duplicating it would double every rollup that sums the period.
    { id: 'M-FS3', file: FSJ, expect: ['FS3'],
      from: '            if (existing.has(key)) {\n                result.SkippedAsAlreadyCaptured++;\n                continue;\n            }',
      to: '            if (false) {\n                result.SkippedAsAlreadyCaptured++;\n                continue;\n            }',
      note: 'a second run the same day writes a second snapshot for the same grain' },

    // A reversed period is refused by the JOB, before CK_ForecastSnapshot_PeriodOrder sees it -- so the
    // error names the caller rather than a constraint.
    { id: 'M-FS4', file: FSJ, expect: ['FS6'],
      from: '        if (period.PeriodEnd < period.PeriodStart) {',
      to: '        if (false) {',
      note: 'a reversed period reaches the database and fails on a constraint name instead' },

    // The default period is the current calendar month IN UTC. Read in local time it is the wrong month
    // for the first hours of every month for anyone west of Greenwich -- and `FS7` could not see it
    // until its sample moved: it used 23:30Z on the 31st, which is still the 31st locally on this host,
    // so the two readings agreed exactly where it was looking.
    { id: 'M-FS5', file: FSJ, expect: ['FS7'],
      from: '    const year = now.getUTCFullYear();\n    const month = now.getUTCMonth();',
      to: '    const year = now.getFullYear();\n    const month = now.getMonth();',
      note: 'the month boundary is read in the host timezone, so a snapshot lands in the previous period' }
];

const wanted = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')));

/**
 * AN UNKNOWN ID IS A FAILURE, NOT A SKIP.
 *
 * `wanted` was filtered against MUTATIONS with a bare `continue`, so asking for a mutant that does not
 * exist ran nothing and said nothing. That is how three ids -- M-WT6T, M-WT8O, M-WT12C -- were listed in
 * a run command, never authored, and then reported as "authored but unproven": the run produced no line
 * for them and their absence looked exactly like the timeout that killed the rest of the batch.
 *
 * A tool that silently does less than it was asked is the same failure shape as a gate that scans
 * nothing and reports clean.
 */
if (wanted.size) {
    const known = new Set(MUTATIONS.map((m) => m.id));
    const unknown = [...wanted].filter((id) => !known.has(id));
    if (unknown.length) {
        console.error(`\n✖ no such mutant: ${unknown.join(', ')}`);
        console.error('  Run with --list to see the ids that exist. Nothing was run.\n');
        process.exit(2);
    }
}
if (process.argv.includes('--list')) {
    for (const m of MUTATIONS) console.log(`${m.id.padEnd(8)} ${m.file.padEnd(56)} expect ${m.expect.join(',')}`);
    process.exit(0);
}

const FAIL_RE = /^ {2,}✖ ([A-Z]+\d+):/gmu;
const TALLY_RE = /(\d+) passed,\s+(\d+) failed,\s+(\d+) skipped/;

/**
 * Holds the suite lock for one mutant's WHOLE attempt sequence.
 *
 * ── WHY THE DRIVER HOLDS IT RATHER THAN EACH SUITE RUN ─────────────────────────────────────────
 *
 * The retry exists to survive a DEADLOCK: another writer on the host kills one of the suite's
 * transactions, the result is meaningless, and the run is discarded and repeated. That is correct.
 *
 * What it also did was re-QUEUE. Each attempt acquired the lock for itself, so a mutant that
 * deadlocked twice paid the queue three times -- measured at 46.6s on a quiet evening, and the reason
 * four consecutive attempts at this batch died on a ten-minute ceiling having printed nothing.
 *
 * A deadlock and a queue are opposite conditions and were being handled identically. A deadlock means
 * RETRY. A queue means WAIT -- and waiting a second time for something you were already waiting for is
 * just paying twice.
 *
 * So: acquire once here, tell the child not to acquire, run the attempts, release. The wait is paid
 * once per mutant AND it is visible, because this process owns it and can print while it blocks --
 * which the previous `⏳` probe could not do, sampling only at spawn time while the queue happened
 * inside the run afterwards.
 *
 * Released in a `finally` per mutant rather than held across the campaign: a driver that squats on the
 * lock for an hour is a worse neighbour than one that queues.
 */
async function withSuiteLock(label, fn) {
    let sql;
    let pool = null;
    try {
        sql = (await import('mssql')).default;
        await import('dotenv/config');
        pool = await new sql.ConnectionPool({
            server: process.env.DB_HOST ?? 'localhost',
            port: Number(process.env.DB_PORT ?? 1433),
            database: process.env.DB_DATABASE,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            options: { trustServerCertificate: true, encrypt: true },
            pool: { max: 1, min: 1 },
            requestTimeout: 20 * 60_000,
        }).connect();
    } catch {
        /**
         * NO CONNECTION MEANS NO CLAIM. Fall through and let the child acquire the lock itself, exactly
         * as it did before. Degrading to the slower-but-correct path beats running unserialised.
         */
        if (pool) { try { await pool.close(); } catch { /* already gone */ } }
        return await fn(false);
    }

    const ask = async (timeoutMs) => {
        const r = pool.request();
        r.input('Resource', sql.NVarChar(255), 'bizapps-sales:integration-suite');
        r.input('LockMode', sql.NVarChar(32), 'Exclusive');
        r.input('LockOwner', sql.NVarChar(32), 'Session');
        r.input('LockTimeout', sql.Int, timeoutMs);
        return (await r.execute('sp_getapplock')).returnValue;
    };

    try {
        let rc = await ask(0);
        if (rc < 0) {
            console.log(`${label.padEnd(7)} ⏳ queued on the suite lock — waiting once for this mutant, `
                + 'not once per attempt.');
            const t0 = Date.now();
            rc = await ask(15 * 60_000);
            if (rc < 0) {
                console.log(`${label.padEnd(7)} ✖ could not acquire the suite lock in 15 min — `
                    + 'falling back to per-attempt locking.');
                return await fn(false);
            }
            console.log(`${label.padEnd(7)} ✔ lock acquired after ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
        }
        return await fn(true);
    } finally {
        try { await pool.close(); } catch { /* the session is gone, which released it */ }
    }
}

const safety = mkdtempSync(join(tmpdir(), 'mj-mutate-'));
const results = [];

/**
 * ── THE COMPILED OUTPUT MUST ACTUALLY CHANGE, OR THE RUN MEASURED NOTHING ───────────────────────
 *
 * A mutant is applied to a .ts SOURCE and measured by a suite that loads compiled .js. If the build
 * between them does not carry the edit through, the suite runs the ORIGINAL code and every check
 * passes -- and the driver reports `MISS failed=-`, which is the strongest claim it makes: this
 * mutation killed nothing, so the check that names the behaviour may be vacuous.
 *
 * IT HAPPENED. `M-WT2R` was reported MISS at 125/0. The identical mutation applied by hand, verified
 * present in dist/, gave 119 passed / 6 failed -- WT1, WT2, WT3, WT9, WT10, CD23 -- which is also the
 * exact six-check signature seen earlier when that same mutation was stranded in dist/. Two
 * independent observations, and WT2 would have been filed as unproven on the strength of the first.
 *
 * A FALSE MISS IS WORSE THAN A SKIP. A skip announces itself. A MISS looks like a finding.
 *
 * ── WHY A HASH DIFF AND NOT A SUBSTRING SEARCH ─────────────────────────────────────────────────
 *
 * The obvious guard -- look for the mutated text in dist/ -- fails on anything the compiler rewrites.
 * `const stageOrder: StageOrderPlan | null = null;` emits as `const stageOrder = null;`, so a literal
 * search would report a perfectly good mutation missing and turn a false MISS into a false ERROR.
 *
 * Comparing the compiled file BEFORE and AFTER the build asks the question that actually matters --
 * did the edit reach the artefact the suite loads -- without knowing anything about TypeScript.
 *
 * A mutation that is genuinely a no-op in emitted JS (a type-only change) trips this too. That is
 * correct: such a mutation cannot be measured by a runtime suite, and saying so is the point.
 */
function distPathFor(srcRel) {
    if (!srcRel.includes('/src/') || !srcRel.endsWith('.ts')) return null;
    return join(REPO, srcRel.replace('/src/', '/dist/').replace(/\.ts$/, '.js'));
}

function distFingerprint(srcRel) {
    const p = distPathFor(srcRel);
    if (!p || !existsSync(p)) return null;
    return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** Restores from the byte-for-byte copy and PROVES it. Never `git checkout`. */
function restore(abs, backup) {
    copyFileSync(backup, abs);
    if (readFileSync(abs, 'utf8') !== readFileSync(backup, 'utf8')) {
        console.error(`\n✖ RESTORE FAILED for ${abs}\n  The original is still at ${backup} — copy it back by hand before doing anything else.\n`);
        process.exit(3);
    }
}

for (const m of MUTATIONS) {
    if (wanted.size && !wanted.has(m.id)) continue;

    const abs = join(REPO, m.file);
    const original = readFileSync(abs, 'utf8');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const norm = original.split('\r\n').join('\n');

    const hits = norm.split(m.from).length - 1;
    if (hits !== 1) {
        console.log(`${m.id.padEnd(7)} SKIPPED — anchor appears ${hits} times in ${basename(m.file)}`);
        results.push({ ...m, skipped: `anchor ${hits}` });
        continue;
    }

    // SAFETY FIRST — the copy is taken before a single byte changes.
    const backup = join(safety, `${m.id}-${basename(m.file)}`);
    copyFileSync(abs, backup);

    // Taken BEFORE the edit, so the comparison after the build is against the untouched artefact.
    const distBefore = distFingerprint(m.file);

    const mutated = norm.replace(m.from, m.to);
    writeFileSync(abs, eol === '\r\n' ? mutated.split('\n').join('\r\n') : mutated);

    const started = Date.now();
    try {
        try {
            execSync('npm run build:packages', { cwd: REPO, stdio: 'pipe' });
        } catch (err) {
            const text = String(err.stdout ?? '') + String(err.stderr ?? '');
            const lines = text.split('\n').filter((l) => /error/i.test(l)).slice(0, 2);
            console.log(`${m.id.padEnd(7)} BUILD FAILED — ${lines.map((l) => l.trim().slice(0, 100)).join(' | ')}`);
            results.push({ ...m, skipped: 'build' });
            continue;
        }

        /**
         * THE EDIT MUST HAVE REACHED dist/. Anything else is not a measurement, and must not be
         * allowed to look like one -- see the note on `distFingerprint`.
         */
        const distAfter = distFingerprint(m.file);
        if (distBefore !== null && distAfter !== null && distBefore === distAfter) {
            console.log(
                `${m.id.padEnd(7)} ✖ BUILD DID NOT CARRY THE MUTATION — ${distPathFor(m.file)} is byte-identical `
                + 'before and after. The suite would have run the ORIGINAL code and reported a false MISS. '
                + 'Nothing was measured.',
            );
            results.push({ ...m, skipped: 'dist-unchanged' });
            continue;
        }

        /**
         * ── A DEADLOCKED RUN IS NOT A RESULT. RE-RUN IT. ────────────────────────────────────────
         *
         * The suite now takes an application lock, so two integration runs serialise instead of
         * fighting. That does NOT cover every writer on the host: MJAPI serving Explorer reads the
         * same tables, and a plain `SELECT TOP 1000 * FROM vwDeals` was captured in the deadlock
         * graph as the other half of a cycle that killed a check mid-campaign.
         *
         * Left alone, that lands in this driver as a check failing under a mutation -- which is
         * exactly the signal it is trying to measure, and indistinguishable from a real kill. A
         * campaign of 75 mutants would then report a handful of kills that are pure noise, and the
         * noise moves every run.
         *
         * So contention is DETECTED and the mutant re-run, rather than averaged over or explained
         * away in the write-up. If it still shows after the retries, the result is MARKED rather
         * than quietly trusted -- an unreliable measurement that says so is worth more than a clean
         * number that is wrong.
         */
        const CONTENTION_RE = /was deadlocked on lock resources|deadlock victim/i;
        const runSuiteOnce = (extraEnv = {}) => {
            try {
                return execSync('node test-harnesses/integration.mjs', {
                    cwd: REPO, stdio: 'pipe', encoding: 'utf8',
                    env: { ...process.env, RUN_MUTATION_TESTS: '1', ...extraEnv },
                });
            } catch (err) {
                // a failing suite exits non-zero, which is the POINT
                return String(err.stdout ?? '') + String(err.stderr ?? '');
            }
        };

        /**
         * ── SAY IT OUT LOUD WHEN THE RUN IS QUEUED, BECAUSE THE SUITE'S OWN MESSAGE IS SWALLOWED ──
         *
         * `integration.mjs` takes an application lock and, when another run holds it, prints
         * "WAITING up to Ns for it to finish — this is not a hang". That message exists precisely so a
         * queued run is not mistaken for a wedged one.
         *
         * It never reaches a human from here. The suite is spawned with `stdio: 'pipe'` so its output can
         * be PARSED -- the ✖ lines the tally is read from arrive on stderr -- which means every word it
         * prints lands in a buffer until the run ends. A run queued behind another session therefore
         * shows absolutely nothing for up to fifteen minutes.
         *
         * That cost a night: three runs hit a ten-minute tool timeout having printed zero bytes, and the
         * diagnosis went to host contention -- measured and disproved (2.5 min per mutant, no deadlocks,
         * lock free) -- before the real answer turned out to be the lock working correctly with its
         * explanation trapped one layer up, inside its own consumer.
         *
         * So the driver asks the question itself, BEFORE spawning, and prints the answer where a person
         * can see it. Stdout stays piped, so parsing is untouched.
         */
        /**
         * The lock is taken HERE, around every attempt, rather than by each attempt. See
         * `withSuiteLock`: a deadlock means retry, a queue means wait, and the two were being paid for
         * identically. The spawn-time probe this replaces could only sample BEFORE the run; the queue
         * happens inside it, which is why four batches died on a ten-minute ceiling printing nothing.
         */
        let out = '';
        let contended = 0;
        await withSuiteLock(m.id, async (held) => {
            const childEnv = held ? { MJ_INTEGRATION_LOCK_HELD_BY_PARENT: '1' } : {};
            for (let attempt = 1; attempt <= 3; attempt++) {
                out = runSuiteOnce(childEnv);
                if (!CONTENTION_RE.test(out)) break;
                contended++;
                if (attempt < 3) {
                    console.log(`${m.id.padEnd(7)} ⚠ deadlock during the run — discarding and re-running `
                        + `(${attempt + 1}/3). No re-queue: the lock is already held.`);
                }
            }
        });
        const stillContended = CONTENTION_RE.test(out);

        const failed = [...new Set([...out.matchAll(FAIL_RE)].map((x) => x[1]))].sort();
        const tally = out.match(TALLY_RE);
        /**
         * NO TALLY MEANS THE SUITE NEVER FINISHED, SO THERE IS NOTHING TO CONCLUDE.
         *
         * Without this the line read `MISS failed=- (NO TALLY)` -- which looks exactly like a mutant that
         * ran cleanly and killed nothing, the single most interesting result this driver produces. It is
         * the opposite: no measurement happened at all. A killed run, a crashed provider or a suite that
         * died in startup all land here.
         *
         * Reported as INCOMPLETE and excluded from `hit`, so it can never be counted as a mutant that
         * failed to kill its target.
         */
        const incomplete = !tally;
        const hit = !incomplete && m.expect.every((id) => failed.includes(id));
        results.push({ ...m, failed, tally: tally?.[0], contended, stillContended });
        console.log(
            `${m.id.padEnd(7)} ${(incomplete ? 'INCOMPLETE' : hit ? 'OK' : 'MISS').padEnd(10)} failed=${(failed.join(',') || '-').padEnd(24)} ` +
            `expect=${m.expect.join(',').padEnd(12)} (${tally?.[0] ?? 'NO TALLY'}, ${Math.round((Date.now() - started) / 1000)}s)` +
            (stillContended ? '  ⚠ CONTENDED — result unreliable' : contended ? `  (re-ran ${contended}x after deadlock)` : ''),
        );
    } finally {
        restore(abs, backup);
        /**
         * ── AND REBUILD, OR THE MUTANT OUTLIVES THE RUN ─────────────────────────────────────────────
         *
         * Restoring the SOURCE is not enough. Every mutation is applied by editing the .ts and running
         * `npm run build:packages`, so when the run ends `dist/` still holds the LAST MUTANT while the
         * source is clean — and nothing that reads `dist/` can tell.
         *
         * That is not theoretical. After a mutation session, an Explorer spec spent three runs failing on
         * a defect that had already been fixed, because MJAPI was serving a `dist/` in which the fix had
         * been mutated out. The source was right, `git diff` was clean, the integration suite (which the
         * driver rebuilds for) was green — and the browser was testing something else entirely. It cost
         * two API restarts and a false hypothesis before the compiled output was read.
         *
         * A tool whose job is to break things on purpose must not be able to leave them broken. Same
         * principle as the copy-aside restore above; this is the half that was missing.
         */
        try {
            execSync('npm run build:packages', { cwd: REPO, stdio: 'pipe' });
        } catch (err) {
            console.error(
                `
  ⚠️  REBUILD AFTER RESTORE FAILED for ${m.id}. dist/ may still hold the mutant — ` +
                `run \`npm run build\` before trusting anything that reads it.
${String(err.stdout ?? err)}`,
            );
        }
    }
}

// ── the summary, and the one number that matters ──────────────────────────
/**
 * ── TWO NUMBERS, NOT ONE, BECAUSE THE OLD ONE OVERCOUNTED ───────────────────────────────────────
 *
 * This printed `new Set(everything that failed).size` as "checks proven able to fail". That claims the
 * mutated code is on every failing check's path, which is precisely what has NOT been established: a
 * mutation disturbs the whole suite. `M-ST1` doubles every stage event and fells seven checks having been
 * aimed at three; `M-ST7` stops the close setting a status and fells six; `M-AC2` fells four. Measured
 * overstatement on a real run: 22 reported where 18 was defensible.
 *
 * The defensible figure is the DECLARED one -- a check the mutation's author aimed at, which then fell.
 * That pairing is a claim someone wrote down and the run confirmed. Collateral is still reported, because
 * it is genuinely informative (it is how BD1 and BD4 were first shown able to fail), but it is a weaker
 * claim: read the `failed=` column and confirm the mutated code is on that check's path before promoting
 * one. Conflating the two is how a coverage figure drifts upward without anybody deciding it should.
 */
const ran = results.filter((r) => r.failed);
const declaredKilled = new Set(ran.flatMap((r) => r.expect.filter((id) => r.failed.includes(id))));
const collateral = [...new Set(ran.flatMap((r) => r.failed))].filter((id) => !declaredKilled.has(id));
const isolating = ran.filter((r) => r.failed.length === 1).length;
console.log(
    `\n  ${ran.length} mutations ran · ${declaredKilled.size} checks proven able to fail (declared and fell)`
    + ` · ${isolating} isolated exactly one`,
);
if (collateral.length) {
    console.log(
        `  + ${collateral.length} more fell as COLLATERAL -- a weaker claim, since the mutation was `
        + `not aimed at them and may not be on their path: ${collateral.sort().join(', ')}`,
    );
}
const missed = ran.filter((r) => !r.expect.every((id) => r.failed.includes(id)));
if (missed.length) {
    console.log('\n  MISSES — read these, they are usually findings and not retries:');
    for (const m of missed) console.log(`    ${m.id}: expected ${m.expect.join(',')}, got ${m.failed.join(',') || 'nothing'}`);
}
const skipped = results.filter((r) => r.skipped);
if (skipped.length) console.log(`\n  skipped: ${skipped.map((r) => `${r.id} (${r.skipped})`).join(', ')}`);

if (existsSync(safety)) rmSync(safety, { recursive: true, force: true });
process.exit(missed.length || skipped.length ? 1 : 0);
