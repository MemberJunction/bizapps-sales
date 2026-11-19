-- =============================================================================================
-- PostgreSQL counterpart of V202611182210__v6.32.x__Metadata_Sync.sql
-- =============================================================================================
-- Same records, same values as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE: `mj sql-convert --from tsql --to postgres` (MJ CLI 6.2.1) on each block of the
-- push log, one block per run. Each create block's guard is then widened to match the T-SQL file
-- (ID, or the natural key) and its update branch removed, so every create is create-only. The
-- pipeline policy and the view layout are updated only while they hold the previous release's
-- value. Query fields' source entity fields are resolved on the target database as in the T-SQL
-- file, and the 27 IsNullable = FALSE values the push log left out are added. The five
-- ExtractionStatus = Warning updates and the 37 DetectionMethod-only parameter updates are left
-- out. Core references use ${mjSchema}; this app's schema stays literal (__mj_BizAppsSales, folded
-- to lower case by PostgreSQL). String values the converter rewrote are restored verbatim from the
-- T-SQL file. The three Deals fields resolve by entity name + field name.
-- =============================================================================================

-- Save MJ_BizApps_Sales: Pipelines (core SP call only)
DO $mj$
DECLARE
  p_CloseWonPolicy_fe14f2d9033a TEXT;
  p_ID_fe14f2d9033a UUID;
BEGIN
  p_CloseWonPolicy_fe14f2d9033a := '{"CreateContract":true,"ContractTypeCode":"ORDER_FORM","TermMonths":12,"SubscriptionLinesTo":"Contract","OneTimeLinesTo":"Order","RequireApprovalTaskTypeCode":null,"CloseWonTasks":{"AssigneeEntityName": "MJ_BizApps_Common: People", "AssigneeRecordID": null, "DueInDays": 5}}';
  p_ID_fe14f2d9033a := '90111111-0000-4000-A000-000000000001';
  -- Only while the pipeline still holds the policy the previous release shipped: a host that
  -- edited it keeps its own.
  IF EXISTS (SELECT 1 FROM __mj_BizAppsSales."Pipeline"
             WHERE "ID" = p_ID_fe14f2d9033a AND "CloseWonPolicy" = '{"CreateContract":true,"ContractTypeCode":"Order Form","TermMonths":12,"SubscriptionLinesTo":"Contract","OneTimeLinesTo":"Order","RequireApprovalTaskTypeCode":null,"CloseWonTasks":{"AssigneeEntityName": "MJ_BizApps_Common: People", "AssigneeRecordID": null, "DueInDays": 5}}') THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_bizappssales' AND p.proname = 'spUpdatePipeline'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsSales."spUpdatePipeline"(p_data := jsonb_build_object(
      'CloseWonPolicy', p_CloseWonPolicy_fe14f2d9033a,
      'ID', p_ID_fe14f2d9033a
    ));
    ELSE
      PERFORM __mj_BizAppsSales."spUpdatePipeline"(p_CloseWonPolicy := p_CloseWonPolicy_fe14f2d9033a, p_ID := p_ID_fe14f2d9033a);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Remote Operations (core SP call only)
DO $mj$
DECLARE
  p_InputTypeDefinition_e4c5abba10f1 TEXT;
  p_OutputTypeDefinition_e4c5abba10f1 TEXT;
  p_ID_e4c5abba10f1 UUID;
BEGIN
  p_InputTypeDefinition_e4c5abba10f1 := '/**
 * ============================================================================
 * WHY THE SHARED CLOSE SHAPES LIVE IN THIS FILE
 * ============================================================================
 * CodeGen emits each operation''s `InputTypeDefinition` / `OutputTypeDefinition`
 * **verbatim** into one `remote_operations.ts`, de-duplicating by exact text and
 * resolving NO imports. A definition file cannot `import` a sibling — every name
 * it uses must be declared in some definition that also gets emitted.
 *
 * `CloseDeal` carries the policy and routing shapes, so they are declared once
 * here. `ReopenDeal` references them freely: TypeScript hoists interfaces, so
 * emission order does not matter.
 *
 * NO `import` statements in this file. Ever.
 * ============================================================================
 */

/**
 * `Pipeline.CloseWonPolicy`, parsed — master plan §7.1.
 *
 * THE POLICY IS THE ONLY THING THAT DECIDES ROUTING. Nothing in the close flow
 * may branch on a pipeline''s name, a status''s name, or the words "B2B"/"D2C":
 * a deployment renames those freely, and a rename must not change what happens
 * when a deal is won. Behaviour comes from this JSON plus the `DealStatusType`
 * flags, and from nowhere else.
 *
 * Every field is optional because a pipeline may declare a partial policy; the
 * resolver supplies defaults and the effective policy is what gets recorded.
 */
export interface SalesCloseWonPolicy {
    /** Create an agreement for this deal. Routes to Contracts.CreateFromDeal (or RenewTerm). */
    CreateContract?: boolean;
    /** Which contract type the agreement takes. A CODE, resolved by contracts, not by sales. */
    ContractTypeCode?: string | null;
    /** Default term for the created agreement. */
    TermMonths?: number | null;
    /** Where recurring lines go. `Contract` | `Subscription` | `None`. */
    SubscriptionLinesTo?: string | null;
    /** Where one-time lines go. `Order` | `Contract` | `None`. */
    OneTimeLinesTo?: string | null;
    /** When set, the close raises an approval task of this type rather than completing. */
    RequireApprovalTaskTypeCode?: string | null;
}

/**
 * What the caller asks for.
 *
 * NAMED FOR THE OUTCOME TYPE, NOT FOR "WON". The operation resolves everything from the target
 * status''s flags (`IsWon` / `IsLost` / `LocksDeal`), so a deployment that calls its winning status
 * "Signed" needs no code change — master plan §7.2.
 */
export interface SalesCloseDealInput {
    DealID: string;
    /** The status to close INTO. Its flags decide the whole path. */
    DealStatusTypeID: string;

    /**
     * Required when the target status has `IsLost`. Loss reason is this app''s only mandatory field,
     * and the friction is deliberate: it is the highest-value, most consistently-skipped data in any
     * CRM (§7.2).
     */
    LossReasonID?: string | null;
    /** Required when the chosen loss reason has `RequiresNotes`. */
    LossNotes?: string | null;

    /**
     * Per-deal overrides merged OVER the pipeline''s policy. This is how §7.1''s "a deal may override
     * it" is expressed without a per-deal policy column — see `docs/DECISIONS.md`.
     */
    PolicyOverrides?: SalesCloseWonPolicy;

    /** The stage to land in. Optional: when omitted the operation keeps the deal''s current stage. */
    ClosingStageID?: string | null;

    /** Recorded on the DealStageEvent. Free text, for the human record. */
    Notes?: string | null;

    /**
     * Validate and report what WOULD happen without writing anything. Nothing is committed, no lock
     * is applied, and the routing plan comes back in the output — so a UI can show the consequences
     * of a close before asking for confirmation.
     */
    PreviewOnly?: boolean;
}

/** What the caller asks for when undoing a close — §7.3. */
export interface SalesReopenDealInput {
    DealID: string;
    /**
     * REQUIRED. §7.3 makes reopening reason-gated on purpose: a lock exists because the deal is the
     * provenance of a contract and an order, so undoing it is an event that has to be explainable.
     */
    Reason: string;
    /** The status to reopen INTO. Must be a status whose `LocksDeal` is not set. */
    DealStatusTypeID?: string | null;
    /** The stage to return to. Defaults to the deal''s current stage. */
    StageID?: string | null;
}
';
  p_OutputTypeDefinition_e4c5abba10f1 := '/**
 * Output shapes for the close family. Declared here rather than repeated per operation — see the
 * header of `sales-close-deal.input.ts` for why definition files may not import one another.
 */

/** Which pane of the deal workspace an issue belongs to. Matches the workspace''s tab keys exactly. */
export type SalesCloseSection = ''deal'' | ''party'' | ''lines'' | ''schedule'' | ''terms'' | ''variances'';

/**
 * `info` is for something the close could not do YET that needs nobody''s action: it will happen on its
 * own later. It never blocks and never reads as a problem.
 */
export type SalesCloseSeverity = ''error'' | ''warning'' | ''info'';

/**
 * ONE ISSUE, STRUCTURED — never a joined string. `Section` is what lets a tab badge itself, `Field`
 * what lets a field mark itself. The same shape `Sales.SaveDeal` already returns, so a UI handles
 * both operations'' refusals with one code path.
 */
export interface SalesCloseIssue {
    Section: SalesCloseSection;
    Field?: string | null;
    Severity: SalesCloseSeverity;
    Message: string;
}

/**
 * What the policy decided, per downstream target.
 *
 * RETURNED EVEN WHEN THE CALL WAS STUBBED OR REFUSED, and `Executed` is what says which. The contract
 * route is live through `LiveContractsSeam` and the order is embedded at deal creation (see
 * `docs/DECISIONS.md` D-CF1, D-CF3 and D-CF4); when a route is declined or stubbed in a test, a close
 * reports `Planned: true, Executed: false` with a reason so the intent remains auditable.
 */
export interface SalesCloseRoutingResult {
    /** `Contract` | `Order` | `Subscription`. */
    Target: string;
    /** The policy said this should happen. */
    Planned: boolean;
    /** It actually happened. False when the downstream route was declined or stubbed. */
    Executed: boolean;
    /** How many deal lines were routed here. */
    LineCount: number;
    /** The created record, when one was created. */
    RecordID?: string | null;
    /** Why it did not execute, when it did not. Shown verbatim. */
    Reason?: string | null;
}

export interface SalesCloseDealOutput {
    Success: boolean;
    /** Empty on a clean close. Warnings may be present even when Success is true. */
    Issues: SalesCloseIssue[];

    /** True when the target status carried `IsWon` — resolved from the FLAG, never a name. */
    IsWon: boolean;
    /** True when the target status carried `IsLost`. */
    IsLost: boolean;
    /** True when the deal is now immutable, i.e. the target status had `LocksDeal`. */
    Locked: boolean;

    /** The policy actually applied: pipeline default with the caller''s overrides merged over it. */
    EffectivePolicy?: SalesCloseWonPolicy;
    /** One entry per downstream the policy named. */
    Routing: SalesCloseRoutingResult[];

    /** The append-only provenance row this close wrote. Absent on a preview. */
    DealStageEventID?: string | null;
    ClosedAt?: string | null;

    /** True when nothing was written because the caller asked for a preview. */
    WasPreview: boolean;
}

export interface SalesReopenDealOutput {
    Success: boolean;
    Issues: SalesCloseIssue[];
    /** The deal is editable again. */
    Unlocked: boolean;
    /** The append-only row recording the reopen and its reason. */
    DealStageEventID?: string | null;
}
';
  p_ID_e4c5abba10f1 := 'D4F8A162-0002-4E71-B0A8-3F17C5E2D802';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateRemoteOperation'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_data := jsonb_build_object(
    'InputTypeDefinition', p_InputTypeDefinition_e4c5abba10f1,
    'OutputTypeDefinition', p_OutputTypeDefinition_e4c5abba10f1,
    'ID', p_ID_e4c5abba10f1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_InputTypeDefinition := p_InputTypeDefinition_e4c5abba10f1, p_OutputTypeDefinition := p_OutputTypeDefinition_e4c5abba10f1, p_ID := p_ID_e4c5abba10f1);
  END IF;
END $mj$;

-- Save MJ: Remote Operations (core SP call only)
DO $mj$
DECLARE
  p_InputTypeDefinition_bec77cc5dfad TEXT;
  p_OutputTypeDefinition_bec77cc5dfad TEXT;
  p_ID_bec77cc5dfad UUID;
BEGIN
  p_InputTypeDefinition_bec77cc5dfad := '/**
 * ============================================================================
 * WHY THE SHARED CLOSE SHAPES LIVE IN THIS FILE
 * ============================================================================
 * CodeGen emits each operation''s `InputTypeDefinition` / `OutputTypeDefinition`
 * **verbatim** into one `remote_operations.ts`, de-duplicating by exact text and
 * resolving NO imports. A definition file cannot `import` a sibling — every name
 * it uses must be declared in some definition that also gets emitted.
 *
 * `CloseDeal` carries the policy and routing shapes, so they are declared once
 * here. `ReopenDeal` references them freely: TypeScript hoists interfaces, so
 * emission order does not matter.
 *
 * NO `import` statements in this file. Ever.
 * ============================================================================
 */

/**
 * `Pipeline.CloseWonPolicy`, parsed — master plan §7.1.
 *
 * THE POLICY IS THE ONLY THING THAT DECIDES ROUTING. Nothing in the close flow
 * may branch on a pipeline''s name, a status''s name, or the words "B2B"/"D2C":
 * a deployment renames those freely, and a rename must not change what happens
 * when a deal is won. Behaviour comes from this JSON plus the `DealStatusType`
 * flags, and from nowhere else.
 *
 * Every field is optional because a pipeline may declare a partial policy; the
 * resolver supplies defaults and the effective policy is what gets recorded.
 */
export interface SalesCloseWonPolicy {
    /** Create an agreement for this deal. Routes to Contracts.CreateFromDeal (or RenewTerm). */
    CreateContract?: boolean;
    /** Which contract type the agreement takes. A CODE, resolved by contracts, not by sales. */
    ContractTypeCode?: string | null;
    /** Default term for the created agreement. */
    TermMonths?: number | null;
    /** Where recurring lines go. `Contract` | `Subscription` | `None`. */
    SubscriptionLinesTo?: string | null;
    /** Where one-time lines go. `Order` | `Contract` | `None`. */
    OneTimeLinesTo?: string | null;
    /** When set, the close raises an approval task of this type rather than completing. */
    RequireApprovalTaskTypeCode?: string | null;
}

/**
 * What the caller asks for.
 *
 * NAMED FOR THE OUTCOME TYPE, NOT FOR "WON". The operation resolves everything from the target
 * status''s flags (`IsWon` / `IsLost` / `LocksDeal`), so a deployment that calls its winning status
 * "Signed" needs no code change — master plan §7.2.
 */
export interface SalesCloseDealInput {
    DealID: string;
    /** The status to close INTO. Its flags decide the whole path. */
    DealStatusTypeID: string;

    /**
     * Required when the target status has `IsLost`. Loss reason is this app''s only mandatory field,
     * and the friction is deliberate: it is the highest-value, most consistently-skipped data in any
     * CRM (§7.2).
     */
    LossReasonID?: string | null;
    /** Required when the chosen loss reason has `RequiresNotes`. */
    LossNotes?: string | null;

    /**
     * Per-deal overrides merged OVER the pipeline''s policy. This is how §7.1''s "a deal may override
     * it" is expressed without a per-deal policy column — see `docs/DECISIONS.md`.
     */
    PolicyOverrides?: SalesCloseWonPolicy;

    /** The stage to land in. Optional: when omitted the operation keeps the deal''s current stage. */
    ClosingStageID?: string | null;

    /** Recorded on the DealStageEvent. Free text, for the human record. */
    Notes?: string | null;

    /**
     * Validate and report what WOULD happen without writing anything. Nothing is committed, no lock
     * is applied, and the routing plan comes back in the output — so a UI can show the consequences
     * of a close before asking for confirmation.
     */
    PreviewOnly?: boolean;
}

/** What the caller asks for when undoing a close — §7.3. */
export interface SalesReopenDealInput {
    DealID: string;
    /**
     * REQUIRED. §7.3 makes reopening reason-gated on purpose: a lock exists because the deal is the
     * provenance of a contract and an order, so undoing it is an event that has to be explainable.
     */
    Reason: string;
    /** The status to reopen INTO. Must be a status whose `LocksDeal` is not set. */
    DealStatusTypeID?: string | null;
    /** The stage to return to. Defaults to the deal''s current stage. */
    StageID?: string | null;
}
';
  p_OutputTypeDefinition_bec77cc5dfad := '/**
 * Output shapes for the close family. Declared here rather than repeated per operation — see the
 * header of `sales-close-deal.input.ts` for why definition files may not import one another.
 */

/** Which pane of the deal workspace an issue belongs to. Matches the workspace''s tab keys exactly. */
export type SalesCloseSection = ''deal'' | ''party'' | ''lines'' | ''schedule'' | ''terms'' | ''variances'';

/**
 * `info` is for something the close could not do YET that needs nobody''s action: it will happen on its
 * own later. It never blocks and never reads as a problem.
 */
export type SalesCloseSeverity = ''error'' | ''warning'' | ''info'';

/**
 * ONE ISSUE, STRUCTURED — never a joined string. `Section` is what lets a tab badge itself, `Field`
 * what lets a field mark itself. The same shape `Sales.SaveDeal` already returns, so a UI handles
 * both operations'' refusals with one code path.
 */
export interface SalesCloseIssue {
    Section: SalesCloseSection;
    Field?: string | null;
    Severity: SalesCloseSeverity;
    Message: string;
}

/**
 * What the policy decided, per downstream target.
 *
 * RETURNED EVEN WHEN THE CALL WAS STUBBED OR REFUSED, and `Executed` is what says which. The contract
 * route is live through `LiveContractsSeam` and the order is embedded at deal creation (see
 * `docs/DECISIONS.md` D-CF1, D-CF3 and D-CF4); when a route is declined or stubbed in a test, a close
 * reports `Planned: true, Executed: false` with a reason so the intent remains auditable.
 */
export interface SalesCloseRoutingResult {
    /** `Contract` | `Order` | `Subscription`. */
    Target: string;
    /** The policy said this should happen. */
    Planned: boolean;
    /** It actually happened. False when the downstream route was declined or stubbed. */
    Executed: boolean;
    /** How many deal lines were routed here. */
    LineCount: number;
    /** The created record, when one was created. */
    RecordID?: string | null;
    /** Why it did not execute, when it did not. Shown verbatim. */
    Reason?: string | null;
}

export interface SalesCloseDealOutput {
    Success: boolean;
    /** Empty on a clean close. Warnings may be present even when Success is true. */
    Issues: SalesCloseIssue[];

    /** True when the target status carried `IsWon` — resolved from the FLAG, never a name. */
    IsWon: boolean;
    /** True when the target status carried `IsLost`. */
    IsLost: boolean;
    /** True when the deal is now immutable, i.e. the target status had `LocksDeal`. */
    Locked: boolean;

    /** The policy actually applied: pipeline default with the caller''s overrides merged over it. */
    EffectivePolicy?: SalesCloseWonPolicy;
    /** One entry per downstream the policy named. */
    Routing: SalesCloseRoutingResult[];

    /** The append-only provenance row this close wrote. Absent on a preview. */
    DealStageEventID?: string | null;
    ClosedAt?: string | null;

    /** True when nothing was written because the caller asked for a preview. */
    WasPreview: boolean;
}

export interface SalesReopenDealOutput {
    Success: boolean;
    Issues: SalesCloseIssue[];
    /** The deal is editable again. */
    Unlocked: boolean;
    /** The append-only row recording the reopen and its reason. */
    DealStageEventID?: string | null;
}
';
  p_ID_bec77cc5dfad := 'D4F8A162-0003-4E71-B0A8-3F17C5E2D802';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateRemoteOperation'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_data := jsonb_build_object(
    'InputTypeDefinition', p_InputTypeDefinition_bec77cc5dfad,
    'OutputTypeDefinition', p_OutputTypeDefinition_bec77cc5dfad,
    'ID', p_ID_bec77cc5dfad
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_InputTypeDefinition := p_InputTypeDefinition_bec77cc5dfad, p_OutputTypeDefinition := p_OutputTypeDefinition_bec77cc5dfad, p_ID := p_ID_bec77cc5dfad);
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_SQL_ad07a1cd56aa TEXT;
  p_ExtractedSQLHash_ad07a1cd56aa VARCHAR(64);
  p_ExtractionStatus_ad07a1cd56aa VARCHAR(20);
  p_ID_ad07a1cd56aa UUID;
BEGIN
  p_SQL_ad07a1cd56aa := '-- Bookings by OWNER. Master plan §9.4, and the first half of a deliberate PAIR.
--
-- ══ ATTRIBUTION BASIS: OWNER-ROLE FILTER. EVERY DEAL COUNTED EXACTLY ONCE. ══════════════════════
--
-- This is the "bookings by AE" question. It answers: whose number is this?
--
-- The join is filtered to `DealRole.IsOwnerRole = 1`, a FLAG, so a deal with an AE, an SE and an SDR
-- contributes its amount once — to the AE. §9.4 names the alternative as a trap in as many words:
-- summing `Deal.Amount` across `DealTeamMember` unfiltered TRIPLE-COUNTS that deal, and the resulting
-- total looks plausible enough to survive a review.
--
-- THE OTHER HALF IS `deal-involvement-by-rep.sql`, weighted by AttributionPct. The two are not
-- variants of one report and must never be substituted for each other: this one sums to the company''s
-- actual bookings, that one does not and is not meant to. §9.4: "There is no safe default that works
-- for both."
--
-- ══ EVERY MONEY COLUMN HERE IS ADDITIVE, AND THAT IS THE POINT OF THE OWNER FILTER ════════════
--
-- BookedAmount, LostAmount, BookedStatedAmount and the counts all total correctly across rows,
-- because the IsOwnerRole filter means each deal appears on exactly ONE row. WinRateByCount is the
-- single exception -- it is a ratio, and ratios never average across rows.
--
-- Contrast the paired report, `deal-involvement-by-rep.sql`, where most columns are NOT additive:
-- there a deal appears once per team member. Measured on the seeded won deal, its
-- WonAmountOfDealsTouched column totals 82,440 for a deal worth 27,480. This query is the one to
-- reach for whenever a figure has to reconcile.
--
-- WHY NOT `Deal.OwnerEmployeeID`, WHICH IS RIGHT THERE. Because it is a DENORMALISED STAMP — server
-- code derives it FROM the owner-role team row on every save, and CLAUDE.md is explicit that
-- DealTeamMember is the source of truth for membership, including the owner. Reading the stamp would
-- agree today and drift the moment a save path is added that forgets it. Reading the team row cannot
-- drift, because there is nothing for it to drift from.
--
-- DATE DIMENSION: ActualCloseDate — bookings belong to the period the deal actually closed in.
WITH owner_row AS (
    SELECT
        tm.DealID,
        tm.EmployeeID,
        tm.PersonID,
        r.Name AS OwnerRoleName
    FROM [__mj_BizAppsSales].DealTeamMember tm
    INNER JOIN [__mj_BizAppsSales].DealRole r
            ON r.ID = tm.DealRoleID
           AND r.IsOwnerRole = 1          -- THE FILTER THAT MAKES THIS ONE-PER-DEAL. Do not remove.
    WHERE tm.IsActive = 1
)
SELECT
    tm.EmployeeID,
    tm.PersonID,
    COALESCE(tm.EmployeeID, tm.PersonID)        AS OwnerID,
    CASE WHEN tm.EmployeeID IS NOT NULL THEN N''Employee''
         WHEN tm.PersonID IS NOT NULL THEN N''Person''
         ELSE N''Unassigned''
    END                                         AS OwnerKind,
    ISNULL(COALESCE(emp.FirstName + '' '' + emp.LastName, per.DisplayName), ''(unassigned)'') AS OwnerName,
    tm.OwnerRoleName,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    SUM(CASE WHEN st.IsWon  = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS BookedAmount,
    SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END)                   AS WonCount,
    SUM(CASE WHEN st.IsLost = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS LostAmount,
    SUM(CASE WHEN st.IsLost = 1 THEN 1 ELSE 0 END)                   AS LostCount,
    CAST(SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END) AS DECIMAL(18, 4))
        / NULLIF(COUNT(*), 0)                                        AS WinRateByCount,
    SUM(CASE WHEN st.IsWon = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS BookedStatedAmount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsClosed = 1
LEFT OUTER JOIN owner_row tm
        ON tm.DealID = d.ID
LEFT OUTER JOIN [${mjSchema}].Employee emp
        ON emp.ID = tm.EmployeeID
LEFT OUTER JOIN [__mj_BizAppsCommon].Person per
        ON per.ID = tm.PersonID
WHERE d.ActualCloseDate IS NOT NULL
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if PeriodStart %}
  AND d.ActualCloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND d.ActualCloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    tm.EmployeeID, tm.PersonID, emp.FirstName, emp.LastName, per.DisplayName, tm.OwnerRoleName,
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline
ORDER BY
    BookedAmount DESC;
';
  p_ExtractedSQLHash_ad07a1cd56aa := '9844963b0257fbcbedbea4d3cab38677bdde3553643e2c877f7f58878f95360d';
  p_ExtractionStatus_ad07a1cd56aa := 'OK';
  p_ID_ad07a1cd56aa := '5A1E5000-0001-4000-A000-000000000008';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'SQL', p_SQL_ad07a1cd56aa,
    'ExtractedSQLHash', p_ExtractedSQLHash_ad07a1cd56aa,
    'ExtractionStatus', p_ExtractionStatus_ad07a1cd56aa,
    'ID', p_ID_ad07a1cd56aa
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_SQL := p_SQL_ad07a1cd56aa, p_ExtractedSQLHash := p_ExtractedSQLHash_ad07a1cd56aa, p_ExtractionStatus := p_ExtractionStatus_ad07a1cd56aa, p_ID := p_ID_ad07a1cd56aa);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_b570bae8c203 UUID;
  p_IsNullable_b570bae8c203 BOOLEAN;
  p_ID_b570bae8c203 UUID;
BEGIN
  p_SourceEntityFieldID_b570bae8c203 := 'D5C7EF81-EFD5-46CE-ABCC-B76C7F39D5C3';
  p_IsNullable_b570bae8c203 := TRUE;
  p_ID_b570bae8c203 := '25AC1C9A-F78E-48A4-B01F-5AF909C9AE95';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_b570bae8c203 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_b570bae8c203
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_b570bae8c203 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_b570bae8c203));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_b570bae8c203,
    'IsNullable', p_IsNullable_b570bae8c203,
    'ID', p_ID_b570bae8c203
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_b570bae8c203, p_IsNullable := p_IsNullable_b570bae8c203, p_ID := p_ID_b570bae8c203);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_b11b363a1f50 UUID;
  p_QueryID_b11b363a1f50 UUID;
  p_Name_b11b363a1f50 VARCHAR(255);
  p_Description_b11b363a1f50 TEXT;
  p_Sequence_b11b363a1f50 INTEGER;
  p_SQLBaseType_b11b363a1f50 VARCHAR(50);
  p_SQLFullType_b11b363a1f50 VARCHAR(100);
  p_SourceEntityID_b11b363a1f50 UUID;
  p_SourceFieldName_b11b363a1f50 VARCHAR(255);
  p_IsComputed_b11b363a1f50 BOOLEAN;
  p_ComputationDescription_b11b363a1f50 TEXT;
  p_IsSummary_b11b363a1f50 BOOLEAN;
  p_SummaryDescription_b11b363a1f50 TEXT;
  p_DetectionMethod_b11b363a1f50 VARCHAR(50);
  p_AutoDetectConfidenceScore_b11b363a1f50 NUMERIC(3,2);
  p_SourceEntityFieldID_b11b363a1f50 UUID;
  p_IsNullable_b11b363a1f50 BOOLEAN;
  p_SourceObjectName_b11b363a1f50 VARCHAR(500);
BEGIN
  p_ID_b11b363a1f50 := '3802aa40-ce82-44e8-ab70-8e5f34ed5189';
  p_QueryID_b11b363a1f50 := '5A1E5000-0001-4000-A000-000000000008';
  p_Name_b11b363a1f50 := 'PersonID';
  p_Description_b11b363a1f50 := 'The team member, when they are not an employee, such as a partner rep. Set this or Employee, not both.';
  p_Sequence_b11b363a1f50 := 2;
  p_SQLBaseType_b11b363a1f50 := 'uniqueidentifier';
  p_SQLFullType_b11b363a1f50 := 'uniqueidentifier';
  p_SourceEntityID_b11b363a1f50 := 'A5BC9EE5-4C4E-408B-BB07-3C718227B616';
  p_SourceFieldName_b11b363a1f50 := 'PersonID';
  p_IsComputed_b11b363a1f50 := FALSE;
  p_IsSummary_b11b363a1f50 := FALSE;
  p_DetectionMethod_b11b363a1f50 := 'Database';
  p_SourceEntityFieldID_b11b363a1f50 := '6ADB00D1-C166-43D8-815E-7A458CD79DBF';
  p_IsNullable_b11b363a1f50 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_b11b363a1f50 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_b11b363a1f50 AND "Name" = p_SourceFieldName_b11b363a1f50
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_b11b363a1f50 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_b11b363a1f50
                    OR ("QueryID" = p_QueryID_b11b363a1f50 AND "Name" = p_Name_b11b363a1f50)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_b11b363a1f50,
    'QueryID', p_QueryID_b11b363a1f50,
    'Name', p_Name_b11b363a1f50,
    'Description', p_Description_b11b363a1f50,
    'Sequence', p_Sequence_b11b363a1f50,
    'SQLBaseType', p_SQLBaseType_b11b363a1f50,
    'SQLFullType', p_SQLFullType_b11b363a1f50,
    'SourceEntityID', p_SourceEntityID_b11b363a1f50,
    'SourceFieldName', p_SourceFieldName_b11b363a1f50,
    'IsComputed', p_IsComputed_b11b363a1f50,
    'ComputationDescription', p_ComputationDescription_b11b363a1f50,
    'IsSummary', p_IsSummary_b11b363a1f50,
    'SummaryDescription', p_SummaryDescription_b11b363a1f50,
    'DetectionMethod', p_DetectionMethod_b11b363a1f50,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b11b363a1f50,
    'SourceEntityFieldID', p_SourceEntityFieldID_b11b363a1f50,
    'IsNullable', p_IsNullable_b11b363a1f50,
    'SourceObjectName', p_SourceObjectName_b11b363a1f50
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_b11b363a1f50, p_QueryID := p_QueryID_b11b363a1f50, p_Name := p_Name_b11b363a1f50, p_Description := p_Description_b11b363a1f50, p_Sequence := p_Sequence_b11b363a1f50, p_SQLBaseType := p_SQLBaseType_b11b363a1f50, p_SQLFullType := p_SQLFullType_b11b363a1f50, p_SourceEntityID := p_SourceEntityID_b11b363a1f50, p_SourceFieldName := p_SourceFieldName_b11b363a1f50, p_IsComputed := p_IsComputed_b11b363a1f50, p_ComputationDescription := p_ComputationDescription_b11b363a1f50, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b11b363a1f50, p_SummaryDescription := p_SummaryDescription_b11b363a1f50, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b11b363a1f50, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b11b363a1f50, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_b11b363a1f50, p_IsNullable := p_IsNullable_b11b363a1f50, p_SourceObjectName := p_SourceObjectName_b11b363a1f50, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_8d6b4f380cb5 UUID;
  p_QueryID_8d6b4f380cb5 UUID;
  p_Name_8d6b4f380cb5 VARCHAR(255);
  p_Description_8d6b4f380cb5 TEXT;
  p_Sequence_8d6b4f380cb5 INTEGER;
  p_SQLBaseType_8d6b4f380cb5 VARCHAR(50);
  p_SQLFullType_8d6b4f380cb5 VARCHAR(100);
  p_SourceEntityID_8d6b4f380cb5 UUID;
  p_SourceFieldName_8d6b4f380cb5 VARCHAR(255);
  p_IsComputed_8d6b4f380cb5 BOOLEAN;
  p_ComputationDescription_8d6b4f380cb5 TEXT;
  p_IsSummary_8d6b4f380cb5 BOOLEAN;
  p_SummaryDescription_8d6b4f380cb5 TEXT;
  p_DetectionMethod_8d6b4f380cb5 VARCHAR(50);
  p_AutoDetectConfidenceScore_8d6b4f380cb5 NUMERIC(3,2);
  p_SourceEntityFieldID_8d6b4f380cb5 UUID;
  p_IsNullable_8d6b4f380cb5 BOOLEAN;
  p_SourceObjectName_8d6b4f380cb5 VARCHAR(500);
