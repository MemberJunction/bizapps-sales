-- =============================================================================================
-- PostgreSQL counterpart of V202610161328__v6.16.x__Metadata_Sync.sql -- BizApps Sales v6.16.x Metadata_Sync
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.5) on the push log the T-SQL file
--     was generated from. Each record is a DO block that calls the core or app function, in
--     whichever signature the host has (jsonb or named parameters).
--   * The converter does not translate the lookups and guards the T-SQL file adds, so they are
--     written here by hand from the T-SQL ones, block for block:
--       - SELECT TOP 1 @x = [ID] ... ORDER BY ... becomes
--         p_x := COALESCE((SELECT "ID" ... ORDER BY ... LIMIT 1), p_x), which keeps the literal
--         ID when nothing matches, as the T-SQL assignment does.
--       - IF <guard> EXEC ... becomes IF <guard> THEN <call> END IF.
--   * Every string value is taken verbatim from the T-SQL file: the converter rewrites T-SQL
--     inside string literals.
--   * Core calls use ${mjSchema}; this app's schema is written as the converter emits it.
-- =============================================================================================

SET standard_conforming_strings = on;

-- Save MJ_BizApps_Sales: Pipeline Stages (core SP call only)
DO $mj$
DECLARE
  p_ID_2c2057a96432 UUID;
  p_PipelineID_2c2057a96432 UUID;
  p_Name_2c2057a96432 VARCHAR(200);
  p_Code_2c2057a96432 VARCHAR(40);
  p_DisplayOrder_2c2057a96432 INTEGER;
  p_Probability_2c2057a96432 NUMERIC(5,2);
  p_ForecastCategoryTypeID_2c2057a96432 UUID;
  p_DealStatusTypeID_2c2057a96432 UUID;
  p_OrderStatusOnEntry_2c2057a96432 VARCHAR(20);
  p_RottingDays_2c2057a96432 INTEGER;
  p_EntryCriteria_2c2057a96432 TEXT;
  p_ExitCriteria_2c2057a96432 TEXT;
  p_RequiredFields_2c2057a96432 TEXT;
  p_GuidanceMarkdown_2c2057a96432 TEXT;
  p_IsActive_2c2057a96432 BOOLEAN;
BEGIN
  p_ID_2c2057a96432 := '58CC2FFF-21E8-4FB2-A1BA-3BBB1AA372F7';
  p_PipelineID_2c2057a96432 := '90111111-0000-4000-A000-000000000002';
  p_Name_2c2057a96432 := 'Lost';
  p_Code_2c2057a96432 := 'LOST';
  p_DisplayOrder_2c2057a96432 := 40;
  p_Probability_2c2057a96432 := 0;
  p_ForecastCategoryTypeID_2c2057a96432 := '4DAF7153-0005-4E43-A164-8F1DA05C9344';
  p_DealStatusTypeID_2c2057a96432 := '1A7C4E20-0003-4B10-9E31-5C8A7D2F6011';
  p_OrderStatusOnEntry_2c2057a96432 := 'Voided';
  p_GuidanceMarkdown_2c2057a96432 := 'A loss reason is mandatory — it is the highest-value, most-skipped data in any CRM. Entering this stage VOIDS the order.';
  p_IsActive_2c2057a96432 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM ${flyway:defaultSchema}."PipelineStage"
               WHERE "ID" = p_ID_2c2057a96432 OR ("PipelineID" = p_PipelineID_2c2057a96432 AND "Name" = p_Name_2c2057a96432)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_BizAppsSales' AND p.proname = 'spCreatePipelineStage'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsSales."spCreatePipelineStage"(p_data := jsonb_build_object(
      'ID', p_ID_2c2057a96432,
      'PipelineID', p_PipelineID_2c2057a96432,
      'Name', p_Name_2c2057a96432,
      'Code', p_Code_2c2057a96432,
      'DisplayOrder', p_DisplayOrder_2c2057a96432,
      'Probability', p_Probability_2c2057a96432,
      'ForecastCategoryTypeID', p_ForecastCategoryTypeID_2c2057a96432,
      'DealStatusTypeID', p_DealStatusTypeID_2c2057a96432,
      'OrderStatusOnEntry', p_OrderStatusOnEntry_2c2057a96432,
      'RottingDays', p_RottingDays_2c2057a96432,
      'EntryCriteria', p_EntryCriteria_2c2057a96432,
      'ExitCriteria', p_ExitCriteria_2c2057a96432,
      'RequiredFields', p_RequiredFields_2c2057a96432,
      'GuidanceMarkdown', p_GuidanceMarkdown_2c2057a96432,
      'IsActive', p_IsActive_2c2057a96432
    ));
    ELSE
      PERFORM __mj_BizAppsSales."spCreatePipelineStage"(p_ID := p_ID_2c2057a96432, p_PipelineID := p_PipelineID_2c2057a96432, p_Name := p_Name_2c2057a96432, p_Code := p_Code_2c2057a96432, p_DisplayOrder := p_DisplayOrder_2c2057a96432, p_Probability := p_Probability_2c2057a96432, p_ForecastCategoryTypeID := p_ForecastCategoryTypeID_2c2057a96432, p_DealStatusTypeID := p_DealStatusTypeID_2c2057a96432, p_OrderStatusOnEntry := p_OrderStatusOnEntry_2c2057a96432, p_RottingDays := p_RottingDays_2c2057a96432, p_RottingDays_Clear := TRUE, p_EntryCriteria := p_EntryCriteria_2c2057a96432, p_EntryCriteria_Clear := TRUE, p_ExitCriteria := p_ExitCriteria_2c2057a96432, p_ExitCriteria_Clear := TRUE, p_RequiredFields := p_RequiredFields_2c2057a96432, p_RequiredFields_Clear := TRUE, p_GuidanceMarkdown := p_GuidanceMarkdown_2c2057a96432, p_IsActive := p_IsActive_2c2057a96432);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Remote Operations (core SP call only)
DO $mj$
DECLARE
  p_Name_e4c5abba10f1 VARCHAR(255);
  p_OperationKey_e4c5abba10f1 VARCHAR(255);
  p_CategoryID_e4c5abba10f1 UUID;
  p_Description_e4c5abba10f1 TEXT;
  p_InputTypeName_e4c5abba10f1 VARCHAR(255);
  p_InputTypeDefinition_e4c5abba10f1 TEXT;
  p_InputTypeIsArray_e4c5abba10f1 BOOLEAN;
  p_OutputTypeName_e4c5abba10f1 VARCHAR(255);
  p_OutputTypeDefinition_e4c5abba10f1 TEXT;
  p_OutputTypeIsArray_e4c5abba10f1 BOOLEAN;
  p_ExecutionMode_e4c5abba10f1 VARCHAR(20);
  p_RequiredScope_e4c5abba10f1 VARCHAR(255);
  p_RequiresSystemUser_e4c5abba10f1 BOOLEAN;
  p_GenerationType_e4c5abba10f1 VARCHAR(20);
  p_Code_e4c5abba10f1 TEXT;
  p_CodeApprovalStatus_e4c5abba10f1 VARCHAR(20);
  p_CodeApprovedByUserID_e4c5abba10f1 UUID;
  p_CodeApprovedAt_e4c5abba10f1 TIMESTAMPTZ;
  p_ContractFingerprint_e4c5abba10f1 VARCHAR(100);
  p_Status_e4c5abba10f1 VARCHAR(20);
  p_CacheTTLSeconds_e4c5abba10f1 INTEGER;
  p_TimeoutMS_e4c5abba10f1 INTEGER;
  p_MaxConcurrency_e4c5abba10f1 INTEGER;
  p_CodeLocked_e4c5abba10f1 BOOLEAN;
  p_CodeComments_e4c5abba10f1 TEXT;
  p_Libraries_e4c5abba10f1 TEXT;
  p_ID_e4c5abba10f1 UUID;
BEGIN
  p_Name_e4c5abba10f1 := 'Close Deal';
  p_OperationKey_e4c5abba10f1 := 'Sales.CloseDeal';
  p_CategoryID_e4c5abba10f1 := 'D4F8A162-9C35-4E71-B0A8-3F17C5E2D801';
  p_Description_e4c5abba10f1 := 'Close a deal into a target status, in ONE transaction: validate it is closeable, resolve the effective CloseWonPolicy (pipeline default + caller overrides), route lines to a contract and/or an order per that policy, append the DealStageEvent, stamp ActualCloseDate/ClosedAt/ClosedByUserID, and apply the close lock when the status carries LocksDeal. Routing is decided by the policy and by DealStatusType FLAGS — never by a pipeline or status NAME. Sales passes intent only; every figure is computed downstream by orders.';
  p_InputTypeName_e4c5abba10f1 := 'SalesCloseDealInput';
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
     * it" is expressed without a per-deal policy column — see CLOSE-FLOW-DECISIONS.md D-CF6.
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
  p_InputTypeIsArray_e4c5abba10f1 := FALSE;
  p_OutputTypeName_e4c5abba10f1 := 'SalesCloseDealOutput';
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
 * RETURNED EVEN WHEN THE CALL WAS STUBBED, and `Executed` is what says which. Today both downstreams
 * are stubs (CLOSE-FLOW-DECISIONS.md D-CF3/D-CF4), so a close reports `Planned: true,
 * Executed: false` with a reason — the intent is auditable now and the flag flips to true when the
 * seam lands, with no shape change.
 */
export interface SalesCloseRoutingResult {
    /** `Contract` | `Order` | `Subscription`. */
    Target: string;
    /** The policy said this should happen. */
    Planned: boolean;
    /** It actually happened. False while the downstream is stubbed. */
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
  p_OutputTypeIsArray_e4c5abba10f1 := FALSE;
  p_ExecutionMode_e4c5abba10f1 := 'Sync';
  p_RequiredScope_e4c5abba10f1 := 'sales:write';
  p_RequiresSystemUser_e4c5abba10f1 := FALSE;
  p_GenerationType_e4c5abba10f1 := 'Manual';
  p_CodeApprovalStatus_e4c5abba10f1 := 'Approved';
  p_Status_e4c5abba10f1 := 'Active';
  p_CodeLocked_e4c5abba10f1 := FALSE;
  p_ID_e4c5abba10f1 := 'D4F8A162-0002-4E71-B0A8-3F17C5E2D802';
  p_ID_e4c5abba10f1 := COALESCE((SELECT "ID" FROM "${mjSchema}"."RemoteOperation" WHERE "OperationKey" = 'Sales.CloseDeal' ORDER BY CASE WHEN "ID" = p_ID_e4c5abba10f1 THEN 0 ELSE 1 END LIMIT 1), p_ID_e4c5abba10f1);
  p_CategoryID_e4c5abba10f1 := COALESCE((SELECT "ID" FROM "${mjSchema}"."RemoteOperationCategory" WHERE "Name" = 'Deal Lifecycle' ORDER BY CASE WHEN "ID" = p_CategoryID_e4c5abba10f1 THEN 0 ELSE 1 END LIMIT 1), p_CategoryID_e4c5abba10f1);
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateRemoteOperation'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_data := jsonb_build_object(
    'Name', p_Name_e4c5abba10f1,
    'OperationKey', p_OperationKey_e4c5abba10f1,
    'CategoryID', p_CategoryID_e4c5abba10f1,
    'Description', p_Description_e4c5abba10f1,
    'InputTypeName', p_InputTypeName_e4c5abba10f1,
    'InputTypeDefinition', p_InputTypeDefinition_e4c5abba10f1,
    'InputTypeIsArray', p_InputTypeIsArray_e4c5abba10f1,
    'OutputTypeName', p_OutputTypeName_e4c5abba10f1,
    'OutputTypeDefinition', p_OutputTypeDefinition_e4c5abba10f1,
    'OutputTypeIsArray', p_OutputTypeIsArray_e4c5abba10f1,
    'ExecutionMode', p_ExecutionMode_e4c5abba10f1,
    'RequiredScope', p_RequiredScope_e4c5abba10f1,
    'RequiresSystemUser', p_RequiresSystemUser_e4c5abba10f1,
    'GenerationType', p_GenerationType_e4c5abba10f1,
    'Code', p_Code_e4c5abba10f1,
    'CodeApprovalStatus', p_CodeApprovalStatus_e4c5abba10f1,
    'CodeApprovedByUserID', p_CodeApprovedByUserID_e4c5abba10f1,
    'CodeApprovedAt', p_CodeApprovedAt_e4c5abba10f1,
    'ContractFingerprint', p_ContractFingerprint_e4c5abba10f1,
    'Status', p_Status_e4c5abba10f1,
    'CacheTTLSeconds', p_CacheTTLSeconds_e4c5abba10f1,
    'TimeoutMS', p_TimeoutMS_e4c5abba10f1,
    'MaxConcurrency', p_MaxConcurrency_e4c5abba10f1,
    'CodeLocked', p_CodeLocked_e4c5abba10f1,
    'CodeComments', p_CodeComments_e4c5abba10f1,
    'Libraries', p_Libraries_e4c5abba10f1,
    'ID', p_ID_e4c5abba10f1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_Name := p_Name_e4c5abba10f1, p_OperationKey := p_OperationKey_e4c5abba10f1, p_CategoryID := p_CategoryID_e4c5abba10f1, p_Description := p_Description_e4c5abba10f1, p_InputTypeName := p_InputTypeName_e4c5abba10f1, p_InputTypeDefinition := p_InputTypeDefinition_e4c5abba10f1, p_InputTypeIsArray := p_InputTypeIsArray_e4c5abba10f1, p_OutputTypeName := p_OutputTypeName_e4c5abba10f1, p_OutputTypeDefinition := p_OutputTypeDefinition_e4c5abba10f1, p_OutputTypeIsArray := p_OutputTypeIsArray_e4c5abba10f1, p_ExecutionMode := p_ExecutionMode_e4c5abba10f1, p_RequiredScope := p_RequiredScope_e4c5abba10f1, p_RequiresSystemUser := p_RequiresSystemUser_e4c5abba10f1, p_GenerationType := p_GenerationType_e4c5abba10f1, p_Code := p_Code_e4c5abba10f1, p_Code_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_e4c5abba10f1, p_CodeApprovedByUserID := p_CodeApprovedByUserID_e4c5abba10f1, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_e4c5abba10f1, p_CodeApprovedAt_Clear := TRUE, p_ContractFingerprint := p_ContractFingerprint_e4c5abba10f1, p_ContractFingerprint_Clear := TRUE, p_Status := p_Status_e4c5abba10f1, p_CacheTTLSeconds := p_CacheTTLSeconds_e4c5abba10f1, p_CacheTTLSeconds_Clear := TRUE, p_TimeoutMS := p_TimeoutMS_e4c5abba10f1, p_TimeoutMS_Clear := TRUE, p_MaxConcurrency := p_MaxConcurrency_e4c5abba10f1, p_MaxConcurrency_Clear := TRUE, p_CodeLocked := p_CodeLocked_e4c5abba10f1, p_CodeComments := p_CodeComments_e4c5abba10f1, p_CodeComments_Clear := TRUE, p_Libraries := p_Libraries_e4c5abba10f1, p_Libraries_Clear := TRUE, p_ID := p_ID_e4c5abba10f1);
  END IF;
END $mj$;

-- Save MJ: Remote Operations (core SP call only)
DO $mj$
DECLARE
  p_Name_bec77cc5dfad VARCHAR(255);
  p_OperationKey_bec77cc5dfad VARCHAR(255);
  p_CategoryID_bec77cc5dfad UUID;
  p_Description_bec77cc5dfad TEXT;
  p_InputTypeName_bec77cc5dfad VARCHAR(255);
  p_InputTypeDefinition_bec77cc5dfad TEXT;
  p_InputTypeIsArray_bec77cc5dfad BOOLEAN;
  p_OutputTypeName_bec77cc5dfad VARCHAR(255);
  p_OutputTypeDefinition_bec77cc5dfad TEXT;
  p_OutputTypeIsArray_bec77cc5dfad BOOLEAN;
  p_ExecutionMode_bec77cc5dfad VARCHAR(20);
  p_RequiredScope_bec77cc5dfad VARCHAR(255);
  p_RequiresSystemUser_bec77cc5dfad BOOLEAN;
  p_GenerationType_bec77cc5dfad VARCHAR(20);
  p_Code_bec77cc5dfad TEXT;
  p_CodeApprovalStatus_bec77cc5dfad VARCHAR(20);
  p_CodeApprovedByUserID_bec77cc5dfad UUID;
  p_CodeApprovedAt_bec77cc5dfad TIMESTAMPTZ;
  p_ContractFingerprint_bec77cc5dfad VARCHAR(100);
  p_Status_bec77cc5dfad VARCHAR(20);
  p_CacheTTLSeconds_bec77cc5dfad INTEGER;
  p_TimeoutMS_bec77cc5dfad INTEGER;
  p_MaxConcurrency_bec77cc5dfad INTEGER;
  p_CodeLocked_bec77cc5dfad BOOLEAN;
  p_CodeComments_bec77cc5dfad TEXT;
  p_Libraries_bec77cc5dfad TEXT;
  p_ID_bec77cc5dfad UUID;
BEGIN
  p_Name_bec77cc5dfad := 'Reopen Deal';
  p_OperationKey_bec77cc5dfad := 'Sales.ReopenDeal';
  p_CategoryID_bec77cc5dfad := 'D4F8A162-9C35-4E71-B0A8-3F17C5E2D801';
  p_Description_bec77cc5dfad := 'Reopen a locked deal into a non-locking status, recording a mandatory reason. Appends a DealStageEvent, clears the close stamps, and releases the immutability enforced by DealEntityServer.Save(). The only sanctioned exit from the close lock (§7.3).';
  p_InputTypeName_bec77cc5dfad := 'SalesReopenDealInput';
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
     * it" is expressed without a per-deal policy column — see CLOSE-FLOW-DECISIONS.md D-CF6.
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
  p_InputTypeIsArray_bec77cc5dfad := FALSE;
  p_OutputTypeName_bec77cc5dfad := 'SalesReopenDealOutput';
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
 * RETURNED EVEN WHEN THE CALL WAS STUBBED, and `Executed` is what says which. Today both downstreams
 * are stubs (CLOSE-FLOW-DECISIONS.md D-CF3/D-CF4), so a close reports `Planned: true,
 * Executed: false` with a reason — the intent is auditable now and the flag flips to true when the
 * seam lands, with no shape change.
 */
export interface SalesCloseRoutingResult {
    /** `Contract` | `Order` | `Subscription`. */
    Target: string;
    /** The policy said this should happen. */
    Planned: boolean;
    /** It actually happened. False while the downstream is stubbed. */
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
  p_OutputTypeIsArray_bec77cc5dfad := FALSE;
  p_ExecutionMode_bec77cc5dfad := 'Sync';
  p_RequiredScope_bec77cc5dfad := 'sales:write';
  p_RequiresSystemUser_bec77cc5dfad := FALSE;
  p_GenerationType_bec77cc5dfad := 'Manual';
  p_CodeApprovalStatus_bec77cc5dfad := 'Approved';
  p_Status_bec77cc5dfad := 'Active';
  p_CodeLocked_bec77cc5dfad := FALSE;
  p_ID_bec77cc5dfad := 'D4F8A162-0003-4E71-B0A8-3F17C5E2D802';
  p_ID_bec77cc5dfad := COALESCE((SELECT "ID" FROM "${mjSchema}"."RemoteOperation" WHERE "OperationKey" = 'Sales.ReopenDeal' ORDER BY CASE WHEN "ID" = p_ID_bec77cc5dfad THEN 0 ELSE 1 END LIMIT 1), p_ID_bec77cc5dfad);
  p_CategoryID_bec77cc5dfad := COALESCE((SELECT "ID" FROM "${mjSchema}"."RemoteOperationCategory" WHERE "Name" = 'Deal Lifecycle' ORDER BY CASE WHEN "ID" = p_CategoryID_bec77cc5dfad THEN 0 ELSE 1 END LIMIT 1), p_CategoryID_bec77cc5dfad);
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateRemoteOperation'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_data := jsonb_build_object(
    'Name', p_Name_bec77cc5dfad,
    'OperationKey', p_OperationKey_bec77cc5dfad,
    'CategoryID', p_CategoryID_bec77cc5dfad,
    'Description', p_Description_bec77cc5dfad,
    'InputTypeName', p_InputTypeName_bec77cc5dfad,
    'InputTypeDefinition', p_InputTypeDefinition_bec77cc5dfad,
    'InputTypeIsArray', p_InputTypeIsArray_bec77cc5dfad,
    'OutputTypeName', p_OutputTypeName_bec77cc5dfad,
    'OutputTypeDefinition', p_OutputTypeDefinition_bec77cc5dfad,
    'OutputTypeIsArray', p_OutputTypeIsArray_bec77cc5dfad,
    'ExecutionMode', p_ExecutionMode_bec77cc5dfad,
    'RequiredScope', p_RequiredScope_bec77cc5dfad,
    'RequiresSystemUser', p_RequiresSystemUser_bec77cc5dfad,
    'GenerationType', p_GenerationType_bec77cc5dfad,
    'Code', p_Code_bec77cc5dfad,
    'CodeApprovalStatus', p_CodeApprovalStatus_bec77cc5dfad,
    'CodeApprovedByUserID', p_CodeApprovedByUserID_bec77cc5dfad,
    'CodeApprovedAt', p_CodeApprovedAt_bec77cc5dfad,
    'ContractFingerprint', p_ContractFingerprint_bec77cc5dfad,
    'Status', p_Status_bec77cc5dfad,
    'CacheTTLSeconds', p_CacheTTLSeconds_bec77cc5dfad,
    'TimeoutMS', p_TimeoutMS_bec77cc5dfad,
    'MaxConcurrency', p_MaxConcurrency_bec77cc5dfad,
    'CodeLocked', p_CodeLocked_bec77cc5dfad,
    'CodeComments', p_CodeComments_bec77cc5dfad,
    'Libraries', p_Libraries_bec77cc5dfad,
    'ID', p_ID_bec77cc5dfad
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_Name := p_Name_bec77cc5dfad, p_OperationKey := p_OperationKey_bec77cc5dfad, p_CategoryID := p_CategoryID_bec77cc5dfad, p_Description := p_Description_bec77cc5dfad, p_InputTypeName := p_InputTypeName_bec77cc5dfad, p_InputTypeDefinition := p_InputTypeDefinition_bec77cc5dfad, p_InputTypeIsArray := p_InputTypeIsArray_bec77cc5dfad, p_OutputTypeName := p_OutputTypeName_bec77cc5dfad, p_OutputTypeDefinition := p_OutputTypeDefinition_bec77cc5dfad, p_OutputTypeIsArray := p_OutputTypeIsArray_bec77cc5dfad, p_ExecutionMode := p_ExecutionMode_bec77cc5dfad, p_RequiredScope := p_RequiredScope_bec77cc5dfad, p_RequiresSystemUser := p_RequiresSystemUser_bec77cc5dfad, p_GenerationType := p_GenerationType_bec77cc5dfad, p_Code := p_Code_bec77cc5dfad, p_Code_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_bec77cc5dfad, p_CodeApprovedByUserID := p_CodeApprovedByUserID_bec77cc5dfad, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_bec77cc5dfad, p_CodeApprovedAt_Clear := TRUE, p_ContractFingerprint := p_ContractFingerprint_bec77cc5dfad, p_ContractFingerprint_Clear := TRUE, p_Status := p_Status_bec77cc5dfad, p_CacheTTLSeconds := p_CacheTTLSeconds_bec77cc5dfad, p_CacheTTLSeconds_Clear := TRUE, p_TimeoutMS := p_TimeoutMS_bec77cc5dfad, p_TimeoutMS_Clear := TRUE, p_MaxConcurrency := p_MaxConcurrency_bec77cc5dfad, p_MaxConcurrency_Clear := TRUE, p_CodeLocked := p_CodeLocked_bec77cc5dfad, p_CodeComments := p_CodeComments_bec77cc5dfad, p_CodeComments_Clear := TRUE, p_Libraries := p_Libraries_bec77cc5dfad, p_Libraries_Clear := TRUE, p_ID := p_ID_bec77cc5dfad);
  END IF;
END $mj$;

-- Save MJ: Actions (core SP call only)
DO $mj$
DECLARE
  p_ID_39ec01e49a1e UUID;
  p_CategoryID_39ec01e49a1e UUID;
  p_Name_39ec01e49a1e VARCHAR(425);
  p_Description_39ec01e49a1e TEXT;
  p_Type_39ec01e49a1e VARCHAR(20);
  p_UserPrompt_39ec01e49a1e TEXT;
  p_UserComments_39ec01e49a1e TEXT;
  p_Code_39ec01e49a1e TEXT;
  p_CodeComments_39ec01e49a1e TEXT;
  p_CodeApprovalStatus_39ec01e49a1e VARCHAR(20);
  p_CodeApprovalComments_39ec01e49a1e TEXT;
  p_CodeApprovedByUserID_39ec01e49a1e UUID;
  p_CodeApprovedAt_39ec01e49a1e TIMESTAMPTZ;
  p_CodeLocked_39ec01e49a1e BOOLEAN;
  p_ForceCodeGeneration_39ec01e49a1e BOOLEAN;
  p_RetentionPeriod_39ec01e49a1e INTEGER;
  p_Status_39ec01e49a1e VARCHAR(20);
  p_DriverClass_39ec01e49a1e VARCHAR(255);
  p_ParentID_39ec01e49a1e UUID;
  p_IconClass_39ec01e49a1e VARCHAR(100);
  p_DefaultCompactPromptID_39ec01e49a1e UUID;
  p_Config_39ec01e49a1e TEXT;
  p_RuntimeActionConfiguration_39ec01e49a1e TEXT;
  p_MaxExecutionTimeMS_39ec01e49a1e INTEGER;
  p_CreatedByAgentID_39ec01e49a1e UUID;
