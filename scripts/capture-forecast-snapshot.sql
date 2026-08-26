-- =============================================================================
-- ⚠ NOT THE FORECAST SNAPSHOT WRITER. A MANUAL TOOL, DELIBERATELY UNSEEDED.
--
-- `Sales.CaptureForecastSnapshot` is the writer -- an MJ Action, driven by the
-- seeded `Sales - Forecast Snapshot (daily)` ScheduledJob. This script is NOT
-- wired to any job and must not be: two writers for one table is worse than
-- either of them, and this one and the Action disagree about same-day re-runs
-- (see below), so running both would make `ForecastSnapshot` mean different
-- things on different days.
--
-- Its original header argued for being a plain script rather than an Action.
-- That argument predates the Action existing and is no longer the choice on
-- offer; it is left corrected rather than deleted because THIS IS THE ONLY
-- WORKING PER-OWNER CAPTURE IN THE REPO. The Action's source reads
-- `Sales: Forecast by Category`, which groups by company and pipeline only, so
-- the owner grain that `forecast-history.sql` partitions its LAG windows by
-- cannot come from it yet. When a companion owner-grain query is written, the
-- GROUP BY at the bottom of this file is the reference for what it must project.
--
-- Run it by hand if you need a one-off capture and understand that it REPLACES
-- today's rows. Do not seed a ScheduledJob for it.
-- =============================================================================
-- capture-forecast-snapshot.sql — writes one ForecastSnapshot row per
-- company × pipeline × owner × period. Master plan §9.5.
--
-- ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
--
-- §9.5 is unusually direct about it: "Snapshots matter more than the live
-- number: 'what did we think on the first of the month' is the question a
-- forecast review actually asks, and it is unanswerable after the fact without
-- them."
--
-- That is a statement about IMPOSSIBILITY, not about convenience. A live query
-- over `Deal` can always tell you today's forecast. It can never tell you last
-- month's, because amounts change, expected close dates move, deals are
-- recategorised and deals are created — and none of that leaves the current row
-- carrying what it used to say. `DealStageEvent` stamps amount and probability
-- at TRANSITION, which covers deals that moved stage and nothing else.
--
-- So the answer has to be captured while it is still true.
--
-- ── HOW IT IS RUN ────────────────────────────────────────────────────────────
--
-- BY HAND, and by nothing else. The line that used to sit here said "an MJ
-- Scheduled Job, nightly" -- that was never true (nothing ever seeded one) and
-- is now the Action's job. Corrected rather than left, because a comment
-- claiming a schedule that does not exist is how somebody concludes snapshots
-- are being captured when they are not.
---- ── IDEMPOTENT PER DAY -- AND IT DISAGREES WITH THE ACTION, WHICH WINS ───────
--
-- This script REPLACES today's rows: it deletes them and re-inserts. The Action
-- SKIPS a grain already captured today, leaving the first capture standing. That
-- difference is settled and the Action's behaviour is the ruling.
--
-- The argument originally made here -- that duplicate captures would double every
-- movement calculation in `forecast-history.sql`, whose LAG windows step by
-- `CapturedAt` -- is true, and does NOT choose between the two: skip and replace
-- both yield exactly one row per day, so both avoid it.
--
-- What chooses is what `CapturedAt` is FOR. It answers "what did we think on the
-- 1st", and that only holds if the first capture survives. Replace lets a later
-- run silently rewrite recorded history -- and unlike a duplicate, which is
-- visible as two rows, an overwrite leaves nothing behind to notice. That is the
-- failure you cannot detect afterwards, so it is the one to refuse.
--
-- Yesterday's rows are never touched by either. "Pen, not pencil", the same
-- discipline `DealStageEvent` follows -- this script simply applies it one day
-- later than the Action does.
---- ── WHAT A PERIOD IS ─────────────────────────────────────────────────────────
--
-- The current calendar MONTH, in UTC. Everything stored is UTC and a snapshot
-- taken at 02:00 local must not land in the previous period for half the year.
-- Month is the smallest period a forecast review uses; a quarterly view is a
-- sum of months, which the history query can do, while the reverse is not
-- possible from quarterly captures.
-- =============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @CapturedAt   DATETIMEOFFSET = SYSUTCDATETIME();
DECLARE @Today        DATE           = CAST(SYSUTCDATETIME() AS DATE);
DECLARE @PeriodStart  DATE           = DATEFROMPARTS(YEAR(@Today), MONTH(@Today), 1);
DECLARE @PeriodEnd    DATE           = EOMONTH(@Today);