BEGIN
  p_ID_8d6b4f380cb5 := '70ed450b-6e35-47e1-bdf7-d312c7dc2fa7';
  p_QueryID_8d6b4f380cb5 := '5A1E5000-0001-4000-A000-000000000008';
  p_Name_8d6b4f380cb5 := 'OwnerID';
  p_Sequence_8d6b4f380cb5 := 3;
  p_SQLBaseType_8d6b4f380cb5 := 'uniqueidentifier';
  p_SQLFullType_8d6b4f380cb5 := 'uniqueidentifier';
  p_IsComputed_8d6b4f380cb5 := TRUE;
  p_IsSummary_8d6b4f380cb5 := FALSE;
  p_DetectionMethod_8d6b4f380cb5 := 'Database';
  p_IsNullable_8d6b4f380cb5 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_8d6b4f380cb5
                    OR ("QueryID" = p_QueryID_8d6b4f380cb5 AND "Name" = p_Name_8d6b4f380cb5)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_8d6b4f380cb5,
    'QueryID', p_QueryID_8d6b4f380cb5,
    'Name', p_Name_8d6b4f380cb5,
    'Description', p_Description_8d6b4f380cb5,
    'Sequence', p_Sequence_8d6b4f380cb5,
    'SQLBaseType', p_SQLBaseType_8d6b4f380cb5,
    'SQLFullType', p_SQLFullType_8d6b4f380cb5,
    'SourceEntityID', p_SourceEntityID_8d6b4f380cb5,
    'SourceFieldName', p_SourceFieldName_8d6b4f380cb5,
    'IsComputed', p_IsComputed_8d6b4f380cb5,
    'ComputationDescription', p_ComputationDescription_8d6b4f380cb5,
    'IsSummary', p_IsSummary_8d6b4f380cb5,
    'SummaryDescription', p_SummaryDescription_8d6b4f380cb5,
    'DetectionMethod', p_DetectionMethod_8d6b4f380cb5,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8d6b4f380cb5,
    'SourceEntityFieldID', p_SourceEntityFieldID_8d6b4f380cb5,
    'IsNullable', p_IsNullable_8d6b4f380cb5,
    'SourceObjectName', p_SourceObjectName_8d6b4f380cb5
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_8d6b4f380cb5, p_QueryID := p_QueryID_8d6b4f380cb5, p_Name := p_Name_8d6b4f380cb5, p_Description := p_Description_8d6b4f380cb5, p_Description_Clear := TRUE, p_Sequence := p_Sequence_8d6b4f380cb5, p_SQLBaseType := p_SQLBaseType_8d6b4f380cb5, p_SQLFullType := p_SQLFullType_8d6b4f380cb5, p_SourceEntityID := p_SourceEntityID_8d6b4f380cb5, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_8d6b4f380cb5, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_8d6b4f380cb5, p_ComputationDescription := p_ComputationDescription_8d6b4f380cb5, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_8d6b4f380cb5, p_SummaryDescription := p_SummaryDescription_8d6b4f380cb5, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8d6b4f380cb5, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8d6b4f380cb5, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_8d6b4f380cb5, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_8d6b4f380cb5, p_SourceObjectName := p_SourceObjectName_8d6b4f380cb5, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_3ab8314dd5ee UUID;
  p_QueryID_3ab8314dd5ee UUID;
  p_Name_3ab8314dd5ee VARCHAR(255);
  p_Description_3ab8314dd5ee TEXT;
  p_Sequence_3ab8314dd5ee INTEGER;
  p_SQLBaseType_3ab8314dd5ee VARCHAR(50);
  p_SQLFullType_3ab8314dd5ee VARCHAR(100);
  p_SourceEntityID_3ab8314dd5ee UUID;
  p_SourceFieldName_3ab8314dd5ee VARCHAR(255);
  p_IsComputed_3ab8314dd5ee BOOLEAN;
  p_ComputationDescription_3ab8314dd5ee TEXT;
  p_IsSummary_3ab8314dd5ee BOOLEAN;
  p_SummaryDescription_3ab8314dd5ee TEXT;
  p_DetectionMethod_3ab8314dd5ee VARCHAR(50);
  p_AutoDetectConfidenceScore_3ab8314dd5ee NUMERIC(3,2);
  p_SourceEntityFieldID_3ab8314dd5ee UUID;
  p_IsNullable_3ab8314dd5ee BOOLEAN;
  p_SourceObjectName_3ab8314dd5ee VARCHAR(500);
BEGIN
  p_ID_3ab8314dd5ee := '45166d45-2e12-4b11-b127-327093539837';
  p_QueryID_3ab8314dd5ee := '5A1E5000-0001-4000-A000-000000000008';
  p_Name_3ab8314dd5ee := 'OwnerKind';
  p_Sequence_3ab8314dd5ee := 4;
  p_SQLBaseType_3ab8314dd5ee := 'nvarchar';
  p_SQLFullType_3ab8314dd5ee := 'nvarchar(10)';
  p_IsComputed_3ab8314dd5ee := TRUE;
  p_IsSummary_3ab8314dd5ee := FALSE;
  p_DetectionMethod_3ab8314dd5ee := 'Database';
  p_IsNullable_3ab8314dd5ee := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_3ab8314dd5ee
                    OR ("QueryID" = p_QueryID_3ab8314dd5ee AND "Name" = p_Name_3ab8314dd5ee)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_3ab8314dd5ee,
    'QueryID', p_QueryID_3ab8314dd5ee,
    'Name', p_Name_3ab8314dd5ee,
    'Description', p_Description_3ab8314dd5ee,
    'Sequence', p_Sequence_3ab8314dd5ee,
    'SQLBaseType', p_SQLBaseType_3ab8314dd5ee,
    'SQLFullType', p_SQLFullType_3ab8314dd5ee,
    'SourceEntityID', p_SourceEntityID_3ab8314dd5ee,
    'SourceFieldName', p_SourceFieldName_3ab8314dd5ee,
    'IsComputed', p_IsComputed_3ab8314dd5ee,
    'ComputationDescription', p_ComputationDescription_3ab8314dd5ee,
    'IsSummary', p_IsSummary_3ab8314dd5ee,
    'SummaryDescription', p_SummaryDescription_3ab8314dd5ee,
    'DetectionMethod', p_DetectionMethod_3ab8314dd5ee,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_3ab8314dd5ee,
    'SourceEntityFieldID', p_SourceEntityFieldID_3ab8314dd5ee,
    'IsNullable', p_IsNullable_3ab8314dd5ee,
    'SourceObjectName', p_SourceObjectName_3ab8314dd5ee
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_3ab8314dd5ee, p_QueryID := p_QueryID_3ab8314dd5ee, p_Name := p_Name_3ab8314dd5ee, p_Description := p_Description_3ab8314dd5ee, p_Description_Clear := TRUE, p_Sequence := p_Sequence_3ab8314dd5ee, p_SQLBaseType := p_SQLBaseType_3ab8314dd5ee, p_SQLFullType := p_SQLFullType_3ab8314dd5ee, p_SourceEntityID := p_SourceEntityID_3ab8314dd5ee, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_3ab8314dd5ee, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_3ab8314dd5ee, p_ComputationDescription := p_ComputationDescription_3ab8314dd5ee, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_3ab8314dd5ee, p_SummaryDescription := p_SummaryDescription_3ab8314dd5ee, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_3ab8314dd5ee, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_3ab8314dd5ee, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_3ab8314dd5ee, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_3ab8314dd5ee, p_SourceObjectName := p_SourceObjectName_3ab8314dd5ee, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_d3ca80ecdf53 INTEGER;
  p_SQLFullType_d3ca80ecdf53 VARCHAR(100);
  p_IsNullable_d3ca80ecdf53 BOOLEAN;
  p_ID_d3ca80ecdf53 UUID;
BEGIN
  p_Sequence_d3ca80ecdf53 := 5;
  p_SQLFullType_d3ca80ecdf53 := 'nvarchar(250)';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_d3ca80ecdf53 := FALSE;
  p_ID_d3ca80ecdf53 := '4D92F86D-397A-44B4-B09D-819E5CAFD988';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_d3ca80ecdf53,
    'SQLFullType', p_SQLFullType_d3ca80ecdf53,
    'IsNullable', p_IsNullable_d3ca80ecdf53,
    'ID', p_ID_d3ca80ecdf53
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_d3ca80ecdf53, p_SQLFullType := p_SQLFullType_d3ca80ecdf53, p_IsNullable := p_IsNullable_d3ca80ecdf53, p_ID := p_ID_d3ca80ecdf53);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_605bde6ad850 INTEGER;
  p_SourceEntityFieldID_605bde6ad850 UUID;
  p_IsNullable_605bde6ad850 BOOLEAN;
  p_ID_605bde6ad850 UUID;
BEGIN
  p_Sequence_605bde6ad850 := 6;
  p_SourceEntityFieldID_605bde6ad850 := '8C17A9F4-85C7-470D-96CC-E9A3D1168A6D';
  p_IsNullable_605bde6ad850 := TRUE;
  p_ID_605bde6ad850 := '633729B5-C08C-4D2D-978F-BAA6B79B3463';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_605bde6ad850 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_605bde6ad850
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_605bde6ad850 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_605bde6ad850));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_605bde6ad850,
    'SourceEntityFieldID', p_SourceEntityFieldID_605bde6ad850,
    'IsNullable', p_IsNullable_605bde6ad850,
    'ID', p_ID_605bde6ad850
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_605bde6ad850, p_SourceEntityFieldID := p_SourceEntityFieldID_605bde6ad850, p_IsNullable := p_IsNullable_605bde6ad850, p_ID := p_ID_605bde6ad850);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_90407bc694ba INTEGER;
  p_SourceEntityFieldID_90407bc694ba UUID;
  p_IsNullable_90407bc694ba BOOLEAN;
  p_ID_90407bc694ba UUID;
BEGIN
  p_Sequence_90407bc694ba := 7;
  p_SourceEntityFieldID_90407bc694ba := 'A4B19A26-071E-4BA8-8ADD-43317EF70061';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_90407bc694ba := FALSE;
  p_ID_90407bc694ba := 'B019ABEE-87AA-457D-9535-BBFBB76C599F';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_90407bc694ba := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_90407bc694ba
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_90407bc694ba THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_90407bc694ba));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_90407bc694ba,
    'SourceEntityFieldID', p_SourceEntityFieldID_90407bc694ba,
    'IsNullable', p_IsNullable_90407bc694ba,
    'ID', p_ID_90407bc694ba
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_90407bc694ba, p_SourceEntityFieldID := p_SourceEntityFieldID_90407bc694ba, p_IsNullable := p_IsNullable_90407bc694ba, p_ID := p_ID_90407bc694ba);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_f9455daeebaa INTEGER;
  p_SourceEntityFieldID_f9455daeebaa UUID;
  p_IsNullable_f9455daeebaa BOOLEAN;
  p_ID_f9455daeebaa UUID;
BEGIN
  p_Sequence_f9455daeebaa := 8;
  p_SourceEntityFieldID_f9455daeebaa := '79A3E2FC-768E-4219-A16A-A70E3330605E';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_f9455daeebaa := FALSE;
  p_ID_f9455daeebaa := 'E279BB38-8DCE-4EEB-9FD4-EF13EE7B6D36';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_f9455daeebaa := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_f9455daeebaa
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_f9455daeebaa THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_f9455daeebaa));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_f9455daeebaa,
    'SourceEntityFieldID', p_SourceEntityFieldID_f9455daeebaa,
    'IsNullable', p_IsNullable_f9455daeebaa,
    'ID', p_ID_f9455daeebaa
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_f9455daeebaa, p_SourceEntityFieldID := p_SourceEntityFieldID_f9455daeebaa, p_IsNullable := p_IsNullable_f9455daeebaa, p_ID := p_ID_f9455daeebaa);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_f86b79cc479e INTEGER;
  p_SourceEntityFieldID_f86b79cc479e UUID;
  p_IsNullable_f86b79cc479e BOOLEAN;
  p_ID_f86b79cc479e UUID;
BEGIN
  p_Sequence_f86b79cc479e := 9;
  p_SourceEntityFieldID_f86b79cc479e := '35BA5F17-3D6F-473D-AC3B-6B0FC38F7312';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_f86b79cc479e := FALSE;
  p_ID_f86b79cc479e := '5FB96B0E-F251-48F2-8AD1-19845B77493E';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_f86b79cc479e := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_f86b79cc479e
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_f86b79cc479e THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_f86b79cc479e));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_f86b79cc479e,
    'SourceEntityFieldID', p_SourceEntityFieldID_f86b79cc479e,
    'IsNullable', p_IsNullable_f86b79cc479e,
    'ID', p_ID_f86b79cc479e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_f86b79cc479e, p_SourceEntityFieldID := p_SourceEntityFieldID_f86b79cc479e, p_IsNullable := p_IsNullable_f86b79cc479e, p_ID := p_ID_f86b79cc479e);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_578751fac39e INTEGER;
  p_SourceEntityFieldID_578751fac39e UUID;
  p_IsNullable_578751fac39e BOOLEAN;
  p_ID_578751fac39e UUID;
BEGIN
  p_Sequence_578751fac39e := 10;
  p_SourceEntityFieldID_578751fac39e := '2AA2DC76-847E-452C-B01C-8CC4082921B2';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_578751fac39e := FALSE;
  p_ID_578751fac39e := 'C55A5DE6-8F70-417B-9D05-B8D2077B53A4';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_578751fac39e := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_578751fac39e
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_578751fac39e THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_578751fac39e));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_578751fac39e,
    'SourceEntityFieldID', p_SourceEntityFieldID_578751fac39e,
    'IsNullable', p_IsNullable_578751fac39e,
    'ID', p_ID_578751fac39e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_578751fac39e, p_SourceEntityFieldID := p_SourceEntityFieldID_578751fac39e, p_IsNullable := p_IsNullable_578751fac39e, p_ID := p_ID_578751fac39e);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_a0c22f5dc0ea INTEGER;
  p_SQLBaseType_a0c22f5dc0ea VARCHAR(50);
  p_SQLFullType_a0c22f5dc0ea VARCHAR(100);
  p_IsNullable_a0c22f5dc0ea BOOLEAN;
  p_ID_a0c22f5dc0ea UUID;
BEGIN
  p_Sequence_a0c22f5dc0ea := 11;
  p_SQLBaseType_a0c22f5dc0ea := 'decimal';
  p_SQLFullType_a0c22f5dc0ea := 'decimal(38,4)';
  p_IsNullable_a0c22f5dc0ea := TRUE;
  p_ID_a0c22f5dc0ea := '73D6448D-F3EE-4E0A-B788-6797396EDAD8';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_a0c22f5dc0ea,
    'SQLBaseType', p_SQLBaseType_a0c22f5dc0ea,
    'SQLFullType', p_SQLFullType_a0c22f5dc0ea,
    'IsNullable', p_IsNullable_a0c22f5dc0ea,
    'ID', p_ID_a0c22f5dc0ea
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_a0c22f5dc0ea, p_SQLBaseType := p_SQLBaseType_a0c22f5dc0ea, p_SQLFullType := p_SQLFullType_a0c22f5dc0ea, p_IsNullable := p_IsNullable_a0c22f5dc0ea, p_ID := p_ID_a0c22f5dc0ea);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_40d9fe3c35c9 INTEGER;
  p_SQLBaseType_40d9fe3c35c9 VARCHAR(50);
  p_SQLFullType_40d9fe3c35c9 VARCHAR(100);
  p_IsNullable_40d9fe3c35c9 BOOLEAN;
  p_ID_40d9fe3c35c9 UUID;
BEGIN
  p_Sequence_40d9fe3c35c9 := 12;
  p_SQLBaseType_40d9fe3c35c9 := 'int';
  p_SQLFullType_40d9fe3c35c9 := 'int';
  p_IsNullable_40d9fe3c35c9 := TRUE;
  p_ID_40d9fe3c35c9 := '4BDD5A1D-7BEA-45A3-954F-93DCEFF543AF';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_40d9fe3c35c9,
    'SQLBaseType', p_SQLBaseType_40d9fe3c35c9,
    'SQLFullType', p_SQLFullType_40d9fe3c35c9,
    'IsNullable', p_IsNullable_40d9fe3c35c9,
    'ID', p_ID_40d9fe3c35c9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_40d9fe3c35c9, p_SQLBaseType := p_SQLBaseType_40d9fe3c35c9, p_SQLFullType := p_SQLFullType_40d9fe3c35c9, p_IsNullable := p_IsNullable_40d9fe3c35c9, p_ID := p_ID_40d9fe3c35c9);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_5eb70cd1d613 INTEGER;
  p_SQLBaseType_5eb70cd1d613 VARCHAR(50);
  p_SQLFullType_5eb70cd1d613 VARCHAR(100);
  p_IsNullable_5eb70cd1d613 BOOLEAN;
  p_ID_5eb70cd1d613 UUID;
BEGIN
  p_Sequence_5eb70cd1d613 := 13;
  p_SQLBaseType_5eb70cd1d613 := 'decimal';
  p_SQLFullType_5eb70cd1d613 := 'decimal(38,4)';
  p_IsNullable_5eb70cd1d613 := TRUE;
  p_ID_5eb70cd1d613 := '7CEC8CAC-12E3-4C5F-9740-594456808689';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_5eb70cd1d613,
    'SQLBaseType', p_SQLBaseType_5eb70cd1d613,
    'SQLFullType', p_SQLFullType_5eb70cd1d613,
    'IsNullable', p_IsNullable_5eb70cd1d613,
    'ID', p_ID_5eb70cd1d613
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_5eb70cd1d613, p_SQLBaseType := p_SQLBaseType_5eb70cd1d613, p_SQLFullType := p_SQLFullType_5eb70cd1d613, p_IsNullable := p_IsNullable_5eb70cd1d613, p_ID := p_ID_5eb70cd1d613);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_36b22739422a INTEGER;
  p_SQLBaseType_36b22739422a VARCHAR(50);
  p_SQLFullType_36b22739422a VARCHAR(100);
  p_IsNullable_36b22739422a BOOLEAN;
  p_ID_36b22739422a UUID;
BEGIN
  p_Sequence_36b22739422a := 14;
  p_SQLBaseType_36b22739422a := 'int';
  p_SQLFullType_36b22739422a := 'int';
  p_IsNullable_36b22739422a := TRUE;
  p_ID_36b22739422a := '48C760F8-081F-4E2F-B429-5D042D678E7D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_36b22739422a,
    'SQLBaseType', p_SQLBaseType_36b22739422a,
    'SQLFullType', p_SQLFullType_36b22739422a,
    'IsNullable', p_IsNullable_36b22739422a,
    'ID', p_ID_36b22739422a
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_36b22739422a, p_SQLBaseType := p_SQLBaseType_36b22739422a, p_SQLFullType := p_SQLFullType_36b22739422a, p_IsNullable := p_IsNullable_36b22739422a, p_ID := p_ID_36b22739422a);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_679615f3ddc6 INTEGER;
  p_SQLBaseType_679615f3ddc6 VARCHAR(50);
  p_SQLFullType_679615f3ddc6 VARCHAR(100);
  p_IsNullable_679615f3ddc6 BOOLEAN;
  p_ID_679615f3ddc6 UUID;
BEGIN
  p_Sequence_679615f3ddc6 := 15;
  p_SQLBaseType_679615f3ddc6 := 'decimal';
  p_SQLFullType_679615f3ddc6 := 'decimal(29,15)';
  p_IsNullable_679615f3ddc6 := TRUE;
  p_ID_679615f3ddc6 := '4DC13F8A-0CEA-49A2-9493-F3588794F3EE';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_679615f3ddc6,
    'SQLBaseType', p_SQLBaseType_679615f3ddc6,
    'SQLFullType', p_SQLFullType_679615f3ddc6,
    'IsNullable', p_IsNullable_679615f3ddc6,
    'ID', p_ID_679615f3ddc6
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_679615f3ddc6, p_SQLBaseType := p_SQLBaseType_679615f3ddc6, p_SQLFullType := p_SQLFullType_679615f3ddc6, p_IsNullable := p_IsNullable_679615f3ddc6, p_ID := p_ID_679615f3ddc6);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_8b5994013eae INTEGER;
  p_SQLBaseType_8b5994013eae VARCHAR(50);
  p_SQLFullType_8b5994013eae VARCHAR(100);
  p_IsNullable_8b5994013eae BOOLEAN;
  p_ID_8b5994013eae UUID;
BEGIN
  p_Sequence_8b5994013eae := 16;
  p_SQLBaseType_8b5994013eae := 'decimal';
  p_SQLFullType_8b5994013eae := 'decimal(38,4)';
  p_IsNullable_8b5994013eae := TRUE;
  p_ID_8b5994013eae := '45AD67C3-8E2B-4FCC-93EC-D2446D0C3D0E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_8b5994013eae,
    'SQLBaseType', p_SQLBaseType_8b5994013eae,
    'SQLFullType', p_SQLFullType_8b5994013eae,
    'IsNullable', p_IsNullable_8b5994013eae,
    'ID', p_ID_8b5994013eae
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_8b5994013eae, p_SQLBaseType := p_SQLBaseType_8b5994013eae, p_SQLFullType := p_SQLFullType_8b5994013eae, p_IsNullable := p_IsNullable_8b5994013eae, p_ID := p_ID_8b5994013eae);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_eb2e2b6bc6de UUID;
  p_QueryID_eb2e2b6bc6de UUID;
  p_EntityID_eb2e2b6bc6de UUID;
  p_DetectionMethod_eb2e2b6bc6de VARCHAR(50);
  p_AutoDetectConfidenceScore_eb2e2b6bc6de NUMERIC(3,2);
  p_AlternateBaseViewID_eb2e2b6bc6de UUID;
BEGIN
  p_ID_eb2e2b6bc6de := '0777596d-0186-4652-9172-68ff109efc09';
  p_QueryID_eb2e2b6bc6de := '5A1E5000-0001-4000-A000-000000000008';
  p_EntityID_eb2e2b6bc6de := '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F';
  p_DetectionMethod_eb2e2b6bc6de := 'Parser';
  p_AutoDetectConfidenceScore_eb2e2b6bc6de := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_eb2e2b6bc6de
                    OR ("QueryID" = p_QueryID_eb2e2b6bc6de AND "EntityID" = p_EntityID_eb2e2b6bc6de)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_eb2e2b6bc6de,
    'QueryID', p_QueryID_eb2e2b6bc6de,
    'EntityID', p_EntityID_eb2e2b6bc6de,
    'DetectionMethod', p_DetectionMethod_eb2e2b6bc6de,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_eb2e2b6bc6de,
    'AlternateBaseViewID', p_AlternateBaseViewID_eb2e2b6bc6de
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_eb2e2b6bc6de, p_QueryID := p_QueryID_eb2e2b6bc6de, p_EntityID := p_EntityID_eb2e2b6bc6de, p_DetectionMethod := p_DetectionMethod_eb2e2b6bc6de, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_eb2e2b6bc6de, p_AlternateBaseViewID := p_AlternateBaseViewID_eb2e2b6bc6de, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_SQL_b77dfbd84854 TEXT;
  p_ExtractedSQLHash_b77dfbd84854 VARCHAR(64);
  p_ExtractionStatus_b77dfbd84854 VARCHAR(20);
  p_ID_b77dfbd84854 UUID;
BEGIN
  p_SQL_b77dfbd84854 := '-- The dashboard tiles, forecast and attention counts, as ONE row of scalars. Master plan §9.5.