BEGIN
  p_ID_39ec01e49a1e := 'DD7CEF7B-C75B-42F8-8D7A-45B9503A6D19';
  p_CategoryID_39ec01e49a1e := '5A1E5000-0000-4000-8000-000000000001';
  p_Name_39ec01e49a1e := 'Relink Won Deal Orders To Contracts';
  p_Description_39ec01e49a1e := 'Link every won deal''s order to its contract where the deal has both and no link exists, so contracts can copy the contract''s renewal terms to the order''s subscriptions. Idempotent: an existing link is left alone. Skips while the installed bizapps-contracts has no order links.';
  p_Type_39ec01e49a1e := 'Custom';
  p_UserPrompt_39ec01e49a1e := 'Link won deals'' orders to their contracts where the link is missing.';
  p_CodeApprovalStatus_39ec01e49a1e := 'Approved';
  p_CodeLocked_39ec01e49a1e := FALSE;
  p_ForceCodeGeneration_39ec01e49a1e := FALSE;
  p_Status_39ec01e49a1e := 'Active';
  p_DriverClass_39ec01e49a1e := 'Sales.RelinkWonDealOrdersToContracts';
  p_IconClass_39ec01e49a1e := 'fa-solid fa-link';
  p_CategoryID_39ec01e49a1e := COALESCE((SELECT "ID" FROM "${mjSchema}"."ActionCategory" WHERE "Name" = 'Sales' ORDER BY CASE WHEN "ID" = p_CategoryID_39ec01e49a1e THEN 0 ELSE 1 END LIMIT 1), p_CategoryID_39ec01e49a1e);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Action" WHERE "ID" = p_ID_39ec01e49a1e OR "Name" = p_Name_39ec01e49a1e) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAction'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAction"(p_data := jsonb_build_object(
      'ID', p_ID_39ec01e49a1e,
      'CategoryID', p_CategoryID_39ec01e49a1e,
      'Name', p_Name_39ec01e49a1e,
      'Description', p_Description_39ec01e49a1e,
      'Type', p_Type_39ec01e49a1e,
      'UserPrompt', p_UserPrompt_39ec01e49a1e,
      'UserComments', p_UserComments_39ec01e49a1e,
      'Code', p_Code_39ec01e49a1e,
      'CodeComments', p_CodeComments_39ec01e49a1e,
      'CodeApprovalStatus', p_CodeApprovalStatus_39ec01e49a1e,
      'CodeApprovalComments', p_CodeApprovalComments_39ec01e49a1e,
      'CodeApprovedByUserID', p_CodeApprovedByUserID_39ec01e49a1e,
      'CodeApprovedAt', p_CodeApprovedAt_39ec01e49a1e,
      'CodeLocked', p_CodeLocked_39ec01e49a1e,
      'ForceCodeGeneration', p_ForceCodeGeneration_39ec01e49a1e,
      'RetentionPeriod', p_RetentionPeriod_39ec01e49a1e,
      'Status', p_Status_39ec01e49a1e,
      'DriverClass', p_DriverClass_39ec01e49a1e,
      'ParentID', p_ParentID_39ec01e49a1e,
      'IconClass', p_IconClass_39ec01e49a1e,
      'DefaultCompactPromptID', p_DefaultCompactPromptID_39ec01e49a1e,
      'Config', p_Config_39ec01e49a1e,
      'RuntimeActionConfiguration', p_RuntimeActionConfiguration_39ec01e49a1e,
      'MaxExecutionTimeMS', p_MaxExecutionTimeMS_39ec01e49a1e,
      'CreatedByAgentID', p_CreatedByAgentID_39ec01e49a1e
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAction"(p_ID := p_ID_39ec01e49a1e, p_CategoryID := p_CategoryID_39ec01e49a1e, p_Name := p_Name_39ec01e49a1e, p_Description := p_Description_39ec01e49a1e, p_Type := p_Type_39ec01e49a1e, p_UserPrompt := p_UserPrompt_39ec01e49a1e, p_UserComments := p_UserComments_39ec01e49a1e, p_UserComments_Clear := TRUE, p_Code := p_Code_39ec01e49a1e, p_Code_Clear := TRUE, p_CodeComments := p_CodeComments_39ec01e49a1e, p_CodeComments_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_39ec01e49a1e, p_CodeApprovalComments := p_CodeApprovalComments_39ec01e49a1e, p_CodeApprovalComments_Clear := TRUE, p_CodeApprovedByUserID := p_CodeApprovedByUserID_39ec01e49a1e, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_39ec01e49a1e, p_CodeApprovedAt_Clear := TRUE, p_CodeLocked := p_CodeLocked_39ec01e49a1e, p_ForceCodeGeneration := p_ForceCodeGeneration_39ec01e49a1e, p_RetentionPeriod := p_RetentionPeriod_39ec01e49a1e, p_RetentionPeriod_Clear := TRUE, p_Status := p_Status_39ec01e49a1e, p_DriverClass := p_DriverClass_39ec01e49a1e, p_ParentID := p_ParentID_39ec01e49a1e, p_ParentID_Clear := TRUE, p_IconClass := p_IconClass_39ec01e49a1e, p_DefaultCompactPromptID := p_DefaultCompactPromptID_39ec01e49a1e, p_DefaultCompactPromptID_Clear := TRUE, p_Config := p_Config_39ec01e49a1e, p_Config_Clear := TRUE, p_RuntimeActionConfiguration := p_RuntimeActionConfiguration_39ec01e49a1e, p_RuntimeActionConfiguration_Clear := TRUE, p_MaxExecutionTimeMS := p_MaxExecutionTimeMS_39ec01e49a1e, p_MaxExecutionTimeMS_Clear := TRUE, p_CreatedByAgentID := p_CreatedByAgentID_39ec01e49a1e, p_CreatedByAgentID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Actions (core SP call only)
DO $mj$
DECLARE
  p_ID_29aca4e28d7e UUID;
  p_CategoryID_29aca4e28d7e UUID;
  p_Name_29aca4e28d7e VARCHAR(425);
  p_Description_29aca4e28d7e TEXT;
  p_Type_29aca4e28d7e VARCHAR(20);
  p_UserPrompt_29aca4e28d7e TEXT;
  p_UserComments_29aca4e28d7e TEXT;
  p_Code_29aca4e28d7e TEXT;
  p_CodeComments_29aca4e28d7e TEXT;
  p_CodeApprovalStatus_29aca4e28d7e VARCHAR(20);
  p_CodeApprovalComments_29aca4e28d7e TEXT;
  p_CodeApprovedByUserID_29aca4e28d7e UUID;
  p_CodeApprovedAt_29aca4e28d7e TIMESTAMPTZ;
  p_CodeLocked_29aca4e28d7e BOOLEAN;
  p_ForceCodeGeneration_29aca4e28d7e BOOLEAN;
  p_RetentionPeriod_29aca4e28d7e INTEGER;
  p_Status_29aca4e28d7e VARCHAR(20);
  p_DriverClass_29aca4e28d7e VARCHAR(255);
  p_ParentID_29aca4e28d7e UUID;
  p_IconClass_29aca4e28d7e VARCHAR(100);
  p_DefaultCompactPromptID_29aca4e28d7e UUID;
  p_Config_29aca4e28d7e TEXT;
  p_RuntimeActionConfiguration_29aca4e28d7e TEXT;
  p_MaxExecutionTimeMS_29aca4e28d7e INTEGER;
  p_CreatedByAgentID_29aca4e28d7e UUID;
BEGIN
  p_ID_29aca4e28d7e := '097952C6-0D37-4395-87FD-998AEDD8ECA4';
  p_CategoryID_29aca4e28d7e := '5A1E5000-0000-4000-8000-000000000001';
  p_Name_29aca4e28d7e := 'Copy Default Pipeline To Companies';
  p_Description_29aca4e28d7e := 'Copy the default pipeline (IsDefault = 1) and all of its stages onto every company that has no pipeline with the same Code. Each company''s copy saves in one transaction; a failure is reported per company and does not undo the others. Re-runnable: companies that already have the pipeline are skipped.';
  p_Type_29aca4e28d7e := 'Custom';
  p_UserPrompt_29aca4e28d7e := 'Give every company its own copy of the default sales pipeline.';
  p_CodeApprovalStatus_29aca4e28d7e := 'Approved';
  p_CodeLocked_29aca4e28d7e := FALSE;
  p_ForceCodeGeneration_29aca4e28d7e := FALSE;
  p_Status_29aca4e28d7e := 'Active';
  p_DriverClass_29aca4e28d7e := 'Sales.CopyDefaultPipelineToCompanies';
  p_IconClass_29aca4e28d7e := 'fa-solid fa-code-branch';
  p_CategoryID_29aca4e28d7e := COALESCE((SELECT "ID" FROM "${mjSchema}"."ActionCategory" WHERE "Name" = 'Sales' ORDER BY CASE WHEN "ID" = p_CategoryID_29aca4e28d7e THEN 0 ELSE 1 END LIMIT 1), p_CategoryID_29aca4e28d7e);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Action" WHERE "ID" = p_ID_29aca4e28d7e OR "Name" = p_Name_29aca4e28d7e) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAction'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAction"(p_data := jsonb_build_object(
      'ID', p_ID_29aca4e28d7e,
      'CategoryID', p_CategoryID_29aca4e28d7e,
      'Name', p_Name_29aca4e28d7e,
      'Description', p_Description_29aca4e28d7e,
      'Type', p_Type_29aca4e28d7e,
      'UserPrompt', p_UserPrompt_29aca4e28d7e,
      'UserComments', p_UserComments_29aca4e28d7e,
      'Code', p_Code_29aca4e28d7e,
      'CodeComments', p_CodeComments_29aca4e28d7e,
      'CodeApprovalStatus', p_CodeApprovalStatus_29aca4e28d7e,
      'CodeApprovalComments', p_CodeApprovalComments_29aca4e28d7e,
      'CodeApprovedByUserID', p_CodeApprovedByUserID_29aca4e28d7e,
      'CodeApprovedAt', p_CodeApprovedAt_29aca4e28d7e,
      'CodeLocked', p_CodeLocked_29aca4e28d7e,
      'ForceCodeGeneration', p_ForceCodeGeneration_29aca4e28d7e,
      'RetentionPeriod', p_RetentionPeriod_29aca4e28d7e,
      'Status', p_Status_29aca4e28d7e,
      'DriverClass', p_DriverClass_29aca4e28d7e,
      'ParentID', p_ParentID_29aca4e28d7e,
      'IconClass', p_IconClass_29aca4e28d7e,
      'DefaultCompactPromptID', p_DefaultCompactPromptID_29aca4e28d7e,
      'Config', p_Config_29aca4e28d7e,
      'RuntimeActionConfiguration', p_RuntimeActionConfiguration_29aca4e28d7e,
      'MaxExecutionTimeMS', p_MaxExecutionTimeMS_29aca4e28d7e,
      'CreatedByAgentID', p_CreatedByAgentID_29aca4e28d7e
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAction"(p_ID := p_ID_29aca4e28d7e, p_CategoryID := p_CategoryID_29aca4e28d7e, p_Name := p_Name_29aca4e28d7e, p_Description := p_Description_29aca4e28d7e, p_Type := p_Type_29aca4e28d7e, p_UserPrompt := p_UserPrompt_29aca4e28d7e, p_UserComments := p_UserComments_29aca4e28d7e, p_UserComments_Clear := TRUE, p_Code := p_Code_29aca4e28d7e, p_Code_Clear := TRUE, p_CodeComments := p_CodeComments_29aca4e28d7e, p_CodeComments_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_29aca4e28d7e, p_CodeApprovalComments := p_CodeApprovalComments_29aca4e28d7e, p_CodeApprovalComments_Clear := TRUE, p_CodeApprovedByUserID := p_CodeApprovedByUserID_29aca4e28d7e, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_29aca4e28d7e, p_CodeApprovedAt_Clear := TRUE, p_CodeLocked := p_CodeLocked_29aca4e28d7e, p_ForceCodeGeneration := p_ForceCodeGeneration_29aca4e28d7e, p_RetentionPeriod := p_RetentionPeriod_29aca4e28d7e, p_RetentionPeriod_Clear := TRUE, p_Status := p_Status_29aca4e28d7e, p_DriverClass := p_DriverClass_29aca4e28d7e, p_ParentID := p_ParentID_29aca4e28d7e, p_ParentID_Clear := TRUE, p_IconClass := p_IconClass_29aca4e28d7e, p_DefaultCompactPromptID := p_DefaultCompactPromptID_29aca4e28d7e, p_DefaultCompactPromptID_Clear := TRUE, p_Config := p_Config_29aca4e28d7e, p_Config_Clear := TRUE, p_RuntimeActionConfiguration := p_RuntimeActionConfiguration_29aca4e28d7e, p_RuntimeActionConfiguration_Clear := TRUE, p_MaxExecutionTimeMS := p_MaxExecutionTimeMS_29aca4e28d7e, p_MaxExecutionTimeMS_Clear := TRUE, p_CreatedByAgentID := p_CreatedByAgentID_29aca4e28d7e, p_CreatedByAgentID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Scheduled Jobs (core SP call only)
DO $mj$
DECLARE
  p_ID_874a2c925cc4 UUID;
  p_JobTypeID_874a2c925cc4 UUID;
  p_Name_874a2c925cc4 VARCHAR(200);
  p_Description_874a2c925cc4 TEXT;
  p_CronExpression_874a2c925cc4 VARCHAR(120);
  p_Timezone_874a2c925cc4 VARCHAR(64);
  p_StartAt_874a2c925cc4 TIMESTAMPTZ;
  p_EndAt_874a2c925cc4 TIMESTAMPTZ;
  p_Status_874a2c925cc4 VARCHAR(20);
  p_Configuration_874a2c925cc4 TEXT;
  p_OwnerUserID_874a2c925cc4 UUID;
  p_LastRunAt_874a2c925cc4 TIMESTAMPTZ;
  p_NextRunAt_874a2c925cc4 TIMESTAMPTZ;
  p_RunCount_874a2c925cc4 INTEGER;
  p_SuccessCount_874a2c925cc4 INTEGER;
  p_FailureCount_874a2c925cc4 INTEGER;
  p_NotifyOnSuccess_874a2c925cc4 BOOLEAN;
  p_NotifyOnFailure_874a2c925cc4 BOOLEAN;
  p_NotifyUserID_874a2c925cc4 UUID;
  p_NotifyViaEmail_874a2c925cc4 BOOLEAN;
  p_NotifyViaInApp_874a2c925cc4 BOOLEAN;
  p_LockToken_874a2c925cc4 UUID;
  p_LockedAt_874a2c925cc4 TIMESTAMPTZ;
  p_LockedByInstance_874a2c925cc4 VARCHAR(255);
  p_ExpectedCompletionAt_874a2c925cc4 TIMESTAMPTZ;
  p_ConcurrencyMode_874a2c925cc4 VARCHAR(20);
  p_RunImmediatelyIfNeverRun_874a2c925cc4 BOOLEAN;
  p_MaxRuntimeMinutes_874a2c925cc4 INTEGER;
  p_MissedRunPolicy_874a2c925cc4 VARCHAR(20);
BEGIN
  p_ID_874a2c925cc4 := 'B1E51D67-B681-40F7-A2AD-FF84D2C2A6EC';
  p_JobTypeID_874a2c925cc4 := '3B94DD43-E961-4D85-B7F4-B6783D748766';
  p_Name_874a2c925cc4 := 'Sales — Relink Won Deal Orders To Contracts (daily)';
  p_Description_874a2c925cc4 := 'Links each won deal''s order to its contract where the link is missing. Skips while the installed bizapps-contracts has no order links.';
  p_CronExpression_874a2c925cc4 := '0 0 1 * * *';
  p_Timezone_874a2c925cc4 := 'UTC';
  p_Status_874a2c925cc4 := 'Active';
  p_Configuration_874a2c925cc4 := '{"ActionID":"DD7CEF7B-C75B-42F8-8D7A-45B9503A6D19","Params":[]}';
  p_RunCount_874a2c925cc4 := 0;
  p_SuccessCount_874a2c925cc4 := 0;
  p_FailureCount_874a2c925cc4 := 0;
  p_NotifyOnSuccess_874a2c925cc4 := FALSE;
  p_NotifyOnFailure_874a2c925cc4 := FALSE;
  p_NotifyViaEmail_874a2c925cc4 := FALSE;
  p_NotifyViaInApp_874a2c925cc4 := FALSE;
  p_ConcurrencyMode_874a2c925cc4 := 'Skip';
  p_RunImmediatelyIfNeverRun_874a2c925cc4 := TRUE;
  p_MaxRuntimeMinutes_874a2c925cc4 := 15;
  p_MissedRunPolicy_874a2c925cc4 := 'RunOnce';
  IF p_JobTypeID_874a2c925cc4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."ScheduledJob"
               WHERE "ID" = p_ID_874a2c925cc4 OR "Name" = p_Name_874a2c925cc4) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateScheduledJob'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateScheduledJob"(p_data := jsonb_build_object(
      'ID', p_ID_874a2c925cc4,
      'JobTypeID', p_JobTypeID_874a2c925cc4,
      'Name', p_Name_874a2c925cc4,
      'Description', p_Description_874a2c925cc4,
      'CronExpression', p_CronExpression_874a2c925cc4,
      'Timezone', p_Timezone_874a2c925cc4,
      'StartAt', p_StartAt_874a2c925cc4,
      'EndAt', p_EndAt_874a2c925cc4,
      'Status', p_Status_874a2c925cc4,
      'Configuration', p_Configuration_874a2c925cc4,
      'OwnerUserID', p_OwnerUserID_874a2c925cc4,
      'LastRunAt', p_LastRunAt_874a2c925cc4,
      'NextRunAt', p_NextRunAt_874a2c925cc4,
      'RunCount', p_RunCount_874a2c925cc4,
      'SuccessCount', p_SuccessCount_874a2c925cc4,
      'FailureCount', p_FailureCount_874a2c925cc4,
      'NotifyOnSuccess', p_NotifyOnSuccess_874a2c925cc4,
      'NotifyOnFailure', p_NotifyOnFailure_874a2c925cc4,
      'NotifyUserID', p_NotifyUserID_874a2c925cc4,
      'NotifyViaEmail', p_NotifyViaEmail_874a2c925cc4,
      'NotifyViaInApp', p_NotifyViaInApp_874a2c925cc4,
      'LockToken', p_LockToken_874a2c925cc4,
      'LockedAt', p_LockedAt_874a2c925cc4,
      'LockedByInstance', p_LockedByInstance_874a2c925cc4,
      'ExpectedCompletionAt', p_ExpectedCompletionAt_874a2c925cc4,
      'ConcurrencyMode', p_ConcurrencyMode_874a2c925cc4,
      'RunImmediatelyIfNeverRun', p_RunImmediatelyIfNeverRun_874a2c925cc4,
      'MaxRuntimeMinutes', p_MaxRuntimeMinutes_874a2c925cc4,
      'MissedRunPolicy', p_MissedRunPolicy_874a2c925cc4
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateScheduledJob"(p_ID := p_ID_874a2c925cc4, p_JobTypeID := p_JobTypeID_874a2c925cc4, p_Name := p_Name_874a2c925cc4, p_Description := p_Description_874a2c925cc4, p_CronExpression := p_CronExpression_874a2c925cc4, p_Timezone := p_Timezone_874a2c925cc4, p_StartAt := p_StartAt_874a2c925cc4, p_StartAt_Clear := TRUE, p_EndAt := p_EndAt_874a2c925cc4, p_EndAt_Clear := TRUE, p_Status := p_Status_874a2c925cc4, p_Configuration := p_Configuration_874a2c925cc4, p_OwnerUserID := p_OwnerUserID_874a2c925cc4, p_OwnerUserID_Clear := TRUE, p_LastRunAt := p_LastRunAt_874a2c925cc4, p_LastRunAt_Clear := TRUE, p_NextRunAt := p_NextRunAt_874a2c925cc4, p_NextRunAt_Clear := TRUE, p_RunCount := p_RunCount_874a2c925cc4, p_SuccessCount := p_SuccessCount_874a2c925cc4, p_FailureCount := p_FailureCount_874a2c925cc4, p_NotifyOnSuccess := p_NotifyOnSuccess_874a2c925cc4, p_NotifyOnFailure := p_NotifyOnFailure_874a2c925cc4, p_NotifyUserID := p_NotifyUserID_874a2c925cc4, p_NotifyUserID_Clear := TRUE, p_NotifyViaEmail := p_NotifyViaEmail_874a2c925cc4, p_NotifyViaInApp := p_NotifyViaInApp_874a2c925cc4, p_LockToken := p_LockToken_874a2c925cc4, p_LockToken_Clear := TRUE, p_LockedAt := p_LockedAt_874a2c925cc4, p_LockedAt_Clear := TRUE, p_LockedByInstance := p_LockedByInstance_874a2c925cc4, p_LockedByInstance_Clear := TRUE, p_ExpectedCompletionAt := p_ExpectedCompletionAt_874a2c925cc4, p_ExpectedCompletionAt_Clear := TRUE, p_ConcurrencyMode := p_ConcurrencyMode_874a2c925cc4, p_RunImmediatelyIfNeverRun := p_RunImmediatelyIfNeverRun_874a2c925cc4, p_MaxRuntimeMinutes := p_MaxRuntimeMinutes_874a2c925cc4, p_MissedRunPolicy := p_MissedRunPolicy_874a2c925cc4);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_a3e987eedd8f VARCHAR(255);
  p_Description_a3e987eedd8f TEXT;
  p_AutoUpdateDescription_a3e987eedd8f BOOLEAN;
  p_IsPrimaryKey_a3e987eedd8f BOOLEAN;
  p_IsUnique_a3e987eedd8f BOOLEAN;
  p_Category_a3e987eedd8f VARCHAR(255);
  p_ValueListType_a3e987eedd8f VARCHAR(20);
  p_ExtendedType_a3e987eedd8f VARCHAR(50);
  p_CodeType_a3e987eedd8f VARCHAR(50);
  p_DefaultInView_a3e987eedd8f BOOLEAN;
  p_ViewCellTemplate_a3e987eedd8f TEXT;
  p_DefaultColumnWidth_a3e987eedd8f INTEGER;
  p_AllowUpdateAPI_a3e987eedd8f BOOLEAN;
  p_AllowUpdateInView_a3e987eedd8f BOOLEAN;
  p_IncludeInUserSearchAPI_a3e987eedd8f BOOLEAN;
  p_FullTextSearchEnabled_a3e987eedd8f BOOLEAN;
  p_UserSearchParamFormatAPI_a3e987eedd8f VARCHAR(500);
  p_IncludeInGeneratedForm_a3e987eedd8f BOOLEAN;
  p_GeneratedFormSection_a3e987eedd8f VARCHAR(10);
  p_IsNameField_a3e987eedd8f BOOLEAN;
  p_RelatedEntityID_a3e987eedd8f UUID;
  p_RelatedEntityFieldName_a3e987eedd8f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_a3e987eedd8f BOOLEAN;
  p_RelatedEntityNameFieldMap_a3e987eedd8f VARCHAR(255);
  p_RelatedEntityDisplayType_a3e987eedd8f VARCHAR(20);
  p_EntityIDFieldName_a3e987eedd8f VARCHAR(100);
  p_ScopeDefault_a3e987eedd8f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_a3e987eedd8f BOOLEAN;
  p_ValuesToPackWithSchema_a3e987eedd8f VARCHAR(10);
  p_Status_a3e987eedd8f VARCHAR(25);
  p_AutoUpdateIsNameField_a3e987eedd8f BOOLEAN;
  p_AutoUpdateDefaultInView_a3e987eedd8f BOOLEAN;
  p_AutoUpdateCategory_a3e987eedd8f BOOLEAN;
  p_AutoUpdateDisplayName_a3e987eedd8f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_a3e987eedd8f BOOLEAN;
  p_Encrypt_a3e987eedd8f BOOLEAN;
  p_EncryptionKeyID_a3e987eedd8f UUID;
  p_AllowDecryptInAPI_a3e987eedd8f BOOLEAN;
  p_SendEncryptedValue_a3e987eedd8f BOOLEAN;
  p_IsSoftPrimaryKey_a3e987eedd8f BOOLEAN;
  p_IsSoftForeignKey_a3e987eedd8f BOOLEAN;
  p_RelatedEntityJoinFields_a3e987eedd8f TEXT;
  p_JSONType_a3e987eedd8f VARCHAR(255);
  p_JSONTypeIsArray_a3e987eedd8f BOOLEAN;
  p_JSONTypeDefinition_a3e987eedd8f TEXT;
  p_UserSearchPredicateAPI_a3e987eedd8f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_a3e987eedd8f BOOLEAN;
  p_AutoUpdateFullTextSearch_a3e987eedd8f BOOLEAN;
  p_AutoUpdateExtendedType_a3e987eedd8f BOOLEAN;
  p_IsComputed_a3e987eedd8f BOOLEAN;
  p_EmbeddedRecord_a3e987eedd8f TEXT;
  p_Configuration_a3e987eedd8f TEXT;
  p_ID_a3e987eedd8f UUID;
BEGIN
  p_DisplayName_a3e987eedd8f := 'Closed At';
  p_Description_a3e987eedd8f := 'The moment the deal was closed. Set by closing the deal and cleared by reopening it; it cannot be edited. For when an open deal is expected to close, use Expected Close Date.';
  p_AutoUpdateDescription_a3e987eedd8f := FALSE;
  p_IsPrimaryKey_a3e987eedd8f := FALSE;
  p_IsUnique_a3e987eedd8f := FALSE;
  p_ValueListType_a3e987eedd8f := 'None';
  p_DefaultInView_a3e987eedd8f := FALSE;
  p_DefaultColumnWidth_a3e987eedd8f := 100;
  p_AllowUpdateAPI_a3e987eedd8f := TRUE;
  p_AllowUpdateInView_a3e987eedd8f := TRUE;
  p_IncludeInUserSearchAPI_a3e987eedd8f := FALSE;
  p_FullTextSearchEnabled_a3e987eedd8f := FALSE;
  p_IncludeInGeneratedForm_a3e987eedd8f := TRUE;
  p_GeneratedFormSection_a3e987eedd8f := 'Details';
  p_IsNameField_a3e987eedd8f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_a3e987eedd8f := FALSE;
  p_RelatedEntityDisplayType_a3e987eedd8f := 'Search';
  p_AutoUpdateRelatedEntityInfo_a3e987eedd8f := TRUE;
  p_ValuesToPackWithSchema_a3e987eedd8f := 'Auto';
  p_Status_a3e987eedd8f := 'Active';
  p_AutoUpdateIsNameField_a3e987eedd8f := TRUE;
  p_AutoUpdateDefaultInView_a3e987eedd8f := TRUE;
  p_AutoUpdateCategory_a3e987eedd8f := TRUE;
  p_AutoUpdateDisplayName_a3e987eedd8f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_a3e987eedd8f := TRUE;
  p_Encrypt_a3e987eedd8f := FALSE;
  p_AllowDecryptInAPI_a3e987eedd8f := FALSE;
  p_SendEncryptedValue_a3e987eedd8f := FALSE;
  p_IsSoftPrimaryKey_a3e987eedd8f := FALSE;
  p_IsSoftForeignKey_a3e987eedd8f := FALSE;
  p_JSONTypeIsArray_a3e987eedd8f := FALSE;
  p_UserSearchPredicateAPI_a3e987eedd8f := 'Contains';
  p_AutoUpdateUserSearchPredicate_a3e987eedd8f := TRUE;
  p_AutoUpdateFullTextSearch_a3e987eedd8f := TRUE;
  p_AutoUpdateExtendedType_a3e987eedd8f := TRUE;
  p_IsComputed_a3e987eedd8f := FALSE;
  p_ID_a3e987eedd8f := '3C6BF8FE-39AB-4613-A857-1D01CED1BE44';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_a3e987eedd8f,
    'Description', p_Description_a3e987eedd8f,
    'AutoUpdateDescription', p_AutoUpdateDescription_a3e987eedd8f,
    'IsPrimaryKey', p_IsPrimaryKey_a3e987eedd8f,
    'IsUnique', p_IsUnique_a3e987eedd8f,
    'Category', p_Category_a3e987eedd8f,
    'ValueListType', p_ValueListType_a3e987eedd8f,
    'ExtendedType', p_ExtendedType_a3e987eedd8f,
    'CodeType', p_CodeType_a3e987eedd8f,
    'DefaultInView', p_DefaultInView_a3e987eedd8f,
    'ViewCellTemplate', p_ViewCellTemplate_a3e987eedd8f,
    'DefaultColumnWidth', p_DefaultColumnWidth_a3e987eedd8f,
    'AllowUpdateAPI', p_AllowUpdateAPI_a3e987eedd8f,
    'AllowUpdateInView', p_AllowUpdateInView_a3e987eedd8f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_a3e987eedd8f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_a3e987eedd8f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_a3e987eedd8f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_a3e987eedd8f,
    'GeneratedFormSection', p_GeneratedFormSection_a3e987eedd8f,
    'IsNameField', p_IsNameField_a3e987eedd8f,
    'RelatedEntityID', p_RelatedEntityID_a3e987eedd8f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_a3e987eedd8f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_a3e987eedd8f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_a3e987eedd8f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_a3e987eedd8f,
    'EntityIDFieldName', p_EntityIDFieldName_a3e987eedd8f,
    'ScopeDefault', p_ScopeDefault_a3e987eedd8f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_a3e987eedd8f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_a3e987eedd8f,
    'Status', p_Status_a3e987eedd8f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_a3e987eedd8f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_a3e987eedd8f,
    'AutoUpdateCategory', p_AutoUpdateCategory_a3e987eedd8f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_a3e987eedd8f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_a3e987eedd8f,
    'Encrypt', p_Encrypt_a3e987eedd8f,
    'EncryptionKeyID', p_EncryptionKeyID_a3e987eedd8f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_a3e987eedd8f,
    'SendEncryptedValue', p_SendEncryptedValue_a3e987eedd8f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_a3e987eedd8f,
    'IsSoftForeignKey', p_IsSoftForeignKey_a3e987eedd8f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_a3e987eedd8f,
    'JSONType', p_JSONType_a3e987eedd8f,
    'JSONTypeIsArray', p_JSONTypeIsArray_a3e987eedd8f,
    'JSONTypeDefinition', p_JSONTypeDefinition_a3e987eedd8f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_a3e987eedd8f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_a3e987eedd8f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_a3e987eedd8f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_a3e987eedd8f,
    'IsComputed', p_IsComputed_a3e987eedd8f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_a3e987eedd8f,
    'Configuration', p_Configuration_a3e987eedd8f,
    'ID', p_ID_a3e987eedd8f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_a3e987eedd8f, p_Description := p_Description_a3e987eedd8f, p_AutoUpdateDescription := p_AutoUpdateDescription_a3e987eedd8f, p_IsPrimaryKey := p_IsPrimaryKey_a3e987eedd8f, p_IsUnique := p_IsUnique_a3e987eedd8f, p_Category := p_Category_a3e987eedd8f, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_a3e987eedd8f, p_ExtendedType := p_ExtendedType_a3e987eedd8f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_a3e987eedd8f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_a3e987eedd8f, p_ViewCellTemplate := p_ViewCellTemplate_a3e987eedd8f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_a3e987eedd8f, p_AllowUpdateAPI := p_AllowUpdateAPI_a3e987eedd8f, p_AllowUpdateInView := p_AllowUpdateInView_a3e987eedd8f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_a3e987eedd8f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_a3e987eedd8f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_a3e987eedd8f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_a3e987eedd8f, p_GeneratedFormSection := p_GeneratedFormSection_a3e987eedd8f, p_IsNameField := p_IsNameField_a3e987eedd8f, p_RelatedEntityID := p_RelatedEntityID_a3e987eedd8f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_a3e987eedd8f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_a3e987eedd8f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_a3e987eedd8f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_a3e987eedd8f, p_EntityIDFieldName := p_EntityIDFieldName_a3e987eedd8f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_a3e987eedd8f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_a3e987eedd8f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_a3e987eedd8f, p_Status := p_Status_a3e987eedd8f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_a3e987eedd8f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_a3e987eedd8f, p_AutoUpdateCategory := p_AutoUpdateCategory_a3e987eedd8f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_a3e987eedd8f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_a3e987eedd8f, p_Encrypt := p_Encrypt_a3e987eedd8f, p_EncryptionKeyID := p_EncryptionKeyID_a3e987eedd8f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_a3e987eedd8f, p_SendEncryptedValue := p_SendEncryptedValue_a3e987eedd8f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_a3e987eedd8f, p_IsSoftForeignKey := p_IsSoftForeignKey_a3e987eedd8f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_a3e987eedd8f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_a3e987eedd8f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_a3e987eedd8f, p_JSONTypeDefinition := p_JSONTypeDefinition_a3e987eedd8f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_a3e987eedd8f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_a3e987eedd8f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_a3e987eedd8f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_a3e987eedd8f, p_IsComputed := p_IsComputed_a3e987eedd8f, p_EmbeddedRecord := p_EmbeddedRecord_a3e987eedd8f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_a3e987eedd8f, p_Configuration_Clear := TRUE, p_ID := p_ID_a3e987eedd8f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_1cd14b185cee VARCHAR(255);
  p_Description_1cd14b185cee TEXT;
  p_AutoUpdateDescription_1cd14b185cee BOOLEAN;
  p_IsPrimaryKey_1cd14b185cee BOOLEAN;
  p_IsUnique_1cd14b185cee BOOLEAN;
  p_Category_1cd14b185cee VARCHAR(255);
  p_ValueListType_1cd14b185cee VARCHAR(20);
  p_ExtendedType_1cd14b185cee VARCHAR(50);
  p_CodeType_1cd14b185cee VARCHAR(50);
  p_DefaultInView_1cd14b185cee BOOLEAN;
  p_ViewCellTemplate_1cd14b185cee TEXT;
  p_DefaultColumnWidth_1cd14b185cee INTEGER;
  p_AllowUpdateAPI_1cd14b185cee BOOLEAN;
  p_AllowUpdateInView_1cd14b185cee BOOLEAN;
  p_IncludeInUserSearchAPI_1cd14b185cee BOOLEAN;
  p_FullTextSearchEnabled_1cd14b185cee BOOLEAN;
  p_UserSearchParamFormatAPI_1cd14b185cee VARCHAR(500);
  p_IncludeInGeneratedForm_1cd14b185cee BOOLEAN;
  p_GeneratedFormSection_1cd14b185cee VARCHAR(10);
  p_IsNameField_1cd14b185cee BOOLEAN;
  p_RelatedEntityID_1cd14b185cee UUID;
  p_RelatedEntityFieldName_1cd14b185cee VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_1cd14b185cee BOOLEAN;
  p_RelatedEntityNameFieldMap_1cd14b185cee VARCHAR(255);
  p_RelatedEntityDisplayType_1cd14b185cee VARCHAR(20);
  p_EntityIDFieldName_1cd14b185cee VARCHAR(100);
  p_ScopeDefault_1cd14b185cee VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_1cd14b185cee BOOLEAN;
  p_ValuesToPackWithSchema_1cd14b185cee VARCHAR(10);
  p_Status_1cd14b185cee VARCHAR(25);
  p_AutoUpdateIsNameField_1cd14b185cee BOOLEAN;
  p_AutoUpdateDefaultInView_1cd14b185cee BOOLEAN;
  p_AutoUpdateCategory_1cd14b185cee BOOLEAN;
  p_AutoUpdateDisplayName_1cd14b185cee BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_1cd14b185cee BOOLEAN;
  p_Encrypt_1cd14b185cee BOOLEAN;
  p_EncryptionKeyID_1cd14b185cee UUID;
  p_AllowDecryptInAPI_1cd14b185cee BOOLEAN;
  p_SendEncryptedValue_1cd14b185cee BOOLEAN;
  p_IsSoftPrimaryKey_1cd14b185cee BOOLEAN;
  p_IsSoftForeignKey_1cd14b185cee BOOLEAN;
  p_RelatedEntityJoinFields_1cd14b185cee TEXT;
  p_JSONType_1cd14b185cee VARCHAR(255);
  p_JSONTypeIsArray_1cd14b185cee BOOLEAN;
  p_JSONTypeDefinition_1cd14b185cee TEXT;
  p_UserSearchPredicateAPI_1cd14b185cee VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_1cd14b185cee BOOLEAN;
  p_AutoUpdateFullTextSearch_1cd14b185cee BOOLEAN;
  p_AutoUpdateExtendedType_1cd14b185cee BOOLEAN;
  p_IsComputed_1cd14b185cee BOOLEAN;
  p_EmbeddedRecord_1cd14b185cee TEXT;
  p_Configuration_1cd14b185cee TEXT;
  p_ID_1cd14b185cee UUID;
BEGIN
  p_DisplayName_1cd14b185cee := 'Actual Close Date';
  p_Description_1cd14b185cee := 'The business day the deal closed on, in its company''s time zone. Set by closing the deal and cleared by reopening it; it cannot be edited. For when an open deal is expected to close, use Expected Close Date.';
  p_AutoUpdateDescription_1cd14b185cee := FALSE;
  p_IsPrimaryKey_1cd14b185cee := FALSE;
  p_IsUnique_1cd14b185cee := FALSE;
  p_ValueListType_1cd14b185cee := 'None';
  p_DefaultInView_1cd14b185cee := FALSE;
  p_DefaultColumnWidth_1cd14b185cee := 150;
  p_AllowUpdateAPI_1cd14b185cee := TRUE;
  p_AllowUpdateInView_1cd14b185cee := TRUE;
  p_IncludeInUserSearchAPI_1cd14b185cee := FALSE;
  p_FullTextSearchEnabled_1cd14b185cee := FALSE;
  p_IncludeInGeneratedForm_1cd14b185cee := TRUE;
  p_GeneratedFormSection_1cd14b185cee := 'Details';
  p_IsNameField_1cd14b185cee := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_1cd14b185cee := FALSE;
  p_RelatedEntityDisplayType_1cd14b185cee := 'Search';
  p_AutoUpdateRelatedEntityInfo_1cd14b185cee := TRUE;
  p_ValuesToPackWithSchema_1cd14b185cee := 'Auto';
  p_Status_1cd14b185cee := 'Active';
  p_AutoUpdateIsNameField_1cd14b185cee := TRUE;
  p_AutoUpdateDefaultInView_1cd14b185cee := TRUE;
  p_AutoUpdateCategory_1cd14b185cee := TRUE;
  p_AutoUpdateDisplayName_1cd14b185cee := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_1cd14b185cee := TRUE;
  p_Encrypt_1cd14b185cee := FALSE;
  p_AllowDecryptInAPI_1cd14b185cee := FALSE;
  p_SendEncryptedValue_1cd14b185cee := FALSE;
  p_IsSoftPrimaryKey_1cd14b185cee := FALSE;
  p_IsSoftForeignKey_1cd14b185cee := FALSE;
  p_JSONTypeIsArray_1cd14b185cee := FALSE;
  p_UserSearchPredicateAPI_1cd14b185cee := 'Contains';
  p_AutoUpdateUserSearchPredicate_1cd14b185cee := TRUE;
  p_AutoUpdateFullTextSearch_1cd14b185cee := TRUE;
  p_AutoUpdateExtendedType_1cd14b185cee := TRUE;
  p_IsComputed_1cd14b185cee := FALSE;
  p_ID_1cd14b185cee := '43F7976A-C33B-461E-B160-A4629DC6E114';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_1cd14b185cee,
    'Description', p_Description_1cd14b185cee,
    'AutoUpdateDescription', p_AutoUpdateDescription_1cd14b185cee,
    'IsPrimaryKey', p_IsPrimaryKey_1cd14b185cee,
    'IsUnique', p_IsUnique_1cd14b185cee,
    'Category', p_Category_1cd14b185cee,
    'ValueListType', p_ValueListType_1cd14b185cee,
    'ExtendedType', p_ExtendedType_1cd14b185cee,
    'CodeType', p_CodeType_1cd14b185cee,
    'DefaultInView', p_DefaultInView_1cd14b185cee,
    'ViewCellTemplate', p_ViewCellTemplate_1cd14b185cee,
    'DefaultColumnWidth', p_DefaultColumnWidth_1cd14b185cee,
    'AllowUpdateAPI', p_AllowUpdateAPI_1cd14b185cee,
    'AllowUpdateInView', p_AllowUpdateInView_1cd14b185cee,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_1cd14b185cee,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_1cd14b185cee,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_1cd14b185cee,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_1cd14b185cee,
    'GeneratedFormSection', p_GeneratedFormSection_1cd14b185cee,
    'IsNameField', p_IsNameField_1cd14b185cee,
    'RelatedEntityID', p_RelatedEntityID_1cd14b185cee,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_1cd14b185cee,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_1cd14b185cee,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_1cd14b185cee,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_1cd14b185cee,
    'EntityIDFieldName', p_EntityIDFieldName_1cd14b185cee,
    'ScopeDefault', p_ScopeDefault_1cd14b185cee,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_1cd14b185cee,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_1cd14b185cee,
    'Status', p_Status_1cd14b185cee,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_1cd14b185cee,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_1cd14b185cee,
    'AutoUpdateCategory', p_AutoUpdateCategory_1cd14b185cee,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_1cd14b185cee,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_1cd14b185cee,
    'Encrypt', p_Encrypt_1cd14b185cee,
    'EncryptionKeyID', p_EncryptionKeyID_1cd14b185cee,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_1cd14b185cee,
    'SendEncryptedValue', p_SendEncryptedValue_1cd14b185cee,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_1cd14b185cee,
    'IsSoftForeignKey', p_IsSoftForeignKey_1cd14b185cee,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_1cd14b185cee,
    'JSONType', p_JSONType_1cd14b185cee,
    'JSONTypeIsArray', p_JSONTypeIsArray_1cd14b185cee,
    'JSONTypeDefinition', p_JSONTypeDefinition_1cd14b185cee,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_1cd14b185cee,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_1cd14b185cee,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_1cd14b185cee,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_1cd14b185cee,
    'IsComputed', p_IsComputed_1cd14b185cee
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_1cd14b185cee,
    'Configuration', p_Configuration_1cd14b185cee,
    'ID', p_ID_1cd14b185cee
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_1cd14b185cee, p_Description := p_Description_1cd14b185cee, p_AutoUpdateDescription := p_AutoUpdateDescription_1cd14b185cee, p_IsPrimaryKey := p_IsPrimaryKey_1cd14b185cee, p_IsUnique := p_IsUnique_1cd14b185cee, p_Category := p_Category_1cd14b185cee, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_1cd14b185cee, p_ExtendedType := p_ExtendedType_1cd14b185cee, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_1cd14b185cee, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_1cd14b185cee, p_ViewCellTemplate := p_ViewCellTemplate_1cd14b185cee, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_1cd14b185cee, p_AllowUpdateAPI := p_AllowUpdateAPI_1cd14b185cee, p_AllowUpdateInView := p_AllowUpdateInView_1cd14b185cee, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_1cd14b185cee, p_FullTextSearchEnabled := p_FullTextSearchEnabled_1cd14b185cee, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_1cd14b185cee, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_1cd14b185cee, p_GeneratedFormSection := p_GeneratedFormSection_1cd14b185cee, p_IsNameField := p_IsNameField_1cd14b185cee, p_RelatedEntityID := p_RelatedEntityID_1cd14b185cee, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_1cd14b185cee, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_1cd14b185cee, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_1cd14b185cee, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_1cd14b185cee, p_EntityIDFieldName := p_EntityIDFieldName_1cd14b185cee, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_1cd14b185cee, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_1cd14b185cee, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_1cd14b185cee, p_Status := p_Status_1cd14b185cee, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_1cd14b185cee, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_1cd14b185cee, p_AutoUpdateCategory := p_AutoUpdateCategory_1cd14b185cee, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_1cd14b185cee, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_1cd14b185cee, p_Encrypt := p_Encrypt_1cd14b185cee, p_EncryptionKeyID := p_EncryptionKeyID_1cd14b185cee, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_1cd14b185cee, p_SendEncryptedValue := p_SendEncryptedValue_1cd14b185cee, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_1cd14b185cee, p_IsSoftForeignKey := p_IsSoftForeignKey_1cd14b185cee, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_1cd14b185cee, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_1cd14b185cee, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_1cd14b185cee, p_JSONTypeDefinition := p_JSONTypeDefinition_1cd14b185cee, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_1cd14b185cee, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_1cd14b185cee, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_1cd14b185cee, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_1cd14b185cee, p_IsComputed := p_IsComputed_1cd14b185cee, p_EmbeddedRecord := p_EmbeddedRecord_1cd14b185cee, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_1cd14b185cee, p_Configuration_Clear := TRUE, p_ID := p_ID_1cd14b185cee);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_66d0b0fbf56b VARCHAR(255);
  p_Description_66d0b0fbf56b TEXT;
  p_AutoUpdateDescription_66d0b0fbf56b BOOLEAN;
  p_IsPrimaryKey_66d0b0fbf56b BOOLEAN;
  p_IsUnique_66d0b0fbf56b BOOLEAN;
  p_Category_66d0b0fbf56b VARCHAR(255);
  p_ValueListType_66d0b0fbf56b VARCHAR(20);
  p_ExtendedType_66d0b0fbf56b VARCHAR(50);
  p_CodeType_66d0b0fbf56b VARCHAR(50);
  p_DefaultInView_66d0b0fbf56b BOOLEAN;
  p_ViewCellTemplate_66d0b0fbf56b TEXT;
  p_DefaultColumnWidth_66d0b0fbf56b INTEGER;
  p_AllowUpdateAPI_66d0b0fbf56b BOOLEAN;
  p_AllowUpdateInView_66d0b0fbf56b BOOLEAN;
  p_IncludeInUserSearchAPI_66d0b0fbf56b BOOLEAN;
  p_FullTextSearchEnabled_66d0b0fbf56b BOOLEAN;
  p_UserSearchParamFormatAPI_66d0b0fbf56b VARCHAR(500);
  p_IncludeInGeneratedForm_66d0b0fbf56b BOOLEAN;
  p_GeneratedFormSection_66d0b0fbf56b VARCHAR(10);
  p_IsNameField_66d0b0fbf56b BOOLEAN;
  p_RelatedEntityID_66d0b0fbf56b UUID;
  p_RelatedEntityFieldName_66d0b0fbf56b VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_66d0b0fbf56b BOOLEAN;
  p_RelatedEntityNameFieldMap_66d0b0fbf56b VARCHAR(255);
  p_RelatedEntityDisplayType_66d0b0fbf56b VARCHAR(20);
  p_EntityIDFieldName_66d0b0fbf56b VARCHAR(100);
  p_ScopeDefault_66d0b0fbf56b VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_66d0b0fbf56b BOOLEAN;
  p_ValuesToPackWithSchema_66d0b0fbf56b VARCHAR(10);
  p_Status_66d0b0fbf56b VARCHAR(25);
  p_AutoUpdateIsNameField_66d0b0fbf56b BOOLEAN;
  p_AutoUpdateDefaultInView_66d0b0fbf56b BOOLEAN;
  p_AutoUpdateCategory_66d0b0fbf56b BOOLEAN;
  p_AutoUpdateDisplayName_66d0b0fbf56b BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_66d0b0fbf56b BOOLEAN;
  p_Encrypt_66d0b0fbf56b BOOLEAN;
  p_EncryptionKeyID_66d0b0fbf56b UUID;
  p_AllowDecryptInAPI_66d0b0fbf56b BOOLEAN;
  p_SendEncryptedValue_66d0b0fbf56b BOOLEAN;
  p_IsSoftPrimaryKey_66d0b0fbf56b BOOLEAN;
  p_IsSoftForeignKey_66d0b0fbf56b BOOLEAN;
  p_RelatedEntityJoinFields_66d0b0fbf56b TEXT;
  p_JSONType_66d0b0fbf56b VARCHAR(255);
  p_JSONTypeIsArray_66d0b0fbf56b BOOLEAN;
  p_JSONTypeDefinition_66d0b0fbf56b TEXT;
  p_UserSearchPredicateAPI_66d0b0fbf56b VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_66d0b0fbf56b BOOLEAN;
  p_AutoUpdateFullTextSearch_66d0b0fbf56b BOOLEAN;
  p_AutoUpdateExtendedType_66d0b0fbf56b BOOLEAN;
  p_IsComputed_66d0b0fbf56b BOOLEAN;
  p_EmbeddedRecord_66d0b0fbf56b TEXT;
  p_Configuration_66d0b0fbf56b TEXT;
  p_ID_66d0b0fbf56b UUID;
BEGIN
  p_DisplayName_66d0b0fbf56b := 'Closed By User ID';
  p_Description_66d0b0fbf56b := 'The user who closed the deal. Set by closing the deal and cleared by reopening it; it cannot be edited.';
  p_AutoUpdateDescription_66d0b0fbf56b := FALSE;
  p_IsPrimaryKey_66d0b0fbf56b := FALSE;
  p_IsUnique_66d0b0fbf56b := FALSE;
  p_ValueListType_66d0b0fbf56b := 'None';
  p_DefaultInView_66d0b0fbf56b := FALSE;
  p_DefaultColumnWidth_66d0b0fbf56b := 150;
  p_AllowUpdateAPI_66d0b0fbf56b := TRUE;
  p_AllowUpdateInView_66d0b0fbf56b := TRUE;
  p_IncludeInUserSearchAPI_66d0b0fbf56b := FALSE;
  p_FullTextSearchEnabled_66d0b0fbf56b := FALSE;
  p_IncludeInGeneratedForm_66d0b0fbf56b := TRUE;
  p_GeneratedFormSection_66d0b0fbf56b := 'Details';
  p_IsNameField_66d0b0fbf56b := FALSE;
  p_RelatedEntityID_66d0b0fbf56b := 'E1238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_66d0b0fbf56b := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_66d0b0fbf56b := TRUE;
  p_RelatedEntityNameFieldMap_66d0b0fbf56b := 'ClosedByUser';
  p_RelatedEntityDisplayType_66d0b0fbf56b := 'Search';
  p_AutoUpdateRelatedEntityInfo_66d0b0fbf56b := TRUE;
  p_ValuesToPackWithSchema_66d0b0fbf56b := 'Auto';
  p_Status_66d0b0fbf56b := 'Active';
  p_AutoUpdateIsNameField_66d0b0fbf56b := TRUE;
  p_AutoUpdateDefaultInView_66d0b0fbf56b := TRUE;
  p_AutoUpdateCategory_66d0b0fbf56b := TRUE;
  p_AutoUpdateDisplayName_66d0b0fbf56b := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_66d0b0fbf56b := TRUE;
  p_Encrypt_66d0b0fbf56b := FALSE;
  p_AllowDecryptInAPI_66d0b0fbf56b := FALSE;
  p_SendEncryptedValue_66d0b0fbf56b := FALSE;
  p_IsSoftPrimaryKey_66d0b0fbf56b := FALSE;
  p_IsSoftForeignKey_66d0b0fbf56b := FALSE;
  p_JSONTypeIsArray_66d0b0fbf56b := FALSE;
  p_UserSearchPredicateAPI_66d0b0fbf56b := 'Contains';
  p_AutoUpdateUserSearchPredicate_66d0b0fbf56b := TRUE;
  p_AutoUpdateFullTextSearch_66d0b0fbf56b := TRUE;
  p_AutoUpdateExtendedType_66d0b0fbf56b := TRUE;
  p_IsComputed_66d0b0fbf56b := FALSE;
  p_ID_66d0b0fbf56b := '5AF08107-39E1-480C-A468-5F4045E9766D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_66d0b0fbf56b,
    'Description', p_Description_66d0b0fbf56b,
    'AutoUpdateDescription', p_AutoUpdateDescription_66d0b0fbf56b,
    'IsPrimaryKey', p_IsPrimaryKey_66d0b0fbf56b,
    'IsUnique', p_IsUnique_66d0b0fbf56b,
    'Category', p_Category_66d0b0fbf56b,
    'ValueListType', p_ValueListType_66d0b0fbf56b,
    'ExtendedType', p_ExtendedType_66d0b0fbf56b,
    'CodeType', p_CodeType_66d0b0fbf56b,
    'DefaultInView', p_DefaultInView_66d0b0fbf56b,
    'ViewCellTemplate', p_ViewCellTemplate_66d0b0fbf56b,
    'DefaultColumnWidth', p_DefaultColumnWidth_66d0b0fbf56b,
    'AllowUpdateAPI', p_AllowUpdateAPI_66d0b0fbf56b,
    'AllowUpdateInView', p_AllowUpdateInView_66d0b0fbf56b,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_66d0b0fbf56b,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_66d0b0fbf56b,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_66d0b0fbf56b,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_66d0b0fbf56b,
    'GeneratedFormSection', p_GeneratedFormSection_66d0b0fbf56b,
    'IsNameField', p_IsNameField_66d0b0fbf56b,
    'RelatedEntityID', p_RelatedEntityID_66d0b0fbf56b,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_66d0b0fbf56b,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_66d0b0fbf56b,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_66d0b0fbf56b,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_66d0b0fbf56b,
    'EntityIDFieldName', p_EntityIDFieldName_66d0b0fbf56b,
    'ScopeDefault', p_ScopeDefault_66d0b0fbf56b,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_66d0b0fbf56b,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_66d0b0fbf56b,
    'Status', p_Status_66d0b0fbf56b,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_66d0b0fbf56b,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_66d0b0fbf56b,
    'AutoUpdateCategory', p_AutoUpdateCategory_66d0b0fbf56b,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_66d0b0fbf56b,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_66d0b0fbf56b,
    'Encrypt', p_Encrypt_66d0b0fbf56b,
    'EncryptionKeyID', p_EncryptionKeyID_66d0b0fbf56b,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_66d0b0fbf56b,
    'SendEncryptedValue', p_SendEncryptedValue_66d0b0fbf56b,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_66d0b0fbf56b,
    'IsSoftForeignKey', p_IsSoftForeignKey_66d0b0fbf56b,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_66d0b0fbf56b,
    'JSONType', p_JSONType_66d0b0fbf56b,
    'JSONTypeIsArray', p_JSONTypeIsArray_66d0b0fbf56b,
    'JSONTypeDefinition', p_JSONTypeDefinition_66d0b0fbf56b,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_66d0b0fbf56b,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_66d0b0fbf56b,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_66d0b0fbf56b,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_66d0b0fbf56b,
    'IsComputed', p_IsComputed_66d0b0fbf56b
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_66d0b0fbf56b,
    'Configuration', p_Configuration_66d0b0fbf56b,
    'ID', p_ID_66d0b0fbf56b
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_66d0b0fbf56b, p_Description := p_Description_66d0b0fbf56b, p_AutoUpdateDescription := p_AutoUpdateDescription_66d0b0fbf56b, p_IsPrimaryKey := p_IsPrimaryKey_66d0b0fbf56b, p_IsUnique := p_IsUnique_66d0b0fbf56b, p_Category := p_Category_66d0b0fbf56b, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_66d0b0fbf56b, p_ExtendedType := p_ExtendedType_66d0b0fbf56b, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_66d0b0fbf56b, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_66d0b0fbf56b, p_ViewCellTemplate := p_ViewCellTemplate_66d0b0fbf56b, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_66d0b0fbf56b, p_AllowUpdateAPI := p_AllowUpdateAPI_66d0b0fbf56b, p_AllowUpdateInView := p_AllowUpdateInView_66d0b0fbf56b, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_66d0b0fbf56b, p_FullTextSearchEnabled := p_FullTextSearchEnabled_66d0b0fbf56b, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_66d0b0fbf56b, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_66d0b0fbf56b, p_GeneratedFormSection := p_GeneratedFormSection_66d0b0fbf56b, p_IsNameField := p_IsNameField_66d0b0fbf56b, p_RelatedEntityID := p_RelatedEntityID_66d0b0fbf56b, p_RelatedEntityFieldName := p_RelatedEntityFieldName_66d0b0fbf56b, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_66d0b0fbf56b, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_66d0b0fbf56b, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_66d0b0fbf56b, p_EntityIDFieldName := p_EntityIDFieldName_66d0b0fbf56b, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_66d0b0fbf56b, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_66d0b0fbf56b, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_66d0b0fbf56b, p_Status := p_Status_66d0b0fbf56b, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_66d0b0fbf56b, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_66d0b0fbf56b, p_AutoUpdateCategory := p_AutoUpdateCategory_66d0b0fbf56b, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_66d0b0fbf56b, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_66d0b0fbf56b, p_Encrypt := p_Encrypt_66d0b0fbf56b, p_EncryptionKeyID := p_EncryptionKeyID_66d0b0fbf56b, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_66d0b0fbf56b, p_SendEncryptedValue := p_SendEncryptedValue_66d0b0fbf56b, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_66d0b0fbf56b, p_IsSoftForeignKey := p_IsSoftForeignKey_66d0b0fbf56b, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_66d0b0fbf56b, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_66d0b0fbf56b, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_66d0b0fbf56b, p_JSONTypeDefinition := p_JSONTypeDefinition_66d0b0fbf56b, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_66d0b0fbf56b, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_66d0b0fbf56b, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_66d0b0fbf56b, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_66d0b0fbf56b, p_IsComputed := p_IsComputed_66d0b0fbf56b, p_EmbeddedRecord := p_EmbeddedRecord_66d0b0fbf56b, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_66d0b0fbf56b, p_Configuration_Clear := TRUE, p_ID := p_ID_66d0b0fbf56b);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_91eb4aee46e3 VARCHAR(255);
  p_Description_91eb4aee46e3 TEXT;
  p_AutoUpdateDescription_91eb4aee46e3 BOOLEAN;
  p_IsPrimaryKey_91eb4aee46e3 BOOLEAN;
  p_IsUnique_91eb4aee46e3 BOOLEAN;
  p_Category_91eb4aee46e3 VARCHAR(255);
  p_ValueListType_91eb4aee46e3 VARCHAR(20);
  p_ExtendedType_91eb4aee46e3 VARCHAR(50);
  p_CodeType_91eb4aee46e3 VARCHAR(50);
  p_DefaultInView_91eb4aee46e3 BOOLEAN;
  p_ViewCellTemplate_91eb4aee46e3 TEXT;
  p_DefaultColumnWidth_91eb4aee46e3 INTEGER;
  p_AllowUpdateAPI_91eb4aee46e3 BOOLEAN;
  p_AllowUpdateInView_91eb4aee46e3 BOOLEAN;
  p_IncludeInUserSearchAPI_91eb4aee46e3 BOOLEAN;
  p_FullTextSearchEnabled_91eb4aee46e3 BOOLEAN;
  p_UserSearchParamFormatAPI_91eb4aee46e3 VARCHAR(500);
  p_IncludeInGeneratedForm_91eb4aee46e3 BOOLEAN;
  p_GeneratedFormSection_91eb4aee46e3 VARCHAR(10);
  p_IsNameField_91eb4aee46e3 BOOLEAN;
  p_RelatedEntityID_91eb4aee46e3 UUID;
  p_RelatedEntityFieldName_91eb4aee46e3 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_91eb4aee46e3 BOOLEAN;
  p_RelatedEntityNameFieldMap_91eb4aee46e3 VARCHAR(255);
  p_RelatedEntityDisplayType_91eb4aee46e3 VARCHAR(20);
  p_EntityIDFieldName_91eb4aee46e3 VARCHAR(100);
  p_ScopeDefault_91eb4aee46e3 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_91eb4aee46e3 BOOLEAN;
  p_ValuesToPackWithSchema_91eb4aee46e3 VARCHAR(10);
  p_Status_91eb4aee46e3 VARCHAR(25);
  p_AutoUpdateIsNameField_91eb4aee46e3 BOOLEAN;
  p_AutoUpdateDefaultInView_91eb4aee46e3 BOOLEAN;
  p_AutoUpdateCategory_91eb4aee46e3 BOOLEAN;
  p_AutoUpdateDisplayName_91eb4aee46e3 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_91eb4aee46e3 BOOLEAN;
  p_Encrypt_91eb4aee46e3 BOOLEAN;
  p_EncryptionKeyID_91eb4aee46e3 UUID;
  p_AllowDecryptInAPI_91eb4aee46e3 BOOLEAN;
  p_SendEncryptedValue_91eb4aee46e3 BOOLEAN;
  p_IsSoftPrimaryKey_91eb4aee46e3 BOOLEAN;
  p_IsSoftForeignKey_91eb4aee46e3 BOOLEAN;
  p_RelatedEntityJoinFields_91eb4aee46e3 TEXT;
  p_JSONType_91eb4aee46e3 VARCHAR(255);
  p_JSONTypeIsArray_91eb4aee46e3 BOOLEAN;
  p_JSONTypeDefinition_91eb4aee46e3 TEXT;
  p_UserSearchPredicateAPI_91eb4aee46e3 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_91eb4aee46e3 BOOLEAN;
  p_AutoUpdateFullTextSearch_91eb4aee46e3 BOOLEAN;
  p_AutoUpdateExtendedType_91eb4aee46e3 BOOLEAN;
  p_IsComputed_91eb4aee46e3 BOOLEAN;
  p_EmbeddedRecord_91eb4aee46e3 TEXT;
  p_Configuration_91eb4aee46e3 TEXT;
  p_ID_91eb4aee46e3 UUID;
BEGIN
  p_DisplayName_91eb4aee46e3 := 'Expected Close Date';
  p_Description_91eb4aee46e3 := 'The day the deal is expected to close. Update it as the date moves; the actual close date is set when the deal is closed.';
  p_AutoUpdateDescription_91eb4aee46e3 := FALSE;
  p_IsPrimaryKey_91eb4aee46e3 := FALSE;
  p_IsUnique_91eb4aee46e3 := FALSE;
  p_ValueListType_91eb4aee46e3 := 'None';
  p_DefaultInView_91eb4aee46e3 := TRUE;
  p_DefaultColumnWidth_91eb4aee46e3 := 150;
  p_AllowUpdateAPI_91eb4aee46e3 := TRUE;
  p_AllowUpdateInView_91eb4aee46e3 := TRUE;
  p_IncludeInUserSearchAPI_91eb4aee46e3 := FALSE;
  p_FullTextSearchEnabled_91eb4aee46e3 := FALSE;
  p_IncludeInGeneratedForm_91eb4aee46e3 := TRUE;
  p_GeneratedFormSection_91eb4aee46e3 := 'Details';
  p_IsNameField_91eb4aee46e3 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_91eb4aee46e3 := FALSE;
  p_RelatedEntityDisplayType_91eb4aee46e3 := 'Search';
  p_AutoUpdateRelatedEntityInfo_91eb4aee46e3 := TRUE;
  p_ValuesToPackWithSchema_91eb4aee46e3 := 'Auto';
  p_Status_91eb4aee46e3 := 'Active';
  p_AutoUpdateIsNameField_91eb4aee46e3 := TRUE;
  p_AutoUpdateDefaultInView_91eb4aee46e3 := TRUE;
  p_AutoUpdateCategory_91eb4aee46e3 := TRUE;
  p_AutoUpdateDisplayName_91eb4aee46e3 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_91eb4aee46e3 := TRUE;
  p_Encrypt_91eb4aee46e3 := FALSE;
  p_AllowDecryptInAPI_91eb4aee46e3 := FALSE;
  p_SendEncryptedValue_91eb4aee46e3 := FALSE;
  p_IsSoftPrimaryKey_91eb4aee46e3 := FALSE;
  p_IsSoftForeignKey_91eb4aee46e3 := FALSE;
  p_JSONTypeIsArray_91eb4aee46e3 := FALSE;
  p_UserSearchPredicateAPI_91eb4aee46e3 := 'Contains';
  p_AutoUpdateUserSearchPredicate_91eb4aee46e3 := TRUE;
  p_AutoUpdateFullTextSearch_91eb4aee46e3 := TRUE;
  p_AutoUpdateExtendedType_91eb4aee46e3 := TRUE;
  p_IsComputed_91eb4aee46e3 := FALSE;
  p_ID_91eb4aee46e3 := '6AC23D15-33D1-4618-B582-01EC9F40655B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_91eb4aee46e3,
    'Description', p_Description_91eb4aee46e3,
    'AutoUpdateDescription', p_AutoUpdateDescription_91eb4aee46e3,
    'IsPrimaryKey', p_IsPrimaryKey_91eb4aee46e3,
    'IsUnique', p_IsUnique_91eb4aee46e3,
    'Category', p_Category_91eb4aee46e3,
    'ValueListType', p_ValueListType_91eb4aee46e3,
    'ExtendedType', p_ExtendedType_91eb4aee46e3,
    'CodeType', p_CodeType_91eb4aee46e3,
    'DefaultInView', p_DefaultInView_91eb4aee46e3,
    'ViewCellTemplate', p_ViewCellTemplate_91eb4aee46e3,
    'DefaultColumnWidth', p_DefaultColumnWidth_91eb4aee46e3,
    'AllowUpdateAPI', p_AllowUpdateAPI_91eb4aee46e3,
    'AllowUpdateInView', p_AllowUpdateInView_91eb4aee46e3,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_91eb4aee46e3,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_91eb4aee46e3,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_91eb4aee46e3,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_91eb4aee46e3,
    'GeneratedFormSection', p_GeneratedFormSection_91eb4aee46e3,
    'IsNameField', p_IsNameField_91eb4aee46e3,
    'RelatedEntityID', p_RelatedEntityID_91eb4aee46e3,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_91eb4aee46e3,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_91eb4aee46e3,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_91eb4aee46e3,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_91eb4aee46e3,
    'EntityIDFieldName', p_EntityIDFieldName_91eb4aee46e3,
    'ScopeDefault', p_ScopeDefault_91eb4aee46e3,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_91eb4aee46e3,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_91eb4aee46e3,
    'Status', p_Status_91eb4aee46e3,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_91eb4aee46e3,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_91eb4aee46e3,
    'AutoUpdateCategory', p_AutoUpdateCategory_91eb4aee46e3,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_91eb4aee46e3,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_91eb4aee46e3,
    'Encrypt', p_Encrypt_91eb4aee46e3,
    'EncryptionKeyID', p_EncryptionKeyID_91eb4aee46e3,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_91eb4aee46e3,
    'SendEncryptedValue', p_SendEncryptedValue_91eb4aee46e3,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_91eb4aee46e3,
    'IsSoftForeignKey', p_IsSoftForeignKey_91eb4aee46e3,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_91eb4aee46e3,
    'JSONType', p_JSONType_91eb4aee46e3,
    'JSONTypeIsArray', p_JSONTypeIsArray_91eb4aee46e3,
    'JSONTypeDefinition', p_JSONTypeDefinition_91eb4aee46e3,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_91eb4aee46e3,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_91eb4aee46e3,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_91eb4aee46e3,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_91eb4aee46e3,
    'IsComputed', p_IsComputed_91eb4aee46e3
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_91eb4aee46e3,
    'Configuration', p_Configuration_91eb4aee46e3,
    'ID', p_ID_91eb4aee46e3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_91eb4aee46e3, p_Description := p_Description_91eb4aee46e3, p_AutoUpdateDescription := p_AutoUpdateDescription_91eb4aee46e3, p_IsPrimaryKey := p_IsPrimaryKey_91eb4aee46e3, p_IsUnique := p_IsUnique_91eb4aee46e3, p_Category := p_Category_91eb4aee46e3, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_91eb4aee46e3, p_ExtendedType := p_ExtendedType_91eb4aee46e3, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_91eb4aee46e3, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_91eb4aee46e3, p_ViewCellTemplate := p_ViewCellTemplate_91eb4aee46e3, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_91eb4aee46e3, p_AllowUpdateAPI := p_AllowUpdateAPI_91eb4aee46e3, p_AllowUpdateInView := p_AllowUpdateInView_91eb4aee46e3, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_91eb4aee46e3, p_FullTextSearchEnabled := p_FullTextSearchEnabled_91eb4aee46e3, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_91eb4aee46e3, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_91eb4aee46e3, p_GeneratedFormSection := p_GeneratedFormSection_91eb4aee46e3, p_IsNameField := p_IsNameField_91eb4aee46e3, p_RelatedEntityID := p_RelatedEntityID_91eb4aee46e3, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_91eb4aee46e3, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_91eb4aee46e3, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_91eb4aee46e3, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_91eb4aee46e3, p_EntityIDFieldName := p_EntityIDFieldName_91eb4aee46e3, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_91eb4aee46e3, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_91eb4aee46e3, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_91eb4aee46e3, p_Status := p_Status_91eb4aee46e3, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_91eb4aee46e3, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_91eb4aee46e3, p_AutoUpdateCategory := p_AutoUpdateCategory_91eb4aee46e3, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_91eb4aee46e3, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_91eb4aee46e3, p_Encrypt := p_Encrypt_91eb4aee46e3, p_EncryptionKeyID := p_EncryptionKeyID_91eb4aee46e3, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_91eb4aee46e3, p_SendEncryptedValue := p_SendEncryptedValue_91eb4aee46e3, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_91eb4aee46e3, p_IsSoftForeignKey := p_IsSoftForeignKey_91eb4aee46e3, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_91eb4aee46e3, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_91eb4aee46e3, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_91eb4aee46e3, p_JSONTypeDefinition := p_JSONTypeDefinition_91eb4aee46e3, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_91eb4aee46e3, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_91eb4aee46e3, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_91eb4aee46e3, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_91eb4aee46e3, p_IsComputed := p_IsComputed_91eb4aee46e3, p_EmbeddedRecord := p_EmbeddedRecord_91eb4aee46e3, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_91eb4aee46e3, p_Configuration_Clear := TRUE, p_ID := p_ID_91eb4aee46e3);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_702e0a232521 VARCHAR(255);
  p_Description_702e0a232521 TEXT;
  p_AutoUpdateDescription_702e0a232521 BOOLEAN;
  p_IsPrimaryKey_702e0a232521 BOOLEAN;
  p_IsUnique_702e0a232521 BOOLEAN;
  p_Category_702e0a232521 VARCHAR(255);
  p_ValueListType_702e0a232521 VARCHAR(20);
  p_ExtendedType_702e0a232521 VARCHAR(50);
  p_CodeType_702e0a232521 VARCHAR(50);
  p_DefaultInView_702e0a232521 BOOLEAN;
  p_ViewCellTemplate_702e0a232521 TEXT;
  p_DefaultColumnWidth_702e0a232521 INTEGER;
  p_AllowUpdateAPI_702e0a232521 BOOLEAN;
  p_AllowUpdateInView_702e0a232521 BOOLEAN;
  p_IncludeInUserSearchAPI_702e0a232521 BOOLEAN;
  p_FullTextSearchEnabled_702e0a232521 BOOLEAN;
  p_UserSearchParamFormatAPI_702e0a232521 VARCHAR(500);
  p_IncludeInGeneratedForm_702e0a232521 BOOLEAN;
  p_GeneratedFormSection_702e0a232521 VARCHAR(10);
  p_IsNameField_702e0a232521 BOOLEAN;
  p_RelatedEntityID_702e0a232521 UUID;
  p_RelatedEntityFieldName_702e0a232521 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_702e0a232521 BOOLEAN;
  p_RelatedEntityNameFieldMap_702e0a232521 VARCHAR(255);
  p_RelatedEntityDisplayType_702e0a232521 VARCHAR(20);
  p_EntityIDFieldName_702e0a232521 VARCHAR(100);
  p_ScopeDefault_702e0a232521 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_702e0a232521 BOOLEAN;
  p_ValuesToPackWithSchema_702e0a232521 VARCHAR(10);
  p_Status_702e0a232521 VARCHAR(25);
  p_AutoUpdateIsNameField_702e0a232521 BOOLEAN;
  p_AutoUpdateDefaultInView_702e0a232521 BOOLEAN;
  p_AutoUpdateCategory_702e0a232521 BOOLEAN;
  p_AutoUpdateDisplayName_702e0a232521 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_702e0a232521 BOOLEAN;
  p_Encrypt_702e0a232521 BOOLEAN;
  p_EncryptionKeyID_702e0a232521 UUID;
  p_AllowDecryptInAPI_702e0a232521 BOOLEAN;
  p_SendEncryptedValue_702e0a232521 BOOLEAN;
  p_IsSoftPrimaryKey_702e0a232521 BOOLEAN;
  p_IsSoftForeignKey_702e0a232521 BOOLEAN;
  p_RelatedEntityJoinFields_702e0a232521 TEXT;
  p_JSONType_702e0a232521 VARCHAR(255);
  p_JSONTypeIsArray_702e0a232521 BOOLEAN;
  p_JSONTypeDefinition_702e0a232521 TEXT;
  p_UserSearchPredicateAPI_702e0a232521 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_702e0a232521 BOOLEAN;
  p_AutoUpdateFullTextSearch_702e0a232521 BOOLEAN;
  p_AutoUpdateExtendedType_702e0a232521 BOOLEAN;
  p_IsComputed_702e0a232521 BOOLEAN;
  p_EmbeddedRecord_702e0a232521 TEXT;
  p_Configuration_702e0a232521 TEXT;
  p_ID_702e0a232521 UUID;