BEGIN TRANSACTION;

-- Today's capture, if one already ran. See the idempotency note above.
DELETE FROM [__mj_BizAppsSales].ForecastSnapshot
 WHERE PeriodStart = @PeriodStart
   AND CAST(CapturedAt AS DATE) = @Today;

INSERT INTO [__mj_BizAppsSales].ForecastSnapshot (
    ID, CompanyID, PipelineID, OwnerEmployeeID,
    PeriodStart, PeriodEnd, CapturedAt,
    CommitAmount, BestCaseAmount, PipelineAmount, ClosedAmount, SnapshotJSON
)
SELECT
    NEWID(),
    d.CompanyID,
    d.PipelineID,
    -- The OWNER SLICE READS THE DENORMALISED STAMP, and that is the right call here even though
    -- `bookings-by-owner.sql` deliberately does not. This groups a forecast BY owner; it does not
    -- attribute revenue TO one. Joining DealTeamMember would multiply a deal across its AE, SE and SDR
    -- and inflate every bucket -- the §9.4 double-count, arriving through the back door. The stamp is
    -- server-maintained from the owner-role team row, so it is the same person by construction.
    d.OwnerEmployeeID,
    @PeriodStart,
    @PeriodEnd,
    @CapturedAt,
    -- The three forecast buckets, from FLAGS. Same rule as forecast-by-category.sql, and the same
    -- warning applies: these OVERLAP and must never be added together.
    SUM(CASE WHEN st.IsOpen = 1 AND fc.IncludeInCommit   = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END),
    SUM(CASE WHEN st.IsOpen = 1 AND fc.IncludeInBestCase = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END),
    SUM(CASE WHEN st.IsOpen = 1 AND fc.IncludeInPipeline = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END),
    SUM(CASE WHEN st.IsWon  = 1                              THEN ISNULL(d.Amount, 0) ELSE 0 END),
    -- SnapshotJSON carries what the columns cannot: the counts behind the money, and how much of it
    -- nobody priced. A snapshot whose figures were entirely hand-typed is a different artefact from
    -- one the orders engine produced, and six months later there is no way to tell them apart unless
    -- the capture says so.
    (
        SELECT
            COUNT(*)                                                              AS DealCount,
            SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)                        AS OpenCount,
            SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END)                        AS WonCount,
            SUM(CASE WHEN d.AmountIsComputed = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS PricedAmount,
            SUM(CASE WHEN d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS StatedAmount,
            SUM(CASE WHEN d.Amount IS NULL THEN 1 ELSE 0 END)                     AS NoAmountCount
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    )
FROM [__mj_BizAppsSales].Deal d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
        ON fc.ID = d.ForecastCategoryTypeID
       AND fc.IsActive = 1
WHERE
    -- Open deals belong to the period they are EXPECTED to close in; won deals to the period they
    -- ACTUALLY closed in. Two date columns because they answer two questions, per §9.2.
    (st.IsOpen = 1 AND d.ExpectedCloseDate BETWEEN @PeriodStart AND @PeriodEnd)
 OR (st.IsWon  = 1 AND d.ActualCloseDate   BETWEEN @PeriodStart AND @PeriodEnd)
GROUP BY
    d.CompanyID, d.PipelineID, d.OwnerEmployeeID;

DECLARE @Rows INT = @@ROWCOUNT;

COMMIT TRANSACTION;

SELECT
    @Rows        AS RowsCaptured,
    @PeriodStart AS PeriodStart,
    @PeriodEnd   AS PeriodEnd,
    @CapturedAt  AS CapturedAt;