--
-- ── WHY THIS EXISTS WHEN THIRTEEN QUERIES ALREADY DO ────────────────────────────────────────────
--
-- The tiles were re-pointed onto queries per §9.5, and the existing set does not answer them as
-- SCALARS. Checked one by one before adding anything:
--
--   Open pipeline        `Sales: Pipeline Summary` has OpenAmount, but grouped by pipeline and stage —
--                        the tile would still be summing rows in the browser.
--   Open deals / total   the DENOMINATOR is every deal regardless of status, and nothing in the set
--                        reports that: Pipeline Summary is open-only by construction.
--   Past expected close  `Sales: Deal Roster` carries IsPastExpectedClose per row, so the tile would
--                        be counting rows in the browser.
--   Won                  `Sales: Bookings by Period` is grouped by period; the tile wants one count.
--
-- Composing the tiles from those would have moved the SQL to the server and left the AGGREGATION in
-- the component, which is the half §9.5 is actually about. So this returns the figures already
-- reduced, and the component renders them.
--
-- ── THE SAME FLAGS, THE SAME MEANINGS ───────────────────────────────────────────────────────────
--
-- Every count branches on a DealStatusType or ForecastCategoryType FLAG, never on a name.
-- `test-harnesses/compare-dashboard-measures.mjs` recomputes each figure from the deal rows and fails
-- on any disagreement, and the dashboard''s Inspect grid lists each figure''s deals with the same
-- predicate (`InspectCriteriaWhere`), so a tile and its list agree by construction.
--
-- ── WHAT THE PERIOD BOUNDS (bc-aidp-next-golive#350) ────────────────────────────────────────────
--
-- Each figure uses the date that answers its own question:
--
--   Won                 a win lands on its ActualCloseDate, so Won counts wins whose ActualCloseDate
--                       is in the window.
--   Open figures        an open deal has not closed, so the date that places it in a period is the
--                       one it is expected to close on. Open pipeline, Commit, Best case, Pipeline and
--                       Weighted count open deals whose ExpectedCloseDate is in the window. A forecast
--                       for "this quarter" is the deals expected to close this quarter, which is how a
--                       reader takes the figure; counting the whole book under a quarter label made
--                       the tiles look wrong to everyone who read them.
--   No close date       an open deal with no ExpectedCloseDate cannot be placed in any bounded window,
--                       so it falls out of every bounded open figure. NoCloseDateCount reports how many
--                       there are, whatever the period, so the forecast card can say so rather than
--                       leave them silently out.
--   Needs attention     PastExpectedCloseCount, NoOwnerCount and NoCloseDateCount are about the open
--                       book as it stands today, so the period does not narrow them.
--
-- Omitting both period parameters is "All time": every open deal and every win, dated or not.
--
-- The window is applied in the `scoped` rows below as two flags, OpenInPeriod and WonInPeriod, so
-- every column reads the same rule from one place. A comparison against a NULL date is UNKNOWN, so
-- an undated deal fails a bounded window without a separate IS NOT NULL test.
--
-- ── THE FILTER BAR (bc-aidp-next-golive#350) ────────────────────────────────────────────────────
--
-- CompanyIDs, OwnerEmployeeIDs, PipelineIDs and ProductCompanyIDs are lists, rendered with `sqlIn`.
-- Each narrows every column. The single-value CompanyID and PipelineID parameters still work for
-- callers that pass one. A list that is "All" is left out by the caller rather than sent empty:
-- `sqlIn` renders an empty list as `(NULL)`, which matches nothing.
--
-- Product company reads the companies stamped on the deal''s order lines (OrderLine.CompanyID, set by
-- orders from the product). A deal matches when at least one line belongs to a selected company, and
-- counts once at its full amount: these are deal-level figures, and splitting a deal''s amount by line
-- would be pricing arithmetic sales does not do. A deal with no lines cannot match, so it drops out
-- when a product company is chosen. NoLinesDealCount says how many deals in the other filters'' scope
-- have no lines, so the filter chip can explain the drop.
--
-- ── PIPELINES FLAGGED OUT OF THE FORECAST ───────────────────────────────────────────────────────
--
-- Pipeline.IncludeInForecast = 0 marks a pipeline that holds historical deals. Its OPEN deals are
-- left out of every figure, TotalCount included. Its won and lost deals stay. Naming the pipeline in
-- PipelineID or PipelineIDs includes it.
--
-- ── FORECAST CATEGORIES LEFT OUT OF THE PIPELINE ────────────────────────────────────────────────
--
-- A deal whose ForecastCategoryType has IncludeInPipeline = 0 (Omitted) is left out of the open MONEY
-- figures, the same flag `forecast-by-category.sql` and the forecast snapshot gate on. OpenCount still
-- counts it; OpenOmittedCount says how many the money figures leave out. A deal with no category
-- counts as pipeline, as the roster treats it.
--
-- ── THE FORECAST SEGMENTS ───────────────────────────────────────────────────────────────────────
--
-- Commit ⊂ Best case ⊂ Pipeline, so each open pipeline deal is counted once, in its highest
-- category: CommitAmount (IncludeInCommit), then BestCaseOnlyAmount (IncludeInBestCase and not
-- Commit), then PipelineOnlyAmount (neither). The three add up to OpenAmount. WeightedAmount weights
-- the same deals by Probability, master plan §9.3''s "weighted pipeline": a statistic about
-- likelihood, not a price.
WITH scoped AS (
    SELECT
        d.ID,
        d.Amount,
        d.AmountIsComputed,
        d.Probability,
        d.ExpectedCloseDate,
        d.OwnerEmployeeID,
        ISNULL(cur.Code, N''USD'')                AS CurrencyCode,
        st.ID                                   AS StatusID,
        ISNULL(st.IsOpen, 0)                    AS IsOpen,
        ISNULL(st.IsWon, 0)                     AS IsWon,
        ISNULL(fc.IncludeInPipeline, 1)         AS IncludeInPipeline,
        ISNULL(fc.IncludeInCommit, 0)           AS IncludeInCommit,
        ISNULL(fc.IncludeInBestCase, 0)         AS IncludeInBestCase,
        -- Open, and expected to close inside the window. Unbounded when no period is supplied. A
        -- status that is both open and won counts once, as won.
        CASE WHEN st.IsOpen = 1 AND st.IsWon = 0
              {% if PeriodStart %}
              AND d.ExpectedCloseDate >= {{ PeriodStart | sqlString }}
              {% endif %}
              {% if PeriodEnd %}
              AND d.ExpectedCloseDate <= {{ PeriodEnd | sqlString }}
              {% endif %}
             THEN 1 ELSE 0 END                  AS OpenInPeriod,
        -- Won, and the win landed inside the window. ActualCloseDate is a DATE, so `<= PeriodEnd`
        -- includes the whole last day.
        CASE WHEN st.IsWon = 1
              {% if PeriodStart %}
              AND d.ActualCloseDate >= {{ PeriodStart | sqlString }}
              {% endif %}
              {% if PeriodEnd %}
              AND d.ActualCloseDate <= {{ PeriodEnd | sqlString }}
              {% endif %}
             THEN 1 ELSE 0 END                  AS WonInPeriod,
        -- Whether the deal''s order carries any line, and whether one belongs to a selected product
        -- company. Every deal is in scope when no product company is selected.
        CASE WHEN EXISTS (SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol WHERE ol.OrderHeaderID = d.OrderID)
             THEN 1 ELSE 0 END                  AS HasLines,
        CASE WHEN 1 = 1
              {% if ProductCompanyIDs %}
              AND EXISTS (SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol
                          WHERE ol.OrderHeaderID = d.OrderID
                            AND ol.CompanyID IN {{ ProductCompanyIDs | sqlIn }})
              {% endif %}
             THEN 1 ELSE 0 END                  AS InProductScope
    FROM [__mj_BizAppsSales].Deal d
    /**
     * LEFT JOIN, NOT INNER -- `Deal.DealStatusTypeID` is NULLABLE.
     *
     * With an INNER JOIN, a deal with no status disappears from every figure here, including
     * TotalCount. The flags above are wrapped in ISNULL(…, 0), so an unclassified deal lands in
     * TotalCount and in none of the others: it exists, and it is neither open nor won.
     */
    LEFT OUTER JOIN [__mj_BizAppsSales].DealStatusType st
            ON st.ID = d.DealStatusTypeID
    INNER JOIN [__mj_BizAppsSales].Pipeline p
            ON p.ID = d.PipelineID
    LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
            ON fc.ID = d.ForecastCategoryTypeID
    LEFT OUTER JOIN [__mj_BizAppsAccounting].Currency cur
            ON cur.ID = d.CurrencyID
    WHERE 1 = 1
      {% if CompanyID %}
      AND d.CompanyID = {{ CompanyID | sqlString }}
      {% endif %}
      {% if CompanyIDs %}
      AND d.CompanyID IN {{ CompanyIDs | sqlIn }}
      {% endif %}
      {% if OwnerEmployeeIDs %}
      AND d.OwnerEmployeeID IN {{ OwnerEmployeeIDs | sqlIn }}
      {% endif %}
      {% if PipelineID %}
      AND d.PipelineID = {{ PipelineID | sqlString }}
      {% endif %}
      {% if PipelineIDs %}
      AND d.PipelineID IN {{ PipelineIDs | sqlIn }}
      {% endif %}
      {% if not PipelineID and not PipelineIDs %}
      AND (ISNULL(st.IsOpen, 0) = 0 OR p.IncludeInForecast = 1)
      {% endif %}
)
SELECT
    s.CurrencyCode,
    -- TILE: Open pipeline. Open pipeline deals expected to close in the period. A SUM of stored
    -- answers, not pricing arithmetic.
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 THEN ISNULL(s.Amount, 0) ELSE 0 END)
                                                                                  AS OpenAmount,
    SUM(CASE WHEN s.OpenInPeriod = 1 THEN 1 ELSE 0 END)                           AS OpenCount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 0 THEN 1 ELSE 0 END)
                                                                                  AS OpenOmittedCount,

    -- FORECAST: each open pipeline deal in the period once, in its highest category.
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.IncludeInCommit = 1
             THEN ISNULL(s.Amount, 0) ELSE 0 END)                                 AS CommitAmount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.IncludeInCommit = 1
             THEN 1 ELSE 0 END)                                                   AS CommitCount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.IncludeInCommit = 0
              AND s.IncludeInBestCase = 1
             THEN ISNULL(s.Amount, 0) ELSE 0 END)                                 AS BestCaseOnlyAmount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.IncludeInCommit = 0
              AND s.IncludeInBestCase = 0
             THEN ISNULL(s.Amount, 0) ELSE 0 END)                                 AS PipelineOnlyAmount,
    -- TILE: Weighted pipeline. Amount × Probability / 100 over the Open pipeline deals.
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1
             THEN ISNULL(s.Amount, 0) * ISNULL(s.Probability, 0) / 100.0 ELSE 0 END)
                                                                                  AS WeightedAmount,

    -- The denominator of the whole scope: every deal, whatever its status or date. COUNT(*) over the
    -- OUTER join, so a status-less deal is counted here even though it lands in no other figure.
    COUNT(*)                                                                      AS TotalCount,
    SUM(CASE WHEN s.StatusID IS NULL THEN 1 ELSE 0 END)                           AS NoStatusCount,

    -- NEEDS ATTENTION. About the open book today, so the period does not narrow these.
    SUM(CASE WHEN s.IsOpen = 1 AND s.ExpectedCloseDate < bt.Today THEN 1 ELSE 0 END)
                                                                                  AS PastExpectedCloseCount,
    SUM(CASE WHEN s.IsOpen = 1 AND s.OwnerEmployeeID IS NULL THEN 1 ELSE 0 END)   AS NoOwnerCount,
    SUM(CASE WHEN s.IsOpen = 1 AND s.ExpectedCloseDate IS NULL THEN 1 ELSE 0 END) AS NoCloseDateCount,

    -- TILE: Won, in the period on ActualCloseDate. A won deal with no ActualCloseDate is outside every
    -- bounded window and inside All time, so it is never invisible everywhere at once.
    SUM(CASE WHEN s.WonInPeriod = 1 THEN 1 ELSE 0 END)                            AS WonCount,
    -- The same deals as WonCount, summed: the forecast''s Won segment.
    SUM(CASE WHEN s.WonInPeriod = 1 THEN ISNULL(s.Amount, 0) ELSE 0 END)          AS WonAmount,

    -- Provenance for the Open pipeline figure, so its footnote can say how much nobody priced.
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.AmountIsComputed = 1
             THEN ISNULL(s.Amount, 0) ELSE 0 END)                                 AS OpenPricedAmount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.AmountIsComputed = 0
             THEN ISNULL(s.Amount, 0) ELSE 0 END)                                 AS OpenStatedAmount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.Amount IS NULL
             THEN 1 ELSE 0 END)                                                   AS OpenNoAmountCount,

    -- Deals in the other filters'' scope whose order has no lines: what a product company filter
    -- leaves out. Read over every scoped row, not only those in product scope.
    (SELECT COUNT(*) FROM scoped x WHERE x.HasLines = 0)                          AS NoLinesDealCount
FROM scoped s
-- One row: the business day. "Past its expected close" is a "today" question, so it compares
-- against the business day from fnBusinessToday() rather than the UTC day, which rolls over in the
-- evening for a business west of Greenwich (bc-aidp-next-golive#168).
CROSS JOIN [__mj_BizAppsCommon].[fnBusinessToday]() AS bt
WHERE s.InProductScope = 1
GROUP BY s.CurrencyCode
ORDER BY s.CurrencyCode;
';
  p_ExtractedSQLHash_b77dfbd84854 := '1bffd79d7ac46dcdcfcaad521d03222a5ea296812c9f05c3c995cf8390c32521';
  p_ExtractionStatus_b77dfbd84854 := 'OK';
  p_ID_b77dfbd84854 := '5A1E5000-0001-4000-A000-00000000000E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'SQL', p_SQL_b77dfbd84854,
    'ExtractedSQLHash', p_ExtractedSQLHash_b77dfbd84854,
    'ExtractionStatus', p_ExtractionStatus_b77dfbd84854,
    'ID', p_ID_b77dfbd84854
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_SQL := p_SQL_b77dfbd84854, p_ExtractedSQLHash := p_ExtractedSQLHash_b77dfbd84854, p_ExtractionStatus := p_ExtractionStatus_b77dfbd84854, p_ID := p_ID_b77dfbd84854);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_4624fbae173e UUID;
  p_QueryID_4624fbae173e UUID;
  p_Name_4624fbae173e VARCHAR(255);
  p_Description_4624fbae173e TEXT;
  p_Sequence_4624fbae173e INTEGER;
  p_SQLBaseType_4624fbae173e VARCHAR(50);
  p_SQLFullType_4624fbae173e VARCHAR(100);
  p_SourceEntityID_4624fbae173e UUID;
  p_SourceFieldName_4624fbae173e VARCHAR(255);
  p_IsComputed_4624fbae173e BOOLEAN;
  p_ComputationDescription_4624fbae173e TEXT;
  p_IsSummary_4624fbae173e BOOLEAN;
  p_SummaryDescription_4624fbae173e TEXT;
  p_DetectionMethod_4624fbae173e VARCHAR(50);
  p_AutoDetectConfidenceScore_4624fbae173e NUMERIC(3,2);
  p_SourceEntityFieldID_4624fbae173e UUID;
  p_IsNullable_4624fbae173e BOOLEAN;
  p_SourceObjectName_4624fbae173e VARCHAR(500);
BEGIN
  p_ID_4624fbae173e := '0779ac7e-9c64-496f-95a1-c416a52c5989';
  p_QueryID_4624fbae173e := '5A1E5000-0001-4000-A000-00000000000E';
  p_Name_4624fbae173e := 'CurrencyCode';
  p_Sequence_4624fbae173e := 1;
  p_SQLBaseType_4624fbae173e := 'char';
  p_SQLFullType_4624fbae173e := 'char(3)';
  p_IsComputed_4624fbae173e := TRUE;
  p_IsSummary_4624fbae173e := FALSE;
  p_DetectionMethod_4624fbae173e := 'Database';
  p_IsNullable_4624fbae173e := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_4624fbae173e
                    OR ("QueryID" = p_QueryID_4624fbae173e AND "Name" = p_Name_4624fbae173e)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_4624fbae173e,
    'QueryID', p_QueryID_4624fbae173e,
    'Name', p_Name_4624fbae173e,
    'Description', p_Description_4624fbae173e,
    'Sequence', p_Sequence_4624fbae173e,
    'SQLBaseType', p_SQLBaseType_4624fbae173e,
    'SQLFullType', p_SQLFullType_4624fbae173e,
    'SourceEntityID', p_SourceEntityID_4624fbae173e,
    'SourceFieldName', p_SourceFieldName_4624fbae173e,
    'IsComputed', p_IsComputed_4624fbae173e,
    'ComputationDescription', p_ComputationDescription_4624fbae173e,
    'IsSummary', p_IsSummary_4624fbae173e,
    'SummaryDescription', p_SummaryDescription_4624fbae173e,
    'DetectionMethod', p_DetectionMethod_4624fbae173e,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4624fbae173e,
    'SourceEntityFieldID', p_SourceEntityFieldID_4624fbae173e,
    'IsNullable', p_IsNullable_4624fbae173e,
    'SourceObjectName', p_SourceObjectName_4624fbae173e
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_4624fbae173e, p_QueryID := p_QueryID_4624fbae173e, p_Name := p_Name_4624fbae173e, p_Description := p_Description_4624fbae173e, p_Description_Clear := TRUE, p_Sequence := p_Sequence_4624fbae173e, p_SQLBaseType := p_SQLBaseType_4624fbae173e, p_SQLFullType := p_SQLFullType_4624fbae173e, p_SourceEntityID := p_SourceEntityID_4624fbae173e, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_4624fbae173e, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_4624fbae173e, p_ComputationDescription := p_ComputationDescription_4624fbae173e, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_4624fbae173e, p_SummaryDescription := p_SummaryDescription_4624fbae173e, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_4624fbae173e, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4624fbae173e, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_4624fbae173e, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_4624fbae173e, p_SourceObjectName := p_SourceObjectName_4624fbae173e, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_3c9dda3c10af INTEGER;
  p_SQLBaseType_3c9dda3c10af VARCHAR(50);
  p_SQLFullType_3c9dda3c10af VARCHAR(100);
  p_IsNullable_3c9dda3c10af BOOLEAN;
  p_ID_3c9dda3c10af UUID;
BEGIN
  p_Sequence_3c9dda3c10af := 2;
  p_SQLBaseType_3c9dda3c10af := 'decimal';
  p_SQLFullType_3c9dda3c10af := 'decimal(38,4)';
  p_IsNullable_3c9dda3c10af := TRUE;
  p_ID_3c9dda3c10af := '3A5B19C7-6788-482D-95B4-543039BE5E2D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_3c9dda3c10af,
    'SQLBaseType', p_SQLBaseType_3c9dda3c10af,
    'SQLFullType', p_SQLFullType_3c9dda3c10af,
    'IsNullable', p_IsNullable_3c9dda3c10af,
    'ID', p_ID_3c9dda3c10af
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_3c9dda3c10af, p_SQLBaseType := p_SQLBaseType_3c9dda3c10af, p_SQLFullType := p_SQLFullType_3c9dda3c10af, p_IsNullable := p_IsNullable_3c9dda3c10af, p_ID := p_ID_3c9dda3c10af);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_3d59e3d2cb7a INTEGER;
  p_SQLBaseType_3d59e3d2cb7a VARCHAR(50);
  p_SQLFullType_3d59e3d2cb7a VARCHAR(100);
  p_IsNullable_3d59e3d2cb7a BOOLEAN;
  p_ID_3d59e3d2cb7a UUID;
BEGIN
  p_Sequence_3d59e3d2cb7a := 3;
  p_SQLBaseType_3d59e3d2cb7a := 'int';
  p_SQLFullType_3d59e3d2cb7a := 'int';
  p_IsNullable_3d59e3d2cb7a := TRUE;
  p_ID_3d59e3d2cb7a := '17EAB6F2-EA6F-40EB-96BD-C00018399ACB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_3d59e3d2cb7a,
    'SQLBaseType', p_SQLBaseType_3d59e3d2cb7a,
    'SQLFullType', p_SQLFullType_3d59e3d2cb7a,
    'IsNullable', p_IsNullable_3d59e3d2cb7a,
    'ID', p_ID_3d59e3d2cb7a
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_3d59e3d2cb7a, p_SQLBaseType := p_SQLBaseType_3d59e3d2cb7a, p_SQLFullType := p_SQLFullType_3d59e3d2cb7a, p_IsNullable := p_IsNullable_3d59e3d2cb7a, p_ID := p_ID_3d59e3d2cb7a);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_d3c9fa423f0d INTEGER;
  p_SQLBaseType_d3c9fa423f0d VARCHAR(50);
  p_SQLFullType_d3c9fa423f0d VARCHAR(100);
  p_IsNullable_d3c9fa423f0d BOOLEAN;
  p_ID_d3c9fa423f0d UUID;
BEGIN
  p_Sequence_d3c9fa423f0d := 4;
  p_SQLBaseType_d3c9fa423f0d := 'int';
  p_SQLFullType_d3c9fa423f0d := 'int';
  p_IsNullable_d3c9fa423f0d := TRUE;
  p_ID_d3c9fa423f0d := 'D1AB52C7-997B-4607-8461-99CCF534DC9F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_d3c9fa423f0d,
    'SQLBaseType', p_SQLBaseType_d3c9fa423f0d,
    'SQLFullType', p_SQLFullType_d3c9fa423f0d,
    'IsNullable', p_IsNullable_d3c9fa423f0d,
    'ID', p_ID_d3c9fa423f0d
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_d3c9fa423f0d, p_SQLBaseType := p_SQLBaseType_d3c9fa423f0d, p_SQLFullType := p_SQLFullType_d3c9fa423f0d, p_IsNullable := p_IsNullable_d3c9fa423f0d, p_ID := p_ID_d3c9fa423f0d);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_4b1d32d29b33 INTEGER;
  p_SQLBaseType_4b1d32d29b33 VARCHAR(50);
  p_SQLFullType_4b1d32d29b33 VARCHAR(100);
  p_IsNullable_4b1d32d29b33 BOOLEAN;
  p_ID_4b1d32d29b33 UUID;
BEGIN
  p_Sequence_4b1d32d29b33 := 5;
  p_SQLBaseType_4b1d32d29b33 := 'decimal';
  p_SQLFullType_4b1d32d29b33 := 'decimal(38,4)';
  p_IsNullable_4b1d32d29b33 := TRUE;
  p_ID_4b1d32d29b33 := 'EFDC2AC5-065F-4AE3-8CBB-8E41DBEE340B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_4b1d32d29b33,
    'SQLBaseType', p_SQLBaseType_4b1d32d29b33,
    'SQLFullType', p_SQLFullType_4b1d32d29b33,
    'IsNullable', p_IsNullable_4b1d32d29b33,
    'ID', p_ID_4b1d32d29b33
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_4b1d32d29b33, p_SQLBaseType := p_SQLBaseType_4b1d32d29b33, p_SQLFullType := p_SQLFullType_4b1d32d29b33, p_IsNullable := p_IsNullable_4b1d32d29b33, p_ID := p_ID_4b1d32d29b33);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_9083e5056f67 INTEGER;
  p_SQLBaseType_9083e5056f67 VARCHAR(50);
  p_SQLFullType_9083e5056f67 VARCHAR(100);
  p_IsNullable_9083e5056f67 BOOLEAN;
  p_ID_9083e5056f67 UUID;
BEGIN
  p_Sequence_9083e5056f67 := 6;
  p_SQLBaseType_9083e5056f67 := 'int';
  p_SQLFullType_9083e5056f67 := 'int';
  p_IsNullable_9083e5056f67 := TRUE;
  p_ID_9083e5056f67 := '17833E1F-F85E-43FD-B874-64C2F6F516C8';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_9083e5056f67,
    'SQLBaseType', p_SQLBaseType_9083e5056f67,
    'SQLFullType', p_SQLFullType_9083e5056f67,
    'IsNullable', p_IsNullable_9083e5056f67,
    'ID', p_ID_9083e5056f67
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_9083e5056f67, p_SQLBaseType := p_SQLBaseType_9083e5056f67, p_SQLFullType := p_SQLFullType_9083e5056f67, p_IsNullable := p_IsNullable_9083e5056f67, p_ID := p_ID_9083e5056f67);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_780104c19990 INTEGER;
  p_SQLBaseType_780104c19990 VARCHAR(50);
  p_SQLFullType_780104c19990 VARCHAR(100);
  p_IsNullable_780104c19990 BOOLEAN;
  p_ID_780104c19990 UUID;
BEGIN
  p_Sequence_780104c19990 := 7;
  p_SQLBaseType_780104c19990 := 'decimal';
  p_SQLFullType_780104c19990 := 'decimal(38,4)';
  p_IsNullable_780104c19990 := TRUE;
  p_ID_780104c19990 := '7B220FB6-DFF2-429C-A8EE-745C1C35964D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_780104c19990,
    'SQLBaseType', p_SQLBaseType_780104c19990,
    'SQLFullType', p_SQLFullType_780104c19990,
    'IsNullable', p_IsNullable_780104c19990,
    'ID', p_ID_780104c19990
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_780104c19990, p_SQLBaseType := p_SQLBaseType_780104c19990, p_SQLFullType := p_SQLFullType_780104c19990, p_IsNullable := p_IsNullable_780104c19990, p_ID := p_ID_780104c19990);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_a4081ff630a6 INTEGER;
  p_SQLBaseType_a4081ff630a6 VARCHAR(50);
  p_SQLFullType_a4081ff630a6 VARCHAR(100);
  p_IsNullable_a4081ff630a6 BOOLEAN;
  p_ID_a4081ff630a6 UUID;
BEGIN
  p_Sequence_a4081ff630a6 := 8;
  p_SQLBaseType_a4081ff630a6 := 'decimal';
  p_SQLFullType_a4081ff630a6 := 'decimal(38,4)';
  p_IsNullable_a4081ff630a6 := TRUE;
  p_ID_a4081ff630a6 := '70A69D33-4B17-431A-94D0-2C9A68986100';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_a4081ff630a6,
    'SQLBaseType', p_SQLBaseType_a4081ff630a6,
    'SQLFullType', p_SQLFullType_a4081ff630a6,
    'IsNullable', p_IsNullable_a4081ff630a6,
    'ID', p_ID_a4081ff630a6
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_a4081ff630a6, p_SQLBaseType := p_SQLBaseType_a4081ff630a6, p_SQLFullType := p_SQLFullType_a4081ff630a6, p_IsNullable := p_IsNullable_a4081ff630a6, p_ID := p_ID_a4081ff630a6);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_d81cd8de7f80 INTEGER;
  p_SQLBaseType_d81cd8de7f80 VARCHAR(50);
  p_SQLFullType_d81cd8de7f80 VARCHAR(100);
  p_IsNullable_d81cd8de7f80 BOOLEAN;
  p_ID_d81cd8de7f80 UUID;
BEGIN
  p_Sequence_d81cd8de7f80 := 9;
  p_SQLBaseType_d81cd8de7f80 := 'numeric';
  p_SQLFullType_d81cd8de7f80 := 'numeric(38,11)';
  p_IsNullable_d81cd8de7f80 := TRUE;
  p_ID_d81cd8de7f80 := '369A6E6E-F702-4D62-9A1C-0C4324021774';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_d81cd8de7f80,
    'SQLBaseType', p_SQLBaseType_d81cd8de7f80,
    'SQLFullType', p_SQLFullType_d81cd8de7f80,
    'IsNullable', p_IsNullable_d81cd8de7f80,
    'ID', p_ID_d81cd8de7f80
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_d81cd8de7f80, p_SQLBaseType := p_SQLBaseType_d81cd8de7f80, p_SQLFullType := p_SQLFullType_d81cd8de7f80, p_IsNullable := p_IsNullable_d81cd8de7f80, p_ID := p_ID_d81cd8de7f80);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_5eb151e53cb8 INTEGER;
  p_SQLBaseType_5eb151e53cb8 VARCHAR(50);
  p_SQLFullType_5eb151e53cb8 VARCHAR(100);
  p_IsNullable_5eb151e53cb8 BOOLEAN;
  p_ID_5eb151e53cb8 UUID;
BEGIN
  p_Sequence_5eb151e53cb8 := 10;
  p_SQLBaseType_5eb151e53cb8 := 'int';
  p_SQLFullType_5eb151e53cb8 := 'int';
  p_IsNullable_5eb151e53cb8 := TRUE;
  p_ID_5eb151e53cb8 := '886D16AA-7924-47BE-B8E7-888F7DF84F9F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_5eb151e53cb8,
    'SQLBaseType', p_SQLBaseType_5eb151e53cb8,
    'SQLFullType', p_SQLFullType_5eb151e53cb8,
    'IsNullable', p_IsNullable_5eb151e53cb8,
    'ID', p_ID_5eb151e53cb8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_5eb151e53cb8, p_SQLBaseType := p_SQLBaseType_5eb151e53cb8, p_SQLFullType := p_SQLFullType_5eb151e53cb8, p_IsNullable := p_IsNullable_5eb151e53cb8, p_ID := p_ID_5eb151e53cb8);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_27edbec555e5 INTEGER;
  p_SQLBaseType_27edbec555e5 VARCHAR(50);
  p_SQLFullType_27edbec555e5 VARCHAR(100);
  p_IsNullable_27edbec555e5 BOOLEAN;
  p_ID_27edbec555e5 UUID;
BEGIN
  p_Sequence_27edbec555e5 := 11;
  p_SQLBaseType_27edbec555e5 := 'int';
  p_SQLFullType_27edbec555e5 := 'int';
  p_IsNullable_27edbec555e5 := TRUE;
  p_ID_27edbec555e5 := '69131812-D5F3-4938-BA8B-46F5DC5B5DDD';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_27edbec555e5,
    'SQLBaseType', p_SQLBaseType_27edbec555e5,
    'SQLFullType', p_SQLFullType_27edbec555e5,
    'IsNullable', p_IsNullable_27edbec555e5,
    'ID', p_ID_27edbec555e5
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_27edbec555e5, p_SQLBaseType := p_SQLBaseType_27edbec555e5, p_SQLFullType := p_SQLFullType_27edbec555e5, p_IsNullable := p_IsNullable_27edbec555e5, p_ID := p_ID_27edbec555e5);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_5f84854a25ac INTEGER;
  p_SQLBaseType_5f84854a25ac VARCHAR(50);
  p_SQLFullType_5f84854a25ac VARCHAR(100);
  p_IsNullable_5f84854a25ac BOOLEAN;
  p_ID_5f84854a25ac UUID;
BEGIN
  p_Sequence_5f84854a25ac := 12;
  p_SQLBaseType_5f84854a25ac := 'int';
  p_SQLFullType_5f84854a25ac := 'int';
  p_IsNullable_5f84854a25ac := TRUE;
  p_ID_5f84854a25ac := '1FB43D26-7BA8-4FC1-BF87-A64AF6FFCCB2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_5f84854a25ac,
    'SQLBaseType', p_SQLBaseType_5f84854a25ac,
    'SQLFullType', p_SQLFullType_5f84854a25ac,
    'IsNullable', p_IsNullable_5f84854a25ac,
    'ID', p_ID_5f84854a25ac
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_5f84854a25ac, p_SQLBaseType := p_SQLBaseType_5f84854a25ac, p_SQLFullType := p_SQLFullType_5f84854a25ac, p_IsNullable := p_IsNullable_5f84854a25ac, p_ID := p_ID_5f84854a25ac);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_6432723b8ab1 INTEGER;
  p_SQLBaseType_6432723b8ab1 VARCHAR(50);
  p_SQLFullType_6432723b8ab1 VARCHAR(100);
  p_IsNullable_6432723b8ab1 BOOLEAN;
  p_ID_6432723b8ab1 UUID;
BEGIN
  p_Sequence_6432723b8ab1 := 13;
  p_SQLBaseType_6432723b8ab1 := 'int';
  p_SQLFullType_6432723b8ab1 := 'int';
  p_IsNullable_6432723b8ab1 := TRUE;
  p_ID_6432723b8ab1 := 'AD4CB70B-5699-4F17-A7E5-A1C6FEDA9135';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_6432723b8ab1,
    'SQLBaseType', p_SQLBaseType_6432723b8ab1,
    'SQLFullType', p_SQLFullType_6432723b8ab1,
    'IsNullable', p_IsNullable_6432723b8ab1,
    'ID', p_ID_6432723b8ab1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_6432723b8ab1, p_SQLBaseType := p_SQLBaseType_6432723b8ab1, p_SQLFullType := p_SQLFullType_6432723b8ab1, p_IsNullable := p_IsNullable_6432723b8ab1, p_ID := p_ID_6432723b8ab1);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_55a2548303df INTEGER;
  p_SQLBaseType_55a2548303df VARCHAR(50);
  p_SQLFullType_55a2548303df VARCHAR(100);
  p_IsNullable_55a2548303df BOOLEAN;
  p_ID_55a2548303df UUID;