BEGIN
  p_DisplayName_702e0a232521 := 'Payment Date';
  p_AutoUpdateDescription_702e0a232521 := TRUE;
  p_IsPrimaryKey_702e0a232521 := FALSE;
  p_IsUnique_702e0a232521 := FALSE;
  p_ValueListType_702e0a232521 := 'None';
  p_DefaultInView_702e0a232521 := TRUE;
  p_DefaultColumnWidth_702e0a232521 := 150;
  p_AllowUpdateAPI_702e0a232521 := TRUE;
  p_AllowUpdateInView_702e0a232521 := TRUE;
  p_IncludeInUserSearchAPI_702e0a232521 := FALSE;
  p_FullTextSearchEnabled_702e0a232521 := FALSE;
  p_IncludeInGeneratedForm_702e0a232521 := TRUE;
  p_GeneratedFormSection_702e0a232521 := 'Details';
  p_IsNameField_702e0a232521 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_702e0a232521 := FALSE;
  p_RelatedEntityDisplayType_702e0a232521 := 'Search';
  p_AutoUpdateRelatedEntityInfo_702e0a232521 := TRUE;
  p_ValuesToPackWithSchema_702e0a232521 := 'Auto';
  p_Status_702e0a232521 := 'Active';
  p_AutoUpdateIsNameField_702e0a232521 := TRUE;
  p_AutoUpdateDefaultInView_702e0a232521 := TRUE;
  p_AutoUpdateCategory_702e0a232521 := TRUE;
  p_AutoUpdateDisplayName_702e0a232521 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_702e0a232521 := TRUE;
  p_Encrypt_702e0a232521 := FALSE;
  p_AllowDecryptInAPI_702e0a232521 := FALSE;
  p_SendEncryptedValue_702e0a232521 := FALSE;
  p_IsSoftPrimaryKey_702e0a232521 := FALSE;
  p_IsSoftForeignKey_702e0a232521 := FALSE;
  p_JSONTypeIsArray_702e0a232521 := FALSE;
  p_UserSearchPredicateAPI_702e0a232521 := 'Contains';
  p_AutoUpdateUserSearchPredicate_702e0a232521 := TRUE;
  p_AutoUpdateFullTextSearch_702e0a232521 := TRUE;
  p_AutoUpdateExtendedType_702e0a232521 := TRUE;
  p_IsComputed_702e0a232521 := FALSE;
  p_ID_702e0a232521 := 'A816267E-67F9-4545-8846-43913E2B17DD';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_702e0a232521,
    'Description', p_Description_702e0a232521,
    'AutoUpdateDescription', p_AutoUpdateDescription_702e0a232521,
    'IsPrimaryKey', p_IsPrimaryKey_702e0a232521,
    'IsUnique', p_IsUnique_702e0a232521,
    'Category', p_Category_702e0a232521,
    'ValueListType', p_ValueListType_702e0a232521,
    'ExtendedType', p_ExtendedType_702e0a232521,
    'CodeType', p_CodeType_702e0a232521,
    'DefaultInView', p_DefaultInView_702e0a232521,
    'ViewCellTemplate', p_ViewCellTemplate_702e0a232521,
    'DefaultColumnWidth', p_DefaultColumnWidth_702e0a232521,
    'AllowUpdateAPI', p_AllowUpdateAPI_702e0a232521,
    'AllowUpdateInView', p_AllowUpdateInView_702e0a232521,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_702e0a232521,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_702e0a232521,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_702e0a232521,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_702e0a232521,
    'GeneratedFormSection', p_GeneratedFormSection_702e0a232521,
    'IsNameField', p_IsNameField_702e0a232521,
    'RelatedEntityID', p_RelatedEntityID_702e0a232521,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_702e0a232521,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_702e0a232521,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_702e0a232521,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_702e0a232521,
    'EntityIDFieldName', p_EntityIDFieldName_702e0a232521,
    'ScopeDefault', p_ScopeDefault_702e0a232521,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_702e0a232521,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_702e0a232521,
    'Status', p_Status_702e0a232521,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_702e0a232521,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_702e0a232521,
    'AutoUpdateCategory', p_AutoUpdateCategory_702e0a232521,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_702e0a232521,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_702e0a232521,
    'Encrypt', p_Encrypt_702e0a232521,
    'EncryptionKeyID', p_EncryptionKeyID_702e0a232521,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_702e0a232521,
    'SendEncryptedValue', p_SendEncryptedValue_702e0a232521,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_702e0a232521,
    'IsSoftForeignKey', p_IsSoftForeignKey_702e0a232521,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_702e0a232521,
    'JSONType', p_JSONType_702e0a232521,
    'JSONTypeIsArray', p_JSONTypeIsArray_702e0a232521,
    'JSONTypeDefinition', p_JSONTypeDefinition_702e0a232521,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_702e0a232521,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_702e0a232521,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_702e0a232521,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_702e0a232521,
    'IsComputed', p_IsComputed_702e0a232521
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_702e0a232521,
    'Configuration', p_Configuration_702e0a232521,
    'ID', p_ID_702e0a232521
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_702e0a232521, p_Description := p_Description_702e0a232521, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_702e0a232521, p_IsPrimaryKey := p_IsPrimaryKey_702e0a232521, p_IsUnique := p_IsUnique_702e0a232521, p_Category := p_Category_702e0a232521, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_702e0a232521, p_ExtendedType := p_ExtendedType_702e0a232521, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_702e0a232521, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_702e0a232521, p_ViewCellTemplate := p_ViewCellTemplate_702e0a232521, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_702e0a232521, p_AllowUpdateAPI := p_AllowUpdateAPI_702e0a232521, p_AllowUpdateInView := p_AllowUpdateInView_702e0a232521, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_702e0a232521, p_FullTextSearchEnabled := p_FullTextSearchEnabled_702e0a232521, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_702e0a232521, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_702e0a232521, p_GeneratedFormSection := p_GeneratedFormSection_702e0a232521, p_IsNameField := p_IsNameField_702e0a232521, p_RelatedEntityID := p_RelatedEntityID_702e0a232521, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_702e0a232521, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_702e0a232521, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_702e0a232521, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_702e0a232521, p_EntityIDFieldName := p_EntityIDFieldName_702e0a232521, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_702e0a232521, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_702e0a232521, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_702e0a232521, p_Status := p_Status_702e0a232521, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_702e0a232521, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_702e0a232521, p_AutoUpdateCategory := p_AutoUpdateCategory_702e0a232521, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_702e0a232521, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_702e0a232521, p_Encrypt := p_Encrypt_702e0a232521, p_EncryptionKeyID := p_EncryptionKeyID_702e0a232521, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_702e0a232521, p_SendEncryptedValue := p_SendEncryptedValue_702e0a232521, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_702e0a232521, p_IsSoftForeignKey := p_IsSoftForeignKey_702e0a232521, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_702e0a232521, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_702e0a232521, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_702e0a232521, p_JSONTypeDefinition := p_JSONTypeDefinition_702e0a232521, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_702e0a232521, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_702e0a232521, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_702e0a232521, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_702e0a232521, p_IsComputed := p_IsComputed_702e0a232521, p_EmbeddedRecord := p_EmbeddedRecord_702e0a232521, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_702e0a232521, p_Configuration_Clear := TRUE, p_ID := p_ID_702e0a232521);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_709cda272a2d VARCHAR(255);
  p_Description_709cda272a2d TEXT;
  p_AutoUpdateDescription_709cda272a2d BOOLEAN;
  p_IsPrimaryKey_709cda272a2d BOOLEAN;
  p_IsUnique_709cda272a2d BOOLEAN;
  p_Category_709cda272a2d VARCHAR(255);
  p_ValueListType_709cda272a2d VARCHAR(20);
  p_ExtendedType_709cda272a2d VARCHAR(50);
  p_CodeType_709cda272a2d VARCHAR(50);
  p_DefaultInView_709cda272a2d BOOLEAN;
  p_ViewCellTemplate_709cda272a2d TEXT;
  p_DefaultColumnWidth_709cda272a2d INTEGER;
  p_AllowUpdateAPI_709cda272a2d BOOLEAN;
  p_AllowUpdateInView_709cda272a2d BOOLEAN;
  p_IncludeInUserSearchAPI_709cda272a2d BOOLEAN;
  p_FullTextSearchEnabled_709cda272a2d BOOLEAN;
  p_UserSearchParamFormatAPI_709cda272a2d VARCHAR(500);
  p_IncludeInGeneratedForm_709cda272a2d BOOLEAN;
  p_GeneratedFormSection_709cda272a2d VARCHAR(10);
  p_IsNameField_709cda272a2d BOOLEAN;
  p_RelatedEntityID_709cda272a2d UUID;
  p_RelatedEntityFieldName_709cda272a2d VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_709cda272a2d BOOLEAN;
  p_RelatedEntityNameFieldMap_709cda272a2d VARCHAR(255);
  p_RelatedEntityDisplayType_709cda272a2d VARCHAR(20);
  p_EntityIDFieldName_709cda272a2d VARCHAR(100);
  p_ScopeDefault_709cda272a2d VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_709cda272a2d BOOLEAN;
  p_ValuesToPackWithSchema_709cda272a2d VARCHAR(10);
  p_Status_709cda272a2d VARCHAR(25);
  p_AutoUpdateIsNameField_709cda272a2d BOOLEAN;
  p_AutoUpdateDefaultInView_709cda272a2d BOOLEAN;
  p_AutoUpdateCategory_709cda272a2d BOOLEAN;
  p_AutoUpdateDisplayName_709cda272a2d BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_709cda272a2d BOOLEAN;
  p_Encrypt_709cda272a2d BOOLEAN;
  p_EncryptionKeyID_709cda272a2d UUID;
  p_AllowDecryptInAPI_709cda272a2d BOOLEAN;
  p_SendEncryptedValue_709cda272a2d BOOLEAN;
  p_IsSoftPrimaryKey_709cda272a2d BOOLEAN;
  p_IsSoftForeignKey_709cda272a2d BOOLEAN;
  p_RelatedEntityJoinFields_709cda272a2d TEXT;
  p_JSONType_709cda272a2d VARCHAR(255);
  p_JSONTypeIsArray_709cda272a2d BOOLEAN;
  p_JSONTypeDefinition_709cda272a2d TEXT;
  p_UserSearchPredicateAPI_709cda272a2d VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_709cda272a2d BOOLEAN;
  p_AutoUpdateFullTextSearch_709cda272a2d BOOLEAN;
  p_AutoUpdateExtendedType_709cda272a2d BOOLEAN;
  p_IsComputed_709cda272a2d BOOLEAN;
  p_EmbeddedRecord_709cda272a2d TEXT;
  p_Configuration_709cda272a2d TEXT;
  p_ID_709cda272a2d UUID;
