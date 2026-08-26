--
--  DealStageEvent.AmountAtTransitionIsComputed — the provenance of a stamped close amount.
--
--  ADDITIVE, and NOT folded into the baseline's generated half, because CodeGen cannot produce it here.
--  Running `mj codegen` against this database is the measured corruption recorded in CLAUDE.md: a second
--  full pass regenerates `vwDeals` with an eleventh virtual lookup column and no matching EntityField
--  row, after which every Deal insert fails on a column count. So the two CRUD procs below are
--  transformed from their LIVE definitions — parameter pair, both INSERT column lists, both VALUES
--  blocks, and the UPDATE SET list — each insertion point derived from the AmountAtTransition line beside
--  it, so the shape follows what CodeGen actually emitted.
--
--  `vwDealStageEvents` needs no change: it is `SELECT d.*` plus named lookup columns, so a new base-table
--  column flows through it already. Verified against the live definition rather than assumed.
--
--  ── WHY THE COLUMN EXISTS ────────────────────────────────────────────────────────────────────────
--
--  Finance reads close amounts out of this table and cannot classify them. `AmountAtTransition` is the
--  point-in-time stamp — that part works — but whether the figure came from the orders engine or from a
--  person lives in `Deal.AmountIsComputed`, on a row that keeps changing. So the provenance of a CLOSE
--  amount becomes unrecoverable the moment the deal is repriced, and every historical close is
--  unclassifiable in retrospect.
--
--  IT CANNOT BE BACKFILLED. For every row already in this table the answer is genuinely unknown, which is
--  why the column is NULLABLE rather than NOT NULL DEFAULT 0: a zero would assert that those amounts were
--  hand-typed, which is a claim nobody can support. NULL means "written before this was recorded". The
--  column's value starts the day it ships, which is the argument for shipping it early rather than well.
--
--  Bit, not a copy of the flag's name: it answers one question about one number.
--

-- ── 1. THE COLUMN ───────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
     WHERE object_id = OBJECT_ID('__mj_BizAppsSales.DealStageEvent') AND name = 'AmountAtTransitionIsComputed'
)
BEGIN
    ALTER TABLE __mj_BizAppsSales.DealStageEvent ADD AmountAtTransitionIsComputed BIT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.extended_properties ep
     WHERE ep.major_id = OBJECT_ID('__mj_BizAppsSales.DealStageEvent')
       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('__mj_BizAppsSales.DealStageEvent'), 'AmountAtTransitionIsComputed', 'ColumnId')
       AND ep.name = 'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Whether AmountAtTransition came from the orders engine (1) or was stated by a person (0). NULL means the transition was recorded before this was tracked — it is not backfillable, because Deal.AmountIsComputed describes the deal as it is now, not as it was at the close.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsSales',
        @level1type = N'TABLE',  @level1name = N'DealStageEvent',
        @level2type = N'COLUMN', @level2name = N'AmountAtTransitionIsComputed';
END
GO

-- ── 2. THE ENTITY FIELD, so the entity layer can write it ───────────────────────────────────────
-- Hardcoded ID, like every other metadata row in this repo. Sequence follows the same MAX+10 expression
-- CodeGen uses, so the field lands after the ones already registered.
-- ── THE ENTITY MUST EXIST FIRST, AND ON A REBUILD IT DOES NOT ─────────────────────────────────
--
-- `EntityID` below is a hardcoded FK into `Entity`. That row is created by the GENERATED half of
-- the baseline -- and `scripts/rebuild-db.sh` deliberately TRIMS that half, applying hand-authored
-- DDL only so that CodeGen can regenerate it from scratch. That trim is what makes "edit the
-- baseline in place" safe, so it is not going away.
--
-- Without the `IF EXISTS` below, this migration therefore fails on every rebuild:
--
--   Failed at batch 3/5 (lines 56-97): The INSERT statement conflicted with the FOREIGN KEY
--   constraint "FK_EntityField_Entity"
--
-- and it takes the whole of step 7/7 with it, leaving a database with no sales schema at all.
-- Measured 2026-08-25 on a rebuild from empty -- the first full rebuild since this migration
-- landed on 2026-08-21 (see KI-24: the rebuild loop had lapsed, so nothing exercised it).
--
-- Skipping is correct rather than merely safe. On a rebuild CodeGen runs immediately after and
-- registers this field from the schema itself, which is the same row by a better route. On a
-- normal install the generated half is present, the entity exists, and this INSERT does its job.
IF EXISTS (SELECT 1 FROM [${mjSchema}].[Entity] WHERE ID = '5AC3D14E-A9BA-4667-AF73-5928DAE446BF')
AND NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityField]
     WHERE ID = 'b7f4a1c2-3d5e-4a68-9c07-1e2f3a4b5c6d'
        OR (EntityID = '5AC3D14E-A9BA-4667-AF73-5928DAE446BF' AND Name = 'AmountAtTransitionIsComputed')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityField]
    (
        [ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length],
        [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI],
        [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField],
        [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView],
        [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt]
    )
    VALUES
    (
        'b7f4a1c2-3d5e-4a68-9c07-1e2f3a4b5c6d',
        '5AC3D14E-A9BA-4667-AF73-5928DAE446BF', -- Entity: MJ_BizApps_Sales: Deal Stage Events
        (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField]
          WHERE [EntityID] = '5AC3D14E-A9BA-4667-AF73-5928DAE446BF') + 10,
        'AmountAtTransitionIsComputed',
        'Amount At Transition Is Computed',
        'Whether AmountAtTransition came from the orders engine (1) or was stated by a person (0). NULL means the transition predates the column.',
        'bit',
        1,
        1,
        0,
        1,          -- AllowsNull: NULL is a real answer here, see the header
        NULL,
        0,
        1,          -- AllowUpdateAPI
        0, 0,
        NULL, NULL,
        0, 0, 0, 0, 0, 0,
        'Search',
        GETUTCDATE(), GETUTCDATE()
    );
