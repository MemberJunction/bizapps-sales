-- The four dashboard tiles, as ONE row of scalars. Master plan §9.5.
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
--   Won                  `Sales: Bookings by Period` is date-windowed and grouped by period; the tile
--                        wants an all-time count.
--
-- Composing the tiles from those would have moved the SQL to the server and left the AGGREGATION in
-- the component, which is the half §9.5 is actually about. So this returns the four figures already
-- reduced, and the component renders them.
--
-- ── THE SAME FLAGS, THE SAME MEANINGS ───────────────────────────────────────────────────────────
--
-- Every count branches on a DealStatusType FLAG, exactly as the component's `hasFlag` did. This is a
-- MECHANISM change, not a measure change: each column below is defined to match what the tile
-- computed client-side, so a figure that moves is a bug in one of the two and not a difference of
-- opinion. `test-harnesses/compare-dashboard-measures.mjs` runs both paths over the same data and
-- fails on any disagreement.
--
-- ── THE ONE PLACE THE DEFINITIONS COULD DRIFT, AND HOW IT IS PINNED ─────────────────────────────
--
-- `IsPastExpectedClose` compares against `CAST(SYSUTCDATETIME() AS DATE)`. The component compared
-- against a UTC date string it built with getUTC* getters, for a documented reason: ExpectedCloseDate
-- is a DATE and everything stored is UTC, so a local-time comparison moves the boundary by a day for
-- anyone west of Greenwich. Doing it in SQL removes the client's clock from the question entirely —
-- the server's UTC date is the only one involved.
--
-- ── THE PERIOD WINDOW APPLIES TO ONE COLUMN, AND IT IS NOT IN THE `WHERE` ──────────────────────
--
-- This header used to read "NO PERIOD PARAMETER -- these tiles are 'right now' and 'to date'". That
-- was true of all four tiles and is now true of three. golive#232 reported the fourth: a "Won" count
-- of every won deal ever, sitting beside Open pipeline and Open deals, which are the current book.
-- Read together they invite a subtraction that means nothing.
--
-- So `WonCount` takes an OPTIONAL window on `ActualCloseDate` -- the date a win actually landed,
-- which is the same dimension `win-rate.sql` uses, so the two agree by construction rather than by
-- coincidence.
--
-- THE PREDICATE IS INSIDE THE CASE, NEVER IN THE `WHERE`, AND THAT IS THE WHOLE DESIGN. A `WHERE`
-- clause would narrow every column in this SELECT: open pipeline would drop any deal whose close
-- date is outside the window, and `TotalCount` -- the denominator of the "of N total" tile -- would
-- stop describing the whole book. golive#232 asks for the opposite in as many words: open-deal
-- figures stay as they are, because they are not period-bound. Keeping the window inside the one
-- CASE is what makes that literally true rather than approximately true.
--
-- Omitting both parameters restores the original all-time count exactly, which is what the "All
-- time" option on the dashboard selects.
--
-- Company and pipeline remain the only slices that apply to the whole row.
--
-- ── PIPELINES FLAGGED OUT OF THE FORECAST ───────────────────────────────────────────────────────
--
-- Pipeline.IncludeInForecast = 0 marks a pipeline that holds historical deals. Its OPEN deals are
-- left out of every tile, TotalCount included, so "of N total" stays the denominator of the figures
-- beside it. Its won and lost deals stay. Naming the pipeline in PipelineID includes it.
SELECT
    -- TILE 1 — open pipeline. A SUM of stored answers, not pricing arithmetic.
    SUM(CASE WHEN st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)              AS OpenAmount,
    SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)                                AS OpenCount,

    -- TILE 2 — the denominator: every deal, whatever its status. COUNT(*) over the OUTER join, so a
    -- status-less deal is counted here even though it lands in none of the flag-driven figures.
    COUNT(*)                                                                      AS TotalCount,
    -- Visible rather than merely absent: if this is non-zero, OpenCount + WonCount will not reconcile
    -- to TotalCount and a reader deserves to know why.
    SUM(CASE WHEN st.ID IS NULL THEN 1 ELSE 0 END)                                AS NoStatusCount,

    -- TILE 3 — open, and its expected close date has gone by.
    SUM(CASE WHEN st.IsOpen = 1
              AND d.ExpectedCloseDate IS NOT NULL
              AND d.ExpectedCloseDate < CAST(SYSUTCDATETIME() AS DATE)
             THEN 1 ELSE 0 END)                                                   AS PastExpectedCloseCount,

    -- TILE 4 — won, within the selected period. Unbounded when no period is supplied.
    --
    -- A won deal with a NULL ActualCloseDate is EXCLUDED from a bounded window and included in the
    -- unbounded one. That is the only reading available: the tile asks "won in this period", and a
    -- deal that never recorded when it closed cannot answer it. It stays visible in the all-time
    -- figure, so the deal is never invisible everywhere at once.
    --
    -- The exclusion needs no `IS NOT NULL`: a comparison against NULL is UNKNOWN, so the CASE falls to
    -- ELSE 0. Said here rather than written twice, because an explicit guard in each branch would
    -- duplicate when both bounds are supplied. The client-side `WonInPeriod()` applies the same rule
    -- against the same column, which is what keeps the tile and its drill-through in agreement.
    SUM(CASE WHEN st.IsWon = 1
              {% if PeriodStart %}
              AND d.ActualCloseDate >= {{ PeriodStart | sqlString }}
              {% endif %}
              {% if PeriodEnd %}
              AND d.ActualCloseDate <= {{ PeriodEnd | sqlString }}
              {% endif %}
             THEN 1 ELSE 0 END)                                                   AS WonCount,

    -- Provenance for the open figure, so a tile can say how much of it nobody priced. Not currently
    -- rendered on the dashboard; it is here because the figure and its provenance should travel
    -- together, and because the board already makes this distinction visible.
    SUM(CASE WHEN st.IsOpen = 1 AND d.AmountIsComputed = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)
                                                                                  AS OpenPricedAmount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END)
                                                                                  AS OpenStatedAmount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.Amount IS NULL THEN 1 ELSE 0 END)           AS OpenNoAmountCount
FROM [__mj_BizAppsSales].Deal d
/**
 * LEFT JOIN, NOT INNER -- `Deal.DealStatusTypeID` is NULLABLE.
 *
 * With an INNER JOIN, a deal with no status disappears from every figure here, including TotalCount,
 * which is the denominator of the "of N total" tile. The client implementation this replaced counted
 * `this.Deals.length` with no join at all, so an INNER JOIN would have silently changed what the tile
 * MEANS -- and this file's header claims a mechanism change, not a measure change. Keeping that claim
 * true requires the outer join.
 *
 * The counts below already branch on flags, and a NULL flag fails every CASE, so an unclassified deal
 * lands in TotalCount and in none of the others. That is the correct reading: it exists, and it is
 * neither open nor won.
 */
LEFT OUTER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% else %}
  AND (ISNULL(st.IsOpen, 0) = 0 OR p.IncludeInForecast = 1)
  {% endif %};