BEGIN
  p_Sequence_55a2548303df := 14;
  p_SQLBaseType_55a2548303df := 'int';
  p_SQLFullType_55a2548303df := 'int';
  p_IsNullable_55a2548303df := TRUE;
  p_ID_55a2548303df := '8E28C3CC-FCF6-4A3C-9A94-F37DF9EF2284';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_55a2548303df,
    'SQLBaseType', p_SQLBaseType_55a2548303df,
    'SQLFullType', p_SQLFullType_55a2548303df,
    'IsNullable', p_IsNullable_55a2548303df,
    'ID', p_ID_55a2548303df
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_55a2548303df, p_SQLBaseType := p_SQLBaseType_55a2548303df, p_SQLFullType := p_SQLFullType_55a2548303df, p_IsNullable := p_IsNullable_55a2548303df, p_ID := p_ID_55a2548303df);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_3216fb61f004 INTEGER;
  p_SQLBaseType_3216fb61f004 VARCHAR(50);
  p_SQLFullType_3216fb61f004 VARCHAR(100);
  p_IsNullable_3216fb61f004 BOOLEAN;
  p_ID_3216fb61f004 UUID;
BEGIN
  p_Sequence_3216fb61f004 := 15;
  p_SQLBaseType_3216fb61f004 := 'int';
  p_SQLFullType_3216fb61f004 := 'int';
  p_IsNullable_3216fb61f004 := TRUE;
  p_ID_3216fb61f004 := '2760E90E-7C64-47BD-B516-1BBDCF0DFCC8';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_3216fb61f004,
    'SQLBaseType', p_SQLBaseType_3216fb61f004,
    'SQLFullType', p_SQLFullType_3216fb61f004,
    'IsNullable', p_IsNullable_3216fb61f004,
    'ID', p_ID_3216fb61f004
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_3216fb61f004, p_SQLBaseType := p_SQLBaseType_3216fb61f004, p_SQLFullType := p_SQLFullType_3216fb61f004, p_IsNullable := p_IsNullable_3216fb61f004, p_ID := p_ID_3216fb61f004);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_4045ee706930 INTEGER;
  p_SQLBaseType_4045ee706930 VARCHAR(50);
  p_SQLFullType_4045ee706930 VARCHAR(100);
  p_IsNullable_4045ee706930 BOOLEAN;
  p_ID_4045ee706930 UUID;
BEGIN
  p_Sequence_4045ee706930 := 16;
  p_SQLBaseType_4045ee706930 := 'decimal';
  p_SQLFullType_4045ee706930 := 'decimal(38,4)';
  p_IsNullable_4045ee706930 := TRUE;
  p_ID_4045ee706930 := '76216847-7C49-439A-9E23-7316580D3E58';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_4045ee706930,
    'SQLBaseType', p_SQLBaseType_4045ee706930,
    'SQLFullType', p_SQLFullType_4045ee706930,
    'IsNullable', p_IsNullable_4045ee706930,
    'ID', p_ID_4045ee706930
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_4045ee706930, p_SQLBaseType := p_SQLBaseType_4045ee706930, p_SQLFullType := p_SQLFullType_4045ee706930, p_IsNullable := p_IsNullable_4045ee706930, p_ID := p_ID_4045ee706930);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_2daf368a9ef9 INTEGER;
  p_SQLBaseType_2daf368a9ef9 VARCHAR(50);
  p_SQLFullType_2daf368a9ef9 VARCHAR(100);
  p_IsNullable_2daf368a9ef9 BOOLEAN;
  p_ID_2daf368a9ef9 UUID;
BEGIN
  p_Sequence_2daf368a9ef9 := 17;
  p_SQLBaseType_2daf368a9ef9 := 'decimal';
  p_SQLFullType_2daf368a9ef9 := 'decimal(38,4)';
  p_IsNullable_2daf368a9ef9 := TRUE;
  p_ID_2daf368a9ef9 := '476C8704-431B-498F-B05C-C747FE863E96';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_2daf368a9ef9,
    'SQLBaseType', p_SQLBaseType_2daf368a9ef9,
    'SQLFullType', p_SQLFullType_2daf368a9ef9,
    'IsNullable', p_IsNullable_2daf368a9ef9,
    'ID', p_ID_2daf368a9ef9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_2daf368a9ef9, p_SQLBaseType := p_SQLBaseType_2daf368a9ef9, p_SQLFullType := p_SQLFullType_2daf368a9ef9, p_IsNullable := p_IsNullable_2daf368a9ef9, p_ID := p_ID_2daf368a9ef9);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_333d3269f589 INTEGER;
  p_SQLBaseType_333d3269f589 VARCHAR(50);
  p_SQLFullType_333d3269f589 VARCHAR(100);
  p_IsNullable_333d3269f589 BOOLEAN;
  p_ID_333d3269f589 UUID;
BEGIN
  p_Sequence_333d3269f589 := 18;
  p_SQLBaseType_333d3269f589 := 'decimal';
  p_SQLFullType_333d3269f589 := 'decimal(38,4)';
  p_IsNullable_333d3269f589 := TRUE;
  p_ID_333d3269f589 := 'D5B8A981-9C1A-420D-9F5C-BDB604732AD8';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_333d3269f589,
    'SQLBaseType', p_SQLBaseType_333d3269f589,
    'SQLFullType', p_SQLFullType_333d3269f589,
    'IsNullable', p_IsNullable_333d3269f589,
    'ID', p_ID_333d3269f589
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_333d3269f589, p_SQLBaseType := p_SQLBaseType_333d3269f589, p_SQLFullType := p_SQLFullType_333d3269f589, p_IsNullable := p_IsNullable_333d3269f589, p_ID := p_ID_333d3269f589);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_d594150246ea INTEGER;
  p_SQLBaseType_d594150246ea VARCHAR(50);
  p_SQLFullType_d594150246ea VARCHAR(100);
  p_IsNullable_d594150246ea BOOLEAN;
  p_ID_d594150246ea UUID;
BEGIN
  p_Sequence_d594150246ea := 19;
  p_SQLBaseType_d594150246ea := 'int';
  p_SQLFullType_d594150246ea := 'int';
  p_IsNullable_d594150246ea := TRUE;
  p_ID_d594150246ea := 'CC5A1403-9778-468D-B156-16A4B5083243';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_d594150246ea,
    'SQLBaseType', p_SQLBaseType_d594150246ea,
    'SQLFullType', p_SQLFullType_d594150246ea,
    'IsNullable', p_IsNullable_d594150246ea,
    'ID', p_ID_d594150246ea
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_d594150246ea, p_SQLBaseType := p_SQLBaseType_d594150246ea, p_SQLFullType := p_SQLFullType_d594150246ea, p_IsNullable := p_IsNullable_d594150246ea, p_ID := p_ID_d594150246ea);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_dcbfadec9d6e INTEGER;
  p_SQLBaseType_dcbfadec9d6e VARCHAR(50);
  p_SQLFullType_dcbfadec9d6e VARCHAR(100);
  p_IsNullable_dcbfadec9d6e BOOLEAN;
  p_ID_dcbfadec9d6e UUID;
BEGIN
  p_Sequence_dcbfadec9d6e := 20;
  p_SQLBaseType_dcbfadec9d6e := 'int';
  p_SQLFullType_dcbfadec9d6e := 'int';
  p_IsNullable_dcbfadec9d6e := TRUE;
  p_ID_dcbfadec9d6e := '69174F16-136E-4E1F-A059-E117A5BD02F6';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_dcbfadec9d6e,
    'SQLBaseType', p_SQLBaseType_dcbfadec9d6e,
    'SQLFullType', p_SQLFullType_dcbfadec9d6e,
    'IsNullable', p_IsNullable_dcbfadec9d6e,
    'ID', p_ID_dcbfadec9d6e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_dcbfadec9d6e, p_SQLBaseType := p_SQLBaseType_dcbfadec9d6e, p_SQLFullType := p_SQLFullType_dcbfadec9d6e, p_IsNullable := p_IsNullable_dcbfadec9d6e, p_ID := p_ID_dcbfadec9d6e);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_28b7b4e94ae1 UUID;
  p_QueryID_28b7b4e94ae1 UUID;
  p_EntityID_28b7b4e94ae1 UUID;
  p_DetectionMethod_28b7b4e94ae1 VARCHAR(50);
  p_AutoDetectConfidenceScore_28b7b4e94ae1 NUMERIC(3,2);
  p_AlternateBaseViewID_28b7b4e94ae1 UUID;
BEGIN
  p_ID_28b7b4e94ae1 := '2f1ad9b6-a9ac-4b6c-97b3-065cdb798788';
  p_QueryID_28b7b4e94ae1 := '5A1E5000-0001-4000-A000-00000000000E';
  p_EntityID_28b7b4e94ae1 := '66D82C24-9C9F-4CD6-B019-53C20274AB00';
  p_DetectionMethod_28b7b4e94ae1 := 'Parser';
  p_AutoDetectConfidenceScore_28b7b4e94ae1 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_28b7b4e94ae1
                    OR ("QueryID" = p_QueryID_28b7b4e94ae1 AND "EntityID" = p_EntityID_28b7b4e94ae1)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_28b7b4e94ae1,
    'QueryID', p_QueryID_28b7b4e94ae1,
    'EntityID', p_EntityID_28b7b4e94ae1,
    'DetectionMethod', p_DetectionMethod_28b7b4e94ae1,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_28b7b4e94ae1,
    'AlternateBaseViewID', p_AlternateBaseViewID_28b7b4e94ae1
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_28b7b4e94ae1, p_QueryID := p_QueryID_28b7b4e94ae1, p_EntityID := p_EntityID_28b7b4e94ae1, p_DetectionMethod := p_DetectionMethod_28b7b4e94ae1, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_28b7b4e94ae1, p_AlternateBaseViewID := p_AlternateBaseViewID_28b7b4e94ae1, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_93ca02227461 UUID;
  p_QueryID_93ca02227461 UUID;
  p_EntityID_93ca02227461 UUID;
  p_DetectionMethod_93ca02227461 VARCHAR(50);
  p_AutoDetectConfidenceScore_93ca02227461 NUMERIC(3,2);
  p_AlternateBaseViewID_93ca02227461 UUID;
BEGIN
  p_ID_93ca02227461 := 'ba1f7001-09b7-4549-bd23-4b07ad99935d';
  p_QueryID_93ca02227461 := '5A1E5000-0001-4000-A000-00000000000E';
  p_EntityID_93ca02227461 := 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7';
  p_DetectionMethod_93ca02227461 := 'Parser';
  p_AutoDetectConfidenceScore_93ca02227461 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_93ca02227461
                    OR ("QueryID" = p_QueryID_93ca02227461 AND "EntityID" = p_EntityID_93ca02227461)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_93ca02227461,
    'QueryID', p_QueryID_93ca02227461,
    'EntityID', p_EntityID_93ca02227461,
    'DetectionMethod', p_DetectionMethod_93ca02227461,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_93ca02227461,
    'AlternateBaseViewID', p_AlternateBaseViewID_93ca02227461
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_93ca02227461, p_QueryID := p_QueryID_93ca02227461, p_EntityID := p_EntityID_93ca02227461, p_DetectionMethod := p_DetectionMethod_93ca02227461, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_93ca02227461, p_AlternateBaseViewID := p_AlternateBaseViewID_93ca02227461, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_SQL_02bb0c3d3340 TEXT;
  p_ExtractedSQLHash_02bb0c3d3340 VARCHAR(64);
  p_ExtractionStatus_02bb0c3d3340 VARCHAR(20);
  p_ID_02bb0c3d3340 UUID;
BEGIN
  p_SQL_02bb0c3d3340 := '-- Deal involvement by rep, ATTRIBUTION-WEIGHTED. Master plan §9.4, the second half of the pair.
--
-- ══ ATTRIBUTION BASIS: WEIGHTED BY DealTeamMember.AttributionPct. CREDIT IS SPLIT. ══════════════
--
-- This is the "deals I was involved in" question. It answers: who contributed to this, and how much?
--
-- Every active team member appears — AE, SE, SDR, partner rep — and each one''s share of the deal is
-- `Amount * AttributionPct / 100`. That is a CREDIT SPLIT, not a booking. It exists so an SE who
-- supported nine deals is visible at all, which the owner-filtered report cannot show by design.
--
-- ══ THIS DOES NOT SUM TO THE COMPANY''S BOOKINGS, AND THAT IS NOT A BUG ══════════════════════════
--
-- Nothing constrains a deal''s AttributionPct values to total 100. If a deal''s three members carry 60
-- / 30 / 30, this reports 120% of it; if they carry 50 / 20, it reports 70%. Both are legitimate
-- statements about credit and neither is a statement about revenue.
--
-- AN EARLIER VERSION OF THIS COMMENT PROMISED AN "AttributionCoveragePct" COLUMN. It does not
-- exist, and the fix is to delete the promise rather than add the column: coverage is a property of a
-- DEAL (do its members'' shares total 100?), and this query groups by REP. A per-rep row has no
-- coverage to report, so the column could only ever have been misleading here.
--
-- `UnstatedAttributionCount` below is the part of that intent this grain CAN honestly carry: it
-- counts members whose share was never stated, which is the most common cause of coverage being off.
--
-- Deal-level coverage belongs in a deal-grained report. It is not built; noted so the next person
-- reads an absence rather than a broken reference.
--
-- ══ WHICH COLUMNS ARE ADDITIVE ACROSS ROWS, BECAUSE ONLY SOME ARE ═════════════════════════════
--
--   ADDITIVE      WeightedWonAmount -- shares of a deal, so totalling them returns the deal.
--   ADDITIVE      UnstatedAttributionCount -- a count of member rows, and rows are what this grain is.
--   NOT ADDITIVE  WonAmountOfDealsTouched -- the whole deal, repeated per member. See its note.
--   NOT ADDITIVE  DealsInvolvedIn / WonDealsInvolvedIn -- one deal counts once per member who touched it.
--   NOT ADDITIVE  AvgAttributionPct -- an average; averaging averages across reps is not an average.
--
-- Stated here rather than left to a reader''s judgement because the failure is silent: every one of
-- those non-additive columns produces a plausible-looking number when summed.
--
-- HOW THE MISSING COLUMN WAS FOUND, since it is the kind of thing that hides for a long time: by
-- seeding demo data these reports could actually read and then looking at the OUTPUT instead of the
-- comment. Before that, every by-rep report returned zero rows, so nothing disagreed with anything.
--
-- USE `bookings-by-owner.sql` FOR ANY NUMBER THAT HAS TO RECONCILE — a board figure, a commission
-- input, an accounting tie-out. Use this one for coverage and involvement. §9.4: "There is no safe
-- default that works for both."
--
-- NULL AttributionPct IS TREATED AS ZERO CREDIT, NOT AS FULL CREDIT. A member nobody assigned a share
-- to has an unstated contribution, and inventing 100 for them would manufacture the exact overcount
-- this query is built to expose. They still appear, with their zero visible.
--
-- DATE DIMENSION: ActualCloseDate.
SELECT
    tm.EmployeeID,
    tm.PersonID,
    COALESCE(tm.EmployeeID, tm.PersonID)        AS RepID,
    CASE WHEN tm.EmployeeID IS NOT NULL THEN N''Employee''
         WHEN tm.PersonID IS NOT NULL THEN N''Person''
    END                                         AS RepKind,
    COALESCE(emp.FirstName + '' '' + emp.LastName, per.DisplayName) AS RepName,
    tm.DealRoleID,
    r.Name                                      AS RoleName,
    r.IsOwnerRole,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    COUNT(*)                                    AS DealsInvolvedIn,
    SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END) AS WonDealsInvolvedIn,
    -- The weighted credit. Amount and AttributionPct are both stored values; this splits a figure,
    -- it does not price anything.
    SUM(CASE WHEN st.IsWon = 1
             THEN ISNULL(d.Amount, 0) * ISNULL(tm.AttributionPct, 0) / 100.0
             ELSE 0 END)                        AS WeightedWonAmount,
    /**
     * NOT ADDITIVE ACROSS ROWS. Renamed from "UnweightedWonAmount", which read like something you
     * could total up. It is the FULL value of the deals this rep touched, repeated in full on every
     * member''s row -- so summing the column across reps multiplies each shared deal by its team size.
     *
     * Measured on the seeded won deal: 27,480 split 60/25/15 gives 16,488 + 6,870 + 4,122, which sums
     * back to 27,480 exactly. The same deal contributes 27,480 to all three rows here, so summing
     * this column gives 82,440 -- three times a deal that was worth 27,480 once. That is §9.4''s
     * double-count, arriving through a column name rather than through a missing filter.
     */
    SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS WonAmountOfDealsTouched,
    AVG(CAST(ISNULL(tm.AttributionPct, 0) AS FLOAT))                AS AvgAttributionPct,
    SUM(CASE WHEN tm.AttributionPct IS NULL THEN 1 ELSE 0 END)      AS UnstatedAttributionCount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsClosed = 1
INNER JOIN [__mj_BizAppsSales].DealTeamMember tm
        ON tm.DealID = d.ID
       AND tm.IsActive = 1
       -- NO IsOwnerRole FILTER. Its absence is the definition of this report, not an omission.
INNER JOIN [__mj_BizAppsSales].DealRole r
        ON r.ID = tm.DealRoleID
LEFT OUTER JOIN [${mjSchema}].Employee emp
        ON emp.ID = tm.EmployeeID
LEFT OUTER JOIN [__mj_BizAppsCommon].Person per
        ON per.ID = tm.PersonID
WHERE d.ActualCloseDate IS NOT NULL
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if PeriodStart %}
  AND d.ActualCloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND d.ActualCloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    tm.EmployeeID, tm.PersonID, emp.FirstName, emp.LastName, per.DisplayName,
    tm.DealRoleID, r.Name, r.IsOwnerRole,
    d.CompanyID, d.Company
ORDER BY
    WeightedWonAmount DESC;
';
  p_ExtractedSQLHash_02bb0c3d3340 := '9f3576138418b80b4deebc3870b4b9a6cf10545e16cd80953d245677d154228a';
  p_ExtractionStatus_02bb0c3d3340 := 'OK';
  p_ID_02bb0c3d3340 := '5A1E5000-0001-4000-A000-000000000009';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'SQL', p_SQL_02bb0c3d3340,
    'ExtractedSQLHash', p_ExtractedSQLHash_02bb0c3d3340,
    'ExtractionStatus', p_ExtractionStatus_02bb0c3d3340,
    'ID', p_ID_02bb0c3d3340
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_SQL := p_SQL_02bb0c3d3340, p_ExtractedSQLHash := p_ExtractedSQLHash_02bb0c3d3340, p_ExtractionStatus := p_ExtractionStatus_02bb0c3d3340, p_ID := p_ID_02bb0c3d3340);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_6e2470bb9a13 UUID;
  p_IsNullable_6e2470bb9a13 BOOLEAN;
  p_ID_6e2470bb9a13 UUID;
BEGIN
  p_SourceEntityFieldID_6e2470bb9a13 := 'D5C7EF81-EFD5-46CE-ABCC-B76C7F39D5C3';
  p_IsNullable_6e2470bb9a13 := TRUE;
  p_ID_6e2470bb9a13 := 'A6700493-1CDA-45C3-B65D-CFBF1309A483';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_6e2470bb9a13 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_6e2470bb9a13
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_6e2470bb9a13 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_6e2470bb9a13));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_6e2470bb9a13,
    'IsNullable', p_IsNullable_6e2470bb9a13,
    'ID', p_ID_6e2470bb9a13
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_6e2470bb9a13, p_IsNullable := p_IsNullable_6e2470bb9a13, p_ID := p_ID_6e2470bb9a13);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_8218e21516d9 UUID;
  p_QueryID_8218e21516d9 UUID;
  p_Name_8218e21516d9 VARCHAR(255);
  p_Description_8218e21516d9 TEXT;
  p_Sequence_8218e21516d9 INTEGER;
  p_SQLBaseType_8218e21516d9 VARCHAR(50);
  p_SQLFullType_8218e21516d9 VARCHAR(100);
  p_SourceEntityID_8218e21516d9 UUID;
  p_SourceFieldName_8218e21516d9 VARCHAR(255);
  p_IsComputed_8218e21516d9 BOOLEAN;
  p_ComputationDescription_8218e21516d9 TEXT;
  p_IsSummary_8218e21516d9 BOOLEAN;
  p_SummaryDescription_8218e21516d9 TEXT;
  p_DetectionMethod_8218e21516d9 VARCHAR(50);
  p_AutoDetectConfidenceScore_8218e21516d9 NUMERIC(3,2);
  p_SourceEntityFieldID_8218e21516d9 UUID;
  p_IsNullable_8218e21516d9 BOOLEAN;
  p_SourceObjectName_8218e21516d9 VARCHAR(500);
BEGIN
  p_ID_8218e21516d9 := 'fd5f27e7-4bc5-41a8-adbc-6d6cb741d2b5';
  p_QueryID_8218e21516d9 := '5A1E5000-0001-4000-A000-000000000009';
  p_Name_8218e21516d9 := 'PersonID';
  p_Description_8218e21516d9 := 'The team member, when they are not an employee, such as a partner rep. Set this or Employee, not both.';
  p_Sequence_8218e21516d9 := 2;
  p_SQLBaseType_8218e21516d9 := 'uniqueidentifier';
  p_SQLFullType_8218e21516d9 := 'uniqueidentifier';
  p_SourceEntityID_8218e21516d9 := 'A5BC9EE5-4C4E-408B-BB07-3C718227B616';
  p_SourceFieldName_8218e21516d9 := 'PersonID';
  p_IsComputed_8218e21516d9 := FALSE;
  p_IsSummary_8218e21516d9 := FALSE;
  p_DetectionMethod_8218e21516d9 := 'Database';
  p_SourceEntityFieldID_8218e21516d9 := '6ADB00D1-C166-43D8-815E-7A458CD79DBF';
  p_IsNullable_8218e21516d9 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_8218e21516d9 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_8218e21516d9 AND "Name" = p_SourceFieldName_8218e21516d9
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_8218e21516d9 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_8218e21516d9
                    OR ("QueryID" = p_QueryID_8218e21516d9 AND "Name" = p_Name_8218e21516d9)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_8218e21516d9,
    'QueryID', p_QueryID_8218e21516d9,
    'Name', p_Name_8218e21516d9,
    'Description', p_Description_8218e21516d9,
    'Sequence', p_Sequence_8218e21516d9,
    'SQLBaseType', p_SQLBaseType_8218e21516d9,
    'SQLFullType', p_SQLFullType_8218e21516d9,
    'SourceEntityID', p_SourceEntityID_8218e21516d9,
    'SourceFieldName', p_SourceFieldName_8218e21516d9,
    'IsComputed', p_IsComputed_8218e21516d9,
    'ComputationDescription', p_ComputationDescription_8218e21516d9,
    'IsSummary', p_IsSummary_8218e21516d9,
    'SummaryDescription', p_SummaryDescription_8218e21516d9,
    'DetectionMethod', p_DetectionMethod_8218e21516d9,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8218e21516d9,
    'SourceEntityFieldID', p_SourceEntityFieldID_8218e21516d9,
    'IsNullable', p_IsNullable_8218e21516d9,
    'SourceObjectName', p_SourceObjectName_8218e21516d9
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_8218e21516d9, p_QueryID := p_QueryID_8218e21516d9, p_Name := p_Name_8218e21516d9, p_Description := p_Description_8218e21516d9, p_Sequence := p_Sequence_8218e21516d9, p_SQLBaseType := p_SQLBaseType_8218e21516d9, p_SQLFullType := p_SQLFullType_8218e21516d9, p_SourceEntityID := p_SourceEntityID_8218e21516d9, p_SourceFieldName := p_SourceFieldName_8218e21516d9, p_IsComputed := p_IsComputed_8218e21516d9, p_ComputationDescription := p_ComputationDescription_8218e21516d9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_8218e21516d9, p_SummaryDescription := p_SummaryDescription_8218e21516d9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8218e21516d9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8218e21516d9, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_8218e21516d9, p_IsNullable := p_IsNullable_8218e21516d9, p_SourceObjectName := p_SourceObjectName_8218e21516d9, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_76cab4e76a34 UUID;
  p_QueryID_76cab4e76a34 UUID;
  p_Name_76cab4e76a34 VARCHAR(255);
  p_Description_76cab4e76a34 TEXT;
  p_Sequence_76cab4e76a34 INTEGER;
  p_SQLBaseType_76cab4e76a34 VARCHAR(50);
  p_SQLFullType_76cab4e76a34 VARCHAR(100);
  p_SourceEntityID_76cab4e76a34 UUID;
  p_SourceFieldName_76cab4e76a34 VARCHAR(255);
  p_IsComputed_76cab4e76a34 BOOLEAN;
  p_ComputationDescription_76cab4e76a34 TEXT;
  p_IsSummary_76cab4e76a34 BOOLEAN;
  p_SummaryDescription_76cab4e76a34 TEXT;
  p_DetectionMethod_76cab4e76a34 VARCHAR(50);
  p_AutoDetectConfidenceScore_76cab4e76a34 NUMERIC(3,2);
  p_SourceEntityFieldID_76cab4e76a34 UUID;
  p_IsNullable_76cab4e76a34 BOOLEAN;
  p_SourceObjectName_76cab4e76a34 VARCHAR(500);
BEGIN
  p_ID_76cab4e76a34 := '1af6b970-586c-4605-a24f-c16746f0b8bd';
  p_QueryID_76cab4e76a34 := '5A1E5000-0001-4000-A000-000000000009';
  p_Name_76cab4e76a34 := 'RepID';
  p_Sequence_76cab4e76a34 := 3;
  p_SQLBaseType_76cab4e76a34 := 'uniqueidentifier';
  p_SQLFullType_76cab4e76a34 := 'uniqueidentifier';
  p_IsComputed_76cab4e76a34 := TRUE;
  p_IsSummary_76cab4e76a34 := FALSE;
  p_DetectionMethod_76cab4e76a34 := 'Database';
  p_IsNullable_76cab4e76a34 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_76cab4e76a34
                    OR ("QueryID" = p_QueryID_76cab4e76a34 AND "Name" = p_Name_76cab4e76a34)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_76cab4e76a34,
    'QueryID', p_QueryID_76cab4e76a34,
    'Name', p_Name_76cab4e76a34,
    'Description', p_Description_76cab4e76a34,
    'Sequence', p_Sequence_76cab4e76a34,
    'SQLBaseType', p_SQLBaseType_76cab4e76a34,
    'SQLFullType', p_SQLFullType_76cab4e76a34,
    'SourceEntityID', p_SourceEntityID_76cab4e76a34,
    'SourceFieldName', p_SourceFieldName_76cab4e76a34,
    'IsComputed', p_IsComputed_76cab4e76a34,
    'ComputationDescription', p_ComputationDescription_76cab4e76a34,
    'IsSummary', p_IsSummary_76cab4e76a34,
    'SummaryDescription', p_SummaryDescription_76cab4e76a34,
    'DetectionMethod', p_DetectionMethod_76cab4e76a34,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_76cab4e76a34,
    'SourceEntityFieldID', p_SourceEntityFieldID_76cab4e76a34,
    'IsNullable', p_IsNullable_76cab4e76a34,
    'SourceObjectName', p_SourceObjectName_76cab4e76a34
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_76cab4e76a34, p_QueryID := p_QueryID_76cab4e76a34, p_Name := p_Name_76cab4e76a34, p_Description := p_Description_76cab4e76a34, p_Description_Clear := TRUE, p_Sequence := p_Sequence_76cab4e76a34, p_SQLBaseType := p_SQLBaseType_76cab4e76a34, p_SQLFullType := p_SQLFullType_76cab4e76a34, p_SourceEntityID := p_SourceEntityID_76cab4e76a34, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_76cab4e76a34, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_76cab4e76a34, p_ComputationDescription := p_ComputationDescription_76cab4e76a34, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_76cab4e76a34, p_SummaryDescription := p_SummaryDescription_76cab4e76a34, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_76cab4e76a34, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_76cab4e76a34, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_76cab4e76a34, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_76cab4e76a34, p_SourceObjectName := p_SourceObjectName_76cab4e76a34, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_d1bba9bbf6ba UUID;
  p_QueryID_d1bba9bbf6ba UUID;
  p_Name_d1bba9bbf6ba VARCHAR(255);
  p_Description_d1bba9bbf6ba TEXT;
  p_Sequence_d1bba9bbf6ba INTEGER;
  p_SQLBaseType_d1bba9bbf6ba VARCHAR(50);
  p_SQLFullType_d1bba9bbf6ba VARCHAR(100);
  p_SourceEntityID_d1bba9bbf6ba UUID;
  p_SourceFieldName_d1bba9bbf6ba VARCHAR(255);
  p_IsComputed_d1bba9bbf6ba BOOLEAN;
  p_ComputationDescription_d1bba9bbf6ba TEXT;
  p_IsSummary_d1bba9bbf6ba BOOLEAN;
  p_SummaryDescription_d1bba9bbf6ba TEXT;
  p_DetectionMethod_d1bba9bbf6ba VARCHAR(50);
  p_AutoDetectConfidenceScore_d1bba9bbf6ba NUMERIC(3,2);
  p_SourceEntityFieldID_d1bba9bbf6ba UUID;
  p_IsNullable_d1bba9bbf6ba BOOLEAN;
  p_SourceObjectName_d1bba9bbf6ba VARCHAR(500);
BEGIN
  p_ID_d1bba9bbf6ba := 'bf291b25-c88a-4887-992c-9eb5db0c7c7e';
  p_QueryID_d1bba9bbf6ba := '5A1E5000-0001-4000-A000-000000000009';
  p_Name_d1bba9bbf6ba := 'RepKind';
  p_Sequence_d1bba9bbf6ba := 4;
  p_SQLBaseType_d1bba9bbf6ba := 'nvarchar';
  p_SQLFullType_d1bba9bbf6ba := 'nvarchar(8)';
  p_IsComputed_d1bba9bbf6ba := TRUE;
  p_IsSummary_d1bba9bbf6ba := FALSE;
  p_DetectionMethod_d1bba9bbf6ba := 'Database';
  p_IsNullable_d1bba9bbf6ba := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_d1bba9bbf6ba
                    OR ("QueryID" = p_QueryID_d1bba9bbf6ba AND "Name" = p_Name_d1bba9bbf6ba)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_d1bba9bbf6ba,
    'QueryID', p_QueryID_d1bba9bbf6ba,
    'Name', p_Name_d1bba9bbf6ba,
    'Description', p_Description_d1bba9bbf6ba,
    'Sequence', p_Sequence_d1bba9bbf6ba,
    'SQLBaseType', p_SQLBaseType_d1bba9bbf6ba,
    'SQLFullType', p_SQLFullType_d1bba9bbf6ba,
    'SourceEntityID', p_SourceEntityID_d1bba9bbf6ba,
    'SourceFieldName', p_SourceFieldName_d1bba9bbf6ba,
    'IsComputed', p_IsComputed_d1bba9bbf6ba,
    'ComputationDescription', p_ComputationDescription_d1bba9bbf6ba,
    'IsSummary', p_IsSummary_d1bba9bbf6ba,
    'SummaryDescription', p_SummaryDescription_d1bba9bbf6ba,
    'DetectionMethod', p_DetectionMethod_d1bba9bbf6ba,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_d1bba9bbf6ba,
    'SourceEntityFieldID', p_SourceEntityFieldID_d1bba9bbf6ba,
    'IsNullable', p_IsNullable_d1bba9bbf6ba,
    'SourceObjectName', p_SourceObjectName_d1bba9bbf6ba
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_d1bba9bbf6ba, p_QueryID := p_QueryID_d1bba9bbf6ba, p_Name := p_Name_d1bba9bbf6ba, p_Description := p_Description_d1bba9bbf6ba, p_Description_Clear := TRUE, p_Sequence := p_Sequence_d1bba9bbf6ba, p_SQLBaseType := p_SQLBaseType_d1bba9bbf6ba, p_SQLFullType := p_SQLFullType_d1bba9bbf6ba, p_SourceEntityID := p_SourceEntityID_d1bba9bbf6ba, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_d1bba9bbf6ba, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_d1bba9bbf6ba, p_ComputationDescription := p_ComputationDescription_d1bba9bbf6ba, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_d1bba9bbf6ba, p_SummaryDescription := p_SummaryDescription_d1bba9bbf6ba, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_d1bba9bbf6ba, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_d1bba9bbf6ba, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_d1bba9bbf6ba, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_d1bba9bbf6ba, p_SourceObjectName := p_SourceObjectName_d1bba9bbf6ba, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_d6ca5ad11294 INTEGER;
  p_SQLFullType_d6ca5ad11294 VARCHAR(100);
  p_IsNullable_d6ca5ad11294 BOOLEAN;
  p_ID_d6ca5ad11294 UUID;
BEGIN
  p_Sequence_d6ca5ad11294 := 5;
  p_SQLFullType_d6ca5ad11294 := 'nvarchar(250)';
  p_IsNullable_d6ca5ad11294 := TRUE;
  p_ID_d6ca5ad11294 := 'A3F7119A-E744-4E4E-9A18-FE434E8E9950';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_d6ca5ad11294,
    'SQLFullType', p_SQLFullType_d6ca5ad11294,
    'IsNullable', p_IsNullable_d6ca5ad11294,
    'ID', p_ID_d6ca5ad11294
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_d6ca5ad11294, p_SQLFullType := p_SQLFullType_d6ca5ad11294, p_IsNullable := p_IsNullable_d6ca5ad11294, p_ID := p_ID_d6ca5ad11294);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_8770a91b4663 INTEGER;
  p_SourceEntityFieldID_8770a91b4663 UUID;
  p_IsNullable_8770a91b4663 BOOLEAN;
  p_ID_8770a91b4663 UUID;
BEGIN
  p_Sequence_8770a91b4663 := 6;
  p_SourceEntityFieldID_8770a91b4663 := '2D29B870-916F-4DD2-A499-E7AD018DFEED';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_8770a91b4663 := FALSE;
  p_ID_8770a91b4663 := '141E31D2-FA4C-4905-9E8E-CE5E19EC27D0';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_8770a91b4663 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_8770a91b4663
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_8770a91b4663 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_8770a91b4663));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_8770a91b4663,
    'SourceEntityFieldID', p_SourceEntityFieldID_8770a91b4663,
    'IsNullable', p_IsNullable_8770a91b4663,
    'ID', p_ID_8770a91b4663
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_8770a91b4663, p_SourceEntityFieldID := p_SourceEntityFieldID_8770a91b4663, p_IsNullable := p_IsNullable_8770a91b4663, p_ID := p_ID_8770a91b4663);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_510313457669 INTEGER;
  p_SourceEntityFieldID_510313457669 UUID;
  p_IsNullable_510313457669 BOOLEAN;
  p_ID_510313457669 UUID;
BEGIN
  p_Sequence_510313457669 := 7;
  p_SourceEntityFieldID_510313457669 := '8C17A9F4-85C7-470D-96CC-E9A3D1168A6D';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_510313457669 := FALSE;
  p_ID_510313457669 := '32797840-B259-4E30-AF4A-D6E336D4024B';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_510313457669 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_510313457669
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_510313457669 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_510313457669));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_510313457669,
    'SourceEntityFieldID', p_SourceEntityFieldID_510313457669,
    'IsNullable', p_IsNullable_510313457669,
    'ID', p_ID_510313457669
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_510313457669, p_SourceEntityFieldID := p_SourceEntityFieldID_510313457669, p_IsNullable := p_IsNullable_510313457669, p_ID := p_ID_510313457669);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_3f9d8719578d INTEGER;
  p_SourceEntityFieldID_3f9d8719578d UUID;
  p_IsNullable_3f9d8719578d BOOLEAN;
  p_ID_3f9d8719578d UUID;
BEGIN
  p_Sequence_3f9d8719578d := 8;
  p_SourceEntityFieldID_3f9d8719578d := '0FB859F1-CE24-4FAD-92F4-568D8C24E2A1';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_3f9d8719578d := FALSE;
  p_ID_3f9d8719578d := 'E25A7E38-56E6-4D90-8AFF-A5A5CFFDB68A';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_3f9d8719578d := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_3f9d8719578d
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_3f9d8719578d THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_3f9d8719578d));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_3f9d8719578d,
    'SourceEntityFieldID', p_SourceEntityFieldID_3f9d8719578d,
    'IsNullable', p_IsNullable_3f9d8719578d,
    'ID', p_ID_3f9d8719578d
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_3f9d8719578d, p_SourceEntityFieldID := p_SourceEntityFieldID_3f9d8719578d, p_IsNullable := p_IsNullable_3f9d8719578d, p_ID := p_ID_3f9d8719578d);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_75123d22d67f INTEGER;
  p_SourceEntityFieldID_75123d22d67f UUID;
  p_IsNullable_75123d22d67f BOOLEAN;
  p_ID_75123d22d67f UUID;
BEGIN
  p_Sequence_75123d22d67f := 9;
  p_SourceEntityFieldID_75123d22d67f := 'A4B19A26-071E-4BA8-8ADD-43317EF70061';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_75123d22d67f := FALSE;
  p_ID_75123d22d67f := '84AC7517-CBD1-4BE0-8307-DA513A2D26BC';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_75123d22d67f := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_75123d22d67f
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_75123d22d67f THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_75123d22d67f));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_75123d22d67f,
    'SourceEntityFieldID', p_SourceEntityFieldID_75123d22d67f,
    'IsNullable', p_IsNullable_75123d22d67f,
    'ID', p_ID_75123d22d67f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_75123d22d67f, p_SourceEntityFieldID := p_SourceEntityFieldID_75123d22d67f, p_IsNullable := p_IsNullable_75123d22d67f, p_ID := p_ID_75123d22d67f);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_3d88b040c681 INTEGER;
  p_SourceEntityFieldID_3d88b040c681 UUID;
  p_IsNullable_3d88b040c681 BOOLEAN;
  p_ID_3d88b040c681 UUID;
BEGIN
  p_Sequence_3d88b040c681 := 10;
  p_SourceEntityFieldID_3d88b040c681 := '79A3E2FC-768E-4219-A16A-A70E3330605E';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_3d88b040c681 := FALSE;
  p_ID_3d88b040c681 := '86827925-41BD-43AC-A8DC-E14ED969D879';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_3d88b040c681 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_3d88b040c681
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_3d88b040c681 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_3d88b040c681));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_3d88b040c681,
    'SourceEntityFieldID', p_SourceEntityFieldID_3d88b040c681,
    'IsNullable', p_IsNullable_3d88b040c681,
    'ID', p_ID_3d88b040c681
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_3d88b040c681, p_SourceEntityFieldID := p_SourceEntityFieldID_3d88b040c681, p_IsNullable := p_IsNullable_3d88b040c681, p_ID := p_ID_3d88b040c681);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_48afdcf9e2f3 INTEGER;
  p_SQLBaseType_48afdcf9e2f3 VARCHAR(50);
  p_SQLFullType_48afdcf9e2f3 VARCHAR(100);
  p_IsNullable_48afdcf9e2f3 BOOLEAN;
  p_ID_48afdcf9e2f3 UUID;
BEGIN
  p_Sequence_48afdcf9e2f3 := 11;
  p_SQLBaseType_48afdcf9e2f3 := 'int';
  p_SQLFullType_48afdcf9e2f3 := 'int';
  p_IsNullable_48afdcf9e2f3 := TRUE;
  p_ID_48afdcf9e2f3 := 'DADD4CAC-8018-4677-8F95-F90B432A4210';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_48afdcf9e2f3,
    'SQLBaseType', p_SQLBaseType_48afdcf9e2f3,
    'SQLFullType', p_SQLFullType_48afdcf9e2f3,
    'IsNullable', p_IsNullable_48afdcf9e2f3,
    'ID', p_ID_48afdcf9e2f3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_48afdcf9e2f3, p_SQLBaseType := p_SQLBaseType_48afdcf9e2f3, p_SQLFullType := p_SQLFullType_48afdcf9e2f3, p_IsNullable := p_IsNullable_48afdcf9e2f3, p_ID := p_ID_48afdcf9e2f3);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_42b107c22d03 INTEGER;
  p_SQLBaseType_42b107c22d03 VARCHAR(50);
  p_SQLFullType_42b107c22d03 VARCHAR(100);
  p_IsNullable_42b107c22d03 BOOLEAN;
  p_ID_42b107c22d03 UUID;
BEGIN
  p_Sequence_42b107c22d03 := 12;
  p_SQLBaseType_42b107c22d03 := 'int';
  p_SQLFullType_42b107c22d03 := 'int';
  p_IsNullable_42b107c22d03 := TRUE;
  p_ID_42b107c22d03 := '92002D54-F59A-4B53-8D03-5743B6F6270D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_42b107c22d03,
    'SQLBaseType', p_SQLBaseType_42b107c22d03,
    'SQLFullType', p_SQLFullType_42b107c22d03,
    'IsNullable', p_IsNullable_42b107c22d03,
    'ID', p_ID_42b107c22d03
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_42b107c22d03, p_SQLBaseType := p_SQLBaseType_42b107c22d03, p_SQLFullType := p_SQLFullType_42b107c22d03, p_IsNullable := p_IsNullable_42b107c22d03, p_ID := p_ID_42b107c22d03);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_f9ce99a6229f INTEGER;
  p_SQLBaseType_f9ce99a6229f VARCHAR(50);
  p_SQLFullType_f9ce99a6229f VARCHAR(100);
  p_IsNullable_f9ce99a6229f BOOLEAN;
  p_ID_f9ce99a6229f UUID;
BEGIN
  p_Sequence_f9ce99a6229f := 13;
  p_SQLBaseType_f9ce99a6229f := 'numeric';
  p_SQLFullType_f9ce99a6229f := 'numeric(38,11)';
  p_IsNullable_f9ce99a6229f := TRUE;
  p_ID_f9ce99a6229f := '34583209-873F-48CE-8BAC-87BCB6F9761F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_f9ce99a6229f,
    'SQLBaseType', p_SQLBaseType_f9ce99a6229f,
    'SQLFullType', p_SQLFullType_f9ce99a6229f,
    'IsNullable', p_IsNullable_f9ce99a6229f,
    'ID', p_ID_f9ce99a6229f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_f9ce99a6229f, p_SQLBaseType := p_SQLBaseType_f9ce99a6229f, p_SQLFullType := p_SQLFullType_f9ce99a6229f, p_IsNullable := p_IsNullable_f9ce99a6229f, p_ID := p_ID_f9ce99a6229f);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_4608f604f0fc INTEGER;
  p_SQLBaseType_4608f604f0fc VARCHAR(50);
  p_SQLFullType_4608f604f0fc VARCHAR(100);
  p_IsNullable_4608f604f0fc BOOLEAN;
  p_ID_4608f604f0fc UUID;
BEGIN
  p_Sequence_4608f604f0fc := 14;
  p_SQLBaseType_4608f604f0fc := 'decimal';
  p_SQLFullType_4608f604f0fc := 'decimal(38,4)';
  p_IsNullable_4608f604f0fc := TRUE;
  p_ID_4608f604f0fc := '3E8FE250-36F5-4C37-8DC2-4E6DEA4A4F84';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_4608f604f0fc,
    'SQLBaseType', p_SQLBaseType_4608f604f0fc,
    'SQLFullType', p_SQLFullType_4608f604f0fc,
    'IsNullable', p_IsNullable_4608f604f0fc,
    'ID', p_ID_4608f604f0fc
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_4608f604f0fc, p_SQLBaseType := p_SQLBaseType_4608f604f0fc, p_SQLFullType := p_SQLFullType_4608f604f0fc, p_IsNullable := p_IsNullable_4608f604f0fc, p_ID := p_ID_4608f604f0fc);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_8c11e4caa3f3 INTEGER;
  p_SQLBaseType_8c11e4caa3f3 VARCHAR(50);
  p_SQLFullType_8c11e4caa3f3 VARCHAR(100);
  p_IsNullable_8c11e4caa3f3 BOOLEAN;
  p_ID_8c11e4caa3f3 UUID;
BEGIN
  p_Sequence_8c11e4caa3f3 := 15;
  p_SQLBaseType_8c11e4caa3f3 := 'float';
  p_SQLFullType_8c11e4caa3f3 := 'float';
  p_IsNullable_8c11e4caa3f3 := TRUE;
  p_ID_8c11e4caa3f3 := 'C6B1AF70-DCB1-4DD0-8725-454D8374EC16';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_8c11e4caa3f3,
    'SQLBaseType', p_SQLBaseType_8c11e4caa3f3,
    'SQLFullType', p_SQLFullType_8c11e4caa3f3,
    'IsNullable', p_IsNullable_8c11e4caa3f3,
    'ID', p_ID_8c11e4caa3f3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_8c11e4caa3f3, p_SQLBaseType := p_SQLBaseType_8c11e4caa3f3, p_SQLFullType := p_SQLFullType_8c11e4caa3f3, p_IsNullable := p_IsNullable_8c11e4caa3f3, p_ID := p_ID_8c11e4caa3f3);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_462a7f171ce8 INTEGER;
  p_SQLBaseType_462a7f171ce8 VARCHAR(50);
  p_SQLFullType_462a7f171ce8 VARCHAR(100);
  p_IsNullable_462a7f171ce8 BOOLEAN;
  p_ID_462a7f171ce8 UUID;
BEGIN
  p_Sequence_462a7f171ce8 := 16;
  p_SQLBaseType_462a7f171ce8 := 'int';
  p_SQLFullType_462a7f171ce8 := 'int';
  p_IsNullable_462a7f171ce8 := TRUE;
  p_ID_462a7f171ce8 := 'F06FF8DB-28D3-4C7C-9EF9-E8DA86FA42BB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_462a7f171ce8,
    'SQLBaseType', p_SQLBaseType_462a7f171ce8,
    'SQLFullType', p_SQLFullType_462a7f171ce8,
    'IsNullable', p_IsNullable_462a7f171ce8,
    'ID', p_ID_462a7f171ce8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_462a7f171ce8, p_SQLBaseType := p_SQLBaseType_462a7f171ce8, p_SQLFullType := p_SQLFullType_462a7f171ce8, p_IsNullable := p_IsNullable_462a7f171ce8, p_ID := p_ID_462a7f171ce8);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_9db4aa9c9917 UUID;
  p_QueryID_9db4aa9c9917 UUID;
  p_EntityID_9db4aa9c9917 UUID;
  p_DetectionMethod_9db4aa9c9917 VARCHAR(50);
  p_AutoDetectConfidenceScore_9db4aa9c9917 NUMERIC(3,2);
  p_AlternateBaseViewID_9db4aa9c9917 UUID;
BEGIN
  p_ID_9db4aa9c9917 := '32db6498-b50f-4863-8482-0ae037356cf2';
  p_QueryID_9db4aa9c9917 := '5A1E5000-0001-4000-A000-000000000009';
  p_EntityID_9db4aa9c9917 := '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F';
  p_DetectionMethod_9db4aa9c9917 := 'Parser';
  p_AutoDetectConfidenceScore_9db4aa9c9917 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_9db4aa9c9917
                    OR ("QueryID" = p_QueryID_9db4aa9c9917 AND "EntityID" = p_EntityID_9db4aa9c9917)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_9db4aa9c9917,
    'QueryID', p_QueryID_9db4aa9c9917,
    'EntityID', p_EntityID_9db4aa9c9917,
    'DetectionMethod', p_DetectionMethod_9db4aa9c9917,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_9db4aa9c9917,
    'AlternateBaseViewID', p_AlternateBaseViewID_9db4aa9c9917
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_9db4aa9c9917, p_QueryID := p_QueryID_9db4aa9c9917, p_EntityID := p_EntityID_9db4aa9c9917, p_DetectionMethod := p_DetectionMethod_9db4aa9c9917, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_9db4aa9c9917, p_AlternateBaseViewID := p_AlternateBaseViewID_9db4aa9c9917, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_SQL_2e889650e48e TEXT;
  p_ExtractedSQLHash_2e889650e48e VARCHAR(64);
  p_ExtractionStatus_2e889650e48e VARCHAR(20);
  p_ID_2e889650e48e UUID;
BEGIN
  p_SQL_2e889650e48e := '-- Forecast by category — commit, best case, pipeline. Master plan §9.3, measure 3.
--
-- THE THREE BUCKETS ARE FLAGS, AND THAT IS THE WHOLE POINT OF THIS QUERY.
-- ForecastCategoryType carries IncludeInCommit / IncludeInBestCase / IncludeInPipeline, and §9.3 says
-- "never a string comparison" in as many words. A deployment can rename "Commit" to "Committed" or
-- add a fourth category; nothing here changes.
--
-- THEY ARE NOT MUTUALLY EXCLUSIVE, AND MUST NOT BE READ AS IF THEY WERE. One category can set more
-- than one flag — a Commit category almost always also counts toward best case and toward pipeline,
-- because commit is the floor of the forecast rather than a slice of it. So CommitAmount,
-- BestCaseAmount and PipelineAmount are three OVERLAPPING answers to three different questions, and
-- adding them together produces a number that means nothing. The columns are separate SUMs for
-- exactly that reason.
--
-- DATE DIMENSION: ExpectedCloseDate — a forecast is about the period a deal is expected to land in.
--
-- PIPELINES FLAGGED OUT OF THE FORECAST. Pipeline.IncludeInForecast = 0 drops that pipeline''s OPEN
-- deals from every bucket; its won deals still count toward ClosedWonAmount. This is the query the
-- daily ForecastSnapshot job reads, so the snapshot history inherits the same rule.
--
-- CLOSED IS REPORTED ALONGSIDE, NOT MIXED IN. ClosedAmount sums won deals in the same period, using
-- ActualCloseDate, so a forecast review can see attainment against the same window without a second
-- query. It is a different date column on purpose and is labelled as such.
SELECT
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    SUM(CASE WHEN fc.IncludeInCommit    = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS CommitAmount,
    SUM(CASE WHEN fc.IncludeInBestCase  = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS BestCaseAmount,
    SUM(CASE WHEN fc.IncludeInPipeline  = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS PipelineAmount,
    SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)                                AS ClosedWonAmount,
    SUM(CASE WHEN fc.IncludeInCommit    = 1 AND st.IsOpen = 1 THEN 1 ELSE 0 END)                   AS CommitDealCount,
    SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)                                                 AS OpenDealCount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.ForecastCategoryTypeID IS NULL THEN 1 ELSE 0 END)            AS UncategorizedOpenCount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
        ON fc.ID = d.ForecastCategoryTypeID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% else %}
  -- A pipeline flagged out of the forecast keeps its WON deals here (they are attainment) and loses
  -- its open ones (they are not the current book). Asking for the pipeline by ID includes it.
  AND (st.IsOpen = 0 OR p.IncludeInForecast = 1)
  {% endif %}
  -- Open deals are placed by EXPECTED close; won deals by ACTUAL close. Same window, and each row
  -- uses the date that actually answers its question.
  {% if PeriodStart %}
  AND (
        (st.IsOpen = 1 AND d.ExpectedCloseDate >= {{ PeriodStart | sqlString }})
     OR (st.IsWon  = 1 AND d.ActualCloseDate   >= {{ PeriodStart | sqlString }})
      )
  {% endif %}
  {% if PeriodEnd %}
  AND (
        (st.IsOpen = 1 AND d.ExpectedCloseDate <= {{ PeriodEnd | sqlString }})
     OR (st.IsWon  = 1 AND d.ActualCloseDate   <= {{ PeriodEnd | sqlString }})
      )
  {% endif %}
GROUP BY
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline
ORDER BY
    d.Company, d.Pipeline;
';
  p_ExtractedSQLHash_2e889650e48e := 'e794dac3241e87d57e6b39ee7c600dd2026803feab23657476c8428ae17d0996';
  p_ExtractionStatus_2e889650e48e := 'OK';
  p_ID_2e889650e48e := '5A1E5000-0001-4000-A000-000000000002';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'SQL', p_SQL_2e889650e48e,
    'ExtractedSQLHash', p_ExtractedSQLHash_2e889650e48e,
    'ExtractionStatus', p_ExtractionStatus_2e889650e48e,
    'ID', p_ID_2e889650e48e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_SQL := p_SQL_2e889650e48e, p_ExtractedSQLHash := p_ExtractedSQLHash_2e889650e48e, p_ExtractionStatus := p_ExtractionStatus_2e889650e48e, p_ID := p_ID_2e889650e48e);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_542a32705400 UUID;
  p_IsNullable_542a32705400 BOOLEAN;
  p_ID_542a32705400 UUID;
BEGIN
  p_SourceEntityFieldID_542a32705400 := 'A4B19A26-071E-4BA8-8ADD-43317EF70061';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_542a32705400 := FALSE;
  p_ID_542a32705400 := '471DB305-FF2B-40B2-819C-76D2F11E413A';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_542a32705400 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_542a32705400
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_542a32705400 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_542a32705400));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_542a32705400,
    'IsNullable', p_IsNullable_542a32705400,
    'ID', p_ID_542a32705400
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_542a32705400, p_IsNullable := p_IsNullable_542a32705400, p_ID := p_ID_542a32705400);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_a110261e9228 UUID;
  p_IsNullable_a110261e9228 BOOLEAN;
  p_ID_a110261e9228 UUID;
BEGIN
  p_SourceEntityFieldID_a110261e9228 := '79A3E2FC-768E-4219-A16A-A70E3330605E';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_a110261e9228 := FALSE;
  p_ID_a110261e9228 := 'DDD3A48D-9CBB-49E7-8646-CBDBFA8DC136';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_a110261e9228 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_a110261e9228
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_a110261e9228 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_a110261e9228));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_a110261e9228,
    'IsNullable', p_IsNullable_a110261e9228,
    'ID', p_ID_a110261e9228
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_a110261e9228, p_IsNullable := p_IsNullable_a110261e9228, p_ID := p_ID_a110261e9228);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_758f475a8267 UUID;
  p_IsNullable_758f475a8267 BOOLEAN;
  p_ID_758f475a8267 UUID;
BEGIN
  p_SourceEntityFieldID_758f475a8267 := '35BA5F17-3D6F-473D-AC3B-6B0FC38F7312';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_758f475a8267 := FALSE;
  p_ID_758f475a8267 := '583C8FB5-0B9A-4427-B22C-288EF16755A0';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_758f475a8267 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_758f475a8267
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_758f475a8267 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_758f475a8267));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_758f475a8267,
    'IsNullable', p_IsNullable_758f475a8267,
    'ID', p_ID_758f475a8267
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_758f475a8267, p_IsNullable := p_IsNullable_758f475a8267, p_ID := p_ID_758f475a8267);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_21c119548209 UUID;
  p_IsNullable_21c119548209 BOOLEAN;
  p_ID_21c119548209 UUID;
BEGIN
  p_SourceEntityFieldID_21c119548209 := '2AA2DC76-847E-452C-B01C-8CC4082921B2';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_21c119548209 := FALSE;
  p_ID_21c119548209 := 'F22559DC-0622-4FD2-8C8A-A634D1D5C076';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_21c119548209 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_21c119548209
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_21c119548209 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_21c119548209));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_21c119548209,
    'IsNullable', p_IsNullable_21c119548209,
    'ID', p_ID_21c119548209
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_21c119548209, p_IsNullable := p_IsNullable_21c119548209, p_ID := p_ID_21c119548209);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_c0c1181f67ad VARCHAR(50);
  p_SQLFullType_c0c1181f67ad VARCHAR(100);
  p_IsNullable_c0c1181f67ad BOOLEAN;
  p_ID_c0c1181f67ad UUID;
BEGIN
  p_SQLBaseType_c0c1181f67ad := 'decimal';
  p_SQLFullType_c0c1181f67ad := 'decimal(38,4)';
  p_IsNullable_c0c1181f67ad := TRUE;
  p_ID_c0c1181f67ad := '3D4CD343-5815-4C8B-8456-3A4F98E7AD04';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_c0c1181f67ad,
    'SQLFullType', p_SQLFullType_c0c1181f67ad,
    'IsNullable', p_IsNullable_c0c1181f67ad,
    'ID', p_ID_c0c1181f67ad
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_c0c1181f67ad, p_SQLFullType := p_SQLFullType_c0c1181f67ad, p_IsNullable := p_IsNullable_c0c1181f67ad, p_ID := p_ID_c0c1181f67ad);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_7f5e003fb6b0 VARCHAR(50);
  p_SQLFullType_7f5e003fb6b0 VARCHAR(100);
  p_IsNullable_7f5e003fb6b0 BOOLEAN;
  p_ID_7f5e003fb6b0 UUID;
BEGIN
  p_SQLBaseType_7f5e003fb6b0 := 'decimal';
  p_SQLFullType_7f5e003fb6b0 := 'decimal(38,4)';
  p_IsNullable_7f5e003fb6b0 := TRUE;
  p_ID_7f5e003fb6b0 := '74B19868-5CA4-4442-82D6-8C91E1F28061';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_7f5e003fb6b0,
    'SQLFullType', p_SQLFullType_7f5e003fb6b0,
    'IsNullable', p_IsNullable_7f5e003fb6b0,
    'ID', p_ID_7f5e003fb6b0
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_7f5e003fb6b0, p_SQLFullType := p_SQLFullType_7f5e003fb6b0, p_IsNullable := p_IsNullable_7f5e003fb6b0, p_ID := p_ID_7f5e003fb6b0);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_a9e3cbe5676e VARCHAR(50);
  p_SQLFullType_a9e3cbe5676e VARCHAR(100);
  p_IsNullable_a9e3cbe5676e BOOLEAN;
  p_ID_a9e3cbe5676e UUID;
BEGIN
  p_SQLBaseType_a9e3cbe5676e := 'decimal';
  p_SQLFullType_a9e3cbe5676e := 'decimal(38,4)';
  p_IsNullable_a9e3cbe5676e := TRUE;
  p_ID_a9e3cbe5676e := 'EB7E8AE0-BD0E-44A4-B575-8D93A5897EF4';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_a9e3cbe5676e,
    'SQLFullType', p_SQLFullType_a9e3cbe5676e,
    'IsNullable', p_IsNullable_a9e3cbe5676e,
    'ID', p_ID_a9e3cbe5676e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_a9e3cbe5676e, p_SQLFullType := p_SQLFullType_a9e3cbe5676e, p_IsNullable := p_IsNullable_a9e3cbe5676e, p_ID := p_ID_a9e3cbe5676e);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_f23320835589 VARCHAR(50);
  p_SQLFullType_f23320835589 VARCHAR(100);
  p_IsNullable_f23320835589 BOOLEAN;
  p_ID_f23320835589 UUID;
BEGIN
  p_SQLBaseType_f23320835589 := 'decimal';
  p_SQLFullType_f23320835589 := 'decimal(38,4)';
  p_IsNullable_f23320835589 := TRUE;
  p_ID_f23320835589 := '47E88E19-4236-4968-9A5D-2AFAFD8EF5DF';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_f23320835589,
    'SQLFullType', p_SQLFullType_f23320835589,
    'IsNullable', p_IsNullable_f23320835589,
    'ID', p_ID_f23320835589
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_f23320835589, p_SQLFullType := p_SQLFullType_f23320835589, p_IsNullable := p_IsNullable_f23320835589, p_ID := p_ID_f23320835589);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_d61c578717ef VARCHAR(50);
  p_SQLFullType_d61c578717ef VARCHAR(100);
  p_IsNullable_d61c578717ef BOOLEAN;
  p_ID_d61c578717ef UUID;