END
GO

-- ── 3. THE CRUD PROCS, transformed from their live definitions ──────────────────────────────────
CREATE OR ALTER PROCEDURE [__mj_BizAppsSales].[spCreateDealStageEvent]
    @ID uniqueidentifier = NULL,
    @DealID uniqueidentifier,
    @FromStageID_Clear bit = 0,
    @FromStageID uniqueidentifier = NULL,
    @ToStageID_Clear bit = 0,
    @ToStageID uniqueidentifier = NULL,
    @FromDealStatusTypeID_Clear bit = 0,
    @FromDealStatusTypeID uniqueidentifier = NULL,
    @ToDealStatusTypeID_Clear bit = 0,
    @ToDealStatusTypeID uniqueidentifier = NULL,
    @ChangedByUserID_Clear bit = 0,
    @ChangedByUserID uniqueidentifier = NULL,
    @ChangedAt datetimeoffset = NULL,
    @DaysInPreviousStage_Clear bit = 0,
    @DaysInPreviousStage int = NULL,
    @AmountAtTransition_Clear bit = 0,
    @AmountAtTransition decimal(19, 4) = NULL,
    @AmountAtTransitionIsComputed_Clear bit = 0,
    @AmountAtTransitionIsComputed bit = NULL,
    @ProbabilityAtTransition_Clear bit = 0,
    @ProbabilityAtTransition decimal(5, 2) = NULL,
    @Notes_Clear bit = 0,
    @Notes nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [__mj_BizAppsSales].[DealStageEvent]
            (
                [ID],
                [DealID],
                [FromStageID],
                [ToStageID],
                [FromDealStatusTypeID],
                [ToDealStatusTypeID],
                [ChangedByUserID],
                [ChangedAt],
                [DaysInPreviousStage],
                [AmountAtTransition],
                [AmountAtTransitionIsComputed],
                [ProbabilityAtTransition],
                [Notes]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @DealID,
                CASE WHEN @FromStageID_Clear = 1 THEN NULL ELSE ISNULL(@FromStageID, NULL) END,
                CASE WHEN @ToStageID_Clear = 1 THEN NULL ELSE ISNULL(@ToStageID, NULL) END,
                CASE WHEN @FromDealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@FromDealStatusTypeID, NULL) END,
                CASE WHEN @ToDealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ToDealStatusTypeID, NULL) END,
                CASE WHEN @ChangedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ChangedByUserID, NULL) END,
                ISNULL(@ChangedAt, 'sysutcdatetime()'),
                CASE WHEN @DaysInPreviousStage_Clear = 1 THEN NULL ELSE ISNULL(@DaysInPreviousStage, NULL) END,
                CASE WHEN @AmountAtTransition_Clear = 1 THEN NULL ELSE ISNULL(@AmountAtTransition, NULL) END,
                CASE WHEN @AmountAtTransitionIsComputed_Clear = 1 THEN NULL ELSE ISNULL(@AmountAtTransitionIsComputed, NULL) END,
                CASE WHEN @ProbabilityAtTransition_Clear = 1 THEN NULL ELSE ISNULL(@ProbabilityAtTransition, NULL) END,
                CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [__mj_BizAppsSales].[DealStageEvent]
            (
                [DealID],
                [FromStageID],
                [ToStageID],
                [FromDealStatusTypeID],
                [ToDealStatusTypeID],
                [ChangedByUserID],
                [ChangedAt],
                [DaysInPreviousStage],
                [AmountAtTransition],
                [AmountAtTransitionIsComputed],
                [ProbabilityAtTransition],
                [Notes]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @DealID,
                CASE WHEN @FromStageID_Clear = 1 THEN NULL ELSE ISNULL(@FromStageID, NULL) END,
                CASE WHEN @ToStageID_Clear = 1 THEN NULL ELSE ISNULL(@ToStageID, NULL) END,
                CASE WHEN @FromDealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@FromDealStatusTypeID, NULL) END,
                CASE WHEN @ToDealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ToDealStatusTypeID, NULL) END,
                CASE WHEN @ChangedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ChangedByUserID, NULL) END,
                ISNULL(@ChangedAt, 'sysutcdatetime()'),
                CASE WHEN @DaysInPreviousStage_Clear = 1 THEN NULL ELSE ISNULL(@DaysInPreviousStage, NULL) END,
                CASE WHEN @AmountAtTransition_Clear = 1 THEN NULL ELSE ISNULL(@AmountAtTransition, NULL) END,
                CASE WHEN @AmountAtTransitionIsComputed_Clear = 1 THEN NULL ELSE ISNULL(@AmountAtTransitionIsComputed, NULL) END,
                CASE WHEN @ProbabilityAtTransition_Clear = 1 THEN NULL ELSE ISNULL(@ProbabilityAtTransition, NULL) END,
                CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [__mj_BizAppsSales].[vwDealStageEvents] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO

CREATE OR ALTER PROCEDURE [__mj_BizAppsSales].[spUpdateDealStageEvent]
    @ID uniqueidentifier,
    @DealID uniqueidentifier = NULL,
    @FromStageID_Clear bit = 0,
    @FromStageID uniqueidentifier = NULL,
    @ToStageID_Clear bit = 0,
    @ToStageID uniqueidentifier = NULL,
    @FromDealStatusTypeID_Clear bit = 0,
    @FromDealStatusTypeID uniqueidentifier = NULL,
    @ToDealStatusTypeID_Clear bit = 0,
    @ToDealStatusTypeID uniqueidentifier = NULL,
    @ChangedByUserID_Clear bit = 0,
    @ChangedByUserID uniqueidentifier = NULL,
    @ChangedAt datetimeoffset = NULL,
    @DaysInPreviousStage_Clear bit = 0,
    @DaysInPreviousStage int = NULL,
    @AmountAtTransition_Clear bit = 0,
    @AmountAtTransition decimal(19, 4) = NULL,
    @AmountAtTransitionIsComputed_Clear bit = 0,
    @AmountAtTransitionIsComputed bit = NULL,
    @ProbabilityAtTransition_Clear bit = 0,
    @ProbabilityAtTransition decimal(5, 2) = NULL,
    @Notes_Clear bit = 0,
    @Notes nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [__mj_BizAppsSales].[DealStageEvent]
    SET
        [DealID] = ISNULL(@DealID, [DealID]),
        [FromStageID] = CASE WHEN @FromStageID_Clear = 1 THEN NULL ELSE ISNULL(@FromStageID, [FromStageID]) END,
        [ToStageID] = CASE WHEN @ToStageID_Clear = 1 THEN NULL ELSE ISNULL(@ToStageID, [ToStageID]) END,
        [FromDealStatusTypeID] = CASE WHEN @FromDealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@FromDealStatusTypeID, [FromDealStatusTypeID]) END,
        [ToDealStatusTypeID] = CASE WHEN @ToDealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ToDealStatusTypeID, [ToDealStatusTypeID]) END,
        [ChangedByUserID] = CASE WHEN @ChangedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ChangedByUserID, [ChangedByUserID]) END,
        [ChangedAt] = ISNULL(@ChangedAt, [ChangedAt]),
        [DaysInPreviousStage] = CASE WHEN @DaysInPreviousStage_Clear = 1 THEN NULL ELSE ISNULL(@DaysInPreviousStage, [DaysInPreviousStage]) END,
        [AmountAtTransition] = CASE WHEN @AmountAtTransition_Clear = 1 THEN NULL ELSE ISNULL(@AmountAtTransition, [AmountAtTransition]) END,
        [AmountAtTransitionIsComputed] = CASE WHEN @AmountAtTransitionIsComputed_Clear = 1 THEN NULL ELSE ISNULL(@AmountAtTransitionIsComputed, [AmountAtTransitionIsComputed]) END,
        [ProbabilityAtTransition] = CASE WHEN @ProbabilityAtTransition_Clear = 1 THEN NULL ELSE ISNULL(@ProbabilityAtTransition, [ProbabilityAtTransition]) END,
        [Notes] = CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, [Notes]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [__mj_BizAppsSales].[vwDealStageEvents] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [__mj_BizAppsSales].[vwDealStageEvents]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO
