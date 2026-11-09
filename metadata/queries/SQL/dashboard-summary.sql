-- The dashboard tiles, forecast and attention counts, as ONE row of scalars. Master plan §9.5.
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
-- on any disagreement, and the dashboard's Inspect grid lists each figure's deals with the same
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
-- Product company reads the companies stamped on the deal's order lines (OrderLine.CompanyID, set by
-- orders from the product). A deal matches when at least one line belongs to a selected company, and
-- counts once at its full amount: these are deal-level figures, and splitting a deal's amount by line
-- would be pricing arithmetic sales does not do. A deal with no lines cannot match, so it drops out
-- when a product company is chosen. NoLinesDealCount says how many deals in the other filters' scope
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
-- the same deals by Probability, master plan §9.3's "weighted pipeline": a statistic about
-- likelihood, not a price.
WITH scoped AS (
    SELECT
        d.ID,
        d.Amount,
        d.AmountIsComputed,
        d.Probability,
        d.ExpectedCloseDate,
        d.OwnerEmployeeID,
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
        -- Whether the deal's order carries any line, and whether one belongs to a selected product
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
    -- The same deals as WonCount, summed: the forecast's Won segment.
    SUM(CASE WHEN s.WonInPeriod = 1 THEN ISNULL(s.Amount, 0) ELSE 0 END)          AS WonAmount,

    -- Provenance for the Open pipeline figure, so its footnote can say how much nobody priced.
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.AmountIsComputed = 1
             THEN ISNULL(s.Amount, 0) ELSE 0 END)                                 AS OpenPricedAmount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.AmountIsComputed = 0
             THEN ISNULL(s.Amount, 0) ELSE 0 END)                                 AS OpenStatedAmount,
    SUM(CASE WHEN s.OpenInPeriod = 1 AND s.IncludeInPipeline = 1 AND s.Amount IS NULL
             THEN 1 ELSE 0 END)                                                   AS OpenNoAmountCount,

    -- Deals in the other filters' scope whose order has no lines: what a product company filter
    -- leaves out. Read over every scoped row, not only those in product scope.
    (SELECT COUNT(*) FROM scoped x WHERE x.HasLines = 0)                          AS NoLinesDealCount
FROM scoped s
-- One row: the business day. "Past its expected close" is a "today" question, so it compares
-- against the business day from fnBusinessToday() rather than the UTC day, which rolls over in the
-- evening for a business west of Greenwich (bc-aidp-next-golive#168).
CROSS JOIN [__mj_BizAppsCommon].[fnBusinessToday]() AS bt
WHERE s.InProductScope = 1;