BEGIN
  p_SQLBaseType_d61c578717ef := 'int';
  p_SQLFullType_d61c578717ef := 'int';
  p_IsNullable_d61c578717ef := TRUE;
  p_ID_d61c578717ef := '5D1A9162-C433-4092-B84F-3CA616136808';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_d61c578717ef,
    'SQLFullType', p_SQLFullType_d61c578717ef,
    'IsNullable', p_IsNullable_d61c578717ef,
    'ID', p_ID_d61c578717ef
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_d61c578717ef, p_SQLFullType := p_SQLFullType_d61c578717ef, p_IsNullable := p_IsNullable_d61c578717ef, p_ID := p_ID_d61c578717ef);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_406124256fc1 VARCHAR(50);
  p_SQLFullType_406124256fc1 VARCHAR(100);
  p_IsNullable_406124256fc1 BOOLEAN;
  p_ID_406124256fc1 UUID;
BEGIN
  p_SQLBaseType_406124256fc1 := 'int';
  p_SQLFullType_406124256fc1 := 'int';
  p_IsNullable_406124256fc1 := TRUE;
  p_ID_406124256fc1 := 'F93BB663-0510-45D9-B88F-F78A0E363954';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_406124256fc1,
    'SQLFullType', p_SQLFullType_406124256fc1,
    'IsNullable', p_IsNullable_406124256fc1,
    'ID', p_ID_406124256fc1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_406124256fc1, p_SQLFullType := p_SQLFullType_406124256fc1, p_IsNullable := p_IsNullable_406124256fc1, p_ID := p_ID_406124256fc1);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_862ec20381dd VARCHAR(50);
  p_SQLFullType_862ec20381dd VARCHAR(100);
  p_IsNullable_862ec20381dd BOOLEAN;
  p_ID_862ec20381dd UUID;
BEGIN
  p_SQLBaseType_862ec20381dd := 'int';
  p_SQLFullType_862ec20381dd := 'int';
  p_IsNullable_862ec20381dd := TRUE;
  p_ID_862ec20381dd := 'FB8BEEA7-170D-4596-90B8-FC1CF969649F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_862ec20381dd,
    'SQLFullType', p_SQLFullType_862ec20381dd,
    'IsNullable', p_IsNullable_862ec20381dd,
    'ID', p_ID_862ec20381dd
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_862ec20381dd, p_SQLFullType := p_SQLFullType_862ec20381dd, p_IsNullable := p_IsNullable_862ec20381dd, p_ID := p_ID_862ec20381dd);
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_SQL_4502e037ceee TEXT;
  p_ExtractedSQLHash_4502e037ceee VARCHAR(64);
  p_ExtractionStatus_4502e037ceee VARCHAR(20);
  p_ID_4502e037ceee UUID;
BEGIN
  p_SQL_4502e037ceee := '-- Forecast by category, AT OWNER GRAIN. The live companion to `forecast-history.sql`.
--
-- ══ WHY THIS EXISTS AS A COMPANION RATHER THAN AS A CHANGE TO THE OTHER QUERY ═══════════════════
--
-- `forecast-by-category.sql` groups by company and pipeline. `forecast-history.sql` partitions its
-- LAG windows by `OwnerEmployeeID` and joins Employee for an owner name — it is built expecting owner
-- grain, and `capture-forecast-snapshot.sql` writes rows at that grain. So the history report is
-- already owner-shaped while nothing reports the LIVE forecast the same way, and a forecast review
-- that asks "whose commit moved" has a history to read and no current number to compare it against.
--
-- Adding an owner column to the existing query would have been the smaller diff and the wrong change:
-- the dashboard consumes it, and widening a report''s GROUP BY changes its row shape for every
-- consumer. One report gaining a dimension should not be another report''s regression.
--
-- Same measures, same flags, same date handling as `forecast-by-category.sql`. Only the grain differs.
--
-- ══ §9.4 ATTRIBUTION BASIS: THE OWNER STAMP. EACH DEAL COUNTED EXACTLY ONCE. ════════════════════
--
-- This groups by `Deal.OwnerEmployeeID`, the server-maintained stamp, NOT by joining
-- `DealTeamMember`. Both halves of that matter:
--
--   ONE ROW PER DEAL. Joining the team table would multiply every deal by its team size — the seeded
--   won deal has three members, so its 27,480 would land in three owners'' commit figures and the
--   company total would read 82,440. That is §9.4''s double-count arriving through a forecast rather
--   than through a bookings report, and a forecast is where it would be least likely to be noticed,
--   because nobody reconciles a forecast to the penny.
--
--   IT MATCHES THE SNAPSHOT. `capture-forecast-snapshot.sql` groups by the same stamp for the same
--   reason, so this query and the history it is compared against slice the world identically. A live
--   report and its own history disagreeing about what an owner''s commit is would be worse than having
--   no live report at all.
--
-- WHY THE STAMP IS SAFE HERE WHEN `bookings-by-owner.sql` DELIBERATELY AVOIDS IT. That query is a
-- reconciling revenue figure, so it reads `DealTeamMember` filtered to `DealRole.IsOwnerRole` —
-- CLAUDE.md makes the team table the source of truth for membership, and a bookings number must not
-- depend on a denormalised copy. This is a forecast SLICE: it groups deals BY an owner, it does not
-- attribute revenue TO one, and the stamp is derived from that same owner-role row on every save. If
-- the two ever disagree, the stamp is the bug and the team table is right — but the answer here would
-- still be a grouping, not a misstated total.
--
-- ══ ADDITIVITY ACROSS ROWS ═════════════════════════════════════════════════════════════════════
--
--   ADDITIVE      CommitAmount, BestCaseAmount, PipelineAmount, ClosedWonAmount, and every count.
--                 One deal, one row, so totalling any of them returns the company figure.
--   NOT ADDITIVE  The three forecast buckets ACROSS EACH OTHER — they overlap by design, since a
--                 commit category normally also counts toward best case and pipeline. Summing
--                 Commit + BestCase + Pipeline is meaningless in any grouping.
--
-- DATE DIMENSION: open deals placed by ExpectedCloseDate, won deals by ActualCloseDate — the same
-- split `forecast-by-category.sql` uses, because each answers a different question.
SELECT
    d.OwnerEmployeeID,
    -- An unowned deal is a real state, not a row to drop: it is forecast nobody is accountable for,
    -- which is exactly what a forecast review should see.
    ISNULL(emp.FirstName + '' '' + emp.LastName, ''(unassigned)'') AS OwnerName,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    ISNULL(cur.Code, N''USD'')                    AS CurrencyCode,
    SUM(CASE WHEN fc.IncludeInCommit    = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS CommitAmount,
    SUM(CASE WHEN fc.IncludeInBestCase  = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS BestCaseAmount,
    SUM(CASE WHEN fc.IncludeInPipeline  = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS PipelineAmount,
    SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)                                AS ClosedWonAmount,
    SUM(CASE WHEN fc.IncludeInCommit    = 1 AND st.IsOpen = 1 THEN 1 ELSE 0 END)                   AS CommitDealCount,
    SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)                                                 AS OpenDealCount,
    SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END)                                                 AS WonDealCount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.ForecastCategoryTypeID IS NULL THEN 1 ELSE 0 END)            AS UncategorizedOpenCount,
    -- Provenance, at the grain a forecast review actually argues about. A commit figure nobody priced
    -- is a different kind of claim from one the orders engine produced, and this is the report where
    -- somebody is asked to stand behind the number.
    SUM(CASE WHEN st.IsOpen = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END)    AS OpenStatedAmount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
        ON fc.ID = d.ForecastCategoryTypeID
LEFT OUTER JOIN [${mjSchema}].Employee emp
        ON emp.ID = d.OwnerEmployeeID
LEFT OUTER JOIN [__mj_BizAppsAccounting].Currency cur
        ON cur.ID = d.CurrencyID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% else %}
  -- A pipeline flagged out of the forecast keeps its WON deals here (they are attainment) and loses
  -- its open ones (they are not the current book). Asking for the pipeline by ID includes it.
  AND (st.IsOpen = 0 OR p.IncludeInForecast = 1)
  {% endif %}
  {% if OwnerEmployeeID %}
  AND d.OwnerEmployeeID = {{ OwnerEmployeeID | sqlString }}
  {% endif %}
  {% if PeriodStart %}
  AND (
        (st.IsOpen = 1 AND d.ExpectedCloseDate >= {{ PeriodStart | sqlString }})
     OR (st.IsWon  = 1 AND d.ActualCloseDate   >= {{ PeriodStart | sqlString }})
      )
  {% endif %}
  {% if PeriodEnd %}
  AND (
        (st.IsOpen = 1 AND d.ExpectedCloseDate <= {{ PeriodEnd | sqlString }})
     OR (st.IsWon  = 1 AND d.ActualCloseDate   <= {{ PeriodEnd | sqlString }})
      )
  {% endif %}
GROUP BY
    d.OwnerEmployeeID, emp.FirstName, emp.LastName,
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline,
    ISNULL(cur.Code, N''USD'')
ORDER BY
    CommitAmount DESC, OwnerName, CurrencyCode;
';
  p_ExtractedSQLHash_4502e037ceee := '12f8f864b639682c9986e3c103833c0f6a1e011e0cb2ab0d7f563b3b89c3e19b';
  p_ExtractionStatus_4502e037ceee := 'OK';
  p_ID_4502e037ceee := '5A1E5000-0001-4000-A000-00000000000F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'SQL', p_SQL_4502e037ceee,
    'ExtractedSQLHash', p_ExtractedSQLHash_4502e037ceee,
    'ExtractionStatus', p_ExtractionStatus_4502e037ceee,
    'ID', p_ID_4502e037ceee
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_SQL := p_SQL_4502e037ceee, p_ExtractedSQLHash := p_ExtractedSQLHash_4502e037ceee, p_ExtractionStatus := p_ExtractionStatus_4502e037ceee, p_ID := p_ID_4502e037ceee);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_82bb3b93350c UUID;
  p_IsNullable_82bb3b93350c BOOLEAN;
  p_ID_82bb3b93350c UUID;
BEGIN
  p_SourceEntityFieldID_82bb3b93350c := 'C9F4CB38-D4FA-4C5B-9CF0-EBA5571AB52D';
  p_IsNullable_82bb3b93350c := TRUE;
  p_ID_82bb3b93350c := '0C317E29-5D9F-438F-9701-D717B8372505';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_82bb3b93350c := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_82bb3b93350c
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_82bb3b93350c THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_82bb3b93350c));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_82bb3b93350c,
    'IsNullable', p_IsNullable_82bb3b93350c,
    'ID', p_ID_82bb3b93350c
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_82bb3b93350c, p_IsNullable := p_IsNullable_82bb3b93350c, p_ID := p_ID_82bb3b93350c);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLFullType_63c867a35720 VARCHAR(100);
  p_IsNullable_63c867a35720 BOOLEAN;
  p_ID_63c867a35720 UUID;
BEGIN
  p_SQLFullType_63c867a35720 := 'nvarchar(81)';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_63c867a35720 := FALSE;
  p_ID_63c867a35720 := '086D4657-5CEC-4331-8CA9-795827831780';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLFullType', p_SQLFullType_63c867a35720,
    'IsNullable', p_IsNullable_63c867a35720,
    'ID', p_ID_63c867a35720
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLFullType := p_SQLFullType_63c867a35720, p_IsNullable := p_IsNullable_63c867a35720, p_ID := p_ID_63c867a35720);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_fd3d418d3ce1 UUID;
  p_IsNullable_fd3d418d3ce1 BOOLEAN;
  p_ID_fd3d418d3ce1 UUID;
BEGIN
  p_SourceEntityFieldID_fd3d418d3ce1 := 'A4B19A26-071E-4BA8-8ADD-43317EF70061';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_fd3d418d3ce1 := FALSE;
  p_ID_fd3d418d3ce1 := '77BE9D4A-DFD2-4DE7-BFB9-DAD7BDE9E7CC';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_fd3d418d3ce1 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_fd3d418d3ce1
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_fd3d418d3ce1 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_fd3d418d3ce1));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_fd3d418d3ce1,
    'IsNullable', p_IsNullable_fd3d418d3ce1,
    'ID', p_ID_fd3d418d3ce1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_fd3d418d3ce1, p_IsNullable := p_IsNullable_fd3d418d3ce1, p_ID := p_ID_fd3d418d3ce1);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_f530e09fb704 UUID;
  p_IsNullable_f530e09fb704 BOOLEAN;
  p_ID_f530e09fb704 UUID;
BEGIN
  p_SourceEntityFieldID_f530e09fb704 := '79A3E2FC-768E-4219-A16A-A70E3330605E';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_f530e09fb704 := FALSE;
  p_ID_f530e09fb704 := '00AA6EB1-894F-424C-B4A1-80266B0439EA';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_f530e09fb704 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_f530e09fb704
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_f530e09fb704 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_f530e09fb704));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_f530e09fb704,
    'IsNullable', p_IsNullable_f530e09fb704,
    'ID', p_ID_f530e09fb704
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_f530e09fb704, p_IsNullable := p_IsNullable_f530e09fb704, p_ID := p_ID_f530e09fb704);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_5c5b03179651 UUID;
  p_IsNullable_5c5b03179651 BOOLEAN;
  p_ID_5c5b03179651 UUID;
BEGIN
  p_SourceEntityFieldID_5c5b03179651 := '35BA5F17-3D6F-473D-AC3B-6B0FC38F7312';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_5c5b03179651 := FALSE;
  p_ID_5c5b03179651 := '291C89B0-C226-448C-87A5-B67D23777673';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_5c5b03179651 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_5c5b03179651
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_5c5b03179651 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_5c5b03179651));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_5c5b03179651,
    'IsNullable', p_IsNullable_5c5b03179651,
    'ID', p_ID_5c5b03179651
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_5c5b03179651, p_IsNullable := p_IsNullable_5c5b03179651, p_ID := p_ID_5c5b03179651);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_c3981c7f7b64 UUID;
  p_IsNullable_c3981c7f7b64 BOOLEAN;
  p_ID_c3981c7f7b64 UUID;
BEGIN
  p_SourceEntityFieldID_c3981c7f7b64 := '2AA2DC76-847E-452C-B01C-8CC4082921B2';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_c3981c7f7b64 := FALSE;
  p_ID_c3981c7f7b64 := '48EDC69C-16F1-4828-A606-E965FA24DF30';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_c3981c7f7b64 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_c3981c7f7b64
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_c3981c7f7b64 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_c3981c7f7b64));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_c3981c7f7b64,
    'IsNullable', p_IsNullable_c3981c7f7b64,
    'ID', p_ID_c3981c7f7b64
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_c3981c7f7b64, p_IsNullable := p_IsNullable_c3981c7f7b64, p_ID := p_ID_c3981c7f7b64);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_6a17e9408b41 UUID;
  p_QueryID_6a17e9408b41 UUID;
  p_Name_6a17e9408b41 VARCHAR(255);
  p_Description_6a17e9408b41 TEXT;
  p_Sequence_6a17e9408b41 INTEGER;
  p_SQLBaseType_6a17e9408b41 VARCHAR(50);
  p_SQLFullType_6a17e9408b41 VARCHAR(100);
  p_SourceEntityID_6a17e9408b41 UUID;
  p_SourceFieldName_6a17e9408b41 VARCHAR(255);
  p_IsComputed_6a17e9408b41 BOOLEAN;
  p_ComputationDescription_6a17e9408b41 TEXT;
  p_IsSummary_6a17e9408b41 BOOLEAN;
  p_SummaryDescription_6a17e9408b41 TEXT;
  p_DetectionMethod_6a17e9408b41 VARCHAR(50);
  p_AutoDetectConfidenceScore_6a17e9408b41 NUMERIC(3,2);
  p_SourceEntityFieldID_6a17e9408b41 UUID;
  p_IsNullable_6a17e9408b41 BOOLEAN;
  p_SourceObjectName_6a17e9408b41 VARCHAR(500);
BEGIN
  p_ID_6a17e9408b41 := '6db0cbb1-7b2f-4550-85c8-c83b0b047a84';
  p_QueryID_6a17e9408b41 := '5A1E5000-0001-4000-A000-00000000000F';
  p_Name_6a17e9408b41 := 'CurrencyCode';
  p_Sequence_6a17e9408b41 := 7;
  p_SQLBaseType_6a17e9408b41 := 'char';
  p_SQLFullType_6a17e9408b41 := 'char(3)';
  p_IsComputed_6a17e9408b41 := TRUE;
  p_IsSummary_6a17e9408b41 := FALSE;
  p_DetectionMethod_6a17e9408b41 := 'Database';
  p_IsNullable_6a17e9408b41 := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_6a17e9408b41
                    OR ("QueryID" = p_QueryID_6a17e9408b41 AND "Name" = p_Name_6a17e9408b41)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_6a17e9408b41,
    'QueryID', p_QueryID_6a17e9408b41,
    'Name', p_Name_6a17e9408b41,
    'Description', p_Description_6a17e9408b41,
    'Sequence', p_Sequence_6a17e9408b41,
    'SQLBaseType', p_SQLBaseType_6a17e9408b41,
    'SQLFullType', p_SQLFullType_6a17e9408b41,
    'SourceEntityID', p_SourceEntityID_6a17e9408b41,
    'SourceFieldName', p_SourceFieldName_6a17e9408b41,
    'IsComputed', p_IsComputed_6a17e9408b41,
    'ComputationDescription', p_ComputationDescription_6a17e9408b41,
    'IsSummary', p_IsSummary_6a17e9408b41,
    'SummaryDescription', p_SummaryDescription_6a17e9408b41,
    'DetectionMethod', p_DetectionMethod_6a17e9408b41,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_6a17e9408b41,
    'SourceEntityFieldID', p_SourceEntityFieldID_6a17e9408b41,
    'IsNullable', p_IsNullable_6a17e9408b41,
    'SourceObjectName', p_SourceObjectName_6a17e9408b41
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_6a17e9408b41, p_QueryID := p_QueryID_6a17e9408b41, p_Name := p_Name_6a17e9408b41, p_Description := p_Description_6a17e9408b41, p_Description_Clear := TRUE, p_Sequence := p_Sequence_6a17e9408b41, p_SQLBaseType := p_SQLBaseType_6a17e9408b41, p_SQLFullType := p_SQLFullType_6a17e9408b41, p_SourceEntityID := p_SourceEntityID_6a17e9408b41, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_6a17e9408b41, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_6a17e9408b41, p_ComputationDescription := p_ComputationDescription_6a17e9408b41, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_6a17e9408b41, p_SummaryDescription := p_SummaryDescription_6a17e9408b41, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_6a17e9408b41, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_6a17e9408b41, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_6a17e9408b41, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_6a17e9408b41, p_SourceObjectName := p_SourceObjectName_6a17e9408b41, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_50eb1be87d5c INTEGER;
  p_SQLBaseType_50eb1be87d5c VARCHAR(50);
  p_SQLFullType_50eb1be87d5c VARCHAR(100);
  p_IsNullable_50eb1be87d5c BOOLEAN;
  p_ID_50eb1be87d5c UUID;
BEGIN
  p_Sequence_50eb1be87d5c := 8;
  p_SQLBaseType_50eb1be87d5c := 'decimal';
  p_SQLFullType_50eb1be87d5c := 'decimal(38,4)';
  p_IsNullable_50eb1be87d5c := TRUE;
  p_ID_50eb1be87d5c := '63014A48-9589-49EC-A033-37EC382C2030';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_50eb1be87d5c,
    'SQLBaseType', p_SQLBaseType_50eb1be87d5c,
    'SQLFullType', p_SQLFullType_50eb1be87d5c,
    'IsNullable', p_IsNullable_50eb1be87d5c,
    'ID', p_ID_50eb1be87d5c
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_50eb1be87d5c, p_SQLBaseType := p_SQLBaseType_50eb1be87d5c, p_SQLFullType := p_SQLFullType_50eb1be87d5c, p_IsNullable := p_IsNullable_50eb1be87d5c, p_ID := p_ID_50eb1be87d5c);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_7b39ed428140 INTEGER;
  p_SQLBaseType_7b39ed428140 VARCHAR(50);
  p_SQLFullType_7b39ed428140 VARCHAR(100);
  p_IsNullable_7b39ed428140 BOOLEAN;
  p_ID_7b39ed428140 UUID;
BEGIN
  p_Sequence_7b39ed428140 := 9;
  p_SQLBaseType_7b39ed428140 := 'decimal';
  p_SQLFullType_7b39ed428140 := 'decimal(38,4)';
  p_IsNullable_7b39ed428140 := TRUE;
  p_ID_7b39ed428140 := 'B3A8679D-5988-4EA9-97E6-954666AD691A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_7b39ed428140,
    'SQLBaseType', p_SQLBaseType_7b39ed428140,
    'SQLFullType', p_SQLFullType_7b39ed428140,
    'IsNullable', p_IsNullable_7b39ed428140,
    'ID', p_ID_7b39ed428140
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_7b39ed428140, p_SQLBaseType := p_SQLBaseType_7b39ed428140, p_SQLFullType := p_SQLFullType_7b39ed428140, p_IsNullable := p_IsNullable_7b39ed428140, p_ID := p_ID_7b39ed428140);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_95f63ef95083 INTEGER;
  p_SQLBaseType_95f63ef95083 VARCHAR(50);
  p_SQLFullType_95f63ef95083 VARCHAR(100);
  p_IsNullable_95f63ef95083 BOOLEAN;
  p_ID_95f63ef95083 UUID;
BEGIN
  p_Sequence_95f63ef95083 := 10;
  p_SQLBaseType_95f63ef95083 := 'decimal';
  p_SQLFullType_95f63ef95083 := 'decimal(38,4)';
  p_IsNullable_95f63ef95083 := TRUE;
  p_ID_95f63ef95083 := '5F1CAEE2-4ACB-4276-8133-AD6541EA3DCE';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_95f63ef95083,
    'SQLBaseType', p_SQLBaseType_95f63ef95083,
    'SQLFullType', p_SQLFullType_95f63ef95083,
    'IsNullable', p_IsNullable_95f63ef95083,
    'ID', p_ID_95f63ef95083
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_95f63ef95083, p_SQLBaseType := p_SQLBaseType_95f63ef95083, p_SQLFullType := p_SQLFullType_95f63ef95083, p_IsNullable := p_IsNullable_95f63ef95083, p_ID := p_ID_95f63ef95083);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_145b1b66401f INTEGER;
  p_SQLBaseType_145b1b66401f VARCHAR(50);
  p_SQLFullType_145b1b66401f VARCHAR(100);
  p_IsNullable_145b1b66401f BOOLEAN;
  p_ID_145b1b66401f UUID;
BEGIN
  p_Sequence_145b1b66401f := 11;
  p_SQLBaseType_145b1b66401f := 'decimal';
  p_SQLFullType_145b1b66401f := 'decimal(38,4)';
  p_IsNullable_145b1b66401f := TRUE;
  p_ID_145b1b66401f := '9904ED81-E48E-4577-84AF-883029BCBC6B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_145b1b66401f,
    'SQLBaseType', p_SQLBaseType_145b1b66401f,
    'SQLFullType', p_SQLFullType_145b1b66401f,
    'IsNullable', p_IsNullable_145b1b66401f,
    'ID', p_ID_145b1b66401f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_145b1b66401f, p_SQLBaseType := p_SQLBaseType_145b1b66401f, p_SQLFullType := p_SQLFullType_145b1b66401f, p_IsNullable := p_IsNullable_145b1b66401f, p_ID := p_ID_145b1b66401f);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_65c27d415b62 INTEGER;
  p_SQLBaseType_65c27d415b62 VARCHAR(50);
  p_SQLFullType_65c27d415b62 VARCHAR(100);
  p_IsNullable_65c27d415b62 BOOLEAN;
  p_ID_65c27d415b62 UUID;
BEGIN
  p_Sequence_65c27d415b62 := 12;
  p_SQLBaseType_65c27d415b62 := 'int';
  p_SQLFullType_65c27d415b62 := 'int';
  p_IsNullable_65c27d415b62 := TRUE;
  p_ID_65c27d415b62 := 'F8430409-D246-409A-AEFE-931DF52F94AF';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_65c27d415b62,
    'SQLBaseType', p_SQLBaseType_65c27d415b62,
    'SQLFullType', p_SQLFullType_65c27d415b62,
    'IsNullable', p_IsNullable_65c27d415b62,
    'ID', p_ID_65c27d415b62
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_65c27d415b62, p_SQLBaseType := p_SQLBaseType_65c27d415b62, p_SQLFullType := p_SQLFullType_65c27d415b62, p_IsNullable := p_IsNullable_65c27d415b62, p_ID := p_ID_65c27d415b62);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_d8ddba41251b INTEGER;
  p_SQLBaseType_d8ddba41251b VARCHAR(50);
  p_SQLFullType_d8ddba41251b VARCHAR(100);
  p_IsNullable_d8ddba41251b BOOLEAN;
  p_ID_d8ddba41251b UUID;
BEGIN
  p_Sequence_d8ddba41251b := 13;
  p_SQLBaseType_d8ddba41251b := 'int';
  p_SQLFullType_d8ddba41251b := 'int';
  p_IsNullable_d8ddba41251b := TRUE;
  p_ID_d8ddba41251b := 'A54B0821-C036-43FC-BDE3-3D369436B24F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_d8ddba41251b,
    'SQLBaseType', p_SQLBaseType_d8ddba41251b,
    'SQLFullType', p_SQLFullType_d8ddba41251b,
    'IsNullable', p_IsNullable_d8ddba41251b,
    'ID', p_ID_d8ddba41251b
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_d8ddba41251b, p_SQLBaseType := p_SQLBaseType_d8ddba41251b, p_SQLFullType := p_SQLFullType_d8ddba41251b, p_IsNullable := p_IsNullable_d8ddba41251b, p_ID := p_ID_d8ddba41251b);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_28b068ea4ce8 INTEGER;
  p_SQLBaseType_28b068ea4ce8 VARCHAR(50);
  p_SQLFullType_28b068ea4ce8 VARCHAR(100);
  p_IsNullable_28b068ea4ce8 BOOLEAN;
  p_ID_28b068ea4ce8 UUID;
BEGIN
  p_Sequence_28b068ea4ce8 := 14;
  p_SQLBaseType_28b068ea4ce8 := 'int';
  p_SQLFullType_28b068ea4ce8 := 'int';
  p_IsNullable_28b068ea4ce8 := TRUE;
  p_ID_28b068ea4ce8 := '83606F8C-1C2E-4D0D-B9B4-C239A0775227';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_28b068ea4ce8,
    'SQLBaseType', p_SQLBaseType_28b068ea4ce8,
    'SQLFullType', p_SQLFullType_28b068ea4ce8,
    'IsNullable', p_IsNullable_28b068ea4ce8,
    'ID', p_ID_28b068ea4ce8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_28b068ea4ce8, p_SQLBaseType := p_SQLBaseType_28b068ea4ce8, p_SQLFullType := p_SQLFullType_28b068ea4ce8, p_IsNullable := p_IsNullable_28b068ea4ce8, p_ID := p_ID_28b068ea4ce8);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_860c5b30b8a5 INTEGER;
  p_SQLBaseType_860c5b30b8a5 VARCHAR(50);
  p_SQLFullType_860c5b30b8a5 VARCHAR(100);
  p_IsNullable_860c5b30b8a5 BOOLEAN;
  p_ID_860c5b30b8a5 UUID;
BEGIN
  p_Sequence_860c5b30b8a5 := 15;
  p_SQLBaseType_860c5b30b8a5 := 'int';
  p_SQLFullType_860c5b30b8a5 := 'int';
  p_IsNullable_860c5b30b8a5 := TRUE;
  p_ID_860c5b30b8a5 := '72B0F2E9-B1CB-4A5B-8FD8-951A7BC28DB4';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_860c5b30b8a5,
    'SQLBaseType', p_SQLBaseType_860c5b30b8a5,
    'SQLFullType', p_SQLFullType_860c5b30b8a5,
    'IsNullable', p_IsNullable_860c5b30b8a5,
    'ID', p_ID_860c5b30b8a5
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_860c5b30b8a5, p_SQLBaseType := p_SQLBaseType_860c5b30b8a5, p_SQLFullType := p_SQLFullType_860c5b30b8a5, p_IsNullable := p_IsNullable_860c5b30b8a5, p_ID := p_ID_860c5b30b8a5);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_fcd65e2e5140 INTEGER;
  p_SQLBaseType_fcd65e2e5140 VARCHAR(50);
  p_SQLFullType_fcd65e2e5140 VARCHAR(100);
  p_IsNullable_fcd65e2e5140 BOOLEAN;
  p_ID_fcd65e2e5140 UUID;
BEGIN
  p_Sequence_fcd65e2e5140 := 16;
  p_SQLBaseType_fcd65e2e5140 := 'decimal';
  p_SQLFullType_fcd65e2e5140 := 'decimal(38,4)';
  p_IsNullable_fcd65e2e5140 := TRUE;
  p_ID_fcd65e2e5140 := '0D357C7D-9676-4423-B450-0E14D2E771D6';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_fcd65e2e5140,
    'SQLBaseType', p_SQLBaseType_fcd65e2e5140,
    'SQLFullType', p_SQLFullType_fcd65e2e5140,
    'IsNullable', p_IsNullable_fcd65e2e5140,
    'ID', p_ID_fcd65e2e5140
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_fcd65e2e5140, p_SQLBaseType := p_SQLBaseType_fcd65e2e5140, p_SQLFullType := p_SQLFullType_fcd65e2e5140, p_IsNullable := p_IsNullable_fcd65e2e5140, p_ID := p_ID_fcd65e2e5140);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_501671da7f8a UUID;
  p_QueryID_501671da7f8a UUID;
  p_EntityID_501671da7f8a UUID;
  p_DetectionMethod_501671da7f8a VARCHAR(50);
  p_AutoDetectConfidenceScore_501671da7f8a NUMERIC(3,2);
  p_AlternateBaseViewID_501671da7f8a UUID;