BEGIN
  p_DisplayName_709cda272a2d := 'Amount';
  p_Description_709cda272a2d := 'The instalment amount as agreed. Unconstrained in sign: a refund or credit instalment is legitimately negative, and this table records what was agreed rather than asserting a shape for it.';
  p_AutoUpdateDescription_709cda272a2d := TRUE;
  p_IsPrimaryKey_709cda272a2d := FALSE;
  p_IsUnique_709cda272a2d := FALSE;
  p_ValueListType_709cda272a2d := 'None';
  p_DefaultInView_709cda272a2d := TRUE;
  p_DefaultColumnWidth_709cda272a2d := 150;
  p_AllowUpdateAPI_709cda272a2d := TRUE;
  p_AllowUpdateInView_709cda272a2d := TRUE;
  p_IncludeInUserSearchAPI_709cda272a2d := FALSE;
  p_FullTextSearchEnabled_709cda272a2d := FALSE;
  p_IncludeInGeneratedForm_709cda272a2d := TRUE;
  p_GeneratedFormSection_709cda272a2d := 'Details';
  p_IsNameField_709cda272a2d := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_709cda272a2d := FALSE;
  p_RelatedEntityDisplayType_709cda272a2d := 'Search';
  p_AutoUpdateRelatedEntityInfo_709cda272a2d := TRUE;
  p_ValuesToPackWithSchema_709cda272a2d := 'Auto';
  p_Status_709cda272a2d := 'Active';
  p_AutoUpdateIsNameField_709cda272a2d := TRUE;
  p_AutoUpdateDefaultInView_709cda272a2d := TRUE;
  p_AutoUpdateCategory_709cda272a2d := TRUE;
  p_AutoUpdateDisplayName_709cda272a2d := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_709cda272a2d := TRUE;
  p_Encrypt_709cda272a2d := FALSE;
  p_AllowDecryptInAPI_709cda272a2d := FALSE;
  p_SendEncryptedValue_709cda272a2d := FALSE;
  p_IsSoftPrimaryKey_709cda272a2d := FALSE;
  p_IsSoftForeignKey_709cda272a2d := FALSE;
  p_JSONTypeIsArray_709cda272a2d := FALSE;
  p_UserSearchPredicateAPI_709cda272a2d := 'Contains';
  p_AutoUpdateUserSearchPredicate_709cda272a2d := TRUE;
  p_AutoUpdateFullTextSearch_709cda272a2d := TRUE;
  p_AutoUpdateExtendedType_709cda272a2d := TRUE;
  p_IsComputed_709cda272a2d := FALSE;
  p_ID_709cda272a2d := '883DEAD2-8813-416A-9286-9EEF318D141A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_709cda272a2d,
    'Description', p_Description_709cda272a2d,
    'AutoUpdateDescription', p_AutoUpdateDescription_709cda272a2d,
    'IsPrimaryKey', p_IsPrimaryKey_709cda272a2d,
    'IsUnique', p_IsUnique_709cda272a2d,
    'Category', p_Category_709cda272a2d,
    'ValueListType', p_ValueListType_709cda272a2d,
    'ExtendedType', p_ExtendedType_709cda272a2d,
    'CodeType', p_CodeType_709cda272a2d,
    'DefaultInView', p_DefaultInView_709cda272a2d,
    'ViewCellTemplate', p_ViewCellTemplate_709cda272a2d,
    'DefaultColumnWidth', p_DefaultColumnWidth_709cda272a2d,
    'AllowUpdateAPI', p_AllowUpdateAPI_709cda272a2d,
    'AllowUpdateInView', p_AllowUpdateInView_709cda272a2d,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_709cda272a2d,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_709cda272a2d,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_709cda272a2d,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_709cda272a2d,
    'GeneratedFormSection', p_GeneratedFormSection_709cda272a2d,
    'IsNameField', p_IsNameField_709cda272a2d,
    'RelatedEntityID', p_RelatedEntityID_709cda272a2d,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_709cda272a2d,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_709cda272a2d,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_709cda272a2d,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_709cda272a2d,
    'EntityIDFieldName', p_EntityIDFieldName_709cda272a2d,
    'ScopeDefault', p_ScopeDefault_709cda272a2d,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_709cda272a2d,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_709cda272a2d,
    'Status', p_Status_709cda272a2d,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_709cda272a2d,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_709cda272a2d,
    'AutoUpdateCategory', p_AutoUpdateCategory_709cda272a2d,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_709cda272a2d,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_709cda272a2d,
    'Encrypt', p_Encrypt_709cda272a2d,
    'EncryptionKeyID', p_EncryptionKeyID_709cda272a2d,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_709cda272a2d,
    'SendEncryptedValue', p_SendEncryptedValue_709cda272a2d,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_709cda272a2d,
    'IsSoftForeignKey', p_IsSoftForeignKey_709cda272a2d,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_709cda272a2d,
    'JSONType', p_JSONType_709cda272a2d,
    'JSONTypeIsArray', p_JSONTypeIsArray_709cda272a2d,
    'JSONTypeDefinition', p_JSONTypeDefinition_709cda272a2d,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_709cda272a2d,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_709cda272a2d,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_709cda272a2d,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_709cda272a2d,
    'IsComputed', p_IsComputed_709cda272a2d
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_709cda272a2d,
    'Configuration', p_Configuration_709cda272a2d,
    'ID', p_ID_709cda272a2d
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_709cda272a2d, p_Description := p_Description_709cda272a2d, p_AutoUpdateDescription := p_AutoUpdateDescription_709cda272a2d, p_IsPrimaryKey := p_IsPrimaryKey_709cda272a2d, p_IsUnique := p_IsUnique_709cda272a2d, p_Category := p_Category_709cda272a2d, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_709cda272a2d, p_ExtendedType := p_ExtendedType_709cda272a2d, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_709cda272a2d, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_709cda272a2d, p_ViewCellTemplate := p_ViewCellTemplate_709cda272a2d, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_709cda272a2d, p_AllowUpdateAPI := p_AllowUpdateAPI_709cda272a2d, p_AllowUpdateInView := p_AllowUpdateInView_709cda272a2d, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_709cda272a2d, p_FullTextSearchEnabled := p_FullTextSearchEnabled_709cda272a2d, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_709cda272a2d, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_709cda272a2d, p_GeneratedFormSection := p_GeneratedFormSection_709cda272a2d, p_IsNameField := p_IsNameField_709cda272a2d, p_RelatedEntityID := p_RelatedEntityID_709cda272a2d, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_709cda272a2d, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_709cda272a2d, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_709cda272a2d, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_709cda272a2d, p_EntityIDFieldName := p_EntityIDFieldName_709cda272a2d, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_709cda272a2d, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_709cda272a2d, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_709cda272a2d, p_Status := p_Status_709cda272a2d, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_709cda272a2d, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_709cda272a2d, p_AutoUpdateCategory := p_AutoUpdateCategory_709cda272a2d, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_709cda272a2d, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_709cda272a2d, p_Encrypt := p_Encrypt_709cda272a2d, p_EncryptionKeyID := p_EncryptionKeyID_709cda272a2d, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_709cda272a2d, p_SendEncryptedValue := p_SendEncryptedValue_709cda272a2d, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_709cda272a2d, p_IsSoftForeignKey := p_IsSoftForeignKey_709cda272a2d, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_709cda272a2d, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_709cda272a2d, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_709cda272a2d, p_JSONTypeDefinition := p_JSONTypeDefinition_709cda272a2d, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_709cda272a2d, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_709cda272a2d, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_709cda272a2d, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_709cda272a2d, p_IsComputed := p_IsComputed_709cda272a2d, p_EmbeddedRecord := p_EmbeddedRecord_709cda272a2d, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_709cda272a2d, p_Configuration_Clear := TRUE, p_ID := p_ID_709cda272a2d);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_9a3e41aca814 VARCHAR(255);
  p_Description_9a3e41aca814 TEXT;
  p_AutoUpdateDescription_9a3e41aca814 BOOLEAN;
  p_IsPrimaryKey_9a3e41aca814 BOOLEAN;
  p_IsUnique_9a3e41aca814 BOOLEAN;
  p_Category_9a3e41aca814 VARCHAR(255);
  p_ValueListType_9a3e41aca814 VARCHAR(20);
  p_ExtendedType_9a3e41aca814 VARCHAR(50);
  p_CodeType_9a3e41aca814 VARCHAR(50);
  p_DefaultInView_9a3e41aca814 BOOLEAN;
  p_ViewCellTemplate_9a3e41aca814 TEXT;
  p_DefaultColumnWidth_9a3e41aca814 INTEGER;
  p_AllowUpdateAPI_9a3e41aca814 BOOLEAN;
  p_AllowUpdateInView_9a3e41aca814 BOOLEAN;
  p_IncludeInUserSearchAPI_9a3e41aca814 BOOLEAN;
  p_FullTextSearchEnabled_9a3e41aca814 BOOLEAN;
  p_UserSearchParamFormatAPI_9a3e41aca814 VARCHAR(500);
  p_IncludeInGeneratedForm_9a3e41aca814 BOOLEAN;
  p_GeneratedFormSection_9a3e41aca814 VARCHAR(10);
  p_IsNameField_9a3e41aca814 BOOLEAN;
  p_RelatedEntityID_9a3e41aca814 UUID;
  p_RelatedEntityFieldName_9a3e41aca814 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_9a3e41aca814 BOOLEAN;
  p_RelatedEntityNameFieldMap_9a3e41aca814 VARCHAR(255);
  p_RelatedEntityDisplayType_9a3e41aca814 VARCHAR(20);
  p_EntityIDFieldName_9a3e41aca814 VARCHAR(100);
  p_ScopeDefault_9a3e41aca814 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_9a3e41aca814 BOOLEAN;
  p_ValuesToPackWithSchema_9a3e41aca814 VARCHAR(10);
  p_Status_9a3e41aca814 VARCHAR(25);
  p_AutoUpdateIsNameField_9a3e41aca814 BOOLEAN;
  p_AutoUpdateDefaultInView_9a3e41aca814 BOOLEAN;
  p_AutoUpdateCategory_9a3e41aca814 BOOLEAN;
  p_AutoUpdateDisplayName_9a3e41aca814 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_9a3e41aca814 BOOLEAN;
  p_Encrypt_9a3e41aca814 BOOLEAN;
  p_EncryptionKeyID_9a3e41aca814 UUID;
  p_AllowDecryptInAPI_9a3e41aca814 BOOLEAN;
  p_SendEncryptedValue_9a3e41aca814 BOOLEAN;
  p_IsSoftPrimaryKey_9a3e41aca814 BOOLEAN;
  p_IsSoftForeignKey_9a3e41aca814 BOOLEAN;
  p_RelatedEntityJoinFields_9a3e41aca814 TEXT;
  p_JSONType_9a3e41aca814 VARCHAR(255);
  p_JSONTypeIsArray_9a3e41aca814 BOOLEAN;
  p_JSONTypeDefinition_9a3e41aca814 TEXT;
  p_UserSearchPredicateAPI_9a3e41aca814 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_9a3e41aca814 BOOLEAN;
  p_AutoUpdateFullTextSearch_9a3e41aca814 BOOLEAN;
  p_AutoUpdateExtendedType_9a3e41aca814 BOOLEAN;
  p_IsComputed_9a3e41aca814 BOOLEAN;
  p_EmbeddedRecord_9a3e41aca814 TEXT;
  p_Configuration_9a3e41aca814 TEXT;
  p_ID_9a3e41aca814 UUID;
BEGIN
  p_DisplayName_9a3e41aca814 := 'Description';
  p_AutoUpdateDescription_9a3e41aca814 := TRUE;
  p_IsPrimaryKey_9a3e41aca814 := FALSE;
  p_IsUnique_9a3e41aca814 := FALSE;
  p_ValueListType_9a3e41aca814 := 'None';
  p_DefaultInView_9a3e41aca814 := TRUE;
  p_DefaultColumnWidth_9a3e41aca814 := 150;
  p_AllowUpdateAPI_9a3e41aca814 := TRUE;
  p_AllowUpdateInView_9a3e41aca814 := TRUE;
  p_IncludeInUserSearchAPI_9a3e41aca814 := FALSE;
  p_FullTextSearchEnabled_9a3e41aca814 := FALSE;
  p_IncludeInGeneratedForm_9a3e41aca814 := TRUE;
  p_GeneratedFormSection_9a3e41aca814 := 'Details';
  p_IsNameField_9a3e41aca814 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_9a3e41aca814 := FALSE;
  p_RelatedEntityDisplayType_9a3e41aca814 := 'Search';
  p_AutoUpdateRelatedEntityInfo_9a3e41aca814 := TRUE;
  p_ValuesToPackWithSchema_9a3e41aca814 := 'Auto';
  p_Status_9a3e41aca814 := 'Active';
  p_AutoUpdateIsNameField_9a3e41aca814 := TRUE;
  p_AutoUpdateDefaultInView_9a3e41aca814 := TRUE;
  p_AutoUpdateCategory_9a3e41aca814 := TRUE;
  p_AutoUpdateDisplayName_9a3e41aca814 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_9a3e41aca814 := TRUE;
  p_Encrypt_9a3e41aca814 := FALSE;
  p_AllowDecryptInAPI_9a3e41aca814 := FALSE;
  p_SendEncryptedValue_9a3e41aca814 := FALSE;
  p_IsSoftPrimaryKey_9a3e41aca814 := FALSE;
  p_IsSoftForeignKey_9a3e41aca814 := FALSE;
  p_JSONTypeIsArray_9a3e41aca814 := FALSE;
  p_UserSearchPredicateAPI_9a3e41aca814 := 'Contains';
  p_AutoUpdateUserSearchPredicate_9a3e41aca814 := TRUE;
  p_AutoUpdateFullTextSearch_9a3e41aca814 := TRUE;
  p_AutoUpdateExtendedType_9a3e41aca814 := TRUE;
  p_IsComputed_9a3e41aca814 := FALSE;
  p_ID_9a3e41aca814 := 'BE645A75-4840-4CD2-8A08-AABA5E0EA2F2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_9a3e41aca814,
    'Description', p_Description_9a3e41aca814,
    'AutoUpdateDescription', p_AutoUpdateDescription_9a3e41aca814,
    'IsPrimaryKey', p_IsPrimaryKey_9a3e41aca814,
    'IsUnique', p_IsUnique_9a3e41aca814,
    'Category', p_Category_9a3e41aca814,
    'ValueListType', p_ValueListType_9a3e41aca814,
    'ExtendedType', p_ExtendedType_9a3e41aca814,
    'CodeType', p_CodeType_9a3e41aca814,
    'DefaultInView', p_DefaultInView_9a3e41aca814,
    'ViewCellTemplate', p_ViewCellTemplate_9a3e41aca814,
    'DefaultColumnWidth', p_DefaultColumnWidth_9a3e41aca814,
    'AllowUpdateAPI', p_AllowUpdateAPI_9a3e41aca814,
    'AllowUpdateInView', p_AllowUpdateInView_9a3e41aca814,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_9a3e41aca814,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_9a3e41aca814,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_9a3e41aca814,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_9a3e41aca814,
    'GeneratedFormSection', p_GeneratedFormSection_9a3e41aca814,
    'IsNameField', p_IsNameField_9a3e41aca814,
    'RelatedEntityID', p_RelatedEntityID_9a3e41aca814,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_9a3e41aca814,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_9a3e41aca814,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_9a3e41aca814,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_9a3e41aca814,
    'EntityIDFieldName', p_EntityIDFieldName_9a3e41aca814,
    'ScopeDefault', p_ScopeDefault_9a3e41aca814,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_9a3e41aca814,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_9a3e41aca814,
    'Status', p_Status_9a3e41aca814,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_9a3e41aca814,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_9a3e41aca814,
    'AutoUpdateCategory', p_AutoUpdateCategory_9a3e41aca814,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_9a3e41aca814,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_9a3e41aca814,
    'Encrypt', p_Encrypt_9a3e41aca814,
    'EncryptionKeyID', p_EncryptionKeyID_9a3e41aca814,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_9a3e41aca814,
    'SendEncryptedValue', p_SendEncryptedValue_9a3e41aca814,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_9a3e41aca814,
    'IsSoftForeignKey', p_IsSoftForeignKey_9a3e41aca814,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_9a3e41aca814,
    'JSONType', p_JSONType_9a3e41aca814,
    'JSONTypeIsArray', p_JSONTypeIsArray_9a3e41aca814,
    'JSONTypeDefinition', p_JSONTypeDefinition_9a3e41aca814,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_9a3e41aca814,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_9a3e41aca814,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_9a3e41aca814,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_9a3e41aca814,
    'IsComputed', p_IsComputed_9a3e41aca814
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_9a3e41aca814,
    'Configuration', p_Configuration_9a3e41aca814,
    'ID', p_ID_9a3e41aca814
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_9a3e41aca814, p_Description := p_Description_9a3e41aca814, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_9a3e41aca814, p_IsPrimaryKey := p_IsPrimaryKey_9a3e41aca814, p_IsUnique := p_IsUnique_9a3e41aca814, p_Category := p_Category_9a3e41aca814, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_9a3e41aca814, p_ExtendedType := p_ExtendedType_9a3e41aca814, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_9a3e41aca814, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_9a3e41aca814, p_ViewCellTemplate := p_ViewCellTemplate_9a3e41aca814, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_9a3e41aca814, p_AllowUpdateAPI := p_AllowUpdateAPI_9a3e41aca814, p_AllowUpdateInView := p_AllowUpdateInView_9a3e41aca814, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_9a3e41aca814, p_FullTextSearchEnabled := p_FullTextSearchEnabled_9a3e41aca814, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_9a3e41aca814, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_9a3e41aca814, p_GeneratedFormSection := p_GeneratedFormSection_9a3e41aca814, p_IsNameField := p_IsNameField_9a3e41aca814, p_RelatedEntityID := p_RelatedEntityID_9a3e41aca814, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_9a3e41aca814, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_9a3e41aca814, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_9a3e41aca814, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_9a3e41aca814, p_EntityIDFieldName := p_EntityIDFieldName_9a3e41aca814, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_9a3e41aca814, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_9a3e41aca814, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_9a3e41aca814, p_Status := p_Status_9a3e41aca814, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_9a3e41aca814, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_9a3e41aca814, p_AutoUpdateCategory := p_AutoUpdateCategory_9a3e41aca814, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_9a3e41aca814, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_9a3e41aca814, p_Encrypt := p_Encrypt_9a3e41aca814, p_EncryptionKeyID := p_EncryptionKeyID_9a3e41aca814, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_9a3e41aca814, p_SendEncryptedValue := p_SendEncryptedValue_9a3e41aca814, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_9a3e41aca814, p_IsSoftForeignKey := p_IsSoftForeignKey_9a3e41aca814, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_9a3e41aca814, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_9a3e41aca814, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_9a3e41aca814, p_JSONTypeDefinition := p_JSONTypeDefinition_9a3e41aca814, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_9a3e41aca814, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_9a3e41aca814, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_9a3e41aca814, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_9a3e41aca814, p_IsComputed := p_IsComputed_9a3e41aca814, p_EmbeddedRecord := p_EmbeddedRecord_9a3e41aca814, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_9a3e41aca814, p_Configuration_Clear := TRUE, p_ID := p_ID_9a3e41aca814);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_626ca0ef7f11 VARCHAR(255);
  p_Description_626ca0ef7f11 TEXT;
  p_AutoUpdateDescription_626ca0ef7f11 BOOLEAN;
  p_IsPrimaryKey_626ca0ef7f11 BOOLEAN;
  p_IsUnique_626ca0ef7f11 BOOLEAN;
  p_Category_626ca0ef7f11 VARCHAR(255);
  p_ValueListType_626ca0ef7f11 VARCHAR(20);
  p_ExtendedType_626ca0ef7f11 VARCHAR(50);
  p_CodeType_626ca0ef7f11 VARCHAR(50);
  p_DefaultInView_626ca0ef7f11 BOOLEAN;
  p_ViewCellTemplate_626ca0ef7f11 TEXT;
  p_DefaultColumnWidth_626ca0ef7f11 INTEGER;
  p_AllowUpdateAPI_626ca0ef7f11 BOOLEAN;
  p_AllowUpdateInView_626ca0ef7f11 BOOLEAN;
  p_IncludeInUserSearchAPI_626ca0ef7f11 BOOLEAN;
  p_FullTextSearchEnabled_626ca0ef7f11 BOOLEAN;
  p_UserSearchParamFormatAPI_626ca0ef7f11 VARCHAR(500);
  p_IncludeInGeneratedForm_626ca0ef7f11 BOOLEAN;
  p_GeneratedFormSection_626ca0ef7f11 VARCHAR(10);
  p_IsNameField_626ca0ef7f11 BOOLEAN;
  p_RelatedEntityID_626ca0ef7f11 UUID;
  p_RelatedEntityFieldName_626ca0ef7f11 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_626ca0ef7f11 BOOLEAN;
  p_RelatedEntityNameFieldMap_626ca0ef7f11 VARCHAR(255);
  p_RelatedEntityDisplayType_626ca0ef7f11 VARCHAR(20);
  p_EntityIDFieldName_626ca0ef7f11 VARCHAR(100);
  p_ScopeDefault_626ca0ef7f11 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_626ca0ef7f11 BOOLEAN;
  p_ValuesToPackWithSchema_626ca0ef7f11 VARCHAR(10);
  p_Status_626ca0ef7f11 VARCHAR(25);
  p_AutoUpdateIsNameField_626ca0ef7f11 BOOLEAN;
  p_AutoUpdateDefaultInView_626ca0ef7f11 BOOLEAN;
  p_AutoUpdateCategory_626ca0ef7f11 BOOLEAN;
  p_AutoUpdateDisplayName_626ca0ef7f11 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_626ca0ef7f11 BOOLEAN;
  p_Encrypt_626ca0ef7f11 BOOLEAN;
  p_EncryptionKeyID_626ca0ef7f11 UUID;
  p_AllowDecryptInAPI_626ca0ef7f11 BOOLEAN;
  p_SendEncryptedValue_626ca0ef7f11 BOOLEAN;
  p_IsSoftPrimaryKey_626ca0ef7f11 BOOLEAN;
  p_IsSoftForeignKey_626ca0ef7f11 BOOLEAN;
  p_RelatedEntityJoinFields_626ca0ef7f11 TEXT;
  p_JSONType_626ca0ef7f11 VARCHAR(255);
  p_JSONTypeIsArray_626ca0ef7f11 BOOLEAN;
  p_JSONTypeDefinition_626ca0ef7f11 TEXT;
  p_UserSearchPredicateAPI_626ca0ef7f11 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_626ca0ef7f11 BOOLEAN;
  p_AutoUpdateFullTextSearch_626ca0ef7f11 BOOLEAN;
  p_AutoUpdateExtendedType_626ca0ef7f11 BOOLEAN;
  p_IsComputed_626ca0ef7f11 BOOLEAN;
  p_EmbeddedRecord_626ca0ef7f11 TEXT;
  p_Configuration_626ca0ef7f11 TEXT;
  p_ID_626ca0ef7f11 UUID;
BEGIN
  p_DisplayName_626ca0ef7f11 := 'Changed At';
  p_Description_626ca0ef7f11 := 'The ORIGINAL time of the transition, not the row''s insert time. A distinct column rather than a reliance on __mj_CreatedAt because the HubSpot import must preserve historical timestamps — a 2023 transition has to land as 2023.';
  p_AutoUpdateDescription_626ca0ef7f11 := TRUE;
  p_IsPrimaryKey_626ca0ef7f11 := FALSE;
  p_IsUnique_626ca0ef7f11 := FALSE;
  p_ValueListType_626ca0ef7f11 := 'None';
  p_DefaultInView_626ca0ef7f11 := TRUE;
  p_DefaultColumnWidth_626ca0ef7f11 := 100;
  p_AllowUpdateAPI_626ca0ef7f11 := TRUE;
  p_AllowUpdateInView_626ca0ef7f11 := TRUE;
  p_IncludeInUserSearchAPI_626ca0ef7f11 := FALSE;
  p_FullTextSearchEnabled_626ca0ef7f11 := FALSE;
  p_IncludeInGeneratedForm_626ca0ef7f11 := TRUE;
  p_GeneratedFormSection_626ca0ef7f11 := 'Details';
  p_IsNameField_626ca0ef7f11 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_626ca0ef7f11 := FALSE;
  p_RelatedEntityDisplayType_626ca0ef7f11 := 'Search';
  p_AutoUpdateRelatedEntityInfo_626ca0ef7f11 := TRUE;
  p_ValuesToPackWithSchema_626ca0ef7f11 := 'Auto';
  p_Status_626ca0ef7f11 := 'Active';
  p_AutoUpdateIsNameField_626ca0ef7f11 := TRUE;
  p_AutoUpdateDefaultInView_626ca0ef7f11 := FALSE;
  p_AutoUpdateCategory_626ca0ef7f11 := TRUE;
  p_AutoUpdateDisplayName_626ca0ef7f11 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_626ca0ef7f11 := TRUE;
  p_Encrypt_626ca0ef7f11 := FALSE;
  p_AllowDecryptInAPI_626ca0ef7f11 := FALSE;
  p_SendEncryptedValue_626ca0ef7f11 := FALSE;
  p_IsSoftPrimaryKey_626ca0ef7f11 := FALSE;
  p_IsSoftForeignKey_626ca0ef7f11 := FALSE;
  p_JSONTypeIsArray_626ca0ef7f11 := FALSE;
  p_UserSearchPredicateAPI_626ca0ef7f11 := 'Contains';
  p_AutoUpdateUserSearchPredicate_626ca0ef7f11 := TRUE;
  p_AutoUpdateFullTextSearch_626ca0ef7f11 := TRUE;
  p_AutoUpdateExtendedType_626ca0ef7f11 := TRUE;
  p_IsComputed_626ca0ef7f11 := FALSE;
  p_ID_626ca0ef7f11 := '8B99D902-5E7E-4A84-8A62-0B88E16953C3';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_626ca0ef7f11,
    'Description', p_Description_626ca0ef7f11,
    'AutoUpdateDescription', p_AutoUpdateDescription_626ca0ef7f11,
    'IsPrimaryKey', p_IsPrimaryKey_626ca0ef7f11,
    'IsUnique', p_IsUnique_626ca0ef7f11,
    'Category', p_Category_626ca0ef7f11,
    'ValueListType', p_ValueListType_626ca0ef7f11,
    'ExtendedType', p_ExtendedType_626ca0ef7f11,
    'CodeType', p_CodeType_626ca0ef7f11,
    'DefaultInView', p_DefaultInView_626ca0ef7f11,
    'ViewCellTemplate', p_ViewCellTemplate_626ca0ef7f11,
    'DefaultColumnWidth', p_DefaultColumnWidth_626ca0ef7f11,
    'AllowUpdateAPI', p_AllowUpdateAPI_626ca0ef7f11,
    'AllowUpdateInView', p_AllowUpdateInView_626ca0ef7f11,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_626ca0ef7f11,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_626ca0ef7f11,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_626ca0ef7f11,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_626ca0ef7f11,
    'GeneratedFormSection', p_GeneratedFormSection_626ca0ef7f11,
    'IsNameField', p_IsNameField_626ca0ef7f11,
    'RelatedEntityID', p_RelatedEntityID_626ca0ef7f11,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_626ca0ef7f11,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_626ca0ef7f11,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_626ca0ef7f11,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_626ca0ef7f11,
    'EntityIDFieldName', p_EntityIDFieldName_626ca0ef7f11,
    'ScopeDefault', p_ScopeDefault_626ca0ef7f11,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_626ca0ef7f11,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_626ca0ef7f11,
    'Status', p_Status_626ca0ef7f11,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_626ca0ef7f11,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_626ca0ef7f11,
    'AutoUpdateCategory', p_AutoUpdateCategory_626ca0ef7f11,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_626ca0ef7f11,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_626ca0ef7f11,
    'Encrypt', p_Encrypt_626ca0ef7f11,
    'EncryptionKeyID', p_EncryptionKeyID_626ca0ef7f11,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_626ca0ef7f11,
    'SendEncryptedValue', p_SendEncryptedValue_626ca0ef7f11,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_626ca0ef7f11,
    'IsSoftForeignKey', p_IsSoftForeignKey_626ca0ef7f11,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_626ca0ef7f11,
    'JSONType', p_JSONType_626ca0ef7f11,
    'JSONTypeIsArray', p_JSONTypeIsArray_626ca0ef7f11,
    'JSONTypeDefinition', p_JSONTypeDefinition_626ca0ef7f11,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_626ca0ef7f11,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_626ca0ef7f11,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_626ca0ef7f11,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_626ca0ef7f11,
    'IsComputed', p_IsComputed_626ca0ef7f11
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_626ca0ef7f11,
    'Configuration', p_Configuration_626ca0ef7f11,
    'ID', p_ID_626ca0ef7f11
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_626ca0ef7f11, p_Description := p_Description_626ca0ef7f11, p_AutoUpdateDescription := p_AutoUpdateDescription_626ca0ef7f11, p_IsPrimaryKey := p_IsPrimaryKey_626ca0ef7f11, p_IsUnique := p_IsUnique_626ca0ef7f11, p_Category := p_Category_626ca0ef7f11, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_626ca0ef7f11, p_ExtendedType := p_ExtendedType_626ca0ef7f11, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_626ca0ef7f11, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_626ca0ef7f11, p_ViewCellTemplate := p_ViewCellTemplate_626ca0ef7f11, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_626ca0ef7f11, p_AllowUpdateAPI := p_AllowUpdateAPI_626ca0ef7f11, p_AllowUpdateInView := p_AllowUpdateInView_626ca0ef7f11, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_626ca0ef7f11, p_FullTextSearchEnabled := p_FullTextSearchEnabled_626ca0ef7f11, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_626ca0ef7f11, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_626ca0ef7f11, p_GeneratedFormSection := p_GeneratedFormSection_626ca0ef7f11, p_IsNameField := p_IsNameField_626ca0ef7f11, p_RelatedEntityID := p_RelatedEntityID_626ca0ef7f11, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_626ca0ef7f11, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_626ca0ef7f11, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_626ca0ef7f11, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_626ca0ef7f11, p_EntityIDFieldName := p_EntityIDFieldName_626ca0ef7f11, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_626ca0ef7f11, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_626ca0ef7f11, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_626ca0ef7f11, p_Status := p_Status_626ca0ef7f11, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_626ca0ef7f11, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_626ca0ef7f11, p_AutoUpdateCategory := p_AutoUpdateCategory_626ca0ef7f11, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_626ca0ef7f11, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_626ca0ef7f11, p_Encrypt := p_Encrypt_626ca0ef7f11, p_EncryptionKeyID := p_EncryptionKeyID_626ca0ef7f11, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_626ca0ef7f11, p_SendEncryptedValue := p_SendEncryptedValue_626ca0ef7f11, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_626ca0ef7f11, p_IsSoftForeignKey := p_IsSoftForeignKey_626ca0ef7f11, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_626ca0ef7f11, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_626ca0ef7f11, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_626ca0ef7f11, p_JSONTypeDefinition := p_JSONTypeDefinition_626ca0ef7f11, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_626ca0ef7f11, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_626ca0ef7f11, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_626ca0ef7f11, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_626ca0ef7f11, p_IsComputed := p_IsComputed_626ca0ef7f11, p_EmbeddedRecord := p_EmbeddedRecord_626ca0ef7f11, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_626ca0ef7f11, p_Configuration_Clear := TRUE, p_ID := p_ID_626ca0ef7f11);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_1869d425a51e VARCHAR(255);
  p_Description_1869d425a51e TEXT;
  p_AutoUpdateDescription_1869d425a51e BOOLEAN;
  p_IsPrimaryKey_1869d425a51e BOOLEAN;
  p_IsUnique_1869d425a51e BOOLEAN;
  p_Category_1869d425a51e VARCHAR(255);
  p_ValueListType_1869d425a51e VARCHAR(20);
  p_ExtendedType_1869d425a51e VARCHAR(50);
  p_CodeType_1869d425a51e VARCHAR(50);
  p_DefaultInView_1869d425a51e BOOLEAN;
  p_ViewCellTemplate_1869d425a51e TEXT;
  p_DefaultColumnWidth_1869d425a51e INTEGER;
  p_AllowUpdateAPI_1869d425a51e BOOLEAN;
  p_AllowUpdateInView_1869d425a51e BOOLEAN;
  p_IncludeInUserSearchAPI_1869d425a51e BOOLEAN;
  p_FullTextSearchEnabled_1869d425a51e BOOLEAN;
  p_UserSearchParamFormatAPI_1869d425a51e VARCHAR(500);
  p_IncludeInGeneratedForm_1869d425a51e BOOLEAN;
  p_GeneratedFormSection_1869d425a51e VARCHAR(10);
  p_IsNameField_1869d425a51e BOOLEAN;
  p_RelatedEntityID_1869d425a51e UUID;
  p_RelatedEntityFieldName_1869d425a51e VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_1869d425a51e BOOLEAN;
  p_RelatedEntityNameFieldMap_1869d425a51e VARCHAR(255);
  p_RelatedEntityDisplayType_1869d425a51e VARCHAR(20);
  p_EntityIDFieldName_1869d425a51e VARCHAR(100);
  p_ScopeDefault_1869d425a51e VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_1869d425a51e BOOLEAN;
  p_ValuesToPackWithSchema_1869d425a51e VARCHAR(10);
  p_Status_1869d425a51e VARCHAR(25);
  p_AutoUpdateIsNameField_1869d425a51e BOOLEAN;
  p_AutoUpdateDefaultInView_1869d425a51e BOOLEAN;
  p_AutoUpdateCategory_1869d425a51e BOOLEAN;
  p_AutoUpdateDisplayName_1869d425a51e BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_1869d425a51e BOOLEAN;
  p_Encrypt_1869d425a51e BOOLEAN;
  p_EncryptionKeyID_1869d425a51e UUID;
  p_AllowDecryptInAPI_1869d425a51e BOOLEAN;
  p_SendEncryptedValue_1869d425a51e BOOLEAN;
  p_IsSoftPrimaryKey_1869d425a51e BOOLEAN;
  p_IsSoftForeignKey_1869d425a51e BOOLEAN;
  p_RelatedEntityJoinFields_1869d425a51e TEXT;
  p_JSONType_1869d425a51e VARCHAR(255);
  p_JSONTypeIsArray_1869d425a51e BOOLEAN;
  p_JSONTypeDefinition_1869d425a51e TEXT;
  p_UserSearchPredicateAPI_1869d425a51e VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_1869d425a51e BOOLEAN;
  p_AutoUpdateFullTextSearch_1869d425a51e BOOLEAN;
  p_AutoUpdateExtendedType_1869d425a51e BOOLEAN;
  p_IsComputed_1869d425a51e BOOLEAN;
  p_EmbeddedRecord_1869d425a51e TEXT;
  p_Configuration_1869d425a51e TEXT;
  p_ID_1869d425a51e UUID;
BEGIN
  p_DisplayName_1869d425a51e := 'From Stage';
  p_AutoUpdateDescription_1869d425a51e := TRUE;
  p_IsPrimaryKey_1869d425a51e := FALSE;
  p_IsUnique_1869d425a51e := FALSE;
  p_ValueListType_1869d425a51e := 'None';
  p_DefaultInView_1869d425a51e := TRUE;
  p_DefaultColumnWidth_1869d425a51e := 150;
  p_AllowUpdateAPI_1869d425a51e := FALSE;
  p_AllowUpdateInView_1869d425a51e := TRUE;
  p_IncludeInUserSearchAPI_1869d425a51e := FALSE;
  p_FullTextSearchEnabled_1869d425a51e := FALSE;
  p_IncludeInGeneratedForm_1869d425a51e := TRUE;
  p_GeneratedFormSection_1869d425a51e := 'Details';
  p_IsNameField_1869d425a51e := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_1869d425a51e := FALSE;
  p_RelatedEntityDisplayType_1869d425a51e := 'Search';
  p_AutoUpdateRelatedEntityInfo_1869d425a51e := TRUE;
  p_ValuesToPackWithSchema_1869d425a51e := 'Auto';
  p_Status_1869d425a51e := 'Active';
  p_AutoUpdateIsNameField_1869d425a51e := TRUE;
  p_AutoUpdateDefaultInView_1869d425a51e := FALSE;
  p_AutoUpdateCategory_1869d425a51e := TRUE;
  p_AutoUpdateDisplayName_1869d425a51e := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_1869d425a51e := TRUE;
  p_Encrypt_1869d425a51e := FALSE;
  p_AllowDecryptInAPI_1869d425a51e := FALSE;
  p_SendEncryptedValue_1869d425a51e := FALSE;
  p_IsSoftPrimaryKey_1869d425a51e := FALSE;
  p_IsSoftForeignKey_1869d425a51e := FALSE;
  p_JSONTypeIsArray_1869d425a51e := FALSE;
  p_UserSearchPredicateAPI_1869d425a51e := 'Contains';
  p_AutoUpdateUserSearchPredicate_1869d425a51e := TRUE;
  p_AutoUpdateFullTextSearch_1869d425a51e := TRUE;
  p_AutoUpdateExtendedType_1869d425a51e := TRUE;
  p_IsComputed_1869d425a51e := FALSE;
  p_ID_1869d425a51e := '86BF76F8-DFF6-48C8-847F-E7A599239EBB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_1869d425a51e,
    'Description', p_Description_1869d425a51e,
    'AutoUpdateDescription', p_AutoUpdateDescription_1869d425a51e,
    'IsPrimaryKey', p_IsPrimaryKey_1869d425a51e,
    'IsUnique', p_IsUnique_1869d425a51e,
    'Category', p_Category_1869d425a51e,
    'ValueListType', p_ValueListType_1869d425a51e,
    'ExtendedType', p_ExtendedType_1869d425a51e,
    'CodeType', p_CodeType_1869d425a51e,
    'DefaultInView', p_DefaultInView_1869d425a51e,
    'ViewCellTemplate', p_ViewCellTemplate_1869d425a51e,
    'DefaultColumnWidth', p_DefaultColumnWidth_1869d425a51e,
    'AllowUpdateAPI', p_AllowUpdateAPI_1869d425a51e,
    'AllowUpdateInView', p_AllowUpdateInView_1869d425a51e,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_1869d425a51e,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_1869d425a51e,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_1869d425a51e,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_1869d425a51e,
    'GeneratedFormSection', p_GeneratedFormSection_1869d425a51e,
    'IsNameField', p_IsNameField_1869d425a51e,
    'RelatedEntityID', p_RelatedEntityID_1869d425a51e,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_1869d425a51e,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_1869d425a51e,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_1869d425a51e,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_1869d425a51e,
    'EntityIDFieldName', p_EntityIDFieldName_1869d425a51e,
    'ScopeDefault', p_ScopeDefault_1869d425a51e,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_1869d425a51e,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_1869d425a51e,
    'Status', p_Status_1869d425a51e,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_1869d425a51e,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_1869d425a51e,
    'AutoUpdateCategory', p_AutoUpdateCategory_1869d425a51e,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_1869d425a51e,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_1869d425a51e,
    'Encrypt', p_Encrypt_1869d425a51e,
    'EncryptionKeyID', p_EncryptionKeyID_1869d425a51e,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_1869d425a51e,
    'SendEncryptedValue', p_SendEncryptedValue_1869d425a51e,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_1869d425a51e,
    'IsSoftForeignKey', p_IsSoftForeignKey_1869d425a51e,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_1869d425a51e,
    'JSONType', p_JSONType_1869d425a51e,
    'JSONTypeIsArray', p_JSONTypeIsArray_1869d425a51e,
    'JSONTypeDefinition', p_JSONTypeDefinition_1869d425a51e,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_1869d425a51e,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_1869d425a51e,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_1869d425a51e,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_1869d425a51e,
    'IsComputed', p_IsComputed_1869d425a51e
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_1869d425a51e,
    'Configuration', p_Configuration_1869d425a51e,
    'ID', p_ID_1869d425a51e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_1869d425a51e, p_Description := p_Description_1869d425a51e, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_1869d425a51e, p_IsPrimaryKey := p_IsPrimaryKey_1869d425a51e, p_IsUnique := p_IsUnique_1869d425a51e, p_Category := p_Category_1869d425a51e, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_1869d425a51e, p_ExtendedType := p_ExtendedType_1869d425a51e, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_1869d425a51e, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_1869d425a51e, p_ViewCellTemplate := p_ViewCellTemplate_1869d425a51e, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_1869d425a51e, p_AllowUpdateAPI := p_AllowUpdateAPI_1869d425a51e, p_AllowUpdateInView := p_AllowUpdateInView_1869d425a51e, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_1869d425a51e, p_FullTextSearchEnabled := p_FullTextSearchEnabled_1869d425a51e, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_1869d425a51e, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_1869d425a51e, p_GeneratedFormSection := p_GeneratedFormSection_1869d425a51e, p_IsNameField := p_IsNameField_1869d425a51e, p_RelatedEntityID := p_RelatedEntityID_1869d425a51e, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_1869d425a51e, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_1869d425a51e, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_1869d425a51e, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_1869d425a51e, p_EntityIDFieldName := p_EntityIDFieldName_1869d425a51e, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_1869d425a51e, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_1869d425a51e, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_1869d425a51e, p_Status := p_Status_1869d425a51e, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_1869d425a51e, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_1869d425a51e, p_AutoUpdateCategory := p_AutoUpdateCategory_1869d425a51e, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_1869d425a51e, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_1869d425a51e, p_Encrypt := p_Encrypt_1869d425a51e, p_EncryptionKeyID := p_EncryptionKeyID_1869d425a51e, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_1869d425a51e, p_SendEncryptedValue := p_SendEncryptedValue_1869d425a51e, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_1869d425a51e, p_IsSoftForeignKey := p_IsSoftForeignKey_1869d425a51e, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_1869d425a51e, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_1869d425a51e, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_1869d425a51e, p_JSONTypeDefinition := p_JSONTypeDefinition_1869d425a51e, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_1869d425a51e, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_1869d425a51e, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_1869d425a51e, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_1869d425a51e, p_IsComputed := p_IsComputed_1869d425a51e, p_EmbeddedRecord := p_EmbeddedRecord_1869d425a51e, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_1869d425a51e, p_Configuration_Clear := TRUE, p_ID := p_ID_1869d425a51e);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_913cac6a5d92 VARCHAR(255);
  p_Description_913cac6a5d92 TEXT;
  p_AutoUpdateDescription_913cac6a5d92 BOOLEAN;
  p_IsPrimaryKey_913cac6a5d92 BOOLEAN;
  p_IsUnique_913cac6a5d92 BOOLEAN;
  p_Category_913cac6a5d92 VARCHAR(255);
  p_ValueListType_913cac6a5d92 VARCHAR(20);
  p_ExtendedType_913cac6a5d92 VARCHAR(50);
  p_CodeType_913cac6a5d92 VARCHAR(50);
  p_DefaultInView_913cac6a5d92 BOOLEAN;
  p_ViewCellTemplate_913cac6a5d92 TEXT;
  p_DefaultColumnWidth_913cac6a5d92 INTEGER;
  p_AllowUpdateAPI_913cac6a5d92 BOOLEAN;
  p_AllowUpdateInView_913cac6a5d92 BOOLEAN;
  p_IncludeInUserSearchAPI_913cac6a5d92 BOOLEAN;
  p_FullTextSearchEnabled_913cac6a5d92 BOOLEAN;
  p_UserSearchParamFormatAPI_913cac6a5d92 VARCHAR(500);
  p_IncludeInGeneratedForm_913cac6a5d92 BOOLEAN;
  p_GeneratedFormSection_913cac6a5d92 VARCHAR(10);
  p_IsNameField_913cac6a5d92 BOOLEAN;
  p_RelatedEntityID_913cac6a5d92 UUID;
  p_RelatedEntityFieldName_913cac6a5d92 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_913cac6a5d92 BOOLEAN;
  p_RelatedEntityNameFieldMap_913cac6a5d92 VARCHAR(255);
  p_RelatedEntityDisplayType_913cac6a5d92 VARCHAR(20);
  p_EntityIDFieldName_913cac6a5d92 VARCHAR(100);
  p_ScopeDefault_913cac6a5d92 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_913cac6a5d92 BOOLEAN;
  p_ValuesToPackWithSchema_913cac6a5d92 VARCHAR(10);
  p_Status_913cac6a5d92 VARCHAR(25);
  p_AutoUpdateIsNameField_913cac6a5d92 BOOLEAN;
  p_AutoUpdateDefaultInView_913cac6a5d92 BOOLEAN;
  p_AutoUpdateCategory_913cac6a5d92 BOOLEAN;
  p_AutoUpdateDisplayName_913cac6a5d92 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_913cac6a5d92 BOOLEAN;
  p_Encrypt_913cac6a5d92 BOOLEAN;
  p_EncryptionKeyID_913cac6a5d92 UUID;
  p_AllowDecryptInAPI_913cac6a5d92 BOOLEAN;
  p_SendEncryptedValue_913cac6a5d92 BOOLEAN;
  p_IsSoftPrimaryKey_913cac6a5d92 BOOLEAN;
  p_IsSoftForeignKey_913cac6a5d92 BOOLEAN;
  p_RelatedEntityJoinFields_913cac6a5d92 TEXT;
  p_JSONType_913cac6a5d92 VARCHAR(255);
  p_JSONTypeIsArray_913cac6a5d92 BOOLEAN;
  p_JSONTypeDefinition_913cac6a5d92 TEXT;
  p_UserSearchPredicateAPI_913cac6a5d92 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_913cac6a5d92 BOOLEAN;
  p_AutoUpdateFullTextSearch_913cac6a5d92 BOOLEAN;
  p_AutoUpdateExtendedType_913cac6a5d92 BOOLEAN;
  p_IsComputed_913cac6a5d92 BOOLEAN;
  p_EmbeddedRecord_913cac6a5d92 TEXT;
  p_Configuration_913cac6a5d92 TEXT;
  p_ID_913cac6a5d92 UUID;
BEGIN
  p_DisplayName_913cac6a5d92 := 'To Stage';
  p_AutoUpdateDescription_913cac6a5d92 := TRUE;
  p_IsPrimaryKey_913cac6a5d92 := FALSE;
  p_IsUnique_913cac6a5d92 := FALSE;
  p_ValueListType_913cac6a5d92 := 'None';
  p_DefaultInView_913cac6a5d92 := TRUE;
  p_DefaultColumnWidth_913cac6a5d92 := 150;
  p_AllowUpdateAPI_913cac6a5d92 := FALSE;
  p_AllowUpdateInView_913cac6a5d92 := TRUE;
  p_IncludeInUserSearchAPI_913cac6a5d92 := FALSE;
  p_FullTextSearchEnabled_913cac6a5d92 := FALSE;
  p_IncludeInGeneratedForm_913cac6a5d92 := TRUE;
  p_GeneratedFormSection_913cac6a5d92 := 'Details';
  p_IsNameField_913cac6a5d92 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_913cac6a5d92 := FALSE;
  p_RelatedEntityDisplayType_913cac6a5d92 := 'Search';
  p_AutoUpdateRelatedEntityInfo_913cac6a5d92 := TRUE;
  p_ValuesToPackWithSchema_913cac6a5d92 := 'Auto';
  p_Status_913cac6a5d92 := 'Active';
  p_AutoUpdateIsNameField_913cac6a5d92 := TRUE;
  p_AutoUpdateDefaultInView_913cac6a5d92 := FALSE;
  p_AutoUpdateCategory_913cac6a5d92 := TRUE;
  p_AutoUpdateDisplayName_913cac6a5d92 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_913cac6a5d92 := TRUE;
  p_Encrypt_913cac6a5d92 := FALSE;
  p_AllowDecryptInAPI_913cac6a5d92 := FALSE;
  p_SendEncryptedValue_913cac6a5d92 := FALSE;
  p_IsSoftPrimaryKey_913cac6a5d92 := FALSE;
  p_IsSoftForeignKey_913cac6a5d92 := FALSE;
  p_JSONTypeIsArray_913cac6a5d92 := FALSE;
  p_UserSearchPredicateAPI_913cac6a5d92 := 'Contains';
  p_AutoUpdateUserSearchPredicate_913cac6a5d92 := TRUE;
  p_AutoUpdateFullTextSearch_913cac6a5d92 := TRUE;
  p_AutoUpdateExtendedType_913cac6a5d92 := TRUE;
  p_IsComputed_913cac6a5d92 := FALSE;
  p_ID_913cac6a5d92 := 'E4A61A1F-636B-44AE-966C-EEB5D2E90C0B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_913cac6a5d92,
    'Description', p_Description_913cac6a5d92,
    'AutoUpdateDescription', p_AutoUpdateDescription_913cac6a5d92,
    'IsPrimaryKey', p_IsPrimaryKey_913cac6a5d92,
    'IsUnique', p_IsUnique_913cac6a5d92,
    'Category', p_Category_913cac6a5d92,
    'ValueListType', p_ValueListType_913cac6a5d92,
    'ExtendedType', p_ExtendedType_913cac6a5d92,
    'CodeType', p_CodeType_913cac6a5d92,
    'DefaultInView', p_DefaultInView_913cac6a5d92,
    'ViewCellTemplate', p_ViewCellTemplate_913cac6a5d92,
    'DefaultColumnWidth', p_DefaultColumnWidth_913cac6a5d92,
    'AllowUpdateAPI', p_AllowUpdateAPI_913cac6a5d92,
    'AllowUpdateInView', p_AllowUpdateInView_913cac6a5d92,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_913cac6a5d92,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_913cac6a5d92,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_913cac6a5d92,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_913cac6a5d92,
    'GeneratedFormSection', p_GeneratedFormSection_913cac6a5d92,
    'IsNameField', p_IsNameField_913cac6a5d92,
    'RelatedEntityID', p_RelatedEntityID_913cac6a5d92,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_913cac6a5d92,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_913cac6a5d92,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_913cac6a5d92,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_913cac6a5d92,
    'EntityIDFieldName', p_EntityIDFieldName_913cac6a5d92,
    'ScopeDefault', p_ScopeDefault_913cac6a5d92,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_913cac6a5d92,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_913cac6a5d92,
    'Status', p_Status_913cac6a5d92,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_913cac6a5d92,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_913cac6a5d92,
    'AutoUpdateCategory', p_AutoUpdateCategory_913cac6a5d92,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_913cac6a5d92,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_913cac6a5d92,
    'Encrypt', p_Encrypt_913cac6a5d92,
    'EncryptionKeyID', p_EncryptionKeyID_913cac6a5d92,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_913cac6a5d92,
    'SendEncryptedValue', p_SendEncryptedValue_913cac6a5d92,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_913cac6a5d92,
    'IsSoftForeignKey', p_IsSoftForeignKey_913cac6a5d92,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_913cac6a5d92,
    'JSONType', p_JSONType_913cac6a5d92,
    'JSONTypeIsArray', p_JSONTypeIsArray_913cac6a5d92,
    'JSONTypeDefinition', p_JSONTypeDefinition_913cac6a5d92,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_913cac6a5d92,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_913cac6a5d92,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_913cac6a5d92,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_913cac6a5d92,
    'IsComputed', p_IsComputed_913cac6a5d92
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_913cac6a5d92,
    'Configuration', p_Configuration_913cac6a5d92,
    'ID', p_ID_913cac6a5d92
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_913cac6a5d92, p_Description := p_Description_913cac6a5d92, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_913cac6a5d92, p_IsPrimaryKey := p_IsPrimaryKey_913cac6a5d92, p_IsUnique := p_IsUnique_913cac6a5d92, p_Category := p_Category_913cac6a5d92, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_913cac6a5d92, p_ExtendedType := p_ExtendedType_913cac6a5d92, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_913cac6a5d92, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_913cac6a5d92, p_ViewCellTemplate := p_ViewCellTemplate_913cac6a5d92, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_913cac6a5d92, p_AllowUpdateAPI := p_AllowUpdateAPI_913cac6a5d92, p_AllowUpdateInView := p_AllowUpdateInView_913cac6a5d92, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_913cac6a5d92, p_FullTextSearchEnabled := p_FullTextSearchEnabled_913cac6a5d92, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_913cac6a5d92, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_913cac6a5d92, p_GeneratedFormSection := p_GeneratedFormSection_913cac6a5d92, p_IsNameField := p_IsNameField_913cac6a5d92, p_RelatedEntityID := p_RelatedEntityID_913cac6a5d92, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_913cac6a5d92, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_913cac6a5d92, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_913cac6a5d92, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_913cac6a5d92, p_EntityIDFieldName := p_EntityIDFieldName_913cac6a5d92, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_913cac6a5d92, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_913cac6a5d92, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_913cac6a5d92, p_Status := p_Status_913cac6a5d92, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_913cac6a5d92, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_913cac6a5d92, p_AutoUpdateCategory := p_AutoUpdateCategory_913cac6a5d92, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_913cac6a5d92, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_913cac6a5d92, p_Encrypt := p_Encrypt_913cac6a5d92, p_EncryptionKeyID := p_EncryptionKeyID_913cac6a5d92, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_913cac6a5d92, p_SendEncryptedValue := p_SendEncryptedValue_913cac6a5d92, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_913cac6a5d92, p_IsSoftForeignKey := p_IsSoftForeignKey_913cac6a5d92, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_913cac6a5d92, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_913cac6a5d92, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_913cac6a5d92, p_JSONTypeDefinition := p_JSONTypeDefinition_913cac6a5d92, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_913cac6a5d92, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_913cac6a5d92, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_913cac6a5d92, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_913cac6a5d92, p_IsComputed := p_IsComputed_913cac6a5d92, p_EmbeddedRecord := p_EmbeddedRecord_913cac6a5d92, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_913cac6a5d92, p_Configuration_Clear := TRUE, p_ID := p_ID_913cac6a5d92);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_5940e43e3ae1 VARCHAR(255);
  p_Description_5940e43e3ae1 TEXT;
  p_AutoUpdateDescription_5940e43e3ae1 BOOLEAN;
  p_IsPrimaryKey_5940e43e3ae1 BOOLEAN;
  p_IsUnique_5940e43e3ae1 BOOLEAN;
  p_Category_5940e43e3ae1 VARCHAR(255);
  p_ValueListType_5940e43e3ae1 VARCHAR(20);
  p_ExtendedType_5940e43e3ae1 VARCHAR(50);
  p_CodeType_5940e43e3ae1 VARCHAR(50);
  p_DefaultInView_5940e43e3ae1 BOOLEAN;
  p_ViewCellTemplate_5940e43e3ae1 TEXT;
  p_DefaultColumnWidth_5940e43e3ae1 INTEGER;
  p_AllowUpdateAPI_5940e43e3ae1 BOOLEAN;
  p_AllowUpdateInView_5940e43e3ae1 BOOLEAN;
  p_IncludeInUserSearchAPI_5940e43e3ae1 BOOLEAN;
  p_FullTextSearchEnabled_5940e43e3ae1 BOOLEAN;
  p_UserSearchParamFormatAPI_5940e43e3ae1 VARCHAR(500);
  p_IncludeInGeneratedForm_5940e43e3ae1 BOOLEAN;
  p_GeneratedFormSection_5940e43e3ae1 VARCHAR(10);
  p_IsNameField_5940e43e3ae1 BOOLEAN;
  p_RelatedEntityID_5940e43e3ae1 UUID;
  p_RelatedEntityFieldName_5940e43e3ae1 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_5940e43e3ae1 BOOLEAN;
  p_RelatedEntityNameFieldMap_5940e43e3ae1 VARCHAR(255);
  p_RelatedEntityDisplayType_5940e43e3ae1 VARCHAR(20);
  p_EntityIDFieldName_5940e43e3ae1 VARCHAR(100);
  p_ScopeDefault_5940e43e3ae1 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_5940e43e3ae1 BOOLEAN;
  p_ValuesToPackWithSchema_5940e43e3ae1 VARCHAR(10);
  p_Status_5940e43e3ae1 VARCHAR(25);
  p_AutoUpdateIsNameField_5940e43e3ae1 BOOLEAN;
  p_AutoUpdateDefaultInView_5940e43e3ae1 BOOLEAN;
  p_AutoUpdateCategory_5940e43e3ae1 BOOLEAN;
  p_AutoUpdateDisplayName_5940e43e3ae1 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_5940e43e3ae1 BOOLEAN;
  p_Encrypt_5940e43e3ae1 BOOLEAN;
  p_EncryptionKeyID_5940e43e3ae1 UUID;
  p_AllowDecryptInAPI_5940e43e3ae1 BOOLEAN;
  p_SendEncryptedValue_5940e43e3ae1 BOOLEAN;
  p_IsSoftPrimaryKey_5940e43e3ae1 BOOLEAN;
  p_IsSoftForeignKey_5940e43e3ae1 BOOLEAN;
  p_RelatedEntityJoinFields_5940e43e3ae1 TEXT;
  p_JSONType_5940e43e3ae1 VARCHAR(255);
  p_JSONTypeIsArray_5940e43e3ae1 BOOLEAN;
  p_JSONTypeDefinition_5940e43e3ae1 TEXT;
  p_UserSearchPredicateAPI_5940e43e3ae1 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_5940e43e3ae1 BOOLEAN;
  p_AutoUpdateFullTextSearch_5940e43e3ae1 BOOLEAN;
  p_AutoUpdateExtendedType_5940e43e3ae1 BOOLEAN;
  p_IsComputed_5940e43e3ae1 BOOLEAN;
  p_EmbeddedRecord_5940e43e3ae1 TEXT;
  p_Configuration_5940e43e3ae1 TEXT;
  p_ID_5940e43e3ae1 UUID;
BEGIN
  p_DisplayName_5940e43e3ae1 := 'From Deal Status Type';
  p_AutoUpdateDescription_5940e43e3ae1 := TRUE;
  p_IsPrimaryKey_5940e43e3ae1 := FALSE;
  p_IsUnique_5940e43e3ae1 := FALSE;
  p_ValueListType_5940e43e3ae1 := 'None';
  p_DefaultInView_5940e43e3ae1 := TRUE;
  p_DefaultColumnWidth_5940e43e3ae1 := 150;
  p_AllowUpdateAPI_5940e43e3ae1 := FALSE;
  p_AllowUpdateInView_5940e43e3ae1 := TRUE;
  p_IncludeInUserSearchAPI_5940e43e3ae1 := FALSE;
  p_FullTextSearchEnabled_5940e43e3ae1 := FALSE;
  p_IncludeInGeneratedForm_5940e43e3ae1 := TRUE;
  p_GeneratedFormSection_5940e43e3ae1 := 'Details';
  p_IsNameField_5940e43e3ae1 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_5940e43e3ae1 := FALSE;
  p_RelatedEntityDisplayType_5940e43e3ae1 := 'Search';
  p_AutoUpdateRelatedEntityInfo_5940e43e3ae1 := TRUE;
  p_ValuesToPackWithSchema_5940e43e3ae1 := 'Auto';
  p_Status_5940e43e3ae1 := 'Active';
  p_AutoUpdateIsNameField_5940e43e3ae1 := TRUE;
  p_AutoUpdateDefaultInView_5940e43e3ae1 := FALSE;
  p_AutoUpdateCategory_5940e43e3ae1 := TRUE;
  p_AutoUpdateDisplayName_5940e43e3ae1 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_5940e43e3ae1 := TRUE;
  p_Encrypt_5940e43e3ae1 := FALSE;
  p_AllowDecryptInAPI_5940e43e3ae1 := FALSE;
  p_SendEncryptedValue_5940e43e3ae1 := FALSE;
  p_IsSoftPrimaryKey_5940e43e3ae1 := FALSE;
  p_IsSoftForeignKey_5940e43e3ae1 := FALSE;
  p_JSONTypeIsArray_5940e43e3ae1 := FALSE;
  p_UserSearchPredicateAPI_5940e43e3ae1 := 'Contains';
  p_AutoUpdateUserSearchPredicate_5940e43e3ae1 := TRUE;
  p_AutoUpdateFullTextSearch_5940e43e3ae1 := TRUE;
  p_AutoUpdateExtendedType_5940e43e3ae1 := TRUE;
  p_IsComputed_5940e43e3ae1 := FALSE;
  p_ID_5940e43e3ae1 := 'C128B042-D1CB-4C14-B894-A7462A6868AB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_5940e43e3ae1,
    'Description', p_Description_5940e43e3ae1,
    'AutoUpdateDescription', p_AutoUpdateDescription_5940e43e3ae1,
    'IsPrimaryKey', p_IsPrimaryKey_5940e43e3ae1,
    'IsUnique', p_IsUnique_5940e43e3ae1,
    'Category', p_Category_5940e43e3ae1,
    'ValueListType', p_ValueListType_5940e43e3ae1,
    'ExtendedType', p_ExtendedType_5940e43e3ae1,
    'CodeType', p_CodeType_5940e43e3ae1,
    'DefaultInView', p_DefaultInView_5940e43e3ae1,
    'ViewCellTemplate', p_ViewCellTemplate_5940e43e3ae1,
    'DefaultColumnWidth', p_DefaultColumnWidth_5940e43e3ae1,
    'AllowUpdateAPI', p_AllowUpdateAPI_5940e43e3ae1,
    'AllowUpdateInView', p_AllowUpdateInView_5940e43e3ae1,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_5940e43e3ae1,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_5940e43e3ae1,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_5940e43e3ae1,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_5940e43e3ae1,
    'GeneratedFormSection', p_GeneratedFormSection_5940e43e3ae1,
    'IsNameField', p_IsNameField_5940e43e3ae1,
    'RelatedEntityID', p_RelatedEntityID_5940e43e3ae1,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_5940e43e3ae1,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_5940e43e3ae1,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_5940e43e3ae1,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_5940e43e3ae1,
    'EntityIDFieldName', p_EntityIDFieldName_5940e43e3ae1,
    'ScopeDefault', p_ScopeDefault_5940e43e3ae1,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_5940e43e3ae1,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_5940e43e3ae1,
    'Status', p_Status_5940e43e3ae1,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_5940e43e3ae1,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_5940e43e3ae1,
    'AutoUpdateCategory', p_AutoUpdateCategory_5940e43e3ae1,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_5940e43e3ae1,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_5940e43e3ae1,
    'Encrypt', p_Encrypt_5940e43e3ae1,
    'EncryptionKeyID', p_EncryptionKeyID_5940e43e3ae1,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_5940e43e3ae1,
    'SendEncryptedValue', p_SendEncryptedValue_5940e43e3ae1,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_5940e43e3ae1,
    'IsSoftForeignKey', p_IsSoftForeignKey_5940e43e3ae1,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_5940e43e3ae1,
    'JSONType', p_JSONType_5940e43e3ae1,
    'JSONTypeIsArray', p_JSONTypeIsArray_5940e43e3ae1,
    'JSONTypeDefinition', p_JSONTypeDefinition_5940e43e3ae1,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_5940e43e3ae1,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_5940e43e3ae1,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_5940e43e3ae1,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_5940e43e3ae1,
    'IsComputed', p_IsComputed_5940e43e3ae1
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_5940e43e3ae1,
    'Configuration', p_Configuration_5940e43e3ae1,
    'ID', p_ID_5940e43e3ae1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_5940e43e3ae1, p_Description := p_Description_5940e43e3ae1, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_5940e43e3ae1, p_IsPrimaryKey := p_IsPrimaryKey_5940e43e3ae1, p_IsUnique := p_IsUnique_5940e43e3ae1, p_Category := p_Category_5940e43e3ae1, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_5940e43e3ae1, p_ExtendedType := p_ExtendedType_5940e43e3ae1, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_5940e43e3ae1, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_5940e43e3ae1, p_ViewCellTemplate := p_ViewCellTemplate_5940e43e3ae1, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_5940e43e3ae1, p_AllowUpdateAPI := p_AllowUpdateAPI_5940e43e3ae1, p_AllowUpdateInView := p_AllowUpdateInView_5940e43e3ae1, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_5940e43e3ae1, p_FullTextSearchEnabled := p_FullTextSearchEnabled_5940e43e3ae1, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_5940e43e3ae1, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_5940e43e3ae1, p_GeneratedFormSection := p_GeneratedFormSection_5940e43e3ae1, p_IsNameField := p_IsNameField_5940e43e3ae1, p_RelatedEntityID := p_RelatedEntityID_5940e43e3ae1, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_5940e43e3ae1, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_5940e43e3ae1, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_5940e43e3ae1, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_5940e43e3ae1, p_EntityIDFieldName := p_EntityIDFieldName_5940e43e3ae1, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_5940e43e3ae1, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_5940e43e3ae1, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_5940e43e3ae1, p_Status := p_Status_5940e43e3ae1, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_5940e43e3ae1, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_5940e43e3ae1, p_AutoUpdateCategory := p_AutoUpdateCategory_5940e43e3ae1, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_5940e43e3ae1, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_5940e43e3ae1, p_Encrypt := p_Encrypt_5940e43e3ae1, p_EncryptionKeyID := p_EncryptionKeyID_5940e43e3ae1, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_5940e43e3ae1, p_SendEncryptedValue := p_SendEncryptedValue_5940e43e3ae1, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_5940e43e3ae1, p_IsSoftForeignKey := p_IsSoftForeignKey_5940e43e3ae1, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_5940e43e3ae1, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_5940e43e3ae1, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_5940e43e3ae1, p_JSONTypeDefinition := p_JSONTypeDefinition_5940e43e3ae1, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_5940e43e3ae1, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_5940e43e3ae1, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_5940e43e3ae1, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_5940e43e3ae1, p_IsComputed := p_IsComputed_5940e43e3ae1, p_EmbeddedRecord := p_EmbeddedRecord_5940e43e3ae1, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_5940e43e3ae1, p_Configuration_Clear := TRUE, p_ID := p_ID_5940e43e3ae1);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_cb985a758c86 VARCHAR(255);
  p_Description_cb985a758c86 TEXT;
  p_AutoUpdateDescription_cb985a758c86 BOOLEAN;
  p_IsPrimaryKey_cb985a758c86 BOOLEAN;
  p_IsUnique_cb985a758c86 BOOLEAN;
  p_Category_cb985a758c86 VARCHAR(255);
  p_ValueListType_cb985a758c86 VARCHAR(20);
  p_ExtendedType_cb985a758c86 VARCHAR(50);
  p_CodeType_cb985a758c86 VARCHAR(50);
  p_DefaultInView_cb985a758c86 BOOLEAN;
  p_ViewCellTemplate_cb985a758c86 TEXT;
  p_DefaultColumnWidth_cb985a758c86 INTEGER;
  p_AllowUpdateAPI_cb985a758c86 BOOLEAN;
  p_AllowUpdateInView_cb985a758c86 BOOLEAN;
  p_IncludeInUserSearchAPI_cb985a758c86 BOOLEAN;
  p_FullTextSearchEnabled_cb985a758c86 BOOLEAN;
  p_UserSearchParamFormatAPI_cb985a758c86 VARCHAR(500);
  p_IncludeInGeneratedForm_cb985a758c86 BOOLEAN;
  p_GeneratedFormSection_cb985a758c86 VARCHAR(10);
  p_IsNameField_cb985a758c86 BOOLEAN;
  p_RelatedEntityID_cb985a758c86 UUID;
  p_RelatedEntityFieldName_cb985a758c86 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_cb985a758c86 BOOLEAN;
  p_RelatedEntityNameFieldMap_cb985a758c86 VARCHAR(255);
  p_RelatedEntityDisplayType_cb985a758c86 VARCHAR(20);
  p_EntityIDFieldName_cb985a758c86 VARCHAR(100);
  p_ScopeDefault_cb985a758c86 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_cb985a758c86 BOOLEAN;
  p_ValuesToPackWithSchema_cb985a758c86 VARCHAR(10);
  p_Status_cb985a758c86 VARCHAR(25);
  p_AutoUpdateIsNameField_cb985a758c86 BOOLEAN;
  p_AutoUpdateDefaultInView_cb985a758c86 BOOLEAN;
  p_AutoUpdateCategory_cb985a758c86 BOOLEAN;
  p_AutoUpdateDisplayName_cb985a758c86 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_cb985a758c86 BOOLEAN;
  p_Encrypt_cb985a758c86 BOOLEAN;
  p_EncryptionKeyID_cb985a758c86 UUID;
  p_AllowDecryptInAPI_cb985a758c86 BOOLEAN;
  p_SendEncryptedValue_cb985a758c86 BOOLEAN;
  p_IsSoftPrimaryKey_cb985a758c86 BOOLEAN;
  p_IsSoftForeignKey_cb985a758c86 BOOLEAN;
  p_RelatedEntityJoinFields_cb985a758c86 TEXT;
  p_JSONType_cb985a758c86 VARCHAR(255);
  p_JSONTypeIsArray_cb985a758c86 BOOLEAN;
  p_JSONTypeDefinition_cb985a758c86 TEXT;
  p_UserSearchPredicateAPI_cb985a758c86 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_cb985a758c86 BOOLEAN;
  p_AutoUpdateFullTextSearch_cb985a758c86 BOOLEAN;
  p_AutoUpdateExtendedType_cb985a758c86 BOOLEAN;
  p_IsComputed_cb985a758c86 BOOLEAN;
  p_EmbeddedRecord_cb985a758c86 TEXT;
  p_Configuration_cb985a758c86 TEXT;
  p_ID_cb985a758c86 UUID;
