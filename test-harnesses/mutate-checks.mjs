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
 * Each mutation runs the WHOLE suite, not one bundle, so a mutation that breaks something unintended
 * shows up instead of hiding. Budget roughly 70 seconds each.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const DES = 'packages/CoreEntitiesServer/src/DealEntityServer.ts';
const CDO = 'packages/CoreEntitiesServer/src/CloseDealOperation.ts';
const PF = 'packages/Entities/src/product-filter.ts';
const DE = 'packages/Entities/src/deal-entity.ts';
const SEQ = 'packages/CoreEntitiesServer/src/SequenceService.ts';
const SEAM = 'packages/Entities/src/downstream-seams.ts';
const LCS = 'packages/CoreEntitiesServer/src/LiveContractsSeam.ts';

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
    { id: 'M-SD10', file: DES, expect: ['SD10'],
      from: '        const saved = this.IsSaved || this.DealNumber\n            ? await this.saveApplyingStageOrderStatus(options, stageOrder)\n            : await this.saveWithNewDealNumber(options, stageOrder);',
      to: '        const saved = await this.saveWithNewDealNumber(options, stageOrder);' },
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
    { id: 'M-CD4', file: CDO, expect: ['CD4'],
      from: '        event.AmountAtTransition = deal.Amount;\n        event.ProbabilityAtTransition = deal.Probability;\n        event.Notes = this.routingNote(routing, input.Notes);',
      to: '        event.AmountAtTransition = null;\n        event.ProbabilityAtTransition = deal.Probability;\n        event.Notes = this.routingNote(routing, input.Notes);' },
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
      from: '        const stageOrder = await this.planStageOrderStatus();',
      to: '        const stageOrder: StageOrderPlan | null = null;\n        void this.planStageOrderStatus;' },
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
      from: '        if (total === null || !Number.isFinite(total)) {\n            return;   // no priced lines, or no usable answer — either way, nothing to cache',
      to: '        if (false) {\n            return;',
      note: '"nothing priced" becomes a computed amount of nothing — the SD23 defect' },

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
      from: 'const taskIssues: SalesCloseIssue[] = [];\n            if (target.IsWon) {',
      to: 'const taskIssues: SalesCloseIssue[] = [];\n            if (true) {',
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
      from: '        const probabilityIsTheirs = creating',
      to: '        const probabilityIsTheirs = false && creating',
      note: 'creation asks Dirty again — the defect BD2 found the first time' },

    // OVERWRITE INSTEAD OF FILL, which is the version a reasonable person writes first: the stage always
    // wins and a probability somebody typed is discarded. BD6 is the only check that forbids it.
    { id: 'M-BD3', file: DES, expect: ['BD6'],
      from: '        if (!probabilityIsTheirs) {',
      to: '        if (true) {',
      note: 'the stage default always overwrites a stated probability' },

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
      note: 'the close reports the flag as false regardless of what the deal says' }
];

const wanted = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')));
if (process.argv.includes('--list')) {
    for (const m of MUTATIONS) console.log(`${m.id.padEnd(8)} ${m.file.padEnd(56)} expect ${m.expect.join(',')}`);
    process.exit(0);
}

const FAIL_RE = /^ {2,}✖ ([A-Z]+\d+):/gmu;
const TALLY_RE = /(\d+) passed,\s+(\d+) failed,\s+(\d+) skipped/;

const safety = mkdtempSync(join(tmpdir(), 'mj-mutate-'));
const results = [];

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

        let out = '';
        try {
            out = execSync('node test-harnesses/integration.mjs', {
                cwd: REPO, stdio: 'pipe', encoding: 'utf8',
                env: { ...process.env, RUN_MUTATION_TESTS: '1' },
            });
        } catch (err) {
            out = String(err.stdout ?? '') + String(err.stderr ?? '');   // a failing suite exits non-zero, which is the POINT
        }

        const failed = [...new Set([...out.matchAll(FAIL_RE)].map((x) => x[1]))].sort();
        const tally = out.match(TALLY_RE);
        const hit = m.expect.every((id) => failed.includes(id));
        results.push({ ...m, failed, tally: tally?.[0] });
        console.log(
            `${m.id.padEnd(7)} ${(hit ? 'OK' : 'MISS').padEnd(4)} failed=${(failed.join(',') || '-').padEnd(24)} ` +
            `expect=${m.expect.join(',').padEnd(12)} (${tally?.[0] ?? 'NO TALLY'}, ${Math.round((Date.now() - started) / 1000)}s)`,
        );
    } finally {
        restore(abs, backup);
    }
}

// ── the summary, and the one number that matters ──────────────────────────
const ran = results.filter((r) => r.failed);
const covered = new Set(ran.flatMap((r) => r.failed));
const isolating = ran.filter((r) => r.failed.length === 1).length;
console.log(`\n  ${ran.length} mutations ran · ${covered.size} checks proven able to fail · ${isolating} isolated exactly one`);
const missed = ran.filter((r) => !r.expect.every((id) => r.failed.includes(id)));
if (missed.length) {
    console.log('\n  MISSES — read these, they are usually findings and not retries:');
    for (const m of missed) console.log(`    ${m.id}: expected ${m.expect.join(',')}, got ${m.failed.join(',') || 'nothing'}`);
}
const skipped = results.filter((r) => r.skipped);
if (skipped.length) console.log(`\n  skipped: ${skipped.map((r) => `${r.id} (${r.skipped})`).join(', ')}`);

if (existsSync(safety)) rmSync(safety, { recursive: true, force: true });
process.exit(missed.length || skipped.length ? 1 : 0);
