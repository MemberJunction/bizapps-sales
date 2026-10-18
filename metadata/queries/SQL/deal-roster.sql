-- The deal roster — one row per deal, dimensioned, for a grid or a drill-through target.
--
-- WHY A LIST BELONGS IN A SET OF AGGREGATES. Every other query here answers a question with a number,
-- and the first thing anyone does with a number they distrust is ask which deals are in it. Without a
-- roster that shares the same filters, that question gets answered by someone writing ad-hoc SQL
-- against `Deal` — which is how a report and its drill-through quietly stop agreeing.
--
-- It is also what the dashboard's own tables need. `DealWorkspaceService.LoadRoster()` currently
-- builds this shape by hand in TypeScript; when the tiles are re-pointed at these queries (a later
-- step, deliberately not done here while another session is in that file), this is what they read.
--
-- NO RAW IDs FOR DISPLAY — S-US11 asks for names throughout — but the IDs are returned alongside,
-- because a grid needs the name and a drill-through needs the key.
--
-- STATUS FLAGS TRAVEL WITH THE ROW so a consumer can branch on IsOpen / IsWon / IsClosed without
-- either re-joining the type table or, worse, comparing the status NAME it was given for display.
-- That is the vocabulary rule reaching one layer further out than the query itself.
--
-- DATE DIMENSION: filtered on expected close for open deals and actual close for closed ones, so one
-- period filter behaves sensibly across a mixed set.
--
-- THE FILTER BAR (bc-aidp-next-golive#350). CompanyIDs, OwnerEmployeeIDs, PipelineIDs and
-- ProductCompanyIDs are lists, rendered with `sqlIn`, and narrow the rows the same way they narrow
-- `Sales: Dashboard Summary`, so the dashboard's by-stage, by-owner and by-date cards group exactly the
-- deals its tiles count. The single-value CompanyID, PipelineID and OwnerEmployeeID still work. A list
-- that is "All" is left out rather than sent empty: `sqlIn` renders an empty list as `(NULL)`, which
-- matches nothing.
--
-- PRODUCT COMPANIES. A deal's product companies are the distinct companies stamped on its order's
-- lines (OrderLine.CompanyID, which orders copies from the product). They are returned per row as
-- ProductCompanyIDs (comma-separated IDs) and ProductCompanyNames (comma-separated names). Each is a
-- set: the two lists are not guaranteed to be in the same order, because STRING_AGG's WITHIN GROUP
-- ordering is not something MJ's SQL parser can read, and a query it cannot parse loses its recorded
-- fields. Read IDs from the ID list and names from the name list, never one by position in the other.
-- The ProductCompanyIDs parameter keeps a deal when at least one line belongs to a selected company.
-- A deal with no lines returns NULL for both and does not match the parameter.
SELECT
    d.ID                                        AS DealID,
    d.DealNumber,
    d.Name                                      AS DealName,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.AccountID,
    d.Account                                   AS AccountName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    -- Whether this pipeline's OPEN deals belong in the current-book figures. The roster itself keeps
    -- every deal, because the board must still show a pipeline that holds historical deals; the
    -- dashboard's aggregates drop open rows where this is 0.
    p.IncludeInForecast                         AS PipelineIncludeInForecast,
    d.PipelineStageID,
    d.PipelineStage                             AS StageName,
    ps.DisplayOrder                             AS StageOrder,
    d.DealTypeID,
    d.DealType                                  AS DealTypeName,
    d.DealStatusTypeID,
    d.DealStatusType                            AS StatusName,
    -- A deal with no status is not open, won, lost or closed -- it is unclassified. ISNULL(...,0)
    -- says exactly that, and keeps every consumer's boolean checks total.
    ISNULL(st.IsOpen, 0)                        AS IsOpen,
    ISNULL(st.IsWon, 0)                         AS IsWon,
    ISNULL(st.IsLost, 0)                        AS IsLost,
    ISNULL(st.IsClosed, 0)                      AS IsClosed,
    -- Surfaced so a status-less deal is VISIBLE as one rather than merely reading as not-open.
    CASE WHEN d.DealStatusTypeID IS NULL OR st.ID IS NULL THEN 1 ELSE 0 END AS HasNoStatus,
    d.ForecastCategoryType                      AS ForecastCategoryName,
    fc.IncludeInCommit,
    fc.IncludeInBestCase,
    -- Whether the deal's forecast category counts toward the pipeline (Omitted does not). A deal with
    -- no category counts, which is how the dashboard has always treated it.
    ISNULL(fc.IncludeInPipeline, 1)             AS IncludeInPipeline,
    d.OwnerEmployeeID,
    d.OwnerEmployee                             AS OwnerName,
    d.Amount,
    /**
     * THE CURRENCY THE AMOUNT IS IN. Selected because three display sites hardcode 'USD', and a deal
     * priced in EUR would otherwise render as dollars and be summed into a dollar column total.
     *
     * Nullable, and NULL on every seeded deal today -- nothing populates it yet. A consumer must treat
     * NULL as "unknown", not as the display default, and must refuse to total a set containing more
     * than one distinct value. The board does both.
     */
    d.CurrencyID,
    -- Provenance, so a grid can mark a stated figure rather than presenting it as settled. This is
    -- the same distinction the board and dashboard now render.
    d.AmountIsComputed,
    d.AmountComputedAt,
    d.Probability,
    ISNULL(d.Amount, 0) * ISNULL(d.Probability, 0) / 100.0 AS WeightedAmount,
    d.ExpectedCloseDate,
    d.ActualCloseDate,
    -- "Past its expected close and still open" — the slipped flag the dashboard shows. "Today" is
    -- the BUSINESS day from fnBusinessToday(), not the UTC day: from 6 PM Central (7 PM in daylight
    -- time) the UTC day is already tomorrow, and a deal due today read as past due all evening (bc-aidp-next-golive#168).
    CASE WHEN ISNULL(st.IsOpen, 0) = 1
          AND d.ExpectedCloseDate IS NOT NULL
          AND d.ExpectedCloseDate < bt.Today
         THEN 1 ELSE 0 END                      AS IsPastExpectedClose,
    d.OrderID,
    -- The deal's product companies, distinct. See the header.
    (SELECT STRING_AGG(CAST(pc.CompanyID AS NVARCHAR(36)), ',')
       FROM (SELECT DISTINCT ol.CompanyID, co.Name AS CompanyName
               FROM [__mj_BizAppsOrders].OrderLine ol
               LEFT OUTER JOIN [__mj].Company co ON co.ID = ol.CompanyID
              WHERE ol.OrderHeaderID = d.OrderID) pc)   AS ProductCompanyIDs,
    (SELECT STRING_AGG(pc.CompanyName, ', ')
       FROM (SELECT DISTINCT ol.CompanyID, co.Name AS CompanyName
               FROM [__mj_BizAppsOrders].OrderLine ol
               LEFT OUTER JOIN [__mj].Company co ON co.ID = ol.CompanyID
              WHERE ol.OrderHeaderID = d.OrderID) pc)   AS ProductCompanyNames,
    d.ContractID,
    d.__mj_CreatedAt                            AS CreatedAt
FROM [__mj_BizAppsSales].vwDeals d
/**
 * LEFT JOIN, NOT INNER, AND THIS WAS A BUG.
 *
 * `Deal.DealStatusTypeID` is NULLABLE. An INNER JOIN here silently DROPS any deal with no status, or
 * whose status row has been deleted -- and this query is the roster, so such a deal would vanish from
 * the grid, from the board, from the "of N total" denominator, and from every §9 aggregate built on
 * it. The client path this replaced was a plain RunView with no join at all, which counted every
 * deal, so the INNER JOIN quietly turned a mechanism change into a MEASURE change.
 *
 * There are no status-less deals in the seeded data, which is the only reason it never showed. The
 * flags below therefore have to tolerate NULL rather than assume a row: see the ISNULL wrappers.
 */
LEFT OUTER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage ps
        ON ps.ID = d.PipelineStageID
LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
        ON fc.ID = d.ForecastCategoryTypeID
CROSS JOIN [__mj_BizAppsCommon].[fnBusinessToday]() AS bt
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
  {% if OwnerEmployeeID %}
  AND d.OwnerEmployeeID = {{ OwnerEmployeeID | sqlString }}
  {% endif %}
  {% if OwnerEmployeeIDs %}
  AND d.OwnerEmployeeID IN {{ OwnerEmployeeIDs | sqlIn }}
  {% endif %}
  {% if ProductCompanyIDs %}
  AND EXISTS (SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol
              WHERE ol.OrderHeaderID = d.OrderID
                AND ol.CompanyID IN {{ ProductCompanyIDs | sqlIn }})
  {% endif %}
  {% if OpenOnly == "true" %}
  AND ISNULL(st.IsOpen, 0) = 1
  {% endif %}
  {% if PeriodStart %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) >= {{ PeriodStart | sqlString }}
  {% endif %}
  /**
   * CLOSED DEALS FROM A DATE ON; EVERY OTHER DEAL ALWAYS (bizapps-sales#209).
   *
   * The Sales section's first load shipped the whole book, closed deals included, and the browser
   * reduced it. Its dashboard figures read only open deals, and the won figures come from
   * `Sales: Dashboard Summary`, so the only closed deals it renders are the board's, which shows those
   * closed in the current fiscal quarter. This bounds the closed rows and leaves the rest alone:
   * open deals and status-less ones are kept whatever their dates, unlike `PeriodStart`, which windows
   * every row.
   *
   * A closed deal with neither close date is left out: nothing says when it closed.
   */
  {% if ClosedSince %}
  AND (ISNULL(st.IsClosed, 0) = 0
       OR COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) >= {{ ClosedSince | sqlString }})
  {% endif %}
  {% if PeriodEnd %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) <= {{ PeriodEnd | sqlString }}
  {% endif %}
ORDER BY
    CASE WHEN ISNULL(st.IsOpen, 0) = 1 THEN 0 ELSE 1 END,
    d.ExpectedCloseDate,
    d.Amount DESC;