BEGIN
  p_DisplayName_cb985a758c86 := 'To Deal Status Type';
  p_AutoUpdateDescription_cb985a758c86 := TRUE;
  p_IsPrimaryKey_cb985a758c86 := FALSE;
  p_IsUnique_cb985a758c86 := FALSE;
  p_ValueListType_cb985a758c86 := 'None';
  p_DefaultInView_cb985a758c86 := TRUE;
  p_DefaultColumnWidth_cb985a758c86 := 150;
  p_AllowUpdateAPI_cb985a758c86 := FALSE;
  p_AllowUpdateInView_cb985a758c86 := TRUE;
  p_IncludeInUserSearchAPI_cb985a758c86 := FALSE;
  p_FullTextSearchEnabled_cb985a758c86 := FALSE;
  p_IncludeInGeneratedForm_cb985a758c86 := TRUE;
  p_GeneratedFormSection_cb985a758c86 := 'Details';
  p_IsNameField_cb985a758c86 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_cb985a758c86 := FALSE;
  p_RelatedEntityDisplayType_cb985a758c86 := 'Search';
  p_AutoUpdateRelatedEntityInfo_cb985a758c86 := TRUE;
  p_ValuesToPackWithSchema_cb985a758c86 := 'Auto';
  p_Status_cb985a758c86 := 'Active';
  p_AutoUpdateIsNameField_cb985a758c86 := TRUE;
  p_AutoUpdateDefaultInView_cb985a758c86 := FALSE;
  p_AutoUpdateCategory_cb985a758c86 := TRUE;
  p_AutoUpdateDisplayName_cb985a758c86 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_cb985a758c86 := TRUE;
  p_Encrypt_cb985a758c86 := FALSE;
  p_AllowDecryptInAPI_cb985a758c86 := FALSE;
  p_SendEncryptedValue_cb985a758c86 := FALSE;
  p_IsSoftPrimaryKey_cb985a758c86 := FALSE;
  p_IsSoftForeignKey_cb985a758c86 := FALSE;
  p_JSONTypeIsArray_cb985a758c86 := FALSE;
  p_UserSearchPredicateAPI_cb985a758c86 := 'Contains';
  p_AutoUpdateUserSearchPredicate_cb985a758c86 := TRUE;
  p_AutoUpdateFullTextSearch_cb985a758c86 := TRUE;
  p_AutoUpdateExtendedType_cb985a758c86 := TRUE;
  p_IsComputed_cb985a758c86 := FALSE;
  p_ID_cb985a758c86 := 'C8453BCE-FAED-4350-AB26-CB6EDB6E944B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_cb985a758c86,
    'Description', p_Description_cb985a758c86,
    'AutoUpdateDescription', p_AutoUpdateDescription_cb985a758c86,
    'IsPrimaryKey', p_IsPrimaryKey_cb985a758c86,
    'IsUnique', p_IsUnique_cb985a758c86,
    'Category', p_Category_cb985a758c86,
    'ValueListType', p_ValueListType_cb985a758c86,
    'ExtendedType', p_ExtendedType_cb985a758c86,
    'CodeType', p_CodeType_cb985a758c86,
    'DefaultInView', p_DefaultInView_cb985a758c86,
    'ViewCellTemplate', p_ViewCellTemplate_cb985a758c86,
    'DefaultColumnWidth', p_DefaultColumnWidth_cb985a758c86,
    'AllowUpdateAPI', p_AllowUpdateAPI_cb985a758c86,
    'AllowUpdateInView', p_AllowUpdateInView_cb985a758c86,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_cb985a758c86,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_cb985a758c86,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_cb985a758c86,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_cb985a758c86,
    'GeneratedFormSection', p_GeneratedFormSection_cb985a758c86,
    'IsNameField', p_IsNameField_cb985a758c86,
    'RelatedEntityID', p_RelatedEntityID_cb985a758c86,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_cb985a758c86,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_cb985a758c86,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_cb985a758c86,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_cb985a758c86,
    'EntityIDFieldName', p_EntityIDFieldName_cb985a758c86,
    'ScopeDefault', p_ScopeDefault_cb985a758c86,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_cb985a758c86,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_cb985a758c86,
    'Status', p_Status_cb985a758c86,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_cb985a758c86,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_cb985a758c86,
    'AutoUpdateCategory', p_AutoUpdateCategory_cb985a758c86,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_cb985a758c86,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_cb985a758c86,
    'Encrypt', p_Encrypt_cb985a758c86,
    'EncryptionKeyID', p_EncryptionKeyID_cb985a758c86,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_cb985a758c86,
    'SendEncryptedValue', p_SendEncryptedValue_cb985a758c86,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_cb985a758c86,
    'IsSoftForeignKey', p_IsSoftForeignKey_cb985a758c86,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_cb985a758c86,
    'JSONType', p_JSONType_cb985a758c86,
    'JSONTypeIsArray', p_JSONTypeIsArray_cb985a758c86,
    'JSONTypeDefinition', p_JSONTypeDefinition_cb985a758c86,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_cb985a758c86,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_cb985a758c86,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_cb985a758c86,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_cb985a758c86,
    'IsComputed', p_IsComputed_cb985a758c86
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_cb985a758c86,
    'Configuration', p_Configuration_cb985a758c86,
    'ID', p_ID_cb985a758c86
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_cb985a758c86, p_Description := p_Description_cb985a758c86, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_cb985a758c86, p_IsPrimaryKey := p_IsPrimaryKey_cb985a758c86, p_IsUnique := p_IsUnique_cb985a758c86, p_Category := p_Category_cb985a758c86, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_cb985a758c86, p_ExtendedType := p_ExtendedType_cb985a758c86, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_cb985a758c86, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_cb985a758c86, p_ViewCellTemplate := p_ViewCellTemplate_cb985a758c86, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_cb985a758c86, p_AllowUpdateAPI := p_AllowUpdateAPI_cb985a758c86, p_AllowUpdateInView := p_AllowUpdateInView_cb985a758c86, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_cb985a758c86, p_FullTextSearchEnabled := p_FullTextSearchEnabled_cb985a758c86, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_cb985a758c86, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_cb985a758c86, p_GeneratedFormSection := p_GeneratedFormSection_cb985a758c86, p_IsNameField := p_IsNameField_cb985a758c86, p_RelatedEntityID := p_RelatedEntityID_cb985a758c86, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_cb985a758c86, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_cb985a758c86, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_cb985a758c86, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_cb985a758c86, p_EntityIDFieldName := p_EntityIDFieldName_cb985a758c86, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_cb985a758c86, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_cb985a758c86, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_cb985a758c86, p_Status := p_Status_cb985a758c86, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_cb985a758c86, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_cb985a758c86, p_AutoUpdateCategory := p_AutoUpdateCategory_cb985a758c86, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_cb985a758c86, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_cb985a758c86, p_Encrypt := p_Encrypt_cb985a758c86, p_EncryptionKeyID := p_EncryptionKeyID_cb985a758c86, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_cb985a758c86, p_SendEncryptedValue := p_SendEncryptedValue_cb985a758c86, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_cb985a758c86, p_IsSoftForeignKey := p_IsSoftForeignKey_cb985a758c86, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_cb985a758c86, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_cb985a758c86, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_cb985a758c86, p_JSONTypeDefinition := p_JSONTypeDefinition_cb985a758c86, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_cb985a758c86, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_cb985a758c86, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_cb985a758c86, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_cb985a758c86, p_IsComputed := p_IsComputed_cb985a758c86, p_EmbeddedRecord := p_EmbeddedRecord_cb985a758c86, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_cb985a758c86, p_Configuration_Clear := TRUE, p_ID := p_ID_cb985a758c86);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_c96111de4660 VARCHAR(255);
  p_Description_c96111de4660 TEXT;
  p_AutoUpdateDescription_c96111de4660 BOOLEAN;
  p_IsPrimaryKey_c96111de4660 BOOLEAN;
  p_IsUnique_c96111de4660 BOOLEAN;
  p_Category_c96111de4660 VARCHAR(255);
  p_ValueListType_c96111de4660 VARCHAR(20);
  p_ExtendedType_c96111de4660 VARCHAR(50);
  p_CodeType_c96111de4660 VARCHAR(50);
  p_DefaultInView_c96111de4660 BOOLEAN;
  p_ViewCellTemplate_c96111de4660 TEXT;
  p_DefaultColumnWidth_c96111de4660 INTEGER;
  p_AllowUpdateAPI_c96111de4660 BOOLEAN;
  p_AllowUpdateInView_c96111de4660 BOOLEAN;
  p_IncludeInUserSearchAPI_c96111de4660 BOOLEAN;
  p_FullTextSearchEnabled_c96111de4660 BOOLEAN;
  p_UserSearchParamFormatAPI_c96111de4660 VARCHAR(500);
  p_IncludeInGeneratedForm_c96111de4660 BOOLEAN;
  p_GeneratedFormSection_c96111de4660 VARCHAR(10);
  p_IsNameField_c96111de4660 BOOLEAN;
  p_RelatedEntityID_c96111de4660 UUID;
  p_RelatedEntityFieldName_c96111de4660 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_c96111de4660 BOOLEAN;
  p_RelatedEntityNameFieldMap_c96111de4660 VARCHAR(255);
  p_RelatedEntityDisplayType_c96111de4660 VARCHAR(20);
  p_EntityIDFieldName_c96111de4660 VARCHAR(100);
  p_ScopeDefault_c96111de4660 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_c96111de4660 BOOLEAN;
  p_ValuesToPackWithSchema_c96111de4660 VARCHAR(10);
  p_Status_c96111de4660 VARCHAR(25);
  p_AutoUpdateIsNameField_c96111de4660 BOOLEAN;
  p_AutoUpdateDefaultInView_c96111de4660 BOOLEAN;
  p_AutoUpdateCategory_c96111de4660 BOOLEAN;
  p_AutoUpdateDisplayName_c96111de4660 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_c96111de4660 BOOLEAN;
  p_Encrypt_c96111de4660 BOOLEAN;
  p_EncryptionKeyID_c96111de4660 UUID;
  p_AllowDecryptInAPI_c96111de4660 BOOLEAN;
  p_SendEncryptedValue_c96111de4660 BOOLEAN;
  p_IsSoftPrimaryKey_c96111de4660 BOOLEAN;
  p_IsSoftForeignKey_c96111de4660 BOOLEAN;
  p_RelatedEntityJoinFields_c96111de4660 TEXT;
  p_JSONType_c96111de4660 VARCHAR(255);
  p_JSONTypeIsArray_c96111de4660 BOOLEAN;
  p_JSONTypeDefinition_c96111de4660 TEXT;
  p_UserSearchPredicateAPI_c96111de4660 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_c96111de4660 BOOLEAN;
  p_AutoUpdateFullTextSearch_c96111de4660 BOOLEAN;
  p_AutoUpdateExtendedType_c96111de4660 BOOLEAN;
  p_IsComputed_c96111de4660 BOOLEAN;
  p_EmbeddedRecord_c96111de4660 TEXT;
  p_Configuration_c96111de4660 TEXT;
  p_ID_c96111de4660 UUID;
BEGIN
  p_DisplayName_c96111de4660 := 'Changed By User';
  p_AutoUpdateDescription_c96111de4660 := TRUE;
  p_IsPrimaryKey_c96111de4660 := FALSE;
  p_IsUnique_c96111de4660 := FALSE;
  p_ValueListType_c96111de4660 := 'None';
  p_DefaultInView_c96111de4660 := TRUE;
  p_DefaultColumnWidth_c96111de4660 := 150;
  p_AllowUpdateAPI_c96111de4660 := FALSE;
  p_AllowUpdateInView_c96111de4660 := TRUE;
  p_IncludeInUserSearchAPI_c96111de4660 := FALSE;
  p_FullTextSearchEnabled_c96111de4660 := FALSE;
  p_IncludeInGeneratedForm_c96111de4660 := TRUE;
  p_GeneratedFormSection_c96111de4660 := 'Details';
  p_IsNameField_c96111de4660 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_c96111de4660 := FALSE;
  p_RelatedEntityDisplayType_c96111de4660 := 'Search';
  p_AutoUpdateRelatedEntityInfo_c96111de4660 := TRUE;
  p_ValuesToPackWithSchema_c96111de4660 := 'Auto';
  p_Status_c96111de4660 := 'Active';
  p_AutoUpdateIsNameField_c96111de4660 := TRUE;
  p_AutoUpdateDefaultInView_c96111de4660 := FALSE;
  p_AutoUpdateCategory_c96111de4660 := TRUE;
  p_AutoUpdateDisplayName_c96111de4660 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_c96111de4660 := TRUE;
  p_Encrypt_c96111de4660 := FALSE;
  p_AllowDecryptInAPI_c96111de4660 := FALSE;
  p_SendEncryptedValue_c96111de4660 := FALSE;
  p_IsSoftPrimaryKey_c96111de4660 := FALSE;
  p_IsSoftForeignKey_c96111de4660 := FALSE;
  p_JSONTypeIsArray_c96111de4660 := FALSE;
  p_UserSearchPredicateAPI_c96111de4660 := 'Contains';
  p_AutoUpdateUserSearchPredicate_c96111de4660 := TRUE;
  p_AutoUpdateFullTextSearch_c96111de4660 := TRUE;
  p_AutoUpdateExtendedType_c96111de4660 := TRUE;
  p_IsComputed_c96111de4660 := FALSE;
  p_ID_c96111de4660 := '0481D40B-B8D8-4300-9C49-FEB4749EA080';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_c96111de4660,
    'Description', p_Description_c96111de4660,
    'AutoUpdateDescription', p_AutoUpdateDescription_c96111de4660,
    'IsPrimaryKey', p_IsPrimaryKey_c96111de4660,
    'IsUnique', p_IsUnique_c96111de4660,
    'Category', p_Category_c96111de4660,
    'ValueListType', p_ValueListType_c96111de4660,
    'ExtendedType', p_ExtendedType_c96111de4660,
    'CodeType', p_CodeType_c96111de4660,
    'DefaultInView', p_DefaultInView_c96111de4660,
    'ViewCellTemplate', p_ViewCellTemplate_c96111de4660,
    'DefaultColumnWidth', p_DefaultColumnWidth_c96111de4660,
    'AllowUpdateAPI', p_AllowUpdateAPI_c96111de4660,
    'AllowUpdateInView', p_AllowUpdateInView_c96111de4660,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_c96111de4660,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_c96111de4660,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_c96111de4660,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_c96111de4660,
    'GeneratedFormSection', p_GeneratedFormSection_c96111de4660,
    'IsNameField', p_IsNameField_c96111de4660,
    'RelatedEntityID', p_RelatedEntityID_c96111de4660,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_c96111de4660,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_c96111de4660,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_c96111de4660,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_c96111de4660,
    'EntityIDFieldName', p_EntityIDFieldName_c96111de4660,
    'ScopeDefault', p_ScopeDefault_c96111de4660,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_c96111de4660,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_c96111de4660,
    'Status', p_Status_c96111de4660,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_c96111de4660,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_c96111de4660,
    'AutoUpdateCategory', p_AutoUpdateCategory_c96111de4660,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_c96111de4660,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_c96111de4660,
    'Encrypt', p_Encrypt_c96111de4660,
    'EncryptionKeyID', p_EncryptionKeyID_c96111de4660,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_c96111de4660,
    'SendEncryptedValue', p_SendEncryptedValue_c96111de4660,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_c96111de4660,
    'IsSoftForeignKey', p_IsSoftForeignKey_c96111de4660,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_c96111de4660,
    'JSONType', p_JSONType_c96111de4660,
    'JSONTypeIsArray', p_JSONTypeIsArray_c96111de4660,
    'JSONTypeDefinition', p_JSONTypeDefinition_c96111de4660,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_c96111de4660,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_c96111de4660,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_c96111de4660,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_c96111de4660,
    'IsComputed', p_IsComputed_c96111de4660
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_c96111de4660,
    'Configuration', p_Configuration_c96111de4660,
    'ID', p_ID_c96111de4660
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_c96111de4660, p_Description := p_Description_c96111de4660, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_c96111de4660, p_IsPrimaryKey := p_IsPrimaryKey_c96111de4660, p_IsUnique := p_IsUnique_c96111de4660, p_Category := p_Category_c96111de4660, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_c96111de4660, p_ExtendedType := p_ExtendedType_c96111de4660, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_c96111de4660, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_c96111de4660, p_ViewCellTemplate := p_ViewCellTemplate_c96111de4660, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_c96111de4660, p_AllowUpdateAPI := p_AllowUpdateAPI_c96111de4660, p_AllowUpdateInView := p_AllowUpdateInView_c96111de4660, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_c96111de4660, p_FullTextSearchEnabled := p_FullTextSearchEnabled_c96111de4660, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_c96111de4660, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_c96111de4660, p_GeneratedFormSection := p_GeneratedFormSection_c96111de4660, p_IsNameField := p_IsNameField_c96111de4660, p_RelatedEntityID := p_RelatedEntityID_c96111de4660, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_c96111de4660, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_c96111de4660, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_c96111de4660, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_c96111de4660, p_EntityIDFieldName := p_EntityIDFieldName_c96111de4660, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_c96111de4660, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_c96111de4660, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_c96111de4660, p_Status := p_Status_c96111de4660, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_c96111de4660, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_c96111de4660, p_AutoUpdateCategory := p_AutoUpdateCategory_c96111de4660, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_c96111de4660, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_c96111de4660, p_Encrypt := p_Encrypt_c96111de4660, p_EncryptionKeyID := p_EncryptionKeyID_c96111de4660, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_c96111de4660, p_SendEncryptedValue := p_SendEncryptedValue_c96111de4660, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_c96111de4660, p_IsSoftForeignKey := p_IsSoftForeignKey_c96111de4660, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_c96111de4660, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_c96111de4660, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_c96111de4660, p_JSONTypeDefinition := p_JSONTypeDefinition_c96111de4660, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_c96111de4660, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_c96111de4660, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_c96111de4660, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_c96111de4660, p_IsComputed := p_IsComputed_c96111de4660, p_EmbeddedRecord := p_EmbeddedRecord_c96111de4660, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_c96111de4660, p_Configuration_Clear := TRUE, p_ID := p_ID_c96111de4660);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_b86476eeef6c VARCHAR(255);
  p_Description_b86476eeef6c TEXT;
  p_AutoUpdateDescription_b86476eeef6c BOOLEAN;
  p_IsPrimaryKey_b86476eeef6c BOOLEAN;
  p_IsUnique_b86476eeef6c BOOLEAN;
  p_Category_b86476eeef6c VARCHAR(255);
  p_ValueListType_b86476eeef6c VARCHAR(20);
  p_ExtendedType_b86476eeef6c VARCHAR(50);
  p_CodeType_b86476eeef6c VARCHAR(50);
  p_DefaultInView_b86476eeef6c BOOLEAN;
  p_ViewCellTemplate_b86476eeef6c TEXT;
  p_DefaultColumnWidth_b86476eeef6c INTEGER;
  p_AllowUpdateAPI_b86476eeef6c BOOLEAN;
  p_AllowUpdateInView_b86476eeef6c BOOLEAN;
  p_IncludeInUserSearchAPI_b86476eeef6c BOOLEAN;
  p_FullTextSearchEnabled_b86476eeef6c BOOLEAN;
  p_UserSearchParamFormatAPI_b86476eeef6c VARCHAR(500);
  p_IncludeInGeneratedForm_b86476eeef6c BOOLEAN;
  p_GeneratedFormSection_b86476eeef6c VARCHAR(10);
  p_IsNameField_b86476eeef6c BOOLEAN;
  p_RelatedEntityID_b86476eeef6c UUID;
  p_RelatedEntityFieldName_b86476eeef6c VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_b86476eeef6c BOOLEAN;
  p_RelatedEntityNameFieldMap_b86476eeef6c VARCHAR(255);
  p_RelatedEntityDisplayType_b86476eeef6c VARCHAR(20);
  p_EntityIDFieldName_b86476eeef6c VARCHAR(100);
  p_ScopeDefault_b86476eeef6c VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_b86476eeef6c BOOLEAN;
  p_ValuesToPackWithSchema_b86476eeef6c VARCHAR(10);
  p_Status_b86476eeef6c VARCHAR(25);
  p_AutoUpdateIsNameField_b86476eeef6c BOOLEAN;
  p_AutoUpdateDefaultInView_b86476eeef6c BOOLEAN;
  p_AutoUpdateCategory_b86476eeef6c BOOLEAN;
  p_AutoUpdateDisplayName_b86476eeef6c BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_b86476eeef6c BOOLEAN;
  p_Encrypt_b86476eeef6c BOOLEAN;
  p_EncryptionKeyID_b86476eeef6c UUID;
  p_AllowDecryptInAPI_b86476eeef6c BOOLEAN;
  p_SendEncryptedValue_b86476eeef6c BOOLEAN;
  p_IsSoftPrimaryKey_b86476eeef6c BOOLEAN;
  p_IsSoftForeignKey_b86476eeef6c BOOLEAN;
  p_RelatedEntityJoinFields_b86476eeef6c TEXT;
  p_JSONType_b86476eeef6c VARCHAR(255);
  p_JSONTypeIsArray_b86476eeef6c BOOLEAN;
  p_JSONTypeDefinition_b86476eeef6c TEXT;
  p_UserSearchPredicateAPI_b86476eeef6c VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_b86476eeef6c BOOLEAN;
  p_AutoUpdateFullTextSearch_b86476eeef6c BOOLEAN;
  p_AutoUpdateExtendedType_b86476eeef6c BOOLEAN;
  p_IsComputed_b86476eeef6c BOOLEAN;
  p_EmbeddedRecord_b86476eeef6c TEXT;
  p_Configuration_b86476eeef6c TEXT;
  p_ID_b86476eeef6c UUID;
BEGIN
  p_DisplayName_b86476eeef6c := 'Days In Previous Stage';
  p_AutoUpdateDescription_b86476eeef6c := TRUE;
  p_IsPrimaryKey_b86476eeef6c := FALSE;
  p_IsUnique_b86476eeef6c := FALSE;
  p_ValueListType_b86476eeef6c := 'None';
  p_DefaultInView_b86476eeef6c := TRUE;
  p_DefaultColumnWidth_b86476eeef6c := 50;
  p_AllowUpdateAPI_b86476eeef6c := TRUE;
  p_AllowUpdateInView_b86476eeef6c := TRUE;
  p_IncludeInUserSearchAPI_b86476eeef6c := FALSE;
  p_FullTextSearchEnabled_b86476eeef6c := FALSE;
  p_IncludeInGeneratedForm_b86476eeef6c := TRUE;
  p_GeneratedFormSection_b86476eeef6c := 'Details';
  p_IsNameField_b86476eeef6c := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_b86476eeef6c := FALSE;
  p_RelatedEntityDisplayType_b86476eeef6c := 'Search';
  p_AutoUpdateRelatedEntityInfo_b86476eeef6c := TRUE;
  p_ValuesToPackWithSchema_b86476eeef6c := 'Auto';
  p_Status_b86476eeef6c := 'Active';
  p_AutoUpdateIsNameField_b86476eeef6c := TRUE;
  p_AutoUpdateDefaultInView_b86476eeef6c := FALSE;
  p_AutoUpdateCategory_b86476eeef6c := TRUE;
  p_AutoUpdateDisplayName_b86476eeef6c := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_b86476eeef6c := TRUE;
  p_Encrypt_b86476eeef6c := FALSE;
  p_AllowDecryptInAPI_b86476eeef6c := FALSE;
  p_SendEncryptedValue_b86476eeef6c := FALSE;
  p_IsSoftPrimaryKey_b86476eeef6c := FALSE;
  p_IsSoftForeignKey_b86476eeef6c := FALSE;
  p_JSONTypeIsArray_b86476eeef6c := FALSE;
  p_UserSearchPredicateAPI_b86476eeef6c := 'Contains';
  p_AutoUpdateUserSearchPredicate_b86476eeef6c := TRUE;
  p_AutoUpdateFullTextSearch_b86476eeef6c := TRUE;
  p_AutoUpdateExtendedType_b86476eeef6c := TRUE;
  p_IsComputed_b86476eeef6c := FALSE;
  p_ID_b86476eeef6c := '9DDCE3FC-53BD-4076-A727-50408C538721';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_b86476eeef6c,
    'Description', p_Description_b86476eeef6c,
    'AutoUpdateDescription', p_AutoUpdateDescription_b86476eeef6c,
    'IsPrimaryKey', p_IsPrimaryKey_b86476eeef6c,
    'IsUnique', p_IsUnique_b86476eeef6c,
    'Category', p_Category_b86476eeef6c,
    'ValueListType', p_ValueListType_b86476eeef6c,
    'ExtendedType', p_ExtendedType_b86476eeef6c,
    'CodeType', p_CodeType_b86476eeef6c,
    'DefaultInView', p_DefaultInView_b86476eeef6c,
    'ViewCellTemplate', p_ViewCellTemplate_b86476eeef6c,
    'DefaultColumnWidth', p_DefaultColumnWidth_b86476eeef6c,
    'AllowUpdateAPI', p_AllowUpdateAPI_b86476eeef6c,
    'AllowUpdateInView', p_AllowUpdateInView_b86476eeef6c,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_b86476eeef6c,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_b86476eeef6c,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_b86476eeef6c,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_b86476eeef6c,
    'GeneratedFormSection', p_GeneratedFormSection_b86476eeef6c,
    'IsNameField', p_IsNameField_b86476eeef6c,
    'RelatedEntityID', p_RelatedEntityID_b86476eeef6c,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_b86476eeef6c,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_b86476eeef6c,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_b86476eeef6c,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_b86476eeef6c,
    'EntityIDFieldName', p_EntityIDFieldName_b86476eeef6c,
    'ScopeDefault', p_ScopeDefault_b86476eeef6c,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_b86476eeef6c,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_b86476eeef6c,
    'Status', p_Status_b86476eeef6c,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_b86476eeef6c,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_b86476eeef6c,
    'AutoUpdateCategory', p_AutoUpdateCategory_b86476eeef6c,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_b86476eeef6c,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_b86476eeef6c,
    'Encrypt', p_Encrypt_b86476eeef6c,
    'EncryptionKeyID', p_EncryptionKeyID_b86476eeef6c,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_b86476eeef6c,
    'SendEncryptedValue', p_SendEncryptedValue_b86476eeef6c,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_b86476eeef6c,
    'IsSoftForeignKey', p_IsSoftForeignKey_b86476eeef6c,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_b86476eeef6c,
    'JSONType', p_JSONType_b86476eeef6c,
    'JSONTypeIsArray', p_JSONTypeIsArray_b86476eeef6c,
    'JSONTypeDefinition', p_JSONTypeDefinition_b86476eeef6c,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_b86476eeef6c,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_b86476eeef6c,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_b86476eeef6c,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_b86476eeef6c,
    'IsComputed', p_IsComputed_b86476eeef6c
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_b86476eeef6c,
    'Configuration', p_Configuration_b86476eeef6c,
    'ID', p_ID_b86476eeef6c
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_b86476eeef6c, p_Description := p_Description_b86476eeef6c, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_b86476eeef6c, p_IsPrimaryKey := p_IsPrimaryKey_b86476eeef6c, p_IsUnique := p_IsUnique_b86476eeef6c, p_Category := p_Category_b86476eeef6c, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_b86476eeef6c, p_ExtendedType := p_ExtendedType_b86476eeef6c, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_b86476eeef6c, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_b86476eeef6c, p_ViewCellTemplate := p_ViewCellTemplate_b86476eeef6c, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_b86476eeef6c, p_AllowUpdateAPI := p_AllowUpdateAPI_b86476eeef6c, p_AllowUpdateInView := p_AllowUpdateInView_b86476eeef6c, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_b86476eeef6c, p_FullTextSearchEnabled := p_FullTextSearchEnabled_b86476eeef6c, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_b86476eeef6c, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_b86476eeef6c, p_GeneratedFormSection := p_GeneratedFormSection_b86476eeef6c, p_IsNameField := p_IsNameField_b86476eeef6c, p_RelatedEntityID := p_RelatedEntityID_b86476eeef6c, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_b86476eeef6c, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_b86476eeef6c, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_b86476eeef6c, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_b86476eeef6c, p_EntityIDFieldName := p_EntityIDFieldName_b86476eeef6c, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_b86476eeef6c, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_b86476eeef6c, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_b86476eeef6c, p_Status := p_Status_b86476eeef6c, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_b86476eeef6c, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_b86476eeef6c, p_AutoUpdateCategory := p_AutoUpdateCategory_b86476eeef6c, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_b86476eeef6c, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_b86476eeef6c, p_Encrypt := p_Encrypt_b86476eeef6c, p_EncryptionKeyID := p_EncryptionKeyID_b86476eeef6c, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_b86476eeef6c, p_SendEncryptedValue := p_SendEncryptedValue_b86476eeef6c, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_b86476eeef6c, p_IsSoftForeignKey := p_IsSoftForeignKey_b86476eeef6c, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_b86476eeef6c, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_b86476eeef6c, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_b86476eeef6c, p_JSONTypeDefinition := p_JSONTypeDefinition_b86476eeef6c, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_b86476eeef6c, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_b86476eeef6c, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_b86476eeef6c, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_b86476eeef6c, p_IsComputed := p_IsComputed_b86476eeef6c, p_EmbeddedRecord := p_EmbeddedRecord_b86476eeef6c, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_b86476eeef6c, p_Configuration_Clear := TRUE, p_ID := p_ID_b86476eeef6c);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_8aa296b58f85 VARCHAR(255);
  p_Description_8aa296b58f85 TEXT;
  p_AutoUpdateDescription_8aa296b58f85 BOOLEAN;
  p_IsPrimaryKey_8aa296b58f85 BOOLEAN;
  p_IsUnique_8aa296b58f85 BOOLEAN;
  p_Category_8aa296b58f85 VARCHAR(255);
  p_ValueListType_8aa296b58f85 VARCHAR(20);
  p_ExtendedType_8aa296b58f85 VARCHAR(50);
  p_CodeType_8aa296b58f85 VARCHAR(50);
  p_DefaultInView_8aa296b58f85 BOOLEAN;
  p_ViewCellTemplate_8aa296b58f85 TEXT;
  p_DefaultColumnWidth_8aa296b58f85 INTEGER;
  p_AllowUpdateAPI_8aa296b58f85 BOOLEAN;
  p_AllowUpdateInView_8aa296b58f85 BOOLEAN;
  p_IncludeInUserSearchAPI_8aa296b58f85 BOOLEAN;
  p_FullTextSearchEnabled_8aa296b58f85 BOOLEAN;
  p_UserSearchParamFormatAPI_8aa296b58f85 VARCHAR(500);
  p_IncludeInGeneratedForm_8aa296b58f85 BOOLEAN;
  p_GeneratedFormSection_8aa296b58f85 VARCHAR(10);
  p_IsNameField_8aa296b58f85 BOOLEAN;
  p_RelatedEntityID_8aa296b58f85 UUID;
  p_RelatedEntityFieldName_8aa296b58f85 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_8aa296b58f85 BOOLEAN;
  p_RelatedEntityNameFieldMap_8aa296b58f85 VARCHAR(255);
  p_RelatedEntityDisplayType_8aa296b58f85 VARCHAR(20);
  p_EntityIDFieldName_8aa296b58f85 VARCHAR(100);
  p_ScopeDefault_8aa296b58f85 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_8aa296b58f85 BOOLEAN;
  p_ValuesToPackWithSchema_8aa296b58f85 VARCHAR(10);
  p_Status_8aa296b58f85 VARCHAR(25);
  p_AutoUpdateIsNameField_8aa296b58f85 BOOLEAN;
  p_AutoUpdateDefaultInView_8aa296b58f85 BOOLEAN;
  p_AutoUpdateCategory_8aa296b58f85 BOOLEAN;
  p_AutoUpdateDisplayName_8aa296b58f85 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_8aa296b58f85 BOOLEAN;
  p_Encrypt_8aa296b58f85 BOOLEAN;
  p_EncryptionKeyID_8aa296b58f85 UUID;
  p_AllowDecryptInAPI_8aa296b58f85 BOOLEAN;
  p_SendEncryptedValue_8aa296b58f85 BOOLEAN;
  p_IsSoftPrimaryKey_8aa296b58f85 BOOLEAN;
  p_IsSoftForeignKey_8aa296b58f85 BOOLEAN;
  p_RelatedEntityJoinFields_8aa296b58f85 TEXT;
  p_JSONType_8aa296b58f85 VARCHAR(255);
  p_JSONTypeIsArray_8aa296b58f85 BOOLEAN;
  p_JSONTypeDefinition_8aa296b58f85 TEXT;
  p_UserSearchPredicateAPI_8aa296b58f85 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_8aa296b58f85 BOOLEAN;
  p_AutoUpdateFullTextSearch_8aa296b58f85 BOOLEAN;
  p_AutoUpdateExtendedType_8aa296b58f85 BOOLEAN;
  p_IsComputed_8aa296b58f85 BOOLEAN;
  p_EmbeddedRecord_8aa296b58f85 TEXT;
  p_Configuration_8aa296b58f85 TEXT;
  p_ID_8aa296b58f85 UUID;
BEGIN
  p_DisplayName_8aa296b58f85 := 'Amount At Transition';
  p_Description_8aa296b58f85 := 'Deal.Amount as it stood at this transition. Point-in-time truth: "what did we think the forecast was on the 1st" is unanswerable from Deal alone once amounts change.';
  p_AutoUpdateDescription_8aa296b58f85 := TRUE;
  p_IsPrimaryKey_8aa296b58f85 := FALSE;
  p_IsUnique_8aa296b58f85 := FALSE;
  p_ValueListType_8aa296b58f85 := 'None';
  p_DefaultInView_8aa296b58f85 := TRUE;
  p_DefaultColumnWidth_8aa296b58f85 := 150;
  p_AllowUpdateAPI_8aa296b58f85 := TRUE;
  p_AllowUpdateInView_8aa296b58f85 := TRUE;
  p_IncludeInUserSearchAPI_8aa296b58f85 := FALSE;
  p_FullTextSearchEnabled_8aa296b58f85 := FALSE;
  p_IncludeInGeneratedForm_8aa296b58f85 := TRUE;
  p_GeneratedFormSection_8aa296b58f85 := 'Details';
  p_IsNameField_8aa296b58f85 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_8aa296b58f85 := FALSE;
  p_RelatedEntityDisplayType_8aa296b58f85 := 'Search';
  p_AutoUpdateRelatedEntityInfo_8aa296b58f85 := TRUE;
  p_ValuesToPackWithSchema_8aa296b58f85 := 'Auto';
  p_Status_8aa296b58f85 := 'Active';
  p_AutoUpdateIsNameField_8aa296b58f85 := TRUE;
  p_AutoUpdateDefaultInView_8aa296b58f85 := FALSE;
  p_AutoUpdateCategory_8aa296b58f85 := TRUE;
  p_AutoUpdateDisplayName_8aa296b58f85 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_8aa296b58f85 := TRUE;
  p_Encrypt_8aa296b58f85 := FALSE;
  p_AllowDecryptInAPI_8aa296b58f85 := FALSE;
  p_SendEncryptedValue_8aa296b58f85 := FALSE;
  p_IsSoftPrimaryKey_8aa296b58f85 := FALSE;
  p_IsSoftForeignKey_8aa296b58f85 := FALSE;
  p_JSONTypeIsArray_8aa296b58f85 := FALSE;
  p_UserSearchPredicateAPI_8aa296b58f85 := 'Contains';
  p_AutoUpdateUserSearchPredicate_8aa296b58f85 := TRUE;
  p_AutoUpdateFullTextSearch_8aa296b58f85 := TRUE;
  p_AutoUpdateExtendedType_8aa296b58f85 := TRUE;
  p_IsComputed_8aa296b58f85 := FALSE;
  p_ID_8aa296b58f85 := '25284BF4-8A16-43AF-9C25-B872DFA13252';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_8aa296b58f85,
    'Description', p_Description_8aa296b58f85,
    'AutoUpdateDescription', p_AutoUpdateDescription_8aa296b58f85,
    'IsPrimaryKey', p_IsPrimaryKey_8aa296b58f85,
    'IsUnique', p_IsUnique_8aa296b58f85,
    'Category', p_Category_8aa296b58f85,
    'ValueListType', p_ValueListType_8aa296b58f85,
    'ExtendedType', p_ExtendedType_8aa296b58f85,
    'CodeType', p_CodeType_8aa296b58f85,
    'DefaultInView', p_DefaultInView_8aa296b58f85,
    'ViewCellTemplate', p_ViewCellTemplate_8aa296b58f85,
    'DefaultColumnWidth', p_DefaultColumnWidth_8aa296b58f85,
    'AllowUpdateAPI', p_AllowUpdateAPI_8aa296b58f85,
    'AllowUpdateInView', p_AllowUpdateInView_8aa296b58f85,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_8aa296b58f85,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_8aa296b58f85,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_8aa296b58f85,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_8aa296b58f85,
    'GeneratedFormSection', p_GeneratedFormSection_8aa296b58f85,
    'IsNameField', p_IsNameField_8aa296b58f85,
    'RelatedEntityID', p_RelatedEntityID_8aa296b58f85,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_8aa296b58f85,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_8aa296b58f85,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_8aa296b58f85,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_8aa296b58f85,
    'EntityIDFieldName', p_EntityIDFieldName_8aa296b58f85,
    'ScopeDefault', p_ScopeDefault_8aa296b58f85,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_8aa296b58f85,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_8aa296b58f85,
    'Status', p_Status_8aa296b58f85,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_8aa296b58f85,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_8aa296b58f85,
    'AutoUpdateCategory', p_AutoUpdateCategory_8aa296b58f85,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_8aa296b58f85,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_8aa296b58f85,
    'Encrypt', p_Encrypt_8aa296b58f85,
    'EncryptionKeyID', p_EncryptionKeyID_8aa296b58f85,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_8aa296b58f85,
    'SendEncryptedValue', p_SendEncryptedValue_8aa296b58f85,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_8aa296b58f85,
    'IsSoftForeignKey', p_IsSoftForeignKey_8aa296b58f85,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_8aa296b58f85,
    'JSONType', p_JSONType_8aa296b58f85,
    'JSONTypeIsArray', p_JSONTypeIsArray_8aa296b58f85,
    'JSONTypeDefinition', p_JSONTypeDefinition_8aa296b58f85,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_8aa296b58f85,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_8aa296b58f85,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_8aa296b58f85,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_8aa296b58f85,
    'IsComputed', p_IsComputed_8aa296b58f85
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_8aa296b58f85,
    'Configuration', p_Configuration_8aa296b58f85,
    'ID', p_ID_8aa296b58f85
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_8aa296b58f85, p_Description := p_Description_8aa296b58f85, p_AutoUpdateDescription := p_AutoUpdateDescription_8aa296b58f85, p_IsPrimaryKey := p_IsPrimaryKey_8aa296b58f85, p_IsUnique := p_IsUnique_8aa296b58f85, p_Category := p_Category_8aa296b58f85, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_8aa296b58f85, p_ExtendedType := p_ExtendedType_8aa296b58f85, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_8aa296b58f85, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_8aa296b58f85, p_ViewCellTemplate := p_ViewCellTemplate_8aa296b58f85, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_8aa296b58f85, p_AllowUpdateAPI := p_AllowUpdateAPI_8aa296b58f85, p_AllowUpdateInView := p_AllowUpdateInView_8aa296b58f85, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_8aa296b58f85, p_FullTextSearchEnabled := p_FullTextSearchEnabled_8aa296b58f85, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_8aa296b58f85, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_8aa296b58f85, p_GeneratedFormSection := p_GeneratedFormSection_8aa296b58f85, p_IsNameField := p_IsNameField_8aa296b58f85, p_RelatedEntityID := p_RelatedEntityID_8aa296b58f85, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_8aa296b58f85, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_8aa296b58f85, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_8aa296b58f85, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_8aa296b58f85, p_EntityIDFieldName := p_EntityIDFieldName_8aa296b58f85, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_8aa296b58f85, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_8aa296b58f85, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_8aa296b58f85, p_Status := p_Status_8aa296b58f85, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_8aa296b58f85, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_8aa296b58f85, p_AutoUpdateCategory := p_AutoUpdateCategory_8aa296b58f85, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_8aa296b58f85, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_8aa296b58f85, p_Encrypt := p_Encrypt_8aa296b58f85, p_EncryptionKeyID := p_EncryptionKeyID_8aa296b58f85, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_8aa296b58f85, p_SendEncryptedValue := p_SendEncryptedValue_8aa296b58f85, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_8aa296b58f85, p_IsSoftForeignKey := p_IsSoftForeignKey_8aa296b58f85, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_8aa296b58f85, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_8aa296b58f85, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_8aa296b58f85, p_JSONTypeDefinition := p_JSONTypeDefinition_8aa296b58f85, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_8aa296b58f85, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_8aa296b58f85, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_8aa296b58f85, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_8aa296b58f85, p_IsComputed := p_IsComputed_8aa296b58f85, p_EmbeddedRecord := p_EmbeddedRecord_8aa296b58f85, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_8aa296b58f85, p_Configuration_Clear := TRUE, p_ID := p_ID_8aa296b58f85);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_a27c3331afe2 VARCHAR(255);
  p_Description_a27c3331afe2 TEXT;
  p_AutoUpdateDescription_a27c3331afe2 BOOLEAN;
  p_IsPrimaryKey_a27c3331afe2 BOOLEAN;
  p_IsUnique_a27c3331afe2 BOOLEAN;
  p_Category_a27c3331afe2 VARCHAR(255);
  p_ValueListType_a27c3331afe2 VARCHAR(20);
  p_ExtendedType_a27c3331afe2 VARCHAR(50);
  p_CodeType_a27c3331afe2 VARCHAR(50);
  p_DefaultInView_a27c3331afe2 BOOLEAN;
  p_ViewCellTemplate_a27c3331afe2 TEXT;
  p_DefaultColumnWidth_a27c3331afe2 INTEGER;
  p_AllowUpdateAPI_a27c3331afe2 BOOLEAN;
  p_AllowUpdateInView_a27c3331afe2 BOOLEAN;
  p_IncludeInUserSearchAPI_a27c3331afe2 BOOLEAN;
  p_FullTextSearchEnabled_a27c3331afe2 BOOLEAN;
  p_UserSearchParamFormatAPI_a27c3331afe2 VARCHAR(500);
  p_IncludeInGeneratedForm_a27c3331afe2 BOOLEAN;
  p_GeneratedFormSection_a27c3331afe2 VARCHAR(10);
  p_IsNameField_a27c3331afe2 BOOLEAN;
  p_RelatedEntityID_a27c3331afe2 UUID;
  p_RelatedEntityFieldName_a27c3331afe2 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_a27c3331afe2 BOOLEAN;
  p_RelatedEntityNameFieldMap_a27c3331afe2 VARCHAR(255);
  p_RelatedEntityDisplayType_a27c3331afe2 VARCHAR(20);
  p_EntityIDFieldName_a27c3331afe2 VARCHAR(100);
  p_ScopeDefault_a27c3331afe2 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_a27c3331afe2 BOOLEAN;
  p_ValuesToPackWithSchema_a27c3331afe2 VARCHAR(10);
  p_Status_a27c3331afe2 VARCHAR(25);
  p_AutoUpdateIsNameField_a27c3331afe2 BOOLEAN;
  p_AutoUpdateDefaultInView_a27c3331afe2 BOOLEAN;
  p_AutoUpdateCategory_a27c3331afe2 BOOLEAN;
  p_AutoUpdateDisplayName_a27c3331afe2 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_a27c3331afe2 BOOLEAN;
  p_Encrypt_a27c3331afe2 BOOLEAN;
  p_EncryptionKeyID_a27c3331afe2 UUID;
  p_AllowDecryptInAPI_a27c3331afe2 BOOLEAN;
  p_SendEncryptedValue_a27c3331afe2 BOOLEAN;
  p_IsSoftPrimaryKey_a27c3331afe2 BOOLEAN;
  p_IsSoftForeignKey_a27c3331afe2 BOOLEAN;
  p_RelatedEntityJoinFields_a27c3331afe2 TEXT;
  p_JSONType_a27c3331afe2 VARCHAR(255);
  p_JSONTypeIsArray_a27c3331afe2 BOOLEAN;
  p_JSONTypeDefinition_a27c3331afe2 TEXT;
  p_UserSearchPredicateAPI_a27c3331afe2 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_a27c3331afe2 BOOLEAN;
  p_AutoUpdateFullTextSearch_a27c3331afe2 BOOLEAN;
  p_AutoUpdateExtendedType_a27c3331afe2 BOOLEAN;
  p_IsComputed_a27c3331afe2 BOOLEAN;
  p_EmbeddedRecord_a27c3331afe2 TEXT;
  p_Configuration_a27c3331afe2 TEXT;
  p_ID_a27c3331afe2 UUID;