BEGIN
  p_ID_501671da7f8a := '004c56bf-15dd-40d6-8ef3-cb162e0d84a9';
  p_QueryID_501671da7f8a := '5A1E5000-0001-4000-A000-00000000000F';
  p_EntityID_501671da7f8a := 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7';
  p_DetectionMethod_501671da7f8a := 'Parser';
  p_AutoDetectConfidenceScore_501671da7f8a := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_501671da7f8a
                    OR ("QueryID" = p_QueryID_501671da7f8a AND "EntityID" = p_EntityID_501671da7f8a)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_501671da7f8a,
    'QueryID', p_QueryID_501671da7f8a,
    'EntityID', p_EntityID_501671da7f8a,
    'DetectionMethod', p_DetectionMethod_501671da7f8a,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_501671da7f8a,
    'AlternateBaseViewID', p_AlternateBaseViewID_501671da7f8a
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_501671da7f8a, p_QueryID := p_QueryID_501671da7f8a, p_EntityID := p_EntityID_501671da7f8a, p_DetectionMethod := p_DetectionMethod_501671da7f8a, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_501671da7f8a, p_AlternateBaseViewID := p_AlternateBaseViewID_501671da7f8a, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_SQL_07772d8728d8 TEXT;
  p_ExtractedSQLHash_07772d8728d8 VARCHAR(64);
  p_ExtractionStatus_07772d8728d8 VARCHAR(20);
  p_ID_07772d8728d8 UUID;
BEGIN
  p_SQL_07772d8728d8 := '-- Win rate, BY COUNT AND BY VALUE. Master plan §9.3, measure 5.
--
-- BOTH, ALWAYS, AND NEVER ONE ALONE — which is why §9.3 names them together and why this query
-- refuses to pick. They diverge exactly when it matters: a team that wins nine small deals and loses
-- one large one has a 90% win rate by count and may be under 50% by value. Reporting either number
-- without the other is how a pipeline problem stays invisible for a quarter.
--
-- THE DENOMINATOR IS CLOSED DEALS ONLY (DealStatusType.IsClosed), because an open deal has not been
-- won or lost yet and including it would drag every rate toward zero as the pipeline grows. Won and
-- lost are read from IsWon / IsLost rather than from "not won", so a closed status that is neither —
-- if a deployment ever seeds one, such as "Closed - No Decision" — is visible as the gap between
-- ClosedCount and (WonCount + LostCount) instead of being silently counted as a loss.
--
-- DATE DIMENSION: ActualCloseDate. A win rate is about deals that closed in the window.
--
-- ── A MISSING CLOSE DATE IS EXCLUDED BY THE WINDOW, NOT BY A STANDING `IS NOT NULL` ─────────────
--
-- This WHERE used to open with an unconditional `d.ActualCloseDate IS NOT NULL`, which contradicted
-- the denominator stated three paragraphs up: a closed deal that never recorded its close date is
-- still a closed deal, and dropping it moved the rate without appearing in either count.
--
-- It also put this query out of step with the Won tile. `dashboard-summary.sql` counts every won
-- deal when no period is supplied, INCLUDING an undated one, so on "All time" the dashboard showed
-- a Won count next to an "N won / M closed" line computed over a different set, with nothing on
-- screen explaining the gap.
--
-- The guard is not needed for the bounded case either. A comparison against NULL is UNKNOWN, so a
-- row with no ActualCloseDate fails `>= PeriodStart` and `<= PeriodEnd` on its own -- the same
-- mechanism `dashboard-summary.sql` relies on inside its `WonCount` CASE. Both queries therefore
-- now read the same way: an undated win is outside every bounded window and inside the unbounded
-- one, so it is never invisible everywhere at once.
--
-- ── THE FILTER BAR (bc-aidp-next-golive#350) ────────────────────────────────────────────────────
--
-- CompanyIDs, OwnerEmployeeIDs, PipelineIDs and ProductCompanyIDs are lists, rendered with `sqlIn`,
-- and narrow the closed deals the rate is computed over, exactly as they narrow `Sales: Dashboard
-- Summary`, so the Win rate tile describes the same deals as the tiles beside it. The single-value
-- CompanyID and PipelineID still work. A list that is "All" is left out rather than sent empty, since
-- `sqlIn` renders an empty list as `(NULL)`, which matches nothing.
--
-- Product company matches a deal when at least one line of its order belongs to a selected company
-- (OrderLine.CompanyID). The deal counts once at its full amount; a deal with no lines cannot match.
--
-- NULLIF GUARDS BOTH RATES. A period with no closed deals returns NULL rather than dividing by zero,
-- and NULL is the honest answer: "no rate" is a different fact from "a rate of zero".
SELECT
    d.CompanyID,
    d.Company                                    AS CompanyName,
    d.PipelineID,
    d.Pipeline                                   AS PipelineName,
    d.DealTypeID,
    d.DealType                                   AS DealTypeName,
    ISNULL(cur.Code, N''USD'')                     AS CurrencyCode,
    COUNT(*)                                     AS ClosedCount,
    SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END) AS WonCount,
    SUM(CASE WHEN st.IsLost = 1 THEN 1 ELSE 0 END) AS LostCount,
    CAST(SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END) AS DECIMAL(18, 4))
        / NULLIF(COUNT(*), 0)                    AS WinRateByCount,
    SUM(CASE WHEN st.IsWon  = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS WonAmount,
    SUM(CASE WHEN st.IsLost = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS LostAmount,
    CAST(SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS DECIMAL(18, 4))
        / NULLIF(SUM(ISNULL(d.Amount, 0)), 0)    AS WinRateByValue
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsClosed = 1
LEFT OUTER JOIN [__mj_BizAppsAccounting].Currency cur
        ON cur.ID = d.CurrencyID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if CompanyIDs %}
  AND d.CompanyID IN {{ CompanyIDs | sqlIn }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if PipelineIDs %}
  AND d.PipelineID IN {{ PipelineIDs | sqlIn }}
  {% endif %}
  {% if OwnerEmployeeIDs %}
  AND d.OwnerEmployeeID IN {{ OwnerEmployeeIDs | sqlIn }}
  {% endif %}
  {% if ProductCompanyIDs %}
  AND EXISTS (SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol
              WHERE ol.OrderHeaderID = d.OrderID
                AND ol.CompanyID IN {{ ProductCompanyIDs | sqlIn }})
  {% endif %}
  {% if PeriodStart %}
  AND d.ActualCloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND d.ActualCloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline, d.DealTypeID, d.DealType,
    ISNULL(cur.Code, N''USD'')
ORDER BY
    d.Company, d.Pipeline, d.DealType, CurrencyCode;
';
  p_ExtractedSQLHash_07772d8728d8 := 'c2278195ab31fac701e6b289eefdcb17ab3fd9f94f380e804acc1ee084405b63';
  p_ExtractionStatus_07772d8728d8 := 'OK';
  p_ID_07772d8728d8 := '5A1E5000-0001-4000-A000-000000000004';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'SQL', p_SQL_07772d8728d8,
    'ExtractedSQLHash', p_ExtractedSQLHash_07772d8728d8,
    'ExtractionStatus', p_ExtractionStatus_07772d8728d8,
    'ID', p_ID_07772d8728d8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_SQL := p_SQL_07772d8728d8, p_ExtractedSQLHash := p_ExtractedSQLHash_07772d8728d8, p_ExtractionStatus := p_ExtractionStatus_07772d8728d8, p_ID := p_ID_07772d8728d8);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_73a67d6b5a95 UUID;
  p_IsNullable_73a67d6b5a95 BOOLEAN;
  p_ID_73a67d6b5a95 UUID;
BEGIN
  p_SourceEntityFieldID_73a67d6b5a95 := 'A4B19A26-071E-4BA8-8ADD-43317EF70061';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_73a67d6b5a95 := FALSE;
  p_ID_73a67d6b5a95 := 'A6419755-1282-4B52-850A-19E68FB2D20B';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_73a67d6b5a95 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_73a67d6b5a95
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_73a67d6b5a95 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_73a67d6b5a95));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_73a67d6b5a95,
    'IsNullable', p_IsNullable_73a67d6b5a95,
    'ID', p_ID_73a67d6b5a95
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_73a67d6b5a95, p_IsNullable := p_IsNullable_73a67d6b5a95, p_ID := p_ID_73a67d6b5a95);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_86f4179beea3 UUID;
  p_IsNullable_86f4179beea3 BOOLEAN;
  p_ID_86f4179beea3 UUID;
BEGIN
  p_SourceEntityFieldID_86f4179beea3 := '79A3E2FC-768E-4219-A16A-A70E3330605E';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_86f4179beea3 := FALSE;
  p_ID_86f4179beea3 := '6C923BA2-6C3E-494A-B8D5-6A809FD82502';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_86f4179beea3 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_86f4179beea3
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_86f4179beea3 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_86f4179beea3));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_86f4179beea3,
    'IsNullable', p_IsNullable_86f4179beea3,
    'ID', p_ID_86f4179beea3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_86f4179beea3, p_IsNullable := p_IsNullable_86f4179beea3, p_ID := p_ID_86f4179beea3);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_8e4d88ed02ce UUID;
  p_IsNullable_8e4d88ed02ce BOOLEAN;
  p_ID_8e4d88ed02ce UUID;
BEGIN
  p_SourceEntityFieldID_8e4d88ed02ce := '35BA5F17-3D6F-473D-AC3B-6B0FC38F7312';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_8e4d88ed02ce := FALSE;
  p_ID_8e4d88ed02ce := '19AF744E-674B-4058-A42F-10A3B653E0BD';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_8e4d88ed02ce := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_8e4d88ed02ce
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_8e4d88ed02ce THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_8e4d88ed02ce));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_8e4d88ed02ce,
    'IsNullable', p_IsNullable_8e4d88ed02ce,
    'ID', p_ID_8e4d88ed02ce
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_8e4d88ed02ce, p_IsNullable := p_IsNullable_8e4d88ed02ce, p_ID := p_ID_8e4d88ed02ce);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_3c935312be29 UUID;
  p_IsNullable_3c935312be29 BOOLEAN;
  p_ID_3c935312be29 UUID;
BEGIN
  p_SourceEntityFieldID_3c935312be29 := '2AA2DC76-847E-452C-B01C-8CC4082921B2';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_3c935312be29 := FALSE;
  p_ID_3c935312be29 := 'F6900447-7D15-43BB-9957-C02DF710EC27';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_3c935312be29 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_3c935312be29
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_3c935312be29 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_3c935312be29));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_3c935312be29,
    'IsNullable', p_IsNullable_3c935312be29,
    'ID', p_ID_3c935312be29
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_3c935312be29, p_IsNullable := p_IsNullable_3c935312be29, p_ID := p_ID_3c935312be29);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_3d55c118c6e6 UUID;
  p_IsNullable_3d55c118c6e6 BOOLEAN;
  p_ID_3d55c118c6e6 UUID;
BEGIN
  p_SourceEntityFieldID_3d55c118c6e6 := '0BDEAB6B-9097-4642-9729-8A844D3C5234';
  p_IsNullable_3d55c118c6e6 := TRUE;
  p_ID_3d55c118c6e6 := 'FA68F1B9-4304-4DD9-8CB1-DF6C5C882944';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_3d55c118c6e6 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_3d55c118c6e6
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_3d55c118c6e6 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_3d55c118c6e6));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_3d55c118c6e6,
    'IsNullable', p_IsNullable_3d55c118c6e6,
    'ID', p_ID_3d55c118c6e6
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_3d55c118c6e6, p_IsNullable := p_IsNullable_3d55c118c6e6, p_ID := p_ID_3d55c118c6e6);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_8d1267a8f278 UUID;
  p_IsNullable_8d1267a8f278 BOOLEAN;
  p_ID_8d1267a8f278 UUID;
BEGIN
  p_SourceEntityFieldID_8d1267a8f278 := 'FB397468-2AC3-4CAB-943D-97EA9C0FBBEB';
  p_IsNullable_8d1267a8f278 := TRUE;
  p_ID_8d1267a8f278 := '244160C9-5A5C-4CB1-A5BE-35DCC7C7E61A';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_8d1267a8f278 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_8d1267a8f278
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_8d1267a8f278 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_8d1267a8f278));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_8d1267a8f278,
    'IsNullable', p_IsNullable_8d1267a8f278,
    'ID', p_ID_8d1267a8f278
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_8d1267a8f278, p_IsNullable := p_IsNullable_8d1267a8f278, p_ID := p_ID_8d1267a8f278);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_f2c856a9c38e UUID;
  p_QueryID_f2c856a9c38e UUID;
  p_Name_f2c856a9c38e VARCHAR(255);
  p_Description_f2c856a9c38e TEXT;
  p_Sequence_f2c856a9c38e INTEGER;
  p_SQLBaseType_f2c856a9c38e VARCHAR(50);
  p_SQLFullType_f2c856a9c38e VARCHAR(100);
  p_SourceEntityID_f2c856a9c38e UUID;
  p_SourceFieldName_f2c856a9c38e VARCHAR(255);
  p_IsComputed_f2c856a9c38e BOOLEAN;
  p_ComputationDescription_f2c856a9c38e TEXT;
  p_IsSummary_f2c856a9c38e BOOLEAN;
  p_SummaryDescription_f2c856a9c38e TEXT;
  p_DetectionMethod_f2c856a9c38e VARCHAR(50);
  p_AutoDetectConfidenceScore_f2c856a9c38e NUMERIC(3,2);
  p_SourceEntityFieldID_f2c856a9c38e UUID;
  p_IsNullable_f2c856a9c38e BOOLEAN;
  p_SourceObjectName_f2c856a9c38e VARCHAR(500);
BEGIN
  p_ID_f2c856a9c38e := '693687c0-f1a6-4d2c-bc70-ababc5584694';
  p_QueryID_f2c856a9c38e := '5A1E5000-0001-4000-A000-000000000004';
  p_Name_f2c856a9c38e := 'CurrencyCode';
  p_Sequence_f2c856a9c38e := 7;
  p_SQLBaseType_f2c856a9c38e := 'char';
  p_SQLFullType_f2c856a9c38e := 'char(3)';
  p_IsComputed_f2c856a9c38e := TRUE;
  p_IsSummary_f2c856a9c38e := FALSE;
  p_DetectionMethod_f2c856a9c38e := 'Database';
  p_IsNullable_f2c856a9c38e := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_f2c856a9c38e
                    OR ("QueryID" = p_QueryID_f2c856a9c38e AND "Name" = p_Name_f2c856a9c38e)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_f2c856a9c38e,
    'QueryID', p_QueryID_f2c856a9c38e,
    'Name', p_Name_f2c856a9c38e,
    'Description', p_Description_f2c856a9c38e,
    'Sequence', p_Sequence_f2c856a9c38e,
    'SQLBaseType', p_SQLBaseType_f2c856a9c38e,
    'SQLFullType', p_SQLFullType_f2c856a9c38e,
    'SourceEntityID', p_SourceEntityID_f2c856a9c38e,
    'SourceFieldName', p_SourceFieldName_f2c856a9c38e,
    'IsComputed', p_IsComputed_f2c856a9c38e,
    'ComputationDescription', p_ComputationDescription_f2c856a9c38e,
    'IsSummary', p_IsSummary_f2c856a9c38e,
    'SummaryDescription', p_SummaryDescription_f2c856a9c38e,
    'DetectionMethod', p_DetectionMethod_f2c856a9c38e,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_f2c856a9c38e,
    'SourceEntityFieldID', p_SourceEntityFieldID_f2c856a9c38e,
    'IsNullable', p_IsNullable_f2c856a9c38e,
    'SourceObjectName', p_SourceObjectName_f2c856a9c38e
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_f2c856a9c38e, p_QueryID := p_QueryID_f2c856a9c38e, p_Name := p_Name_f2c856a9c38e, p_Description := p_Description_f2c856a9c38e, p_Description_Clear := TRUE, p_Sequence := p_Sequence_f2c856a9c38e, p_SQLBaseType := p_SQLBaseType_f2c856a9c38e, p_SQLFullType := p_SQLFullType_f2c856a9c38e, p_SourceEntityID := p_SourceEntityID_f2c856a9c38e, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_f2c856a9c38e, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_f2c856a9c38e, p_ComputationDescription := p_ComputationDescription_f2c856a9c38e, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_f2c856a9c38e, p_SummaryDescription := p_SummaryDescription_f2c856a9c38e, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_f2c856a9c38e, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_f2c856a9c38e, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_f2c856a9c38e, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_f2c856a9c38e, p_SourceObjectName := p_SourceObjectName_f2c856a9c38e, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_09d97884c08f INTEGER;
  p_SQLBaseType_09d97884c08f VARCHAR(50);
  p_SQLFullType_09d97884c08f VARCHAR(100);
  p_IsNullable_09d97884c08f BOOLEAN;
  p_ID_09d97884c08f UUID;
BEGIN
  p_Sequence_09d97884c08f := 8;
  p_SQLBaseType_09d97884c08f := 'int';
  p_SQLFullType_09d97884c08f := 'int';
  p_IsNullable_09d97884c08f := TRUE;
  p_ID_09d97884c08f := 'E7CE6AA1-3893-4235-946F-1D369045F293';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_09d97884c08f,
    'SQLBaseType', p_SQLBaseType_09d97884c08f,
    'SQLFullType', p_SQLFullType_09d97884c08f,
    'IsNullable', p_IsNullable_09d97884c08f,
    'ID', p_ID_09d97884c08f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_09d97884c08f, p_SQLBaseType := p_SQLBaseType_09d97884c08f, p_SQLFullType := p_SQLFullType_09d97884c08f, p_IsNullable := p_IsNullable_09d97884c08f, p_ID := p_ID_09d97884c08f);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_bffed913cbeb INTEGER;
  p_SQLBaseType_bffed913cbeb VARCHAR(50);
  p_SQLFullType_bffed913cbeb VARCHAR(100);
  p_IsNullable_bffed913cbeb BOOLEAN;
  p_ID_bffed913cbeb UUID;
BEGIN
  p_Sequence_bffed913cbeb := 9;
  p_SQLBaseType_bffed913cbeb := 'int';
  p_SQLFullType_bffed913cbeb := 'int';
  p_IsNullable_bffed913cbeb := TRUE;
  p_ID_bffed913cbeb := '22869A3D-F7A8-45FA-92C2-D4C294F29A43';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_bffed913cbeb,
    'SQLBaseType', p_SQLBaseType_bffed913cbeb,
    'SQLFullType', p_SQLFullType_bffed913cbeb,
    'IsNullable', p_IsNullable_bffed913cbeb,
    'ID', p_ID_bffed913cbeb
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_bffed913cbeb, p_SQLBaseType := p_SQLBaseType_bffed913cbeb, p_SQLFullType := p_SQLFullType_bffed913cbeb, p_IsNullable := p_IsNullable_bffed913cbeb, p_ID := p_ID_bffed913cbeb);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_85bd4819e2d3 INTEGER;
  p_SQLBaseType_85bd4819e2d3 VARCHAR(50);
  p_SQLFullType_85bd4819e2d3 VARCHAR(100);
  p_IsNullable_85bd4819e2d3 BOOLEAN;
  p_ID_85bd4819e2d3 UUID;
BEGIN
  p_Sequence_85bd4819e2d3 := 10;
  p_SQLBaseType_85bd4819e2d3 := 'int';
  p_SQLFullType_85bd4819e2d3 := 'int';
  p_IsNullable_85bd4819e2d3 := TRUE;
  p_ID_85bd4819e2d3 := '4050636C-3544-4310-B532-A06502701912';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_85bd4819e2d3,
    'SQLBaseType', p_SQLBaseType_85bd4819e2d3,
    'SQLFullType', p_SQLFullType_85bd4819e2d3,
    'IsNullable', p_IsNullable_85bd4819e2d3,
    'ID', p_ID_85bd4819e2d3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_85bd4819e2d3, p_SQLBaseType := p_SQLBaseType_85bd4819e2d3, p_SQLFullType := p_SQLFullType_85bd4819e2d3, p_IsNullable := p_IsNullable_85bd4819e2d3, p_ID := p_ID_85bd4819e2d3);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_5c359c52ca9b INTEGER;
  p_SQLBaseType_5c359c52ca9b VARCHAR(50);
  p_SQLFullType_5c359c52ca9b VARCHAR(100);
  p_IsNullable_5c359c52ca9b BOOLEAN;
  p_ID_5c359c52ca9b UUID;
BEGIN
  p_Sequence_5c359c52ca9b := 11;
  p_SQLBaseType_5c359c52ca9b := 'decimal';
  p_SQLFullType_5c359c52ca9b := 'decimal(29,15)';
  p_IsNullable_5c359c52ca9b := TRUE;
  p_ID_5c359c52ca9b := 'F2C4DDC1-8136-4B44-9175-B6CF7A8A5D01';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_5c359c52ca9b,
    'SQLBaseType', p_SQLBaseType_5c359c52ca9b,
    'SQLFullType', p_SQLFullType_5c359c52ca9b,
    'IsNullable', p_IsNullable_5c359c52ca9b,
    'ID', p_ID_5c359c52ca9b
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_5c359c52ca9b, p_SQLBaseType := p_SQLBaseType_5c359c52ca9b, p_SQLFullType := p_SQLFullType_5c359c52ca9b, p_IsNullable := p_IsNullable_5c359c52ca9b, p_ID := p_ID_5c359c52ca9b);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_b68729d27e89 INTEGER;
  p_SQLBaseType_b68729d27e89 VARCHAR(50);
  p_SQLFullType_b68729d27e89 VARCHAR(100);
  p_IsNullable_b68729d27e89 BOOLEAN;
  p_ID_b68729d27e89 UUID;
BEGIN
  p_Sequence_b68729d27e89 := 12;
  p_SQLBaseType_b68729d27e89 := 'decimal';
  p_SQLFullType_b68729d27e89 := 'decimal(38,4)';
  p_IsNullable_b68729d27e89 := TRUE;
  p_ID_b68729d27e89 := 'B07569B0-312C-4A12-B7C2-A3EA4D0892EA';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_b68729d27e89,
    'SQLBaseType', p_SQLBaseType_b68729d27e89,
    'SQLFullType', p_SQLFullType_b68729d27e89,
    'IsNullable', p_IsNullable_b68729d27e89,
    'ID', p_ID_b68729d27e89
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_b68729d27e89, p_SQLBaseType := p_SQLBaseType_b68729d27e89, p_SQLFullType := p_SQLFullType_b68729d27e89, p_IsNullable := p_IsNullable_b68729d27e89, p_ID := p_ID_b68729d27e89);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_9abddcf96085 INTEGER;
  p_SQLBaseType_9abddcf96085 VARCHAR(50);
  p_SQLFullType_9abddcf96085 VARCHAR(100);
  p_IsNullable_9abddcf96085 BOOLEAN;
  p_ID_9abddcf96085 UUID;
BEGIN
  p_Sequence_9abddcf96085 := 13;
  p_SQLBaseType_9abddcf96085 := 'decimal';
  p_SQLFullType_9abddcf96085 := 'decimal(38,4)';
  p_IsNullable_9abddcf96085 := TRUE;
  p_ID_9abddcf96085 := '6B5B6CF1-D47F-470B-8D30-C805055790DD';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_9abddcf96085,
    'SQLBaseType', p_SQLBaseType_9abddcf96085,
    'SQLFullType', p_SQLFullType_9abddcf96085,
    'IsNullable', p_IsNullable_9abddcf96085,
    'ID', p_ID_9abddcf96085
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_9abddcf96085, p_SQLBaseType := p_SQLBaseType_9abddcf96085, p_SQLFullType := p_SQLFullType_9abddcf96085, p_IsNullable := p_IsNullable_9abddcf96085, p_ID := p_ID_9abddcf96085);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_Sequence_bd352610d13d INTEGER;
  p_SQLBaseType_bd352610d13d VARCHAR(50);
  p_SQLFullType_bd352610d13d VARCHAR(100);
  p_IsNullable_bd352610d13d BOOLEAN;
  p_ID_bd352610d13d UUID;
BEGIN
  p_Sequence_bd352610d13d := 14;
  p_SQLBaseType_bd352610d13d := 'decimal';
  p_SQLFullType_bd352610d13d := 'decimal(38,20)';
  p_IsNullable_bd352610d13d := TRUE;
  p_ID_bd352610d13d := 'ABE72E28-0999-4811-A23D-D8EF7B5754B5';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'Sequence', p_Sequence_bd352610d13d,
    'SQLBaseType', p_SQLBaseType_bd352610d13d,
    'SQLFullType', p_SQLFullType_bd352610d13d,
    'IsNullable', p_IsNullable_bd352610d13d,
    'ID', p_ID_bd352610d13d
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_Sequence := p_Sequence_bd352610d13d, p_SQLBaseType := p_SQLBaseType_bd352610d13d, p_SQLFullType := p_SQLFullType_bd352610d13d, p_IsNullable := p_IsNullable_bd352610d13d, p_ID := p_ID_bd352610d13d);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_c5c29f2d8c5b UUID;
  p_QueryID_c5c29f2d8c5b UUID;
  p_EntityID_c5c29f2d8c5b UUID;
  p_DetectionMethod_c5c29f2d8c5b VARCHAR(50);
  p_AutoDetectConfidenceScore_c5c29f2d8c5b NUMERIC(3,2);
  p_AlternateBaseViewID_c5c29f2d8c5b UUID;
BEGIN
  p_ID_c5c29f2d8c5b := 'ec141483-ea96-4734-bc77-3785c9d3135f';
  p_QueryID_c5c29f2d8c5b := '5A1E5000-0001-4000-A000-000000000004';
  p_EntityID_c5c29f2d8c5b := 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7';
  p_DetectionMethod_c5c29f2d8c5b := 'Parser';
  p_AutoDetectConfidenceScore_c5c29f2d8c5b := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_c5c29f2d8c5b
                    OR ("QueryID" = p_QueryID_c5c29f2d8c5b AND "EntityID" = p_EntityID_c5c29f2d8c5b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_c5c29f2d8c5b,
    'QueryID', p_QueryID_c5c29f2d8c5b,
    'EntityID', p_EntityID_c5c29f2d8c5b,
    'DetectionMethod', p_DetectionMethod_c5c29f2d8c5b,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_c5c29f2d8c5b,
    'AlternateBaseViewID', p_AlternateBaseViewID_c5c29f2d8c5b
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_c5c29f2d8c5b, p_QueryID := p_QueryID_c5c29f2d8c5b, p_EntityID := p_EntityID_c5c29f2d8c5b, p_DetectionMethod := p_DetectionMethod_c5c29f2d8c5b, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_c5c29f2d8c5b, p_AlternateBaseViewID := p_AlternateBaseViewID_c5c29f2d8c5b, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_SQL_cea609283ad9 TEXT;
  p_ExtractedSQLHash_cea609283ad9 VARCHAR(64);
  p_ExtractionStatus_cea609283ad9 VARCHAR(20);
  p_ID_cea609283ad9 UUID;
BEGIN
  p_SQL_cea609283ad9 := '-- Won deals whose order was never confirmed. Finance exception review, golive #279 type 3.
--
-- A deal won and never booked is never billed, and nothing else in the system says so: closing a
-- deal Won creates the contract and the review tasks, but the order stays at whatever status the
-- stage left it. This lists every won deal whose order is still not Confirmed, for finance to clear
-- at month end until the nightly exception check replaces it.
--
-- THE LINK IS Deal.OrderID. DealEntityServer.Save() provisions a Draft order on a deal''s first save,
-- so an empty OrderID is the unusual case, not the normal one. It is still reported (OrderStatus is
-- NULL) because it is the same exception: nothing will bill this deal.
--
-- A VOIDED ORDER IS REPORTED TOO. A won deal whose order was voided and not replaced has the same
-- outcome as one never confirmed, and finance decides whether that was intended.
--
-- WON IS DealStatusType.IsWon, never a status name. Order Status is a CHECK-constrained column
-- (Draft, Quoted, Confirmed, Voided), not seeded vocabulary, so it is compared by value.
--
-- DATE DIMENSION: ActualCloseDate, falling back to ClosedAt''s BUSINESS day (fnBusinessDayOf) for a
-- deal closed without one. ActualCloseDate is stamped on the business day (bc-aidp-next-golive#168);
-- a CAST of ClosedAt took the UTC day, the NEXT day for a close in the Central evening, so the
-- fallback would have been a different kind of day from the column it stands in for. DaysSinceClose
-- counts to the business day from fnBusinessToday(), the same "today" the orders views use, so a deal
-- closed late in the evening does not age a day early.
--
-- MinDaysSinceClose is the grace period before a won deal counts as an exception. It is optional
-- until finance sets the threshold; omitted, every won deal with an unconfirmed order is listed.
WITH won AS (
    SELECT
        d.ID,
        d.DealNumber,
        d.Name,
        d.CompanyID,
        d.Company,
        d.AccountID,
        d.Account,
        d.OwnerEmployeeID,
        d.OwnerEmployee,
        d.Amount,
        d.OrderID,
        d.ClosedByUserID,
        d.ClosedByUser,
        COALESCE(
            d.ActualCloseDate,
            [__mj_BizAppsCommon].[fnBusinessDayOf](d.ClosedAt),
            [__mj_BizAppsCommon].[fnBusinessDayOf](d.__mj_UpdatedAt)
        ) AS CloseDate
    FROM [__mj_BizAppsSales].vwDeals d
    INNER JOIN [__mj_BizAppsSales].DealStatusType st
            ON st.ID = d.DealStatusTypeID
           AND st.IsWon = 1
)
SELECT
    w.ID                                    AS DealID,
    w.DealNumber,
    w.Name                                  AS DealName,
    w.CompanyID,
    w.Company                               AS CompanyName,
    w.AccountID,
    w.Account                               AS AccountName,
    w.OwnerEmployeeID,
    w.OwnerEmployee                         AS OwnerName,
    w.ClosedByUserID,
    w.ClosedByUser                          AS ClosedByUserName,
    w.CloseDate,
    DATEDIFF(DAY, w.CloseDate, bt.Today)    AS DaysSinceClose,
    w.Amount                                AS DealAmount,
    w.OrderID,
    o.OrderNumber,
    o.Status                                AS OrderStatus,
    o.TotalGross                            AS OrderTotalGross
FROM won w
CROSS JOIN [__mj_BizAppsCommon].[fnBusinessToday]() AS bt
LEFT JOIN [__mj_BizAppsOrders].vwOrderHeaders o
       ON o.ID = w.OrderID
WHERE (o.ID IS NULL OR o.Status <> N''Confirmed'')
  {% if CompanyID %}
  AND w.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if MinDaysSinceClose %}
  AND DATEDIFF(DAY, w.CloseDate, bt.Today) >= {{ MinDaysSinceClose | sqlNumber }}
  {% endif %}
  {% if PeriodStart %}
  AND w.CloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND w.CloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
ORDER BY
    w.Company, w.CloseDate, w.DealNumber;
';
  p_ExtractedSQLHash_cea609283ad9 := '947d6375ad0c33272ecbe10840784ecfcade55617a436c811cec1eb591fd5ddf';
  p_ExtractionStatus_cea609283ad9 := 'OK';
  p_ID_cea609283ad9 := '5A1E5000-0001-4000-A000-000000000010';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'SQL', p_SQL_cea609283ad9,
    'ExtractedSQLHash', p_ExtractedSQLHash_cea609283ad9,
    'ExtractionStatus', p_ExtractionStatus_cea609283ad9,
    'ID', p_ID_cea609283ad9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_SQL := p_SQL_cea609283ad9, p_ExtractedSQLHash := p_ExtractedSQLHash_cea609283ad9, p_ExtractionStatus := p_ExtractionStatus_cea609283ad9, p_ID := p_ID_cea609283ad9);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_d7dfb0d6a3ed UUID;
  p_IsNullable_d7dfb0d6a3ed BOOLEAN;
  p_ID_d7dfb0d6a3ed UUID;
