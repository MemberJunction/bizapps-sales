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
-- NO PERIOD PARAMETER. These tiles are "right now" and "to date"; a window would change what they
-- mean rather than filter them. Company and pipeline are the only slices offered.
SELECT
    -- TILE 1 — open pipeline. A SUM of stored answers, not pricing arithmetic.
    SUM(CASE WHEN st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)              AS OpenAmount,
    SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)                                AS OpenCount,

    -- TILE 2 — the denominator: every deal, whatever its status.
    COUNT(*)                                                                      AS TotalCount,

    -- TILE 3 — open, and its expected close date has gone by.
    SUM(CASE WHEN st.IsOpen = 1
              AND d.ExpectedCloseDate IS NOT NULL
              AND d.ExpectedCloseDate < CAST(SYSUTCDATETIME() AS DATE)
             THEN 1 ELSE 0 END)                                                   AS PastExpectedCloseCount,

    -- TILE 4 — won, all time.
    SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END)                                 AS WonCount,

    -- Provenance for the open figure, so a tile can say how much of it nobody priced. Not currently
    -- rendered on the dashboard; it is here because the figure and its provenance should travel
    -- together, and because the board already makes this distinction visible.
    SUM(CASE WHEN st.IsOpen = 1 AND d.AmountIsComputed = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)
                                                                                  AS OpenPricedAmount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END)
                                                                                  AS OpenStatedAmount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.Amount IS NULL THEN 1 ELSE 0 END)           AS OpenNoAmountCount
FROM [__mj_BizAppsSales].Deal d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %};