BEGIN
  p_DisplayName_a27c3331afe2 := 'Employee';
  p_AutoUpdateDescription_a27c3331afe2 := TRUE;
  p_IsPrimaryKey_a27c3331afe2 := FALSE;
  p_IsUnique_a27c3331afe2 := FALSE;
  p_ValueListType_a27c3331afe2 := 'None';
  p_DefaultInView_a27c3331afe2 := TRUE;
  p_DefaultColumnWidth_a27c3331afe2 := 150;
  p_AllowUpdateAPI_a27c3331afe2 := FALSE;
  p_AllowUpdateInView_a27c3331afe2 := TRUE;
  p_IncludeInUserSearchAPI_a27c3331afe2 := FALSE;
  p_FullTextSearchEnabled_a27c3331afe2 := FALSE;
  p_IncludeInGeneratedForm_a27c3331afe2 := TRUE;
  p_GeneratedFormSection_a27c3331afe2 := 'Details';
  p_IsNameField_a27c3331afe2 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_a27c3331afe2 := FALSE;
  p_RelatedEntityDisplayType_a27c3331afe2 := 'Search';
  p_AutoUpdateRelatedEntityInfo_a27c3331afe2 := TRUE;
  p_ValuesToPackWithSchema_a27c3331afe2 := 'Auto';
  p_Status_a27c3331afe2 := 'Active';
  p_AutoUpdateIsNameField_a27c3331afe2 := TRUE;
  p_AutoUpdateDefaultInView_a27c3331afe2 := TRUE;
  p_AutoUpdateCategory_a27c3331afe2 := TRUE;
  p_AutoUpdateDisplayName_a27c3331afe2 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_a27c3331afe2 := TRUE;
  p_Encrypt_a27c3331afe2 := FALSE;
  p_AllowDecryptInAPI_a27c3331afe2 := FALSE;
  p_SendEncryptedValue_a27c3331afe2 := FALSE;
  p_IsSoftPrimaryKey_a27c3331afe2 := FALSE;
  p_IsSoftForeignKey_a27c3331afe2 := FALSE;
  p_JSONTypeIsArray_a27c3331afe2 := FALSE;
  p_UserSearchPredicateAPI_a27c3331afe2 := 'Contains';
  p_AutoUpdateUserSearchPredicate_a27c3331afe2 := TRUE;
  p_AutoUpdateFullTextSearch_a27c3331afe2 := TRUE;
  p_AutoUpdateExtendedType_a27c3331afe2 := TRUE;
  p_IsComputed_a27c3331afe2 := FALSE;
  p_ID_a27c3331afe2 := '63AD7EFE-70BC-479F-A2B0-015635613E07';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_a27c3331afe2,
    'Description', p_Description_a27c3331afe2,
    'AutoUpdateDescription', p_AutoUpdateDescription_a27c3331afe2,
    'IsPrimaryKey', p_IsPrimaryKey_a27c3331afe2,
    'IsUnique', p_IsUnique_a27c3331afe2,
    'Category', p_Category_a27c3331afe2,
    'ValueListType', p_ValueListType_a27c3331afe2,
    'ExtendedType', p_ExtendedType_a27c3331afe2,
    'CodeType', p_CodeType_a27c3331afe2,
    'DefaultInView', p_DefaultInView_a27c3331afe2,
    'ViewCellTemplate', p_ViewCellTemplate_a27c3331afe2,
    'DefaultColumnWidth', p_DefaultColumnWidth_a27c3331afe2,
    'AllowUpdateAPI', p_AllowUpdateAPI_a27c3331afe2,
    'AllowUpdateInView', p_AllowUpdateInView_a27c3331afe2,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_a27c3331afe2,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_a27c3331afe2,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_a27c3331afe2,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_a27c3331afe2,
    'GeneratedFormSection', p_GeneratedFormSection_a27c3331afe2,
    'IsNameField', p_IsNameField_a27c3331afe2,
    'RelatedEntityID', p_RelatedEntityID_a27c3331afe2,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_a27c3331afe2,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_a27c3331afe2,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_a27c3331afe2,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_a27c3331afe2,
    'EntityIDFieldName', p_EntityIDFieldName_a27c3331afe2,
    'ScopeDefault', p_ScopeDefault_a27c3331afe2,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_a27c3331afe2,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_a27c3331afe2,
    'Status', p_Status_a27c3331afe2,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_a27c3331afe2,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_a27c3331afe2,
    'AutoUpdateCategory', p_AutoUpdateCategory_a27c3331afe2,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_a27c3331afe2,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_a27c3331afe2,
    'Encrypt', p_Encrypt_a27c3331afe2,
    'EncryptionKeyID', p_EncryptionKeyID_a27c3331afe2,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_a27c3331afe2,
    'SendEncryptedValue', p_SendEncryptedValue_a27c3331afe2,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_a27c3331afe2,
    'IsSoftForeignKey', p_IsSoftForeignKey_a27c3331afe2,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_a27c3331afe2,
    'JSONType', p_JSONType_a27c3331afe2,
    'JSONTypeIsArray', p_JSONTypeIsArray_a27c3331afe2,
    'JSONTypeDefinition', p_JSONTypeDefinition_a27c3331afe2,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_a27c3331afe2,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_a27c3331afe2,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_a27c3331afe2,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_a27c3331afe2,
    'IsComputed', p_IsComputed_a27c3331afe2
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_a27c3331afe2,
    'Configuration', p_Configuration_a27c3331afe2,
    'ID', p_ID_a27c3331afe2
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_a27c3331afe2, p_Description := p_Description_a27c3331afe2, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_a27c3331afe2, p_IsPrimaryKey := p_IsPrimaryKey_a27c3331afe2, p_IsUnique := p_IsUnique_a27c3331afe2, p_Category := p_Category_a27c3331afe2, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_a27c3331afe2, p_ExtendedType := p_ExtendedType_a27c3331afe2, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_a27c3331afe2, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_a27c3331afe2, p_ViewCellTemplate := p_ViewCellTemplate_a27c3331afe2, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_a27c3331afe2, p_AllowUpdateAPI := p_AllowUpdateAPI_a27c3331afe2, p_AllowUpdateInView := p_AllowUpdateInView_a27c3331afe2, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_a27c3331afe2, p_FullTextSearchEnabled := p_FullTextSearchEnabled_a27c3331afe2, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_a27c3331afe2, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_a27c3331afe2, p_GeneratedFormSection := p_GeneratedFormSection_a27c3331afe2, p_IsNameField := p_IsNameField_a27c3331afe2, p_RelatedEntityID := p_RelatedEntityID_a27c3331afe2, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_a27c3331afe2, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_a27c3331afe2, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_a27c3331afe2, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_a27c3331afe2, p_EntityIDFieldName := p_EntityIDFieldName_a27c3331afe2, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_a27c3331afe2, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_a27c3331afe2, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_a27c3331afe2, p_Status := p_Status_a27c3331afe2, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_a27c3331afe2, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_a27c3331afe2, p_AutoUpdateCategory := p_AutoUpdateCategory_a27c3331afe2, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_a27c3331afe2, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_a27c3331afe2, p_Encrypt := p_Encrypt_a27c3331afe2, p_EncryptionKeyID := p_EncryptionKeyID_a27c3331afe2, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_a27c3331afe2, p_SendEncryptedValue := p_SendEncryptedValue_a27c3331afe2, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_a27c3331afe2, p_IsSoftForeignKey := p_IsSoftForeignKey_a27c3331afe2, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_a27c3331afe2, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_a27c3331afe2, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_a27c3331afe2, p_JSONTypeDefinition := p_JSONTypeDefinition_a27c3331afe2, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_a27c3331afe2, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_a27c3331afe2, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_a27c3331afe2, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_a27c3331afe2, p_IsComputed := p_IsComputed_a27c3331afe2, p_EmbeddedRecord := p_EmbeddedRecord_a27c3331afe2, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_a27c3331afe2, p_Configuration_Clear := TRUE, p_ID := p_ID_a27c3331afe2);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_da09dba6ab92 VARCHAR(255);
  p_Description_da09dba6ab92 TEXT;
  p_AutoUpdateDescription_da09dba6ab92 BOOLEAN;
  p_IsPrimaryKey_da09dba6ab92 BOOLEAN;
  p_IsUnique_da09dba6ab92 BOOLEAN;
  p_Category_da09dba6ab92 VARCHAR(255);
  p_ValueListType_da09dba6ab92 VARCHAR(20);
  p_ExtendedType_da09dba6ab92 VARCHAR(50);
  p_CodeType_da09dba6ab92 VARCHAR(50);
  p_DefaultInView_da09dba6ab92 BOOLEAN;
  p_ViewCellTemplate_da09dba6ab92 TEXT;
  p_DefaultColumnWidth_da09dba6ab92 INTEGER;
  p_AllowUpdateAPI_da09dba6ab92 BOOLEAN;
  p_AllowUpdateInView_da09dba6ab92 BOOLEAN;
  p_IncludeInUserSearchAPI_da09dba6ab92 BOOLEAN;
  p_FullTextSearchEnabled_da09dba6ab92 BOOLEAN;
  p_UserSearchParamFormatAPI_da09dba6ab92 VARCHAR(500);
  p_IncludeInGeneratedForm_da09dba6ab92 BOOLEAN;
  p_GeneratedFormSection_da09dba6ab92 VARCHAR(10);
  p_IsNameField_da09dba6ab92 BOOLEAN;
  p_RelatedEntityID_da09dba6ab92 UUID;
  p_RelatedEntityFieldName_da09dba6ab92 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_da09dba6ab92 BOOLEAN;
  p_RelatedEntityNameFieldMap_da09dba6ab92 VARCHAR(255);
  p_RelatedEntityDisplayType_da09dba6ab92 VARCHAR(20);
  p_EntityIDFieldName_da09dba6ab92 VARCHAR(100);
  p_ScopeDefault_da09dba6ab92 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_da09dba6ab92 BOOLEAN;
  p_ValuesToPackWithSchema_da09dba6ab92 VARCHAR(10);
  p_Status_da09dba6ab92 VARCHAR(25);
  p_AutoUpdateIsNameField_da09dba6ab92 BOOLEAN;
  p_AutoUpdateDefaultInView_da09dba6ab92 BOOLEAN;
  p_AutoUpdateCategory_da09dba6ab92 BOOLEAN;
  p_AutoUpdateDisplayName_da09dba6ab92 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_da09dba6ab92 BOOLEAN;
  p_Encrypt_da09dba6ab92 BOOLEAN;
  p_EncryptionKeyID_da09dba6ab92 UUID;
  p_AllowDecryptInAPI_da09dba6ab92 BOOLEAN;
  p_SendEncryptedValue_da09dba6ab92 BOOLEAN;
  p_IsSoftPrimaryKey_da09dba6ab92 BOOLEAN;
  p_IsSoftForeignKey_da09dba6ab92 BOOLEAN;
  p_RelatedEntityJoinFields_da09dba6ab92 TEXT;
  p_JSONType_da09dba6ab92 VARCHAR(255);
  p_JSONTypeIsArray_da09dba6ab92 BOOLEAN;
  p_JSONTypeDefinition_da09dba6ab92 TEXT;
  p_UserSearchPredicateAPI_da09dba6ab92 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_da09dba6ab92 BOOLEAN;
  p_AutoUpdateFullTextSearch_da09dba6ab92 BOOLEAN;
  p_AutoUpdateExtendedType_da09dba6ab92 BOOLEAN;
  p_IsComputed_da09dba6ab92 BOOLEAN;
  p_EmbeddedRecord_da09dba6ab92 TEXT;
  p_Configuration_da09dba6ab92 TEXT;
  p_ID_da09dba6ab92 UUID;
BEGIN
  p_DisplayName_da09dba6ab92 := 'Person';
  p_AutoUpdateDescription_da09dba6ab92 := TRUE;
  p_IsPrimaryKey_da09dba6ab92 := FALSE;
  p_IsUnique_da09dba6ab92 := FALSE;
  p_ValueListType_da09dba6ab92 := 'None';
  p_DefaultInView_da09dba6ab92 := TRUE;
  p_DefaultColumnWidth_da09dba6ab92 := 150;
  p_AllowUpdateAPI_da09dba6ab92 := FALSE;
  p_AllowUpdateInView_da09dba6ab92 := TRUE;
  p_IncludeInUserSearchAPI_da09dba6ab92 := FALSE;
  p_FullTextSearchEnabled_da09dba6ab92 := FALSE;
  p_IncludeInGeneratedForm_da09dba6ab92 := TRUE;
  p_GeneratedFormSection_da09dba6ab92 := 'Details';
  p_IsNameField_da09dba6ab92 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_da09dba6ab92 := FALSE;
  p_RelatedEntityDisplayType_da09dba6ab92 := 'Search';
  p_AutoUpdateRelatedEntityInfo_da09dba6ab92 := TRUE;
  p_ValuesToPackWithSchema_da09dba6ab92 := 'Auto';
  p_Status_da09dba6ab92 := 'Active';
  p_AutoUpdateIsNameField_da09dba6ab92 := TRUE;
  p_AutoUpdateDefaultInView_da09dba6ab92 := TRUE;
  p_AutoUpdateCategory_da09dba6ab92 := TRUE;
  p_AutoUpdateDisplayName_da09dba6ab92 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_da09dba6ab92 := TRUE;
  p_Encrypt_da09dba6ab92 := FALSE;
  p_AllowDecryptInAPI_da09dba6ab92 := FALSE;
  p_SendEncryptedValue_da09dba6ab92 := FALSE;
  p_IsSoftPrimaryKey_da09dba6ab92 := FALSE;
  p_IsSoftForeignKey_da09dba6ab92 := FALSE;
  p_JSONTypeIsArray_da09dba6ab92 := FALSE;
  p_UserSearchPredicateAPI_da09dba6ab92 := 'Contains';
  p_AutoUpdateUserSearchPredicate_da09dba6ab92 := TRUE;
  p_AutoUpdateFullTextSearch_da09dba6ab92 := TRUE;
  p_AutoUpdateExtendedType_da09dba6ab92 := TRUE;
  p_IsComputed_da09dba6ab92 := FALSE;
  p_ID_da09dba6ab92 := '90F8AAED-FDE9-4103-B27C-68AE90F7F9F2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_da09dba6ab92,
    'Description', p_Description_da09dba6ab92,
    'AutoUpdateDescription', p_AutoUpdateDescription_da09dba6ab92,
    'IsPrimaryKey', p_IsPrimaryKey_da09dba6ab92,
    'IsUnique', p_IsUnique_da09dba6ab92,
    'Category', p_Category_da09dba6ab92,
    'ValueListType', p_ValueListType_da09dba6ab92,
    'ExtendedType', p_ExtendedType_da09dba6ab92,
    'CodeType', p_CodeType_da09dba6ab92,
    'DefaultInView', p_DefaultInView_da09dba6ab92,
    'ViewCellTemplate', p_ViewCellTemplate_da09dba6ab92,
    'DefaultColumnWidth', p_DefaultColumnWidth_da09dba6ab92,
    'AllowUpdateAPI', p_AllowUpdateAPI_da09dba6ab92,
    'AllowUpdateInView', p_AllowUpdateInView_da09dba6ab92,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_da09dba6ab92,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_da09dba6ab92,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_da09dba6ab92,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_da09dba6ab92,
    'GeneratedFormSection', p_GeneratedFormSection_da09dba6ab92,
    'IsNameField', p_IsNameField_da09dba6ab92,
    'RelatedEntityID', p_RelatedEntityID_da09dba6ab92,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_da09dba6ab92,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_da09dba6ab92,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_da09dba6ab92,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_da09dba6ab92,
    'EntityIDFieldName', p_EntityIDFieldName_da09dba6ab92,
    'ScopeDefault', p_ScopeDefault_da09dba6ab92,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_da09dba6ab92,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_da09dba6ab92,
    'Status', p_Status_da09dba6ab92,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_da09dba6ab92,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_da09dba6ab92,
    'AutoUpdateCategory', p_AutoUpdateCategory_da09dba6ab92,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_da09dba6ab92,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_da09dba6ab92,
    'Encrypt', p_Encrypt_da09dba6ab92,
    'EncryptionKeyID', p_EncryptionKeyID_da09dba6ab92,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_da09dba6ab92,
    'SendEncryptedValue', p_SendEncryptedValue_da09dba6ab92,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_da09dba6ab92,
    'IsSoftForeignKey', p_IsSoftForeignKey_da09dba6ab92,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_da09dba6ab92,
    'JSONType', p_JSONType_da09dba6ab92,
    'JSONTypeIsArray', p_JSONTypeIsArray_da09dba6ab92,
    'JSONTypeDefinition', p_JSONTypeDefinition_da09dba6ab92,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_da09dba6ab92,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_da09dba6ab92,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_da09dba6ab92,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_da09dba6ab92,
    'IsComputed', p_IsComputed_da09dba6ab92
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_da09dba6ab92,
    'Configuration', p_Configuration_da09dba6ab92,
    'ID', p_ID_da09dba6ab92
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_da09dba6ab92, p_Description := p_Description_da09dba6ab92, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_da09dba6ab92, p_IsPrimaryKey := p_IsPrimaryKey_da09dba6ab92, p_IsUnique := p_IsUnique_da09dba6ab92, p_Category := p_Category_da09dba6ab92, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_da09dba6ab92, p_ExtendedType := p_ExtendedType_da09dba6ab92, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_da09dba6ab92, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_da09dba6ab92, p_ViewCellTemplate := p_ViewCellTemplate_da09dba6ab92, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_da09dba6ab92, p_AllowUpdateAPI := p_AllowUpdateAPI_da09dba6ab92, p_AllowUpdateInView := p_AllowUpdateInView_da09dba6ab92, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_da09dba6ab92, p_FullTextSearchEnabled := p_FullTextSearchEnabled_da09dba6ab92, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_da09dba6ab92, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_da09dba6ab92, p_GeneratedFormSection := p_GeneratedFormSection_da09dba6ab92, p_IsNameField := p_IsNameField_da09dba6ab92, p_RelatedEntityID := p_RelatedEntityID_da09dba6ab92, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_da09dba6ab92, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_da09dba6ab92, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_da09dba6ab92, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_da09dba6ab92, p_EntityIDFieldName := p_EntityIDFieldName_da09dba6ab92, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_da09dba6ab92, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_da09dba6ab92, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_da09dba6ab92, p_Status := p_Status_da09dba6ab92, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_da09dba6ab92, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_da09dba6ab92, p_AutoUpdateCategory := p_AutoUpdateCategory_da09dba6ab92, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_da09dba6ab92, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_da09dba6ab92, p_Encrypt := p_Encrypt_da09dba6ab92, p_EncryptionKeyID := p_EncryptionKeyID_da09dba6ab92, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_da09dba6ab92, p_SendEncryptedValue := p_SendEncryptedValue_da09dba6ab92, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_da09dba6ab92, p_IsSoftForeignKey := p_IsSoftForeignKey_da09dba6ab92, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_da09dba6ab92, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_da09dba6ab92, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_da09dba6ab92, p_JSONTypeDefinition := p_JSONTypeDefinition_da09dba6ab92, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_da09dba6ab92, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_da09dba6ab92, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_da09dba6ab92, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_da09dba6ab92, p_IsComputed := p_IsComputed_da09dba6ab92, p_EmbeddedRecord := p_EmbeddedRecord_da09dba6ab92, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_da09dba6ab92, p_Configuration_Clear := TRUE, p_ID := p_ID_da09dba6ab92);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_84971c2ea406 VARCHAR(255);
  p_Description_84971c2ea406 TEXT;
  p_AutoUpdateDescription_84971c2ea406 BOOLEAN;
  p_IsPrimaryKey_84971c2ea406 BOOLEAN;
  p_IsUnique_84971c2ea406 BOOLEAN;
  p_Category_84971c2ea406 VARCHAR(255);
  p_ValueListType_84971c2ea406 VARCHAR(20);
  p_ExtendedType_84971c2ea406 VARCHAR(50);
  p_CodeType_84971c2ea406 VARCHAR(50);
  p_DefaultInView_84971c2ea406 BOOLEAN;
  p_ViewCellTemplate_84971c2ea406 TEXT;
  p_DefaultColumnWidth_84971c2ea406 INTEGER;
  p_AllowUpdateAPI_84971c2ea406 BOOLEAN;
  p_AllowUpdateInView_84971c2ea406 BOOLEAN;
  p_IncludeInUserSearchAPI_84971c2ea406 BOOLEAN;
  p_FullTextSearchEnabled_84971c2ea406 BOOLEAN;
  p_UserSearchParamFormatAPI_84971c2ea406 VARCHAR(500);
  p_IncludeInGeneratedForm_84971c2ea406 BOOLEAN;
  p_GeneratedFormSection_84971c2ea406 VARCHAR(10);
  p_IsNameField_84971c2ea406 BOOLEAN;
  p_RelatedEntityID_84971c2ea406 UUID;
  p_RelatedEntityFieldName_84971c2ea406 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_84971c2ea406 BOOLEAN;
  p_RelatedEntityNameFieldMap_84971c2ea406 VARCHAR(255);
  p_RelatedEntityDisplayType_84971c2ea406 VARCHAR(20);
  p_EntityIDFieldName_84971c2ea406 VARCHAR(100);
  p_ScopeDefault_84971c2ea406 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_84971c2ea406 BOOLEAN;
  p_ValuesToPackWithSchema_84971c2ea406 VARCHAR(10);
  p_Status_84971c2ea406 VARCHAR(25);
  p_AutoUpdateIsNameField_84971c2ea406 BOOLEAN;
  p_AutoUpdateDefaultInView_84971c2ea406 BOOLEAN;
  p_AutoUpdateCategory_84971c2ea406 BOOLEAN;
  p_AutoUpdateDisplayName_84971c2ea406 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_84971c2ea406 BOOLEAN;
  p_Encrypt_84971c2ea406 BOOLEAN;
  p_EncryptionKeyID_84971c2ea406 UUID;
  p_AllowDecryptInAPI_84971c2ea406 BOOLEAN;
  p_SendEncryptedValue_84971c2ea406 BOOLEAN;
  p_IsSoftPrimaryKey_84971c2ea406 BOOLEAN;
  p_IsSoftForeignKey_84971c2ea406 BOOLEAN;
  p_RelatedEntityJoinFields_84971c2ea406 TEXT;
  p_JSONType_84971c2ea406 VARCHAR(255);
  p_JSONTypeIsArray_84971c2ea406 BOOLEAN;
  p_JSONTypeDefinition_84971c2ea406 TEXT;
  p_UserSearchPredicateAPI_84971c2ea406 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_84971c2ea406 BOOLEAN;
  p_AutoUpdateFullTextSearch_84971c2ea406 BOOLEAN;
  p_AutoUpdateExtendedType_84971c2ea406 BOOLEAN;
  p_IsComputed_84971c2ea406 BOOLEAN;
  p_EmbeddedRecord_84971c2ea406 TEXT;
  p_Configuration_84971c2ea406 TEXT;
  p_ID_84971c2ea406 UUID;
BEGIN
  p_DisplayName_84971c2ea406 := 'Deal Role';
  p_AutoUpdateDescription_84971c2ea406 := TRUE;
  p_IsPrimaryKey_84971c2ea406 := FALSE;
  p_IsUnique_84971c2ea406 := FALSE;
  p_ValueListType_84971c2ea406 := 'None';
  p_DefaultInView_84971c2ea406 := TRUE;
  p_DefaultColumnWidth_84971c2ea406 := 150;
  p_AllowUpdateAPI_84971c2ea406 := FALSE;
  p_AllowUpdateInView_84971c2ea406 := TRUE;
  p_IncludeInUserSearchAPI_84971c2ea406 := FALSE;
  p_FullTextSearchEnabled_84971c2ea406 := FALSE;
  p_IncludeInGeneratedForm_84971c2ea406 := TRUE;
  p_GeneratedFormSection_84971c2ea406 := 'Details';
  p_IsNameField_84971c2ea406 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_84971c2ea406 := FALSE;
  p_RelatedEntityDisplayType_84971c2ea406 := 'Search';
  p_AutoUpdateRelatedEntityInfo_84971c2ea406 := TRUE;
  p_ValuesToPackWithSchema_84971c2ea406 := 'Auto';
  p_Status_84971c2ea406 := 'Active';
  p_AutoUpdateIsNameField_84971c2ea406 := TRUE;
  p_AutoUpdateDefaultInView_84971c2ea406 := TRUE;
  p_AutoUpdateCategory_84971c2ea406 := TRUE;
  p_AutoUpdateDisplayName_84971c2ea406 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_84971c2ea406 := TRUE;
  p_Encrypt_84971c2ea406 := FALSE;
  p_AllowDecryptInAPI_84971c2ea406 := FALSE;
  p_SendEncryptedValue_84971c2ea406 := FALSE;
  p_IsSoftPrimaryKey_84971c2ea406 := FALSE;
  p_IsSoftForeignKey_84971c2ea406 := FALSE;
  p_JSONTypeIsArray_84971c2ea406 := FALSE;
  p_UserSearchPredicateAPI_84971c2ea406 := 'Contains';
  p_AutoUpdateUserSearchPredicate_84971c2ea406 := TRUE;
  p_AutoUpdateFullTextSearch_84971c2ea406 := TRUE;
  p_AutoUpdateExtendedType_84971c2ea406 := TRUE;
  p_IsComputed_84971c2ea406 := FALSE;
  p_ID_84971c2ea406 := '5637A083-7CE5-4590-9FA0-A27A9489CE5C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_84971c2ea406,
    'Description', p_Description_84971c2ea406,
    'AutoUpdateDescription', p_AutoUpdateDescription_84971c2ea406,
    'IsPrimaryKey', p_IsPrimaryKey_84971c2ea406,
    'IsUnique', p_IsUnique_84971c2ea406,
    'Category', p_Category_84971c2ea406,
    'ValueListType', p_ValueListType_84971c2ea406,
    'ExtendedType', p_ExtendedType_84971c2ea406,
    'CodeType', p_CodeType_84971c2ea406,
    'DefaultInView', p_DefaultInView_84971c2ea406,
    'ViewCellTemplate', p_ViewCellTemplate_84971c2ea406,
    'DefaultColumnWidth', p_DefaultColumnWidth_84971c2ea406,
    'AllowUpdateAPI', p_AllowUpdateAPI_84971c2ea406,
    'AllowUpdateInView', p_AllowUpdateInView_84971c2ea406,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_84971c2ea406,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_84971c2ea406,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_84971c2ea406,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_84971c2ea406,
    'GeneratedFormSection', p_GeneratedFormSection_84971c2ea406,
    'IsNameField', p_IsNameField_84971c2ea406,
    'RelatedEntityID', p_RelatedEntityID_84971c2ea406,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_84971c2ea406,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_84971c2ea406,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_84971c2ea406,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_84971c2ea406,
    'EntityIDFieldName', p_EntityIDFieldName_84971c2ea406,
    'ScopeDefault', p_ScopeDefault_84971c2ea406,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_84971c2ea406,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_84971c2ea406,
    'Status', p_Status_84971c2ea406,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_84971c2ea406,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_84971c2ea406,
    'AutoUpdateCategory', p_AutoUpdateCategory_84971c2ea406,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_84971c2ea406,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_84971c2ea406,
    'Encrypt', p_Encrypt_84971c2ea406,
    'EncryptionKeyID', p_EncryptionKeyID_84971c2ea406,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_84971c2ea406,
    'SendEncryptedValue', p_SendEncryptedValue_84971c2ea406,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_84971c2ea406,
    'IsSoftForeignKey', p_IsSoftForeignKey_84971c2ea406,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_84971c2ea406,
    'JSONType', p_JSONType_84971c2ea406,
    'JSONTypeIsArray', p_JSONTypeIsArray_84971c2ea406,
    'JSONTypeDefinition', p_JSONTypeDefinition_84971c2ea406,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_84971c2ea406,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_84971c2ea406,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_84971c2ea406,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_84971c2ea406,
    'IsComputed', p_IsComputed_84971c2ea406
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_84971c2ea406,
    'Configuration', p_Configuration_84971c2ea406,
    'ID', p_ID_84971c2ea406
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_84971c2ea406, p_Description := p_Description_84971c2ea406, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_84971c2ea406, p_IsPrimaryKey := p_IsPrimaryKey_84971c2ea406, p_IsUnique := p_IsUnique_84971c2ea406, p_Category := p_Category_84971c2ea406, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_84971c2ea406, p_ExtendedType := p_ExtendedType_84971c2ea406, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_84971c2ea406, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_84971c2ea406, p_ViewCellTemplate := p_ViewCellTemplate_84971c2ea406, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_84971c2ea406, p_AllowUpdateAPI := p_AllowUpdateAPI_84971c2ea406, p_AllowUpdateInView := p_AllowUpdateInView_84971c2ea406, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_84971c2ea406, p_FullTextSearchEnabled := p_FullTextSearchEnabled_84971c2ea406, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_84971c2ea406, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_84971c2ea406, p_GeneratedFormSection := p_GeneratedFormSection_84971c2ea406, p_IsNameField := p_IsNameField_84971c2ea406, p_RelatedEntityID := p_RelatedEntityID_84971c2ea406, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_84971c2ea406, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_84971c2ea406, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_84971c2ea406, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_84971c2ea406, p_EntityIDFieldName := p_EntityIDFieldName_84971c2ea406, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_84971c2ea406, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_84971c2ea406, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_84971c2ea406, p_Status := p_Status_84971c2ea406, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_84971c2ea406, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_84971c2ea406, p_AutoUpdateCategory := p_AutoUpdateCategory_84971c2ea406, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_84971c2ea406, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_84971c2ea406, p_Encrypt := p_Encrypt_84971c2ea406, p_EncryptionKeyID := p_EncryptionKeyID_84971c2ea406, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_84971c2ea406, p_SendEncryptedValue := p_SendEncryptedValue_84971c2ea406, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_84971c2ea406, p_IsSoftForeignKey := p_IsSoftForeignKey_84971c2ea406, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_84971c2ea406, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_84971c2ea406, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_84971c2ea406, p_JSONTypeDefinition := p_JSONTypeDefinition_84971c2ea406, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_84971c2ea406, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_84971c2ea406, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_84971c2ea406, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_84971c2ea406, p_IsComputed := p_IsComputed_84971c2ea406, p_EmbeddedRecord := p_EmbeddedRecord_84971c2ea406, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_84971c2ea406, p_Configuration_Clear := TRUE, p_ID := p_ID_84971c2ea406);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_fca4ede5c5d0 VARCHAR(255);
  p_Description_fca4ede5c5d0 TEXT;
  p_AutoUpdateDescription_fca4ede5c5d0 BOOLEAN;
  p_IsPrimaryKey_fca4ede5c5d0 BOOLEAN;
  p_IsUnique_fca4ede5c5d0 BOOLEAN;
  p_Category_fca4ede5c5d0 VARCHAR(255);
  p_ValueListType_fca4ede5c5d0 VARCHAR(20);
  p_ExtendedType_fca4ede5c5d0 VARCHAR(50);
  p_CodeType_fca4ede5c5d0 VARCHAR(50);
  p_DefaultInView_fca4ede5c5d0 BOOLEAN;
  p_ViewCellTemplate_fca4ede5c5d0 TEXT;
  p_DefaultColumnWidth_fca4ede5c5d0 INTEGER;
  p_AllowUpdateAPI_fca4ede5c5d0 BOOLEAN;
  p_AllowUpdateInView_fca4ede5c5d0 BOOLEAN;
  p_IncludeInUserSearchAPI_fca4ede5c5d0 BOOLEAN;
  p_FullTextSearchEnabled_fca4ede5c5d0 BOOLEAN;
  p_UserSearchParamFormatAPI_fca4ede5c5d0 VARCHAR(500);
  p_IncludeInGeneratedForm_fca4ede5c5d0 BOOLEAN;
  p_GeneratedFormSection_fca4ede5c5d0 VARCHAR(10);
  p_IsNameField_fca4ede5c5d0 BOOLEAN;
  p_RelatedEntityID_fca4ede5c5d0 UUID;
  p_RelatedEntityFieldName_fca4ede5c5d0 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_fca4ede5c5d0 BOOLEAN;
  p_RelatedEntityNameFieldMap_fca4ede5c5d0 VARCHAR(255);
  p_RelatedEntityDisplayType_fca4ede5c5d0 VARCHAR(20);
  p_EntityIDFieldName_fca4ede5c5d0 VARCHAR(100);
  p_ScopeDefault_fca4ede5c5d0 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_fca4ede5c5d0 BOOLEAN;
  p_ValuesToPackWithSchema_fca4ede5c5d0 VARCHAR(10);
  p_Status_fca4ede5c5d0 VARCHAR(25);
  p_AutoUpdateIsNameField_fca4ede5c5d0 BOOLEAN;
  p_AutoUpdateDefaultInView_fca4ede5c5d0 BOOLEAN;
  p_AutoUpdateCategory_fca4ede5c5d0 BOOLEAN;
  p_AutoUpdateDisplayName_fca4ede5c5d0 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_fca4ede5c5d0 BOOLEAN;
  p_Encrypt_fca4ede5c5d0 BOOLEAN;
  p_EncryptionKeyID_fca4ede5c5d0 UUID;
  p_AllowDecryptInAPI_fca4ede5c5d0 BOOLEAN;
  p_SendEncryptedValue_fca4ede5c5d0 BOOLEAN;
  p_IsSoftPrimaryKey_fca4ede5c5d0 BOOLEAN;
  p_IsSoftForeignKey_fca4ede5c5d0 BOOLEAN;
  p_RelatedEntityJoinFields_fca4ede5c5d0 TEXT;
  p_JSONType_fca4ede5c5d0 VARCHAR(255);
  p_JSONTypeIsArray_fca4ede5c5d0 BOOLEAN;
  p_JSONTypeDefinition_fca4ede5c5d0 TEXT;
  p_UserSearchPredicateAPI_fca4ede5c5d0 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_fca4ede5c5d0 BOOLEAN;
  p_AutoUpdateFullTextSearch_fca4ede5c5d0 BOOLEAN;
  p_AutoUpdateExtendedType_fca4ede5c5d0 BOOLEAN;
  p_IsComputed_fca4ede5c5d0 BOOLEAN;
  p_EmbeddedRecord_fca4ede5c5d0 TEXT;
  p_Configuration_fca4ede5c5d0 TEXT;
  p_ID_fca4ede5c5d0 UUID;