BEGIN
  p_SourceEntityFieldID_d7dfb0d6a3ed := '3D52AFFE-C851-46F7-8C49-5263BECB0C9B';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_d7dfb0d6a3ed := FALSE;
  p_ID_d7dfb0d6a3ed := '3E40DCD0-B4CC-477F-8D8C-255C9B0ACBA8';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_d7dfb0d6a3ed := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_d7dfb0d6a3ed
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_d7dfb0d6a3ed THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_d7dfb0d6a3ed));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_d7dfb0d6a3ed,
    'IsNullable', p_IsNullable_d7dfb0d6a3ed,
    'ID', p_ID_d7dfb0d6a3ed
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_d7dfb0d6a3ed, p_IsNullable := p_IsNullable_d7dfb0d6a3ed, p_ID := p_ID_d7dfb0d6a3ed);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_2fed37d88bce UUID;
  p_IsNullable_2fed37d88bce BOOLEAN;
  p_ID_2fed37d88bce UUID;
BEGIN
  p_SourceEntityFieldID_2fed37d88bce := '939FFD49-39DA-4200-BE2E-906F14FE50E1';
  p_IsNullable_2fed37d88bce := TRUE;
  p_ID_2fed37d88bce := '1A6E54B5-56C1-4150-BAEA-F957A080BDF2';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_2fed37d88bce := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_2fed37d88bce
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_2fed37d88bce THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_2fed37d88bce));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_2fed37d88bce,
    'IsNullable', p_IsNullable_2fed37d88bce,
    'ID', p_ID_2fed37d88bce
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_2fed37d88bce, p_IsNullable := p_IsNullable_2fed37d88bce, p_ID := p_ID_2fed37d88bce);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_8df01a42309b UUID;
  p_IsNullable_8df01a42309b BOOLEAN;
  p_ID_8df01a42309b UUID;
BEGIN
  p_SourceEntityFieldID_8df01a42309b := '379450E4-178C-4CDD-90B3-9081E903B51D';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_8df01a42309b := FALSE;
  p_ID_8df01a42309b := '5CBDA0EF-C4F3-4EDA-8D09-B21E1053557B';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_8df01a42309b := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_8df01a42309b
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_8df01a42309b THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_8df01a42309b));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_8df01a42309b,
    'IsNullable', p_IsNullable_8df01a42309b,
    'ID', p_ID_8df01a42309b
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_8df01a42309b, p_IsNullable := p_IsNullable_8df01a42309b, p_ID := p_ID_8df01a42309b);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_ea90ef04c9a9 UUID;
  p_IsNullable_ea90ef04c9a9 BOOLEAN;
  p_ID_ea90ef04c9a9 UUID;
BEGIN
  p_SourceEntityFieldID_ea90ef04c9a9 := 'A4B19A26-071E-4BA8-8ADD-43317EF70061';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_ea90ef04c9a9 := FALSE;
  p_ID_ea90ef04c9a9 := 'CAD9778A-AFCC-471C-9D00-30A8AFB48B14';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_ea90ef04c9a9 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_ea90ef04c9a9
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_ea90ef04c9a9 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_ea90ef04c9a9));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_ea90ef04c9a9,
    'IsNullable', p_IsNullable_ea90ef04c9a9,
    'ID', p_ID_ea90ef04c9a9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_ea90ef04c9a9, p_IsNullable := p_IsNullable_ea90ef04c9a9, p_ID := p_ID_ea90ef04c9a9);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_da8fbf350256 UUID;
  p_IsNullable_da8fbf350256 BOOLEAN;
  p_ID_da8fbf350256 UUID;
BEGIN
  p_SourceEntityFieldID_da8fbf350256 := '79A3E2FC-768E-4219-A16A-A70E3330605E';
  -- IsNullable = FALSE as the push wrote it: MJ CLI 6.2.1's SQL log leaves out a NULL -> false change.
  p_IsNullable_da8fbf350256 := FALSE;
  p_ID_da8fbf350256 := '441C9AFF-5C0B-4759-80F4-1CA4E075ECA7';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_da8fbf350256 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_da8fbf350256
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_da8fbf350256 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_da8fbf350256));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_da8fbf350256,
    'IsNullable', p_IsNullable_da8fbf350256,
    'ID', p_ID_da8fbf350256
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_da8fbf350256, p_IsNullable := p_IsNullable_da8fbf350256, p_ID := p_ID_da8fbf350256);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_b8a8afaebe95 UUID;
  p_IsNullable_b8a8afaebe95 BOOLEAN;
  p_ID_b8a8afaebe95 UUID;
BEGIN
  p_SourceEntityFieldID_b8a8afaebe95 := '67A21862-5E5A-4597-AF82-32CB0C4CF1C4';
  p_IsNullable_b8a8afaebe95 := TRUE;
  p_ID_b8a8afaebe95 := '1CEF46F0-4490-4876-8BBA-39148D7F33FF';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_b8a8afaebe95 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_b8a8afaebe95
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_b8a8afaebe95 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_b8a8afaebe95));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_b8a8afaebe95,
    'IsNullable', p_IsNullable_b8a8afaebe95,
    'ID', p_ID_b8a8afaebe95
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_b8a8afaebe95, p_IsNullable := p_IsNullable_b8a8afaebe95, p_ID := p_ID_b8a8afaebe95);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_4834dcdcd0ba UUID;
  p_IsNullable_4834dcdcd0ba BOOLEAN;
  p_ID_4834dcdcd0ba UUID;
BEGIN
  p_SourceEntityFieldID_4834dcdcd0ba := '94114B63-4A39-4A2C-B774-16651DCC7944';
  p_IsNullable_4834dcdcd0ba := TRUE;
  p_ID_4834dcdcd0ba := '2960CB45-F1FC-4163-96AA-AA453DA64206';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_4834dcdcd0ba := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_4834dcdcd0ba
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_4834dcdcd0ba THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_4834dcdcd0ba));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_4834dcdcd0ba,
    'IsNullable', p_IsNullable_4834dcdcd0ba,
    'ID', p_ID_4834dcdcd0ba
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_4834dcdcd0ba, p_IsNullable := p_IsNullable_4834dcdcd0ba, p_ID := p_ID_4834dcdcd0ba);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_d47541da0071 UUID;
  p_IsNullable_d47541da0071 BOOLEAN;
  p_ID_d47541da0071 UUID;
BEGIN
  p_SourceEntityFieldID_d47541da0071 := 'C9F4CB38-D4FA-4C5B-9CF0-EBA5571AB52D';
  p_IsNullable_d47541da0071 := TRUE;
  p_ID_d47541da0071 := 'A60C15DE-C414-41A9-ADED-4780B0BFBAAB';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_d47541da0071 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_d47541da0071
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_d47541da0071 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_d47541da0071));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_d47541da0071,
    'IsNullable', p_IsNullable_d47541da0071,
    'ID', p_ID_d47541da0071
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_d47541da0071, p_IsNullable := p_IsNullable_d47541da0071, p_ID := p_ID_d47541da0071);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_031f756c6c0c UUID;
  p_IsNullable_031f756c6c0c BOOLEAN;
  p_ID_031f756c6c0c UUID;
BEGIN
  p_SourceEntityFieldID_031f756c6c0c := '3442E4F5-F87C-4993-9AB3-38D7FBBECF88';
  p_IsNullable_031f756c6c0c := TRUE;
  p_ID_031f756c6c0c := '9783BB41-C0EB-4AD1-A482-360EEDD1B01D';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_031f756c6c0c := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_031f756c6c0c
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_031f756c6c0c THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_031f756c6c0c));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_031f756c6c0c,
    'IsNullable', p_IsNullable_031f756c6c0c,
    'ID', p_ID_031f756c6c0c
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_031f756c6c0c, p_IsNullable := p_IsNullable_031f756c6c0c, p_ID := p_ID_031f756c6c0c);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_246245a99685 UUID;
  p_IsNullable_246245a99685 BOOLEAN;
  p_ID_246245a99685 UUID;
BEGIN
  p_SourceEntityFieldID_246245a99685 := '5AF08107-39E1-480C-A468-5F4045E9766D';
  p_IsNullable_246245a99685 := TRUE;
  p_ID_246245a99685 := 'A54DC8B3-D710-4387-83B1-6697154E994A';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_246245a99685 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_246245a99685
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_246245a99685 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_246245a99685));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_246245a99685,
    'IsNullable', p_IsNullable_246245a99685,
    'ID', p_ID_246245a99685
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_246245a99685, p_IsNullable := p_IsNullable_246245a99685, p_ID := p_ID_246245a99685);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_24f876cd6b72 UUID;
  p_IsNullable_24f876cd6b72 BOOLEAN;
  p_ID_24f876cd6b72 UUID;
BEGIN
  p_SourceEntityFieldID_24f876cd6b72 := '369E68C2-7E9D-4972-A557-00A1432D1950';
  p_IsNullable_24f876cd6b72 := TRUE;
  p_ID_24f876cd6b72 := '866CE81E-1A12-4F80-9CB6-5BD7F6A0463B';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_24f876cd6b72 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_24f876cd6b72
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_24f876cd6b72 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_24f876cd6b72));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_24f876cd6b72,
    'IsNullable', p_IsNullable_24f876cd6b72,
    'ID', p_ID_24f876cd6b72
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_24f876cd6b72, p_IsNullable := p_IsNullable_24f876cd6b72, p_ID := p_ID_24f876cd6b72);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_fdcab433cf58 VARCHAR(50);
  p_SQLFullType_fdcab433cf58 VARCHAR(100);
  p_SourceFieldName_fdcab433cf58 VARCHAR(255);
  p_IsComputed_fdcab433cf58 BOOLEAN;
  p_IsNullable_fdcab433cf58 BOOLEAN;
  p_ID_fdcab433cf58 UUID;
BEGIN
  p_SQLBaseType_fdcab433cf58 := 'date';
  p_SQLFullType_fdcab433cf58 := 'date';
  p_IsComputed_fdcab433cf58 := TRUE;
  p_IsNullable_fdcab433cf58 := TRUE;
  p_ID_fdcab433cf58 := 'F6B93A11-A656-457C-99AC-F02142B54D9C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_fdcab433cf58,
    'SQLFullType', p_SQLFullType_fdcab433cf58,
    'SourceFieldName', p_SourceFieldName_fdcab433cf58,
    'IsComputed', p_IsComputed_fdcab433cf58,
    'IsNullable', p_IsNullable_fdcab433cf58,
    'ID', p_ID_fdcab433cf58
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_fdcab433cf58, p_SQLFullType := p_SQLFullType_fdcab433cf58, p_SourceFieldName := p_SourceFieldName_fdcab433cf58, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_fdcab433cf58, p_IsNullable := p_IsNullable_fdcab433cf58, p_ID := p_ID_fdcab433cf58);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLBaseType_0c3547cbb7d2 VARCHAR(50);
  p_SQLFullType_0c3547cbb7d2 VARCHAR(100);
  p_IsNullable_0c3547cbb7d2 BOOLEAN;
  p_ID_0c3547cbb7d2 UUID;
BEGIN
  p_SQLBaseType_0c3547cbb7d2 := 'int';
  p_SQLFullType_0c3547cbb7d2 := 'int';
  p_IsNullable_0c3547cbb7d2 := TRUE;
  p_ID_0c3547cbb7d2 := 'B4C6C150-E95A-4586-A9C5-F50321ECC5E0';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLBaseType', p_SQLBaseType_0c3547cbb7d2,
    'SQLFullType', p_SQLFullType_0c3547cbb7d2,
    'IsNullable', p_IsNullable_0c3547cbb7d2,
    'ID', p_ID_0c3547cbb7d2
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLBaseType := p_SQLBaseType_0c3547cbb7d2, p_SQLFullType := p_SQLFullType_0c3547cbb7d2, p_IsNullable := p_IsNullable_0c3547cbb7d2, p_ID := p_ID_0c3547cbb7d2);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLFullType_9cd52c5fe366 VARCHAR(100);
  p_SourceEntityFieldID_9cd52c5fe366 UUID;
  p_IsNullable_9cd52c5fe366 BOOLEAN;
  p_ID_9cd52c5fe366 UUID;
BEGIN
  p_SQLFullType_9cd52c5fe366 := 'decimal(19,4)';
  p_SourceEntityFieldID_9cd52c5fe366 := '440893BB-B492-4D23-B250-EE48A590182F';
  p_IsNullable_9cd52c5fe366 := TRUE;
  p_ID_9cd52c5fe366 := '42AE0785-66D4-4A9E-A9D1-0E47512312AD';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_9cd52c5fe366 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_9cd52c5fe366
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_9cd52c5fe366 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_9cd52c5fe366));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLFullType', p_SQLFullType_9cd52c5fe366,
    'SourceEntityFieldID', p_SourceEntityFieldID_9cd52c5fe366,
    'IsNullable', p_IsNullable_9cd52c5fe366,
    'ID', p_ID_9cd52c5fe366
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLFullType := p_SQLFullType_9cd52c5fe366, p_SourceEntityFieldID := p_SourceEntityFieldID_9cd52c5fe366, p_IsNullable := p_IsNullable_9cd52c5fe366, p_ID := p_ID_9cd52c5fe366);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_7d20d20505ab UUID;
  p_IsNullable_7d20d20505ab BOOLEAN;
  p_ID_7d20d20505ab UUID;
BEGIN
  p_SourceEntityFieldID_7d20d20505ab := '34BB232D-184C-4233-8E37-92AF616EEDC7';
  p_IsNullable_7d20d20505ab := TRUE;
  p_ID_7d20d20505ab := '3120C0ED-847A-480A-8E20-9B7A05B14B19';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_7d20d20505ab := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_7d20d20505ab
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_7d20d20505ab THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_7d20d20505ab));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_7d20d20505ab,
    'IsNullable', p_IsNullable_7d20d20505ab,
    'ID', p_ID_7d20d20505ab
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_7d20d20505ab, p_IsNullable := p_IsNullable_7d20d20505ab, p_ID := p_ID_7d20d20505ab);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_93334c5a58e0 UUID;
  p_IsNullable_93334c5a58e0 BOOLEAN;
  p_ID_93334c5a58e0 UUID;
BEGIN
  p_SourceEntityFieldID_93334c5a58e0 := '37ED0567-5213-4E33-9123-C88CF3E9A851';
  p_IsNullable_93334c5a58e0 := TRUE;
  p_ID_93334c5a58e0 := '28CEEB85-1EE3-46CF-AED0-C62B972F5A5B';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_93334c5a58e0 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_93334c5a58e0
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_93334c5a58e0 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_93334c5a58e0));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_93334c5a58e0,
    'IsNullable', p_IsNullable_93334c5a58e0,
    'ID', p_ID_93334c5a58e0
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_93334c5a58e0, p_IsNullable := p_IsNullable_93334c5a58e0, p_ID := p_ID_93334c5a58e0);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SourceEntityFieldID_9ba5d7ac7f70 UUID;
  p_IsNullable_9ba5d7ac7f70 BOOLEAN;
  p_ID_9ba5d7ac7f70 UUID;
BEGIN
  p_SourceEntityFieldID_9ba5d7ac7f70 := 'DFCEE14E-6200-4025-BF35-06E5A2FDDD8A';
  p_IsNullable_9ba5d7ac7f70 := TRUE;
  p_ID_9ba5d7ac7f70 := '6D85EEEC-916B-497C-BC53-4A1F0ED1E81A';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_9ba5d7ac7f70 := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_9ba5d7ac7f70
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_9ba5d7ac7f70 THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_9ba5d7ac7f70));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SourceEntityFieldID', p_SourceEntityFieldID_9ba5d7ac7f70,
    'IsNullable', p_IsNullable_9ba5d7ac7f70,
    'ID', p_ID_9ba5d7ac7f70
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SourceEntityFieldID := p_SourceEntityFieldID_9ba5d7ac7f70, p_IsNullable := p_IsNullable_9ba5d7ac7f70, p_ID := p_ID_9ba5d7ac7f70);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_SQLFullType_48eb55412ceb VARCHAR(100);
  p_SourceEntityFieldID_48eb55412ceb UUID;
  p_IsNullable_48eb55412ceb BOOLEAN;
  p_ID_48eb55412ceb UUID;
BEGIN
  p_SQLFullType_48eb55412ceb := 'decimal(18,2)';
  p_SourceEntityFieldID_48eb55412ceb := '7AEB02A2-1574-4FC4-ADF1-299328154295';
  p_IsNullable_48eb55412ceb := TRUE;
  p_ID_48eb55412ceb := '4192E271-FD0E-4C88-AA7F-0D09922D69A7';
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases.
  -- When none matches, the field keeps the value it has.
  p_SourceEntityFieldID_48eb55412ceb := COALESCE((SELECT ef."ID" FROM "${mjSchema}"."EntityField" ef
      JOIN "${mjSchema}"."QueryField" qf ON qf."ID" = p_ID_48eb55412ceb
      WHERE ef."EntityID" = qf."SourceEntityID" AND ef."Name" = qf."SourceFieldName"
      ORDER BY CASE WHEN ef."ID" = p_SourceEntityFieldID_48eb55412ceb THEN 0 ELSE 1 END LIMIT 1),
    (SELECT "SourceEntityFieldID" FROM "${mjSchema}"."QueryField" WHERE "ID" = p_ID_48eb55412ceb));
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'SQLFullType', p_SQLFullType_48eb55412ceb,
    'SourceEntityFieldID', p_SourceEntityFieldID_48eb55412ceb,
    'IsNullable', p_IsNullable_48eb55412ceb,
    'ID', p_ID_48eb55412ceb
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_SQLFullType := p_SQLFullType_48eb55412ceb, p_SourceEntityFieldID := p_SourceEntityFieldID_48eb55412ceb, p_IsNullable := p_IsNullable_48eb55412ceb, p_ID := p_ID_48eb55412ceb);
  END IF;
END $mj$;

-- Save MJ: User Views (core SP call only)
DO $mj$
DECLARE
  p_GridState_521a1ae1f213 TEXT;
  p_ID_521a1ae1f213 UUID;
BEGIN
  p_GridState_521a1ae1f213 := '{"sortSettings": [{"field": "ClosedAt", "dir": "asc"}, {"field": "ExpectedCloseDate", "dir": "asc"}], "columnSettings": [{"Name": "Name", "DisplayName": "Deal", "orderIndex": 0, "width": 260, "pinned": "left"}, {"Name": "DealNumber", "DisplayName": "Number", "orderIndex": 1, "width": 120}, {"Name": "Account", "DisplayName": "Customer", "orderIndex": 2, "width": 180}, {"Name": "Pipeline", "DisplayName": "Pipeline", "orderIndex": 3, "width": 140}, {"Name": "PipelineStage", "DisplayName": "Stage", "orderIndex": 4, "width": 130}, {"Name": "DealStatusType", "DisplayName": "Status", "orderIndex": 5, "width": 110, "format": {"type": "text", "conditionalRules": [{"condition": "contains", "value": "Won", "style": {"color": "#047857", "backgroundColor": "#d1fae5", "bold": true}}, {"condition": "contains", "value": "Lost", "style": {"color": "#b45309", "backgroundColor": "#fef3c7"}}, {"condition": "equals", "value": "Open", "style": {"color": "#1d4ed8", "backgroundColor": "#dbeafe"}}]}}, {"Name": "Amount", "DisplayName": "Amount", "orderIndex": 6, "width": 120, "format": {"type": "number", "decimals": 0, "align": "right"}}, {"Name": "CurrencyID", "DisplayName": "Currency", "orderIndex": 7, "width": 110}, {"Name": "Probability", "DisplayName": "Prob", "orderIndex": 8, "width": 80, "format": {"type": "percent", "decimals": 0, "align": "right"}}, {"Name": "ExpectedCloseDate", "DisplayName": "Expected close", "orderIndex": 9, "width": 130, "format": {"type": "date", "dateFormat": "medium"}}, {"Name": "ActualCloseDate", "DisplayName": "Closed on", "orderIndex": 10, "width": 120, "format": {"type": "date", "dateFormat": "medium"}}, {"Name": "OwnerEmployee", "DisplayName": "Owner", "orderIndex": 11, "width": 140}, {"Name": "ForecastCategoryType", "DisplayName": "Forecast", "orderIndex": 12, "width": 130}, {"Name": "NextStep", "DisplayName": "Next step", "orderIndex": 13, "width": 200}, {"Name": "ClosedAt", "DisplayName": "Closed at", "orderIndex": 14, "width": 120, "hidden": true}]}';
  p_ID_521a1ae1f213 := 'A11DEA15-0001-4E71-B0A8-3F17C5E2D803';
  -- Only while the view still holds the layout the previous release shipped: a host that
  -- changed it keeps its own.
  IF EXISTS (SELECT 1 FROM "${mjSchema}"."UserView"
             WHERE "ID" = p_ID_521a1ae1f213 AND "GridState" = '{"sortSettings": [{"field": "ClosedAt", "dir": "asc"}, {"field": "ExpectedCloseDate", "dir": "asc"}], "columnSettings": [{"Name": "Name", "DisplayName": "Deal", "orderIndex": 0, "width": 260, "pinned": "left"}, {"Name": "DealNumber", "DisplayName": "Number", "orderIndex": 1, "width": 120}, {"Name": "Account", "DisplayName": "Customer", "orderIndex": 2, "width": 180}, {"Name": "Pipeline", "DisplayName": "Pipeline", "orderIndex": 3, "width": 140}, {"Name": "PipelineStage", "DisplayName": "Stage", "orderIndex": 4, "width": 130}, {"Name": "DealStatusType", "DisplayName": "Status", "orderIndex": 5, "width": 110, "format": {"type": "text", "conditionalRules": [{"condition": "contains", "value": "Won", "style": {"color": "#047857", "backgroundColor": "#d1fae5", "bold": true}}, {"condition": "contains", "value": "Lost", "style": {"color": "#b45309", "backgroundColor": "#fef3c7"}}, {"condition": "equals", "value": "Open", "style": {"color": "#1d4ed8", "backgroundColor": "#dbeafe"}}]}}, {"Name": "Amount", "DisplayName": "Amount", "orderIndex": 6, "width": 120, "format": {"type": "currency", "currencyCode": "USD", "decimals": 0, "align": "right"}}, {"Name": "Probability", "DisplayName": "Prob", "orderIndex": 7, "width": 80, "format": {"type": "percent", "decimals": 0, "align": "right"}}, {"Name": "ExpectedCloseDate", "DisplayName": "Expected close", "orderIndex": 8, "width": 130, "format": {"type": "date", "dateFormat": "medium"}}, {"Name": "ActualCloseDate", "DisplayName": "Closed on", "orderIndex": 9, "width": 120, "format": {"type": "date", "dateFormat": "medium"}}, {"Name": "OwnerEmployee", "DisplayName": "Owner", "orderIndex": 10, "width": 140}, {"Name": "ForecastCategoryType", "DisplayName": "Forecast", "orderIndex": 11, "width": 130}, {"Name": "NextStep", "DisplayName": "Next step", "orderIndex": 12, "width": 200}, {"Name": "ClosedAt", "DisplayName": "Closed at", "orderIndex": 13, "width": 120, "hidden": true}]}') THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateUserView'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateUserView"(p_data := jsonb_build_object(
      'GridState', p_GridState_521a1ae1f213,
      'ID', p_ID_521a1ae1f213
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateUserView"(p_GridState := p_GridState_521a1ae1f213, p_ID := p_ID_521a1ae1f213);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_IncludeInGeneratedForm_b1a7c3e5d901 BOOLEAN;
  p_DefaultInView_b1a7c3e5d901 BOOLEAN;
  p_ID_b1a7c3e5d901 UUID;
BEGIN
  p_IncludeInGeneratedForm_b1a7c3e5d901 := FALSE;
  p_DefaultInView_b1a7c3e5d901 := FALSE;
  -- The field is found by entity name + field name; only while either flag is still on.
  SELECT ef."ID" INTO p_ID_b1a7c3e5d901
    FROM "${mjSchema}"."EntityField" ef
    JOIN "${mjSchema}"."Entity" e ON e."ID" = ef."EntityID"
   WHERE e."Name" = 'MJ_BizApps_Sales: Deals' AND ef."Name" = 'PredictedWinProbability'
     AND (ef."IncludeInGeneratedForm" = TRUE OR ef."DefaultInView" = TRUE)
   LIMIT 1;
  IF p_ID_b1a7c3e5d901 IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
      'IncludeInGeneratedForm', p_IncludeInGeneratedForm_b1a7c3e5d901,
      'DefaultInView', p_DefaultInView_b1a7c3e5d901,
      'ID', p_ID_b1a7c3e5d901
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_b1a7c3e5d901, p_DefaultInView := p_DefaultInView_b1a7c3e5d901, p_ID := p_ID_b1a7c3e5d901);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_IncludeInGeneratedForm_b1a7c3e5d902 BOOLEAN;
  p_DefaultInView_b1a7c3e5d902 BOOLEAN;
  p_ID_b1a7c3e5d902 UUID;
BEGIN
  p_IncludeInGeneratedForm_b1a7c3e5d902 := FALSE;
  p_DefaultInView_b1a7c3e5d902 := FALSE;
  -- The field is found by entity name + field name; only while either flag is still on.
  SELECT ef."ID" INTO p_ID_b1a7c3e5d902
    FROM "${mjSchema}"."EntityField" ef
    JOIN "${mjSchema}"."Entity" e ON e."ID" = ef."EntityID"
   WHERE e."Name" = 'MJ_BizApps_Sales: Deals' AND ef."Name" = 'PredictedWinRiskBand'
     AND (ef."IncludeInGeneratedForm" = TRUE OR ef."DefaultInView" = TRUE)
   LIMIT 1;
  IF p_ID_b1a7c3e5d902 IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
      'IncludeInGeneratedForm', p_IncludeInGeneratedForm_b1a7c3e5d902,
      'DefaultInView', p_DefaultInView_b1a7c3e5d902,
      'ID', p_ID_b1a7c3e5d902
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_b1a7c3e5d902, p_DefaultInView := p_DefaultInView_b1a7c3e5d902, p_ID := p_ID_b1a7c3e5d902);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_IncludeInGeneratedForm_b1a7c3e5d903 BOOLEAN;
  p_DefaultInView_b1a7c3e5d903 BOOLEAN;
  p_ID_b1a7c3e5d903 UUID;
BEGIN
  p_IncludeInGeneratedForm_b1a7c3e5d903 := FALSE;
  p_DefaultInView_b1a7c3e5d903 := FALSE;
  -- The field is found by entity name + field name; only while either flag is still on.
  SELECT ef."ID" INTO p_ID_b1a7c3e5d903
    FROM "${mjSchema}"."EntityField" ef
    JOIN "${mjSchema}"."Entity" e ON e."ID" = ef."EntityID"
   WHERE e."Name" = 'MJ_BizApps_Sales: Deals' AND ef."Name" = 'PredictedWinScoredAt'
     AND (ef."IncludeInGeneratedForm" = TRUE OR ef."DefaultInView" = TRUE)
   LIMIT 1;
  IF p_ID_b1a7c3e5d903 IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
      'IncludeInGeneratedForm', p_IncludeInGeneratedForm_b1a7c3e5d903,
      'DefaultInView', p_DefaultInView_b1a7c3e5d903,
      'ID', p_ID_b1a7c3e5d903
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_b1a7c3e5d903, p_DefaultInView := p_DefaultInView_b1a7c3e5d903, p_ID := p_ID_b1a7c3e5d903);
    END IF;
  END IF;
END $mj$;
