-- =============================================================================================
-- PostgreSQL counterpart of V202611061330__v6.24.x__Metadata_Sync.sql -- BizApps Sales v6.24.x Metadata_Sync
-- =============================================================================================
-- Same record, same values as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.6) on the push log the T-SQL file was
--     generated from, with the core schema written as `${flyway:defaultSchema}` for the conversion:
--     the converter skips a block whose call is written `EXEC [${mjSchema}].sp...`
--     (MemberJunction/MJ#5543). The core schema was then set to ${mjSchema}. The record is a DO
--     block that calls the core function in whichever signature the host has (jsonb or named
--     parameters).
--   * Every value in the T-SQL file was checked against this file, including the BIT values
--     (MemberJunction/MJ#5918); none needed copying back.
--   * The block was checked to parse (pglast).
-- =============================================================================================

SET standard_conforming_strings = on;
-- ===================== Data (INSERT/UPDATE/DELETE) =====================

-- Save MJ: Remote Operations (core SP call only)
DO $mj$
DECLARE
  p_Name_47f1ffe72864 VARCHAR(255);
  p_OperationKey_47f1ffe72864 VARCHAR(255);
  p_CategoryID_47f1ffe72864 UUID;
  p_Description_47f1ffe72864 TEXT;
  p_InputTypeName_47f1ffe72864 VARCHAR(255);
  p_InputTypeDefinition_47f1ffe72864 TEXT;
  p_InputTypeIsArray_47f1ffe72864 BOOLEAN;
  p_OutputTypeName_47f1ffe72864 VARCHAR(255);
  p_OutputTypeDefinition_47f1ffe72864 TEXT;
  p_OutputTypeIsArray_47f1ffe72864 BOOLEAN;
  p_ExecutionMode_47f1ffe72864 VARCHAR(20);
  p_RequiredScope_47f1ffe72864 VARCHAR(255);
  p_RequiresSystemUser_47f1ffe72864 BOOLEAN;
  p_GenerationType_47f1ffe72864 VARCHAR(20);
  p_Code_47f1ffe72864 TEXT;
  p_CodeApprovalStatus_47f1ffe72864 VARCHAR(20);
  p_CodeApprovedByUserID_47f1ffe72864 UUID;
  p_CodeApprovedAt_47f1ffe72864 TIMESTAMPTZ;
  p_ContractFingerprint_47f1ffe72864 VARCHAR(100);
  p_Status_47f1ffe72864 VARCHAR(20);
  p_CacheTTLSeconds_47f1ffe72864 INTEGER;
  p_TimeoutMS_47f1ffe72864 INTEGER;
  p_MaxConcurrency_47f1ffe72864 INTEGER;
  p_CodeLocked_47f1ffe72864 BOOLEAN;
  p_CodeComments_47f1ffe72864 TEXT;
  p_Libraries_47f1ffe72864 TEXT;
  p_ID_47f1ffe72864 UUID;
BEGIN
  p_Name_47f1ffe72864 := 'Record Discount Concession';
  p_OperationKey_47f1ffe72864 := 'Sales.RecordDiscountConcession';
  p_CategoryID_47f1ffe72864 := 'D4F8A162-9C35-4E71-B0A8-3F17C5E2D801';
  p_Description_47f1ffe72864 := 'Records a deal line''s raised discount as a Price concession on its order line, replacing the line''s earlier one, for orders to value and decide.';
  p_InputTypeName_47f1ffe72864 := 'SalesRecordDiscountConcessionInput';
  p_InputTypeDefinition_47f1ffe72864 := '/**
 * What the deal-line editor sends when a line''s discount went up. NO `import` statements in this file:
 * CodeGen emits it verbatim into `remote_operations.ts` and resolves none (see
 * `sales-close-deal.input.ts`).
 */
export interface SalesRecordDiscountConcessionInput {
    /** The saved order line the discount is on. Orders values the concession from what it stores. */
    OrderLineID: string;
    /**
     * One of orders'' concession reason categories. Typed as a string because orders owns the list
     * (its `CK_OrderConcession_ReasonCategory`), so a category it adds needs no sales release.
     */
    ReasonCategory: string;
    /** The rep''s reason. Required: an approver decides on it. */
    Reason: string;
    /**
     * Client-generated UUID for this recording attempt, so a retry after a timeout finds the
     * concession the first attempt already wrote instead of withdrawing and recreating it.
     */
    ConcessionID?: string | null;
}
';
  p_InputTypeIsArray_47f1ffe72864 := FALSE;
  p_OutputTypeName_47f1ffe72864 := 'SalesRecordDiscountConcessionOutput';
  p_OutputTypeDefinition_47f1ffe72864 := '/**
 * What orders decided about a discount concession, or why it refused to record one. NO `import`
 * statements in this file (see `sales-close-deal.input.ts`).
 */
export interface SalesRecordDiscountConcessionOutput {
    /** The concession was recorded. False when sales or orders refused it; `Message` says why. */
    Success: boolean;
    /** The recorded concession, when there is one. */
    ConcessionID?: string | null;
    /**
     * Recorded but not decided: the discount is outside the requester''s Sales Authority and waits for
     * the approving role. Read from whether orders stamped a decider, never from the status''s name.
     */
    AwaitingApproval: boolean;
    /** Orders'' or sales'' refusal, verbatim, when `Success` is false. */
    Message?: string | null;
}
';
  p_OutputTypeIsArray_47f1ffe72864 := FALSE;
  p_ExecutionMode_47f1ffe72864 := 'Sync';
  p_RequiredScope_47f1ffe72864 := 'sales:write';
  p_RequiresSystemUser_47f1ffe72864 := FALSE;
  p_GenerationType_47f1ffe72864 := 'Manual';
  p_CodeApprovalStatus_47f1ffe72864 := 'Approved';
  p_Status_47f1ffe72864 := 'Active';
  p_CodeLocked_47f1ffe72864 := FALSE;
  p_ID_47f1ffe72864 := '59D32E09-65A4-4DC7-B515-5A129F1C5A1D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateRemoteOperation'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_data := jsonb_build_object(
    'Name', p_Name_47f1ffe72864,
    'OperationKey', p_OperationKey_47f1ffe72864,
    'CategoryID', p_CategoryID_47f1ffe72864,
    'Description', p_Description_47f1ffe72864,
    'InputTypeName', p_InputTypeName_47f1ffe72864,
    'InputTypeDefinition', p_InputTypeDefinition_47f1ffe72864,
    'InputTypeIsArray', p_InputTypeIsArray_47f1ffe72864,
    'OutputTypeName', p_OutputTypeName_47f1ffe72864,
    'OutputTypeDefinition', p_OutputTypeDefinition_47f1ffe72864,
    'OutputTypeIsArray', p_OutputTypeIsArray_47f1ffe72864,
    'ExecutionMode', p_ExecutionMode_47f1ffe72864,
    'RequiredScope', p_RequiredScope_47f1ffe72864,
    'RequiresSystemUser', p_RequiresSystemUser_47f1ffe72864,
    'GenerationType', p_GenerationType_47f1ffe72864,
    'Code', p_Code_47f1ffe72864,
    'CodeApprovalStatus', p_CodeApprovalStatus_47f1ffe72864,
    'CodeApprovedByUserID', p_CodeApprovedByUserID_47f1ffe72864,
    'CodeApprovedAt', p_CodeApprovedAt_47f1ffe72864,
    'ContractFingerprint', p_ContractFingerprint_47f1ffe72864,
    'Status', p_Status_47f1ffe72864,
    'CacheTTLSeconds', p_CacheTTLSeconds_47f1ffe72864,
    'TimeoutMS', p_TimeoutMS_47f1ffe72864,
    'MaxConcurrency', p_MaxConcurrency_47f1ffe72864,
    'CodeLocked', p_CodeLocked_47f1ffe72864,
    'CodeComments', p_CodeComments_47f1ffe72864,
    'Libraries', p_Libraries_47f1ffe72864,
    'ID', p_ID_47f1ffe72864
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateRemoteOperation"(p_Name := p_Name_47f1ffe72864, p_OperationKey := p_OperationKey_47f1ffe72864, p_CategoryID := p_CategoryID_47f1ffe72864, p_Description := p_Description_47f1ffe72864, p_InputTypeName := p_InputTypeName_47f1ffe72864, p_InputTypeDefinition := p_InputTypeDefinition_47f1ffe72864, p_InputTypeIsArray := p_InputTypeIsArray_47f1ffe72864, p_OutputTypeName := p_OutputTypeName_47f1ffe72864, p_OutputTypeDefinition := p_OutputTypeDefinition_47f1ffe72864, p_OutputTypeIsArray := p_OutputTypeIsArray_47f1ffe72864, p_ExecutionMode := p_ExecutionMode_47f1ffe72864, p_RequiredScope := p_RequiredScope_47f1ffe72864, p_RequiresSystemUser := p_RequiresSystemUser_47f1ffe72864, p_GenerationType := p_GenerationType_47f1ffe72864, p_Code := p_Code_47f1ffe72864, p_Code_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_47f1ffe72864, p_CodeApprovedByUserID := p_CodeApprovedByUserID_47f1ffe72864, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_47f1ffe72864, p_CodeApprovedAt_Clear := TRUE, p_ContractFingerprint := p_ContractFingerprint_47f1ffe72864, p_ContractFingerprint_Clear := TRUE, p_Status := p_Status_47f1ffe72864, p_CacheTTLSeconds := p_CacheTTLSeconds_47f1ffe72864, p_CacheTTLSeconds_Clear := TRUE, p_TimeoutMS := p_TimeoutMS_47f1ffe72864, p_TimeoutMS_Clear := TRUE, p_MaxConcurrency := p_MaxConcurrency_47f1ffe72864, p_MaxConcurrency_Clear := TRUE, p_CodeLocked := p_CodeLocked_47f1ffe72864, p_CodeComments := p_CodeComments_47f1ffe72864, p_CodeComments_Clear := TRUE, p_Libraries := p_Libraries_47f1ffe72864, p_Libraries_Clear := TRUE, p_ID := p_ID_47f1ffe72864);
  END IF;
END $mj$;