BEGIN
  p_DisplayName_fca4ede5c5d0 := 'Attribution Pct';
  p_Description_fca4ede5c5d0 := 'This member''s share of the deal for by-rep rollups. When any member of a deal has a value set, the app validates that active members sum to 100. Leave NULL to fall back to owner-role attribution.';
  p_AutoUpdateDescription_fca4ede5c5d0 := TRUE;
  p_IsPrimaryKey_fca4ede5c5d0 := FALSE;
  p_IsUnique_fca4ede5c5d0 := FALSE;
  p_ValueListType_fca4ede5c5d0 := 'None';
  p_DefaultInView_fca4ede5c5d0 := TRUE;
  p_DefaultColumnWidth_fca4ede5c5d0 := 150;
  p_AllowUpdateAPI_fca4ede5c5d0 := TRUE;
  p_AllowUpdateInView_fca4ede5c5d0 := TRUE;
  p_IncludeInUserSearchAPI_fca4ede5c5d0 := FALSE;
  p_FullTextSearchEnabled_fca4ede5c5d0 := FALSE;
  p_IncludeInGeneratedForm_fca4ede5c5d0 := TRUE;
  p_GeneratedFormSection_fca4ede5c5d0 := 'Details';
  p_IsNameField_fca4ede5c5d0 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_fca4ede5c5d0 := FALSE;
  p_RelatedEntityDisplayType_fca4ede5c5d0 := 'Search';
  p_AutoUpdateRelatedEntityInfo_fca4ede5c5d0 := TRUE;
  p_ValuesToPackWithSchema_fca4ede5c5d0 := 'Auto';
  p_Status_fca4ede5c5d0 := 'Active';
  p_AutoUpdateIsNameField_fca4ede5c5d0 := TRUE;
  p_AutoUpdateDefaultInView_fca4ede5c5d0 := TRUE;
  p_AutoUpdateCategory_fca4ede5c5d0 := TRUE;
  p_AutoUpdateDisplayName_fca4ede5c5d0 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_fca4ede5c5d0 := TRUE;
  p_Encrypt_fca4ede5c5d0 := FALSE;
  p_AllowDecryptInAPI_fca4ede5c5d0 := FALSE;
  p_SendEncryptedValue_fca4ede5c5d0 := FALSE;
  p_IsSoftPrimaryKey_fca4ede5c5d0 := FALSE;
  p_IsSoftForeignKey_fca4ede5c5d0 := FALSE;
  p_JSONTypeIsArray_fca4ede5c5d0 := FALSE;
  p_UserSearchPredicateAPI_fca4ede5c5d0 := 'Contains';
  p_AutoUpdateUserSearchPredicate_fca4ede5c5d0 := TRUE;
  p_AutoUpdateFullTextSearch_fca4ede5c5d0 := TRUE;
  p_AutoUpdateExtendedType_fca4ede5c5d0 := TRUE;
  p_IsComputed_fca4ede5c5d0 := FALSE;
  p_ID_fca4ede5c5d0 := '8E8AA967-D5FB-4CF1-BF14-ACCD9018544B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_fca4ede5c5d0,
    'Description', p_Description_fca4ede5c5d0,
    'AutoUpdateDescription', p_AutoUpdateDescription_fca4ede5c5d0,
    'IsPrimaryKey', p_IsPrimaryKey_fca4ede5c5d0,
    'IsUnique', p_IsUnique_fca4ede5c5d0,
    'Category', p_Category_fca4ede5c5d0,
    'ValueListType', p_ValueListType_fca4ede5c5d0,
    'ExtendedType', p_ExtendedType_fca4ede5c5d0,
    'CodeType', p_CodeType_fca4ede5c5d0,
    'DefaultInView', p_DefaultInView_fca4ede5c5d0,
    'ViewCellTemplate', p_ViewCellTemplate_fca4ede5c5d0,
    'DefaultColumnWidth', p_DefaultColumnWidth_fca4ede5c5d0,
    'AllowUpdateAPI', p_AllowUpdateAPI_fca4ede5c5d0,
    'AllowUpdateInView', p_AllowUpdateInView_fca4ede5c5d0,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_fca4ede5c5d0,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_fca4ede5c5d0,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_fca4ede5c5d0,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_fca4ede5c5d0,
    'GeneratedFormSection', p_GeneratedFormSection_fca4ede5c5d0,
    'IsNameField', p_IsNameField_fca4ede5c5d0,
    'RelatedEntityID', p_RelatedEntityID_fca4ede5c5d0,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_fca4ede5c5d0,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_fca4ede5c5d0,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_fca4ede5c5d0,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_fca4ede5c5d0,
    'EntityIDFieldName', p_EntityIDFieldName_fca4ede5c5d0,
    'ScopeDefault', p_ScopeDefault_fca4ede5c5d0,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_fca4ede5c5d0,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_fca4ede5c5d0,
    'Status', p_Status_fca4ede5c5d0,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_fca4ede5c5d0,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_fca4ede5c5d0,
    'AutoUpdateCategory', p_AutoUpdateCategory_fca4ede5c5d0,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_fca4ede5c5d0,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_fca4ede5c5d0,
    'Encrypt', p_Encrypt_fca4ede5c5d0,
    'EncryptionKeyID', p_EncryptionKeyID_fca4ede5c5d0,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_fca4ede5c5d0,
    'SendEncryptedValue', p_SendEncryptedValue_fca4ede5c5d0,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_fca4ede5c5d0,
    'IsSoftForeignKey', p_IsSoftForeignKey_fca4ede5c5d0,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_fca4ede5c5d0,
    'JSONType', p_JSONType_fca4ede5c5d0,
    'JSONTypeIsArray', p_JSONTypeIsArray_fca4ede5c5d0,
    'JSONTypeDefinition', p_JSONTypeDefinition_fca4ede5c5d0,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_fca4ede5c5d0,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_fca4ede5c5d0,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_fca4ede5c5d0,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_fca4ede5c5d0,
    'IsComputed', p_IsComputed_fca4ede5c5d0
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_fca4ede5c5d0,
    'Configuration', p_Configuration_fca4ede5c5d0,
    'ID', p_ID_fca4ede5c5d0
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_fca4ede5c5d0, p_Description := p_Description_fca4ede5c5d0, p_AutoUpdateDescription := p_AutoUpdateDescription_fca4ede5c5d0, p_IsPrimaryKey := p_IsPrimaryKey_fca4ede5c5d0, p_IsUnique := p_IsUnique_fca4ede5c5d0, p_Category := p_Category_fca4ede5c5d0, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_fca4ede5c5d0, p_ExtendedType := p_ExtendedType_fca4ede5c5d0, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_fca4ede5c5d0, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_fca4ede5c5d0, p_ViewCellTemplate := p_ViewCellTemplate_fca4ede5c5d0, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_fca4ede5c5d0, p_AllowUpdateAPI := p_AllowUpdateAPI_fca4ede5c5d0, p_AllowUpdateInView := p_AllowUpdateInView_fca4ede5c5d0, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_fca4ede5c5d0, p_FullTextSearchEnabled := p_FullTextSearchEnabled_fca4ede5c5d0, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_fca4ede5c5d0, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_fca4ede5c5d0, p_GeneratedFormSection := p_GeneratedFormSection_fca4ede5c5d0, p_IsNameField := p_IsNameField_fca4ede5c5d0, p_RelatedEntityID := p_RelatedEntityID_fca4ede5c5d0, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_fca4ede5c5d0, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_fca4ede5c5d0, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_fca4ede5c5d0, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_fca4ede5c5d0, p_EntityIDFieldName := p_EntityIDFieldName_fca4ede5c5d0, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_fca4ede5c5d0, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_fca4ede5c5d0, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_fca4ede5c5d0, p_Status := p_Status_fca4ede5c5d0, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_fca4ede5c5d0, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_fca4ede5c5d0, p_AutoUpdateCategory := p_AutoUpdateCategory_fca4ede5c5d0, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_fca4ede5c5d0, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_fca4ede5c5d0, p_Encrypt := p_Encrypt_fca4ede5c5d0, p_EncryptionKeyID := p_EncryptionKeyID_fca4ede5c5d0, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_fca4ede5c5d0, p_SendEncryptedValue := p_SendEncryptedValue_fca4ede5c5d0, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_fca4ede5c5d0, p_IsSoftForeignKey := p_IsSoftForeignKey_fca4ede5c5d0, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_fca4ede5c5d0, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_fca4ede5c5d0, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_fca4ede5c5d0, p_JSONTypeDefinition := p_JSONTypeDefinition_fca4ede5c5d0, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_fca4ede5c5d0, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_fca4ede5c5d0, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_fca4ede5c5d0, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_fca4ede5c5d0, p_IsComputed := p_IsComputed_fca4ede5c5d0, p_EmbeddedRecord := p_EmbeddedRecord_fca4ede5c5d0, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_fca4ede5c5d0, p_Configuration_Clear := TRUE, p_ID := p_ID_fca4ede5c5d0);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_90ad1303d9a5 VARCHAR(255);
  p_Description_90ad1303d9a5 TEXT;
  p_AutoUpdateDescription_90ad1303d9a5 BOOLEAN;
  p_IsPrimaryKey_90ad1303d9a5 BOOLEAN;
  p_IsUnique_90ad1303d9a5 BOOLEAN;
  p_Category_90ad1303d9a5 VARCHAR(255);
  p_ValueListType_90ad1303d9a5 VARCHAR(20);
  p_ExtendedType_90ad1303d9a5 VARCHAR(50);
  p_CodeType_90ad1303d9a5 VARCHAR(50);
  p_DefaultInView_90ad1303d9a5 BOOLEAN;
  p_ViewCellTemplate_90ad1303d9a5 TEXT;
  p_DefaultColumnWidth_90ad1303d9a5 INTEGER;
  p_AllowUpdateAPI_90ad1303d9a5 BOOLEAN;
  p_AllowUpdateInView_90ad1303d9a5 BOOLEAN;
  p_IncludeInUserSearchAPI_90ad1303d9a5 BOOLEAN;
  p_FullTextSearchEnabled_90ad1303d9a5 BOOLEAN;
  p_UserSearchParamFormatAPI_90ad1303d9a5 VARCHAR(500);
  p_IncludeInGeneratedForm_90ad1303d9a5 BOOLEAN;
  p_GeneratedFormSection_90ad1303d9a5 VARCHAR(10);
  p_IsNameField_90ad1303d9a5 BOOLEAN;
  p_RelatedEntityID_90ad1303d9a5 UUID;
  p_RelatedEntityFieldName_90ad1303d9a5 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_90ad1303d9a5 BOOLEAN;
  p_RelatedEntityNameFieldMap_90ad1303d9a5 VARCHAR(255);
  p_RelatedEntityDisplayType_90ad1303d9a5 VARCHAR(20);
  p_EntityIDFieldName_90ad1303d9a5 VARCHAR(100);
  p_ScopeDefault_90ad1303d9a5 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_90ad1303d9a5 BOOLEAN;
  p_ValuesToPackWithSchema_90ad1303d9a5 VARCHAR(10);
  p_Status_90ad1303d9a5 VARCHAR(25);
  p_AutoUpdateIsNameField_90ad1303d9a5 BOOLEAN;
  p_AutoUpdateDefaultInView_90ad1303d9a5 BOOLEAN;
  p_AutoUpdateCategory_90ad1303d9a5 BOOLEAN;
  p_AutoUpdateDisplayName_90ad1303d9a5 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_90ad1303d9a5 BOOLEAN;
  p_Encrypt_90ad1303d9a5 BOOLEAN;
  p_EncryptionKeyID_90ad1303d9a5 UUID;
  p_AllowDecryptInAPI_90ad1303d9a5 BOOLEAN;
  p_SendEncryptedValue_90ad1303d9a5 BOOLEAN;
  p_IsSoftPrimaryKey_90ad1303d9a5 BOOLEAN;
  p_IsSoftForeignKey_90ad1303d9a5 BOOLEAN;
  p_RelatedEntityJoinFields_90ad1303d9a5 TEXT;
  p_JSONType_90ad1303d9a5 VARCHAR(255);
  p_JSONTypeIsArray_90ad1303d9a5 BOOLEAN;
  p_JSONTypeDefinition_90ad1303d9a5 TEXT;
  p_UserSearchPredicateAPI_90ad1303d9a5 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_90ad1303d9a5 BOOLEAN;
  p_AutoUpdateFullTextSearch_90ad1303d9a5 BOOLEAN;
  p_AutoUpdateExtendedType_90ad1303d9a5 BOOLEAN;
  p_IsComputed_90ad1303d9a5 BOOLEAN;
  p_EmbeddedRecord_90ad1303d9a5 TEXT;
  p_Configuration_90ad1303d9a5 TEXT;
  p_ID_90ad1303d9a5 UUID;
BEGIN
  p_DisplayName_90ad1303d9a5 := 'Start Date';
  p_AutoUpdateDescription_90ad1303d9a5 := TRUE;
  p_IsPrimaryKey_90ad1303d9a5 := FALSE;
  p_IsUnique_90ad1303d9a5 := FALSE;
  p_ValueListType_90ad1303d9a5 := 'None';
  p_DefaultInView_90ad1303d9a5 := TRUE;
  p_DefaultColumnWidth_90ad1303d9a5 := 150;
  p_AllowUpdateAPI_90ad1303d9a5 := TRUE;
  p_AllowUpdateInView_90ad1303d9a5 := TRUE;
  p_IncludeInUserSearchAPI_90ad1303d9a5 := FALSE;
  p_FullTextSearchEnabled_90ad1303d9a5 := FALSE;
  p_IncludeInGeneratedForm_90ad1303d9a5 := TRUE;
  p_GeneratedFormSection_90ad1303d9a5 := 'Details';
  p_IsNameField_90ad1303d9a5 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_90ad1303d9a5 := FALSE;
  p_RelatedEntityDisplayType_90ad1303d9a5 := 'Search';
  p_AutoUpdateRelatedEntityInfo_90ad1303d9a5 := TRUE;
  p_ValuesToPackWithSchema_90ad1303d9a5 := 'Auto';
  p_Status_90ad1303d9a5 := 'Active';
  p_AutoUpdateIsNameField_90ad1303d9a5 := TRUE;
  p_AutoUpdateDefaultInView_90ad1303d9a5 := TRUE;
  p_AutoUpdateCategory_90ad1303d9a5 := TRUE;
  p_AutoUpdateDisplayName_90ad1303d9a5 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_90ad1303d9a5 := TRUE;
  p_Encrypt_90ad1303d9a5 := FALSE;
  p_AllowDecryptInAPI_90ad1303d9a5 := FALSE;
  p_SendEncryptedValue_90ad1303d9a5 := FALSE;
  p_IsSoftPrimaryKey_90ad1303d9a5 := FALSE;
  p_IsSoftForeignKey_90ad1303d9a5 := FALSE;
  p_JSONTypeIsArray_90ad1303d9a5 := FALSE;
  p_UserSearchPredicateAPI_90ad1303d9a5 := 'Contains';
  p_AutoUpdateUserSearchPredicate_90ad1303d9a5 := TRUE;
  p_AutoUpdateFullTextSearch_90ad1303d9a5 := TRUE;
  p_AutoUpdateExtendedType_90ad1303d9a5 := TRUE;
  p_IsComputed_90ad1303d9a5 := FALSE;
  p_ID_90ad1303d9a5 := '3832EA6A-1DDA-48D0-88E4-CE74FE076D3E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_90ad1303d9a5,
    'Description', p_Description_90ad1303d9a5,
    'AutoUpdateDescription', p_AutoUpdateDescription_90ad1303d9a5,
    'IsPrimaryKey', p_IsPrimaryKey_90ad1303d9a5,
    'IsUnique', p_IsUnique_90ad1303d9a5,
    'Category', p_Category_90ad1303d9a5,
    'ValueListType', p_ValueListType_90ad1303d9a5,
    'ExtendedType', p_ExtendedType_90ad1303d9a5,
    'CodeType', p_CodeType_90ad1303d9a5,
    'DefaultInView', p_DefaultInView_90ad1303d9a5,
    'ViewCellTemplate', p_ViewCellTemplate_90ad1303d9a5,
    'DefaultColumnWidth', p_DefaultColumnWidth_90ad1303d9a5,
    'AllowUpdateAPI', p_AllowUpdateAPI_90ad1303d9a5,
    'AllowUpdateInView', p_AllowUpdateInView_90ad1303d9a5,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_90ad1303d9a5,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_90ad1303d9a5,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_90ad1303d9a5,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_90ad1303d9a5,
    'GeneratedFormSection', p_GeneratedFormSection_90ad1303d9a5,
    'IsNameField', p_IsNameField_90ad1303d9a5,
    'RelatedEntityID', p_RelatedEntityID_90ad1303d9a5,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_90ad1303d9a5,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_90ad1303d9a5,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_90ad1303d9a5,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_90ad1303d9a5,
    'EntityIDFieldName', p_EntityIDFieldName_90ad1303d9a5,
    'ScopeDefault', p_ScopeDefault_90ad1303d9a5,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_90ad1303d9a5,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_90ad1303d9a5,
    'Status', p_Status_90ad1303d9a5,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_90ad1303d9a5,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_90ad1303d9a5,
    'AutoUpdateCategory', p_AutoUpdateCategory_90ad1303d9a5,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_90ad1303d9a5,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_90ad1303d9a5,
    'Encrypt', p_Encrypt_90ad1303d9a5,
    'EncryptionKeyID', p_EncryptionKeyID_90ad1303d9a5,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_90ad1303d9a5,
    'SendEncryptedValue', p_SendEncryptedValue_90ad1303d9a5,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_90ad1303d9a5,
    'IsSoftForeignKey', p_IsSoftForeignKey_90ad1303d9a5,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_90ad1303d9a5,
    'JSONType', p_JSONType_90ad1303d9a5,
    'JSONTypeIsArray', p_JSONTypeIsArray_90ad1303d9a5,
    'JSONTypeDefinition', p_JSONTypeDefinition_90ad1303d9a5,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_90ad1303d9a5,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_90ad1303d9a5,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_90ad1303d9a5,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_90ad1303d9a5,
    'IsComputed', p_IsComputed_90ad1303d9a5
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_90ad1303d9a5,
    'Configuration', p_Configuration_90ad1303d9a5,
    'ID', p_ID_90ad1303d9a5
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_90ad1303d9a5, p_Description := p_Description_90ad1303d9a5, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_90ad1303d9a5, p_IsPrimaryKey := p_IsPrimaryKey_90ad1303d9a5, p_IsUnique := p_IsUnique_90ad1303d9a5, p_Category := p_Category_90ad1303d9a5, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_90ad1303d9a5, p_ExtendedType := p_ExtendedType_90ad1303d9a5, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_90ad1303d9a5, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_90ad1303d9a5, p_ViewCellTemplate := p_ViewCellTemplate_90ad1303d9a5, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_90ad1303d9a5, p_AllowUpdateAPI := p_AllowUpdateAPI_90ad1303d9a5, p_AllowUpdateInView := p_AllowUpdateInView_90ad1303d9a5, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_90ad1303d9a5, p_FullTextSearchEnabled := p_FullTextSearchEnabled_90ad1303d9a5, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_90ad1303d9a5, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_90ad1303d9a5, p_GeneratedFormSection := p_GeneratedFormSection_90ad1303d9a5, p_IsNameField := p_IsNameField_90ad1303d9a5, p_RelatedEntityID := p_RelatedEntityID_90ad1303d9a5, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_90ad1303d9a5, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_90ad1303d9a5, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_90ad1303d9a5, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_90ad1303d9a5, p_EntityIDFieldName := p_EntityIDFieldName_90ad1303d9a5, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_90ad1303d9a5, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_90ad1303d9a5, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_90ad1303d9a5, p_Status := p_Status_90ad1303d9a5, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_90ad1303d9a5, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_90ad1303d9a5, p_AutoUpdateCategory := p_AutoUpdateCategory_90ad1303d9a5, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_90ad1303d9a5, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_90ad1303d9a5, p_Encrypt := p_Encrypt_90ad1303d9a5, p_EncryptionKeyID := p_EncryptionKeyID_90ad1303d9a5, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_90ad1303d9a5, p_SendEncryptedValue := p_SendEncryptedValue_90ad1303d9a5, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_90ad1303d9a5, p_IsSoftForeignKey := p_IsSoftForeignKey_90ad1303d9a5, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_90ad1303d9a5, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_90ad1303d9a5, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_90ad1303d9a5, p_JSONTypeDefinition := p_JSONTypeDefinition_90ad1303d9a5, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_90ad1303d9a5, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_90ad1303d9a5, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_90ad1303d9a5, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_90ad1303d9a5, p_IsComputed := p_IsComputed_90ad1303d9a5, p_EmbeddedRecord := p_EmbeddedRecord_90ad1303d9a5, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_90ad1303d9a5, p_Configuration_Clear := TRUE, p_ID := p_ID_90ad1303d9a5);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_57aad6f5f37a VARCHAR(255);
  p_Description_57aad6f5f37a TEXT;
  p_AutoUpdateDescription_57aad6f5f37a BOOLEAN;
  p_IsPrimaryKey_57aad6f5f37a BOOLEAN;
  p_IsUnique_57aad6f5f37a BOOLEAN;
  p_Category_57aad6f5f37a VARCHAR(255);
  p_ValueListType_57aad6f5f37a VARCHAR(20);
  p_ExtendedType_57aad6f5f37a VARCHAR(50);
  p_CodeType_57aad6f5f37a VARCHAR(50);
  p_DefaultInView_57aad6f5f37a BOOLEAN;
  p_ViewCellTemplate_57aad6f5f37a TEXT;
  p_DefaultColumnWidth_57aad6f5f37a INTEGER;
  p_AllowUpdateAPI_57aad6f5f37a BOOLEAN;
  p_AllowUpdateInView_57aad6f5f37a BOOLEAN;
  p_IncludeInUserSearchAPI_57aad6f5f37a BOOLEAN;
  p_FullTextSearchEnabled_57aad6f5f37a BOOLEAN;
  p_UserSearchParamFormatAPI_57aad6f5f37a VARCHAR(500);
  p_IncludeInGeneratedForm_57aad6f5f37a BOOLEAN;
  p_GeneratedFormSection_57aad6f5f37a VARCHAR(10);
  p_IsNameField_57aad6f5f37a BOOLEAN;
  p_RelatedEntityID_57aad6f5f37a UUID;
  p_RelatedEntityFieldName_57aad6f5f37a VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_57aad6f5f37a BOOLEAN;
  p_RelatedEntityNameFieldMap_57aad6f5f37a VARCHAR(255);
  p_RelatedEntityDisplayType_57aad6f5f37a VARCHAR(20);
  p_EntityIDFieldName_57aad6f5f37a VARCHAR(100);
  p_ScopeDefault_57aad6f5f37a VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_57aad6f5f37a BOOLEAN;
  p_ValuesToPackWithSchema_57aad6f5f37a VARCHAR(10);
  p_Status_57aad6f5f37a VARCHAR(25);
  p_AutoUpdateIsNameField_57aad6f5f37a BOOLEAN;
  p_AutoUpdateDefaultInView_57aad6f5f37a BOOLEAN;
  p_AutoUpdateCategory_57aad6f5f37a BOOLEAN;
  p_AutoUpdateDisplayName_57aad6f5f37a BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_57aad6f5f37a BOOLEAN;
  p_Encrypt_57aad6f5f37a BOOLEAN;
  p_EncryptionKeyID_57aad6f5f37a UUID;
  p_AllowDecryptInAPI_57aad6f5f37a BOOLEAN;
  p_SendEncryptedValue_57aad6f5f37a BOOLEAN;
  p_IsSoftPrimaryKey_57aad6f5f37a BOOLEAN;
  p_IsSoftForeignKey_57aad6f5f37a BOOLEAN;
  p_RelatedEntityJoinFields_57aad6f5f37a TEXT;
  p_JSONType_57aad6f5f37a VARCHAR(255);
  p_JSONTypeIsArray_57aad6f5f37a BOOLEAN;
  p_JSONTypeDefinition_57aad6f5f37a TEXT;
  p_UserSearchPredicateAPI_57aad6f5f37a VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_57aad6f5f37a BOOLEAN;
  p_AutoUpdateFullTextSearch_57aad6f5f37a BOOLEAN;
  p_AutoUpdateExtendedType_57aad6f5f37a BOOLEAN;
  p_IsComputed_57aad6f5f37a BOOLEAN;
  p_EmbeddedRecord_57aad6f5f37a TEXT;
  p_Configuration_57aad6f5f37a TEXT;
  p_ID_57aad6f5f37a UUID;
BEGIN
  p_DisplayName_57aad6f5f37a := 'End Date';
  p_AutoUpdateDescription_57aad6f5f37a := TRUE;
  p_IsPrimaryKey_57aad6f5f37a := FALSE;
  p_IsUnique_57aad6f5f37a := FALSE;
  p_ValueListType_57aad6f5f37a := 'None';
  p_DefaultInView_57aad6f5f37a := TRUE;
  p_DefaultColumnWidth_57aad6f5f37a := 150;
  p_AllowUpdateAPI_57aad6f5f37a := TRUE;
  p_AllowUpdateInView_57aad6f5f37a := TRUE;
  p_IncludeInUserSearchAPI_57aad6f5f37a := FALSE;
  p_FullTextSearchEnabled_57aad6f5f37a := FALSE;
  p_IncludeInGeneratedForm_57aad6f5f37a := TRUE;
  p_GeneratedFormSection_57aad6f5f37a := 'Details';
  p_IsNameField_57aad6f5f37a := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_57aad6f5f37a := FALSE;
  p_RelatedEntityDisplayType_57aad6f5f37a := 'Search';
  p_AutoUpdateRelatedEntityInfo_57aad6f5f37a := TRUE;
  p_ValuesToPackWithSchema_57aad6f5f37a := 'Auto';
  p_Status_57aad6f5f37a := 'Active';
  p_AutoUpdateIsNameField_57aad6f5f37a := TRUE;
  p_AutoUpdateDefaultInView_57aad6f5f37a := TRUE;
  p_AutoUpdateCategory_57aad6f5f37a := TRUE;
  p_AutoUpdateDisplayName_57aad6f5f37a := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_57aad6f5f37a := TRUE;
  p_Encrypt_57aad6f5f37a := FALSE;
  p_AllowDecryptInAPI_57aad6f5f37a := FALSE;
  p_SendEncryptedValue_57aad6f5f37a := FALSE;
  p_IsSoftPrimaryKey_57aad6f5f37a := FALSE;
  p_IsSoftForeignKey_57aad6f5f37a := FALSE;
  p_JSONTypeIsArray_57aad6f5f37a := FALSE;
  p_UserSearchPredicateAPI_57aad6f5f37a := 'Contains';
  p_AutoUpdateUserSearchPredicate_57aad6f5f37a := TRUE;
  p_AutoUpdateFullTextSearch_57aad6f5f37a := TRUE;
  p_AutoUpdateExtendedType_57aad6f5f37a := TRUE;
  p_IsComputed_57aad6f5f37a := FALSE;
  p_ID_57aad6f5f37a := 'E3FA1EDB-76D0-4352-BED1-C799AEAF2CE3';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_57aad6f5f37a,
    'Description', p_Description_57aad6f5f37a,
    'AutoUpdateDescription', p_AutoUpdateDescription_57aad6f5f37a,
    'IsPrimaryKey', p_IsPrimaryKey_57aad6f5f37a,
    'IsUnique', p_IsUnique_57aad6f5f37a,
    'Category', p_Category_57aad6f5f37a,
    'ValueListType', p_ValueListType_57aad6f5f37a,
    'ExtendedType', p_ExtendedType_57aad6f5f37a,
    'CodeType', p_CodeType_57aad6f5f37a,
    'DefaultInView', p_DefaultInView_57aad6f5f37a,
    'ViewCellTemplate', p_ViewCellTemplate_57aad6f5f37a,
    'DefaultColumnWidth', p_DefaultColumnWidth_57aad6f5f37a,
    'AllowUpdateAPI', p_AllowUpdateAPI_57aad6f5f37a,
    'AllowUpdateInView', p_AllowUpdateInView_57aad6f5f37a,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_57aad6f5f37a,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_57aad6f5f37a,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_57aad6f5f37a,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_57aad6f5f37a,
    'GeneratedFormSection', p_GeneratedFormSection_57aad6f5f37a,
    'IsNameField', p_IsNameField_57aad6f5f37a,
    'RelatedEntityID', p_RelatedEntityID_57aad6f5f37a,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_57aad6f5f37a,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_57aad6f5f37a,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_57aad6f5f37a,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_57aad6f5f37a,
    'EntityIDFieldName', p_EntityIDFieldName_57aad6f5f37a,
    'ScopeDefault', p_ScopeDefault_57aad6f5f37a,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_57aad6f5f37a,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_57aad6f5f37a,
    'Status', p_Status_57aad6f5f37a,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_57aad6f5f37a,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_57aad6f5f37a,
    'AutoUpdateCategory', p_AutoUpdateCategory_57aad6f5f37a,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_57aad6f5f37a,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_57aad6f5f37a,
    'Encrypt', p_Encrypt_57aad6f5f37a,
    'EncryptionKeyID', p_EncryptionKeyID_57aad6f5f37a,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_57aad6f5f37a,
    'SendEncryptedValue', p_SendEncryptedValue_57aad6f5f37a,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_57aad6f5f37a,
    'IsSoftForeignKey', p_IsSoftForeignKey_57aad6f5f37a,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_57aad6f5f37a,
    'JSONType', p_JSONType_57aad6f5f37a,
    'JSONTypeIsArray', p_JSONTypeIsArray_57aad6f5f37a,
    'JSONTypeDefinition', p_JSONTypeDefinition_57aad6f5f37a,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_57aad6f5f37a,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_57aad6f5f37a,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_57aad6f5f37a,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_57aad6f5f37a,
    'IsComputed', p_IsComputed_57aad6f5f37a
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_57aad6f5f37a,
    'Configuration', p_Configuration_57aad6f5f37a,
    'ID', p_ID_57aad6f5f37a
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_57aad6f5f37a, p_Description := p_Description_57aad6f5f37a, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_57aad6f5f37a, p_IsPrimaryKey := p_IsPrimaryKey_57aad6f5f37a, p_IsUnique := p_IsUnique_57aad6f5f37a, p_Category := p_Category_57aad6f5f37a, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_57aad6f5f37a, p_ExtendedType := p_ExtendedType_57aad6f5f37a, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_57aad6f5f37a, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_57aad6f5f37a, p_ViewCellTemplate := p_ViewCellTemplate_57aad6f5f37a, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_57aad6f5f37a, p_AllowUpdateAPI := p_AllowUpdateAPI_57aad6f5f37a, p_AllowUpdateInView := p_AllowUpdateInView_57aad6f5f37a, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_57aad6f5f37a, p_FullTextSearchEnabled := p_FullTextSearchEnabled_57aad6f5f37a, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_57aad6f5f37a, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_57aad6f5f37a, p_GeneratedFormSection := p_GeneratedFormSection_57aad6f5f37a, p_IsNameField := p_IsNameField_57aad6f5f37a, p_RelatedEntityID := p_RelatedEntityID_57aad6f5f37a, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_57aad6f5f37a, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_57aad6f5f37a, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_57aad6f5f37a, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_57aad6f5f37a, p_EntityIDFieldName := p_EntityIDFieldName_57aad6f5f37a, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_57aad6f5f37a, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_57aad6f5f37a, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_57aad6f5f37a, p_Status := p_Status_57aad6f5f37a, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_57aad6f5f37a, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_57aad6f5f37a, p_AutoUpdateCategory := p_AutoUpdateCategory_57aad6f5f37a, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_57aad6f5f37a, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_57aad6f5f37a, p_Encrypt := p_Encrypt_57aad6f5f37a, p_EncryptionKeyID := p_EncryptionKeyID_57aad6f5f37a, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_57aad6f5f37a, p_SendEncryptedValue := p_SendEncryptedValue_57aad6f5f37a, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_57aad6f5f37a, p_IsSoftForeignKey := p_IsSoftForeignKey_57aad6f5f37a, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_57aad6f5f37a, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_57aad6f5f37a, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_57aad6f5f37a, p_JSONTypeDefinition := p_JSONTypeDefinition_57aad6f5f37a, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_57aad6f5f37a, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_57aad6f5f37a, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_57aad6f5f37a, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_57aad6f5f37a, p_IsComputed := p_IsComputed_57aad6f5f37a, p_EmbeddedRecord := p_EmbeddedRecord_57aad6f5f37a, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_57aad6f5f37a, p_Configuration_Clear := TRUE, p_ID := p_ID_57aad6f5f37a);
  END IF;
END $mj$;


-- ===================== Other =====================

-- End of SQL Logging Session
-- Session ID: 69386e71-e49d-4ee2-b5a1-ff41cebb547b
-- Completed: 2026-10-16T13:27:26.297Z
-- Duration: 4939ms
-- Total Statements: 27
