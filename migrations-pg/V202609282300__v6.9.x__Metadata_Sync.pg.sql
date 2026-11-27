-- =============================================================================================
-- PostgreSQL counterpart of V202609282300__v6.9.x__Metadata_Sync.sql -- BizApps Sales v6.9.x Metadata_Sync
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.5) on the T-SQL file's sync blocks,
--     with the schema placeholders written out for the run. Each record is a DO block that calls
--     the core or app function, in whichever signature the host has (jsonb or named parameters).
--   * The converter does not translate the lookups and guards the T-SQL file adds, so they are
--     written here by hand from the T-SQL ones, block for block:
--       - SELECT TOP 1 @x = [ID] ... ORDER BY ... becomes
--         p_x := COALESCE((SELECT "ID" ... ORDER BY ... LIMIT 1), p_x), which keeps the literal
--         ID when nothing matches, as the T-SQL assignment does.
--       - IF <guard> EXEC ... becomes IF <guard> THEN <call> END IF.
--   * Every string value is taken verbatim from the T-SQL file: the converter rewrites T-SQL
--     inside string literals.
--   * Core calls use ${mjSchema}; app schemas are written lowercase, as PostgreSQL stores them.
-- =============================================================================================

SET standard_conforming_strings = on;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_b77dfbd84854 VARCHAR(255);
  p_CategoryID_b77dfbd84854 UUID;
  p_UserQuestion_b77dfbd84854 TEXT;
  p_Description_b77dfbd84854 TEXT;
  p_SQL_b77dfbd84854 TEXT;
  p_TechnicalDescription_b77dfbd84854 TEXT;
  p_OriginalSQL_b77dfbd84854 TEXT;
  p_Feedback_b77dfbd84854 TEXT;
  p_Status_b77dfbd84854 VARCHAR(15);
  p_QualityRank_b77dfbd84854 INTEGER;
  p_ExecutionCostRank_b77dfbd84854 INTEGER;
  p_UsesTemplate_b77dfbd84854 BOOLEAN;
  p_AuditQueryRuns_b77dfbd84854 BOOLEAN;
  p_CacheEnabled_b77dfbd84854 BOOLEAN;
  p_CacheTTLMinutes_b77dfbd84854 INTEGER;
  p_CacheMaxSize_b77dfbd84854 INTEGER;
  p_EmbeddingVector_b77dfbd84854 TEXT;
  p_EmbeddingModelID_b77dfbd84854 UUID;
  p_CacheValidationSQL_b77dfbd84854 TEXT;
  p_SQLDialectID_b77dfbd84854 UUID;
  p_Reusable_b77dfbd84854 BOOLEAN;
  p_ExternalDataSourceID_b77dfbd84854 UUID;
  p_IsMaterialized_b77dfbd84854 BOOLEAN;
  p_ID_b77dfbd84854 UUID;
BEGIN
  p_Name_b77dfbd84854 := 'Sales: Dashboard Summary';
  p_CategoryID_b77dfbd84854 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_b77dfbd84854 := 'What are the dashboard headline figures right now — open pipeline, open deals, deals past their expected close, and wins in the selected period?';
  p_Description_b77dfbd84854 := 'The four KPI tiles as a single row of scalars. Added because the other thirteen queries do not answer them as scalars: Pipeline Summary is grouped by stage and open-only, Deal Roster carries the past-close flag per row, and Bookings by Period is date-windowed — composing the tiles from those would have moved the SQL to the server and left the aggregation in the browser, which is the half §9.5 is about. Also returns the priced/stated split of the open figure so a tile can say how much of it nobody priced. WonCount accepts an optional period window; the other figures never do.';
  p_SQL_b77dfbd84854 := '-- The four dashboard tiles, as ONE row of scalars. Master plan §9.5.
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
-- Every count branches on a DealStatusType FLAG, exactly as the component''s `hasFlag` did. This is a
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
-- anyone west of Greenwich. Doing it in SQL removes the client''s clock from the question entirely —
-- the server''s UTC date is the only one involved.
--
-- ── THE PERIOD WINDOW APPLIES TO ONE COLUMN, AND IT IS NOT IN THE `WHERE` ──────────────────────
--
-- This header used to read "NO PERIOD PARAMETER -- these tiles are ''right now'' and ''to date''". That
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
 * MEANS -- and this file''s header claims a mechanism change, not a measure change. Keeping that claim
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
';
  p_TechnicalDescription_b77dfbd84854 := 'Grain: Deal, reduced to one row. Every count branches on a DealStatusType FLAG (IsOpen, IsWon) exactly as the component''s hasFlag did — this is a mechanism change, not a measure change, and test-harnesses/compare-dashboard-measures.mjs runs both paths over the same data and fails on any disagreement. IsPastExpectedClose compares ExpectedCloseDate against CAST(SYSUTCDATETIME() AS DATE), which removes the client''s clock from the comparison; the component had to build a UTC date string by hand to avoid moving the boundary a day for anyone west of Greenwich. PERIOD SCOPE (golive#232): PeriodStart/PeriodEnd are optional and are applied INSIDE the WonCount CASE expression on ActualCloseDate — never in the WHERE clause. That is deliberate and load-bearing: a WHERE would narrow every column, dropping open deals whose close date falls outside the window and making TotalCount stop describing the whole book, whereas golive#232 requires open-deal figures to stay unwindowed. Omitting both parameters reproduces the original all-time count exactly. ActualCloseDate is the same date dimension win-rate.sql uses, so the Won tile and the win rate agree by construction; a won deal with a NULL ActualCloseDate is excluded from a bounded window and included in the unbounded one. Open deals in pipelines with IncludeInForecast = 0 are excluded from every tile, TotalCount included, unless PipelineID names the pipeline.';
  p_Status_b77dfbd84854 := 'Approved';
  p_QualityRank_b77dfbd84854 := 9;
  p_ExecutionCostRank_b77dfbd84854 := 1;
  p_UsesTemplate_b77dfbd84854 := TRUE;
  p_AuditQueryRuns_b77dfbd84854 := FALSE;
  p_CacheEnabled_b77dfbd84854 := FALSE;
  p_EmbeddingVector_b77dfbd84854 := '[-0.060127586126327515,0.07600998878479004,-0.03980054333806038,-0.023172978311777115,-0.009980072267353535,-0.027933161705732346,0.06631717085838318,0.004659883212298155,-0.047054920345544815,0.009588317945599556,-0.023451462388038635,-0.025785330682992935,0.04687312990427017,0.13283221423625946,0.0016337694833055139,-0.054363179951906204,0.0031472460832446814,-0.006677244324237108,-0.037576161324977875,0.0007001961348578334,-0.005723769310861826,0.00699320062994957,-0.047211140394210815,0.035016100853681564,-0.014865022152662277,-0.03383940830826759,-0.008990858681499958,-0.018864911049604416,0.0026094268541783094,-0.09966862201690674,0.0046555292792618275,0.023401619866490364,-0.003970147110521793,0.0033704049419611692,0.0000027276751097815577,-0.017223574221134186,-0.04678630083799362,0.011339213699102402,-0.04672893136739731,0.09767694026231766,0.006208672188222408,-0.04505284130573273,-0.0027735643088817596,-0.009815829806029797,0.02718963287770748,-0.0418119877576828,-0.059426821768283844,0.07100401818752289,-0.03675193339586258,-0.04690500348806381,0.017804227769374847,-0.0054049319587647915,-0.028757475316524506,0.010378754697740078,-0.00248750951141119,-0.1045464500784874,-0.012647501192986965,-0.065241739153862,0.014462439343333244,-0.11312703043222427,-0.046445105224847794,0.015064291656017303,0.006841191090643406,-0.04753050208091736,0.013886173255741596,0.08469390869140625,-0.02712266333401203,0.00030739366775378585,-0.02426072023808956,-0.003963665571063757,0.07372549921274185,-0.004582203924655914,-0.006525931879878044,-0.06162657588720322,-0.014096159487962723,-0.07308273762464523,-0.057971905916929245,0.03200984001159668,0.022671816870570183,-0.009568789973855019,-0.09162936359643936,0.08685542643070221,-0.03860499709844589,0.012546847574412823,-0.00962898414582014,-0.011359332129359245,0.011963581666350365,-0.006951339077204466,0.008033504709601402,0.011654539033770561,-0.02879672683775425,-0.0012499132426455617,-0.01784275844693184,-0.009793419390916824,-0.028310414403676987,-0.009320884011685848,0.041729528456926346,0.051750730723142624,-0.010580115020275116,-0.0004605682916007936,0.01073539350181818,0.035166237503290176,0.022486375644803047,0.04308412969112396,0.03441111370921135,0.02391251176595688,0.0167067963629961,-0.026606174185872078,-0.009922527708113194,0.05168946087360382,0.015554812736809254,-0.01171222422271967,0.03153776377439499,-0.006795765832066536,-0.07990770041942596,-0.022282153367996216,-0.022857192903757095,0.018569348379969597,-0.01702507957816124,0.023473920300602913,0.10032916814088821,0.00657200301066041,0.0035897111520171165,0.021775633096694946,-0.00871836394071579,0.025712231174111366,-0.014192426577210426,-0.03904116898775101,-0.011594359762966633,-0.011528669856488705,-0.04623667895793915,-0.006162754260003567,0.03296637535095215,-0.013766169548034668,-0.01990223303437233,-0.02000901848077774,-0.000765902572311461,0.05694769322872162,-0.016095956787467003,-0.012042518705129623,-0.028309056535363197,0.0034208977594971657,-0.03996085748076439,0.04219425469636917,0.032391224056482315,-0.014251024462282658,-0.024988623335957527,0.07983363419771194,0.014148086309432983,0.01885795220732689,-0.009220043197274208,-0.008983813226222992,0.0008426228887401521,0.006935401353985071,-0.020214982330799103,-0.016401831060647964,0.023613959550857544,0.00451642507687211,-0.01970263011753559,0.058034468442201614,0.011755483224987984,0.003944258205592632,0.028091175481677055,-0.006280592642724514,-0.008244335651397705,0.02653663605451584,-0.041243776679039,0.014699151739478111,0.0037912921980023384,-0.06097142770886421,-0.03121430054306984,-0.053085144609212875,-0.016601983457803726,0.03702031821012497,0.040757276117801666,-0.00441742641851306,0.0020308434031903744,-0.010893753729760647,-0.009392095729708672,-0.03560582175850868,0.0305106732994318,-0.09787922352552414,-0.025288403034210205,-0.01776202768087387,0.04352951794862747,-0.0027958624996244907,-0.03049580007791519,-0.0221864003688097,0.00884429644793272,0.016141925007104874,0.011401822790503502,0.05203251540660858,-0.08719685673713684,0.0244643185287714,-0.0033085844479501247,-0.04349828138947487,-0.001900803647004068,-0.03956051543354988,0.044827573001384735,0.05029752850532532,-0.007252891082316637,-0.009472114965319633,0.01872148923575878,0.033318351954221725,0.03780301660299301,0.008019932545721531,0.023813696578145027,-0.011688289232552052,-0.05188297852873802,0.015047796070575714,0.05022939294576645,0.006874642800539732,-0.02545999176800251,0.04156000167131424,0.01276066992431879,0.029527150094509125,0.04190049320459366,0.017374077811837196,-0.021385839208960533,-0.006537958513945341,-0.025869397446513176,0.03133624792098999,-0.014812439680099487,0.005434373859316111,0.11844506114721298,0.02925720438361168,0.016072481870651245,0.01129380613565445,-0.011323987506330013,-0.0036583649925887585,-0.02287825010716915,-0.013555005192756653,0.03690285235643387,0.02166210301220417,0.05089978128671646,0.08092189580202103,0.04635603353381157,0.03159122169017792,0.0010705903405323625,0.07803326100111008,-0.027536530047655106,-0.04950963705778122,-0.01890343241393566,0.016452010720968246,0.05841469019651413,-0.020693333819508553,-0.06524763256311417,-0.03863002359867096,0.021444937214255333,0.017382975667715073,-0.03186393156647682,0.019429095089435577,0.082712322473526,-0.01682521589100361,-0.004075432661920786,-0.005172082222998142,-0.13349613547325134,0.018648244440555573,-0.013086451217532158,0.07571934908628464,0.02669525519013405,-0.02233601175248623,-0.008706842549145222,-0.030614031478762627,0.03433331847190857,-0.03115387074649334,0.045518383383750916,-0.05518731474876404,-0.00833535473793745,0.010126281529664993,0.013989884406328201,0.021345771849155426,-0.021867843344807625,-0.01818682812154293,-0.000258817570284009,0.047196291387081146,-0.10145734250545502,-0.0026562013663351536,-0.013688065111637115,-0.006264795549213886,0.012827117927372456,-0.002362632192671299,-0.006240001879632473,0.014504159800708294,0.004221578128635883,0.023244544863700867,0.021680936217308044,-0.005794356111437082,-0.010032975114881992,-0.09275445342063904,0.00911447312682867,-0.028465578332543373,0.03275603801012039,-0.007876495830714703,-0.04788986220955849,0.010481569916009903,-0.057436391711235046,0.037487179040908813,0.0015744110569357872,0.031430259346961975,-0.0403008870780468,-0.03249586373567581,-0.02981134131550789,0.03315603360533714,-0.02216443605720997,0.04025934636592865,0.008297646418213844,-0.0028420097660273314,0.011065407656133175,0.01633448153734207,0.03268444165587425,0.011434374377131462,-0.010231141932308674,-0.016367726027965546,0.022426413372159004,-0.038222119212150574,-0.0641375407576561,0.06129961833357811,-0.028525903820991516,0.07411316782236099,0.0023911260068416595,-0.009732640348374844,-0.04613286256790161,-0.011511583812534809,-0.04425341635942459,0.00955674797296524,-0.0003493004769552499,-0.029518207535147667,-0.039116308093070984,-0.0411493293941021,0.01623409241437912,-0.11655812710523605,-0.025594688951969147,0.00039684560033492744,0.0054585980251431465,-0.07091033458709717,-0.011652993969619274,0.05866345763206482,-0.0130391800776124,-0.026635244488716125,-0.018588608130812645,-0.02399030141532421,-0.025500936433672905,-0.015269674360752106,-0.013357017189264297,-0.04250651225447655,0.08409276604652405,0.02613467164337635,-0.09670598059892654,0.044558651745319366,0.02522071823477745,0.03416764363646507,-0.03658808767795563,-0.01980207860469818,-0.008253004401922226,-0.02350519970059395,-0.02430756203830242,0.009478218853473663,-0.0015061013400554657,-0.08183912187814713,-0.016918199136853218,0.02085586078464985,0.039084699004888535,0.08698741346597672,0.05225575715303421,0.04161331057548523,0.0059710233472287655,-0.014161043800413609,0.052462588995695114,-0.0002459646202623844,-0.022285746410489082,0.01545285526663065,0.038643915206193924,0.025938676670193672,0.004234806168824434,0.005496997851878405,-0.00048613070975989103,0.029079006984829903,0.023167362436652184,-0.013072594068944454,0.035273902118206024,0.03170193359255791,0.0959104597568512,-0.02310512587428093,0.07330967485904694,0.0032515302300453186,-0.05471796914935112,-0.056052833795547485,-0.05670778080821037,0.03221934661269188,-0.0057344152592122555,-0.01813378371298313,0.07141588628292084,0.000313027820084244,-0.000788157747592777,-0.011351149529218674,-0.02413948066532612,0.03919559717178345,-0.005052960477769375,0.006842623930424452,0.00136214355006814,0.05110664293169975,0.05471009761095047,-0.014812995679676533,0.03023948147892952,-0.0495971143245697,-0.10836859792470932,0.02540278248488903,-0.031004054471850395,-0.013840312138199806,-0.021956490352749825,-0.014353838749229908,0.021452337503433228,-0.009061077609658241,0.03659573942422867,-0.006537465378642082,-0.007225422654300928,-0.007918658666312695,0.005403807852417231,0.004189338069409132,0.02559327334165573,0.016148939728736877,0.038307979702949524,0.0005698400782421231,0.020835263654589653,-0.004149071406573057,0.05169299244880676,-0.06993559002876282,-0.0012093809200450778,0.023718761280179024,0.010257451795041561,-0.012907620519399643,-0.017130587249994278,0.016802920028567314,-0.04562200605869293,-0.00588811282068491,0.015286356210708618,-0.009452560916543007,-0.03300878405570984,0.01431305706501007,-0.03092992678284645,0.03549639508128166,0.0748201310634613,0.004495120141655207,-0.020185429602861404,0.007935358211398125,0.0028346371836960316,0.004363827873021364,-0.04675676301121712,-0.06546526402235031,0.02467055805027485,-0.02887878194451332,0.07167527824640274,-0.017679648473858833,-0.037931498140096664,-0.05728955566883087,0.023110125213861465,-0.04742145165801048,-0.02277863770723343,-0.029723864048719406,0.007611400447785854,0.02964375913143158,-0.08341929316520691,0.006463129073381424,0.057583585381507874,-0.04817836359143257,-0.014091072604060173,-0.042438115924596786,0.02043832279741764,-0.052782367914915085,0.05460761487483978,-0.019494377076625824,-0.032892774790525436,-0.005524152889847755,0.04214733466506004,0.018089033663272858,-0.000006923263299540849,0.05762932822108269,0.06541337072849274,0.0030969998333603144,-0.027042686939239502,-0.0032003740780055523,0.018419155851006508,-0.09020102769136429,0.001471925526857376,0.02927774377167225,-0.015191895887255669,-0.020090920850634575,-0.006040351465344429,-0.022731903940439224,0.00435976218432188,-0.011904590763151646,-0.05418871343135834,0.06953944265842438,0.039617281407117844,0.08506439626216888,-0.0047136167995631695,-0.09915921837091446,0.02665577456355095,-0.0481429323554039,-0.05171160772442818,0.018381180241703987,0.016211088746786118,-0.055074241012334824,-0.041369568556547165,0.03005989082157612,0.05974983423948288,-0.024053575471043587,-0.008898421190679073,-0.007950562052428722,0.014226500876247883,-0.002815990010276437,-0.04515327513217926,-0.0267744492739439,0.0661085918545723,-0.011118918657302856,-0.03195256367325783,0.005492775700986385,-0.03249741345643997,0.014150520786643028,0.003999641630798578,-0.01647523045539856,-0.014080172404646873,-0.003519086865708232,0.09026169031858444,-0.04535817727446556,0.027308756485581398,-0.01252102293074131,0.004448090214282274,0.0311159435659647,-0.014223314821720123,0.021290412172675133,0.019409995526075363,0.022272605448961258,-0.00970940850675106,-0.023554015904664993,-0.052213579416275024,0.0295413788408041,0.030915701761841774,0.004390914924442768,-0.061608556658029556,0.03520897030830383,0.04621349647641182,-0.005101226270198822,0.00012877982226200402,0.00472353445366025,-0.028692876920104027,-0.02429930865764618,0.015883956104516983,0.012263180688023567,0.01526965294033289,0.0009266167762689292,-0.03169005736708641,0.0031602371018379927,-0.03899114951491356,-7.656857960569444e-33,-0.009026866406202316,-0.030194979161024094,-0.019522370770573616,0.014235064387321472,-0.03319920226931572,-0.05521384999155998,0.03708502650260925,-0.04256536066532135,0.013702863827347755,-0.04014058783650398,-0.03332286328077316,-0.010135536082088947,0.03181404620409012,-0.008635098114609718,0.041064657270908356,-0.0023147251922637224,0.029214413836598396,-0.012848833575844765,-0.038179438561201096,0.01041455939412117,-0.019240550696849823,0.032066717743873596,0.021598724648356438,0.010084022767841816,-0.04938957840204239,0.015897400677204132,-0.0013441430637612939,0.004439068492501974,0.039693158119916916,-0.02537764050066471,0.007290071342140436,-0.007303626276552677,0.010564878582954407,0.007132531609386206,-0.003732407232746482,-0.08356840908527374,0.016848109662532806,0.002254979219287634,0.02311353012919426,-0.008672303520143032,0.06523662060499191,0.007227993570268154,-0.01076001301407814,0.007715528830885887,0.007273439783602953,-0.02428026869893074,0.022463925182819366,-0.03036116622388363,-0.00756120728328824,0.014137791469693184,0.06147310882806778,0.004499438684433699,-0.022157229483127594,0.07817299664020538,0.0035249015782028437,0.03670618683099747,0.044706959277391434,0.015580402687191963,-0.040599510073661804,0.023049160838127136,0.0027408013120293617,-0.009373246692121029,0.013431723229587078,0.005498893093317747,0.03567828983068466,0.005470640491694212,0.014866556040942669,0.021236954256892204,-0.005717645864933729,-0.023036407306790352,-0.0037365411408245564,0.056074317544698715,-0.033626068383455276,-0.07802709937095642,0.000412580615375191,0.016102423891425133,0.022028731182217598,0.011930849403142929,-0.014962182380259037,0.04129556193947792,0.0036980584263801575,-0.025667699053883553,-0.04854295030236244,0.030375462025403976,0.02802293561398983,-0.03723593428730965,-0.01274107675999403,0.035119716078042984,0.03747234120965004,0.03612091764807701,-0.010045001283288002,0.06787214428186417,-0.03539837896823883,0.01855948381125927,-0.04299412667751312,-0.01478038914501667,0.06361018121242523,0.06007649376988411,0.006675646174699068,-0.029628850519657135,-0.009220218285918236,0.05014333128929138,0.012162363156676292,0.0013628983870148659,-0.007492590229958296,-0.0035476256161928177,0.02191806212067604,0.03272340074181557,-0.03692410886287689,0.031238634139299393,0.008933976292610168,0.02299279160797596,0.045188065618276596,0.013338408432900906,-0.01632426306605339,0.007043258287012577,0.009284740313887596,-0.03600398451089859,-0.0010397667065262794,0.035769522190093994,0.01905129849910736,-0.01764162816107273,-0.01355357002466917,0.004378331825137138,0.018923180177807808,-0.02227449044585228,0.025908131152391434,-0.061283886432647705,0.012306720949709415,0.005951837170869112,-0.0074993278831243515,0.016118232160806656,3.4944602589348506e-7,0.009268190711736679,-0.018664773553609848,-0.02888839691877365,0.10727230459451675,0.014910365454852581,-0.02144809253513813,-0.020539142191410065,0.019524792209267616,0.0031897269655019045,-0.009560516104102135,0.01584112085402012,-0.023843776434659958,0.039737436920404434,0.025278819724917412,0.03453795611858368,-0.04281758889555931,-0.011388491839170456,-0.053834784775972366,-0.07992386817932129,-0.019079837948083878,0.044222939759492874,0.043547794222831726,0.06009037792682648,0.009274653159081936,0.015631655231118202,0.03010251559317112,-0.003386205993592739,-0.047574661672115326,-0.01848326250910759,0.016065344214439392,0.06281747668981552,0.0010399901075288653,-0.017250383272767067,-0.0050944555550813675,0.004979098215699196,0.05770902335643768,-0.02185424417257309,-0.02585320547223091,0.05467350408434868,0.00909033976495266,-0.006543838884681463,-0.06664834171533585,-0.03223368152976036,-0.06378105282783508,0.032371703535318375,-0.009719928726553917,0.04400693625211716,0.07201158255338669,0.002088912297040224,-0.03714516758918762,0.03599166125059128,-0.002242312766611576,0.02040252462029457,0.025345640257000923,0.020473143085837364,-0.018014617264270782,0.03780415281653404,0.03162690997123718,0.04012183099985123,-0.026950277388095856,-0.03307460993528366,-0.010545910336077213,0.011174126528203487,0.022876163944602013,0.0037470096722245216,-0.05533105507493019,-0.030476383864879608,4.035657154897671e-34,0.034414101392030716,0.013100829906761646,0.010824309661984444,0.008996985852718353,0.02585357427597046,-0.015995917841792107,0.04804551228880882,-0.046797625720500946,-0.022200103849172592,-0.07891340553760529,-0.020670097321271896]';
  p_EmbeddingModelID_b77dfbd84854 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_b77dfbd84854 := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_b77dfbd84854 := FALSE;
  p_IsMaterialized_b77dfbd84854 := FALSE;
  p_ID_b77dfbd84854 := '5A1E5000-0001-4000-A000-00000000000E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_b77dfbd84854,
    'CategoryID', p_CategoryID_b77dfbd84854,
    'UserQuestion', p_UserQuestion_b77dfbd84854,
    'Description', p_Description_b77dfbd84854,
    'SQL', p_SQL_b77dfbd84854,
    'TechnicalDescription', p_TechnicalDescription_b77dfbd84854,
    'OriginalSQL', p_OriginalSQL_b77dfbd84854,
    'Feedback', p_Feedback_b77dfbd84854,
    'Status', p_Status_b77dfbd84854,
    'QualityRank', p_QualityRank_b77dfbd84854,
    'ExecutionCostRank', p_ExecutionCostRank_b77dfbd84854,
    'UsesTemplate', p_UsesTemplate_b77dfbd84854,
    'AuditQueryRuns', p_AuditQueryRuns_b77dfbd84854,
    'CacheEnabled', p_CacheEnabled_b77dfbd84854,
    'CacheTTLMinutes', p_CacheTTLMinutes_b77dfbd84854,
    'CacheMaxSize', p_CacheMaxSize_b77dfbd84854,
    'EmbeddingVector', p_EmbeddingVector_b77dfbd84854,
    'EmbeddingModelID', p_EmbeddingModelID_b77dfbd84854,
    'CacheValidationSQL', p_CacheValidationSQL_b77dfbd84854,
    'SQLDialectID', p_SQLDialectID_b77dfbd84854,
    'Reusable', p_Reusable_b77dfbd84854,
    'ExternalDataSourceID', p_ExternalDataSourceID_b77dfbd84854,
    'IsMaterialized', p_IsMaterialized_b77dfbd84854,
    'ID', p_ID_b77dfbd84854
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_b77dfbd84854, p_CategoryID := p_CategoryID_b77dfbd84854, p_UserQuestion := p_UserQuestion_b77dfbd84854, p_Description := p_Description_b77dfbd84854, p_SQL := p_SQL_b77dfbd84854, p_TechnicalDescription := p_TechnicalDescription_b77dfbd84854, p_OriginalSQL := p_OriginalSQL_b77dfbd84854, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_b77dfbd84854, p_Feedback_Clear := TRUE, p_Status := p_Status_b77dfbd84854, p_QualityRank := p_QualityRank_b77dfbd84854, p_ExecutionCostRank := p_ExecutionCostRank_b77dfbd84854, p_UsesTemplate := p_UsesTemplate_b77dfbd84854, p_AuditQueryRuns := p_AuditQueryRuns_b77dfbd84854, p_CacheEnabled := p_CacheEnabled_b77dfbd84854, p_CacheTTLMinutes := p_CacheTTLMinutes_b77dfbd84854, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_b77dfbd84854, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_b77dfbd84854, p_EmbeddingModelID := p_EmbeddingModelID_b77dfbd84854, p_CacheValidationSQL := p_CacheValidationSQL_b77dfbd84854, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_b77dfbd84854, p_Reusable := p_Reusable_b77dfbd84854, p_ExternalDataSourceID := p_ExternalDataSourceID_b77dfbd84854, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_b77dfbd84854, p_ID := p_ID_b77dfbd84854);
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_1d307bbd9717 UUID;
  p_QueryID_1d307bbd9717 UUID;
  p_Name_1d307bbd9717 VARCHAR(255);
  p_Type_1d307bbd9717 VARCHAR(50);
  p_IsRequired_1d307bbd9717 BOOLEAN;
  p_DefaultValue_1d307bbd9717 TEXT;
  p_Description_1d307bbd9717 TEXT;
  p_SampleValue_1d307bbd9717 TEXT;
  p_ValidationFilters_1d307bbd9717 TEXT;
  p_DetectionMethod_1d307bbd9717 VARCHAR(50);
  p_AutoDetectConfidenceScore_1d307bbd9717 NUMERIC(3,2);
BEGIN
  p_ID_1d307bbd9717 := 'b4f92ca5-72db-406d-bc4a-f84247035708';
  p_QueryID_1d307bbd9717 := '5A1E5000-0001-4000-A000-00000000000E';
  p_Name_1d307bbd9717 := 'PeriodStart';
  p_Type_1d307bbd9717 := 'string';
  p_IsRequired_1d307bbd9717 := FALSE;
  p_Description_1d307bbd9717 := 'Optional text value for Period Start';
  p_SampleValue_1d307bbd9717 := 'Example';
  p_DetectionMethod_1d307bbd9717 := 'AI';
  p_QueryID_1d307bbd9717 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Dashboard Summary' ORDER BY CASE WHEN "ID" = p_QueryID_1d307bbd9717 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_1d307bbd9717);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
               WHERE "ID" = p_ID_1d307bbd9717
                  OR ("QueryID" = p_QueryID_1d307bbd9717 AND "Name" = p_Name_1d307bbd9717)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
      'ID', p_ID_1d307bbd9717,
      'QueryID', p_QueryID_1d307bbd9717,
      'Name', p_Name_1d307bbd9717,
      'Type', p_Type_1d307bbd9717,
      'IsRequired', p_IsRequired_1d307bbd9717,
      'DefaultValue', p_DefaultValue_1d307bbd9717,
      'Description', p_Description_1d307bbd9717,
      'SampleValue', p_SampleValue_1d307bbd9717,
      'ValidationFilters', p_ValidationFilters_1d307bbd9717,
      'DetectionMethod', p_DetectionMethod_1d307bbd9717,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_1d307bbd9717
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_1d307bbd9717, p_QueryID := p_QueryID_1d307bbd9717, p_Name := p_Name_1d307bbd9717, p_Type := p_Type_1d307bbd9717, p_IsRequired := p_IsRequired_1d307bbd9717, p_DefaultValue := p_DefaultValue_1d307bbd9717, p_DefaultValue_Clear := TRUE, p_Description := p_Description_1d307bbd9717, p_SampleValue := p_SampleValue_1d307bbd9717, p_ValidationFilters := p_ValidationFilters_1d307bbd9717, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_1d307bbd9717, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_1d307bbd9717, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_fb767912785e UUID;
  p_QueryID_fb767912785e UUID;
  p_Name_fb767912785e VARCHAR(255);
  p_Type_fb767912785e VARCHAR(50);
  p_IsRequired_fb767912785e BOOLEAN;
  p_DefaultValue_fb767912785e TEXT;
  p_Description_fb767912785e TEXT;
  p_SampleValue_fb767912785e TEXT;
  p_ValidationFilters_fb767912785e TEXT;
  p_DetectionMethod_fb767912785e VARCHAR(50);
  p_AutoDetectConfidenceScore_fb767912785e NUMERIC(3,2);
BEGIN
  p_ID_fb767912785e := 'dfa0dfd6-05c3-4e44-9780-34fafb0c3b3b';
  p_QueryID_fb767912785e := '5A1E5000-0001-4000-A000-00000000000E';
  p_Name_fb767912785e := 'PeriodEnd';
  p_Type_fb767912785e := 'string';
  p_IsRequired_fb767912785e := FALSE;
  p_Description_fb767912785e := 'Optional text value for Period End';
  p_SampleValue_fb767912785e := 'Example';
  p_DetectionMethod_fb767912785e := 'AI';
  p_QueryID_fb767912785e := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Dashboard Summary' ORDER BY CASE WHEN "ID" = p_QueryID_fb767912785e THEN 0 ELSE 1 END LIMIT 1), p_QueryID_fb767912785e);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
               WHERE "ID" = p_ID_fb767912785e
                  OR ("QueryID" = p_QueryID_fb767912785e AND "Name" = p_Name_fb767912785e)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
      'ID', p_ID_fb767912785e,
      'QueryID', p_QueryID_fb767912785e,
      'Name', p_Name_fb767912785e,
      'Type', p_Type_fb767912785e,
      'IsRequired', p_IsRequired_fb767912785e,
      'DefaultValue', p_DefaultValue_fb767912785e,
      'Description', p_Description_fb767912785e,
      'SampleValue', p_SampleValue_fb767912785e,
      'ValidationFilters', p_ValidationFilters_fb767912785e,
      'DetectionMethod', p_DetectionMethod_fb767912785e,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_fb767912785e
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_fb767912785e, p_QueryID := p_QueryID_fb767912785e, p_Name := p_Name_fb767912785e, p_Type := p_Type_fb767912785e, p_IsRequired := p_IsRequired_fb767912785e, p_DefaultValue := p_DefaultValue_fb767912785e, p_DefaultValue_Clear := TRUE, p_Description := p_Description_fb767912785e, p_SampleValue := p_SampleValue_fb767912785e, p_ValidationFilters := p_ValidationFilters_fb767912785e, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_fb767912785e, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_fb767912785e, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_fc75ee7f0f5f UUID;
  p_QueryID_fc75ee7f0f5f UUID;
  p_EntityID_fc75ee7f0f5f UUID;
  p_DetectionMethod_fc75ee7f0f5f VARCHAR(50);
  p_AutoDetectConfidenceScore_fc75ee7f0f5f NUMERIC(3,2);
BEGIN
  p_ID_fc75ee7f0f5f := '9a63e4ae-1f35-49aa-963d-829895d42db2';
  p_QueryID_fc75ee7f0f5f := '5A1E5000-0001-4000-A000-00000000000E';
  p_EntityID_fc75ee7f0f5f := 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';
  p_DetectionMethod_fc75ee7f0f5f := 'AI';
  p_AutoDetectConfidenceScore_fc75ee7f0f5f := 1;
  p_QueryID_fc75ee7f0f5f := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Dashboard Summary' ORDER BY CASE WHEN "ID" = p_QueryID_fc75ee7f0f5f THEN 0 ELSE 1 END LIMIT 1), p_QueryID_fc75ee7f0f5f);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_fc75ee7f0f5f
                  OR ("QueryID" = p_QueryID_fc75ee7f0f5f AND "EntityID" = p_EntityID_fc75ee7f0f5f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_fc75ee7f0f5f,
      'QueryID', p_QueryID_fc75ee7f0f5f,
      'EntityID', p_EntityID_fc75ee7f0f5f,
      'DetectionMethod', p_DetectionMethod_fc75ee7f0f5f,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_fc75ee7f0f5f
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_fc75ee7f0f5f, p_QueryID := p_QueryID_fc75ee7f0f5f, p_EntityID := p_EntityID_fc75ee7f0f5f, p_DetectionMethod := p_DetectionMethod_fc75ee7f0f5f, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_fc75ee7f0f5f);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_05e309419f18 VARCHAR(255);
  p_CategoryID_05e309419f18 UUID;
  p_UserQuestion_05e309419f18 TEXT;
  p_Description_05e309419f18 TEXT;
  p_SQL_05e309419f18 TEXT;
  p_TechnicalDescription_05e309419f18 TEXT;
  p_OriginalSQL_05e309419f18 TEXT;
  p_Feedback_05e309419f18 TEXT;
  p_Status_05e309419f18 VARCHAR(15);
  p_QualityRank_05e309419f18 INTEGER;
  p_ExecutionCostRank_05e309419f18 INTEGER;
  p_UsesTemplate_05e309419f18 BOOLEAN;
  p_AuditQueryRuns_05e309419f18 BOOLEAN;
  p_CacheEnabled_05e309419f18 BOOLEAN;
  p_CacheTTLMinutes_05e309419f18 INTEGER;
  p_CacheMaxSize_05e309419f18 INTEGER;
  p_EmbeddingVector_05e309419f18 TEXT;
  p_EmbeddingModelID_05e309419f18 UUID;
  p_CacheValidationSQL_05e309419f18 TEXT;
  p_SQLDialectID_05e309419f18 UUID;
  p_Reusable_05e309419f18 BOOLEAN;
  p_ExternalDataSourceID_05e309419f18 UUID;
  p_IsMaterialized_05e309419f18 BOOLEAN;
  p_ID_05e309419f18 UUID;
BEGIN
  p_Name_05e309419f18 := 'Sales: Deal Roster';
  p_CategoryID_05e309419f18 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_05e309419f18 := 'Which deals are these — one row each, with names, amounts and provenance?';
  p_Description_05e309419f18 := 'One row per deal, dimensioned, as a grid source and a drill-through target for every aggregate here. Exists because the first thing anyone does with a number they distrust is ask which deals are in it, and without a roster sharing the same filters that question gets answered by ad-hoc SQL — which is how a report and its drill-through quietly stop agreeing. Names throughout, per S-US11, with IDs alongside for navigation.';
  p_SQL_05e309419f18 := '-- The deal roster — one row per deal, dimensioned, for a grid or a drill-through target.
--
-- WHY A LIST BELONGS IN A SET OF AGGREGATES. Every other query here answers a question with a number,
-- and the first thing anyone does with a number they distrust is ask which deals are in it. Without a
-- roster that shares the same filters, that question gets answered by someone writing ad-hoc SQL
-- against `Deal` — which is how a report and its drill-through quietly stop agreeing.
--
-- It is also what the dashboard''s own tables need. `DealWorkspaceService.LoadRoster()` currently
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
    -- Whether this pipeline''s OPEN deals belong in the current-book figures. The roster itself keeps
    -- every deal, because the board must still show a pipeline that holds historical deals; the
    -- dashboard''s aggregates drop open rows where this is 0.
    p.IncludeInForecast                         AS PipelineIncludeInForecast,
    d.PipelineStageID,
    d.PipelineStage                             AS StageName,
    ps.DisplayOrder                             AS StageOrder,
    d.DealTypeID,
    d.DealType                                  AS DealTypeName,
    d.DealStatusTypeID,
    d.DealStatusType                            AS StatusName,
    -- A deal with no status is not open, won, lost or closed -- it is unclassified. ISNULL(...,0)
    -- says exactly that, and keeps every consumer''s boolean checks total.
    ISNULL(st.IsOpen, 0)                        AS IsOpen,
    ISNULL(st.IsWon, 0)                         AS IsWon,
    ISNULL(st.IsLost, 0)                        AS IsLost,
    ISNULL(st.IsClosed, 0)                      AS IsClosed,
    -- Surfaced so a status-less deal is VISIBLE as one rather than merely reading as not-open.
    CASE WHEN d.DealStatusTypeID IS NULL OR st.ID IS NULL THEN 1 ELSE 0 END AS HasNoStatus,
    d.ForecastCategoryType                      AS ForecastCategoryName,
    fc.IncludeInCommit,
    fc.IncludeInBestCase,
    d.OwnerEmployeeID,
    d.OwnerEmployee                             AS OwnerName,
    d.Amount,
    /**
     * THE CURRENCY THE AMOUNT IS IN. Selected because three display sites hardcode ''USD'', and a deal
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
    -- "Past its expected close and still open" — the slipped flag the dashboard shows. Computed in
    -- UTC because everything stored is UTC.
    CASE WHEN ISNULL(st.IsOpen, 0) = 1
          AND d.ExpectedCloseDate IS NOT NULL
          AND d.ExpectedCloseDate < CAST(SYSUTCDATETIME() AS DATE)
         THEN 1 ELSE 0 END                      AS IsPastExpectedClose,
    d.OrderID,
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
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if OwnerEmployeeID %}
  AND d.OwnerEmployeeID = {{ OwnerEmployeeID | sqlString }}
  {% endif %}
  {% if OpenOnly == "true" %}
  AND ISNULL(st.IsOpen, 0) = 1
  {% endif %}
  {% if PeriodStart %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) <= {{ PeriodEnd | sqlString }}
  {% endif %}
ORDER BY
    CASE WHEN ISNULL(st.IsOpen, 0) = 1 THEN 0 ELSE 1 END,
    d.ExpectedCloseDate,
    d.Amount DESC;
';
  p_TechnicalDescription_05e309419f18 := 'Grain: Deal. Returns the IsOpen / IsWon / IsLost / IsClosed flags on every row so a consumer can branch on behaviour rather than on the status name it was given for display — the vocabulary rule reaching one layer past the query. Carries AmountIsComputed so a grid can mark a stated figure instead of presenting it as settled. IsPastExpectedClose is computed against SYSUTCDATETIME because everything stored is UTC. Filtered on expected close for open deals and actual close for closed, so one period filter behaves across a mixed set. Returns every deal; PipelineIncludeInForecast lets a consumer leave open deals in pipelines flagged out of the forecast out of current-book figures.';
  p_Status_05e309419f18 := 'Approved';
  p_QualityRank_05e309419f18 := 8;
  p_ExecutionCostRank_05e309419f18 := 2;
  p_UsesTemplate_05e309419f18 := TRUE;
  p_AuditQueryRuns_05e309419f18 := FALSE;
  p_CacheEnabled_05e309419f18 := FALSE;
  p_EmbeddingVector_05e309419f18 := '[-0.015757467597723007,0.09076380729675293,0.012486986815929413,-0.011973385699093342,0.013671742752194405,0.016475502401590347,0.07377937436103821,0.010363291017711163,-0.031016742810606956,-0.005965918302536011,-0.03958207741379738,-0.006266278214752674,0.031253568828105927,0.08149415254592896,0.015433473512530327,0.005209656432271004,0.016544293612241745,-0.0046236454509198666,-0.025774430483579636,-0.0043441904708743095,-0.004250737372785807,0.01525562722235918,-0.026677589863538742,0.009663310833275318,-0.03441742807626724,-0.021730782464146614,0.01690538413822651,-0.012855740264058113,0.023387005552649498,-0.05434203892946243,0.037548795342445374,0.0401901975274086,0.0235616285353899,0.014579848386347294,0.0000027511653115652734,-0.023049142211675644,-0.07704177498817444,0.0032731976825743914,-0.0651940330862999,0.07383361458778381,-0.016520358622074127,-0.052365899085998535,0.00296174013055861,-0.019766712561249733,-0.006972066592425108,-0.035359013825654984,-0.04473976790904999,-0.004184743855148554,-0.011014865711331367,-0.030049636960029602,0.021180976182222366,0.0045037162490189075,-0.04742451757192612,-0.030639907345175743,0.05488394573330879,-0.05752842500805855,0.009495127014815807,-0.03502073511481285,0.022475458681583405,-0.04138965532183647,-0.021592991426587105,0.005457676947116852,0.0030858644749969244,-0.0592292957007885,0.03492329642176628,0.05606617406010628,-0.015058293007314205,0.00520544545724988,0.009419281035661697,0.0016361046582460403,0.11448915302753448,0.010586732067167759,0.004321434535086155,-0.030342642217874527,-0.006916029844433069,-0.057259757071733475,-0.043632492423057556,0.060016945004463196,-0.01601792685687542,-0.022738121449947357,-0.09930036962032318,0.09463997930288315,0.005114761646836996,0.013150396756827831,-0.0391104519367218,-0.02910805679857731,-0.0013780666049569845,0.0025901293847709894,-0.05218904837965965,-0.025299541652202606,0.0011975604575127363,-0.022778037935495377,0.006253481842577457,0.003488600719720125,-0.07543233782052994,0.00621522543951869,0.02632618136703968,-0.0000130952021208941,0.03371184691786766,-0.008965590968728065,-0.034244198352098465,0.007265494670718908,0.006521543022245169,0.012139162980020046,0.04718918725848198,0.012187696993350983,0.0022918505128473043,-0.05372396856546402,-0.031281519681215286,0.033023469150066376,0.011532220989465714,-0.016074785962700844,-0.024944854900240898,0.05692499876022339,-0.048574160784482956,-0.02938566729426384,-0.045340076088905334,-0.013724571093916893,-0.030805163085460663,0.03833003714680672,0.0383022166788578,0.027214277535676956,0.014629460871219635,-0.005474706646054983,0.033270761370658875,-0.04376671835780144,-0.0342438705265522,-0.03842443600296974,0.013589507900178432,0.0019206427969038486,-0.02892809361219406,-0.016378358006477356,0.03514022380113602,-0.02891046553850174,-0.004399009048938751,-0.009166326373815536,0.013146786950528622,0.01620510220527649,0.0037794511299580336,-0.003954960498958826,0.00047249096678569913,0.019644174724817276,-0.038519542664289474,0.05109727755188942,0.031700991094112396,-0.024457532912492752,-0.029573475942015648,0.003083703340962529,-0.00027623542700894177,0.017811138182878494,-0.03885836526751518,0.007142579648643732,-0.03009927086532116,0.012044926173985004,-0.010845751501619816,-0.014973572455346584,0.06259866803884506,-0.06064985692501068,0.00941681768745184,0.03167937323451042,0.011134599335491657,-0.030385741963982582,0.050423622131347656,-0.014277011156082153,-0.007544705644249916,0.0026759265456348658,-0.016683703288435936,0.028617074713110924,-0.0004494866298045963,-0.0439358651638031,-0.0140353012830019,-0.029720226302742958,-0.020524200052022934,-0.0028307330794632435,0.059843141585588455,0.01993906870484352,0.011462978087365627,0.02538713999092579,-0.0197096299380064,-0.021100517362356186,-0.0070686680264770985,-0.10374077409505844,-0.0028909018728882074,0.006555804517120123,0.060101673007011414,-0.029502103105187416,0.040628477931022644,-0.03302614390850067,-0.009428367018699646,0.020529305562376976,0.005492448341101408,0.022468190640211105,-0.053576234728097916,0.03263087943196297,-0.02717740088701248,-0.020928846672177315,-0.00016109671560116112,0.018458660691976547,0.018288999795913696,0.006887135095894337,-0.02133330889046192,-0.0018926572520285845,0.02301342785358429,0.002380231861025095,0.04299439117312431,0.024160420522093773,-0.09817785024642944,-0.006848194170743227,-0.019703373312950134,0.031226495280861855,-0.01779855787754059,0.00482881860807538,-0.016886243596673012,0.022450430318713188,-0.0032472361344844103,0.0232460405677557,0.021253429353237152,0.025309130549430847,-0.030019816011190414,-0.0622519925236702,-0.010545436292886734,-0.030969304963946342,0.0014075073413550854,0.009631837718188763,0.06748854368925095,-0.01835557445883751,0.031845785677433014,-0.007600707933306694,-0.0023948876187205315,0.0012774589704349637,0.010583115741610527,-0.0018234031740576029,0.05683021992444992,0.0352463498711586,0.07005159556865692,0.019735144451260567,0.05290019139647484,0.10907473415136337,0.00309136719442904,0.06865525245666504,0.0039831846952438354,-0.06370721012353897,-0.020830580964684486,0.015642572194337845,-0.01936396025121212,-0.03313203155994415,-0.09309206157922745,-0.004527296405285597,-0.0023442176170647144,0.01386759802699089,0.023792123422026634,0.04411698132753372,0.07094146311283112,-0.011506715789437294,0.019326046109199524,0.038825519382953644,-0.08366569876670837,0.036585479974746704,-0.01244395412504673,0.11798790842294693,-0.051175035536289215,-0.056127820163965225,-0.012299969792366028,-0.03045492246747017,0.009555859491229057,-0.002397388918325305,0.061820853501558304,0.012900998815894127,0.026168212294578552,0.02772068791091442,-0.006862184498459101,-0.001645849086344242,-0.024020453914999962,-0.026769690215587616,-0.019225051626563072,0.022455617785453796,-0.10606689006090164,0.004226747900247574,0.002795411041006446,-0.0015383909922093153,-0.001749628223478794,-0.02200440503656864,-0.01566213183104992,0.035159457474946976,0.03038550354540348,0.004802923649549484,0.02654152736067772,-0.026171784847974777,-0.07804790884256363,-0.0693332627415657,-0.016664007678627968,-0.023059355095028877,0.0018043980235233903,-0.015685472637414932,-0.015907032415270805,0.02240419201552868,-0.023447725921869278,0.04812105372548103,0.01896573416888714,0.024198036640882492,-0.049298785626888275,-0.05235517397522926,-0.0007723260205239058,0.013447956182062626,-0.0018367943121120334,0.045604314655065536,0.054168567061424255,-0.003469842951744795,0.0293600894510746,0.02457498386502266,-0.021271225064992905,0.013339808210730553,0.001574650057591498,-0.006057234946638346,0.0531107634305954,-0.008730035275220871,-0.02868957258760929,0.02240096963942051,-0.03060852736234665,0.09312265366315842,0.008138063363730907,-0.01768038235604763,-0.009021492674946785,-0.004831369966268539,-0.029023021459579468,0.006904481910169125,-0.004776314832270145,0.015195239335298538,-0.04386147856712341,-0.012249520979821682,0.0004684418090619147,-0.09915177524089813,-0.03776368126273155,0.040124934166669846,0.022529060021042824,0.013057831674814224,-0.0062924157828092575,0.04623027145862579,0.02246960997581482,-0.000957493030000478,-0.048362791538238525,-0.025575874373316765,-0.024713857099413872,-0.04328371211886406,0.017319323495030403,0.01585419289767742,0.11477900296449661,0.0014852305175736547,-0.0841699093580246,0.0823049247264862,0.05802973359823227,0.03592991456389427,-0.010527162812650204,-0.006183631252497435,-0.021992452442646027,-0.050362855195999146,-0.03682965040206909,-0.026973191648721695,0.03175666928291321,-0.07444067299365997,-0.02105668932199478,0.007725847885012627,-0.028306804597377777,0.06815940886735916,0.02653130702674389,0.010580450296401978,-0.008708673529326916,-0.016232185065746307,0.03500238060951233,0.022457590326666832,-0.040682103484869,-0.004761204123497009,-0.007900195196270943,0.019952377304434776,0.004902414046227932,-0.029289446771144867,0.026905931532382965,0.05350595340132713,0.0011441536480560899,-0.0021924299653619528,0.023216262459754944,-0.005137315951287746,0.08858217298984528,-0.02994389459490776,0.03246442973613739,0.01356502529233694,-0.07135237008333206,-0.05681844428181648,-0.07268461585044861,0.02927154116332531,-0.008972518146038055,-0.013635392300784588,0.05361226201057434,0.006909654475748539,0.008052616380155087,-0.010383284650743008,-0.006357401143759489,0.04956532642245293,-0.019687969237565994,0.01474972814321518,0.012088625691831112,0.04149528965353966,0.08254990726709366,-0.013497481122612953,0.02127673104405403,-0.02829931117594242,-0.025512199848890305,0.02603187784552574,-0.026376822963356972,-0.06411226838827133,-0.06413496285676956,-0.007477529812604189,-0.0029833379667252302,-0.010735801421105862,0.09208994358778,0.0023780621122568846,-0.004641483537852764,-0.031934790313243866,0.0009025529725477099,-0.05133761093020439,0.02755194529891014,-0.018482541665434837,0.021776195615530014,0.00563554372638464,0.05859220400452614,0.010465828701853752,0.01233925111591816,-0.07528869062662125,0.0021631871350109577,0.008595388382673264,-0.01355854794383049,0.04197288677096367,-0.014078883454203606,0.050177816301584244,-0.019506145268678665,0.04482966288924217,0.03927745297551155,-0.06503255665302277,-0.07430975139141083,-0.003271449124440551,-0.07428886741399765,0.04363255575299263,0.04835008084774017,-0.00846869871020317,-0.01954318955540657,-0.016133254393935204,-0.013512199744582176,0.039171040058135986,-0.02829188108444214,-0.06375434994697571,0.02428670972585678,-0.038598861545324326,0.06528125703334808,0.015476333908736706,-0.013416494242846966,-0.0306388009339571,-0.07158273458480835,-0.029270518571138382,-0.014190570451319218,-0.0346086286008358,0.03519352152943611,0.025429774075746536,-0.07277072221040726,0.00879364088177681,0.00530016515403986,-0.10976552963256836,0.024220697581768036,-0.06910283118486404,-0.018472973257303238,-0.034222979098558426,0.020043667405843735,-0.020109012722969055,-0.034919414669275284,0.0016012380365282297,0.050106730312108994,0.04215064272284508,0.006137324962764978,-0.01090382132679224,0.08986710757017136,0.05808493494987488,-0.02390582300722599,0.038635797798633575,-0.0010493810987100005,-0.09301090985536575,-0.007372406776994467,0.040223486721515656,-0.03391877934336662,0.0016067149117588997,0.001262039877474308,-0.008794940076768398,0.015070322901010513,-0.018546948209404945,-0.04516115039587021,0.12865985929965973,0.017523469403386116,0.11837999522686005,-0.043185316026210785,-0.060311462730169296,-0.012187403626739979,-0.04522792622447014,-0.01595166325569153,-0.005606067832559347,-0.014130458235740662,-0.03209332376718521,-0.014329100027680397,0.05175851657986641,0.029839618131518364,-0.02346082031726837,0.014594579115509987,-0.007444688118994236,0.009958538226783276,0.021157117560505867,0.001861828495748341,-0.05410737544298172,0.04225333034992218,-0.03010857291519642,-0.05954201519489288,0.03663215786218643,-0.02496185153722763,0.022003211081027985,-0.004459994845092297,-0.010914884507656097,0.002416882198303938,0.015206986106932163,0.0050597768276929855,-0.053847454488277435,0.03979376703500748,-0.02232804149389267,-0.0002439861127641052,0.07476955652236938,-0.024766460061073303,-0.006184555124491453,0.01971837319433689,0.006012341473251581,-0.0195027906447649,0.01423839945346117,-0.010668449103832245,0.006012012716382742,0.017658235505223274,-0.004063407424837351,-0.047487977892160416,0.008448835462331772,0.03895183652639389,-0.028257913887500763,-0.010807204991579056,0.01643848419189453,-0.022649550810456276,0.0018018773989751935,0.008154760114848614,0.031146256253123283,0.05168936029076576,-0.031224001199007034,-0.07833347469568253,-0.05016611889004707,-0.062325842678546906,-7.846776705360047e-33,-0.001251433975994587,-0.05035439506173134,0.008848334662616253,-0.04045828431844711,0.015915872529149055,-0.03640056401491165,0.016732841730117798,-0.0005561335710808635,-0.01835528202354908,-0.023608487099409103,-0.025543535128235817,0.012412362731993198,0.034090980887413025,-0.0024882853031158447,0.05319526791572571,0.025891121476888657,0.024791913107037544,-0.015713686123490334,-0.025562278926372528,0.026088356971740723,-0.031826235353946686,0.03077397122979164,0.04901513829827309,0.03582979738712311,-0.022101406008005142,-0.03611215204000473,-0.015921935439109802,0.04353950172662735,0.005510410759598017,-0.006847981829196215,-0.003274890361353755,-0.04585137590765953,0.01935242861509323,0.008490367792546749,0.024499373510479927,-0.043863847851753235,0.00048408517614006996,-0.0021158650051802397,-0.008717474527657032,-0.008852966129779816,0.09181096404790878,-0.005916686728596687,0.02328251674771309,0.003828139742836356,-0.003955591470003128,-0.004521950613707304,0.014227289706468582,-0.03395543247461319,-0.04160109907388687,-0.007363559678196907,0.02374081127345562,-0.006922800559550524,0.006359803956001997,0.028624078258872032,0.01945420913398266,0.04733971133828163,0.02509325183928013,0.027909619733691216,-0.07155457884073257,0.0011215643025934696,0.03986360877752304,0.006298494525253773,0.014750038273632526,-0.004760836251080036,0.025295935571193695,-0.010297889821231365,-0.008483237586915493,0.004419825039803982,-0.009579307399690151,0.0005262750783003867,-0.031046977266669273,0.09749502688646317,-0.02030189149081707,0.013587125577032566,0.009369037114083767,0.05517937242984772,-0.019809702411293983,0.029636578634381294,-0.0010698373662307858,0.013690358959138393,0.03252967819571495,-0.005901329685002565,-0.023755645379424095,0.00817713513970375,0.031210964545607567,-0.03124893084168434,-0.005779221188277006,0.03001377545297146,0.04001246392726898,-0.0032722295727580786,-0.027358708903193474,0.047884006053209305,-0.028061695396900177,0.014587515033781528,-0.08637696504592896,0.010110871866345406,0.050560545176267624,0.02363443188369274,0.0028884285129606724,-0.021155934780836105,-0.030185163021087646,0.048292532563209534,0.046886712312698364,-0.03172697126865387,-0.03326962888240814,0.01797367073595524,0.04764754697680473,-0.016172464936971664,-0.05431414768099785,0.026404565200209618,0.02196703851222992,0.045850157737731934,0.0009577288874424994,0.0017378805205225945,0.007062835153192282,-0.01604946330189705,0.01883843168616295,-0.04531808942556381,0.021803556010127068,-0.029794780537486076,0.029429910704493523,0.040973491966724396,-0.03665923699736595,0.002876357873901725,0.01950008049607277,-0.007299008779227734,0.05026565119624138,-0.03880469128489494,0.058531444519758224,0.015888826921582222,-0.0014852940803393722,0.04799579456448555,3.3915421226993203e-7,0.010289759375154972,-0.009635514579713345,-0.01819196157157421,0.01017501950263977,0.017697805538773537,0.027817895635962486,-0.0021122803445905447,0.02817891351878643,-0.027050938457250595,-0.08680377155542374,0.018522437661886215,-0.05048833042383194,0.0697254166007042,0.03452630713582039,-0.0017459607915952802,-0.06276258826255798,-0.023503243923187256,-0.05549364909529686,-0.06643068045377731,-0.03437068313360214,-0.016238272190093994,0.007048846688121557,0.045209720730781555,-0.0006967806839384139,0.02880881540477276,-0.009225362911820412,-0.0031197278294712305,-0.06583686918020248,-0.00008588900527684018,0.0272828321903944,0.024293921887874603,-0.09301836788654327,-0.01412006001919508,0.0029247859492897987,0.00985660683363676,0.024294471368193626,-0.03580554202198982,-0.022425005212426186,0.030708380043506622,0.03274122625589371,-0.05628751218318939,-0.0907081812620163,-0.006872470956295729,-0.003352453699335456,-0.007045903243124485,-0.018189823254942894,-0.008636179380118847,0.049743328243494034,-0.03263426944613457,0.002227451652288437,-0.00037116280873306096,0.014453192241489887,0.01768665388226509,-0.02112741395831108,0.037888020277023315,0.024342313408851624,0.03916388750076294,0.018620839342474937,0.06410270184278488,0.017891308292746544,-0.03617290407419205,-0.0002772511215880513,0.0023982184939086437,-0.04615803062915802,0.05224187299609184,-0.030288096517324448,-0.009159142151474953,3.530276776813149e-34,0.02352234721183777,-0.027783771976828575,0.022397473454475403,0.0672004371881485,0.0352511964738369,-0.012055733241140842,-0.01258031651377678,-0.022615844383835793,0.02163536846637726,-0.05847138166427612,-0.02202402614057064]';
  p_EmbeddingModelID_05e309419f18 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_05e309419f18 := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_05e309419f18 := FALSE;
  p_IsMaterialized_05e309419f18 := FALSE;
  p_ID_05e309419f18 := '5A1E5000-0001-4000-A000-00000000000D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_05e309419f18,
    'CategoryID', p_CategoryID_05e309419f18,
    'UserQuestion', p_UserQuestion_05e309419f18,
    'Description', p_Description_05e309419f18,
    'SQL', p_SQL_05e309419f18,
    'TechnicalDescription', p_TechnicalDescription_05e309419f18,
    'OriginalSQL', p_OriginalSQL_05e309419f18,
    'Feedback', p_Feedback_05e309419f18,
    'Status', p_Status_05e309419f18,
    'QualityRank', p_QualityRank_05e309419f18,
    'ExecutionCostRank', p_ExecutionCostRank_05e309419f18,
    'UsesTemplate', p_UsesTemplate_05e309419f18,
    'AuditQueryRuns', p_AuditQueryRuns_05e309419f18,
    'CacheEnabled', p_CacheEnabled_05e309419f18,
    'CacheTTLMinutes', p_CacheTTLMinutes_05e309419f18,
    'CacheMaxSize', p_CacheMaxSize_05e309419f18,
    'EmbeddingVector', p_EmbeddingVector_05e309419f18,
    'EmbeddingModelID', p_EmbeddingModelID_05e309419f18,
    'CacheValidationSQL', p_CacheValidationSQL_05e309419f18,
    'SQLDialectID', p_SQLDialectID_05e309419f18,
    'Reusable', p_Reusable_05e309419f18,
    'ExternalDataSourceID', p_ExternalDataSourceID_05e309419f18,
    'IsMaterialized', p_IsMaterialized_05e309419f18,
    'ID', p_ID_05e309419f18
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_05e309419f18, p_CategoryID := p_CategoryID_05e309419f18, p_UserQuestion := p_UserQuestion_05e309419f18, p_Description := p_Description_05e309419f18, p_SQL := p_SQL_05e309419f18, p_TechnicalDescription := p_TechnicalDescription_05e309419f18, p_OriginalSQL := p_OriginalSQL_05e309419f18, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_05e309419f18, p_Feedback_Clear := TRUE, p_Status := p_Status_05e309419f18, p_QualityRank := p_QualityRank_05e309419f18, p_ExecutionCostRank := p_ExecutionCostRank_05e309419f18, p_UsesTemplate := p_UsesTemplate_05e309419f18, p_AuditQueryRuns := p_AuditQueryRuns_05e309419f18, p_CacheEnabled := p_CacheEnabled_05e309419f18, p_CacheTTLMinutes := p_CacheTTLMinutes_05e309419f18, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_05e309419f18, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_05e309419f18, p_EmbeddingModelID := p_EmbeddingModelID_05e309419f18, p_CacheValidationSQL := p_CacheValidationSQL_05e309419f18, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_05e309419f18, p_Reusable := p_Reusable_05e309419f18, p_ExternalDataSourceID := p_ExternalDataSourceID_05e309419f18, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_05e309419f18, p_ID := p_ID_05e309419f18);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_97e3714175a9 UUID;
  p_QueryID_97e3714175a9 UUID;
  p_Name_97e3714175a9 VARCHAR(255);
  p_Description_97e3714175a9 TEXT;
  p_Sequence_97e3714175a9 INTEGER;
  p_SQLBaseType_97e3714175a9 VARCHAR(50);
  p_SQLFullType_97e3714175a9 VARCHAR(100);
  p_SourceEntityID_97e3714175a9 UUID;
  p_SourceFieldName_97e3714175a9 VARCHAR(255);
  p_IsComputed_97e3714175a9 BOOLEAN;
  p_ComputationDescription_97e3714175a9 TEXT;
  p_IsSummary_97e3714175a9 BOOLEAN;
  p_SummaryDescription_97e3714175a9 TEXT;
  p_DetectionMethod_97e3714175a9 VARCHAR(50);
  p_AutoDetectConfidenceScore_97e3714175a9 NUMERIC(3,2);
BEGIN
  p_ID_97e3714175a9 := '91b78998-549a-4da9-ab82-3a3b3765fffd';
  p_QueryID_97e3714175a9 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_97e3714175a9 := 'PipelineIncludeInForecast';
  p_Description_97e3714175a9 := 'IncludeInForecast (aliased as PipelineIncludeInForecast)';
  p_Sequence_97e3714175a9 := 1;
  p_SQLBaseType_97e3714175a9 := 'bit';
  p_SQLFullType_97e3714175a9 := 'bit';
  p_SourceEntityID_97e3714175a9 := 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';
  p_SourceFieldName_97e3714175a9 := 'IncludeInForecast';
  p_IsComputed_97e3714175a9 := FALSE;
  p_IsSummary_97e3714175a9 := FALSE;
  p_DetectionMethod_97e3714175a9 := 'Manual';
  p_QueryID_97e3714175a9 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Deal Roster' ORDER BY CASE WHEN "ID" = p_QueryID_97e3714175a9 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_97e3714175a9);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_97e3714175a9
                  OR ("QueryID" = p_QueryID_97e3714175a9 AND "Name" = p_Name_97e3714175a9)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_97e3714175a9,
      'QueryID', p_QueryID_97e3714175a9,
      'Name', p_Name_97e3714175a9,
      'Description', p_Description_97e3714175a9,
      'Sequence', p_Sequence_97e3714175a9,
      'SQLBaseType', p_SQLBaseType_97e3714175a9,
      'SQLFullType', p_SQLFullType_97e3714175a9,
      'SourceEntityID', p_SourceEntityID_97e3714175a9,
      'SourceFieldName', p_SourceFieldName_97e3714175a9,
      'IsComputed', p_IsComputed_97e3714175a9,
      'ComputationDescription', p_ComputationDescription_97e3714175a9,
      'IsSummary', p_IsSummary_97e3714175a9,
      'SummaryDescription', p_SummaryDescription_97e3714175a9,
      'DetectionMethod', p_DetectionMethod_97e3714175a9,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_97e3714175a9
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_97e3714175a9, p_QueryID := p_QueryID_97e3714175a9, p_Name := p_Name_97e3714175a9, p_Description := p_Description_97e3714175a9, p_Sequence := p_Sequence_97e3714175a9, p_SQLBaseType := p_SQLBaseType_97e3714175a9, p_SQLFullType := p_SQLFullType_97e3714175a9, p_SourceEntityID := p_SourceEntityID_97e3714175a9, p_SourceFieldName := p_SourceFieldName_97e3714175a9, p_IsComputed := p_IsComputed_97e3714175a9, p_ComputationDescription := p_ComputationDescription_97e3714175a9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_97e3714175a9, p_SummaryDescription := p_SummaryDescription_97e3714175a9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_97e3714175a9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_97e3714175a9, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_636f7c8c03f5 UUID;
  p_Name_636f7c8c03f5 VARCHAR(255);
  p_Description_636f7c8c03f5 TEXT;
  p_Sequence_636f7c8c03f5 INTEGER;
  p_SQLBaseType_636f7c8c03f5 VARCHAR(50);
  p_SQLFullType_636f7c8c03f5 VARCHAR(100);
  p_SourceEntityID_636f7c8c03f5 UUID;
  p_SourceFieldName_636f7c8c03f5 VARCHAR(255);
  p_IsComputed_636f7c8c03f5 BOOLEAN;
  p_ComputationDescription_636f7c8c03f5 TEXT;
  p_IsSummary_636f7c8c03f5 BOOLEAN;
  p_SummaryDescription_636f7c8c03f5 TEXT;
  p_DetectionMethod_636f7c8c03f5 VARCHAR(50);
  p_AutoDetectConfidenceScore_636f7c8c03f5 NUMERIC(3,2);
  p_ID_636f7c8c03f5 UUID;
BEGIN
  p_QueryID_636f7c8c03f5 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_636f7c8c03f5 := 'AmountComputedAt';
  p_Description_636f7c8c03f5 := 'AmountComputedAt';
  p_Sequence_636f7c8c03f5 := 31;
  p_SQLBaseType_636f7c8c03f5 := 'datetimeoffset';
  p_SQLFullType_636f7c8c03f5 := 'datetimeoffset';
  p_SourceEntityID_636f7c8c03f5 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_636f7c8c03f5 := 'AmountComputedAt';
  p_IsComputed_636f7c8c03f5 := FALSE;
  p_IsSummary_636f7c8c03f5 := FALSE;
  p_DetectionMethod_636f7c8c03f5 := 'Manual';
  p_ID_636f7c8c03f5 := '119B6DBC-9F41-4104-9827-12BFA3CF7068';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_636f7c8c03f5,
    'Name', p_Name_636f7c8c03f5,
    'Description', p_Description_636f7c8c03f5,
    'Sequence', p_Sequence_636f7c8c03f5,
    'SQLBaseType', p_SQLBaseType_636f7c8c03f5,
    'SQLFullType', p_SQLFullType_636f7c8c03f5,
    'SourceEntityID', p_SourceEntityID_636f7c8c03f5,
    'SourceFieldName', p_SourceFieldName_636f7c8c03f5,
    'IsComputed', p_IsComputed_636f7c8c03f5,
    'ComputationDescription', p_ComputationDescription_636f7c8c03f5,
    'IsSummary', p_IsSummary_636f7c8c03f5,
    'SummaryDescription', p_SummaryDescription_636f7c8c03f5,
    'DetectionMethod', p_DetectionMethod_636f7c8c03f5,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_636f7c8c03f5,
    'ID', p_ID_636f7c8c03f5
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_636f7c8c03f5, p_Name := p_Name_636f7c8c03f5, p_Description := p_Description_636f7c8c03f5, p_Sequence := p_Sequence_636f7c8c03f5, p_SQLBaseType := p_SQLBaseType_636f7c8c03f5, p_SQLFullType := p_SQLFullType_636f7c8c03f5, p_SourceEntityID := p_SourceEntityID_636f7c8c03f5, p_SourceFieldName := p_SourceFieldName_636f7c8c03f5, p_IsComputed := p_IsComputed_636f7c8c03f5, p_ComputationDescription := p_ComputationDescription_636f7c8c03f5, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_636f7c8c03f5, p_SummaryDescription := p_SummaryDescription_636f7c8c03f5, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_636f7c8c03f5, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_636f7c8c03f5, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_636f7c8c03f5);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_c69a95133f37 UUID;
  p_Name_c69a95133f37 VARCHAR(255);
  p_Description_c69a95133f37 TEXT;
  p_Sequence_c69a95133f37 INTEGER;
  p_SQLBaseType_c69a95133f37 VARCHAR(50);
  p_SQLFullType_c69a95133f37 VARCHAR(100);
  p_SourceEntityID_c69a95133f37 UUID;
  p_SourceFieldName_c69a95133f37 VARCHAR(255);
  p_IsComputed_c69a95133f37 BOOLEAN;
  p_ComputationDescription_c69a95133f37 TEXT;
  p_IsSummary_c69a95133f37 BOOLEAN;
  p_SummaryDescription_c69a95133f37 TEXT;
  p_DetectionMethod_c69a95133f37 VARCHAR(50);
  p_AutoDetectConfidenceScore_c69a95133f37 NUMERIC(3,2);
  p_ID_c69a95133f37 UUID;
BEGIN
  p_QueryID_c69a95133f37 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_c69a95133f37 := 'Amount';
  p_Description_c69a95133f37 := 'Amount';
  p_Sequence_c69a95133f37 := 28;
  p_SQLBaseType_c69a95133f37 := 'decimal';
  p_SQLFullType_c69a95133f37 := 'decimal(19, 4)';
  p_SourceEntityID_c69a95133f37 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_c69a95133f37 := 'Amount';
  p_IsComputed_c69a95133f37 := FALSE;
  p_IsSummary_c69a95133f37 := FALSE;
  p_DetectionMethod_c69a95133f37 := 'Manual';
  p_ID_c69a95133f37 := 'F031DCA0-5FC8-4C81-8D94-14A2C8A31D1F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_c69a95133f37,
    'Name', p_Name_c69a95133f37,
    'Description', p_Description_c69a95133f37,
    'Sequence', p_Sequence_c69a95133f37,
    'SQLBaseType', p_SQLBaseType_c69a95133f37,
    'SQLFullType', p_SQLFullType_c69a95133f37,
    'SourceEntityID', p_SourceEntityID_c69a95133f37,
    'SourceFieldName', p_SourceFieldName_c69a95133f37,
    'IsComputed', p_IsComputed_c69a95133f37,
    'ComputationDescription', p_ComputationDescription_c69a95133f37,
    'IsSummary', p_IsSummary_c69a95133f37,
    'SummaryDescription', p_SummaryDescription_c69a95133f37,
    'DetectionMethod', p_DetectionMethod_c69a95133f37,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_c69a95133f37,
    'ID', p_ID_c69a95133f37
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_c69a95133f37, p_Name := p_Name_c69a95133f37, p_Description := p_Description_c69a95133f37, p_Sequence := p_Sequence_c69a95133f37, p_SQLBaseType := p_SQLBaseType_c69a95133f37, p_SQLFullType := p_SQLFullType_c69a95133f37, p_SourceEntityID := p_SourceEntityID_c69a95133f37, p_SourceFieldName := p_SourceFieldName_c69a95133f37, p_IsComputed := p_IsComputed_c69a95133f37, p_ComputationDescription := p_ComputationDescription_c69a95133f37, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_c69a95133f37, p_SummaryDescription := p_SummaryDescription_c69a95133f37, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_c69a95133f37, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_c69a95133f37, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_c69a95133f37);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_0c78029c65de UUID;
  p_Name_0c78029c65de VARCHAR(255);
  p_Description_0c78029c65de TEXT;
  p_Sequence_0c78029c65de INTEGER;
  p_SQLBaseType_0c78029c65de VARCHAR(50);
  p_SQLFullType_0c78029c65de VARCHAR(100);
  p_SourceEntityID_0c78029c65de UUID;
  p_SourceFieldName_0c78029c65de VARCHAR(255);
  p_IsComputed_0c78029c65de BOOLEAN;
  p_ComputationDescription_0c78029c65de TEXT;
  p_IsSummary_0c78029c65de BOOLEAN;
  p_SummaryDescription_0c78029c65de TEXT;
  p_DetectionMethod_0c78029c65de VARCHAR(50);
  p_AutoDetectConfidenceScore_0c78029c65de NUMERIC(3,2);
  p_ID_0c78029c65de UUID;
BEGIN
  p_QueryID_0c78029c65de := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_0c78029c65de := 'DealTypeID';
  p_Description_0c78029c65de := 'DealTypeID';
  p_Sequence_0c78029c65de := 14;
  p_SQLBaseType_0c78029c65de := 'uniqueidentifier';
  p_SQLFullType_0c78029c65de := 'uniqueidentifier';
  p_SourceEntityID_0c78029c65de := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_0c78029c65de := 'DealTypeID';
  p_IsComputed_0c78029c65de := FALSE;
  p_IsSummary_0c78029c65de := FALSE;
  p_DetectionMethod_0c78029c65de := 'Manual';
  p_ID_0c78029c65de := '8C374923-B4A5-4877-8366-1C5B85A6CF2C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_0c78029c65de,
    'Name', p_Name_0c78029c65de,
    'Description', p_Description_0c78029c65de,
    'Sequence', p_Sequence_0c78029c65de,
    'SQLBaseType', p_SQLBaseType_0c78029c65de,
    'SQLFullType', p_SQLFullType_0c78029c65de,
    'SourceEntityID', p_SourceEntityID_0c78029c65de,
    'SourceFieldName', p_SourceFieldName_0c78029c65de,
    'IsComputed', p_IsComputed_0c78029c65de,
    'ComputationDescription', p_ComputationDescription_0c78029c65de,
    'IsSummary', p_IsSummary_0c78029c65de,
    'SummaryDescription', p_SummaryDescription_0c78029c65de,
    'DetectionMethod', p_DetectionMethod_0c78029c65de,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_0c78029c65de,
    'ID', p_ID_0c78029c65de
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_0c78029c65de, p_Name := p_Name_0c78029c65de, p_Description := p_Description_0c78029c65de, p_Sequence := p_Sequence_0c78029c65de, p_SQLBaseType := p_SQLBaseType_0c78029c65de, p_SQLFullType := p_SQLFullType_0c78029c65de, p_SourceEntityID := p_SourceEntityID_0c78029c65de, p_SourceFieldName := p_SourceFieldName_0c78029c65de, p_IsComputed := p_IsComputed_0c78029c65de, p_ComputationDescription := p_ComputationDescription_0c78029c65de, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_0c78029c65de, p_SummaryDescription := p_SummaryDescription_0c78029c65de, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_0c78029c65de, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_0c78029c65de, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_0c78029c65de);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_b4ff3eb961bb UUID;
  p_Name_b4ff3eb961bb VARCHAR(255);
  p_Description_b4ff3eb961bb TEXT;
  p_Sequence_b4ff3eb961bb INTEGER;
  p_SQLBaseType_b4ff3eb961bb VARCHAR(50);
  p_SQLFullType_b4ff3eb961bb VARCHAR(100);
  p_SourceEntityID_b4ff3eb961bb UUID;
  p_SourceFieldName_b4ff3eb961bb VARCHAR(255);
  p_IsComputed_b4ff3eb961bb BOOLEAN;
  p_ComputationDescription_b4ff3eb961bb TEXT;
  p_IsSummary_b4ff3eb961bb BOOLEAN;
  p_SummaryDescription_b4ff3eb961bb TEXT;
  p_DetectionMethod_b4ff3eb961bb VARCHAR(50);
  p_AutoDetectConfidenceScore_b4ff3eb961bb NUMERIC(3,2);
  p_ID_b4ff3eb961bb UUID;
BEGIN
  p_QueryID_b4ff3eb961bb := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_b4ff3eb961bb := 'Probability';
  p_Description_b4ff3eb961bb := 'Probability';
  p_Sequence_b4ff3eb961bb := 32;
  p_SQLBaseType_b4ff3eb961bb := 'decimal';
  p_SQLFullType_b4ff3eb961bb := 'decimal(5, 2)';
  p_SourceEntityID_b4ff3eb961bb := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_b4ff3eb961bb := 'Probability';
  p_IsComputed_b4ff3eb961bb := FALSE;
  p_IsSummary_b4ff3eb961bb := FALSE;
  p_DetectionMethod_b4ff3eb961bb := 'Manual';
  p_ID_b4ff3eb961bb := 'A8DC7262-DD28-4EAA-AF5F-32FBC0AFC2B0';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_b4ff3eb961bb,
    'Name', p_Name_b4ff3eb961bb,
    'Description', p_Description_b4ff3eb961bb,
    'Sequence', p_Sequence_b4ff3eb961bb,
    'SQLBaseType', p_SQLBaseType_b4ff3eb961bb,
    'SQLFullType', p_SQLFullType_b4ff3eb961bb,
    'SourceEntityID', p_SourceEntityID_b4ff3eb961bb,
    'SourceFieldName', p_SourceFieldName_b4ff3eb961bb,
    'IsComputed', p_IsComputed_b4ff3eb961bb,
    'ComputationDescription', p_ComputationDescription_b4ff3eb961bb,
    'IsSummary', p_IsSummary_b4ff3eb961bb,
    'SummaryDescription', p_SummaryDescription_b4ff3eb961bb,
    'DetectionMethod', p_DetectionMethod_b4ff3eb961bb,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b4ff3eb961bb,
    'ID', p_ID_b4ff3eb961bb
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_b4ff3eb961bb, p_Name := p_Name_b4ff3eb961bb, p_Description := p_Description_b4ff3eb961bb, p_Sequence := p_Sequence_b4ff3eb961bb, p_SQLBaseType := p_SQLBaseType_b4ff3eb961bb, p_SQLFullType := p_SQLFullType_b4ff3eb961bb, p_SourceEntityID := p_SourceEntityID_b4ff3eb961bb, p_SourceFieldName := p_SourceFieldName_b4ff3eb961bb, p_IsComputed := p_IsComputed_b4ff3eb961bb, p_ComputationDescription := p_ComputationDescription_b4ff3eb961bb, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b4ff3eb961bb, p_SummaryDescription := p_SummaryDescription_b4ff3eb961bb, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b4ff3eb961bb, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b4ff3eb961bb, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_b4ff3eb961bb);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_36965a79c8df UUID;
  p_Name_36965a79c8df VARCHAR(255);
  p_Description_36965a79c8df TEXT;
  p_Sequence_36965a79c8df INTEGER;
  p_SQLBaseType_36965a79c8df VARCHAR(50);
  p_SQLFullType_36965a79c8df VARCHAR(100);
  p_SourceEntityID_36965a79c8df UUID;
  p_SourceFieldName_36965a79c8df VARCHAR(255);
  p_IsComputed_36965a79c8df BOOLEAN;
  p_ComputationDescription_36965a79c8df TEXT;
  p_IsSummary_36965a79c8df BOOLEAN;
  p_SummaryDescription_36965a79c8df TEXT;
  p_DetectionMethod_36965a79c8df VARCHAR(50);
  p_AutoDetectConfidenceScore_36965a79c8df NUMERIC(3,2);
  p_ID_36965a79c8df UUID;
BEGIN
  p_QueryID_36965a79c8df := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_36965a79c8df := 'StageOrder';
  p_Description_36965a79c8df := 'DisplayOrder (aliased as StageOrder)';
  p_Sequence_36965a79c8df := 13;
  p_SQLBaseType_36965a79c8df := 'int';
  p_SQLFullType_36965a79c8df := 'int';
  p_SourceEntityID_36965a79c8df := 'D9B2404D-CA19-4339-8E87-CE62B1C30647';
  p_SourceFieldName_36965a79c8df := 'DisplayOrder';
  p_IsComputed_36965a79c8df := FALSE;
  p_IsSummary_36965a79c8df := FALSE;
  p_DetectionMethod_36965a79c8df := 'Manual';
  p_ID_36965a79c8df := '668C97C8-526A-4B96-9527-3393417B43C4';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_36965a79c8df,
    'Name', p_Name_36965a79c8df,
    'Description', p_Description_36965a79c8df,
    'Sequence', p_Sequence_36965a79c8df,
    'SQLBaseType', p_SQLBaseType_36965a79c8df,
    'SQLFullType', p_SQLFullType_36965a79c8df,
    'SourceEntityID', p_SourceEntityID_36965a79c8df,
    'SourceFieldName', p_SourceFieldName_36965a79c8df,
    'IsComputed', p_IsComputed_36965a79c8df,
    'ComputationDescription', p_ComputationDescription_36965a79c8df,
    'IsSummary', p_IsSummary_36965a79c8df,
    'SummaryDescription', p_SummaryDescription_36965a79c8df,
    'DetectionMethod', p_DetectionMethod_36965a79c8df,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_36965a79c8df,
    'ID', p_ID_36965a79c8df
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_36965a79c8df, p_Name := p_Name_36965a79c8df, p_Description := p_Description_36965a79c8df, p_Sequence := p_Sequence_36965a79c8df, p_SQLBaseType := p_SQLBaseType_36965a79c8df, p_SQLFullType := p_SQLFullType_36965a79c8df, p_SourceEntityID := p_SourceEntityID_36965a79c8df, p_SourceFieldName := p_SourceFieldName_36965a79c8df, p_IsComputed := p_IsComputed_36965a79c8df, p_ComputationDescription := p_ComputationDescription_36965a79c8df, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_36965a79c8df, p_SummaryDescription := p_SummaryDescription_36965a79c8df, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_36965a79c8df, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_36965a79c8df, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_36965a79c8df);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_da85e8697ff6 UUID;
  p_Name_da85e8697ff6 VARCHAR(255);
  p_Description_da85e8697ff6 TEXT;
  p_Sequence_da85e8697ff6 INTEGER;
  p_SQLBaseType_da85e8697ff6 VARCHAR(50);
  p_SQLFullType_da85e8697ff6 VARCHAR(100);
  p_SourceEntityID_da85e8697ff6 UUID;
  p_SourceFieldName_da85e8697ff6 VARCHAR(255);
  p_IsComputed_da85e8697ff6 BOOLEAN;
  p_ComputationDescription_da85e8697ff6 TEXT;
  p_IsSummary_da85e8697ff6 BOOLEAN;
  p_SummaryDescription_da85e8697ff6 TEXT;
  p_DetectionMethod_da85e8697ff6 VARCHAR(50);
  p_AutoDetectConfidenceScore_da85e8697ff6 NUMERIC(3,2);
  p_ID_da85e8697ff6 UUID;
BEGIN
  p_QueryID_da85e8697ff6 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_da85e8697ff6 := 'OrderID';
  p_Description_da85e8697ff6 := 'OrderID';
  p_Sequence_da85e8697ff6 := 37;
  p_SQLBaseType_da85e8697ff6 := 'uniqueidentifier';
  p_SQLFullType_da85e8697ff6 := 'uniqueidentifier';
  p_SourceEntityID_da85e8697ff6 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_da85e8697ff6 := 'OrderID';
  p_IsComputed_da85e8697ff6 := FALSE;
  p_IsSummary_da85e8697ff6 := FALSE;
  p_DetectionMethod_da85e8697ff6 := 'Manual';
  p_ID_da85e8697ff6 := '16B5982A-23D6-43CB-B1E5-3455FD802B04';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_da85e8697ff6,
    'Name', p_Name_da85e8697ff6,
    'Description', p_Description_da85e8697ff6,
    'Sequence', p_Sequence_da85e8697ff6,
    'SQLBaseType', p_SQLBaseType_da85e8697ff6,
    'SQLFullType', p_SQLFullType_da85e8697ff6,
    'SourceEntityID', p_SourceEntityID_da85e8697ff6,
    'SourceFieldName', p_SourceFieldName_da85e8697ff6,
    'IsComputed', p_IsComputed_da85e8697ff6,
    'ComputationDescription', p_ComputationDescription_da85e8697ff6,
    'IsSummary', p_IsSummary_da85e8697ff6,
    'SummaryDescription', p_SummaryDescription_da85e8697ff6,
    'DetectionMethod', p_DetectionMethod_da85e8697ff6,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_da85e8697ff6,
    'ID', p_ID_da85e8697ff6
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_da85e8697ff6, p_Name := p_Name_da85e8697ff6, p_Description := p_Description_da85e8697ff6, p_Sequence := p_Sequence_da85e8697ff6, p_SQLBaseType := p_SQLBaseType_da85e8697ff6, p_SQLFullType := p_SQLFullType_da85e8697ff6, p_SourceEntityID := p_SourceEntityID_da85e8697ff6, p_SourceFieldName := p_SourceFieldName_da85e8697ff6, p_IsComputed := p_IsComputed_da85e8697ff6, p_ComputationDescription := p_ComputationDescription_da85e8697ff6, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_da85e8697ff6, p_SummaryDescription := p_SummaryDescription_da85e8697ff6, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_da85e8697ff6, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_da85e8697ff6, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_da85e8697ff6);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_c2697294ce0e UUID;
  p_Name_c2697294ce0e VARCHAR(255);
  p_Description_c2697294ce0e TEXT;
  p_Sequence_c2697294ce0e INTEGER;
  p_SQLBaseType_c2697294ce0e VARCHAR(50);
  p_SQLFullType_c2697294ce0e VARCHAR(100);
  p_SourceEntityID_c2697294ce0e UUID;
  p_SourceFieldName_c2697294ce0e VARCHAR(255);
  p_IsComputed_c2697294ce0e BOOLEAN;
  p_ComputationDescription_c2697294ce0e TEXT;
  p_IsSummary_c2697294ce0e BOOLEAN;
  p_SummaryDescription_c2697294ce0e TEXT;
  p_DetectionMethod_c2697294ce0e VARCHAR(50);
  p_AutoDetectConfidenceScore_c2697294ce0e NUMERIC(3,2);
  p_ID_c2697294ce0e UUID;
BEGIN
  p_QueryID_c2697294ce0e := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_c2697294ce0e := 'HasNoStatus';
  p_Description_c2697294ce0e := 'Computed column: HasNoStatus';
  p_Sequence_c2697294ce0e := 22;
  p_SQLBaseType_c2697294ce0e := 'nvarchar';
  p_SQLFullType_c2697294ce0e := 'nvarchar(MAX)';
  p_IsComputed_c2697294ce0e := TRUE;
  p_IsSummary_c2697294ce0e := FALSE;
  p_DetectionMethod_c2697294ce0e := 'Manual';
  p_ID_c2697294ce0e := 'C3C9392B-F08D-4CD8-A727-3483CF5CEBE4';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_c2697294ce0e,
    'Name', p_Name_c2697294ce0e,
    'Description', p_Description_c2697294ce0e,
    'Sequence', p_Sequence_c2697294ce0e,
    'SQLBaseType', p_SQLBaseType_c2697294ce0e,
    'SQLFullType', p_SQLFullType_c2697294ce0e,
    'SourceEntityID', p_SourceEntityID_c2697294ce0e,
    'SourceFieldName', p_SourceFieldName_c2697294ce0e,
    'IsComputed', p_IsComputed_c2697294ce0e,
    'ComputationDescription', p_ComputationDescription_c2697294ce0e,
    'IsSummary', p_IsSummary_c2697294ce0e,
    'SummaryDescription', p_SummaryDescription_c2697294ce0e,
    'DetectionMethod', p_DetectionMethod_c2697294ce0e,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_c2697294ce0e,
    'ID', p_ID_c2697294ce0e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_c2697294ce0e, p_Name := p_Name_c2697294ce0e, p_Description := p_Description_c2697294ce0e, p_Sequence := p_Sequence_c2697294ce0e, p_SQLBaseType := p_SQLBaseType_c2697294ce0e, p_SQLFullType := p_SQLFullType_c2697294ce0e, p_SourceEntityID := p_SourceEntityID_c2697294ce0e, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_c2697294ce0e, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_c2697294ce0e, p_ComputationDescription := p_ComputationDescription_c2697294ce0e, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_c2697294ce0e, p_SummaryDescription := p_SummaryDescription_c2697294ce0e, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_c2697294ce0e, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_c2697294ce0e, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_c2697294ce0e);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_49782e6e2b52 UUID;
  p_Name_49782e6e2b52 VARCHAR(255);
  p_Description_49782e6e2b52 TEXT;
  p_Sequence_49782e6e2b52 INTEGER;
  p_SQLBaseType_49782e6e2b52 VARCHAR(50);
  p_SQLFullType_49782e6e2b52 VARCHAR(100);
  p_SourceEntityID_49782e6e2b52 UUID;
  p_SourceFieldName_49782e6e2b52 VARCHAR(255);
  p_IsComputed_49782e6e2b52 BOOLEAN;
  p_ComputationDescription_49782e6e2b52 TEXT;
  p_IsSummary_49782e6e2b52 BOOLEAN;
  p_SummaryDescription_49782e6e2b52 TEXT;
  p_DetectionMethod_49782e6e2b52 VARCHAR(50);
  p_AutoDetectConfidenceScore_49782e6e2b52 NUMERIC(3,2);
  p_ID_49782e6e2b52 UUID;
BEGIN
  p_QueryID_49782e6e2b52 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_49782e6e2b52 := 'AmountIsComputed';
  p_Description_49782e6e2b52 := 'AmountIsComputed';
  p_Sequence_49782e6e2b52 := 30;
  p_SQLBaseType_49782e6e2b52 := 'bit';
  p_SQLFullType_49782e6e2b52 := 'bit';
  p_SourceEntityID_49782e6e2b52 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_49782e6e2b52 := 'AmountIsComputed';
  p_IsComputed_49782e6e2b52 := FALSE;
  p_IsSummary_49782e6e2b52 := FALSE;
  p_DetectionMethod_49782e6e2b52 := 'Manual';
  p_ID_49782e6e2b52 := '4F3C1A3F-AAF9-42A7-A0EC-475000FA31BD';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_49782e6e2b52,
    'Name', p_Name_49782e6e2b52,
    'Description', p_Description_49782e6e2b52,
    'Sequence', p_Sequence_49782e6e2b52,
    'SQLBaseType', p_SQLBaseType_49782e6e2b52,
    'SQLFullType', p_SQLFullType_49782e6e2b52,
    'SourceEntityID', p_SourceEntityID_49782e6e2b52,
    'SourceFieldName', p_SourceFieldName_49782e6e2b52,
    'IsComputed', p_IsComputed_49782e6e2b52,
    'ComputationDescription', p_ComputationDescription_49782e6e2b52,
    'IsSummary', p_IsSummary_49782e6e2b52,
    'SummaryDescription', p_SummaryDescription_49782e6e2b52,
    'DetectionMethod', p_DetectionMethod_49782e6e2b52,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_49782e6e2b52,
    'ID', p_ID_49782e6e2b52
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_49782e6e2b52, p_Name := p_Name_49782e6e2b52, p_Description := p_Description_49782e6e2b52, p_Sequence := p_Sequence_49782e6e2b52, p_SQLBaseType := p_SQLBaseType_49782e6e2b52, p_SQLFullType := p_SQLFullType_49782e6e2b52, p_SourceEntityID := p_SourceEntityID_49782e6e2b52, p_SourceFieldName := p_SourceFieldName_49782e6e2b52, p_IsComputed := p_IsComputed_49782e6e2b52, p_ComputationDescription := p_ComputationDescription_49782e6e2b52, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_49782e6e2b52, p_SummaryDescription := p_SummaryDescription_49782e6e2b52, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_49782e6e2b52, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_49782e6e2b52, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_49782e6e2b52);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_393eefcbaccd UUID;
  p_Name_393eefcbaccd VARCHAR(255);
  p_Description_393eefcbaccd TEXT;
  p_Sequence_393eefcbaccd INTEGER;
  p_SQLBaseType_393eefcbaccd VARCHAR(50);
  p_SQLFullType_393eefcbaccd VARCHAR(100);
  p_SourceEntityID_393eefcbaccd UUID;
  p_SourceFieldName_393eefcbaccd VARCHAR(255);
  p_IsComputed_393eefcbaccd BOOLEAN;
  p_ComputationDescription_393eefcbaccd TEXT;
  p_IsSummary_393eefcbaccd BOOLEAN;
  p_SummaryDescription_393eefcbaccd TEXT;
  p_DetectionMethod_393eefcbaccd VARCHAR(50);
  p_AutoDetectConfidenceScore_393eefcbaccd NUMERIC(3,2);
  p_ID_393eefcbaccd UUID;
BEGIN
  p_QueryID_393eefcbaccd := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_393eefcbaccd := 'IsLost';
  p_Description_393eefcbaccd := 'Computed column: IsLost';
  p_Sequence_393eefcbaccd := 20;
  p_SQLBaseType_393eefcbaccd := 'bit';
  p_SQLFullType_393eefcbaccd := 'bit';
  p_SourceEntityID_393eefcbaccd := '27E8D79F-A8E2-4AC1-B208-5A0F11416197';
  p_SourceFieldName_393eefcbaccd := 'IsLost';
  p_IsComputed_393eefcbaccd := TRUE;
  p_IsSummary_393eefcbaccd := FALSE;
  p_DetectionMethod_393eefcbaccd := 'Manual';
  p_ID_393eefcbaccd := '32285276-648E-4C1A-B1D5-59D429DE16C9';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_393eefcbaccd,
    'Name', p_Name_393eefcbaccd,
    'Description', p_Description_393eefcbaccd,
    'Sequence', p_Sequence_393eefcbaccd,
    'SQLBaseType', p_SQLBaseType_393eefcbaccd,
    'SQLFullType', p_SQLFullType_393eefcbaccd,
    'SourceEntityID', p_SourceEntityID_393eefcbaccd,
    'SourceFieldName', p_SourceFieldName_393eefcbaccd,
    'IsComputed', p_IsComputed_393eefcbaccd,
    'ComputationDescription', p_ComputationDescription_393eefcbaccd,
    'IsSummary', p_IsSummary_393eefcbaccd,
    'SummaryDescription', p_SummaryDescription_393eefcbaccd,
    'DetectionMethod', p_DetectionMethod_393eefcbaccd,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_393eefcbaccd,
    'ID', p_ID_393eefcbaccd
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_393eefcbaccd, p_Name := p_Name_393eefcbaccd, p_Description := p_Description_393eefcbaccd, p_Sequence := p_Sequence_393eefcbaccd, p_SQLBaseType := p_SQLBaseType_393eefcbaccd, p_SQLFullType := p_SQLFullType_393eefcbaccd, p_SourceEntityID := p_SourceEntityID_393eefcbaccd, p_SourceFieldName := p_SourceFieldName_393eefcbaccd, p_IsComputed := p_IsComputed_393eefcbaccd, p_ComputationDescription := p_ComputationDescription_393eefcbaccd, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_393eefcbaccd, p_SummaryDescription := p_SummaryDescription_393eefcbaccd, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_393eefcbaccd, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_393eefcbaccd, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_393eefcbaccd);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_42ad53f95685 UUID;
  p_Name_42ad53f95685 VARCHAR(255);
  p_Description_42ad53f95685 TEXT;
  p_Sequence_42ad53f95685 INTEGER;
  p_SQLBaseType_42ad53f95685 VARCHAR(50);
  p_SQLFullType_42ad53f95685 VARCHAR(100);
  p_SourceEntityID_42ad53f95685 UUID;
  p_SourceFieldName_42ad53f95685 VARCHAR(255);
  p_IsComputed_42ad53f95685 BOOLEAN;
  p_ComputationDescription_42ad53f95685 TEXT;
  p_IsSummary_42ad53f95685 BOOLEAN;
  p_SummaryDescription_42ad53f95685 TEXT;
  p_DetectionMethod_42ad53f95685 VARCHAR(50);
  p_AutoDetectConfidenceScore_42ad53f95685 NUMERIC(3,2);
  p_ID_42ad53f95685 UUID;
BEGIN
  p_QueryID_42ad53f95685 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_42ad53f95685 := 'StageName';
  p_Description_42ad53f95685 := 'PipelineStage (aliased as StageName)';
  p_Sequence_42ad53f95685 := 12;
  p_SQLBaseType_42ad53f95685 := 'nvarchar';
  p_SQLFullType_42ad53f95685 := 'nvarchar(200)';
  p_SourceEntityID_42ad53f95685 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_42ad53f95685 := 'PipelineStage';
  p_IsComputed_42ad53f95685 := FALSE;
  p_IsSummary_42ad53f95685 := FALSE;
  p_DetectionMethod_42ad53f95685 := 'Manual';
  p_ID_42ad53f95685 := 'AD11A5C4-B94B-405C-B151-6060B24CF131';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_42ad53f95685,
    'Name', p_Name_42ad53f95685,
    'Description', p_Description_42ad53f95685,
    'Sequence', p_Sequence_42ad53f95685,
    'SQLBaseType', p_SQLBaseType_42ad53f95685,
    'SQLFullType', p_SQLFullType_42ad53f95685,
    'SourceEntityID', p_SourceEntityID_42ad53f95685,
    'SourceFieldName', p_SourceFieldName_42ad53f95685,
    'IsComputed', p_IsComputed_42ad53f95685,
    'ComputationDescription', p_ComputationDescription_42ad53f95685,
    'IsSummary', p_IsSummary_42ad53f95685,
    'SummaryDescription', p_SummaryDescription_42ad53f95685,
    'DetectionMethod', p_DetectionMethod_42ad53f95685,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_42ad53f95685,
    'ID', p_ID_42ad53f95685
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_42ad53f95685, p_Name := p_Name_42ad53f95685, p_Description := p_Description_42ad53f95685, p_Sequence := p_Sequence_42ad53f95685, p_SQLBaseType := p_SQLBaseType_42ad53f95685, p_SQLFullType := p_SQLFullType_42ad53f95685, p_SourceEntityID := p_SourceEntityID_42ad53f95685, p_SourceFieldName := p_SourceFieldName_42ad53f95685, p_IsComputed := p_IsComputed_42ad53f95685, p_ComputationDescription := p_ComputationDescription_42ad53f95685, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_42ad53f95685, p_SummaryDescription := p_SummaryDescription_42ad53f95685, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_42ad53f95685, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_42ad53f95685, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_42ad53f95685);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_146bffbc1708 UUID;
  p_Name_146bffbc1708 VARCHAR(255);
  p_Description_146bffbc1708 TEXT;
  p_Sequence_146bffbc1708 INTEGER;
  p_SQLBaseType_146bffbc1708 VARCHAR(50);
  p_SQLFullType_146bffbc1708 VARCHAR(100);
  p_SourceEntityID_146bffbc1708 UUID;
  p_SourceFieldName_146bffbc1708 VARCHAR(255);
  p_IsComputed_146bffbc1708 BOOLEAN;
  p_ComputationDescription_146bffbc1708 TEXT;
  p_IsSummary_146bffbc1708 BOOLEAN;
  p_SummaryDescription_146bffbc1708 TEXT;
  p_DetectionMethod_146bffbc1708 VARCHAR(50);
  p_AutoDetectConfidenceScore_146bffbc1708 NUMERIC(3,2);
  p_ID_146bffbc1708 UUID;
BEGIN
  p_QueryID_146bffbc1708 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_146bffbc1708 := 'ForecastCategoryName';
  p_Description_146bffbc1708 := 'ForecastCategoryType (aliased as ForecastCategoryName)';
  p_Sequence_146bffbc1708 := 23;
  p_SQLBaseType_146bffbc1708 := 'nvarchar';
  p_SQLFullType_146bffbc1708 := 'nvarchar(200)';
  p_SourceEntityID_146bffbc1708 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_146bffbc1708 := 'ForecastCategoryType';
  p_IsComputed_146bffbc1708 := FALSE;
  p_IsSummary_146bffbc1708 := FALSE;
  p_DetectionMethod_146bffbc1708 := 'Manual';
  p_ID_146bffbc1708 := '3C551639-4702-4214-B1ED-6178F1EF1E52';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_146bffbc1708,
    'Name', p_Name_146bffbc1708,
    'Description', p_Description_146bffbc1708,
    'Sequence', p_Sequence_146bffbc1708,
    'SQLBaseType', p_SQLBaseType_146bffbc1708,
    'SQLFullType', p_SQLFullType_146bffbc1708,
    'SourceEntityID', p_SourceEntityID_146bffbc1708,
    'SourceFieldName', p_SourceFieldName_146bffbc1708,
    'IsComputed', p_IsComputed_146bffbc1708,
    'ComputationDescription', p_ComputationDescription_146bffbc1708,
    'IsSummary', p_IsSummary_146bffbc1708,
    'SummaryDescription', p_SummaryDescription_146bffbc1708,
    'DetectionMethod', p_DetectionMethod_146bffbc1708,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_146bffbc1708,
    'ID', p_ID_146bffbc1708
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_146bffbc1708, p_Name := p_Name_146bffbc1708, p_Description := p_Description_146bffbc1708, p_Sequence := p_Sequence_146bffbc1708, p_SQLBaseType := p_SQLBaseType_146bffbc1708, p_SQLFullType := p_SQLFullType_146bffbc1708, p_SourceEntityID := p_SourceEntityID_146bffbc1708, p_SourceFieldName := p_SourceFieldName_146bffbc1708, p_IsComputed := p_IsComputed_146bffbc1708, p_ComputationDescription := p_ComputationDescription_146bffbc1708, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_146bffbc1708, p_SummaryDescription := p_SummaryDescription_146bffbc1708, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_146bffbc1708, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_146bffbc1708, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_146bffbc1708);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_185cb0beeb01 UUID;
  p_Name_185cb0beeb01 VARCHAR(255);
  p_Description_185cb0beeb01 TEXT;
  p_Sequence_185cb0beeb01 INTEGER;
  p_SQLBaseType_185cb0beeb01 VARCHAR(50);
  p_SQLFullType_185cb0beeb01 VARCHAR(100);
  p_SourceEntityID_185cb0beeb01 UUID;
  p_SourceFieldName_185cb0beeb01 VARCHAR(255);
  p_IsComputed_185cb0beeb01 BOOLEAN;
  p_ComputationDescription_185cb0beeb01 TEXT;
  p_IsSummary_185cb0beeb01 BOOLEAN;
  p_SummaryDescription_185cb0beeb01 TEXT;
  p_DetectionMethod_185cb0beeb01 VARCHAR(50);
  p_AutoDetectConfidenceScore_185cb0beeb01 NUMERIC(3,2);
  p_ID_185cb0beeb01 UUID;
BEGIN
  p_QueryID_185cb0beeb01 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_185cb0beeb01 := 'IsPastExpectedClose';
  p_Description_185cb0beeb01 := 'Computed column: IsPastExpectedClose';
  p_Sequence_185cb0beeb01 := 36;
  p_SQLBaseType_185cb0beeb01 := 'nvarchar';
  p_SQLFullType_185cb0beeb01 := 'nvarchar(MAX)';
  p_IsComputed_185cb0beeb01 := TRUE;
  p_IsSummary_185cb0beeb01 := FALSE;
  p_DetectionMethod_185cb0beeb01 := 'Manual';
  p_ID_185cb0beeb01 := '9F105511-56F7-4DDA-9DDA-6ACCC9B18538';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_185cb0beeb01,
    'Name', p_Name_185cb0beeb01,
    'Description', p_Description_185cb0beeb01,
    'Sequence', p_Sequence_185cb0beeb01,
    'SQLBaseType', p_SQLBaseType_185cb0beeb01,
    'SQLFullType', p_SQLFullType_185cb0beeb01,
    'SourceEntityID', p_SourceEntityID_185cb0beeb01,
    'SourceFieldName', p_SourceFieldName_185cb0beeb01,
    'IsComputed', p_IsComputed_185cb0beeb01,
    'ComputationDescription', p_ComputationDescription_185cb0beeb01,
    'IsSummary', p_IsSummary_185cb0beeb01,
    'SummaryDescription', p_SummaryDescription_185cb0beeb01,
    'DetectionMethod', p_DetectionMethod_185cb0beeb01,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_185cb0beeb01,
    'ID', p_ID_185cb0beeb01
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_185cb0beeb01, p_Name := p_Name_185cb0beeb01, p_Description := p_Description_185cb0beeb01, p_Sequence := p_Sequence_185cb0beeb01, p_SQLBaseType := p_SQLBaseType_185cb0beeb01, p_SQLFullType := p_SQLFullType_185cb0beeb01, p_SourceEntityID := p_SourceEntityID_185cb0beeb01, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_185cb0beeb01, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_185cb0beeb01, p_ComputationDescription := p_ComputationDescription_185cb0beeb01, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_185cb0beeb01, p_SummaryDescription := p_SummaryDescription_185cb0beeb01, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_185cb0beeb01, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_185cb0beeb01, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_185cb0beeb01);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_4c6c38b655e5 UUID;
  p_Name_4c6c38b655e5 VARCHAR(255);
  p_Description_4c6c38b655e5 TEXT;
  p_Sequence_4c6c38b655e5 INTEGER;
  p_SQLBaseType_4c6c38b655e5 VARCHAR(50);
  p_SQLFullType_4c6c38b655e5 VARCHAR(100);
  p_SourceEntityID_4c6c38b655e5 UUID;
  p_SourceFieldName_4c6c38b655e5 VARCHAR(255);
  p_IsComputed_4c6c38b655e5 BOOLEAN;
  p_ComputationDescription_4c6c38b655e5 TEXT;
  p_IsSummary_4c6c38b655e5 BOOLEAN;
  p_SummaryDescription_4c6c38b655e5 TEXT;
  p_DetectionMethod_4c6c38b655e5 VARCHAR(50);
  p_AutoDetectConfidenceScore_4c6c38b655e5 NUMERIC(3,2);
  p_ID_4c6c38b655e5 UUID;
BEGIN
  p_QueryID_4c6c38b655e5 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_4c6c38b655e5 := 'WeightedAmount';
  p_Description_4c6c38b655e5 := 'Computed column: WeightedAmount';
  p_Sequence_4c6c38b655e5 := 33;
  p_SQLBaseType_4c6c38b655e5 := 'nvarchar';
  p_SQLFullType_4c6c38b655e5 := 'nvarchar(MAX)';
  p_IsComputed_4c6c38b655e5 := TRUE;
  p_IsSummary_4c6c38b655e5 := FALSE;
  p_DetectionMethod_4c6c38b655e5 := 'Manual';
  p_ID_4c6c38b655e5 := '56B81EF6-5566-439D-B2C7-6BCC07341DD4';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_4c6c38b655e5,
    'Name', p_Name_4c6c38b655e5,
    'Description', p_Description_4c6c38b655e5,
    'Sequence', p_Sequence_4c6c38b655e5,
    'SQLBaseType', p_SQLBaseType_4c6c38b655e5,
    'SQLFullType', p_SQLFullType_4c6c38b655e5,
    'SourceEntityID', p_SourceEntityID_4c6c38b655e5,
    'SourceFieldName', p_SourceFieldName_4c6c38b655e5,
    'IsComputed', p_IsComputed_4c6c38b655e5,
    'ComputationDescription', p_ComputationDescription_4c6c38b655e5,
    'IsSummary', p_IsSummary_4c6c38b655e5,
    'SummaryDescription', p_SummaryDescription_4c6c38b655e5,
    'DetectionMethod', p_DetectionMethod_4c6c38b655e5,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4c6c38b655e5,
    'ID', p_ID_4c6c38b655e5
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_4c6c38b655e5, p_Name := p_Name_4c6c38b655e5, p_Description := p_Description_4c6c38b655e5, p_Sequence := p_Sequence_4c6c38b655e5, p_SQLBaseType := p_SQLBaseType_4c6c38b655e5, p_SQLFullType := p_SQLFullType_4c6c38b655e5, p_SourceEntityID := p_SourceEntityID_4c6c38b655e5, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_4c6c38b655e5, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_4c6c38b655e5, p_ComputationDescription := p_ComputationDescription_4c6c38b655e5, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_4c6c38b655e5, p_SummaryDescription := p_SummaryDescription_4c6c38b655e5, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_4c6c38b655e5, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4c6c38b655e5, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_4c6c38b655e5);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_3689fa3c0db9 UUID;
  p_Name_3689fa3c0db9 VARCHAR(255);
  p_Description_3689fa3c0db9 TEXT;
  p_Sequence_3689fa3c0db9 INTEGER;
  p_SQLBaseType_3689fa3c0db9 VARCHAR(50);
  p_SQLFullType_3689fa3c0db9 VARCHAR(100);
  p_SourceEntityID_3689fa3c0db9 UUID;
  p_SourceFieldName_3689fa3c0db9 VARCHAR(255);
  p_IsComputed_3689fa3c0db9 BOOLEAN;
  p_ComputationDescription_3689fa3c0db9 TEXT;
  p_IsSummary_3689fa3c0db9 BOOLEAN;
  p_SummaryDescription_3689fa3c0db9 TEXT;
  p_DetectionMethod_3689fa3c0db9 VARCHAR(50);
  p_AutoDetectConfidenceScore_3689fa3c0db9 NUMERIC(3,2);
  p_ID_3689fa3c0db9 UUID;
BEGIN
  p_QueryID_3689fa3c0db9 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_3689fa3c0db9 := 'ContractID';
  p_Description_3689fa3c0db9 := 'ContractID';
  p_Sequence_3689fa3c0db9 := 38;
  p_SQLBaseType_3689fa3c0db9 := 'uniqueidentifier';
  p_SQLFullType_3689fa3c0db9 := 'uniqueidentifier';
  p_SourceEntityID_3689fa3c0db9 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_3689fa3c0db9 := 'ContractID';
  p_IsComputed_3689fa3c0db9 := FALSE;
  p_IsSummary_3689fa3c0db9 := FALSE;
  p_DetectionMethod_3689fa3c0db9 := 'Manual';
  p_ID_3689fa3c0db9 := 'F4EA9A57-07FA-4966-B251-6C805055BF61';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_3689fa3c0db9,
    'Name', p_Name_3689fa3c0db9,
    'Description', p_Description_3689fa3c0db9,
    'Sequence', p_Sequence_3689fa3c0db9,
    'SQLBaseType', p_SQLBaseType_3689fa3c0db9,
    'SQLFullType', p_SQLFullType_3689fa3c0db9,
    'SourceEntityID', p_SourceEntityID_3689fa3c0db9,
    'SourceFieldName', p_SourceFieldName_3689fa3c0db9,
    'IsComputed', p_IsComputed_3689fa3c0db9,
    'ComputationDescription', p_ComputationDescription_3689fa3c0db9,
    'IsSummary', p_IsSummary_3689fa3c0db9,
    'SummaryDescription', p_SummaryDescription_3689fa3c0db9,
    'DetectionMethod', p_DetectionMethod_3689fa3c0db9,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_3689fa3c0db9,
    'ID', p_ID_3689fa3c0db9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_3689fa3c0db9, p_Name := p_Name_3689fa3c0db9, p_Description := p_Description_3689fa3c0db9, p_Sequence := p_Sequence_3689fa3c0db9, p_SQLBaseType := p_SQLBaseType_3689fa3c0db9, p_SQLFullType := p_SQLFullType_3689fa3c0db9, p_SourceEntityID := p_SourceEntityID_3689fa3c0db9, p_SourceFieldName := p_SourceFieldName_3689fa3c0db9, p_IsComputed := p_IsComputed_3689fa3c0db9, p_ComputationDescription := p_ComputationDescription_3689fa3c0db9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_3689fa3c0db9, p_SummaryDescription := p_SummaryDescription_3689fa3c0db9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_3689fa3c0db9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_3689fa3c0db9, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_3689fa3c0db9);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_a2e9cdffc4c7 UUID;
  p_Name_a2e9cdffc4c7 VARCHAR(255);
  p_Description_a2e9cdffc4c7 TEXT;
  p_Sequence_a2e9cdffc4c7 INTEGER;
  p_SQLBaseType_a2e9cdffc4c7 VARCHAR(50);
  p_SQLFullType_a2e9cdffc4c7 VARCHAR(100);
  p_SourceEntityID_a2e9cdffc4c7 UUID;
  p_SourceFieldName_a2e9cdffc4c7 VARCHAR(255);
  p_IsComputed_a2e9cdffc4c7 BOOLEAN;
  p_ComputationDescription_a2e9cdffc4c7 TEXT;
  p_IsSummary_a2e9cdffc4c7 BOOLEAN;
  p_SummaryDescription_a2e9cdffc4c7 TEXT;
  p_DetectionMethod_a2e9cdffc4c7 VARCHAR(50);
  p_AutoDetectConfidenceScore_a2e9cdffc4c7 NUMERIC(3,2);
  p_ID_a2e9cdffc4c7 UUID;
BEGIN
  p_QueryID_a2e9cdffc4c7 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_a2e9cdffc4c7 := 'DealStatusTypeID';
  p_Description_a2e9cdffc4c7 := 'DealStatusTypeID';
  p_Sequence_a2e9cdffc4c7 := 16;
  p_SQLBaseType_a2e9cdffc4c7 := 'uniqueidentifier';
  p_SQLFullType_a2e9cdffc4c7 := 'uniqueidentifier';
  p_SourceEntityID_a2e9cdffc4c7 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_a2e9cdffc4c7 := 'DealStatusTypeID';
  p_IsComputed_a2e9cdffc4c7 := FALSE;
  p_IsSummary_a2e9cdffc4c7 := FALSE;
  p_DetectionMethod_a2e9cdffc4c7 := 'Manual';
  p_ID_a2e9cdffc4c7 := '7616A104-B187-4929-95A5-71AD3E3B27E6';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_a2e9cdffc4c7,
    'Name', p_Name_a2e9cdffc4c7,
    'Description', p_Description_a2e9cdffc4c7,
    'Sequence', p_Sequence_a2e9cdffc4c7,
    'SQLBaseType', p_SQLBaseType_a2e9cdffc4c7,
    'SQLFullType', p_SQLFullType_a2e9cdffc4c7,
    'SourceEntityID', p_SourceEntityID_a2e9cdffc4c7,
    'SourceFieldName', p_SourceFieldName_a2e9cdffc4c7,
    'IsComputed', p_IsComputed_a2e9cdffc4c7,
    'ComputationDescription', p_ComputationDescription_a2e9cdffc4c7,
    'IsSummary', p_IsSummary_a2e9cdffc4c7,
    'SummaryDescription', p_SummaryDescription_a2e9cdffc4c7,
    'DetectionMethod', p_DetectionMethod_a2e9cdffc4c7,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_a2e9cdffc4c7,
    'ID', p_ID_a2e9cdffc4c7
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_a2e9cdffc4c7, p_Name := p_Name_a2e9cdffc4c7, p_Description := p_Description_a2e9cdffc4c7, p_Sequence := p_Sequence_a2e9cdffc4c7, p_SQLBaseType := p_SQLBaseType_a2e9cdffc4c7, p_SQLFullType := p_SQLFullType_a2e9cdffc4c7, p_SourceEntityID := p_SourceEntityID_a2e9cdffc4c7, p_SourceFieldName := p_SourceFieldName_a2e9cdffc4c7, p_IsComputed := p_IsComputed_a2e9cdffc4c7, p_ComputationDescription := p_ComputationDescription_a2e9cdffc4c7, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_a2e9cdffc4c7, p_SummaryDescription := p_SummaryDescription_a2e9cdffc4c7, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_a2e9cdffc4c7, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_a2e9cdffc4c7, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_a2e9cdffc4c7);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_15ed6da6ee26 UUID;
  p_Name_15ed6da6ee26 VARCHAR(255);
  p_Description_15ed6da6ee26 TEXT;
  p_Sequence_15ed6da6ee26 INTEGER;
  p_SQLBaseType_15ed6da6ee26 VARCHAR(50);
  p_SQLFullType_15ed6da6ee26 VARCHAR(100);
  p_SourceEntityID_15ed6da6ee26 UUID;
  p_SourceFieldName_15ed6da6ee26 VARCHAR(255);
  p_IsComputed_15ed6da6ee26 BOOLEAN;
  p_ComputationDescription_15ed6da6ee26 TEXT;
  p_IsSummary_15ed6da6ee26 BOOLEAN;
  p_SummaryDescription_15ed6da6ee26 TEXT;
  p_DetectionMethod_15ed6da6ee26 VARCHAR(50);
  p_AutoDetectConfidenceScore_15ed6da6ee26 NUMERIC(3,2);
  p_ID_15ed6da6ee26 UUID;
BEGIN
  p_QueryID_15ed6da6ee26 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_15ed6da6ee26 := 'PipelineStageID';
  p_Description_15ed6da6ee26 := 'PipelineStageID';
  p_Sequence_15ed6da6ee26 := 11;
  p_SQLBaseType_15ed6da6ee26 := 'uniqueidentifier';
  p_SQLFullType_15ed6da6ee26 := 'uniqueidentifier';
  p_SourceEntityID_15ed6da6ee26 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_15ed6da6ee26 := 'PipelineStageID';
  p_IsComputed_15ed6da6ee26 := FALSE;
  p_IsSummary_15ed6da6ee26 := FALSE;
  p_DetectionMethod_15ed6da6ee26 := 'Manual';
  p_ID_15ed6da6ee26 := '0ACC3D7A-027F-4D75-8CE7-7A6A5ED641E3';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_15ed6da6ee26,
    'Name', p_Name_15ed6da6ee26,
    'Description', p_Description_15ed6da6ee26,
    'Sequence', p_Sequence_15ed6da6ee26,
    'SQLBaseType', p_SQLBaseType_15ed6da6ee26,
    'SQLFullType', p_SQLFullType_15ed6da6ee26,
    'SourceEntityID', p_SourceEntityID_15ed6da6ee26,
    'SourceFieldName', p_SourceFieldName_15ed6da6ee26,
    'IsComputed', p_IsComputed_15ed6da6ee26,
    'ComputationDescription', p_ComputationDescription_15ed6da6ee26,
    'IsSummary', p_IsSummary_15ed6da6ee26,
    'SummaryDescription', p_SummaryDescription_15ed6da6ee26,
    'DetectionMethod', p_DetectionMethod_15ed6da6ee26,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_15ed6da6ee26,
    'ID', p_ID_15ed6da6ee26
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_15ed6da6ee26, p_Name := p_Name_15ed6da6ee26, p_Description := p_Description_15ed6da6ee26, p_Sequence := p_Sequence_15ed6da6ee26, p_SQLBaseType := p_SQLBaseType_15ed6da6ee26, p_SQLFullType := p_SQLFullType_15ed6da6ee26, p_SourceEntityID := p_SourceEntityID_15ed6da6ee26, p_SourceFieldName := p_SourceFieldName_15ed6da6ee26, p_IsComputed := p_IsComputed_15ed6da6ee26, p_ComputationDescription := p_ComputationDescription_15ed6da6ee26, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_15ed6da6ee26, p_SummaryDescription := p_SummaryDescription_15ed6da6ee26, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_15ed6da6ee26, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_15ed6da6ee26, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_15ed6da6ee26);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_5b4026db69a4 UUID;
  p_Name_5b4026db69a4 VARCHAR(255);
  p_Description_5b4026db69a4 TEXT;
  p_Sequence_5b4026db69a4 INTEGER;
  p_SQLBaseType_5b4026db69a4 VARCHAR(50);
  p_SQLFullType_5b4026db69a4 VARCHAR(100);
  p_SourceEntityID_5b4026db69a4 UUID;
  p_SourceFieldName_5b4026db69a4 VARCHAR(255);
  p_IsComputed_5b4026db69a4 BOOLEAN;
  p_ComputationDescription_5b4026db69a4 TEXT;
  p_IsSummary_5b4026db69a4 BOOLEAN;
  p_SummaryDescription_5b4026db69a4 TEXT;
  p_DetectionMethod_5b4026db69a4 VARCHAR(50);
  p_AutoDetectConfidenceScore_5b4026db69a4 NUMERIC(3,2);
  p_ID_5b4026db69a4 UUID;
BEGIN
  p_QueryID_5b4026db69a4 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_5b4026db69a4 := 'IncludeInCommit';
  p_Description_5b4026db69a4 := 'IncludeInCommit';
  p_Sequence_5b4026db69a4 := 24;
  p_SQLBaseType_5b4026db69a4 := 'bit';
  p_SQLFullType_5b4026db69a4 := 'bit';
  p_SourceEntityID_5b4026db69a4 := 'DF087A57-A6C1-4EDC-9C52-EB784D95287C';
  p_SourceFieldName_5b4026db69a4 := 'IncludeInCommit';
  p_IsComputed_5b4026db69a4 := FALSE;
  p_IsSummary_5b4026db69a4 := FALSE;
  p_DetectionMethod_5b4026db69a4 := 'Manual';
  p_ID_5b4026db69a4 := 'E0A10251-6C19-4845-BB00-8943FBC0E634';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_5b4026db69a4,
    'Name', p_Name_5b4026db69a4,
    'Description', p_Description_5b4026db69a4,
    'Sequence', p_Sequence_5b4026db69a4,
    'SQLBaseType', p_SQLBaseType_5b4026db69a4,
    'SQLFullType', p_SQLFullType_5b4026db69a4,
    'SourceEntityID', p_SourceEntityID_5b4026db69a4,
    'SourceFieldName', p_SourceFieldName_5b4026db69a4,
    'IsComputed', p_IsComputed_5b4026db69a4,
    'ComputationDescription', p_ComputationDescription_5b4026db69a4,
    'IsSummary', p_IsSummary_5b4026db69a4,
    'SummaryDescription', p_SummaryDescription_5b4026db69a4,
    'DetectionMethod', p_DetectionMethod_5b4026db69a4,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_5b4026db69a4,
    'ID', p_ID_5b4026db69a4
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_5b4026db69a4, p_Name := p_Name_5b4026db69a4, p_Description := p_Description_5b4026db69a4, p_Sequence := p_Sequence_5b4026db69a4, p_SQLBaseType := p_SQLBaseType_5b4026db69a4, p_SQLFullType := p_SQLFullType_5b4026db69a4, p_SourceEntityID := p_SourceEntityID_5b4026db69a4, p_SourceFieldName := p_SourceFieldName_5b4026db69a4, p_IsComputed := p_IsComputed_5b4026db69a4, p_ComputationDescription := p_ComputationDescription_5b4026db69a4, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_5b4026db69a4, p_SummaryDescription := p_SummaryDescription_5b4026db69a4, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_5b4026db69a4, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_5b4026db69a4, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_5b4026db69a4);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_f3d3f008289c UUID;
  p_Name_f3d3f008289c VARCHAR(255);
  p_Description_f3d3f008289c TEXT;
  p_Sequence_f3d3f008289c INTEGER;
  p_SQLBaseType_f3d3f008289c VARCHAR(50);
  p_SQLFullType_f3d3f008289c VARCHAR(100);
  p_SourceEntityID_f3d3f008289c UUID;
  p_SourceFieldName_f3d3f008289c VARCHAR(255);
  p_IsComputed_f3d3f008289c BOOLEAN;
  p_ComputationDescription_f3d3f008289c TEXT;
  p_IsSummary_f3d3f008289c BOOLEAN;
  p_SummaryDescription_f3d3f008289c TEXT;
  p_DetectionMethod_f3d3f008289c VARCHAR(50);
  p_AutoDetectConfidenceScore_f3d3f008289c NUMERIC(3,2);
  p_ID_f3d3f008289c UUID;
BEGIN
  p_QueryID_f3d3f008289c := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_f3d3f008289c := 'IsClosed';
  p_Description_f3d3f008289c := 'Computed column: IsClosed';
  p_Sequence_f3d3f008289c := 21;
  p_SQLBaseType_f3d3f008289c := 'bit';
  p_SQLFullType_f3d3f008289c := 'bit';
  p_SourceEntityID_f3d3f008289c := '27E8D79F-A8E2-4AC1-B208-5A0F11416197';
  p_SourceFieldName_f3d3f008289c := 'IsClosed';
  p_IsComputed_f3d3f008289c := TRUE;
  p_IsSummary_f3d3f008289c := FALSE;
  p_DetectionMethod_f3d3f008289c := 'Manual';
  p_ID_f3d3f008289c := 'C903E405-B3E1-4837-BC6B-8E2382E225F5';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_f3d3f008289c,
    'Name', p_Name_f3d3f008289c,
    'Description', p_Description_f3d3f008289c,
    'Sequence', p_Sequence_f3d3f008289c,
    'SQLBaseType', p_SQLBaseType_f3d3f008289c,
    'SQLFullType', p_SQLFullType_f3d3f008289c,
    'SourceEntityID', p_SourceEntityID_f3d3f008289c,
    'SourceFieldName', p_SourceFieldName_f3d3f008289c,
    'IsComputed', p_IsComputed_f3d3f008289c,
    'ComputationDescription', p_ComputationDescription_f3d3f008289c,
    'IsSummary', p_IsSummary_f3d3f008289c,
    'SummaryDescription', p_SummaryDescription_f3d3f008289c,
    'DetectionMethod', p_DetectionMethod_f3d3f008289c,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_f3d3f008289c,
    'ID', p_ID_f3d3f008289c
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_f3d3f008289c, p_Name := p_Name_f3d3f008289c, p_Description := p_Description_f3d3f008289c, p_Sequence := p_Sequence_f3d3f008289c, p_SQLBaseType := p_SQLBaseType_f3d3f008289c, p_SQLFullType := p_SQLFullType_f3d3f008289c, p_SourceEntityID := p_SourceEntityID_f3d3f008289c, p_SourceFieldName := p_SourceFieldName_f3d3f008289c, p_IsComputed := p_IsComputed_f3d3f008289c, p_ComputationDescription := p_ComputationDescription_f3d3f008289c, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_f3d3f008289c, p_SummaryDescription := p_SummaryDescription_f3d3f008289c, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_f3d3f008289c, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_f3d3f008289c, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_f3d3f008289c);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_513810c55323 UUID;
  p_Name_513810c55323 VARCHAR(255);
  p_Description_513810c55323 TEXT;
  p_Sequence_513810c55323 INTEGER;
  p_SQLBaseType_513810c55323 VARCHAR(50);
  p_SQLFullType_513810c55323 VARCHAR(100);
  p_SourceEntityID_513810c55323 UUID;
  p_SourceFieldName_513810c55323 VARCHAR(255);
  p_IsComputed_513810c55323 BOOLEAN;
  p_ComputationDescription_513810c55323 TEXT;
  p_IsSummary_513810c55323 BOOLEAN;
  p_SummaryDescription_513810c55323 TEXT;
  p_DetectionMethod_513810c55323 VARCHAR(50);
  p_AutoDetectConfidenceScore_513810c55323 NUMERIC(3,2);
  p_ID_513810c55323 UUID;
BEGIN
  p_QueryID_513810c55323 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_513810c55323 := 'IsOpen';
  p_Description_513810c55323 := 'Computed column: IsOpen';
  p_Sequence_513810c55323 := 18;
  p_SQLBaseType_513810c55323 := 'bit';
  p_SQLFullType_513810c55323 := 'bit';
  p_SourceEntityID_513810c55323 := '27E8D79F-A8E2-4AC1-B208-5A0F11416197';
  p_SourceFieldName_513810c55323 := 'IsOpen';
  p_IsComputed_513810c55323 := TRUE;
  p_IsSummary_513810c55323 := FALSE;
  p_DetectionMethod_513810c55323 := 'Manual';
  p_ID_513810c55323 := 'E0BA80C8-7E36-43F5-869D-9533D86EB5CB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_513810c55323,
    'Name', p_Name_513810c55323,
    'Description', p_Description_513810c55323,
    'Sequence', p_Sequence_513810c55323,
    'SQLBaseType', p_SQLBaseType_513810c55323,
    'SQLFullType', p_SQLFullType_513810c55323,
    'SourceEntityID', p_SourceEntityID_513810c55323,
    'SourceFieldName', p_SourceFieldName_513810c55323,
    'IsComputed', p_IsComputed_513810c55323,
    'ComputationDescription', p_ComputationDescription_513810c55323,
    'IsSummary', p_IsSummary_513810c55323,
    'SummaryDescription', p_SummaryDescription_513810c55323,
    'DetectionMethod', p_DetectionMethod_513810c55323,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_513810c55323,
    'ID', p_ID_513810c55323
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_513810c55323, p_Name := p_Name_513810c55323, p_Description := p_Description_513810c55323, p_Sequence := p_Sequence_513810c55323, p_SQLBaseType := p_SQLBaseType_513810c55323, p_SQLFullType := p_SQLFullType_513810c55323, p_SourceEntityID := p_SourceEntityID_513810c55323, p_SourceFieldName := p_SourceFieldName_513810c55323, p_IsComputed := p_IsComputed_513810c55323, p_ComputationDescription := p_ComputationDescription_513810c55323, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_513810c55323, p_SummaryDescription := p_SummaryDescription_513810c55323, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_513810c55323, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_513810c55323, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_513810c55323);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_76d2945044dc UUID;
  p_Name_76d2945044dc VARCHAR(255);
  p_Description_76d2945044dc TEXT;
  p_Sequence_76d2945044dc INTEGER;
  p_SQLBaseType_76d2945044dc VARCHAR(50);
  p_SQLFullType_76d2945044dc VARCHAR(100);
  p_SourceEntityID_76d2945044dc UUID;
  p_SourceFieldName_76d2945044dc VARCHAR(255);
  p_IsComputed_76d2945044dc BOOLEAN;
  p_ComputationDescription_76d2945044dc TEXT;
  p_IsSummary_76d2945044dc BOOLEAN;
  p_SummaryDescription_76d2945044dc TEXT;
  p_DetectionMethod_76d2945044dc VARCHAR(50);
  p_AutoDetectConfidenceScore_76d2945044dc NUMERIC(3,2);
  p_ID_76d2945044dc UUID;
BEGIN
  p_QueryID_76d2945044dc := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_76d2945044dc := 'IsWon';
  p_Description_76d2945044dc := 'Computed column: IsWon';
  p_Sequence_76d2945044dc := 19;
  p_SQLBaseType_76d2945044dc := 'bit';
  p_SQLFullType_76d2945044dc := 'bit';
  p_SourceEntityID_76d2945044dc := '27E8D79F-A8E2-4AC1-B208-5A0F11416197';
  p_SourceFieldName_76d2945044dc := 'IsWon';
  p_IsComputed_76d2945044dc := TRUE;
  p_IsSummary_76d2945044dc := FALSE;
  p_DetectionMethod_76d2945044dc := 'Manual';
  p_ID_76d2945044dc := 'E453C4FF-5DDF-4AB0-A74B-9674C4D33146';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_76d2945044dc,
    'Name', p_Name_76d2945044dc,
    'Description', p_Description_76d2945044dc,
    'Sequence', p_Sequence_76d2945044dc,
    'SQLBaseType', p_SQLBaseType_76d2945044dc,
    'SQLFullType', p_SQLFullType_76d2945044dc,
    'SourceEntityID', p_SourceEntityID_76d2945044dc,
    'SourceFieldName', p_SourceFieldName_76d2945044dc,
    'IsComputed', p_IsComputed_76d2945044dc,
    'ComputationDescription', p_ComputationDescription_76d2945044dc,
    'IsSummary', p_IsSummary_76d2945044dc,
    'SummaryDescription', p_SummaryDescription_76d2945044dc,
    'DetectionMethod', p_DetectionMethod_76d2945044dc,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_76d2945044dc,
    'ID', p_ID_76d2945044dc
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_76d2945044dc, p_Name := p_Name_76d2945044dc, p_Description := p_Description_76d2945044dc, p_Sequence := p_Sequence_76d2945044dc, p_SQLBaseType := p_SQLBaseType_76d2945044dc, p_SQLFullType := p_SQLFullType_76d2945044dc, p_SourceEntityID := p_SourceEntityID_76d2945044dc, p_SourceFieldName := p_SourceFieldName_76d2945044dc, p_IsComputed := p_IsComputed_76d2945044dc, p_ComputationDescription := p_ComputationDescription_76d2945044dc, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_76d2945044dc, p_SummaryDescription := p_SummaryDescription_76d2945044dc, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_76d2945044dc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_76d2945044dc, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_76d2945044dc);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_d2c774d6e1c9 UUID;
  p_Name_d2c774d6e1c9 VARCHAR(255);
  p_Description_d2c774d6e1c9 TEXT;
  p_Sequence_d2c774d6e1c9 INTEGER;
  p_SQLBaseType_d2c774d6e1c9 VARCHAR(50);
  p_SQLFullType_d2c774d6e1c9 VARCHAR(100);
  p_SourceEntityID_d2c774d6e1c9 UUID;
  p_SourceFieldName_d2c774d6e1c9 VARCHAR(255);
  p_IsComputed_d2c774d6e1c9 BOOLEAN;
  p_ComputationDescription_d2c774d6e1c9 TEXT;
  p_IsSummary_d2c774d6e1c9 BOOLEAN;
  p_SummaryDescription_d2c774d6e1c9 TEXT;
  p_DetectionMethod_d2c774d6e1c9 VARCHAR(50);
  p_AutoDetectConfidenceScore_d2c774d6e1c9 NUMERIC(3,2);
  p_ID_d2c774d6e1c9 UUID;
BEGIN
  p_QueryID_d2c774d6e1c9 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_d2c774d6e1c9 := 'CreatedAt';
  p_Description_d2c774d6e1c9 := '__mj_CreatedAt (aliased as CreatedAt)';
  p_Sequence_d2c774d6e1c9 := 39;
  p_SQLBaseType_d2c774d6e1c9 := 'datetimeoffset';
  p_SQLFullType_d2c774d6e1c9 := 'datetimeoffset';
  p_SourceEntityID_d2c774d6e1c9 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_d2c774d6e1c9 := '__mj_CreatedAt';
  p_IsComputed_d2c774d6e1c9 := FALSE;
  p_IsSummary_d2c774d6e1c9 := FALSE;
  p_DetectionMethod_d2c774d6e1c9 := 'Manual';
  p_ID_d2c774d6e1c9 := '462C2503-AAA0-4A06-BD3C-98CC52EA7DE7';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_d2c774d6e1c9,
    'Name', p_Name_d2c774d6e1c9,
    'Description', p_Description_d2c774d6e1c9,
    'Sequence', p_Sequence_d2c774d6e1c9,
    'SQLBaseType', p_SQLBaseType_d2c774d6e1c9,
    'SQLFullType', p_SQLFullType_d2c774d6e1c9,
    'SourceEntityID', p_SourceEntityID_d2c774d6e1c9,
    'SourceFieldName', p_SourceFieldName_d2c774d6e1c9,
    'IsComputed', p_IsComputed_d2c774d6e1c9,
    'ComputationDescription', p_ComputationDescription_d2c774d6e1c9,
    'IsSummary', p_IsSummary_d2c774d6e1c9,
    'SummaryDescription', p_SummaryDescription_d2c774d6e1c9,
    'DetectionMethod', p_DetectionMethod_d2c774d6e1c9,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_d2c774d6e1c9,
    'ID', p_ID_d2c774d6e1c9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_d2c774d6e1c9, p_Name := p_Name_d2c774d6e1c9, p_Description := p_Description_d2c774d6e1c9, p_Sequence := p_Sequence_d2c774d6e1c9, p_SQLBaseType := p_SQLBaseType_d2c774d6e1c9, p_SQLFullType := p_SQLFullType_d2c774d6e1c9, p_SourceEntityID := p_SourceEntityID_d2c774d6e1c9, p_SourceFieldName := p_SourceFieldName_d2c774d6e1c9, p_IsComputed := p_IsComputed_d2c774d6e1c9, p_ComputationDescription := p_ComputationDescription_d2c774d6e1c9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_d2c774d6e1c9, p_SummaryDescription := p_SummaryDescription_d2c774d6e1c9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_d2c774d6e1c9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_d2c774d6e1c9, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_d2c774d6e1c9);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_b0356079e3ff UUID;
  p_Name_b0356079e3ff VARCHAR(255);
  p_Description_b0356079e3ff TEXT;
  p_Sequence_b0356079e3ff INTEGER;
  p_SQLBaseType_b0356079e3ff VARCHAR(50);
  p_SQLFullType_b0356079e3ff VARCHAR(100);
  p_SourceEntityID_b0356079e3ff UUID;
  p_SourceFieldName_b0356079e3ff VARCHAR(255);
  p_IsComputed_b0356079e3ff BOOLEAN;
  p_ComputationDescription_b0356079e3ff TEXT;
  p_IsSummary_b0356079e3ff BOOLEAN;
  p_SummaryDescription_b0356079e3ff TEXT;
  p_DetectionMethod_b0356079e3ff VARCHAR(50);
  p_AutoDetectConfidenceScore_b0356079e3ff NUMERIC(3,2);
  p_ID_b0356079e3ff UUID;
BEGIN
  p_QueryID_b0356079e3ff := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_b0356079e3ff := 'OwnerName';
  p_Description_b0356079e3ff := 'OwnerEmployee (aliased as OwnerName)';
  p_Sequence_b0356079e3ff := 27;
  p_SQLBaseType_b0356079e3ff := 'nvarchar';
  p_SQLFullType_b0356079e3ff := 'nvarchar(81)';
  p_SourceEntityID_b0356079e3ff := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_b0356079e3ff := 'OwnerEmployee';
  p_IsComputed_b0356079e3ff := FALSE;
  p_IsSummary_b0356079e3ff := FALSE;
  p_DetectionMethod_b0356079e3ff := 'Manual';
  p_ID_b0356079e3ff := 'C34B7B15-4162-47B0-9B4E-A0BE1C6B3168';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_b0356079e3ff,
    'Name', p_Name_b0356079e3ff,
    'Description', p_Description_b0356079e3ff,
    'Sequence', p_Sequence_b0356079e3ff,
    'SQLBaseType', p_SQLBaseType_b0356079e3ff,
    'SQLFullType', p_SQLFullType_b0356079e3ff,
    'SourceEntityID', p_SourceEntityID_b0356079e3ff,
    'SourceFieldName', p_SourceFieldName_b0356079e3ff,
    'IsComputed', p_IsComputed_b0356079e3ff,
    'ComputationDescription', p_ComputationDescription_b0356079e3ff,
    'IsSummary', p_IsSummary_b0356079e3ff,
    'SummaryDescription', p_SummaryDescription_b0356079e3ff,
    'DetectionMethod', p_DetectionMethod_b0356079e3ff,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b0356079e3ff,
    'ID', p_ID_b0356079e3ff
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_b0356079e3ff, p_Name := p_Name_b0356079e3ff, p_Description := p_Description_b0356079e3ff, p_Sequence := p_Sequence_b0356079e3ff, p_SQLBaseType := p_SQLBaseType_b0356079e3ff, p_SQLFullType := p_SQLFullType_b0356079e3ff, p_SourceEntityID := p_SourceEntityID_b0356079e3ff, p_SourceFieldName := p_SourceFieldName_b0356079e3ff, p_IsComputed := p_IsComputed_b0356079e3ff, p_ComputationDescription := p_ComputationDescription_b0356079e3ff, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b0356079e3ff, p_SummaryDescription := p_SummaryDescription_b0356079e3ff, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b0356079e3ff, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b0356079e3ff, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_b0356079e3ff);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_42fb4c197df3 UUID;
  p_Name_42fb4c197df3 VARCHAR(255);
  p_Description_42fb4c197df3 TEXT;
  p_Sequence_42fb4c197df3 INTEGER;
  p_SQLBaseType_42fb4c197df3 VARCHAR(50);
  p_SQLFullType_42fb4c197df3 VARCHAR(100);
  p_SourceEntityID_42fb4c197df3 UUID;
  p_SourceFieldName_42fb4c197df3 VARCHAR(255);
  p_IsComputed_42fb4c197df3 BOOLEAN;
  p_ComputationDescription_42fb4c197df3 TEXT;
  p_IsSummary_42fb4c197df3 BOOLEAN;
  p_SummaryDescription_42fb4c197df3 TEXT;
  p_DetectionMethod_42fb4c197df3 VARCHAR(50);
  p_AutoDetectConfidenceScore_42fb4c197df3 NUMERIC(3,2);
  p_ID_42fb4c197df3 UUID;
BEGIN
  p_QueryID_42fb4c197df3 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_42fb4c197df3 := 'IncludeInBestCase';
  p_Description_42fb4c197df3 := 'IncludeInBestCase';
  p_Sequence_42fb4c197df3 := 25;
  p_SQLBaseType_42fb4c197df3 := 'bit';
  p_SQLFullType_42fb4c197df3 := 'bit';
  p_SourceEntityID_42fb4c197df3 := 'DF087A57-A6C1-4EDC-9C52-EB784D95287C';
  p_SourceFieldName_42fb4c197df3 := 'IncludeInBestCase';
  p_IsComputed_42fb4c197df3 := FALSE;
  p_IsSummary_42fb4c197df3 := FALSE;
  p_DetectionMethod_42fb4c197df3 := 'Manual';
  p_ID_42fb4c197df3 := '674D0BC3-AF84-4713-B2BC-A77F0E33D67E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_42fb4c197df3,
    'Name', p_Name_42fb4c197df3,
    'Description', p_Description_42fb4c197df3,
    'Sequence', p_Sequence_42fb4c197df3,
    'SQLBaseType', p_SQLBaseType_42fb4c197df3,
    'SQLFullType', p_SQLFullType_42fb4c197df3,
    'SourceEntityID', p_SourceEntityID_42fb4c197df3,
    'SourceFieldName', p_SourceFieldName_42fb4c197df3,
    'IsComputed', p_IsComputed_42fb4c197df3,
    'ComputationDescription', p_ComputationDescription_42fb4c197df3,
    'IsSummary', p_IsSummary_42fb4c197df3,
    'SummaryDescription', p_SummaryDescription_42fb4c197df3,
    'DetectionMethod', p_DetectionMethod_42fb4c197df3,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_42fb4c197df3,
    'ID', p_ID_42fb4c197df3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_42fb4c197df3, p_Name := p_Name_42fb4c197df3, p_Description := p_Description_42fb4c197df3, p_Sequence := p_Sequence_42fb4c197df3, p_SQLBaseType := p_SQLBaseType_42fb4c197df3, p_SQLFullType := p_SQLFullType_42fb4c197df3, p_SourceEntityID := p_SourceEntityID_42fb4c197df3, p_SourceFieldName := p_SourceFieldName_42fb4c197df3, p_IsComputed := p_IsComputed_42fb4c197df3, p_ComputationDescription := p_ComputationDescription_42fb4c197df3, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_42fb4c197df3, p_SummaryDescription := p_SummaryDescription_42fb4c197df3, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_42fb4c197df3, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_42fb4c197df3, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_42fb4c197df3);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_63753ece3bf5 UUID;
  p_Name_63753ece3bf5 VARCHAR(255);
  p_Description_63753ece3bf5 TEXT;
  p_Sequence_63753ece3bf5 INTEGER;
  p_SQLBaseType_63753ece3bf5 VARCHAR(50);
  p_SQLFullType_63753ece3bf5 VARCHAR(100);
  p_SourceEntityID_63753ece3bf5 UUID;
  p_SourceFieldName_63753ece3bf5 VARCHAR(255);
  p_IsComputed_63753ece3bf5 BOOLEAN;
  p_ComputationDescription_63753ece3bf5 TEXT;
  p_IsSummary_63753ece3bf5 BOOLEAN;
  p_SummaryDescription_63753ece3bf5 TEXT;
  p_DetectionMethod_63753ece3bf5 VARCHAR(50);
  p_AutoDetectConfidenceScore_63753ece3bf5 NUMERIC(3,2);
  p_ID_63753ece3bf5 UUID;
BEGIN
  p_QueryID_63753ece3bf5 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_63753ece3bf5 := 'StatusName';
  p_Description_63753ece3bf5 := 'DealStatusType (aliased as StatusName)';
  p_Sequence_63753ece3bf5 := 17;
  p_SQLBaseType_63753ece3bf5 := 'nvarchar';
  p_SQLFullType_63753ece3bf5 := 'nvarchar(200)';
  p_SourceEntityID_63753ece3bf5 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_63753ece3bf5 := 'DealStatusType';
  p_IsComputed_63753ece3bf5 := FALSE;
  p_IsSummary_63753ece3bf5 := FALSE;
  p_DetectionMethod_63753ece3bf5 := 'Manual';
  p_ID_63753ece3bf5 := '326FBB70-1FE2-4B5D-A536-BE61B1574FBC';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_63753ece3bf5,
    'Name', p_Name_63753ece3bf5,
    'Description', p_Description_63753ece3bf5,
    'Sequence', p_Sequence_63753ece3bf5,
    'SQLBaseType', p_SQLBaseType_63753ece3bf5,
    'SQLFullType', p_SQLFullType_63753ece3bf5,
    'SourceEntityID', p_SourceEntityID_63753ece3bf5,
    'SourceFieldName', p_SourceFieldName_63753ece3bf5,
    'IsComputed', p_IsComputed_63753ece3bf5,
    'ComputationDescription', p_ComputationDescription_63753ece3bf5,
    'IsSummary', p_IsSummary_63753ece3bf5,
    'SummaryDescription', p_SummaryDescription_63753ece3bf5,
    'DetectionMethod', p_DetectionMethod_63753ece3bf5,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_63753ece3bf5,
    'ID', p_ID_63753ece3bf5
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_63753ece3bf5, p_Name := p_Name_63753ece3bf5, p_Description := p_Description_63753ece3bf5, p_Sequence := p_Sequence_63753ece3bf5, p_SQLBaseType := p_SQLBaseType_63753ece3bf5, p_SQLFullType := p_SQLFullType_63753ece3bf5, p_SourceEntityID := p_SourceEntityID_63753ece3bf5, p_SourceFieldName := p_SourceFieldName_63753ece3bf5, p_IsComputed := p_IsComputed_63753ece3bf5, p_ComputationDescription := p_ComputationDescription_63753ece3bf5, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_63753ece3bf5, p_SummaryDescription := p_SummaryDescription_63753ece3bf5, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_63753ece3bf5, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_63753ece3bf5, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_63753ece3bf5);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_312779f011b9 UUID;
  p_Name_312779f011b9 VARCHAR(255);
  p_Description_312779f011b9 TEXT;
  p_Sequence_312779f011b9 INTEGER;
  p_SQLBaseType_312779f011b9 VARCHAR(50);
  p_SQLFullType_312779f011b9 VARCHAR(100);
  p_SourceEntityID_312779f011b9 UUID;
  p_SourceFieldName_312779f011b9 VARCHAR(255);
  p_IsComputed_312779f011b9 BOOLEAN;
  p_ComputationDescription_312779f011b9 TEXT;
  p_IsSummary_312779f011b9 BOOLEAN;
  p_SummaryDescription_312779f011b9 TEXT;
  p_DetectionMethod_312779f011b9 VARCHAR(50);
  p_AutoDetectConfidenceScore_312779f011b9 NUMERIC(3,2);
  p_ID_312779f011b9 UUID;
BEGIN
  p_QueryID_312779f011b9 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_312779f011b9 := 'OwnerEmployeeID';
  p_Description_312779f011b9 := 'OwnerEmployeeID';
  p_Sequence_312779f011b9 := 26;
  p_SQLBaseType_312779f011b9 := 'uniqueidentifier';
  p_SQLFullType_312779f011b9 := 'uniqueidentifier';
  p_SourceEntityID_312779f011b9 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_312779f011b9 := 'OwnerEmployeeID';
  p_IsComputed_312779f011b9 := FALSE;
  p_IsSummary_312779f011b9 := FALSE;
  p_DetectionMethod_312779f011b9 := 'Manual';
  p_ID_312779f011b9 := '6486850A-D086-446E-ABB3-DD46A0477A93';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_312779f011b9,
    'Name', p_Name_312779f011b9,
    'Description', p_Description_312779f011b9,
    'Sequence', p_Sequence_312779f011b9,
    'SQLBaseType', p_SQLBaseType_312779f011b9,
    'SQLFullType', p_SQLFullType_312779f011b9,
    'SourceEntityID', p_SourceEntityID_312779f011b9,
    'SourceFieldName', p_SourceFieldName_312779f011b9,
    'IsComputed', p_IsComputed_312779f011b9,
    'ComputationDescription', p_ComputationDescription_312779f011b9,
    'IsSummary', p_IsSummary_312779f011b9,
    'SummaryDescription', p_SummaryDescription_312779f011b9,
    'DetectionMethod', p_DetectionMethod_312779f011b9,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_312779f011b9,
    'ID', p_ID_312779f011b9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_312779f011b9, p_Name := p_Name_312779f011b9, p_Description := p_Description_312779f011b9, p_Sequence := p_Sequence_312779f011b9, p_SQLBaseType := p_SQLBaseType_312779f011b9, p_SQLFullType := p_SQLFullType_312779f011b9, p_SourceEntityID := p_SourceEntityID_312779f011b9, p_SourceFieldName := p_SourceFieldName_312779f011b9, p_IsComputed := p_IsComputed_312779f011b9, p_ComputationDescription := p_ComputationDescription_312779f011b9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_312779f011b9, p_SummaryDescription := p_SummaryDescription_312779f011b9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_312779f011b9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_312779f011b9, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_312779f011b9);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_99807e2d182f UUID;
  p_Name_99807e2d182f VARCHAR(255);
  p_Description_99807e2d182f TEXT;
  p_Sequence_99807e2d182f INTEGER;
  p_SQLBaseType_99807e2d182f VARCHAR(50);
  p_SQLFullType_99807e2d182f VARCHAR(100);
  p_SourceEntityID_99807e2d182f UUID;
  p_SourceFieldName_99807e2d182f VARCHAR(255);
  p_IsComputed_99807e2d182f BOOLEAN;
  p_ComputationDescription_99807e2d182f TEXT;
  p_IsSummary_99807e2d182f BOOLEAN;
  p_SummaryDescription_99807e2d182f TEXT;
  p_DetectionMethod_99807e2d182f VARCHAR(50);
  p_AutoDetectConfidenceScore_99807e2d182f NUMERIC(3,2);
  p_ID_99807e2d182f UUID;
BEGIN
  p_QueryID_99807e2d182f := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_99807e2d182f := 'ActualCloseDate';
  p_Description_99807e2d182f := 'ActualCloseDate';
  p_Sequence_99807e2d182f := 35;
  p_SQLBaseType_99807e2d182f := 'date';
  p_SQLFullType_99807e2d182f := 'date';
  p_SourceEntityID_99807e2d182f := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_99807e2d182f := 'ActualCloseDate';
  p_IsComputed_99807e2d182f := FALSE;
  p_IsSummary_99807e2d182f := FALSE;
  p_DetectionMethod_99807e2d182f := 'Manual';
  p_ID_99807e2d182f := '33E4832D-F4F8-40E6-AFF0-DD5BBCAF5D94';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_99807e2d182f,
    'Name', p_Name_99807e2d182f,
    'Description', p_Description_99807e2d182f,
    'Sequence', p_Sequence_99807e2d182f,
    'SQLBaseType', p_SQLBaseType_99807e2d182f,
    'SQLFullType', p_SQLFullType_99807e2d182f,
    'SourceEntityID', p_SourceEntityID_99807e2d182f,
    'SourceFieldName', p_SourceFieldName_99807e2d182f,
    'IsComputed', p_IsComputed_99807e2d182f,
    'ComputationDescription', p_ComputationDescription_99807e2d182f,
    'IsSummary', p_IsSummary_99807e2d182f,
    'SummaryDescription', p_SummaryDescription_99807e2d182f,
    'DetectionMethod', p_DetectionMethod_99807e2d182f,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_99807e2d182f,
    'ID', p_ID_99807e2d182f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_99807e2d182f, p_Name := p_Name_99807e2d182f, p_Description := p_Description_99807e2d182f, p_Sequence := p_Sequence_99807e2d182f, p_SQLBaseType := p_SQLBaseType_99807e2d182f, p_SQLFullType := p_SQLFullType_99807e2d182f, p_SourceEntityID := p_SourceEntityID_99807e2d182f, p_SourceFieldName := p_SourceFieldName_99807e2d182f, p_IsComputed := p_IsComputed_99807e2d182f, p_ComputationDescription := p_ComputationDescription_99807e2d182f, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_99807e2d182f, p_SummaryDescription := p_SummaryDescription_99807e2d182f, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_99807e2d182f, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_99807e2d182f, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_99807e2d182f);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_aa2fea38f40d UUID;
  p_Name_aa2fea38f40d VARCHAR(255);
  p_Description_aa2fea38f40d TEXT;
  p_Sequence_aa2fea38f40d INTEGER;
  p_SQLBaseType_aa2fea38f40d VARCHAR(50);
  p_SQLFullType_aa2fea38f40d VARCHAR(100);
  p_SourceEntityID_aa2fea38f40d UUID;
  p_SourceFieldName_aa2fea38f40d VARCHAR(255);
  p_IsComputed_aa2fea38f40d BOOLEAN;
  p_ComputationDescription_aa2fea38f40d TEXT;
  p_IsSummary_aa2fea38f40d BOOLEAN;
  p_SummaryDescription_aa2fea38f40d TEXT;
  p_DetectionMethod_aa2fea38f40d VARCHAR(50);
  p_AutoDetectConfidenceScore_aa2fea38f40d NUMERIC(3,2);
  p_ID_aa2fea38f40d UUID;
BEGIN
  p_QueryID_aa2fea38f40d := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_aa2fea38f40d := 'DealTypeName';
  p_Description_aa2fea38f40d := 'DealType (aliased as DealTypeName)';
  p_Sequence_aa2fea38f40d := 15;
  p_SQLBaseType_aa2fea38f40d := 'nvarchar';
  p_SQLFullType_aa2fea38f40d := 'nvarchar(200)';
  p_SourceEntityID_aa2fea38f40d := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_aa2fea38f40d := 'DealType';
  p_IsComputed_aa2fea38f40d := FALSE;
  p_IsSummary_aa2fea38f40d := FALSE;
  p_DetectionMethod_aa2fea38f40d := 'Manual';
  p_ID_aa2fea38f40d := '2D35403A-1B7C-4077-AA0C-E7A122A08140';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_aa2fea38f40d,
    'Name', p_Name_aa2fea38f40d,
    'Description', p_Description_aa2fea38f40d,
    'Sequence', p_Sequence_aa2fea38f40d,
    'SQLBaseType', p_SQLBaseType_aa2fea38f40d,
    'SQLFullType', p_SQLFullType_aa2fea38f40d,
    'SourceEntityID', p_SourceEntityID_aa2fea38f40d,
    'SourceFieldName', p_SourceFieldName_aa2fea38f40d,
    'IsComputed', p_IsComputed_aa2fea38f40d,
    'ComputationDescription', p_ComputationDescription_aa2fea38f40d,
    'IsSummary', p_IsSummary_aa2fea38f40d,
    'SummaryDescription', p_SummaryDescription_aa2fea38f40d,
    'DetectionMethod', p_DetectionMethod_aa2fea38f40d,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_aa2fea38f40d,
    'ID', p_ID_aa2fea38f40d
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_aa2fea38f40d, p_Name := p_Name_aa2fea38f40d, p_Description := p_Description_aa2fea38f40d, p_Sequence := p_Sequence_aa2fea38f40d, p_SQLBaseType := p_SQLBaseType_aa2fea38f40d, p_SQLFullType := p_SQLFullType_aa2fea38f40d, p_SourceEntityID := p_SourceEntityID_aa2fea38f40d, p_SourceFieldName := p_SourceFieldName_aa2fea38f40d, p_IsComputed := p_IsComputed_aa2fea38f40d, p_ComputationDescription := p_ComputationDescription_aa2fea38f40d, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_aa2fea38f40d, p_SummaryDescription := p_SummaryDescription_aa2fea38f40d, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_aa2fea38f40d, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_aa2fea38f40d, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_aa2fea38f40d);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_10290719eed6 UUID;
  p_Name_10290719eed6 VARCHAR(255);
  p_Description_10290719eed6 TEXT;
  p_Sequence_10290719eed6 INTEGER;
  p_SQLBaseType_10290719eed6 VARCHAR(50);
  p_SQLFullType_10290719eed6 VARCHAR(100);
  p_SourceEntityID_10290719eed6 UUID;
  p_SourceFieldName_10290719eed6 VARCHAR(255);
  p_IsComputed_10290719eed6 BOOLEAN;
  p_ComputationDescription_10290719eed6 TEXT;
  p_IsSummary_10290719eed6 BOOLEAN;
  p_SummaryDescription_10290719eed6 TEXT;
  p_DetectionMethod_10290719eed6 VARCHAR(50);
  p_AutoDetectConfidenceScore_10290719eed6 NUMERIC(3,2);
  p_ID_10290719eed6 UUID;
BEGIN
  p_QueryID_10290719eed6 := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_10290719eed6 := 'CurrencyID';
  p_Description_10290719eed6 := 'CurrencyID';
  p_Sequence_10290719eed6 := 29;
  p_SQLBaseType_10290719eed6 := 'uniqueidentifier';
  p_SQLFullType_10290719eed6 := 'uniqueidentifier';
  p_SourceEntityID_10290719eed6 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_10290719eed6 := 'CurrencyID';
  p_IsComputed_10290719eed6 := FALSE;
  p_IsSummary_10290719eed6 := FALSE;
  p_DetectionMethod_10290719eed6 := 'Manual';
  p_ID_10290719eed6 := 'D8BF844A-57D7-4298-9954-FB61CE09E840';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_10290719eed6,
    'Name', p_Name_10290719eed6,
    'Description', p_Description_10290719eed6,
    'Sequence', p_Sequence_10290719eed6,
    'SQLBaseType', p_SQLBaseType_10290719eed6,
    'SQLFullType', p_SQLFullType_10290719eed6,
    'SourceEntityID', p_SourceEntityID_10290719eed6,
    'SourceFieldName', p_SourceFieldName_10290719eed6,
    'IsComputed', p_IsComputed_10290719eed6,
    'ComputationDescription', p_ComputationDescription_10290719eed6,
    'IsSummary', p_IsSummary_10290719eed6,
    'SummaryDescription', p_SummaryDescription_10290719eed6,
    'DetectionMethod', p_DetectionMethod_10290719eed6,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_10290719eed6,
    'ID', p_ID_10290719eed6
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_10290719eed6, p_Name := p_Name_10290719eed6, p_Description := p_Description_10290719eed6, p_Sequence := p_Sequence_10290719eed6, p_SQLBaseType := p_SQLBaseType_10290719eed6, p_SQLFullType := p_SQLFullType_10290719eed6, p_SourceEntityID := p_SourceEntityID_10290719eed6, p_SourceFieldName := p_SourceFieldName_10290719eed6, p_IsComputed := p_IsComputed_10290719eed6, p_ComputationDescription := p_ComputationDescription_10290719eed6, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_10290719eed6, p_SummaryDescription := p_SummaryDescription_10290719eed6, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_10290719eed6, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_10290719eed6, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_10290719eed6);
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_QueryID_dccc04207a8b UUID;
  p_Name_dccc04207a8b VARCHAR(255);
  p_Description_dccc04207a8b TEXT;
  p_Sequence_dccc04207a8b INTEGER;
  p_SQLBaseType_dccc04207a8b VARCHAR(50);
  p_SQLFullType_dccc04207a8b VARCHAR(100);
  p_SourceEntityID_dccc04207a8b UUID;
  p_SourceFieldName_dccc04207a8b VARCHAR(255);
  p_IsComputed_dccc04207a8b BOOLEAN;
  p_ComputationDescription_dccc04207a8b TEXT;
  p_IsSummary_dccc04207a8b BOOLEAN;
  p_SummaryDescription_dccc04207a8b TEXT;
  p_DetectionMethod_dccc04207a8b VARCHAR(50);
  p_AutoDetectConfidenceScore_dccc04207a8b NUMERIC(3,2);
  p_ID_dccc04207a8b UUID;
BEGIN
  p_QueryID_dccc04207a8b := '5A1E5000-0001-4000-A000-00000000000D';
  p_Name_dccc04207a8b := 'ExpectedCloseDate';
  p_Description_dccc04207a8b := 'ExpectedCloseDate';
  p_Sequence_dccc04207a8b := 34;
  p_SQLBaseType_dccc04207a8b := 'date';
  p_SQLFullType_dccc04207a8b := 'date';
  p_SourceEntityID_dccc04207a8b := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_dccc04207a8b := 'ExpectedCloseDate';
  p_IsComputed_dccc04207a8b := FALSE;
  p_IsSummary_dccc04207a8b := FALSE;
  p_DetectionMethod_dccc04207a8b := 'Manual';
  p_ID_dccc04207a8b := '712B7D2C-839F-425D-9962-FF0517F8525E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQueryField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_data := jsonb_build_object(
    'QueryID', p_QueryID_dccc04207a8b,
    'Name', p_Name_dccc04207a8b,
    'Description', p_Description_dccc04207a8b,
    'Sequence', p_Sequence_dccc04207a8b,
    'SQLBaseType', p_SQLBaseType_dccc04207a8b,
    'SQLFullType', p_SQLFullType_dccc04207a8b,
    'SourceEntityID', p_SourceEntityID_dccc04207a8b,
    'SourceFieldName', p_SourceFieldName_dccc04207a8b,
    'IsComputed', p_IsComputed_dccc04207a8b,
    'ComputationDescription', p_ComputationDescription_dccc04207a8b,
    'IsSummary', p_IsSummary_dccc04207a8b,
    'SummaryDescription', p_SummaryDescription_dccc04207a8b,
    'DetectionMethod', p_DetectionMethod_dccc04207a8b,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_dccc04207a8b,
    'ID', p_ID_dccc04207a8b
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQueryField"(p_QueryID := p_QueryID_dccc04207a8b, p_Name := p_Name_dccc04207a8b, p_Description := p_Description_dccc04207a8b, p_Sequence := p_Sequence_dccc04207a8b, p_SQLBaseType := p_SQLBaseType_dccc04207a8b, p_SQLFullType := p_SQLFullType_dccc04207a8b, p_SourceEntityID := p_SourceEntityID_dccc04207a8b, p_SourceFieldName := p_SourceFieldName_dccc04207a8b, p_IsComputed := p_IsComputed_dccc04207a8b, p_ComputationDescription := p_ComputationDescription_dccc04207a8b, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_dccc04207a8b, p_SummaryDescription := p_SummaryDescription_dccc04207a8b, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_dccc04207a8b, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_dccc04207a8b, p_AutoDetectConfidenceScore_Clear := TRUE, p_ID := p_ID_dccc04207a8b);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_27022684d21c UUID;
  p_QueryID_27022684d21c UUID;
  p_EntityID_27022684d21c UUID;
  p_DetectionMethod_27022684d21c VARCHAR(50);
  p_AutoDetectConfidenceScore_27022684d21c NUMERIC(3,2);
BEGIN
  p_ID_27022684d21c := '02f1c50d-76b5-4041-a4b2-72b8dc9cdeb9';
  p_QueryID_27022684d21c := '5A1E5000-0001-4000-A000-00000000000D';
  p_EntityID_27022684d21c := 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';
  p_DetectionMethod_27022684d21c := 'AI';
  p_AutoDetectConfidenceScore_27022684d21c := 1;
  p_QueryID_27022684d21c := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Deal Roster' ORDER BY CASE WHEN "ID" = p_QueryID_27022684d21c THEN 0 ELSE 1 END LIMIT 1), p_QueryID_27022684d21c);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_27022684d21c
                  OR ("QueryID" = p_QueryID_27022684d21c AND "EntityID" = p_EntityID_27022684d21c)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_27022684d21c,
      'QueryID', p_QueryID_27022684d21c,
      'EntityID', p_EntityID_27022684d21c,
      'DetectionMethod', p_DetectionMethod_27022684d21c,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_27022684d21c
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_27022684d21c, p_QueryID := p_QueryID_27022684d21c, p_EntityID := p_EntityID_27022684d21c, p_DetectionMethod := p_DetectionMethod_27022684d21c, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_27022684d21c);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_2e889650e48e VARCHAR(255);
  p_CategoryID_2e889650e48e UUID;
  p_UserQuestion_2e889650e48e TEXT;
  p_Description_2e889650e48e TEXT;
  p_SQL_2e889650e48e TEXT;
  p_TechnicalDescription_2e889650e48e TEXT;
  p_OriginalSQL_2e889650e48e TEXT;
  p_Feedback_2e889650e48e TEXT;
  p_Status_2e889650e48e VARCHAR(15);
  p_QualityRank_2e889650e48e INTEGER;
  p_ExecutionCostRank_2e889650e48e INTEGER;
  p_UsesTemplate_2e889650e48e BOOLEAN;
  p_AuditQueryRuns_2e889650e48e BOOLEAN;
  p_CacheEnabled_2e889650e48e BOOLEAN;
  p_CacheTTLMinutes_2e889650e48e INTEGER;
  p_CacheMaxSize_2e889650e48e INTEGER;
  p_EmbeddingVector_2e889650e48e TEXT;
  p_EmbeddingModelID_2e889650e48e UUID;
  p_CacheValidationSQL_2e889650e48e TEXT;
  p_SQLDialectID_2e889650e48e UUID;
  p_Reusable_2e889650e48e BOOLEAN;
  p_ExternalDataSourceID_2e889650e48e UUID;
  p_IsMaterialized_2e889650e48e BOOLEAN;
  p_ID_2e889650e48e UUID;
BEGIN
  p_Name_2e889650e48e := 'Sales: Forecast by Category';
  p_CategoryID_2e889650e48e := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_2e889650e48e := 'What are we calling commit, best case and pipeline for this period?';
  p_Description_2e889650e48e := 'Forecast rollup by ForecastCategoryType (master plan §9.3 measure 3). The three buckets are OVERLAPPING, not a partition — one category normally sets more than one flag, because commit is the floor of the forecast rather than a slice of it. Adding the three columns together produces a meaningless number; they are separate SUMs for that reason.';
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
       AND fc.IsActive = 1
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
  p_TechnicalDescription_2e889650e48e := 'Grain: Deal. Buckets come from ForecastCategoryType.IncludeInCommit / IncludeInBestCase / IncludeInPipeline — §9.3 says "never a string comparison" and this is that requirement. Dates: open deals placed by ExpectedCloseDate, won deals by ActualCloseDate, same window. UncategorizedOpenCount surfaces open deals with no forecast category rather than dropping them silently. Open deals in pipelines with IncludeInForecast = 0 are excluded unless PipelineID names the pipeline; their won deals still count toward ClosedWonAmount.';
  p_Status_2e889650e48e := 'Approved';
  p_QualityRank_2e889650e48e := 8;
  p_ExecutionCostRank_2e889650e48e := 2;
  p_UsesTemplate_2e889650e48e := TRUE;
  p_AuditQueryRuns_2e889650e48e := FALSE;
  p_CacheEnabled_2e889650e48e := FALSE;
  p_EmbeddingVector_2e889650e48e := '[0.0009836922399699688,0.05107390880584717,-0.010610779747366905,-0.06135861203074455,0.0029259338043630123,0.0068313926458358765,0.058007508516311646,-0.052011724561452866,-0.0500379279255867,0.008734645321965218,0.026388870552182198,-0.03263113275170326,0.01717759110033512,0.09960772097110748,-0.009669342078268528,-0.038823794573545456,0.03282827511429787,0.004229814279824495,-0.03343166410923004,0.004035876132547855,0.00881910976022482,0.004708742722868919,-0.03216884285211563,0.026877829805016518,-0.013291748240590096,-0.013953395187854767,0.0073156035505235195,-0.021216727793216705,-0.047997985035181046,-0.0466122180223465,0.0553121455013752,-0.004002721980214119,0.029730090871453285,0.03736526519060135,0.0000027071375825471478,-0.0068209487944841385,-0.060416802763938904,-0.017280079424381256,0.008617081679403782,-0.017673049122095108,-0.010045072995126247,-0.09396915882825851,0.014631420373916626,-0.00869253370910883,0.008307510986924171,0.04437674209475517,-0.004506929777562618,0.05586807802319527,0.007117223460227251,-0.0283201914280653,0.03284839913249016,-0.02908128686249256,-0.03996241092681885,-0.007679375819861889,-0.01824304647743702,-0.007247083354741335,-0.012713301926851273,-0.05867450684309006,-0.04058491066098213,-0.09044202417135239,-0.03701682388782501,-0.023796260356903076,0.012087596580386162,-0.01713581196963787,0.06403233110904694,0.029701923951506615,0.04902320355176926,-0.06269900500774384,-0.0001271919609280303,-0.04497142136096954,0.08560262620449066,-0.005537688732147217,-0.0038585285656154156,-0.006847595330327749,0.009617399424314499,-0.04354410618543625,-0.0745384693145752,0.03340810909867287,-0.004875344689935446,-0.029210014268755913,-0.011425844393670559,0.06758373230695724,-0.035094305872917175,-0.006089933682233095,-0.05369746685028076,0.05742303282022476,-0.03556705638766289,-0.020162848755717278,-0.012683299370110035,-0.016873721033334732,0.02349952794611454,-0.004884334281086922,-0.018245261162519455,-0.0034422094468027353,-0.07359694689512253,-0.006631298456341028,0.014835200272500515,0.06069603189826012,-0.00042818739893846214,-0.03784068301320076,0.04546996206045151,0.025950830429792404,0.039763037115335464,0.023468447849154472,0.042745158076286316,0.028824299573898315,0.005247421562671661,-0.005022250581532717,-0.017172228544950485,0.011940857395529747,-0.023854365572333336,-0.0017573251388967037,0.014920324087142944,0.01512855663895607,-0.006090865936130285,0.017554953694343567,-0.03456496819853783,-0.001515391282737255,-0.06694556772708893,0.0027579746674746275,0.11829718947410583,-0.014293273910880089,-0.05520116537809372,0.004444547463208437,0.0082981763407588,0.0005989440833218396,-0.043499428778886795,0.011244201101362705,-0.002729992615059018,0.053487155586481094,-0.02105106972157955,-0.02790333889424801,0.0034912305418401957,-0.011461715213954449,-0.03188356012105942,-0.03196059539914131,0.005596557166427374,0.03929309919476509,-0.04700557142496109,-0.03891563042998314,-0.0018819896504282951,0.004917967598885298,-0.023166608065366745,0.036073531955480576,0.01986565813422203,-0.044221412390470505,0.0077253663912415504,0.07532582432031631,-0.00878082774579525,-0.009020872414112091,-0.025170298293232918,-0.03751954063773155,-0.03386232256889343,-0.007084739860147238,-0.003626528661698103,0.02587626315653324,0.013117002323269844,-0.004374439362436533,-0.014642181806266308,0.06136460602283478,-0.002635212615132332,-0.023818060755729675,0.023020921275019646,-0.038281068205833435,-0.03396785259246826,0.001229483517818153,-0.050592344254255295,-0.006750802509486675,-0.10347925126552582,-0.051550474017858505,0.014837071299552917,-0.06234343722462654,-0.00031837623100727797,-0.013594405725598335,-0.009662375785410404,0.004141888115555048,0.06902159750461578,0.061891451478004456,-0.020706782117486,-0.03591479733586311,-0.030698077753186226,-0.05985322594642639,0.01827581413090229,0.004835430532693863,-0.029192602261900902,-0.02217230387032032,-0.012715904042124748,-0.053347405046224594,-0.01215409580618143,0.0034063165076076984,0.019813094288110733,0.02705317921936512,-0.10297346860170364,-0.003578879637643695,-0.017637204378843307,0.004395066760480404,0.048332445323467255,0.03773985803127289,0.0002142107841791585,0.026563331484794617,0.00930387619882822,-0.005400005262345076,-0.004000209271907806,0.025028573349118233,-0.01080290786921978,-0.016780808568000793,-0.05311591178178787,-0.014107703231275082,0.04698285460472107,0.002680467674508691,0.025793392211198807,0.013228186406195164,-0.024225300177931786,0.022763438522815704,-0.006011818069964647,0.034541256725788116,0.043815601617097855,0.021394221112132072,-0.07270831614732742,-0.04464436694979668,-0.030489394441246986,0.03206845000386238,-0.006915970705449581,-0.0021340958774089813,0.0670875757932663,0.04396579787135124,0.024432674050331116,-0.019768672063946724,0.03147551789879799,-0.020018847659230232,-0.007422853261232376,0.025014586746692657,0.048046812415122986,-0.011647487990558147,-0.01810731366276741,0.07279755920171738,0.00197081221267581,0.1060013398528099,-0.00975838489830494,0.08794247359037399,0.01627899706363678,-0.11047888547182083,0.001904620905406773,-0.003888667095452547,0.09228158742189407,-0.028394345194101334,-0.026874994859099388,-0.01216609962284565,0.015407082624733448,-0.000812069047242403,-0.038553472608327866,0.0430213138461113,0.0020703421905636787,-0.03668039292097092,0.005521934013813734,-0.04207513853907585,-0.10680346935987473,-0.0032285626512020826,0.060348257422447205,0.0872960165143013,0.060139384120702744,-0.01590387336909771,0.002409304492175579,0.0013880066107958555,-0.022170789539813995,-0.026945849880576134,-0.00030310568399727345,0.01718592457473278,-0.002050501061603427,-0.0009126980439759791,0.006104857195168734,0.005658012814819813,-0.022941812872886658,-0.014909634366631508,0.001731873955577612,0.029132647439837456,-0.056168995797634125,-0.024593491107225418,0.025219419971108437,-0.04351577162742615,0.005055223125964403,-0.008743506856262684,0.01329311728477478,0.0022573135793209076,0.009507906623184681,0.035187043249607086,0.02220975048840046,-0.048732150346040726,-0.05106859654188156,-0.12674161791801453,-0.0395687036216259,-0.01499753538519144,-0.017186041921377182,-0.0030020305421203375,-0.06364113837480545,-0.013181120157241821,-0.02878362126648426,0.018070977181196213,0.03399334475398064,0.042872875928878784,-0.012312335893511772,-0.004404727835208178,-0.010866397991776466,0.010808444581925869,-0.0285950917750597,-0.03157900646328926,0.024029411375522614,0.0011471452889963984,0.009833604097366333,0.028476914390921593,0.03854759410023689,0.00314514827914536,-0.02569303661584854,-0.002825556555762887,-0.009978697635233402,-0.04394439607858658,-0.025743242353200912,-0.008217396214604378,-0.007725318428128958,0.09262888878583908,0.0011097794631496072,-0.005520817823708057,-0.02279467135667801,0.026060719043016434,-0.01287351455539465,-0.0008971428615041077,-0.07252523303031921,-0.03217928856611252,-0.06876297295093536,-0.02836376242339611,0.012340293265879154,-0.08357523381710052,-0.04097332805395126,0.009261553175747395,-0.0074693262577056885,-0.07246676832437515,-0.008724876679480076,-0.0026861801743507385,0.0029631052166223526,-0.02547573298215866,-0.010618523694574833,0.006383489817380905,0.01955077238380909,-0.007463366724550724,0.0052040861919522285,0.009676624089479446,0.003428206080570817,0.021619560196995735,-0.09996213018894196,0.036495208740234375,0.006011275574564934,0.017473284155130386,-0.026613980531692505,-0.032761070877313614,-0.017298046499490738,-0.05509180575609207,-0.010899953544139862,0.012709562666714191,-0.0317135751247406,-0.06176278740167618,-0.010134524665772915,0.02391849271953106,0.03786792606115341,0.06512302160263062,-0.020969657227396965,0.030245784670114517,0.04557385295629501,-0.033925801515579224,0.029069213196635246,-0.03476874530315399,-0.011877032928168774,-0.008464674465358257,0.03183785453438759,0.0630914717912674,-0.005159628577530384,-0.032021116465330124,0.012772082351148129,0.01643156073987484,0.0356033556163311,0.017063766717910767,0.010090433992445469,0.04179557412862778,0.06685160100460052,0.009853905998170376,0.004175286740064621,-0.020525099709630013,-0.08900647610425949,-0.05510801821947098,-0.012276790104806423,0.034964669495821,0.027135148644447327,0.021564247086644173,-0.005694357678294182,-0.04816935583949089,0.00974937155842781,-0.019983094185590744,-0.043110258877277374,0.007524588145315647,0.006911777425557375,-0.008701079525053501,0.04951424151659012,-0.004146344028413296,0.04247048869729042,0.0005454210331663489,0.0207488052546978,-0.06289061158895493,-0.03753117471933365,0.011421668343245983,-0.03603547066450119,0.0037279624957591295,0.031986769288778305,-0.0724823996424675,0.03148535639047623,0.011850578710436821,0.0069514368660748005,-0.02950034849345684,0.015629956498742104,0.027421699836850166,0.01491477806121111,0.004321520682424307,0.05136776342988014,0.0163421593606472,0.03443411737680435,-0.00913242157548666,-0.024473121389746666,-0.019545555114746094,0.0600803941488266,-0.060173917561769485,0.008860326372087002,-0.003568878397345543,-0.007761069573462009,0.02834143117070198,-0.0460418164730072,0.028392167761921883,-0.0063425758853554726,0.0710301622748375,0.009670120663940907,0.0007689727353863418,-0.05305006727576256,0.039747536182403564,0.005379737354815006,0.006874020677059889,0.05260579288005829,0.00012376593076623976,0.00826204102486372,-0.020219549536705017,-0.015562216751277447,-0.045052360743284225,-0.060764919966459274,0.004504195414483547,0.039146289229393005,-0.063161700963974,0.036779556423425674,-0.01012572180479765,0.03413979709148407,-0.04729805141687393,-0.08102688938379288,-0.004418490920215845,-0.03968865051865578,0.029053611680865288,0.022556284442543983,0.025939712300896645,-0.07884291559457779,0.01919388957321644,0.004869489930570126,0.010483680292963982,0.0677448958158493,-0.04032333940267563,0.034792352467775345,-0.023765187710523605,-0.016947392374277115,-0.024982979521155357,-0.018647326156497,0.021895386278629303,0.03399797901511192,-0.024632059037685394,-0.02590486966073513,0.0025144298560917377,0.04254572093486786,-0.01599770598113537,-0.08040965348482132,0.03770299255847931,0.003755353856831789,-0.08384202420711517,-0.010222317650914192,0.035826150327920914,0.04902493208646774,-0.017473777756094933,0.009745797142386436,-0.0006258792127482593,0.03690922632813454,-0.06885378807783127,-0.02312382124364376,0.11824218183755875,0.006190018262714148,-0.03177517279982567,0.05012160912156105,-0.0632484033703804,0.023563647642731667,0.04403272271156311,-0.05384019389748573,0.017014792189002037,-0.004568709526211023,-0.055932678282260895,-0.013247684575617313,0.03092724271118641,0.06479630619287491,0.024925384670495987,-0.01197521761059761,0.02102820575237274,0.019129909574985504,0.02190842665731907,-0.04853077977895737,-0.05251467972993851,0.028012715280056,-0.022905495017766953,-0.055271461606025696,-0.006406120490282774,-0.037009548395872116,0.012361397035419941,0.008352949284017086,0.0027406332083046436,0.016778208315372467,-0.0011602259473875165,0.04853374883532524,-0.013951892964541912,0.0004244748561177403,-0.02290654368698597,-0.039407070726156235,0.04185454174876213,0.05866429582238197,0.016661593690514565,-0.03604356572031975,0.023567911237478256,-0.013208032585680485,-0.03785552829504013,-0.016871068626642227,0.04251813516020775,0.060100991278886795,-0.0006819934933446348,-0.07468325644731522,0.04610274359583855,0.059230923652648926,-0.009169772267341614,0.02693561278283596,-0.02220468409359455,-0.042316336184740067,0.016747022047638893,-0.01624186523258686,0.03793952986598015,0.03296489641070366,-0.051514603197574615,-0.0372854582965374,0.011095494963228703,-0.00019874022109434009,-8.16303611360909e-33,-0.044364020228385925,-0.03571202978491783,-0.010433346964418888,-0.06292840838432312,-0.02280418574810028,-0.02492101863026619,0.05013258382678032,-0.020839162170886993,0.010966986417770386,-0.05441609025001526,-0.010385556146502495,0.005406836047768593,0.01710190437734127,-0.008233719505369663,0.0769791305065155,0.039005450904369354,0.02456466108560562,-0.02599792182445526,-0.012668564915657043,0.03362163156270981,0.004561860114336014,0.02121686190366745,0.027555562555789948,0.021310534328222275,-0.024356061592698097,0.0670442059636116,-0.009451386518776417,0.01511853002011776,0.04300780966877937,-0.006442324258387089,0.03270915523171425,-0.04011867940425873,0.03528242185711861,0.01741899363696575,-0.021706897765398026,-0.01742732897400856,0.04223823919892311,-0.04561265558004379,-0.003985104616731405,-0.027992118149995804,-0.00424513965845108,0.010955254547297955,-0.0033182003535330296,0.03496663644909859,-0.020747844129800797,-0.0483456626534462,0.01220716629177332,-0.026412049308419228,-0.023087047040462494,-0.023232361301779747,0.0353219173848629,0.014199508354067802,-0.00892060436308384,0.05854836106300354,0.02282455936074257,0.0758209079504013,0.03709167614579201,0.07167313247919083,0.011525828391313553,0.042045239359140396,-0.0314190648496151,0.04580572620034218,0.009617159143090248,0.01167239435017109,-0.021278467029333115,0.002915658988058567,-0.005163147579878569,0.03120291233062744,-0.029432324692606926,0.012355834245681763,0.003962961956858635,0.08610974252223969,0.007431853096932173,-0.01799657754600048,0.10183820128440857,-0.00763827096670866,0.04773593321442604,0.02821815200150013,-0.00048564589815214276,0.02590971440076828,-0.020472154021263123,-0.015334514901041985,-0.026059551164507866,0.003223702311515808,-0.011710338294506073,-0.032018620520830154,-0.03103754110634327,0.0720684826374054,0.018043581396341324,0.02753675915300846,0.013964052312076092,0.10336314141750336,-0.03158046677708626,0.04379761964082718,-0.003045290242880583,0.046240635216236115,0.0735592469573021,-0.0009337522205896676,0.004828308243304491,0.019492920488119125,-0.056539036333560944,0.008001317270100117,0.041802871972322464,0.034640733152627945,-0.028448615223169327,0.021199172362685204,0.06966709345579147,-0.010992055758833885,-0.04639119654893875,0.001610860344953835,0.023057203739881516,0.03714898228645325,0.014346428215503693,0.03247231990098953,0.04007646441459656,-0.021772846579551697,0.014810948632657528,-0.027850374579429626,-0.01827659271657467,-0.01832527294754982,0.020144905894994736,0.12180817127227783,-0.022164611145853996,0.03226613998413086,0.04236331209540367,-0.024371782317757607,-0.0027516200207173824,-0.08444712311029434,0.006587819661945105,-0.02501036413013935,-0.003447825787588954,0.01050300057977438,3.529762580001261e-7,-0.027460584416985512,0.003042493248358369,-0.020908774808049202,0.029107632115483284,0.0659252181649208,0.002770782448351383,-0.004684775602072477,0.030849827453494072,0.03066294454038143,-0.019523657858371735,0.0047467369586229324,-0.038171421736478806,0.02824208326637745,0.03728405758738518,0.0047443401999771595,-0.06114577874541283,-0.03003140538930893,0.02533312700688839,-0.09731388837099075,-0.004170054569840431,0.031127402558922768,0.03651750832796097,0.04148540273308754,-0.006713529583066702,0.008015675470232964,-0.011610888876020908,-0.03554189205169678,-0.034421537071466446,0.037103522568941116,0.06641656160354614,0.0234299898147583,0.03770921006798744,-0.009169437922537327,0.0009919125586748123,-0.012634898535907269,0.012517358176410198,-0.04899974167346954,0.002707832958549261,0.00926522072404623,-0.015318437479436398,0.0167370717972517,0.028533725067973137,-0.036012914031744,-0.014027680270373821,-0.014065885916352272,0.012560936622321606,0.012026377953588963,-0.01647813804447651,-0.020750558003783226,0.02109720930457115,0.021813595667481422,0.007055500987917185,-0.014900118112564087,0.04027217626571655,0.02724887616932392,0.021018989384174347,0.013899097219109535,0.01109645888209343,0.043360982090234756,-0.021998297423124313,-0.010328725911676884,0.008031941950321198,0.01403845939785242,0.061004918068647385,0.020411139354109764,-0.06426756829023361,-0.015095118433237076,3.6530456823195173e-34,0.02778865024447441,0.005393844563513994,0.022324824705719948,-0.053942203521728516,0.03193380683660507,-0.018428530544042587,0.05170338600873947,-0.016067752614617348,-0.02322085201740265,0.004239881411194801,-0.019735034555196762]';
  p_EmbeddingModelID_2e889650e48e := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_2e889650e48e := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_2e889650e48e := FALSE;
  p_IsMaterialized_2e889650e48e := FALSE;
  p_ID_2e889650e48e := '5A1E5000-0001-4000-A000-000000000002';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_2e889650e48e,
    'CategoryID', p_CategoryID_2e889650e48e,
    'UserQuestion', p_UserQuestion_2e889650e48e,
    'Description', p_Description_2e889650e48e,
    'SQL', p_SQL_2e889650e48e,
    'TechnicalDescription', p_TechnicalDescription_2e889650e48e,
    'OriginalSQL', p_OriginalSQL_2e889650e48e,
    'Feedback', p_Feedback_2e889650e48e,
    'Status', p_Status_2e889650e48e,
    'QualityRank', p_QualityRank_2e889650e48e,
    'ExecutionCostRank', p_ExecutionCostRank_2e889650e48e,
    'UsesTemplate', p_UsesTemplate_2e889650e48e,
    'AuditQueryRuns', p_AuditQueryRuns_2e889650e48e,
    'CacheEnabled', p_CacheEnabled_2e889650e48e,
    'CacheTTLMinutes', p_CacheTTLMinutes_2e889650e48e,
    'CacheMaxSize', p_CacheMaxSize_2e889650e48e,
    'EmbeddingVector', p_EmbeddingVector_2e889650e48e,
    'EmbeddingModelID', p_EmbeddingModelID_2e889650e48e,
    'CacheValidationSQL', p_CacheValidationSQL_2e889650e48e,
    'SQLDialectID', p_SQLDialectID_2e889650e48e,
    'Reusable', p_Reusable_2e889650e48e,
    'ExternalDataSourceID', p_ExternalDataSourceID_2e889650e48e,
    'IsMaterialized', p_IsMaterialized_2e889650e48e,
    'ID', p_ID_2e889650e48e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_2e889650e48e, p_CategoryID := p_CategoryID_2e889650e48e, p_UserQuestion := p_UserQuestion_2e889650e48e, p_Description := p_Description_2e889650e48e, p_SQL := p_SQL_2e889650e48e, p_TechnicalDescription := p_TechnicalDescription_2e889650e48e, p_OriginalSQL := p_OriginalSQL_2e889650e48e, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_2e889650e48e, p_Feedback_Clear := TRUE, p_Status := p_Status_2e889650e48e, p_QualityRank := p_QualityRank_2e889650e48e, p_ExecutionCostRank := p_ExecutionCostRank_2e889650e48e, p_UsesTemplate := p_UsesTemplate_2e889650e48e, p_AuditQueryRuns := p_AuditQueryRuns_2e889650e48e, p_CacheEnabled := p_CacheEnabled_2e889650e48e, p_CacheTTLMinutes := p_CacheTTLMinutes_2e889650e48e, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_2e889650e48e, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_2e889650e48e, p_EmbeddingModelID := p_EmbeddingModelID_2e889650e48e, p_CacheValidationSQL := p_CacheValidationSQL_2e889650e48e, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_2e889650e48e, p_Reusable := p_Reusable_2e889650e48e, p_ExternalDataSourceID := p_ExternalDataSourceID_2e889650e48e, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_2e889650e48e, p_ID := p_ID_2e889650e48e);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_91eee0d04643 UUID;
  p_QueryID_91eee0d04643 UUID;
  p_EntityID_91eee0d04643 UUID;
  p_DetectionMethod_91eee0d04643 VARCHAR(50);
  p_AutoDetectConfidenceScore_91eee0d04643 NUMERIC(3,2);
BEGIN
  p_ID_91eee0d04643 := '1fa26bdb-d524-4f3f-8764-cb7bb84ef053';
  p_QueryID_91eee0d04643 := '5A1E5000-0001-4000-A000-000000000002';
  p_EntityID_91eee0d04643 := 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';
  p_DetectionMethod_91eee0d04643 := 'AI';
  p_AutoDetectConfidenceScore_91eee0d04643 := 1;
  p_QueryID_91eee0d04643 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Forecast by Category' ORDER BY CASE WHEN "ID" = p_QueryID_91eee0d04643 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_91eee0d04643);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_91eee0d04643
                  OR ("QueryID" = p_QueryID_91eee0d04643 AND "EntityID" = p_EntityID_91eee0d04643)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_91eee0d04643,
      'QueryID', p_QueryID_91eee0d04643,
      'EntityID', p_EntityID_91eee0d04643,
      'DetectionMethod', p_DetectionMethod_91eee0d04643,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_91eee0d04643
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_91eee0d04643, p_QueryID := p_QueryID_91eee0d04643, p_EntityID := p_EntityID_91eee0d04643, p_DetectionMethod := p_DetectionMethod_91eee0d04643, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_91eee0d04643);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_4502e037ceee VARCHAR(255);
  p_CategoryID_4502e037ceee UUID;
  p_UserQuestion_4502e037ceee TEXT;
  p_Description_4502e037ceee TEXT;
  p_SQL_4502e037ceee TEXT;
  p_TechnicalDescription_4502e037ceee TEXT;
  p_OriginalSQL_4502e037ceee TEXT;
  p_Feedback_4502e037ceee TEXT;
  p_Status_4502e037ceee VARCHAR(15);
  p_QualityRank_4502e037ceee INTEGER;
  p_ExecutionCostRank_4502e037ceee INTEGER;
  p_UsesTemplate_4502e037ceee BOOLEAN;
  p_AuditQueryRuns_4502e037ceee BOOLEAN;
  p_CacheEnabled_4502e037ceee BOOLEAN;
  p_CacheTTLMinutes_4502e037ceee INTEGER;
  p_CacheMaxSize_4502e037ceee INTEGER;
  p_EmbeddingVector_4502e037ceee TEXT;
  p_EmbeddingModelID_4502e037ceee UUID;
  p_CacheValidationSQL_4502e037ceee TEXT;
  p_SQLDialectID_4502e037ceee UUID;
  p_Reusable_4502e037ceee BOOLEAN;
  p_ExternalDataSourceID_4502e037ceee UUID;
  p_IsMaterialized_4502e037ceee BOOLEAN;
  p_ID_4502e037ceee UUID;
BEGIN
  p_Name_4502e037ceee := 'Sales: Forecast by Owner';
  p_CategoryID_4502e037ceee := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_4502e037ceee := 'What is each owner''s commit, best case and pipeline for this period, and what have they closed?';
  p_Description_4502e037ceee := 'The live forecast at OWNER grain — the companion to Sales: Forecast History, which partitions its movement windows by OwnerEmployeeID and so expects owner-grained rows. Sales: Forecast by Category groups by company and pipeline only, so a forecast review could read an owner''s history with no current number to compare it against. Added as a companion rather than by widening that query''s GROUP BY, because the dashboard consumes it and changing a report''s row shape to serve a second consumer is how one breaks the other. ADDITIVITY: every amount and count totals correctly across rows, because the owner stamp puts each deal on exactly one row. The three forecast buckets still overlap with EACH OTHER by design and must never be added together.';
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
       AND fc.IsActive = 1
LEFT OUTER JOIN [${mjSchema}].Employee emp
        ON emp.ID = d.OwnerEmployeeID
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
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline
ORDER BY
    CommitAmount DESC, OwnerName;
';
  p_TechnicalDescription_4502e037ceee := 'Grain: Deal, grouped by Deal.OwnerEmployeeID. §9.4 ATTRIBUTION BASIS: the server-maintained owner stamp, NOT a DealTeamMember join — joining the team table would multiply every deal by its team size, so the seeded won deal''s 27,480 would land in three owners'' commit figures and total 82,440. It also matches capture-forecast-snapshot.sql, which groups by the same stamp, so this query and the history it is compared against slice the world identically. This is deliberately different from Sales: Bookings by Owner, which reads DealTeamMember filtered to DealRole.IsOwnerRole: that is a reconciling revenue figure and must not depend on a denormalised copy, whereas this groups deals BY an owner rather than attributing revenue TO one. Buckets branch on ForecastCategoryType.IncludeInCommit / IncludeInBestCase / IncludeInPipeline — flags, never names. Dates: open deals placed by ExpectedCloseDate, won deals by ActualCloseDate. Unowned deals appear as ''(unassigned)'' rather than being dropped: forecast nobody is accountable for is what a forecast review most needs to see. Open deals in pipelines with IncludeInForecast = 0 are excluded unless PipelineID names the pipeline; their won deals still count toward ClosedWonAmount.';
  p_Status_4502e037ceee := 'Approved';
  p_QualityRank_4502e037ceee := 9;
  p_ExecutionCostRank_4502e037ceee := 2;
  p_UsesTemplate_4502e037ceee := TRUE;
  p_AuditQueryRuns_4502e037ceee := FALSE;
  p_CacheEnabled_4502e037ceee := FALSE;
  p_EmbeddingVector_4502e037ceee := '[-0.026718098670244217,0.1389387995004654,-0.016619890928268433,-0.0374491922557354,-0.027437305077910423,-0.00009194370068144053,0.050369951874017715,-0.04477844759821892,-0.0039549036882817745,0.0075345514342188835,-0.02269877679646015,-0.0169987753033638,0.008429400622844696,0.08598653227090836,-0.018248530104756355,0.02273954264819622,0.003394987201318145,0.019939344376325607,-0.007298621349036694,-0.017429441213607788,0.0180802159011364,0.003485917579382658,-0.028964942321181297,0.0064721014350652695,-0.03144662082195282,0.008986230008304119,0.01336667314171791,-0.0175528135150671,0.0018672035075724125,-0.07886607944965363,0.02868247590959072,0.03894731029868126,0.008776761591434479,0.05262579396367073,0.0000027809637686004862,0.002742197597399354,-0.04253527522087097,0.020026063546538353,0.020294347777962685,0.03693072870373726,0.0473640114068985,-0.08229285478591919,0.03339334949851036,-0.01021585799753666,-0.011640737764537334,-0.0012727255234494805,-0.06002616137266159,0.053839392960071564,-0.004293890669941902,-0.019310908392071724,0.02598540484905243,-0.009141993708908558,-0.023295044898986816,-0.015211088582873344,0.059713661670684814,-0.07567155361175537,-0.008303612470626831,-0.043868500739336014,-0.001579086296260357,-0.09566526859998703,-0.06366544961929321,0.013247759081423283,0.023767029866576195,-0.041995204985141754,0.056069303303956985,0.02307761088013649,0.07624655216932297,-0.04100053384900093,-0.017160004004836082,-0.027029111981391907,0.11080111563205719,0.03837447613477707,-0.020348405465483665,-0.026679983362555504,0.017798874527215958,-0.04404813051223755,-0.03884345293045044,0.027182791382074356,0.000951603869907558,-0.005929484963417053,-0.051606640219688416,0.10713807493448257,-0.03813789412379265,0.023282304406166077,-0.0724232867360115,0.08443967252969742,-0.02314455807209015,-0.003162756096571684,-0.0377829410135746,0.015572085045278072,0.11370784789323807,-0.0025644858833402395,-0.007747071795165539,-0.03126711770892143,-0.04878847673535347,-0.005570446606725454,0.017991995438933372,0.05114353448152542,-0.004445332568138838,-0.045701853930950165,0.010348247364163399,0.03288518637418747,-0.013441856019198895,0.023731578141450882,0.02933989278972149,0.00686481362208724,0.01994575746357441,-0.016588497906923294,0.01565793715417385,0.013611560687422752,-0.011310438625514507,-0.004204932600259781,0.029258571565151215,-0.01576095260679722,-0.02369239181280136,-0.019233502447605133,-0.022903017699718475,-0.006976379081606865,-0.02850145846605301,-0.00028692660271190107,0.046467650681734085,-0.017763609066605568,-0.003286137944087386,0.021098226308822632,0.014577901922166348,-0.005343591328710318,-0.04523463174700737,0.0040312763303518295,0.0035526808351278305,-0.006274423561990261,-0.02641184814274311,-0.05563829839229584,0.01667593978345394,-0.023150870576500893,-0.01774492859840393,-0.034378860145807266,0.035253945738077164,0.02958935871720314,-0.06985614448785782,-0.007823937572538853,-0.018873002380132675,0.002241375157609582,-0.049707360565662384,0.0416286438703537,0.04968155175447464,-0.02859272062778473,-0.010464547201991081,0.018305353820323944,0.0005203005275689065,0.0020045621786266565,-0.0422297939658165,-0.012782836332917213,-0.033484745770692825,-0.01770048215985298,-0.025546135380864143,-0.020396364852786064,0.05231819301843643,0.005279479082673788,-0.0029590267222374678,0.0389634408056736,0.00023148395121097565,0.014465393498539925,0.00979036744683981,-0.035504333674907684,-0.02610897831618786,0.025549400597810745,-0.08290695399045944,0.004025445785373449,-0.0766557902097702,-0.04179111868143082,-0.009892375208437443,-0.03843582049012184,-0.01334550604224205,0.029429012909531593,0.03771014139056206,-0.02904929406940937,0.014453690499067307,0.052699703723192215,-0.018919728696346283,-0.0036439886316657066,-0.0258413664996624,-0.05640750005841255,-0.008118155412375927,-0.011909897439181805,-0.005016057286411524,-0.03951667621731758,-0.014631171710789204,-0.050701387226581573,-0.00031210939050652087,0.014728899113833904,0.022158147767186165,0.037636201828718185,-0.07138422876596451,0.004197460599243641,0.0050223530270159245,-0.017511814832687378,0.051615167409181595,0.011209819465875626,0.059141915291547775,-0.005637165158987045,0.01807146519422531,0.01637076959013939,0.023298542946577072,0.047958362847566605,0.028013108298182487,0.006359202787280083,-0.017212118953466415,0.01069712545722723,-0.020715219900012016,-0.018270200118422508,0.032214317470788956,0.04514157027006149,-0.05193926393985748,0.019153911620378494,-0.024062922224402428,0.03957108408212662,0.03886335715651512,0.025231938809156418,-0.0736759603023529,-0.01122813019901514,-0.019933978095650673,-0.018458936363458633,-0.009310015477240086,0.008309668861329556,0.09831002354621887,0.03847853094339371,0.023498937487602234,-0.00452743424102664,0.017419937998056412,-0.006671049632132053,-0.013076388277113438,0.029872076585888863,0.025201860815286636,0.003831824054941535,-0.017242806032299995,0.1142040491104126,-0.00045281986240297556,0.06310361623764038,-0.02285228855907917,0.07449634373188019,0.019971797242760658,-0.08409317582845688,-0.004363818559795618,0.0017492593033239245,0.033664505928754807,-0.030298331752419472,-0.040949251502752304,-0.03846629336476326,-0.009871997870504856,-0.005389032419770956,-0.010979246348142624,0.037949338555336,0.03655808046460152,-0.013553263619542122,-0.028576262295246124,-0.05528208985924721,-0.07636827230453491,0.0009546215296722949,0.04879916459321976,0.0765998512506485,-0.02101750485599041,-0.03138096258044243,-0.015461774542927742,-0.002060864120721817,-0.02571146935224533,-0.04751170799136162,0.03494838997721672,0.028391122817993164,-0.00171480025164783,0.007499413099139929,0.014938902109861374,-0.012736296281218529,-0.014240775257349014,-0.03389384225010872,0.013159421272575855,0.02328256517648697,-0.09592966735363007,-0.002040568506345153,0.011236628517508507,-0.020685626193881035,0.017794713377952576,-0.011987138539552689,0.003864025929942727,0.013115577399730682,-0.014298556372523308,0.007935279048979282,0.04301447048783302,-0.035137057304382324,-0.0028379084542393684,-0.14690858125686646,-0.013998521491885185,-0.03183670714497566,0.014048364013433456,0.00124125846195966,-0.04051600769162178,-0.010507375933229923,-0.0831141322851181,0.036211151629686356,0.03476366773247719,0.0821436420083046,-0.02793581411242485,-0.04576733335852623,0.0027218577452003956,0.00646837055683136,-0.006138524040579796,0.022351492196321487,0.03165433555841446,0.023478224873542786,-0.00010131305316463113,0.012374411337077618,0.007976941764354706,0.004295594058930874,-0.0321398563683033,0.009084131568670273,-0.010417379438877106,-0.04071884602308273,0.014408978633582592,0.0367262102663517,-0.02643914334475994,0.09097305685281754,0.02254803478717804,-0.0023092529736459255,-0.02131299488246441,0.013042259030044079,0.006565047428011894,0.03504737839102745,-0.006579386070370674,-0.03263838216662407,-0.042258307337760925,-0.002875285455957055,0.0056273965165019035,-0.10486291348934174,-0.0033102480228990316,0.033956434577703476,-0.050097811967134476,-0.02282116375863552,0.015461345203220844,-0.02457784302532673,0.012070502154529095,-0.021528130397200584,0.0029952910263091326,0.005749438423663378,0.0020592371001839638,-0.050121717154979706,-0.030611911788582802,-0.009995907545089722,0.03684890642762184,-0.0049904715269804,-0.08052439987659454,0.049449119716882706,0.04626620560884476,0.006411261390894651,-0.021783819422125816,-0.01860201358795166,0.008509381674230099,-0.10133351385593414,-0.04057227820158005,-0.06399818509817123,-0.033769164234399796,-0.06915780156850815,-0.02167523466050625,0.03142870217561722,0.10048440843820572,0.08307022601366043,0.012586082331836224,0.026546506211161613,-0.0015852751675993204,-0.004664778709411621,0.05442624166607857,-0.01873353309929371,-0.05587272718548775,0.0009933655383065343,0.021072249859571457,0.0435919463634491,0.014779625460505486,-0.022338710725307465,0.0362154021859169,0.033230993896722794,0.011715643107891083,-0.018547892570495605,0.02135985530912876,-0.002526915166527033,0.04668889194726944,0.005758835468441248,0.041170261800289154,-0.01750347949564457,-0.09447788447141647,-0.03488655760884285,-0.03509138897061348,0.020167136564850807,0.010287120938301086,0.030906010419130325,0.008679778315126896,-0.018291786313056946,0.025305146351456642,-0.07388428598642349,-0.08437228947877884,0.0135657275095582,0.010308490134775639,0.0116714583709836,0.03979683294892311,-0.019418708980083466,0.050139762461185455,-0.0020953011699020863,0.021923841908574104,-0.10955651104450226,0.02308148518204689,0.016438649967312813,-0.052698250859975815,-0.04696440324187279,-0.06171552464365959,-0.009946036152541637,0.03540512174367905,0.004230617079883814,0.03976975753903389,-0.059777580201625824,-0.001365530421026051,-0.0021765062119811773,0.048846933990716934,0.02250356785953045,0.048338882625103,0.010809320956468582,0.007385800126940012,0.0013441151240840554,0.008652090094983578,0.014271952211856842,0.026126576587557793,-0.05290086194872856,-0.005155772902071476,0.0058311522006988525,-0.018298722803592682,0.011475477367639542,-0.025738878175616264,0.011693717911839485,-0.018254654482007027,0.05286174267530441,0.021744024008512497,-0.004664631560444832,-0.019528312608599663,0.01419275626540184,-0.05073712393641472,0.01717185229063034,0.07651156932115555,-0.015983114019036293,0.003418650245293975,0.006252204068005085,-0.028423171490430832,0.013434488326311111,-0.04418864846229553,-0.02071741409599781,0.04621662572026253,-0.013632062822580338,0.06887643784284592,0.017159365117549896,0.031094124540686607,-0.04746418446302414,-0.04971950873732567,-0.030710043385624886,-0.02376214601099491,0.04947492852807045,0.01567721739411354,0.022477036342024803,-0.05150499939918518,0.01454826071858406,0.042816996574401855,-0.018604250624775887,0.009122610092163086,-0.05819593369960785,-0.005077800713479519,-0.023003047332167625,0.0016474024159833789,-0.013302391394972801,-0.01303191389888525,0.015309036709368229,0.014272761531174183,0.012662464752793312,-0.0032763017807155848,0.0625743567943573,0.008188399486243725,-0.012506605125963688,-0.05237260088324547,0.0247453972697258,0.009665187448263168,-0.06865876168012619,-0.014193164184689522,0.04343228042125702,0.0022878434974700212,-0.0013764566974714398,-0.026694869622588158,0.006329209078103304,0.020435916259884834,-0.028604069724678993,-0.04633092135190964,0.11550828814506531,-0.011111156083643436,-0.008419281803071499,-0.015261759050190449,-0.011650239117443562,-0.006935091223567724,-0.03972660377621651,-0.0426974855363369,0.007871129550039768,-0.02453542686998844,-0.063684843480587,0.01272714976221323,0.02605459652841091,0.05680445209145546,0.010051032528281212,0.0039400518871843815,0.014678120613098145,-0.0009086455102078617,0.007916594855487347,-0.05133221298456192,0.005925631150603294,0.057073380798101425,-0.009172340855002403,-0.08150622993707657,-0.03698337450623512,-0.039442505687475204,-0.0204863753169775,0.008318055421113968,0.010214317589998245,0.03636966645717621,0.004975081887096167,0.03760788217186928,-0.06306950747966766,-0.0010474659502506256,-0.019597839564085007,-0.006485253106802702,0.043621696531772614,0.005643680226057768,0.03936087340116501,-0.012227937579154968,0.010254435241222382,-0.0025436023715883493,-0.026470547541975975,0.02340150997042656,-0.041362885385751724,0.062624491751194,-0.017607880756258965,-0.09326103329658508,0.0172591432929039,0.04886966571211815,-0.021800771355628967,-0.002088528359308839,-0.050328806042671204,-0.021959250792860985,0.01200541015714407,-0.01669483631849289,0.05831821262836456,0.033012937754392624,-0.060292523354291916,-0.047453634440898895,0.01464156899601221,-0.032276179641485214,-7.886759676335328e-33,-0.004344049375504255,-0.029729003086686134,-0.048097874969244,-0.1081312969326973,-0.02490316890180111,-0.035913631319999695,0.05120005086064339,-0.045229051262140274,0.024619586765766144,-0.01941690593957901,-0.05292152613401413,-0.0017092771595343947,0.02904631569981575,0.016501588746905327,0.07578415423631668,0.059549134224653244,0.036770299077034,-0.02599947713315487,-0.013404169119894505,0.006011828314512968,-0.017437532544136047,0.049330130219459534,-0.016186585649847984,0.07392137497663498,0.001542481011711061,0.028010159730911255,-0.02465241588652134,0.017647769302129745,-0.01842370443046093,-0.03159460425376892,0.03894367069005966,-0.04848543927073479,0.007872512564063072,0.018133297562599182,-0.024535387754440308,-0.034567881375551224,0.0052119530737400055,-0.03635689988732338,0.0007113342871889472,-0.03055056929588318,0.04119103029370308,0.07282111048698425,-0.016367679461836815,0.032159462571144104,-0.011549506336450577,-0.023671908304095268,0.000006464672424044693,-0.01404667180031538,-0.012897470034658909,-0.023959090933203697,0.05466995760798454,0.03167584538459778,-0.015163660980761051,0.024311214685440063,0.029907332733273506,0.03523292765021324,0.03452235460281372,-0.015299300663173199,-0.006901235319674015,-0.011791154742240906,0.047337792813777924,-0.012928277254104614,0.0033423821441829205,0.03961166739463806,0.0220392644405365,0.014247123152017593,-0.0003701653622556478,0.034879185259342194,-0.025013817474246025,0.012760929763317108,-0.014952347613871098,0.051765792071819305,-0.0015606631059199572,-0.015122074633836746,0.03928818926215172,0.019224952906370163,0.01488561276346445,0.020015602931380272,0.02251451648771763,0.048824794590473175,0.03398425504565239,-0.00904354453086853,-0.02420053817331791,0.0014240824384614825,0.00184862338937819,-0.0429549515247345,-0.0013181595131754875,0.029468998312950134,0.01489246916025877,0.006578299682587385,-0.004518595989793539,0.031094670295715332,-0.029567956924438477,0.024374905973672867,-0.06883455812931061,0.02323879301548004,0.0335518978536129,0.017837144434452057,0.011414789594709873,0.006049029994755983,-0.03650614991784096,0.019977707415819168,0.03464439511299133,0.0420520044863224,-0.011787964031100273,0.014613020233809948,0.10483118891716003,0.0031157636549323797,-0.02070005238056183,0.014424702152609825,0.01855223998427391,0.03703485429286957,0.015010901726782322,0.02174890600144863,0.04301566258072853,0.0012947055511176586,-0.012247259728610516,0.014639515429735184,-0.00988686177879572,0.040851056575775146,0.03595006838440895,0.11134977638721466,-0.013807377777993679,-0.004342762753367424,0.03420085459947586,-0.059312835335731506,0.028226496651768684,-0.06933658570051193,0.0023709596134722233,-0.013959165662527084,-0.006708631757646799,-0.027103282511234283,3.5925134511671786e-7,0.02529381401836872,-0.032543208450078964,0.023806845769286156,0.0061965701170265675,0.026329219341278076,0.04635708034038544,-0.007799813523888588,0.039360590279102325,-0.03584523871541023,0.0041818334721028805,0.03203529492020607,-0.013412173837423325,0.04656851291656494,0.02094622515141964,0.051840223371982574,-0.06780645996332169,-0.0386810339987278,0.021188179031014442,-0.058785416185855865,0.021768655627965927,0.034974079579114914,0.016101369634270668,0.034355584532022476,0.01437266357243061,0.05123347416520119,-0.019335394725203514,-0.024373887106776237,-0.027470918372273445,0.009907531552016735,0.034629978239536285,0.04542222246527672,-0.038415610790252686,-0.028319483622908592,-0.0235633235424757,-0.011007131077349186,0.04980337992310524,-0.06314130872488022,-0.042977649718523026,-0.012974998913705349,-0.024844801053404808,0.015985649079084396,-0.011727151460945606,-0.04029085114598274,-0.030361756682395935,0.007520169485360384,-0.012934510596096516,-0.025159619748592377,0.005758378189057112,-0.015461823903024197,0.028366394340991974,0.020797235891222954,0.012159721925854683,0.025036949664354324,0.01262328214943409,0.024216799065470695,-0.00020073354244232178,-0.014357022009789944,0.0017903856933116913,0.03758333623409271,-0.07247890532016754,-0.01236441545188427,0.016017427667975426,-0.009360303170979023,0.0513564869761467,0.018854977563023567,-0.02019169181585312,0.0006818229448981583,3.656947083785049e-34,0.02768794260919094,0.0417201928794384,-0.005767467897385359,-0.04110953211784363,0.052720293402671814,-0.002446259604766965,0.009817700833082199,0.021536732092499733,-0.006103209685534239,-0.04500620812177658,-0.03493596613407135]';
  p_EmbeddingModelID_4502e037ceee := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_4502e037ceee := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_4502e037ceee := FALSE;
  p_IsMaterialized_4502e037ceee := FALSE;
  p_ID_4502e037ceee := '5A1E5000-0001-4000-A000-00000000000F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_4502e037ceee,
    'CategoryID', p_CategoryID_4502e037ceee,
    'UserQuestion', p_UserQuestion_4502e037ceee,
    'Description', p_Description_4502e037ceee,
    'SQL', p_SQL_4502e037ceee,
    'TechnicalDescription', p_TechnicalDescription_4502e037ceee,
    'OriginalSQL', p_OriginalSQL_4502e037ceee,
    'Feedback', p_Feedback_4502e037ceee,
    'Status', p_Status_4502e037ceee,
    'QualityRank', p_QualityRank_4502e037ceee,
    'ExecutionCostRank', p_ExecutionCostRank_4502e037ceee,
    'UsesTemplate', p_UsesTemplate_4502e037ceee,
    'AuditQueryRuns', p_AuditQueryRuns_4502e037ceee,
    'CacheEnabled', p_CacheEnabled_4502e037ceee,
    'CacheTTLMinutes', p_CacheTTLMinutes_4502e037ceee,
    'CacheMaxSize', p_CacheMaxSize_4502e037ceee,
    'EmbeddingVector', p_EmbeddingVector_4502e037ceee,
    'EmbeddingModelID', p_EmbeddingModelID_4502e037ceee,
    'CacheValidationSQL', p_CacheValidationSQL_4502e037ceee,
    'SQLDialectID', p_SQLDialectID_4502e037ceee,
    'Reusable', p_Reusable_4502e037ceee,
    'ExternalDataSourceID', p_ExternalDataSourceID_4502e037ceee,
    'IsMaterialized', p_IsMaterialized_4502e037ceee,
    'ID', p_ID_4502e037ceee
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_4502e037ceee, p_CategoryID := p_CategoryID_4502e037ceee, p_UserQuestion := p_UserQuestion_4502e037ceee, p_Description := p_Description_4502e037ceee, p_SQL := p_SQL_4502e037ceee, p_TechnicalDescription := p_TechnicalDescription_4502e037ceee, p_OriginalSQL := p_OriginalSQL_4502e037ceee, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_4502e037ceee, p_Feedback_Clear := TRUE, p_Status := p_Status_4502e037ceee, p_QualityRank := p_QualityRank_4502e037ceee, p_ExecutionCostRank := p_ExecutionCostRank_4502e037ceee, p_UsesTemplate := p_UsesTemplate_4502e037ceee, p_AuditQueryRuns := p_AuditQueryRuns_4502e037ceee, p_CacheEnabled := p_CacheEnabled_4502e037ceee, p_CacheTTLMinutes := p_CacheTTLMinutes_4502e037ceee, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_4502e037ceee, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_4502e037ceee, p_EmbeddingModelID := p_EmbeddingModelID_4502e037ceee, p_CacheValidationSQL := p_CacheValidationSQL_4502e037ceee, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_4502e037ceee, p_Reusable := p_Reusable_4502e037ceee, p_ExternalDataSourceID := p_ExternalDataSourceID_4502e037ceee, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_4502e037ceee, p_ID := p_ID_4502e037ceee);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_e52a891b2f4d UUID;
  p_QueryID_e52a891b2f4d UUID;
  p_EntityID_e52a891b2f4d UUID;
  p_DetectionMethod_e52a891b2f4d VARCHAR(50);
  p_AutoDetectConfidenceScore_e52a891b2f4d NUMERIC(3,2);
BEGIN
  p_ID_e52a891b2f4d := 'f3b638fe-0aa9-48f9-beb9-108e1678f9e1';
  p_QueryID_e52a891b2f4d := '5A1E5000-0001-4000-A000-00000000000F';
  p_EntityID_e52a891b2f4d := 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';
  p_DetectionMethod_e52a891b2f4d := 'AI';
  p_AutoDetectConfidenceScore_e52a891b2f4d := 1;
  p_QueryID_e52a891b2f4d := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Forecast by Owner' ORDER BY CASE WHEN "ID" = p_QueryID_e52a891b2f4d THEN 0 ELSE 1 END LIMIT 1), p_QueryID_e52a891b2f4d);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_e52a891b2f4d
                  OR ("QueryID" = p_QueryID_e52a891b2f4d AND "EntityID" = p_EntityID_e52a891b2f4d)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_e52a891b2f4d,
      'QueryID', p_QueryID_e52a891b2f4d,
      'EntityID', p_EntityID_e52a891b2f4d,
      'DetectionMethod', p_DetectionMethod_e52a891b2f4d,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_e52a891b2f4d
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_e52a891b2f4d, p_QueryID := p_QueryID_e52a891b2f4d, p_EntityID := p_EntityID_e52a891b2f4d, p_DetectionMethod := p_DetectionMethod_e52a891b2f4d, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_e52a891b2f4d);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_be7dbc011de3 VARCHAR(255);
  p_CategoryID_be7dbc011de3 UUID;
  p_UserQuestion_be7dbc011de3 TEXT;
  p_Description_be7dbc011de3 TEXT;
  p_SQL_be7dbc011de3 TEXT;
  p_TechnicalDescription_be7dbc011de3 TEXT;
  p_OriginalSQL_be7dbc011de3 TEXT;
  p_Feedback_be7dbc011de3 TEXT;
  p_Status_be7dbc011de3 VARCHAR(15);
  p_QualityRank_be7dbc011de3 INTEGER;
  p_ExecutionCostRank_be7dbc011de3 INTEGER;
  p_UsesTemplate_be7dbc011de3 BOOLEAN;
  p_AuditQueryRuns_be7dbc011de3 BOOLEAN;
  p_CacheEnabled_be7dbc011de3 BOOLEAN;
  p_CacheTTLMinutes_be7dbc011de3 INTEGER;
  p_CacheMaxSize_be7dbc011de3 INTEGER;
  p_EmbeddingVector_be7dbc011de3 TEXT;
  p_EmbeddingModelID_be7dbc011de3 UUID;
  p_CacheValidationSQL_be7dbc011de3 TEXT;
  p_SQLDialectID_be7dbc011de3 UUID;
  p_Reusable_be7dbc011de3 BOOLEAN;
  p_ExternalDataSourceID_be7dbc011de3 UUID;
  p_IsMaterialized_be7dbc011de3 BOOLEAN;
  p_ID_be7dbc011de3 UUID;
BEGIN
  p_Name_be7dbc011de3 := 'Sales: Pipeline Summary';
  p_CategoryID_be7dbc011de3 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_be7dbc011de3 := 'What is in the open pipeline right now, by pipeline and stage, and how much of it is weighted?';
  p_Description_be7dbc011de3 := 'Open and weighted pipeline by pipeline and stage (master plan §9.3 measures 1-2). Splits the total into PricedAmount and StatedAmount by Deal.AmountIsComputed, so a consumer can never present a hand-typed figure as an orders-engine answer.';
  p_SQL_be7dbc011de3 := '-- Open and weighted pipeline, by pipeline and stage. Master plan §9.3, measures 1 and 2.
--
-- DATE DIMENSION: ExpectedCloseDate. This is a forward-looking question — "what is in the pipeline
-- for this period" — so a deal belongs to the period it is expected to CLOSE in, not the one it was
-- created in. §9.2 requires reports to say which date they use; this is that statement.
--
-- OPEN IS A FLAG. DealStatusType.IsOpen, never a status name. A pipeline whose winning stage is
-- called "Signed" is excluded here for the right reason: the status it points at is not open.
--
-- WEIGHTED IS Amount * Probability, which §9.3 names in exactly those words. It is a forecast
-- weighting, not a price — nothing bills from it, and sales computes no money. Probability is stored
-- on the deal (applied from the stage), so this multiplies two stored values to answer a likelihood
-- question.
--
-- PIPELINES FLAGGED OUT OF THE FORECAST ARE LEFT OUT, UNLESS ASKED FOR BY ID. Pipeline.IncludeInForecast
-- = 0 marks a pipeline that holds historical deals, whose open rows would otherwise be counted beside
-- the live ones. Naming the pipeline in PipelineID is an explicit request for it, so the flag steps
-- aside; an unfiltered run can never pick it up by accident.
--
-- AMOUNT PROVENANCE TRAVELS WITH THE FIGURE. StatedAmount / PricedAmount split the same total by
-- Deal.AmountIsComputed, because a hand-typed number and an orders-engine answer are different kinds
-- of fact and a consumer that cannot tell them apart will present both as settled. On today''s data
-- every deal is stated, which is exactly the thing worth surfacing rather than hiding.
SELECT
    d.PipelineID,
    d.Pipeline                                      AS PipelineName,
    d.PipelineStageID,
    d.PipelineStage                                 AS StageName,
    ps.DisplayOrder                                 AS StageOrder,
    d.CompanyID,
    d.Company                                       AS CompanyName,
    COUNT(*)                                        AS DealCount,
    SUM(ISNULL(d.Amount, 0))                        AS OpenAmount,
    SUM(ISNULL(d.Amount, 0) * ISNULL(d.Probability, 0) / 100.0) AS WeightedAmount,
    SUM(CASE WHEN d.AmountIsComputed = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS PricedAmount,
    SUM(CASE WHEN d.AmountIsComputed = 1 THEN 0 ELSE ISNULL(d.Amount, 0) END) AS StatedAmount,
    SUM(CASE WHEN d.Amount IS NULL THEN 1 ELSE 0 END)                         AS NoAmountCount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsOpen = 1
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage ps
        ON ps.ID = d.PipelineStageID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% else %}
  AND p.IncludeInForecast = 1
  {% endif %}
  {% if PeriodStart %}
  AND d.ExpectedCloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND d.ExpectedCloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    d.PipelineID, d.Pipeline, d.PipelineStageID, d.PipelineStage, ps.DisplayOrder,
    d.CompanyID, d.Company
ORDER BY
    d.Pipeline, ps.DisplayOrder;
';
  p_TechnicalDescription_be7dbc011de3 := 'Grain: Deal. Date dimension: ExpectedCloseDate — a forward-looking question, so a deal belongs to the period it is expected to close in. Open is DealStatusType.IsOpen (a FLAG, never a status name). WeightedAmount is Amount * Probability / 100, which §9.3 names as a measure in those words; it is a forecast weighting, not a price, and sales computes no money. Joins PipelineStage only for DisplayOrder. Pipelines with IncludeInForecast = 0 are excluded unless PipelineID names one.';
  p_Status_be7dbc011de3 := 'Approved';
  p_QualityRank_be7dbc011de3 := 8;
  p_ExecutionCostRank_be7dbc011de3 := 2;
  p_UsesTemplate_be7dbc011de3 := TRUE;
  p_AuditQueryRuns_be7dbc011de3 := FALSE;
  p_CacheEnabled_be7dbc011de3 := FALSE;
  p_EmbeddingVector_be7dbc011de3 := '[-0.0472404882311821,0.06269656866788864,-0.01152282115072012,-0.025167003273963928,-0.030221516266465187,-0.008738960139453411,0.005737177096307278,-0.037731584161520004,-0.06928271800279617,-0.003555925562977791,0.02474300190806389,-0.005495131015777588,0.02402573637664318,0.1411992460489273,0.028251413255929947,-0.057287026196718216,-0.024094345048069954,-0.013172116130590439,-0.05460453778505325,0.005057826638221741,0.0013756374828517437,0.013253262266516685,-0.06021380051970482,0.0021623934153467417,0.03207189962267876,-0.0012209105771034956,-0.0140470489859581,0.0039307549595832825,-0.010592857375741005,-0.09204363077878952,0.0049590542912483215,0.03580903634428978,-0.0058370125479996204,0.014489949680864811,0.000002661981170604122,-0.005220337770879269,-0.010780878365039825,0.015429459512233734,-0.0530288964509964,0.010014382191002369,-0.005424566566944122,-0.08511894941329956,-0.0004927090485580266,0.014270777814090252,0.028707101941108704,-0.019238624721765518,-0.007130560465157032,0.07541077584028244,0.002958491677418351,-0.02021992765367031,0.006361464504152536,-0.023699389770627022,-0.014296254143118858,0.020634839311242104,-0.030707797035574913,-0.057862699031829834,0.014999265782535076,-0.0560205839574337,-0.015986261889338493,-0.015384523198008537,-0.0298317838460207,0.007930819876492023,0.011656814254820347,-0.07051628082990646,0.04095347225666046,0.02059863694012165,-0.0289821345359087,-0.018036404624581337,-0.01846408285200596,0.036499444395303726,0.09993405640125275,-0.007065354846417904,-0.0014920724788680673,-0.09283053129911423,-0.03490640968084335,-0.11628270894289017,-0.05066597834229469,0.019454069435596466,0.004188405815511942,0.011906563304364681,-0.10964144766330719,0.012161798775196075,-0.007401342503726482,-0.024060381576418877,-0.02848050557076931,0.0711931362748146,-0.03155234828591347,-0.03694140166044235,-0.008607899770140648,0.056833501905202866,0.002513508079573512,0.0043149967677891254,-0.008181532844901085,-0.041125569492578506,-0.021825682371854782,-0.011156469583511353,0.04064694419503212,0.012724621221423149,-0.01634458266198635,-0.04001036658883095,0.05627954751253128,0.022574128583073616,0.014904128387570381,0.023439260199666023,0.045066531747579575,0.019498344510793686,-0.026278089731931686,-0.04177478328347206,-0.023985229432582855,0.05378219857811928,-0.0164375901222229,-0.031864576041698456,0.011041529476642609,0.00596453296020627,-0.043322037905454636,0.02059132233262062,-0.045362770557403564,0.023664377629756927,-0.029317792505025864,-0.0017988260369747877,0.09684164822101593,-0.007282974664121866,0.05191218852996826,0.03342007100582123,0.0058135283179581165,0.10522077977657318,0.01636497490108013,-0.00962791871279478,-0.03276977315545082,0.004271944984793663,-0.03432457149028778,-0.006193052511662245,-0.012480920180678368,0.004893595818430185,-0.016737299039959908,0.0010459417244419456,0.02039308473467827,-0.004278808366507292,-0.005592545494437218,-0.0148993618786335,0.016924291849136353,0.006717482581734657,-0.028353985399007797,0.07371608167886734,0.03331218287348747,-0.013344505801796913,-0.04381222277879715,0.10837717354297638,0.0006395718664862216,0.01213298924267292,-0.004158192779868841,-0.03783063217997551,0.044272344559431076,-0.010671342723071575,-0.013845780864357948,-0.010683925822377205,-0.031841278076171875,0.0006803288124501705,-0.003988899290561676,0.04556645080447197,-0.0026932088658213615,-0.037680819630622864,-0.05799347162246704,-0.03233608976006508,0.01401712466031313,-0.0015583843924105167,0.011795447207987309,-0.010789592750370502,-0.06652399897575378,-0.02721816673874855,-0.006806377787142992,-0.016926703974604607,-0.0018237417098134756,0.020662933588027954,0.02351675182580948,-0.019207263365387917,0.09062206745147705,-0.053341276943683624,0.026202591136097908,0.04467253386974335,0.0031076823361217976,-0.05178633704781532,-0.00619634659960866,0.004017316736280918,0.008747903630137444,-0.025364946573972702,-0.019581466913223267,-0.005756719037890434,0.00756856519728899,0.02425634115934372,0.004539602901786566,0.04053376242518425,-0.12755201756954193,0.023671753704547882,-0.026205215603113174,-0.009941273368895054,-0.02508203685283661,0.020506469532847404,0.023420142009854317,0.04870017617940903,-0.0034749486949294806,0.029976338148117065,-0.04263494163751602,0.05730016902089119,0.010729343630373478,-0.03061378188431263,0.03187410160899162,-0.011537407524883747,-0.03392856940627098,-0.012436369433999062,0.03800853341817856,0.0112101836130023,0.004560066387057304,0.04897216334939003,0.0034147745463997126,-0.03618732467293739,0.04200286790728569,0.020169002935290337,-0.09509560465812683,-0.05520761013031006,-0.037923526018857956,0.011677426286041737,0.024488763883709908,0.011511933989822865,0.039862509816884995,0.01850055903196335,0.04790250584483147,0.0022790490183979273,0.0022455791477113962,0.002823443152010441,-0.02101254090666771,-0.006891317665576935,0.059723861515522,0.04290743172168732,-0.009963181801140308,0.06314301490783691,0.0015825575683265924,0.10169530659914017,0.015057416632771492,0.06184419244527817,-0.0301362257450819,-0.06944600492715836,-0.01342492550611496,0.00046023415052331984,0.06222619488835335,-0.016429927200078964,-0.04833551496267319,-0.046412672847509384,0.036061178892850876,0.008819438517093658,-0.027760116383433342,0.004516282584518194,0.02116170898079872,-0.01208571158349514,0.0038020608481019735,0.004865219816565514,-0.11371644586324692,-0.01248821523040533,0.03756478801369667,0.04049905017018318,0.010055175982415676,-0.029909024015069008,-0.024330269545316696,-0.04492834210395813,-0.013756622560322285,-0.021597055718302727,-0.0144354784861207,-0.021220898255705833,-0.013297290541231632,0.010216183960437775,0.041742075234651566,0.033109597861766815,0.006739909760653973,-0.019750820472836494,0.0013251128839328885,0.06532779335975647,-0.03438481315970421,-0.010847891680896282,-0.018216729164123535,-0.02819262258708477,0.02533957175910473,0.06143821403384209,-0.011673534289002419,0.010068061761558056,0.013216921128332615,0.060184452682733536,0.03257283195853233,-0.035065289586782455,-0.055543191730976105,-0.08284439891576767,0.03429007530212402,-0.013268768787384033,0.022851506248116493,0.034163378179073334,-0.05678461492061615,0.0051849596202373505,-0.011254196986556053,0.012405112385749817,-0.007090415805578232,0.019288957118988037,0.014288779348134995,-0.0001226781023433432,-0.008305542171001434,0.003176699159666896,-0.008907443843781948,0.014467543922364712,-0.025325531139969826,0.04652303457260132,0.010378345847129822,0.03464379161596298,0.026008715853095055,0.010503931902348995,0.0032198531553149223,-0.036052875220775604,-0.002962913829833269,-0.03764970228075981,0.01569649949669838,0.03882785513997078,-0.05059988424181938,0.0012758499942719936,0.011466793715953827,0.01414690911769867,0.006758731324225664,-0.018081873655319214,-0.015291497111320496,-0.0039434670470654964,-0.011664670892059803,-0.038281846791505814,-0.030388452112674713,-0.03050428070127964,0.023944227024912834,-0.06112106889486313,-0.05865589529275894,-0.02187037467956543,0.004814025014638901,-0.02866467274725437,0.021794000640511513,-0.013686676509678364,-0.04811170697212219,0.001634343876503408,-0.02577151171863079,-0.02677951380610466,-0.010322784073650837,-0.016138020902872086,0.012236551381647587,0.003730905009433627,0.07260726392269135,0.025033848360180855,-0.07422017306089401,0.02691074274480343,0.004290618468075991,0.08270528167486191,-0.020694900304079056,-0.02851589396595955,-0.0047307382337749004,-0.02541288547217846,-0.03528933599591255,-0.013536108657717705,0.020429322496056557,-0.05084220692515373,0.04143427312374115,0.0273653082549572,0.0010189934400841594,0.05253018066287041,0.029465971514582634,0.022170722484588623,0.006010821554809809,-0.03867868334054947,0.04233800619840622,-0.0003418547275941819,-0.04935501515865326,-0.0018038309644907713,0.008476689457893372,0.05763936787843704,0.01798921264708042,-0.008959650993347168,-0.011644537560641766,-0.008642003871500492,0.01766974851489067,0.018708791583776474,0.02568746730685234,0.018092729151248932,0.09102172404527664,-0.009117573499679565,0.06029041111469269,0.01222130935639143,-0.057198330760002136,-0.03984083980321884,0.003467106493189931,-0.013031034730374813,-0.011237099766731262,0.005842982791364193,0.04443415254354477,-0.01723635010421276,-0.016173649579286575,-0.004125356674194336,0.0013045324012637138,0.02570054866373539,-0.004806905519217253,0.01544172316789627,0.032260745763778687,0.07719188928604126,0.006901805754750967,0.00047695974353700876,0.03401174396276474,-0.06870482116937637,-0.031363531947135925,-0.019932258874177933,-0.029245464131236076,0.036769263446331024,0.10735904425382614,-0.07410666346549988,0.012858165428042412,-0.023075800389051437,0.05157552286982536,0.021463939920067787,0.0013389771338552237,-0.0520196408033371,-0.011798539198935032,0.018631257116794586,0.038850024342536926,0.01151317823678255,0.040866218507289886,-0.01115004625171423,-0.013629773631691933,0.001554290414787829,0.03529183194041252,-0.045825228095054626,0.00558777991682291,-0.03311409801244736,-0.026448342949151993,0.024002710357308388,-0.04567307233810425,-0.002964055398479104,-0.023926284164190292,0.028781363740563393,0.02299824170768261,0.051880307495594025,0.001549116219393909,-0.006595630198717117,0.02018761821091175,-0.004147959873080254,0.09006287157535553,-0.004757849033921957,-0.0032391794957220554,0.0726533830165863,-0.042135730385780334,-0.04746017977595329,-0.05247894302010536,-0.05468135327100754,0.05053278058767319,-0.036403778940439224,0.02218964695930481,-0.010768153704702854,0.024669615551829338,-0.040850602090358734,0.00014819692296441644,-0.11490976065397263,-0.06373175978660583,-0.014020891860127449,0.02593572437763214,0.011676645837724209,-0.0948367789387703,0.036248087882995605,0.040692802518606186,0.012759841978549957,-0.09510865062475204,-0.08149445801973343,0.0558098703622818,-0.00838909950107336,-0.02505112998187542,-0.032678961753845215,-0.03594375029206276,-0.002987561747431755,-0.004719003103673458,0.041436415165662766,-0.0014688973315060139,0.09243933856487274,0.051377322524785995,0.0038401130586862564,-0.014810358174145222,0.011623218655586243,0.009728936478495598,-0.040537796914577484,-0.01865333504974842,0.08100835978984833,0.00938832014799118,-0.017275745049118996,-0.012060110457241535,0.030229687690734863,0.03176447004079819,-0.03160475194454193,-0.024159803986549377,0.0572587214410305,0.018484793603420258,0.08000820130109787,0.004084956832230091,-0.060324132442474365,0.01817520707845688,-0.024773690849542618,-0.04026598855853081,0.018077770248055458,0.021964039653539658,-0.06125323474407196,-0.002031613839790225,0.025265706703066826,0.06283386796712875,0.012098487466573715,-0.018938593566417694,0.027487296611070633,-0.0036518240813165903,0.006651829928159714,-0.015192544087767601,0.0016440375475212932,0.0415915809571743,0.02744915336370468,-0.04990231618285179,0.021923253312706947,-0.026386495679616928,0.01822705753147602,0.019162965938448906,-0.0262986458837986,-0.016484029591083527,-0.06248017027974129,0.01363495271652937,-0.051781248301267624,0.0053850277327001095,0.008392952382564545,-0.004353100433945656,0.028521886095404625,-0.013997385278344154,0.04833941534161568,-0.011108235456049442,0.05512356013059616,0.004715585149824619,-0.03202072158455849,-0.019605986773967743,0.09460141509771347,0.04262731596827507,0.030377665534615517,-0.043024711310863495,0.028033733367919922,0.00423042057082057,-0.023842748254537582,0.017229178920388222,0.0040549226105213165,-0.030858147889375687,-0.038489170372486115,-0.0027670608833432198,-0.014529700390994549,-0.017161348834633827,-0.024250144138932228,0.008444899693131447,0.005161193199455738,-0.04985921457409859,-7.751540357108333e-33,-0.031723033636808395,-0.05268968269228935,-0.01537395641207695,-0.048108913004398346,-0.01874910667538643,-0.02131265588104725,0.011298663914203644,-0.020079903304576874,-0.03604653477668762,-0.020467611029744148,0.004395690280944109,0.018073013052344322,0.019095662981271744,-0.0016379787120968103,0.03623775765299797,0.0030460390262305737,0.017822863534092903,-0.04127946123480797,-0.025768741965293884,0.042675383388996124,-0.0012163070496171713,0.03127247840166092,0.029558468610048294,0.04313218593597412,-0.010418806225061417,0.0009859608253464103,0.012406760826706886,0.044176019728183746,-0.02349025383591652,-0.026505539193749428,0.0327504463493824,0.0027143904007971287,0.004398890770971775,-0.027477126568555832,-0.03363027423620224,-0.06127317249774933,-0.02275511622428894,-0.03195196017622948,0.0019516671309247613,-0.009959875606000423,0.03588944301009178,0.03339941054582596,-0.0021228459663689137,-0.008367967791855335,-0.005010643042623997,-0.04175735265016556,0.010043179616332054,0.016240885481238365,0.03378655016422272,-0.035707008093595505,0.04218422248959541,-0.000002900337904065964,-0.045664455741643906,0.09768041223287582,-0.009500997141003609,0.05201885849237442,0.062494389712810516,-0.04707016423344612,0.008743478916585445,0.029399225488305092,-0.0617598257958889,0.012836991809308529,0.015783727169036865,0.01623963564634323,0.05176603049039841,0.014293266460299492,-0.018822208046913147,0.04547325149178505,0.02447131834924221,0.040425870567560196,0.005545967724174261,0.008125584572553635,-0.014227689243853092,-0.11408238112926483,-0.029657362028956413,0.009759176522493362,0.029688512906432152,-0.0073104677721858025,-0.04119269549846649,0.05486805737018585,0.0095132477581501,0.015621761791408062,0.0004259900306351483,-0.01234382577240467,-0.009413634426891804,-0.07667268067598343,-0.008717668242752552,0.07769360393285751,0.0063286954537034035,0.03527804836630821,-0.009868860244750977,-0.0005322254728525877,-0.022756999358534813,0.02362705022096634,-0.009301803074777126,0.033172011375427246,0.026423783972859383,0.017482180148363113,-0.02228628285229206,0.0193407591432333,-0.02674795873463154,0.040610868483781815,0.07351730763912201,0.024631351232528687,-0.00971310492604971,0.02468222752213478,-0.007716787047684193,0.0010295974789187312,-0.05686444416642189,0.00827341340482235,0.006795802619308233,0.04785249009728432,0.0022261254489421844,0.08210394531488419,-0.0076606860384345055,-0.017726169899106026,0.001963011221960187,-0.015229695476591587,0.00014260798343457282,-0.03625795617699623,-0.011418505571782589,0.11191798746585846,0.0048186215572059155,0.022357625886797905,-0.01615503802895546,0.025125877931714058,0.03989081457257271,-0.028562674298882484,0.02286105789244175,-0.03253301605582237,-0.009402671828866005,0.05485060065984726,3.3791226883295167e-7,0.031619541347026825,-0.014912146143615246,0.015456831082701683,0.03787824511528015,0.032378364354372025,-0.025130251422524452,-0.014695409685373306,0.0019907981622964144,-0.007977660745382309,-0.05230189114809036,0.02930249087512493,-0.024958409368991852,-0.011412396095693111,0.02309475839138031,-0.018360069021582603,-0.03974008560180664,-0.013478153385221958,-0.0010575560154393315,-0.048034731298685074,-0.044664427638053894,0.05631859228014946,0.029088735580444336,0.03493081033229828,0.029844142496585846,-0.0032814571168273687,-0.009307699277997017,-0.05009428411722183,0.025377290323376656,0.04583985358476639,0.014196368865668774,0.07285518944263458,-0.06903820484876633,0.005662449635565281,-0.012337115593254566,0.005756691563874483,0.043245699256658554,-0.05154729261994362,0.014505451545119286,0.008856022730469704,-0.039731260389089584,-0.023412438109517097,-0.04488972947001457,-0.006072079762816429,-0.011640319600701332,0.0003917774010915309,-0.009341803379356861,0.0035809825640171766,-0.02238849177956581,-0.01449215691536665,-0.03148890659213066,0.027219977229833603,0.058499839156866074,0.05017765983939171,0.04229779914021492,0.018760155886411667,-0.028593776747584343,0.0208439901471138,0.011602386832237244,0.023072445765137672,-0.03012426756322384,-0.01856265589594841,-0.016194410622119904,-0.0017831188160926104,0.038316745311021805,0.02728124149143696,-0.013962759636342525,-0.008842607960104942,3.2380605902244886e-34,0.019194262102246284,-0.02121622860431671,0.013845537789165974,-0.06060512363910675,0.05493108555674553,0.00731849716976285,-0.022298181429505348,-0.020762862637639046,-0.023777786642313004,-0.08246482908725739,-0.029019001871347427]';
  p_EmbeddingModelID_be7dbc011de3 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_be7dbc011de3 := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_be7dbc011de3 := FALSE;
  p_IsMaterialized_be7dbc011de3 := FALSE;
  p_ID_be7dbc011de3 := '5A1E5000-0001-4000-A000-000000000001';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_be7dbc011de3,
    'CategoryID', p_CategoryID_be7dbc011de3,
    'UserQuestion', p_UserQuestion_be7dbc011de3,
    'Description', p_Description_be7dbc011de3,
    'SQL', p_SQL_be7dbc011de3,
    'TechnicalDescription', p_TechnicalDescription_be7dbc011de3,
    'OriginalSQL', p_OriginalSQL_be7dbc011de3,
    'Feedback', p_Feedback_be7dbc011de3,
    'Status', p_Status_be7dbc011de3,
    'QualityRank', p_QualityRank_be7dbc011de3,
    'ExecutionCostRank', p_ExecutionCostRank_be7dbc011de3,
    'UsesTemplate', p_UsesTemplate_be7dbc011de3,
    'AuditQueryRuns', p_AuditQueryRuns_be7dbc011de3,
    'CacheEnabled', p_CacheEnabled_be7dbc011de3,
    'CacheTTLMinutes', p_CacheTTLMinutes_be7dbc011de3,
    'CacheMaxSize', p_CacheMaxSize_be7dbc011de3,
    'EmbeddingVector', p_EmbeddingVector_be7dbc011de3,
    'EmbeddingModelID', p_EmbeddingModelID_be7dbc011de3,
    'CacheValidationSQL', p_CacheValidationSQL_be7dbc011de3,
    'SQLDialectID', p_SQLDialectID_be7dbc011de3,
    'Reusable', p_Reusable_be7dbc011de3,
    'ExternalDataSourceID', p_ExternalDataSourceID_be7dbc011de3,
    'IsMaterialized', p_IsMaterialized_be7dbc011de3,
    'ID', p_ID_be7dbc011de3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_be7dbc011de3, p_CategoryID := p_CategoryID_be7dbc011de3, p_UserQuestion := p_UserQuestion_be7dbc011de3, p_Description := p_Description_be7dbc011de3, p_SQL := p_SQL_be7dbc011de3, p_TechnicalDescription := p_TechnicalDescription_be7dbc011de3, p_OriginalSQL := p_OriginalSQL_be7dbc011de3, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_be7dbc011de3, p_Feedback_Clear := TRUE, p_Status := p_Status_be7dbc011de3, p_QualityRank := p_QualityRank_be7dbc011de3, p_ExecutionCostRank := p_ExecutionCostRank_be7dbc011de3, p_UsesTemplate := p_UsesTemplate_be7dbc011de3, p_AuditQueryRuns := p_AuditQueryRuns_be7dbc011de3, p_CacheEnabled := p_CacheEnabled_be7dbc011de3, p_CacheTTLMinutes := p_CacheTTLMinutes_be7dbc011de3, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_be7dbc011de3, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_be7dbc011de3, p_EmbeddingModelID := p_EmbeddingModelID_be7dbc011de3, p_CacheValidationSQL := p_CacheValidationSQL_be7dbc011de3, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_be7dbc011de3, p_Reusable := p_Reusable_be7dbc011de3, p_ExternalDataSourceID := p_ExternalDataSourceID_be7dbc011de3, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_be7dbc011de3, p_ID := p_ID_be7dbc011de3);
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_8d91bb9ea799 UUID;
  p_QueryID_8d91bb9ea799 UUID;
  p_EntityID_8d91bb9ea799 UUID;
  p_DetectionMethod_8d91bb9ea799 VARCHAR(50);
  p_AutoDetectConfidenceScore_8d91bb9ea799 NUMERIC(3,2);
BEGIN
  p_ID_8d91bb9ea799 := 'ad15bc3d-7f51-4449-a110-8c4ffb9bfab1';
  p_QueryID_8d91bb9ea799 := '5A1E5000-0001-4000-A000-000000000001';
  p_EntityID_8d91bb9ea799 := 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';
  p_DetectionMethod_8d91bb9ea799 := 'AI';
  p_AutoDetectConfidenceScore_8d91bb9ea799 := 1;
  p_QueryID_8d91bb9ea799 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Pipeline Summary' ORDER BY CASE WHEN "ID" = p_QueryID_8d91bb9ea799 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_8d91bb9ea799);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_8d91bb9ea799
                  OR ("QueryID" = p_QueryID_8d91bb9ea799 AND "EntityID" = p_EntityID_8d91bb9ea799)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_8d91bb9ea799,
      'QueryID', p_QueryID_8d91bb9ea799,
      'EntityID', p_EntityID_8d91bb9ea799,
      'DetectionMethod', p_DetectionMethod_8d91bb9ea799,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8d91bb9ea799
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_8d91bb9ea799, p_QueryID := p_QueryID_8d91bb9ea799, p_EntityID := p_EntityID_8d91bb9ea799, p_DetectionMethod := p_DetectionMethod_8d91bb9ea799, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8d91bb9ea799);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_07772d8728d8 VARCHAR(255);
  p_CategoryID_07772d8728d8 UUID;
  p_UserQuestion_07772d8728d8 TEXT;
  p_Description_07772d8728d8 TEXT;
  p_SQL_07772d8728d8 TEXT;
  p_TechnicalDescription_07772d8728d8 TEXT;
  p_OriginalSQL_07772d8728d8 TEXT;
  p_Feedback_07772d8728d8 TEXT;
  p_Status_07772d8728d8 VARCHAR(15);
  p_QualityRank_07772d8728d8 INTEGER;
  p_ExecutionCostRank_07772d8728d8 INTEGER;
  p_UsesTemplate_07772d8728d8 BOOLEAN;
  p_AuditQueryRuns_07772d8728d8 BOOLEAN;
  p_CacheEnabled_07772d8728d8 BOOLEAN;
  p_CacheTTLMinutes_07772d8728d8 INTEGER;
  p_CacheMaxSize_07772d8728d8 INTEGER;
  p_EmbeddingVector_07772d8728d8 TEXT;
  p_EmbeddingModelID_07772d8728d8 UUID;
  p_CacheValidationSQL_07772d8728d8 TEXT;
  p_SQLDialectID_07772d8728d8 UUID;
  p_Reusable_07772d8728d8 BOOLEAN;
  p_ExternalDataSourceID_07772d8728d8 UUID;
  p_IsMaterialized_07772d8728d8 BOOLEAN;
  p_ID_07772d8728d8 UUID;
BEGIN
  p_Name_07772d8728d8 := 'Sales: Win Rate by Count and Value';
  p_CategoryID_07772d8728d8 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_07772d8728d8 := 'What is our win rate — both by number of deals and by value?';
  p_Description_07772d8728d8 := 'Win rate reported BOTH ways (master plan §9.3 measure 5), because they diverge exactly when it matters: winning nine small deals and losing one large one is a 90% rate by count and can be under 50% by value. Reporting either alone hides a pipeline problem for a quarter.';
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
-- NULLIF GUARDS BOTH RATES. A period with no closed deals returns NULL rather than dividing by zero,
-- and NULL is the honest answer: "no rate" is a different fact from "a rate of zero".
SELECT
    d.CompanyID,
    d.Company                                    AS CompanyName,
    d.PipelineID,
    d.Pipeline                                   AS PipelineName,
    d.DealTypeID,
    d.DealType                                   AS DealTypeName,
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
WHERE 1 = 1
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
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline, d.DealTypeID, d.DealType
ORDER BY
    d.Company, d.Pipeline, d.DealType;
';
  p_TechnicalDescription_07772d8728d8 := 'Grain: Deal. Denominator is closed deals only (IsClosed), since an open deal has not been decided and including it drags every rate toward zero as the pipeline grows. Won and lost read IsWon / IsLost separately rather than treating "not won" as lost, so a closed status that is neither shows as the gap between ClosedCount and Won+Lost. NULLIF guards both divisions — no closed deals returns NULL, which is a different fact from a rate of zero. PERIOD SCOPE (golive#232): optional PeriodStart/PeriodEnd bound ActualCloseDate, the same dimension dashboard-summary.sql windows its WonCount on, so the Won tile and this rate describe the same set. There is no standing ActualCloseDate IS NOT NULL: a closed deal that never recorded its close date is still a closed deal and belongs in the unbounded denominator, and a NULL comparison is UNKNOWN so a bounded window excludes it without needing a guard.';
  p_Status_07772d8728d8 := 'Approved';
  p_QualityRank_07772d8728d8 := 8;
  p_ExecutionCostRank_07772d8728d8 := 2;
  p_UsesTemplate_07772d8728d8 := TRUE;
  p_AuditQueryRuns_07772d8728d8 := FALSE;
  p_CacheEnabled_07772d8728d8 := FALSE;
  p_EmbeddingVector_07772d8728d8 := '[-0.04005869850516319,0.03720869496464729,-0.02002537064254284,0.011616410687565804,-0.029311560094356537,-0.013407175429165363,-0.008681606501340866,-0.06307805329561234,-0.07513956725597382,-0.007241229526698589,0.003974576480686665,-0.06470215320587158,0.04561954364180565,0.1339230090379715,-0.006606814451515675,0.00959901511669159,-0.030297186225652695,0.0020006676204502583,-0.0037000561133027077,-0.003802388673648238,0.013862984254956245,0.004371902905404568,-0.028512710705399513,-0.014066843315958977,-0.04643000662326813,-0.0020012662280350924,-0.00908426009118557,-0.036539603024721146,-0.006788589525967836,-0.10321155190467834,0.025585167109966278,-0.02722880430519581,0.020099889487028122,0.009787285700440407,0.000002486340690666111,-0.011213509365916252,-0.03942934423685074,0.030199892818927765,-0.010918917134404182,0.0316794291138649,0.04483507573604584,-0.044829849153757095,-0.0029213177040219307,0.021059246733784676,-0.03680325299501419,0.004548870027065277,-0.017224159091711044,0.04806062951683998,-0.04417800530791283,0.00715921726077795,0.02195988968014717,0.03553934767842293,-0.056678999215364456,0.009092951193451881,0.00020684313494712114,-0.07997499406337738,-0.0061936997808516026,0.013365833088755608,-0.0429304763674736,-0.10070215910673141,-0.08402276039123535,-0.008572722785174847,-0.0018062357557937503,-0.040695760399103165,-0.009349587373435497,0.03086036443710327,-0.01227438636124134,0.017566967755556107,-0.02245822362601757,-0.01556230429559946,0.01899973675608635,0.027820566669106483,-0.009626043029129505,-0.09426754713058472,0.00836457684636116,-0.134690523147583,-0.05089152976870537,0.04076226055622101,0.026317713782191277,-0.001894868561066687,-0.06013638526201248,0.09573276340961456,-0.0174420103430748,0.00001555461494717747,0.013387499377131462,-0.0232332032173872,-0.021182013675570488,0.011131130158901215,-0.038788773119449615,0.012073378078639507,0.00004527950659394264,-0.005332177970558405,-0.004154296591877937,-0.025315362960100174,-0.030659055337309837,0.010945424437522888,-0.00585923669859767,0.05798419937491417,0.03580937907099724,-0.07625194638967514,-0.0016850157408043742,-0.0009202441433444619,0.018795151263475418,-0.02346882037818432,0.053807277232408524,-0.0111582325771451,0.025371847674250603,-0.05089325085282326,-0.024990148842334747,0.028280144557356834,0.020706474781036377,-0.013367545790970325,0.03818700835108757,0.005379953887313604,-0.013474549166858196,0.011353000067174435,-0.08131129294633865,0.0028575342148542404,0.0000971370391198434,-0.009268468245863914,0.06501255929470062,-0.0024818198289722204,0.007107268553227186,-0.004938540514558554,0.012944956310093403,0.09542489051818848,-0.018714318051934242,0.011743598617613316,0.0013182522961869836,-0.03349108248949051,-0.0013548864517360926,-0.02402050979435444,0.01576676405966282,-0.06220782548189163,0.010658932849764824,-0.05120398476719856,0.013788953423500061,0.03945555165410042,0.03780506178736687,-0.005404331721365452,0.011334256269037724,0.011252823285758495,-0.0505383238196373,0.011359112337231636,-0.0135717848315835,-0.03354085981845856,-0.014818871393799782,0.03756782039999962,0.01396622322499752,0.005334614310413599,0.014675088226795197,-0.02786981128156185,0.015142172574996948,-0.0047023664228618145,-0.007939372211694717,-0.00669191125780344,0.07942978292703629,0.031211497262120247,0.05477545037865639,0.05139511823654175,-0.005454350262880325,-0.0383804626762867,0.005277823656797409,-0.022000407800078392,0.019403906539082527,0.04315153509378433,0.02449823170900345,0.016223816201090813,-0.002741454867646098,-0.04777846112847328,0.024502458050847054,-0.025039128959178925,-0.02160487323999405,-0.01798800565302372,0.04339185357093811,-0.037775829434394836,0.0032348784152418375,0.006432328838855028,-0.031367797404527664,-0.0034197145141661167,-0.04700632020831108,-0.0937105268239975,-0.003485528053715825,0.032000668346881866,0.05002864450216293,-0.03313608095049858,0.019233811646699905,-0.009017856791615486,-0.0056424494832754135,0.03229441121220589,0.0296001099050045,0.0427275113761425,-0.013255195692181587,0.050149161368608475,-0.023296667262911797,-0.0030627334490418434,-0.0023822756484150887,-0.0155551852658391,-0.0032753769773989916,0.05093395337462425,-0.015452105551958084,-0.037502869963645935,-0.022769887000322342,-0.019620047882199287,0.017194189131259918,0.011653400957584381,0.04453029856085777,-0.002481446834281087,-0.09058059006929398,-0.0061581917107105255,0.07662010937929153,0.02130143530666828,0.03716743737459183,0.03833978250622749,0.01559512224048376,0.0019480511546134949,0.030130775645375252,-0.00886665377765894,-0.07939396798610687,-0.026476452127099037,-0.004067797213792801,0.022076880559325218,-0.0019856987055391073,-0.0153327826410532,0.07206045836210251,0.0076692416332662106,0.02817419171333313,-0.026137014850974083,-0.022088075056672096,-0.025748280808329582,0.03120630607008934,-0.00539992842823267,0.017402302473783493,0.024158356711268425,-0.021399157121777534,-0.010116796009242535,0.04824178293347359,0.017170408740639687,0.02461617812514305,0.04058728367090225,-0.003894001478329301,-0.032874565571546555,-0.02141217328608036,0.024195406585931778,0.031161384657025337,-0.055232200771570206,-0.07844794541597366,-0.013564874418079853,0.010732293128967285,0.003152365330606699,-0.011187955737113953,0.017713923007249832,0.034455806016922,-0.008775494061410427,-0.008289257995784283,-0.0251383688300848,-0.13912858068943024,0.017140235751867294,0.027657780796289444,0.053060948848724365,-0.030394112691283226,-0.028801564127206802,-0.01370571181178093,0.002242996357381344,0.0025005806237459183,-0.02741226740181446,0.02386412024497986,-0.01535267848521471,0.04219287633895874,0.012076310813426971,0.022686520591378212,-0.015084372833371162,0.009092699736356735,-0.006740272045135498,0.007882101461291313,0.02521025389432907,-0.12376463413238525,0.026482250541448593,0.027674010023474693,-0.009674319997429848,0.00692982180044055,-0.008976883254945278,-0.03151050582528114,-0.010525718331336975,0.03339004144072533,-0.021131159737706184,0.050231438130140305,0.05437805876135826,-0.07125543802976608,-0.01784525439143181,-0.018818221986293793,-0.029604552313685417,0.008927359245717525,-0.02111317776143551,-0.06715747714042664,0.02143235132098198,-0.0640249103307724,-0.021013256162405014,-0.038843799382448196,0.05311264842748642,0.048763953149318695,-0.054428379982709885,-0.0451483279466629,-0.010218665935099125,-0.01849336363375187,0.004983458202332258,-0.013766733929514885,-0.021064847707748413,0.0027634077705442905,0.03066963702440262,0.046308744698762894,0.0038159938994795084,0.024715982377529144,0.032099831849336624,-0.005453294143080711,-0.06094200909137726,0.0262687299400568,0.062281567603349686,-0.018963247537612915,0.06213410943746567,0.052566736936569214,0.002620493760332465,-0.021027512848377228,0.021712802350521088,0.010454753413796425,-0.012232618406414986,0.01944694295525551,0.004342258907854557,-0.030978551134467125,-0.005149415694177151,-0.021465696394443512,-0.06232426315546036,-0.05439594015479088,-0.011810466647148132,-0.02469286136329174,-0.013065834529697895,-0.02973082847893238,0.06982287019491196,-0.01565839722752571,0.004235734697431326,-0.05215521156787872,-0.016030598431825638,0.00016218493692576885,-0.1060275137424469,-0.010919153690338135,-0.0009033062378875911,0.10651034116744995,0.006891107186675072,-0.07214578986167908,-0.010208114050328732,0.083409883081913,-0.01938481815159321,-0.024930544197559357,-0.050176989287137985,0.008498131297528744,0.024002395570278168,0.03769461065530777,-0.01576264761388302,0.04310504347085953,-0.05922270938754082,-0.05017803609371185,0.03676729276776314,0.0015706856502220035,0.11592347919940948,-0.017947891727089882,0.008540543727576733,0.021065883338451385,0.02180042862892151,0.021861625835299492,0.007939864881336689,0.0025298045948147774,-0.018968453630805016,-0.0028021936304867268,0.0020489338785409927,-0.003575431415811181,0.011611162684857845,0.024547934532165527,-0.032390058040618896,0.03697117790579796,-0.00822308100759983,0.05997106805443764,-0.020822741091251373,0.07555145770311356,-0.049291882663965225,0.03111451491713524,-0.009654697962105274,-0.0371992290019989,-0.03887264057993889,-0.05915699526667595,-0.014470834285020828,-0.025655565783381462,0.0005340493516996503,-0.018274040892720222,-0.0028033589478582144,0.014011583290994167,-0.05438151955604553,0.02477751486003399,0.018148362636566162,-0.004463050980120897,-0.0012286243727430701,0.056060269474983215,0.031056338921189308,0.05445386841893196,0.028636766597628593,0.026868367567658424,-0.034786392003297806,0.028669314458966255,0.037702202796936035,-0.04856618121266365,0.009563425555825233,-0.07479535043239594,0.03853440657258034,-0.0028491371776908636,-0.0060620359145104885,0.08105213940143585,0.05421742796897888,-0.0022276712115854025,-0.02724822238087654,-0.04654651880264282,-0.012729431502521038,0.06400761753320694,0.06012122333049774,0.031005719676613808,0.01476935762912035,-0.03335603326559067,0.02842300571501255,0.00828955601900816,-0.03369737043976784,-0.0029698791913688183,-0.01870235614478588,-0.019568875432014465,0.04347417876124382,-0.0019815133418887854,0.023069756105542183,-0.06362272799015045,-0.06815288215875626,-0.0431499257683754,0.06454432755708694,0.011423778720200062,0.014136047102510929,0.004904117900878191,0.0288354754447937,0.06449992209672928,0.022061072289943695,0.03147182613611221,0.01732587441802025,0.010066262446343899,0.0256222914904356,-0.033080682158470154,-0.05865926295518875,0.0156811885535717,0.016909189522266388,0.09505218267440796,0.005552280694246292,-0.044693730771541595,-0.001557759940624237,-0.04547792300581932,-0.08536483347415924,-0.008414015173912048,-0.017338618636131287,0.01986510679125786,0.007739114575088024,-0.044877372682094574,0.06879764795303345,-0.03126775473356247,-0.0947040319442749,-0.02067711018025875,-0.025871532037854195,0.025196852162480354,-0.01722031645476818,-0.014781729318201542,-0.00851244106888771,-0.015772510319948196,0.003788965754210949,0.007989632897078991,0.05034470558166504,0.010482104495167732,-0.02509288303554058,0.11486246436834335,-0.0076067568734288216,-0.007686613593250513,-0.009930695407092571,-0.005958915688097477,-0.007098292466253042,-0.010188432410359383,0.033802203834056854,-0.004145827144384384,0.0027871024794876575,-0.02051391452550888,0.010094240307807922,0.013884599320590496,-0.04916766658425331,-0.06632766127586365,0.02268420346081257,0.05598994717001915,0.036772750318050385,-0.0574636347591877,-0.024731600657105446,-0.03271074593067169,-0.0005835904157720506,-0.0229323860257864,0.05368572473526001,0.0024629731196910143,-0.0798356905579567,0.008933749981224537,0.07309450209140778,0.05802961438894272,-0.04066966846585274,0.016562316566705704,-0.04266604781150818,0.03503581881523132,-0.03913244977593422,0.09044424444437027,-0.05076804384589195,0.05057452246546745,-0.02504093572497368,-0.042691703885793686,-0.006153574213385582,-0.04215674102306366,0.00785383116453886,0.03162930905818939,-0.00485374266281724,-0.01481753308326006,-0.027897220104932785,0.035147957503795624,-0.08045611530542374,0.03220752254128456,0.0023438292555510998,-0.02848093770444393,0.026730235666036606,-0.025442807003855705,-0.00009044747275765985,-0.006663740146905184,0.038960471749305725,0.032274533063173294,0.05576881393790245,0.03112166002392769,0.05808154493570328,0.022465409711003304,0.016155624762177467,-0.03575223684310913,0.0013977951603010297,0.022008582949638367,-0.02467084862291813,0.02683522365987301,0.017494190484285355,0.0032655145041644573,-0.028445597738027573,-0.008715169504284859,0.02859053760766983,0.016647152602672577,0.022930540144443512,0.0034778860863298178,0.008861202746629715,-0.03977689519524574,-7.311340497928433e-33,-0.02252582646906376,-0.03195267170667648,0.021022161468863487,-0.05901903659105301,-0.01165137067437172,-0.0535813570022583,0.035751841962337494,0.014000121504068375,-0.0024817760568112135,0.031432610005140305,-0.044872019439935684,0.026134543120861053,0.019457153975963593,0.012352812103927135,0.055781733244657516,-0.0046047247014939785,0.0038208505138754845,-0.02222933992743492,0.005088179372251034,0.02013465389609337,-0.03366843983530998,0.01459813117980957,0.05051437020301819,-0.06451133638620377,-0.02670557238161564,0.019450144842267036,-0.0024099505972117186,-0.0009505635243840516,0.011143763549625874,-0.040569305419921875,0.027123643085360527,0.013987401500344276,0.006710628047585487,-0.06397154927253723,-0.017093636095523834,-0.05271109566092491,0.0483599454164505,-0.04336442053318024,0.021326584741473198,0.014479091390967369,0.09300845116376877,0.016581427305936813,0.011147735640406609,0.032244618982076645,0.0499303936958313,-0.0009731934987939894,0.04225648194551468,-0.023204056546092033,-0.02492261305451393,-0.06082424893975258,0.03334551304578781,-0.000039567941712448373,-0.017489224672317505,0.013705543242394924,0.009447830729186535,-0.014064439572393894,0.03518300876021385,0.0001329399092355743,-0.03262462094426155,0.008695458061993122,-0.048685915768146515,0.02858024090528488,0.001113459118641913,-0.018509220331907272,-0.00339863752014935,0.013129441998898983,-0.012779513373970985,0.028701618313789368,0.02351601980626583,-0.0427885577082634,-0.019905589520931244,0.022269055247306824,-0.02292328141629696,-0.03422900661826134,0.06621326506137848,0.04848403111100197,-0.006977987475693226,-0.026441598311066628,0.022177804261446,-0.05150919407606125,0.038563068956136703,-0.00902990810573101,-0.07451041787862778,0.01817961409687996,0.031045585870742798,0.014641611836850643,0.0022837878204882145,0.026850756257772446,-0.0023083649575710297,0.003003139281645417,0.0021836941596120596,0.07920543849468231,0.003200085600838065,0.01715748757123947,-0.0871511846780777,-0.0039804293774068356,0.10100524127483368,0.03214547783136368,-0.04277120530605316,-0.02203420177102089,0.01680736057460308,0.08083933591842651,-0.013259729370474815,-0.013369353488087654,-0.010122491046786308,0.025462063029408455,-0.009036710485816002,-0.0042298766784369946,-0.04373319819569588,-0.010108034126460552,0.02896939590573311,0.02479691617190838,0.007934571243822575,-0.004804248455911875,-0.05033358931541443,-0.01928958110511303,-0.01809537597000599,-0.0396730899810791,0.001919590518809855,-0.06921610981225967,-0.020338149741292,0.03485843911767006,-0.019548412412405014,-0.011188913136720657,-0.0038769757375121117,-0.020152874290943146,0.035462696105241776,-0.023848766461014748,-0.00997881218791008,0.0020073119085282087,-0.017793070524930954,0.004233760759234428,3.2506528668818646e-7,0.029502131044864655,0.012446553446352482,-0.06295707076787949,0.03361574560403824,-0.01675627939403057,0.04565436393022537,0.001710853772237897,0.030266085639595985,0.02078207954764366,-0.045716673135757446,0.026559527963399887,-0.01132713072001934,0.013740217313170433,0.06567206978797913,0.03891953080892563,0.035549409687519073,0.013590961694717407,-0.042322929948568344,0.014492635615170002,-0.054813869297504425,0.006762475706636906,0.037864286452531815,0.0409206785261631,0.004803858697414398,0.019986296072602272,0.07445425540208817,-0.010944983921945095,0.0004556030035018921,0.010942377150058746,0.05641917511820793,0.04183664172887802,-0.043320391327142715,-0.021198993548750877,-0.0019521537469699979,-0.003783040912821889,0.03436277061700821,-0.019130857661366463,-0.015472764149308205,0.021732116118073463,-0.0322052463889122,-0.054653655737638474,-0.013746671378612518,-0.008631536737084389,0.02654656022787094,-0.013929423876106739,-0.03329136222600937,-0.005241597071290016,-0.0571417510509491,-0.01304480992257595,-0.0011915963841602206,0.044924505054950714,0.011320403777062893,0.0013545253314077854,0.04712139442563057,0.016254249960184097,0.016382338479161263,-0.001056766021065414,0.04204662889242172,0.028577255085110664,-0.010136780329048634,-0.03278697282075882,-0.018653767183423042,0.008332754485309124,0.01913849078118801,0.03462265059351921,0.02798168733716011,-0.0147476214915514,2.6775470016102568e-34,0.03747368976473808,-0.006723611615598202,-0.005092575680464506,0.04219420999288559,0.024108340963721275,0.009803865104913712,0.026756804436445236,-0.03815256804227829,-0.004468758124858141,0.003815067233517766,-0.025324039161205292]';
  p_EmbeddingModelID_07772d8728d8 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_07772d8728d8 := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_07772d8728d8 := FALSE;
  p_IsMaterialized_07772d8728d8 := FALSE;
  p_ID_07772d8728d8 := '5A1E5000-0001-4000-A000-000000000004';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_07772d8728d8,
    'CategoryID', p_CategoryID_07772d8728d8,
    'UserQuestion', p_UserQuestion_07772d8728d8,
    'Description', p_Description_07772d8728d8,
    'SQL', p_SQL_07772d8728d8,
    'TechnicalDescription', p_TechnicalDescription_07772d8728d8,
    'OriginalSQL', p_OriginalSQL_07772d8728d8,
    'Feedback', p_Feedback_07772d8728d8,
    'Status', p_Status_07772d8728d8,
    'QualityRank', p_QualityRank_07772d8728d8,
    'ExecutionCostRank', p_ExecutionCostRank_07772d8728d8,
    'UsesTemplate', p_UsesTemplate_07772d8728d8,
    'AuditQueryRuns', p_AuditQueryRuns_07772d8728d8,
    'CacheEnabled', p_CacheEnabled_07772d8728d8,
    'CacheTTLMinutes', p_CacheTTLMinutes_07772d8728d8,
    'CacheMaxSize', p_CacheMaxSize_07772d8728d8,
    'EmbeddingVector', p_EmbeddingVector_07772d8728d8,
    'EmbeddingModelID', p_EmbeddingModelID_07772d8728d8,
    'CacheValidationSQL', p_CacheValidationSQL_07772d8728d8,
    'SQLDialectID', p_SQLDialectID_07772d8728d8,
    'Reusable', p_Reusable_07772d8728d8,
    'ExternalDataSourceID', p_ExternalDataSourceID_07772d8728d8,
    'IsMaterialized', p_IsMaterialized_07772d8728d8,
    'ID', p_ID_07772d8728d8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_07772d8728d8, p_CategoryID := p_CategoryID_07772d8728d8, p_UserQuestion := p_UserQuestion_07772d8728d8, p_Description := p_Description_07772d8728d8, p_SQL := p_SQL_07772d8728d8, p_TechnicalDescription := p_TechnicalDescription_07772d8728d8, p_OriginalSQL := p_OriginalSQL_07772d8728d8, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_07772d8728d8, p_Feedback_Clear := TRUE, p_Status := p_Status_07772d8728d8, p_QualityRank := p_QualityRank_07772d8728d8, p_ExecutionCostRank := p_ExecutionCostRank_07772d8728d8, p_UsesTemplate := p_UsesTemplate_07772d8728d8, p_AuditQueryRuns := p_AuditQueryRuns_07772d8728d8, p_CacheEnabled := p_CacheEnabled_07772d8728d8, p_CacheTTLMinutes := p_CacheTTLMinutes_07772d8728d8, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_07772d8728d8, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_07772d8728d8, p_EmbeddingModelID := p_EmbeddingModelID_07772d8728d8, p_CacheValidationSQL := p_CacheValidationSQL_07772d8728d8, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_07772d8728d8, p_Reusable := p_Reusable_07772d8728d8, p_ExternalDataSourceID := p_ExternalDataSourceID_07772d8728d8, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_07772d8728d8, p_ID := p_ID_07772d8728d8);
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ID_cea609283ad9 UUID;
  p_Name_cea609283ad9 VARCHAR(255);
  p_CategoryID_cea609283ad9 UUID;
  p_UserQuestion_cea609283ad9 TEXT;
  p_Description_cea609283ad9 TEXT;
  p_SQL_cea609283ad9 TEXT;
  p_TechnicalDescription_cea609283ad9 TEXT;
  p_OriginalSQL_cea609283ad9 TEXT;
  p_Feedback_cea609283ad9 TEXT;
  p_Status_cea609283ad9 VARCHAR(15);
  p_QualityRank_cea609283ad9 INTEGER;
  p_ExecutionCostRank_cea609283ad9 INTEGER;
  p_UsesTemplate_cea609283ad9 BOOLEAN;
  p_AuditQueryRuns_cea609283ad9 BOOLEAN;
  p_CacheEnabled_cea609283ad9 BOOLEAN;
  p_CacheTTLMinutes_cea609283ad9 INTEGER;
  p_CacheMaxSize_cea609283ad9 INTEGER;
  p_EmbeddingVector_cea609283ad9 TEXT;
  p_EmbeddingModelID_cea609283ad9 UUID;
  p_CacheValidationSQL_cea609283ad9 TEXT;
  p_SQLDialectID_cea609283ad9 UUID;
  p_Reusable_cea609283ad9 BOOLEAN;
  p_ExternalDataSourceID_cea609283ad9 UUID;
  p_IsMaterialized_cea609283ad9 BOOLEAN;
BEGIN
  p_ID_cea609283ad9 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_cea609283ad9 := 'Sales: Won Deals With Unconfirmed Orders';
  p_CategoryID_cea609283ad9 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_cea609283ad9 := 'Which won deals have an order that was never confirmed, and so will never be billed?';
  p_Description_cea609283ad9 := 'Finance exception review (golive #279, type 3): every won deal whose order is still not Confirmed, including a voided order and a deal with no order. Closing a deal Won does not confirm its order, and nothing else says when that step never happens. Run at month end until the nightly exception check replaces it.';
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
-- DATE DIMENSION: ActualCloseDate, falling back to the date part of ClosedAt for a deal closed
-- without one. DaysSinceClose counts to the business day from fnBusinessToday(), the same "today"
-- the orders views use, so a deal closed late in the evening does not age a day early.
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
        COALESCE(d.ActualCloseDate, CAST(d.ClosedAt AS DATE)) AS CloseDate
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
  p_TechnicalDescription_cea609283ad9 := 'Grain: Deal. Won is DealStatusType.IsWon. The order is reached through Deal.OrderID and read from __mj_BizAppsOrders.vwOrderHeaders; a deal qualifies when the order is missing or its Status is not Confirmed. Date dimension: ActualCloseDate, falling back to the date part of ClosedAt. DaysSinceClose counts to __mj_BizAppsCommon.fnBusinessToday(). Optional parameters: CompanyID; MinDaysSinceClose (grace period, omitted = no grace); PeriodStart/PeriodEnd bound the close date inclusively.';
  p_Status_cea609283ad9 := 'Approved';
  p_QualityRank_cea609283ad9 := 8;
  p_ExecutionCostRank_cea609283ad9 := 2;
  p_UsesTemplate_cea609283ad9 := TRUE;
  p_AuditQueryRuns_cea609283ad9 := FALSE;
  p_CacheEnabled_cea609283ad9 := FALSE;
  p_EmbeddingVector_cea609283ad9 := '[0.03966303542256355,0.049042679369449615,0.01710617169737816,0.023596493527293205,0.009627814404666424,-0.017773542553186417,-0.016751540824770927,-0.0039036620873957872,-0.05576622858643532,-0.008001770824193954,0.024064473807811737,-0.03330753371119499,0.030289387330412865,0.07262806594371796,-0.0498836487531662,0.06326176971197128,-0.013694444671273232,0.00599103607237339,-0.04476066306233406,-0.020357390865683556,-0.031326182186603546,0.05245564505457878,-0.04867278039455414,-0.021491022780537605,-0.00003777525125769898,-0.01251522172242403,-0.04740568995475769,0.01287300419062376,0.015149611048400402,-0.09324841946363449,0.055237263441085815,0.006659382954239845,-0.017116593196988106,0.03770250827074051,0.0000024299704364239005,-0.0078028105199337006,0.007311227265745401,-0.004617679864168167,-0.07475560903549194,0.04063277691602707,-0.09207767993211746,-0.03770359978079796,-0.016274238005280495,0.00773637555539608,-0.0246511809527874,-0.02059010975062847,0.01556585542857647,0.0786963626742363,-0.054586105048656464,0.00841430202126503,0.011810334399342537,0.061429597437381744,-0.028172651305794716,0.007877993397414684,0.03794577717781067,-0.06712912023067474,0.014475904405117035,-0.07536783814430237,-0.0364563912153244,-0.07289808243513107,0.00877486914396286,0.009056676179170609,-0.019965501502156258,-0.029935752972960472,-0.0412520095705986,0.040694788098335266,-0.05680784583091736,0.004418238066136837,-0.03451406583189964,-0.007420027162879705,-0.00037113321013748646,0.02062661200761795,-0.018750717863440514,-0.009620953351259232,-0.030325690284371376,-0.09137378633022308,-0.03102984093129635,0.046797458082437515,0.022267913445830345,0.0032166980672627687,-0.05288658291101456,0.07906698435544968,0.025952192023396492,0.020579801872372627,-0.05925750359892845,0.020456494763493538,-0.02730853483080864,-0.01839936524629593,-0.05505607649683952,0.04006617143750191,-0.0362454317510128,-0.03465459495782852,0.03558843582868576,-0.050483398139476776,-0.011278437450528145,-0.018532413989305496,0.039029110223054886,0.0844515934586525,0.013195745646953583,0.01934153214097023,-0.014408087357878685,0.007122786249965429,-0.011859514750540257,0.007985131815075874,-0.008708417415618896,-0.060793016105890274,-0.000632014125585556,-0.04550907760858536,-0.009317469783127308,0.06762708723545074,0.019174084067344666,-0.038198716938495636,0.009029893204569817,0.08878526836633682,-0.013348089531064034,-0.0013573012547567487,0.004482683259993792,-0.0022093208972364664,-0.051300931721925735,0.02452792041003704,0.032664310187101364,0.08135872334241867,-0.025946708396077156,-0.0062872967682778835,-0.05578785389661789,0.013346714898943901,0.08193381130695343,0.002415172988548875,0.009352863766252995,0.017943456768989563,0.00034347354085184634,-0.06359262019395828,0.019729187712073326,-0.010895505547523499,-0.011235810816287994,-0.019554685801267624,0.007143891882151365,-0.011851388029754162,-0.02655651606619358,0.0354243740439415,0.04716169834136963,-0.014544109813869,-0.0013885936932638288,0.01824774779379368,-0.04448384419083595,0.017372842878103256,-0.006262217648327351,0.0037975141312927008,0.011275549419224262,0.004720711149275303,0.021872980520129204,-0.00810687243938446,-0.006428676191717386,-0.006481350865215063,-0.07371897250413895,0.004751563537865877,0.09271072596311569,-0.007924975827336311,-0.011274045333266258,0.02646046131849289,0.022009801119565964,-0.01429419033229351,0.039729706943035126,0.00653182715177536,0.048492733389139175,0.039537958800792694,0.014932030811905861,0.004768710117787123,-0.05548849701881409,-0.05608883872628212,0.009686626493930817,-0.004767787642776966,0.032102569937705994,-0.025120630860328674,-0.009644703008234501,-0.03552450239658356,-0.07938715070486069,0.01425053272396326,-0.02697720006108284,-0.08542832732200623,-0.0027039649430662394,-0.030909620225429535,-0.024134380742907524,-0.04568123817443848,-0.08186908811330795,-0.02404393069446087,-0.02393016777932644,-0.04736098274588585,-0.01842864789068699,0.00725992675870657,0.0006036044214852154,-0.005421478766947985,0.006467858329415321,0.018792781978845596,-0.0016791968373581767,-0.029034143313765526,-0.04668794944882393,-0.048758067190647125,-0.017586661502718925,0.030604690313339233,-0.03544504567980766,-0.015114196576178074,0.02131619118154049,0.04587060585618019,0.01724785752594471,0.022631965577602386,-0.045254938304424286,0.026395229622721672,-0.08024714887142181,0.004204489290714264,-0.006365262903273106,0.026587294414639473,0.01975703239440918,0.029124705120921135,0.01079526636749506,0.06322389841079712,0.023184973746538162,0.02237832546234131,-0.046715546399354935,0.030198533087968826,-0.01094332430511713,-0.00441623805090785,-0.032254863530397415,-0.021325955167412758,0.06382833421230316,-0.0005727455136366189,0.037324413657188416,-0.009339872747659683,0.00025028217351064086,-0.017366964370012283,0.027931885793805122,-0.0015509838704019785,0.06132801994681358,-0.003557193325832486,-0.056267738342285156,-0.02349458448588848,-0.03510478883981705,-0.022154858335852623,0.017097188159823418,0.0344281941652298,-0.06433535367250443,0.0594264380633831,-0.008891897276043892,0.02020847052335739,-0.01875253953039646,0.018369024619460106,0.005027857143431902,-0.020404310896992683,0.02723868563771248,0.01902228593826294,-0.005205262918025255,0.04138960689306259,0.012619235552847385,-0.01596641354262829,0.017562273889780045,0.0174823310226202,-0.07069789618253708,0.026282085105776787,0.04905534163117409,-0.011787568219006062,0.07302182912826538,-0.03142112120985985,-0.02519143931567669,-0.03682461008429527,0.021607056260108948,0.02082202211022377,0.042087700217962265,-0.007316140923649073,0.027872905135154724,0.017774123698472977,-0.0015051939990371466,-0.009679561480879784,0.043245602399110794,-0.00643784599378705,-0.009649530984461308,0.06498295813798904,-0.05160127580165863,0.050717420876026154,-0.021990273147821426,-0.0053002056665718555,-0.01614455319941044,-0.02370690554380417,0.002104110550135374,0.002830583369359374,0.01393324974924326,0.008900603279471397,-0.016364987939596176,-0.037610508501529694,-0.08903049677610397,0.05018475651741028,-0.04288347065448761,-0.03006603941321373,0.01157178170979023,-0.011326373554766178,-0.024707350879907608,-0.01205629575997591,-0.06001594290137291,0.004182041622698307,0.025862030684947968,-0.035936322063207626,-0.046666424721479416,0.015310780145227909,-0.020364748314023018,-0.028041940182447433,0.0015292407479137182,-0.023968078196048737,0.05744274705648422,0.03361485153436661,-0.049328625202178955,0.038740940392017365,0.05184778571128845,-0.005661715753376484,-0.020005960017442703,-0.032737910747528076,0.025301814079284668,-0.004636713303625584,-0.00935174711048603,0.07705528289079666,-0.04916318506002426,0.09025674313306808,0.009175979532301426,0.001939247245900333,0.028738511726260185,0.04309787601232529,-0.030358560383319855,0.0010141145903617144,-0.0006538230227306485,-0.014859248884022236,-0.026118170469999313,-0.029349565505981445,-0.010217743925750256,-0.008168411441147327,-0.09122426062822342,0.059135857969522476,-0.045909058302640915,-0.09148360043764114,0.029726387932896614,0.058029208332300186,0.0330963060259819,0.012560680508613586,-0.019445175305008888,0.0011580272112041712,0.005486201960593462,-0.015861913561820984,-0.08843567967414856,-0.009054291062057018,0.09315743297338486,0.03586481511592865,-0.05298003926873207,-0.00975437369197607,-0.04241250082850456,0.035586416721343994,-0.05018892511725426,-0.03700611740350723,-0.006818835623562336,-0.004248243756592274,-0.058231424540281296,-0.05247724428772926,0.017853830009698868,-0.06795533001422882,-0.054675355553627014,0.02873758226633072,0.048859987407922745,0.025607358664274216,0.017048347741365433,0.04715782776474953,0.04214928299188614,0.016248997300863266,-0.014457965269684792,-0.01377444714307785,-0.07090425491333008,0.007856101728975773,0.05273030325770378,-0.01606324128806591,0.019928382709622383,0.03568471968173981,0.02757154032588005,-0.018803132697939873,0.07817549258470535,0.008342383429408073,-0.024853814393281937,-0.03988271206617355,0.053101878613233566,0.00007304729660972953,0.0013112338492646813,0.028361277654767036,-0.039056286215782166,-0.06967838108539581,-0.05109907686710358,0.013049698434770107,-0.0007593780755996704,0.11416448652744293,0.00036760425427928567,0.04720180854201317,0.016166113317012787,-0.00782394502311945,-0.048516448587179184,0.05451861023902893,-0.021756481379270554,0.018536224961280823,0.018784787505865097,0.03750170022249222,0.0889541283249855,0.04802682250738144,0.04764534905552864,-0.03523002937436104,-0.010058406740427017,-0.02068313956260681,-0.04630281776189804,0.054496560245752335,0.0029566341545432806,-0.02248959057033062,0.0009446806507185102,0.0031407331116497517,0.024075547233223915,0.01738470047712326,0.011272837407886982,-0.04159115254878998,-0.021159617230296135,-0.047473251819610596,0.008726844564080238,0.03790920972824097,0.04861925542354584,0.019901400431990623,-0.05145791545510292,-0.02405432239174843,-0.02848099172115326,-0.01978502795100212,-0.009281179867684841,-0.05025665462017059,-0.037462543696165085,-0.018206430599093437,-0.02213796228170395,0.04289647936820984,-0.0027302668895572424,0.0048077041283249855,0.0100077074021101,0.07761934399604797,-0.040344834327697754,0.03046306222677231,-0.06332562118768692,0.01613156870007515,0.035018183290958405,0.025221137329936028,0.014045868068933487,0.0547933466732502,-0.014597825706005096,0.048643168061971664,-0.0302750114351511,-0.044860851019620895,0.008636662736535072,-0.09007991850376129,0.09995855391025543,-0.044143106788396835,-0.021298415958881378,0.0024853572249412537,0.01630130223929882,-0.026055773720145226,-0.005644073709845543,-0.014763577841222286,-0.013424419797956944,0.018644453957676888,-0.05283742770552635,0.01992526650428772,0.03605112060904503,-0.07051543146371841,0.04109849035739899,-0.026390260085463524,0.017317786812782288,0.02068742923438549,0.040174584835767746,0.0242170263081789,-0.037203844636678696,0.0064730048179626465,0.04948846623301506,-0.015888139605522156,-0.011712037026882172,0.006514021661132574,0.05438080430030823,0.036058757454156876,-0.028494393453001976,-0.00015858965343795717,0.010013417340815067,-0.0727166011929512,-0.017791826277971268,0.05127866193652153,0.02994683012366295,0.020032983273267746,-0.03610124811530113,0.01585783064365387,0.027242355048656464,0.013683566823601723,-0.06416597962379456,0.004638403654098511,-0.006284244824200869,0.10587141662836075,0.043271373957395554,-0.07618945837020874,0.04902568459510803,-0.008753719739615917,0.020907189697027206,0.01256887149065733,0.038851987570524216,0.0022523077204823494,-0.008419901132583618,0.04256735369563103,0.00914403609931469,-0.028604531660676003,0.022691234946250916,-0.017872020602226257,0.021218523383140564,0.005772284232079983,0.0026662310119718313,0.02659221738576889,0.00041456782491877675,-0.03827109932899475,-0.002294102916494012,-0.008212617598474026,-0.01589699648320675,0.01591392047703266,0.04135657474398613,0.00362682924605906,-0.017578991129994392,-0.02311623841524124,0.06446152925491333,-0.07108752429485321,0.023778114467859268,0.006051938980817795,0.06232058256864548,0.00163560442160815,-0.004935124423354864,0.06271588057279587,0.017931288108229637,0.053716015070676804,0.009955508634448051,0.0265947375446558,-0.027825143188238144,-0.0029300195164978504,0.0473964624106884,-0.035562921315431595,0.004726835060864687,0.0071199266240000725,0.04684098809957504,0.017382103949785233,-0.01839423179626465,-0.016558028757572174,0.004665075335651636,-0.00020405878603924066,-0.05788319185376167,0.050372038036584854,-0.008381701074540615,0.003055707085877657,0.0614585317671299,-0.019183965399861336,-0.03647961840033531,-7.384967586592187e-33,-0.014028744772076607,-0.06233081966638565,-0.018445970490574837,0.03164724260568619,-0.011451533995568752,0.014124558307230473,0.007255174685269594,0.0220536720007658,0.03572135791182518,0.03092327155172825,-0.00219888798892498,0.01512780599296093,0.03826405107975006,0.012359300628304482,0.06766624748706818,0.02149284817278385,0.02979809232056141,-0.0008328579715453088,0.026333604007959366,0.02309195138514042,-0.02371339127421379,0.06081363558769226,0.05255633220076561,0.020631836727261543,0.009822629392147064,-0.025883734226226807,-0.04802126809954643,0.0077318111434578896,-0.0068716080859303474,-0.0322718620300293,-0.00809919461607933,0.015677835792303085,-0.0028566874098032713,0.017663441598415375,-0.008320277556777,-0.11549070477485657,0.03358503431081772,-0.004139905795454979,0.008590650744736195,-0.0038539988454431295,0.020005041733384132,0.02380606159567833,-0.006653978023678064,-0.0037241338286548853,-0.03573262318968773,0.018223077058792114,0.021187543869018555,0.017740117385983467,-0.0023968347813934088,0.018893999978899956,0.04524960741400719,0.013702877797186375,-0.03626980632543564,-0.058831363916397095,-0.004917476326227188,0.05924030765891075,0.035698626190423965,-0.03626278415322304,-0.019859598949551582,0.030779996886849403,-0.06765075773000717,0.02866203524172306,-0.020349664613604546,-0.06412606686353683,-0.05968250706791878,0.001397157902829349,-0.025423958897590637,-0.019934674724936485,-0.03959118574857712,-0.05144500732421875,-0.04185150936245918,0.06407910585403442,-0.06175447627902031,-0.07205761969089508,-0.02939068153500557,0.013444586656987667,0.01961737684905529,0.01979915052652359,0.003974298946559429,-0.016589423641562462,0.038607157766819,-0.02121320739388466,-0.022332075983285904,-0.018053555861115456,0.0468621701002121,-0.028823144733905792,-0.009612860158085823,0.010949322022497654,0.014810415916144848,0.0008750020060688257,0.004648204892873764,0.017695218324661255,-0.026052162051200867,0.005150454118847847,-0.10266793519258499,0.033773623406887054,0.04763009026646614,0.0511496476829052,-0.00014644466864410788,0.0017524855211377144,0.030456220731139183,0.04109643027186394,-0.004065423738211393,0.025473343208432198,-0.02558584325015545,-0.004593107383698225,0.038837507367134094,0.052784621715545654,-0.03197943791747093,0.004634501878172159,-0.012563202530145645,0.024681301787495613,-0.006059585139155388,0.004596120677888393,0.0008466629660688341,-0.04188387095928192,0.0002937094250228256,-0.04212329909205437,0.011563751846551895,-0.013749105855822563,-0.06000524014234543,0.02088305540382862,-0.01489690225571394,0.0354323647916317,-0.050093188881874084,0.006581335794180632,-0.016164833679795265,-0.006721962243318558,-0.05860564485192299,0.029279137030243874,0.003353003179654479,0.01195899210870266,3.1586628779223247e-7,-0.022999199107289314,0.015999265015125275,-0.03133092820644379,0.0811210572719574,-0.019422948360443115,0.01351900864392519,0.0057897139340639114,0.0016861718613654375,0.032028183341026306,0.009113859385251999,0.03392057493329048,-0.04543944448232651,-0.013891058042645454,-0.022116217762231827,-0.023032035678625107,0.014760628342628479,0.01926901377737522,-0.02935216948390007,-0.02309514954686165,-0.037398919463157654,-0.021655583754181862,-0.005658066365867853,0.02935187704861164,-0.015637006610631943,0.011138537898659706,0.0355408638715744,-0.008414722979068756,-0.04285455122590065,-0.06964126974344254,-0.04969830438494682,0.0757024958729744,-0.03110458143055439,0.033434826880693436,-0.023189790546894073,0.02234036475419998,0.020135369151830673,0.021888362243771553,0.02254895120859146,0.019549937918782234,-0.034044183790683746,-0.03104223683476448,-0.06540542840957642,-0.02657359465956688,0.004524368327111006,0.033190060406923294,0.002611882286146283,-0.010782663710415363,0.07432841509580612,-0.004347139038145542,-0.03519125282764435,-0.023016154766082764,0.04394161328673363,0.007851696573197842,0.024024173617362976,0.026816952973604202,-0.002185873920097947,-0.020613400265574455,0.03615101799368858,0.01856665126979351,0.0075432066805660725,-0.010689678601920605,-0.020432215183973312,0.03624018281698227,-0.007918309420347214,-0.04098134860396385,-0.023138487711548805,-0.021972494199872017,2.4867084784078835e-34,0.06006069481372833,-0.009133018553256989,0.0014262156328186393,0.018416648730635643,0.020316042006015778,-0.01602342166006565,0.0953393429517746,-0.037369854748249054,-0.02902698889374733,-0.008433145470917225,-0.02575993537902832]';
  p_EmbeddingModelID_cea609283ad9 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_Reusable_cea609283ad9 := FALSE;
  p_IsMaterialized_cea609283ad9 := FALSE;
  p_CategoryID_cea609283ad9 := COALESCE((SELECT "ID" FROM "${mjSchema}"."QueryCategory" WHERE "Name" = 'Sales' ORDER BY CASE WHEN "ID" = p_CategoryID_cea609283ad9 THEN 0 ELSE 1 END LIMIT 1), p_CategoryID_cea609283ad9);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Query"
               WHERE "ID" = p_ID_cea609283ad9
                  OR ("Name" = p_Name_cea609283ad9 AND ("CategoryID" = p_CategoryID_cea609283ad9 OR ("CategoryID" IS NULL AND p_CategoryID_cea609283ad9 IS NULL)))) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQuery"(p_data := jsonb_build_object(
      'ID', p_ID_cea609283ad9,
      'Name', p_Name_cea609283ad9,
      'CategoryID', p_CategoryID_cea609283ad9,
      'UserQuestion', p_UserQuestion_cea609283ad9,
      'Description', p_Description_cea609283ad9,
      'SQL', p_SQL_cea609283ad9,
      'TechnicalDescription', p_TechnicalDescription_cea609283ad9,
      'OriginalSQL', p_OriginalSQL_cea609283ad9,
      'Feedback', p_Feedback_cea609283ad9,
      'Status', p_Status_cea609283ad9,
      'QualityRank', p_QualityRank_cea609283ad9,
      'ExecutionCostRank', p_ExecutionCostRank_cea609283ad9,
      'UsesTemplate', p_UsesTemplate_cea609283ad9,
      'AuditQueryRuns', p_AuditQueryRuns_cea609283ad9,
      'CacheEnabled', p_CacheEnabled_cea609283ad9,
      'CacheTTLMinutes', p_CacheTTLMinutes_cea609283ad9,
      'CacheMaxSize', p_CacheMaxSize_cea609283ad9,
      'EmbeddingVector', p_EmbeddingVector_cea609283ad9,
      'EmbeddingModelID', p_EmbeddingModelID_cea609283ad9,
      'CacheValidationSQL', p_CacheValidationSQL_cea609283ad9,
      'SQLDialectID', p_SQLDialectID_cea609283ad9,
      'Reusable', p_Reusable_cea609283ad9,
      'ExternalDataSourceID', p_ExternalDataSourceID_cea609283ad9,
      'IsMaterialized', p_IsMaterialized_cea609283ad9
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQuery"(p_ID := p_ID_cea609283ad9, p_Name := p_Name_cea609283ad9, p_CategoryID := p_CategoryID_cea609283ad9, p_UserQuestion := p_UserQuestion_cea609283ad9, p_Description := p_Description_cea609283ad9, p_SQL := p_SQL_cea609283ad9, p_TechnicalDescription := p_TechnicalDescription_cea609283ad9, p_OriginalSQL := p_OriginalSQL_cea609283ad9, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_cea609283ad9, p_Feedback_Clear := TRUE, p_Status := p_Status_cea609283ad9, p_QualityRank := p_QualityRank_cea609283ad9, p_ExecutionCostRank := p_ExecutionCostRank_cea609283ad9, p_UsesTemplate := p_UsesTemplate_cea609283ad9, p_AuditQueryRuns := p_AuditQueryRuns_cea609283ad9, p_CacheEnabled := p_CacheEnabled_cea609283ad9, p_CacheTTLMinutes := p_CacheTTLMinutes_cea609283ad9, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_cea609283ad9, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_cea609283ad9, p_EmbeddingModelID := p_EmbeddingModelID_cea609283ad9, p_CacheValidationSQL := p_CacheValidationSQL_cea609283ad9, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_cea609283ad9, p_Reusable := p_Reusable_cea609283ad9, p_ExternalDataSourceID := p_ExternalDataSourceID_cea609283ad9, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_cea609283ad9);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_b8ce59731faa UUID;
  p_QueryID_b8ce59731faa UUID;
  p_Name_b8ce59731faa VARCHAR(255);
  p_Type_b8ce59731faa VARCHAR(50);
  p_IsRequired_b8ce59731faa BOOLEAN;
  p_DefaultValue_b8ce59731faa TEXT;
  p_Description_b8ce59731faa TEXT;
  p_SampleValue_b8ce59731faa TEXT;
  p_ValidationFilters_b8ce59731faa TEXT;
  p_DetectionMethod_b8ce59731faa VARCHAR(50);
  p_AutoDetectConfidenceScore_b8ce59731faa NUMERIC(3,2);
BEGIN
  p_ID_b8ce59731faa := 'e6572bae-f718-43ff-9ae6-b40c01e047d6';
  p_QueryID_b8ce59731faa := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_b8ce59731faa := 'CompanyID';
  p_Type_b8ce59731faa := 'string';
  p_IsRequired_b8ce59731faa := FALSE;
  p_Description_b8ce59731faa := 'Optional text value for Company I D';
  p_SampleValue_b8ce59731faa := 'Example';
  p_DetectionMethod_b8ce59731faa := 'AI';
  p_QueryID_b8ce59731faa := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_b8ce59731faa THEN 0 ELSE 1 END LIMIT 1), p_QueryID_b8ce59731faa);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
               WHERE "ID" = p_ID_b8ce59731faa
                  OR ("QueryID" = p_QueryID_b8ce59731faa AND "Name" = p_Name_b8ce59731faa)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
      'ID', p_ID_b8ce59731faa,
      'QueryID', p_QueryID_b8ce59731faa,
      'Name', p_Name_b8ce59731faa,
      'Type', p_Type_b8ce59731faa,
      'IsRequired', p_IsRequired_b8ce59731faa,
      'DefaultValue', p_DefaultValue_b8ce59731faa,
      'Description', p_Description_b8ce59731faa,
      'SampleValue', p_SampleValue_b8ce59731faa,
      'ValidationFilters', p_ValidationFilters_b8ce59731faa,
      'DetectionMethod', p_DetectionMethod_b8ce59731faa,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b8ce59731faa
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_b8ce59731faa, p_QueryID := p_QueryID_b8ce59731faa, p_Name := p_Name_b8ce59731faa, p_Type := p_Type_b8ce59731faa, p_IsRequired := p_IsRequired_b8ce59731faa, p_DefaultValue := p_DefaultValue_b8ce59731faa, p_DefaultValue_Clear := TRUE, p_Description := p_Description_b8ce59731faa, p_SampleValue := p_SampleValue_b8ce59731faa, p_ValidationFilters := p_ValidationFilters_b8ce59731faa, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b8ce59731faa, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b8ce59731faa, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_e8fc40294232 UUID;
  p_QueryID_e8fc40294232 UUID;
  p_Name_e8fc40294232 VARCHAR(255);
  p_Type_e8fc40294232 VARCHAR(50);
  p_IsRequired_e8fc40294232 BOOLEAN;
  p_DefaultValue_e8fc40294232 TEXT;
  p_Description_e8fc40294232 TEXT;
  p_SampleValue_e8fc40294232 TEXT;
  p_ValidationFilters_e8fc40294232 TEXT;
  p_DetectionMethod_e8fc40294232 VARCHAR(50);
  p_AutoDetectConfidenceScore_e8fc40294232 NUMERIC(3,2);
BEGIN
  p_ID_e8fc40294232 := 'f8d2f876-059a-49c0-851c-cad5d0329c2c';
  p_QueryID_e8fc40294232 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_e8fc40294232 := 'MinDaysSinceClose';
  p_Type_e8fc40294232 := 'number';
  p_IsRequired_e8fc40294232 := FALSE;
  p_Description_e8fc40294232 := 'Optional numeric value for Min Days Since Close';
  p_SampleValue_e8fc40294232 := '10';
  p_DetectionMethod_e8fc40294232 := 'AI';
  p_QueryID_e8fc40294232 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_e8fc40294232 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_e8fc40294232);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
               WHERE "ID" = p_ID_e8fc40294232
                  OR ("QueryID" = p_QueryID_e8fc40294232 AND "Name" = p_Name_e8fc40294232)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
      'ID', p_ID_e8fc40294232,
      'QueryID', p_QueryID_e8fc40294232,
      'Name', p_Name_e8fc40294232,
      'Type', p_Type_e8fc40294232,
      'IsRequired', p_IsRequired_e8fc40294232,
      'DefaultValue', p_DefaultValue_e8fc40294232,
      'Description', p_Description_e8fc40294232,
      'SampleValue', p_SampleValue_e8fc40294232,
      'ValidationFilters', p_ValidationFilters_e8fc40294232,
      'DetectionMethod', p_DetectionMethod_e8fc40294232,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_e8fc40294232
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_e8fc40294232, p_QueryID := p_QueryID_e8fc40294232, p_Name := p_Name_e8fc40294232, p_Type := p_Type_e8fc40294232, p_IsRequired := p_IsRequired_e8fc40294232, p_DefaultValue := p_DefaultValue_e8fc40294232, p_DefaultValue_Clear := TRUE, p_Description := p_Description_e8fc40294232, p_SampleValue := p_SampleValue_e8fc40294232, p_ValidationFilters := p_ValidationFilters_e8fc40294232, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_e8fc40294232, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_e8fc40294232, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_cd1de5e7d42f UUID;
  p_QueryID_cd1de5e7d42f UUID;
  p_Name_cd1de5e7d42f VARCHAR(255);
  p_Type_cd1de5e7d42f VARCHAR(50);
  p_IsRequired_cd1de5e7d42f BOOLEAN;
  p_DefaultValue_cd1de5e7d42f TEXT;
  p_Description_cd1de5e7d42f TEXT;
  p_SampleValue_cd1de5e7d42f TEXT;
  p_ValidationFilters_cd1de5e7d42f TEXT;
  p_DetectionMethod_cd1de5e7d42f VARCHAR(50);
  p_AutoDetectConfidenceScore_cd1de5e7d42f NUMERIC(3,2);
BEGIN
  p_ID_cd1de5e7d42f := '9ab02341-0165-4e6f-88e3-62e4850a458c';
  p_QueryID_cd1de5e7d42f := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_cd1de5e7d42f := 'PeriodStart';
  p_Type_cd1de5e7d42f := 'string';
  p_IsRequired_cd1de5e7d42f := FALSE;
  p_Description_cd1de5e7d42f := 'Optional text value for Period Start';
  p_SampleValue_cd1de5e7d42f := 'Example';
  p_DetectionMethod_cd1de5e7d42f := 'AI';
  p_QueryID_cd1de5e7d42f := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_cd1de5e7d42f THEN 0 ELSE 1 END LIMIT 1), p_QueryID_cd1de5e7d42f);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
               WHERE "ID" = p_ID_cd1de5e7d42f
                  OR ("QueryID" = p_QueryID_cd1de5e7d42f AND "Name" = p_Name_cd1de5e7d42f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
      'ID', p_ID_cd1de5e7d42f,
      'QueryID', p_QueryID_cd1de5e7d42f,
      'Name', p_Name_cd1de5e7d42f,
      'Type', p_Type_cd1de5e7d42f,
      'IsRequired', p_IsRequired_cd1de5e7d42f,
      'DefaultValue', p_DefaultValue_cd1de5e7d42f,
      'Description', p_Description_cd1de5e7d42f,
      'SampleValue', p_SampleValue_cd1de5e7d42f,
      'ValidationFilters', p_ValidationFilters_cd1de5e7d42f,
      'DetectionMethod', p_DetectionMethod_cd1de5e7d42f,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_cd1de5e7d42f
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_cd1de5e7d42f, p_QueryID := p_QueryID_cd1de5e7d42f, p_Name := p_Name_cd1de5e7d42f, p_Type := p_Type_cd1de5e7d42f, p_IsRequired := p_IsRequired_cd1de5e7d42f, p_DefaultValue := p_DefaultValue_cd1de5e7d42f, p_DefaultValue_Clear := TRUE, p_Description := p_Description_cd1de5e7d42f, p_SampleValue := p_SampleValue_cd1de5e7d42f, p_ValidationFilters := p_ValidationFilters_cd1de5e7d42f, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_cd1de5e7d42f, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_cd1de5e7d42f, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_302c8d0182d9 UUID;
  p_QueryID_302c8d0182d9 UUID;
  p_Name_302c8d0182d9 VARCHAR(255);
  p_Type_302c8d0182d9 VARCHAR(50);
  p_IsRequired_302c8d0182d9 BOOLEAN;
  p_DefaultValue_302c8d0182d9 TEXT;
  p_Description_302c8d0182d9 TEXT;
  p_SampleValue_302c8d0182d9 TEXT;
  p_ValidationFilters_302c8d0182d9 TEXT;
  p_DetectionMethod_302c8d0182d9 VARCHAR(50);
  p_AutoDetectConfidenceScore_302c8d0182d9 NUMERIC(3,2);
BEGIN
  p_ID_302c8d0182d9 := '56c91dab-2491-4051-9beb-c28983f1a778';
  p_QueryID_302c8d0182d9 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_302c8d0182d9 := 'PeriodEnd';
  p_Type_302c8d0182d9 := 'string';
  p_IsRequired_302c8d0182d9 := FALSE;
  p_Description_302c8d0182d9 := 'Optional text value for Period End';
  p_SampleValue_302c8d0182d9 := 'Example';
  p_DetectionMethod_302c8d0182d9 := 'AI';
  p_QueryID_302c8d0182d9 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_302c8d0182d9 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_302c8d0182d9);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
               WHERE "ID" = p_ID_302c8d0182d9
                  OR ("QueryID" = p_QueryID_302c8d0182d9 AND "Name" = p_Name_302c8d0182d9)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
      'ID', p_ID_302c8d0182d9,
      'QueryID', p_QueryID_302c8d0182d9,
      'Name', p_Name_302c8d0182d9,
      'Type', p_Type_302c8d0182d9,
      'IsRequired', p_IsRequired_302c8d0182d9,
      'DefaultValue', p_DefaultValue_302c8d0182d9,
      'Description', p_Description_302c8d0182d9,
      'SampleValue', p_SampleValue_302c8d0182d9,
      'ValidationFilters', p_ValidationFilters_302c8d0182d9,
      'DetectionMethod', p_DetectionMethod_302c8d0182d9,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_302c8d0182d9
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_302c8d0182d9, p_QueryID := p_QueryID_302c8d0182d9, p_Name := p_Name_302c8d0182d9, p_Type := p_Type_302c8d0182d9, p_IsRequired := p_IsRequired_302c8d0182d9, p_DefaultValue := p_DefaultValue_302c8d0182d9, p_DefaultValue_Clear := TRUE, p_Description := p_Description_302c8d0182d9, p_SampleValue := p_SampleValue_302c8d0182d9, p_ValidationFilters := p_ValidationFilters_302c8d0182d9, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_302c8d0182d9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_302c8d0182d9, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_d7dfb0d6a3ed UUID;
  p_QueryID_d7dfb0d6a3ed UUID;
  p_Name_d7dfb0d6a3ed VARCHAR(255);
  p_Description_d7dfb0d6a3ed TEXT;
  p_Sequence_d7dfb0d6a3ed INTEGER;
  p_SQLBaseType_d7dfb0d6a3ed VARCHAR(50);
  p_SQLFullType_d7dfb0d6a3ed VARCHAR(100);
  p_SourceEntityID_d7dfb0d6a3ed UUID;
  p_SourceFieldName_d7dfb0d6a3ed VARCHAR(255);
  p_IsComputed_d7dfb0d6a3ed BOOLEAN;
  p_ComputationDescription_d7dfb0d6a3ed TEXT;
  p_IsSummary_d7dfb0d6a3ed BOOLEAN;
  p_SummaryDescription_d7dfb0d6a3ed TEXT;
  p_DetectionMethod_d7dfb0d6a3ed VARCHAR(50);
  p_AutoDetectConfidenceScore_d7dfb0d6a3ed NUMERIC(3,2);
BEGIN
  p_ID_d7dfb0d6a3ed := '3e40dcd0-b4cc-477f-8d8c-255c9b0acba8';
  p_QueryID_d7dfb0d6a3ed := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_d7dfb0d6a3ed := 'DealID';
  p_Description_d7dfb0d6a3ed := 'ID (aliased as DealID)';
  p_Sequence_d7dfb0d6a3ed := 1;
  p_SQLBaseType_d7dfb0d6a3ed := 'uniqueidentifier';
  p_SQLFullType_d7dfb0d6a3ed := 'uniqueidentifier';
  p_SourceEntityID_d7dfb0d6a3ed := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_d7dfb0d6a3ed := 'ID';
  p_IsComputed_d7dfb0d6a3ed := FALSE;
  p_IsSummary_d7dfb0d6a3ed := FALSE;
  p_DetectionMethod_d7dfb0d6a3ed := 'Manual';
  p_QueryID_d7dfb0d6a3ed := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_d7dfb0d6a3ed THEN 0 ELSE 1 END LIMIT 1), p_QueryID_d7dfb0d6a3ed);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_d7dfb0d6a3ed
                  OR ("QueryID" = p_QueryID_d7dfb0d6a3ed AND "Name" = p_Name_d7dfb0d6a3ed)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_d7dfb0d6a3ed,
      'QueryID', p_QueryID_d7dfb0d6a3ed,
      'Name', p_Name_d7dfb0d6a3ed,
      'Description', p_Description_d7dfb0d6a3ed,
      'Sequence', p_Sequence_d7dfb0d6a3ed,
      'SQLBaseType', p_SQLBaseType_d7dfb0d6a3ed,
      'SQLFullType', p_SQLFullType_d7dfb0d6a3ed,
      'SourceEntityID', p_SourceEntityID_d7dfb0d6a3ed,
      'SourceFieldName', p_SourceFieldName_d7dfb0d6a3ed,
      'IsComputed', p_IsComputed_d7dfb0d6a3ed,
      'ComputationDescription', p_ComputationDescription_d7dfb0d6a3ed,
      'IsSummary', p_IsSummary_d7dfb0d6a3ed,
      'SummaryDescription', p_SummaryDescription_d7dfb0d6a3ed,
      'DetectionMethod', p_DetectionMethod_d7dfb0d6a3ed,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_d7dfb0d6a3ed
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_d7dfb0d6a3ed, p_QueryID := p_QueryID_d7dfb0d6a3ed, p_Name := p_Name_d7dfb0d6a3ed, p_Description := p_Description_d7dfb0d6a3ed, p_Sequence := p_Sequence_d7dfb0d6a3ed, p_SQLBaseType := p_SQLBaseType_d7dfb0d6a3ed, p_SQLFullType := p_SQLFullType_d7dfb0d6a3ed, p_SourceEntityID := p_SourceEntityID_d7dfb0d6a3ed, p_SourceFieldName := p_SourceFieldName_d7dfb0d6a3ed, p_IsComputed := p_IsComputed_d7dfb0d6a3ed, p_ComputationDescription := p_ComputationDescription_d7dfb0d6a3ed, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_d7dfb0d6a3ed, p_SummaryDescription := p_SummaryDescription_d7dfb0d6a3ed, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_d7dfb0d6a3ed, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_d7dfb0d6a3ed, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_2fed37d88bce UUID;
  p_QueryID_2fed37d88bce UUID;
  p_Name_2fed37d88bce VARCHAR(255);
  p_Description_2fed37d88bce TEXT;
  p_Sequence_2fed37d88bce INTEGER;
  p_SQLBaseType_2fed37d88bce VARCHAR(50);
  p_SQLFullType_2fed37d88bce VARCHAR(100);
  p_SourceEntityID_2fed37d88bce UUID;
  p_SourceFieldName_2fed37d88bce VARCHAR(255);
  p_IsComputed_2fed37d88bce BOOLEAN;
  p_ComputationDescription_2fed37d88bce TEXT;
  p_IsSummary_2fed37d88bce BOOLEAN;
  p_SummaryDescription_2fed37d88bce TEXT;
  p_DetectionMethod_2fed37d88bce VARCHAR(50);
  p_AutoDetectConfidenceScore_2fed37d88bce NUMERIC(3,2);
BEGIN
  p_ID_2fed37d88bce := '1a6e54b5-56c1-4150-baea-f957a080bdf2';
  p_QueryID_2fed37d88bce := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_2fed37d88bce := 'DealNumber';
  p_Description_2fed37d88bce := 'DealNumber';
  p_Sequence_2fed37d88bce := 2;
  p_SQLBaseType_2fed37d88bce := 'nvarchar';
  p_SQLFullType_2fed37d88bce := 'nvarchar(50)';
  p_SourceEntityID_2fed37d88bce := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_2fed37d88bce := 'DealNumber';
  p_IsComputed_2fed37d88bce := FALSE;
  p_IsSummary_2fed37d88bce := FALSE;
  p_DetectionMethod_2fed37d88bce := 'Manual';
  p_QueryID_2fed37d88bce := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_2fed37d88bce THEN 0 ELSE 1 END LIMIT 1), p_QueryID_2fed37d88bce);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_2fed37d88bce
                  OR ("QueryID" = p_QueryID_2fed37d88bce AND "Name" = p_Name_2fed37d88bce)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_2fed37d88bce,
      'QueryID', p_QueryID_2fed37d88bce,
      'Name', p_Name_2fed37d88bce,
      'Description', p_Description_2fed37d88bce,
      'Sequence', p_Sequence_2fed37d88bce,
      'SQLBaseType', p_SQLBaseType_2fed37d88bce,
      'SQLFullType', p_SQLFullType_2fed37d88bce,
      'SourceEntityID', p_SourceEntityID_2fed37d88bce,
      'SourceFieldName', p_SourceFieldName_2fed37d88bce,
      'IsComputed', p_IsComputed_2fed37d88bce,
      'ComputationDescription', p_ComputationDescription_2fed37d88bce,
      'IsSummary', p_IsSummary_2fed37d88bce,
      'SummaryDescription', p_SummaryDescription_2fed37d88bce,
      'DetectionMethod', p_DetectionMethod_2fed37d88bce,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_2fed37d88bce
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_2fed37d88bce, p_QueryID := p_QueryID_2fed37d88bce, p_Name := p_Name_2fed37d88bce, p_Description := p_Description_2fed37d88bce, p_Sequence := p_Sequence_2fed37d88bce, p_SQLBaseType := p_SQLBaseType_2fed37d88bce, p_SQLFullType := p_SQLFullType_2fed37d88bce, p_SourceEntityID := p_SourceEntityID_2fed37d88bce, p_SourceFieldName := p_SourceFieldName_2fed37d88bce, p_IsComputed := p_IsComputed_2fed37d88bce, p_ComputationDescription := p_ComputationDescription_2fed37d88bce, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_2fed37d88bce, p_SummaryDescription := p_SummaryDescription_2fed37d88bce, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_2fed37d88bce, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_2fed37d88bce, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_8df01a42309b UUID;
  p_QueryID_8df01a42309b UUID;
  p_Name_8df01a42309b VARCHAR(255);
  p_Description_8df01a42309b TEXT;
  p_Sequence_8df01a42309b INTEGER;
  p_SQLBaseType_8df01a42309b VARCHAR(50);
  p_SQLFullType_8df01a42309b VARCHAR(100);
  p_SourceEntityID_8df01a42309b UUID;
  p_SourceFieldName_8df01a42309b VARCHAR(255);
  p_IsComputed_8df01a42309b BOOLEAN;
  p_ComputationDescription_8df01a42309b TEXT;
  p_IsSummary_8df01a42309b BOOLEAN;
  p_SummaryDescription_8df01a42309b TEXT;
  p_DetectionMethod_8df01a42309b VARCHAR(50);
  p_AutoDetectConfidenceScore_8df01a42309b NUMERIC(3,2);
BEGIN
  p_ID_8df01a42309b := '5cbda0ef-c4f3-4eda-8d09-b21e1053557b';
  p_QueryID_8df01a42309b := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_8df01a42309b := 'DealName';
  p_Description_8df01a42309b := 'Name (aliased as DealName)';
  p_Sequence_8df01a42309b := 3;
  p_SQLBaseType_8df01a42309b := 'nvarchar';
  p_SQLFullType_8df01a42309b := 'nvarchar(500)';
  p_SourceEntityID_8df01a42309b := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_8df01a42309b := 'Name';
  p_IsComputed_8df01a42309b := FALSE;
  p_IsSummary_8df01a42309b := FALSE;
  p_DetectionMethod_8df01a42309b := 'Manual';
  p_QueryID_8df01a42309b := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_8df01a42309b THEN 0 ELSE 1 END LIMIT 1), p_QueryID_8df01a42309b);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_8df01a42309b
                  OR ("QueryID" = p_QueryID_8df01a42309b AND "Name" = p_Name_8df01a42309b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_8df01a42309b,
      'QueryID', p_QueryID_8df01a42309b,
      'Name', p_Name_8df01a42309b,
      'Description', p_Description_8df01a42309b,
      'Sequence', p_Sequence_8df01a42309b,
      'SQLBaseType', p_SQLBaseType_8df01a42309b,
      'SQLFullType', p_SQLFullType_8df01a42309b,
      'SourceEntityID', p_SourceEntityID_8df01a42309b,
      'SourceFieldName', p_SourceFieldName_8df01a42309b,
      'IsComputed', p_IsComputed_8df01a42309b,
      'ComputationDescription', p_ComputationDescription_8df01a42309b,
      'IsSummary', p_IsSummary_8df01a42309b,
      'SummaryDescription', p_SummaryDescription_8df01a42309b,
      'DetectionMethod', p_DetectionMethod_8df01a42309b,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8df01a42309b
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_8df01a42309b, p_QueryID := p_QueryID_8df01a42309b, p_Name := p_Name_8df01a42309b, p_Description := p_Description_8df01a42309b, p_Sequence := p_Sequence_8df01a42309b, p_SQLBaseType := p_SQLBaseType_8df01a42309b, p_SQLFullType := p_SQLFullType_8df01a42309b, p_SourceEntityID := p_SourceEntityID_8df01a42309b, p_SourceFieldName := p_SourceFieldName_8df01a42309b, p_IsComputed := p_IsComputed_8df01a42309b, p_ComputationDescription := p_ComputationDescription_8df01a42309b, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_8df01a42309b, p_SummaryDescription := p_SummaryDescription_8df01a42309b, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8df01a42309b, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8df01a42309b, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_ea90ef04c9a9 UUID;
  p_QueryID_ea90ef04c9a9 UUID;
  p_Name_ea90ef04c9a9 VARCHAR(255);
  p_Description_ea90ef04c9a9 TEXT;
  p_Sequence_ea90ef04c9a9 INTEGER;
  p_SQLBaseType_ea90ef04c9a9 VARCHAR(50);
  p_SQLFullType_ea90ef04c9a9 VARCHAR(100);
  p_SourceEntityID_ea90ef04c9a9 UUID;
  p_SourceFieldName_ea90ef04c9a9 VARCHAR(255);
  p_IsComputed_ea90ef04c9a9 BOOLEAN;
  p_ComputationDescription_ea90ef04c9a9 TEXT;
  p_IsSummary_ea90ef04c9a9 BOOLEAN;
  p_SummaryDescription_ea90ef04c9a9 TEXT;
  p_DetectionMethod_ea90ef04c9a9 VARCHAR(50);
  p_AutoDetectConfidenceScore_ea90ef04c9a9 NUMERIC(3,2);
BEGIN
  p_ID_ea90ef04c9a9 := 'cad9778a-afcc-471c-9d00-30a8afb48b14';
  p_QueryID_ea90ef04c9a9 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_ea90ef04c9a9 := 'CompanyID';
  p_Description_ea90ef04c9a9 := 'CompanyID';
  p_Sequence_ea90ef04c9a9 := 4;
  p_SQLBaseType_ea90ef04c9a9 := 'uniqueidentifier';
  p_SQLFullType_ea90ef04c9a9 := 'uniqueidentifier';
  p_SourceEntityID_ea90ef04c9a9 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_ea90ef04c9a9 := 'CompanyID';
  p_IsComputed_ea90ef04c9a9 := FALSE;
  p_IsSummary_ea90ef04c9a9 := FALSE;
  p_DetectionMethod_ea90ef04c9a9 := 'Manual';
  p_QueryID_ea90ef04c9a9 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_ea90ef04c9a9 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_ea90ef04c9a9);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_ea90ef04c9a9
                  OR ("QueryID" = p_QueryID_ea90ef04c9a9 AND "Name" = p_Name_ea90ef04c9a9)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_ea90ef04c9a9,
      'QueryID', p_QueryID_ea90ef04c9a9,
      'Name', p_Name_ea90ef04c9a9,
      'Description', p_Description_ea90ef04c9a9,
      'Sequence', p_Sequence_ea90ef04c9a9,
      'SQLBaseType', p_SQLBaseType_ea90ef04c9a9,
      'SQLFullType', p_SQLFullType_ea90ef04c9a9,
      'SourceEntityID', p_SourceEntityID_ea90ef04c9a9,
      'SourceFieldName', p_SourceFieldName_ea90ef04c9a9,
      'IsComputed', p_IsComputed_ea90ef04c9a9,
      'ComputationDescription', p_ComputationDescription_ea90ef04c9a9,
      'IsSummary', p_IsSummary_ea90ef04c9a9,
      'SummaryDescription', p_SummaryDescription_ea90ef04c9a9,
      'DetectionMethod', p_DetectionMethod_ea90ef04c9a9,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_ea90ef04c9a9
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_ea90ef04c9a9, p_QueryID := p_QueryID_ea90ef04c9a9, p_Name := p_Name_ea90ef04c9a9, p_Description := p_Description_ea90ef04c9a9, p_Sequence := p_Sequence_ea90ef04c9a9, p_SQLBaseType := p_SQLBaseType_ea90ef04c9a9, p_SQLFullType := p_SQLFullType_ea90ef04c9a9, p_SourceEntityID := p_SourceEntityID_ea90ef04c9a9, p_SourceFieldName := p_SourceFieldName_ea90ef04c9a9, p_IsComputed := p_IsComputed_ea90ef04c9a9, p_ComputationDescription := p_ComputationDescription_ea90ef04c9a9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_ea90ef04c9a9, p_SummaryDescription := p_SummaryDescription_ea90ef04c9a9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_ea90ef04c9a9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_ea90ef04c9a9, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_da8fbf350256 UUID;
  p_QueryID_da8fbf350256 UUID;
  p_Name_da8fbf350256 VARCHAR(255);
  p_Description_da8fbf350256 TEXT;
  p_Sequence_da8fbf350256 INTEGER;
  p_SQLBaseType_da8fbf350256 VARCHAR(50);
  p_SQLFullType_da8fbf350256 VARCHAR(100);
  p_SourceEntityID_da8fbf350256 UUID;
  p_SourceFieldName_da8fbf350256 VARCHAR(255);
  p_IsComputed_da8fbf350256 BOOLEAN;
  p_ComputationDescription_da8fbf350256 TEXT;
  p_IsSummary_da8fbf350256 BOOLEAN;
  p_SummaryDescription_da8fbf350256 TEXT;
  p_DetectionMethod_da8fbf350256 VARCHAR(50);
  p_AutoDetectConfidenceScore_da8fbf350256 NUMERIC(3,2);
BEGIN
  p_ID_da8fbf350256 := '441c9aff-5c0b-4759-80f4-1ca4e075eca7';
  p_QueryID_da8fbf350256 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_da8fbf350256 := 'CompanyName';
  p_Description_da8fbf350256 := 'Company (aliased as CompanyName)';
  p_Sequence_da8fbf350256 := 5;
  p_SQLBaseType_da8fbf350256 := 'nvarchar';
  p_SQLFullType_da8fbf350256 := 'nvarchar(50)';
  p_SourceEntityID_da8fbf350256 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_da8fbf350256 := 'Company';
  p_IsComputed_da8fbf350256 := FALSE;
  p_IsSummary_da8fbf350256 := FALSE;
  p_DetectionMethod_da8fbf350256 := 'Manual';
  p_QueryID_da8fbf350256 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_da8fbf350256 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_da8fbf350256);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_da8fbf350256
                  OR ("QueryID" = p_QueryID_da8fbf350256 AND "Name" = p_Name_da8fbf350256)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_da8fbf350256,
      'QueryID', p_QueryID_da8fbf350256,
      'Name', p_Name_da8fbf350256,
      'Description', p_Description_da8fbf350256,
      'Sequence', p_Sequence_da8fbf350256,
      'SQLBaseType', p_SQLBaseType_da8fbf350256,
      'SQLFullType', p_SQLFullType_da8fbf350256,
      'SourceEntityID', p_SourceEntityID_da8fbf350256,
      'SourceFieldName', p_SourceFieldName_da8fbf350256,
      'IsComputed', p_IsComputed_da8fbf350256,
      'ComputationDescription', p_ComputationDescription_da8fbf350256,
      'IsSummary', p_IsSummary_da8fbf350256,
      'SummaryDescription', p_SummaryDescription_da8fbf350256,
      'DetectionMethod', p_DetectionMethod_da8fbf350256,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_da8fbf350256
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_da8fbf350256, p_QueryID := p_QueryID_da8fbf350256, p_Name := p_Name_da8fbf350256, p_Description := p_Description_da8fbf350256, p_Sequence := p_Sequence_da8fbf350256, p_SQLBaseType := p_SQLBaseType_da8fbf350256, p_SQLFullType := p_SQLFullType_da8fbf350256, p_SourceEntityID := p_SourceEntityID_da8fbf350256, p_SourceFieldName := p_SourceFieldName_da8fbf350256, p_IsComputed := p_IsComputed_da8fbf350256, p_ComputationDescription := p_ComputationDescription_da8fbf350256, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_da8fbf350256, p_SummaryDescription := p_SummaryDescription_da8fbf350256, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_da8fbf350256, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_da8fbf350256, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_b8a8afaebe95 UUID;
  p_QueryID_b8a8afaebe95 UUID;
  p_Name_b8a8afaebe95 VARCHAR(255);
  p_Description_b8a8afaebe95 TEXT;
  p_Sequence_b8a8afaebe95 INTEGER;
  p_SQLBaseType_b8a8afaebe95 VARCHAR(50);
  p_SQLFullType_b8a8afaebe95 VARCHAR(100);
  p_SourceEntityID_b8a8afaebe95 UUID;
  p_SourceFieldName_b8a8afaebe95 VARCHAR(255);
  p_IsComputed_b8a8afaebe95 BOOLEAN;
  p_ComputationDescription_b8a8afaebe95 TEXT;
  p_IsSummary_b8a8afaebe95 BOOLEAN;
  p_SummaryDescription_b8a8afaebe95 TEXT;
  p_DetectionMethod_b8a8afaebe95 VARCHAR(50);
  p_AutoDetectConfidenceScore_b8a8afaebe95 NUMERIC(3,2);
BEGIN
  p_ID_b8a8afaebe95 := '1cef46f0-4490-4876-8bba-39148d7f33ff';
  p_QueryID_b8a8afaebe95 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_b8a8afaebe95 := 'AccountID';
  p_Description_b8a8afaebe95 := 'AccountID';
  p_Sequence_b8a8afaebe95 := 6;
  p_SQLBaseType_b8a8afaebe95 := 'uniqueidentifier';
  p_SQLFullType_b8a8afaebe95 := 'uniqueidentifier';
  p_SourceEntityID_b8a8afaebe95 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_b8a8afaebe95 := 'AccountID';
  p_IsComputed_b8a8afaebe95 := FALSE;
  p_IsSummary_b8a8afaebe95 := FALSE;
  p_DetectionMethod_b8a8afaebe95 := 'Manual';
  p_QueryID_b8a8afaebe95 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_b8a8afaebe95 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_b8a8afaebe95);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_b8a8afaebe95
                  OR ("QueryID" = p_QueryID_b8a8afaebe95 AND "Name" = p_Name_b8a8afaebe95)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_b8a8afaebe95,
      'QueryID', p_QueryID_b8a8afaebe95,
      'Name', p_Name_b8a8afaebe95,
      'Description', p_Description_b8a8afaebe95,
      'Sequence', p_Sequence_b8a8afaebe95,
      'SQLBaseType', p_SQLBaseType_b8a8afaebe95,
      'SQLFullType', p_SQLFullType_b8a8afaebe95,
      'SourceEntityID', p_SourceEntityID_b8a8afaebe95,
      'SourceFieldName', p_SourceFieldName_b8a8afaebe95,
      'IsComputed', p_IsComputed_b8a8afaebe95,
      'ComputationDescription', p_ComputationDescription_b8a8afaebe95,
      'IsSummary', p_IsSummary_b8a8afaebe95,
      'SummaryDescription', p_SummaryDescription_b8a8afaebe95,
      'DetectionMethod', p_DetectionMethod_b8a8afaebe95,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b8a8afaebe95
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_b8a8afaebe95, p_QueryID := p_QueryID_b8a8afaebe95, p_Name := p_Name_b8a8afaebe95, p_Description := p_Description_b8a8afaebe95, p_Sequence := p_Sequence_b8a8afaebe95, p_SQLBaseType := p_SQLBaseType_b8a8afaebe95, p_SQLFullType := p_SQLFullType_b8a8afaebe95, p_SourceEntityID := p_SourceEntityID_b8a8afaebe95, p_SourceFieldName := p_SourceFieldName_b8a8afaebe95, p_IsComputed := p_IsComputed_b8a8afaebe95, p_ComputationDescription := p_ComputationDescription_b8a8afaebe95, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b8a8afaebe95, p_SummaryDescription := p_SummaryDescription_b8a8afaebe95, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b8a8afaebe95, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b8a8afaebe95, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_4834dcdcd0ba UUID;
  p_QueryID_4834dcdcd0ba UUID;
  p_Name_4834dcdcd0ba VARCHAR(255);
  p_Description_4834dcdcd0ba TEXT;
  p_Sequence_4834dcdcd0ba INTEGER;
  p_SQLBaseType_4834dcdcd0ba VARCHAR(50);
  p_SQLFullType_4834dcdcd0ba VARCHAR(100);
  p_SourceEntityID_4834dcdcd0ba UUID;
  p_SourceFieldName_4834dcdcd0ba VARCHAR(255);
  p_IsComputed_4834dcdcd0ba BOOLEAN;
  p_ComputationDescription_4834dcdcd0ba TEXT;
  p_IsSummary_4834dcdcd0ba BOOLEAN;
  p_SummaryDescription_4834dcdcd0ba TEXT;
  p_DetectionMethod_4834dcdcd0ba VARCHAR(50);
  p_AutoDetectConfidenceScore_4834dcdcd0ba NUMERIC(3,2);
BEGIN
  p_ID_4834dcdcd0ba := '2960cb45-f1fc-4163-96aa-aa453da64206';
  p_QueryID_4834dcdcd0ba := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_4834dcdcd0ba := 'AccountName';
  p_Description_4834dcdcd0ba := 'Account (aliased as AccountName)';
  p_Sequence_4834dcdcd0ba := 7;
  p_SQLBaseType_4834dcdcd0ba := 'nvarchar';
  p_SQLFullType_4834dcdcd0ba := 'nvarchar(255)';
  p_SourceEntityID_4834dcdcd0ba := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_4834dcdcd0ba := 'Account';
  p_IsComputed_4834dcdcd0ba := FALSE;
  p_IsSummary_4834dcdcd0ba := FALSE;
  p_DetectionMethod_4834dcdcd0ba := 'Manual';
  p_QueryID_4834dcdcd0ba := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_4834dcdcd0ba THEN 0 ELSE 1 END LIMIT 1), p_QueryID_4834dcdcd0ba);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_4834dcdcd0ba
                  OR ("QueryID" = p_QueryID_4834dcdcd0ba AND "Name" = p_Name_4834dcdcd0ba)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_4834dcdcd0ba,
      'QueryID', p_QueryID_4834dcdcd0ba,
      'Name', p_Name_4834dcdcd0ba,
      'Description', p_Description_4834dcdcd0ba,
      'Sequence', p_Sequence_4834dcdcd0ba,
      'SQLBaseType', p_SQLBaseType_4834dcdcd0ba,
      'SQLFullType', p_SQLFullType_4834dcdcd0ba,
      'SourceEntityID', p_SourceEntityID_4834dcdcd0ba,
      'SourceFieldName', p_SourceFieldName_4834dcdcd0ba,
      'IsComputed', p_IsComputed_4834dcdcd0ba,
      'ComputationDescription', p_ComputationDescription_4834dcdcd0ba,
      'IsSummary', p_IsSummary_4834dcdcd0ba,
      'SummaryDescription', p_SummaryDescription_4834dcdcd0ba,
      'DetectionMethod', p_DetectionMethod_4834dcdcd0ba,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4834dcdcd0ba
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_4834dcdcd0ba, p_QueryID := p_QueryID_4834dcdcd0ba, p_Name := p_Name_4834dcdcd0ba, p_Description := p_Description_4834dcdcd0ba, p_Sequence := p_Sequence_4834dcdcd0ba, p_SQLBaseType := p_SQLBaseType_4834dcdcd0ba, p_SQLFullType := p_SQLFullType_4834dcdcd0ba, p_SourceEntityID := p_SourceEntityID_4834dcdcd0ba, p_SourceFieldName := p_SourceFieldName_4834dcdcd0ba, p_IsComputed := p_IsComputed_4834dcdcd0ba, p_ComputationDescription := p_ComputationDescription_4834dcdcd0ba, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_4834dcdcd0ba, p_SummaryDescription := p_SummaryDescription_4834dcdcd0ba, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_4834dcdcd0ba, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4834dcdcd0ba, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_d47541da0071 UUID;
  p_QueryID_d47541da0071 UUID;
  p_Name_d47541da0071 VARCHAR(255);
  p_Description_d47541da0071 TEXT;
  p_Sequence_d47541da0071 INTEGER;
  p_SQLBaseType_d47541da0071 VARCHAR(50);
  p_SQLFullType_d47541da0071 VARCHAR(100);
  p_SourceEntityID_d47541da0071 UUID;
  p_SourceFieldName_d47541da0071 VARCHAR(255);
  p_IsComputed_d47541da0071 BOOLEAN;
  p_ComputationDescription_d47541da0071 TEXT;
  p_IsSummary_d47541da0071 BOOLEAN;
  p_SummaryDescription_d47541da0071 TEXT;
  p_DetectionMethod_d47541da0071 VARCHAR(50);
  p_AutoDetectConfidenceScore_d47541da0071 NUMERIC(3,2);
BEGIN
  p_ID_d47541da0071 := 'a60c15de-c414-41a9-aded-4780b0bfbaab';
  p_QueryID_d47541da0071 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_d47541da0071 := 'OwnerEmployeeID';
  p_Description_d47541da0071 := 'OwnerEmployeeID';
  p_Sequence_d47541da0071 := 8;
  p_SQLBaseType_d47541da0071 := 'uniqueidentifier';
  p_SQLFullType_d47541da0071 := 'uniqueidentifier';
  p_SourceEntityID_d47541da0071 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_d47541da0071 := 'OwnerEmployeeID';
  p_IsComputed_d47541da0071 := FALSE;
  p_IsSummary_d47541da0071 := FALSE;
  p_DetectionMethod_d47541da0071 := 'Manual';
  p_QueryID_d47541da0071 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_d47541da0071 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_d47541da0071);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_d47541da0071
                  OR ("QueryID" = p_QueryID_d47541da0071 AND "Name" = p_Name_d47541da0071)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_d47541da0071,
      'QueryID', p_QueryID_d47541da0071,
      'Name', p_Name_d47541da0071,
      'Description', p_Description_d47541da0071,
      'Sequence', p_Sequence_d47541da0071,
      'SQLBaseType', p_SQLBaseType_d47541da0071,
      'SQLFullType', p_SQLFullType_d47541da0071,
      'SourceEntityID', p_SourceEntityID_d47541da0071,
      'SourceFieldName', p_SourceFieldName_d47541da0071,
      'IsComputed', p_IsComputed_d47541da0071,
      'ComputationDescription', p_ComputationDescription_d47541da0071,
      'IsSummary', p_IsSummary_d47541da0071,
      'SummaryDescription', p_SummaryDescription_d47541da0071,
      'DetectionMethod', p_DetectionMethod_d47541da0071,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_d47541da0071
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_d47541da0071, p_QueryID := p_QueryID_d47541da0071, p_Name := p_Name_d47541da0071, p_Description := p_Description_d47541da0071, p_Sequence := p_Sequence_d47541da0071, p_SQLBaseType := p_SQLBaseType_d47541da0071, p_SQLFullType := p_SQLFullType_d47541da0071, p_SourceEntityID := p_SourceEntityID_d47541da0071, p_SourceFieldName := p_SourceFieldName_d47541da0071, p_IsComputed := p_IsComputed_d47541da0071, p_ComputationDescription := p_ComputationDescription_d47541da0071, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_d47541da0071, p_SummaryDescription := p_SummaryDescription_d47541da0071, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_d47541da0071, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_d47541da0071, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_031f756c6c0c UUID;
  p_QueryID_031f756c6c0c UUID;
  p_Name_031f756c6c0c VARCHAR(255);
  p_Description_031f756c6c0c TEXT;
  p_Sequence_031f756c6c0c INTEGER;
  p_SQLBaseType_031f756c6c0c VARCHAR(50);
  p_SQLFullType_031f756c6c0c VARCHAR(100);
  p_SourceEntityID_031f756c6c0c UUID;
  p_SourceFieldName_031f756c6c0c VARCHAR(255);
  p_IsComputed_031f756c6c0c BOOLEAN;
  p_ComputationDescription_031f756c6c0c TEXT;
  p_IsSummary_031f756c6c0c BOOLEAN;
  p_SummaryDescription_031f756c6c0c TEXT;
  p_DetectionMethod_031f756c6c0c VARCHAR(50);
  p_AutoDetectConfidenceScore_031f756c6c0c NUMERIC(3,2);
BEGIN
  p_ID_031f756c6c0c := '9783bb41-c0eb-4ad1-a482-360eedd1b01d';
  p_QueryID_031f756c6c0c := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_031f756c6c0c := 'OwnerName';
  p_Description_031f756c6c0c := 'OwnerEmployee (aliased as OwnerName)';
  p_Sequence_031f756c6c0c := 9;
  p_SQLBaseType_031f756c6c0c := 'nvarchar';
  p_SQLFullType_031f756c6c0c := 'nvarchar(81)';
  p_SourceEntityID_031f756c6c0c := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_031f756c6c0c := 'OwnerEmployee';
  p_IsComputed_031f756c6c0c := FALSE;
  p_IsSummary_031f756c6c0c := FALSE;
  p_DetectionMethod_031f756c6c0c := 'Manual';
  p_QueryID_031f756c6c0c := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_031f756c6c0c THEN 0 ELSE 1 END LIMIT 1), p_QueryID_031f756c6c0c);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_031f756c6c0c
                  OR ("QueryID" = p_QueryID_031f756c6c0c AND "Name" = p_Name_031f756c6c0c)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_031f756c6c0c,
      'QueryID', p_QueryID_031f756c6c0c,
      'Name', p_Name_031f756c6c0c,
      'Description', p_Description_031f756c6c0c,
      'Sequence', p_Sequence_031f756c6c0c,
      'SQLBaseType', p_SQLBaseType_031f756c6c0c,
      'SQLFullType', p_SQLFullType_031f756c6c0c,
      'SourceEntityID', p_SourceEntityID_031f756c6c0c,
      'SourceFieldName', p_SourceFieldName_031f756c6c0c,
      'IsComputed', p_IsComputed_031f756c6c0c,
      'ComputationDescription', p_ComputationDescription_031f756c6c0c,
      'IsSummary', p_IsSummary_031f756c6c0c,
      'SummaryDescription', p_SummaryDescription_031f756c6c0c,
      'DetectionMethod', p_DetectionMethod_031f756c6c0c,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_031f756c6c0c
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_031f756c6c0c, p_QueryID := p_QueryID_031f756c6c0c, p_Name := p_Name_031f756c6c0c, p_Description := p_Description_031f756c6c0c, p_Sequence := p_Sequence_031f756c6c0c, p_SQLBaseType := p_SQLBaseType_031f756c6c0c, p_SQLFullType := p_SQLFullType_031f756c6c0c, p_SourceEntityID := p_SourceEntityID_031f756c6c0c, p_SourceFieldName := p_SourceFieldName_031f756c6c0c, p_IsComputed := p_IsComputed_031f756c6c0c, p_ComputationDescription := p_ComputationDescription_031f756c6c0c, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_031f756c6c0c, p_SummaryDescription := p_SummaryDescription_031f756c6c0c, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_031f756c6c0c, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_031f756c6c0c, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_246245a99685 UUID;
  p_QueryID_246245a99685 UUID;
  p_Name_246245a99685 VARCHAR(255);
  p_Description_246245a99685 TEXT;
  p_Sequence_246245a99685 INTEGER;
  p_SQLBaseType_246245a99685 VARCHAR(50);
  p_SQLFullType_246245a99685 VARCHAR(100);
  p_SourceEntityID_246245a99685 UUID;
  p_SourceFieldName_246245a99685 VARCHAR(255);
  p_IsComputed_246245a99685 BOOLEAN;
  p_ComputationDescription_246245a99685 TEXT;
  p_IsSummary_246245a99685 BOOLEAN;
  p_SummaryDescription_246245a99685 TEXT;
  p_DetectionMethod_246245a99685 VARCHAR(50);
  p_AutoDetectConfidenceScore_246245a99685 NUMERIC(3,2);
BEGIN
  p_ID_246245a99685 := 'a54dc8b3-d710-4387-83b1-6697154e994a';
  p_QueryID_246245a99685 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_246245a99685 := 'ClosedByUserID';
  p_Description_246245a99685 := 'ClosedByUserID';
  p_Sequence_246245a99685 := 10;
  p_SQLBaseType_246245a99685 := 'uniqueidentifier';
  p_SQLFullType_246245a99685 := 'uniqueidentifier';
  p_SourceEntityID_246245a99685 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_246245a99685 := 'ClosedByUserID';
  p_IsComputed_246245a99685 := FALSE;
  p_IsSummary_246245a99685 := FALSE;
  p_DetectionMethod_246245a99685 := 'Manual';
  p_QueryID_246245a99685 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_246245a99685 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_246245a99685);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_246245a99685
                  OR ("QueryID" = p_QueryID_246245a99685 AND "Name" = p_Name_246245a99685)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_246245a99685,
      'QueryID', p_QueryID_246245a99685,
      'Name', p_Name_246245a99685,
      'Description', p_Description_246245a99685,
      'Sequence', p_Sequence_246245a99685,
      'SQLBaseType', p_SQLBaseType_246245a99685,
      'SQLFullType', p_SQLFullType_246245a99685,
      'SourceEntityID', p_SourceEntityID_246245a99685,
      'SourceFieldName', p_SourceFieldName_246245a99685,
      'IsComputed', p_IsComputed_246245a99685,
      'ComputationDescription', p_ComputationDescription_246245a99685,
      'IsSummary', p_IsSummary_246245a99685,
      'SummaryDescription', p_SummaryDescription_246245a99685,
      'DetectionMethod', p_DetectionMethod_246245a99685,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_246245a99685
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_246245a99685, p_QueryID := p_QueryID_246245a99685, p_Name := p_Name_246245a99685, p_Description := p_Description_246245a99685, p_Sequence := p_Sequence_246245a99685, p_SQLBaseType := p_SQLBaseType_246245a99685, p_SQLFullType := p_SQLFullType_246245a99685, p_SourceEntityID := p_SourceEntityID_246245a99685, p_SourceFieldName := p_SourceFieldName_246245a99685, p_IsComputed := p_IsComputed_246245a99685, p_ComputationDescription := p_ComputationDescription_246245a99685, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_246245a99685, p_SummaryDescription := p_SummaryDescription_246245a99685, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_246245a99685, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_246245a99685, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_24f876cd6b72 UUID;
  p_QueryID_24f876cd6b72 UUID;
  p_Name_24f876cd6b72 VARCHAR(255);
  p_Description_24f876cd6b72 TEXT;
  p_Sequence_24f876cd6b72 INTEGER;
  p_SQLBaseType_24f876cd6b72 VARCHAR(50);
  p_SQLFullType_24f876cd6b72 VARCHAR(100);
  p_SourceEntityID_24f876cd6b72 UUID;
  p_SourceFieldName_24f876cd6b72 VARCHAR(255);
  p_IsComputed_24f876cd6b72 BOOLEAN;
  p_ComputationDescription_24f876cd6b72 TEXT;
  p_IsSummary_24f876cd6b72 BOOLEAN;
  p_SummaryDescription_24f876cd6b72 TEXT;
  p_DetectionMethod_24f876cd6b72 VARCHAR(50);
  p_AutoDetectConfidenceScore_24f876cd6b72 NUMERIC(3,2);
BEGIN
  p_ID_24f876cd6b72 := '866ce81e-1a12-4f80-9cb6-5bd7f6a0463b';
  p_QueryID_24f876cd6b72 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_24f876cd6b72 := 'ClosedByUserName';
  p_Description_24f876cd6b72 := 'ClosedByUser (aliased as ClosedByUserName)';
  p_Sequence_24f876cd6b72 := 11;
  p_SQLBaseType_24f876cd6b72 := 'nvarchar';
  p_SQLFullType_24f876cd6b72 := 'nvarchar(100)';
  p_SourceEntityID_24f876cd6b72 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_24f876cd6b72 := 'ClosedByUser';
  p_IsComputed_24f876cd6b72 := FALSE;
  p_IsSummary_24f876cd6b72 := FALSE;
  p_DetectionMethod_24f876cd6b72 := 'Manual';
  p_QueryID_24f876cd6b72 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_24f876cd6b72 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_24f876cd6b72);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_24f876cd6b72
                  OR ("QueryID" = p_QueryID_24f876cd6b72 AND "Name" = p_Name_24f876cd6b72)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_24f876cd6b72,
      'QueryID', p_QueryID_24f876cd6b72,
      'Name', p_Name_24f876cd6b72,
      'Description', p_Description_24f876cd6b72,
      'Sequence', p_Sequence_24f876cd6b72,
      'SQLBaseType', p_SQLBaseType_24f876cd6b72,
      'SQLFullType', p_SQLFullType_24f876cd6b72,
      'SourceEntityID', p_SourceEntityID_24f876cd6b72,
      'SourceFieldName', p_SourceFieldName_24f876cd6b72,
      'IsComputed', p_IsComputed_24f876cd6b72,
      'ComputationDescription', p_ComputationDescription_24f876cd6b72,
      'IsSummary', p_IsSummary_24f876cd6b72,
      'SummaryDescription', p_SummaryDescription_24f876cd6b72,
      'DetectionMethod', p_DetectionMethod_24f876cd6b72,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_24f876cd6b72
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_24f876cd6b72, p_QueryID := p_QueryID_24f876cd6b72, p_Name := p_Name_24f876cd6b72, p_Description := p_Description_24f876cd6b72, p_Sequence := p_Sequence_24f876cd6b72, p_SQLBaseType := p_SQLBaseType_24f876cd6b72, p_SQLFullType := p_SQLFullType_24f876cd6b72, p_SourceEntityID := p_SourceEntityID_24f876cd6b72, p_SourceFieldName := p_SourceFieldName_24f876cd6b72, p_IsComputed := p_IsComputed_24f876cd6b72, p_ComputationDescription := p_ComputationDescription_24f876cd6b72, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_24f876cd6b72, p_SummaryDescription := p_SummaryDescription_24f876cd6b72, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_24f876cd6b72, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_24f876cd6b72, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_fdcab433cf58 UUID;
  p_QueryID_fdcab433cf58 UUID;
  p_Name_fdcab433cf58 VARCHAR(255);
  p_Description_fdcab433cf58 TEXT;
  p_Sequence_fdcab433cf58 INTEGER;
  p_SQLBaseType_fdcab433cf58 VARCHAR(50);
  p_SQLFullType_fdcab433cf58 VARCHAR(100);
  p_SourceEntityID_fdcab433cf58 UUID;
  p_SourceFieldName_fdcab433cf58 VARCHAR(255);
  p_IsComputed_fdcab433cf58 BOOLEAN;
  p_ComputationDescription_fdcab433cf58 TEXT;
  p_IsSummary_fdcab433cf58 BOOLEAN;
  p_SummaryDescription_fdcab433cf58 TEXT;
  p_DetectionMethod_fdcab433cf58 VARCHAR(50);
  p_AutoDetectConfidenceScore_fdcab433cf58 NUMERIC(3,2);
BEGIN
  p_ID_fdcab433cf58 := 'f6b93a11-a656-457c-99ac-f02142b54d9c';
  p_QueryID_fdcab433cf58 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_fdcab433cf58 := 'CloseDate';
  p_Description_fdcab433cf58 := 'CloseDate';
  p_Sequence_fdcab433cf58 := 12;
  p_SQLBaseType_fdcab433cf58 := 'nvarchar';
  p_SQLFullType_fdcab433cf58 := 'nvarchar(MAX)';
  p_SourceFieldName_fdcab433cf58 := 'CloseDate';
  p_IsComputed_fdcab433cf58 := FALSE;
  p_IsSummary_fdcab433cf58 := FALSE;
  p_DetectionMethod_fdcab433cf58 := 'Manual';
  p_QueryID_fdcab433cf58 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_fdcab433cf58 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_fdcab433cf58);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_fdcab433cf58
                  OR ("QueryID" = p_QueryID_fdcab433cf58 AND "Name" = p_Name_fdcab433cf58)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_fdcab433cf58,
      'QueryID', p_QueryID_fdcab433cf58,
      'Name', p_Name_fdcab433cf58,
      'Description', p_Description_fdcab433cf58,
      'Sequence', p_Sequence_fdcab433cf58,
      'SQLBaseType', p_SQLBaseType_fdcab433cf58,
      'SQLFullType', p_SQLFullType_fdcab433cf58,
      'SourceEntityID', p_SourceEntityID_fdcab433cf58,
      'SourceFieldName', p_SourceFieldName_fdcab433cf58,
      'IsComputed', p_IsComputed_fdcab433cf58,
      'ComputationDescription', p_ComputationDescription_fdcab433cf58,
      'IsSummary', p_IsSummary_fdcab433cf58,
      'SummaryDescription', p_SummaryDescription_fdcab433cf58,
      'DetectionMethod', p_DetectionMethod_fdcab433cf58,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_fdcab433cf58
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_fdcab433cf58, p_QueryID := p_QueryID_fdcab433cf58, p_Name := p_Name_fdcab433cf58, p_Description := p_Description_fdcab433cf58, p_Sequence := p_Sequence_fdcab433cf58, p_SQLBaseType := p_SQLBaseType_fdcab433cf58, p_SQLFullType := p_SQLFullType_fdcab433cf58, p_SourceEntityID := p_SourceEntityID_fdcab433cf58, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_fdcab433cf58, p_IsComputed := p_IsComputed_fdcab433cf58, p_ComputationDescription := p_ComputationDescription_fdcab433cf58, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_fdcab433cf58, p_SummaryDescription := p_SummaryDescription_fdcab433cf58, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_fdcab433cf58, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_fdcab433cf58, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_0c3547cbb7d2 UUID;
  p_QueryID_0c3547cbb7d2 UUID;
  p_Name_0c3547cbb7d2 VARCHAR(255);
  p_Description_0c3547cbb7d2 TEXT;
  p_Sequence_0c3547cbb7d2 INTEGER;
  p_SQLBaseType_0c3547cbb7d2 VARCHAR(50);
  p_SQLFullType_0c3547cbb7d2 VARCHAR(100);
  p_SourceEntityID_0c3547cbb7d2 UUID;
  p_SourceFieldName_0c3547cbb7d2 VARCHAR(255);
  p_IsComputed_0c3547cbb7d2 BOOLEAN;
  p_ComputationDescription_0c3547cbb7d2 TEXT;
  p_IsSummary_0c3547cbb7d2 BOOLEAN;
  p_SummaryDescription_0c3547cbb7d2 TEXT;
  p_DetectionMethod_0c3547cbb7d2 VARCHAR(50);
  p_AutoDetectConfidenceScore_0c3547cbb7d2 NUMERIC(3,2);
BEGIN
  p_ID_0c3547cbb7d2 := 'b4c6c150-e95a-4586-a9c5-f50321ecc5e0';
  p_QueryID_0c3547cbb7d2 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_0c3547cbb7d2 := 'DaysSinceClose';
  p_Description_0c3547cbb7d2 := 'Computed column: DaysSinceClose';
  p_Sequence_0c3547cbb7d2 := 13;
  p_SQLBaseType_0c3547cbb7d2 := 'nvarchar';
  p_SQLFullType_0c3547cbb7d2 := 'nvarchar(MAX)';
  p_IsComputed_0c3547cbb7d2 := TRUE;
  p_IsSummary_0c3547cbb7d2 := FALSE;
  p_DetectionMethod_0c3547cbb7d2 := 'Manual';
  p_QueryID_0c3547cbb7d2 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_0c3547cbb7d2 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_0c3547cbb7d2);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_0c3547cbb7d2
                  OR ("QueryID" = p_QueryID_0c3547cbb7d2 AND "Name" = p_Name_0c3547cbb7d2)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_0c3547cbb7d2,
      'QueryID', p_QueryID_0c3547cbb7d2,
      'Name', p_Name_0c3547cbb7d2,
      'Description', p_Description_0c3547cbb7d2,
      'Sequence', p_Sequence_0c3547cbb7d2,
      'SQLBaseType', p_SQLBaseType_0c3547cbb7d2,
      'SQLFullType', p_SQLFullType_0c3547cbb7d2,
      'SourceEntityID', p_SourceEntityID_0c3547cbb7d2,
      'SourceFieldName', p_SourceFieldName_0c3547cbb7d2,
      'IsComputed', p_IsComputed_0c3547cbb7d2,
      'ComputationDescription', p_ComputationDescription_0c3547cbb7d2,
      'IsSummary', p_IsSummary_0c3547cbb7d2,
      'SummaryDescription', p_SummaryDescription_0c3547cbb7d2,
      'DetectionMethod', p_DetectionMethod_0c3547cbb7d2,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_0c3547cbb7d2
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_0c3547cbb7d2, p_QueryID := p_QueryID_0c3547cbb7d2, p_Name := p_Name_0c3547cbb7d2, p_Description := p_Description_0c3547cbb7d2, p_Sequence := p_Sequence_0c3547cbb7d2, p_SQLBaseType := p_SQLBaseType_0c3547cbb7d2, p_SQLFullType := p_SQLFullType_0c3547cbb7d2, p_SourceEntityID := p_SourceEntityID_0c3547cbb7d2, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_0c3547cbb7d2, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_0c3547cbb7d2, p_ComputationDescription := p_ComputationDescription_0c3547cbb7d2, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_0c3547cbb7d2, p_SummaryDescription := p_SummaryDescription_0c3547cbb7d2, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_0c3547cbb7d2, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_0c3547cbb7d2, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_9cd52c5fe366 UUID;
  p_QueryID_9cd52c5fe366 UUID;
  p_Name_9cd52c5fe366 VARCHAR(255);
  p_Description_9cd52c5fe366 TEXT;
  p_Sequence_9cd52c5fe366 INTEGER;
  p_SQLBaseType_9cd52c5fe366 VARCHAR(50);
  p_SQLFullType_9cd52c5fe366 VARCHAR(100);
  p_SourceEntityID_9cd52c5fe366 UUID;
  p_SourceFieldName_9cd52c5fe366 VARCHAR(255);
  p_IsComputed_9cd52c5fe366 BOOLEAN;
  p_ComputationDescription_9cd52c5fe366 TEXT;
  p_IsSummary_9cd52c5fe366 BOOLEAN;
  p_SummaryDescription_9cd52c5fe366 TEXT;
  p_DetectionMethod_9cd52c5fe366 VARCHAR(50);
  p_AutoDetectConfidenceScore_9cd52c5fe366 NUMERIC(3,2);
BEGIN
  p_ID_9cd52c5fe366 := '42ae0785-66d4-4a9e-a9d1-0e47512312ad';
  p_QueryID_9cd52c5fe366 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_9cd52c5fe366 := 'DealAmount';
  p_Description_9cd52c5fe366 := 'Amount (aliased as DealAmount)';
  p_Sequence_9cd52c5fe366 := 14;
  p_SQLBaseType_9cd52c5fe366 := 'decimal';
  p_SQLFullType_9cd52c5fe366 := 'decimal(19, 4)';
  p_SourceEntityID_9cd52c5fe366 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_9cd52c5fe366 := 'Amount';
  p_IsComputed_9cd52c5fe366 := FALSE;
  p_IsSummary_9cd52c5fe366 := FALSE;
  p_DetectionMethod_9cd52c5fe366 := 'Manual';
  p_QueryID_9cd52c5fe366 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_9cd52c5fe366 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_9cd52c5fe366);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_9cd52c5fe366
                  OR ("QueryID" = p_QueryID_9cd52c5fe366 AND "Name" = p_Name_9cd52c5fe366)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_9cd52c5fe366,
      'QueryID', p_QueryID_9cd52c5fe366,
      'Name', p_Name_9cd52c5fe366,
      'Description', p_Description_9cd52c5fe366,
      'Sequence', p_Sequence_9cd52c5fe366,
      'SQLBaseType', p_SQLBaseType_9cd52c5fe366,
      'SQLFullType', p_SQLFullType_9cd52c5fe366,
      'SourceEntityID', p_SourceEntityID_9cd52c5fe366,
      'SourceFieldName', p_SourceFieldName_9cd52c5fe366,
      'IsComputed', p_IsComputed_9cd52c5fe366,
      'ComputationDescription', p_ComputationDescription_9cd52c5fe366,
      'IsSummary', p_IsSummary_9cd52c5fe366,
      'SummaryDescription', p_SummaryDescription_9cd52c5fe366,
      'DetectionMethod', p_DetectionMethod_9cd52c5fe366,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_9cd52c5fe366
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_9cd52c5fe366, p_QueryID := p_QueryID_9cd52c5fe366, p_Name := p_Name_9cd52c5fe366, p_Description := p_Description_9cd52c5fe366, p_Sequence := p_Sequence_9cd52c5fe366, p_SQLBaseType := p_SQLBaseType_9cd52c5fe366, p_SQLFullType := p_SQLFullType_9cd52c5fe366, p_SourceEntityID := p_SourceEntityID_9cd52c5fe366, p_SourceFieldName := p_SourceFieldName_9cd52c5fe366, p_IsComputed := p_IsComputed_9cd52c5fe366, p_ComputationDescription := p_ComputationDescription_9cd52c5fe366, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_9cd52c5fe366, p_SummaryDescription := p_SummaryDescription_9cd52c5fe366, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_9cd52c5fe366, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_9cd52c5fe366, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_7d20d20505ab UUID;
  p_QueryID_7d20d20505ab UUID;
  p_Name_7d20d20505ab VARCHAR(255);
  p_Description_7d20d20505ab TEXT;
  p_Sequence_7d20d20505ab INTEGER;
  p_SQLBaseType_7d20d20505ab VARCHAR(50);
  p_SQLFullType_7d20d20505ab VARCHAR(100);
  p_SourceEntityID_7d20d20505ab UUID;
  p_SourceFieldName_7d20d20505ab VARCHAR(255);
  p_IsComputed_7d20d20505ab BOOLEAN;
  p_ComputationDescription_7d20d20505ab TEXT;
  p_IsSummary_7d20d20505ab BOOLEAN;
  p_SummaryDescription_7d20d20505ab TEXT;
  p_DetectionMethod_7d20d20505ab VARCHAR(50);
  p_AutoDetectConfidenceScore_7d20d20505ab NUMERIC(3,2);
BEGIN
  p_ID_7d20d20505ab := '3120c0ed-847a-480a-8e20-9b7a05b14b19';
  p_QueryID_7d20d20505ab := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_7d20d20505ab := 'OrderID';
  p_Description_7d20d20505ab := 'OrderID';
  p_Sequence_7d20d20505ab := 15;
  p_SQLBaseType_7d20d20505ab := 'uniqueidentifier';
  p_SQLFullType_7d20d20505ab := 'uniqueidentifier';
  p_SourceEntityID_7d20d20505ab := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_7d20d20505ab := 'OrderID';
  p_IsComputed_7d20d20505ab := FALSE;
  p_IsSummary_7d20d20505ab := FALSE;
  p_DetectionMethod_7d20d20505ab := 'Manual';
  p_QueryID_7d20d20505ab := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_7d20d20505ab THEN 0 ELSE 1 END LIMIT 1), p_QueryID_7d20d20505ab);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_7d20d20505ab
                  OR ("QueryID" = p_QueryID_7d20d20505ab AND "Name" = p_Name_7d20d20505ab)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_7d20d20505ab,
      'QueryID', p_QueryID_7d20d20505ab,
      'Name', p_Name_7d20d20505ab,
      'Description', p_Description_7d20d20505ab,
      'Sequence', p_Sequence_7d20d20505ab,
      'SQLBaseType', p_SQLBaseType_7d20d20505ab,
      'SQLFullType', p_SQLFullType_7d20d20505ab,
      'SourceEntityID', p_SourceEntityID_7d20d20505ab,
      'SourceFieldName', p_SourceFieldName_7d20d20505ab,
      'IsComputed', p_IsComputed_7d20d20505ab,
      'ComputationDescription', p_ComputationDescription_7d20d20505ab,
      'IsSummary', p_IsSummary_7d20d20505ab,
      'SummaryDescription', p_SummaryDescription_7d20d20505ab,
      'DetectionMethod', p_DetectionMethod_7d20d20505ab,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_7d20d20505ab
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_7d20d20505ab, p_QueryID := p_QueryID_7d20d20505ab, p_Name := p_Name_7d20d20505ab, p_Description := p_Description_7d20d20505ab, p_Sequence := p_Sequence_7d20d20505ab, p_SQLBaseType := p_SQLBaseType_7d20d20505ab, p_SQLFullType := p_SQLFullType_7d20d20505ab, p_SourceEntityID := p_SourceEntityID_7d20d20505ab, p_SourceFieldName := p_SourceFieldName_7d20d20505ab, p_IsComputed := p_IsComputed_7d20d20505ab, p_ComputationDescription := p_ComputationDescription_7d20d20505ab, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_7d20d20505ab, p_SummaryDescription := p_SummaryDescription_7d20d20505ab, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_7d20d20505ab, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_7d20d20505ab, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_93334c5a58e0 UUID;
  p_QueryID_93334c5a58e0 UUID;
  p_Name_93334c5a58e0 VARCHAR(255);
  p_Description_93334c5a58e0 TEXT;
  p_Sequence_93334c5a58e0 INTEGER;
  p_SQLBaseType_93334c5a58e0 VARCHAR(50);
  p_SQLFullType_93334c5a58e0 VARCHAR(100);
  p_SourceEntityID_93334c5a58e0 UUID;
  p_SourceFieldName_93334c5a58e0 VARCHAR(255);
  p_IsComputed_93334c5a58e0 BOOLEAN;
  p_ComputationDescription_93334c5a58e0 TEXT;
  p_IsSummary_93334c5a58e0 BOOLEAN;
  p_SummaryDescription_93334c5a58e0 TEXT;
  p_DetectionMethod_93334c5a58e0 VARCHAR(50);
  p_AutoDetectConfidenceScore_93334c5a58e0 NUMERIC(3,2);
BEGIN
  p_ID_93334c5a58e0 := '28ceeb85-1ee3-46cf-aed0-c62b972f5a5b';
  p_QueryID_93334c5a58e0 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_93334c5a58e0 := 'OrderNumber';
  p_Description_93334c5a58e0 := 'OrderNumber';
  p_Sequence_93334c5a58e0 := 16;
  p_SQLBaseType_93334c5a58e0 := 'nvarchar';
  p_SQLFullType_93334c5a58e0 := 'nvarchar(40)';
  p_SourceEntityID_93334c5a58e0 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_93334c5a58e0 := 'OrderNumber';
  p_IsComputed_93334c5a58e0 := FALSE;
  p_IsSummary_93334c5a58e0 := FALSE;
  p_DetectionMethod_93334c5a58e0 := 'Manual';
  p_QueryID_93334c5a58e0 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_93334c5a58e0 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_93334c5a58e0);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_93334c5a58e0
                  OR ("QueryID" = p_QueryID_93334c5a58e0 AND "Name" = p_Name_93334c5a58e0)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_93334c5a58e0,
      'QueryID', p_QueryID_93334c5a58e0,
      'Name', p_Name_93334c5a58e0,
      'Description', p_Description_93334c5a58e0,
      'Sequence', p_Sequence_93334c5a58e0,
      'SQLBaseType', p_SQLBaseType_93334c5a58e0,
      'SQLFullType', p_SQLFullType_93334c5a58e0,
      'SourceEntityID', p_SourceEntityID_93334c5a58e0,
      'SourceFieldName', p_SourceFieldName_93334c5a58e0,
      'IsComputed', p_IsComputed_93334c5a58e0,
      'ComputationDescription', p_ComputationDescription_93334c5a58e0,
      'IsSummary', p_IsSummary_93334c5a58e0,
      'SummaryDescription', p_SummaryDescription_93334c5a58e0,
      'DetectionMethod', p_DetectionMethod_93334c5a58e0,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_93334c5a58e0
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_93334c5a58e0, p_QueryID := p_QueryID_93334c5a58e0, p_Name := p_Name_93334c5a58e0, p_Description := p_Description_93334c5a58e0, p_Sequence := p_Sequence_93334c5a58e0, p_SQLBaseType := p_SQLBaseType_93334c5a58e0, p_SQLFullType := p_SQLFullType_93334c5a58e0, p_SourceEntityID := p_SourceEntityID_93334c5a58e0, p_SourceFieldName := p_SourceFieldName_93334c5a58e0, p_IsComputed := p_IsComputed_93334c5a58e0, p_ComputationDescription := p_ComputationDescription_93334c5a58e0, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_93334c5a58e0, p_SummaryDescription := p_SummaryDescription_93334c5a58e0, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_93334c5a58e0, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_93334c5a58e0, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_9ba5d7ac7f70 UUID;
  p_QueryID_9ba5d7ac7f70 UUID;
  p_Name_9ba5d7ac7f70 VARCHAR(255);
  p_Description_9ba5d7ac7f70 TEXT;
  p_Sequence_9ba5d7ac7f70 INTEGER;
  p_SQLBaseType_9ba5d7ac7f70 VARCHAR(50);
  p_SQLFullType_9ba5d7ac7f70 VARCHAR(100);
  p_SourceEntityID_9ba5d7ac7f70 UUID;
  p_SourceFieldName_9ba5d7ac7f70 VARCHAR(255);
  p_IsComputed_9ba5d7ac7f70 BOOLEAN;
  p_ComputationDescription_9ba5d7ac7f70 TEXT;
  p_IsSummary_9ba5d7ac7f70 BOOLEAN;
  p_SummaryDescription_9ba5d7ac7f70 TEXT;
  p_DetectionMethod_9ba5d7ac7f70 VARCHAR(50);
  p_AutoDetectConfidenceScore_9ba5d7ac7f70 NUMERIC(3,2);
BEGIN
  p_ID_9ba5d7ac7f70 := '6d85eeec-916b-497c-bc53-4a1f0ed1e81a';
  p_QueryID_9ba5d7ac7f70 := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_9ba5d7ac7f70 := 'OrderStatus';
  p_Description_9ba5d7ac7f70 := 'Status (aliased as OrderStatus)';
  p_Sequence_9ba5d7ac7f70 := 17;
  p_SQLBaseType_9ba5d7ac7f70 := 'nvarchar';
  p_SQLFullType_9ba5d7ac7f70 := 'nvarchar(20)';
  p_SourceEntityID_9ba5d7ac7f70 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_9ba5d7ac7f70 := 'Status';
  p_IsComputed_9ba5d7ac7f70 := FALSE;
  p_IsSummary_9ba5d7ac7f70 := FALSE;
  p_DetectionMethod_9ba5d7ac7f70 := 'Manual';
  p_QueryID_9ba5d7ac7f70 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_9ba5d7ac7f70 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_9ba5d7ac7f70);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_9ba5d7ac7f70
                  OR ("QueryID" = p_QueryID_9ba5d7ac7f70 AND "Name" = p_Name_9ba5d7ac7f70)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_9ba5d7ac7f70,
      'QueryID', p_QueryID_9ba5d7ac7f70,
      'Name', p_Name_9ba5d7ac7f70,
      'Description', p_Description_9ba5d7ac7f70,
      'Sequence', p_Sequence_9ba5d7ac7f70,
      'SQLBaseType', p_SQLBaseType_9ba5d7ac7f70,
      'SQLFullType', p_SQLFullType_9ba5d7ac7f70,
      'SourceEntityID', p_SourceEntityID_9ba5d7ac7f70,
      'SourceFieldName', p_SourceFieldName_9ba5d7ac7f70,
      'IsComputed', p_IsComputed_9ba5d7ac7f70,
      'ComputationDescription', p_ComputationDescription_9ba5d7ac7f70,
      'IsSummary', p_IsSummary_9ba5d7ac7f70,
      'SummaryDescription', p_SummaryDescription_9ba5d7ac7f70,
      'DetectionMethod', p_DetectionMethod_9ba5d7ac7f70,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_9ba5d7ac7f70
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_9ba5d7ac7f70, p_QueryID := p_QueryID_9ba5d7ac7f70, p_Name := p_Name_9ba5d7ac7f70, p_Description := p_Description_9ba5d7ac7f70, p_Sequence := p_Sequence_9ba5d7ac7f70, p_SQLBaseType := p_SQLBaseType_9ba5d7ac7f70, p_SQLFullType := p_SQLFullType_9ba5d7ac7f70, p_SourceEntityID := p_SourceEntityID_9ba5d7ac7f70, p_SourceFieldName := p_SourceFieldName_9ba5d7ac7f70, p_IsComputed := p_IsComputed_9ba5d7ac7f70, p_ComputationDescription := p_ComputationDescription_9ba5d7ac7f70, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_9ba5d7ac7f70, p_SummaryDescription := p_SummaryDescription_9ba5d7ac7f70, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_9ba5d7ac7f70, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_9ba5d7ac7f70, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_48eb55412ceb UUID;
  p_QueryID_48eb55412ceb UUID;
  p_Name_48eb55412ceb VARCHAR(255);
  p_Description_48eb55412ceb TEXT;
  p_Sequence_48eb55412ceb INTEGER;
  p_SQLBaseType_48eb55412ceb VARCHAR(50);
  p_SQLFullType_48eb55412ceb VARCHAR(100);
  p_SourceEntityID_48eb55412ceb UUID;
  p_SourceFieldName_48eb55412ceb VARCHAR(255);
  p_IsComputed_48eb55412ceb BOOLEAN;
  p_ComputationDescription_48eb55412ceb TEXT;
  p_IsSummary_48eb55412ceb BOOLEAN;
  p_SummaryDescription_48eb55412ceb TEXT;
  p_DetectionMethod_48eb55412ceb VARCHAR(50);
  p_AutoDetectConfidenceScore_48eb55412ceb NUMERIC(3,2);
BEGIN
  p_ID_48eb55412ceb := '4192e271-fd0e-4c88-aa7f-0d09922d69a7';
  p_QueryID_48eb55412ceb := '5A1E5000-0001-4000-A000-000000000010';
  p_Name_48eb55412ceb := 'OrderTotalGross';
  p_Description_48eb55412ceb := 'TotalGross (aliased as OrderTotalGross)';
  p_Sequence_48eb55412ceb := 18;
  p_SQLBaseType_48eb55412ceb := 'decimal';
  p_SQLFullType_48eb55412ceb := 'decimal(18, 2)';
  p_SourceEntityID_48eb55412ceb := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_48eb55412ceb := 'TotalGross';
  p_IsComputed_48eb55412ceb := FALSE;
  p_IsSummary_48eb55412ceb := FALSE;
  p_DetectionMethod_48eb55412ceb := 'Manual';
  p_QueryID_48eb55412ceb := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_48eb55412ceb THEN 0 ELSE 1 END LIMIT 1), p_QueryID_48eb55412ceb);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
               WHERE "ID" = p_ID_48eb55412ceb
                  OR ("QueryID" = p_QueryID_48eb55412ceb AND "Name" = p_Name_48eb55412ceb)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_48eb55412ceb,
      'QueryID', p_QueryID_48eb55412ceb,
      'Name', p_Name_48eb55412ceb,
      'Description', p_Description_48eb55412ceb,
      'Sequence', p_Sequence_48eb55412ceb,
      'SQLBaseType', p_SQLBaseType_48eb55412ceb,
      'SQLFullType', p_SQLFullType_48eb55412ceb,
      'SourceEntityID', p_SourceEntityID_48eb55412ceb,
      'SourceFieldName', p_SourceFieldName_48eb55412ceb,
      'IsComputed', p_IsComputed_48eb55412ceb,
      'ComputationDescription', p_ComputationDescription_48eb55412ceb,
      'IsSummary', p_IsSummary_48eb55412ceb,
      'SummaryDescription', p_SummaryDescription_48eb55412ceb,
      'DetectionMethod', p_DetectionMethod_48eb55412ceb,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_48eb55412ceb
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_48eb55412ceb, p_QueryID := p_QueryID_48eb55412ceb, p_Name := p_Name_48eb55412ceb, p_Description := p_Description_48eb55412ceb, p_Sequence := p_Sequence_48eb55412ceb, p_SQLBaseType := p_SQLBaseType_48eb55412ceb, p_SQLFullType := p_SQLFullType_48eb55412ceb, p_SourceEntityID := p_SourceEntityID_48eb55412ceb, p_SourceFieldName := p_SourceFieldName_48eb55412ceb, p_IsComputed := p_IsComputed_48eb55412ceb, p_ComputationDescription := p_ComputationDescription_48eb55412ceb, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_48eb55412ceb, p_SummaryDescription := p_SummaryDescription_48eb55412ceb, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_48eb55412ceb, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_48eb55412ceb, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_074cc11ad565 UUID;
  p_QueryID_074cc11ad565 UUID;
  p_EntityID_074cc11ad565 UUID;
  p_DetectionMethod_074cc11ad565 VARCHAR(50);
  p_AutoDetectConfidenceScore_074cc11ad565 NUMERIC(3,2);
BEGIN
  p_ID_074cc11ad565 := '46801b5b-9a5b-4aad-886b-57fc19b38974';
  p_QueryID_074cc11ad565 := '5A1E5000-0001-4000-A000-000000000010';
  p_EntityID_074cc11ad565 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_DetectionMethod_074cc11ad565 := 'AI';
  p_AutoDetectConfidenceScore_074cc11ad565 := 1;
  p_QueryID_074cc11ad565 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_074cc11ad565 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_074cc11ad565);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_074cc11ad565
                  OR ("QueryID" = p_QueryID_074cc11ad565 AND "EntityID" = p_EntityID_074cc11ad565)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_074cc11ad565,
      'QueryID', p_QueryID_074cc11ad565,
      'EntityID', p_EntityID_074cc11ad565,
      'DetectionMethod', p_DetectionMethod_074cc11ad565,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_074cc11ad565
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_074cc11ad565, p_QueryID := p_QueryID_074cc11ad565, p_EntityID := p_EntityID_074cc11ad565, p_DetectionMethod := p_DetectionMethod_074cc11ad565, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_074cc11ad565);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_ab20faac3de4 UUID;
  p_QueryID_ab20faac3de4 UUID;
  p_EntityID_ab20faac3de4 UUID;
  p_DetectionMethod_ab20faac3de4 VARCHAR(50);
  p_AutoDetectConfidenceScore_ab20faac3de4 NUMERIC(3,2);
BEGIN
  p_ID_ab20faac3de4 := 'e896ac2c-3469-40b2-824b-58e2ad256422';
  p_QueryID_ab20faac3de4 := '5A1E5000-0001-4000-A000-000000000010';
  p_EntityID_ab20faac3de4 := '27E8D79F-A8E2-4AC1-B208-5A0F11416197';
  p_DetectionMethod_ab20faac3de4 := 'AI';
  p_AutoDetectConfidenceScore_ab20faac3de4 := 1;
  p_QueryID_ab20faac3de4 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_ab20faac3de4 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_ab20faac3de4);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_ab20faac3de4
                  OR ("QueryID" = p_QueryID_ab20faac3de4 AND "EntityID" = p_EntityID_ab20faac3de4)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_ab20faac3de4,
      'QueryID', p_QueryID_ab20faac3de4,
      'EntityID', p_EntityID_ab20faac3de4,
      'DetectionMethod', p_DetectionMethod_ab20faac3de4,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_ab20faac3de4
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_ab20faac3de4, p_QueryID := p_QueryID_ab20faac3de4, p_EntityID := p_EntityID_ab20faac3de4, p_DetectionMethod := p_DetectionMethod_ab20faac3de4, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_ab20faac3de4);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_caa3554d829b UUID;
  p_QueryID_caa3554d829b UUID;
  p_EntityID_caa3554d829b UUID;
  p_DetectionMethod_caa3554d829b VARCHAR(50);
  p_AutoDetectConfidenceScore_caa3554d829b NUMERIC(3,2);
BEGIN
  p_ID_caa3554d829b := '3304d42a-a3fd-4c6a-a13f-2dc1acfad389';
  p_QueryID_caa3554d829b := '5A1E5000-0001-4000-A000-000000000010';
  p_EntityID_caa3554d829b := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_DetectionMethod_caa3554d829b := 'AI';
  p_AutoDetectConfidenceScore_caa3554d829b := 1;
  p_QueryID_caa3554d829b := COALESCE((SELECT "ID" FROM "${mjSchema}"."Query" WHERE "Name" = 'Sales: Won Deals With Unconfirmed Orders' ORDER BY CASE WHEN "ID" = p_QueryID_caa3554d829b THEN 0 ELSE 1 END LIMIT 1), p_QueryID_caa3554d829b);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
               WHERE "ID" = p_ID_caa3554d829b
                  OR ("QueryID" = p_QueryID_caa3554d829b AND "EntityID" = p_EntityID_caa3554d829b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_caa3554d829b,
      'QueryID', p_QueryID_caa3554d829b,
      'EntityID', p_EntityID_caa3554d829b,
      'DetectionMethod', p_DetectionMethod_caa3554d829b,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_caa3554d829b
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_caa3554d829b, p_QueryID := p_QueryID_caa3554d829b, p_EntityID := p_EntityID_caa3554d829b, p_DetectionMethod := p_DetectionMethod_caa3554d829b, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_caa3554d829b);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7bb7cd2d9ad6 VARCHAR(255);
  p_Description_7bb7cd2d9ad6 TEXT;
  p_AutoUpdateDescription_7bb7cd2d9ad6 BOOLEAN;
  p_IsPrimaryKey_7bb7cd2d9ad6 BOOLEAN;
  p_IsUnique_7bb7cd2d9ad6 BOOLEAN;
  p_Category_7bb7cd2d9ad6 VARCHAR(255);
  p_ValueListType_7bb7cd2d9ad6 VARCHAR(20);
  p_ExtendedType_7bb7cd2d9ad6 VARCHAR(50);
  p_CodeType_7bb7cd2d9ad6 VARCHAR(50);
  p_DefaultInView_7bb7cd2d9ad6 BOOLEAN;
  p_ViewCellTemplate_7bb7cd2d9ad6 TEXT;
  p_DefaultColumnWidth_7bb7cd2d9ad6 INTEGER;
  p_AllowUpdateAPI_7bb7cd2d9ad6 BOOLEAN;
  p_AllowUpdateInView_7bb7cd2d9ad6 BOOLEAN;
  p_IncludeInUserSearchAPI_7bb7cd2d9ad6 BOOLEAN;
  p_FullTextSearchEnabled_7bb7cd2d9ad6 BOOLEAN;
  p_UserSearchParamFormatAPI_7bb7cd2d9ad6 VARCHAR(500);
  p_IncludeInGeneratedForm_7bb7cd2d9ad6 BOOLEAN;
  p_GeneratedFormSection_7bb7cd2d9ad6 VARCHAR(10);
  p_IsNameField_7bb7cd2d9ad6 BOOLEAN;
  p_RelatedEntityID_7bb7cd2d9ad6 UUID;
  p_RelatedEntityFieldName_7bb7cd2d9ad6 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6 BOOLEAN;
  p_RelatedEntityNameFieldMap_7bb7cd2d9ad6 VARCHAR(255);
  p_RelatedEntityDisplayType_7bb7cd2d9ad6 VARCHAR(20);
  p_EntityIDFieldName_7bb7cd2d9ad6 VARCHAR(100);
  p_ScopeDefault_7bb7cd2d9ad6 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6 BOOLEAN;
  p_ValuesToPackWithSchema_7bb7cd2d9ad6 VARCHAR(10);
  p_Status_7bb7cd2d9ad6 VARCHAR(25);
  p_AutoUpdateIsNameField_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateDefaultInView_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateCategory_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateDisplayName_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6 BOOLEAN;
  p_Encrypt_7bb7cd2d9ad6 BOOLEAN;
  p_EncryptionKeyID_7bb7cd2d9ad6 UUID;
  p_AllowDecryptInAPI_7bb7cd2d9ad6 BOOLEAN;
  p_SendEncryptedValue_7bb7cd2d9ad6 BOOLEAN;
  p_IsSoftPrimaryKey_7bb7cd2d9ad6 BOOLEAN;
  p_IsSoftForeignKey_7bb7cd2d9ad6 BOOLEAN;
  p_RelatedEntityJoinFields_7bb7cd2d9ad6 TEXT;
  p_JSONType_7bb7cd2d9ad6 VARCHAR(255);
  p_JSONTypeIsArray_7bb7cd2d9ad6 BOOLEAN;
  p_JSONTypeDefinition_7bb7cd2d9ad6 TEXT;
  p_UserSearchPredicateAPI_7bb7cd2d9ad6 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateFullTextSearch_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateExtendedType_7bb7cd2d9ad6 BOOLEAN;
  p_IsComputed_7bb7cd2d9ad6 BOOLEAN;
  p_EmbeddedRecord_7bb7cd2d9ad6 TEXT;
  p_Configuration_7bb7cd2d9ad6 TEXT;
  p_ID_7bb7cd2d9ad6 UUID;
BEGIN
  p_DisplayName_7bb7cd2d9ad6 := 'Contract ID';
  p_Description_7bb7cd2d9ad6 := 'SOFT reference (no FK) to a bizapps-contracts Contract. The link points DOWN the dependency graph; there is deliberately no Contract.DealID, because it is ONE contract to MANY deals — the original sale, every renewal, every expansion.';
  p_AutoUpdateDescription_7bb7cd2d9ad6 := TRUE;
  p_IsPrimaryKey_7bb7cd2d9ad6 := FALSE;
  p_IsUnique_7bb7cd2d9ad6 := FALSE;
  p_ValueListType_7bb7cd2d9ad6 := 'None';
  p_DefaultInView_7bb7cd2d9ad6 := FALSE;
  p_DefaultColumnWidth_7bb7cd2d9ad6 := 150;
  p_AllowUpdateAPI_7bb7cd2d9ad6 := TRUE;
  p_AllowUpdateInView_7bb7cd2d9ad6 := TRUE;
  p_IncludeInUserSearchAPI_7bb7cd2d9ad6 := FALSE;
  p_FullTextSearchEnabled_7bb7cd2d9ad6 := FALSE;
  p_IncludeInGeneratedForm_7bb7cd2d9ad6 := TRUE;
  p_GeneratedFormSection_7bb7cd2d9ad6 := 'Details';
  p_IsNameField_7bb7cd2d9ad6 := FALSE;
  p_RelatedEntityID_7bb7cd2d9ad6 := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_RelatedEntityFieldName_7bb7cd2d9ad6 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6 := FALSE;
  p_RelatedEntityDisplayType_7bb7cd2d9ad6 := 'Search';
  p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6 := FALSE;
  p_ValuesToPackWithSchema_7bb7cd2d9ad6 := 'Auto';
  p_Status_7bb7cd2d9ad6 := 'Active';
  p_AutoUpdateIsNameField_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateDefaultInView_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateCategory_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateDisplayName_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6 := TRUE;
  p_Encrypt_7bb7cd2d9ad6 := FALSE;
  p_AllowDecryptInAPI_7bb7cd2d9ad6 := FALSE;
  p_SendEncryptedValue_7bb7cd2d9ad6 := FALSE;
  p_IsSoftPrimaryKey_7bb7cd2d9ad6 := FALSE;
  p_IsSoftForeignKey_7bb7cd2d9ad6 := TRUE;
  p_JSONTypeIsArray_7bb7cd2d9ad6 := FALSE;
  p_UserSearchPredicateAPI_7bb7cd2d9ad6 := 'Contains';
  p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateFullTextSearch_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateExtendedType_7bb7cd2d9ad6 := TRUE;
  p_IsComputed_7bb7cd2d9ad6 := FALSE;
  p_ID_7bb7cd2d9ad6 := '61862F6F-2A93-4EA1-B828-3772CC49E197';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7bb7cd2d9ad6,
    'Description', p_Description_7bb7cd2d9ad6,
    'AutoUpdateDescription', p_AutoUpdateDescription_7bb7cd2d9ad6,
    'IsPrimaryKey', p_IsPrimaryKey_7bb7cd2d9ad6,
    'IsUnique', p_IsUnique_7bb7cd2d9ad6,
    'Category', p_Category_7bb7cd2d9ad6,
    'ValueListType', p_ValueListType_7bb7cd2d9ad6,
    'ExtendedType', p_ExtendedType_7bb7cd2d9ad6,
    'CodeType', p_CodeType_7bb7cd2d9ad6,
    'DefaultInView', p_DefaultInView_7bb7cd2d9ad6,
    'ViewCellTemplate', p_ViewCellTemplate_7bb7cd2d9ad6,
    'DefaultColumnWidth', p_DefaultColumnWidth_7bb7cd2d9ad6,
    'AllowUpdateAPI', p_AllowUpdateAPI_7bb7cd2d9ad6,
    'AllowUpdateInView', p_AllowUpdateInView_7bb7cd2d9ad6,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7bb7cd2d9ad6,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7bb7cd2d9ad6,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7bb7cd2d9ad6,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7bb7cd2d9ad6,
    'GeneratedFormSection', p_GeneratedFormSection_7bb7cd2d9ad6,
    'IsNameField', p_IsNameField_7bb7cd2d9ad6,
    'RelatedEntityID', p_RelatedEntityID_7bb7cd2d9ad6,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7bb7cd2d9ad6,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7bb7cd2d9ad6,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7bb7cd2d9ad6,
    'EntityIDFieldName', p_EntityIDFieldName_7bb7cd2d9ad6,
    'ScopeDefault', p_ScopeDefault_7bb7cd2d9ad6,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7bb7cd2d9ad6,
    'Status', p_Status_7bb7cd2d9ad6,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7bb7cd2d9ad6,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7bb7cd2d9ad6,
    'AutoUpdateCategory', p_AutoUpdateCategory_7bb7cd2d9ad6,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7bb7cd2d9ad6,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6,
    'Encrypt', p_Encrypt_7bb7cd2d9ad6,
    'EncryptionKeyID', p_EncryptionKeyID_7bb7cd2d9ad6,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7bb7cd2d9ad6,
    'SendEncryptedValue', p_SendEncryptedValue_7bb7cd2d9ad6,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7bb7cd2d9ad6,
    'IsSoftForeignKey', p_IsSoftForeignKey_7bb7cd2d9ad6,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7bb7cd2d9ad6,
    'JSONType', p_JSONType_7bb7cd2d9ad6,
    'JSONTypeIsArray', p_JSONTypeIsArray_7bb7cd2d9ad6,
    'JSONTypeDefinition', p_JSONTypeDefinition_7bb7cd2d9ad6,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7bb7cd2d9ad6,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7bb7cd2d9ad6,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7bb7cd2d9ad6,
    'IsComputed', p_IsComputed_7bb7cd2d9ad6
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7bb7cd2d9ad6,
    'Configuration', p_Configuration_7bb7cd2d9ad6,
    'ID', p_ID_7bb7cd2d9ad6
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_7bb7cd2d9ad6, p_Description := p_Description_7bb7cd2d9ad6, p_AutoUpdateDescription := p_AutoUpdateDescription_7bb7cd2d9ad6, p_IsPrimaryKey := p_IsPrimaryKey_7bb7cd2d9ad6, p_IsUnique := p_IsUnique_7bb7cd2d9ad6, p_Category := p_Category_7bb7cd2d9ad6, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_7bb7cd2d9ad6, p_ExtendedType := p_ExtendedType_7bb7cd2d9ad6, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7bb7cd2d9ad6, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7bb7cd2d9ad6, p_ViewCellTemplate := p_ViewCellTemplate_7bb7cd2d9ad6, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7bb7cd2d9ad6, p_AllowUpdateAPI := p_AllowUpdateAPI_7bb7cd2d9ad6, p_AllowUpdateInView := p_AllowUpdateInView_7bb7cd2d9ad6, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7bb7cd2d9ad6, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7bb7cd2d9ad6, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7bb7cd2d9ad6, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7bb7cd2d9ad6, p_GeneratedFormSection := p_GeneratedFormSection_7bb7cd2d9ad6, p_IsNameField := p_IsNameField_7bb7cd2d9ad6, p_RelatedEntityID := p_RelatedEntityID_7bb7cd2d9ad6, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7bb7cd2d9ad6, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7bb7cd2d9ad6, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7bb7cd2d9ad6, p_EntityIDFieldName := p_EntityIDFieldName_7bb7cd2d9ad6, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7bb7cd2d9ad6, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7bb7cd2d9ad6, p_Status := p_Status_7bb7cd2d9ad6, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7bb7cd2d9ad6, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7bb7cd2d9ad6, p_AutoUpdateCategory := p_AutoUpdateCategory_7bb7cd2d9ad6, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7bb7cd2d9ad6, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6, p_Encrypt := p_Encrypt_7bb7cd2d9ad6, p_EncryptionKeyID := p_EncryptionKeyID_7bb7cd2d9ad6, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7bb7cd2d9ad6, p_SendEncryptedValue := p_SendEncryptedValue_7bb7cd2d9ad6, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7bb7cd2d9ad6, p_IsSoftForeignKey := p_IsSoftForeignKey_7bb7cd2d9ad6, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7bb7cd2d9ad6, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7bb7cd2d9ad6, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7bb7cd2d9ad6, p_JSONTypeDefinition := p_JSONTypeDefinition_7bb7cd2d9ad6, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7bb7cd2d9ad6, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7bb7cd2d9ad6, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7bb7cd2d9ad6, p_IsComputed := p_IsComputed_7bb7cd2d9ad6, p_EmbeddedRecord := p_EmbeddedRecord_7bb7cd2d9ad6, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7bb7cd2d9ad6, p_Configuration_Clear := TRUE, p_ID := p_ID_7bb7cd2d9ad6);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7c293164ff22 VARCHAR(255);
  p_Description_7c293164ff22 TEXT;
  p_AutoUpdateDescription_7c293164ff22 BOOLEAN;
  p_IsPrimaryKey_7c293164ff22 BOOLEAN;
  p_IsUnique_7c293164ff22 BOOLEAN;
  p_Category_7c293164ff22 VARCHAR(255);
  p_ValueListType_7c293164ff22 VARCHAR(20);
  p_ExtendedType_7c293164ff22 VARCHAR(50);
  p_CodeType_7c293164ff22 VARCHAR(50);
  p_DefaultInView_7c293164ff22 BOOLEAN;
  p_ViewCellTemplate_7c293164ff22 TEXT;
  p_DefaultColumnWidth_7c293164ff22 INTEGER;
  p_AllowUpdateAPI_7c293164ff22 BOOLEAN;
  p_AllowUpdateInView_7c293164ff22 BOOLEAN;
  p_IncludeInUserSearchAPI_7c293164ff22 BOOLEAN;
  p_FullTextSearchEnabled_7c293164ff22 BOOLEAN;
  p_UserSearchParamFormatAPI_7c293164ff22 VARCHAR(500);
  p_IncludeInGeneratedForm_7c293164ff22 BOOLEAN;
  p_GeneratedFormSection_7c293164ff22 VARCHAR(10);
  p_IsNameField_7c293164ff22 BOOLEAN;
  p_RelatedEntityID_7c293164ff22 UUID;
  p_RelatedEntityFieldName_7c293164ff22 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22 BOOLEAN;
  p_RelatedEntityNameFieldMap_7c293164ff22 VARCHAR(255);
  p_RelatedEntityDisplayType_7c293164ff22 VARCHAR(20);
  p_EntityIDFieldName_7c293164ff22 VARCHAR(100);
  p_ScopeDefault_7c293164ff22 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7c293164ff22 BOOLEAN;
  p_ValuesToPackWithSchema_7c293164ff22 VARCHAR(10);
  p_Status_7c293164ff22 VARCHAR(25);
  p_AutoUpdateIsNameField_7c293164ff22 BOOLEAN;
  p_AutoUpdateDefaultInView_7c293164ff22 BOOLEAN;
  p_AutoUpdateCategory_7c293164ff22 BOOLEAN;
  p_AutoUpdateDisplayName_7c293164ff22 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22 BOOLEAN;
  p_Encrypt_7c293164ff22 BOOLEAN;
  p_EncryptionKeyID_7c293164ff22 UUID;
  p_AllowDecryptInAPI_7c293164ff22 BOOLEAN;
  p_SendEncryptedValue_7c293164ff22 BOOLEAN;
  p_IsSoftPrimaryKey_7c293164ff22 BOOLEAN;
  p_IsSoftForeignKey_7c293164ff22 BOOLEAN;
  p_RelatedEntityJoinFields_7c293164ff22 TEXT;
  p_JSONType_7c293164ff22 VARCHAR(255);
  p_JSONTypeIsArray_7c293164ff22 BOOLEAN;
  p_JSONTypeDefinition_7c293164ff22 TEXT;
  p_UserSearchPredicateAPI_7c293164ff22 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7c293164ff22 BOOLEAN;
  p_AutoUpdateFullTextSearch_7c293164ff22 BOOLEAN;
  p_AutoUpdateExtendedType_7c293164ff22 BOOLEAN;
  p_IsComputed_7c293164ff22 BOOLEAN;
  p_EmbeddedRecord_7c293164ff22 TEXT;
  p_Configuration_7c293164ff22 TEXT;
  p_ID_7c293164ff22 UUID;
BEGIN
  p_DisplayName_7c293164ff22 := 'Renews Contract ID';
  p_Description_7c293164ff22 := 'SOFT reference (no FK) to the contract this deal RENEWS. What makes the renewal chain navigable from the sales side without contracts knowing anything about it. Required when DealType.RequiresRenewalSource is set.';
  p_AutoUpdateDescription_7c293164ff22 := TRUE;
  p_IsPrimaryKey_7c293164ff22 := FALSE;
  p_IsUnique_7c293164ff22 := FALSE;
  p_ValueListType_7c293164ff22 := 'None';
  p_DefaultInView_7c293164ff22 := FALSE;
  p_DefaultColumnWidth_7c293164ff22 := 150;
  p_AllowUpdateAPI_7c293164ff22 := TRUE;
  p_AllowUpdateInView_7c293164ff22 := TRUE;
  p_IncludeInUserSearchAPI_7c293164ff22 := FALSE;
  p_FullTextSearchEnabled_7c293164ff22 := FALSE;
  p_IncludeInGeneratedForm_7c293164ff22 := TRUE;
  p_GeneratedFormSection_7c293164ff22 := 'Details';
  p_IsNameField_7c293164ff22 := FALSE;
  p_RelatedEntityID_7c293164ff22 := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_RelatedEntityFieldName_7c293164ff22 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22 := FALSE;
  p_RelatedEntityDisplayType_7c293164ff22 := 'Search';
  p_AutoUpdateRelatedEntityInfo_7c293164ff22 := FALSE;
  p_ValuesToPackWithSchema_7c293164ff22 := 'Auto';
  p_Status_7c293164ff22 := 'Active';
  p_AutoUpdateIsNameField_7c293164ff22 := TRUE;
  p_AutoUpdateDefaultInView_7c293164ff22 := TRUE;
  p_AutoUpdateCategory_7c293164ff22 := TRUE;
  p_AutoUpdateDisplayName_7c293164ff22 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22 := TRUE;
  p_Encrypt_7c293164ff22 := FALSE;
  p_AllowDecryptInAPI_7c293164ff22 := FALSE;
  p_SendEncryptedValue_7c293164ff22 := FALSE;
  p_IsSoftPrimaryKey_7c293164ff22 := FALSE;
  p_IsSoftForeignKey_7c293164ff22 := TRUE;
  p_JSONTypeIsArray_7c293164ff22 := FALSE;
  p_UserSearchPredicateAPI_7c293164ff22 := 'Contains';
  p_AutoUpdateUserSearchPredicate_7c293164ff22 := TRUE;
  p_AutoUpdateFullTextSearch_7c293164ff22 := TRUE;
  p_AutoUpdateExtendedType_7c293164ff22 := TRUE;
  p_IsComputed_7c293164ff22 := FALSE;
  p_ID_7c293164ff22 := '8023C8F2-325E-4C73-8305-075D89227E12';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7c293164ff22,
    'Description', p_Description_7c293164ff22,
    'AutoUpdateDescription', p_AutoUpdateDescription_7c293164ff22,
    'IsPrimaryKey', p_IsPrimaryKey_7c293164ff22,
    'IsUnique', p_IsUnique_7c293164ff22,
    'Category', p_Category_7c293164ff22,
    'ValueListType', p_ValueListType_7c293164ff22,
    'ExtendedType', p_ExtendedType_7c293164ff22,
    'CodeType', p_CodeType_7c293164ff22,
    'DefaultInView', p_DefaultInView_7c293164ff22,
    'ViewCellTemplate', p_ViewCellTemplate_7c293164ff22,
    'DefaultColumnWidth', p_DefaultColumnWidth_7c293164ff22,
    'AllowUpdateAPI', p_AllowUpdateAPI_7c293164ff22,
    'AllowUpdateInView', p_AllowUpdateInView_7c293164ff22,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7c293164ff22,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7c293164ff22,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7c293164ff22,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7c293164ff22,
    'GeneratedFormSection', p_GeneratedFormSection_7c293164ff22,
    'IsNameField', p_IsNameField_7c293164ff22,
    'RelatedEntityID', p_RelatedEntityID_7c293164ff22,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7c293164ff22,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7c293164ff22,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7c293164ff22,
    'EntityIDFieldName', p_EntityIDFieldName_7c293164ff22,
    'ScopeDefault', p_ScopeDefault_7c293164ff22,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7c293164ff22,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7c293164ff22,
    'Status', p_Status_7c293164ff22,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7c293164ff22,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7c293164ff22,
    'AutoUpdateCategory', p_AutoUpdateCategory_7c293164ff22,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7c293164ff22,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22,
    'Encrypt', p_Encrypt_7c293164ff22,
    'EncryptionKeyID', p_EncryptionKeyID_7c293164ff22,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7c293164ff22,
    'SendEncryptedValue', p_SendEncryptedValue_7c293164ff22,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7c293164ff22,
    'IsSoftForeignKey', p_IsSoftForeignKey_7c293164ff22,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7c293164ff22,
    'JSONType', p_JSONType_7c293164ff22,
    'JSONTypeIsArray', p_JSONTypeIsArray_7c293164ff22,
    'JSONTypeDefinition', p_JSONTypeDefinition_7c293164ff22,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7c293164ff22,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7c293164ff22,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7c293164ff22,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7c293164ff22,
    'IsComputed', p_IsComputed_7c293164ff22
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7c293164ff22,
    'Configuration', p_Configuration_7c293164ff22,
    'ID', p_ID_7c293164ff22
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_7c293164ff22, p_Description := p_Description_7c293164ff22, p_AutoUpdateDescription := p_AutoUpdateDescription_7c293164ff22, p_IsPrimaryKey := p_IsPrimaryKey_7c293164ff22, p_IsUnique := p_IsUnique_7c293164ff22, p_Category := p_Category_7c293164ff22, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_7c293164ff22, p_ExtendedType := p_ExtendedType_7c293164ff22, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7c293164ff22, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7c293164ff22, p_ViewCellTemplate := p_ViewCellTemplate_7c293164ff22, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7c293164ff22, p_AllowUpdateAPI := p_AllowUpdateAPI_7c293164ff22, p_AllowUpdateInView := p_AllowUpdateInView_7c293164ff22, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7c293164ff22, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7c293164ff22, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7c293164ff22, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7c293164ff22, p_GeneratedFormSection := p_GeneratedFormSection_7c293164ff22, p_IsNameField := p_IsNameField_7c293164ff22, p_RelatedEntityID := p_RelatedEntityID_7c293164ff22, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7c293164ff22, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7c293164ff22, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7c293164ff22, p_EntityIDFieldName := p_EntityIDFieldName_7c293164ff22, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7c293164ff22, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7c293164ff22, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7c293164ff22, p_Status := p_Status_7c293164ff22, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7c293164ff22, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7c293164ff22, p_AutoUpdateCategory := p_AutoUpdateCategory_7c293164ff22, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7c293164ff22, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22, p_Encrypt := p_Encrypt_7c293164ff22, p_EncryptionKeyID := p_EncryptionKeyID_7c293164ff22, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7c293164ff22, p_SendEncryptedValue := p_SendEncryptedValue_7c293164ff22, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7c293164ff22, p_IsSoftForeignKey := p_IsSoftForeignKey_7c293164ff22, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7c293164ff22, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7c293164ff22, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7c293164ff22, p_JSONTypeDefinition := p_JSONTypeDefinition_7c293164ff22, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7c293164ff22, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7c293164ff22, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7c293164ff22, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7c293164ff22, p_IsComputed := p_IsComputed_7c293164ff22, p_EmbeddedRecord := p_EmbeddedRecord_7c293164ff22, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7c293164ff22, p_Configuration_Clear := TRUE, p_ID := p_ID_7c293164ff22);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_a8af17a4e961 VARCHAR(255);
  p_Description_a8af17a4e961 TEXT;
  p_AutoUpdateDescription_a8af17a4e961 BOOLEAN;
  p_IsPrimaryKey_a8af17a4e961 BOOLEAN;
  p_IsUnique_a8af17a4e961 BOOLEAN;
  p_Category_a8af17a4e961 VARCHAR(255);
  p_ValueListType_a8af17a4e961 VARCHAR(20);
  p_ExtendedType_a8af17a4e961 VARCHAR(50);
  p_CodeType_a8af17a4e961 VARCHAR(50);
  p_DefaultInView_a8af17a4e961 BOOLEAN;
  p_ViewCellTemplate_a8af17a4e961 TEXT;
  p_DefaultColumnWidth_a8af17a4e961 INTEGER;
  p_AllowUpdateAPI_a8af17a4e961 BOOLEAN;
  p_AllowUpdateInView_a8af17a4e961 BOOLEAN;
  p_IncludeInUserSearchAPI_a8af17a4e961 BOOLEAN;
  p_FullTextSearchEnabled_a8af17a4e961 BOOLEAN;
  p_UserSearchParamFormatAPI_a8af17a4e961 VARCHAR(500);
  p_IncludeInGeneratedForm_a8af17a4e961 BOOLEAN;
  p_GeneratedFormSection_a8af17a4e961 VARCHAR(10);
  p_IsNameField_a8af17a4e961 BOOLEAN;
  p_RelatedEntityID_a8af17a4e961 UUID;
  p_RelatedEntityFieldName_a8af17a4e961 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961 BOOLEAN;
  p_RelatedEntityNameFieldMap_a8af17a4e961 VARCHAR(255);
  p_RelatedEntityDisplayType_a8af17a4e961 VARCHAR(20);
  p_EntityIDFieldName_a8af17a4e961 VARCHAR(100);
  p_ScopeDefault_a8af17a4e961 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_a8af17a4e961 BOOLEAN;
  p_ValuesToPackWithSchema_a8af17a4e961 VARCHAR(10);
  p_Status_a8af17a4e961 VARCHAR(25);
  p_AutoUpdateIsNameField_a8af17a4e961 BOOLEAN;
  p_AutoUpdateDefaultInView_a8af17a4e961 BOOLEAN;
  p_AutoUpdateCategory_a8af17a4e961 BOOLEAN;
  p_AutoUpdateDisplayName_a8af17a4e961 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961 BOOLEAN;
  p_Encrypt_a8af17a4e961 BOOLEAN;
  p_EncryptionKeyID_a8af17a4e961 UUID;
  p_AllowDecryptInAPI_a8af17a4e961 BOOLEAN;
  p_SendEncryptedValue_a8af17a4e961 BOOLEAN;
  p_IsSoftPrimaryKey_a8af17a4e961 BOOLEAN;
  p_IsSoftForeignKey_a8af17a4e961 BOOLEAN;
  p_RelatedEntityJoinFields_a8af17a4e961 TEXT;
  p_JSONType_a8af17a4e961 VARCHAR(255);
  p_JSONTypeIsArray_a8af17a4e961 BOOLEAN;
  p_JSONTypeDefinition_a8af17a4e961 TEXT;
  p_UserSearchPredicateAPI_a8af17a4e961 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_a8af17a4e961 BOOLEAN;
  p_AutoUpdateFullTextSearch_a8af17a4e961 BOOLEAN;
  p_AutoUpdateExtendedType_a8af17a4e961 BOOLEAN;
  p_IsComputed_a8af17a4e961 BOOLEAN;
  p_EmbeddedRecord_a8af17a4e961 TEXT;
  p_Configuration_a8af17a4e961 TEXT;
  p_ID_a8af17a4e961 UUID;
BEGIN
  p_DisplayName_a8af17a4e961 := 'Currency ID';
  p_AutoUpdateDescription_a8af17a4e961 := TRUE;
  p_IsPrimaryKey_a8af17a4e961 := FALSE;
  p_IsUnique_a8af17a4e961 := FALSE;
  p_ValueListType_a8af17a4e961 := 'None';
  p_DefaultInView_a8af17a4e961 := FALSE;
  p_DefaultColumnWidth_a8af17a4e961 := 150;
  p_AllowUpdateAPI_a8af17a4e961 := TRUE;
  p_AllowUpdateInView_a8af17a4e961 := TRUE;
  p_IncludeInUserSearchAPI_a8af17a4e961 := FALSE;
  p_FullTextSearchEnabled_a8af17a4e961 := FALSE;
  p_IncludeInGeneratedForm_a8af17a4e961 := TRUE;
  p_GeneratedFormSection_a8af17a4e961 := 'Details';
  p_IsNameField_a8af17a4e961 := FALSE;
  p_RelatedEntityID_a8af17a4e961 := 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7';
  p_RelatedEntityFieldName_a8af17a4e961 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961 := FALSE;
  p_RelatedEntityDisplayType_a8af17a4e961 := 'Search';
  p_AutoUpdateRelatedEntityInfo_a8af17a4e961 := FALSE;
  p_ValuesToPackWithSchema_a8af17a4e961 := 'Auto';
  p_Status_a8af17a4e961 := 'Active';
  p_AutoUpdateIsNameField_a8af17a4e961 := TRUE;
  p_AutoUpdateDefaultInView_a8af17a4e961 := TRUE;
  p_AutoUpdateCategory_a8af17a4e961 := TRUE;
  p_AutoUpdateDisplayName_a8af17a4e961 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961 := TRUE;
  p_Encrypt_a8af17a4e961 := FALSE;
  p_AllowDecryptInAPI_a8af17a4e961 := FALSE;
  p_SendEncryptedValue_a8af17a4e961 := FALSE;
  p_IsSoftPrimaryKey_a8af17a4e961 := FALSE;
  p_IsSoftForeignKey_a8af17a4e961 := TRUE;
  p_JSONTypeIsArray_a8af17a4e961 := FALSE;
  p_UserSearchPredicateAPI_a8af17a4e961 := 'Contains';
  p_AutoUpdateUserSearchPredicate_a8af17a4e961 := TRUE;
  p_AutoUpdateFullTextSearch_a8af17a4e961 := TRUE;
  p_AutoUpdateExtendedType_a8af17a4e961 := TRUE;
  p_IsComputed_a8af17a4e961 := FALSE;
  p_ID_a8af17a4e961 := '56E0AEA4-670E-4362-9854-3925B1FB215A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_a8af17a4e961,
    'Description', p_Description_a8af17a4e961,
    'AutoUpdateDescription', p_AutoUpdateDescription_a8af17a4e961,
    'IsPrimaryKey', p_IsPrimaryKey_a8af17a4e961,
    'IsUnique', p_IsUnique_a8af17a4e961,
    'Category', p_Category_a8af17a4e961,
    'ValueListType', p_ValueListType_a8af17a4e961,
    'ExtendedType', p_ExtendedType_a8af17a4e961,
    'CodeType', p_CodeType_a8af17a4e961,
    'DefaultInView', p_DefaultInView_a8af17a4e961,
    'ViewCellTemplate', p_ViewCellTemplate_a8af17a4e961,
    'DefaultColumnWidth', p_DefaultColumnWidth_a8af17a4e961,
    'AllowUpdateAPI', p_AllowUpdateAPI_a8af17a4e961,
    'AllowUpdateInView', p_AllowUpdateInView_a8af17a4e961,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_a8af17a4e961,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_a8af17a4e961,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_a8af17a4e961,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_a8af17a4e961,
    'GeneratedFormSection', p_GeneratedFormSection_a8af17a4e961,
    'IsNameField', p_IsNameField_a8af17a4e961,
    'RelatedEntityID', p_RelatedEntityID_a8af17a4e961,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_a8af17a4e961,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_a8af17a4e961,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_a8af17a4e961,
    'EntityIDFieldName', p_EntityIDFieldName_a8af17a4e961,
    'ScopeDefault', p_ScopeDefault_a8af17a4e961,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_a8af17a4e961,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_a8af17a4e961,
    'Status', p_Status_a8af17a4e961,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_a8af17a4e961,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_a8af17a4e961,
    'AutoUpdateCategory', p_AutoUpdateCategory_a8af17a4e961,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_a8af17a4e961,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961,
    'Encrypt', p_Encrypt_a8af17a4e961,
    'EncryptionKeyID', p_EncryptionKeyID_a8af17a4e961,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_a8af17a4e961,
    'SendEncryptedValue', p_SendEncryptedValue_a8af17a4e961,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_a8af17a4e961,
    'IsSoftForeignKey', p_IsSoftForeignKey_a8af17a4e961,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_a8af17a4e961,
    'JSONType', p_JSONType_a8af17a4e961,
    'JSONTypeIsArray', p_JSONTypeIsArray_a8af17a4e961,
    'JSONTypeDefinition', p_JSONTypeDefinition_a8af17a4e961,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_a8af17a4e961,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_a8af17a4e961,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_a8af17a4e961,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_a8af17a4e961,
    'IsComputed', p_IsComputed_a8af17a4e961
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_a8af17a4e961,
    'Configuration', p_Configuration_a8af17a4e961,
    'ID', p_ID_a8af17a4e961
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_a8af17a4e961, p_Description := p_Description_a8af17a4e961, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_a8af17a4e961, p_IsPrimaryKey := p_IsPrimaryKey_a8af17a4e961, p_IsUnique := p_IsUnique_a8af17a4e961, p_Category := p_Category_a8af17a4e961, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_a8af17a4e961, p_ExtendedType := p_ExtendedType_a8af17a4e961, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_a8af17a4e961, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_a8af17a4e961, p_ViewCellTemplate := p_ViewCellTemplate_a8af17a4e961, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_a8af17a4e961, p_AllowUpdateAPI := p_AllowUpdateAPI_a8af17a4e961, p_AllowUpdateInView := p_AllowUpdateInView_a8af17a4e961, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_a8af17a4e961, p_FullTextSearchEnabled := p_FullTextSearchEnabled_a8af17a4e961, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_a8af17a4e961, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_a8af17a4e961, p_GeneratedFormSection := p_GeneratedFormSection_a8af17a4e961, p_IsNameField := p_IsNameField_a8af17a4e961, p_RelatedEntityID := p_RelatedEntityID_a8af17a4e961, p_RelatedEntityFieldName := p_RelatedEntityFieldName_a8af17a4e961, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_a8af17a4e961, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_a8af17a4e961, p_EntityIDFieldName := p_EntityIDFieldName_a8af17a4e961, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_a8af17a4e961, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_a8af17a4e961, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_a8af17a4e961, p_Status := p_Status_a8af17a4e961, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_a8af17a4e961, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_a8af17a4e961, p_AutoUpdateCategory := p_AutoUpdateCategory_a8af17a4e961, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_a8af17a4e961, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961, p_Encrypt := p_Encrypt_a8af17a4e961, p_EncryptionKeyID := p_EncryptionKeyID_a8af17a4e961, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_a8af17a4e961, p_SendEncryptedValue := p_SendEncryptedValue_a8af17a4e961, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_a8af17a4e961, p_IsSoftForeignKey := p_IsSoftForeignKey_a8af17a4e961, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_a8af17a4e961, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_a8af17a4e961, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_a8af17a4e961, p_JSONTypeDefinition := p_JSONTypeDefinition_a8af17a4e961, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_a8af17a4e961, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_a8af17a4e961, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_a8af17a4e961, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_a8af17a4e961, p_IsComputed := p_IsComputed_a8af17a4e961, p_EmbeddedRecord := p_EmbeddedRecord_a8af17a4e961, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_a8af17a4e961, p_Configuration_Clear := TRUE, p_ID := p_ID_a8af17a4e961);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_a95bb133771e VARCHAR(255);
  p_Description_a95bb133771e TEXT;
  p_AutoUpdateDescription_a95bb133771e BOOLEAN;
  p_IsPrimaryKey_a95bb133771e BOOLEAN;
  p_IsUnique_a95bb133771e BOOLEAN;
  p_Category_a95bb133771e VARCHAR(255);
  p_ValueListType_a95bb133771e VARCHAR(20);
  p_ExtendedType_a95bb133771e VARCHAR(50);
  p_CodeType_a95bb133771e VARCHAR(50);
  p_DefaultInView_a95bb133771e BOOLEAN;
  p_ViewCellTemplate_a95bb133771e TEXT;
  p_DefaultColumnWidth_a95bb133771e INTEGER;
  p_AllowUpdateAPI_a95bb133771e BOOLEAN;
  p_AllowUpdateInView_a95bb133771e BOOLEAN;
  p_IncludeInUserSearchAPI_a95bb133771e BOOLEAN;
  p_FullTextSearchEnabled_a95bb133771e BOOLEAN;
  p_UserSearchParamFormatAPI_a95bb133771e VARCHAR(500);
  p_IncludeInGeneratedForm_a95bb133771e BOOLEAN;
  p_GeneratedFormSection_a95bb133771e VARCHAR(10);
  p_IsNameField_a95bb133771e BOOLEAN;
  p_RelatedEntityID_a95bb133771e UUID;
  p_RelatedEntityFieldName_a95bb133771e VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_a95bb133771e BOOLEAN;
  p_RelatedEntityNameFieldMap_a95bb133771e VARCHAR(255);
  p_RelatedEntityDisplayType_a95bb133771e VARCHAR(20);
  p_EntityIDFieldName_a95bb133771e VARCHAR(100);
  p_ScopeDefault_a95bb133771e VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_a95bb133771e BOOLEAN;
  p_ValuesToPackWithSchema_a95bb133771e VARCHAR(10);
  p_Status_a95bb133771e VARCHAR(25);
  p_AutoUpdateIsNameField_a95bb133771e BOOLEAN;
  p_AutoUpdateDefaultInView_a95bb133771e BOOLEAN;
  p_AutoUpdateCategory_a95bb133771e BOOLEAN;
  p_AutoUpdateDisplayName_a95bb133771e BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_a95bb133771e BOOLEAN;
  p_Encrypt_a95bb133771e BOOLEAN;
  p_EncryptionKeyID_a95bb133771e UUID;
  p_AllowDecryptInAPI_a95bb133771e BOOLEAN;
  p_SendEncryptedValue_a95bb133771e BOOLEAN;
  p_IsSoftPrimaryKey_a95bb133771e BOOLEAN;
  p_IsSoftForeignKey_a95bb133771e BOOLEAN;
  p_RelatedEntityJoinFields_a95bb133771e TEXT;
  p_JSONType_a95bb133771e VARCHAR(255);
  p_JSONTypeIsArray_a95bb133771e BOOLEAN;
  p_JSONTypeDefinition_a95bb133771e TEXT;
  p_UserSearchPredicateAPI_a95bb133771e VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_a95bb133771e BOOLEAN;
  p_AutoUpdateFullTextSearch_a95bb133771e BOOLEAN;
  p_AutoUpdateExtendedType_a95bb133771e BOOLEAN;
  p_IsComputed_a95bb133771e BOOLEAN;
  p_EmbeddedRecord_a95bb133771e TEXT;
  p_Configuration_a95bb133771e TEXT;
  p_ID_a95bb133771e UUID;
BEGIN
  p_DisplayName_a95bb133771e := 'Status';
  p_AutoUpdateDescription_a95bb133771e := TRUE;
  p_IsPrimaryKey_a95bb133771e := FALSE;
  p_IsUnique_a95bb133771e := FALSE;
  p_ValueListType_a95bb133771e := 'None';
  p_DefaultInView_a95bb133771e := TRUE;
  p_DefaultColumnWidth_a95bb133771e := 150;
  p_AllowUpdateAPI_a95bb133771e := FALSE;
  p_AllowUpdateInView_a95bb133771e := TRUE;
  p_IncludeInUserSearchAPI_a95bb133771e := FALSE;
  p_FullTextSearchEnabled_a95bb133771e := FALSE;
  p_IncludeInGeneratedForm_a95bb133771e := TRUE;
  p_GeneratedFormSection_a95bb133771e := 'Details';
  p_IsNameField_a95bb133771e := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_a95bb133771e := FALSE;
  p_RelatedEntityDisplayType_a95bb133771e := 'Search';
  p_AutoUpdateRelatedEntityInfo_a95bb133771e := TRUE;
  p_ValuesToPackWithSchema_a95bb133771e := 'Auto';
  p_Status_a95bb133771e := 'Active';
  p_AutoUpdateIsNameField_a95bb133771e := TRUE;
  p_AutoUpdateDefaultInView_a95bb133771e := TRUE;
  p_AutoUpdateCategory_a95bb133771e := TRUE;
  p_AutoUpdateDisplayName_a95bb133771e := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_a95bb133771e := TRUE;
  p_Encrypt_a95bb133771e := FALSE;
  p_AllowDecryptInAPI_a95bb133771e := FALSE;
  p_SendEncryptedValue_a95bb133771e := FALSE;
  p_IsSoftPrimaryKey_a95bb133771e := FALSE;
  p_IsSoftForeignKey_a95bb133771e := FALSE;
  p_JSONTypeIsArray_a95bb133771e := FALSE;
  p_UserSearchPredicateAPI_a95bb133771e := 'Contains';
  p_AutoUpdateUserSearchPredicate_a95bb133771e := TRUE;
  p_AutoUpdateFullTextSearch_a95bb133771e := TRUE;
  p_AutoUpdateExtendedType_a95bb133771e := TRUE;
  p_IsComputed_a95bb133771e := FALSE;
  p_ID_a95bb133771e := '0D7D2672-D189-402E-A84E-249EC5ABBD3E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_a95bb133771e,
    'Description', p_Description_a95bb133771e,
    'AutoUpdateDescription', p_AutoUpdateDescription_a95bb133771e,
    'IsPrimaryKey', p_IsPrimaryKey_a95bb133771e,
    'IsUnique', p_IsUnique_a95bb133771e,
    'Category', p_Category_a95bb133771e,
    'ValueListType', p_ValueListType_a95bb133771e,
    'ExtendedType', p_ExtendedType_a95bb133771e,
    'CodeType', p_CodeType_a95bb133771e,
    'DefaultInView', p_DefaultInView_a95bb133771e,
    'ViewCellTemplate', p_ViewCellTemplate_a95bb133771e,
    'DefaultColumnWidth', p_DefaultColumnWidth_a95bb133771e,
    'AllowUpdateAPI', p_AllowUpdateAPI_a95bb133771e,
    'AllowUpdateInView', p_AllowUpdateInView_a95bb133771e,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_a95bb133771e,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_a95bb133771e,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_a95bb133771e,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_a95bb133771e,
    'GeneratedFormSection', p_GeneratedFormSection_a95bb133771e,
    'IsNameField', p_IsNameField_a95bb133771e,
    'RelatedEntityID', p_RelatedEntityID_a95bb133771e,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_a95bb133771e,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_a95bb133771e,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_a95bb133771e,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_a95bb133771e,
    'EntityIDFieldName', p_EntityIDFieldName_a95bb133771e,
    'ScopeDefault', p_ScopeDefault_a95bb133771e,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_a95bb133771e,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_a95bb133771e,
    'Status', p_Status_a95bb133771e,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_a95bb133771e,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_a95bb133771e,
    'AutoUpdateCategory', p_AutoUpdateCategory_a95bb133771e,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_a95bb133771e,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_a95bb133771e,
    'Encrypt', p_Encrypt_a95bb133771e,
    'EncryptionKeyID', p_EncryptionKeyID_a95bb133771e,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_a95bb133771e,
    'SendEncryptedValue', p_SendEncryptedValue_a95bb133771e,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_a95bb133771e,
    'IsSoftForeignKey', p_IsSoftForeignKey_a95bb133771e,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_a95bb133771e,
    'JSONType', p_JSONType_a95bb133771e,
    'JSONTypeIsArray', p_JSONTypeIsArray_a95bb133771e,
    'JSONTypeDefinition', p_JSONTypeDefinition_a95bb133771e,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_a95bb133771e,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_a95bb133771e,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_a95bb133771e,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_a95bb133771e,
    'IsComputed', p_IsComputed_a95bb133771e
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_a95bb133771e,
    'Configuration', p_Configuration_a95bb133771e,
    'ID', p_ID_a95bb133771e
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_a95bb133771e, p_Description := p_Description_a95bb133771e, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_a95bb133771e, p_IsPrimaryKey := p_IsPrimaryKey_a95bb133771e, p_IsUnique := p_IsUnique_a95bb133771e, p_Category := p_Category_a95bb133771e, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_a95bb133771e, p_ExtendedType := p_ExtendedType_a95bb133771e, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_a95bb133771e, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_a95bb133771e, p_ViewCellTemplate := p_ViewCellTemplate_a95bb133771e, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_a95bb133771e, p_AllowUpdateAPI := p_AllowUpdateAPI_a95bb133771e, p_AllowUpdateInView := p_AllowUpdateInView_a95bb133771e, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_a95bb133771e, p_FullTextSearchEnabled := p_FullTextSearchEnabled_a95bb133771e, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_a95bb133771e, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_a95bb133771e, p_GeneratedFormSection := p_GeneratedFormSection_a95bb133771e, p_IsNameField := p_IsNameField_a95bb133771e, p_RelatedEntityID := p_RelatedEntityID_a95bb133771e, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_a95bb133771e, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_a95bb133771e, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_a95bb133771e, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_a95bb133771e, p_EntityIDFieldName := p_EntityIDFieldName_a95bb133771e, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_a95bb133771e, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_a95bb133771e, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_a95bb133771e, p_Status := p_Status_a95bb133771e, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_a95bb133771e, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_a95bb133771e, p_AutoUpdateCategory := p_AutoUpdateCategory_a95bb133771e, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_a95bb133771e, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_a95bb133771e, p_Encrypt := p_Encrypt_a95bb133771e, p_EncryptionKeyID := p_EncryptionKeyID_a95bb133771e, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_a95bb133771e, p_SendEncryptedValue := p_SendEncryptedValue_a95bb133771e, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_a95bb133771e, p_IsSoftForeignKey := p_IsSoftForeignKey_a95bb133771e, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_a95bb133771e, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_a95bb133771e, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_a95bb133771e, p_JSONTypeDefinition := p_JSONTypeDefinition_a95bb133771e, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_a95bb133771e, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_a95bb133771e, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_a95bb133771e, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_a95bb133771e, p_IsComputed := p_IsComputed_a95bb133771e, p_EmbeddedRecord := p_EmbeddedRecord_a95bb133771e, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_a95bb133771e, p_Configuration_Clear := TRUE, p_ID := p_ID_a95bb133771e);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_492cce800793 VARCHAR(255);
  p_Description_492cce800793 TEXT;
  p_AutoUpdateDescription_492cce800793 BOOLEAN;
  p_IsPrimaryKey_492cce800793 BOOLEAN;
  p_IsUnique_492cce800793 BOOLEAN;
  p_Category_492cce800793 VARCHAR(255);
  p_ValueListType_492cce800793 VARCHAR(20);
  p_ExtendedType_492cce800793 VARCHAR(50);
  p_CodeType_492cce800793 VARCHAR(50);
  p_DefaultInView_492cce800793 BOOLEAN;
  p_ViewCellTemplate_492cce800793 TEXT;
  p_DefaultColumnWidth_492cce800793 INTEGER;
  p_AllowUpdateAPI_492cce800793 BOOLEAN;
  p_AllowUpdateInView_492cce800793 BOOLEAN;
  p_IncludeInUserSearchAPI_492cce800793 BOOLEAN;
  p_FullTextSearchEnabled_492cce800793 BOOLEAN;
  p_UserSearchParamFormatAPI_492cce800793 VARCHAR(500);
  p_IncludeInGeneratedForm_492cce800793 BOOLEAN;
  p_GeneratedFormSection_492cce800793 VARCHAR(10);
  p_IsNameField_492cce800793 BOOLEAN;
  p_RelatedEntityID_492cce800793 UUID;
  p_RelatedEntityFieldName_492cce800793 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_492cce800793 BOOLEAN;
  p_RelatedEntityNameFieldMap_492cce800793 VARCHAR(255);
  p_RelatedEntityDisplayType_492cce800793 VARCHAR(20);
  p_EntityIDFieldName_492cce800793 VARCHAR(100);
  p_ScopeDefault_492cce800793 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_492cce800793 BOOLEAN;
  p_ValuesToPackWithSchema_492cce800793 VARCHAR(10);
  p_Status_492cce800793 VARCHAR(25);
  p_AutoUpdateIsNameField_492cce800793 BOOLEAN;
  p_AutoUpdateDefaultInView_492cce800793 BOOLEAN;
  p_AutoUpdateCategory_492cce800793 BOOLEAN;
  p_AutoUpdateDisplayName_492cce800793 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_492cce800793 BOOLEAN;
  p_Encrypt_492cce800793 BOOLEAN;
  p_EncryptionKeyID_492cce800793 UUID;
  p_AllowDecryptInAPI_492cce800793 BOOLEAN;
  p_SendEncryptedValue_492cce800793 BOOLEAN;
  p_IsSoftPrimaryKey_492cce800793 BOOLEAN;
  p_IsSoftForeignKey_492cce800793 BOOLEAN;
  p_RelatedEntityJoinFields_492cce800793 TEXT;
  p_JSONType_492cce800793 VARCHAR(255);
  p_JSONTypeIsArray_492cce800793 BOOLEAN;
  p_JSONTypeDefinition_492cce800793 TEXT;
  p_UserSearchPredicateAPI_492cce800793 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_492cce800793 BOOLEAN;
  p_AutoUpdateFullTextSearch_492cce800793 BOOLEAN;
  p_AutoUpdateExtendedType_492cce800793 BOOLEAN;
  p_IsComputed_492cce800793 BOOLEAN;
  p_EmbeddedRecord_492cce800793 TEXT;
  p_Configuration_492cce800793 TEXT;
  p_ID_492cce800793 UUID;
BEGIN
  p_DisplayName_492cce800793 := 'Forecast Category';
  p_AutoUpdateDescription_492cce800793 := TRUE;
  p_IsPrimaryKey_492cce800793 := FALSE;
  p_IsUnique_492cce800793 := FALSE;
  p_ValueListType_492cce800793 := 'None';
  p_DefaultInView_492cce800793 := TRUE;
  p_DefaultColumnWidth_492cce800793 := 150;
  p_AllowUpdateAPI_492cce800793 := FALSE;
  p_AllowUpdateInView_492cce800793 := TRUE;
  p_IncludeInUserSearchAPI_492cce800793 := FALSE;
  p_FullTextSearchEnabled_492cce800793 := FALSE;
  p_IncludeInGeneratedForm_492cce800793 := TRUE;
  p_GeneratedFormSection_492cce800793 := 'Details';
  p_IsNameField_492cce800793 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_492cce800793 := FALSE;
  p_RelatedEntityDisplayType_492cce800793 := 'Search';
  p_AutoUpdateRelatedEntityInfo_492cce800793 := TRUE;
  p_ValuesToPackWithSchema_492cce800793 := 'Auto';
  p_Status_492cce800793 := 'Active';
  p_AutoUpdateIsNameField_492cce800793 := TRUE;
  p_AutoUpdateDefaultInView_492cce800793 := TRUE;
  p_AutoUpdateCategory_492cce800793 := TRUE;
  p_AutoUpdateDisplayName_492cce800793 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_492cce800793 := TRUE;
  p_Encrypt_492cce800793 := FALSE;
  p_AllowDecryptInAPI_492cce800793 := FALSE;
  p_SendEncryptedValue_492cce800793 := FALSE;
  p_IsSoftPrimaryKey_492cce800793 := FALSE;
  p_IsSoftForeignKey_492cce800793 := FALSE;
  p_JSONTypeIsArray_492cce800793 := FALSE;
  p_UserSearchPredicateAPI_492cce800793 := 'Contains';
  p_AutoUpdateUserSearchPredicate_492cce800793 := TRUE;
  p_AutoUpdateFullTextSearch_492cce800793 := TRUE;
  p_AutoUpdateExtendedType_492cce800793 := TRUE;
  p_IsComputed_492cce800793 := FALSE;
  p_ID_492cce800793 := '646E4D6C-2A09-49E4-BBF5-E18A4D944DD2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_492cce800793,
    'Description', p_Description_492cce800793,
    'AutoUpdateDescription', p_AutoUpdateDescription_492cce800793,
    'IsPrimaryKey', p_IsPrimaryKey_492cce800793,
    'IsUnique', p_IsUnique_492cce800793,
    'Category', p_Category_492cce800793,
    'ValueListType', p_ValueListType_492cce800793,
    'ExtendedType', p_ExtendedType_492cce800793,
    'CodeType', p_CodeType_492cce800793,
    'DefaultInView', p_DefaultInView_492cce800793,
    'ViewCellTemplate', p_ViewCellTemplate_492cce800793,
    'DefaultColumnWidth', p_DefaultColumnWidth_492cce800793,
    'AllowUpdateAPI', p_AllowUpdateAPI_492cce800793,
    'AllowUpdateInView', p_AllowUpdateInView_492cce800793,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_492cce800793,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_492cce800793,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_492cce800793,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_492cce800793,
    'GeneratedFormSection', p_GeneratedFormSection_492cce800793,
    'IsNameField', p_IsNameField_492cce800793,
    'RelatedEntityID', p_RelatedEntityID_492cce800793,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_492cce800793,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_492cce800793,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_492cce800793,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_492cce800793,
    'EntityIDFieldName', p_EntityIDFieldName_492cce800793,
    'ScopeDefault', p_ScopeDefault_492cce800793,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_492cce800793,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_492cce800793,
    'Status', p_Status_492cce800793,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_492cce800793,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_492cce800793,
    'AutoUpdateCategory', p_AutoUpdateCategory_492cce800793,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_492cce800793,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_492cce800793,
    'Encrypt', p_Encrypt_492cce800793,
    'EncryptionKeyID', p_EncryptionKeyID_492cce800793,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_492cce800793,
    'SendEncryptedValue', p_SendEncryptedValue_492cce800793,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_492cce800793,
    'IsSoftForeignKey', p_IsSoftForeignKey_492cce800793,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_492cce800793,
    'JSONType', p_JSONType_492cce800793,
    'JSONTypeIsArray', p_JSONTypeIsArray_492cce800793,
    'JSONTypeDefinition', p_JSONTypeDefinition_492cce800793,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_492cce800793,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_492cce800793,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_492cce800793,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_492cce800793,
    'IsComputed', p_IsComputed_492cce800793
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_492cce800793,
    'Configuration', p_Configuration_492cce800793,
    'ID', p_ID_492cce800793
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_492cce800793, p_Description := p_Description_492cce800793, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_492cce800793, p_IsPrimaryKey := p_IsPrimaryKey_492cce800793, p_IsUnique := p_IsUnique_492cce800793, p_Category := p_Category_492cce800793, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_492cce800793, p_ExtendedType := p_ExtendedType_492cce800793, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_492cce800793, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_492cce800793, p_ViewCellTemplate := p_ViewCellTemplate_492cce800793, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_492cce800793, p_AllowUpdateAPI := p_AllowUpdateAPI_492cce800793, p_AllowUpdateInView := p_AllowUpdateInView_492cce800793, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_492cce800793, p_FullTextSearchEnabled := p_FullTextSearchEnabled_492cce800793, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_492cce800793, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_492cce800793, p_GeneratedFormSection := p_GeneratedFormSection_492cce800793, p_IsNameField := p_IsNameField_492cce800793, p_RelatedEntityID := p_RelatedEntityID_492cce800793, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_492cce800793, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_492cce800793, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_492cce800793, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_492cce800793, p_EntityIDFieldName := p_EntityIDFieldName_492cce800793, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_492cce800793, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_492cce800793, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_492cce800793, p_Status := p_Status_492cce800793, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_492cce800793, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_492cce800793, p_AutoUpdateCategory := p_AutoUpdateCategory_492cce800793, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_492cce800793, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_492cce800793, p_Encrypt := p_Encrypt_492cce800793, p_EncryptionKeyID := p_EncryptionKeyID_492cce800793, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_492cce800793, p_SendEncryptedValue := p_SendEncryptedValue_492cce800793, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_492cce800793, p_IsSoftForeignKey := p_IsSoftForeignKey_492cce800793, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_492cce800793, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_492cce800793, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_492cce800793, p_JSONTypeDefinition := p_JSONTypeDefinition_492cce800793, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_492cce800793, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_492cce800793, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_492cce800793, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_492cce800793, p_IsComputed := p_IsComputed_492cce800793, p_EmbeddedRecord := p_EmbeddedRecord_492cce800793, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_492cce800793, p_Configuration_Clear := TRUE, p_ID := p_ID_492cce800793);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7a7e86c2ca0b VARCHAR(255);
  p_Description_7a7e86c2ca0b TEXT;
  p_AutoUpdateDescription_7a7e86c2ca0b BOOLEAN;
  p_IsPrimaryKey_7a7e86c2ca0b BOOLEAN;
  p_IsUnique_7a7e86c2ca0b BOOLEAN;
  p_Category_7a7e86c2ca0b VARCHAR(255);
  p_ValueListType_7a7e86c2ca0b VARCHAR(20);
  p_ExtendedType_7a7e86c2ca0b VARCHAR(50);
  p_CodeType_7a7e86c2ca0b VARCHAR(50);
  p_DefaultInView_7a7e86c2ca0b BOOLEAN;
  p_ViewCellTemplate_7a7e86c2ca0b TEXT;
  p_DefaultColumnWidth_7a7e86c2ca0b INTEGER;
  p_AllowUpdateAPI_7a7e86c2ca0b BOOLEAN;
  p_AllowUpdateInView_7a7e86c2ca0b BOOLEAN;
  p_IncludeInUserSearchAPI_7a7e86c2ca0b BOOLEAN;
  p_FullTextSearchEnabled_7a7e86c2ca0b BOOLEAN;
  p_UserSearchParamFormatAPI_7a7e86c2ca0b VARCHAR(500);
  p_IncludeInGeneratedForm_7a7e86c2ca0b BOOLEAN;
  p_GeneratedFormSection_7a7e86c2ca0b VARCHAR(10);
  p_IsNameField_7a7e86c2ca0b BOOLEAN;
  p_RelatedEntityID_7a7e86c2ca0b UUID;
  p_RelatedEntityFieldName_7a7e86c2ca0b VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7a7e86c2ca0b BOOLEAN;
  p_RelatedEntityNameFieldMap_7a7e86c2ca0b VARCHAR(255);
  p_RelatedEntityDisplayType_7a7e86c2ca0b VARCHAR(20);
  p_EntityIDFieldName_7a7e86c2ca0b VARCHAR(100);
  p_ScopeDefault_7a7e86c2ca0b VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7a7e86c2ca0b BOOLEAN;
  p_ValuesToPackWithSchema_7a7e86c2ca0b VARCHAR(10);
  p_Status_7a7e86c2ca0b VARCHAR(25);
  p_AutoUpdateIsNameField_7a7e86c2ca0b BOOLEAN;
  p_AutoUpdateDefaultInView_7a7e86c2ca0b BOOLEAN;
  p_AutoUpdateCategory_7a7e86c2ca0b BOOLEAN;
  p_AutoUpdateDisplayName_7a7e86c2ca0b BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7a7e86c2ca0b BOOLEAN;
  p_Encrypt_7a7e86c2ca0b BOOLEAN;
  p_EncryptionKeyID_7a7e86c2ca0b UUID;
  p_AllowDecryptInAPI_7a7e86c2ca0b BOOLEAN;
  p_SendEncryptedValue_7a7e86c2ca0b BOOLEAN;
  p_IsSoftPrimaryKey_7a7e86c2ca0b BOOLEAN;
  p_IsSoftForeignKey_7a7e86c2ca0b BOOLEAN;
  p_RelatedEntityJoinFields_7a7e86c2ca0b TEXT;
  p_JSONType_7a7e86c2ca0b VARCHAR(255);
  p_JSONTypeIsArray_7a7e86c2ca0b BOOLEAN;
  p_JSONTypeDefinition_7a7e86c2ca0b TEXT;
  p_UserSearchPredicateAPI_7a7e86c2ca0b VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7a7e86c2ca0b BOOLEAN;
  p_AutoUpdateFullTextSearch_7a7e86c2ca0b BOOLEAN;
  p_AutoUpdateExtendedType_7a7e86c2ca0b BOOLEAN;
  p_IsComputed_7a7e86c2ca0b BOOLEAN;
  p_EmbeddedRecord_7a7e86c2ca0b TEXT;
  p_Configuration_7a7e86c2ca0b TEXT;
  p_ID_7a7e86c2ca0b UUID;
BEGIN
  p_DisplayName_7a7e86c2ca0b := 'Primary Contact';
  p_AutoUpdateDescription_7a7e86c2ca0b := TRUE;
  p_IsPrimaryKey_7a7e86c2ca0b := FALSE;
  p_IsUnique_7a7e86c2ca0b := FALSE;
  p_ValueListType_7a7e86c2ca0b := 'None';
  p_DefaultInView_7a7e86c2ca0b := FALSE;
  p_DefaultColumnWidth_7a7e86c2ca0b := 150;
  p_AllowUpdateAPI_7a7e86c2ca0b := TRUE;
  p_AllowUpdateInView_7a7e86c2ca0b := TRUE;
  p_IncludeInUserSearchAPI_7a7e86c2ca0b := FALSE;
  p_FullTextSearchEnabled_7a7e86c2ca0b := FALSE;
  p_IncludeInGeneratedForm_7a7e86c2ca0b := TRUE;
  p_GeneratedFormSection_7a7e86c2ca0b := 'Details';
  p_IsNameField_7a7e86c2ca0b := FALSE;
  p_RelatedEntityID_7a7e86c2ca0b := '530174B2-654E-4E14-BF28-3EF29AC9833D';
  p_RelatedEntityFieldName_7a7e86c2ca0b := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_7a7e86c2ca0b := TRUE;
  p_RelatedEntityDisplayType_7a7e86c2ca0b := 'Search';
  p_AutoUpdateRelatedEntityInfo_7a7e86c2ca0b := TRUE;
  p_ValuesToPackWithSchema_7a7e86c2ca0b := 'Auto';
  p_Status_7a7e86c2ca0b := 'Active';
  p_AutoUpdateIsNameField_7a7e86c2ca0b := TRUE;
  p_AutoUpdateDefaultInView_7a7e86c2ca0b := TRUE;
  p_AutoUpdateCategory_7a7e86c2ca0b := TRUE;
  p_AutoUpdateDisplayName_7a7e86c2ca0b := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_7a7e86c2ca0b := TRUE;
  p_Encrypt_7a7e86c2ca0b := FALSE;
  p_AllowDecryptInAPI_7a7e86c2ca0b := FALSE;
  p_SendEncryptedValue_7a7e86c2ca0b := FALSE;
  p_IsSoftPrimaryKey_7a7e86c2ca0b := FALSE;
  p_IsSoftForeignKey_7a7e86c2ca0b := FALSE;
  p_JSONTypeIsArray_7a7e86c2ca0b := FALSE;
  p_UserSearchPredicateAPI_7a7e86c2ca0b := 'Contains';
  p_AutoUpdateUserSearchPredicate_7a7e86c2ca0b := TRUE;
  p_AutoUpdateFullTextSearch_7a7e86c2ca0b := TRUE;
  p_AutoUpdateExtendedType_7a7e86c2ca0b := TRUE;
  p_IsComputed_7a7e86c2ca0b := FALSE;
  p_ID_7a7e86c2ca0b := '15EE2878-83D2-4D3F-8010-E53132678BBC';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7a7e86c2ca0b,
    'Description', p_Description_7a7e86c2ca0b,
    'AutoUpdateDescription', p_AutoUpdateDescription_7a7e86c2ca0b,
    'IsPrimaryKey', p_IsPrimaryKey_7a7e86c2ca0b,
    'IsUnique', p_IsUnique_7a7e86c2ca0b,
    'Category', p_Category_7a7e86c2ca0b,
    'ValueListType', p_ValueListType_7a7e86c2ca0b,
    'ExtendedType', p_ExtendedType_7a7e86c2ca0b,
    'CodeType', p_CodeType_7a7e86c2ca0b,
    'DefaultInView', p_DefaultInView_7a7e86c2ca0b,
    'ViewCellTemplate', p_ViewCellTemplate_7a7e86c2ca0b,
    'DefaultColumnWidth', p_DefaultColumnWidth_7a7e86c2ca0b,
    'AllowUpdateAPI', p_AllowUpdateAPI_7a7e86c2ca0b,
    'AllowUpdateInView', p_AllowUpdateInView_7a7e86c2ca0b,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7a7e86c2ca0b,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7a7e86c2ca0b,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7a7e86c2ca0b,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7a7e86c2ca0b,
    'GeneratedFormSection', p_GeneratedFormSection_7a7e86c2ca0b,
    'IsNameField', p_IsNameField_7a7e86c2ca0b,
    'RelatedEntityID', p_RelatedEntityID_7a7e86c2ca0b,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7a7e86c2ca0b,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7a7e86c2ca0b,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7a7e86c2ca0b,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7a7e86c2ca0b,
    'EntityIDFieldName', p_EntityIDFieldName_7a7e86c2ca0b,
    'ScopeDefault', p_ScopeDefault_7a7e86c2ca0b,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7a7e86c2ca0b,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7a7e86c2ca0b,
    'Status', p_Status_7a7e86c2ca0b,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7a7e86c2ca0b,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7a7e86c2ca0b,
    'AutoUpdateCategory', p_AutoUpdateCategory_7a7e86c2ca0b,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7a7e86c2ca0b,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7a7e86c2ca0b,
    'Encrypt', p_Encrypt_7a7e86c2ca0b,
    'EncryptionKeyID', p_EncryptionKeyID_7a7e86c2ca0b,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7a7e86c2ca0b,
    'SendEncryptedValue', p_SendEncryptedValue_7a7e86c2ca0b,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7a7e86c2ca0b,
    'IsSoftForeignKey', p_IsSoftForeignKey_7a7e86c2ca0b,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7a7e86c2ca0b,
    'JSONType', p_JSONType_7a7e86c2ca0b,
    'JSONTypeIsArray', p_JSONTypeIsArray_7a7e86c2ca0b,
    'JSONTypeDefinition', p_JSONTypeDefinition_7a7e86c2ca0b,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7a7e86c2ca0b,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7a7e86c2ca0b,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7a7e86c2ca0b,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7a7e86c2ca0b,
    'IsComputed', p_IsComputed_7a7e86c2ca0b
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7a7e86c2ca0b,
    'Configuration', p_Configuration_7a7e86c2ca0b,
    'ID', p_ID_7a7e86c2ca0b
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_7a7e86c2ca0b, p_Description := p_Description_7a7e86c2ca0b, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_7a7e86c2ca0b, p_IsPrimaryKey := p_IsPrimaryKey_7a7e86c2ca0b, p_IsUnique := p_IsUnique_7a7e86c2ca0b, p_Category := p_Category_7a7e86c2ca0b, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_7a7e86c2ca0b, p_ExtendedType := p_ExtendedType_7a7e86c2ca0b, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7a7e86c2ca0b, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7a7e86c2ca0b, p_ViewCellTemplate := p_ViewCellTemplate_7a7e86c2ca0b, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7a7e86c2ca0b, p_AllowUpdateAPI := p_AllowUpdateAPI_7a7e86c2ca0b, p_AllowUpdateInView := p_AllowUpdateInView_7a7e86c2ca0b, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7a7e86c2ca0b, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7a7e86c2ca0b, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7a7e86c2ca0b, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7a7e86c2ca0b, p_GeneratedFormSection := p_GeneratedFormSection_7a7e86c2ca0b, p_IsNameField := p_IsNameField_7a7e86c2ca0b, p_RelatedEntityID := p_RelatedEntityID_7a7e86c2ca0b, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7a7e86c2ca0b, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7a7e86c2ca0b, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7a7e86c2ca0b, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7a7e86c2ca0b, p_EntityIDFieldName := p_EntityIDFieldName_7a7e86c2ca0b, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7a7e86c2ca0b, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7a7e86c2ca0b, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7a7e86c2ca0b, p_Status := p_Status_7a7e86c2ca0b, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7a7e86c2ca0b, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7a7e86c2ca0b, p_AutoUpdateCategory := p_AutoUpdateCategory_7a7e86c2ca0b, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7a7e86c2ca0b, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7a7e86c2ca0b, p_Encrypt := p_Encrypt_7a7e86c2ca0b, p_EncryptionKeyID := p_EncryptionKeyID_7a7e86c2ca0b, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7a7e86c2ca0b, p_SendEncryptedValue := p_SendEncryptedValue_7a7e86c2ca0b, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7a7e86c2ca0b, p_IsSoftForeignKey := p_IsSoftForeignKey_7a7e86c2ca0b, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7a7e86c2ca0b, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7a7e86c2ca0b, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7a7e86c2ca0b, p_JSONTypeDefinition := p_JSONTypeDefinition_7a7e86c2ca0b, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7a7e86c2ca0b, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7a7e86c2ca0b, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7a7e86c2ca0b, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7a7e86c2ca0b, p_IsComputed := p_IsComputed_7a7e86c2ca0b, p_EmbeddedRecord := p_EmbeddedRecord_7a7e86c2ca0b, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7a7e86c2ca0b, p_Configuration_Clear := TRUE, p_ID := p_ID_7a7e86c2ca0b);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_853ffe9adb56 VARCHAR(255);
  p_Description_853ffe9adb56 TEXT;
  p_AutoUpdateDescription_853ffe9adb56 BOOLEAN;
  p_IsPrimaryKey_853ffe9adb56 BOOLEAN;
  p_IsUnique_853ffe9adb56 BOOLEAN;
  p_Category_853ffe9adb56 VARCHAR(255);
  p_ValueListType_853ffe9adb56 VARCHAR(20);
  p_ExtendedType_853ffe9adb56 VARCHAR(50);
  p_CodeType_853ffe9adb56 VARCHAR(50);
  p_DefaultInView_853ffe9adb56 BOOLEAN;
  p_ViewCellTemplate_853ffe9adb56 TEXT;
  p_DefaultColumnWidth_853ffe9adb56 INTEGER;
  p_AllowUpdateAPI_853ffe9adb56 BOOLEAN;
  p_AllowUpdateInView_853ffe9adb56 BOOLEAN;
  p_IncludeInUserSearchAPI_853ffe9adb56 BOOLEAN;
  p_FullTextSearchEnabled_853ffe9adb56 BOOLEAN;
  p_UserSearchParamFormatAPI_853ffe9adb56 VARCHAR(500);
  p_IncludeInGeneratedForm_853ffe9adb56 BOOLEAN;
  p_GeneratedFormSection_853ffe9adb56 VARCHAR(10);
  p_IsNameField_853ffe9adb56 BOOLEAN;
  p_RelatedEntityID_853ffe9adb56 UUID;
  p_RelatedEntityFieldName_853ffe9adb56 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_853ffe9adb56 BOOLEAN;
  p_RelatedEntityNameFieldMap_853ffe9adb56 VARCHAR(255);
  p_RelatedEntityDisplayType_853ffe9adb56 VARCHAR(20);
  p_EntityIDFieldName_853ffe9adb56 VARCHAR(100);
  p_ScopeDefault_853ffe9adb56 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_853ffe9adb56 BOOLEAN;
  p_ValuesToPackWithSchema_853ffe9adb56 VARCHAR(10);
  p_Status_853ffe9adb56 VARCHAR(25);
  p_AutoUpdateIsNameField_853ffe9adb56 BOOLEAN;
  p_AutoUpdateDefaultInView_853ffe9adb56 BOOLEAN;
  p_AutoUpdateCategory_853ffe9adb56 BOOLEAN;
  p_AutoUpdateDisplayName_853ffe9adb56 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_853ffe9adb56 BOOLEAN;
  p_Encrypt_853ffe9adb56 BOOLEAN;
  p_EncryptionKeyID_853ffe9adb56 UUID;
  p_AllowDecryptInAPI_853ffe9adb56 BOOLEAN;
  p_SendEncryptedValue_853ffe9adb56 BOOLEAN;
  p_IsSoftPrimaryKey_853ffe9adb56 BOOLEAN;
  p_IsSoftForeignKey_853ffe9adb56 BOOLEAN;
  p_RelatedEntityJoinFields_853ffe9adb56 TEXT;
  p_JSONType_853ffe9adb56 VARCHAR(255);
  p_JSONTypeIsArray_853ffe9adb56 BOOLEAN;
  p_JSONTypeDefinition_853ffe9adb56 TEXT;
  p_UserSearchPredicateAPI_853ffe9adb56 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_853ffe9adb56 BOOLEAN;
  p_AutoUpdateFullTextSearch_853ffe9adb56 BOOLEAN;
  p_AutoUpdateExtendedType_853ffe9adb56 BOOLEAN;
  p_IsComputed_853ffe9adb56 BOOLEAN;
  p_EmbeddedRecord_853ffe9adb56 TEXT;
  p_Configuration_853ffe9adb56 TEXT;
  p_ID_853ffe9adb56 UUID;
BEGIN
  p_DisplayName_853ffe9adb56 := 'Billing Contact';
  p_Description_853ffe9adb56 := 'The contact who receives the invoice, which is routinely NOT the person negotiating. NULL means the billing contact IS the primary contact — a real default, not "unknown" — so an AD never types the same name twice and changing the primary contact leaves no stale billing copy.';
  p_AutoUpdateDescription_853ffe9adb56 := TRUE;
  p_IsPrimaryKey_853ffe9adb56 := FALSE;
  p_IsUnique_853ffe9adb56 := FALSE;
  p_ValueListType_853ffe9adb56 := 'None';
  p_DefaultInView_853ffe9adb56 := FALSE;
  p_DefaultColumnWidth_853ffe9adb56 := 150;
  p_AllowUpdateAPI_853ffe9adb56 := TRUE;
  p_AllowUpdateInView_853ffe9adb56 := TRUE;
  p_IncludeInUserSearchAPI_853ffe9adb56 := FALSE;
  p_FullTextSearchEnabled_853ffe9adb56 := FALSE;
  p_IncludeInGeneratedForm_853ffe9adb56 := TRUE;
  p_GeneratedFormSection_853ffe9adb56 := 'Details';
  p_IsNameField_853ffe9adb56 := FALSE;
  p_RelatedEntityID_853ffe9adb56 := '530174B2-654E-4E14-BF28-3EF29AC9833D';
  p_RelatedEntityFieldName_853ffe9adb56 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_853ffe9adb56 := TRUE;
  p_RelatedEntityDisplayType_853ffe9adb56 := 'Search';
  p_AutoUpdateRelatedEntityInfo_853ffe9adb56 := TRUE;
  p_ValuesToPackWithSchema_853ffe9adb56 := 'Auto';
  p_Status_853ffe9adb56 := 'Active';
  p_AutoUpdateIsNameField_853ffe9adb56 := TRUE;
  p_AutoUpdateDefaultInView_853ffe9adb56 := TRUE;
  p_AutoUpdateCategory_853ffe9adb56 := TRUE;
  p_AutoUpdateDisplayName_853ffe9adb56 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_853ffe9adb56 := TRUE;
  p_Encrypt_853ffe9adb56 := FALSE;
  p_AllowDecryptInAPI_853ffe9adb56 := FALSE;
  p_SendEncryptedValue_853ffe9adb56 := FALSE;
  p_IsSoftPrimaryKey_853ffe9adb56 := FALSE;
  p_IsSoftForeignKey_853ffe9adb56 := FALSE;
  p_JSONTypeIsArray_853ffe9adb56 := FALSE;
  p_UserSearchPredicateAPI_853ffe9adb56 := 'Contains';
  p_AutoUpdateUserSearchPredicate_853ffe9adb56 := TRUE;
  p_AutoUpdateFullTextSearch_853ffe9adb56 := TRUE;
  p_AutoUpdateExtendedType_853ffe9adb56 := TRUE;
  p_IsComputed_853ffe9adb56 := FALSE;
  p_ID_853ffe9adb56 := '95BFECF9-D5DF-415D-955C-890F48086E91';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_853ffe9adb56,
    'Description', p_Description_853ffe9adb56,
    'AutoUpdateDescription', p_AutoUpdateDescription_853ffe9adb56,
    'IsPrimaryKey', p_IsPrimaryKey_853ffe9adb56,
    'IsUnique', p_IsUnique_853ffe9adb56,
    'Category', p_Category_853ffe9adb56,
    'ValueListType', p_ValueListType_853ffe9adb56,
    'ExtendedType', p_ExtendedType_853ffe9adb56,
    'CodeType', p_CodeType_853ffe9adb56,
    'DefaultInView', p_DefaultInView_853ffe9adb56,
    'ViewCellTemplate', p_ViewCellTemplate_853ffe9adb56,
    'DefaultColumnWidth', p_DefaultColumnWidth_853ffe9adb56,
    'AllowUpdateAPI', p_AllowUpdateAPI_853ffe9adb56,
    'AllowUpdateInView', p_AllowUpdateInView_853ffe9adb56,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_853ffe9adb56,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_853ffe9adb56,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_853ffe9adb56,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_853ffe9adb56,
    'GeneratedFormSection', p_GeneratedFormSection_853ffe9adb56,
    'IsNameField', p_IsNameField_853ffe9adb56,
    'RelatedEntityID', p_RelatedEntityID_853ffe9adb56,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_853ffe9adb56,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_853ffe9adb56,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_853ffe9adb56,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_853ffe9adb56,
    'EntityIDFieldName', p_EntityIDFieldName_853ffe9adb56,
    'ScopeDefault', p_ScopeDefault_853ffe9adb56,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_853ffe9adb56,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_853ffe9adb56,
    'Status', p_Status_853ffe9adb56,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_853ffe9adb56,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_853ffe9adb56,
    'AutoUpdateCategory', p_AutoUpdateCategory_853ffe9adb56,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_853ffe9adb56,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_853ffe9adb56,
    'Encrypt', p_Encrypt_853ffe9adb56,
    'EncryptionKeyID', p_EncryptionKeyID_853ffe9adb56,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_853ffe9adb56,
    'SendEncryptedValue', p_SendEncryptedValue_853ffe9adb56,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_853ffe9adb56,
    'IsSoftForeignKey', p_IsSoftForeignKey_853ffe9adb56,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_853ffe9adb56,
    'JSONType', p_JSONType_853ffe9adb56,
    'JSONTypeIsArray', p_JSONTypeIsArray_853ffe9adb56,
    'JSONTypeDefinition', p_JSONTypeDefinition_853ffe9adb56,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_853ffe9adb56,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_853ffe9adb56,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_853ffe9adb56,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_853ffe9adb56,
    'IsComputed', p_IsComputed_853ffe9adb56
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_853ffe9adb56,
    'Configuration', p_Configuration_853ffe9adb56,
    'ID', p_ID_853ffe9adb56
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_853ffe9adb56, p_Description := p_Description_853ffe9adb56, p_AutoUpdateDescription := p_AutoUpdateDescription_853ffe9adb56, p_IsPrimaryKey := p_IsPrimaryKey_853ffe9adb56, p_IsUnique := p_IsUnique_853ffe9adb56, p_Category := p_Category_853ffe9adb56, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_853ffe9adb56, p_ExtendedType := p_ExtendedType_853ffe9adb56, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_853ffe9adb56, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_853ffe9adb56, p_ViewCellTemplate := p_ViewCellTemplate_853ffe9adb56, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_853ffe9adb56, p_AllowUpdateAPI := p_AllowUpdateAPI_853ffe9adb56, p_AllowUpdateInView := p_AllowUpdateInView_853ffe9adb56, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_853ffe9adb56, p_FullTextSearchEnabled := p_FullTextSearchEnabled_853ffe9adb56, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_853ffe9adb56, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_853ffe9adb56, p_GeneratedFormSection := p_GeneratedFormSection_853ffe9adb56, p_IsNameField := p_IsNameField_853ffe9adb56, p_RelatedEntityID := p_RelatedEntityID_853ffe9adb56, p_RelatedEntityFieldName := p_RelatedEntityFieldName_853ffe9adb56, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_853ffe9adb56, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_853ffe9adb56, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_853ffe9adb56, p_EntityIDFieldName := p_EntityIDFieldName_853ffe9adb56, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_853ffe9adb56, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_853ffe9adb56, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_853ffe9adb56, p_Status := p_Status_853ffe9adb56, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_853ffe9adb56, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_853ffe9adb56, p_AutoUpdateCategory := p_AutoUpdateCategory_853ffe9adb56, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_853ffe9adb56, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_853ffe9adb56, p_Encrypt := p_Encrypt_853ffe9adb56, p_EncryptionKeyID := p_EncryptionKeyID_853ffe9adb56, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_853ffe9adb56, p_SendEncryptedValue := p_SendEncryptedValue_853ffe9adb56, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_853ffe9adb56, p_IsSoftForeignKey := p_IsSoftForeignKey_853ffe9adb56, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_853ffe9adb56, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_853ffe9adb56, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_853ffe9adb56, p_JSONTypeDefinition := p_JSONTypeDefinition_853ffe9adb56, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_853ffe9adb56, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_853ffe9adb56, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_853ffe9adb56, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_853ffe9adb56, p_IsComputed := p_IsComputed_853ffe9adb56, p_EmbeddedRecord := p_EmbeddedRecord_853ffe9adb56, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_853ffe9adb56, p_Configuration_Clear := TRUE, p_ID := p_ID_853ffe9adb56);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_a8af17a4e961 VARCHAR(255);
  p_Description_a8af17a4e961 TEXT;
  p_AutoUpdateDescription_a8af17a4e961 BOOLEAN;
  p_IsPrimaryKey_a8af17a4e961 BOOLEAN;
  p_IsUnique_a8af17a4e961 BOOLEAN;
  p_Category_a8af17a4e961 VARCHAR(255);
  p_ValueListType_a8af17a4e961 VARCHAR(20);
  p_ExtendedType_a8af17a4e961 VARCHAR(50);
  p_CodeType_a8af17a4e961 VARCHAR(50);
  p_DefaultInView_a8af17a4e961 BOOLEAN;
  p_ViewCellTemplate_a8af17a4e961 TEXT;
  p_DefaultColumnWidth_a8af17a4e961 INTEGER;
  p_AllowUpdateAPI_a8af17a4e961 BOOLEAN;
  p_AllowUpdateInView_a8af17a4e961 BOOLEAN;
  p_IncludeInUserSearchAPI_a8af17a4e961 BOOLEAN;
  p_FullTextSearchEnabled_a8af17a4e961 BOOLEAN;
  p_UserSearchParamFormatAPI_a8af17a4e961 VARCHAR(500);
  p_IncludeInGeneratedForm_a8af17a4e961 BOOLEAN;
  p_GeneratedFormSection_a8af17a4e961 VARCHAR(10);
  p_IsNameField_a8af17a4e961 BOOLEAN;
  p_RelatedEntityID_a8af17a4e961 UUID;
  p_RelatedEntityFieldName_a8af17a4e961 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961 BOOLEAN;
  p_RelatedEntityNameFieldMap_a8af17a4e961 VARCHAR(255);
  p_RelatedEntityDisplayType_a8af17a4e961 VARCHAR(20);
  p_EntityIDFieldName_a8af17a4e961 VARCHAR(100);
  p_ScopeDefault_a8af17a4e961 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_a8af17a4e961 BOOLEAN;
  p_ValuesToPackWithSchema_a8af17a4e961 VARCHAR(10);
  p_Status_a8af17a4e961 VARCHAR(25);
  p_AutoUpdateIsNameField_a8af17a4e961 BOOLEAN;
  p_AutoUpdateDefaultInView_a8af17a4e961 BOOLEAN;
  p_AutoUpdateCategory_a8af17a4e961 BOOLEAN;
  p_AutoUpdateDisplayName_a8af17a4e961 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961 BOOLEAN;
  p_Encrypt_a8af17a4e961 BOOLEAN;
  p_EncryptionKeyID_a8af17a4e961 UUID;
  p_AllowDecryptInAPI_a8af17a4e961 BOOLEAN;
  p_SendEncryptedValue_a8af17a4e961 BOOLEAN;
  p_IsSoftPrimaryKey_a8af17a4e961 BOOLEAN;
  p_IsSoftForeignKey_a8af17a4e961 BOOLEAN;
  p_RelatedEntityJoinFields_a8af17a4e961 TEXT;
  p_JSONType_a8af17a4e961 VARCHAR(255);
  p_JSONTypeIsArray_a8af17a4e961 BOOLEAN;
  p_JSONTypeDefinition_a8af17a4e961 TEXT;
  p_UserSearchPredicateAPI_a8af17a4e961 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_a8af17a4e961 BOOLEAN;
  p_AutoUpdateFullTextSearch_a8af17a4e961 BOOLEAN;
  p_AutoUpdateExtendedType_a8af17a4e961 BOOLEAN;
  p_IsComputed_a8af17a4e961 BOOLEAN;
  p_EmbeddedRecord_a8af17a4e961 TEXT;
  p_Configuration_a8af17a4e961 TEXT;
  p_ID_a8af17a4e961 UUID;
BEGIN
  p_DisplayName_a8af17a4e961 := 'Currency';
  p_AutoUpdateDescription_a8af17a4e961 := TRUE;
  p_IsPrimaryKey_a8af17a4e961 := FALSE;
  p_IsUnique_a8af17a4e961 := FALSE;
  p_ValueListType_a8af17a4e961 := 'None';
  p_DefaultInView_a8af17a4e961 := FALSE;
  p_DefaultColumnWidth_a8af17a4e961 := 150;
  p_AllowUpdateAPI_a8af17a4e961 := TRUE;
  p_AllowUpdateInView_a8af17a4e961 := TRUE;
  p_IncludeInUserSearchAPI_a8af17a4e961 := FALSE;
  p_FullTextSearchEnabled_a8af17a4e961 := FALSE;
  p_IncludeInGeneratedForm_a8af17a4e961 := TRUE;
  p_GeneratedFormSection_a8af17a4e961 := 'Details';
  p_IsNameField_a8af17a4e961 := FALSE;
  p_RelatedEntityID_a8af17a4e961 := 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7';
  p_RelatedEntityFieldName_a8af17a4e961 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961 := FALSE;
  p_RelatedEntityDisplayType_a8af17a4e961 := 'Search';
  p_AutoUpdateRelatedEntityInfo_a8af17a4e961 := FALSE;
  p_ValuesToPackWithSchema_a8af17a4e961 := 'Auto';
  p_Status_a8af17a4e961 := 'Active';
  p_AutoUpdateIsNameField_a8af17a4e961 := TRUE;
  p_AutoUpdateDefaultInView_a8af17a4e961 := TRUE;
  p_AutoUpdateCategory_a8af17a4e961 := TRUE;
  p_AutoUpdateDisplayName_a8af17a4e961 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961 := TRUE;
  p_Encrypt_a8af17a4e961 := FALSE;
  p_AllowDecryptInAPI_a8af17a4e961 := FALSE;
  p_SendEncryptedValue_a8af17a4e961 := FALSE;
  p_IsSoftPrimaryKey_a8af17a4e961 := FALSE;
  p_IsSoftForeignKey_a8af17a4e961 := TRUE;
  p_JSONTypeIsArray_a8af17a4e961 := FALSE;
  p_UserSearchPredicateAPI_a8af17a4e961 := 'Contains';
  p_AutoUpdateUserSearchPredicate_a8af17a4e961 := TRUE;
  p_AutoUpdateFullTextSearch_a8af17a4e961 := TRUE;
  p_AutoUpdateExtendedType_a8af17a4e961 := TRUE;
  p_IsComputed_a8af17a4e961 := FALSE;
  p_ID_a8af17a4e961 := '56E0AEA4-670E-4362-9854-3925B1FB215A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_a8af17a4e961,
    'Description', p_Description_a8af17a4e961,
    'AutoUpdateDescription', p_AutoUpdateDescription_a8af17a4e961,
    'IsPrimaryKey', p_IsPrimaryKey_a8af17a4e961,
    'IsUnique', p_IsUnique_a8af17a4e961,
    'Category', p_Category_a8af17a4e961,
    'ValueListType', p_ValueListType_a8af17a4e961,
    'ExtendedType', p_ExtendedType_a8af17a4e961,
    'CodeType', p_CodeType_a8af17a4e961,
    'DefaultInView', p_DefaultInView_a8af17a4e961,
    'ViewCellTemplate', p_ViewCellTemplate_a8af17a4e961,
    'DefaultColumnWidth', p_DefaultColumnWidth_a8af17a4e961,
    'AllowUpdateAPI', p_AllowUpdateAPI_a8af17a4e961,
    'AllowUpdateInView', p_AllowUpdateInView_a8af17a4e961,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_a8af17a4e961,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_a8af17a4e961,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_a8af17a4e961,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_a8af17a4e961,
    'GeneratedFormSection', p_GeneratedFormSection_a8af17a4e961,
    'IsNameField', p_IsNameField_a8af17a4e961,
    'RelatedEntityID', p_RelatedEntityID_a8af17a4e961,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_a8af17a4e961,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_a8af17a4e961,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_a8af17a4e961,
    'EntityIDFieldName', p_EntityIDFieldName_a8af17a4e961,
    'ScopeDefault', p_ScopeDefault_a8af17a4e961,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_a8af17a4e961,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_a8af17a4e961,
    'Status', p_Status_a8af17a4e961,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_a8af17a4e961,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_a8af17a4e961,
    'AutoUpdateCategory', p_AutoUpdateCategory_a8af17a4e961,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_a8af17a4e961,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961,
    'Encrypt', p_Encrypt_a8af17a4e961,
    'EncryptionKeyID', p_EncryptionKeyID_a8af17a4e961,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_a8af17a4e961,
    'SendEncryptedValue', p_SendEncryptedValue_a8af17a4e961,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_a8af17a4e961,
    'IsSoftForeignKey', p_IsSoftForeignKey_a8af17a4e961,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_a8af17a4e961,
    'JSONType', p_JSONType_a8af17a4e961,
    'JSONTypeIsArray', p_JSONTypeIsArray_a8af17a4e961,
    'JSONTypeDefinition', p_JSONTypeDefinition_a8af17a4e961,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_a8af17a4e961,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_a8af17a4e961,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_a8af17a4e961,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_a8af17a4e961,
    'IsComputed', p_IsComputed_a8af17a4e961
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_a8af17a4e961,
    'Configuration', p_Configuration_a8af17a4e961,
    'ID', p_ID_a8af17a4e961
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_a8af17a4e961, p_Description := p_Description_a8af17a4e961, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_a8af17a4e961, p_IsPrimaryKey := p_IsPrimaryKey_a8af17a4e961, p_IsUnique := p_IsUnique_a8af17a4e961, p_Category := p_Category_a8af17a4e961, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_a8af17a4e961, p_ExtendedType := p_ExtendedType_a8af17a4e961, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_a8af17a4e961, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_a8af17a4e961, p_ViewCellTemplate := p_ViewCellTemplate_a8af17a4e961, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_a8af17a4e961, p_AllowUpdateAPI := p_AllowUpdateAPI_a8af17a4e961, p_AllowUpdateInView := p_AllowUpdateInView_a8af17a4e961, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_a8af17a4e961, p_FullTextSearchEnabled := p_FullTextSearchEnabled_a8af17a4e961, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_a8af17a4e961, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_a8af17a4e961, p_GeneratedFormSection := p_GeneratedFormSection_a8af17a4e961, p_IsNameField := p_IsNameField_a8af17a4e961, p_RelatedEntityID := p_RelatedEntityID_a8af17a4e961, p_RelatedEntityFieldName := p_RelatedEntityFieldName_a8af17a4e961, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_a8af17a4e961, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_a8af17a4e961, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_a8af17a4e961, p_EntityIDFieldName := p_EntityIDFieldName_a8af17a4e961, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_a8af17a4e961, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_a8af17a4e961, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_a8af17a4e961, p_Status := p_Status_a8af17a4e961, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_a8af17a4e961, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_a8af17a4e961, p_AutoUpdateCategory := p_AutoUpdateCategory_a8af17a4e961, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_a8af17a4e961, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_a8af17a4e961, p_Encrypt := p_Encrypt_a8af17a4e961, p_EncryptionKeyID := p_EncryptionKeyID_a8af17a4e961, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_a8af17a4e961, p_SendEncryptedValue := p_SendEncryptedValue_a8af17a4e961, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_a8af17a4e961, p_IsSoftForeignKey := p_IsSoftForeignKey_a8af17a4e961, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_a8af17a4e961, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_a8af17a4e961, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_a8af17a4e961, p_JSONTypeDefinition := p_JSONTypeDefinition_a8af17a4e961, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_a8af17a4e961, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_a8af17a4e961, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_a8af17a4e961, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_a8af17a4e961, p_IsComputed := p_IsComputed_a8af17a4e961, p_EmbeddedRecord := p_EmbeddedRecord_a8af17a4e961, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_a8af17a4e961, p_Configuration_Clear := TRUE, p_ID := p_ID_a8af17a4e961);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7bb7cd2d9ad6 VARCHAR(255);
  p_Description_7bb7cd2d9ad6 TEXT;
  p_AutoUpdateDescription_7bb7cd2d9ad6 BOOLEAN;
  p_IsPrimaryKey_7bb7cd2d9ad6 BOOLEAN;
  p_IsUnique_7bb7cd2d9ad6 BOOLEAN;
  p_Category_7bb7cd2d9ad6 VARCHAR(255);
  p_ValueListType_7bb7cd2d9ad6 VARCHAR(20);
  p_ExtendedType_7bb7cd2d9ad6 VARCHAR(50);
  p_CodeType_7bb7cd2d9ad6 VARCHAR(50);
  p_DefaultInView_7bb7cd2d9ad6 BOOLEAN;
  p_ViewCellTemplate_7bb7cd2d9ad6 TEXT;
  p_DefaultColumnWidth_7bb7cd2d9ad6 INTEGER;
  p_AllowUpdateAPI_7bb7cd2d9ad6 BOOLEAN;
  p_AllowUpdateInView_7bb7cd2d9ad6 BOOLEAN;
  p_IncludeInUserSearchAPI_7bb7cd2d9ad6 BOOLEAN;
  p_FullTextSearchEnabled_7bb7cd2d9ad6 BOOLEAN;
  p_UserSearchParamFormatAPI_7bb7cd2d9ad6 VARCHAR(500);
  p_IncludeInGeneratedForm_7bb7cd2d9ad6 BOOLEAN;
  p_GeneratedFormSection_7bb7cd2d9ad6 VARCHAR(10);
  p_IsNameField_7bb7cd2d9ad6 BOOLEAN;
  p_RelatedEntityID_7bb7cd2d9ad6 UUID;
  p_RelatedEntityFieldName_7bb7cd2d9ad6 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6 BOOLEAN;
  p_RelatedEntityNameFieldMap_7bb7cd2d9ad6 VARCHAR(255);
  p_RelatedEntityDisplayType_7bb7cd2d9ad6 VARCHAR(20);
  p_EntityIDFieldName_7bb7cd2d9ad6 VARCHAR(100);
  p_ScopeDefault_7bb7cd2d9ad6 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6 BOOLEAN;
  p_ValuesToPackWithSchema_7bb7cd2d9ad6 VARCHAR(10);
  p_Status_7bb7cd2d9ad6 VARCHAR(25);
  p_AutoUpdateIsNameField_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateDefaultInView_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateCategory_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateDisplayName_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6 BOOLEAN;
  p_Encrypt_7bb7cd2d9ad6 BOOLEAN;
  p_EncryptionKeyID_7bb7cd2d9ad6 UUID;
  p_AllowDecryptInAPI_7bb7cd2d9ad6 BOOLEAN;
  p_SendEncryptedValue_7bb7cd2d9ad6 BOOLEAN;
  p_IsSoftPrimaryKey_7bb7cd2d9ad6 BOOLEAN;
  p_IsSoftForeignKey_7bb7cd2d9ad6 BOOLEAN;
  p_RelatedEntityJoinFields_7bb7cd2d9ad6 TEXT;
  p_JSONType_7bb7cd2d9ad6 VARCHAR(255);
  p_JSONTypeIsArray_7bb7cd2d9ad6 BOOLEAN;
  p_JSONTypeDefinition_7bb7cd2d9ad6 TEXT;
  p_UserSearchPredicateAPI_7bb7cd2d9ad6 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateFullTextSearch_7bb7cd2d9ad6 BOOLEAN;
  p_AutoUpdateExtendedType_7bb7cd2d9ad6 BOOLEAN;
  p_IsComputed_7bb7cd2d9ad6 BOOLEAN;
  p_EmbeddedRecord_7bb7cd2d9ad6 TEXT;
  p_Configuration_7bb7cd2d9ad6 TEXT;
  p_ID_7bb7cd2d9ad6 UUID;
BEGIN
  p_DisplayName_7bb7cd2d9ad6 := 'Contract';
  p_Description_7bb7cd2d9ad6 := 'SOFT reference (no FK) to a bizapps-contracts Contract. The link points DOWN the dependency graph; there is deliberately no Contract.DealID, because it is ONE contract to MANY deals — the original sale, every renewal, every expansion.';
  p_AutoUpdateDescription_7bb7cd2d9ad6 := TRUE;
  p_IsPrimaryKey_7bb7cd2d9ad6 := FALSE;
  p_IsUnique_7bb7cd2d9ad6 := FALSE;
  p_ValueListType_7bb7cd2d9ad6 := 'None';
  p_DefaultInView_7bb7cd2d9ad6 := FALSE;
  p_DefaultColumnWidth_7bb7cd2d9ad6 := 150;
  p_AllowUpdateAPI_7bb7cd2d9ad6 := TRUE;
  p_AllowUpdateInView_7bb7cd2d9ad6 := TRUE;
  p_IncludeInUserSearchAPI_7bb7cd2d9ad6 := FALSE;
  p_FullTextSearchEnabled_7bb7cd2d9ad6 := FALSE;
  p_IncludeInGeneratedForm_7bb7cd2d9ad6 := TRUE;
  p_GeneratedFormSection_7bb7cd2d9ad6 := 'Details';
  p_IsNameField_7bb7cd2d9ad6 := FALSE;
  p_RelatedEntityID_7bb7cd2d9ad6 := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_RelatedEntityFieldName_7bb7cd2d9ad6 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6 := FALSE;
  p_RelatedEntityDisplayType_7bb7cd2d9ad6 := 'Search';
  p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6 := FALSE;
  p_ValuesToPackWithSchema_7bb7cd2d9ad6 := 'Auto';
  p_Status_7bb7cd2d9ad6 := 'Active';
  p_AutoUpdateIsNameField_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateDefaultInView_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateCategory_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateDisplayName_7bb7cd2d9ad6 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6 := TRUE;
  p_Encrypt_7bb7cd2d9ad6 := FALSE;
  p_AllowDecryptInAPI_7bb7cd2d9ad6 := FALSE;
  p_SendEncryptedValue_7bb7cd2d9ad6 := FALSE;
  p_IsSoftPrimaryKey_7bb7cd2d9ad6 := FALSE;
  p_IsSoftForeignKey_7bb7cd2d9ad6 := TRUE;
  p_JSONTypeIsArray_7bb7cd2d9ad6 := FALSE;
  p_UserSearchPredicateAPI_7bb7cd2d9ad6 := 'Contains';
  p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateFullTextSearch_7bb7cd2d9ad6 := TRUE;
  p_AutoUpdateExtendedType_7bb7cd2d9ad6 := TRUE;
  p_IsComputed_7bb7cd2d9ad6 := FALSE;
  p_ID_7bb7cd2d9ad6 := '61862F6F-2A93-4EA1-B828-3772CC49E197';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7bb7cd2d9ad6,
    'Description', p_Description_7bb7cd2d9ad6,
    'AutoUpdateDescription', p_AutoUpdateDescription_7bb7cd2d9ad6,
    'IsPrimaryKey', p_IsPrimaryKey_7bb7cd2d9ad6,
    'IsUnique', p_IsUnique_7bb7cd2d9ad6,
    'Category', p_Category_7bb7cd2d9ad6,
    'ValueListType', p_ValueListType_7bb7cd2d9ad6,
    'ExtendedType', p_ExtendedType_7bb7cd2d9ad6,
    'CodeType', p_CodeType_7bb7cd2d9ad6,
    'DefaultInView', p_DefaultInView_7bb7cd2d9ad6,
    'ViewCellTemplate', p_ViewCellTemplate_7bb7cd2d9ad6,
    'DefaultColumnWidth', p_DefaultColumnWidth_7bb7cd2d9ad6,
    'AllowUpdateAPI', p_AllowUpdateAPI_7bb7cd2d9ad6,
    'AllowUpdateInView', p_AllowUpdateInView_7bb7cd2d9ad6,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7bb7cd2d9ad6,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7bb7cd2d9ad6,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7bb7cd2d9ad6,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7bb7cd2d9ad6,
    'GeneratedFormSection', p_GeneratedFormSection_7bb7cd2d9ad6,
    'IsNameField', p_IsNameField_7bb7cd2d9ad6,
    'RelatedEntityID', p_RelatedEntityID_7bb7cd2d9ad6,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7bb7cd2d9ad6,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7bb7cd2d9ad6,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7bb7cd2d9ad6,
    'EntityIDFieldName', p_EntityIDFieldName_7bb7cd2d9ad6,
    'ScopeDefault', p_ScopeDefault_7bb7cd2d9ad6,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7bb7cd2d9ad6,
    'Status', p_Status_7bb7cd2d9ad6,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7bb7cd2d9ad6,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7bb7cd2d9ad6,
    'AutoUpdateCategory', p_AutoUpdateCategory_7bb7cd2d9ad6,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7bb7cd2d9ad6,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6,
    'Encrypt', p_Encrypt_7bb7cd2d9ad6,
    'EncryptionKeyID', p_EncryptionKeyID_7bb7cd2d9ad6,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7bb7cd2d9ad6,
    'SendEncryptedValue', p_SendEncryptedValue_7bb7cd2d9ad6,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7bb7cd2d9ad6,
    'IsSoftForeignKey', p_IsSoftForeignKey_7bb7cd2d9ad6,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7bb7cd2d9ad6,
    'JSONType', p_JSONType_7bb7cd2d9ad6,
    'JSONTypeIsArray', p_JSONTypeIsArray_7bb7cd2d9ad6,
    'JSONTypeDefinition', p_JSONTypeDefinition_7bb7cd2d9ad6,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7bb7cd2d9ad6,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7bb7cd2d9ad6,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7bb7cd2d9ad6,
    'IsComputed', p_IsComputed_7bb7cd2d9ad6
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7bb7cd2d9ad6,
    'Configuration', p_Configuration_7bb7cd2d9ad6,
    'ID', p_ID_7bb7cd2d9ad6
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_7bb7cd2d9ad6, p_Description := p_Description_7bb7cd2d9ad6, p_AutoUpdateDescription := p_AutoUpdateDescription_7bb7cd2d9ad6, p_IsPrimaryKey := p_IsPrimaryKey_7bb7cd2d9ad6, p_IsUnique := p_IsUnique_7bb7cd2d9ad6, p_Category := p_Category_7bb7cd2d9ad6, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_7bb7cd2d9ad6, p_ExtendedType := p_ExtendedType_7bb7cd2d9ad6, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7bb7cd2d9ad6, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7bb7cd2d9ad6, p_ViewCellTemplate := p_ViewCellTemplate_7bb7cd2d9ad6, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7bb7cd2d9ad6, p_AllowUpdateAPI := p_AllowUpdateAPI_7bb7cd2d9ad6, p_AllowUpdateInView := p_AllowUpdateInView_7bb7cd2d9ad6, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7bb7cd2d9ad6, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7bb7cd2d9ad6, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7bb7cd2d9ad6, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7bb7cd2d9ad6, p_GeneratedFormSection := p_GeneratedFormSection_7bb7cd2d9ad6, p_IsNameField := p_IsNameField_7bb7cd2d9ad6, p_RelatedEntityID := p_RelatedEntityID_7bb7cd2d9ad6, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7bb7cd2d9ad6, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7bb7cd2d9ad6, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7bb7cd2d9ad6, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7bb7cd2d9ad6, p_EntityIDFieldName := p_EntityIDFieldName_7bb7cd2d9ad6, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7bb7cd2d9ad6, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7bb7cd2d9ad6, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7bb7cd2d9ad6, p_Status := p_Status_7bb7cd2d9ad6, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7bb7cd2d9ad6, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7bb7cd2d9ad6, p_AutoUpdateCategory := p_AutoUpdateCategory_7bb7cd2d9ad6, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7bb7cd2d9ad6, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7bb7cd2d9ad6, p_Encrypt := p_Encrypt_7bb7cd2d9ad6, p_EncryptionKeyID := p_EncryptionKeyID_7bb7cd2d9ad6, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7bb7cd2d9ad6, p_SendEncryptedValue := p_SendEncryptedValue_7bb7cd2d9ad6, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7bb7cd2d9ad6, p_IsSoftForeignKey := p_IsSoftForeignKey_7bb7cd2d9ad6, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7bb7cd2d9ad6, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7bb7cd2d9ad6, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7bb7cd2d9ad6, p_JSONTypeDefinition := p_JSONTypeDefinition_7bb7cd2d9ad6, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7bb7cd2d9ad6, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7bb7cd2d9ad6, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7bb7cd2d9ad6, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7bb7cd2d9ad6, p_IsComputed := p_IsComputed_7bb7cd2d9ad6, p_EmbeddedRecord := p_EmbeddedRecord_7bb7cd2d9ad6, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7bb7cd2d9ad6, p_Configuration_Clear := TRUE, p_ID := p_ID_7bb7cd2d9ad6);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7c293164ff22 VARCHAR(255);
  p_Description_7c293164ff22 TEXT;
  p_AutoUpdateDescription_7c293164ff22 BOOLEAN;
  p_IsPrimaryKey_7c293164ff22 BOOLEAN;
  p_IsUnique_7c293164ff22 BOOLEAN;
  p_Category_7c293164ff22 VARCHAR(255);
  p_ValueListType_7c293164ff22 VARCHAR(20);
  p_ExtendedType_7c293164ff22 VARCHAR(50);
  p_CodeType_7c293164ff22 VARCHAR(50);
  p_DefaultInView_7c293164ff22 BOOLEAN;
  p_ViewCellTemplate_7c293164ff22 TEXT;
  p_DefaultColumnWidth_7c293164ff22 INTEGER;
  p_AllowUpdateAPI_7c293164ff22 BOOLEAN;
  p_AllowUpdateInView_7c293164ff22 BOOLEAN;
  p_IncludeInUserSearchAPI_7c293164ff22 BOOLEAN;
  p_FullTextSearchEnabled_7c293164ff22 BOOLEAN;
  p_UserSearchParamFormatAPI_7c293164ff22 VARCHAR(500);
  p_IncludeInGeneratedForm_7c293164ff22 BOOLEAN;
  p_GeneratedFormSection_7c293164ff22 VARCHAR(10);
  p_IsNameField_7c293164ff22 BOOLEAN;
  p_RelatedEntityID_7c293164ff22 UUID;
  p_RelatedEntityFieldName_7c293164ff22 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22 BOOLEAN;
  p_RelatedEntityNameFieldMap_7c293164ff22 VARCHAR(255);
  p_RelatedEntityDisplayType_7c293164ff22 VARCHAR(20);
  p_EntityIDFieldName_7c293164ff22 VARCHAR(100);
  p_ScopeDefault_7c293164ff22 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7c293164ff22 BOOLEAN;
  p_ValuesToPackWithSchema_7c293164ff22 VARCHAR(10);
  p_Status_7c293164ff22 VARCHAR(25);
  p_AutoUpdateIsNameField_7c293164ff22 BOOLEAN;
  p_AutoUpdateDefaultInView_7c293164ff22 BOOLEAN;
  p_AutoUpdateCategory_7c293164ff22 BOOLEAN;
  p_AutoUpdateDisplayName_7c293164ff22 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22 BOOLEAN;
  p_Encrypt_7c293164ff22 BOOLEAN;
  p_EncryptionKeyID_7c293164ff22 UUID;
  p_AllowDecryptInAPI_7c293164ff22 BOOLEAN;
  p_SendEncryptedValue_7c293164ff22 BOOLEAN;
  p_IsSoftPrimaryKey_7c293164ff22 BOOLEAN;
  p_IsSoftForeignKey_7c293164ff22 BOOLEAN;
  p_RelatedEntityJoinFields_7c293164ff22 TEXT;
  p_JSONType_7c293164ff22 VARCHAR(255);
  p_JSONTypeIsArray_7c293164ff22 BOOLEAN;
  p_JSONTypeDefinition_7c293164ff22 TEXT;
  p_UserSearchPredicateAPI_7c293164ff22 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7c293164ff22 BOOLEAN;
  p_AutoUpdateFullTextSearch_7c293164ff22 BOOLEAN;
  p_AutoUpdateExtendedType_7c293164ff22 BOOLEAN;
  p_IsComputed_7c293164ff22 BOOLEAN;
  p_EmbeddedRecord_7c293164ff22 TEXT;
  p_Configuration_7c293164ff22 TEXT;
  p_ID_7c293164ff22 UUID;
BEGIN
  p_DisplayName_7c293164ff22 := 'Renews Contract';
  p_Description_7c293164ff22 := 'SOFT reference (no FK) to the contract this deal RENEWS. What makes the renewal chain navigable from the sales side without contracts knowing anything about it. Required when DealType.RequiresRenewalSource is set.';
  p_AutoUpdateDescription_7c293164ff22 := TRUE;
  p_IsPrimaryKey_7c293164ff22 := FALSE;
  p_IsUnique_7c293164ff22 := FALSE;
  p_ValueListType_7c293164ff22 := 'None';
  p_DefaultInView_7c293164ff22 := FALSE;
  p_DefaultColumnWidth_7c293164ff22 := 150;
  p_AllowUpdateAPI_7c293164ff22 := TRUE;
  p_AllowUpdateInView_7c293164ff22 := TRUE;
  p_IncludeInUserSearchAPI_7c293164ff22 := FALSE;
  p_FullTextSearchEnabled_7c293164ff22 := FALSE;
  p_IncludeInGeneratedForm_7c293164ff22 := TRUE;
  p_GeneratedFormSection_7c293164ff22 := 'Details';
  p_IsNameField_7c293164ff22 := FALSE;
  p_RelatedEntityID_7c293164ff22 := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_RelatedEntityFieldName_7c293164ff22 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22 := FALSE;
  p_RelatedEntityDisplayType_7c293164ff22 := 'Search';
  p_AutoUpdateRelatedEntityInfo_7c293164ff22 := FALSE;
  p_ValuesToPackWithSchema_7c293164ff22 := 'Auto';
  p_Status_7c293164ff22 := 'Active';
  p_AutoUpdateIsNameField_7c293164ff22 := TRUE;
  p_AutoUpdateDefaultInView_7c293164ff22 := TRUE;
  p_AutoUpdateCategory_7c293164ff22 := TRUE;
  p_AutoUpdateDisplayName_7c293164ff22 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22 := TRUE;
  p_Encrypt_7c293164ff22 := FALSE;
  p_AllowDecryptInAPI_7c293164ff22 := FALSE;
  p_SendEncryptedValue_7c293164ff22 := FALSE;
  p_IsSoftPrimaryKey_7c293164ff22 := FALSE;
  p_IsSoftForeignKey_7c293164ff22 := TRUE;
  p_JSONTypeIsArray_7c293164ff22 := FALSE;
  p_UserSearchPredicateAPI_7c293164ff22 := 'Contains';
  p_AutoUpdateUserSearchPredicate_7c293164ff22 := TRUE;
  p_AutoUpdateFullTextSearch_7c293164ff22 := TRUE;
  p_AutoUpdateExtendedType_7c293164ff22 := TRUE;
  p_IsComputed_7c293164ff22 := FALSE;
  p_ID_7c293164ff22 := '8023C8F2-325E-4C73-8305-075D89227E12';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7c293164ff22,
    'Description', p_Description_7c293164ff22,
    'AutoUpdateDescription', p_AutoUpdateDescription_7c293164ff22,
    'IsPrimaryKey', p_IsPrimaryKey_7c293164ff22,
    'IsUnique', p_IsUnique_7c293164ff22,
    'Category', p_Category_7c293164ff22,
    'ValueListType', p_ValueListType_7c293164ff22,
    'ExtendedType', p_ExtendedType_7c293164ff22,
    'CodeType', p_CodeType_7c293164ff22,
    'DefaultInView', p_DefaultInView_7c293164ff22,
    'ViewCellTemplate', p_ViewCellTemplate_7c293164ff22,
    'DefaultColumnWidth', p_DefaultColumnWidth_7c293164ff22,
    'AllowUpdateAPI', p_AllowUpdateAPI_7c293164ff22,
    'AllowUpdateInView', p_AllowUpdateInView_7c293164ff22,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7c293164ff22,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7c293164ff22,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7c293164ff22,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7c293164ff22,
    'GeneratedFormSection', p_GeneratedFormSection_7c293164ff22,
    'IsNameField', p_IsNameField_7c293164ff22,
    'RelatedEntityID', p_RelatedEntityID_7c293164ff22,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7c293164ff22,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7c293164ff22,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7c293164ff22,
    'EntityIDFieldName', p_EntityIDFieldName_7c293164ff22,
    'ScopeDefault', p_ScopeDefault_7c293164ff22,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7c293164ff22,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7c293164ff22,
    'Status', p_Status_7c293164ff22,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7c293164ff22,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7c293164ff22,
    'AutoUpdateCategory', p_AutoUpdateCategory_7c293164ff22,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7c293164ff22,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22,
    'Encrypt', p_Encrypt_7c293164ff22,
    'EncryptionKeyID', p_EncryptionKeyID_7c293164ff22,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7c293164ff22,
    'SendEncryptedValue', p_SendEncryptedValue_7c293164ff22,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7c293164ff22,
    'IsSoftForeignKey', p_IsSoftForeignKey_7c293164ff22,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7c293164ff22,
    'JSONType', p_JSONType_7c293164ff22,
    'JSONTypeIsArray', p_JSONTypeIsArray_7c293164ff22,
    'JSONTypeDefinition', p_JSONTypeDefinition_7c293164ff22,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7c293164ff22,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7c293164ff22,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7c293164ff22,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7c293164ff22,
    'IsComputed', p_IsComputed_7c293164ff22
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7c293164ff22,
    'Configuration', p_Configuration_7c293164ff22,
    'ID', p_ID_7c293164ff22
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_7c293164ff22, p_Description := p_Description_7c293164ff22, p_AutoUpdateDescription := p_AutoUpdateDescription_7c293164ff22, p_IsPrimaryKey := p_IsPrimaryKey_7c293164ff22, p_IsUnique := p_IsUnique_7c293164ff22, p_Category := p_Category_7c293164ff22, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_7c293164ff22, p_ExtendedType := p_ExtendedType_7c293164ff22, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7c293164ff22, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7c293164ff22, p_ViewCellTemplate := p_ViewCellTemplate_7c293164ff22, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7c293164ff22, p_AllowUpdateAPI := p_AllowUpdateAPI_7c293164ff22, p_AllowUpdateInView := p_AllowUpdateInView_7c293164ff22, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7c293164ff22, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7c293164ff22, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7c293164ff22, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7c293164ff22, p_GeneratedFormSection := p_GeneratedFormSection_7c293164ff22, p_IsNameField := p_IsNameField_7c293164ff22, p_RelatedEntityID := p_RelatedEntityID_7c293164ff22, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7c293164ff22, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7c293164ff22, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7c293164ff22, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7c293164ff22, p_EntityIDFieldName := p_EntityIDFieldName_7c293164ff22, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7c293164ff22, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7c293164ff22, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7c293164ff22, p_Status := p_Status_7c293164ff22, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7c293164ff22, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7c293164ff22, p_AutoUpdateCategory := p_AutoUpdateCategory_7c293164ff22, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7c293164ff22, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7c293164ff22, p_Encrypt := p_Encrypt_7c293164ff22, p_EncryptionKeyID := p_EncryptionKeyID_7c293164ff22, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7c293164ff22, p_SendEncryptedValue := p_SendEncryptedValue_7c293164ff22, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7c293164ff22, p_IsSoftForeignKey := p_IsSoftForeignKey_7c293164ff22, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7c293164ff22, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7c293164ff22, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7c293164ff22, p_JSONTypeDefinition := p_JSONTypeDefinition_7c293164ff22, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7c293164ff22, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7c293164ff22, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7c293164ff22, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7c293164ff22, p_IsComputed := p_IsComputed_7c293164ff22, p_EmbeddedRecord := p_EmbeddedRecord_7c293164ff22, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7c293164ff22, p_Configuration_Clear := TRUE, p_ID := p_ID_7c293164ff22);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_b436ed19c308 VARCHAR(255);
  p_Description_b436ed19c308 TEXT;
  p_AutoUpdateDescription_b436ed19c308 BOOLEAN;
  p_IsPrimaryKey_b436ed19c308 BOOLEAN;
  p_IsUnique_b436ed19c308 BOOLEAN;
  p_Category_b436ed19c308 VARCHAR(255);
  p_ValueListType_b436ed19c308 VARCHAR(20);
  p_ExtendedType_b436ed19c308 VARCHAR(50);
  p_CodeType_b436ed19c308 VARCHAR(50);
  p_DefaultInView_b436ed19c308 BOOLEAN;
  p_ViewCellTemplate_b436ed19c308 TEXT;
  p_DefaultColumnWidth_b436ed19c308 INTEGER;
  p_AllowUpdateAPI_b436ed19c308 BOOLEAN;
  p_AllowUpdateInView_b436ed19c308 BOOLEAN;
  p_IncludeInUserSearchAPI_b436ed19c308 BOOLEAN;
  p_FullTextSearchEnabled_b436ed19c308 BOOLEAN;
  p_UserSearchParamFormatAPI_b436ed19c308 VARCHAR(500);
  p_IncludeInGeneratedForm_b436ed19c308 BOOLEAN;
  p_GeneratedFormSection_b436ed19c308 VARCHAR(10);
  p_IsNameField_b436ed19c308 BOOLEAN;
  p_RelatedEntityID_b436ed19c308 UUID;
  p_RelatedEntityFieldName_b436ed19c308 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_b436ed19c308 BOOLEAN;
  p_RelatedEntityNameFieldMap_b436ed19c308 VARCHAR(255);
  p_RelatedEntityDisplayType_b436ed19c308 VARCHAR(20);
  p_EntityIDFieldName_b436ed19c308 VARCHAR(100);
  p_ScopeDefault_b436ed19c308 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_b436ed19c308 BOOLEAN;
  p_ValuesToPackWithSchema_b436ed19c308 VARCHAR(10);
  p_Status_b436ed19c308 VARCHAR(25);
  p_AutoUpdateIsNameField_b436ed19c308 BOOLEAN;
  p_AutoUpdateDefaultInView_b436ed19c308 BOOLEAN;
  p_AutoUpdateCategory_b436ed19c308 BOOLEAN;
  p_AutoUpdateDisplayName_b436ed19c308 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_b436ed19c308 BOOLEAN;
  p_Encrypt_b436ed19c308 BOOLEAN;
  p_EncryptionKeyID_b436ed19c308 UUID;
  p_AllowDecryptInAPI_b436ed19c308 BOOLEAN;
  p_SendEncryptedValue_b436ed19c308 BOOLEAN;
  p_IsSoftPrimaryKey_b436ed19c308 BOOLEAN;
  p_IsSoftForeignKey_b436ed19c308 BOOLEAN;
  p_RelatedEntityJoinFields_b436ed19c308 TEXT;
  p_JSONType_b436ed19c308 VARCHAR(255);
  p_JSONTypeIsArray_b436ed19c308 BOOLEAN;
  p_JSONTypeDefinition_b436ed19c308 TEXT;
  p_UserSearchPredicateAPI_b436ed19c308 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_b436ed19c308 BOOLEAN;
  p_AutoUpdateFullTextSearch_b436ed19c308 BOOLEAN;
  p_AutoUpdateExtendedType_b436ed19c308 BOOLEAN;
  p_IsComputed_b436ed19c308 BOOLEAN;
  p_EmbeddedRecord_b436ed19c308 TEXT;
  p_Configuration_b436ed19c308 TEXT;
  p_ID_b436ed19c308 UUID;
BEGIN
  p_DisplayName_b436ed19c308 := 'Campaign';
  p_AutoUpdateDescription_b436ed19c308 := TRUE;
  p_IsPrimaryKey_b436ed19c308 := FALSE;
  p_IsUnique_b436ed19c308 := FALSE;
  p_ValueListType_b436ed19c308 := 'None';
  p_DefaultInView_b436ed19c308 := FALSE;
  p_DefaultColumnWidth_b436ed19c308 := 150;
  p_AllowUpdateAPI_b436ed19c308 := TRUE;
  p_AllowUpdateInView_b436ed19c308 := TRUE;
  p_IncludeInUserSearchAPI_b436ed19c308 := FALSE;
  p_FullTextSearchEnabled_b436ed19c308 := FALSE;
  p_IncludeInGeneratedForm_b436ed19c308 := TRUE;
  p_GeneratedFormSection_b436ed19c308 := 'Details';
  p_IsNameField_b436ed19c308 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_b436ed19c308 := FALSE;
  p_RelatedEntityDisplayType_b436ed19c308 := 'Search';
  p_AutoUpdateRelatedEntityInfo_b436ed19c308 := TRUE;
  p_ValuesToPackWithSchema_b436ed19c308 := 'Auto';
  p_Status_b436ed19c308 := 'Active';
  p_AutoUpdateIsNameField_b436ed19c308 := TRUE;
  p_AutoUpdateDefaultInView_b436ed19c308 := TRUE;
  p_AutoUpdateCategory_b436ed19c308 := TRUE;
  p_AutoUpdateDisplayName_b436ed19c308 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_b436ed19c308 := TRUE;
  p_Encrypt_b436ed19c308 := FALSE;
  p_AllowDecryptInAPI_b436ed19c308 := FALSE;
  p_SendEncryptedValue_b436ed19c308 := FALSE;
  p_IsSoftPrimaryKey_b436ed19c308 := FALSE;
  p_IsSoftForeignKey_b436ed19c308 := FALSE;
  p_JSONTypeIsArray_b436ed19c308 := FALSE;
  p_UserSearchPredicateAPI_b436ed19c308 := 'Contains';
  p_AutoUpdateUserSearchPredicate_b436ed19c308 := TRUE;
  p_AutoUpdateFullTextSearch_b436ed19c308 := TRUE;
  p_AutoUpdateExtendedType_b436ed19c308 := TRUE;
  p_IsComputed_b436ed19c308 := FALSE;
  p_ID_b436ed19c308 := '6C045E57-59E0-4EB0-B693-9ADB17E4161B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_b436ed19c308,
    'Description', p_Description_b436ed19c308,
    'AutoUpdateDescription', p_AutoUpdateDescription_b436ed19c308,
    'IsPrimaryKey', p_IsPrimaryKey_b436ed19c308,
    'IsUnique', p_IsUnique_b436ed19c308,
    'Category', p_Category_b436ed19c308,
    'ValueListType', p_ValueListType_b436ed19c308,
    'ExtendedType', p_ExtendedType_b436ed19c308,
    'CodeType', p_CodeType_b436ed19c308,
    'DefaultInView', p_DefaultInView_b436ed19c308,
    'ViewCellTemplate', p_ViewCellTemplate_b436ed19c308,
    'DefaultColumnWidth', p_DefaultColumnWidth_b436ed19c308,
    'AllowUpdateAPI', p_AllowUpdateAPI_b436ed19c308,
    'AllowUpdateInView', p_AllowUpdateInView_b436ed19c308,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_b436ed19c308,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_b436ed19c308,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_b436ed19c308,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_b436ed19c308,
    'GeneratedFormSection', p_GeneratedFormSection_b436ed19c308,
    'IsNameField', p_IsNameField_b436ed19c308,
    'RelatedEntityID', p_RelatedEntityID_b436ed19c308,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_b436ed19c308,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_b436ed19c308,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_b436ed19c308,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_b436ed19c308,
    'EntityIDFieldName', p_EntityIDFieldName_b436ed19c308,
    'ScopeDefault', p_ScopeDefault_b436ed19c308,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_b436ed19c308,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_b436ed19c308,
    'Status', p_Status_b436ed19c308,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_b436ed19c308,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_b436ed19c308,
    'AutoUpdateCategory', p_AutoUpdateCategory_b436ed19c308,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_b436ed19c308,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_b436ed19c308,
    'Encrypt', p_Encrypt_b436ed19c308,
    'EncryptionKeyID', p_EncryptionKeyID_b436ed19c308,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_b436ed19c308,
    'SendEncryptedValue', p_SendEncryptedValue_b436ed19c308,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_b436ed19c308,
    'IsSoftForeignKey', p_IsSoftForeignKey_b436ed19c308,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_b436ed19c308,
    'JSONType', p_JSONType_b436ed19c308,
    'JSONTypeIsArray', p_JSONTypeIsArray_b436ed19c308,
    'JSONTypeDefinition', p_JSONTypeDefinition_b436ed19c308,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_b436ed19c308,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_b436ed19c308,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_b436ed19c308,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_b436ed19c308,
    'IsComputed', p_IsComputed_b436ed19c308
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_b436ed19c308,
    'Configuration', p_Configuration_b436ed19c308,
    'ID', p_ID_b436ed19c308
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_b436ed19c308, p_Description := p_Description_b436ed19c308, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_b436ed19c308, p_IsPrimaryKey := p_IsPrimaryKey_b436ed19c308, p_IsUnique := p_IsUnique_b436ed19c308, p_Category := p_Category_b436ed19c308, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_b436ed19c308, p_ExtendedType := p_ExtendedType_b436ed19c308, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_b436ed19c308, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_b436ed19c308, p_ViewCellTemplate := p_ViewCellTemplate_b436ed19c308, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_b436ed19c308, p_AllowUpdateAPI := p_AllowUpdateAPI_b436ed19c308, p_AllowUpdateInView := p_AllowUpdateInView_b436ed19c308, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_b436ed19c308, p_FullTextSearchEnabled := p_FullTextSearchEnabled_b436ed19c308, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_b436ed19c308, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_b436ed19c308, p_GeneratedFormSection := p_GeneratedFormSection_b436ed19c308, p_IsNameField := p_IsNameField_b436ed19c308, p_RelatedEntityID := p_RelatedEntityID_b436ed19c308, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_b436ed19c308, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_b436ed19c308, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_b436ed19c308, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_b436ed19c308, p_EntityIDFieldName := p_EntityIDFieldName_b436ed19c308, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_b436ed19c308, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_b436ed19c308, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_b436ed19c308, p_Status := p_Status_b436ed19c308, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_b436ed19c308, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_b436ed19c308, p_AutoUpdateCategory := p_AutoUpdateCategory_b436ed19c308, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_b436ed19c308, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_b436ed19c308, p_Encrypt := p_Encrypt_b436ed19c308, p_EncryptionKeyID := p_EncryptionKeyID_b436ed19c308, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_b436ed19c308, p_SendEncryptedValue := p_SendEncryptedValue_b436ed19c308, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_b436ed19c308, p_IsSoftForeignKey := p_IsSoftForeignKey_b436ed19c308, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_b436ed19c308, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_b436ed19c308, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_b436ed19c308, p_JSONTypeDefinition := p_JSONTypeDefinition_b436ed19c308, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_b436ed19c308, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_b436ed19c308, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_b436ed19c308, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_b436ed19c308, p_IsComputed := p_IsComputed_b436ed19c308, p_EmbeddedRecord := p_EmbeddedRecord_b436ed19c308, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_b436ed19c308, p_Configuration_Clear := TRUE, p_ID := p_ID_b436ed19c308);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_f4315ef94831 VARCHAR(255);
  p_Description_f4315ef94831 TEXT;
  p_AutoUpdateDescription_f4315ef94831 BOOLEAN;
  p_IsPrimaryKey_f4315ef94831 BOOLEAN;
  p_IsUnique_f4315ef94831 BOOLEAN;
  p_Category_f4315ef94831 VARCHAR(255);
  p_ValueListType_f4315ef94831 VARCHAR(20);
  p_ExtendedType_f4315ef94831 VARCHAR(50);
  p_CodeType_f4315ef94831 VARCHAR(50);
  p_DefaultInView_f4315ef94831 BOOLEAN;
  p_ViewCellTemplate_f4315ef94831 TEXT;
  p_DefaultColumnWidth_f4315ef94831 INTEGER;
  p_AllowUpdateAPI_f4315ef94831 BOOLEAN;
  p_AllowUpdateInView_f4315ef94831 BOOLEAN;
  p_IncludeInUserSearchAPI_f4315ef94831 BOOLEAN;
  p_FullTextSearchEnabled_f4315ef94831 BOOLEAN;
  p_UserSearchParamFormatAPI_f4315ef94831 VARCHAR(500);
  p_IncludeInGeneratedForm_f4315ef94831 BOOLEAN;
  p_GeneratedFormSection_f4315ef94831 VARCHAR(10);
  p_IsNameField_f4315ef94831 BOOLEAN;
  p_RelatedEntityID_f4315ef94831 UUID;
  p_RelatedEntityFieldName_f4315ef94831 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_f4315ef94831 BOOLEAN;
  p_RelatedEntityNameFieldMap_f4315ef94831 VARCHAR(255);
  p_RelatedEntityDisplayType_f4315ef94831 VARCHAR(20);
  p_EntityIDFieldName_f4315ef94831 VARCHAR(100);
  p_ScopeDefault_f4315ef94831 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_f4315ef94831 BOOLEAN;
  p_ValuesToPackWithSchema_f4315ef94831 VARCHAR(10);
  p_Status_f4315ef94831 VARCHAR(25);
  p_AutoUpdateIsNameField_f4315ef94831 BOOLEAN;
  p_AutoUpdateDefaultInView_f4315ef94831 BOOLEAN;
  p_AutoUpdateCategory_f4315ef94831 BOOLEAN;
  p_AutoUpdateDisplayName_f4315ef94831 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_f4315ef94831 BOOLEAN;
  p_Encrypt_f4315ef94831 BOOLEAN;
  p_EncryptionKeyID_f4315ef94831 UUID;
  p_AllowDecryptInAPI_f4315ef94831 BOOLEAN;
  p_SendEncryptedValue_f4315ef94831 BOOLEAN;
  p_IsSoftPrimaryKey_f4315ef94831 BOOLEAN;
  p_IsSoftForeignKey_f4315ef94831 BOOLEAN;
  p_RelatedEntityJoinFields_f4315ef94831 TEXT;
  p_JSONType_f4315ef94831 VARCHAR(255);
  p_JSONTypeIsArray_f4315ef94831 BOOLEAN;
  p_JSONTypeDefinition_f4315ef94831 TEXT;
  p_UserSearchPredicateAPI_f4315ef94831 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_f4315ef94831 BOOLEAN;
  p_AutoUpdateFullTextSearch_f4315ef94831 BOOLEAN;
  p_AutoUpdateExtendedType_f4315ef94831 BOOLEAN;
  p_IsComputed_f4315ef94831 BOOLEAN;
  p_EmbeddedRecord_f4315ef94831 TEXT;
  p_Configuration_f4315ef94831 TEXT;
  p_ID_f4315ef94831 UUID;
BEGIN
  p_DisplayName_f4315ef94831 := 'MRR';
  p_AutoUpdateDescription_f4315ef94831 := TRUE;
  p_IsPrimaryKey_f4315ef94831 := FALSE;
  p_IsUnique_f4315ef94831 := FALSE;
  p_ValueListType_f4315ef94831 := 'None';
  p_DefaultInView_f4315ef94831 := FALSE;
  p_DefaultColumnWidth_f4315ef94831 := 150;
  p_AllowUpdateAPI_f4315ef94831 := TRUE;
  p_AllowUpdateInView_f4315ef94831 := TRUE;
  p_IncludeInUserSearchAPI_f4315ef94831 := FALSE;
  p_FullTextSearchEnabled_f4315ef94831 := FALSE;
  p_IncludeInGeneratedForm_f4315ef94831 := TRUE;
  p_GeneratedFormSection_f4315ef94831 := 'Details';
  p_IsNameField_f4315ef94831 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_f4315ef94831 := FALSE;
  p_RelatedEntityDisplayType_f4315ef94831 := 'Search';
  p_AutoUpdateRelatedEntityInfo_f4315ef94831 := TRUE;
  p_ValuesToPackWithSchema_f4315ef94831 := 'Auto';
  p_Status_f4315ef94831 := 'Active';
  p_AutoUpdateIsNameField_f4315ef94831 := TRUE;
  p_AutoUpdateDefaultInView_f4315ef94831 := TRUE;
  p_AutoUpdateCategory_f4315ef94831 := TRUE;
  p_AutoUpdateDisplayName_f4315ef94831 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_f4315ef94831 := TRUE;
  p_Encrypt_f4315ef94831 := FALSE;
  p_AllowDecryptInAPI_f4315ef94831 := FALSE;
  p_SendEncryptedValue_f4315ef94831 := FALSE;
  p_IsSoftPrimaryKey_f4315ef94831 := FALSE;
  p_IsSoftForeignKey_f4315ef94831 := FALSE;
  p_JSONTypeIsArray_f4315ef94831 := FALSE;
  p_UserSearchPredicateAPI_f4315ef94831 := 'Contains';
  p_AutoUpdateUserSearchPredicate_f4315ef94831 := TRUE;
  p_AutoUpdateFullTextSearch_f4315ef94831 := TRUE;
  p_AutoUpdateExtendedType_f4315ef94831 := TRUE;
  p_IsComputed_f4315ef94831 := FALSE;
  p_ID_f4315ef94831 := '08642249-6750-452E-A9F8-CA0631A97B66';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_f4315ef94831,
    'Description', p_Description_f4315ef94831,
    'AutoUpdateDescription', p_AutoUpdateDescription_f4315ef94831,
    'IsPrimaryKey', p_IsPrimaryKey_f4315ef94831,
    'IsUnique', p_IsUnique_f4315ef94831,
    'Category', p_Category_f4315ef94831,
    'ValueListType', p_ValueListType_f4315ef94831,
    'ExtendedType', p_ExtendedType_f4315ef94831,
    'CodeType', p_CodeType_f4315ef94831,
    'DefaultInView', p_DefaultInView_f4315ef94831,
    'ViewCellTemplate', p_ViewCellTemplate_f4315ef94831,
    'DefaultColumnWidth', p_DefaultColumnWidth_f4315ef94831,
    'AllowUpdateAPI', p_AllowUpdateAPI_f4315ef94831,
    'AllowUpdateInView', p_AllowUpdateInView_f4315ef94831,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_f4315ef94831,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_f4315ef94831,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_f4315ef94831,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_f4315ef94831,
    'GeneratedFormSection', p_GeneratedFormSection_f4315ef94831,
    'IsNameField', p_IsNameField_f4315ef94831,
    'RelatedEntityID', p_RelatedEntityID_f4315ef94831,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_f4315ef94831,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_f4315ef94831,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_f4315ef94831,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_f4315ef94831,
    'EntityIDFieldName', p_EntityIDFieldName_f4315ef94831,
    'ScopeDefault', p_ScopeDefault_f4315ef94831,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_f4315ef94831,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_f4315ef94831,
    'Status', p_Status_f4315ef94831,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_f4315ef94831,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_f4315ef94831,
    'AutoUpdateCategory', p_AutoUpdateCategory_f4315ef94831,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_f4315ef94831,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_f4315ef94831,
    'Encrypt', p_Encrypt_f4315ef94831,
    'EncryptionKeyID', p_EncryptionKeyID_f4315ef94831,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_f4315ef94831,
    'SendEncryptedValue', p_SendEncryptedValue_f4315ef94831,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_f4315ef94831,
    'IsSoftForeignKey', p_IsSoftForeignKey_f4315ef94831,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_f4315ef94831,
    'JSONType', p_JSONType_f4315ef94831,
    'JSONTypeIsArray', p_JSONTypeIsArray_f4315ef94831,
    'JSONTypeDefinition', p_JSONTypeDefinition_f4315ef94831,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_f4315ef94831,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_f4315ef94831,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_f4315ef94831,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_f4315ef94831,
    'IsComputed', p_IsComputed_f4315ef94831
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_f4315ef94831,
    'Configuration', p_Configuration_f4315ef94831,
    'ID', p_ID_f4315ef94831
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_f4315ef94831, p_Description := p_Description_f4315ef94831, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_f4315ef94831, p_IsPrimaryKey := p_IsPrimaryKey_f4315ef94831, p_IsUnique := p_IsUnique_f4315ef94831, p_Category := p_Category_f4315ef94831, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_f4315ef94831, p_ExtendedType := p_ExtendedType_f4315ef94831, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_f4315ef94831, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_f4315ef94831, p_ViewCellTemplate := p_ViewCellTemplate_f4315ef94831, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_f4315ef94831, p_AllowUpdateAPI := p_AllowUpdateAPI_f4315ef94831, p_AllowUpdateInView := p_AllowUpdateInView_f4315ef94831, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_f4315ef94831, p_FullTextSearchEnabled := p_FullTextSearchEnabled_f4315ef94831, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_f4315ef94831, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_f4315ef94831, p_GeneratedFormSection := p_GeneratedFormSection_f4315ef94831, p_IsNameField := p_IsNameField_f4315ef94831, p_RelatedEntityID := p_RelatedEntityID_f4315ef94831, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_f4315ef94831, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_f4315ef94831, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_f4315ef94831, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_f4315ef94831, p_EntityIDFieldName := p_EntityIDFieldName_f4315ef94831, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_f4315ef94831, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_f4315ef94831, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_f4315ef94831, p_Status := p_Status_f4315ef94831, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_f4315ef94831, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_f4315ef94831, p_AutoUpdateCategory := p_AutoUpdateCategory_f4315ef94831, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_f4315ef94831, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_f4315ef94831, p_Encrypt := p_Encrypt_f4315ef94831, p_EncryptionKeyID := p_EncryptionKeyID_f4315ef94831, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_f4315ef94831, p_SendEncryptedValue := p_SendEncryptedValue_f4315ef94831, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_f4315ef94831, p_IsSoftForeignKey := p_IsSoftForeignKey_f4315ef94831, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_f4315ef94831, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_f4315ef94831, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_f4315ef94831, p_JSONTypeDefinition := p_JSONTypeDefinition_f4315ef94831, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_f4315ef94831, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_f4315ef94831, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_f4315ef94831, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_f4315ef94831, p_IsComputed := p_IsComputed_f4315ef94831, p_EmbeddedRecord := p_EmbeddedRecord_f4315ef94831, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_f4315ef94831, p_Configuration_Clear := TRUE, p_ID := p_ID_f4315ef94831);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e0db98a47397 VARCHAR(255);
  p_Description_e0db98a47397 TEXT;
  p_AutoUpdateDescription_e0db98a47397 BOOLEAN;
  p_IsPrimaryKey_e0db98a47397 BOOLEAN;
  p_IsUnique_e0db98a47397 BOOLEAN;
  p_Category_e0db98a47397 VARCHAR(255);
  p_ValueListType_e0db98a47397 VARCHAR(20);
  p_ExtendedType_e0db98a47397 VARCHAR(50);
  p_CodeType_e0db98a47397 VARCHAR(50);
  p_DefaultInView_e0db98a47397 BOOLEAN;
  p_ViewCellTemplate_e0db98a47397 TEXT;
  p_DefaultColumnWidth_e0db98a47397 INTEGER;
  p_AllowUpdateAPI_e0db98a47397 BOOLEAN;
  p_AllowUpdateInView_e0db98a47397 BOOLEAN;
  p_IncludeInUserSearchAPI_e0db98a47397 BOOLEAN;
  p_FullTextSearchEnabled_e0db98a47397 BOOLEAN;
  p_UserSearchParamFormatAPI_e0db98a47397 VARCHAR(500);
  p_IncludeInGeneratedForm_e0db98a47397 BOOLEAN;
  p_GeneratedFormSection_e0db98a47397 VARCHAR(10);
  p_IsNameField_e0db98a47397 BOOLEAN;
  p_RelatedEntityID_e0db98a47397 UUID;
  p_RelatedEntityFieldName_e0db98a47397 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e0db98a47397 BOOLEAN;
  p_RelatedEntityNameFieldMap_e0db98a47397 VARCHAR(255);
  p_RelatedEntityDisplayType_e0db98a47397 VARCHAR(20);
  p_EntityIDFieldName_e0db98a47397 VARCHAR(100);
  p_ScopeDefault_e0db98a47397 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e0db98a47397 BOOLEAN;
  p_ValuesToPackWithSchema_e0db98a47397 VARCHAR(10);
  p_Status_e0db98a47397 VARCHAR(25);
  p_AutoUpdateIsNameField_e0db98a47397 BOOLEAN;
  p_AutoUpdateDefaultInView_e0db98a47397 BOOLEAN;
  p_AutoUpdateCategory_e0db98a47397 BOOLEAN;
  p_AutoUpdateDisplayName_e0db98a47397 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e0db98a47397 BOOLEAN;
  p_Encrypt_e0db98a47397 BOOLEAN;
  p_EncryptionKeyID_e0db98a47397 UUID;
  p_AllowDecryptInAPI_e0db98a47397 BOOLEAN;
  p_SendEncryptedValue_e0db98a47397 BOOLEAN;
  p_IsSoftPrimaryKey_e0db98a47397 BOOLEAN;
  p_IsSoftForeignKey_e0db98a47397 BOOLEAN;
  p_RelatedEntityJoinFields_e0db98a47397 TEXT;
  p_JSONType_e0db98a47397 VARCHAR(255);
  p_JSONTypeIsArray_e0db98a47397 BOOLEAN;
  p_JSONTypeDefinition_e0db98a47397 TEXT;
  p_UserSearchPredicateAPI_e0db98a47397 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e0db98a47397 BOOLEAN;
  p_AutoUpdateFullTextSearch_e0db98a47397 BOOLEAN;
  p_AutoUpdateExtendedType_e0db98a47397 BOOLEAN;
  p_IsComputed_e0db98a47397 BOOLEAN;
  p_EmbeddedRecord_e0db98a47397 TEXT;
  p_Configuration_e0db98a47397 TEXT;
  p_ID_e0db98a47397 UUID;
BEGIN
  p_DisplayName_e0db98a47397 := 'ARR';
  p_AutoUpdateDescription_e0db98a47397 := TRUE;
  p_IsPrimaryKey_e0db98a47397 := FALSE;
  p_IsUnique_e0db98a47397 := FALSE;
  p_ValueListType_e0db98a47397 := 'None';
  p_DefaultInView_e0db98a47397 := FALSE;
  p_DefaultColumnWidth_e0db98a47397 := 150;
  p_AllowUpdateAPI_e0db98a47397 := TRUE;
  p_AllowUpdateInView_e0db98a47397 := TRUE;
  p_IncludeInUserSearchAPI_e0db98a47397 := FALSE;
  p_FullTextSearchEnabled_e0db98a47397 := FALSE;
  p_IncludeInGeneratedForm_e0db98a47397 := TRUE;
  p_GeneratedFormSection_e0db98a47397 := 'Details';
  p_IsNameField_e0db98a47397 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_e0db98a47397 := FALSE;
  p_RelatedEntityDisplayType_e0db98a47397 := 'Search';
  p_AutoUpdateRelatedEntityInfo_e0db98a47397 := TRUE;
  p_ValuesToPackWithSchema_e0db98a47397 := 'Auto';
  p_Status_e0db98a47397 := 'Active';
  p_AutoUpdateIsNameField_e0db98a47397 := TRUE;
  p_AutoUpdateDefaultInView_e0db98a47397 := TRUE;
  p_AutoUpdateCategory_e0db98a47397 := TRUE;
  p_AutoUpdateDisplayName_e0db98a47397 := FALSE;
  p_AutoUpdateIncludeInUserSearchAPI_e0db98a47397 := TRUE;
  p_Encrypt_e0db98a47397 := FALSE;
  p_AllowDecryptInAPI_e0db98a47397 := FALSE;
  p_SendEncryptedValue_e0db98a47397 := FALSE;
  p_IsSoftPrimaryKey_e0db98a47397 := FALSE;
  p_IsSoftForeignKey_e0db98a47397 := FALSE;
  p_JSONTypeIsArray_e0db98a47397 := FALSE;
  p_UserSearchPredicateAPI_e0db98a47397 := 'Contains';
  p_AutoUpdateUserSearchPredicate_e0db98a47397 := TRUE;
  p_AutoUpdateFullTextSearch_e0db98a47397 := TRUE;
  p_AutoUpdateExtendedType_e0db98a47397 := TRUE;
  p_IsComputed_e0db98a47397 := FALSE;
  p_ID_e0db98a47397 := 'C32126DE-530E-4A16-BD14-979B5B816321';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e0db98a47397,
    'Description', p_Description_e0db98a47397,
    'AutoUpdateDescription', p_AutoUpdateDescription_e0db98a47397,
    'IsPrimaryKey', p_IsPrimaryKey_e0db98a47397,
    'IsUnique', p_IsUnique_e0db98a47397,
    'Category', p_Category_e0db98a47397,
    'ValueListType', p_ValueListType_e0db98a47397,
    'ExtendedType', p_ExtendedType_e0db98a47397,
    'CodeType', p_CodeType_e0db98a47397,
    'DefaultInView', p_DefaultInView_e0db98a47397,
    'ViewCellTemplate', p_ViewCellTemplate_e0db98a47397,
    'DefaultColumnWidth', p_DefaultColumnWidth_e0db98a47397,
    'AllowUpdateAPI', p_AllowUpdateAPI_e0db98a47397,
    'AllowUpdateInView', p_AllowUpdateInView_e0db98a47397,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e0db98a47397,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e0db98a47397,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e0db98a47397,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e0db98a47397,
    'GeneratedFormSection', p_GeneratedFormSection_e0db98a47397,
    'IsNameField', p_IsNameField_e0db98a47397,
    'RelatedEntityID', p_RelatedEntityID_e0db98a47397,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e0db98a47397,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e0db98a47397,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e0db98a47397,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e0db98a47397,
    'EntityIDFieldName', p_EntityIDFieldName_e0db98a47397,
    'ScopeDefault', p_ScopeDefault_e0db98a47397,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e0db98a47397,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e0db98a47397,
    'Status', p_Status_e0db98a47397,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e0db98a47397,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e0db98a47397,
    'AutoUpdateCategory', p_AutoUpdateCategory_e0db98a47397,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e0db98a47397,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e0db98a47397,
    'Encrypt', p_Encrypt_e0db98a47397,
    'EncryptionKeyID', p_EncryptionKeyID_e0db98a47397,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e0db98a47397,
    'SendEncryptedValue', p_SendEncryptedValue_e0db98a47397,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e0db98a47397,
    'IsSoftForeignKey', p_IsSoftForeignKey_e0db98a47397,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e0db98a47397,
    'JSONType', p_JSONType_e0db98a47397,
    'JSONTypeIsArray', p_JSONTypeIsArray_e0db98a47397,
    'JSONTypeDefinition', p_JSONTypeDefinition_e0db98a47397,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e0db98a47397,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e0db98a47397,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e0db98a47397,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e0db98a47397,
    'IsComputed', p_IsComputed_e0db98a47397
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e0db98a47397,
    'Configuration', p_Configuration_e0db98a47397,
    'ID', p_ID_e0db98a47397
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_e0db98a47397, p_Description := p_Description_e0db98a47397, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e0db98a47397, p_IsPrimaryKey := p_IsPrimaryKey_e0db98a47397, p_IsUnique := p_IsUnique_e0db98a47397, p_Category := p_Category_e0db98a47397, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_e0db98a47397, p_ExtendedType := p_ExtendedType_e0db98a47397, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e0db98a47397, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e0db98a47397, p_ViewCellTemplate := p_ViewCellTemplate_e0db98a47397, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e0db98a47397, p_AllowUpdateAPI := p_AllowUpdateAPI_e0db98a47397, p_AllowUpdateInView := p_AllowUpdateInView_e0db98a47397, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e0db98a47397, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e0db98a47397, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e0db98a47397, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e0db98a47397, p_GeneratedFormSection := p_GeneratedFormSection_e0db98a47397, p_IsNameField := p_IsNameField_e0db98a47397, p_RelatedEntityID := p_RelatedEntityID_e0db98a47397, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e0db98a47397, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e0db98a47397, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e0db98a47397, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e0db98a47397, p_EntityIDFieldName := p_EntityIDFieldName_e0db98a47397, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e0db98a47397, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e0db98a47397, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e0db98a47397, p_Status := p_Status_e0db98a47397, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e0db98a47397, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e0db98a47397, p_AutoUpdateCategory := p_AutoUpdateCategory_e0db98a47397, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e0db98a47397, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e0db98a47397, p_Encrypt := p_Encrypt_e0db98a47397, p_EncryptionKeyID := p_EncryptionKeyID_e0db98a47397, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e0db98a47397, p_SendEncryptedValue := p_SendEncryptedValue_e0db98a47397, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e0db98a47397, p_IsSoftForeignKey := p_IsSoftForeignKey_e0db98a47397, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e0db98a47397, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e0db98a47397, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e0db98a47397, p_JSONTypeDefinition := p_JSONTypeDefinition_e0db98a47397, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e0db98a47397, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e0db98a47397, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e0db98a47397, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e0db98a47397, p_IsComputed := p_IsComputed_e0db98a47397, p_EmbeddedRecord := p_EmbeddedRecord_e0db98a47397, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e0db98a47397, p_Configuration_Clear := TRUE, p_ID := p_ID_e0db98a47397);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_048aaf4f40fd VARCHAR(255);
  p_Description_048aaf4f40fd TEXT;
  p_AutoUpdateDescription_048aaf4f40fd BOOLEAN;
  p_IsPrimaryKey_048aaf4f40fd BOOLEAN;
  p_IsUnique_048aaf4f40fd BOOLEAN;
  p_Category_048aaf4f40fd VARCHAR(255);
  p_ValueListType_048aaf4f40fd VARCHAR(20);
  p_ExtendedType_048aaf4f40fd VARCHAR(50);
  p_CodeType_048aaf4f40fd VARCHAR(50);
  p_DefaultInView_048aaf4f40fd BOOLEAN;
  p_ViewCellTemplate_048aaf4f40fd TEXT;
  p_DefaultColumnWidth_048aaf4f40fd INTEGER;
  p_AllowUpdateAPI_048aaf4f40fd BOOLEAN;
  p_AllowUpdateInView_048aaf4f40fd BOOLEAN;
  p_IncludeInUserSearchAPI_048aaf4f40fd BOOLEAN;
  p_FullTextSearchEnabled_048aaf4f40fd BOOLEAN;
  p_UserSearchParamFormatAPI_048aaf4f40fd VARCHAR(500);
  p_IncludeInGeneratedForm_048aaf4f40fd BOOLEAN;
  p_GeneratedFormSection_048aaf4f40fd VARCHAR(10);
  p_IsNameField_048aaf4f40fd BOOLEAN;
  p_RelatedEntityID_048aaf4f40fd UUID;
  p_RelatedEntityFieldName_048aaf4f40fd VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_048aaf4f40fd BOOLEAN;
  p_RelatedEntityNameFieldMap_048aaf4f40fd VARCHAR(255);
  p_RelatedEntityDisplayType_048aaf4f40fd VARCHAR(20);
  p_EntityIDFieldName_048aaf4f40fd VARCHAR(100);
  p_ScopeDefault_048aaf4f40fd VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_048aaf4f40fd BOOLEAN;
  p_ValuesToPackWithSchema_048aaf4f40fd VARCHAR(10);
  p_Status_048aaf4f40fd VARCHAR(25);
  p_AutoUpdateIsNameField_048aaf4f40fd BOOLEAN;
  p_AutoUpdateDefaultInView_048aaf4f40fd BOOLEAN;
  p_AutoUpdateCategory_048aaf4f40fd BOOLEAN;
  p_AutoUpdateDisplayName_048aaf4f40fd BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_048aaf4f40fd BOOLEAN;
  p_Encrypt_048aaf4f40fd BOOLEAN;
  p_EncryptionKeyID_048aaf4f40fd UUID;
  p_AllowDecryptInAPI_048aaf4f40fd BOOLEAN;
  p_SendEncryptedValue_048aaf4f40fd BOOLEAN;
  p_IsSoftPrimaryKey_048aaf4f40fd BOOLEAN;
  p_IsSoftForeignKey_048aaf4f40fd BOOLEAN;
  p_RelatedEntityJoinFields_048aaf4f40fd TEXT;
  p_JSONType_048aaf4f40fd VARCHAR(255);
  p_JSONTypeIsArray_048aaf4f40fd BOOLEAN;
  p_JSONTypeDefinition_048aaf4f40fd TEXT;
  p_UserSearchPredicateAPI_048aaf4f40fd VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_048aaf4f40fd BOOLEAN;
  p_AutoUpdateFullTextSearch_048aaf4f40fd BOOLEAN;
  p_AutoUpdateExtendedType_048aaf4f40fd BOOLEAN;
  p_IsComputed_048aaf4f40fd BOOLEAN;
  p_EmbeddedRecord_048aaf4f40fd TEXT;
  p_Configuration_048aaf4f40fd TEXT;
  p_ID_048aaf4f40fd UUID;
BEGIN
  p_DisplayName_048aaf4f40fd := 'Organization Type ID';
  p_AutoUpdateDescription_048aaf4f40fd := TRUE;
  p_IsPrimaryKey_048aaf4f40fd := FALSE;
  p_IsUnique_048aaf4f40fd := FALSE;
  p_ValueListType_048aaf4f40fd := 'None';
  p_DefaultInView_048aaf4f40fd := FALSE;
  p_DefaultColumnWidth_048aaf4f40fd := 150;
  p_AllowUpdateAPI_048aaf4f40fd := TRUE;
  p_AllowUpdateInView_048aaf4f40fd := TRUE;
  p_IncludeInUserSearchAPI_048aaf4f40fd := FALSE;
  p_FullTextSearchEnabled_048aaf4f40fd := FALSE;
  p_IncludeInGeneratedForm_048aaf4f40fd := TRUE;
  p_GeneratedFormSection_048aaf4f40fd := 'Details';
  p_IsNameField_048aaf4f40fd := FALSE;
  p_RelatedEntityID_048aaf4f40fd := 'A77D9725-4871-484B-99F0-F65461D7ABEE';
  p_IncludeRelatedEntityNameFieldInBaseView_048aaf4f40fd := FALSE;
  p_RelatedEntityNameFieldMap_048aaf4f40fd := 'OrganizationType';
  p_RelatedEntityDisplayType_048aaf4f40fd := 'Search';
  p_AutoUpdateRelatedEntityInfo_048aaf4f40fd := FALSE;
  p_ValuesToPackWithSchema_048aaf4f40fd := 'Auto';
  p_Status_048aaf4f40fd := 'Active';
  p_AutoUpdateIsNameField_048aaf4f40fd := TRUE;
  p_AutoUpdateDefaultInView_048aaf4f40fd := TRUE;
  p_AutoUpdateCategory_048aaf4f40fd := TRUE;
  p_AutoUpdateDisplayName_048aaf4f40fd := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_048aaf4f40fd := TRUE;
  p_Encrypt_048aaf4f40fd := FALSE;
  p_AllowDecryptInAPI_048aaf4f40fd := FALSE;
  p_SendEncryptedValue_048aaf4f40fd := FALSE;
  p_IsSoftPrimaryKey_048aaf4f40fd := FALSE;
  p_IsSoftForeignKey_048aaf4f40fd := FALSE;
  p_JSONTypeIsArray_048aaf4f40fd := FALSE;
  p_UserSearchPredicateAPI_048aaf4f40fd := 'Contains';
  p_AutoUpdateUserSearchPredicate_048aaf4f40fd := TRUE;
  p_AutoUpdateFullTextSearch_048aaf4f40fd := TRUE;
  p_AutoUpdateExtendedType_048aaf4f40fd := TRUE;
  p_IsComputed_048aaf4f40fd := FALSE;
  p_ID_048aaf4f40fd := 'B7C7DD83-392B-4326-AFF6-9B57C8B29E40';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_048aaf4f40fd,
    'Description', p_Description_048aaf4f40fd,
    'AutoUpdateDescription', p_AutoUpdateDescription_048aaf4f40fd,
    'IsPrimaryKey', p_IsPrimaryKey_048aaf4f40fd,
    'IsUnique', p_IsUnique_048aaf4f40fd,
    'Category', p_Category_048aaf4f40fd,
    'ValueListType', p_ValueListType_048aaf4f40fd,
    'ExtendedType', p_ExtendedType_048aaf4f40fd,
    'CodeType', p_CodeType_048aaf4f40fd,
    'DefaultInView', p_DefaultInView_048aaf4f40fd,
    'ViewCellTemplate', p_ViewCellTemplate_048aaf4f40fd,
    'DefaultColumnWidth', p_DefaultColumnWidth_048aaf4f40fd,
    'AllowUpdateAPI', p_AllowUpdateAPI_048aaf4f40fd,
    'AllowUpdateInView', p_AllowUpdateInView_048aaf4f40fd,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_048aaf4f40fd,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_048aaf4f40fd,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_048aaf4f40fd,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_048aaf4f40fd,
    'GeneratedFormSection', p_GeneratedFormSection_048aaf4f40fd,
    'IsNameField', p_IsNameField_048aaf4f40fd,
    'RelatedEntityID', p_RelatedEntityID_048aaf4f40fd,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_048aaf4f40fd,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_048aaf4f40fd,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_048aaf4f40fd,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_048aaf4f40fd,
    'EntityIDFieldName', p_EntityIDFieldName_048aaf4f40fd,
    'ScopeDefault', p_ScopeDefault_048aaf4f40fd,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_048aaf4f40fd,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_048aaf4f40fd,
    'Status', p_Status_048aaf4f40fd,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_048aaf4f40fd,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_048aaf4f40fd,
    'AutoUpdateCategory', p_AutoUpdateCategory_048aaf4f40fd,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_048aaf4f40fd,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_048aaf4f40fd,
    'Encrypt', p_Encrypt_048aaf4f40fd,
    'EncryptionKeyID', p_EncryptionKeyID_048aaf4f40fd,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_048aaf4f40fd,
    'SendEncryptedValue', p_SendEncryptedValue_048aaf4f40fd,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_048aaf4f40fd,
    'IsSoftForeignKey', p_IsSoftForeignKey_048aaf4f40fd,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_048aaf4f40fd,
    'JSONType', p_JSONType_048aaf4f40fd,
    'JSONTypeIsArray', p_JSONTypeIsArray_048aaf4f40fd,
    'JSONTypeDefinition', p_JSONTypeDefinition_048aaf4f40fd,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_048aaf4f40fd,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_048aaf4f40fd,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_048aaf4f40fd,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_048aaf4f40fd,
    'IsComputed', p_IsComputed_048aaf4f40fd
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_048aaf4f40fd,
    'Configuration', p_Configuration_048aaf4f40fd,
    'ID', p_ID_048aaf4f40fd
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_048aaf4f40fd, p_Description := p_Description_048aaf4f40fd, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_048aaf4f40fd, p_IsPrimaryKey := p_IsPrimaryKey_048aaf4f40fd, p_IsUnique := p_IsUnique_048aaf4f40fd, p_Category := p_Category_048aaf4f40fd, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_048aaf4f40fd, p_ExtendedType := p_ExtendedType_048aaf4f40fd, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_048aaf4f40fd, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_048aaf4f40fd, p_ViewCellTemplate := p_ViewCellTemplate_048aaf4f40fd, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_048aaf4f40fd, p_AllowUpdateAPI := p_AllowUpdateAPI_048aaf4f40fd, p_AllowUpdateInView := p_AllowUpdateInView_048aaf4f40fd, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_048aaf4f40fd, p_FullTextSearchEnabled := p_FullTextSearchEnabled_048aaf4f40fd, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_048aaf4f40fd, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_048aaf4f40fd, p_GeneratedFormSection := p_GeneratedFormSection_048aaf4f40fd, p_IsNameField := p_IsNameField_048aaf4f40fd, p_RelatedEntityID := p_RelatedEntityID_048aaf4f40fd, p_RelatedEntityFieldName := p_RelatedEntityFieldName_048aaf4f40fd, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_048aaf4f40fd, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_048aaf4f40fd, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_048aaf4f40fd, p_EntityIDFieldName := p_EntityIDFieldName_048aaf4f40fd, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_048aaf4f40fd, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_048aaf4f40fd, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_048aaf4f40fd, p_Status := p_Status_048aaf4f40fd, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_048aaf4f40fd, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_048aaf4f40fd, p_AutoUpdateCategory := p_AutoUpdateCategory_048aaf4f40fd, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_048aaf4f40fd, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_048aaf4f40fd, p_Encrypt := p_Encrypt_048aaf4f40fd, p_EncryptionKeyID := p_EncryptionKeyID_048aaf4f40fd, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_048aaf4f40fd, p_SendEncryptedValue := p_SendEncryptedValue_048aaf4f40fd, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_048aaf4f40fd, p_IsSoftForeignKey := p_IsSoftForeignKey_048aaf4f40fd, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_048aaf4f40fd, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_048aaf4f40fd, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_048aaf4f40fd, p_JSONTypeDefinition := p_JSONTypeDefinition_048aaf4f40fd, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_048aaf4f40fd, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_048aaf4f40fd, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_048aaf4f40fd, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_048aaf4f40fd, p_IsComputed := p_IsComputed_048aaf4f40fd, p_EmbeddedRecord := p_EmbeddedRecord_048aaf4f40fd, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_048aaf4f40fd, p_Configuration_Clear := TRUE, p_ID := p_ID_048aaf4f40fd);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_92f030b2f1b0 VARCHAR(255);
  p_Description_92f030b2f1b0 TEXT;
  p_AutoUpdateDescription_92f030b2f1b0 BOOLEAN;
  p_IsPrimaryKey_92f030b2f1b0 BOOLEAN;
  p_IsUnique_92f030b2f1b0 BOOLEAN;
  p_Category_92f030b2f1b0 VARCHAR(255);
  p_ValueListType_92f030b2f1b0 VARCHAR(20);
  p_ExtendedType_92f030b2f1b0 VARCHAR(50);
  p_CodeType_92f030b2f1b0 VARCHAR(50);
  p_DefaultInView_92f030b2f1b0 BOOLEAN;
  p_ViewCellTemplate_92f030b2f1b0 TEXT;
  p_DefaultColumnWidth_92f030b2f1b0 INTEGER;
  p_AllowUpdateAPI_92f030b2f1b0 BOOLEAN;
  p_AllowUpdateInView_92f030b2f1b0 BOOLEAN;
  p_IncludeInUserSearchAPI_92f030b2f1b0 BOOLEAN;
  p_FullTextSearchEnabled_92f030b2f1b0 BOOLEAN;
  p_UserSearchParamFormatAPI_92f030b2f1b0 VARCHAR(500);
  p_IncludeInGeneratedForm_92f030b2f1b0 BOOLEAN;
  p_GeneratedFormSection_92f030b2f1b0 VARCHAR(10);
  p_IsNameField_92f030b2f1b0 BOOLEAN;
  p_RelatedEntityID_92f030b2f1b0 UUID;
  p_RelatedEntityFieldName_92f030b2f1b0 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_92f030b2f1b0 BOOLEAN;
  p_RelatedEntityNameFieldMap_92f030b2f1b0 VARCHAR(255);
  p_RelatedEntityDisplayType_92f030b2f1b0 VARCHAR(20);
  p_EntityIDFieldName_92f030b2f1b0 VARCHAR(100);
  p_ScopeDefault_92f030b2f1b0 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_92f030b2f1b0 BOOLEAN;
  p_ValuesToPackWithSchema_92f030b2f1b0 VARCHAR(10);
  p_Status_92f030b2f1b0 VARCHAR(25);
  p_AutoUpdateIsNameField_92f030b2f1b0 BOOLEAN;
  p_AutoUpdateDefaultInView_92f030b2f1b0 BOOLEAN;
  p_AutoUpdateCategory_92f030b2f1b0 BOOLEAN;
  p_AutoUpdateDisplayName_92f030b2f1b0 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_92f030b2f1b0 BOOLEAN;
  p_Encrypt_92f030b2f1b0 BOOLEAN;
  p_EncryptionKeyID_92f030b2f1b0 UUID;
  p_AllowDecryptInAPI_92f030b2f1b0 BOOLEAN;
  p_SendEncryptedValue_92f030b2f1b0 BOOLEAN;
  p_IsSoftPrimaryKey_92f030b2f1b0 BOOLEAN;
  p_IsSoftForeignKey_92f030b2f1b0 BOOLEAN;
  p_RelatedEntityJoinFields_92f030b2f1b0 TEXT;
  p_JSONType_92f030b2f1b0 VARCHAR(255);
  p_JSONTypeIsArray_92f030b2f1b0 BOOLEAN;
  p_JSONTypeDefinition_92f030b2f1b0 TEXT;
  p_UserSearchPredicateAPI_92f030b2f1b0 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_92f030b2f1b0 BOOLEAN;
  p_AutoUpdateFullTextSearch_92f030b2f1b0 BOOLEAN;
  p_AutoUpdateExtendedType_92f030b2f1b0 BOOLEAN;
  p_IsComputed_92f030b2f1b0 BOOLEAN;
  p_EmbeddedRecord_92f030b2f1b0 TEXT;
  p_Configuration_92f030b2f1b0 TEXT;
  p_ID_92f030b2f1b0 UUID;
BEGIN
  p_DisplayName_92f030b2f1b0 := 'Parent ID';
  p_AutoUpdateDescription_92f030b2f1b0 := TRUE;
  p_IsPrimaryKey_92f030b2f1b0 := FALSE;
  p_IsUnique_92f030b2f1b0 := FALSE;
  p_ValueListType_92f030b2f1b0 := 'None';
  p_DefaultInView_92f030b2f1b0 := FALSE;
  p_DefaultColumnWidth_92f030b2f1b0 := 150;
  p_AllowUpdateAPI_92f030b2f1b0 := TRUE;
  p_AllowUpdateInView_92f030b2f1b0 := TRUE;
  p_IncludeInUserSearchAPI_92f030b2f1b0 := FALSE;
  p_FullTextSearchEnabled_92f030b2f1b0 := FALSE;
  p_IncludeInGeneratedForm_92f030b2f1b0 := TRUE;
  p_GeneratedFormSection_92f030b2f1b0 := 'Details';
  p_IsNameField_92f030b2f1b0 := FALSE;
  p_RelatedEntityID_92f030b2f1b0 := 'C70448F9-9792-41D7-A82C-784B66429D54';
  p_IncludeRelatedEntityNameFieldInBaseView_92f030b2f1b0 := FALSE;
  p_RelatedEntityNameFieldMap_92f030b2f1b0 := 'Parent';
  p_RelatedEntityDisplayType_92f030b2f1b0 := 'Search';
  p_AutoUpdateRelatedEntityInfo_92f030b2f1b0 := FALSE;
  p_ValuesToPackWithSchema_92f030b2f1b0 := 'Auto';
  p_Status_92f030b2f1b0 := 'Active';
  p_AutoUpdateIsNameField_92f030b2f1b0 := TRUE;
  p_AutoUpdateDefaultInView_92f030b2f1b0 := TRUE;
  p_AutoUpdateCategory_92f030b2f1b0 := TRUE;
  p_AutoUpdateDisplayName_92f030b2f1b0 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_92f030b2f1b0 := TRUE;
  p_Encrypt_92f030b2f1b0 := FALSE;
  p_AllowDecryptInAPI_92f030b2f1b0 := FALSE;
  p_SendEncryptedValue_92f030b2f1b0 := FALSE;
  p_IsSoftPrimaryKey_92f030b2f1b0 := FALSE;
  p_IsSoftForeignKey_92f030b2f1b0 := FALSE;
  p_JSONTypeIsArray_92f030b2f1b0 := FALSE;
  p_UserSearchPredicateAPI_92f030b2f1b0 := 'Contains';
  p_AutoUpdateUserSearchPredicate_92f030b2f1b0 := TRUE;
  p_AutoUpdateFullTextSearch_92f030b2f1b0 := TRUE;
  p_AutoUpdateExtendedType_92f030b2f1b0 := TRUE;
  p_IsComputed_92f030b2f1b0 := FALSE;
  p_ID_92f030b2f1b0 := '35E3A619-36ED-4DCE-AC9C-2F2C22BD7ACB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_92f030b2f1b0,
    'Description', p_Description_92f030b2f1b0,
    'AutoUpdateDescription', p_AutoUpdateDescription_92f030b2f1b0,
    'IsPrimaryKey', p_IsPrimaryKey_92f030b2f1b0,
    'IsUnique', p_IsUnique_92f030b2f1b0,
    'Category', p_Category_92f030b2f1b0,
    'ValueListType', p_ValueListType_92f030b2f1b0,
    'ExtendedType', p_ExtendedType_92f030b2f1b0,
    'CodeType', p_CodeType_92f030b2f1b0,
    'DefaultInView', p_DefaultInView_92f030b2f1b0,
    'ViewCellTemplate', p_ViewCellTemplate_92f030b2f1b0,
    'DefaultColumnWidth', p_DefaultColumnWidth_92f030b2f1b0,
    'AllowUpdateAPI', p_AllowUpdateAPI_92f030b2f1b0,
    'AllowUpdateInView', p_AllowUpdateInView_92f030b2f1b0,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_92f030b2f1b0,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_92f030b2f1b0,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_92f030b2f1b0,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_92f030b2f1b0,
    'GeneratedFormSection', p_GeneratedFormSection_92f030b2f1b0,
    'IsNameField', p_IsNameField_92f030b2f1b0,
    'RelatedEntityID', p_RelatedEntityID_92f030b2f1b0,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_92f030b2f1b0,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_92f030b2f1b0,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_92f030b2f1b0,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_92f030b2f1b0,
    'EntityIDFieldName', p_EntityIDFieldName_92f030b2f1b0,
    'ScopeDefault', p_ScopeDefault_92f030b2f1b0,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_92f030b2f1b0,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_92f030b2f1b0,
    'Status', p_Status_92f030b2f1b0,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_92f030b2f1b0,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_92f030b2f1b0,
    'AutoUpdateCategory', p_AutoUpdateCategory_92f030b2f1b0,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_92f030b2f1b0,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_92f030b2f1b0,
    'Encrypt', p_Encrypt_92f030b2f1b0,
    'EncryptionKeyID', p_EncryptionKeyID_92f030b2f1b0,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_92f030b2f1b0,
    'SendEncryptedValue', p_SendEncryptedValue_92f030b2f1b0,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_92f030b2f1b0,
    'IsSoftForeignKey', p_IsSoftForeignKey_92f030b2f1b0,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_92f030b2f1b0,
    'JSONType', p_JSONType_92f030b2f1b0,
    'JSONTypeIsArray', p_JSONTypeIsArray_92f030b2f1b0,
    'JSONTypeDefinition', p_JSONTypeDefinition_92f030b2f1b0,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_92f030b2f1b0,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_92f030b2f1b0,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_92f030b2f1b0,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_92f030b2f1b0,
    'IsComputed', p_IsComputed_92f030b2f1b0
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_92f030b2f1b0,
    'Configuration', p_Configuration_92f030b2f1b0,
    'ID', p_ID_92f030b2f1b0
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_92f030b2f1b0, p_Description := p_Description_92f030b2f1b0, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_92f030b2f1b0, p_IsPrimaryKey := p_IsPrimaryKey_92f030b2f1b0, p_IsUnique := p_IsUnique_92f030b2f1b0, p_Category := p_Category_92f030b2f1b0, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_92f030b2f1b0, p_ExtendedType := p_ExtendedType_92f030b2f1b0, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_92f030b2f1b0, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_92f030b2f1b0, p_ViewCellTemplate := p_ViewCellTemplate_92f030b2f1b0, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_92f030b2f1b0, p_AllowUpdateAPI := p_AllowUpdateAPI_92f030b2f1b0, p_AllowUpdateInView := p_AllowUpdateInView_92f030b2f1b0, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_92f030b2f1b0, p_FullTextSearchEnabled := p_FullTextSearchEnabled_92f030b2f1b0, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_92f030b2f1b0, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_92f030b2f1b0, p_GeneratedFormSection := p_GeneratedFormSection_92f030b2f1b0, p_IsNameField := p_IsNameField_92f030b2f1b0, p_RelatedEntityID := p_RelatedEntityID_92f030b2f1b0, p_RelatedEntityFieldName := p_RelatedEntityFieldName_92f030b2f1b0, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_92f030b2f1b0, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_92f030b2f1b0, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_92f030b2f1b0, p_EntityIDFieldName := p_EntityIDFieldName_92f030b2f1b0, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_92f030b2f1b0, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_92f030b2f1b0, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_92f030b2f1b0, p_Status := p_Status_92f030b2f1b0, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_92f030b2f1b0, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_92f030b2f1b0, p_AutoUpdateCategory := p_AutoUpdateCategory_92f030b2f1b0, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_92f030b2f1b0, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_92f030b2f1b0, p_Encrypt := p_Encrypt_92f030b2f1b0, p_EncryptionKeyID := p_EncryptionKeyID_92f030b2f1b0, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_92f030b2f1b0, p_SendEncryptedValue := p_SendEncryptedValue_92f030b2f1b0, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_92f030b2f1b0, p_IsSoftForeignKey := p_IsSoftForeignKey_92f030b2f1b0, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_92f030b2f1b0, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_92f030b2f1b0, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_92f030b2f1b0, p_JSONTypeDefinition := p_JSONTypeDefinition_92f030b2f1b0, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_92f030b2f1b0, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_92f030b2f1b0, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_92f030b2f1b0, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_92f030b2f1b0, p_IsComputed := p_IsComputed_92f030b2f1b0, p_EmbeddedRecord := p_EmbeddedRecord_92f030b2f1b0, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_92f030b2f1b0, p_Configuration_Clear := TRUE, p_ID := p_ID_92f030b2f1b0);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_6231218b5f03 VARCHAR(255);
  p_Description_6231218b5f03 TEXT;
  p_AutoUpdateDescription_6231218b5f03 BOOLEAN;
  p_IsPrimaryKey_6231218b5f03 BOOLEAN;
  p_IsUnique_6231218b5f03 BOOLEAN;
  p_Category_6231218b5f03 VARCHAR(255);
  p_ValueListType_6231218b5f03 VARCHAR(20);
  p_ExtendedType_6231218b5f03 VARCHAR(50);
  p_CodeType_6231218b5f03 VARCHAR(50);
  p_DefaultInView_6231218b5f03 BOOLEAN;
  p_ViewCellTemplate_6231218b5f03 TEXT;
  p_DefaultColumnWidth_6231218b5f03 INTEGER;
  p_AllowUpdateAPI_6231218b5f03 BOOLEAN;
  p_AllowUpdateInView_6231218b5f03 BOOLEAN;
  p_IncludeInUserSearchAPI_6231218b5f03 BOOLEAN;
  p_FullTextSearchEnabled_6231218b5f03 BOOLEAN;
  p_UserSearchParamFormatAPI_6231218b5f03 VARCHAR(500);
  p_IncludeInGeneratedForm_6231218b5f03 BOOLEAN;
  p_GeneratedFormSection_6231218b5f03 VARCHAR(10);
  p_IsNameField_6231218b5f03 BOOLEAN;
  p_RelatedEntityID_6231218b5f03 UUID;
  p_RelatedEntityFieldName_6231218b5f03 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_6231218b5f03 BOOLEAN;
  p_RelatedEntityNameFieldMap_6231218b5f03 VARCHAR(255);
  p_RelatedEntityDisplayType_6231218b5f03 VARCHAR(20);
  p_EntityIDFieldName_6231218b5f03 VARCHAR(100);
  p_ScopeDefault_6231218b5f03 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_6231218b5f03 BOOLEAN;
  p_ValuesToPackWithSchema_6231218b5f03 VARCHAR(10);
  p_Status_6231218b5f03 VARCHAR(25);
  p_AutoUpdateIsNameField_6231218b5f03 BOOLEAN;
  p_AutoUpdateDefaultInView_6231218b5f03 BOOLEAN;
  p_AutoUpdateCategory_6231218b5f03 BOOLEAN;
  p_AutoUpdateDisplayName_6231218b5f03 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_6231218b5f03 BOOLEAN;
  p_Encrypt_6231218b5f03 BOOLEAN;
  p_EncryptionKeyID_6231218b5f03 UUID;
  p_AllowDecryptInAPI_6231218b5f03 BOOLEAN;
  p_SendEncryptedValue_6231218b5f03 BOOLEAN;
  p_IsSoftPrimaryKey_6231218b5f03 BOOLEAN;
  p_IsSoftForeignKey_6231218b5f03 BOOLEAN;
  p_RelatedEntityJoinFields_6231218b5f03 TEXT;
  p_JSONType_6231218b5f03 VARCHAR(255);
  p_JSONTypeIsArray_6231218b5f03 BOOLEAN;
  p_JSONTypeDefinition_6231218b5f03 TEXT;
  p_UserSearchPredicateAPI_6231218b5f03 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_6231218b5f03 BOOLEAN;
  p_AutoUpdateFullTextSearch_6231218b5f03 BOOLEAN;
  p_AutoUpdateExtendedType_6231218b5f03 BOOLEAN;
  p_IsComputed_6231218b5f03 BOOLEAN;
  p_EmbeddedRecord_6231218b5f03 TEXT;
  p_Configuration_6231218b5f03 TEXT;
  p_ID_6231218b5f03 UUID;
BEGIN
  p_DisplayName_6231218b5f03 := 'Linked User ID';
  p_AutoUpdateDescription_6231218b5f03 := TRUE;
  p_IsPrimaryKey_6231218b5f03 := FALSE;
  p_IsUnique_6231218b5f03 := FALSE;
  p_ValueListType_6231218b5f03 := 'None';
  p_DefaultInView_6231218b5f03 := FALSE;
  p_DefaultColumnWidth_6231218b5f03 := 150;
  p_AllowUpdateAPI_6231218b5f03 := TRUE;
  p_AllowUpdateInView_6231218b5f03 := TRUE;
  p_IncludeInUserSearchAPI_6231218b5f03 := FALSE;
  p_FullTextSearchEnabled_6231218b5f03 := FALSE;
  p_IncludeInGeneratedForm_6231218b5f03 := TRUE;
  p_GeneratedFormSection_6231218b5f03 := 'Details';
  p_IsNameField_6231218b5f03 := FALSE;
  p_RelatedEntityID_6231218b5f03 := 'E1238F34-2837-EF11-86D4-6045BDEE16E6';
  p_IncludeRelatedEntityNameFieldInBaseView_6231218b5f03 := FALSE;
  p_RelatedEntityNameFieldMap_6231218b5f03 := 'LinkedUser';
  p_RelatedEntityDisplayType_6231218b5f03 := 'Search';
  p_AutoUpdateRelatedEntityInfo_6231218b5f03 := FALSE;
  p_ValuesToPackWithSchema_6231218b5f03 := 'Auto';
  p_Status_6231218b5f03 := 'Active';
  p_AutoUpdateIsNameField_6231218b5f03 := TRUE;
  p_AutoUpdateDefaultInView_6231218b5f03 := TRUE;
  p_AutoUpdateCategory_6231218b5f03 := TRUE;
  p_AutoUpdateDisplayName_6231218b5f03 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_6231218b5f03 := TRUE;
  p_Encrypt_6231218b5f03 := FALSE;
  p_AllowDecryptInAPI_6231218b5f03 := FALSE;
  p_SendEncryptedValue_6231218b5f03 := FALSE;
  p_IsSoftPrimaryKey_6231218b5f03 := FALSE;
  p_IsSoftForeignKey_6231218b5f03 := FALSE;
  p_JSONTypeIsArray_6231218b5f03 := FALSE;
  p_UserSearchPredicateAPI_6231218b5f03 := 'Contains';
  p_AutoUpdateUserSearchPredicate_6231218b5f03 := TRUE;
  p_AutoUpdateFullTextSearch_6231218b5f03 := TRUE;
  p_AutoUpdateExtendedType_6231218b5f03 := TRUE;
  p_IsComputed_6231218b5f03 := FALSE;
  p_ID_6231218b5f03 := 'AA2B7302-83E0-4F32-B204-F5B7D16E283F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_6231218b5f03,
    'Description', p_Description_6231218b5f03,
    'AutoUpdateDescription', p_AutoUpdateDescription_6231218b5f03,
    'IsPrimaryKey', p_IsPrimaryKey_6231218b5f03,
    'IsUnique', p_IsUnique_6231218b5f03,
    'Category', p_Category_6231218b5f03,
    'ValueListType', p_ValueListType_6231218b5f03,
    'ExtendedType', p_ExtendedType_6231218b5f03,
    'CodeType', p_CodeType_6231218b5f03,
    'DefaultInView', p_DefaultInView_6231218b5f03,
    'ViewCellTemplate', p_ViewCellTemplate_6231218b5f03,
    'DefaultColumnWidth', p_DefaultColumnWidth_6231218b5f03,
    'AllowUpdateAPI', p_AllowUpdateAPI_6231218b5f03,
    'AllowUpdateInView', p_AllowUpdateInView_6231218b5f03,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_6231218b5f03,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_6231218b5f03,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_6231218b5f03,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_6231218b5f03,
    'GeneratedFormSection', p_GeneratedFormSection_6231218b5f03,
    'IsNameField', p_IsNameField_6231218b5f03,
    'RelatedEntityID', p_RelatedEntityID_6231218b5f03,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_6231218b5f03,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_6231218b5f03,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_6231218b5f03,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_6231218b5f03,
    'EntityIDFieldName', p_EntityIDFieldName_6231218b5f03,
    'ScopeDefault', p_ScopeDefault_6231218b5f03,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_6231218b5f03,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_6231218b5f03,
    'Status', p_Status_6231218b5f03,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_6231218b5f03,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_6231218b5f03,
    'AutoUpdateCategory', p_AutoUpdateCategory_6231218b5f03,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_6231218b5f03,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_6231218b5f03,
    'Encrypt', p_Encrypt_6231218b5f03,
    'EncryptionKeyID', p_EncryptionKeyID_6231218b5f03,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_6231218b5f03,
    'SendEncryptedValue', p_SendEncryptedValue_6231218b5f03,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_6231218b5f03,
    'IsSoftForeignKey', p_IsSoftForeignKey_6231218b5f03,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_6231218b5f03,
    'JSONType', p_JSONType_6231218b5f03,
    'JSONTypeIsArray', p_JSONTypeIsArray_6231218b5f03,
    'JSONTypeDefinition', p_JSONTypeDefinition_6231218b5f03,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_6231218b5f03,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_6231218b5f03,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_6231218b5f03,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_6231218b5f03,
    'IsComputed', p_IsComputed_6231218b5f03
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_6231218b5f03,
    'Configuration', p_Configuration_6231218b5f03,
    'ID', p_ID_6231218b5f03
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_6231218b5f03, p_Description := p_Description_6231218b5f03, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_6231218b5f03, p_IsPrimaryKey := p_IsPrimaryKey_6231218b5f03, p_IsUnique := p_IsUnique_6231218b5f03, p_Category := p_Category_6231218b5f03, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_6231218b5f03, p_ExtendedType := p_ExtendedType_6231218b5f03, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_6231218b5f03, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_6231218b5f03, p_ViewCellTemplate := p_ViewCellTemplate_6231218b5f03, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_6231218b5f03, p_AllowUpdateAPI := p_AllowUpdateAPI_6231218b5f03, p_AllowUpdateInView := p_AllowUpdateInView_6231218b5f03, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_6231218b5f03, p_FullTextSearchEnabled := p_FullTextSearchEnabled_6231218b5f03, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_6231218b5f03, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_6231218b5f03, p_GeneratedFormSection := p_GeneratedFormSection_6231218b5f03, p_IsNameField := p_IsNameField_6231218b5f03, p_RelatedEntityID := p_RelatedEntityID_6231218b5f03, p_RelatedEntityFieldName := p_RelatedEntityFieldName_6231218b5f03, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_6231218b5f03, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_6231218b5f03, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_6231218b5f03, p_EntityIDFieldName := p_EntityIDFieldName_6231218b5f03, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_6231218b5f03, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_6231218b5f03, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_6231218b5f03, p_Status := p_Status_6231218b5f03, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_6231218b5f03, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_6231218b5f03, p_AutoUpdateCategory := p_AutoUpdateCategory_6231218b5f03, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_6231218b5f03, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_6231218b5f03, p_Encrypt := p_Encrypt_6231218b5f03, p_EncryptionKeyID := p_EncryptionKeyID_6231218b5f03, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_6231218b5f03, p_SendEncryptedValue := p_SendEncryptedValue_6231218b5f03, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_6231218b5f03, p_IsSoftForeignKey := p_IsSoftForeignKey_6231218b5f03, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_6231218b5f03, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_6231218b5f03, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_6231218b5f03, p_JSONTypeDefinition := p_JSONTypeDefinition_6231218b5f03, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_6231218b5f03, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_6231218b5f03, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_6231218b5f03, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_6231218b5f03, p_IsComputed := p_IsComputed_6231218b5f03, p_EmbeddedRecord := p_EmbeddedRecord_6231218b5f03, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_6231218b5f03, p_Configuration_Clear := TRUE, p_ID := p_ID_6231218b5f03);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e4fe93e9c98f VARCHAR(255);
  p_Description_e4fe93e9c98f TEXT;
  p_AutoUpdateDescription_e4fe93e9c98f BOOLEAN;
  p_IsPrimaryKey_e4fe93e9c98f BOOLEAN;
  p_IsUnique_e4fe93e9c98f BOOLEAN;
  p_Category_e4fe93e9c98f VARCHAR(255);
  p_ValueListType_e4fe93e9c98f VARCHAR(20);
  p_ExtendedType_e4fe93e9c98f VARCHAR(50);
  p_CodeType_e4fe93e9c98f VARCHAR(50);
  p_DefaultInView_e4fe93e9c98f BOOLEAN;
  p_ViewCellTemplate_e4fe93e9c98f TEXT;
  p_DefaultColumnWidth_e4fe93e9c98f INTEGER;
  p_AllowUpdateAPI_e4fe93e9c98f BOOLEAN;
  p_AllowUpdateInView_e4fe93e9c98f BOOLEAN;
  p_IncludeInUserSearchAPI_e4fe93e9c98f BOOLEAN;
  p_FullTextSearchEnabled_e4fe93e9c98f BOOLEAN;
  p_UserSearchParamFormatAPI_e4fe93e9c98f VARCHAR(500);
  p_IncludeInGeneratedForm_e4fe93e9c98f BOOLEAN;
  p_GeneratedFormSection_e4fe93e9c98f VARCHAR(10);
  p_IsNameField_e4fe93e9c98f BOOLEAN;
  p_RelatedEntityID_e4fe93e9c98f UUID;
  p_RelatedEntityFieldName_e4fe93e9c98f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e4fe93e9c98f BOOLEAN;
  p_RelatedEntityNameFieldMap_e4fe93e9c98f VARCHAR(255);
  p_RelatedEntityDisplayType_e4fe93e9c98f VARCHAR(20);
  p_EntityIDFieldName_e4fe93e9c98f VARCHAR(100);
  p_ScopeDefault_e4fe93e9c98f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e4fe93e9c98f BOOLEAN;
  p_ValuesToPackWithSchema_e4fe93e9c98f VARCHAR(10);
  p_Status_e4fe93e9c98f VARCHAR(25);
  p_AutoUpdateIsNameField_e4fe93e9c98f BOOLEAN;
  p_AutoUpdateDefaultInView_e4fe93e9c98f BOOLEAN;
  p_AutoUpdateCategory_e4fe93e9c98f BOOLEAN;
  p_AutoUpdateDisplayName_e4fe93e9c98f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e4fe93e9c98f BOOLEAN;
  p_Encrypt_e4fe93e9c98f BOOLEAN;
  p_EncryptionKeyID_e4fe93e9c98f UUID;
  p_AllowDecryptInAPI_e4fe93e9c98f BOOLEAN;
  p_SendEncryptedValue_e4fe93e9c98f BOOLEAN;
  p_IsSoftPrimaryKey_e4fe93e9c98f BOOLEAN;
  p_IsSoftForeignKey_e4fe93e9c98f BOOLEAN;
  p_RelatedEntityJoinFields_e4fe93e9c98f TEXT;
  p_JSONType_e4fe93e9c98f VARCHAR(255);
  p_JSONTypeIsArray_e4fe93e9c98f BOOLEAN;
  p_JSONTypeDefinition_e4fe93e9c98f TEXT;
  p_UserSearchPredicateAPI_e4fe93e9c98f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e4fe93e9c98f BOOLEAN;
  p_AutoUpdateFullTextSearch_e4fe93e9c98f BOOLEAN;
  p_AutoUpdateExtendedType_e4fe93e9c98f BOOLEAN;
  p_IsComputed_e4fe93e9c98f BOOLEAN;
  p_EmbeddedRecord_e4fe93e9c98f TEXT;
  p_Configuration_e4fe93e9c98f TEXT;
  p_ID_e4fe93e9c98f UUID;
BEGIN
  p_DisplayName_e4fe93e9c98f := 'Title';
  p_AutoUpdateDescription_e4fe93e9c98f := TRUE;
  p_IsPrimaryKey_e4fe93e9c98f := FALSE;
  p_IsUnique_e4fe93e9c98f := FALSE;
  p_ValueListType_e4fe93e9c98f := 'None';
  p_DefaultInView_e4fe93e9c98f := TRUE;
  p_DefaultColumnWidth_e4fe93e9c98f := 150;
  p_AllowUpdateAPI_e4fe93e9c98f := TRUE;
  p_AllowUpdateInView_e4fe93e9c98f := TRUE;
  p_IncludeInUserSearchAPI_e4fe93e9c98f := FALSE;
  p_FullTextSearchEnabled_e4fe93e9c98f := FALSE;
  p_IncludeInGeneratedForm_e4fe93e9c98f := TRUE;
  p_GeneratedFormSection_e4fe93e9c98f := 'Details';
  p_IsNameField_e4fe93e9c98f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_e4fe93e9c98f := FALSE;
  p_RelatedEntityDisplayType_e4fe93e9c98f := 'Search';
  p_AutoUpdateRelatedEntityInfo_e4fe93e9c98f := TRUE;
  p_ValuesToPackWithSchema_e4fe93e9c98f := 'Auto';
  p_Status_e4fe93e9c98f := 'Active';
  p_AutoUpdateIsNameField_e4fe93e9c98f := TRUE;
  p_AutoUpdateDefaultInView_e4fe93e9c98f := TRUE;
  p_AutoUpdateCategory_e4fe93e9c98f := TRUE;
  p_AutoUpdateDisplayName_e4fe93e9c98f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_e4fe93e9c98f := TRUE;
  p_Encrypt_e4fe93e9c98f := FALSE;
  p_AllowDecryptInAPI_e4fe93e9c98f := FALSE;
  p_SendEncryptedValue_e4fe93e9c98f := FALSE;
  p_IsSoftPrimaryKey_e4fe93e9c98f := FALSE;
  p_IsSoftForeignKey_e4fe93e9c98f := FALSE;
  p_JSONTypeIsArray_e4fe93e9c98f := FALSE;
  p_UserSearchPredicateAPI_e4fe93e9c98f := 'Contains';
  p_AutoUpdateUserSearchPredicate_e4fe93e9c98f := TRUE;
  p_AutoUpdateFullTextSearch_e4fe93e9c98f := TRUE;
  p_AutoUpdateExtendedType_e4fe93e9c98f := TRUE;
  p_IsComputed_e4fe93e9c98f := FALSE;
  p_ID_e4fe93e9c98f := '5DBABF4B-9D67-46FC-BF7F-BADE089980F8';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e4fe93e9c98f,
    'Description', p_Description_e4fe93e9c98f,
    'AutoUpdateDescription', p_AutoUpdateDescription_e4fe93e9c98f,
    'IsPrimaryKey', p_IsPrimaryKey_e4fe93e9c98f,
    'IsUnique', p_IsUnique_e4fe93e9c98f,
    'Category', p_Category_e4fe93e9c98f,
    'ValueListType', p_ValueListType_e4fe93e9c98f,
    'ExtendedType', p_ExtendedType_e4fe93e9c98f,
    'CodeType', p_CodeType_e4fe93e9c98f,
    'DefaultInView', p_DefaultInView_e4fe93e9c98f,
    'ViewCellTemplate', p_ViewCellTemplate_e4fe93e9c98f,
    'DefaultColumnWidth', p_DefaultColumnWidth_e4fe93e9c98f,
    'AllowUpdateAPI', p_AllowUpdateAPI_e4fe93e9c98f,
    'AllowUpdateInView', p_AllowUpdateInView_e4fe93e9c98f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e4fe93e9c98f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e4fe93e9c98f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e4fe93e9c98f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e4fe93e9c98f,
    'GeneratedFormSection', p_GeneratedFormSection_e4fe93e9c98f,
    'IsNameField', p_IsNameField_e4fe93e9c98f,
    'RelatedEntityID', p_RelatedEntityID_e4fe93e9c98f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e4fe93e9c98f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e4fe93e9c98f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e4fe93e9c98f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e4fe93e9c98f,
    'EntityIDFieldName', p_EntityIDFieldName_e4fe93e9c98f,
    'ScopeDefault', p_ScopeDefault_e4fe93e9c98f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e4fe93e9c98f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e4fe93e9c98f,
    'Status', p_Status_e4fe93e9c98f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e4fe93e9c98f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e4fe93e9c98f,
    'AutoUpdateCategory', p_AutoUpdateCategory_e4fe93e9c98f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e4fe93e9c98f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e4fe93e9c98f,
    'Encrypt', p_Encrypt_e4fe93e9c98f,
    'EncryptionKeyID', p_EncryptionKeyID_e4fe93e9c98f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e4fe93e9c98f,
    'SendEncryptedValue', p_SendEncryptedValue_e4fe93e9c98f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e4fe93e9c98f,
    'IsSoftForeignKey', p_IsSoftForeignKey_e4fe93e9c98f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e4fe93e9c98f,
    'JSONType', p_JSONType_e4fe93e9c98f,
    'JSONTypeIsArray', p_JSONTypeIsArray_e4fe93e9c98f,
    'JSONTypeDefinition', p_JSONTypeDefinition_e4fe93e9c98f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e4fe93e9c98f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e4fe93e9c98f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e4fe93e9c98f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e4fe93e9c98f,
    'IsComputed', p_IsComputed_e4fe93e9c98f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e4fe93e9c98f,
    'Configuration', p_Configuration_e4fe93e9c98f,
    'ID', p_ID_e4fe93e9c98f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_e4fe93e9c98f, p_Description := p_Description_e4fe93e9c98f, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e4fe93e9c98f, p_IsPrimaryKey := p_IsPrimaryKey_e4fe93e9c98f, p_IsUnique := p_IsUnique_e4fe93e9c98f, p_Category := p_Category_e4fe93e9c98f, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_e4fe93e9c98f, p_ExtendedType := p_ExtendedType_e4fe93e9c98f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e4fe93e9c98f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e4fe93e9c98f, p_ViewCellTemplate := p_ViewCellTemplate_e4fe93e9c98f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e4fe93e9c98f, p_AllowUpdateAPI := p_AllowUpdateAPI_e4fe93e9c98f, p_AllowUpdateInView := p_AllowUpdateInView_e4fe93e9c98f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e4fe93e9c98f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e4fe93e9c98f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e4fe93e9c98f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e4fe93e9c98f, p_GeneratedFormSection := p_GeneratedFormSection_e4fe93e9c98f, p_IsNameField := p_IsNameField_e4fe93e9c98f, p_RelatedEntityID := p_RelatedEntityID_e4fe93e9c98f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e4fe93e9c98f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e4fe93e9c98f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e4fe93e9c98f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e4fe93e9c98f, p_EntityIDFieldName := p_EntityIDFieldName_e4fe93e9c98f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e4fe93e9c98f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e4fe93e9c98f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e4fe93e9c98f, p_Status := p_Status_e4fe93e9c98f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e4fe93e9c98f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e4fe93e9c98f, p_AutoUpdateCategory := p_AutoUpdateCategory_e4fe93e9c98f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e4fe93e9c98f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e4fe93e9c98f, p_Encrypt := p_Encrypt_e4fe93e9c98f, p_EncryptionKeyID := p_EncryptionKeyID_e4fe93e9c98f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e4fe93e9c98f, p_SendEncryptedValue := p_SendEncryptedValue_e4fe93e9c98f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e4fe93e9c98f, p_IsSoftForeignKey := p_IsSoftForeignKey_e4fe93e9c98f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e4fe93e9c98f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e4fe93e9c98f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e4fe93e9c98f, p_JSONTypeDefinition := p_JSONTypeDefinition_e4fe93e9c98f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e4fe93e9c98f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e4fe93e9c98f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e4fe93e9c98f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e4fe93e9c98f, p_IsComputed := p_IsComputed_e4fe93e9c98f, p_EmbeddedRecord := p_EmbeddedRecord_e4fe93e9c98f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e4fe93e9c98f, p_Configuration_Clear := TRUE, p_ID := p_ID_e4fe93e9c98f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e575882c9ea9 VARCHAR(255);
  p_Description_e575882c9ea9 TEXT;
  p_AutoUpdateDescription_e575882c9ea9 BOOLEAN;
  p_IsPrimaryKey_e575882c9ea9 BOOLEAN;
  p_IsUnique_e575882c9ea9 BOOLEAN;
  p_Category_e575882c9ea9 VARCHAR(255);
  p_ValueListType_e575882c9ea9 VARCHAR(20);
  p_ExtendedType_e575882c9ea9 VARCHAR(50);
  p_CodeType_e575882c9ea9 VARCHAR(50);
  p_DefaultInView_e575882c9ea9 BOOLEAN;
  p_ViewCellTemplate_e575882c9ea9 TEXT;
  p_DefaultColumnWidth_e575882c9ea9 INTEGER;
  p_AllowUpdateAPI_e575882c9ea9 BOOLEAN;
  p_AllowUpdateInView_e575882c9ea9 BOOLEAN;
  p_IncludeInUserSearchAPI_e575882c9ea9 BOOLEAN;
  p_FullTextSearchEnabled_e575882c9ea9 BOOLEAN;
  p_UserSearchParamFormatAPI_e575882c9ea9 VARCHAR(500);
  p_IncludeInGeneratedForm_e575882c9ea9 BOOLEAN;
  p_GeneratedFormSection_e575882c9ea9 VARCHAR(10);
  p_IsNameField_e575882c9ea9 BOOLEAN;
  p_RelatedEntityID_e575882c9ea9 UUID;
  p_RelatedEntityFieldName_e575882c9ea9 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e575882c9ea9 BOOLEAN;
  p_RelatedEntityNameFieldMap_e575882c9ea9 VARCHAR(255);
  p_RelatedEntityDisplayType_e575882c9ea9 VARCHAR(20);
  p_EntityIDFieldName_e575882c9ea9 VARCHAR(100);
  p_ScopeDefault_e575882c9ea9 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e575882c9ea9 BOOLEAN;
  p_ValuesToPackWithSchema_e575882c9ea9 VARCHAR(10);
  p_Status_e575882c9ea9 VARCHAR(25);
  p_AutoUpdateIsNameField_e575882c9ea9 BOOLEAN;
  p_AutoUpdateDefaultInView_e575882c9ea9 BOOLEAN;
  p_AutoUpdateCategory_e575882c9ea9 BOOLEAN;
  p_AutoUpdateDisplayName_e575882c9ea9 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e575882c9ea9 BOOLEAN;
  p_Encrypt_e575882c9ea9 BOOLEAN;
  p_EncryptionKeyID_e575882c9ea9 UUID;
  p_AllowDecryptInAPI_e575882c9ea9 BOOLEAN;
  p_SendEncryptedValue_e575882c9ea9 BOOLEAN;
  p_IsSoftPrimaryKey_e575882c9ea9 BOOLEAN;
  p_IsSoftForeignKey_e575882c9ea9 BOOLEAN;
  p_RelatedEntityJoinFields_e575882c9ea9 TEXT;
  p_JSONType_e575882c9ea9 VARCHAR(255);
  p_JSONTypeIsArray_e575882c9ea9 BOOLEAN;
  p_JSONTypeDefinition_e575882c9ea9 TEXT;
  p_UserSearchPredicateAPI_e575882c9ea9 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e575882c9ea9 BOOLEAN;
  p_AutoUpdateFullTextSearch_e575882c9ea9 BOOLEAN;
  p_AutoUpdateExtendedType_e575882c9ea9 BOOLEAN;
  p_IsComputed_e575882c9ea9 BOOLEAN;
  p_EmbeddedRecord_e575882c9ea9 TEXT;
  p_Configuration_e575882c9ea9 TEXT;
  p_ID_e575882c9ea9 UUID;
BEGIN
  p_DisplayName_e575882c9ea9 := 'Lifecycle Stage Type';
  p_AutoUpdateDescription_e575882c9ea9 := TRUE;
  p_IsPrimaryKey_e575882c9ea9 := FALSE;
  p_IsUnique_e575882c9ea9 := FALSE;
  p_ValueListType_e575882c9ea9 := 'None';
  p_DefaultInView_e575882c9ea9 := TRUE;
  p_DefaultColumnWidth_e575882c9ea9 := 150;
  p_AllowUpdateAPI_e575882c9ea9 := FALSE;
  p_AllowUpdateInView_e575882c9ea9 := TRUE;
  p_IncludeInUserSearchAPI_e575882c9ea9 := FALSE;
  p_FullTextSearchEnabled_e575882c9ea9 := FALSE;
  p_IncludeInGeneratedForm_e575882c9ea9 := TRUE;
  p_GeneratedFormSection_e575882c9ea9 := 'Details';
  p_IsNameField_e575882c9ea9 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_e575882c9ea9 := FALSE;
  p_RelatedEntityDisplayType_e575882c9ea9 := 'Search';
  p_AutoUpdateRelatedEntityInfo_e575882c9ea9 := TRUE;
  p_ValuesToPackWithSchema_e575882c9ea9 := 'Auto';
  p_Status_e575882c9ea9 := 'Active';
  p_AutoUpdateIsNameField_e575882c9ea9 := TRUE;
  p_AutoUpdateDefaultInView_e575882c9ea9 := TRUE;
  p_AutoUpdateCategory_e575882c9ea9 := TRUE;
  p_AutoUpdateDisplayName_e575882c9ea9 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_e575882c9ea9 := TRUE;
  p_Encrypt_e575882c9ea9 := FALSE;
  p_AllowDecryptInAPI_e575882c9ea9 := FALSE;
  p_SendEncryptedValue_e575882c9ea9 := FALSE;
  p_IsSoftPrimaryKey_e575882c9ea9 := FALSE;
  p_IsSoftForeignKey_e575882c9ea9 := FALSE;
  p_JSONTypeIsArray_e575882c9ea9 := FALSE;
  p_UserSearchPredicateAPI_e575882c9ea9 := 'Contains';
  p_AutoUpdateUserSearchPredicate_e575882c9ea9 := TRUE;
  p_AutoUpdateFullTextSearch_e575882c9ea9 := TRUE;
  p_AutoUpdateExtendedType_e575882c9ea9 := TRUE;
  p_IsComputed_e575882c9ea9 := FALSE;
  p_ID_e575882c9ea9 := '8D266773-DFAE-4986-AF34-02BD9C88EF39';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e575882c9ea9,
    'Description', p_Description_e575882c9ea9,
    'AutoUpdateDescription', p_AutoUpdateDescription_e575882c9ea9,
    'IsPrimaryKey', p_IsPrimaryKey_e575882c9ea9,
    'IsUnique', p_IsUnique_e575882c9ea9,
    'Category', p_Category_e575882c9ea9,
    'ValueListType', p_ValueListType_e575882c9ea9,
    'ExtendedType', p_ExtendedType_e575882c9ea9,
    'CodeType', p_CodeType_e575882c9ea9,
    'DefaultInView', p_DefaultInView_e575882c9ea9,
    'ViewCellTemplate', p_ViewCellTemplate_e575882c9ea9,
    'DefaultColumnWidth', p_DefaultColumnWidth_e575882c9ea9,
    'AllowUpdateAPI', p_AllowUpdateAPI_e575882c9ea9,
    'AllowUpdateInView', p_AllowUpdateInView_e575882c9ea9,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e575882c9ea9,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e575882c9ea9,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e575882c9ea9,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e575882c9ea9,
    'GeneratedFormSection', p_GeneratedFormSection_e575882c9ea9,
    'IsNameField', p_IsNameField_e575882c9ea9,
    'RelatedEntityID', p_RelatedEntityID_e575882c9ea9,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e575882c9ea9,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e575882c9ea9,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e575882c9ea9,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e575882c9ea9,
    'EntityIDFieldName', p_EntityIDFieldName_e575882c9ea9,
    'ScopeDefault', p_ScopeDefault_e575882c9ea9,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e575882c9ea9,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e575882c9ea9,
    'Status', p_Status_e575882c9ea9,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e575882c9ea9,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e575882c9ea9,
    'AutoUpdateCategory', p_AutoUpdateCategory_e575882c9ea9,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e575882c9ea9,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e575882c9ea9,
    'Encrypt', p_Encrypt_e575882c9ea9,
    'EncryptionKeyID', p_EncryptionKeyID_e575882c9ea9,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e575882c9ea9,
    'SendEncryptedValue', p_SendEncryptedValue_e575882c9ea9,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e575882c9ea9,
    'IsSoftForeignKey', p_IsSoftForeignKey_e575882c9ea9,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e575882c9ea9,
    'JSONType', p_JSONType_e575882c9ea9,
    'JSONTypeIsArray', p_JSONTypeIsArray_e575882c9ea9,
    'JSONTypeDefinition', p_JSONTypeDefinition_e575882c9ea9,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e575882c9ea9,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e575882c9ea9,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e575882c9ea9,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e575882c9ea9,
    'IsComputed', p_IsComputed_e575882c9ea9
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e575882c9ea9,
    'Configuration', p_Configuration_e575882c9ea9,
    'ID', p_ID_e575882c9ea9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_e575882c9ea9, p_Description := p_Description_e575882c9ea9, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e575882c9ea9, p_IsPrimaryKey := p_IsPrimaryKey_e575882c9ea9, p_IsUnique := p_IsUnique_e575882c9ea9, p_Category := p_Category_e575882c9ea9, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_e575882c9ea9, p_ExtendedType := p_ExtendedType_e575882c9ea9, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e575882c9ea9, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e575882c9ea9, p_ViewCellTemplate := p_ViewCellTemplate_e575882c9ea9, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e575882c9ea9, p_AllowUpdateAPI := p_AllowUpdateAPI_e575882c9ea9, p_AllowUpdateInView := p_AllowUpdateInView_e575882c9ea9, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e575882c9ea9, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e575882c9ea9, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e575882c9ea9, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e575882c9ea9, p_GeneratedFormSection := p_GeneratedFormSection_e575882c9ea9, p_IsNameField := p_IsNameField_e575882c9ea9, p_RelatedEntityID := p_RelatedEntityID_e575882c9ea9, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e575882c9ea9, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e575882c9ea9, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e575882c9ea9, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e575882c9ea9, p_EntityIDFieldName := p_EntityIDFieldName_e575882c9ea9, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e575882c9ea9, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e575882c9ea9, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e575882c9ea9, p_Status := p_Status_e575882c9ea9, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e575882c9ea9, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e575882c9ea9, p_AutoUpdateCategory := p_AutoUpdateCategory_e575882c9ea9, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e575882c9ea9, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e575882c9ea9, p_Encrypt := p_Encrypt_e575882c9ea9, p_EncryptionKeyID := p_EncryptionKeyID_e575882c9ea9, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e575882c9ea9, p_SendEncryptedValue := p_SendEncryptedValue_e575882c9ea9, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e575882c9ea9, p_IsSoftForeignKey := p_IsSoftForeignKey_e575882c9ea9, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e575882c9ea9, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e575882c9ea9, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e575882c9ea9, p_JSONTypeDefinition := p_JSONTypeDefinition_e575882c9ea9, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e575882c9ea9, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e575882c9ea9, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e575882c9ea9, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e575882c9ea9, p_IsComputed := p_IsComputed_e575882c9ea9, p_EmbeddedRecord := p_EmbeddedRecord_e575882c9ea9, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e575882c9ea9, p_Configuration_Clear := TRUE, p_ID := p_ID_e575882c9ea9);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_336429b8d1b1 VARCHAR(255);
  p_Description_336429b8d1b1 TEXT;
  p_AutoUpdateDescription_336429b8d1b1 BOOLEAN;
  p_IsPrimaryKey_336429b8d1b1 BOOLEAN;
  p_IsUnique_336429b8d1b1 BOOLEAN;
  p_Category_336429b8d1b1 VARCHAR(255);
  p_ValueListType_336429b8d1b1 VARCHAR(20);
  p_ExtendedType_336429b8d1b1 VARCHAR(50);
  p_CodeType_336429b8d1b1 VARCHAR(50);
  p_DefaultInView_336429b8d1b1 BOOLEAN;
  p_ViewCellTemplate_336429b8d1b1 TEXT;
  p_DefaultColumnWidth_336429b8d1b1 INTEGER;
  p_AllowUpdateAPI_336429b8d1b1 BOOLEAN;
  p_AllowUpdateInView_336429b8d1b1 BOOLEAN;
  p_IncludeInUserSearchAPI_336429b8d1b1 BOOLEAN;
  p_FullTextSearchEnabled_336429b8d1b1 BOOLEAN;
  p_UserSearchParamFormatAPI_336429b8d1b1 VARCHAR(500);
  p_IncludeInGeneratedForm_336429b8d1b1 BOOLEAN;
  p_GeneratedFormSection_336429b8d1b1 VARCHAR(10);
  p_IsNameField_336429b8d1b1 BOOLEAN;
  p_RelatedEntityID_336429b8d1b1 UUID;
  p_RelatedEntityFieldName_336429b8d1b1 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_336429b8d1b1 BOOLEAN;
  p_RelatedEntityNameFieldMap_336429b8d1b1 VARCHAR(255);
  p_RelatedEntityDisplayType_336429b8d1b1 VARCHAR(20);
  p_EntityIDFieldName_336429b8d1b1 VARCHAR(100);
  p_ScopeDefault_336429b8d1b1 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_336429b8d1b1 BOOLEAN;
  p_ValuesToPackWithSchema_336429b8d1b1 VARCHAR(10);
  p_Status_336429b8d1b1 VARCHAR(25);
  p_AutoUpdateIsNameField_336429b8d1b1 BOOLEAN;
  p_AutoUpdateDefaultInView_336429b8d1b1 BOOLEAN;
  p_AutoUpdateCategory_336429b8d1b1 BOOLEAN;
  p_AutoUpdateDisplayName_336429b8d1b1 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_336429b8d1b1 BOOLEAN;
  p_Encrypt_336429b8d1b1 BOOLEAN;
  p_EncryptionKeyID_336429b8d1b1 UUID;
  p_AllowDecryptInAPI_336429b8d1b1 BOOLEAN;
  p_SendEncryptedValue_336429b8d1b1 BOOLEAN;
  p_IsSoftPrimaryKey_336429b8d1b1 BOOLEAN;
  p_IsSoftForeignKey_336429b8d1b1 BOOLEAN;
  p_RelatedEntityJoinFields_336429b8d1b1 TEXT;
  p_JSONType_336429b8d1b1 VARCHAR(255);
  p_JSONTypeIsArray_336429b8d1b1 BOOLEAN;
  p_JSONTypeDefinition_336429b8d1b1 TEXT;
  p_UserSearchPredicateAPI_336429b8d1b1 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_336429b8d1b1 BOOLEAN;
  p_AutoUpdateFullTextSearch_336429b8d1b1 BOOLEAN;
  p_AutoUpdateExtendedType_336429b8d1b1 BOOLEAN;
  p_IsComputed_336429b8d1b1 BOOLEAN;
  p_EmbeddedRecord_336429b8d1b1 TEXT;
  p_Configuration_336429b8d1b1 TEXT;
  p_ID_336429b8d1b1 UUID;
BEGIN
  p_DisplayName_336429b8d1b1 := 'Owner Employee';
  p_AutoUpdateDescription_336429b8d1b1 := TRUE;
  p_IsPrimaryKey_336429b8d1b1 := FALSE;
  p_IsUnique_336429b8d1b1 := FALSE;
  p_ValueListType_336429b8d1b1 := 'None';
  p_DefaultInView_336429b8d1b1 := TRUE;
  p_DefaultColumnWidth_336429b8d1b1 := 150;
  p_AllowUpdateAPI_336429b8d1b1 := FALSE;
  p_AllowUpdateInView_336429b8d1b1 := TRUE;
  p_IncludeInUserSearchAPI_336429b8d1b1 := FALSE;
  p_FullTextSearchEnabled_336429b8d1b1 := FALSE;
  p_IncludeInGeneratedForm_336429b8d1b1 := TRUE;
  p_GeneratedFormSection_336429b8d1b1 := 'Details';
  p_IsNameField_336429b8d1b1 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_336429b8d1b1 := FALSE;
  p_RelatedEntityDisplayType_336429b8d1b1 := 'Search';
  p_AutoUpdateRelatedEntityInfo_336429b8d1b1 := TRUE;
  p_ValuesToPackWithSchema_336429b8d1b1 := 'Auto';
  p_Status_336429b8d1b1 := 'Active';
  p_AutoUpdateIsNameField_336429b8d1b1 := TRUE;
  p_AutoUpdateDefaultInView_336429b8d1b1 := TRUE;
  p_AutoUpdateCategory_336429b8d1b1 := TRUE;
  p_AutoUpdateDisplayName_336429b8d1b1 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_336429b8d1b1 := TRUE;
  p_Encrypt_336429b8d1b1 := FALSE;
  p_AllowDecryptInAPI_336429b8d1b1 := FALSE;
  p_SendEncryptedValue_336429b8d1b1 := FALSE;
  p_IsSoftPrimaryKey_336429b8d1b1 := FALSE;
  p_IsSoftForeignKey_336429b8d1b1 := FALSE;
  p_JSONTypeIsArray_336429b8d1b1 := FALSE;
  p_UserSearchPredicateAPI_336429b8d1b1 := 'Contains';
  p_AutoUpdateUserSearchPredicate_336429b8d1b1 := TRUE;
  p_AutoUpdateFullTextSearch_336429b8d1b1 := TRUE;
  p_AutoUpdateExtendedType_336429b8d1b1 := TRUE;
  p_IsComputed_336429b8d1b1 := FALSE;
  p_ID_336429b8d1b1 := '11E64D89-31B9-4120-B74F-14434B3ACE8E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_336429b8d1b1,
    'Description', p_Description_336429b8d1b1,
    'AutoUpdateDescription', p_AutoUpdateDescription_336429b8d1b1,
    'IsPrimaryKey', p_IsPrimaryKey_336429b8d1b1,
    'IsUnique', p_IsUnique_336429b8d1b1,
    'Category', p_Category_336429b8d1b1,
    'ValueListType', p_ValueListType_336429b8d1b1,
    'ExtendedType', p_ExtendedType_336429b8d1b1,
    'CodeType', p_CodeType_336429b8d1b1,
    'DefaultInView', p_DefaultInView_336429b8d1b1,
    'ViewCellTemplate', p_ViewCellTemplate_336429b8d1b1,
    'DefaultColumnWidth', p_DefaultColumnWidth_336429b8d1b1,
    'AllowUpdateAPI', p_AllowUpdateAPI_336429b8d1b1,
    'AllowUpdateInView', p_AllowUpdateInView_336429b8d1b1,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_336429b8d1b1,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_336429b8d1b1,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_336429b8d1b1,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_336429b8d1b1,
    'GeneratedFormSection', p_GeneratedFormSection_336429b8d1b1,
    'IsNameField', p_IsNameField_336429b8d1b1,
    'RelatedEntityID', p_RelatedEntityID_336429b8d1b1,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_336429b8d1b1,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_336429b8d1b1,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_336429b8d1b1,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_336429b8d1b1,
    'EntityIDFieldName', p_EntityIDFieldName_336429b8d1b1,
    'ScopeDefault', p_ScopeDefault_336429b8d1b1,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_336429b8d1b1,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_336429b8d1b1,
    'Status', p_Status_336429b8d1b1,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_336429b8d1b1,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_336429b8d1b1,
    'AutoUpdateCategory', p_AutoUpdateCategory_336429b8d1b1,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_336429b8d1b1,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_336429b8d1b1,
    'Encrypt', p_Encrypt_336429b8d1b1,
    'EncryptionKeyID', p_EncryptionKeyID_336429b8d1b1,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_336429b8d1b1,
    'SendEncryptedValue', p_SendEncryptedValue_336429b8d1b1,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_336429b8d1b1,
    'IsSoftForeignKey', p_IsSoftForeignKey_336429b8d1b1,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_336429b8d1b1,
    'JSONType', p_JSONType_336429b8d1b1,
    'JSONTypeIsArray', p_JSONTypeIsArray_336429b8d1b1,
    'JSONTypeDefinition', p_JSONTypeDefinition_336429b8d1b1,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_336429b8d1b1,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_336429b8d1b1,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_336429b8d1b1,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_336429b8d1b1,
    'IsComputed', p_IsComputed_336429b8d1b1
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_336429b8d1b1,
    'Configuration', p_Configuration_336429b8d1b1,
    'ID', p_ID_336429b8d1b1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_336429b8d1b1, p_Description := p_Description_336429b8d1b1, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_336429b8d1b1, p_IsPrimaryKey := p_IsPrimaryKey_336429b8d1b1, p_IsUnique := p_IsUnique_336429b8d1b1, p_Category := p_Category_336429b8d1b1, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_336429b8d1b1, p_ExtendedType := p_ExtendedType_336429b8d1b1, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_336429b8d1b1, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_336429b8d1b1, p_ViewCellTemplate := p_ViewCellTemplate_336429b8d1b1, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_336429b8d1b1, p_AllowUpdateAPI := p_AllowUpdateAPI_336429b8d1b1, p_AllowUpdateInView := p_AllowUpdateInView_336429b8d1b1, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_336429b8d1b1, p_FullTextSearchEnabled := p_FullTextSearchEnabled_336429b8d1b1, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_336429b8d1b1, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_336429b8d1b1, p_GeneratedFormSection := p_GeneratedFormSection_336429b8d1b1, p_IsNameField := p_IsNameField_336429b8d1b1, p_RelatedEntityID := p_RelatedEntityID_336429b8d1b1, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_336429b8d1b1, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_336429b8d1b1, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_336429b8d1b1, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_336429b8d1b1, p_EntityIDFieldName := p_EntityIDFieldName_336429b8d1b1, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_336429b8d1b1, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_336429b8d1b1, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_336429b8d1b1, p_Status := p_Status_336429b8d1b1, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_336429b8d1b1, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_336429b8d1b1, p_AutoUpdateCategory := p_AutoUpdateCategory_336429b8d1b1, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_336429b8d1b1, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_336429b8d1b1, p_Encrypt := p_Encrypt_336429b8d1b1, p_EncryptionKeyID := p_EncryptionKeyID_336429b8d1b1, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_336429b8d1b1, p_SendEncryptedValue := p_SendEncryptedValue_336429b8d1b1, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_336429b8d1b1, p_IsSoftForeignKey := p_IsSoftForeignKey_336429b8d1b1, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_336429b8d1b1, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_336429b8d1b1, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_336429b8d1b1, p_JSONTypeDefinition := p_JSONTypeDefinition_336429b8d1b1, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_336429b8d1b1, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_336429b8d1b1, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_336429b8d1b1, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_336429b8d1b1, p_IsComputed := p_IsComputed_336429b8d1b1, p_EmbeddedRecord := p_EmbeddedRecord_336429b8d1b1, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_336429b8d1b1, p_Configuration_Clear := TRUE, p_ID := p_ID_336429b8d1b1);
  END IF;
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_572fd35b3bb2 UUID;
  p_Name_572fd35b3bb2 VARCHAR(255);
  p_NameSuffix_572fd35b3bb2 VARCHAR(255);
  p_Description_572fd35b3bb2 TEXT;
  p_AutoUpdateDescription_572fd35b3bb2 BOOLEAN;
  p_BaseView_572fd35b3bb2 VARCHAR(255);
  p_BaseViewGenerated_572fd35b3bb2 BOOLEAN;
  p_VirtualEntity_572fd35b3bb2 BOOLEAN;
  p_TrackRecordChanges_572fd35b3bb2 BOOLEAN;
  p_AuditRecordAccess_572fd35b3bb2 BOOLEAN;
  p_AuditViewRuns_572fd35b3bb2 BOOLEAN;
  p_IncludeInAPI_572fd35b3bb2 BOOLEAN;
  p_AllowAllRowsAPI_572fd35b3bb2 BOOLEAN;
  p_AllowUpdateAPI_572fd35b3bb2 BOOLEAN;
  p_AllowCreateAPI_572fd35b3bb2 BOOLEAN;
  p_AllowDeleteAPI_572fd35b3bb2 BOOLEAN;
  p_CustomResolverAPI_572fd35b3bb2 BOOLEAN;
  p_AllowUserSearchAPI_572fd35b3bb2 BOOLEAN;
  p_FullTextSearchEnabled_572fd35b3bb2 BOOLEAN;
  p_FullTextCatalog_572fd35b3bb2 VARCHAR(255);
  p_FullTextCatalogGenerated_572fd35b3bb2 BOOLEAN;
  p_FullTextIndex_572fd35b3bb2 VARCHAR(255);
  p_FullTextIndexGenerated_572fd35b3bb2 BOOLEAN;
  p_FullTextSearchFunction_572fd35b3bb2 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_572fd35b3bb2 BOOLEAN;
  p_UserViewMaxRows_572fd35b3bb2 INTEGER;
  p_spCreate_572fd35b3bb2 VARCHAR(255);
  p_spUpdate_572fd35b3bb2 VARCHAR(255);
  p_spDelete_572fd35b3bb2 VARCHAR(255);
  p_spCreateGenerated_572fd35b3bb2 BOOLEAN;
  p_spUpdateGenerated_572fd35b3bb2 BOOLEAN;
  p_spDeleteGenerated_572fd35b3bb2 BOOLEAN;
  p_CascadeDeletes_572fd35b3bb2 BOOLEAN;
  p_DeleteType_572fd35b3bb2 VARCHAR(10);
  p_AllowRecordMerge_572fd35b3bb2 BOOLEAN;
  p_spMatch_572fd35b3bb2 VARCHAR(255);
  p_RelationshipDefaultDisplayType_572fd35b3bb2 VARCHAR(20);
  p_UserFormGenerated_572fd35b3bb2 BOOLEAN;
  p_EntityObjectSubclassName_572fd35b3bb2 VARCHAR(255);
  p_EntityObjectSubclassImport_572fd35b3bb2 VARCHAR(255);
  p_PreferredCommunicationField_572fd35b3bb2 VARCHAR(255);
  p_Icon_572fd35b3bb2 VARCHAR(500);
  p_ScopeDefault_572fd35b3bb2 VARCHAR(100);
  p_RowsToPackWithSchema_572fd35b3bb2 VARCHAR(20);
  p_RowsToPackSampleMethod_572fd35b3bb2 VARCHAR(20);
  p_RowsToPackSampleCount_572fd35b3bb2 INTEGER;
  p_RowsToPackSampleOrder_572fd35b3bb2 TEXT;
  p_AutoRowCountFrequency_572fd35b3bb2 INTEGER;
  p_RowCount_572fd35b3bb2 BIGINT;
  p_RowCountRunAt_572fd35b3bb2 TIMESTAMPTZ;
  p_Status_572fd35b3bb2 VARCHAR(25);
  p_DisplayName_572fd35b3bb2 VARCHAR(255);
  p_AllowMultipleSubtypes_572fd35b3bb2 BOOLEAN;
  p_AutoUpdateFullTextSearch_572fd35b3bb2 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_572fd35b3bb2 BOOLEAN;
  p_TrustServerCacheCompletely_572fd35b3bb2 BOOLEAN;
  p_SupportsGeoCoding_572fd35b3bb2 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_572fd35b3bb2 BOOLEAN;
  p_AllowCaching_572fd35b3bb2 BOOLEAN;
  p_DetectExternalChanges_572fd35b3bb2 BOOLEAN;
  p_ExternalDataSourceID_572fd35b3bb2 UUID;
  p_ExternalObjectName_572fd35b3bb2 VARCHAR(255);
  p_GeneratedBaseViewName_572fd35b3bb2 VARCHAR(255);
  p_AllowDirectSQLInsert_572fd35b3bb2 BOOLEAN;
  p_AllowDirectSQLUpdate_572fd35b3bb2 BOOLEAN;
  p_AllowDirectSQLDelete_572fd35b3bb2 BOOLEAN;
  p_Configuration_572fd35b3bb2 TEXT;
  p_SubtypeSelector_572fd35b3bb2 TEXT;
  p_EnableFieldLevelSecurity_572fd35b3bb2 BOOLEAN;
  p_ID_572fd35b3bb2 UUID;
BEGIN
  p_Name_572fd35b3bb2 := 'MJ_BizApps_Sales: Account Types';
  p_AutoUpdateDescription_572fd35b3bb2 := TRUE;
  p_BaseView_572fd35b3bb2 := 'vwAccountTypes';
  p_BaseViewGenerated_572fd35b3bb2 := TRUE;
  p_VirtualEntity_572fd35b3bb2 := FALSE;
  p_TrackRecordChanges_572fd35b3bb2 := TRUE;
  p_AuditRecordAccess_572fd35b3bb2 := FALSE;
  p_AuditViewRuns_572fd35b3bb2 := FALSE;
  p_IncludeInAPI_572fd35b3bb2 := TRUE;
  p_AllowAllRowsAPI_572fd35b3bb2 := FALSE;
  p_AllowUpdateAPI_572fd35b3bb2 := TRUE;
  p_AllowCreateAPI_572fd35b3bb2 := TRUE;
  p_AllowDeleteAPI_572fd35b3bb2 := TRUE;
  p_CustomResolverAPI_572fd35b3bb2 := FALSE;
  p_AllowUserSearchAPI_572fd35b3bb2 := FALSE;
  p_FullTextSearchEnabled_572fd35b3bb2 := FALSE;
  p_FullTextCatalogGenerated_572fd35b3bb2 := TRUE;
  p_FullTextIndexGenerated_572fd35b3bb2 := TRUE;
  p_FullTextSearchFunctionGenerated_572fd35b3bb2 := TRUE;
  p_UserViewMaxRows_572fd35b3bb2 := 1000;
  p_spCreateGenerated_572fd35b3bb2 := TRUE;
  p_spUpdateGenerated_572fd35b3bb2 := TRUE;
  p_spDeleteGenerated_572fd35b3bb2 := TRUE;
  p_CascadeDeletes_572fd35b3bb2 := FALSE;
  p_DeleteType_572fd35b3bb2 := 'Hard';
  p_AllowRecordMerge_572fd35b3bb2 := FALSE;
  p_RelationshipDefaultDisplayType_572fd35b3bb2 := 'Search';
  p_UserFormGenerated_572fd35b3bb2 := TRUE;
  p_RowsToPackWithSchema_572fd35b3bb2 := 'None';
  p_RowsToPackSampleMethod_572fd35b3bb2 := 'random';
  p_RowsToPackSampleCount_572fd35b3bb2 := 0;
  p_Status_572fd35b3bb2 := 'Active';
  p_DisplayName_572fd35b3bb2 := 'Account Types';
  p_AllowMultipleSubtypes_572fd35b3bb2 := FALSE;
  p_AutoUpdateFullTextSearch_572fd35b3bb2 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_572fd35b3bb2 := FALSE;
  p_TrustServerCacheCompletely_572fd35b3bb2 := TRUE;
  p_SupportsGeoCoding_572fd35b3bb2 := FALSE;
  p_AutoUpdateSupportsGeoCoding_572fd35b3bb2 := TRUE;
  p_AllowCaching_572fd35b3bb2 := FALSE;
  p_DetectExternalChanges_572fd35b3bb2 := FALSE;
  p_AllowDirectSQLInsert_572fd35b3bb2 := FALSE;
  p_AllowDirectSQLUpdate_572fd35b3bb2 := FALSE;
  p_AllowDirectSQLDelete_572fd35b3bb2 := FALSE;
  p_Configuration_572fd35b3bb2 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_572fd35b3bb2 := FALSE;
  p_ID_572fd35b3bb2 := '49B11108-EDB9-41F8-AE0F-959FFB95285B';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_572fd35b3bb2,
    'Name', p_Name_572fd35b3bb2,
    'NameSuffix', p_NameSuffix_572fd35b3bb2,
    'Description', p_Description_572fd35b3bb2,
    'AutoUpdateDescription', p_AutoUpdateDescription_572fd35b3bb2,
    'BaseView', p_BaseView_572fd35b3bb2,
    'BaseViewGenerated', p_BaseViewGenerated_572fd35b3bb2,
    'VirtualEntity', p_VirtualEntity_572fd35b3bb2,
    'TrackRecordChanges', p_TrackRecordChanges_572fd35b3bb2,
    'AuditRecordAccess', p_AuditRecordAccess_572fd35b3bb2,
    'AuditViewRuns', p_AuditViewRuns_572fd35b3bb2,
    'IncludeInAPI', p_IncludeInAPI_572fd35b3bb2,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_572fd35b3bb2,
    'AllowUpdateAPI', p_AllowUpdateAPI_572fd35b3bb2,
    'AllowCreateAPI', p_AllowCreateAPI_572fd35b3bb2,
    'AllowDeleteAPI', p_AllowDeleteAPI_572fd35b3bb2,
    'CustomResolverAPI', p_CustomResolverAPI_572fd35b3bb2,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_572fd35b3bb2,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_572fd35b3bb2,
    'FullTextCatalog', p_FullTextCatalog_572fd35b3bb2,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_572fd35b3bb2,
    'FullTextIndex', p_FullTextIndex_572fd35b3bb2,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_572fd35b3bb2,
    'FullTextSearchFunction', p_FullTextSearchFunction_572fd35b3bb2,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_572fd35b3bb2,
    'UserViewMaxRows', p_UserViewMaxRows_572fd35b3bb2,
    'spCreate', p_spCreate_572fd35b3bb2,
    'spUpdate', p_spUpdate_572fd35b3bb2,
    'spDelete', p_spDelete_572fd35b3bb2,
    'spCreateGenerated', p_spCreateGenerated_572fd35b3bb2,
    'spUpdateGenerated', p_spUpdateGenerated_572fd35b3bb2,
    'spDeleteGenerated', p_spDeleteGenerated_572fd35b3bb2,
    'CascadeDeletes', p_CascadeDeletes_572fd35b3bb2,
    'DeleteType', p_DeleteType_572fd35b3bb2,
    'AllowRecordMerge', p_AllowRecordMerge_572fd35b3bb2,
    'spMatch', p_spMatch_572fd35b3bb2,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_572fd35b3bb2,
    'UserFormGenerated', p_UserFormGenerated_572fd35b3bb2,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_572fd35b3bb2,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_572fd35b3bb2,
    'PreferredCommunicationField', p_PreferredCommunicationField_572fd35b3bb2,
    'Icon', p_Icon_572fd35b3bb2,
    'ScopeDefault', p_ScopeDefault_572fd35b3bb2,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_572fd35b3bb2,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_572fd35b3bb2,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_572fd35b3bb2,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_572fd35b3bb2,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_572fd35b3bb2,
    'RowCount', p_RowCount_572fd35b3bb2,
    'RowCountRunAt', p_RowCountRunAt_572fd35b3bb2
  ) ||
  jsonb_build_object(
    'Status', p_Status_572fd35b3bb2,
    'DisplayName', p_DisplayName_572fd35b3bb2,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_572fd35b3bb2,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_572fd35b3bb2,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_572fd35b3bb2,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_572fd35b3bb2,
    'SupportsGeoCoding', p_SupportsGeoCoding_572fd35b3bb2,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_572fd35b3bb2,
    'AllowCaching', p_AllowCaching_572fd35b3bb2,
    'DetectExternalChanges', p_DetectExternalChanges_572fd35b3bb2,
    'ExternalDataSourceID', p_ExternalDataSourceID_572fd35b3bb2,
    'ExternalObjectName', p_ExternalObjectName_572fd35b3bb2,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_572fd35b3bb2,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_572fd35b3bb2,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_572fd35b3bb2,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_572fd35b3bb2,
    'Configuration', p_Configuration_572fd35b3bb2,
    'SubtypeSelector', p_SubtypeSelector_572fd35b3bb2,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_572fd35b3bb2,
    'ID', p_ID_572fd35b3bb2
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_4a33c3a84f51 UUID;
  p_Name_4a33c3a84f51 VARCHAR(255);
  p_NameSuffix_4a33c3a84f51 VARCHAR(255);
  p_Description_4a33c3a84f51 TEXT;
  p_AutoUpdateDescription_4a33c3a84f51 BOOLEAN;
  p_BaseView_4a33c3a84f51 VARCHAR(255);
  p_BaseViewGenerated_4a33c3a84f51 BOOLEAN;
  p_VirtualEntity_4a33c3a84f51 BOOLEAN;
  p_TrackRecordChanges_4a33c3a84f51 BOOLEAN;
  p_AuditRecordAccess_4a33c3a84f51 BOOLEAN;
  p_AuditViewRuns_4a33c3a84f51 BOOLEAN;
  p_IncludeInAPI_4a33c3a84f51 BOOLEAN;
  p_AllowAllRowsAPI_4a33c3a84f51 BOOLEAN;
  p_AllowUpdateAPI_4a33c3a84f51 BOOLEAN;
  p_AllowCreateAPI_4a33c3a84f51 BOOLEAN;
  p_AllowDeleteAPI_4a33c3a84f51 BOOLEAN;
  p_CustomResolverAPI_4a33c3a84f51 BOOLEAN;
  p_AllowUserSearchAPI_4a33c3a84f51 BOOLEAN;
  p_FullTextSearchEnabled_4a33c3a84f51 BOOLEAN;
  p_FullTextCatalog_4a33c3a84f51 VARCHAR(255);
  p_FullTextCatalogGenerated_4a33c3a84f51 BOOLEAN;
  p_FullTextIndex_4a33c3a84f51 VARCHAR(255);
  p_FullTextIndexGenerated_4a33c3a84f51 BOOLEAN;
  p_FullTextSearchFunction_4a33c3a84f51 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_4a33c3a84f51 BOOLEAN;
  p_UserViewMaxRows_4a33c3a84f51 INTEGER;
  p_spCreate_4a33c3a84f51 VARCHAR(255);
  p_spUpdate_4a33c3a84f51 VARCHAR(255);
  p_spDelete_4a33c3a84f51 VARCHAR(255);
  p_spCreateGenerated_4a33c3a84f51 BOOLEAN;
  p_spUpdateGenerated_4a33c3a84f51 BOOLEAN;
  p_spDeleteGenerated_4a33c3a84f51 BOOLEAN;
  p_CascadeDeletes_4a33c3a84f51 BOOLEAN;
  p_DeleteType_4a33c3a84f51 VARCHAR(10);
  p_AllowRecordMerge_4a33c3a84f51 BOOLEAN;
  p_spMatch_4a33c3a84f51 VARCHAR(255);
  p_RelationshipDefaultDisplayType_4a33c3a84f51 VARCHAR(20);
  p_UserFormGenerated_4a33c3a84f51 BOOLEAN;
  p_EntityObjectSubclassName_4a33c3a84f51 VARCHAR(255);
  p_EntityObjectSubclassImport_4a33c3a84f51 VARCHAR(255);
  p_PreferredCommunicationField_4a33c3a84f51 VARCHAR(255);
  p_Icon_4a33c3a84f51 VARCHAR(500);
  p_ScopeDefault_4a33c3a84f51 VARCHAR(100);
  p_RowsToPackWithSchema_4a33c3a84f51 VARCHAR(20);
  p_RowsToPackSampleMethod_4a33c3a84f51 VARCHAR(20);
  p_RowsToPackSampleCount_4a33c3a84f51 INTEGER;
  p_RowsToPackSampleOrder_4a33c3a84f51 TEXT;
  p_AutoRowCountFrequency_4a33c3a84f51 INTEGER;
  p_RowCount_4a33c3a84f51 BIGINT;
  p_RowCountRunAt_4a33c3a84f51 TIMESTAMPTZ;
  p_Status_4a33c3a84f51 VARCHAR(25);
  p_DisplayName_4a33c3a84f51 VARCHAR(255);
  p_AllowMultipleSubtypes_4a33c3a84f51 BOOLEAN;
  p_AutoUpdateFullTextSearch_4a33c3a84f51 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_4a33c3a84f51 BOOLEAN;
  p_TrustServerCacheCompletely_4a33c3a84f51 BOOLEAN;
  p_SupportsGeoCoding_4a33c3a84f51 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_4a33c3a84f51 BOOLEAN;
  p_AllowCaching_4a33c3a84f51 BOOLEAN;
  p_DetectExternalChanges_4a33c3a84f51 BOOLEAN;
  p_ExternalDataSourceID_4a33c3a84f51 UUID;
  p_ExternalObjectName_4a33c3a84f51 VARCHAR(255);
  p_GeneratedBaseViewName_4a33c3a84f51 VARCHAR(255);
  p_AllowDirectSQLInsert_4a33c3a84f51 BOOLEAN;
  p_AllowDirectSQLUpdate_4a33c3a84f51 BOOLEAN;
  p_AllowDirectSQLDelete_4a33c3a84f51 BOOLEAN;
  p_Configuration_4a33c3a84f51 TEXT;
  p_SubtypeSelector_4a33c3a84f51 TEXT;
  p_EnableFieldLevelSecurity_4a33c3a84f51 BOOLEAN;
  p_ID_4a33c3a84f51 UUID;
BEGIN
  p_Name_4a33c3a84f51 := 'MJ_BizApps_Sales: Buying Role Types';
  p_AutoUpdateDescription_4a33c3a84f51 := TRUE;
  p_BaseView_4a33c3a84f51 := 'vwBuyingRoleTypes';
  p_BaseViewGenerated_4a33c3a84f51 := TRUE;
  p_VirtualEntity_4a33c3a84f51 := FALSE;
  p_TrackRecordChanges_4a33c3a84f51 := TRUE;
  p_AuditRecordAccess_4a33c3a84f51 := FALSE;
  p_AuditViewRuns_4a33c3a84f51 := FALSE;
  p_IncludeInAPI_4a33c3a84f51 := TRUE;
  p_AllowAllRowsAPI_4a33c3a84f51 := FALSE;
  p_AllowUpdateAPI_4a33c3a84f51 := TRUE;
  p_AllowCreateAPI_4a33c3a84f51 := TRUE;
  p_AllowDeleteAPI_4a33c3a84f51 := TRUE;
  p_CustomResolverAPI_4a33c3a84f51 := FALSE;
  p_AllowUserSearchAPI_4a33c3a84f51 := FALSE;
  p_FullTextSearchEnabled_4a33c3a84f51 := FALSE;
  p_FullTextCatalogGenerated_4a33c3a84f51 := TRUE;
  p_FullTextIndexGenerated_4a33c3a84f51 := TRUE;
  p_FullTextSearchFunctionGenerated_4a33c3a84f51 := TRUE;
  p_UserViewMaxRows_4a33c3a84f51 := 1000;
  p_spCreateGenerated_4a33c3a84f51 := TRUE;
  p_spUpdateGenerated_4a33c3a84f51 := TRUE;
  p_spDeleteGenerated_4a33c3a84f51 := TRUE;
  p_CascadeDeletes_4a33c3a84f51 := FALSE;
  p_DeleteType_4a33c3a84f51 := 'Hard';
  p_AllowRecordMerge_4a33c3a84f51 := FALSE;
  p_RelationshipDefaultDisplayType_4a33c3a84f51 := 'Search';
  p_UserFormGenerated_4a33c3a84f51 := TRUE;
  p_RowsToPackWithSchema_4a33c3a84f51 := 'None';
  p_RowsToPackSampleMethod_4a33c3a84f51 := 'random';
  p_RowsToPackSampleCount_4a33c3a84f51 := 0;
  p_Status_4a33c3a84f51 := 'Active';
  p_DisplayName_4a33c3a84f51 := 'Buying Role Types';
  p_AllowMultipleSubtypes_4a33c3a84f51 := FALSE;
  p_AutoUpdateFullTextSearch_4a33c3a84f51 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_4a33c3a84f51 := FALSE;
  p_TrustServerCacheCompletely_4a33c3a84f51 := TRUE;
  p_SupportsGeoCoding_4a33c3a84f51 := FALSE;
  p_AutoUpdateSupportsGeoCoding_4a33c3a84f51 := TRUE;
  p_AllowCaching_4a33c3a84f51 := FALSE;
  p_DetectExternalChanges_4a33c3a84f51 := FALSE;
  p_AllowDirectSQLInsert_4a33c3a84f51 := FALSE;
  p_AllowDirectSQLUpdate_4a33c3a84f51 := FALSE;
  p_AllowDirectSQLDelete_4a33c3a84f51 := FALSE;
  p_Configuration_4a33c3a84f51 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_4a33c3a84f51 := FALSE;
  p_ID_4a33c3a84f51 := '4C180A97-7A9A-4277-8A97-1632A19CB22D';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_4a33c3a84f51,
    'Name', p_Name_4a33c3a84f51,
    'NameSuffix', p_NameSuffix_4a33c3a84f51,
    'Description', p_Description_4a33c3a84f51,
    'AutoUpdateDescription', p_AutoUpdateDescription_4a33c3a84f51,
    'BaseView', p_BaseView_4a33c3a84f51,
    'BaseViewGenerated', p_BaseViewGenerated_4a33c3a84f51,
    'VirtualEntity', p_VirtualEntity_4a33c3a84f51,
    'TrackRecordChanges', p_TrackRecordChanges_4a33c3a84f51,
    'AuditRecordAccess', p_AuditRecordAccess_4a33c3a84f51,
    'AuditViewRuns', p_AuditViewRuns_4a33c3a84f51,
    'IncludeInAPI', p_IncludeInAPI_4a33c3a84f51,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_4a33c3a84f51,
    'AllowUpdateAPI', p_AllowUpdateAPI_4a33c3a84f51,
    'AllowCreateAPI', p_AllowCreateAPI_4a33c3a84f51,
    'AllowDeleteAPI', p_AllowDeleteAPI_4a33c3a84f51,
    'CustomResolverAPI', p_CustomResolverAPI_4a33c3a84f51,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_4a33c3a84f51,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_4a33c3a84f51,
    'FullTextCatalog', p_FullTextCatalog_4a33c3a84f51,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_4a33c3a84f51,
    'FullTextIndex', p_FullTextIndex_4a33c3a84f51,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_4a33c3a84f51,
    'FullTextSearchFunction', p_FullTextSearchFunction_4a33c3a84f51,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_4a33c3a84f51,
    'UserViewMaxRows', p_UserViewMaxRows_4a33c3a84f51,
    'spCreate', p_spCreate_4a33c3a84f51,
    'spUpdate', p_spUpdate_4a33c3a84f51,
    'spDelete', p_spDelete_4a33c3a84f51,
    'spCreateGenerated', p_spCreateGenerated_4a33c3a84f51,
    'spUpdateGenerated', p_spUpdateGenerated_4a33c3a84f51,
    'spDeleteGenerated', p_spDeleteGenerated_4a33c3a84f51,
    'CascadeDeletes', p_CascadeDeletes_4a33c3a84f51,
    'DeleteType', p_DeleteType_4a33c3a84f51,
    'AllowRecordMerge', p_AllowRecordMerge_4a33c3a84f51,
    'spMatch', p_spMatch_4a33c3a84f51,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_4a33c3a84f51,
    'UserFormGenerated', p_UserFormGenerated_4a33c3a84f51,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_4a33c3a84f51,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_4a33c3a84f51,
    'PreferredCommunicationField', p_PreferredCommunicationField_4a33c3a84f51,
    'Icon', p_Icon_4a33c3a84f51,
    'ScopeDefault', p_ScopeDefault_4a33c3a84f51,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_4a33c3a84f51,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_4a33c3a84f51,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_4a33c3a84f51,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_4a33c3a84f51,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_4a33c3a84f51,
    'RowCount', p_RowCount_4a33c3a84f51,
    'RowCountRunAt', p_RowCountRunAt_4a33c3a84f51
  ) ||
  jsonb_build_object(
    'Status', p_Status_4a33c3a84f51,
    'DisplayName', p_DisplayName_4a33c3a84f51,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_4a33c3a84f51,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_4a33c3a84f51,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_4a33c3a84f51,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_4a33c3a84f51,
    'SupportsGeoCoding', p_SupportsGeoCoding_4a33c3a84f51,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_4a33c3a84f51,
    'AllowCaching', p_AllowCaching_4a33c3a84f51,
    'DetectExternalChanges', p_DetectExternalChanges_4a33c3a84f51,
    'ExternalDataSourceID', p_ExternalDataSourceID_4a33c3a84f51,
    'ExternalObjectName', p_ExternalObjectName_4a33c3a84f51,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_4a33c3a84f51,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_4a33c3a84f51,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_4a33c3a84f51,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_4a33c3a84f51,
    'Configuration', p_Configuration_4a33c3a84f51,
    'SubtypeSelector', p_SubtypeSelector_4a33c3a84f51,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_4a33c3a84f51,
    'ID', p_ID_4a33c3a84f51
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_01388f97d053 UUID;
  p_Name_01388f97d053 VARCHAR(255);
  p_NameSuffix_01388f97d053 VARCHAR(255);
  p_Description_01388f97d053 TEXT;
  p_AutoUpdateDescription_01388f97d053 BOOLEAN;
  p_BaseView_01388f97d053 VARCHAR(255);
  p_BaseViewGenerated_01388f97d053 BOOLEAN;
  p_VirtualEntity_01388f97d053 BOOLEAN;
  p_TrackRecordChanges_01388f97d053 BOOLEAN;
  p_AuditRecordAccess_01388f97d053 BOOLEAN;
  p_AuditViewRuns_01388f97d053 BOOLEAN;
  p_IncludeInAPI_01388f97d053 BOOLEAN;
  p_AllowAllRowsAPI_01388f97d053 BOOLEAN;
  p_AllowUpdateAPI_01388f97d053 BOOLEAN;
  p_AllowCreateAPI_01388f97d053 BOOLEAN;
  p_AllowDeleteAPI_01388f97d053 BOOLEAN;
  p_CustomResolverAPI_01388f97d053 BOOLEAN;
  p_AllowUserSearchAPI_01388f97d053 BOOLEAN;
  p_FullTextSearchEnabled_01388f97d053 BOOLEAN;
  p_FullTextCatalog_01388f97d053 VARCHAR(255);
  p_FullTextCatalogGenerated_01388f97d053 BOOLEAN;
  p_FullTextIndex_01388f97d053 VARCHAR(255);
  p_FullTextIndexGenerated_01388f97d053 BOOLEAN;
  p_FullTextSearchFunction_01388f97d053 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_01388f97d053 BOOLEAN;
  p_UserViewMaxRows_01388f97d053 INTEGER;
  p_spCreate_01388f97d053 VARCHAR(255);
  p_spUpdate_01388f97d053 VARCHAR(255);
  p_spDelete_01388f97d053 VARCHAR(255);
  p_spCreateGenerated_01388f97d053 BOOLEAN;
  p_spUpdateGenerated_01388f97d053 BOOLEAN;
  p_spDeleteGenerated_01388f97d053 BOOLEAN;
  p_CascadeDeletes_01388f97d053 BOOLEAN;
  p_DeleteType_01388f97d053 VARCHAR(10);
  p_AllowRecordMerge_01388f97d053 BOOLEAN;
  p_spMatch_01388f97d053 VARCHAR(255);
  p_RelationshipDefaultDisplayType_01388f97d053 VARCHAR(20);
  p_UserFormGenerated_01388f97d053 BOOLEAN;
  p_EntityObjectSubclassName_01388f97d053 VARCHAR(255);
  p_EntityObjectSubclassImport_01388f97d053 VARCHAR(255);
  p_PreferredCommunicationField_01388f97d053 VARCHAR(255);
  p_Icon_01388f97d053 VARCHAR(500);
  p_ScopeDefault_01388f97d053 VARCHAR(100);
  p_RowsToPackWithSchema_01388f97d053 VARCHAR(20);
  p_RowsToPackSampleMethod_01388f97d053 VARCHAR(20);
  p_RowsToPackSampleCount_01388f97d053 INTEGER;
  p_RowsToPackSampleOrder_01388f97d053 TEXT;
  p_AutoRowCountFrequency_01388f97d053 INTEGER;
  p_RowCount_01388f97d053 BIGINT;
  p_RowCountRunAt_01388f97d053 TIMESTAMPTZ;
  p_Status_01388f97d053 VARCHAR(25);
  p_DisplayName_01388f97d053 VARCHAR(255);
  p_AllowMultipleSubtypes_01388f97d053 BOOLEAN;
  p_AutoUpdateFullTextSearch_01388f97d053 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_01388f97d053 BOOLEAN;
  p_TrustServerCacheCompletely_01388f97d053 BOOLEAN;
  p_SupportsGeoCoding_01388f97d053 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_01388f97d053 BOOLEAN;
  p_AllowCaching_01388f97d053 BOOLEAN;
  p_DetectExternalChanges_01388f97d053 BOOLEAN;
  p_ExternalDataSourceID_01388f97d053 UUID;
  p_ExternalObjectName_01388f97d053 VARCHAR(255);
  p_GeneratedBaseViewName_01388f97d053 VARCHAR(255);
  p_AllowDirectSQLInsert_01388f97d053 BOOLEAN;
  p_AllowDirectSQLUpdate_01388f97d053 BOOLEAN;
  p_AllowDirectSQLDelete_01388f97d053 BOOLEAN;
  p_Configuration_01388f97d053 TEXT;
  p_SubtypeSelector_01388f97d053 TEXT;
  p_EnableFieldLevelSecurity_01388f97d053 BOOLEAN;
  p_ID_01388f97d053 UUID;
BEGIN
  p_Name_01388f97d053 := 'MJ_BizApps_Sales: Deal Contact Roles';
  p_Description_01388f97d053 := 'The buying committee on the CUSTOMER side: which contact plays which role on this deal. A junction rather than a field on SalesContact because one contact holds different roles on different deals.';
  p_AutoUpdateDescription_01388f97d053 := TRUE;
  p_BaseView_01388f97d053 := 'vwDealContactRoles';
  p_BaseViewGenerated_01388f97d053 := TRUE;
  p_VirtualEntity_01388f97d053 := FALSE;
  p_TrackRecordChanges_01388f97d053 := TRUE;
  p_AuditRecordAccess_01388f97d053 := FALSE;
  p_AuditViewRuns_01388f97d053 := FALSE;
  p_IncludeInAPI_01388f97d053 := TRUE;
  p_AllowAllRowsAPI_01388f97d053 := FALSE;
  p_AllowUpdateAPI_01388f97d053 := TRUE;
  p_AllowCreateAPI_01388f97d053 := TRUE;
  p_AllowDeleteAPI_01388f97d053 := TRUE;
  p_CustomResolverAPI_01388f97d053 := FALSE;
  p_AllowUserSearchAPI_01388f97d053 := FALSE;
  p_FullTextSearchEnabled_01388f97d053 := FALSE;
  p_FullTextCatalogGenerated_01388f97d053 := TRUE;
  p_FullTextIndexGenerated_01388f97d053 := TRUE;
  p_FullTextSearchFunctionGenerated_01388f97d053 := TRUE;
  p_UserViewMaxRows_01388f97d053 := 1000;
  p_spCreateGenerated_01388f97d053 := TRUE;
  p_spUpdateGenerated_01388f97d053 := TRUE;
  p_spDeleteGenerated_01388f97d053 := TRUE;
  p_CascadeDeletes_01388f97d053 := FALSE;
  p_DeleteType_01388f97d053 := 'Hard';
  p_AllowRecordMerge_01388f97d053 := FALSE;
  p_RelationshipDefaultDisplayType_01388f97d053 := 'Search';
  p_UserFormGenerated_01388f97d053 := TRUE;
  p_RowsToPackWithSchema_01388f97d053 := 'None';
  p_RowsToPackSampleMethod_01388f97d053 := 'random';
  p_RowsToPackSampleCount_01388f97d053 := 0;
  p_Status_01388f97d053 := 'Active';
  p_DisplayName_01388f97d053 := 'Deal Contact Roles';
  p_AllowMultipleSubtypes_01388f97d053 := FALSE;
  p_AutoUpdateFullTextSearch_01388f97d053 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_01388f97d053 := FALSE;
  p_TrustServerCacheCompletely_01388f97d053 := TRUE;
  p_SupportsGeoCoding_01388f97d053 := FALSE;
  p_AutoUpdateSupportsGeoCoding_01388f97d053 := TRUE;
  p_AllowCaching_01388f97d053 := FALSE;
  p_DetectExternalChanges_01388f97d053 := FALSE;
  p_AllowDirectSQLInsert_01388f97d053 := FALSE;
  p_AllowDirectSQLUpdate_01388f97d053 := FALSE;
  p_AllowDirectSQLDelete_01388f97d053 := FALSE;
  p_Configuration_01388f97d053 := '{
  "UI": {
    "Form": {
      "Layout": "accordion"
    }
  }
}';
  p_EnableFieldLevelSecurity_01388f97d053 := FALSE;
  p_ID_01388f97d053 := '862535EB-36DD-4434-8B4E-E256363E781F';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_01388f97d053,
    'Name', p_Name_01388f97d053,
    'NameSuffix', p_NameSuffix_01388f97d053,
    'Description', p_Description_01388f97d053,
    'AutoUpdateDescription', p_AutoUpdateDescription_01388f97d053,
    'BaseView', p_BaseView_01388f97d053,
    'BaseViewGenerated', p_BaseViewGenerated_01388f97d053,
    'VirtualEntity', p_VirtualEntity_01388f97d053,
    'TrackRecordChanges', p_TrackRecordChanges_01388f97d053,
    'AuditRecordAccess', p_AuditRecordAccess_01388f97d053,
    'AuditViewRuns', p_AuditViewRuns_01388f97d053,
    'IncludeInAPI', p_IncludeInAPI_01388f97d053,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_01388f97d053,
    'AllowUpdateAPI', p_AllowUpdateAPI_01388f97d053,
    'AllowCreateAPI', p_AllowCreateAPI_01388f97d053,
    'AllowDeleteAPI', p_AllowDeleteAPI_01388f97d053,
    'CustomResolverAPI', p_CustomResolverAPI_01388f97d053,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_01388f97d053,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_01388f97d053,
    'FullTextCatalog', p_FullTextCatalog_01388f97d053,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_01388f97d053,
    'FullTextIndex', p_FullTextIndex_01388f97d053,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_01388f97d053,
    'FullTextSearchFunction', p_FullTextSearchFunction_01388f97d053,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_01388f97d053,
    'UserViewMaxRows', p_UserViewMaxRows_01388f97d053,
    'spCreate', p_spCreate_01388f97d053,
    'spUpdate', p_spUpdate_01388f97d053,
    'spDelete', p_spDelete_01388f97d053,
    'spCreateGenerated', p_spCreateGenerated_01388f97d053,
    'spUpdateGenerated', p_spUpdateGenerated_01388f97d053,
    'spDeleteGenerated', p_spDeleteGenerated_01388f97d053,
    'CascadeDeletes', p_CascadeDeletes_01388f97d053,
    'DeleteType', p_DeleteType_01388f97d053,
    'AllowRecordMerge', p_AllowRecordMerge_01388f97d053,
    'spMatch', p_spMatch_01388f97d053,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_01388f97d053,
    'UserFormGenerated', p_UserFormGenerated_01388f97d053,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_01388f97d053,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_01388f97d053,
    'PreferredCommunicationField', p_PreferredCommunicationField_01388f97d053,
    'Icon', p_Icon_01388f97d053,
    'ScopeDefault', p_ScopeDefault_01388f97d053,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_01388f97d053,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_01388f97d053,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_01388f97d053,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_01388f97d053,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_01388f97d053,
    'RowCount', p_RowCount_01388f97d053,
    'RowCountRunAt', p_RowCountRunAt_01388f97d053
  ) ||
  jsonb_build_object(
    'Status', p_Status_01388f97d053,
    'DisplayName', p_DisplayName_01388f97d053,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_01388f97d053,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_01388f97d053,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_01388f97d053,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_01388f97d053,
    'SupportsGeoCoding', p_SupportsGeoCoding_01388f97d053,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_01388f97d053,
    'AllowCaching', p_AllowCaching_01388f97d053,
    'DetectExternalChanges', p_DetectExternalChanges_01388f97d053,
    'ExternalDataSourceID', p_ExternalDataSourceID_01388f97d053,
    'ExternalObjectName', p_ExternalObjectName_01388f97d053,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_01388f97d053,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_01388f97d053,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_01388f97d053,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_01388f97d053,
    'Configuration', p_Configuration_01388f97d053,
    'SubtypeSelector', p_SubtypeSelector_01388f97d053,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_01388f97d053,
    'ID', p_ID_01388f97d053
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_2aa0c17985d0 UUID;
  p_Name_2aa0c17985d0 VARCHAR(255);
  p_NameSuffix_2aa0c17985d0 VARCHAR(255);
  p_Description_2aa0c17985d0 TEXT;
  p_AutoUpdateDescription_2aa0c17985d0 BOOLEAN;
  p_BaseView_2aa0c17985d0 VARCHAR(255);
  p_BaseViewGenerated_2aa0c17985d0 BOOLEAN;
  p_VirtualEntity_2aa0c17985d0 BOOLEAN;
  p_TrackRecordChanges_2aa0c17985d0 BOOLEAN;
  p_AuditRecordAccess_2aa0c17985d0 BOOLEAN;
  p_AuditViewRuns_2aa0c17985d0 BOOLEAN;
  p_IncludeInAPI_2aa0c17985d0 BOOLEAN;
  p_AllowAllRowsAPI_2aa0c17985d0 BOOLEAN;
  p_AllowUpdateAPI_2aa0c17985d0 BOOLEAN;
  p_AllowCreateAPI_2aa0c17985d0 BOOLEAN;
  p_AllowDeleteAPI_2aa0c17985d0 BOOLEAN;
  p_CustomResolverAPI_2aa0c17985d0 BOOLEAN;
  p_AllowUserSearchAPI_2aa0c17985d0 BOOLEAN;
  p_FullTextSearchEnabled_2aa0c17985d0 BOOLEAN;
  p_FullTextCatalog_2aa0c17985d0 VARCHAR(255);
  p_FullTextCatalogGenerated_2aa0c17985d0 BOOLEAN;
  p_FullTextIndex_2aa0c17985d0 VARCHAR(255);
  p_FullTextIndexGenerated_2aa0c17985d0 BOOLEAN;
  p_FullTextSearchFunction_2aa0c17985d0 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_2aa0c17985d0 BOOLEAN;
  p_UserViewMaxRows_2aa0c17985d0 INTEGER;
  p_spCreate_2aa0c17985d0 VARCHAR(255);
  p_spUpdate_2aa0c17985d0 VARCHAR(255);
  p_spDelete_2aa0c17985d0 VARCHAR(255);
  p_spCreateGenerated_2aa0c17985d0 BOOLEAN;
  p_spUpdateGenerated_2aa0c17985d0 BOOLEAN;
  p_spDeleteGenerated_2aa0c17985d0 BOOLEAN;
  p_CascadeDeletes_2aa0c17985d0 BOOLEAN;
  p_DeleteType_2aa0c17985d0 VARCHAR(10);
  p_AllowRecordMerge_2aa0c17985d0 BOOLEAN;
  p_spMatch_2aa0c17985d0 VARCHAR(255);
  p_RelationshipDefaultDisplayType_2aa0c17985d0 VARCHAR(20);
  p_UserFormGenerated_2aa0c17985d0 BOOLEAN;
  p_EntityObjectSubclassName_2aa0c17985d0 VARCHAR(255);
  p_EntityObjectSubclassImport_2aa0c17985d0 VARCHAR(255);
  p_PreferredCommunicationField_2aa0c17985d0 VARCHAR(255);
  p_Icon_2aa0c17985d0 VARCHAR(500);
  p_ScopeDefault_2aa0c17985d0 VARCHAR(100);
  p_RowsToPackWithSchema_2aa0c17985d0 VARCHAR(20);
  p_RowsToPackSampleMethod_2aa0c17985d0 VARCHAR(20);
  p_RowsToPackSampleCount_2aa0c17985d0 INTEGER;
  p_RowsToPackSampleOrder_2aa0c17985d0 TEXT;
  p_AutoRowCountFrequency_2aa0c17985d0 INTEGER;
  p_RowCount_2aa0c17985d0 BIGINT;
  p_RowCountRunAt_2aa0c17985d0 TIMESTAMPTZ;
  p_Status_2aa0c17985d0 VARCHAR(25);
  p_DisplayName_2aa0c17985d0 VARCHAR(255);
  p_AllowMultipleSubtypes_2aa0c17985d0 BOOLEAN;
  p_AutoUpdateFullTextSearch_2aa0c17985d0 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_2aa0c17985d0 BOOLEAN;
  p_TrustServerCacheCompletely_2aa0c17985d0 BOOLEAN;
  p_SupportsGeoCoding_2aa0c17985d0 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_2aa0c17985d0 BOOLEAN;
  p_AllowCaching_2aa0c17985d0 BOOLEAN;
  p_DetectExternalChanges_2aa0c17985d0 BOOLEAN;
  p_ExternalDataSourceID_2aa0c17985d0 UUID;
  p_ExternalObjectName_2aa0c17985d0 VARCHAR(255);
  p_GeneratedBaseViewName_2aa0c17985d0 VARCHAR(255);
  p_AllowDirectSQLInsert_2aa0c17985d0 BOOLEAN;
  p_AllowDirectSQLUpdate_2aa0c17985d0 BOOLEAN;
  p_AllowDirectSQLDelete_2aa0c17985d0 BOOLEAN;
  p_Configuration_2aa0c17985d0 TEXT;
  p_SubtypeSelector_2aa0c17985d0 TEXT;
  p_EnableFieldLevelSecurity_2aa0c17985d0 BOOLEAN;
  p_ID_2aa0c17985d0 UUID;
BEGIN
  p_Name_2aa0c17985d0 := 'MJ_BizApps_Sales: Deal Payment Schedules';
  p_Description_2aa0c17985d0 := 'The EXCEPTION payment schedule for a deal. THE ABSENCE OF ROWS IS THE COMMON CASE and that is the design: the standard term is 100% payable on execution, so a deal on standard terms carries no rows here and rows exist only where something else was negotiated. Storing the default on every deal would let a later change to "default" silently rewrite history, and would turn "did this deal negotiate payment terms?" into arithmetic instead of a row count. This app does NOT check that the schedule sums to the deal amount — that is computing money, and the authoritative total lives in orders.';
  p_AutoUpdateDescription_2aa0c17985d0 := TRUE;
  p_BaseView_2aa0c17985d0 := 'vwDealPaymentSchedules';
  p_BaseViewGenerated_2aa0c17985d0 := TRUE;
  p_VirtualEntity_2aa0c17985d0 := FALSE;
  p_TrackRecordChanges_2aa0c17985d0 := TRUE;
  p_AuditRecordAccess_2aa0c17985d0 := FALSE;
  p_AuditViewRuns_2aa0c17985d0 := FALSE;
  p_IncludeInAPI_2aa0c17985d0 := TRUE;
  p_AllowAllRowsAPI_2aa0c17985d0 := FALSE;
  p_AllowUpdateAPI_2aa0c17985d0 := TRUE;
  p_AllowCreateAPI_2aa0c17985d0 := TRUE;
  p_AllowDeleteAPI_2aa0c17985d0 := TRUE;
  p_CustomResolverAPI_2aa0c17985d0 := FALSE;
  p_AllowUserSearchAPI_2aa0c17985d0 := FALSE;
  p_FullTextSearchEnabled_2aa0c17985d0 := FALSE;
  p_FullTextCatalogGenerated_2aa0c17985d0 := TRUE;
  p_FullTextIndexGenerated_2aa0c17985d0 := TRUE;
  p_FullTextSearchFunctionGenerated_2aa0c17985d0 := TRUE;
  p_UserViewMaxRows_2aa0c17985d0 := 1000;
  p_spCreateGenerated_2aa0c17985d0 := TRUE;
  p_spUpdateGenerated_2aa0c17985d0 := TRUE;
  p_spDeleteGenerated_2aa0c17985d0 := TRUE;
  p_CascadeDeletes_2aa0c17985d0 := FALSE;
  p_DeleteType_2aa0c17985d0 := 'Hard';
  p_AllowRecordMerge_2aa0c17985d0 := FALSE;
  p_RelationshipDefaultDisplayType_2aa0c17985d0 := 'Search';
  p_UserFormGenerated_2aa0c17985d0 := TRUE;
  p_RowsToPackWithSchema_2aa0c17985d0 := 'None';
  p_RowsToPackSampleMethod_2aa0c17985d0 := 'random';
  p_RowsToPackSampleCount_2aa0c17985d0 := 0;
  p_Status_2aa0c17985d0 := 'Active';
  p_DisplayName_2aa0c17985d0 := 'Deal Payment Schedules';
  p_AllowMultipleSubtypes_2aa0c17985d0 := FALSE;
  p_AutoUpdateFullTextSearch_2aa0c17985d0 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_2aa0c17985d0 := FALSE;
  p_TrustServerCacheCompletely_2aa0c17985d0 := TRUE;
  p_SupportsGeoCoding_2aa0c17985d0 := FALSE;
  p_AutoUpdateSupportsGeoCoding_2aa0c17985d0 := TRUE;
  p_AllowCaching_2aa0c17985d0 := FALSE;
  p_DetectExternalChanges_2aa0c17985d0 := FALSE;
  p_AllowDirectSQLInsert_2aa0c17985d0 := FALSE;
  p_AllowDirectSQLUpdate_2aa0c17985d0 := FALSE;
  p_AllowDirectSQLDelete_2aa0c17985d0 := FALSE;
  p_Configuration_2aa0c17985d0 := '{
  "UI": {
    "Form": {
      "Layout": "accordion"
    }
  }
}';
  p_EnableFieldLevelSecurity_2aa0c17985d0 := FALSE;
  p_ID_2aa0c17985d0 := '69B5DBE6-F0A4-4291-9947-0B2B8129F349';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_2aa0c17985d0,
    'Name', p_Name_2aa0c17985d0,
    'NameSuffix', p_NameSuffix_2aa0c17985d0,
    'Description', p_Description_2aa0c17985d0,
    'AutoUpdateDescription', p_AutoUpdateDescription_2aa0c17985d0,
    'BaseView', p_BaseView_2aa0c17985d0,
    'BaseViewGenerated', p_BaseViewGenerated_2aa0c17985d0,
    'VirtualEntity', p_VirtualEntity_2aa0c17985d0,
    'TrackRecordChanges', p_TrackRecordChanges_2aa0c17985d0,
    'AuditRecordAccess', p_AuditRecordAccess_2aa0c17985d0,
    'AuditViewRuns', p_AuditViewRuns_2aa0c17985d0,
    'IncludeInAPI', p_IncludeInAPI_2aa0c17985d0,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_2aa0c17985d0,
    'AllowUpdateAPI', p_AllowUpdateAPI_2aa0c17985d0,
    'AllowCreateAPI', p_AllowCreateAPI_2aa0c17985d0,
    'AllowDeleteAPI', p_AllowDeleteAPI_2aa0c17985d0,
    'CustomResolverAPI', p_CustomResolverAPI_2aa0c17985d0,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_2aa0c17985d0,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_2aa0c17985d0,
    'FullTextCatalog', p_FullTextCatalog_2aa0c17985d0,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_2aa0c17985d0,
    'FullTextIndex', p_FullTextIndex_2aa0c17985d0,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_2aa0c17985d0,
    'FullTextSearchFunction', p_FullTextSearchFunction_2aa0c17985d0,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_2aa0c17985d0,
    'UserViewMaxRows', p_UserViewMaxRows_2aa0c17985d0,
    'spCreate', p_spCreate_2aa0c17985d0,
    'spUpdate', p_spUpdate_2aa0c17985d0,
    'spDelete', p_spDelete_2aa0c17985d0,
    'spCreateGenerated', p_spCreateGenerated_2aa0c17985d0,
    'spUpdateGenerated', p_spUpdateGenerated_2aa0c17985d0,
    'spDeleteGenerated', p_spDeleteGenerated_2aa0c17985d0,
    'CascadeDeletes', p_CascadeDeletes_2aa0c17985d0,
    'DeleteType', p_DeleteType_2aa0c17985d0,
    'AllowRecordMerge', p_AllowRecordMerge_2aa0c17985d0,
    'spMatch', p_spMatch_2aa0c17985d0,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_2aa0c17985d0,
    'UserFormGenerated', p_UserFormGenerated_2aa0c17985d0,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_2aa0c17985d0,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_2aa0c17985d0,
    'PreferredCommunicationField', p_PreferredCommunicationField_2aa0c17985d0,
    'Icon', p_Icon_2aa0c17985d0,
    'ScopeDefault', p_ScopeDefault_2aa0c17985d0,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_2aa0c17985d0,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_2aa0c17985d0,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_2aa0c17985d0,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_2aa0c17985d0,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_2aa0c17985d0,
    'RowCount', p_RowCount_2aa0c17985d0,
    'RowCountRunAt', p_RowCountRunAt_2aa0c17985d0
  ) ||
  jsonb_build_object(
    'Status', p_Status_2aa0c17985d0,
    'DisplayName', p_DisplayName_2aa0c17985d0,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_2aa0c17985d0,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_2aa0c17985d0,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_2aa0c17985d0,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_2aa0c17985d0,
    'SupportsGeoCoding', p_SupportsGeoCoding_2aa0c17985d0,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_2aa0c17985d0,
    'AllowCaching', p_AllowCaching_2aa0c17985d0,
    'DetectExternalChanges', p_DetectExternalChanges_2aa0c17985d0,
    'ExternalDataSourceID', p_ExternalDataSourceID_2aa0c17985d0,
    'ExternalObjectName', p_ExternalObjectName_2aa0c17985d0,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_2aa0c17985d0,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_2aa0c17985d0,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_2aa0c17985d0,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_2aa0c17985d0,
    'Configuration', p_Configuration_2aa0c17985d0,
    'SubtypeSelector', p_SubtypeSelector_2aa0c17985d0,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_2aa0c17985d0,
    'ID', p_ID_2aa0c17985d0
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_d448c0c39117 UUID;
  p_Name_d448c0c39117 VARCHAR(255);
  p_NameSuffix_d448c0c39117 VARCHAR(255);
  p_Description_d448c0c39117 TEXT;
  p_AutoUpdateDescription_d448c0c39117 BOOLEAN;
  p_BaseView_d448c0c39117 VARCHAR(255);
  p_BaseViewGenerated_d448c0c39117 BOOLEAN;
  p_VirtualEntity_d448c0c39117 BOOLEAN;
  p_TrackRecordChanges_d448c0c39117 BOOLEAN;
  p_AuditRecordAccess_d448c0c39117 BOOLEAN;
  p_AuditViewRuns_d448c0c39117 BOOLEAN;
  p_IncludeInAPI_d448c0c39117 BOOLEAN;
  p_AllowAllRowsAPI_d448c0c39117 BOOLEAN;
  p_AllowUpdateAPI_d448c0c39117 BOOLEAN;
  p_AllowCreateAPI_d448c0c39117 BOOLEAN;
  p_AllowDeleteAPI_d448c0c39117 BOOLEAN;
  p_CustomResolverAPI_d448c0c39117 BOOLEAN;
  p_AllowUserSearchAPI_d448c0c39117 BOOLEAN;
  p_FullTextSearchEnabled_d448c0c39117 BOOLEAN;
  p_FullTextCatalog_d448c0c39117 VARCHAR(255);
  p_FullTextCatalogGenerated_d448c0c39117 BOOLEAN;
  p_FullTextIndex_d448c0c39117 VARCHAR(255);
  p_FullTextIndexGenerated_d448c0c39117 BOOLEAN;
  p_FullTextSearchFunction_d448c0c39117 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_d448c0c39117 BOOLEAN;
  p_UserViewMaxRows_d448c0c39117 INTEGER;
  p_spCreate_d448c0c39117 VARCHAR(255);
  p_spUpdate_d448c0c39117 VARCHAR(255);
  p_spDelete_d448c0c39117 VARCHAR(255);
  p_spCreateGenerated_d448c0c39117 BOOLEAN;
  p_spUpdateGenerated_d448c0c39117 BOOLEAN;
  p_spDeleteGenerated_d448c0c39117 BOOLEAN;
  p_CascadeDeletes_d448c0c39117 BOOLEAN;
  p_DeleteType_d448c0c39117 VARCHAR(10);
  p_AllowRecordMerge_d448c0c39117 BOOLEAN;
  p_spMatch_d448c0c39117 VARCHAR(255);
  p_RelationshipDefaultDisplayType_d448c0c39117 VARCHAR(20);
  p_UserFormGenerated_d448c0c39117 BOOLEAN;
  p_EntityObjectSubclassName_d448c0c39117 VARCHAR(255);
  p_EntityObjectSubclassImport_d448c0c39117 VARCHAR(255);
  p_PreferredCommunicationField_d448c0c39117 VARCHAR(255);
  p_Icon_d448c0c39117 VARCHAR(500);
  p_ScopeDefault_d448c0c39117 VARCHAR(100);
  p_RowsToPackWithSchema_d448c0c39117 VARCHAR(20);
  p_RowsToPackSampleMethod_d448c0c39117 VARCHAR(20);
  p_RowsToPackSampleCount_d448c0c39117 INTEGER;
  p_RowsToPackSampleOrder_d448c0c39117 TEXT;
  p_AutoRowCountFrequency_d448c0c39117 INTEGER;
  p_RowCount_d448c0c39117 BIGINT;
  p_RowCountRunAt_d448c0c39117 TIMESTAMPTZ;
  p_Status_d448c0c39117 VARCHAR(25);
  p_DisplayName_d448c0c39117 VARCHAR(255);
  p_AllowMultipleSubtypes_d448c0c39117 BOOLEAN;
  p_AutoUpdateFullTextSearch_d448c0c39117 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_d448c0c39117 BOOLEAN;
  p_TrustServerCacheCompletely_d448c0c39117 BOOLEAN;
  p_SupportsGeoCoding_d448c0c39117 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_d448c0c39117 BOOLEAN;
  p_AllowCaching_d448c0c39117 BOOLEAN;
  p_DetectExternalChanges_d448c0c39117 BOOLEAN;
  p_ExternalDataSourceID_d448c0c39117 UUID;
  p_ExternalObjectName_d448c0c39117 VARCHAR(255);
  p_GeneratedBaseViewName_d448c0c39117 VARCHAR(255);
  p_AllowDirectSQLInsert_d448c0c39117 BOOLEAN;
  p_AllowDirectSQLUpdate_d448c0c39117 BOOLEAN;
  p_AllowDirectSQLDelete_d448c0c39117 BOOLEAN;
  p_Configuration_d448c0c39117 TEXT;
  p_SubtypeSelector_d448c0c39117 TEXT;
  p_EnableFieldLevelSecurity_d448c0c39117 BOOLEAN;
  p_ID_d448c0c39117 UUID;
BEGIN
  p_Name_d448c0c39117 := 'MJ_BizApps_Sales: Deal Roles';
  p_Description_d448c0c39117 := 'The roles internal people hold on a deal (Owner/AE, Sales Engineer, SDR, Executive Sponsor, Partner Manager, CS Lead).';
  p_AutoUpdateDescription_d448c0c39117 := TRUE;
  p_BaseView_d448c0c39117 := 'vwDealRoles';
  p_BaseViewGenerated_d448c0c39117 := TRUE;
  p_VirtualEntity_d448c0c39117 := FALSE;
  p_TrackRecordChanges_d448c0c39117 := TRUE;
  p_AuditRecordAccess_d448c0c39117 := FALSE;
  p_AuditViewRuns_d448c0c39117 := FALSE;
  p_IncludeInAPI_d448c0c39117 := TRUE;
  p_AllowAllRowsAPI_d448c0c39117 := FALSE;
  p_AllowUpdateAPI_d448c0c39117 := TRUE;
  p_AllowCreateAPI_d448c0c39117 := TRUE;
  p_AllowDeleteAPI_d448c0c39117 := TRUE;
  p_CustomResolverAPI_d448c0c39117 := FALSE;
  p_AllowUserSearchAPI_d448c0c39117 := TRUE;
  p_FullTextSearchEnabled_d448c0c39117 := FALSE;
  p_FullTextCatalogGenerated_d448c0c39117 := TRUE;
  p_FullTextIndexGenerated_d448c0c39117 := TRUE;
  p_FullTextSearchFunctionGenerated_d448c0c39117 := TRUE;
  p_UserViewMaxRows_d448c0c39117 := 1000;
  p_spCreateGenerated_d448c0c39117 := TRUE;
  p_spUpdateGenerated_d448c0c39117 := TRUE;
  p_spDeleteGenerated_d448c0c39117 := TRUE;
  p_CascadeDeletes_d448c0c39117 := FALSE;
  p_DeleteType_d448c0c39117 := 'Hard';
  p_AllowRecordMerge_d448c0c39117 := FALSE;
  p_RelationshipDefaultDisplayType_d448c0c39117 := 'Search';
  p_UserFormGenerated_d448c0c39117 := TRUE;
  p_RowsToPackWithSchema_d448c0c39117 := 'None';
  p_RowsToPackSampleMethod_d448c0c39117 := 'random';
  p_RowsToPackSampleCount_d448c0c39117 := 0;
  p_Status_d448c0c39117 := 'Active';
  p_DisplayName_d448c0c39117 := 'Deal Roles';
  p_AllowMultipleSubtypes_d448c0c39117 := FALSE;
  p_AutoUpdateFullTextSearch_d448c0c39117 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_d448c0c39117 := FALSE;
  p_TrustServerCacheCompletely_d448c0c39117 := TRUE;
  p_SupportsGeoCoding_d448c0c39117 := FALSE;
  p_AutoUpdateSupportsGeoCoding_d448c0c39117 := TRUE;
  p_AllowCaching_d448c0c39117 := FALSE;
  p_DetectExternalChanges_d448c0c39117 := FALSE;
  p_AllowDirectSQLInsert_d448c0c39117 := FALSE;
  p_AllowDirectSQLUpdate_d448c0c39117 := FALSE;
  p_AllowDirectSQLDelete_d448c0c39117 := FALSE;
  p_Configuration_d448c0c39117 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_d448c0c39117 := FALSE;
  p_ID_d448c0c39117 := 'F1C22449-8F48-42A8-945C-CBE2EFD9E847';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_d448c0c39117,
    'Name', p_Name_d448c0c39117,
    'NameSuffix', p_NameSuffix_d448c0c39117,
    'Description', p_Description_d448c0c39117,
    'AutoUpdateDescription', p_AutoUpdateDescription_d448c0c39117,
    'BaseView', p_BaseView_d448c0c39117,
    'BaseViewGenerated', p_BaseViewGenerated_d448c0c39117,
    'VirtualEntity', p_VirtualEntity_d448c0c39117,
    'TrackRecordChanges', p_TrackRecordChanges_d448c0c39117,
    'AuditRecordAccess', p_AuditRecordAccess_d448c0c39117,
    'AuditViewRuns', p_AuditViewRuns_d448c0c39117,
    'IncludeInAPI', p_IncludeInAPI_d448c0c39117,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_d448c0c39117,
    'AllowUpdateAPI', p_AllowUpdateAPI_d448c0c39117,
    'AllowCreateAPI', p_AllowCreateAPI_d448c0c39117,
    'AllowDeleteAPI', p_AllowDeleteAPI_d448c0c39117,
    'CustomResolverAPI', p_CustomResolverAPI_d448c0c39117,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_d448c0c39117,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_d448c0c39117,
    'FullTextCatalog', p_FullTextCatalog_d448c0c39117,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_d448c0c39117,
    'FullTextIndex', p_FullTextIndex_d448c0c39117,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_d448c0c39117,
    'FullTextSearchFunction', p_FullTextSearchFunction_d448c0c39117,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_d448c0c39117,
    'UserViewMaxRows', p_UserViewMaxRows_d448c0c39117,
    'spCreate', p_spCreate_d448c0c39117,
    'spUpdate', p_spUpdate_d448c0c39117,
    'spDelete', p_spDelete_d448c0c39117,
    'spCreateGenerated', p_spCreateGenerated_d448c0c39117,
    'spUpdateGenerated', p_spUpdateGenerated_d448c0c39117,
    'spDeleteGenerated', p_spDeleteGenerated_d448c0c39117,
    'CascadeDeletes', p_CascadeDeletes_d448c0c39117,
    'DeleteType', p_DeleteType_d448c0c39117,
    'AllowRecordMerge', p_AllowRecordMerge_d448c0c39117,
    'spMatch', p_spMatch_d448c0c39117,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_d448c0c39117,
    'UserFormGenerated', p_UserFormGenerated_d448c0c39117,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_d448c0c39117,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_d448c0c39117,
    'PreferredCommunicationField', p_PreferredCommunicationField_d448c0c39117,
    'Icon', p_Icon_d448c0c39117,
    'ScopeDefault', p_ScopeDefault_d448c0c39117,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_d448c0c39117,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_d448c0c39117,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_d448c0c39117,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_d448c0c39117,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_d448c0c39117,
    'RowCount', p_RowCount_d448c0c39117,
    'RowCountRunAt', p_RowCountRunAt_d448c0c39117
  ) ||
  jsonb_build_object(
    'Status', p_Status_d448c0c39117,
    'DisplayName', p_DisplayName_d448c0c39117,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_d448c0c39117,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_d448c0c39117,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_d448c0c39117,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_d448c0c39117,
    'SupportsGeoCoding', p_SupportsGeoCoding_d448c0c39117,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_d448c0c39117,
    'AllowCaching', p_AllowCaching_d448c0c39117,
    'DetectExternalChanges', p_DetectExternalChanges_d448c0c39117,
    'ExternalDataSourceID', p_ExternalDataSourceID_d448c0c39117,
    'ExternalObjectName', p_ExternalObjectName_d448c0c39117,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_d448c0c39117,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_d448c0c39117,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_d448c0c39117,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_d448c0c39117,
    'Configuration', p_Configuration_d448c0c39117,
    'SubtypeSelector', p_SubtypeSelector_d448c0c39117,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_d448c0c39117,
    'ID', p_ID_d448c0c39117
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_53aadba64b22 UUID;
  p_Name_53aadba64b22 VARCHAR(255);
  p_NameSuffix_53aadba64b22 VARCHAR(255);
  p_Description_53aadba64b22 TEXT;
  p_AutoUpdateDescription_53aadba64b22 BOOLEAN;
  p_BaseView_53aadba64b22 VARCHAR(255);
  p_BaseViewGenerated_53aadba64b22 BOOLEAN;
  p_VirtualEntity_53aadba64b22 BOOLEAN;
  p_TrackRecordChanges_53aadba64b22 BOOLEAN;
  p_AuditRecordAccess_53aadba64b22 BOOLEAN;
  p_AuditViewRuns_53aadba64b22 BOOLEAN;
  p_IncludeInAPI_53aadba64b22 BOOLEAN;
  p_AllowAllRowsAPI_53aadba64b22 BOOLEAN;
  p_AllowUpdateAPI_53aadba64b22 BOOLEAN;
  p_AllowCreateAPI_53aadba64b22 BOOLEAN;
  p_AllowDeleteAPI_53aadba64b22 BOOLEAN;
  p_CustomResolverAPI_53aadba64b22 BOOLEAN;
  p_AllowUserSearchAPI_53aadba64b22 BOOLEAN;
  p_FullTextSearchEnabled_53aadba64b22 BOOLEAN;
  p_FullTextCatalog_53aadba64b22 VARCHAR(255);
  p_FullTextCatalogGenerated_53aadba64b22 BOOLEAN;
  p_FullTextIndex_53aadba64b22 VARCHAR(255);
  p_FullTextIndexGenerated_53aadba64b22 BOOLEAN;
  p_FullTextSearchFunction_53aadba64b22 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_53aadba64b22 BOOLEAN;
  p_UserViewMaxRows_53aadba64b22 INTEGER;
  p_spCreate_53aadba64b22 VARCHAR(255);
  p_spUpdate_53aadba64b22 VARCHAR(255);
  p_spDelete_53aadba64b22 VARCHAR(255);
  p_spCreateGenerated_53aadba64b22 BOOLEAN;
  p_spUpdateGenerated_53aadba64b22 BOOLEAN;
  p_spDeleteGenerated_53aadba64b22 BOOLEAN;
  p_CascadeDeletes_53aadba64b22 BOOLEAN;
  p_DeleteType_53aadba64b22 VARCHAR(10);
  p_AllowRecordMerge_53aadba64b22 BOOLEAN;
  p_spMatch_53aadba64b22 VARCHAR(255);
  p_RelationshipDefaultDisplayType_53aadba64b22 VARCHAR(20);
  p_UserFormGenerated_53aadba64b22 BOOLEAN;
  p_EntityObjectSubclassName_53aadba64b22 VARCHAR(255);
  p_EntityObjectSubclassImport_53aadba64b22 VARCHAR(255);
  p_PreferredCommunicationField_53aadba64b22 VARCHAR(255);
  p_Icon_53aadba64b22 VARCHAR(500);
  p_ScopeDefault_53aadba64b22 VARCHAR(100);
  p_RowsToPackWithSchema_53aadba64b22 VARCHAR(20);
  p_RowsToPackSampleMethod_53aadba64b22 VARCHAR(20);
  p_RowsToPackSampleCount_53aadba64b22 INTEGER;
  p_RowsToPackSampleOrder_53aadba64b22 TEXT;
  p_AutoRowCountFrequency_53aadba64b22 INTEGER;
  p_RowCount_53aadba64b22 BIGINT;
  p_RowCountRunAt_53aadba64b22 TIMESTAMPTZ;
  p_Status_53aadba64b22 VARCHAR(25);
  p_DisplayName_53aadba64b22 VARCHAR(255);
  p_AllowMultipleSubtypes_53aadba64b22 BOOLEAN;
  p_AutoUpdateFullTextSearch_53aadba64b22 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_53aadba64b22 BOOLEAN;
  p_TrustServerCacheCompletely_53aadba64b22 BOOLEAN;
  p_SupportsGeoCoding_53aadba64b22 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_53aadba64b22 BOOLEAN;
  p_AllowCaching_53aadba64b22 BOOLEAN;
  p_DetectExternalChanges_53aadba64b22 BOOLEAN;
  p_ExternalDataSourceID_53aadba64b22 UUID;
  p_ExternalObjectName_53aadba64b22 VARCHAR(255);
  p_GeneratedBaseViewName_53aadba64b22 VARCHAR(255);
  p_AllowDirectSQLInsert_53aadba64b22 BOOLEAN;
  p_AllowDirectSQLUpdate_53aadba64b22 BOOLEAN;
  p_AllowDirectSQLDelete_53aadba64b22 BOOLEAN;
  p_Configuration_53aadba64b22 TEXT;
  p_SubtypeSelector_53aadba64b22 TEXT;
  p_EnableFieldLevelSecurity_53aadba64b22 BOOLEAN;
  p_ID_53aadba64b22 UUID;
BEGIN
  p_Name_53aadba64b22 := 'MJ_BizApps_Sales: Deal Sequences';
  p_AutoUpdateDescription_53aadba64b22 := TRUE;
  p_BaseView_53aadba64b22 := 'vwDealSequences';
  p_BaseViewGenerated_53aadba64b22 := TRUE;
  p_VirtualEntity_53aadba64b22 := FALSE;
  p_TrackRecordChanges_53aadba64b22 := TRUE;
  p_AuditRecordAccess_53aadba64b22 := FALSE;
  p_AuditViewRuns_53aadba64b22 := FALSE;
  p_IncludeInAPI_53aadba64b22 := TRUE;
  p_AllowAllRowsAPI_53aadba64b22 := FALSE;
  p_AllowUpdateAPI_53aadba64b22 := TRUE;
  p_AllowCreateAPI_53aadba64b22 := TRUE;
  p_AllowDeleteAPI_53aadba64b22 := TRUE;
  p_CustomResolverAPI_53aadba64b22 := FALSE;
  p_AllowUserSearchAPI_53aadba64b22 := FALSE;
  p_FullTextSearchEnabled_53aadba64b22 := FALSE;
  p_FullTextCatalogGenerated_53aadba64b22 := TRUE;
  p_FullTextIndexGenerated_53aadba64b22 := TRUE;
  p_FullTextSearchFunctionGenerated_53aadba64b22 := TRUE;
  p_UserViewMaxRows_53aadba64b22 := 1000;
  p_spCreateGenerated_53aadba64b22 := TRUE;
  p_spUpdateGenerated_53aadba64b22 := TRUE;
  p_spDeleteGenerated_53aadba64b22 := TRUE;
  p_CascadeDeletes_53aadba64b22 := FALSE;
  p_DeleteType_53aadba64b22 := 'Hard';
  p_AllowRecordMerge_53aadba64b22 := FALSE;
  p_RelationshipDefaultDisplayType_53aadba64b22 := 'Search';
  p_UserFormGenerated_53aadba64b22 := TRUE;
  p_RowsToPackWithSchema_53aadba64b22 := 'None';
  p_RowsToPackSampleMethod_53aadba64b22 := 'random';
  p_RowsToPackSampleCount_53aadba64b22 := 0;
  p_Status_53aadba64b22 := 'Active';
  p_DisplayName_53aadba64b22 := 'Deal Sequences';
  p_AllowMultipleSubtypes_53aadba64b22 := FALSE;
  p_AutoUpdateFullTextSearch_53aadba64b22 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_53aadba64b22 := FALSE;
  p_TrustServerCacheCompletely_53aadba64b22 := TRUE;
  p_SupportsGeoCoding_53aadba64b22 := FALSE;
  p_AutoUpdateSupportsGeoCoding_53aadba64b22 := TRUE;
  p_AllowCaching_53aadba64b22 := FALSE;
  p_DetectExternalChanges_53aadba64b22 := FALSE;
  p_AllowDirectSQLInsert_53aadba64b22 := FALSE;
  p_AllowDirectSQLUpdate_53aadba64b22 := FALSE;
  p_AllowDirectSQLDelete_53aadba64b22 := FALSE;
  p_Configuration_53aadba64b22 := '{
  "UI": {
    "Form": {
      "Layout": "accordion"
    }
  }
}';
  p_EnableFieldLevelSecurity_53aadba64b22 := FALSE;
  p_ID_53aadba64b22 := 'B3CC65A2-DF0B-4AD8-8749-152329A2C27B';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_53aadba64b22,
    'Name', p_Name_53aadba64b22,
    'NameSuffix', p_NameSuffix_53aadba64b22,
    'Description', p_Description_53aadba64b22,
    'AutoUpdateDescription', p_AutoUpdateDescription_53aadba64b22,
    'BaseView', p_BaseView_53aadba64b22,
    'BaseViewGenerated', p_BaseViewGenerated_53aadba64b22,
    'VirtualEntity', p_VirtualEntity_53aadba64b22,
    'TrackRecordChanges', p_TrackRecordChanges_53aadba64b22,
    'AuditRecordAccess', p_AuditRecordAccess_53aadba64b22,
    'AuditViewRuns', p_AuditViewRuns_53aadba64b22,
    'IncludeInAPI', p_IncludeInAPI_53aadba64b22,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_53aadba64b22,
    'AllowUpdateAPI', p_AllowUpdateAPI_53aadba64b22,
    'AllowCreateAPI', p_AllowCreateAPI_53aadba64b22,
    'AllowDeleteAPI', p_AllowDeleteAPI_53aadba64b22,
    'CustomResolverAPI', p_CustomResolverAPI_53aadba64b22,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_53aadba64b22,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_53aadba64b22,
    'FullTextCatalog', p_FullTextCatalog_53aadba64b22,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_53aadba64b22,
    'FullTextIndex', p_FullTextIndex_53aadba64b22,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_53aadba64b22,
    'FullTextSearchFunction', p_FullTextSearchFunction_53aadba64b22,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_53aadba64b22,
    'UserViewMaxRows', p_UserViewMaxRows_53aadba64b22,
    'spCreate', p_spCreate_53aadba64b22,
    'spUpdate', p_spUpdate_53aadba64b22,
    'spDelete', p_spDelete_53aadba64b22,
    'spCreateGenerated', p_spCreateGenerated_53aadba64b22,
    'spUpdateGenerated', p_spUpdateGenerated_53aadba64b22,
    'spDeleteGenerated', p_spDeleteGenerated_53aadba64b22,
    'CascadeDeletes', p_CascadeDeletes_53aadba64b22,
    'DeleteType', p_DeleteType_53aadba64b22,
    'AllowRecordMerge', p_AllowRecordMerge_53aadba64b22,
    'spMatch', p_spMatch_53aadba64b22,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_53aadba64b22,
    'UserFormGenerated', p_UserFormGenerated_53aadba64b22,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_53aadba64b22,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_53aadba64b22,
    'PreferredCommunicationField', p_PreferredCommunicationField_53aadba64b22,
    'Icon', p_Icon_53aadba64b22,
    'ScopeDefault', p_ScopeDefault_53aadba64b22,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_53aadba64b22,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_53aadba64b22,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_53aadba64b22,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_53aadba64b22,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_53aadba64b22,
    'RowCount', p_RowCount_53aadba64b22,
    'RowCountRunAt', p_RowCountRunAt_53aadba64b22
  ) ||
  jsonb_build_object(
    'Status', p_Status_53aadba64b22,
    'DisplayName', p_DisplayName_53aadba64b22,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_53aadba64b22,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_53aadba64b22,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_53aadba64b22,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_53aadba64b22,
    'SupportsGeoCoding', p_SupportsGeoCoding_53aadba64b22,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_53aadba64b22,
    'AllowCaching', p_AllowCaching_53aadba64b22,
    'DetectExternalChanges', p_DetectExternalChanges_53aadba64b22,
    'ExternalDataSourceID', p_ExternalDataSourceID_53aadba64b22,
    'ExternalObjectName', p_ExternalObjectName_53aadba64b22,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_53aadba64b22,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_53aadba64b22,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_53aadba64b22,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_53aadba64b22,
    'Configuration', p_Configuration_53aadba64b22,
    'SubtypeSelector', p_SubtypeSelector_53aadba64b22,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_53aadba64b22,
    'ID', p_ID_53aadba64b22
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_1d7e762d39bc UUID;
  p_Name_1d7e762d39bc VARCHAR(255);
  p_NameSuffix_1d7e762d39bc VARCHAR(255);
  p_Description_1d7e762d39bc TEXT;
  p_AutoUpdateDescription_1d7e762d39bc BOOLEAN;
  p_BaseView_1d7e762d39bc VARCHAR(255);
  p_BaseViewGenerated_1d7e762d39bc BOOLEAN;
  p_VirtualEntity_1d7e762d39bc BOOLEAN;
  p_TrackRecordChanges_1d7e762d39bc BOOLEAN;
  p_AuditRecordAccess_1d7e762d39bc BOOLEAN;
  p_AuditViewRuns_1d7e762d39bc BOOLEAN;
  p_IncludeInAPI_1d7e762d39bc BOOLEAN;
  p_AllowAllRowsAPI_1d7e762d39bc BOOLEAN;
  p_AllowUpdateAPI_1d7e762d39bc BOOLEAN;
  p_AllowCreateAPI_1d7e762d39bc BOOLEAN;
  p_AllowDeleteAPI_1d7e762d39bc BOOLEAN;
  p_CustomResolverAPI_1d7e762d39bc BOOLEAN;
  p_AllowUserSearchAPI_1d7e762d39bc BOOLEAN;
  p_FullTextSearchEnabled_1d7e762d39bc BOOLEAN;
  p_FullTextCatalog_1d7e762d39bc VARCHAR(255);
  p_FullTextCatalogGenerated_1d7e762d39bc BOOLEAN;
  p_FullTextIndex_1d7e762d39bc VARCHAR(255);
  p_FullTextIndexGenerated_1d7e762d39bc BOOLEAN;
  p_FullTextSearchFunction_1d7e762d39bc VARCHAR(255);
  p_FullTextSearchFunctionGenerated_1d7e762d39bc BOOLEAN;
  p_UserViewMaxRows_1d7e762d39bc INTEGER;
  p_spCreate_1d7e762d39bc VARCHAR(255);
  p_spUpdate_1d7e762d39bc VARCHAR(255);
  p_spDelete_1d7e762d39bc VARCHAR(255);
  p_spCreateGenerated_1d7e762d39bc BOOLEAN;
  p_spUpdateGenerated_1d7e762d39bc BOOLEAN;
  p_spDeleteGenerated_1d7e762d39bc BOOLEAN;
  p_CascadeDeletes_1d7e762d39bc BOOLEAN;
  p_DeleteType_1d7e762d39bc VARCHAR(10);
  p_AllowRecordMerge_1d7e762d39bc BOOLEAN;
  p_spMatch_1d7e762d39bc VARCHAR(255);
  p_RelationshipDefaultDisplayType_1d7e762d39bc VARCHAR(20);
  p_UserFormGenerated_1d7e762d39bc BOOLEAN;
  p_EntityObjectSubclassName_1d7e762d39bc VARCHAR(255);
  p_EntityObjectSubclassImport_1d7e762d39bc VARCHAR(255);
  p_PreferredCommunicationField_1d7e762d39bc VARCHAR(255);
  p_Icon_1d7e762d39bc VARCHAR(500);
  p_ScopeDefault_1d7e762d39bc VARCHAR(100);
  p_RowsToPackWithSchema_1d7e762d39bc VARCHAR(20);
  p_RowsToPackSampleMethod_1d7e762d39bc VARCHAR(20);
  p_RowsToPackSampleCount_1d7e762d39bc INTEGER;
  p_RowsToPackSampleOrder_1d7e762d39bc TEXT;
  p_AutoRowCountFrequency_1d7e762d39bc INTEGER;
  p_RowCount_1d7e762d39bc BIGINT;
  p_RowCountRunAt_1d7e762d39bc TIMESTAMPTZ;
  p_Status_1d7e762d39bc VARCHAR(25);
  p_DisplayName_1d7e762d39bc VARCHAR(255);
  p_AllowMultipleSubtypes_1d7e762d39bc BOOLEAN;
  p_AutoUpdateFullTextSearch_1d7e762d39bc BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_1d7e762d39bc BOOLEAN;
  p_TrustServerCacheCompletely_1d7e762d39bc BOOLEAN;
  p_SupportsGeoCoding_1d7e762d39bc BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_1d7e762d39bc BOOLEAN;
  p_AllowCaching_1d7e762d39bc BOOLEAN;
  p_DetectExternalChanges_1d7e762d39bc BOOLEAN;
  p_ExternalDataSourceID_1d7e762d39bc UUID;
  p_ExternalObjectName_1d7e762d39bc VARCHAR(255);
  p_GeneratedBaseViewName_1d7e762d39bc VARCHAR(255);
  p_AllowDirectSQLInsert_1d7e762d39bc BOOLEAN;
  p_AllowDirectSQLUpdate_1d7e762d39bc BOOLEAN;
  p_AllowDirectSQLDelete_1d7e762d39bc BOOLEAN;
  p_Configuration_1d7e762d39bc TEXT;
  p_SubtypeSelector_1d7e762d39bc TEXT;
  p_EnableFieldLevelSecurity_1d7e762d39bc BOOLEAN;
  p_ID_1d7e762d39bc UUID;
BEGIN
  p_Name_1d7e762d39bc := 'MJ_BizApps_Sales: Deal Stage Events';
  p_Description_1d7e762d39bc := 'APPEND-ONLY transition log, never edited. The source for stage conversion, velocity, dwell time, slippage and skipped-stage analysis. Stamping the amount and probability AT each transition is what lets historical roll-ups reconstruct correctly after a deal''s amount changes.';
  p_AutoUpdateDescription_1d7e762d39bc := TRUE;
  p_BaseView_1d7e762d39bc := 'vwDealStageEvents';
  p_BaseViewGenerated_1d7e762d39bc := TRUE;
  p_VirtualEntity_1d7e762d39bc := FALSE;
  p_TrackRecordChanges_1d7e762d39bc := TRUE;
  p_AuditRecordAccess_1d7e762d39bc := FALSE;
  p_AuditViewRuns_1d7e762d39bc := FALSE;
  p_IncludeInAPI_1d7e762d39bc := TRUE;
  p_AllowAllRowsAPI_1d7e762d39bc := FALSE;
  p_AllowUpdateAPI_1d7e762d39bc := TRUE;
  p_AllowCreateAPI_1d7e762d39bc := TRUE;
  p_AllowDeleteAPI_1d7e762d39bc := TRUE;
  p_CustomResolverAPI_1d7e762d39bc := FALSE;
  p_AllowUserSearchAPI_1d7e762d39bc := FALSE;
  p_FullTextSearchEnabled_1d7e762d39bc := FALSE;
  p_FullTextCatalogGenerated_1d7e762d39bc := TRUE;
  p_FullTextIndexGenerated_1d7e762d39bc := TRUE;
  p_FullTextSearchFunctionGenerated_1d7e762d39bc := TRUE;
  p_UserViewMaxRows_1d7e762d39bc := 1000;
  p_spCreateGenerated_1d7e762d39bc := TRUE;
  p_spUpdateGenerated_1d7e762d39bc := TRUE;
  p_spDeleteGenerated_1d7e762d39bc := TRUE;
  p_CascadeDeletes_1d7e762d39bc := FALSE;
  p_DeleteType_1d7e762d39bc := 'Hard';
  p_AllowRecordMerge_1d7e762d39bc := FALSE;
  p_RelationshipDefaultDisplayType_1d7e762d39bc := 'Search';
  p_UserFormGenerated_1d7e762d39bc := TRUE;
  p_RowsToPackWithSchema_1d7e762d39bc := 'None';
  p_RowsToPackSampleMethod_1d7e762d39bc := 'random';
  p_RowsToPackSampleCount_1d7e762d39bc := 0;
  p_Status_1d7e762d39bc := 'Active';
  p_DisplayName_1d7e762d39bc := 'Deal Stage Events';
  p_AllowMultipleSubtypes_1d7e762d39bc := FALSE;
  p_AutoUpdateFullTextSearch_1d7e762d39bc := TRUE;
  p_AutoUpdateAllowUserSearchAPI_1d7e762d39bc := FALSE;
  p_TrustServerCacheCompletely_1d7e762d39bc := TRUE;
  p_SupportsGeoCoding_1d7e762d39bc := FALSE;
  p_AutoUpdateSupportsGeoCoding_1d7e762d39bc := TRUE;
  p_AllowCaching_1d7e762d39bc := FALSE;
  p_DetectExternalChanges_1d7e762d39bc := FALSE;
  p_AllowDirectSQLInsert_1d7e762d39bc := FALSE;
  p_AllowDirectSQLUpdate_1d7e762d39bc := FALSE;
  p_AllowDirectSQLDelete_1d7e762d39bc := FALSE;
  p_EnableFieldLevelSecurity_1d7e762d39bc := FALSE;
  p_ID_1d7e762d39bc := '5AC3D14E-A9BA-4667-AF73-5928DAE446BF';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_1d7e762d39bc,
    'Name', p_Name_1d7e762d39bc,
    'NameSuffix', p_NameSuffix_1d7e762d39bc,
    'Description', p_Description_1d7e762d39bc,
    'AutoUpdateDescription', p_AutoUpdateDescription_1d7e762d39bc,
    'BaseView', p_BaseView_1d7e762d39bc,
    'BaseViewGenerated', p_BaseViewGenerated_1d7e762d39bc,
    'VirtualEntity', p_VirtualEntity_1d7e762d39bc,
    'TrackRecordChanges', p_TrackRecordChanges_1d7e762d39bc,
    'AuditRecordAccess', p_AuditRecordAccess_1d7e762d39bc,
    'AuditViewRuns', p_AuditViewRuns_1d7e762d39bc,
    'IncludeInAPI', p_IncludeInAPI_1d7e762d39bc,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_1d7e762d39bc,
    'AllowUpdateAPI', p_AllowUpdateAPI_1d7e762d39bc,
    'AllowCreateAPI', p_AllowCreateAPI_1d7e762d39bc,
    'AllowDeleteAPI', p_AllowDeleteAPI_1d7e762d39bc,
    'CustomResolverAPI', p_CustomResolverAPI_1d7e762d39bc,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_1d7e762d39bc,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_1d7e762d39bc,
    'FullTextCatalog', p_FullTextCatalog_1d7e762d39bc,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_1d7e762d39bc,
    'FullTextIndex', p_FullTextIndex_1d7e762d39bc,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_1d7e762d39bc,
    'FullTextSearchFunction', p_FullTextSearchFunction_1d7e762d39bc,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_1d7e762d39bc,
    'UserViewMaxRows', p_UserViewMaxRows_1d7e762d39bc,
    'spCreate', p_spCreate_1d7e762d39bc,
    'spUpdate', p_spUpdate_1d7e762d39bc,
    'spDelete', p_spDelete_1d7e762d39bc,
    'spCreateGenerated', p_spCreateGenerated_1d7e762d39bc,
    'spUpdateGenerated', p_spUpdateGenerated_1d7e762d39bc,
    'spDeleteGenerated', p_spDeleteGenerated_1d7e762d39bc,
    'CascadeDeletes', p_CascadeDeletes_1d7e762d39bc,
    'DeleteType', p_DeleteType_1d7e762d39bc,
    'AllowRecordMerge', p_AllowRecordMerge_1d7e762d39bc,
    'spMatch', p_spMatch_1d7e762d39bc,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_1d7e762d39bc,
    'UserFormGenerated', p_UserFormGenerated_1d7e762d39bc,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_1d7e762d39bc,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_1d7e762d39bc,
    'PreferredCommunicationField', p_PreferredCommunicationField_1d7e762d39bc,
    'Icon', p_Icon_1d7e762d39bc,
    'ScopeDefault', p_ScopeDefault_1d7e762d39bc,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_1d7e762d39bc,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_1d7e762d39bc,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_1d7e762d39bc,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_1d7e762d39bc,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_1d7e762d39bc,
    'RowCount', p_RowCount_1d7e762d39bc,
    'RowCountRunAt', p_RowCountRunAt_1d7e762d39bc
  ) ||
  jsonb_build_object(
    'Status', p_Status_1d7e762d39bc,
    'DisplayName', p_DisplayName_1d7e762d39bc,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_1d7e762d39bc,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_1d7e762d39bc,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_1d7e762d39bc,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_1d7e762d39bc,
    'SupportsGeoCoding', p_SupportsGeoCoding_1d7e762d39bc,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_1d7e762d39bc,
    'AllowCaching', p_AllowCaching_1d7e762d39bc,
    'DetectExternalChanges', p_DetectExternalChanges_1d7e762d39bc,
    'ExternalDataSourceID', p_ExternalDataSourceID_1d7e762d39bc,
    'ExternalObjectName', p_ExternalObjectName_1d7e762d39bc,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_1d7e762d39bc,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_1d7e762d39bc,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_1d7e762d39bc,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_1d7e762d39bc,
    'Configuration', p_Configuration_1d7e762d39bc,
    'SubtypeSelector', p_SubtypeSelector_1d7e762d39bc,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_1d7e762d39bc,
    'ID', p_ID_1d7e762d39bc
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_99391990b229 UUID;
  p_Name_99391990b229 VARCHAR(255);
  p_NameSuffix_99391990b229 VARCHAR(255);
  p_Description_99391990b229 TEXT;
  p_AutoUpdateDescription_99391990b229 BOOLEAN;
  p_BaseView_99391990b229 VARCHAR(255);
  p_BaseViewGenerated_99391990b229 BOOLEAN;
  p_VirtualEntity_99391990b229 BOOLEAN;
  p_TrackRecordChanges_99391990b229 BOOLEAN;
  p_AuditRecordAccess_99391990b229 BOOLEAN;
  p_AuditViewRuns_99391990b229 BOOLEAN;
  p_IncludeInAPI_99391990b229 BOOLEAN;
  p_AllowAllRowsAPI_99391990b229 BOOLEAN;
  p_AllowUpdateAPI_99391990b229 BOOLEAN;
  p_AllowCreateAPI_99391990b229 BOOLEAN;
  p_AllowDeleteAPI_99391990b229 BOOLEAN;
  p_CustomResolverAPI_99391990b229 BOOLEAN;
  p_AllowUserSearchAPI_99391990b229 BOOLEAN;
  p_FullTextSearchEnabled_99391990b229 BOOLEAN;
  p_FullTextCatalog_99391990b229 VARCHAR(255);
  p_FullTextCatalogGenerated_99391990b229 BOOLEAN;
  p_FullTextIndex_99391990b229 VARCHAR(255);
  p_FullTextIndexGenerated_99391990b229 BOOLEAN;
  p_FullTextSearchFunction_99391990b229 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_99391990b229 BOOLEAN;
  p_UserViewMaxRows_99391990b229 INTEGER;
  p_spCreate_99391990b229 VARCHAR(255);
  p_spUpdate_99391990b229 VARCHAR(255);
  p_spDelete_99391990b229 VARCHAR(255);
  p_spCreateGenerated_99391990b229 BOOLEAN;
  p_spUpdateGenerated_99391990b229 BOOLEAN;
  p_spDeleteGenerated_99391990b229 BOOLEAN;
  p_CascadeDeletes_99391990b229 BOOLEAN;
  p_DeleteType_99391990b229 VARCHAR(10);
  p_AllowRecordMerge_99391990b229 BOOLEAN;
  p_spMatch_99391990b229 VARCHAR(255);
  p_RelationshipDefaultDisplayType_99391990b229 VARCHAR(20);
  p_UserFormGenerated_99391990b229 BOOLEAN;
  p_EntityObjectSubclassName_99391990b229 VARCHAR(255);
  p_EntityObjectSubclassImport_99391990b229 VARCHAR(255);
  p_PreferredCommunicationField_99391990b229 VARCHAR(255);
  p_Icon_99391990b229 VARCHAR(500);
  p_ScopeDefault_99391990b229 VARCHAR(100);
  p_RowsToPackWithSchema_99391990b229 VARCHAR(20);
  p_RowsToPackSampleMethod_99391990b229 VARCHAR(20);
  p_RowsToPackSampleCount_99391990b229 INTEGER;
  p_RowsToPackSampleOrder_99391990b229 TEXT;
  p_AutoRowCountFrequency_99391990b229 INTEGER;
  p_RowCount_99391990b229 BIGINT;
  p_RowCountRunAt_99391990b229 TIMESTAMPTZ;
  p_Status_99391990b229 VARCHAR(25);
  p_DisplayName_99391990b229 VARCHAR(255);
  p_AllowMultipleSubtypes_99391990b229 BOOLEAN;
  p_AutoUpdateFullTextSearch_99391990b229 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_99391990b229 BOOLEAN;
  p_TrustServerCacheCompletely_99391990b229 BOOLEAN;
  p_SupportsGeoCoding_99391990b229 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_99391990b229 BOOLEAN;
  p_AllowCaching_99391990b229 BOOLEAN;
  p_DetectExternalChanges_99391990b229 BOOLEAN;
  p_ExternalDataSourceID_99391990b229 UUID;
  p_ExternalObjectName_99391990b229 VARCHAR(255);
  p_GeneratedBaseViewName_99391990b229 VARCHAR(255);
  p_AllowDirectSQLInsert_99391990b229 BOOLEAN;
  p_AllowDirectSQLUpdate_99391990b229 BOOLEAN;
  p_AllowDirectSQLDelete_99391990b229 BOOLEAN;
  p_Configuration_99391990b229 TEXT;
  p_SubtypeSelector_99391990b229 TEXT;
  p_EnableFieldLevelSecurity_99391990b229 BOOLEAN;
  p_ID_99391990b229 UUID;
BEGIN
  p_Name_99391990b229 := 'MJ_BizApps_Sales: Deal Status Types';
  p_Description_99391990b229 := 'The OUTCOME vocabulary for deals (Open, Won, Lost, Abandoned, On Hold ...). Behaviour comes from the flags on this row, NEVER from the Name — Sales.CloseDeal is named for the outcome type rather than a hardcoded "won" precisely so it can resolve everything from IsWon/IsLost/LocksDeal. Renaming a status is a metadata change with no code impact.';
  p_AutoUpdateDescription_99391990b229 := TRUE;
  p_BaseView_99391990b229 := 'vwDealStatusTypes';
  p_BaseViewGenerated_99391990b229 := TRUE;
  p_VirtualEntity_99391990b229 := FALSE;
  p_TrackRecordChanges_99391990b229 := TRUE;
  p_AuditRecordAccess_99391990b229 := FALSE;
  p_AuditViewRuns_99391990b229 := FALSE;
  p_IncludeInAPI_99391990b229 := TRUE;
  p_AllowAllRowsAPI_99391990b229 := FALSE;
  p_AllowUpdateAPI_99391990b229 := TRUE;
  p_AllowCreateAPI_99391990b229 := TRUE;
  p_AllowDeleteAPI_99391990b229 := TRUE;
  p_CustomResolverAPI_99391990b229 := FALSE;
  p_AllowUserSearchAPI_99391990b229 := TRUE;
  p_FullTextSearchEnabled_99391990b229 := FALSE;
  p_FullTextCatalogGenerated_99391990b229 := TRUE;
  p_FullTextIndexGenerated_99391990b229 := TRUE;
  p_FullTextSearchFunctionGenerated_99391990b229 := TRUE;
  p_UserViewMaxRows_99391990b229 := 1000;
  p_spCreateGenerated_99391990b229 := TRUE;
  p_spUpdateGenerated_99391990b229 := TRUE;
  p_spDeleteGenerated_99391990b229 := TRUE;
  p_CascadeDeletes_99391990b229 := FALSE;
  p_DeleteType_99391990b229 := 'Hard';
  p_AllowRecordMerge_99391990b229 := FALSE;
  p_RelationshipDefaultDisplayType_99391990b229 := 'Search';
  p_UserFormGenerated_99391990b229 := TRUE;
  p_RowsToPackWithSchema_99391990b229 := 'None';
  p_RowsToPackSampleMethod_99391990b229 := 'random';
  p_RowsToPackSampleCount_99391990b229 := 0;
  p_Status_99391990b229 := 'Active';
  p_DisplayName_99391990b229 := 'Deal Status Types';
  p_AllowMultipleSubtypes_99391990b229 := FALSE;
  p_AutoUpdateFullTextSearch_99391990b229 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_99391990b229 := FALSE;
  p_TrustServerCacheCompletely_99391990b229 := TRUE;
  p_SupportsGeoCoding_99391990b229 := FALSE;
  p_AutoUpdateSupportsGeoCoding_99391990b229 := TRUE;
  p_AllowCaching_99391990b229 := FALSE;
  p_DetectExternalChanges_99391990b229 := FALSE;
  p_AllowDirectSQLInsert_99391990b229 := FALSE;
  p_AllowDirectSQLUpdate_99391990b229 := FALSE;
  p_AllowDirectSQLDelete_99391990b229 := FALSE;
  p_Configuration_99391990b229 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_99391990b229 := FALSE;
  p_ID_99391990b229 := '27E8D79F-A8E2-4AC1-B208-5A0F11416197';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_99391990b229,
    'Name', p_Name_99391990b229,
    'NameSuffix', p_NameSuffix_99391990b229,
    'Description', p_Description_99391990b229,
    'AutoUpdateDescription', p_AutoUpdateDescription_99391990b229,
    'BaseView', p_BaseView_99391990b229,
    'BaseViewGenerated', p_BaseViewGenerated_99391990b229,
    'VirtualEntity', p_VirtualEntity_99391990b229,
    'TrackRecordChanges', p_TrackRecordChanges_99391990b229,
    'AuditRecordAccess', p_AuditRecordAccess_99391990b229,
    'AuditViewRuns', p_AuditViewRuns_99391990b229,
    'IncludeInAPI', p_IncludeInAPI_99391990b229,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_99391990b229,
    'AllowUpdateAPI', p_AllowUpdateAPI_99391990b229,
    'AllowCreateAPI', p_AllowCreateAPI_99391990b229,
    'AllowDeleteAPI', p_AllowDeleteAPI_99391990b229,
    'CustomResolverAPI', p_CustomResolverAPI_99391990b229,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_99391990b229,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_99391990b229,
    'FullTextCatalog', p_FullTextCatalog_99391990b229,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_99391990b229,
    'FullTextIndex', p_FullTextIndex_99391990b229,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_99391990b229,
    'FullTextSearchFunction', p_FullTextSearchFunction_99391990b229,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_99391990b229,
    'UserViewMaxRows', p_UserViewMaxRows_99391990b229,
    'spCreate', p_spCreate_99391990b229,
    'spUpdate', p_spUpdate_99391990b229,
    'spDelete', p_spDelete_99391990b229,
    'spCreateGenerated', p_spCreateGenerated_99391990b229,
    'spUpdateGenerated', p_spUpdateGenerated_99391990b229,
    'spDeleteGenerated', p_spDeleteGenerated_99391990b229,
    'CascadeDeletes', p_CascadeDeletes_99391990b229,
    'DeleteType', p_DeleteType_99391990b229,
    'AllowRecordMerge', p_AllowRecordMerge_99391990b229,
    'spMatch', p_spMatch_99391990b229,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_99391990b229,
    'UserFormGenerated', p_UserFormGenerated_99391990b229,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_99391990b229,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_99391990b229,
    'PreferredCommunicationField', p_PreferredCommunicationField_99391990b229,
    'Icon', p_Icon_99391990b229,
    'ScopeDefault', p_ScopeDefault_99391990b229,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_99391990b229,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_99391990b229,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_99391990b229,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_99391990b229,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_99391990b229,
    'RowCount', p_RowCount_99391990b229,
    'RowCountRunAt', p_RowCountRunAt_99391990b229
  ) ||
  jsonb_build_object(
    'Status', p_Status_99391990b229,
    'DisplayName', p_DisplayName_99391990b229,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_99391990b229,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_99391990b229,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_99391990b229,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_99391990b229,
    'SupportsGeoCoding', p_SupportsGeoCoding_99391990b229,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_99391990b229,
    'AllowCaching', p_AllowCaching_99391990b229,
    'DetectExternalChanges', p_DetectExternalChanges_99391990b229,
    'ExternalDataSourceID', p_ExternalDataSourceID_99391990b229,
    'ExternalObjectName', p_ExternalObjectName_99391990b229,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_99391990b229,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_99391990b229,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_99391990b229,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_99391990b229,
    'Configuration', p_Configuration_99391990b229,
    'SubtypeSelector', p_SubtypeSelector_99391990b229,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_99391990b229,
    'ID', p_ID_99391990b229
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_c7238aa4b4dc UUID;
  p_Name_c7238aa4b4dc VARCHAR(255);
  p_NameSuffix_c7238aa4b4dc VARCHAR(255);
  p_Description_c7238aa4b4dc TEXT;
  p_AutoUpdateDescription_c7238aa4b4dc BOOLEAN;
  p_BaseView_c7238aa4b4dc VARCHAR(255);
  p_BaseViewGenerated_c7238aa4b4dc BOOLEAN;
  p_VirtualEntity_c7238aa4b4dc BOOLEAN;
  p_TrackRecordChanges_c7238aa4b4dc BOOLEAN;
  p_AuditRecordAccess_c7238aa4b4dc BOOLEAN;
  p_AuditViewRuns_c7238aa4b4dc BOOLEAN;
  p_IncludeInAPI_c7238aa4b4dc BOOLEAN;
  p_AllowAllRowsAPI_c7238aa4b4dc BOOLEAN;
  p_AllowUpdateAPI_c7238aa4b4dc BOOLEAN;
  p_AllowCreateAPI_c7238aa4b4dc BOOLEAN;
  p_AllowDeleteAPI_c7238aa4b4dc BOOLEAN;
  p_CustomResolverAPI_c7238aa4b4dc BOOLEAN;
  p_AllowUserSearchAPI_c7238aa4b4dc BOOLEAN;
  p_FullTextSearchEnabled_c7238aa4b4dc BOOLEAN;
  p_FullTextCatalog_c7238aa4b4dc VARCHAR(255);
  p_FullTextCatalogGenerated_c7238aa4b4dc BOOLEAN;
  p_FullTextIndex_c7238aa4b4dc VARCHAR(255);
  p_FullTextIndexGenerated_c7238aa4b4dc BOOLEAN;
  p_FullTextSearchFunction_c7238aa4b4dc VARCHAR(255);
  p_FullTextSearchFunctionGenerated_c7238aa4b4dc BOOLEAN;
  p_UserViewMaxRows_c7238aa4b4dc INTEGER;
  p_spCreate_c7238aa4b4dc VARCHAR(255);
  p_spUpdate_c7238aa4b4dc VARCHAR(255);
  p_spDelete_c7238aa4b4dc VARCHAR(255);
  p_spCreateGenerated_c7238aa4b4dc BOOLEAN;
  p_spUpdateGenerated_c7238aa4b4dc BOOLEAN;
  p_spDeleteGenerated_c7238aa4b4dc BOOLEAN;
  p_CascadeDeletes_c7238aa4b4dc BOOLEAN;
  p_DeleteType_c7238aa4b4dc VARCHAR(10);
  p_AllowRecordMerge_c7238aa4b4dc BOOLEAN;
  p_spMatch_c7238aa4b4dc VARCHAR(255);
  p_RelationshipDefaultDisplayType_c7238aa4b4dc VARCHAR(20);
  p_UserFormGenerated_c7238aa4b4dc BOOLEAN;
  p_EntityObjectSubclassName_c7238aa4b4dc VARCHAR(255);
  p_EntityObjectSubclassImport_c7238aa4b4dc VARCHAR(255);
  p_PreferredCommunicationField_c7238aa4b4dc VARCHAR(255);
  p_Icon_c7238aa4b4dc VARCHAR(500);
  p_ScopeDefault_c7238aa4b4dc VARCHAR(100);
  p_RowsToPackWithSchema_c7238aa4b4dc VARCHAR(20);
  p_RowsToPackSampleMethod_c7238aa4b4dc VARCHAR(20);
  p_RowsToPackSampleCount_c7238aa4b4dc INTEGER;
  p_RowsToPackSampleOrder_c7238aa4b4dc TEXT;
  p_AutoRowCountFrequency_c7238aa4b4dc INTEGER;
  p_RowCount_c7238aa4b4dc BIGINT;
  p_RowCountRunAt_c7238aa4b4dc TIMESTAMPTZ;
  p_Status_c7238aa4b4dc VARCHAR(25);
  p_DisplayName_c7238aa4b4dc VARCHAR(255);
  p_AllowMultipleSubtypes_c7238aa4b4dc BOOLEAN;
  p_AutoUpdateFullTextSearch_c7238aa4b4dc BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_c7238aa4b4dc BOOLEAN;
  p_TrustServerCacheCompletely_c7238aa4b4dc BOOLEAN;
  p_SupportsGeoCoding_c7238aa4b4dc BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_c7238aa4b4dc BOOLEAN;
  p_AllowCaching_c7238aa4b4dc BOOLEAN;
  p_DetectExternalChanges_c7238aa4b4dc BOOLEAN;
  p_ExternalDataSourceID_c7238aa4b4dc UUID;
  p_ExternalObjectName_c7238aa4b4dc VARCHAR(255);
  p_GeneratedBaseViewName_c7238aa4b4dc VARCHAR(255);
  p_AllowDirectSQLInsert_c7238aa4b4dc BOOLEAN;
  p_AllowDirectSQLUpdate_c7238aa4b4dc BOOLEAN;
  p_AllowDirectSQLDelete_c7238aa4b4dc BOOLEAN;
  p_Configuration_c7238aa4b4dc TEXT;
  p_SubtypeSelector_c7238aa4b4dc TEXT;
  p_EnableFieldLevelSecurity_c7238aa4b4dc BOOLEAN;
  p_ID_c7238aa4b4dc UUID;
BEGIN
  p_Name_c7238aa4b4dc := 'MJ_BizApps_Sales: Deal Team Members';
  p_Description_c7238aa4b4dc := 'The internal people on a deal and the role each holds — the SINGLE SOURCE OF TRUTH for deal membership, INCLUDING the owner (the member whose DealRole has IsOwnerRole = 1). WATCH THE ATTRIBUTION DOUBLE-COUNT: a deal with an AE, an SE and an SDR has three rows, so summing Deal.Amount across this table triple-counts the deal. Every by-rep rollup must either filter to the owner role or weight by AttributionPct.';
  p_AutoUpdateDescription_c7238aa4b4dc := TRUE;
  p_BaseView_c7238aa4b4dc := 'vwDealTeamMembers';
  p_BaseViewGenerated_c7238aa4b4dc := TRUE;
  p_VirtualEntity_c7238aa4b4dc := FALSE;
  p_TrackRecordChanges_c7238aa4b4dc := TRUE;
  p_AuditRecordAccess_c7238aa4b4dc := FALSE;
  p_AuditViewRuns_c7238aa4b4dc := FALSE;
  p_IncludeInAPI_c7238aa4b4dc := TRUE;
  p_AllowAllRowsAPI_c7238aa4b4dc := FALSE;
  p_AllowUpdateAPI_c7238aa4b4dc := TRUE;
  p_AllowCreateAPI_c7238aa4b4dc := TRUE;
  p_AllowDeleteAPI_c7238aa4b4dc := TRUE;
  p_CustomResolverAPI_c7238aa4b4dc := FALSE;
  p_AllowUserSearchAPI_c7238aa4b4dc := FALSE;
  p_FullTextSearchEnabled_c7238aa4b4dc := FALSE;
  p_FullTextCatalogGenerated_c7238aa4b4dc := TRUE;
  p_FullTextIndexGenerated_c7238aa4b4dc := TRUE;
  p_FullTextSearchFunctionGenerated_c7238aa4b4dc := TRUE;
  p_UserViewMaxRows_c7238aa4b4dc := 1000;
  p_spCreateGenerated_c7238aa4b4dc := TRUE;
  p_spUpdateGenerated_c7238aa4b4dc := TRUE;
  p_spDeleteGenerated_c7238aa4b4dc := TRUE;
  p_CascadeDeletes_c7238aa4b4dc := FALSE;
  p_DeleteType_c7238aa4b4dc := 'Hard';
  p_AllowRecordMerge_c7238aa4b4dc := FALSE;
  p_RelationshipDefaultDisplayType_c7238aa4b4dc := 'Search';
  p_UserFormGenerated_c7238aa4b4dc := TRUE;
  p_RowsToPackWithSchema_c7238aa4b4dc := 'None';
  p_RowsToPackSampleMethod_c7238aa4b4dc := 'random';
  p_RowsToPackSampleCount_c7238aa4b4dc := 0;
  p_Status_c7238aa4b4dc := 'Active';
  p_DisplayName_c7238aa4b4dc := 'Deal Team Members';
  p_AllowMultipleSubtypes_c7238aa4b4dc := FALSE;
  p_AutoUpdateFullTextSearch_c7238aa4b4dc := TRUE;
  p_AutoUpdateAllowUserSearchAPI_c7238aa4b4dc := FALSE;
  p_TrustServerCacheCompletely_c7238aa4b4dc := TRUE;
  p_SupportsGeoCoding_c7238aa4b4dc := FALSE;
  p_AutoUpdateSupportsGeoCoding_c7238aa4b4dc := TRUE;
  p_AllowCaching_c7238aa4b4dc := FALSE;
  p_DetectExternalChanges_c7238aa4b4dc := FALSE;
  p_AllowDirectSQLInsert_c7238aa4b4dc := FALSE;
  p_AllowDirectSQLUpdate_c7238aa4b4dc := FALSE;
  p_AllowDirectSQLDelete_c7238aa4b4dc := FALSE;
  p_Configuration_c7238aa4b4dc := '{
  "UI": {
    "Form": {
      "Layout": "accordion"
    }
  }
}';
  p_EnableFieldLevelSecurity_c7238aa4b4dc := FALSE;
  p_ID_c7238aa4b4dc := 'A5BC9EE5-4C4E-408B-BB07-3C718227B616';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_c7238aa4b4dc,
    'Name', p_Name_c7238aa4b4dc,
    'NameSuffix', p_NameSuffix_c7238aa4b4dc,
    'Description', p_Description_c7238aa4b4dc,
    'AutoUpdateDescription', p_AutoUpdateDescription_c7238aa4b4dc,
    'BaseView', p_BaseView_c7238aa4b4dc,
    'BaseViewGenerated', p_BaseViewGenerated_c7238aa4b4dc,
    'VirtualEntity', p_VirtualEntity_c7238aa4b4dc,
    'TrackRecordChanges', p_TrackRecordChanges_c7238aa4b4dc,
    'AuditRecordAccess', p_AuditRecordAccess_c7238aa4b4dc,
    'AuditViewRuns', p_AuditViewRuns_c7238aa4b4dc,
    'IncludeInAPI', p_IncludeInAPI_c7238aa4b4dc,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_c7238aa4b4dc,
    'AllowUpdateAPI', p_AllowUpdateAPI_c7238aa4b4dc,
    'AllowCreateAPI', p_AllowCreateAPI_c7238aa4b4dc,
    'AllowDeleteAPI', p_AllowDeleteAPI_c7238aa4b4dc,
    'CustomResolverAPI', p_CustomResolverAPI_c7238aa4b4dc,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_c7238aa4b4dc,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_c7238aa4b4dc,
    'FullTextCatalog', p_FullTextCatalog_c7238aa4b4dc,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_c7238aa4b4dc,
    'FullTextIndex', p_FullTextIndex_c7238aa4b4dc,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_c7238aa4b4dc,
    'FullTextSearchFunction', p_FullTextSearchFunction_c7238aa4b4dc,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_c7238aa4b4dc,
    'UserViewMaxRows', p_UserViewMaxRows_c7238aa4b4dc,
    'spCreate', p_spCreate_c7238aa4b4dc,
    'spUpdate', p_spUpdate_c7238aa4b4dc,
    'spDelete', p_spDelete_c7238aa4b4dc,
    'spCreateGenerated', p_spCreateGenerated_c7238aa4b4dc,
    'spUpdateGenerated', p_spUpdateGenerated_c7238aa4b4dc,
    'spDeleteGenerated', p_spDeleteGenerated_c7238aa4b4dc,
    'CascadeDeletes', p_CascadeDeletes_c7238aa4b4dc,
    'DeleteType', p_DeleteType_c7238aa4b4dc,
    'AllowRecordMerge', p_AllowRecordMerge_c7238aa4b4dc,
    'spMatch', p_spMatch_c7238aa4b4dc,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_c7238aa4b4dc,
    'UserFormGenerated', p_UserFormGenerated_c7238aa4b4dc,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_c7238aa4b4dc,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_c7238aa4b4dc,
    'PreferredCommunicationField', p_PreferredCommunicationField_c7238aa4b4dc,
    'Icon', p_Icon_c7238aa4b4dc,
    'ScopeDefault', p_ScopeDefault_c7238aa4b4dc,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_c7238aa4b4dc,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_c7238aa4b4dc,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_c7238aa4b4dc,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_c7238aa4b4dc,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_c7238aa4b4dc,
    'RowCount', p_RowCount_c7238aa4b4dc,
    'RowCountRunAt', p_RowCountRunAt_c7238aa4b4dc
  ) ||
  jsonb_build_object(
    'Status', p_Status_c7238aa4b4dc,
    'DisplayName', p_DisplayName_c7238aa4b4dc,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_c7238aa4b4dc,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_c7238aa4b4dc,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_c7238aa4b4dc,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_c7238aa4b4dc,
    'SupportsGeoCoding', p_SupportsGeoCoding_c7238aa4b4dc,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_c7238aa4b4dc,
    'AllowCaching', p_AllowCaching_c7238aa4b4dc,
    'DetectExternalChanges', p_DetectExternalChanges_c7238aa4b4dc,
    'ExternalDataSourceID', p_ExternalDataSourceID_c7238aa4b4dc,
    'ExternalObjectName', p_ExternalObjectName_c7238aa4b4dc,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_c7238aa4b4dc,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_c7238aa4b4dc,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_c7238aa4b4dc,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_c7238aa4b4dc,
    'Configuration', p_Configuration_c7238aa4b4dc,
    'SubtypeSelector', p_SubtypeSelector_c7238aa4b4dc,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_c7238aa4b4dc,
    'ID', p_ID_c7238aa4b4dc
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_502a83566113 UUID;
  p_Name_502a83566113 VARCHAR(255);
  p_NameSuffix_502a83566113 VARCHAR(255);
  p_Description_502a83566113 TEXT;
  p_AutoUpdateDescription_502a83566113 BOOLEAN;
  p_BaseView_502a83566113 VARCHAR(255);
  p_BaseViewGenerated_502a83566113 BOOLEAN;
  p_VirtualEntity_502a83566113 BOOLEAN;
  p_TrackRecordChanges_502a83566113 BOOLEAN;
  p_AuditRecordAccess_502a83566113 BOOLEAN;
  p_AuditViewRuns_502a83566113 BOOLEAN;
  p_IncludeInAPI_502a83566113 BOOLEAN;
  p_AllowAllRowsAPI_502a83566113 BOOLEAN;
  p_AllowUpdateAPI_502a83566113 BOOLEAN;
  p_AllowCreateAPI_502a83566113 BOOLEAN;
  p_AllowDeleteAPI_502a83566113 BOOLEAN;
  p_CustomResolverAPI_502a83566113 BOOLEAN;
  p_AllowUserSearchAPI_502a83566113 BOOLEAN;
  p_FullTextSearchEnabled_502a83566113 BOOLEAN;
  p_FullTextCatalog_502a83566113 VARCHAR(255);
  p_FullTextCatalogGenerated_502a83566113 BOOLEAN;
  p_FullTextIndex_502a83566113 VARCHAR(255);
  p_FullTextIndexGenerated_502a83566113 BOOLEAN;
  p_FullTextSearchFunction_502a83566113 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_502a83566113 BOOLEAN;
  p_UserViewMaxRows_502a83566113 INTEGER;
  p_spCreate_502a83566113 VARCHAR(255);
  p_spUpdate_502a83566113 VARCHAR(255);
  p_spDelete_502a83566113 VARCHAR(255);
  p_spCreateGenerated_502a83566113 BOOLEAN;
  p_spUpdateGenerated_502a83566113 BOOLEAN;
  p_spDeleteGenerated_502a83566113 BOOLEAN;
  p_CascadeDeletes_502a83566113 BOOLEAN;
  p_DeleteType_502a83566113 VARCHAR(10);
  p_AllowRecordMerge_502a83566113 BOOLEAN;
  p_spMatch_502a83566113 VARCHAR(255);
  p_RelationshipDefaultDisplayType_502a83566113 VARCHAR(20);
  p_UserFormGenerated_502a83566113 BOOLEAN;
  p_EntityObjectSubclassName_502a83566113 VARCHAR(255);
  p_EntityObjectSubclassImport_502a83566113 VARCHAR(255);
  p_PreferredCommunicationField_502a83566113 VARCHAR(255);
  p_Icon_502a83566113 VARCHAR(500);
  p_ScopeDefault_502a83566113 VARCHAR(100);
  p_RowsToPackWithSchema_502a83566113 VARCHAR(20);
  p_RowsToPackSampleMethod_502a83566113 VARCHAR(20);
  p_RowsToPackSampleCount_502a83566113 INTEGER;
  p_RowsToPackSampleOrder_502a83566113 TEXT;
  p_AutoRowCountFrequency_502a83566113 INTEGER;
  p_RowCount_502a83566113 BIGINT;
  p_RowCountRunAt_502a83566113 TIMESTAMPTZ;
  p_Status_502a83566113 VARCHAR(25);
  p_DisplayName_502a83566113 VARCHAR(255);
  p_AllowMultipleSubtypes_502a83566113 BOOLEAN;
  p_AutoUpdateFullTextSearch_502a83566113 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_502a83566113 BOOLEAN;
  p_TrustServerCacheCompletely_502a83566113 BOOLEAN;
  p_SupportsGeoCoding_502a83566113 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_502a83566113 BOOLEAN;
  p_AllowCaching_502a83566113 BOOLEAN;
  p_DetectExternalChanges_502a83566113 BOOLEAN;
  p_ExternalDataSourceID_502a83566113 UUID;
  p_ExternalObjectName_502a83566113 VARCHAR(255);
  p_GeneratedBaseViewName_502a83566113 VARCHAR(255);
  p_AllowDirectSQLInsert_502a83566113 BOOLEAN;
  p_AllowDirectSQLUpdate_502a83566113 BOOLEAN;
  p_AllowDirectSQLDelete_502a83566113 BOOLEAN;
  p_Configuration_502a83566113 TEXT;
  p_SubtypeSelector_502a83566113 TEXT;
  p_EnableFieldLevelSecurity_502a83566113 BOOLEAN;
  p_ID_502a83566113 UUID;
BEGIN
  p_Name_502a83566113 := 'MJ_BizApps_Sales: Deal Types';
  p_AutoUpdateDescription_502a83566113 := TRUE;
  p_BaseView_502a83566113 := 'vwDealTypes';
  p_BaseViewGenerated_502a83566113 := TRUE;
  p_VirtualEntity_502a83566113 := FALSE;
  p_TrackRecordChanges_502a83566113 := TRUE;
  p_AuditRecordAccess_502a83566113 := FALSE;
  p_AuditViewRuns_502a83566113 := FALSE;
  p_IncludeInAPI_502a83566113 := TRUE;
  p_AllowAllRowsAPI_502a83566113 := FALSE;
  p_AllowUpdateAPI_502a83566113 := TRUE;
  p_AllowCreateAPI_502a83566113 := TRUE;
  p_AllowDeleteAPI_502a83566113 := TRUE;
  p_CustomResolverAPI_502a83566113 := FALSE;
  p_AllowUserSearchAPI_502a83566113 := TRUE;
  p_FullTextSearchEnabled_502a83566113 := FALSE;
  p_FullTextCatalogGenerated_502a83566113 := TRUE;
  p_FullTextIndexGenerated_502a83566113 := TRUE;
  p_FullTextSearchFunctionGenerated_502a83566113 := TRUE;
  p_UserViewMaxRows_502a83566113 := 1000;
  p_spCreateGenerated_502a83566113 := TRUE;
  p_spUpdateGenerated_502a83566113 := TRUE;
  p_spDeleteGenerated_502a83566113 := TRUE;
  p_CascadeDeletes_502a83566113 := FALSE;
  p_DeleteType_502a83566113 := 'Hard';
  p_AllowRecordMerge_502a83566113 := FALSE;
  p_RelationshipDefaultDisplayType_502a83566113 := 'Search';
  p_UserFormGenerated_502a83566113 := TRUE;
  p_RowsToPackWithSchema_502a83566113 := 'None';
  p_RowsToPackSampleMethod_502a83566113 := 'random';
  p_RowsToPackSampleCount_502a83566113 := 0;
  p_Status_502a83566113 := 'Active';
  p_DisplayName_502a83566113 := 'Deal Types';
  p_AllowMultipleSubtypes_502a83566113 := FALSE;
  p_AutoUpdateFullTextSearch_502a83566113 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_502a83566113 := FALSE;
  p_TrustServerCacheCompletely_502a83566113 := TRUE;
  p_SupportsGeoCoding_502a83566113 := FALSE;
  p_AutoUpdateSupportsGeoCoding_502a83566113 := TRUE;
  p_AllowCaching_502a83566113 := FALSE;
  p_DetectExternalChanges_502a83566113 := FALSE;
  p_AllowDirectSQLInsert_502a83566113 := FALSE;
  p_AllowDirectSQLUpdate_502a83566113 := FALSE;
  p_AllowDirectSQLDelete_502a83566113 := FALSE;
  p_Configuration_502a83566113 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_502a83566113 := FALSE;
  p_ID_502a83566113 := '5F0A310E-94EE-47C2-9BBF-0F45FDC37E07';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_502a83566113,
    'Name', p_Name_502a83566113,
    'NameSuffix', p_NameSuffix_502a83566113,
    'Description', p_Description_502a83566113,
    'AutoUpdateDescription', p_AutoUpdateDescription_502a83566113,
    'BaseView', p_BaseView_502a83566113,
    'BaseViewGenerated', p_BaseViewGenerated_502a83566113,
    'VirtualEntity', p_VirtualEntity_502a83566113,
    'TrackRecordChanges', p_TrackRecordChanges_502a83566113,
    'AuditRecordAccess', p_AuditRecordAccess_502a83566113,
    'AuditViewRuns', p_AuditViewRuns_502a83566113,
    'IncludeInAPI', p_IncludeInAPI_502a83566113,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_502a83566113,
    'AllowUpdateAPI', p_AllowUpdateAPI_502a83566113,
    'AllowCreateAPI', p_AllowCreateAPI_502a83566113,
    'AllowDeleteAPI', p_AllowDeleteAPI_502a83566113,
    'CustomResolverAPI', p_CustomResolverAPI_502a83566113,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_502a83566113,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_502a83566113,
    'FullTextCatalog', p_FullTextCatalog_502a83566113,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_502a83566113,
    'FullTextIndex', p_FullTextIndex_502a83566113,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_502a83566113,
    'FullTextSearchFunction', p_FullTextSearchFunction_502a83566113,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_502a83566113,
    'UserViewMaxRows', p_UserViewMaxRows_502a83566113,
    'spCreate', p_spCreate_502a83566113,
    'spUpdate', p_spUpdate_502a83566113,
    'spDelete', p_spDelete_502a83566113,
    'spCreateGenerated', p_spCreateGenerated_502a83566113,
    'spUpdateGenerated', p_spUpdateGenerated_502a83566113,
    'spDeleteGenerated', p_spDeleteGenerated_502a83566113,
    'CascadeDeletes', p_CascadeDeletes_502a83566113,
    'DeleteType', p_DeleteType_502a83566113,
    'AllowRecordMerge', p_AllowRecordMerge_502a83566113,
    'spMatch', p_spMatch_502a83566113,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_502a83566113,
    'UserFormGenerated', p_UserFormGenerated_502a83566113,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_502a83566113,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_502a83566113,
    'PreferredCommunicationField', p_PreferredCommunicationField_502a83566113,
    'Icon', p_Icon_502a83566113,
    'ScopeDefault', p_ScopeDefault_502a83566113,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_502a83566113,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_502a83566113,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_502a83566113,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_502a83566113,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_502a83566113,
    'RowCount', p_RowCount_502a83566113,
    'RowCountRunAt', p_RowCountRunAt_502a83566113
  ) ||
  jsonb_build_object(
    'Status', p_Status_502a83566113,
    'DisplayName', p_DisplayName_502a83566113,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_502a83566113,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_502a83566113,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_502a83566113,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_502a83566113,
    'SupportsGeoCoding', p_SupportsGeoCoding_502a83566113,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_502a83566113,
    'AllowCaching', p_AllowCaching_502a83566113,
    'DetectExternalChanges', p_DetectExternalChanges_502a83566113,
    'ExternalDataSourceID', p_ExternalDataSourceID_502a83566113,
    'ExternalObjectName', p_ExternalObjectName_502a83566113,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_502a83566113,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_502a83566113,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_502a83566113,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_502a83566113,
    'Configuration', p_Configuration_502a83566113,
    'SubtypeSelector', p_SubtypeSelector_502a83566113,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_502a83566113,
    'ID', p_ID_502a83566113
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_67a6b57c6c04 UUID;
  p_Name_67a6b57c6c04 VARCHAR(255);
  p_NameSuffix_67a6b57c6c04 VARCHAR(255);
  p_Description_67a6b57c6c04 TEXT;
  p_AutoUpdateDescription_67a6b57c6c04 BOOLEAN;
  p_BaseView_67a6b57c6c04 VARCHAR(255);
  p_BaseViewGenerated_67a6b57c6c04 BOOLEAN;
  p_VirtualEntity_67a6b57c6c04 BOOLEAN;
  p_TrackRecordChanges_67a6b57c6c04 BOOLEAN;
  p_AuditRecordAccess_67a6b57c6c04 BOOLEAN;
  p_AuditViewRuns_67a6b57c6c04 BOOLEAN;
  p_IncludeInAPI_67a6b57c6c04 BOOLEAN;
  p_AllowAllRowsAPI_67a6b57c6c04 BOOLEAN;
  p_AllowUpdateAPI_67a6b57c6c04 BOOLEAN;
  p_AllowCreateAPI_67a6b57c6c04 BOOLEAN;
  p_AllowDeleteAPI_67a6b57c6c04 BOOLEAN;
  p_CustomResolverAPI_67a6b57c6c04 BOOLEAN;
  p_AllowUserSearchAPI_67a6b57c6c04 BOOLEAN;
  p_FullTextSearchEnabled_67a6b57c6c04 BOOLEAN;
  p_FullTextCatalog_67a6b57c6c04 VARCHAR(255);
  p_FullTextCatalogGenerated_67a6b57c6c04 BOOLEAN;
  p_FullTextIndex_67a6b57c6c04 VARCHAR(255);
  p_FullTextIndexGenerated_67a6b57c6c04 BOOLEAN;
  p_FullTextSearchFunction_67a6b57c6c04 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_67a6b57c6c04 BOOLEAN;
  p_UserViewMaxRows_67a6b57c6c04 INTEGER;
  p_spCreate_67a6b57c6c04 VARCHAR(255);
  p_spUpdate_67a6b57c6c04 VARCHAR(255);
  p_spDelete_67a6b57c6c04 VARCHAR(255);
  p_spCreateGenerated_67a6b57c6c04 BOOLEAN;
  p_spUpdateGenerated_67a6b57c6c04 BOOLEAN;
  p_spDeleteGenerated_67a6b57c6c04 BOOLEAN;
  p_CascadeDeletes_67a6b57c6c04 BOOLEAN;
  p_DeleteType_67a6b57c6c04 VARCHAR(10);
  p_AllowRecordMerge_67a6b57c6c04 BOOLEAN;
  p_spMatch_67a6b57c6c04 VARCHAR(255);
  p_RelationshipDefaultDisplayType_67a6b57c6c04 VARCHAR(20);
  p_UserFormGenerated_67a6b57c6c04 BOOLEAN;
  p_EntityObjectSubclassName_67a6b57c6c04 VARCHAR(255);
  p_EntityObjectSubclassImport_67a6b57c6c04 VARCHAR(255);
  p_PreferredCommunicationField_67a6b57c6c04 VARCHAR(255);
  p_Icon_67a6b57c6c04 VARCHAR(500);
  p_ScopeDefault_67a6b57c6c04 VARCHAR(100);
  p_RowsToPackWithSchema_67a6b57c6c04 VARCHAR(20);
  p_RowsToPackSampleMethod_67a6b57c6c04 VARCHAR(20);
  p_RowsToPackSampleCount_67a6b57c6c04 INTEGER;
  p_RowsToPackSampleOrder_67a6b57c6c04 TEXT;
  p_AutoRowCountFrequency_67a6b57c6c04 INTEGER;
  p_RowCount_67a6b57c6c04 BIGINT;
  p_RowCountRunAt_67a6b57c6c04 TIMESTAMPTZ;
  p_Status_67a6b57c6c04 VARCHAR(25);
  p_DisplayName_67a6b57c6c04 VARCHAR(255);
  p_AllowMultipleSubtypes_67a6b57c6c04 BOOLEAN;
  p_AutoUpdateFullTextSearch_67a6b57c6c04 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_67a6b57c6c04 BOOLEAN;
  p_TrustServerCacheCompletely_67a6b57c6c04 BOOLEAN;
  p_SupportsGeoCoding_67a6b57c6c04 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_67a6b57c6c04 BOOLEAN;
  p_AllowCaching_67a6b57c6c04 BOOLEAN;
  p_DetectExternalChanges_67a6b57c6c04 BOOLEAN;
  p_ExternalDataSourceID_67a6b57c6c04 UUID;
  p_ExternalObjectName_67a6b57c6c04 VARCHAR(255);
  p_GeneratedBaseViewName_67a6b57c6c04 VARCHAR(255);
  p_AllowDirectSQLInsert_67a6b57c6c04 BOOLEAN;
  p_AllowDirectSQLUpdate_67a6b57c6c04 BOOLEAN;
  p_AllowDirectSQLDelete_67a6b57c6c04 BOOLEAN;
  p_Configuration_67a6b57c6c04 TEXT;
  p_SubtypeSelector_67a6b57c6c04 TEXT;
  p_EnableFieldLevelSecurity_67a6b57c6c04 BOOLEAN;
  p_ID_67a6b57c6c04 UUID;
BEGIN
  p_Name_67a6b57c6c04 := 'MJ_BizApps_Sales: Deals';
  p_Description_67a6b57c6c04 := 'A deal (opportunity). Amount is a CACHED answer from Orders.PreviewOrder carrying its own provenance, never a locally computed total — this app performs no pricing arithmetic of any kind. Closing a deal is a transaction that CREATES a contract and/or orders, not a notification that someone should.';
  p_AutoUpdateDescription_67a6b57c6c04 := TRUE;
  p_BaseView_67a6b57c6c04 := 'vwDeals';
  p_BaseViewGenerated_67a6b57c6c04 := FALSE;
  p_VirtualEntity_67a6b57c6c04 := FALSE;
  p_TrackRecordChanges_67a6b57c6c04 := TRUE;
  p_AuditRecordAccess_67a6b57c6c04 := FALSE;
  p_AuditViewRuns_67a6b57c6c04 := FALSE;
  p_IncludeInAPI_67a6b57c6c04 := TRUE;
  p_AllowAllRowsAPI_67a6b57c6c04 := FALSE;
  p_AllowUpdateAPI_67a6b57c6c04 := TRUE;
  p_AllowCreateAPI_67a6b57c6c04 := TRUE;
  p_AllowDeleteAPI_67a6b57c6c04 := TRUE;
  p_CustomResolverAPI_67a6b57c6c04 := FALSE;
  p_AllowUserSearchAPI_67a6b57c6c04 := TRUE;
  p_FullTextSearchEnabled_67a6b57c6c04 := FALSE;
  p_FullTextCatalogGenerated_67a6b57c6c04 := TRUE;
  p_FullTextIndexGenerated_67a6b57c6c04 := TRUE;
  p_FullTextSearchFunctionGenerated_67a6b57c6c04 := TRUE;
  p_UserViewMaxRows_67a6b57c6c04 := 1000;
  p_spCreateGenerated_67a6b57c6c04 := TRUE;
  p_spUpdateGenerated_67a6b57c6c04 := TRUE;
  p_spDeleteGenerated_67a6b57c6c04 := TRUE;
  p_CascadeDeletes_67a6b57c6c04 := FALSE;
  p_DeleteType_67a6b57c6c04 := 'Hard';
  p_AllowRecordMerge_67a6b57c6c04 := FALSE;
  p_RelationshipDefaultDisplayType_67a6b57c6c04 := 'Search';
  p_UserFormGenerated_67a6b57c6c04 := TRUE;
  p_RowsToPackWithSchema_67a6b57c6c04 := 'None';
  p_RowsToPackSampleMethod_67a6b57c6c04 := 'random';
  p_RowsToPackSampleCount_67a6b57c6c04 := 0;
  p_Status_67a6b57c6c04 := 'Active';
  p_DisplayName_67a6b57c6c04 := 'Deals';
  p_AllowMultipleSubtypes_67a6b57c6c04 := FALSE;
  p_AutoUpdateFullTextSearch_67a6b57c6c04 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_67a6b57c6c04 := FALSE;
  p_TrustServerCacheCompletely_67a6b57c6c04 := TRUE;
  p_SupportsGeoCoding_67a6b57c6c04 := FALSE;
  p_AutoUpdateSupportsGeoCoding_67a6b57c6c04 := TRUE;
  p_AllowCaching_67a6b57c6c04 := FALSE;
  p_DetectExternalChanges_67a6b57c6c04 := FALSE;
  p_GeneratedBaseViewName_67a6b57c6c04 := 'vwDealsGenerated';
  p_AllowDirectSQLInsert_67a6b57c6c04 := FALSE;
  p_AllowDirectSQLUpdate_67a6b57c6c04 := FALSE;
  p_AllowDirectSQLDelete_67a6b57c6c04 := FALSE;
  p_Configuration_67a6b57c6c04 := '{
  "UI": {
    "Form": {
      "Layout": "left-nav",
      "RelatedRolePolicy": "smart"
    }
  }
}';
  p_EnableFieldLevelSecurity_67a6b57c6c04 := FALSE;
  p_ID_67a6b57c6c04 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_67a6b57c6c04,
    'Name', p_Name_67a6b57c6c04,
    'NameSuffix', p_NameSuffix_67a6b57c6c04,
    'Description', p_Description_67a6b57c6c04,
    'AutoUpdateDescription', p_AutoUpdateDescription_67a6b57c6c04,
    'BaseView', p_BaseView_67a6b57c6c04,
    'BaseViewGenerated', p_BaseViewGenerated_67a6b57c6c04,
    'VirtualEntity', p_VirtualEntity_67a6b57c6c04,
    'TrackRecordChanges', p_TrackRecordChanges_67a6b57c6c04,
    'AuditRecordAccess', p_AuditRecordAccess_67a6b57c6c04,
    'AuditViewRuns', p_AuditViewRuns_67a6b57c6c04,
    'IncludeInAPI', p_IncludeInAPI_67a6b57c6c04,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_67a6b57c6c04,
    'AllowUpdateAPI', p_AllowUpdateAPI_67a6b57c6c04,
    'AllowCreateAPI', p_AllowCreateAPI_67a6b57c6c04,
    'AllowDeleteAPI', p_AllowDeleteAPI_67a6b57c6c04,
    'CustomResolverAPI', p_CustomResolverAPI_67a6b57c6c04,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_67a6b57c6c04,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_67a6b57c6c04,
    'FullTextCatalog', p_FullTextCatalog_67a6b57c6c04,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_67a6b57c6c04,
    'FullTextIndex', p_FullTextIndex_67a6b57c6c04,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_67a6b57c6c04,
    'FullTextSearchFunction', p_FullTextSearchFunction_67a6b57c6c04,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_67a6b57c6c04,
    'UserViewMaxRows', p_UserViewMaxRows_67a6b57c6c04,
    'spCreate', p_spCreate_67a6b57c6c04,
    'spUpdate', p_spUpdate_67a6b57c6c04,
    'spDelete', p_spDelete_67a6b57c6c04,
    'spCreateGenerated', p_spCreateGenerated_67a6b57c6c04,
    'spUpdateGenerated', p_spUpdateGenerated_67a6b57c6c04,
    'spDeleteGenerated', p_spDeleteGenerated_67a6b57c6c04,
    'CascadeDeletes', p_CascadeDeletes_67a6b57c6c04,
    'DeleteType', p_DeleteType_67a6b57c6c04,
    'AllowRecordMerge', p_AllowRecordMerge_67a6b57c6c04,
    'spMatch', p_spMatch_67a6b57c6c04,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_67a6b57c6c04,
    'UserFormGenerated', p_UserFormGenerated_67a6b57c6c04,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_67a6b57c6c04,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_67a6b57c6c04,
    'PreferredCommunicationField', p_PreferredCommunicationField_67a6b57c6c04,
    'Icon', p_Icon_67a6b57c6c04,
    'ScopeDefault', p_ScopeDefault_67a6b57c6c04,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_67a6b57c6c04,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_67a6b57c6c04,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_67a6b57c6c04,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_67a6b57c6c04,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_67a6b57c6c04,
    'RowCount', p_RowCount_67a6b57c6c04,
    'RowCountRunAt', p_RowCountRunAt_67a6b57c6c04
  ) ||
  jsonb_build_object(
    'Status', p_Status_67a6b57c6c04,
    'DisplayName', p_DisplayName_67a6b57c6c04,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_67a6b57c6c04,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_67a6b57c6c04,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_67a6b57c6c04,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_67a6b57c6c04,
    'SupportsGeoCoding', p_SupportsGeoCoding_67a6b57c6c04,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_67a6b57c6c04,
    'AllowCaching', p_AllowCaching_67a6b57c6c04,
    'DetectExternalChanges', p_DetectExternalChanges_67a6b57c6c04,
    'ExternalDataSourceID', p_ExternalDataSourceID_67a6b57c6c04,
    'ExternalObjectName', p_ExternalObjectName_67a6b57c6c04,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_67a6b57c6c04,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_67a6b57c6c04,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_67a6b57c6c04,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_67a6b57c6c04,
    'Configuration', p_Configuration_67a6b57c6c04,
    'SubtypeSelector', p_SubtypeSelector_67a6b57c6c04,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_67a6b57c6c04,
    'ID', p_ID_67a6b57c6c04
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_8efeee94425e UUID;
  p_Name_8efeee94425e VARCHAR(255);
  p_NameSuffix_8efeee94425e VARCHAR(255);
  p_Description_8efeee94425e TEXT;
  p_AutoUpdateDescription_8efeee94425e BOOLEAN;
  p_BaseView_8efeee94425e VARCHAR(255);
  p_BaseViewGenerated_8efeee94425e BOOLEAN;
  p_VirtualEntity_8efeee94425e BOOLEAN;
  p_TrackRecordChanges_8efeee94425e BOOLEAN;
  p_AuditRecordAccess_8efeee94425e BOOLEAN;
  p_AuditViewRuns_8efeee94425e BOOLEAN;
  p_IncludeInAPI_8efeee94425e BOOLEAN;
  p_AllowAllRowsAPI_8efeee94425e BOOLEAN;
  p_AllowUpdateAPI_8efeee94425e BOOLEAN;
  p_AllowCreateAPI_8efeee94425e BOOLEAN;
  p_AllowDeleteAPI_8efeee94425e BOOLEAN;
  p_CustomResolverAPI_8efeee94425e BOOLEAN;
  p_AllowUserSearchAPI_8efeee94425e BOOLEAN;
  p_FullTextSearchEnabled_8efeee94425e BOOLEAN;
  p_FullTextCatalog_8efeee94425e VARCHAR(255);
  p_FullTextCatalogGenerated_8efeee94425e BOOLEAN;
  p_FullTextIndex_8efeee94425e VARCHAR(255);
  p_FullTextIndexGenerated_8efeee94425e BOOLEAN;
  p_FullTextSearchFunction_8efeee94425e VARCHAR(255);
  p_FullTextSearchFunctionGenerated_8efeee94425e BOOLEAN;
  p_UserViewMaxRows_8efeee94425e INTEGER;
  p_spCreate_8efeee94425e VARCHAR(255);
  p_spUpdate_8efeee94425e VARCHAR(255);
  p_spDelete_8efeee94425e VARCHAR(255);
  p_spCreateGenerated_8efeee94425e BOOLEAN;
  p_spUpdateGenerated_8efeee94425e BOOLEAN;
  p_spDeleteGenerated_8efeee94425e BOOLEAN;
  p_CascadeDeletes_8efeee94425e BOOLEAN;
  p_DeleteType_8efeee94425e VARCHAR(10);
  p_AllowRecordMerge_8efeee94425e BOOLEAN;
  p_spMatch_8efeee94425e VARCHAR(255);
  p_RelationshipDefaultDisplayType_8efeee94425e VARCHAR(20);
  p_UserFormGenerated_8efeee94425e BOOLEAN;
  p_EntityObjectSubclassName_8efeee94425e VARCHAR(255);
  p_EntityObjectSubclassImport_8efeee94425e VARCHAR(255);
  p_PreferredCommunicationField_8efeee94425e VARCHAR(255);
  p_Icon_8efeee94425e VARCHAR(500);
  p_ScopeDefault_8efeee94425e VARCHAR(100);
  p_RowsToPackWithSchema_8efeee94425e VARCHAR(20);
  p_RowsToPackSampleMethod_8efeee94425e VARCHAR(20);
  p_RowsToPackSampleCount_8efeee94425e INTEGER;
  p_RowsToPackSampleOrder_8efeee94425e TEXT;
  p_AutoRowCountFrequency_8efeee94425e INTEGER;
  p_RowCount_8efeee94425e BIGINT;
  p_RowCountRunAt_8efeee94425e TIMESTAMPTZ;
  p_Status_8efeee94425e VARCHAR(25);
  p_DisplayName_8efeee94425e VARCHAR(255);
  p_AllowMultipleSubtypes_8efeee94425e BOOLEAN;
  p_AutoUpdateFullTextSearch_8efeee94425e BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_8efeee94425e BOOLEAN;
  p_TrustServerCacheCompletely_8efeee94425e BOOLEAN;
  p_SupportsGeoCoding_8efeee94425e BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_8efeee94425e BOOLEAN;
  p_AllowCaching_8efeee94425e BOOLEAN;
  p_DetectExternalChanges_8efeee94425e BOOLEAN;
  p_ExternalDataSourceID_8efeee94425e UUID;
  p_ExternalObjectName_8efeee94425e VARCHAR(255);
  p_GeneratedBaseViewName_8efeee94425e VARCHAR(255);
  p_AllowDirectSQLInsert_8efeee94425e BOOLEAN;
  p_AllowDirectSQLUpdate_8efeee94425e BOOLEAN;
  p_AllowDirectSQLDelete_8efeee94425e BOOLEAN;
  p_Configuration_8efeee94425e TEXT;
  p_SubtypeSelector_8efeee94425e TEXT;
  p_EnableFieldLevelSecurity_8efeee94425e BOOLEAN;
  p_ID_8efeee94425e UUID;
BEGIN
  p_Name_8efeee94425e := 'MJ_BizApps_Sales: Forecast Category Types';
  p_Description_8efeee94425e := 'How a deal rolls into the forecast (Omitted, Pipeline, Best Case, Commit, Closed). The Include* flags are read directly by the forecast measures; a query that compared a category NAME would be exactly the violation the CI grep exists to catch.';
  p_AutoUpdateDescription_8efeee94425e := TRUE;
  p_BaseView_8efeee94425e := 'vwForecastCategoryTypes';
  p_BaseViewGenerated_8efeee94425e := TRUE;
  p_VirtualEntity_8efeee94425e := FALSE;
  p_TrackRecordChanges_8efeee94425e := TRUE;
  p_AuditRecordAccess_8efeee94425e := FALSE;
  p_AuditViewRuns_8efeee94425e := FALSE;
  p_IncludeInAPI_8efeee94425e := TRUE;
  p_AllowAllRowsAPI_8efeee94425e := FALSE;
  p_AllowUpdateAPI_8efeee94425e := TRUE;
  p_AllowCreateAPI_8efeee94425e := TRUE;
  p_AllowDeleteAPI_8efeee94425e := TRUE;
  p_CustomResolverAPI_8efeee94425e := FALSE;
  p_AllowUserSearchAPI_8efeee94425e := FALSE;
  p_FullTextSearchEnabled_8efeee94425e := FALSE;
  p_FullTextCatalogGenerated_8efeee94425e := TRUE;
  p_FullTextIndexGenerated_8efeee94425e := TRUE;
  p_FullTextSearchFunctionGenerated_8efeee94425e := TRUE;
  p_UserViewMaxRows_8efeee94425e := 1000;
  p_spCreateGenerated_8efeee94425e := TRUE;
  p_spUpdateGenerated_8efeee94425e := TRUE;
  p_spDeleteGenerated_8efeee94425e := TRUE;
  p_CascadeDeletes_8efeee94425e := FALSE;
  p_DeleteType_8efeee94425e := 'Hard';
  p_AllowRecordMerge_8efeee94425e := FALSE;
  p_RelationshipDefaultDisplayType_8efeee94425e := 'Search';
  p_UserFormGenerated_8efeee94425e := TRUE;
  p_RowsToPackWithSchema_8efeee94425e := 'None';
  p_RowsToPackSampleMethod_8efeee94425e := 'random';
  p_RowsToPackSampleCount_8efeee94425e := 0;
  p_Status_8efeee94425e := 'Active';
  p_DisplayName_8efeee94425e := 'Forecast Category Types';
  p_AllowMultipleSubtypes_8efeee94425e := FALSE;
  p_AutoUpdateFullTextSearch_8efeee94425e := TRUE;
  p_AutoUpdateAllowUserSearchAPI_8efeee94425e := FALSE;
  p_TrustServerCacheCompletely_8efeee94425e := TRUE;
  p_SupportsGeoCoding_8efeee94425e := FALSE;
  p_AutoUpdateSupportsGeoCoding_8efeee94425e := TRUE;
  p_AllowCaching_8efeee94425e := FALSE;
  p_DetectExternalChanges_8efeee94425e := FALSE;
  p_AllowDirectSQLInsert_8efeee94425e := FALSE;
  p_AllowDirectSQLUpdate_8efeee94425e := FALSE;
  p_AllowDirectSQLDelete_8efeee94425e := FALSE;
  p_Configuration_8efeee94425e := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_8efeee94425e := FALSE;
  p_ID_8efeee94425e := 'DF087A57-A6C1-4EDC-9C52-EB784D95287C';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_8efeee94425e,
    'Name', p_Name_8efeee94425e,
    'NameSuffix', p_NameSuffix_8efeee94425e,
    'Description', p_Description_8efeee94425e,
    'AutoUpdateDescription', p_AutoUpdateDescription_8efeee94425e,
    'BaseView', p_BaseView_8efeee94425e,
    'BaseViewGenerated', p_BaseViewGenerated_8efeee94425e,
    'VirtualEntity', p_VirtualEntity_8efeee94425e,
    'TrackRecordChanges', p_TrackRecordChanges_8efeee94425e,
    'AuditRecordAccess', p_AuditRecordAccess_8efeee94425e,
    'AuditViewRuns', p_AuditViewRuns_8efeee94425e,
    'IncludeInAPI', p_IncludeInAPI_8efeee94425e,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_8efeee94425e,
    'AllowUpdateAPI', p_AllowUpdateAPI_8efeee94425e,
    'AllowCreateAPI', p_AllowCreateAPI_8efeee94425e,
    'AllowDeleteAPI', p_AllowDeleteAPI_8efeee94425e,
    'CustomResolverAPI', p_CustomResolverAPI_8efeee94425e,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_8efeee94425e,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_8efeee94425e,
    'FullTextCatalog', p_FullTextCatalog_8efeee94425e,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_8efeee94425e,
    'FullTextIndex', p_FullTextIndex_8efeee94425e,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_8efeee94425e,
    'FullTextSearchFunction', p_FullTextSearchFunction_8efeee94425e,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_8efeee94425e,
    'UserViewMaxRows', p_UserViewMaxRows_8efeee94425e,
    'spCreate', p_spCreate_8efeee94425e,
    'spUpdate', p_spUpdate_8efeee94425e,
    'spDelete', p_spDelete_8efeee94425e,
    'spCreateGenerated', p_spCreateGenerated_8efeee94425e,
    'spUpdateGenerated', p_spUpdateGenerated_8efeee94425e,
    'spDeleteGenerated', p_spDeleteGenerated_8efeee94425e,
    'CascadeDeletes', p_CascadeDeletes_8efeee94425e,
    'DeleteType', p_DeleteType_8efeee94425e,
    'AllowRecordMerge', p_AllowRecordMerge_8efeee94425e,
    'spMatch', p_spMatch_8efeee94425e,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_8efeee94425e,
    'UserFormGenerated', p_UserFormGenerated_8efeee94425e,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_8efeee94425e,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_8efeee94425e,
    'PreferredCommunicationField', p_PreferredCommunicationField_8efeee94425e,
    'Icon', p_Icon_8efeee94425e,
    'ScopeDefault', p_ScopeDefault_8efeee94425e,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_8efeee94425e,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_8efeee94425e,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_8efeee94425e,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_8efeee94425e,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_8efeee94425e,
    'RowCount', p_RowCount_8efeee94425e,
    'RowCountRunAt', p_RowCountRunAt_8efeee94425e
  ) ||
  jsonb_build_object(
    'Status', p_Status_8efeee94425e,
    'DisplayName', p_DisplayName_8efeee94425e,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_8efeee94425e,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_8efeee94425e,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_8efeee94425e,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_8efeee94425e,
    'SupportsGeoCoding', p_SupportsGeoCoding_8efeee94425e,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_8efeee94425e,
    'AllowCaching', p_AllowCaching_8efeee94425e,
    'DetectExternalChanges', p_DetectExternalChanges_8efeee94425e,
    'ExternalDataSourceID', p_ExternalDataSourceID_8efeee94425e,
    'ExternalObjectName', p_ExternalObjectName_8efeee94425e,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_8efeee94425e,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_8efeee94425e,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_8efeee94425e,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_8efeee94425e,
    'Configuration', p_Configuration_8efeee94425e,
    'SubtypeSelector', p_SubtypeSelector_8efeee94425e,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_8efeee94425e,
    'ID', p_ID_8efeee94425e
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_160f81f48877 UUID;
  p_Name_160f81f48877 VARCHAR(255);
  p_NameSuffix_160f81f48877 VARCHAR(255);
  p_Description_160f81f48877 TEXT;
  p_AutoUpdateDescription_160f81f48877 BOOLEAN;
  p_BaseView_160f81f48877 VARCHAR(255);
  p_BaseViewGenerated_160f81f48877 BOOLEAN;
  p_VirtualEntity_160f81f48877 BOOLEAN;
  p_TrackRecordChanges_160f81f48877 BOOLEAN;
  p_AuditRecordAccess_160f81f48877 BOOLEAN;
  p_AuditViewRuns_160f81f48877 BOOLEAN;
  p_IncludeInAPI_160f81f48877 BOOLEAN;
  p_AllowAllRowsAPI_160f81f48877 BOOLEAN;
  p_AllowUpdateAPI_160f81f48877 BOOLEAN;
  p_AllowCreateAPI_160f81f48877 BOOLEAN;
  p_AllowDeleteAPI_160f81f48877 BOOLEAN;
  p_CustomResolverAPI_160f81f48877 BOOLEAN;
  p_AllowUserSearchAPI_160f81f48877 BOOLEAN;
  p_FullTextSearchEnabled_160f81f48877 BOOLEAN;
  p_FullTextCatalog_160f81f48877 VARCHAR(255);
  p_FullTextCatalogGenerated_160f81f48877 BOOLEAN;
  p_FullTextIndex_160f81f48877 VARCHAR(255);
  p_FullTextIndexGenerated_160f81f48877 BOOLEAN;
  p_FullTextSearchFunction_160f81f48877 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_160f81f48877 BOOLEAN;
  p_UserViewMaxRows_160f81f48877 INTEGER;
  p_spCreate_160f81f48877 VARCHAR(255);
  p_spUpdate_160f81f48877 VARCHAR(255);
  p_spDelete_160f81f48877 VARCHAR(255);
  p_spCreateGenerated_160f81f48877 BOOLEAN;
  p_spUpdateGenerated_160f81f48877 BOOLEAN;
  p_spDeleteGenerated_160f81f48877 BOOLEAN;
  p_CascadeDeletes_160f81f48877 BOOLEAN;
  p_DeleteType_160f81f48877 VARCHAR(10);
  p_AllowRecordMerge_160f81f48877 BOOLEAN;
  p_spMatch_160f81f48877 VARCHAR(255);
  p_RelationshipDefaultDisplayType_160f81f48877 VARCHAR(20);
  p_UserFormGenerated_160f81f48877 BOOLEAN;
  p_EntityObjectSubclassName_160f81f48877 VARCHAR(255);
  p_EntityObjectSubclassImport_160f81f48877 VARCHAR(255);
  p_PreferredCommunicationField_160f81f48877 VARCHAR(255);
  p_Icon_160f81f48877 VARCHAR(500);
  p_ScopeDefault_160f81f48877 VARCHAR(100);
  p_RowsToPackWithSchema_160f81f48877 VARCHAR(20);
  p_RowsToPackSampleMethod_160f81f48877 VARCHAR(20);
  p_RowsToPackSampleCount_160f81f48877 INTEGER;
  p_RowsToPackSampleOrder_160f81f48877 TEXT;
  p_AutoRowCountFrequency_160f81f48877 INTEGER;
  p_RowCount_160f81f48877 BIGINT;
  p_RowCountRunAt_160f81f48877 TIMESTAMPTZ;
  p_Status_160f81f48877 VARCHAR(25);
  p_DisplayName_160f81f48877 VARCHAR(255);
  p_AllowMultipleSubtypes_160f81f48877 BOOLEAN;
  p_AutoUpdateFullTextSearch_160f81f48877 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_160f81f48877 BOOLEAN;
  p_TrustServerCacheCompletely_160f81f48877 BOOLEAN;
  p_SupportsGeoCoding_160f81f48877 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_160f81f48877 BOOLEAN;
  p_AllowCaching_160f81f48877 BOOLEAN;
  p_DetectExternalChanges_160f81f48877 BOOLEAN;
  p_ExternalDataSourceID_160f81f48877 UUID;
  p_ExternalObjectName_160f81f48877 VARCHAR(255);
  p_GeneratedBaseViewName_160f81f48877 VARCHAR(255);
  p_AllowDirectSQLInsert_160f81f48877 BOOLEAN;
  p_AllowDirectSQLUpdate_160f81f48877 BOOLEAN;
  p_AllowDirectSQLDelete_160f81f48877 BOOLEAN;
  p_Configuration_160f81f48877 TEXT;
  p_SubtypeSelector_160f81f48877 TEXT;
  p_EnableFieldLevelSecurity_160f81f48877 BOOLEAN;
  p_ID_160f81f48877 UUID;
BEGIN
  p_Name_160f81f48877 := 'MJ_BizApps_Sales: Forecast Snapshots';
  p_Description_160f81f48877 := 'A point-in-time capture of the forecast, written by a Scheduled Job. Snapshots matter more than the live number: "what did we think on the first of the month" is the question a forecast review actually asks, and it is unanswerable after the fact without them. The live figure reads Deal; the historical one reads this table.';
  p_AutoUpdateDescription_160f81f48877 := TRUE;
  p_BaseView_160f81f48877 := 'vwForecastSnapshots';
  p_BaseViewGenerated_160f81f48877 := TRUE;
  p_VirtualEntity_160f81f48877 := FALSE;
  p_TrackRecordChanges_160f81f48877 := TRUE;
  p_AuditRecordAccess_160f81f48877 := FALSE;
  p_AuditViewRuns_160f81f48877 := FALSE;
  p_IncludeInAPI_160f81f48877 := TRUE;
  p_AllowAllRowsAPI_160f81f48877 := FALSE;
  p_AllowUpdateAPI_160f81f48877 := TRUE;
  p_AllowCreateAPI_160f81f48877 := TRUE;
  p_AllowDeleteAPI_160f81f48877 := TRUE;
  p_CustomResolverAPI_160f81f48877 := FALSE;
  p_AllowUserSearchAPI_160f81f48877 := FALSE;
  p_FullTextSearchEnabled_160f81f48877 := FALSE;
  p_FullTextCatalogGenerated_160f81f48877 := TRUE;
  p_FullTextIndexGenerated_160f81f48877 := TRUE;
  p_FullTextSearchFunctionGenerated_160f81f48877 := TRUE;
  p_UserViewMaxRows_160f81f48877 := 1000;
  p_spCreateGenerated_160f81f48877 := TRUE;
  p_spUpdateGenerated_160f81f48877 := TRUE;
  p_spDeleteGenerated_160f81f48877 := TRUE;
  p_CascadeDeletes_160f81f48877 := FALSE;
  p_DeleteType_160f81f48877 := 'Hard';
  p_AllowRecordMerge_160f81f48877 := FALSE;
  p_RelationshipDefaultDisplayType_160f81f48877 := 'Search';
  p_UserFormGenerated_160f81f48877 := TRUE;
  p_RowsToPackWithSchema_160f81f48877 := 'None';
  p_RowsToPackSampleMethod_160f81f48877 := 'random';
  p_RowsToPackSampleCount_160f81f48877 := 0;
  p_Status_160f81f48877 := 'Active';
  p_DisplayName_160f81f48877 := 'Forecast Snapshots';
  p_AllowMultipleSubtypes_160f81f48877 := FALSE;
  p_AutoUpdateFullTextSearch_160f81f48877 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_160f81f48877 := FALSE;
  p_TrustServerCacheCompletely_160f81f48877 := TRUE;
  p_SupportsGeoCoding_160f81f48877 := FALSE;
  p_AutoUpdateSupportsGeoCoding_160f81f48877 := TRUE;
  p_AllowCaching_160f81f48877 := FALSE;
  p_DetectExternalChanges_160f81f48877 := FALSE;
  p_AllowDirectSQLInsert_160f81f48877 := FALSE;
  p_AllowDirectSQLUpdate_160f81f48877 := FALSE;
  p_AllowDirectSQLDelete_160f81f48877 := FALSE;
  p_Configuration_160f81f48877 := '{
  "UI": {
    "Form": {
      "Layout": "accordion"
    }
  }
}';
  p_EnableFieldLevelSecurity_160f81f48877 := FALSE;
  p_ID_160f81f48877 := '4697F309-CD43-42DD-A2B5-2747473E5B98';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_160f81f48877,
    'Name', p_Name_160f81f48877,
    'NameSuffix', p_NameSuffix_160f81f48877,
    'Description', p_Description_160f81f48877,
    'AutoUpdateDescription', p_AutoUpdateDescription_160f81f48877,
    'BaseView', p_BaseView_160f81f48877,
    'BaseViewGenerated', p_BaseViewGenerated_160f81f48877,
    'VirtualEntity', p_VirtualEntity_160f81f48877,
    'TrackRecordChanges', p_TrackRecordChanges_160f81f48877,
    'AuditRecordAccess', p_AuditRecordAccess_160f81f48877,
    'AuditViewRuns', p_AuditViewRuns_160f81f48877,
    'IncludeInAPI', p_IncludeInAPI_160f81f48877,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_160f81f48877,
    'AllowUpdateAPI', p_AllowUpdateAPI_160f81f48877,
    'AllowCreateAPI', p_AllowCreateAPI_160f81f48877,
    'AllowDeleteAPI', p_AllowDeleteAPI_160f81f48877,
    'CustomResolverAPI', p_CustomResolverAPI_160f81f48877,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_160f81f48877,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_160f81f48877,
    'FullTextCatalog', p_FullTextCatalog_160f81f48877,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_160f81f48877,
    'FullTextIndex', p_FullTextIndex_160f81f48877,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_160f81f48877,
    'FullTextSearchFunction', p_FullTextSearchFunction_160f81f48877,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_160f81f48877,
    'UserViewMaxRows', p_UserViewMaxRows_160f81f48877,
    'spCreate', p_spCreate_160f81f48877,
    'spUpdate', p_spUpdate_160f81f48877,
    'spDelete', p_spDelete_160f81f48877,
    'spCreateGenerated', p_spCreateGenerated_160f81f48877,
    'spUpdateGenerated', p_spUpdateGenerated_160f81f48877,
    'spDeleteGenerated', p_spDeleteGenerated_160f81f48877,
    'CascadeDeletes', p_CascadeDeletes_160f81f48877,
    'DeleteType', p_DeleteType_160f81f48877,
    'AllowRecordMerge', p_AllowRecordMerge_160f81f48877,
    'spMatch', p_spMatch_160f81f48877,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_160f81f48877,
    'UserFormGenerated', p_UserFormGenerated_160f81f48877,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_160f81f48877,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_160f81f48877,
    'PreferredCommunicationField', p_PreferredCommunicationField_160f81f48877,
    'Icon', p_Icon_160f81f48877,
    'ScopeDefault', p_ScopeDefault_160f81f48877,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_160f81f48877,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_160f81f48877,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_160f81f48877,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_160f81f48877,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_160f81f48877,
    'RowCount', p_RowCount_160f81f48877,
    'RowCountRunAt', p_RowCountRunAt_160f81f48877
  ) ||
  jsonb_build_object(
    'Status', p_Status_160f81f48877,
    'DisplayName', p_DisplayName_160f81f48877,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_160f81f48877,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_160f81f48877,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_160f81f48877,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_160f81f48877,
    'SupportsGeoCoding', p_SupportsGeoCoding_160f81f48877,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_160f81f48877,
    'AllowCaching', p_AllowCaching_160f81f48877,
    'DetectExternalChanges', p_DetectExternalChanges_160f81f48877,
    'ExternalDataSourceID', p_ExternalDataSourceID_160f81f48877,
    'ExternalObjectName', p_ExternalObjectName_160f81f48877,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_160f81f48877,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_160f81f48877,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_160f81f48877,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_160f81f48877,
    'Configuration', p_Configuration_160f81f48877,
    'SubtypeSelector', p_SubtypeSelector_160f81f48877,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_160f81f48877,
    'ID', p_ID_160f81f48877
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_2071d9135b37 UUID;
  p_Name_2071d9135b37 VARCHAR(255);
  p_NameSuffix_2071d9135b37 VARCHAR(255);
  p_Description_2071d9135b37 TEXT;
  p_AutoUpdateDescription_2071d9135b37 BOOLEAN;
  p_BaseView_2071d9135b37 VARCHAR(255);
  p_BaseViewGenerated_2071d9135b37 BOOLEAN;
  p_VirtualEntity_2071d9135b37 BOOLEAN;
  p_TrackRecordChanges_2071d9135b37 BOOLEAN;
  p_AuditRecordAccess_2071d9135b37 BOOLEAN;
  p_AuditViewRuns_2071d9135b37 BOOLEAN;
  p_IncludeInAPI_2071d9135b37 BOOLEAN;
  p_AllowAllRowsAPI_2071d9135b37 BOOLEAN;
  p_AllowUpdateAPI_2071d9135b37 BOOLEAN;
  p_AllowCreateAPI_2071d9135b37 BOOLEAN;
  p_AllowDeleteAPI_2071d9135b37 BOOLEAN;
  p_CustomResolverAPI_2071d9135b37 BOOLEAN;
  p_AllowUserSearchAPI_2071d9135b37 BOOLEAN;
  p_FullTextSearchEnabled_2071d9135b37 BOOLEAN;
  p_FullTextCatalog_2071d9135b37 VARCHAR(255);
  p_FullTextCatalogGenerated_2071d9135b37 BOOLEAN;
  p_FullTextIndex_2071d9135b37 VARCHAR(255);
  p_FullTextIndexGenerated_2071d9135b37 BOOLEAN;
  p_FullTextSearchFunction_2071d9135b37 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_2071d9135b37 BOOLEAN;
  p_UserViewMaxRows_2071d9135b37 INTEGER;
  p_spCreate_2071d9135b37 VARCHAR(255);
  p_spUpdate_2071d9135b37 VARCHAR(255);
  p_spDelete_2071d9135b37 VARCHAR(255);
  p_spCreateGenerated_2071d9135b37 BOOLEAN;
  p_spUpdateGenerated_2071d9135b37 BOOLEAN;
  p_spDeleteGenerated_2071d9135b37 BOOLEAN;
  p_CascadeDeletes_2071d9135b37 BOOLEAN;
  p_DeleteType_2071d9135b37 VARCHAR(10);
  p_AllowRecordMerge_2071d9135b37 BOOLEAN;
  p_spMatch_2071d9135b37 VARCHAR(255);
  p_RelationshipDefaultDisplayType_2071d9135b37 VARCHAR(20);
  p_UserFormGenerated_2071d9135b37 BOOLEAN;
  p_EntityObjectSubclassName_2071d9135b37 VARCHAR(255);
  p_EntityObjectSubclassImport_2071d9135b37 VARCHAR(255);
  p_PreferredCommunicationField_2071d9135b37 VARCHAR(255);
  p_Icon_2071d9135b37 VARCHAR(500);
  p_ScopeDefault_2071d9135b37 VARCHAR(100);
  p_RowsToPackWithSchema_2071d9135b37 VARCHAR(20);
  p_RowsToPackSampleMethod_2071d9135b37 VARCHAR(20);
  p_RowsToPackSampleCount_2071d9135b37 INTEGER;
  p_RowsToPackSampleOrder_2071d9135b37 TEXT;
  p_AutoRowCountFrequency_2071d9135b37 INTEGER;
  p_RowCount_2071d9135b37 BIGINT;
  p_RowCountRunAt_2071d9135b37 TIMESTAMPTZ;
  p_Status_2071d9135b37 VARCHAR(25);
  p_DisplayName_2071d9135b37 VARCHAR(255);
  p_AllowMultipleSubtypes_2071d9135b37 BOOLEAN;
  p_AutoUpdateFullTextSearch_2071d9135b37 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_2071d9135b37 BOOLEAN;
  p_TrustServerCacheCompletely_2071d9135b37 BOOLEAN;
  p_SupportsGeoCoding_2071d9135b37 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_2071d9135b37 BOOLEAN;
  p_AllowCaching_2071d9135b37 BOOLEAN;
  p_DetectExternalChanges_2071d9135b37 BOOLEAN;
  p_ExternalDataSourceID_2071d9135b37 UUID;
  p_ExternalObjectName_2071d9135b37 VARCHAR(255);
  p_GeneratedBaseViewName_2071d9135b37 VARCHAR(255);
  p_AllowDirectSQLInsert_2071d9135b37 BOOLEAN;
  p_AllowDirectSQLUpdate_2071d9135b37 BOOLEAN;
  p_AllowDirectSQLDelete_2071d9135b37 BOOLEAN;
  p_Configuration_2071d9135b37 TEXT;
  p_SubtypeSelector_2071d9135b37 TEXT;
  p_EnableFieldLevelSecurity_2071d9135b37 BOOLEAN;
  p_ID_2071d9135b37 UUID;
BEGIN
  p_Name_2071d9135b37 := 'MJ_BizApps_Sales: Lead Source Types';
  p_AutoUpdateDescription_2071d9135b37 := TRUE;
  p_BaseView_2071d9135b37 := 'vwLeadSourceTypes';
  p_BaseViewGenerated_2071d9135b37 := TRUE;
  p_VirtualEntity_2071d9135b37 := FALSE;
  p_TrackRecordChanges_2071d9135b37 := TRUE;
  p_AuditRecordAccess_2071d9135b37 := FALSE;
  p_AuditViewRuns_2071d9135b37 := FALSE;
  p_IncludeInAPI_2071d9135b37 := TRUE;
  p_AllowAllRowsAPI_2071d9135b37 := FALSE;
  p_AllowUpdateAPI_2071d9135b37 := TRUE;
  p_AllowCreateAPI_2071d9135b37 := TRUE;
  p_AllowDeleteAPI_2071d9135b37 := TRUE;
  p_CustomResolverAPI_2071d9135b37 := FALSE;
  p_AllowUserSearchAPI_2071d9135b37 := FALSE;
  p_FullTextSearchEnabled_2071d9135b37 := FALSE;
  p_FullTextCatalogGenerated_2071d9135b37 := TRUE;
  p_FullTextIndexGenerated_2071d9135b37 := TRUE;
  p_FullTextSearchFunctionGenerated_2071d9135b37 := TRUE;
  p_UserViewMaxRows_2071d9135b37 := 1000;
  p_spCreateGenerated_2071d9135b37 := TRUE;
  p_spUpdateGenerated_2071d9135b37 := TRUE;
  p_spDeleteGenerated_2071d9135b37 := TRUE;
  p_CascadeDeletes_2071d9135b37 := FALSE;
  p_DeleteType_2071d9135b37 := 'Hard';
  p_AllowRecordMerge_2071d9135b37 := FALSE;
  p_RelationshipDefaultDisplayType_2071d9135b37 := 'Search';
  p_UserFormGenerated_2071d9135b37 := TRUE;
  p_RowsToPackWithSchema_2071d9135b37 := 'None';
  p_RowsToPackSampleMethod_2071d9135b37 := 'random';
  p_RowsToPackSampleCount_2071d9135b37 := 0;
  p_Status_2071d9135b37 := 'Active';
  p_DisplayName_2071d9135b37 := 'Lead Source Types';
  p_AllowMultipleSubtypes_2071d9135b37 := FALSE;
  p_AutoUpdateFullTextSearch_2071d9135b37 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_2071d9135b37 := FALSE;
  p_TrustServerCacheCompletely_2071d9135b37 := TRUE;
  p_SupportsGeoCoding_2071d9135b37 := FALSE;
  p_AutoUpdateSupportsGeoCoding_2071d9135b37 := TRUE;
  p_AllowCaching_2071d9135b37 := FALSE;
  p_DetectExternalChanges_2071d9135b37 := FALSE;
  p_AllowDirectSQLInsert_2071d9135b37 := FALSE;
  p_AllowDirectSQLUpdate_2071d9135b37 := FALSE;
  p_AllowDirectSQLDelete_2071d9135b37 := FALSE;
  p_Configuration_2071d9135b37 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_2071d9135b37 := FALSE;
  p_ID_2071d9135b37 := '6F9CEC8B-ED51-40DF-9308-C6E8CF8D0212';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_2071d9135b37,
    'Name', p_Name_2071d9135b37,
    'NameSuffix', p_NameSuffix_2071d9135b37,
    'Description', p_Description_2071d9135b37,
    'AutoUpdateDescription', p_AutoUpdateDescription_2071d9135b37,
    'BaseView', p_BaseView_2071d9135b37,
    'BaseViewGenerated', p_BaseViewGenerated_2071d9135b37,
    'VirtualEntity', p_VirtualEntity_2071d9135b37,
    'TrackRecordChanges', p_TrackRecordChanges_2071d9135b37,
    'AuditRecordAccess', p_AuditRecordAccess_2071d9135b37,
    'AuditViewRuns', p_AuditViewRuns_2071d9135b37,
    'IncludeInAPI', p_IncludeInAPI_2071d9135b37,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_2071d9135b37,
    'AllowUpdateAPI', p_AllowUpdateAPI_2071d9135b37,
    'AllowCreateAPI', p_AllowCreateAPI_2071d9135b37,
    'AllowDeleteAPI', p_AllowDeleteAPI_2071d9135b37,
    'CustomResolverAPI', p_CustomResolverAPI_2071d9135b37,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_2071d9135b37,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_2071d9135b37,
    'FullTextCatalog', p_FullTextCatalog_2071d9135b37,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_2071d9135b37,
    'FullTextIndex', p_FullTextIndex_2071d9135b37,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_2071d9135b37,
    'FullTextSearchFunction', p_FullTextSearchFunction_2071d9135b37,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_2071d9135b37,
    'UserViewMaxRows', p_UserViewMaxRows_2071d9135b37,
    'spCreate', p_spCreate_2071d9135b37,
    'spUpdate', p_spUpdate_2071d9135b37,
    'spDelete', p_spDelete_2071d9135b37,
    'spCreateGenerated', p_spCreateGenerated_2071d9135b37,
    'spUpdateGenerated', p_spUpdateGenerated_2071d9135b37,
    'spDeleteGenerated', p_spDeleteGenerated_2071d9135b37,
    'CascadeDeletes', p_CascadeDeletes_2071d9135b37,
    'DeleteType', p_DeleteType_2071d9135b37,
    'AllowRecordMerge', p_AllowRecordMerge_2071d9135b37,
    'spMatch', p_spMatch_2071d9135b37,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_2071d9135b37,
    'UserFormGenerated', p_UserFormGenerated_2071d9135b37,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_2071d9135b37,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_2071d9135b37,
    'PreferredCommunicationField', p_PreferredCommunicationField_2071d9135b37,
    'Icon', p_Icon_2071d9135b37,
    'ScopeDefault', p_ScopeDefault_2071d9135b37,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_2071d9135b37,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_2071d9135b37,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_2071d9135b37,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_2071d9135b37,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_2071d9135b37,
    'RowCount', p_RowCount_2071d9135b37,
    'RowCountRunAt', p_RowCountRunAt_2071d9135b37
  ) ||
  jsonb_build_object(
    'Status', p_Status_2071d9135b37,
    'DisplayName', p_DisplayName_2071d9135b37,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_2071d9135b37,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_2071d9135b37,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_2071d9135b37,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_2071d9135b37,
    'SupportsGeoCoding', p_SupportsGeoCoding_2071d9135b37,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_2071d9135b37,
    'AllowCaching', p_AllowCaching_2071d9135b37,
    'DetectExternalChanges', p_DetectExternalChanges_2071d9135b37,
    'ExternalDataSourceID', p_ExternalDataSourceID_2071d9135b37,
    'ExternalObjectName', p_ExternalObjectName_2071d9135b37,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_2071d9135b37,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_2071d9135b37,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_2071d9135b37,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_2071d9135b37,
    'Configuration', p_Configuration_2071d9135b37,
    'SubtypeSelector', p_SubtypeSelector_2071d9135b37,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_2071d9135b37,
    'ID', p_ID_2071d9135b37
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_8f40042603ac UUID;
  p_Name_8f40042603ac VARCHAR(255);
  p_NameSuffix_8f40042603ac VARCHAR(255);
  p_Description_8f40042603ac TEXT;
  p_AutoUpdateDescription_8f40042603ac BOOLEAN;
  p_BaseView_8f40042603ac VARCHAR(255);
  p_BaseViewGenerated_8f40042603ac BOOLEAN;
  p_VirtualEntity_8f40042603ac BOOLEAN;
  p_TrackRecordChanges_8f40042603ac BOOLEAN;
  p_AuditRecordAccess_8f40042603ac BOOLEAN;
  p_AuditViewRuns_8f40042603ac BOOLEAN;
  p_IncludeInAPI_8f40042603ac BOOLEAN;
  p_AllowAllRowsAPI_8f40042603ac BOOLEAN;
  p_AllowUpdateAPI_8f40042603ac BOOLEAN;
  p_AllowCreateAPI_8f40042603ac BOOLEAN;
  p_AllowDeleteAPI_8f40042603ac BOOLEAN;
  p_CustomResolverAPI_8f40042603ac BOOLEAN;
  p_AllowUserSearchAPI_8f40042603ac BOOLEAN;
  p_FullTextSearchEnabled_8f40042603ac BOOLEAN;
  p_FullTextCatalog_8f40042603ac VARCHAR(255);
  p_FullTextCatalogGenerated_8f40042603ac BOOLEAN;
  p_FullTextIndex_8f40042603ac VARCHAR(255);
  p_FullTextIndexGenerated_8f40042603ac BOOLEAN;
  p_FullTextSearchFunction_8f40042603ac VARCHAR(255);
  p_FullTextSearchFunctionGenerated_8f40042603ac BOOLEAN;
  p_UserViewMaxRows_8f40042603ac INTEGER;
  p_spCreate_8f40042603ac VARCHAR(255);
  p_spUpdate_8f40042603ac VARCHAR(255);
  p_spDelete_8f40042603ac VARCHAR(255);
  p_spCreateGenerated_8f40042603ac BOOLEAN;
  p_spUpdateGenerated_8f40042603ac BOOLEAN;
  p_spDeleteGenerated_8f40042603ac BOOLEAN;
  p_CascadeDeletes_8f40042603ac BOOLEAN;
  p_DeleteType_8f40042603ac VARCHAR(10);
  p_AllowRecordMerge_8f40042603ac BOOLEAN;
  p_spMatch_8f40042603ac VARCHAR(255);
  p_RelationshipDefaultDisplayType_8f40042603ac VARCHAR(20);
  p_UserFormGenerated_8f40042603ac BOOLEAN;
  p_EntityObjectSubclassName_8f40042603ac VARCHAR(255);
  p_EntityObjectSubclassImport_8f40042603ac VARCHAR(255);
  p_PreferredCommunicationField_8f40042603ac VARCHAR(255);
  p_Icon_8f40042603ac VARCHAR(500);
  p_ScopeDefault_8f40042603ac VARCHAR(100);
  p_RowsToPackWithSchema_8f40042603ac VARCHAR(20);
  p_RowsToPackSampleMethod_8f40042603ac VARCHAR(20);
  p_RowsToPackSampleCount_8f40042603ac INTEGER;
  p_RowsToPackSampleOrder_8f40042603ac TEXT;
  p_AutoRowCountFrequency_8f40042603ac INTEGER;
  p_RowCount_8f40042603ac BIGINT;
  p_RowCountRunAt_8f40042603ac TIMESTAMPTZ;
  p_Status_8f40042603ac VARCHAR(25);
  p_DisplayName_8f40042603ac VARCHAR(255);
  p_AllowMultipleSubtypes_8f40042603ac BOOLEAN;
  p_AutoUpdateFullTextSearch_8f40042603ac BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_8f40042603ac BOOLEAN;
  p_TrustServerCacheCompletely_8f40042603ac BOOLEAN;
  p_SupportsGeoCoding_8f40042603ac BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_8f40042603ac BOOLEAN;
  p_AllowCaching_8f40042603ac BOOLEAN;
  p_DetectExternalChanges_8f40042603ac BOOLEAN;
  p_ExternalDataSourceID_8f40042603ac UUID;
  p_ExternalObjectName_8f40042603ac VARCHAR(255);
  p_GeneratedBaseViewName_8f40042603ac VARCHAR(255);
  p_AllowDirectSQLInsert_8f40042603ac BOOLEAN;
  p_AllowDirectSQLUpdate_8f40042603ac BOOLEAN;
  p_AllowDirectSQLDelete_8f40042603ac BOOLEAN;
  p_Configuration_8f40042603ac TEXT;
  p_SubtypeSelector_8f40042603ac TEXT;
  p_EnableFieldLevelSecurity_8f40042603ac BOOLEAN;
  p_ID_8f40042603ac UUID;
BEGIN
  p_Name_8f40042603ac := 'MJ_BizApps_Sales: Lifecycle Stage Types';
  p_Description_8f40042603ac := 'Where a Person or Organization sits on the journey from stranger to evangelist. This table is what makes "Lead" a STAGE rather than an entity: a lead is a common.Person carrying a LifecycleStageTypeID, not a second identity table for humans.';
  p_AutoUpdateDescription_8f40042603ac := TRUE;
  p_BaseView_8f40042603ac := 'vwLifecycleStageTypes';
  p_BaseViewGenerated_8f40042603ac := TRUE;
  p_VirtualEntity_8f40042603ac := FALSE;
  p_TrackRecordChanges_8f40042603ac := TRUE;
  p_AuditRecordAccess_8f40042603ac := FALSE;
  p_AuditViewRuns_8f40042603ac := FALSE;
  p_IncludeInAPI_8f40042603ac := TRUE;
  p_AllowAllRowsAPI_8f40042603ac := FALSE;
  p_AllowUpdateAPI_8f40042603ac := TRUE;
  p_AllowCreateAPI_8f40042603ac := TRUE;
  p_AllowDeleteAPI_8f40042603ac := TRUE;
  p_CustomResolverAPI_8f40042603ac := FALSE;
  p_AllowUserSearchAPI_8f40042603ac := FALSE;
  p_FullTextSearchEnabled_8f40042603ac := FALSE;
  p_FullTextCatalogGenerated_8f40042603ac := TRUE;
  p_FullTextIndexGenerated_8f40042603ac := TRUE;
  p_FullTextSearchFunctionGenerated_8f40042603ac := TRUE;
  p_UserViewMaxRows_8f40042603ac := 1000;
  p_spCreateGenerated_8f40042603ac := TRUE;
  p_spUpdateGenerated_8f40042603ac := TRUE;
  p_spDeleteGenerated_8f40042603ac := TRUE;
  p_CascadeDeletes_8f40042603ac := FALSE;
  p_DeleteType_8f40042603ac := 'Hard';
  p_AllowRecordMerge_8f40042603ac := FALSE;
  p_RelationshipDefaultDisplayType_8f40042603ac := 'Search';
  p_UserFormGenerated_8f40042603ac := TRUE;
  p_RowsToPackWithSchema_8f40042603ac := 'None';
  p_RowsToPackSampleMethod_8f40042603ac := 'random';
  p_RowsToPackSampleCount_8f40042603ac := 0;
  p_Status_8f40042603ac := 'Active';
  p_DisplayName_8f40042603ac := 'Lifecycle Stage Types';
  p_AllowMultipleSubtypes_8f40042603ac := FALSE;
  p_AutoUpdateFullTextSearch_8f40042603ac := TRUE;
  p_AutoUpdateAllowUserSearchAPI_8f40042603ac := FALSE;
  p_TrustServerCacheCompletely_8f40042603ac := TRUE;
  p_SupportsGeoCoding_8f40042603ac := FALSE;
  p_AutoUpdateSupportsGeoCoding_8f40042603ac := TRUE;
  p_AllowCaching_8f40042603ac := FALSE;
  p_DetectExternalChanges_8f40042603ac := FALSE;
  p_AllowDirectSQLInsert_8f40042603ac := FALSE;
  p_AllowDirectSQLUpdate_8f40042603ac := FALSE;
  p_AllowDirectSQLDelete_8f40042603ac := FALSE;
  p_Configuration_8f40042603ac := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_8f40042603ac := FALSE;
  p_ID_8f40042603ac := '7E187729-0E0C-4ED6-AE5A-FFD14452BF2A';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_8f40042603ac,
    'Name', p_Name_8f40042603ac,
    'NameSuffix', p_NameSuffix_8f40042603ac,
    'Description', p_Description_8f40042603ac,
    'AutoUpdateDescription', p_AutoUpdateDescription_8f40042603ac,
    'BaseView', p_BaseView_8f40042603ac,
    'BaseViewGenerated', p_BaseViewGenerated_8f40042603ac,
    'VirtualEntity', p_VirtualEntity_8f40042603ac,
    'TrackRecordChanges', p_TrackRecordChanges_8f40042603ac,
    'AuditRecordAccess', p_AuditRecordAccess_8f40042603ac,
    'AuditViewRuns', p_AuditViewRuns_8f40042603ac,
    'IncludeInAPI', p_IncludeInAPI_8f40042603ac,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_8f40042603ac,
    'AllowUpdateAPI', p_AllowUpdateAPI_8f40042603ac,
    'AllowCreateAPI', p_AllowCreateAPI_8f40042603ac,
    'AllowDeleteAPI', p_AllowDeleteAPI_8f40042603ac,
    'CustomResolverAPI', p_CustomResolverAPI_8f40042603ac,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_8f40042603ac,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_8f40042603ac,
    'FullTextCatalog', p_FullTextCatalog_8f40042603ac,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_8f40042603ac,
    'FullTextIndex', p_FullTextIndex_8f40042603ac,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_8f40042603ac,
    'FullTextSearchFunction', p_FullTextSearchFunction_8f40042603ac,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_8f40042603ac,
    'UserViewMaxRows', p_UserViewMaxRows_8f40042603ac,
    'spCreate', p_spCreate_8f40042603ac,
    'spUpdate', p_spUpdate_8f40042603ac,
    'spDelete', p_spDelete_8f40042603ac,
    'spCreateGenerated', p_spCreateGenerated_8f40042603ac,
    'spUpdateGenerated', p_spUpdateGenerated_8f40042603ac,
    'spDeleteGenerated', p_spDeleteGenerated_8f40042603ac,
    'CascadeDeletes', p_CascadeDeletes_8f40042603ac,
    'DeleteType', p_DeleteType_8f40042603ac,
    'AllowRecordMerge', p_AllowRecordMerge_8f40042603ac,
    'spMatch', p_spMatch_8f40042603ac,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_8f40042603ac,
    'UserFormGenerated', p_UserFormGenerated_8f40042603ac,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_8f40042603ac,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_8f40042603ac,
    'PreferredCommunicationField', p_PreferredCommunicationField_8f40042603ac,
    'Icon', p_Icon_8f40042603ac,
    'ScopeDefault', p_ScopeDefault_8f40042603ac,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_8f40042603ac,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_8f40042603ac,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_8f40042603ac,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_8f40042603ac,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_8f40042603ac,
    'RowCount', p_RowCount_8f40042603ac,
    'RowCountRunAt', p_RowCountRunAt_8f40042603ac
  ) ||
  jsonb_build_object(
    'Status', p_Status_8f40042603ac,
    'DisplayName', p_DisplayName_8f40042603ac,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_8f40042603ac,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_8f40042603ac,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_8f40042603ac,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_8f40042603ac,
    'SupportsGeoCoding', p_SupportsGeoCoding_8f40042603ac,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_8f40042603ac,
    'AllowCaching', p_AllowCaching_8f40042603ac,
    'DetectExternalChanges', p_DetectExternalChanges_8f40042603ac,
    'ExternalDataSourceID', p_ExternalDataSourceID_8f40042603ac,
    'ExternalObjectName', p_ExternalObjectName_8f40042603ac,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_8f40042603ac,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_8f40042603ac,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_8f40042603ac,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_8f40042603ac,
    'Configuration', p_Configuration_8f40042603ac,
    'SubtypeSelector', p_SubtypeSelector_8f40042603ac,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_8f40042603ac,
    'ID', p_ID_8f40042603ac
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_85c696e797f2 UUID;
  p_Name_85c696e797f2 VARCHAR(255);
  p_NameSuffix_85c696e797f2 VARCHAR(255);
  p_Description_85c696e797f2 TEXT;
  p_AutoUpdateDescription_85c696e797f2 BOOLEAN;
  p_BaseView_85c696e797f2 VARCHAR(255);
  p_BaseViewGenerated_85c696e797f2 BOOLEAN;
  p_VirtualEntity_85c696e797f2 BOOLEAN;
  p_TrackRecordChanges_85c696e797f2 BOOLEAN;
  p_AuditRecordAccess_85c696e797f2 BOOLEAN;
  p_AuditViewRuns_85c696e797f2 BOOLEAN;
  p_IncludeInAPI_85c696e797f2 BOOLEAN;
  p_AllowAllRowsAPI_85c696e797f2 BOOLEAN;
  p_AllowUpdateAPI_85c696e797f2 BOOLEAN;
  p_AllowCreateAPI_85c696e797f2 BOOLEAN;
  p_AllowDeleteAPI_85c696e797f2 BOOLEAN;
  p_CustomResolverAPI_85c696e797f2 BOOLEAN;
  p_AllowUserSearchAPI_85c696e797f2 BOOLEAN;
  p_FullTextSearchEnabled_85c696e797f2 BOOLEAN;
  p_FullTextCatalog_85c696e797f2 VARCHAR(255);
  p_FullTextCatalogGenerated_85c696e797f2 BOOLEAN;
  p_FullTextIndex_85c696e797f2 VARCHAR(255);
  p_FullTextIndexGenerated_85c696e797f2 BOOLEAN;
  p_FullTextSearchFunction_85c696e797f2 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_85c696e797f2 BOOLEAN;
  p_UserViewMaxRows_85c696e797f2 INTEGER;
  p_spCreate_85c696e797f2 VARCHAR(255);
  p_spUpdate_85c696e797f2 VARCHAR(255);
  p_spDelete_85c696e797f2 VARCHAR(255);
  p_spCreateGenerated_85c696e797f2 BOOLEAN;
  p_spUpdateGenerated_85c696e797f2 BOOLEAN;
  p_spDeleteGenerated_85c696e797f2 BOOLEAN;
  p_CascadeDeletes_85c696e797f2 BOOLEAN;
  p_DeleteType_85c696e797f2 VARCHAR(10);
  p_AllowRecordMerge_85c696e797f2 BOOLEAN;
  p_spMatch_85c696e797f2 VARCHAR(255);
  p_RelationshipDefaultDisplayType_85c696e797f2 VARCHAR(20);
  p_UserFormGenerated_85c696e797f2 BOOLEAN;
  p_EntityObjectSubclassName_85c696e797f2 VARCHAR(255);
  p_EntityObjectSubclassImport_85c696e797f2 VARCHAR(255);
  p_PreferredCommunicationField_85c696e797f2 VARCHAR(255);
  p_Icon_85c696e797f2 VARCHAR(500);
  p_ScopeDefault_85c696e797f2 VARCHAR(100);
  p_RowsToPackWithSchema_85c696e797f2 VARCHAR(20);
  p_RowsToPackSampleMethod_85c696e797f2 VARCHAR(20);
  p_RowsToPackSampleCount_85c696e797f2 INTEGER;
  p_RowsToPackSampleOrder_85c696e797f2 TEXT;
  p_AutoRowCountFrequency_85c696e797f2 INTEGER;
  p_RowCount_85c696e797f2 BIGINT;
  p_RowCountRunAt_85c696e797f2 TIMESTAMPTZ;
  p_Status_85c696e797f2 VARCHAR(25);
  p_DisplayName_85c696e797f2 VARCHAR(255);
  p_AllowMultipleSubtypes_85c696e797f2 BOOLEAN;
  p_AutoUpdateFullTextSearch_85c696e797f2 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_85c696e797f2 BOOLEAN;
  p_TrustServerCacheCompletely_85c696e797f2 BOOLEAN;
  p_SupportsGeoCoding_85c696e797f2 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_85c696e797f2 BOOLEAN;
  p_AllowCaching_85c696e797f2 BOOLEAN;
  p_DetectExternalChanges_85c696e797f2 BOOLEAN;
  p_ExternalDataSourceID_85c696e797f2 UUID;
  p_ExternalObjectName_85c696e797f2 VARCHAR(255);
  p_GeneratedBaseViewName_85c696e797f2 VARCHAR(255);
  p_AllowDirectSQLInsert_85c696e797f2 BOOLEAN;
  p_AllowDirectSQLUpdate_85c696e797f2 BOOLEAN;
  p_AllowDirectSQLDelete_85c696e797f2 BOOLEAN;
  p_Configuration_85c696e797f2 TEXT;
  p_SubtypeSelector_85c696e797f2 TEXT;
  p_EnableFieldLevelSecurity_85c696e797f2 BOOLEAN;
  p_ID_85c696e797f2 UUID;
BEGIN
  p_Name_85c696e797f2 := 'MJ_BizApps_Sales: Loss Reasons';
  p_Description_85c696e797f2 := 'Why a deal was lost. Loss reason is this app''s ONLY mandatory field and the friction is deliberate: loss reasons are the highest-value and most consistently-skipped data in any CRM.';
  p_AutoUpdateDescription_85c696e797f2 := TRUE;
  p_BaseView_85c696e797f2 := 'vwLossReasons';
  p_BaseViewGenerated_85c696e797f2 := TRUE;
  p_VirtualEntity_85c696e797f2 := FALSE;
  p_TrackRecordChanges_85c696e797f2 := TRUE;
  p_AuditRecordAccess_85c696e797f2 := FALSE;
  p_AuditViewRuns_85c696e797f2 := FALSE;
  p_IncludeInAPI_85c696e797f2 := TRUE;
  p_AllowAllRowsAPI_85c696e797f2 := FALSE;
  p_AllowUpdateAPI_85c696e797f2 := TRUE;
  p_AllowCreateAPI_85c696e797f2 := TRUE;
  p_AllowDeleteAPI_85c696e797f2 := TRUE;
  p_CustomResolverAPI_85c696e797f2 := FALSE;
  p_AllowUserSearchAPI_85c696e797f2 := FALSE;
  p_FullTextSearchEnabled_85c696e797f2 := FALSE;
  p_FullTextCatalogGenerated_85c696e797f2 := TRUE;
  p_FullTextIndexGenerated_85c696e797f2 := TRUE;
  p_FullTextSearchFunctionGenerated_85c696e797f2 := TRUE;
  p_UserViewMaxRows_85c696e797f2 := 1000;
  p_spCreateGenerated_85c696e797f2 := TRUE;
  p_spUpdateGenerated_85c696e797f2 := TRUE;
  p_spDeleteGenerated_85c696e797f2 := TRUE;
  p_CascadeDeletes_85c696e797f2 := FALSE;
  p_DeleteType_85c696e797f2 := 'Hard';
  p_AllowRecordMerge_85c696e797f2 := FALSE;
  p_RelationshipDefaultDisplayType_85c696e797f2 := 'Search';
  p_UserFormGenerated_85c696e797f2 := TRUE;
  p_RowsToPackWithSchema_85c696e797f2 := 'None';
  p_RowsToPackSampleMethod_85c696e797f2 := 'random';
  p_RowsToPackSampleCount_85c696e797f2 := 0;
  p_Status_85c696e797f2 := 'Active';
  p_DisplayName_85c696e797f2 := 'Loss Reasons';
  p_AllowMultipleSubtypes_85c696e797f2 := FALSE;
  p_AutoUpdateFullTextSearch_85c696e797f2 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_85c696e797f2 := FALSE;
  p_TrustServerCacheCompletely_85c696e797f2 := TRUE;
  p_SupportsGeoCoding_85c696e797f2 := FALSE;
  p_AutoUpdateSupportsGeoCoding_85c696e797f2 := TRUE;
  p_AllowCaching_85c696e797f2 := FALSE;
  p_DetectExternalChanges_85c696e797f2 := FALSE;
  p_AllowDirectSQLInsert_85c696e797f2 := FALSE;
  p_AllowDirectSQLUpdate_85c696e797f2 := FALSE;
  p_AllowDirectSQLDelete_85c696e797f2 := FALSE;
  p_Configuration_85c696e797f2 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_85c696e797f2 := FALSE;
  p_ID_85c696e797f2 := '827FE4A6-F190-4D4C-A042-9A31FD695886';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_85c696e797f2,
    'Name', p_Name_85c696e797f2,
    'NameSuffix', p_NameSuffix_85c696e797f2,
    'Description', p_Description_85c696e797f2,
    'AutoUpdateDescription', p_AutoUpdateDescription_85c696e797f2,
    'BaseView', p_BaseView_85c696e797f2,
    'BaseViewGenerated', p_BaseViewGenerated_85c696e797f2,
    'VirtualEntity', p_VirtualEntity_85c696e797f2,
    'TrackRecordChanges', p_TrackRecordChanges_85c696e797f2,
    'AuditRecordAccess', p_AuditRecordAccess_85c696e797f2,
    'AuditViewRuns', p_AuditViewRuns_85c696e797f2,
    'IncludeInAPI', p_IncludeInAPI_85c696e797f2,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_85c696e797f2,
    'AllowUpdateAPI', p_AllowUpdateAPI_85c696e797f2,
    'AllowCreateAPI', p_AllowCreateAPI_85c696e797f2,
    'AllowDeleteAPI', p_AllowDeleteAPI_85c696e797f2,
    'CustomResolverAPI', p_CustomResolverAPI_85c696e797f2,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_85c696e797f2,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_85c696e797f2,
    'FullTextCatalog', p_FullTextCatalog_85c696e797f2,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_85c696e797f2,
    'FullTextIndex', p_FullTextIndex_85c696e797f2,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_85c696e797f2,
    'FullTextSearchFunction', p_FullTextSearchFunction_85c696e797f2,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_85c696e797f2,
    'UserViewMaxRows', p_UserViewMaxRows_85c696e797f2,
    'spCreate', p_spCreate_85c696e797f2,
    'spUpdate', p_spUpdate_85c696e797f2,
    'spDelete', p_spDelete_85c696e797f2,
    'spCreateGenerated', p_spCreateGenerated_85c696e797f2,
    'spUpdateGenerated', p_spUpdateGenerated_85c696e797f2,
    'spDeleteGenerated', p_spDeleteGenerated_85c696e797f2,
    'CascadeDeletes', p_CascadeDeletes_85c696e797f2,
    'DeleteType', p_DeleteType_85c696e797f2,
    'AllowRecordMerge', p_AllowRecordMerge_85c696e797f2,
    'spMatch', p_spMatch_85c696e797f2,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_85c696e797f2,
    'UserFormGenerated', p_UserFormGenerated_85c696e797f2,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_85c696e797f2,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_85c696e797f2,
    'PreferredCommunicationField', p_PreferredCommunicationField_85c696e797f2,
    'Icon', p_Icon_85c696e797f2,
    'ScopeDefault', p_ScopeDefault_85c696e797f2,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_85c696e797f2,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_85c696e797f2,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_85c696e797f2,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_85c696e797f2,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_85c696e797f2,
    'RowCount', p_RowCount_85c696e797f2,
    'RowCountRunAt', p_RowCountRunAt_85c696e797f2
  ) ||
  jsonb_build_object(
    'Status', p_Status_85c696e797f2,
    'DisplayName', p_DisplayName_85c696e797f2,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_85c696e797f2,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_85c696e797f2,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_85c696e797f2,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_85c696e797f2,
    'SupportsGeoCoding', p_SupportsGeoCoding_85c696e797f2,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_85c696e797f2,
    'AllowCaching', p_AllowCaching_85c696e797f2,
    'DetectExternalChanges', p_DetectExternalChanges_85c696e797f2,
    'ExternalDataSourceID', p_ExternalDataSourceID_85c696e797f2,
    'ExternalObjectName', p_ExternalObjectName_85c696e797f2,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_85c696e797f2,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_85c696e797f2,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_85c696e797f2,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_85c696e797f2,
    'Configuration', p_Configuration_85c696e797f2,
    'SubtypeSelector', p_SubtypeSelector_85c696e797f2,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_85c696e797f2,
    'ID', p_ID_85c696e797f2
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_96b5eb3d96fe UUID;
  p_Name_96b5eb3d96fe VARCHAR(255);
  p_NameSuffix_96b5eb3d96fe VARCHAR(255);
  p_Description_96b5eb3d96fe TEXT;
  p_AutoUpdateDescription_96b5eb3d96fe BOOLEAN;
  p_BaseView_96b5eb3d96fe VARCHAR(255);
  p_BaseViewGenerated_96b5eb3d96fe BOOLEAN;
  p_VirtualEntity_96b5eb3d96fe BOOLEAN;
  p_TrackRecordChanges_96b5eb3d96fe BOOLEAN;
  p_AuditRecordAccess_96b5eb3d96fe BOOLEAN;
  p_AuditViewRuns_96b5eb3d96fe BOOLEAN;
  p_IncludeInAPI_96b5eb3d96fe BOOLEAN;
  p_AllowAllRowsAPI_96b5eb3d96fe BOOLEAN;
  p_AllowUpdateAPI_96b5eb3d96fe BOOLEAN;
  p_AllowCreateAPI_96b5eb3d96fe BOOLEAN;
  p_AllowDeleteAPI_96b5eb3d96fe BOOLEAN;
  p_CustomResolverAPI_96b5eb3d96fe BOOLEAN;
  p_AllowUserSearchAPI_96b5eb3d96fe BOOLEAN;
  p_FullTextSearchEnabled_96b5eb3d96fe BOOLEAN;
  p_FullTextCatalog_96b5eb3d96fe VARCHAR(255);
  p_FullTextCatalogGenerated_96b5eb3d96fe BOOLEAN;
  p_FullTextIndex_96b5eb3d96fe VARCHAR(255);
  p_FullTextIndexGenerated_96b5eb3d96fe BOOLEAN;
  p_FullTextSearchFunction_96b5eb3d96fe VARCHAR(255);
  p_FullTextSearchFunctionGenerated_96b5eb3d96fe BOOLEAN;
  p_UserViewMaxRows_96b5eb3d96fe INTEGER;
  p_spCreate_96b5eb3d96fe VARCHAR(255);
  p_spUpdate_96b5eb3d96fe VARCHAR(255);
  p_spDelete_96b5eb3d96fe VARCHAR(255);
  p_spCreateGenerated_96b5eb3d96fe BOOLEAN;
  p_spUpdateGenerated_96b5eb3d96fe BOOLEAN;
  p_spDeleteGenerated_96b5eb3d96fe BOOLEAN;
  p_CascadeDeletes_96b5eb3d96fe BOOLEAN;
  p_DeleteType_96b5eb3d96fe VARCHAR(10);
  p_AllowRecordMerge_96b5eb3d96fe BOOLEAN;
  p_spMatch_96b5eb3d96fe VARCHAR(255);
  p_RelationshipDefaultDisplayType_96b5eb3d96fe VARCHAR(20);
  p_UserFormGenerated_96b5eb3d96fe BOOLEAN;
  p_EntityObjectSubclassName_96b5eb3d96fe VARCHAR(255);
  p_EntityObjectSubclassImport_96b5eb3d96fe VARCHAR(255);
  p_PreferredCommunicationField_96b5eb3d96fe VARCHAR(255);
  p_Icon_96b5eb3d96fe VARCHAR(500);
  p_ScopeDefault_96b5eb3d96fe VARCHAR(100);
  p_RowsToPackWithSchema_96b5eb3d96fe VARCHAR(20);
  p_RowsToPackSampleMethod_96b5eb3d96fe VARCHAR(20);
  p_RowsToPackSampleCount_96b5eb3d96fe INTEGER;
  p_RowsToPackSampleOrder_96b5eb3d96fe TEXT;
  p_AutoRowCountFrequency_96b5eb3d96fe INTEGER;
  p_RowCount_96b5eb3d96fe BIGINT;
  p_RowCountRunAt_96b5eb3d96fe TIMESTAMPTZ;
  p_Status_96b5eb3d96fe VARCHAR(25);
  p_DisplayName_96b5eb3d96fe VARCHAR(255);
  p_AllowMultipleSubtypes_96b5eb3d96fe BOOLEAN;
  p_AutoUpdateFullTextSearch_96b5eb3d96fe BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_96b5eb3d96fe BOOLEAN;
  p_TrustServerCacheCompletely_96b5eb3d96fe BOOLEAN;
  p_SupportsGeoCoding_96b5eb3d96fe BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_96b5eb3d96fe BOOLEAN;
  p_AllowCaching_96b5eb3d96fe BOOLEAN;
  p_DetectExternalChanges_96b5eb3d96fe BOOLEAN;
  p_ExternalDataSourceID_96b5eb3d96fe UUID;
  p_ExternalObjectName_96b5eb3d96fe VARCHAR(255);
  p_GeneratedBaseViewName_96b5eb3d96fe VARCHAR(255);
  p_AllowDirectSQLInsert_96b5eb3d96fe BOOLEAN;
  p_AllowDirectSQLUpdate_96b5eb3d96fe BOOLEAN;
  p_AllowDirectSQLDelete_96b5eb3d96fe BOOLEAN;
  p_Configuration_96b5eb3d96fe TEXT;
  p_SubtypeSelector_96b5eb3d96fe TEXT;
  p_EnableFieldLevelSecurity_96b5eb3d96fe BOOLEAN;
  p_ID_96b5eb3d96fe UUID;
BEGIN
  p_Name_96b5eb3d96fe := 'MJ_BizApps_Sales: Pipeline Stages';
  p_Description_96b5eb3d96fe := 'An ordered stage within a pipeline. Stages carry NO IsWon/IsClosed of their own — they point at a DealStatusType that does. That indirection is what makes "Closed Won" a label rather than a behaviour, and lets a pipeline call its winning stage Signed, Booked or Enrolled with no code aware of the difference.';
  p_AutoUpdateDescription_96b5eb3d96fe := TRUE;
  p_BaseView_96b5eb3d96fe := 'vwPipelineStages';
  p_BaseViewGenerated_96b5eb3d96fe := TRUE;
  p_VirtualEntity_96b5eb3d96fe := FALSE;
  p_TrackRecordChanges_96b5eb3d96fe := TRUE;
  p_AuditRecordAccess_96b5eb3d96fe := FALSE;
  p_AuditViewRuns_96b5eb3d96fe := FALSE;
  p_IncludeInAPI_96b5eb3d96fe := TRUE;
  p_AllowAllRowsAPI_96b5eb3d96fe := FALSE;
  p_AllowUpdateAPI_96b5eb3d96fe := TRUE;
  p_AllowCreateAPI_96b5eb3d96fe := TRUE;
  p_AllowDeleteAPI_96b5eb3d96fe := TRUE;
  p_CustomResolverAPI_96b5eb3d96fe := FALSE;
  p_AllowUserSearchAPI_96b5eb3d96fe := TRUE;
  p_FullTextSearchEnabled_96b5eb3d96fe := FALSE;
  p_FullTextCatalogGenerated_96b5eb3d96fe := TRUE;
  p_FullTextIndexGenerated_96b5eb3d96fe := TRUE;
  p_FullTextSearchFunctionGenerated_96b5eb3d96fe := TRUE;
  p_UserViewMaxRows_96b5eb3d96fe := 1000;
  p_spCreateGenerated_96b5eb3d96fe := TRUE;
  p_spUpdateGenerated_96b5eb3d96fe := TRUE;
  p_spDeleteGenerated_96b5eb3d96fe := TRUE;
  p_CascadeDeletes_96b5eb3d96fe := FALSE;
  p_DeleteType_96b5eb3d96fe := 'Hard';
  p_AllowRecordMerge_96b5eb3d96fe := FALSE;
  p_RelationshipDefaultDisplayType_96b5eb3d96fe := 'Search';
  p_UserFormGenerated_96b5eb3d96fe := TRUE;
  p_RowsToPackWithSchema_96b5eb3d96fe := 'None';
  p_RowsToPackSampleMethod_96b5eb3d96fe := 'random';
  p_RowsToPackSampleCount_96b5eb3d96fe := 0;
  p_Status_96b5eb3d96fe := 'Active';
  p_DisplayName_96b5eb3d96fe := 'Pipeline Stages';
  p_AllowMultipleSubtypes_96b5eb3d96fe := FALSE;
  p_AutoUpdateFullTextSearch_96b5eb3d96fe := TRUE;
  p_AutoUpdateAllowUserSearchAPI_96b5eb3d96fe := FALSE;
  p_TrustServerCacheCompletely_96b5eb3d96fe := TRUE;
  p_SupportsGeoCoding_96b5eb3d96fe := FALSE;
  p_AutoUpdateSupportsGeoCoding_96b5eb3d96fe := TRUE;
  p_AllowCaching_96b5eb3d96fe := FALSE;
  p_DetectExternalChanges_96b5eb3d96fe := FALSE;
  p_AllowDirectSQLInsert_96b5eb3d96fe := FALSE;
  p_AllowDirectSQLUpdate_96b5eb3d96fe := FALSE;
  p_AllowDirectSQLDelete_96b5eb3d96fe := FALSE;
  p_Configuration_96b5eb3d96fe := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_96b5eb3d96fe := FALSE;
  p_ID_96b5eb3d96fe := 'D9B2404D-CA19-4339-8E87-CE62B1C30647';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_96b5eb3d96fe,
    'Name', p_Name_96b5eb3d96fe,
    'NameSuffix', p_NameSuffix_96b5eb3d96fe,
    'Description', p_Description_96b5eb3d96fe,
    'AutoUpdateDescription', p_AutoUpdateDescription_96b5eb3d96fe,
    'BaseView', p_BaseView_96b5eb3d96fe,
    'BaseViewGenerated', p_BaseViewGenerated_96b5eb3d96fe,
    'VirtualEntity', p_VirtualEntity_96b5eb3d96fe,
    'TrackRecordChanges', p_TrackRecordChanges_96b5eb3d96fe,
    'AuditRecordAccess', p_AuditRecordAccess_96b5eb3d96fe,
    'AuditViewRuns', p_AuditViewRuns_96b5eb3d96fe,
    'IncludeInAPI', p_IncludeInAPI_96b5eb3d96fe,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_96b5eb3d96fe,
    'AllowUpdateAPI', p_AllowUpdateAPI_96b5eb3d96fe,
    'AllowCreateAPI', p_AllowCreateAPI_96b5eb3d96fe,
    'AllowDeleteAPI', p_AllowDeleteAPI_96b5eb3d96fe,
    'CustomResolverAPI', p_CustomResolverAPI_96b5eb3d96fe,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_96b5eb3d96fe,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_96b5eb3d96fe,
    'FullTextCatalog', p_FullTextCatalog_96b5eb3d96fe,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_96b5eb3d96fe,
    'FullTextIndex', p_FullTextIndex_96b5eb3d96fe,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_96b5eb3d96fe,
    'FullTextSearchFunction', p_FullTextSearchFunction_96b5eb3d96fe,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_96b5eb3d96fe,
    'UserViewMaxRows', p_UserViewMaxRows_96b5eb3d96fe,
    'spCreate', p_spCreate_96b5eb3d96fe,
    'spUpdate', p_spUpdate_96b5eb3d96fe,
    'spDelete', p_spDelete_96b5eb3d96fe,
    'spCreateGenerated', p_spCreateGenerated_96b5eb3d96fe,
    'spUpdateGenerated', p_spUpdateGenerated_96b5eb3d96fe,
    'spDeleteGenerated', p_spDeleteGenerated_96b5eb3d96fe,
    'CascadeDeletes', p_CascadeDeletes_96b5eb3d96fe,
    'DeleteType', p_DeleteType_96b5eb3d96fe,
    'AllowRecordMerge', p_AllowRecordMerge_96b5eb3d96fe,
    'spMatch', p_spMatch_96b5eb3d96fe,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_96b5eb3d96fe,
    'UserFormGenerated', p_UserFormGenerated_96b5eb3d96fe,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_96b5eb3d96fe,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_96b5eb3d96fe,
    'PreferredCommunicationField', p_PreferredCommunicationField_96b5eb3d96fe,
    'Icon', p_Icon_96b5eb3d96fe,
    'ScopeDefault', p_ScopeDefault_96b5eb3d96fe,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_96b5eb3d96fe,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_96b5eb3d96fe,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_96b5eb3d96fe,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_96b5eb3d96fe,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_96b5eb3d96fe,
    'RowCount', p_RowCount_96b5eb3d96fe,
    'RowCountRunAt', p_RowCountRunAt_96b5eb3d96fe
  ) ||
  jsonb_build_object(
    'Status', p_Status_96b5eb3d96fe,
    'DisplayName', p_DisplayName_96b5eb3d96fe,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_96b5eb3d96fe,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_96b5eb3d96fe,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_96b5eb3d96fe,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_96b5eb3d96fe,
    'SupportsGeoCoding', p_SupportsGeoCoding_96b5eb3d96fe,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_96b5eb3d96fe,
    'AllowCaching', p_AllowCaching_96b5eb3d96fe,
    'DetectExternalChanges', p_DetectExternalChanges_96b5eb3d96fe,
    'ExternalDataSourceID', p_ExternalDataSourceID_96b5eb3d96fe,
    'ExternalObjectName', p_ExternalObjectName_96b5eb3d96fe,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_96b5eb3d96fe,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_96b5eb3d96fe,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_96b5eb3d96fe,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_96b5eb3d96fe,
    'Configuration', p_Configuration_96b5eb3d96fe,
    'SubtypeSelector', p_SubtypeSelector_96b5eb3d96fe,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_96b5eb3d96fe,
    'ID', p_ID_96b5eb3d96fe
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_74690c337cf3 UUID;
  p_Name_74690c337cf3 VARCHAR(255);
  p_NameSuffix_74690c337cf3 VARCHAR(255);
  p_Description_74690c337cf3 TEXT;
  p_AutoUpdateDescription_74690c337cf3 BOOLEAN;
  p_BaseView_74690c337cf3 VARCHAR(255);
  p_BaseViewGenerated_74690c337cf3 BOOLEAN;
  p_VirtualEntity_74690c337cf3 BOOLEAN;
  p_TrackRecordChanges_74690c337cf3 BOOLEAN;
  p_AuditRecordAccess_74690c337cf3 BOOLEAN;
  p_AuditViewRuns_74690c337cf3 BOOLEAN;
  p_IncludeInAPI_74690c337cf3 BOOLEAN;
  p_AllowAllRowsAPI_74690c337cf3 BOOLEAN;
  p_AllowUpdateAPI_74690c337cf3 BOOLEAN;
  p_AllowCreateAPI_74690c337cf3 BOOLEAN;
  p_AllowDeleteAPI_74690c337cf3 BOOLEAN;
  p_CustomResolverAPI_74690c337cf3 BOOLEAN;
  p_AllowUserSearchAPI_74690c337cf3 BOOLEAN;
  p_FullTextSearchEnabled_74690c337cf3 BOOLEAN;
  p_FullTextCatalog_74690c337cf3 VARCHAR(255);
  p_FullTextCatalogGenerated_74690c337cf3 BOOLEAN;
  p_FullTextIndex_74690c337cf3 VARCHAR(255);
  p_FullTextIndexGenerated_74690c337cf3 BOOLEAN;
  p_FullTextSearchFunction_74690c337cf3 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_74690c337cf3 BOOLEAN;
  p_UserViewMaxRows_74690c337cf3 INTEGER;
  p_spCreate_74690c337cf3 VARCHAR(255);
  p_spUpdate_74690c337cf3 VARCHAR(255);
  p_spDelete_74690c337cf3 VARCHAR(255);
  p_spCreateGenerated_74690c337cf3 BOOLEAN;
  p_spUpdateGenerated_74690c337cf3 BOOLEAN;
  p_spDeleteGenerated_74690c337cf3 BOOLEAN;
  p_CascadeDeletes_74690c337cf3 BOOLEAN;
  p_DeleteType_74690c337cf3 VARCHAR(10);
  p_AllowRecordMerge_74690c337cf3 BOOLEAN;
  p_spMatch_74690c337cf3 VARCHAR(255);
  p_RelationshipDefaultDisplayType_74690c337cf3 VARCHAR(20);
  p_UserFormGenerated_74690c337cf3 BOOLEAN;
  p_EntityObjectSubclassName_74690c337cf3 VARCHAR(255);
  p_EntityObjectSubclassImport_74690c337cf3 VARCHAR(255);
  p_PreferredCommunicationField_74690c337cf3 VARCHAR(255);
  p_Icon_74690c337cf3 VARCHAR(500);
  p_ScopeDefault_74690c337cf3 VARCHAR(100);
  p_RowsToPackWithSchema_74690c337cf3 VARCHAR(20);
  p_RowsToPackSampleMethod_74690c337cf3 VARCHAR(20);
  p_RowsToPackSampleCount_74690c337cf3 INTEGER;
  p_RowsToPackSampleOrder_74690c337cf3 TEXT;
  p_AutoRowCountFrequency_74690c337cf3 INTEGER;
  p_RowCount_74690c337cf3 BIGINT;
  p_RowCountRunAt_74690c337cf3 TIMESTAMPTZ;
  p_Status_74690c337cf3 VARCHAR(25);
  p_DisplayName_74690c337cf3 VARCHAR(255);
  p_AllowMultipleSubtypes_74690c337cf3 BOOLEAN;
  p_AutoUpdateFullTextSearch_74690c337cf3 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_74690c337cf3 BOOLEAN;
  p_TrustServerCacheCompletely_74690c337cf3 BOOLEAN;
  p_SupportsGeoCoding_74690c337cf3 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_74690c337cf3 BOOLEAN;
  p_AllowCaching_74690c337cf3 BOOLEAN;
  p_DetectExternalChanges_74690c337cf3 BOOLEAN;
  p_ExternalDataSourceID_74690c337cf3 UUID;
  p_ExternalObjectName_74690c337cf3 VARCHAR(255);
  p_GeneratedBaseViewName_74690c337cf3 VARCHAR(255);
  p_AllowDirectSQLInsert_74690c337cf3 BOOLEAN;
  p_AllowDirectSQLUpdate_74690c337cf3 BOOLEAN;
  p_AllowDirectSQLDelete_74690c337cf3 BOOLEAN;
  p_Configuration_74690c337cf3 TEXT;
  p_SubtypeSelector_74690c337cf3 TEXT;
  p_EnableFieldLevelSecurity_74690c337cf3 BOOLEAN;
  p_ID_74690c337cf3 UUID;
BEGIN
  p_Name_74690c337cf3 := 'MJ_BizApps_Sales: Pipelines';
  p_Description_74690c337cf3 := 'A sales pipeline, owned by exactly one company. A company may have any number of pipelines; a pipeline may have any number of deals.';
  p_AutoUpdateDescription_74690c337cf3 := TRUE;
  p_BaseView_74690c337cf3 := 'vwPipelines';
  p_BaseViewGenerated_74690c337cf3 := TRUE;
  p_VirtualEntity_74690c337cf3 := FALSE;
  p_TrackRecordChanges_74690c337cf3 := TRUE;
  p_AuditRecordAccess_74690c337cf3 := FALSE;
  p_AuditViewRuns_74690c337cf3 := FALSE;
  p_IncludeInAPI_74690c337cf3 := TRUE;
  p_AllowAllRowsAPI_74690c337cf3 := FALSE;
  p_AllowUpdateAPI_74690c337cf3 := TRUE;
  p_AllowCreateAPI_74690c337cf3 := TRUE;
  p_AllowDeleteAPI_74690c337cf3 := TRUE;
  p_CustomResolverAPI_74690c337cf3 := FALSE;
  p_AllowUserSearchAPI_74690c337cf3 := TRUE;
  p_FullTextSearchEnabled_74690c337cf3 := FALSE;
  p_FullTextCatalogGenerated_74690c337cf3 := TRUE;
  p_FullTextIndexGenerated_74690c337cf3 := TRUE;
  p_FullTextSearchFunctionGenerated_74690c337cf3 := TRUE;
  p_UserViewMaxRows_74690c337cf3 := 1000;
  p_spCreateGenerated_74690c337cf3 := TRUE;
  p_spUpdateGenerated_74690c337cf3 := TRUE;
  p_spDeleteGenerated_74690c337cf3 := TRUE;
  p_CascadeDeletes_74690c337cf3 := FALSE;
  p_DeleteType_74690c337cf3 := 'Hard';
  p_AllowRecordMerge_74690c337cf3 := FALSE;
  p_RelationshipDefaultDisplayType_74690c337cf3 := 'Search';
  p_UserFormGenerated_74690c337cf3 := TRUE;
  p_RowsToPackWithSchema_74690c337cf3 := 'None';
  p_RowsToPackSampleMethod_74690c337cf3 := 'random';
  p_RowsToPackSampleCount_74690c337cf3 := 0;
  p_Status_74690c337cf3 := 'Active';
  p_DisplayName_74690c337cf3 := 'Pipelines';
  p_AllowMultipleSubtypes_74690c337cf3 := FALSE;
  p_AutoUpdateFullTextSearch_74690c337cf3 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_74690c337cf3 := FALSE;
  p_TrustServerCacheCompletely_74690c337cf3 := TRUE;
  p_SupportsGeoCoding_74690c337cf3 := FALSE;
  p_AutoUpdateSupportsGeoCoding_74690c337cf3 := TRUE;
  p_AllowCaching_74690c337cf3 := FALSE;
  p_DetectExternalChanges_74690c337cf3 := FALSE;
  p_AllowDirectSQLInsert_74690c337cf3 := FALSE;
  p_AllowDirectSQLUpdate_74690c337cf3 := FALSE;
  p_AllowDirectSQLDelete_74690c337cf3 := FALSE;
  p_Configuration_74690c337cf3 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "smart"
    }
  }
}';
  p_EnableFieldLevelSecurity_74690c337cf3 := FALSE;
  p_ID_74690c337cf3 := 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_74690c337cf3,
    'Name', p_Name_74690c337cf3,
    'NameSuffix', p_NameSuffix_74690c337cf3,
    'Description', p_Description_74690c337cf3,
    'AutoUpdateDescription', p_AutoUpdateDescription_74690c337cf3,
    'BaseView', p_BaseView_74690c337cf3,
    'BaseViewGenerated', p_BaseViewGenerated_74690c337cf3,
    'VirtualEntity', p_VirtualEntity_74690c337cf3,
    'TrackRecordChanges', p_TrackRecordChanges_74690c337cf3,
    'AuditRecordAccess', p_AuditRecordAccess_74690c337cf3,
    'AuditViewRuns', p_AuditViewRuns_74690c337cf3,
    'IncludeInAPI', p_IncludeInAPI_74690c337cf3,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_74690c337cf3,
    'AllowUpdateAPI', p_AllowUpdateAPI_74690c337cf3,
    'AllowCreateAPI', p_AllowCreateAPI_74690c337cf3,
    'AllowDeleteAPI', p_AllowDeleteAPI_74690c337cf3,
    'CustomResolverAPI', p_CustomResolverAPI_74690c337cf3,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_74690c337cf3,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_74690c337cf3,
    'FullTextCatalog', p_FullTextCatalog_74690c337cf3,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_74690c337cf3,
    'FullTextIndex', p_FullTextIndex_74690c337cf3,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_74690c337cf3,
    'FullTextSearchFunction', p_FullTextSearchFunction_74690c337cf3,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_74690c337cf3,
    'UserViewMaxRows', p_UserViewMaxRows_74690c337cf3,
    'spCreate', p_spCreate_74690c337cf3,
    'spUpdate', p_spUpdate_74690c337cf3,
    'spDelete', p_spDelete_74690c337cf3,
    'spCreateGenerated', p_spCreateGenerated_74690c337cf3,
    'spUpdateGenerated', p_spUpdateGenerated_74690c337cf3,
    'spDeleteGenerated', p_spDeleteGenerated_74690c337cf3,
    'CascadeDeletes', p_CascadeDeletes_74690c337cf3,
    'DeleteType', p_DeleteType_74690c337cf3,
    'AllowRecordMerge', p_AllowRecordMerge_74690c337cf3,
    'spMatch', p_spMatch_74690c337cf3,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_74690c337cf3,
    'UserFormGenerated', p_UserFormGenerated_74690c337cf3,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_74690c337cf3,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_74690c337cf3,
    'PreferredCommunicationField', p_PreferredCommunicationField_74690c337cf3,
    'Icon', p_Icon_74690c337cf3,
    'ScopeDefault', p_ScopeDefault_74690c337cf3,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_74690c337cf3,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_74690c337cf3,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_74690c337cf3,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_74690c337cf3,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_74690c337cf3,
    'RowCount', p_RowCount_74690c337cf3,
    'RowCountRunAt', p_RowCountRunAt_74690c337cf3
  ) ||
  jsonb_build_object(
    'Status', p_Status_74690c337cf3,
    'DisplayName', p_DisplayName_74690c337cf3,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_74690c337cf3,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_74690c337cf3,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_74690c337cf3,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_74690c337cf3,
    'SupportsGeoCoding', p_SupportsGeoCoding_74690c337cf3,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_74690c337cf3,
    'AllowCaching', p_AllowCaching_74690c337cf3,
    'DetectExternalChanges', p_DetectExternalChanges_74690c337cf3,
    'ExternalDataSourceID', p_ExternalDataSourceID_74690c337cf3,
    'ExternalObjectName', p_ExternalObjectName_74690c337cf3,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_74690c337cf3,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_74690c337cf3,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_74690c337cf3,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_74690c337cf3,
    'Configuration', p_Configuration_74690c337cf3,
    'SubtypeSelector', p_SubtypeSelector_74690c337cf3,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_74690c337cf3,
    'ID', p_ID_74690c337cf3
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_027c4c420d81 UUID;
  p_Name_027c4c420d81 VARCHAR(255);
  p_NameSuffix_027c4c420d81 VARCHAR(255);
  p_Description_027c4c420d81 TEXT;
  p_AutoUpdateDescription_027c4c420d81 BOOLEAN;
  p_BaseView_027c4c420d81 VARCHAR(255);
  p_BaseViewGenerated_027c4c420d81 BOOLEAN;
  p_VirtualEntity_027c4c420d81 BOOLEAN;
  p_TrackRecordChanges_027c4c420d81 BOOLEAN;
  p_AuditRecordAccess_027c4c420d81 BOOLEAN;
  p_AuditViewRuns_027c4c420d81 BOOLEAN;
  p_IncludeInAPI_027c4c420d81 BOOLEAN;
  p_AllowAllRowsAPI_027c4c420d81 BOOLEAN;
  p_AllowUpdateAPI_027c4c420d81 BOOLEAN;
  p_AllowCreateAPI_027c4c420d81 BOOLEAN;
  p_AllowDeleteAPI_027c4c420d81 BOOLEAN;
  p_CustomResolverAPI_027c4c420d81 BOOLEAN;
  p_AllowUserSearchAPI_027c4c420d81 BOOLEAN;
  p_FullTextSearchEnabled_027c4c420d81 BOOLEAN;
  p_FullTextCatalog_027c4c420d81 VARCHAR(255);
  p_FullTextCatalogGenerated_027c4c420d81 BOOLEAN;
  p_FullTextIndex_027c4c420d81 VARCHAR(255);
  p_FullTextIndexGenerated_027c4c420d81 BOOLEAN;
  p_FullTextSearchFunction_027c4c420d81 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_027c4c420d81 BOOLEAN;
  p_UserViewMaxRows_027c4c420d81 INTEGER;
  p_spCreate_027c4c420d81 VARCHAR(255);
  p_spUpdate_027c4c420d81 VARCHAR(255);
  p_spDelete_027c4c420d81 VARCHAR(255);
  p_spCreateGenerated_027c4c420d81 BOOLEAN;
  p_spUpdateGenerated_027c4c420d81 BOOLEAN;
  p_spDeleteGenerated_027c4c420d81 BOOLEAN;
  p_CascadeDeletes_027c4c420d81 BOOLEAN;
  p_DeleteType_027c4c420d81 VARCHAR(10);
  p_AllowRecordMerge_027c4c420d81 BOOLEAN;
  p_spMatch_027c4c420d81 VARCHAR(255);
  p_RelationshipDefaultDisplayType_027c4c420d81 VARCHAR(20);
  p_UserFormGenerated_027c4c420d81 BOOLEAN;
  p_EntityObjectSubclassName_027c4c420d81 VARCHAR(255);
  p_EntityObjectSubclassImport_027c4c420d81 VARCHAR(255);
  p_PreferredCommunicationField_027c4c420d81 VARCHAR(255);
  p_Icon_027c4c420d81 VARCHAR(500);
  p_ScopeDefault_027c4c420d81 VARCHAR(100);
  p_RowsToPackWithSchema_027c4c420d81 VARCHAR(20);
  p_RowsToPackSampleMethod_027c4c420d81 VARCHAR(20);
  p_RowsToPackSampleCount_027c4c420d81 INTEGER;
  p_RowsToPackSampleOrder_027c4c420d81 TEXT;
  p_AutoRowCountFrequency_027c4c420d81 INTEGER;
  p_RowCount_027c4c420d81 BIGINT;
  p_RowCountRunAt_027c4c420d81 TIMESTAMPTZ;
  p_Status_027c4c420d81 VARCHAR(25);
  p_DisplayName_027c4c420d81 VARCHAR(255);
  p_AllowMultipleSubtypes_027c4c420d81 BOOLEAN;
  p_AutoUpdateFullTextSearch_027c4c420d81 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_027c4c420d81 BOOLEAN;
  p_TrustServerCacheCompletely_027c4c420d81 BOOLEAN;
  p_SupportsGeoCoding_027c4c420d81 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_027c4c420d81 BOOLEAN;
  p_AllowCaching_027c4c420d81 BOOLEAN;
  p_DetectExternalChanges_027c4c420d81 BOOLEAN;
  p_ExternalDataSourceID_027c4c420d81 UUID;
  p_ExternalObjectName_027c4c420d81 VARCHAR(255);
  p_GeneratedBaseViewName_027c4c420d81 VARCHAR(255);
  p_AllowDirectSQLInsert_027c4c420d81 BOOLEAN;
  p_AllowDirectSQLUpdate_027c4c420d81 BOOLEAN;
  p_AllowDirectSQLDelete_027c4c420d81 BOOLEAN;
  p_Configuration_027c4c420d81 TEXT;
  p_SubtypeSelector_027c4c420d81 TEXT;
  p_EnableFieldLevelSecurity_027c4c420d81 BOOLEAN;
  p_ID_027c4c420d81 UUID;
BEGIN
  p_ParentID_027c4c420d81 := 'C70448F9-9792-41D7-A82C-784B66429D54';
  p_Name_027c4c420d81 := 'MJ_BizApps_Sales: Sales Accounts';
  p_Description_027c4c420d81 := 'CRM attributes for an organization we sell to. An IsA extension of __mj_BizAppsCommon.Organization sharing its UUID — the account and the organization ARE one record, so a customer that is also a vendor and a member stays one row in the Organization graph.';
  p_AutoUpdateDescription_027c4c420d81 := TRUE;
  p_BaseView_027c4c420d81 := 'vwSalesAccounts';
  p_BaseViewGenerated_027c4c420d81 := TRUE;
  p_VirtualEntity_027c4c420d81 := FALSE;
  p_TrackRecordChanges_027c4c420d81 := TRUE;
  p_AuditRecordAccess_027c4c420d81 := FALSE;
  p_AuditViewRuns_027c4c420d81 := FALSE;
  p_IncludeInAPI_027c4c420d81 := TRUE;
  p_AllowAllRowsAPI_027c4c420d81 := FALSE;
  p_AllowUpdateAPI_027c4c420d81 := TRUE;
  p_AllowCreateAPI_027c4c420d81 := TRUE;
  p_AllowDeleteAPI_027c4c420d81 := TRUE;
  p_CustomResolverAPI_027c4c420d81 := FALSE;
  p_AllowUserSearchAPI_027c4c420d81 := TRUE;
  p_FullTextSearchEnabled_027c4c420d81 := FALSE;
  p_FullTextCatalogGenerated_027c4c420d81 := TRUE;
  p_FullTextIndexGenerated_027c4c420d81 := TRUE;
  p_FullTextSearchFunctionGenerated_027c4c420d81 := TRUE;
  p_UserViewMaxRows_027c4c420d81 := 1000;
  p_spCreateGenerated_027c4c420d81 := TRUE;
  p_spUpdateGenerated_027c4c420d81 := TRUE;
  p_spDeleteGenerated_027c4c420d81 := TRUE;
  p_CascadeDeletes_027c4c420d81 := FALSE;
  p_DeleteType_027c4c420d81 := 'Hard';
  p_AllowRecordMerge_027c4c420d81 := FALSE;
  p_RelationshipDefaultDisplayType_027c4c420d81 := 'Search';
  p_UserFormGenerated_027c4c420d81 := TRUE;
  p_RowsToPackWithSchema_027c4c420d81 := 'None';
  p_RowsToPackSampleMethod_027c4c420d81 := 'random';
  p_RowsToPackSampleCount_027c4c420d81 := 0;
  p_Status_027c4c420d81 := 'Active';
  p_DisplayName_027c4c420d81 := 'Sales Accounts';
  p_AllowMultipleSubtypes_027c4c420d81 := FALSE;
  p_AutoUpdateFullTextSearch_027c4c420d81 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_027c4c420d81 := FALSE;
  p_TrustServerCacheCompletely_027c4c420d81 := TRUE;
  p_SupportsGeoCoding_027c4c420d81 := FALSE;
  p_AutoUpdateSupportsGeoCoding_027c4c420d81 := TRUE;
  p_AllowCaching_027c4c420d81 := FALSE;
  p_DetectExternalChanges_027c4c420d81 := FALSE;
  p_AllowDirectSQLInsert_027c4c420d81 := FALSE;
  p_AllowDirectSQLUpdate_027c4c420d81 := FALSE;
  p_AllowDirectSQLDelete_027c4c420d81 := FALSE;
  p_Configuration_027c4c420d81 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_027c4c420d81 := FALSE;
  p_ID_027c4c420d81 := '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A';
  PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_027c4c420d81,
    'Name', p_Name_027c4c420d81,
    'NameSuffix', p_NameSuffix_027c4c420d81,
    'Description', p_Description_027c4c420d81,
    'AutoUpdateDescription', p_AutoUpdateDescription_027c4c420d81,
    'BaseView', p_BaseView_027c4c420d81,
    'BaseViewGenerated', p_BaseViewGenerated_027c4c420d81,
    'VirtualEntity', p_VirtualEntity_027c4c420d81,
    'TrackRecordChanges', p_TrackRecordChanges_027c4c420d81,
    'AuditRecordAccess', p_AuditRecordAccess_027c4c420d81,
    'AuditViewRuns', p_AuditViewRuns_027c4c420d81,
    'IncludeInAPI', p_IncludeInAPI_027c4c420d81,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_027c4c420d81,
    'AllowUpdateAPI', p_AllowUpdateAPI_027c4c420d81,
    'AllowCreateAPI', p_AllowCreateAPI_027c4c420d81,
    'AllowDeleteAPI', p_AllowDeleteAPI_027c4c420d81,
    'CustomResolverAPI', p_CustomResolverAPI_027c4c420d81,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_027c4c420d81,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_027c4c420d81,
    'FullTextCatalog', p_FullTextCatalog_027c4c420d81,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_027c4c420d81,
    'FullTextIndex', p_FullTextIndex_027c4c420d81,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_027c4c420d81,
    'FullTextSearchFunction', p_FullTextSearchFunction_027c4c420d81,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_027c4c420d81,
    'UserViewMaxRows', p_UserViewMaxRows_027c4c420d81,
    'spCreate', p_spCreate_027c4c420d81,
    'spUpdate', p_spUpdate_027c4c420d81,
    'spDelete', p_spDelete_027c4c420d81,
    'spCreateGenerated', p_spCreateGenerated_027c4c420d81,
    'spUpdateGenerated', p_spUpdateGenerated_027c4c420d81,
    'spDeleteGenerated', p_spDeleteGenerated_027c4c420d81,
    'CascadeDeletes', p_CascadeDeletes_027c4c420d81,
    'DeleteType', p_DeleteType_027c4c420d81,
    'AllowRecordMerge', p_AllowRecordMerge_027c4c420d81,
    'spMatch', p_spMatch_027c4c420d81,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_027c4c420d81,
    'UserFormGenerated', p_UserFormGenerated_027c4c420d81,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_027c4c420d81,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_027c4c420d81,
    'PreferredCommunicationField', p_PreferredCommunicationField_027c4c420d81,
    'Icon', p_Icon_027c4c420d81,
    'ScopeDefault', p_ScopeDefault_027c4c420d81,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_027c4c420d81,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_027c4c420d81,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_027c4c420d81,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_027c4c420d81,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_027c4c420d81,
    'RowCount', p_RowCount_027c4c420d81,
    'RowCountRunAt', p_RowCountRunAt_027c4c420d81
  ) ||
  jsonb_build_object(
    'Status', p_Status_027c4c420d81,
    'DisplayName', p_DisplayName_027c4c420d81,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_027c4c420d81,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_027c4c420d81,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_027c4c420d81,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_027c4c420d81,
    'SupportsGeoCoding', p_SupportsGeoCoding_027c4c420d81,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_027c4c420d81,
    'AllowCaching', p_AllowCaching_027c4c420d81,
    'DetectExternalChanges', p_DetectExternalChanges_027c4c420d81,
    'ExternalDataSourceID', p_ExternalDataSourceID_027c4c420d81,
    'ExternalObjectName', p_ExternalObjectName_027c4c420d81,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_027c4c420d81,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_027c4c420d81,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_027c4c420d81,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_027c4c420d81,
    'Configuration', p_Configuration_027c4c420d81,
    'SubtypeSelector', p_SubtypeSelector_027c4c420d81,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_027c4c420d81,
    'ID', p_ID_027c4c420d81
  ));
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_46ccf5cdda36 UUID;
  p_Name_46ccf5cdda36 VARCHAR(255);
  p_NameSuffix_46ccf5cdda36 VARCHAR(255);
  p_Description_46ccf5cdda36 TEXT;
  p_AutoUpdateDescription_46ccf5cdda36 BOOLEAN;
  p_BaseView_46ccf5cdda36 VARCHAR(255);
  p_BaseViewGenerated_46ccf5cdda36 BOOLEAN;
  p_VirtualEntity_46ccf5cdda36 BOOLEAN;
  p_TrackRecordChanges_46ccf5cdda36 BOOLEAN;
  p_AuditRecordAccess_46ccf5cdda36 BOOLEAN;
  p_AuditViewRuns_46ccf5cdda36 BOOLEAN;
  p_IncludeInAPI_46ccf5cdda36 BOOLEAN;
  p_AllowAllRowsAPI_46ccf5cdda36 BOOLEAN;
  p_AllowUpdateAPI_46ccf5cdda36 BOOLEAN;
  p_AllowCreateAPI_46ccf5cdda36 BOOLEAN;
  p_AllowDeleteAPI_46ccf5cdda36 BOOLEAN;
  p_CustomResolverAPI_46ccf5cdda36 BOOLEAN;
  p_AllowUserSearchAPI_46ccf5cdda36 BOOLEAN;
  p_FullTextSearchEnabled_46ccf5cdda36 BOOLEAN;
  p_FullTextCatalog_46ccf5cdda36 VARCHAR(255);
  p_FullTextCatalogGenerated_46ccf5cdda36 BOOLEAN;
  p_FullTextIndex_46ccf5cdda36 VARCHAR(255);
  p_FullTextIndexGenerated_46ccf5cdda36 BOOLEAN;
  p_FullTextSearchFunction_46ccf5cdda36 VARCHAR(255);
  p_FullTextSearchFunctionGenerated_46ccf5cdda36 BOOLEAN;
  p_UserViewMaxRows_46ccf5cdda36 INTEGER;
  p_spCreate_46ccf5cdda36 VARCHAR(255);
  p_spUpdate_46ccf5cdda36 VARCHAR(255);
  p_spDelete_46ccf5cdda36 VARCHAR(255);
  p_spCreateGenerated_46ccf5cdda36 BOOLEAN;
  p_spUpdateGenerated_46ccf5cdda36 BOOLEAN;
  p_spDeleteGenerated_46ccf5cdda36 BOOLEAN;
  p_CascadeDeletes_46ccf5cdda36 BOOLEAN;
  p_DeleteType_46ccf5cdda36 VARCHAR(10);
  p_AllowRecordMerge_46ccf5cdda36 BOOLEAN;
  p_spMatch_46ccf5cdda36 VARCHAR(255);
  p_RelationshipDefaultDisplayType_46ccf5cdda36 VARCHAR(20);
  p_UserFormGenerated_46ccf5cdda36 BOOLEAN;
  p_EntityObjectSubclassName_46ccf5cdda36 VARCHAR(255);
  p_EntityObjectSubclassImport_46ccf5cdda36 VARCHAR(255);
  p_PreferredCommunicationField_46ccf5cdda36 VARCHAR(255);
  p_Icon_46ccf5cdda36 VARCHAR(500);
  p_ScopeDefault_46ccf5cdda36 VARCHAR(100);
  p_RowsToPackWithSchema_46ccf5cdda36 VARCHAR(20);
  p_RowsToPackSampleMethod_46ccf5cdda36 VARCHAR(20);
  p_RowsToPackSampleCount_46ccf5cdda36 INTEGER;
  p_RowsToPackSampleOrder_46ccf5cdda36 TEXT;
  p_AutoRowCountFrequency_46ccf5cdda36 INTEGER;
  p_RowCount_46ccf5cdda36 BIGINT;
  p_RowCountRunAt_46ccf5cdda36 TIMESTAMPTZ;
  p_Status_46ccf5cdda36 VARCHAR(25);
  p_DisplayName_46ccf5cdda36 VARCHAR(255);
  p_AllowMultipleSubtypes_46ccf5cdda36 BOOLEAN;
  p_AutoUpdateFullTextSearch_46ccf5cdda36 BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_46ccf5cdda36 BOOLEAN;
  p_TrustServerCacheCompletely_46ccf5cdda36 BOOLEAN;
  p_SupportsGeoCoding_46ccf5cdda36 BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_46ccf5cdda36 BOOLEAN;
  p_AllowCaching_46ccf5cdda36 BOOLEAN;
  p_DetectExternalChanges_46ccf5cdda36 BOOLEAN;
  p_ExternalDataSourceID_46ccf5cdda36 UUID;
  p_ExternalObjectName_46ccf5cdda36 VARCHAR(255);
  p_GeneratedBaseViewName_46ccf5cdda36 VARCHAR(255);
  p_AllowDirectSQLInsert_46ccf5cdda36 BOOLEAN;
  p_AllowDirectSQLUpdate_46ccf5cdda36 BOOLEAN;
  p_AllowDirectSQLDelete_46ccf5cdda36 BOOLEAN;
  p_Configuration_46ccf5cdda36 TEXT;
  p_SubtypeSelector_46ccf5cdda36 TEXT;
  p_EnableFieldLevelSecurity_46ccf5cdda36 BOOLEAN;
  p_ID_46ccf5cdda36 UUID;
BEGIN
  p_ParentID_46ccf5cdda36 := '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F';
  p_Name_46ccf5cdda36 := 'MJ_BizApps_Sales: Sales Contacts';
  p_Description_46ccf5cdda36 := 'CRM attributes for a person we sell to. An IsA extension of __mj_BizAppsCommon.Person sharing its UUID. There is deliberately no Lead entity — a lead is a Person at a lifecycle stage.';
  p_AutoUpdateDescription_46ccf5cdda36 := TRUE;
  p_BaseView_46ccf5cdda36 := 'vwSalesContacts';
  p_BaseViewGenerated_46ccf5cdda36 := FALSE;
  p_VirtualEntity_46ccf5cdda36 := FALSE;
  p_TrackRecordChanges_46ccf5cdda36 := TRUE;
  p_AuditRecordAccess_46ccf5cdda36 := FALSE;
  p_AuditViewRuns_46ccf5cdda36 := FALSE;
  p_IncludeInAPI_46ccf5cdda36 := TRUE;
  p_AllowAllRowsAPI_46ccf5cdda36 := FALSE;
  p_AllowUpdateAPI_46ccf5cdda36 := TRUE;
  p_AllowCreateAPI_46ccf5cdda36 := TRUE;
  p_AllowDeleteAPI_46ccf5cdda36 := TRUE;
  p_CustomResolverAPI_46ccf5cdda36 := FALSE;
  p_AllowUserSearchAPI_46ccf5cdda36 := FALSE;
  p_FullTextSearchEnabled_46ccf5cdda36 := FALSE;
  p_FullTextCatalogGenerated_46ccf5cdda36 := TRUE;
  p_FullTextIndexGenerated_46ccf5cdda36 := TRUE;
  p_FullTextSearchFunctionGenerated_46ccf5cdda36 := TRUE;
  p_UserViewMaxRows_46ccf5cdda36 := 1000;
  p_spCreateGenerated_46ccf5cdda36 := TRUE;
  p_spUpdateGenerated_46ccf5cdda36 := TRUE;
  p_spDeleteGenerated_46ccf5cdda36 := TRUE;
  p_CascadeDeletes_46ccf5cdda36 := FALSE;
  p_DeleteType_46ccf5cdda36 := 'Hard';
  p_AllowRecordMerge_46ccf5cdda36 := FALSE;
  p_RelationshipDefaultDisplayType_46ccf5cdda36 := 'Search';
  p_UserFormGenerated_46ccf5cdda36 := TRUE;
  p_RowsToPackWithSchema_46ccf5cdda36 := 'None';
  p_RowsToPackSampleMethod_46ccf5cdda36 := 'random';
  p_RowsToPackSampleCount_46ccf5cdda36 := 0;
  p_Status_46ccf5cdda36 := 'Active';
  p_DisplayName_46ccf5cdda36 := 'Sales Contacts';
  p_AllowMultipleSubtypes_46ccf5cdda36 := FALSE;
  p_AutoUpdateFullTextSearch_46ccf5cdda36 := TRUE;
  p_AutoUpdateAllowUserSearchAPI_46ccf5cdda36 := FALSE;
  p_TrustServerCacheCompletely_46ccf5cdda36 := TRUE;
  p_SupportsGeoCoding_46ccf5cdda36 := FALSE;
  p_AutoUpdateSupportsGeoCoding_46ccf5cdda36 := TRUE;
  p_AllowCaching_46ccf5cdda36 := FALSE;
  p_DetectExternalChanges_46ccf5cdda36 := FALSE;
  p_GeneratedBaseViewName_46ccf5cdda36 := 'vwSalesContactsGenerated';
  p_AllowDirectSQLInsert_46ccf5cdda36 := FALSE;
  p_AllowDirectSQLUpdate_46ccf5cdda36 := FALSE;
  p_AllowDirectSQLDelete_46ccf5cdda36 := FALSE;
  p_Configuration_46ccf5cdda36 := '{
  "UI": {
    "Form": {
      "Layout": "accordion",
      "RelatedRolePolicy": "keep-all-primary"
    }
  }
}';
  p_EnableFieldLevelSecurity_46ccf5cdda36 := FALSE;
  p_ID_46ccf5cdda36 := '530174B2-654E-4E14-BF28-3EF29AC9833D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntity'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_46ccf5cdda36,
    'Name', p_Name_46ccf5cdda36,
    'NameSuffix', p_NameSuffix_46ccf5cdda36,
    'Description', p_Description_46ccf5cdda36,
    'AutoUpdateDescription', p_AutoUpdateDescription_46ccf5cdda36,
    'BaseView', p_BaseView_46ccf5cdda36,
    'BaseViewGenerated', p_BaseViewGenerated_46ccf5cdda36,
    'VirtualEntity', p_VirtualEntity_46ccf5cdda36,
    'TrackRecordChanges', p_TrackRecordChanges_46ccf5cdda36,
    'AuditRecordAccess', p_AuditRecordAccess_46ccf5cdda36,
    'AuditViewRuns', p_AuditViewRuns_46ccf5cdda36,
    'IncludeInAPI', p_IncludeInAPI_46ccf5cdda36,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_46ccf5cdda36,
    'AllowUpdateAPI', p_AllowUpdateAPI_46ccf5cdda36,
    'AllowCreateAPI', p_AllowCreateAPI_46ccf5cdda36,
    'AllowDeleteAPI', p_AllowDeleteAPI_46ccf5cdda36,
    'CustomResolverAPI', p_CustomResolverAPI_46ccf5cdda36,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_46ccf5cdda36,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_46ccf5cdda36,
    'FullTextCatalog', p_FullTextCatalog_46ccf5cdda36,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_46ccf5cdda36,
    'FullTextIndex', p_FullTextIndex_46ccf5cdda36,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_46ccf5cdda36,
    'FullTextSearchFunction', p_FullTextSearchFunction_46ccf5cdda36,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_46ccf5cdda36,
    'UserViewMaxRows', p_UserViewMaxRows_46ccf5cdda36,
    'spCreate', p_spCreate_46ccf5cdda36,
    'spUpdate', p_spUpdate_46ccf5cdda36,
    'spDelete', p_spDelete_46ccf5cdda36,
    'spCreateGenerated', p_spCreateGenerated_46ccf5cdda36,
    'spUpdateGenerated', p_spUpdateGenerated_46ccf5cdda36,
    'spDeleteGenerated', p_spDeleteGenerated_46ccf5cdda36,
    'CascadeDeletes', p_CascadeDeletes_46ccf5cdda36,
    'DeleteType', p_DeleteType_46ccf5cdda36,
    'AllowRecordMerge', p_AllowRecordMerge_46ccf5cdda36,
    'spMatch', p_spMatch_46ccf5cdda36,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_46ccf5cdda36,
    'UserFormGenerated', p_UserFormGenerated_46ccf5cdda36,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_46ccf5cdda36,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_46ccf5cdda36,
    'PreferredCommunicationField', p_PreferredCommunicationField_46ccf5cdda36,
    'Icon', p_Icon_46ccf5cdda36,
    'ScopeDefault', p_ScopeDefault_46ccf5cdda36,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_46ccf5cdda36,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_46ccf5cdda36,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_46ccf5cdda36,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_46ccf5cdda36,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_46ccf5cdda36,
    'RowCount', p_RowCount_46ccf5cdda36,
    'RowCountRunAt', p_RowCountRunAt_46ccf5cdda36
  ) ||
  jsonb_build_object(
    'Status', p_Status_46ccf5cdda36,
    'DisplayName', p_DisplayName_46ccf5cdda36,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_46ccf5cdda36,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_46ccf5cdda36,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_46ccf5cdda36,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_46ccf5cdda36,
    'SupportsGeoCoding', p_SupportsGeoCoding_46ccf5cdda36,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_46ccf5cdda36,
    'AllowCaching', p_AllowCaching_46ccf5cdda36,
    'DetectExternalChanges', p_DetectExternalChanges_46ccf5cdda36,
    'ExternalDataSourceID', p_ExternalDataSourceID_46ccf5cdda36,
    'ExternalObjectName', p_ExternalObjectName_46ccf5cdda36,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_46ccf5cdda36,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_46ccf5cdda36,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_46ccf5cdda36,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_46ccf5cdda36,
    'Configuration', p_Configuration_46ccf5cdda36,
    'SubtypeSelector', p_SubtypeSelector_46ccf5cdda36,
    'EnableFieldLevelSecurity', p_EnableFieldLevelSecurity_46ccf5cdda36,
    'ID', p_ID_46ccf5cdda36
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntity"(p_ParentID := p_ParentID_46ccf5cdda36, p_Name := p_Name_46ccf5cdda36, p_NameSuffix := p_NameSuffix_46ccf5cdda36, p_NameSuffix_Clear := TRUE, p_Description := p_Description_46ccf5cdda36, p_AutoUpdateDescription := p_AutoUpdateDescription_46ccf5cdda36, p_BaseView := p_BaseView_46ccf5cdda36, p_BaseViewGenerated := p_BaseViewGenerated_46ccf5cdda36, p_VirtualEntity := p_VirtualEntity_46ccf5cdda36, p_TrackRecordChanges := p_TrackRecordChanges_46ccf5cdda36, p_AuditRecordAccess := p_AuditRecordAccess_46ccf5cdda36, p_AuditViewRuns := p_AuditViewRuns_46ccf5cdda36, p_IncludeInAPI := p_IncludeInAPI_46ccf5cdda36, p_AllowAllRowsAPI := p_AllowAllRowsAPI_46ccf5cdda36, p_AllowUpdateAPI := p_AllowUpdateAPI_46ccf5cdda36, p_AllowCreateAPI := p_AllowCreateAPI_46ccf5cdda36, p_AllowDeleteAPI := p_AllowDeleteAPI_46ccf5cdda36, p_CustomResolverAPI := p_CustomResolverAPI_46ccf5cdda36, p_AllowUserSearchAPI := p_AllowUserSearchAPI_46ccf5cdda36, p_FullTextSearchEnabled := p_FullTextSearchEnabled_46ccf5cdda36, p_FullTextCatalog := p_FullTextCatalog_46ccf5cdda36, p_FullTextCatalog_Clear := TRUE, p_FullTextCatalogGenerated := p_FullTextCatalogGenerated_46ccf5cdda36, p_FullTextIndex := p_FullTextIndex_46ccf5cdda36, p_FullTextIndex_Clear := TRUE, p_FullTextIndexGenerated := p_FullTextIndexGenerated_46ccf5cdda36, p_FullTextSearchFunction := p_FullTextSearchFunction_46ccf5cdda36, p_FullTextSearchFunction_Clear := TRUE, p_FullTextSearchFunctionGenerated := p_FullTextSearchFunctionGenerated_46ccf5cdda36, p_UserViewMaxRows := p_UserViewMaxRows_46ccf5cdda36, p_spCreate := p_spCreate_46ccf5cdda36, p_spCreate_Clear := TRUE, p_spUpdate := p_spUpdate_46ccf5cdda36, p_spUpdate_Clear := TRUE, p_spDelete := p_spDelete_46ccf5cdda36, p_spDelete_Clear := TRUE, p_spCreateGenerated := p_spCreateGenerated_46ccf5cdda36, p_spUpdateGenerated := p_spUpdateGenerated_46ccf5cdda36, p_spDeleteGenerated := p_spDeleteGenerated_46ccf5cdda36, p_CascadeDeletes := p_CascadeDeletes_46ccf5cdda36, p_DeleteType := p_DeleteType_46ccf5cdda36, p_AllowRecordMerge := p_AllowRecordMerge_46ccf5cdda36, p_spMatch := p_spMatch_46ccf5cdda36, p_spMatch_Clear := TRUE, p_RelationshipDefaultDisplayType := p_RelationshipDefaultDisplayType_46ccf5cdda36, p_UserFormGenerated := p_UserFormGenerated_46ccf5cdda36, p_EntityObjectSubclassName := p_EntityObjectSubclassName_46ccf5cdda36, p_EntityObjectSubclassName_Clear := TRUE, p_EntityObjectSubclassImport := p_EntityObjectSubclassImport_46ccf5cdda36, p_EntityObjectSubclassImport_Clear := TRUE, p_PreferredCommunicationField := p_PreferredCommunicationField_46ccf5cdda36, p_PreferredCommunicationField_Clear := TRUE, p_Icon := p_Icon_46ccf5cdda36, p_Icon_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_46ccf5cdda36, p_ScopeDefault_Clear := TRUE, p_RowsToPackWithSchema := p_RowsToPackWithSchema_46ccf5cdda36, p_RowsToPackSampleMethod := p_RowsToPackSampleMethod_46ccf5cdda36, p_RowsToPackSampleCount := p_RowsToPackSampleCount_46ccf5cdda36, p_RowsToPackSampleOrder := p_RowsToPackSampleOrder_46ccf5cdda36, p_RowsToPackSampleOrder_Clear := TRUE, p_AutoRowCountFrequency := p_AutoRowCountFrequency_46ccf5cdda36, p_AutoRowCountFrequency_Clear := TRUE, p_RowCount := p_RowCount_46ccf5cdda36, p_RowCount_Clear := TRUE, p_RowCountRunAt := p_RowCountRunAt_46ccf5cdda36, p_RowCountRunAt_Clear := TRUE, p_Status := p_Status_46ccf5cdda36, p_DisplayName := p_DisplayName_46ccf5cdda36, p_AllowMultipleSubtypes := p_AllowMultipleSubtypes_46ccf5cdda36, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_46ccf5cdda36, p_AutoUpdateAllowUserSearchAPI := p_AutoUpdateAllowUserSearchAPI_46ccf5cdda36, p_TrustServerCacheCompletely := p_TrustServerCacheCompletely_46ccf5cdda36, p_SupportsGeoCoding := p_SupportsGeoCoding_46ccf5cdda36, p_AutoUpdateSupportsGeoCoding := p_AutoUpdateSupportsGeoCoding_46ccf5cdda36, p_AllowCaching := p_AllowCaching_46ccf5cdda36, p_DetectExternalChanges := p_DetectExternalChanges_46ccf5cdda36, p_ExternalDataSourceID := p_ExternalDataSourceID_46ccf5cdda36, p_ExternalDataSourceID_Clear := TRUE, p_ExternalObjectName := p_ExternalObjectName_46ccf5cdda36, p_ExternalObjectName_Clear := TRUE, p_GeneratedBaseViewName := p_GeneratedBaseViewName_46ccf5cdda36, p_AllowDirectSQLInsert := p_AllowDirectSQLInsert_46ccf5cdda36, p_AllowDirectSQLUpdate := p_AllowDirectSQLUpdate_46ccf5cdda36, p_AllowDirectSQLDelete := p_AllowDirectSQLDelete_46ccf5cdda36, p_Configuration := p_Configuration_46ccf5cdda36, p_SubtypeSelector := p_SubtypeSelector_46ccf5cdda36, p_SubtypeSelector_Clear := TRUE, p_EnableFieldLevelSecurity := p_EnableFieldLevelSecurity_46ccf5cdda36, p_ID := p_ID_46ccf5cdda36);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_5e1396ac8a29 VARCHAR(255);
  p_Description_5e1396ac8a29 TEXT;
  p_AutoUpdateDescription_5e1396ac8a29 BOOLEAN;
  p_IsPrimaryKey_5e1396ac8a29 BOOLEAN;
  p_IsUnique_5e1396ac8a29 BOOLEAN;
  p_Category_5e1396ac8a29 VARCHAR(255);
  p_ValueListType_5e1396ac8a29 VARCHAR(20);
  p_ExtendedType_5e1396ac8a29 VARCHAR(50);
  p_CodeType_5e1396ac8a29 VARCHAR(50);
  p_DefaultInView_5e1396ac8a29 BOOLEAN;
  p_ViewCellTemplate_5e1396ac8a29 TEXT;
  p_DefaultColumnWidth_5e1396ac8a29 INTEGER;
  p_AllowUpdateAPI_5e1396ac8a29 BOOLEAN;
  p_AllowUpdateInView_5e1396ac8a29 BOOLEAN;
  p_IncludeInUserSearchAPI_5e1396ac8a29 BOOLEAN;
  p_FullTextSearchEnabled_5e1396ac8a29 BOOLEAN;
  p_UserSearchParamFormatAPI_5e1396ac8a29 VARCHAR(500);
  p_IncludeInGeneratedForm_5e1396ac8a29 BOOLEAN;
  p_GeneratedFormSection_5e1396ac8a29 VARCHAR(10);
  p_IsNameField_5e1396ac8a29 BOOLEAN;
  p_RelatedEntityID_5e1396ac8a29 UUID;
  p_RelatedEntityFieldName_5e1396ac8a29 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_5e1396ac8a29 BOOLEAN;
  p_RelatedEntityNameFieldMap_5e1396ac8a29 VARCHAR(255);
  p_RelatedEntityDisplayType_5e1396ac8a29 VARCHAR(20);
  p_EntityIDFieldName_5e1396ac8a29 VARCHAR(100);
  p_ScopeDefault_5e1396ac8a29 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_5e1396ac8a29 BOOLEAN;
  p_ValuesToPackWithSchema_5e1396ac8a29 VARCHAR(10);
  p_Status_5e1396ac8a29 VARCHAR(25);
  p_AutoUpdateIsNameField_5e1396ac8a29 BOOLEAN;
  p_AutoUpdateDefaultInView_5e1396ac8a29 BOOLEAN;
  p_AutoUpdateCategory_5e1396ac8a29 BOOLEAN;
  p_AutoUpdateDisplayName_5e1396ac8a29 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_5e1396ac8a29 BOOLEAN;
  p_Encrypt_5e1396ac8a29 BOOLEAN;
  p_EncryptionKeyID_5e1396ac8a29 UUID;
  p_AllowDecryptInAPI_5e1396ac8a29 BOOLEAN;
  p_SendEncryptedValue_5e1396ac8a29 BOOLEAN;
  p_IsSoftPrimaryKey_5e1396ac8a29 BOOLEAN;
  p_IsSoftForeignKey_5e1396ac8a29 BOOLEAN;
  p_RelatedEntityJoinFields_5e1396ac8a29 TEXT;
  p_JSONType_5e1396ac8a29 VARCHAR(255);
  p_JSONTypeIsArray_5e1396ac8a29 BOOLEAN;
  p_JSONTypeDefinition_5e1396ac8a29 TEXT;
  p_UserSearchPredicateAPI_5e1396ac8a29 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_5e1396ac8a29 BOOLEAN;
  p_AutoUpdateFullTextSearch_5e1396ac8a29 BOOLEAN;
  p_AutoUpdateExtendedType_5e1396ac8a29 BOOLEAN;
  p_IsComputed_5e1396ac8a29 BOOLEAN;
  p_EmbeddedRecord_5e1396ac8a29 TEXT;
  p_Configuration_5e1396ac8a29 TEXT;
  p_ID_5e1396ac8a29 UUID;
BEGIN
  p_DisplayName_5e1396ac8a29 := 'Name';
  p_AutoUpdateDescription_5e1396ac8a29 := TRUE;
  p_IsPrimaryKey_5e1396ac8a29 := FALSE;
  p_IsUnique_5e1396ac8a29 := FALSE;
  p_ValueListType_5e1396ac8a29 := 'None';
  p_DefaultInView_5e1396ac8a29 := TRUE;
  p_DefaultColumnWidth_5e1396ac8a29 := 150;
  p_AllowUpdateAPI_5e1396ac8a29 := TRUE;
  p_AllowUpdateInView_5e1396ac8a29 := TRUE;
  p_IncludeInUserSearchAPI_5e1396ac8a29 := TRUE;
  p_FullTextSearchEnabled_5e1396ac8a29 := FALSE;
  p_IncludeInGeneratedForm_5e1396ac8a29 := TRUE;
  p_GeneratedFormSection_5e1396ac8a29 := 'Details';
  p_IsNameField_5e1396ac8a29 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_5e1396ac8a29 := FALSE;
  p_RelatedEntityDisplayType_5e1396ac8a29 := 'Search';
  p_AutoUpdateRelatedEntityInfo_5e1396ac8a29 := TRUE;
  p_ValuesToPackWithSchema_5e1396ac8a29 := 'Auto';
  p_Status_5e1396ac8a29 := 'Active';
  p_AutoUpdateIsNameField_5e1396ac8a29 := TRUE;
  p_AutoUpdateDefaultInView_5e1396ac8a29 := TRUE;
  p_AutoUpdateCategory_5e1396ac8a29 := TRUE;
  p_AutoUpdateDisplayName_5e1396ac8a29 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_5e1396ac8a29 := FALSE;
  p_Encrypt_5e1396ac8a29 := FALSE;
  p_AllowDecryptInAPI_5e1396ac8a29 := FALSE;
  p_SendEncryptedValue_5e1396ac8a29 := FALSE;
  p_IsSoftPrimaryKey_5e1396ac8a29 := FALSE;
  p_IsSoftForeignKey_5e1396ac8a29 := FALSE;
  p_JSONTypeIsArray_5e1396ac8a29 := FALSE;
  p_UserSearchPredicateAPI_5e1396ac8a29 := 'BeginsWith';
  p_AutoUpdateUserSearchPredicate_5e1396ac8a29 := TRUE;
  p_AutoUpdateFullTextSearch_5e1396ac8a29 := TRUE;
  p_AutoUpdateExtendedType_5e1396ac8a29 := TRUE;
  p_IsComputed_5e1396ac8a29 := FALSE;
  p_ID_5e1396ac8a29 := '8C17A9F4-85C7-470D-96CC-E9A3D1168A6D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_5e1396ac8a29,
    'Description', p_Description_5e1396ac8a29,
    'AutoUpdateDescription', p_AutoUpdateDescription_5e1396ac8a29,
    'IsPrimaryKey', p_IsPrimaryKey_5e1396ac8a29,
    'IsUnique', p_IsUnique_5e1396ac8a29,
    'Category', p_Category_5e1396ac8a29,
    'ValueListType', p_ValueListType_5e1396ac8a29,
    'ExtendedType', p_ExtendedType_5e1396ac8a29,
    'CodeType', p_CodeType_5e1396ac8a29,
    'DefaultInView', p_DefaultInView_5e1396ac8a29,
    'ViewCellTemplate', p_ViewCellTemplate_5e1396ac8a29,
    'DefaultColumnWidth', p_DefaultColumnWidth_5e1396ac8a29,
    'AllowUpdateAPI', p_AllowUpdateAPI_5e1396ac8a29,
    'AllowUpdateInView', p_AllowUpdateInView_5e1396ac8a29,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_5e1396ac8a29,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_5e1396ac8a29,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_5e1396ac8a29,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_5e1396ac8a29,
    'GeneratedFormSection', p_GeneratedFormSection_5e1396ac8a29,
    'IsNameField', p_IsNameField_5e1396ac8a29,
    'RelatedEntityID', p_RelatedEntityID_5e1396ac8a29,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_5e1396ac8a29,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_5e1396ac8a29,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_5e1396ac8a29,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_5e1396ac8a29,
    'EntityIDFieldName', p_EntityIDFieldName_5e1396ac8a29,
    'ScopeDefault', p_ScopeDefault_5e1396ac8a29,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_5e1396ac8a29,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_5e1396ac8a29,
    'Status', p_Status_5e1396ac8a29,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_5e1396ac8a29,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_5e1396ac8a29,
    'AutoUpdateCategory', p_AutoUpdateCategory_5e1396ac8a29,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_5e1396ac8a29,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_5e1396ac8a29,
    'Encrypt', p_Encrypt_5e1396ac8a29,
    'EncryptionKeyID', p_EncryptionKeyID_5e1396ac8a29,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_5e1396ac8a29,
    'SendEncryptedValue', p_SendEncryptedValue_5e1396ac8a29,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_5e1396ac8a29,
    'IsSoftForeignKey', p_IsSoftForeignKey_5e1396ac8a29,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_5e1396ac8a29,
    'JSONType', p_JSONType_5e1396ac8a29,
    'JSONTypeIsArray', p_JSONTypeIsArray_5e1396ac8a29,
    'JSONTypeDefinition', p_JSONTypeDefinition_5e1396ac8a29,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_5e1396ac8a29,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_5e1396ac8a29,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_5e1396ac8a29,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_5e1396ac8a29,
    'IsComputed', p_IsComputed_5e1396ac8a29
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_5e1396ac8a29,
    'Configuration', p_Configuration_5e1396ac8a29,
    'ID', p_ID_5e1396ac8a29
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_5e1396ac8a29, p_Description := p_Description_5e1396ac8a29, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_5e1396ac8a29, p_IsPrimaryKey := p_IsPrimaryKey_5e1396ac8a29, p_IsUnique := p_IsUnique_5e1396ac8a29, p_Category := p_Category_5e1396ac8a29, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_5e1396ac8a29, p_ExtendedType := p_ExtendedType_5e1396ac8a29, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_5e1396ac8a29, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_5e1396ac8a29, p_ViewCellTemplate := p_ViewCellTemplate_5e1396ac8a29, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_5e1396ac8a29, p_AllowUpdateAPI := p_AllowUpdateAPI_5e1396ac8a29, p_AllowUpdateInView := p_AllowUpdateInView_5e1396ac8a29, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_5e1396ac8a29, p_FullTextSearchEnabled := p_FullTextSearchEnabled_5e1396ac8a29, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_5e1396ac8a29, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_5e1396ac8a29, p_GeneratedFormSection := p_GeneratedFormSection_5e1396ac8a29, p_IsNameField := p_IsNameField_5e1396ac8a29, p_RelatedEntityID := p_RelatedEntityID_5e1396ac8a29, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_5e1396ac8a29, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_5e1396ac8a29, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_5e1396ac8a29, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_5e1396ac8a29, p_EntityIDFieldName := p_EntityIDFieldName_5e1396ac8a29, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_5e1396ac8a29, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_5e1396ac8a29, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_5e1396ac8a29, p_Status := p_Status_5e1396ac8a29, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_5e1396ac8a29, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_5e1396ac8a29, p_AutoUpdateCategory := p_AutoUpdateCategory_5e1396ac8a29, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_5e1396ac8a29, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_5e1396ac8a29, p_Encrypt := p_Encrypt_5e1396ac8a29, p_EncryptionKeyID := p_EncryptionKeyID_5e1396ac8a29, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_5e1396ac8a29, p_SendEncryptedValue := p_SendEncryptedValue_5e1396ac8a29, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_5e1396ac8a29, p_IsSoftForeignKey := p_IsSoftForeignKey_5e1396ac8a29, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_5e1396ac8a29, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_5e1396ac8a29, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_5e1396ac8a29, p_JSONTypeDefinition := p_JSONTypeDefinition_5e1396ac8a29, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_5e1396ac8a29, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_5e1396ac8a29, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_5e1396ac8a29, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_5e1396ac8a29, p_IsComputed := p_IsComputed_5e1396ac8a29, p_EmbeddedRecord := p_EmbeddedRecord_5e1396ac8a29, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_5e1396ac8a29, p_Configuration_Clear := TRUE, p_ID := p_ID_5e1396ac8a29);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e4675bca08e8 VARCHAR(255);
  p_Description_e4675bca08e8 TEXT;
  p_AutoUpdateDescription_e4675bca08e8 BOOLEAN;
  p_IsPrimaryKey_e4675bca08e8 BOOLEAN;
  p_IsUnique_e4675bca08e8 BOOLEAN;
  p_Category_e4675bca08e8 VARCHAR(255);
  p_ValueListType_e4675bca08e8 VARCHAR(20);
  p_ExtendedType_e4675bca08e8 VARCHAR(50);
  p_CodeType_e4675bca08e8 VARCHAR(50);
  p_DefaultInView_e4675bca08e8 BOOLEAN;
  p_ViewCellTemplate_e4675bca08e8 TEXT;
  p_DefaultColumnWidth_e4675bca08e8 INTEGER;
  p_AllowUpdateAPI_e4675bca08e8 BOOLEAN;
  p_AllowUpdateInView_e4675bca08e8 BOOLEAN;
  p_IncludeInUserSearchAPI_e4675bca08e8 BOOLEAN;
  p_FullTextSearchEnabled_e4675bca08e8 BOOLEAN;
  p_UserSearchParamFormatAPI_e4675bca08e8 VARCHAR(500);
  p_IncludeInGeneratedForm_e4675bca08e8 BOOLEAN;
  p_GeneratedFormSection_e4675bca08e8 VARCHAR(10);
  p_IsNameField_e4675bca08e8 BOOLEAN;
  p_RelatedEntityID_e4675bca08e8 UUID;
  p_RelatedEntityFieldName_e4675bca08e8 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e4675bca08e8 BOOLEAN;
  p_RelatedEntityNameFieldMap_e4675bca08e8 VARCHAR(255);
  p_RelatedEntityDisplayType_e4675bca08e8 VARCHAR(20);
  p_EntityIDFieldName_e4675bca08e8 VARCHAR(100);
  p_ScopeDefault_e4675bca08e8 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e4675bca08e8 BOOLEAN;
  p_ValuesToPackWithSchema_e4675bca08e8 VARCHAR(10);
  p_Status_e4675bca08e8 VARCHAR(25);
  p_AutoUpdateIsNameField_e4675bca08e8 BOOLEAN;
  p_AutoUpdateDefaultInView_e4675bca08e8 BOOLEAN;
  p_AutoUpdateCategory_e4675bca08e8 BOOLEAN;
  p_AutoUpdateDisplayName_e4675bca08e8 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e4675bca08e8 BOOLEAN;
  p_Encrypt_e4675bca08e8 BOOLEAN;
  p_EncryptionKeyID_e4675bca08e8 UUID;
  p_AllowDecryptInAPI_e4675bca08e8 BOOLEAN;
  p_SendEncryptedValue_e4675bca08e8 BOOLEAN;
  p_IsSoftPrimaryKey_e4675bca08e8 BOOLEAN;
  p_IsSoftForeignKey_e4675bca08e8 BOOLEAN;
  p_RelatedEntityJoinFields_e4675bca08e8 TEXT;
  p_JSONType_e4675bca08e8 VARCHAR(255);
  p_JSONTypeIsArray_e4675bca08e8 BOOLEAN;
  p_JSONTypeDefinition_e4675bca08e8 TEXT;
  p_UserSearchPredicateAPI_e4675bca08e8 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e4675bca08e8 BOOLEAN;
  p_AutoUpdateFullTextSearch_e4675bca08e8 BOOLEAN;
  p_AutoUpdateExtendedType_e4675bca08e8 BOOLEAN;
  p_IsComputed_e4675bca08e8 BOOLEAN;
  p_EmbeddedRecord_e4675bca08e8 TEXT;
  p_Configuration_e4675bca08e8 TEXT;
  p_ID_e4675bca08e8 UUID;
BEGIN
  p_DisplayName_e4675bca08e8 := 'ID';
  p_AutoUpdateDescription_e4675bca08e8 := TRUE;
  p_IsPrimaryKey_e4675bca08e8 := TRUE;
  p_IsUnique_e4675bca08e8 := TRUE;
  p_ValueListType_e4675bca08e8 := 'None';
  p_DefaultInView_e4675bca08e8 := FALSE;
  p_DefaultColumnWidth_e4675bca08e8 := 150;
  p_AllowUpdateAPI_e4675bca08e8 := FALSE;
  p_AllowUpdateInView_e4675bca08e8 := TRUE;
  p_IncludeInUserSearchAPI_e4675bca08e8 := FALSE;
  p_FullTextSearchEnabled_e4675bca08e8 := FALSE;
  p_IncludeInGeneratedForm_e4675bca08e8 := TRUE;
  p_GeneratedFormSection_e4675bca08e8 := 'Details';
  p_IsNameField_e4675bca08e8 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_e4675bca08e8 := FALSE;
  p_RelatedEntityDisplayType_e4675bca08e8 := 'Search';
  p_AutoUpdateRelatedEntityInfo_e4675bca08e8 := TRUE;
  p_ValuesToPackWithSchema_e4675bca08e8 := 'Auto';
  p_Status_e4675bca08e8 := 'Active';
  p_AutoUpdateIsNameField_e4675bca08e8 := TRUE;
  p_AutoUpdateDefaultInView_e4675bca08e8 := TRUE;
  p_AutoUpdateCategory_e4675bca08e8 := TRUE;
  p_AutoUpdateDisplayName_e4675bca08e8 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_e4675bca08e8 := FALSE;
  p_Encrypt_e4675bca08e8 := FALSE;
  p_AllowDecryptInAPI_e4675bca08e8 := FALSE;
  p_SendEncryptedValue_e4675bca08e8 := FALSE;
  p_IsSoftPrimaryKey_e4675bca08e8 := FALSE;
  p_IsSoftForeignKey_e4675bca08e8 := FALSE;
  p_JSONTypeIsArray_e4675bca08e8 := FALSE;
  p_UserSearchPredicateAPI_e4675bca08e8 := 'Contains';
  p_AutoUpdateUserSearchPredicate_e4675bca08e8 := TRUE;
  p_AutoUpdateFullTextSearch_e4675bca08e8 := TRUE;
  p_AutoUpdateExtendedType_e4675bca08e8 := TRUE;
  p_IsComputed_e4675bca08e8 := FALSE;
  p_ID_e4675bca08e8 := '04B57698-4FBA-49BE-9B6C-197B73AA515F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e4675bca08e8,
    'Description', p_Description_e4675bca08e8,
    'AutoUpdateDescription', p_AutoUpdateDescription_e4675bca08e8,
    'IsPrimaryKey', p_IsPrimaryKey_e4675bca08e8,
    'IsUnique', p_IsUnique_e4675bca08e8,
    'Category', p_Category_e4675bca08e8,
    'ValueListType', p_ValueListType_e4675bca08e8,
    'ExtendedType', p_ExtendedType_e4675bca08e8,
    'CodeType', p_CodeType_e4675bca08e8,
    'DefaultInView', p_DefaultInView_e4675bca08e8,
    'ViewCellTemplate', p_ViewCellTemplate_e4675bca08e8,
    'DefaultColumnWidth', p_DefaultColumnWidth_e4675bca08e8,
    'AllowUpdateAPI', p_AllowUpdateAPI_e4675bca08e8,
    'AllowUpdateInView', p_AllowUpdateInView_e4675bca08e8,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e4675bca08e8,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e4675bca08e8,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e4675bca08e8,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e4675bca08e8,
    'GeneratedFormSection', p_GeneratedFormSection_e4675bca08e8,
    'IsNameField', p_IsNameField_e4675bca08e8,
    'RelatedEntityID', p_RelatedEntityID_e4675bca08e8,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e4675bca08e8,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e4675bca08e8,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e4675bca08e8,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e4675bca08e8,
    'EntityIDFieldName', p_EntityIDFieldName_e4675bca08e8,
    'ScopeDefault', p_ScopeDefault_e4675bca08e8,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e4675bca08e8,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e4675bca08e8,
    'Status', p_Status_e4675bca08e8,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e4675bca08e8,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e4675bca08e8,
    'AutoUpdateCategory', p_AutoUpdateCategory_e4675bca08e8,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e4675bca08e8,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e4675bca08e8,
    'Encrypt', p_Encrypt_e4675bca08e8,
    'EncryptionKeyID', p_EncryptionKeyID_e4675bca08e8,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e4675bca08e8,
    'SendEncryptedValue', p_SendEncryptedValue_e4675bca08e8,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e4675bca08e8,
    'IsSoftForeignKey', p_IsSoftForeignKey_e4675bca08e8,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e4675bca08e8,
    'JSONType', p_JSONType_e4675bca08e8,
    'JSONTypeIsArray', p_JSONTypeIsArray_e4675bca08e8,
    'JSONTypeDefinition', p_JSONTypeDefinition_e4675bca08e8,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e4675bca08e8,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e4675bca08e8,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e4675bca08e8,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e4675bca08e8,
    'IsComputed', p_IsComputed_e4675bca08e8
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e4675bca08e8,
    'Configuration', p_Configuration_e4675bca08e8,
    'ID', p_ID_e4675bca08e8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_e4675bca08e8, p_Description := p_Description_e4675bca08e8, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e4675bca08e8, p_IsPrimaryKey := p_IsPrimaryKey_e4675bca08e8, p_IsUnique := p_IsUnique_e4675bca08e8, p_Category := p_Category_e4675bca08e8, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_e4675bca08e8, p_ExtendedType := p_ExtendedType_e4675bca08e8, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e4675bca08e8, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e4675bca08e8, p_ViewCellTemplate := p_ViewCellTemplate_e4675bca08e8, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e4675bca08e8, p_AllowUpdateAPI := p_AllowUpdateAPI_e4675bca08e8, p_AllowUpdateInView := p_AllowUpdateInView_e4675bca08e8, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e4675bca08e8, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e4675bca08e8, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e4675bca08e8, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e4675bca08e8, p_GeneratedFormSection := p_GeneratedFormSection_e4675bca08e8, p_IsNameField := p_IsNameField_e4675bca08e8, p_RelatedEntityID := p_RelatedEntityID_e4675bca08e8, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e4675bca08e8, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e4675bca08e8, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e4675bca08e8, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e4675bca08e8, p_EntityIDFieldName := p_EntityIDFieldName_e4675bca08e8, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e4675bca08e8, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e4675bca08e8, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e4675bca08e8, p_Status := p_Status_e4675bca08e8, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e4675bca08e8, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e4675bca08e8, p_AutoUpdateCategory := p_AutoUpdateCategory_e4675bca08e8, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e4675bca08e8, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e4675bca08e8, p_Encrypt := p_Encrypt_e4675bca08e8, p_EncryptionKeyID := p_EncryptionKeyID_e4675bca08e8, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e4675bca08e8, p_SendEncryptedValue := p_SendEncryptedValue_e4675bca08e8, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e4675bca08e8, p_IsSoftForeignKey := p_IsSoftForeignKey_e4675bca08e8, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e4675bca08e8, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e4675bca08e8, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e4675bca08e8, p_JSONTypeDefinition := p_JSONTypeDefinition_e4675bca08e8, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e4675bca08e8, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e4675bca08e8, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e4675bca08e8, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e4675bca08e8, p_IsComputed := p_IsComputed_e4675bca08e8, p_EmbeddedRecord := p_EmbeddedRecord_e4675bca08e8, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e4675bca08e8, p_Configuration_Clear := TRUE, p_ID := p_ID_e4675bca08e8);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7b8b36a25695 VARCHAR(255);
  p_Description_7b8b36a25695 TEXT;
  p_AutoUpdateDescription_7b8b36a25695 BOOLEAN;
  p_IsPrimaryKey_7b8b36a25695 BOOLEAN;
  p_IsUnique_7b8b36a25695 BOOLEAN;
  p_Category_7b8b36a25695 VARCHAR(255);
  p_ValueListType_7b8b36a25695 VARCHAR(20);
  p_ExtendedType_7b8b36a25695 VARCHAR(50);
  p_CodeType_7b8b36a25695 VARCHAR(50);
  p_DefaultInView_7b8b36a25695 BOOLEAN;
  p_ViewCellTemplate_7b8b36a25695 TEXT;
  p_DefaultColumnWidth_7b8b36a25695 INTEGER;
  p_AllowUpdateAPI_7b8b36a25695 BOOLEAN;
  p_AllowUpdateInView_7b8b36a25695 BOOLEAN;
  p_IncludeInUserSearchAPI_7b8b36a25695 BOOLEAN;
  p_FullTextSearchEnabled_7b8b36a25695 BOOLEAN;
  p_UserSearchParamFormatAPI_7b8b36a25695 VARCHAR(500);
  p_IncludeInGeneratedForm_7b8b36a25695 BOOLEAN;
  p_GeneratedFormSection_7b8b36a25695 VARCHAR(10);
  p_IsNameField_7b8b36a25695 BOOLEAN;
  p_RelatedEntityID_7b8b36a25695 UUID;
  p_RelatedEntityFieldName_7b8b36a25695 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7b8b36a25695 BOOLEAN;
  p_RelatedEntityNameFieldMap_7b8b36a25695 VARCHAR(255);
  p_RelatedEntityDisplayType_7b8b36a25695 VARCHAR(20);
  p_EntityIDFieldName_7b8b36a25695 VARCHAR(100);
  p_ScopeDefault_7b8b36a25695 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7b8b36a25695 BOOLEAN;
  p_ValuesToPackWithSchema_7b8b36a25695 VARCHAR(10);
  p_Status_7b8b36a25695 VARCHAR(25);
  p_AutoUpdateIsNameField_7b8b36a25695 BOOLEAN;
  p_AutoUpdateDefaultInView_7b8b36a25695 BOOLEAN;
  p_AutoUpdateCategory_7b8b36a25695 BOOLEAN;
  p_AutoUpdateDisplayName_7b8b36a25695 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7b8b36a25695 BOOLEAN;
  p_Encrypt_7b8b36a25695 BOOLEAN;
  p_EncryptionKeyID_7b8b36a25695 UUID;
  p_AllowDecryptInAPI_7b8b36a25695 BOOLEAN;
  p_SendEncryptedValue_7b8b36a25695 BOOLEAN;
  p_IsSoftPrimaryKey_7b8b36a25695 BOOLEAN;
  p_IsSoftForeignKey_7b8b36a25695 BOOLEAN;
  p_RelatedEntityJoinFields_7b8b36a25695 TEXT;
  p_JSONType_7b8b36a25695 VARCHAR(255);
  p_JSONTypeIsArray_7b8b36a25695 BOOLEAN;
  p_JSONTypeDefinition_7b8b36a25695 TEXT;
  p_UserSearchPredicateAPI_7b8b36a25695 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7b8b36a25695 BOOLEAN;
  p_AutoUpdateFullTextSearch_7b8b36a25695 BOOLEAN;
  p_AutoUpdateExtendedType_7b8b36a25695 BOOLEAN;
  p_IsComputed_7b8b36a25695 BOOLEAN;
  p_EmbeddedRecord_7b8b36a25695 TEXT;
  p_Configuration_7b8b36a25695 TEXT;
  p_ID_7b8b36a25695 UUID;
BEGIN
  p_DisplayName_7b8b36a25695 := 'Name';
  p_AutoUpdateDescription_7b8b36a25695 := TRUE;
  p_IsPrimaryKey_7b8b36a25695 := FALSE;
  p_IsUnique_7b8b36a25695 := FALSE;
  p_ValueListType_7b8b36a25695 := 'None';
  p_DefaultInView_7b8b36a25695 := TRUE;
  p_DefaultColumnWidth_7b8b36a25695 := 150;
  p_AllowUpdateAPI_7b8b36a25695 := TRUE;
  p_AllowUpdateInView_7b8b36a25695 := TRUE;
  p_IncludeInUserSearchAPI_7b8b36a25695 := TRUE;
  p_FullTextSearchEnabled_7b8b36a25695 := FALSE;
  p_IncludeInGeneratedForm_7b8b36a25695 := TRUE;
  p_GeneratedFormSection_7b8b36a25695 := 'Details';
  p_IsNameField_7b8b36a25695 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_7b8b36a25695 := FALSE;
  p_RelatedEntityDisplayType_7b8b36a25695 := 'Search';
  p_AutoUpdateRelatedEntityInfo_7b8b36a25695 := TRUE;
  p_ValuesToPackWithSchema_7b8b36a25695 := 'Auto';
  p_Status_7b8b36a25695 := 'Active';
  p_AutoUpdateIsNameField_7b8b36a25695 := TRUE;
  p_AutoUpdateDefaultInView_7b8b36a25695 := TRUE;
  p_AutoUpdateCategory_7b8b36a25695 := TRUE;
  p_AutoUpdateDisplayName_7b8b36a25695 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_7b8b36a25695 := FALSE;
  p_Encrypt_7b8b36a25695 := FALSE;
  p_AllowDecryptInAPI_7b8b36a25695 := FALSE;
  p_SendEncryptedValue_7b8b36a25695 := FALSE;
  p_IsSoftPrimaryKey_7b8b36a25695 := FALSE;
  p_IsSoftForeignKey_7b8b36a25695 := FALSE;
  p_JSONTypeIsArray_7b8b36a25695 := FALSE;
  p_UserSearchPredicateAPI_7b8b36a25695 := 'BeginsWith';
  p_AutoUpdateUserSearchPredicate_7b8b36a25695 := TRUE;
  p_AutoUpdateFullTextSearch_7b8b36a25695 := TRUE;
  p_AutoUpdateExtendedType_7b8b36a25695 := TRUE;
  p_IsComputed_7b8b36a25695 := FALSE;
  p_ID_7b8b36a25695 := 'DB9388D1-3519-4120-9BF9-4BCB0309C7A5';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7b8b36a25695,
    'Description', p_Description_7b8b36a25695,
    'AutoUpdateDescription', p_AutoUpdateDescription_7b8b36a25695,
    'IsPrimaryKey', p_IsPrimaryKey_7b8b36a25695,
    'IsUnique', p_IsUnique_7b8b36a25695,
    'Category', p_Category_7b8b36a25695,
    'ValueListType', p_ValueListType_7b8b36a25695,
    'ExtendedType', p_ExtendedType_7b8b36a25695,
    'CodeType', p_CodeType_7b8b36a25695,
    'DefaultInView', p_DefaultInView_7b8b36a25695,
    'ViewCellTemplate', p_ViewCellTemplate_7b8b36a25695,
    'DefaultColumnWidth', p_DefaultColumnWidth_7b8b36a25695,
    'AllowUpdateAPI', p_AllowUpdateAPI_7b8b36a25695,
    'AllowUpdateInView', p_AllowUpdateInView_7b8b36a25695,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7b8b36a25695,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7b8b36a25695,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7b8b36a25695,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7b8b36a25695,
    'GeneratedFormSection', p_GeneratedFormSection_7b8b36a25695,
    'IsNameField', p_IsNameField_7b8b36a25695,
    'RelatedEntityID', p_RelatedEntityID_7b8b36a25695,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7b8b36a25695,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7b8b36a25695,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7b8b36a25695,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7b8b36a25695,
    'EntityIDFieldName', p_EntityIDFieldName_7b8b36a25695,
    'ScopeDefault', p_ScopeDefault_7b8b36a25695,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7b8b36a25695,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7b8b36a25695,
    'Status', p_Status_7b8b36a25695,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7b8b36a25695,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7b8b36a25695,
    'AutoUpdateCategory', p_AutoUpdateCategory_7b8b36a25695,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7b8b36a25695,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7b8b36a25695,
    'Encrypt', p_Encrypt_7b8b36a25695,
    'EncryptionKeyID', p_EncryptionKeyID_7b8b36a25695,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7b8b36a25695,
    'SendEncryptedValue', p_SendEncryptedValue_7b8b36a25695,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7b8b36a25695,
    'IsSoftForeignKey', p_IsSoftForeignKey_7b8b36a25695,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7b8b36a25695,
    'JSONType', p_JSONType_7b8b36a25695,
    'JSONTypeIsArray', p_JSONTypeIsArray_7b8b36a25695,
    'JSONTypeDefinition', p_JSONTypeDefinition_7b8b36a25695,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7b8b36a25695,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7b8b36a25695,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7b8b36a25695,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7b8b36a25695,
    'IsComputed', p_IsComputed_7b8b36a25695
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7b8b36a25695,
    'Configuration', p_Configuration_7b8b36a25695,
    'ID', p_ID_7b8b36a25695
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_7b8b36a25695, p_Description := p_Description_7b8b36a25695, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_7b8b36a25695, p_IsPrimaryKey := p_IsPrimaryKey_7b8b36a25695, p_IsUnique := p_IsUnique_7b8b36a25695, p_Category := p_Category_7b8b36a25695, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_7b8b36a25695, p_ExtendedType := p_ExtendedType_7b8b36a25695, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7b8b36a25695, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7b8b36a25695, p_ViewCellTemplate := p_ViewCellTemplate_7b8b36a25695, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7b8b36a25695, p_AllowUpdateAPI := p_AllowUpdateAPI_7b8b36a25695, p_AllowUpdateInView := p_AllowUpdateInView_7b8b36a25695, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7b8b36a25695, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7b8b36a25695, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7b8b36a25695, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7b8b36a25695, p_GeneratedFormSection := p_GeneratedFormSection_7b8b36a25695, p_IsNameField := p_IsNameField_7b8b36a25695, p_RelatedEntityID := p_RelatedEntityID_7b8b36a25695, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7b8b36a25695, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7b8b36a25695, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7b8b36a25695, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7b8b36a25695, p_EntityIDFieldName := p_EntityIDFieldName_7b8b36a25695, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7b8b36a25695, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7b8b36a25695, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7b8b36a25695, p_Status := p_Status_7b8b36a25695, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7b8b36a25695, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7b8b36a25695, p_AutoUpdateCategory := p_AutoUpdateCategory_7b8b36a25695, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7b8b36a25695, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7b8b36a25695, p_Encrypt := p_Encrypt_7b8b36a25695, p_EncryptionKeyID := p_EncryptionKeyID_7b8b36a25695, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7b8b36a25695, p_SendEncryptedValue := p_SendEncryptedValue_7b8b36a25695, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7b8b36a25695, p_IsSoftForeignKey := p_IsSoftForeignKey_7b8b36a25695, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7b8b36a25695, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7b8b36a25695, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7b8b36a25695, p_JSONTypeDefinition := p_JSONTypeDefinition_7b8b36a25695, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7b8b36a25695, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7b8b36a25695, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7b8b36a25695, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7b8b36a25695, p_IsComputed := p_IsComputed_7b8b36a25695, p_EmbeddedRecord := p_EmbeddedRecord_7b8b36a25695, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7b8b36a25695, p_Configuration_Clear := TRUE, p_ID := p_ID_7b8b36a25695);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_b958d1b9981a VARCHAR(255);
  p_Description_b958d1b9981a TEXT;
  p_AutoUpdateDescription_b958d1b9981a BOOLEAN;
  p_IsPrimaryKey_b958d1b9981a BOOLEAN;
  p_IsUnique_b958d1b9981a BOOLEAN;
  p_Category_b958d1b9981a VARCHAR(255);
  p_ValueListType_b958d1b9981a VARCHAR(20);
  p_ExtendedType_b958d1b9981a VARCHAR(50);
  p_CodeType_b958d1b9981a VARCHAR(50);
  p_DefaultInView_b958d1b9981a BOOLEAN;
  p_ViewCellTemplate_b958d1b9981a TEXT;
  p_DefaultColumnWidth_b958d1b9981a INTEGER;
  p_AllowUpdateAPI_b958d1b9981a BOOLEAN;
  p_AllowUpdateInView_b958d1b9981a BOOLEAN;
  p_IncludeInUserSearchAPI_b958d1b9981a BOOLEAN;
  p_FullTextSearchEnabled_b958d1b9981a BOOLEAN;
  p_UserSearchParamFormatAPI_b958d1b9981a VARCHAR(500);
  p_IncludeInGeneratedForm_b958d1b9981a BOOLEAN;
  p_GeneratedFormSection_b958d1b9981a VARCHAR(10);
  p_IsNameField_b958d1b9981a BOOLEAN;
  p_RelatedEntityID_b958d1b9981a UUID;
  p_RelatedEntityFieldName_b958d1b9981a VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_b958d1b9981a BOOLEAN;
  p_RelatedEntityNameFieldMap_b958d1b9981a VARCHAR(255);
  p_RelatedEntityDisplayType_b958d1b9981a VARCHAR(20);
  p_EntityIDFieldName_b958d1b9981a VARCHAR(100);
  p_ScopeDefault_b958d1b9981a VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_b958d1b9981a BOOLEAN;
  p_ValuesToPackWithSchema_b958d1b9981a VARCHAR(10);
  p_Status_b958d1b9981a VARCHAR(25);
  p_AutoUpdateIsNameField_b958d1b9981a BOOLEAN;
  p_AutoUpdateDefaultInView_b958d1b9981a BOOLEAN;
  p_AutoUpdateCategory_b958d1b9981a BOOLEAN;
  p_AutoUpdateDisplayName_b958d1b9981a BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_b958d1b9981a BOOLEAN;
  p_Encrypt_b958d1b9981a BOOLEAN;
  p_EncryptionKeyID_b958d1b9981a UUID;
  p_AllowDecryptInAPI_b958d1b9981a BOOLEAN;
  p_SendEncryptedValue_b958d1b9981a BOOLEAN;
  p_IsSoftPrimaryKey_b958d1b9981a BOOLEAN;
  p_IsSoftForeignKey_b958d1b9981a BOOLEAN;
  p_RelatedEntityJoinFields_b958d1b9981a TEXT;
  p_JSONType_b958d1b9981a VARCHAR(255);
  p_JSONTypeIsArray_b958d1b9981a BOOLEAN;
  p_JSONTypeDefinition_b958d1b9981a TEXT;
  p_UserSearchPredicateAPI_b958d1b9981a VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_b958d1b9981a BOOLEAN;
  p_AutoUpdateFullTextSearch_b958d1b9981a BOOLEAN;
  p_AutoUpdateExtendedType_b958d1b9981a BOOLEAN;
  p_IsComputed_b958d1b9981a BOOLEAN;
  p_EmbeddedRecord_b958d1b9981a TEXT;
  p_Configuration_b958d1b9981a TEXT;
  p_ID_b958d1b9981a UUID;
BEGIN
  p_DisplayName_b958d1b9981a := 'ID';
  p_AutoUpdateDescription_b958d1b9981a := TRUE;
  p_IsPrimaryKey_b958d1b9981a := TRUE;
  p_IsUnique_b958d1b9981a := TRUE;
  p_ValueListType_b958d1b9981a := 'None';
  p_DefaultInView_b958d1b9981a := FALSE;
  p_DefaultColumnWidth_b958d1b9981a := 150;
  p_AllowUpdateAPI_b958d1b9981a := FALSE;
  p_AllowUpdateInView_b958d1b9981a := TRUE;
  p_IncludeInUserSearchAPI_b958d1b9981a := FALSE;
  p_FullTextSearchEnabled_b958d1b9981a := FALSE;
  p_IncludeInGeneratedForm_b958d1b9981a := TRUE;
  p_GeneratedFormSection_b958d1b9981a := 'Details';
  p_IsNameField_b958d1b9981a := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_b958d1b9981a := FALSE;
  p_RelatedEntityDisplayType_b958d1b9981a := 'Search';
  p_AutoUpdateRelatedEntityInfo_b958d1b9981a := TRUE;
  p_ValuesToPackWithSchema_b958d1b9981a := 'Auto';
  p_Status_b958d1b9981a := 'Active';
  p_AutoUpdateIsNameField_b958d1b9981a := TRUE;
  p_AutoUpdateDefaultInView_b958d1b9981a := TRUE;
  p_AutoUpdateCategory_b958d1b9981a := TRUE;
  p_AutoUpdateDisplayName_b958d1b9981a := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_b958d1b9981a := FALSE;
  p_Encrypt_b958d1b9981a := FALSE;
  p_AllowDecryptInAPI_b958d1b9981a := FALSE;
  p_SendEncryptedValue_b958d1b9981a := FALSE;
  p_IsSoftPrimaryKey_b958d1b9981a := FALSE;
  p_IsSoftForeignKey_b958d1b9981a := FALSE;
  p_JSONTypeIsArray_b958d1b9981a := FALSE;
  p_UserSearchPredicateAPI_b958d1b9981a := 'Contains';
  p_AutoUpdateUserSearchPredicate_b958d1b9981a := TRUE;
  p_AutoUpdateFullTextSearch_b958d1b9981a := TRUE;
  p_AutoUpdateExtendedType_b958d1b9981a := TRUE;
  p_IsComputed_b958d1b9981a := FALSE;
  p_ID_b958d1b9981a := 'B07BC7DB-C41C-47F2-96FA-C67DF7A9BCE7';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_b958d1b9981a,
    'Description', p_Description_b958d1b9981a,
    'AutoUpdateDescription', p_AutoUpdateDescription_b958d1b9981a,
    'IsPrimaryKey', p_IsPrimaryKey_b958d1b9981a,
    'IsUnique', p_IsUnique_b958d1b9981a,
    'Category', p_Category_b958d1b9981a,
    'ValueListType', p_ValueListType_b958d1b9981a,
    'ExtendedType', p_ExtendedType_b958d1b9981a,
    'CodeType', p_CodeType_b958d1b9981a,
    'DefaultInView', p_DefaultInView_b958d1b9981a,
    'ViewCellTemplate', p_ViewCellTemplate_b958d1b9981a,
    'DefaultColumnWidth', p_DefaultColumnWidth_b958d1b9981a,
    'AllowUpdateAPI', p_AllowUpdateAPI_b958d1b9981a,
    'AllowUpdateInView', p_AllowUpdateInView_b958d1b9981a,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_b958d1b9981a,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_b958d1b9981a,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_b958d1b9981a,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_b958d1b9981a,
    'GeneratedFormSection', p_GeneratedFormSection_b958d1b9981a,
    'IsNameField', p_IsNameField_b958d1b9981a,
    'RelatedEntityID', p_RelatedEntityID_b958d1b9981a,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_b958d1b9981a,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_b958d1b9981a,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_b958d1b9981a,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_b958d1b9981a,
    'EntityIDFieldName', p_EntityIDFieldName_b958d1b9981a,
    'ScopeDefault', p_ScopeDefault_b958d1b9981a,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_b958d1b9981a,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_b958d1b9981a,
    'Status', p_Status_b958d1b9981a,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_b958d1b9981a,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_b958d1b9981a,
    'AutoUpdateCategory', p_AutoUpdateCategory_b958d1b9981a,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_b958d1b9981a,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_b958d1b9981a,
    'Encrypt', p_Encrypt_b958d1b9981a,
    'EncryptionKeyID', p_EncryptionKeyID_b958d1b9981a,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_b958d1b9981a,
    'SendEncryptedValue', p_SendEncryptedValue_b958d1b9981a,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_b958d1b9981a,
    'IsSoftForeignKey', p_IsSoftForeignKey_b958d1b9981a,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_b958d1b9981a,
    'JSONType', p_JSONType_b958d1b9981a,
    'JSONTypeIsArray', p_JSONTypeIsArray_b958d1b9981a,
    'JSONTypeDefinition', p_JSONTypeDefinition_b958d1b9981a,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_b958d1b9981a,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_b958d1b9981a,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_b958d1b9981a,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_b958d1b9981a,
    'IsComputed', p_IsComputed_b958d1b9981a
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_b958d1b9981a,
    'Configuration', p_Configuration_b958d1b9981a,
    'ID', p_ID_b958d1b9981a
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_b958d1b9981a, p_Description := p_Description_b958d1b9981a, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_b958d1b9981a, p_IsPrimaryKey := p_IsPrimaryKey_b958d1b9981a, p_IsUnique := p_IsUnique_b958d1b9981a, p_Category := p_Category_b958d1b9981a, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_b958d1b9981a, p_ExtendedType := p_ExtendedType_b958d1b9981a, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_b958d1b9981a, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_b958d1b9981a, p_ViewCellTemplate := p_ViewCellTemplate_b958d1b9981a, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_b958d1b9981a, p_AllowUpdateAPI := p_AllowUpdateAPI_b958d1b9981a, p_AllowUpdateInView := p_AllowUpdateInView_b958d1b9981a, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_b958d1b9981a, p_FullTextSearchEnabled := p_FullTextSearchEnabled_b958d1b9981a, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_b958d1b9981a, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_b958d1b9981a, p_GeneratedFormSection := p_GeneratedFormSection_b958d1b9981a, p_IsNameField := p_IsNameField_b958d1b9981a, p_RelatedEntityID := p_RelatedEntityID_b958d1b9981a, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_b958d1b9981a, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_b958d1b9981a, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_b958d1b9981a, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_b958d1b9981a, p_EntityIDFieldName := p_EntityIDFieldName_b958d1b9981a, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_b958d1b9981a, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_b958d1b9981a, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_b958d1b9981a, p_Status := p_Status_b958d1b9981a, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_b958d1b9981a, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_b958d1b9981a, p_AutoUpdateCategory := p_AutoUpdateCategory_b958d1b9981a, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_b958d1b9981a, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_b958d1b9981a, p_Encrypt := p_Encrypt_b958d1b9981a, p_EncryptionKeyID := p_EncryptionKeyID_b958d1b9981a, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_b958d1b9981a, p_SendEncryptedValue := p_SendEncryptedValue_b958d1b9981a, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_b958d1b9981a, p_IsSoftForeignKey := p_IsSoftForeignKey_b958d1b9981a, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_b958d1b9981a, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_b958d1b9981a, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_b958d1b9981a, p_JSONTypeDefinition := p_JSONTypeDefinition_b958d1b9981a, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_b958d1b9981a, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_b958d1b9981a, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_b958d1b9981a, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_b958d1b9981a, p_IsComputed := p_IsComputed_b958d1b9981a, p_EmbeddedRecord := p_EmbeddedRecord_b958d1b9981a, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_b958d1b9981a, p_Configuration_Clear := TRUE, p_ID := p_ID_b958d1b9981a);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_9b10996fcb69 VARCHAR(255);
  p_Description_9b10996fcb69 TEXT;
  p_AutoUpdateDescription_9b10996fcb69 BOOLEAN;
  p_IsPrimaryKey_9b10996fcb69 BOOLEAN;
  p_IsUnique_9b10996fcb69 BOOLEAN;
  p_Category_9b10996fcb69 VARCHAR(255);
  p_ValueListType_9b10996fcb69 VARCHAR(20);
  p_ExtendedType_9b10996fcb69 VARCHAR(50);
  p_CodeType_9b10996fcb69 VARCHAR(50);
  p_DefaultInView_9b10996fcb69 BOOLEAN;
  p_ViewCellTemplate_9b10996fcb69 TEXT;
  p_DefaultColumnWidth_9b10996fcb69 INTEGER;
  p_AllowUpdateAPI_9b10996fcb69 BOOLEAN;
  p_AllowUpdateInView_9b10996fcb69 BOOLEAN;
  p_IncludeInUserSearchAPI_9b10996fcb69 BOOLEAN;
  p_FullTextSearchEnabled_9b10996fcb69 BOOLEAN;
  p_UserSearchParamFormatAPI_9b10996fcb69 VARCHAR(500);
  p_IncludeInGeneratedForm_9b10996fcb69 BOOLEAN;
  p_GeneratedFormSection_9b10996fcb69 VARCHAR(10);
  p_IsNameField_9b10996fcb69 BOOLEAN;
  p_RelatedEntityID_9b10996fcb69 UUID;
  p_RelatedEntityFieldName_9b10996fcb69 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_9b10996fcb69 BOOLEAN;
  p_RelatedEntityNameFieldMap_9b10996fcb69 VARCHAR(255);
  p_RelatedEntityDisplayType_9b10996fcb69 VARCHAR(20);
  p_EntityIDFieldName_9b10996fcb69 VARCHAR(100);
  p_ScopeDefault_9b10996fcb69 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_9b10996fcb69 BOOLEAN;
  p_ValuesToPackWithSchema_9b10996fcb69 VARCHAR(10);
  p_Status_9b10996fcb69 VARCHAR(25);
  p_AutoUpdateIsNameField_9b10996fcb69 BOOLEAN;
  p_AutoUpdateDefaultInView_9b10996fcb69 BOOLEAN;
  p_AutoUpdateCategory_9b10996fcb69 BOOLEAN;
  p_AutoUpdateDisplayName_9b10996fcb69 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_9b10996fcb69 BOOLEAN;
  p_Encrypt_9b10996fcb69 BOOLEAN;
  p_EncryptionKeyID_9b10996fcb69 UUID;
  p_AllowDecryptInAPI_9b10996fcb69 BOOLEAN;
  p_SendEncryptedValue_9b10996fcb69 BOOLEAN;
  p_IsSoftPrimaryKey_9b10996fcb69 BOOLEAN;
  p_IsSoftForeignKey_9b10996fcb69 BOOLEAN;
  p_RelatedEntityJoinFields_9b10996fcb69 TEXT;
  p_JSONType_9b10996fcb69 VARCHAR(255);
  p_JSONTypeIsArray_9b10996fcb69 BOOLEAN;
  p_JSONTypeDefinition_9b10996fcb69 TEXT;
  p_UserSearchPredicateAPI_9b10996fcb69 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_9b10996fcb69 BOOLEAN;
  p_AutoUpdateFullTextSearch_9b10996fcb69 BOOLEAN;
  p_AutoUpdateExtendedType_9b10996fcb69 BOOLEAN;
  p_IsComputed_9b10996fcb69 BOOLEAN;
  p_EmbeddedRecord_9b10996fcb69 TEXT;
  p_Configuration_9b10996fcb69 TEXT;
  p_ID_9b10996fcb69 UUID;
BEGIN
  p_DisplayName_9b10996fcb69 := 'Name';
  p_AutoUpdateDescription_9b10996fcb69 := TRUE;
  p_IsPrimaryKey_9b10996fcb69 := FALSE;
  p_IsUnique_9b10996fcb69 := FALSE;
  p_ValueListType_9b10996fcb69 := 'None';
  p_DefaultInView_9b10996fcb69 := TRUE;
  p_DefaultColumnWidth_9b10996fcb69 := 150;
  p_AllowUpdateAPI_9b10996fcb69 := TRUE;
  p_AllowUpdateInView_9b10996fcb69 := TRUE;
  p_IncludeInUserSearchAPI_9b10996fcb69 := TRUE;
  p_FullTextSearchEnabled_9b10996fcb69 := FALSE;
  p_IncludeInGeneratedForm_9b10996fcb69 := TRUE;
  p_GeneratedFormSection_9b10996fcb69 := 'Details';
  p_IsNameField_9b10996fcb69 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_9b10996fcb69 := FALSE;
  p_RelatedEntityDisplayType_9b10996fcb69 := 'Search';
  p_AutoUpdateRelatedEntityInfo_9b10996fcb69 := TRUE;
  p_ValuesToPackWithSchema_9b10996fcb69 := 'Auto';
  p_Status_9b10996fcb69 := 'Active';
  p_AutoUpdateIsNameField_9b10996fcb69 := TRUE;
  p_AutoUpdateDefaultInView_9b10996fcb69 := TRUE;
  p_AutoUpdateCategory_9b10996fcb69 := TRUE;
  p_AutoUpdateDisplayName_9b10996fcb69 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_9b10996fcb69 := FALSE;
  p_Encrypt_9b10996fcb69 := FALSE;
  p_AllowDecryptInAPI_9b10996fcb69 := FALSE;
  p_SendEncryptedValue_9b10996fcb69 := FALSE;
  p_IsSoftPrimaryKey_9b10996fcb69 := FALSE;
  p_IsSoftForeignKey_9b10996fcb69 := FALSE;
  p_JSONTypeIsArray_9b10996fcb69 := FALSE;
  p_UserSearchPredicateAPI_9b10996fcb69 := 'BeginsWith';
  p_AutoUpdateUserSearchPredicate_9b10996fcb69 := TRUE;
  p_AutoUpdateFullTextSearch_9b10996fcb69 := TRUE;
  p_AutoUpdateExtendedType_9b10996fcb69 := TRUE;
  p_IsComputed_9b10996fcb69 := FALSE;
  p_ID_9b10996fcb69 := '1E6BBE4F-B112-42BD-ACB4-3114187F85C8';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_9b10996fcb69,
    'Description', p_Description_9b10996fcb69,
    'AutoUpdateDescription', p_AutoUpdateDescription_9b10996fcb69,
    'IsPrimaryKey', p_IsPrimaryKey_9b10996fcb69,
    'IsUnique', p_IsUnique_9b10996fcb69,
    'Category', p_Category_9b10996fcb69,
    'ValueListType', p_ValueListType_9b10996fcb69,
    'ExtendedType', p_ExtendedType_9b10996fcb69,
    'CodeType', p_CodeType_9b10996fcb69,
    'DefaultInView', p_DefaultInView_9b10996fcb69,
    'ViewCellTemplate', p_ViewCellTemplate_9b10996fcb69,
    'DefaultColumnWidth', p_DefaultColumnWidth_9b10996fcb69,
    'AllowUpdateAPI', p_AllowUpdateAPI_9b10996fcb69,
    'AllowUpdateInView', p_AllowUpdateInView_9b10996fcb69,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_9b10996fcb69,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_9b10996fcb69,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_9b10996fcb69,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_9b10996fcb69,
    'GeneratedFormSection', p_GeneratedFormSection_9b10996fcb69,
    'IsNameField', p_IsNameField_9b10996fcb69,
    'RelatedEntityID', p_RelatedEntityID_9b10996fcb69,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_9b10996fcb69,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_9b10996fcb69,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_9b10996fcb69,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_9b10996fcb69,
    'EntityIDFieldName', p_EntityIDFieldName_9b10996fcb69,
    'ScopeDefault', p_ScopeDefault_9b10996fcb69,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_9b10996fcb69,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_9b10996fcb69,
    'Status', p_Status_9b10996fcb69,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_9b10996fcb69,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_9b10996fcb69,
    'AutoUpdateCategory', p_AutoUpdateCategory_9b10996fcb69,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_9b10996fcb69,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_9b10996fcb69,
    'Encrypt', p_Encrypt_9b10996fcb69,
    'EncryptionKeyID', p_EncryptionKeyID_9b10996fcb69,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_9b10996fcb69,
    'SendEncryptedValue', p_SendEncryptedValue_9b10996fcb69,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_9b10996fcb69,
    'IsSoftForeignKey', p_IsSoftForeignKey_9b10996fcb69,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_9b10996fcb69,
    'JSONType', p_JSONType_9b10996fcb69,
    'JSONTypeIsArray', p_JSONTypeIsArray_9b10996fcb69,
    'JSONTypeDefinition', p_JSONTypeDefinition_9b10996fcb69,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_9b10996fcb69,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_9b10996fcb69,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_9b10996fcb69,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_9b10996fcb69,
    'IsComputed', p_IsComputed_9b10996fcb69
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_9b10996fcb69,
    'Configuration', p_Configuration_9b10996fcb69,
    'ID', p_ID_9b10996fcb69
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_9b10996fcb69, p_Description := p_Description_9b10996fcb69, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_9b10996fcb69, p_IsPrimaryKey := p_IsPrimaryKey_9b10996fcb69, p_IsUnique := p_IsUnique_9b10996fcb69, p_Category := p_Category_9b10996fcb69, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_9b10996fcb69, p_ExtendedType := p_ExtendedType_9b10996fcb69, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_9b10996fcb69, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_9b10996fcb69, p_ViewCellTemplate := p_ViewCellTemplate_9b10996fcb69, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_9b10996fcb69, p_AllowUpdateAPI := p_AllowUpdateAPI_9b10996fcb69, p_AllowUpdateInView := p_AllowUpdateInView_9b10996fcb69, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_9b10996fcb69, p_FullTextSearchEnabled := p_FullTextSearchEnabled_9b10996fcb69, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_9b10996fcb69, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_9b10996fcb69, p_GeneratedFormSection := p_GeneratedFormSection_9b10996fcb69, p_IsNameField := p_IsNameField_9b10996fcb69, p_RelatedEntityID := p_RelatedEntityID_9b10996fcb69, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_9b10996fcb69, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_9b10996fcb69, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_9b10996fcb69, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_9b10996fcb69, p_EntityIDFieldName := p_EntityIDFieldName_9b10996fcb69, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_9b10996fcb69, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_9b10996fcb69, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_9b10996fcb69, p_Status := p_Status_9b10996fcb69, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_9b10996fcb69, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_9b10996fcb69, p_AutoUpdateCategory := p_AutoUpdateCategory_9b10996fcb69, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_9b10996fcb69, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_9b10996fcb69, p_Encrypt := p_Encrypt_9b10996fcb69, p_EncryptionKeyID := p_EncryptionKeyID_9b10996fcb69, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_9b10996fcb69, p_SendEncryptedValue := p_SendEncryptedValue_9b10996fcb69, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_9b10996fcb69, p_IsSoftForeignKey := p_IsSoftForeignKey_9b10996fcb69, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_9b10996fcb69, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_9b10996fcb69, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_9b10996fcb69, p_JSONTypeDefinition := p_JSONTypeDefinition_9b10996fcb69, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_9b10996fcb69, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_9b10996fcb69, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_9b10996fcb69, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_9b10996fcb69, p_IsComputed := p_IsComputed_9b10996fcb69, p_EmbeddedRecord := p_EmbeddedRecord_9b10996fcb69, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_9b10996fcb69, p_Configuration_Clear := TRUE, p_ID := p_ID_9b10996fcb69);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_c03e0456a34f VARCHAR(255);
  p_Description_c03e0456a34f TEXT;
  p_AutoUpdateDescription_c03e0456a34f BOOLEAN;
  p_IsPrimaryKey_c03e0456a34f BOOLEAN;
  p_IsUnique_c03e0456a34f BOOLEAN;
  p_Category_c03e0456a34f VARCHAR(255);
  p_ValueListType_c03e0456a34f VARCHAR(20);
  p_ExtendedType_c03e0456a34f VARCHAR(50);
  p_CodeType_c03e0456a34f VARCHAR(50);
  p_DefaultInView_c03e0456a34f BOOLEAN;
  p_ViewCellTemplate_c03e0456a34f TEXT;
  p_DefaultColumnWidth_c03e0456a34f INTEGER;
  p_AllowUpdateAPI_c03e0456a34f BOOLEAN;
  p_AllowUpdateInView_c03e0456a34f BOOLEAN;
  p_IncludeInUserSearchAPI_c03e0456a34f BOOLEAN;
  p_FullTextSearchEnabled_c03e0456a34f BOOLEAN;
  p_UserSearchParamFormatAPI_c03e0456a34f VARCHAR(500);
  p_IncludeInGeneratedForm_c03e0456a34f BOOLEAN;
  p_GeneratedFormSection_c03e0456a34f VARCHAR(10);
  p_IsNameField_c03e0456a34f BOOLEAN;
  p_RelatedEntityID_c03e0456a34f UUID;
  p_RelatedEntityFieldName_c03e0456a34f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_c03e0456a34f BOOLEAN;
  p_RelatedEntityNameFieldMap_c03e0456a34f VARCHAR(255);
  p_RelatedEntityDisplayType_c03e0456a34f VARCHAR(20);
  p_EntityIDFieldName_c03e0456a34f VARCHAR(100);
  p_ScopeDefault_c03e0456a34f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_c03e0456a34f BOOLEAN;
  p_ValuesToPackWithSchema_c03e0456a34f VARCHAR(10);
  p_Status_c03e0456a34f VARCHAR(25);
  p_AutoUpdateIsNameField_c03e0456a34f BOOLEAN;
  p_AutoUpdateDefaultInView_c03e0456a34f BOOLEAN;
  p_AutoUpdateCategory_c03e0456a34f BOOLEAN;
  p_AutoUpdateDisplayName_c03e0456a34f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_c03e0456a34f BOOLEAN;
  p_Encrypt_c03e0456a34f BOOLEAN;
  p_EncryptionKeyID_c03e0456a34f UUID;
  p_AllowDecryptInAPI_c03e0456a34f BOOLEAN;
  p_SendEncryptedValue_c03e0456a34f BOOLEAN;
  p_IsSoftPrimaryKey_c03e0456a34f BOOLEAN;
  p_IsSoftForeignKey_c03e0456a34f BOOLEAN;
  p_RelatedEntityJoinFields_c03e0456a34f TEXT;
  p_JSONType_c03e0456a34f VARCHAR(255);
  p_JSONTypeIsArray_c03e0456a34f BOOLEAN;
  p_JSONTypeDefinition_c03e0456a34f TEXT;
  p_UserSearchPredicateAPI_c03e0456a34f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_c03e0456a34f BOOLEAN;
  p_AutoUpdateFullTextSearch_c03e0456a34f BOOLEAN;
  p_AutoUpdateExtendedType_c03e0456a34f BOOLEAN;
  p_IsComputed_c03e0456a34f BOOLEAN;
  p_EmbeddedRecord_c03e0456a34f TEXT;
  p_Configuration_c03e0456a34f TEXT;
  p_ID_c03e0456a34f UUID;
BEGIN
  p_DisplayName_c03e0456a34f := 'ID';
  p_AutoUpdateDescription_c03e0456a34f := TRUE;
  p_IsPrimaryKey_c03e0456a34f := TRUE;
  p_IsUnique_c03e0456a34f := TRUE;
  p_ValueListType_c03e0456a34f := 'None';
  p_DefaultInView_c03e0456a34f := FALSE;
  p_DefaultColumnWidth_c03e0456a34f := 150;
  p_AllowUpdateAPI_c03e0456a34f := FALSE;
  p_AllowUpdateInView_c03e0456a34f := TRUE;
  p_IncludeInUserSearchAPI_c03e0456a34f := FALSE;
  p_FullTextSearchEnabled_c03e0456a34f := FALSE;
  p_IncludeInGeneratedForm_c03e0456a34f := TRUE;
  p_GeneratedFormSection_c03e0456a34f := 'Details';
  p_IsNameField_c03e0456a34f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_c03e0456a34f := FALSE;
  p_RelatedEntityDisplayType_c03e0456a34f := 'Search';
  p_AutoUpdateRelatedEntityInfo_c03e0456a34f := TRUE;
  p_ValuesToPackWithSchema_c03e0456a34f := 'Auto';
  p_Status_c03e0456a34f := 'Active';
  p_AutoUpdateIsNameField_c03e0456a34f := TRUE;
  p_AutoUpdateDefaultInView_c03e0456a34f := TRUE;
  p_AutoUpdateCategory_c03e0456a34f := TRUE;
  p_AutoUpdateDisplayName_c03e0456a34f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_c03e0456a34f := FALSE;
  p_Encrypt_c03e0456a34f := FALSE;
  p_AllowDecryptInAPI_c03e0456a34f := FALSE;
  p_SendEncryptedValue_c03e0456a34f := FALSE;
  p_IsSoftPrimaryKey_c03e0456a34f := FALSE;
  p_IsSoftForeignKey_c03e0456a34f := FALSE;
  p_JSONTypeIsArray_c03e0456a34f := FALSE;
  p_UserSearchPredicateAPI_c03e0456a34f := 'Contains';
  p_AutoUpdateUserSearchPredicate_c03e0456a34f := TRUE;
  p_AutoUpdateFullTextSearch_c03e0456a34f := TRUE;
  p_AutoUpdateExtendedType_c03e0456a34f := TRUE;
  p_IsComputed_c03e0456a34f := FALSE;
  p_ID_c03e0456a34f := 'F2190A26-B0CB-4411-9ED9-66B124AD0390';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_c03e0456a34f,
    'Description', p_Description_c03e0456a34f,
    'AutoUpdateDescription', p_AutoUpdateDescription_c03e0456a34f,
    'IsPrimaryKey', p_IsPrimaryKey_c03e0456a34f,
    'IsUnique', p_IsUnique_c03e0456a34f,
    'Category', p_Category_c03e0456a34f,
    'ValueListType', p_ValueListType_c03e0456a34f,
    'ExtendedType', p_ExtendedType_c03e0456a34f,
    'CodeType', p_CodeType_c03e0456a34f,
    'DefaultInView', p_DefaultInView_c03e0456a34f,
    'ViewCellTemplate', p_ViewCellTemplate_c03e0456a34f,
    'DefaultColumnWidth', p_DefaultColumnWidth_c03e0456a34f,
    'AllowUpdateAPI', p_AllowUpdateAPI_c03e0456a34f,
    'AllowUpdateInView', p_AllowUpdateInView_c03e0456a34f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_c03e0456a34f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_c03e0456a34f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_c03e0456a34f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_c03e0456a34f,
    'GeneratedFormSection', p_GeneratedFormSection_c03e0456a34f,
    'IsNameField', p_IsNameField_c03e0456a34f,
    'RelatedEntityID', p_RelatedEntityID_c03e0456a34f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_c03e0456a34f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_c03e0456a34f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_c03e0456a34f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_c03e0456a34f,
    'EntityIDFieldName', p_EntityIDFieldName_c03e0456a34f,
    'ScopeDefault', p_ScopeDefault_c03e0456a34f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_c03e0456a34f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_c03e0456a34f,
    'Status', p_Status_c03e0456a34f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_c03e0456a34f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_c03e0456a34f,
    'AutoUpdateCategory', p_AutoUpdateCategory_c03e0456a34f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_c03e0456a34f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_c03e0456a34f,
    'Encrypt', p_Encrypt_c03e0456a34f,
    'EncryptionKeyID', p_EncryptionKeyID_c03e0456a34f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_c03e0456a34f,
    'SendEncryptedValue', p_SendEncryptedValue_c03e0456a34f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_c03e0456a34f,
    'IsSoftForeignKey', p_IsSoftForeignKey_c03e0456a34f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_c03e0456a34f,
    'JSONType', p_JSONType_c03e0456a34f,
    'JSONTypeIsArray', p_JSONTypeIsArray_c03e0456a34f,
    'JSONTypeDefinition', p_JSONTypeDefinition_c03e0456a34f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_c03e0456a34f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_c03e0456a34f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_c03e0456a34f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_c03e0456a34f,
    'IsComputed', p_IsComputed_c03e0456a34f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_c03e0456a34f,
    'Configuration', p_Configuration_c03e0456a34f,
    'ID', p_ID_c03e0456a34f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_c03e0456a34f, p_Description := p_Description_c03e0456a34f, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_c03e0456a34f, p_IsPrimaryKey := p_IsPrimaryKey_c03e0456a34f, p_IsUnique := p_IsUnique_c03e0456a34f, p_Category := p_Category_c03e0456a34f, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_c03e0456a34f, p_ExtendedType := p_ExtendedType_c03e0456a34f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_c03e0456a34f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_c03e0456a34f, p_ViewCellTemplate := p_ViewCellTemplate_c03e0456a34f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_c03e0456a34f, p_AllowUpdateAPI := p_AllowUpdateAPI_c03e0456a34f, p_AllowUpdateInView := p_AllowUpdateInView_c03e0456a34f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_c03e0456a34f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_c03e0456a34f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_c03e0456a34f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_c03e0456a34f, p_GeneratedFormSection := p_GeneratedFormSection_c03e0456a34f, p_IsNameField := p_IsNameField_c03e0456a34f, p_RelatedEntityID := p_RelatedEntityID_c03e0456a34f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_c03e0456a34f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_c03e0456a34f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_c03e0456a34f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_c03e0456a34f, p_EntityIDFieldName := p_EntityIDFieldName_c03e0456a34f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_c03e0456a34f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_c03e0456a34f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_c03e0456a34f, p_Status := p_Status_c03e0456a34f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_c03e0456a34f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_c03e0456a34f, p_AutoUpdateCategory := p_AutoUpdateCategory_c03e0456a34f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_c03e0456a34f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_c03e0456a34f, p_Encrypt := p_Encrypt_c03e0456a34f, p_EncryptionKeyID := p_EncryptionKeyID_c03e0456a34f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_c03e0456a34f, p_SendEncryptedValue := p_SendEncryptedValue_c03e0456a34f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_c03e0456a34f, p_IsSoftForeignKey := p_IsSoftForeignKey_c03e0456a34f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_c03e0456a34f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_c03e0456a34f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_c03e0456a34f, p_JSONTypeDefinition := p_JSONTypeDefinition_c03e0456a34f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_c03e0456a34f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_c03e0456a34f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_c03e0456a34f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_c03e0456a34f, p_IsComputed := p_IsComputed_c03e0456a34f, p_EmbeddedRecord := p_EmbeddedRecord_c03e0456a34f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_c03e0456a34f, p_Configuration_Clear := TRUE, p_ID := p_ID_c03e0456a34f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e917623d29b3 VARCHAR(255);
  p_Description_e917623d29b3 TEXT;
  p_AutoUpdateDescription_e917623d29b3 BOOLEAN;
  p_IsPrimaryKey_e917623d29b3 BOOLEAN;
  p_IsUnique_e917623d29b3 BOOLEAN;
  p_Category_e917623d29b3 VARCHAR(255);
  p_ValueListType_e917623d29b3 VARCHAR(20);
  p_ExtendedType_e917623d29b3 VARCHAR(50);
  p_CodeType_e917623d29b3 VARCHAR(50);
  p_DefaultInView_e917623d29b3 BOOLEAN;
  p_ViewCellTemplate_e917623d29b3 TEXT;
  p_DefaultColumnWidth_e917623d29b3 INTEGER;
  p_AllowUpdateAPI_e917623d29b3 BOOLEAN;
  p_AllowUpdateInView_e917623d29b3 BOOLEAN;
  p_IncludeInUserSearchAPI_e917623d29b3 BOOLEAN;
  p_FullTextSearchEnabled_e917623d29b3 BOOLEAN;
  p_UserSearchParamFormatAPI_e917623d29b3 VARCHAR(500);
  p_IncludeInGeneratedForm_e917623d29b3 BOOLEAN;
  p_GeneratedFormSection_e917623d29b3 VARCHAR(10);
  p_IsNameField_e917623d29b3 BOOLEAN;
  p_RelatedEntityID_e917623d29b3 UUID;
  p_RelatedEntityFieldName_e917623d29b3 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e917623d29b3 BOOLEAN;
  p_RelatedEntityNameFieldMap_e917623d29b3 VARCHAR(255);
  p_RelatedEntityDisplayType_e917623d29b3 VARCHAR(20);
  p_EntityIDFieldName_e917623d29b3 VARCHAR(100);
  p_ScopeDefault_e917623d29b3 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e917623d29b3 BOOLEAN;
  p_ValuesToPackWithSchema_e917623d29b3 VARCHAR(10);
  p_Status_e917623d29b3 VARCHAR(25);
  p_AutoUpdateIsNameField_e917623d29b3 BOOLEAN;
  p_AutoUpdateDefaultInView_e917623d29b3 BOOLEAN;
  p_AutoUpdateCategory_e917623d29b3 BOOLEAN;
  p_AutoUpdateDisplayName_e917623d29b3 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e917623d29b3 BOOLEAN;
  p_Encrypt_e917623d29b3 BOOLEAN;
  p_EncryptionKeyID_e917623d29b3 UUID;
  p_AllowDecryptInAPI_e917623d29b3 BOOLEAN;
  p_SendEncryptedValue_e917623d29b3 BOOLEAN;
  p_IsSoftPrimaryKey_e917623d29b3 BOOLEAN;
  p_IsSoftForeignKey_e917623d29b3 BOOLEAN;
  p_RelatedEntityJoinFields_e917623d29b3 TEXT;
  p_JSONType_e917623d29b3 VARCHAR(255);
  p_JSONTypeIsArray_e917623d29b3 BOOLEAN;
  p_JSONTypeDefinition_e917623d29b3 TEXT;
  p_UserSearchPredicateAPI_e917623d29b3 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e917623d29b3 BOOLEAN;
  p_AutoUpdateFullTextSearch_e917623d29b3 BOOLEAN;
  p_AutoUpdateExtendedType_e917623d29b3 BOOLEAN;
  p_IsComputed_e917623d29b3 BOOLEAN;
  p_EmbeddedRecord_e917623d29b3 TEXT;
  p_Configuration_e917623d29b3 TEXT;
  p_ID_e917623d29b3 UUID;
BEGIN
  p_DisplayName_e917623d29b3 := 'Name';
  p_AutoUpdateDescription_e917623d29b3 := TRUE;
  p_IsPrimaryKey_e917623d29b3 := FALSE;
  p_IsUnique_e917623d29b3 := FALSE;
  p_ValueListType_e917623d29b3 := 'None';
  p_DefaultInView_e917623d29b3 := TRUE;
  p_DefaultColumnWidth_e917623d29b3 := 150;
  p_AllowUpdateAPI_e917623d29b3 := TRUE;
  p_AllowUpdateInView_e917623d29b3 := TRUE;
  p_IncludeInUserSearchAPI_e917623d29b3 := TRUE;
  p_FullTextSearchEnabled_e917623d29b3 := FALSE;
  p_IncludeInGeneratedForm_e917623d29b3 := TRUE;
  p_GeneratedFormSection_e917623d29b3 := 'Details';
  p_IsNameField_e917623d29b3 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_e917623d29b3 := FALSE;
  p_RelatedEntityDisplayType_e917623d29b3 := 'Search';
  p_AutoUpdateRelatedEntityInfo_e917623d29b3 := TRUE;
  p_ValuesToPackWithSchema_e917623d29b3 := 'Auto';
  p_Status_e917623d29b3 := 'Active';
  p_AutoUpdateIsNameField_e917623d29b3 := TRUE;
  p_AutoUpdateDefaultInView_e917623d29b3 := TRUE;
  p_AutoUpdateCategory_e917623d29b3 := TRUE;
  p_AutoUpdateDisplayName_e917623d29b3 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_e917623d29b3 := FALSE;
  p_Encrypt_e917623d29b3 := FALSE;
  p_AllowDecryptInAPI_e917623d29b3 := FALSE;
  p_SendEncryptedValue_e917623d29b3 := FALSE;
  p_IsSoftPrimaryKey_e917623d29b3 := FALSE;
  p_IsSoftForeignKey_e917623d29b3 := FALSE;
  p_JSONTypeIsArray_e917623d29b3 := FALSE;
  p_UserSearchPredicateAPI_e917623d29b3 := 'BeginsWith';
  p_AutoUpdateUserSearchPredicate_e917623d29b3 := TRUE;
  p_AutoUpdateFullTextSearch_e917623d29b3 := TRUE;
  p_AutoUpdateExtendedType_e917623d29b3 := TRUE;
  p_IsComputed_e917623d29b3 := FALSE;
  p_ID_e917623d29b3 := '379450E4-178C-4CDD-90B3-9081E903B51D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e917623d29b3,
    'Description', p_Description_e917623d29b3,
    'AutoUpdateDescription', p_AutoUpdateDescription_e917623d29b3,
    'IsPrimaryKey', p_IsPrimaryKey_e917623d29b3,
    'IsUnique', p_IsUnique_e917623d29b3,
    'Category', p_Category_e917623d29b3,
    'ValueListType', p_ValueListType_e917623d29b3,
    'ExtendedType', p_ExtendedType_e917623d29b3,
    'CodeType', p_CodeType_e917623d29b3,
    'DefaultInView', p_DefaultInView_e917623d29b3,
    'ViewCellTemplate', p_ViewCellTemplate_e917623d29b3,
    'DefaultColumnWidth', p_DefaultColumnWidth_e917623d29b3,
    'AllowUpdateAPI', p_AllowUpdateAPI_e917623d29b3,
    'AllowUpdateInView', p_AllowUpdateInView_e917623d29b3,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e917623d29b3,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e917623d29b3,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e917623d29b3,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e917623d29b3,
    'GeneratedFormSection', p_GeneratedFormSection_e917623d29b3,
    'IsNameField', p_IsNameField_e917623d29b3,
    'RelatedEntityID', p_RelatedEntityID_e917623d29b3,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e917623d29b3,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e917623d29b3,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e917623d29b3,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e917623d29b3,
    'EntityIDFieldName', p_EntityIDFieldName_e917623d29b3,
    'ScopeDefault', p_ScopeDefault_e917623d29b3,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e917623d29b3,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e917623d29b3,
    'Status', p_Status_e917623d29b3,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e917623d29b3,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e917623d29b3,
    'AutoUpdateCategory', p_AutoUpdateCategory_e917623d29b3,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e917623d29b3,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e917623d29b3,
    'Encrypt', p_Encrypt_e917623d29b3,
    'EncryptionKeyID', p_EncryptionKeyID_e917623d29b3,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e917623d29b3,
    'SendEncryptedValue', p_SendEncryptedValue_e917623d29b3,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e917623d29b3,
    'IsSoftForeignKey', p_IsSoftForeignKey_e917623d29b3,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e917623d29b3,
    'JSONType', p_JSONType_e917623d29b3,
    'JSONTypeIsArray', p_JSONTypeIsArray_e917623d29b3,
    'JSONTypeDefinition', p_JSONTypeDefinition_e917623d29b3,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e917623d29b3,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e917623d29b3,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e917623d29b3,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e917623d29b3,
    'IsComputed', p_IsComputed_e917623d29b3
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e917623d29b3,
    'Configuration', p_Configuration_e917623d29b3,
    'ID', p_ID_e917623d29b3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_e917623d29b3, p_Description := p_Description_e917623d29b3, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e917623d29b3, p_IsPrimaryKey := p_IsPrimaryKey_e917623d29b3, p_IsUnique := p_IsUnique_e917623d29b3, p_Category := p_Category_e917623d29b3, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_e917623d29b3, p_ExtendedType := p_ExtendedType_e917623d29b3, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e917623d29b3, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e917623d29b3, p_ViewCellTemplate := p_ViewCellTemplate_e917623d29b3, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e917623d29b3, p_AllowUpdateAPI := p_AllowUpdateAPI_e917623d29b3, p_AllowUpdateInView := p_AllowUpdateInView_e917623d29b3, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e917623d29b3, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e917623d29b3, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e917623d29b3, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e917623d29b3, p_GeneratedFormSection := p_GeneratedFormSection_e917623d29b3, p_IsNameField := p_IsNameField_e917623d29b3, p_RelatedEntityID := p_RelatedEntityID_e917623d29b3, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e917623d29b3, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e917623d29b3, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e917623d29b3, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e917623d29b3, p_EntityIDFieldName := p_EntityIDFieldName_e917623d29b3, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e917623d29b3, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e917623d29b3, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e917623d29b3, p_Status := p_Status_e917623d29b3, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e917623d29b3, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e917623d29b3, p_AutoUpdateCategory := p_AutoUpdateCategory_e917623d29b3, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e917623d29b3, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e917623d29b3, p_Encrypt := p_Encrypt_e917623d29b3, p_EncryptionKeyID := p_EncryptionKeyID_e917623d29b3, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e917623d29b3, p_SendEncryptedValue := p_SendEncryptedValue_e917623d29b3, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e917623d29b3, p_IsSoftForeignKey := p_IsSoftForeignKey_e917623d29b3, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e917623d29b3, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e917623d29b3, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e917623d29b3, p_JSONTypeDefinition := p_JSONTypeDefinition_e917623d29b3, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e917623d29b3, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e917623d29b3, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e917623d29b3, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e917623d29b3, p_IsComputed := p_IsComputed_e917623d29b3, p_EmbeddedRecord := p_EmbeddedRecord_e917623d29b3, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e917623d29b3, p_Configuration_Clear := TRUE, p_ID := p_ID_e917623d29b3);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_103b157514dd VARCHAR(255);
  p_Description_103b157514dd TEXT;
  p_AutoUpdateDescription_103b157514dd BOOLEAN;
  p_IsPrimaryKey_103b157514dd BOOLEAN;
  p_IsUnique_103b157514dd BOOLEAN;
  p_Category_103b157514dd VARCHAR(255);
  p_ValueListType_103b157514dd VARCHAR(20);
  p_ExtendedType_103b157514dd VARCHAR(50);
  p_CodeType_103b157514dd VARCHAR(50);
  p_DefaultInView_103b157514dd BOOLEAN;
  p_ViewCellTemplate_103b157514dd TEXT;
  p_DefaultColumnWidth_103b157514dd INTEGER;
  p_AllowUpdateAPI_103b157514dd BOOLEAN;
  p_AllowUpdateInView_103b157514dd BOOLEAN;
  p_IncludeInUserSearchAPI_103b157514dd BOOLEAN;
  p_FullTextSearchEnabled_103b157514dd BOOLEAN;
  p_UserSearchParamFormatAPI_103b157514dd VARCHAR(500);
  p_IncludeInGeneratedForm_103b157514dd BOOLEAN;
  p_GeneratedFormSection_103b157514dd VARCHAR(10);
  p_IsNameField_103b157514dd BOOLEAN;
  p_RelatedEntityID_103b157514dd UUID;
  p_RelatedEntityFieldName_103b157514dd VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_103b157514dd BOOLEAN;
  p_RelatedEntityNameFieldMap_103b157514dd VARCHAR(255);
  p_RelatedEntityDisplayType_103b157514dd VARCHAR(20);
  p_EntityIDFieldName_103b157514dd VARCHAR(100);
  p_ScopeDefault_103b157514dd VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_103b157514dd BOOLEAN;
  p_ValuesToPackWithSchema_103b157514dd VARCHAR(10);
  p_Status_103b157514dd VARCHAR(25);
  p_AutoUpdateIsNameField_103b157514dd BOOLEAN;
  p_AutoUpdateDefaultInView_103b157514dd BOOLEAN;
  p_AutoUpdateCategory_103b157514dd BOOLEAN;
  p_AutoUpdateDisplayName_103b157514dd BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_103b157514dd BOOLEAN;
  p_Encrypt_103b157514dd BOOLEAN;
  p_EncryptionKeyID_103b157514dd UUID;
  p_AllowDecryptInAPI_103b157514dd BOOLEAN;
  p_SendEncryptedValue_103b157514dd BOOLEAN;
  p_IsSoftPrimaryKey_103b157514dd BOOLEAN;
  p_IsSoftForeignKey_103b157514dd BOOLEAN;
  p_RelatedEntityJoinFields_103b157514dd TEXT;
  p_JSONType_103b157514dd VARCHAR(255);
  p_JSONTypeIsArray_103b157514dd BOOLEAN;
  p_JSONTypeDefinition_103b157514dd TEXT;
  p_UserSearchPredicateAPI_103b157514dd VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_103b157514dd BOOLEAN;
  p_AutoUpdateFullTextSearch_103b157514dd BOOLEAN;
  p_AutoUpdateExtendedType_103b157514dd BOOLEAN;
  p_IsComputed_103b157514dd BOOLEAN;
  p_EmbeddedRecord_103b157514dd TEXT;
  p_Configuration_103b157514dd TEXT;
  p_ID_103b157514dd UUID;
BEGIN
  p_DisplayName_103b157514dd := 'ID';
  p_AutoUpdateDescription_103b157514dd := TRUE;
  p_IsPrimaryKey_103b157514dd := TRUE;
  p_IsUnique_103b157514dd := TRUE;
  p_ValueListType_103b157514dd := 'None';
  p_DefaultInView_103b157514dd := FALSE;
  p_DefaultColumnWidth_103b157514dd := 150;
  p_AllowUpdateAPI_103b157514dd := FALSE;
  p_AllowUpdateInView_103b157514dd := TRUE;
  p_IncludeInUserSearchAPI_103b157514dd := FALSE;
  p_FullTextSearchEnabled_103b157514dd := FALSE;
  p_IncludeInGeneratedForm_103b157514dd := TRUE;
  p_GeneratedFormSection_103b157514dd := 'Details';
  p_IsNameField_103b157514dd := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_103b157514dd := FALSE;
  p_RelatedEntityDisplayType_103b157514dd := 'Search';
  p_AutoUpdateRelatedEntityInfo_103b157514dd := TRUE;
  p_ValuesToPackWithSchema_103b157514dd := 'Auto';
  p_Status_103b157514dd := 'Active';
  p_AutoUpdateIsNameField_103b157514dd := TRUE;
  p_AutoUpdateDefaultInView_103b157514dd := TRUE;
  p_AutoUpdateCategory_103b157514dd := TRUE;
  p_AutoUpdateDisplayName_103b157514dd := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_103b157514dd := FALSE;
  p_Encrypt_103b157514dd := FALSE;
  p_AllowDecryptInAPI_103b157514dd := FALSE;
  p_SendEncryptedValue_103b157514dd := FALSE;
  p_IsSoftPrimaryKey_103b157514dd := FALSE;
  p_IsSoftForeignKey_103b157514dd := FALSE;
  p_JSONTypeIsArray_103b157514dd := FALSE;
  p_UserSearchPredicateAPI_103b157514dd := 'Contains';
  p_AutoUpdateUserSearchPredicate_103b157514dd := TRUE;
  p_AutoUpdateFullTextSearch_103b157514dd := TRUE;
  p_AutoUpdateExtendedType_103b157514dd := TRUE;
  p_IsComputed_103b157514dd := FALSE;
  p_ID_103b157514dd := '3D52AFFE-C851-46F7-8C49-5263BECB0C9B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_103b157514dd,
    'Description', p_Description_103b157514dd,
    'AutoUpdateDescription', p_AutoUpdateDescription_103b157514dd,
    'IsPrimaryKey', p_IsPrimaryKey_103b157514dd,
    'IsUnique', p_IsUnique_103b157514dd,
    'Category', p_Category_103b157514dd,
    'ValueListType', p_ValueListType_103b157514dd,
    'ExtendedType', p_ExtendedType_103b157514dd,
    'CodeType', p_CodeType_103b157514dd,
    'DefaultInView', p_DefaultInView_103b157514dd,
    'ViewCellTemplate', p_ViewCellTemplate_103b157514dd,
    'DefaultColumnWidth', p_DefaultColumnWidth_103b157514dd,
    'AllowUpdateAPI', p_AllowUpdateAPI_103b157514dd,
    'AllowUpdateInView', p_AllowUpdateInView_103b157514dd,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_103b157514dd,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_103b157514dd,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_103b157514dd,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_103b157514dd,
    'GeneratedFormSection', p_GeneratedFormSection_103b157514dd,
    'IsNameField', p_IsNameField_103b157514dd,
    'RelatedEntityID', p_RelatedEntityID_103b157514dd,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_103b157514dd,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_103b157514dd,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_103b157514dd,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_103b157514dd,
    'EntityIDFieldName', p_EntityIDFieldName_103b157514dd,
    'ScopeDefault', p_ScopeDefault_103b157514dd,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_103b157514dd,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_103b157514dd,
    'Status', p_Status_103b157514dd,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_103b157514dd,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_103b157514dd,
    'AutoUpdateCategory', p_AutoUpdateCategory_103b157514dd,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_103b157514dd,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_103b157514dd,
    'Encrypt', p_Encrypt_103b157514dd,
    'EncryptionKeyID', p_EncryptionKeyID_103b157514dd,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_103b157514dd,
    'SendEncryptedValue', p_SendEncryptedValue_103b157514dd,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_103b157514dd,
    'IsSoftForeignKey', p_IsSoftForeignKey_103b157514dd,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_103b157514dd,
    'JSONType', p_JSONType_103b157514dd,
    'JSONTypeIsArray', p_JSONTypeIsArray_103b157514dd,
    'JSONTypeDefinition', p_JSONTypeDefinition_103b157514dd,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_103b157514dd,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_103b157514dd,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_103b157514dd,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_103b157514dd,
    'IsComputed', p_IsComputed_103b157514dd
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_103b157514dd,
    'Configuration', p_Configuration_103b157514dd,
    'ID', p_ID_103b157514dd
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_103b157514dd, p_Description := p_Description_103b157514dd, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_103b157514dd, p_IsPrimaryKey := p_IsPrimaryKey_103b157514dd, p_IsUnique := p_IsUnique_103b157514dd, p_Category := p_Category_103b157514dd, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_103b157514dd, p_ExtendedType := p_ExtendedType_103b157514dd, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_103b157514dd, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_103b157514dd, p_ViewCellTemplate := p_ViewCellTemplate_103b157514dd, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_103b157514dd, p_AllowUpdateAPI := p_AllowUpdateAPI_103b157514dd, p_AllowUpdateInView := p_AllowUpdateInView_103b157514dd, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_103b157514dd, p_FullTextSearchEnabled := p_FullTextSearchEnabled_103b157514dd, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_103b157514dd, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_103b157514dd, p_GeneratedFormSection := p_GeneratedFormSection_103b157514dd, p_IsNameField := p_IsNameField_103b157514dd, p_RelatedEntityID := p_RelatedEntityID_103b157514dd, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_103b157514dd, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_103b157514dd, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_103b157514dd, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_103b157514dd, p_EntityIDFieldName := p_EntityIDFieldName_103b157514dd, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_103b157514dd, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_103b157514dd, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_103b157514dd, p_Status := p_Status_103b157514dd, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_103b157514dd, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_103b157514dd, p_AutoUpdateCategory := p_AutoUpdateCategory_103b157514dd, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_103b157514dd, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_103b157514dd, p_Encrypt := p_Encrypt_103b157514dd, p_EncryptionKeyID := p_EncryptionKeyID_103b157514dd, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_103b157514dd, p_SendEncryptedValue := p_SendEncryptedValue_103b157514dd, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_103b157514dd, p_IsSoftForeignKey := p_IsSoftForeignKey_103b157514dd, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_103b157514dd, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_103b157514dd, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_103b157514dd, p_JSONTypeDefinition := p_JSONTypeDefinition_103b157514dd, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_103b157514dd, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_103b157514dd, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_103b157514dd, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_103b157514dd, p_IsComputed := p_IsComputed_103b157514dd, p_EmbeddedRecord := p_EmbeddedRecord_103b157514dd, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_103b157514dd, p_Configuration_Clear := TRUE, p_ID := p_ID_103b157514dd);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_d515ae197d13 VARCHAR(255);
  p_Description_d515ae197d13 TEXT;
  p_AutoUpdateDescription_d515ae197d13 BOOLEAN;
  p_IsPrimaryKey_d515ae197d13 BOOLEAN;
  p_IsUnique_d515ae197d13 BOOLEAN;
  p_Category_d515ae197d13 VARCHAR(255);
  p_ValueListType_d515ae197d13 VARCHAR(20);
  p_ExtendedType_d515ae197d13 VARCHAR(50);
  p_CodeType_d515ae197d13 VARCHAR(50);
  p_DefaultInView_d515ae197d13 BOOLEAN;
  p_ViewCellTemplate_d515ae197d13 TEXT;
  p_DefaultColumnWidth_d515ae197d13 INTEGER;
  p_AllowUpdateAPI_d515ae197d13 BOOLEAN;
  p_AllowUpdateInView_d515ae197d13 BOOLEAN;
  p_IncludeInUserSearchAPI_d515ae197d13 BOOLEAN;
  p_FullTextSearchEnabled_d515ae197d13 BOOLEAN;
  p_UserSearchParamFormatAPI_d515ae197d13 VARCHAR(500);
  p_IncludeInGeneratedForm_d515ae197d13 BOOLEAN;
  p_GeneratedFormSection_d515ae197d13 VARCHAR(10);
  p_IsNameField_d515ae197d13 BOOLEAN;
  p_RelatedEntityID_d515ae197d13 UUID;
  p_RelatedEntityFieldName_d515ae197d13 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_d515ae197d13 BOOLEAN;
  p_RelatedEntityNameFieldMap_d515ae197d13 VARCHAR(255);
  p_RelatedEntityDisplayType_d515ae197d13 VARCHAR(20);
  p_EntityIDFieldName_d515ae197d13 VARCHAR(100);
  p_ScopeDefault_d515ae197d13 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_d515ae197d13 BOOLEAN;
  p_ValuesToPackWithSchema_d515ae197d13 VARCHAR(10);
  p_Status_d515ae197d13 VARCHAR(25);
  p_AutoUpdateIsNameField_d515ae197d13 BOOLEAN;
  p_AutoUpdateDefaultInView_d515ae197d13 BOOLEAN;
  p_AutoUpdateCategory_d515ae197d13 BOOLEAN;
  p_AutoUpdateDisplayName_d515ae197d13 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_d515ae197d13 BOOLEAN;
  p_Encrypt_d515ae197d13 BOOLEAN;
  p_EncryptionKeyID_d515ae197d13 UUID;
  p_AllowDecryptInAPI_d515ae197d13 BOOLEAN;
  p_SendEncryptedValue_d515ae197d13 BOOLEAN;
  p_IsSoftPrimaryKey_d515ae197d13 BOOLEAN;
  p_IsSoftForeignKey_d515ae197d13 BOOLEAN;
  p_RelatedEntityJoinFields_d515ae197d13 TEXT;
  p_JSONType_d515ae197d13 VARCHAR(255);
  p_JSONTypeIsArray_d515ae197d13 BOOLEAN;
  p_JSONTypeDefinition_d515ae197d13 TEXT;
  p_UserSearchPredicateAPI_d515ae197d13 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_d515ae197d13 BOOLEAN;
  p_AutoUpdateFullTextSearch_d515ae197d13 BOOLEAN;
  p_AutoUpdateExtendedType_d515ae197d13 BOOLEAN;
  p_IsComputed_d515ae197d13 BOOLEAN;
  p_EmbeddedRecord_d515ae197d13 TEXT;
  p_Configuration_d515ae197d13 TEXT;
  p_ID_d515ae197d13 UUID;
BEGIN
  p_DisplayName_d515ae197d13 := 'Name';
  p_AutoUpdateDescription_d515ae197d13 := TRUE;
  p_IsPrimaryKey_d515ae197d13 := FALSE;
  p_IsUnique_d515ae197d13 := FALSE;
  p_ValueListType_d515ae197d13 := 'None';
  p_DefaultInView_d515ae197d13 := TRUE;
  p_DefaultColumnWidth_d515ae197d13 := 150;
  p_AllowUpdateAPI_d515ae197d13 := TRUE;
  p_AllowUpdateInView_d515ae197d13 := TRUE;
  p_IncludeInUserSearchAPI_d515ae197d13 := TRUE;
  p_FullTextSearchEnabled_d515ae197d13 := FALSE;
  p_IncludeInGeneratedForm_d515ae197d13 := TRUE;
  p_GeneratedFormSection_d515ae197d13 := 'Details';
  p_IsNameField_d515ae197d13 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_d515ae197d13 := FALSE;
  p_RelatedEntityDisplayType_d515ae197d13 := 'Search';
  p_AutoUpdateRelatedEntityInfo_d515ae197d13 := TRUE;
  p_ValuesToPackWithSchema_d515ae197d13 := 'Auto';
  p_Status_d515ae197d13 := 'Active';
  p_AutoUpdateIsNameField_d515ae197d13 := TRUE;
  p_AutoUpdateDefaultInView_d515ae197d13 := TRUE;
  p_AutoUpdateCategory_d515ae197d13 := TRUE;
  p_AutoUpdateDisplayName_d515ae197d13 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_d515ae197d13 := FALSE;
  p_Encrypt_d515ae197d13 := FALSE;
  p_AllowDecryptInAPI_d515ae197d13 := FALSE;
  p_SendEncryptedValue_d515ae197d13 := FALSE;
  p_IsSoftPrimaryKey_d515ae197d13 := FALSE;
  p_IsSoftForeignKey_d515ae197d13 := FALSE;
  p_JSONTypeIsArray_d515ae197d13 := FALSE;
  p_UserSearchPredicateAPI_d515ae197d13 := 'BeginsWith';
  p_AutoUpdateUserSearchPredicate_d515ae197d13 := TRUE;
  p_AutoUpdateFullTextSearch_d515ae197d13 := TRUE;
  p_AutoUpdateExtendedType_d515ae197d13 := TRUE;
  p_IsComputed_d515ae197d13 := FALSE;
  p_ID_d515ae197d13 := '94227B67-8406-47E6-8CF9-87C859FB483D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_d515ae197d13,
    'Description', p_Description_d515ae197d13,
    'AutoUpdateDescription', p_AutoUpdateDescription_d515ae197d13,
    'IsPrimaryKey', p_IsPrimaryKey_d515ae197d13,
    'IsUnique', p_IsUnique_d515ae197d13,
    'Category', p_Category_d515ae197d13,
    'ValueListType', p_ValueListType_d515ae197d13,
    'ExtendedType', p_ExtendedType_d515ae197d13,
    'CodeType', p_CodeType_d515ae197d13,
    'DefaultInView', p_DefaultInView_d515ae197d13,
    'ViewCellTemplate', p_ViewCellTemplate_d515ae197d13,
    'DefaultColumnWidth', p_DefaultColumnWidth_d515ae197d13,
    'AllowUpdateAPI', p_AllowUpdateAPI_d515ae197d13,
    'AllowUpdateInView', p_AllowUpdateInView_d515ae197d13,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_d515ae197d13,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_d515ae197d13,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_d515ae197d13,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_d515ae197d13,
    'GeneratedFormSection', p_GeneratedFormSection_d515ae197d13,
    'IsNameField', p_IsNameField_d515ae197d13,
    'RelatedEntityID', p_RelatedEntityID_d515ae197d13,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_d515ae197d13,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_d515ae197d13,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_d515ae197d13,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_d515ae197d13,
    'EntityIDFieldName', p_EntityIDFieldName_d515ae197d13,
    'ScopeDefault', p_ScopeDefault_d515ae197d13,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_d515ae197d13,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_d515ae197d13,
    'Status', p_Status_d515ae197d13,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_d515ae197d13,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_d515ae197d13,
    'AutoUpdateCategory', p_AutoUpdateCategory_d515ae197d13,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_d515ae197d13,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_d515ae197d13,
    'Encrypt', p_Encrypt_d515ae197d13,
    'EncryptionKeyID', p_EncryptionKeyID_d515ae197d13,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_d515ae197d13,
    'SendEncryptedValue', p_SendEncryptedValue_d515ae197d13,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_d515ae197d13,
    'IsSoftForeignKey', p_IsSoftForeignKey_d515ae197d13,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_d515ae197d13,
    'JSONType', p_JSONType_d515ae197d13,
    'JSONTypeIsArray', p_JSONTypeIsArray_d515ae197d13,
    'JSONTypeDefinition', p_JSONTypeDefinition_d515ae197d13,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_d515ae197d13,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_d515ae197d13,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_d515ae197d13,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_d515ae197d13,
    'IsComputed', p_IsComputed_d515ae197d13
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_d515ae197d13,
    'Configuration', p_Configuration_d515ae197d13,
    'ID', p_ID_d515ae197d13
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_d515ae197d13, p_Description := p_Description_d515ae197d13, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_d515ae197d13, p_IsPrimaryKey := p_IsPrimaryKey_d515ae197d13, p_IsUnique := p_IsUnique_d515ae197d13, p_Category := p_Category_d515ae197d13, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_d515ae197d13, p_ExtendedType := p_ExtendedType_d515ae197d13, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_d515ae197d13, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_d515ae197d13, p_ViewCellTemplate := p_ViewCellTemplate_d515ae197d13, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_d515ae197d13, p_AllowUpdateAPI := p_AllowUpdateAPI_d515ae197d13, p_AllowUpdateInView := p_AllowUpdateInView_d515ae197d13, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_d515ae197d13, p_FullTextSearchEnabled := p_FullTextSearchEnabled_d515ae197d13, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_d515ae197d13, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_d515ae197d13, p_GeneratedFormSection := p_GeneratedFormSection_d515ae197d13, p_IsNameField := p_IsNameField_d515ae197d13, p_RelatedEntityID := p_RelatedEntityID_d515ae197d13, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_d515ae197d13, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_d515ae197d13, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_d515ae197d13, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_d515ae197d13, p_EntityIDFieldName := p_EntityIDFieldName_d515ae197d13, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_d515ae197d13, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_d515ae197d13, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_d515ae197d13, p_Status := p_Status_d515ae197d13, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_d515ae197d13, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_d515ae197d13, p_AutoUpdateCategory := p_AutoUpdateCategory_d515ae197d13, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_d515ae197d13, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_d515ae197d13, p_Encrypt := p_Encrypt_d515ae197d13, p_EncryptionKeyID := p_EncryptionKeyID_d515ae197d13, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_d515ae197d13, p_SendEncryptedValue := p_SendEncryptedValue_d515ae197d13, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_d515ae197d13, p_IsSoftForeignKey := p_IsSoftForeignKey_d515ae197d13, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_d515ae197d13, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_d515ae197d13, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_d515ae197d13, p_JSONTypeDefinition := p_JSONTypeDefinition_d515ae197d13, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_d515ae197d13, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_d515ae197d13, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_d515ae197d13, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_d515ae197d13, p_IsComputed := p_IsComputed_d515ae197d13, p_EmbeddedRecord := p_EmbeddedRecord_d515ae197d13, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_d515ae197d13, p_Configuration_Clear := TRUE, p_ID := p_ID_d515ae197d13);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e40d49664439 VARCHAR(255);
  p_Description_e40d49664439 TEXT;
  p_AutoUpdateDescription_e40d49664439 BOOLEAN;
  p_IsPrimaryKey_e40d49664439 BOOLEAN;
  p_IsUnique_e40d49664439 BOOLEAN;
  p_Category_e40d49664439 VARCHAR(255);
  p_ValueListType_e40d49664439 VARCHAR(20);
  p_ExtendedType_e40d49664439 VARCHAR(50);
  p_CodeType_e40d49664439 VARCHAR(50);
  p_DefaultInView_e40d49664439 BOOLEAN;
  p_ViewCellTemplate_e40d49664439 TEXT;
  p_DefaultColumnWidth_e40d49664439 INTEGER;
  p_AllowUpdateAPI_e40d49664439 BOOLEAN;
  p_AllowUpdateInView_e40d49664439 BOOLEAN;
  p_IncludeInUserSearchAPI_e40d49664439 BOOLEAN;
  p_FullTextSearchEnabled_e40d49664439 BOOLEAN;
  p_UserSearchParamFormatAPI_e40d49664439 VARCHAR(500);
  p_IncludeInGeneratedForm_e40d49664439 BOOLEAN;
  p_GeneratedFormSection_e40d49664439 VARCHAR(10);
  p_IsNameField_e40d49664439 BOOLEAN;
  p_RelatedEntityID_e40d49664439 UUID;
  p_RelatedEntityFieldName_e40d49664439 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e40d49664439 BOOLEAN;
  p_RelatedEntityNameFieldMap_e40d49664439 VARCHAR(255);
  p_RelatedEntityDisplayType_e40d49664439 VARCHAR(20);
  p_EntityIDFieldName_e40d49664439 VARCHAR(100);
  p_ScopeDefault_e40d49664439 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e40d49664439 BOOLEAN;
  p_ValuesToPackWithSchema_e40d49664439 VARCHAR(10);
  p_Status_e40d49664439 VARCHAR(25);
  p_AutoUpdateIsNameField_e40d49664439 BOOLEAN;
  p_AutoUpdateDefaultInView_e40d49664439 BOOLEAN;
  p_AutoUpdateCategory_e40d49664439 BOOLEAN;
  p_AutoUpdateDisplayName_e40d49664439 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e40d49664439 BOOLEAN;
  p_Encrypt_e40d49664439 BOOLEAN;
  p_EncryptionKeyID_e40d49664439 UUID;
  p_AllowDecryptInAPI_e40d49664439 BOOLEAN;
  p_SendEncryptedValue_e40d49664439 BOOLEAN;
  p_IsSoftPrimaryKey_e40d49664439 BOOLEAN;
  p_IsSoftForeignKey_e40d49664439 BOOLEAN;
  p_RelatedEntityJoinFields_e40d49664439 TEXT;
  p_JSONType_e40d49664439 VARCHAR(255);
  p_JSONTypeIsArray_e40d49664439 BOOLEAN;
  p_JSONTypeDefinition_e40d49664439 TEXT;
  p_UserSearchPredicateAPI_e40d49664439 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e40d49664439 BOOLEAN;
  p_AutoUpdateFullTextSearch_e40d49664439 BOOLEAN;
  p_AutoUpdateExtendedType_e40d49664439 BOOLEAN;
  p_IsComputed_e40d49664439 BOOLEAN;
  p_EmbeddedRecord_e40d49664439 TEXT;
  p_Configuration_e40d49664439 TEXT;
  p_ID_e40d49664439 UUID;
BEGIN
  p_DisplayName_e40d49664439 := 'ID';
  p_AutoUpdateDescription_e40d49664439 := TRUE;
  p_IsPrimaryKey_e40d49664439 := TRUE;
  p_IsUnique_e40d49664439 := TRUE;
  p_ValueListType_e40d49664439 := 'None';
  p_DefaultInView_e40d49664439 := FALSE;
  p_DefaultColumnWidth_e40d49664439 := 150;
  p_AllowUpdateAPI_e40d49664439 := FALSE;
  p_AllowUpdateInView_e40d49664439 := TRUE;
  p_IncludeInUserSearchAPI_e40d49664439 := FALSE;
  p_FullTextSearchEnabled_e40d49664439 := FALSE;
  p_IncludeInGeneratedForm_e40d49664439 := TRUE;
  p_GeneratedFormSection_e40d49664439 := 'Details';
  p_IsNameField_e40d49664439 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_e40d49664439 := FALSE;
  p_RelatedEntityDisplayType_e40d49664439 := 'Search';
  p_AutoUpdateRelatedEntityInfo_e40d49664439 := TRUE;
  p_ValuesToPackWithSchema_e40d49664439 := 'Auto';
  p_Status_e40d49664439 := 'Active';
  p_AutoUpdateIsNameField_e40d49664439 := TRUE;
  p_AutoUpdateDefaultInView_e40d49664439 := TRUE;
  p_AutoUpdateCategory_e40d49664439 := TRUE;
  p_AutoUpdateDisplayName_e40d49664439 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_e40d49664439 := FALSE;
  p_Encrypt_e40d49664439 := FALSE;
  p_AllowDecryptInAPI_e40d49664439 := FALSE;
  p_SendEncryptedValue_e40d49664439 := FALSE;
  p_IsSoftPrimaryKey_e40d49664439 := FALSE;
  p_IsSoftForeignKey_e40d49664439 := FALSE;
  p_JSONTypeIsArray_e40d49664439 := FALSE;
  p_UserSearchPredicateAPI_e40d49664439 := 'Contains';
  p_AutoUpdateUserSearchPredicate_e40d49664439 := TRUE;
  p_AutoUpdateFullTextSearch_e40d49664439 := TRUE;
  p_AutoUpdateExtendedType_e40d49664439 := TRUE;
  p_IsComputed_e40d49664439 := FALSE;
  p_ID_e40d49664439 := '6CD18772-D751-4E59-AD22-239CC68555B6';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e40d49664439,
    'Description', p_Description_e40d49664439,
    'AutoUpdateDescription', p_AutoUpdateDescription_e40d49664439,
    'IsPrimaryKey', p_IsPrimaryKey_e40d49664439,
    'IsUnique', p_IsUnique_e40d49664439,
    'Category', p_Category_e40d49664439,
    'ValueListType', p_ValueListType_e40d49664439,
    'ExtendedType', p_ExtendedType_e40d49664439,
    'CodeType', p_CodeType_e40d49664439,
    'DefaultInView', p_DefaultInView_e40d49664439,
    'ViewCellTemplate', p_ViewCellTemplate_e40d49664439,
    'DefaultColumnWidth', p_DefaultColumnWidth_e40d49664439,
    'AllowUpdateAPI', p_AllowUpdateAPI_e40d49664439,
    'AllowUpdateInView', p_AllowUpdateInView_e40d49664439,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e40d49664439,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e40d49664439,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e40d49664439,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e40d49664439,
    'GeneratedFormSection', p_GeneratedFormSection_e40d49664439,
    'IsNameField', p_IsNameField_e40d49664439,
    'RelatedEntityID', p_RelatedEntityID_e40d49664439,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e40d49664439,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e40d49664439,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e40d49664439,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e40d49664439,
    'EntityIDFieldName', p_EntityIDFieldName_e40d49664439,
    'ScopeDefault', p_ScopeDefault_e40d49664439,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e40d49664439,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e40d49664439,
    'Status', p_Status_e40d49664439,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e40d49664439,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e40d49664439,
    'AutoUpdateCategory', p_AutoUpdateCategory_e40d49664439,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e40d49664439,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e40d49664439,
    'Encrypt', p_Encrypt_e40d49664439,
    'EncryptionKeyID', p_EncryptionKeyID_e40d49664439,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e40d49664439,
    'SendEncryptedValue', p_SendEncryptedValue_e40d49664439,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e40d49664439,
    'IsSoftForeignKey', p_IsSoftForeignKey_e40d49664439,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e40d49664439,
    'JSONType', p_JSONType_e40d49664439,
    'JSONTypeIsArray', p_JSONTypeIsArray_e40d49664439,
    'JSONTypeDefinition', p_JSONTypeDefinition_e40d49664439,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e40d49664439,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e40d49664439,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e40d49664439,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e40d49664439,
    'IsComputed', p_IsComputed_e40d49664439
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e40d49664439,
    'Configuration', p_Configuration_e40d49664439,
    'ID', p_ID_e40d49664439
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_e40d49664439, p_Description := p_Description_e40d49664439, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e40d49664439, p_IsPrimaryKey := p_IsPrimaryKey_e40d49664439, p_IsUnique := p_IsUnique_e40d49664439, p_Category := p_Category_e40d49664439, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_e40d49664439, p_ExtendedType := p_ExtendedType_e40d49664439, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e40d49664439, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e40d49664439, p_ViewCellTemplate := p_ViewCellTemplate_e40d49664439, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e40d49664439, p_AllowUpdateAPI := p_AllowUpdateAPI_e40d49664439, p_AllowUpdateInView := p_AllowUpdateInView_e40d49664439, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e40d49664439, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e40d49664439, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e40d49664439, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e40d49664439, p_GeneratedFormSection := p_GeneratedFormSection_e40d49664439, p_IsNameField := p_IsNameField_e40d49664439, p_RelatedEntityID := p_RelatedEntityID_e40d49664439, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e40d49664439, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e40d49664439, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e40d49664439, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e40d49664439, p_EntityIDFieldName := p_EntityIDFieldName_e40d49664439, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e40d49664439, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e40d49664439, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e40d49664439, p_Status := p_Status_e40d49664439, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e40d49664439, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e40d49664439, p_AutoUpdateCategory := p_AutoUpdateCategory_e40d49664439, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e40d49664439, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e40d49664439, p_Encrypt := p_Encrypt_e40d49664439, p_EncryptionKeyID := p_EncryptionKeyID_e40d49664439, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e40d49664439, p_SendEncryptedValue := p_SendEncryptedValue_e40d49664439, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e40d49664439, p_IsSoftForeignKey := p_IsSoftForeignKey_e40d49664439, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e40d49664439, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e40d49664439, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e40d49664439, p_JSONTypeDefinition := p_JSONTypeDefinition_e40d49664439, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e40d49664439, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e40d49664439, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e40d49664439, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e40d49664439, p_IsComputed := p_IsComputed_e40d49664439, p_EmbeddedRecord := p_EmbeddedRecord_e40d49664439, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e40d49664439, p_Configuration_Clear := TRUE, p_ID := p_ID_e40d49664439);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_c3791f2411a1 VARCHAR(255);
  p_Description_c3791f2411a1 TEXT;
  p_AutoUpdateDescription_c3791f2411a1 BOOLEAN;
  p_IsPrimaryKey_c3791f2411a1 BOOLEAN;
  p_IsUnique_c3791f2411a1 BOOLEAN;
  p_Category_c3791f2411a1 VARCHAR(255);
  p_ValueListType_c3791f2411a1 VARCHAR(20);
  p_ExtendedType_c3791f2411a1 VARCHAR(50);
  p_CodeType_c3791f2411a1 VARCHAR(50);
  p_DefaultInView_c3791f2411a1 BOOLEAN;
  p_ViewCellTemplate_c3791f2411a1 TEXT;
  p_DefaultColumnWidth_c3791f2411a1 INTEGER;
  p_AllowUpdateAPI_c3791f2411a1 BOOLEAN;
  p_AllowUpdateInView_c3791f2411a1 BOOLEAN;
  p_IncludeInUserSearchAPI_c3791f2411a1 BOOLEAN;
  p_FullTextSearchEnabled_c3791f2411a1 BOOLEAN;
  p_UserSearchParamFormatAPI_c3791f2411a1 VARCHAR(500);
  p_IncludeInGeneratedForm_c3791f2411a1 BOOLEAN;
  p_GeneratedFormSection_c3791f2411a1 VARCHAR(10);
  p_IsNameField_c3791f2411a1 BOOLEAN;
  p_RelatedEntityID_c3791f2411a1 UUID;
  p_RelatedEntityFieldName_c3791f2411a1 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_c3791f2411a1 BOOLEAN;
  p_RelatedEntityNameFieldMap_c3791f2411a1 VARCHAR(255);
  p_RelatedEntityDisplayType_c3791f2411a1 VARCHAR(20);
  p_EntityIDFieldName_c3791f2411a1 VARCHAR(100);
  p_ScopeDefault_c3791f2411a1 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_c3791f2411a1 BOOLEAN;
  p_ValuesToPackWithSchema_c3791f2411a1 VARCHAR(10);
  p_Status_c3791f2411a1 VARCHAR(25);
  p_AutoUpdateIsNameField_c3791f2411a1 BOOLEAN;
  p_AutoUpdateDefaultInView_c3791f2411a1 BOOLEAN;
  p_AutoUpdateCategory_c3791f2411a1 BOOLEAN;
  p_AutoUpdateDisplayName_c3791f2411a1 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_c3791f2411a1 BOOLEAN;
  p_Encrypt_c3791f2411a1 BOOLEAN;
  p_EncryptionKeyID_c3791f2411a1 UUID;
  p_AllowDecryptInAPI_c3791f2411a1 BOOLEAN;
  p_SendEncryptedValue_c3791f2411a1 BOOLEAN;
  p_IsSoftPrimaryKey_c3791f2411a1 BOOLEAN;
  p_IsSoftForeignKey_c3791f2411a1 BOOLEAN;
  p_RelatedEntityJoinFields_c3791f2411a1 TEXT;
  p_JSONType_c3791f2411a1 VARCHAR(255);
  p_JSONTypeIsArray_c3791f2411a1 BOOLEAN;
  p_JSONTypeDefinition_c3791f2411a1 TEXT;
  p_UserSearchPredicateAPI_c3791f2411a1 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_c3791f2411a1 BOOLEAN;
  p_AutoUpdateFullTextSearch_c3791f2411a1 BOOLEAN;
  p_AutoUpdateExtendedType_c3791f2411a1 BOOLEAN;
  p_IsComputed_c3791f2411a1 BOOLEAN;
  p_EmbeddedRecord_c3791f2411a1 TEXT;
  p_Configuration_c3791f2411a1 TEXT;
  p_ID_c3791f2411a1 UUID;
BEGIN
  p_DisplayName_c3791f2411a1 := 'Name';
  p_AutoUpdateDescription_c3791f2411a1 := TRUE;
  p_IsPrimaryKey_c3791f2411a1 := FALSE;
  p_IsUnique_c3791f2411a1 := FALSE;
  p_ValueListType_c3791f2411a1 := 'None';
  p_DefaultInView_c3791f2411a1 := TRUE;
  p_DefaultColumnWidth_c3791f2411a1 := 150;
  p_AllowUpdateAPI_c3791f2411a1 := TRUE;
  p_AllowUpdateInView_c3791f2411a1 := TRUE;
  p_IncludeInUserSearchAPI_c3791f2411a1 := TRUE;
  p_FullTextSearchEnabled_c3791f2411a1 := FALSE;
  p_IncludeInGeneratedForm_c3791f2411a1 := TRUE;
  p_GeneratedFormSection_c3791f2411a1 := 'Details';
  p_IsNameField_c3791f2411a1 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_c3791f2411a1 := FALSE;
  p_RelatedEntityDisplayType_c3791f2411a1 := 'Search';
  p_AutoUpdateRelatedEntityInfo_c3791f2411a1 := TRUE;
  p_ValuesToPackWithSchema_c3791f2411a1 := 'Auto';
  p_Status_c3791f2411a1 := 'Active';
  p_AutoUpdateIsNameField_c3791f2411a1 := TRUE;
  p_AutoUpdateDefaultInView_c3791f2411a1 := TRUE;
  p_AutoUpdateCategory_c3791f2411a1 := TRUE;
  p_AutoUpdateDisplayName_c3791f2411a1 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_c3791f2411a1 := FALSE;
  p_Encrypt_c3791f2411a1 := FALSE;
  p_AllowDecryptInAPI_c3791f2411a1 := FALSE;
  p_SendEncryptedValue_c3791f2411a1 := FALSE;
  p_IsSoftPrimaryKey_c3791f2411a1 := FALSE;
  p_IsSoftForeignKey_c3791f2411a1 := FALSE;
  p_JSONTypeIsArray_c3791f2411a1 := FALSE;
  p_UserSearchPredicateAPI_c3791f2411a1 := 'BeginsWith';
  p_AutoUpdateUserSearchPredicate_c3791f2411a1 := TRUE;
  p_AutoUpdateFullTextSearch_c3791f2411a1 := TRUE;
  p_AutoUpdateExtendedType_c3791f2411a1 := TRUE;
  p_IsComputed_c3791f2411a1 := FALSE;
  p_ID_c3791f2411a1 := '92DA7E6E-7C0A-4D59-BC13-3FAA763E8D1A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_c3791f2411a1,
    'Description', p_Description_c3791f2411a1,
    'AutoUpdateDescription', p_AutoUpdateDescription_c3791f2411a1,
    'IsPrimaryKey', p_IsPrimaryKey_c3791f2411a1,
    'IsUnique', p_IsUnique_c3791f2411a1,
    'Category', p_Category_c3791f2411a1,
    'ValueListType', p_ValueListType_c3791f2411a1,
    'ExtendedType', p_ExtendedType_c3791f2411a1,
    'CodeType', p_CodeType_c3791f2411a1,
    'DefaultInView', p_DefaultInView_c3791f2411a1,
    'ViewCellTemplate', p_ViewCellTemplate_c3791f2411a1,
    'DefaultColumnWidth', p_DefaultColumnWidth_c3791f2411a1,
    'AllowUpdateAPI', p_AllowUpdateAPI_c3791f2411a1,
    'AllowUpdateInView', p_AllowUpdateInView_c3791f2411a1,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_c3791f2411a1,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_c3791f2411a1,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_c3791f2411a1,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_c3791f2411a1,
    'GeneratedFormSection', p_GeneratedFormSection_c3791f2411a1,
    'IsNameField', p_IsNameField_c3791f2411a1,
    'RelatedEntityID', p_RelatedEntityID_c3791f2411a1,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_c3791f2411a1,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_c3791f2411a1,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_c3791f2411a1,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_c3791f2411a1,
    'EntityIDFieldName', p_EntityIDFieldName_c3791f2411a1,
    'ScopeDefault', p_ScopeDefault_c3791f2411a1,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_c3791f2411a1,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_c3791f2411a1,
    'Status', p_Status_c3791f2411a1,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_c3791f2411a1,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_c3791f2411a1,
    'AutoUpdateCategory', p_AutoUpdateCategory_c3791f2411a1,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_c3791f2411a1,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_c3791f2411a1,
    'Encrypt', p_Encrypt_c3791f2411a1,
    'EncryptionKeyID', p_EncryptionKeyID_c3791f2411a1,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_c3791f2411a1,
    'SendEncryptedValue', p_SendEncryptedValue_c3791f2411a1,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_c3791f2411a1,
    'IsSoftForeignKey', p_IsSoftForeignKey_c3791f2411a1,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_c3791f2411a1,
    'JSONType', p_JSONType_c3791f2411a1,
    'JSONTypeIsArray', p_JSONTypeIsArray_c3791f2411a1,
    'JSONTypeDefinition', p_JSONTypeDefinition_c3791f2411a1,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_c3791f2411a1,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_c3791f2411a1,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_c3791f2411a1,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_c3791f2411a1,
    'IsComputed', p_IsComputed_c3791f2411a1
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_c3791f2411a1,
    'Configuration', p_Configuration_c3791f2411a1,
    'ID', p_ID_c3791f2411a1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_c3791f2411a1, p_Description := p_Description_c3791f2411a1, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_c3791f2411a1, p_IsPrimaryKey := p_IsPrimaryKey_c3791f2411a1, p_IsUnique := p_IsUnique_c3791f2411a1, p_Category := p_Category_c3791f2411a1, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_c3791f2411a1, p_ExtendedType := p_ExtendedType_c3791f2411a1, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_c3791f2411a1, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_c3791f2411a1, p_ViewCellTemplate := p_ViewCellTemplate_c3791f2411a1, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_c3791f2411a1, p_AllowUpdateAPI := p_AllowUpdateAPI_c3791f2411a1, p_AllowUpdateInView := p_AllowUpdateInView_c3791f2411a1, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_c3791f2411a1, p_FullTextSearchEnabled := p_FullTextSearchEnabled_c3791f2411a1, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_c3791f2411a1, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_c3791f2411a1, p_GeneratedFormSection := p_GeneratedFormSection_c3791f2411a1, p_IsNameField := p_IsNameField_c3791f2411a1, p_RelatedEntityID := p_RelatedEntityID_c3791f2411a1, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_c3791f2411a1, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_c3791f2411a1, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_c3791f2411a1, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_c3791f2411a1, p_EntityIDFieldName := p_EntityIDFieldName_c3791f2411a1, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_c3791f2411a1, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_c3791f2411a1, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_c3791f2411a1, p_Status := p_Status_c3791f2411a1, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_c3791f2411a1, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_c3791f2411a1, p_AutoUpdateCategory := p_AutoUpdateCategory_c3791f2411a1, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_c3791f2411a1, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_c3791f2411a1, p_Encrypt := p_Encrypt_c3791f2411a1, p_EncryptionKeyID := p_EncryptionKeyID_c3791f2411a1, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_c3791f2411a1, p_SendEncryptedValue := p_SendEncryptedValue_c3791f2411a1, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_c3791f2411a1, p_IsSoftForeignKey := p_IsSoftForeignKey_c3791f2411a1, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_c3791f2411a1, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_c3791f2411a1, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_c3791f2411a1, p_JSONTypeDefinition := p_JSONTypeDefinition_c3791f2411a1, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_c3791f2411a1, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_c3791f2411a1, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_c3791f2411a1, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_c3791f2411a1, p_IsComputed := p_IsComputed_c3791f2411a1, p_EmbeddedRecord := p_EmbeddedRecord_c3791f2411a1, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_c3791f2411a1, p_Configuration_Clear := TRUE, p_ID := p_ID_c3791f2411a1);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_bb645a0be659 VARCHAR(255);
  p_Description_bb645a0be659 TEXT;
  p_AutoUpdateDescription_bb645a0be659 BOOLEAN;
  p_IsPrimaryKey_bb645a0be659 BOOLEAN;
  p_IsUnique_bb645a0be659 BOOLEAN;
  p_Category_bb645a0be659 VARCHAR(255);
  p_ValueListType_bb645a0be659 VARCHAR(20);
  p_ExtendedType_bb645a0be659 VARCHAR(50);
  p_CodeType_bb645a0be659 VARCHAR(50);
  p_DefaultInView_bb645a0be659 BOOLEAN;
  p_ViewCellTemplate_bb645a0be659 TEXT;
  p_DefaultColumnWidth_bb645a0be659 INTEGER;
  p_AllowUpdateAPI_bb645a0be659 BOOLEAN;
  p_AllowUpdateInView_bb645a0be659 BOOLEAN;
  p_IncludeInUserSearchAPI_bb645a0be659 BOOLEAN;
  p_FullTextSearchEnabled_bb645a0be659 BOOLEAN;
  p_UserSearchParamFormatAPI_bb645a0be659 VARCHAR(500);
  p_IncludeInGeneratedForm_bb645a0be659 BOOLEAN;
  p_GeneratedFormSection_bb645a0be659 VARCHAR(10);
  p_IsNameField_bb645a0be659 BOOLEAN;
  p_RelatedEntityID_bb645a0be659 UUID;
  p_RelatedEntityFieldName_bb645a0be659 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_bb645a0be659 BOOLEAN;
  p_RelatedEntityNameFieldMap_bb645a0be659 VARCHAR(255);
  p_RelatedEntityDisplayType_bb645a0be659 VARCHAR(20);
  p_EntityIDFieldName_bb645a0be659 VARCHAR(100);
  p_ScopeDefault_bb645a0be659 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_bb645a0be659 BOOLEAN;
  p_ValuesToPackWithSchema_bb645a0be659 VARCHAR(10);
  p_Status_bb645a0be659 VARCHAR(25);
  p_AutoUpdateIsNameField_bb645a0be659 BOOLEAN;
  p_AutoUpdateDefaultInView_bb645a0be659 BOOLEAN;
  p_AutoUpdateCategory_bb645a0be659 BOOLEAN;
  p_AutoUpdateDisplayName_bb645a0be659 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_bb645a0be659 BOOLEAN;
  p_Encrypt_bb645a0be659 BOOLEAN;
  p_EncryptionKeyID_bb645a0be659 UUID;
  p_AllowDecryptInAPI_bb645a0be659 BOOLEAN;
  p_SendEncryptedValue_bb645a0be659 BOOLEAN;
  p_IsSoftPrimaryKey_bb645a0be659 BOOLEAN;
  p_IsSoftForeignKey_bb645a0be659 BOOLEAN;
  p_RelatedEntityJoinFields_bb645a0be659 TEXT;
  p_JSONType_bb645a0be659 VARCHAR(255);
  p_JSONTypeIsArray_bb645a0be659 BOOLEAN;
  p_JSONTypeDefinition_bb645a0be659 TEXT;
  p_UserSearchPredicateAPI_bb645a0be659 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_bb645a0be659 BOOLEAN;
  p_AutoUpdateFullTextSearch_bb645a0be659 BOOLEAN;
  p_AutoUpdateExtendedType_bb645a0be659 BOOLEAN;
  p_IsComputed_bb645a0be659 BOOLEAN;
  p_EmbeddedRecord_bb645a0be659 TEXT;
  p_Configuration_bb645a0be659 TEXT;
  p_ID_bb645a0be659 UUID;
BEGIN
  p_DisplayName_bb645a0be659 := 'ID';
  p_AutoUpdateDescription_bb645a0be659 := TRUE;
  p_IsPrimaryKey_bb645a0be659 := TRUE;
  p_IsUnique_bb645a0be659 := TRUE;
  p_ValueListType_bb645a0be659 := 'None';
  p_DefaultInView_bb645a0be659 := FALSE;
  p_DefaultColumnWidth_bb645a0be659 := 150;
  p_AllowUpdateAPI_bb645a0be659 := FALSE;
  p_AllowUpdateInView_bb645a0be659 := TRUE;
  p_IncludeInUserSearchAPI_bb645a0be659 := FALSE;
  p_FullTextSearchEnabled_bb645a0be659 := FALSE;
  p_IncludeInGeneratedForm_bb645a0be659 := TRUE;
  p_GeneratedFormSection_bb645a0be659 := 'Details';
  p_IsNameField_bb645a0be659 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_bb645a0be659 := FALSE;
  p_RelatedEntityDisplayType_bb645a0be659 := 'Search';
  p_AutoUpdateRelatedEntityInfo_bb645a0be659 := TRUE;
  p_ValuesToPackWithSchema_bb645a0be659 := 'Auto';
  p_Status_bb645a0be659 := 'Active';
  p_AutoUpdateIsNameField_bb645a0be659 := TRUE;
  p_AutoUpdateDefaultInView_bb645a0be659 := TRUE;
  p_AutoUpdateCategory_bb645a0be659 := TRUE;
  p_AutoUpdateDisplayName_bb645a0be659 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_bb645a0be659 := FALSE;
  p_Encrypt_bb645a0be659 := FALSE;
  p_AllowDecryptInAPI_bb645a0be659 := FALSE;
  p_SendEncryptedValue_bb645a0be659 := FALSE;
  p_IsSoftPrimaryKey_bb645a0be659 := FALSE;
  p_IsSoftForeignKey_bb645a0be659 := FALSE;
  p_JSONTypeIsArray_bb645a0be659 := FALSE;
  p_UserSearchPredicateAPI_bb645a0be659 := 'Contains';
  p_AutoUpdateUserSearchPredicate_bb645a0be659 := TRUE;
  p_AutoUpdateFullTextSearch_bb645a0be659 := TRUE;
  p_AutoUpdateExtendedType_bb645a0be659 := TRUE;
  p_IsComputed_bb645a0be659 := FALSE;
  p_ID_bb645a0be659 := '84FBEAAC-5A75-47C3-A025-5A4A7589A62D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_bb645a0be659,
    'Description', p_Description_bb645a0be659,
    'AutoUpdateDescription', p_AutoUpdateDescription_bb645a0be659,
    'IsPrimaryKey', p_IsPrimaryKey_bb645a0be659,
    'IsUnique', p_IsUnique_bb645a0be659,
    'Category', p_Category_bb645a0be659,
    'ValueListType', p_ValueListType_bb645a0be659,
    'ExtendedType', p_ExtendedType_bb645a0be659,
    'CodeType', p_CodeType_bb645a0be659,
    'DefaultInView', p_DefaultInView_bb645a0be659,
    'ViewCellTemplate', p_ViewCellTemplate_bb645a0be659,
    'DefaultColumnWidth', p_DefaultColumnWidth_bb645a0be659,
    'AllowUpdateAPI', p_AllowUpdateAPI_bb645a0be659,
    'AllowUpdateInView', p_AllowUpdateInView_bb645a0be659,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_bb645a0be659,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_bb645a0be659,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_bb645a0be659,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_bb645a0be659,
    'GeneratedFormSection', p_GeneratedFormSection_bb645a0be659,
    'IsNameField', p_IsNameField_bb645a0be659,
    'RelatedEntityID', p_RelatedEntityID_bb645a0be659,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_bb645a0be659,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_bb645a0be659,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_bb645a0be659,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_bb645a0be659,
    'EntityIDFieldName', p_EntityIDFieldName_bb645a0be659,
    'ScopeDefault', p_ScopeDefault_bb645a0be659,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_bb645a0be659,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_bb645a0be659,
    'Status', p_Status_bb645a0be659,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_bb645a0be659,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_bb645a0be659,
    'AutoUpdateCategory', p_AutoUpdateCategory_bb645a0be659,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_bb645a0be659,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_bb645a0be659,
    'Encrypt', p_Encrypt_bb645a0be659,
    'EncryptionKeyID', p_EncryptionKeyID_bb645a0be659,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_bb645a0be659,
    'SendEncryptedValue', p_SendEncryptedValue_bb645a0be659,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_bb645a0be659,
    'IsSoftForeignKey', p_IsSoftForeignKey_bb645a0be659,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_bb645a0be659,
    'JSONType', p_JSONType_bb645a0be659,
    'JSONTypeIsArray', p_JSONTypeIsArray_bb645a0be659,
    'JSONTypeDefinition', p_JSONTypeDefinition_bb645a0be659,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_bb645a0be659,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_bb645a0be659,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_bb645a0be659,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_bb645a0be659,
    'IsComputed', p_IsComputed_bb645a0be659
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_bb645a0be659,
    'Configuration', p_Configuration_bb645a0be659,
    'ID', p_ID_bb645a0be659
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_bb645a0be659, p_Description := p_Description_bb645a0be659, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_bb645a0be659, p_IsPrimaryKey := p_IsPrimaryKey_bb645a0be659, p_IsUnique := p_IsUnique_bb645a0be659, p_Category := p_Category_bb645a0be659, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_bb645a0be659, p_ExtendedType := p_ExtendedType_bb645a0be659, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_bb645a0be659, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_bb645a0be659, p_ViewCellTemplate := p_ViewCellTemplate_bb645a0be659, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_bb645a0be659, p_AllowUpdateAPI := p_AllowUpdateAPI_bb645a0be659, p_AllowUpdateInView := p_AllowUpdateInView_bb645a0be659, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_bb645a0be659, p_FullTextSearchEnabled := p_FullTextSearchEnabled_bb645a0be659, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_bb645a0be659, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_bb645a0be659, p_GeneratedFormSection := p_GeneratedFormSection_bb645a0be659, p_IsNameField := p_IsNameField_bb645a0be659, p_RelatedEntityID := p_RelatedEntityID_bb645a0be659, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_bb645a0be659, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_bb645a0be659, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_bb645a0be659, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_bb645a0be659, p_EntityIDFieldName := p_EntityIDFieldName_bb645a0be659, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_bb645a0be659, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_bb645a0be659, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_bb645a0be659, p_Status := p_Status_bb645a0be659, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_bb645a0be659, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_bb645a0be659, p_AutoUpdateCategory := p_AutoUpdateCategory_bb645a0be659, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_bb645a0be659, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_bb645a0be659, p_Encrypt := p_Encrypt_bb645a0be659, p_EncryptionKeyID := p_EncryptionKeyID_bb645a0be659, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_bb645a0be659, p_SendEncryptedValue := p_SendEncryptedValue_bb645a0be659, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_bb645a0be659, p_IsSoftForeignKey := p_IsSoftForeignKey_bb645a0be659, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_bb645a0be659, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_bb645a0be659, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_bb645a0be659, p_JSONTypeDefinition := p_JSONTypeDefinition_bb645a0be659, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_bb645a0be659, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_bb645a0be659, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_bb645a0be659, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_bb645a0be659, p_IsComputed := p_IsComputed_bb645a0be659, p_EmbeddedRecord := p_EmbeddedRecord_bb645a0be659, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_bb645a0be659, p_Configuration_Clear := TRUE, p_ID := p_ID_bb645a0be659);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_69875ad6f325 VARCHAR(255);
  p_Description_69875ad6f325 TEXT;
  p_AutoUpdateDescription_69875ad6f325 BOOLEAN;
  p_IsPrimaryKey_69875ad6f325 BOOLEAN;
  p_IsUnique_69875ad6f325 BOOLEAN;
  p_Category_69875ad6f325 VARCHAR(255);
  p_ValueListType_69875ad6f325 VARCHAR(20);
  p_ExtendedType_69875ad6f325 VARCHAR(50);
  p_CodeType_69875ad6f325 VARCHAR(50);
  p_DefaultInView_69875ad6f325 BOOLEAN;
  p_ViewCellTemplate_69875ad6f325 TEXT;
  p_DefaultColumnWidth_69875ad6f325 INTEGER;
  p_AllowUpdateAPI_69875ad6f325 BOOLEAN;
  p_AllowUpdateInView_69875ad6f325 BOOLEAN;
  p_IncludeInUserSearchAPI_69875ad6f325 BOOLEAN;
  p_FullTextSearchEnabled_69875ad6f325 BOOLEAN;
  p_UserSearchParamFormatAPI_69875ad6f325 VARCHAR(500);
  p_IncludeInGeneratedForm_69875ad6f325 BOOLEAN;
  p_GeneratedFormSection_69875ad6f325 VARCHAR(10);
  p_IsNameField_69875ad6f325 BOOLEAN;
  p_RelatedEntityID_69875ad6f325 UUID;
  p_RelatedEntityFieldName_69875ad6f325 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_69875ad6f325 BOOLEAN;
  p_RelatedEntityNameFieldMap_69875ad6f325 VARCHAR(255);
  p_RelatedEntityDisplayType_69875ad6f325 VARCHAR(20);
  p_EntityIDFieldName_69875ad6f325 VARCHAR(100);
  p_ScopeDefault_69875ad6f325 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_69875ad6f325 BOOLEAN;
  p_ValuesToPackWithSchema_69875ad6f325 VARCHAR(10);
  p_Status_69875ad6f325 VARCHAR(25);
  p_AutoUpdateIsNameField_69875ad6f325 BOOLEAN;
  p_AutoUpdateDefaultInView_69875ad6f325 BOOLEAN;
  p_AutoUpdateCategory_69875ad6f325 BOOLEAN;
  p_AutoUpdateDisplayName_69875ad6f325 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_69875ad6f325 BOOLEAN;
  p_Encrypt_69875ad6f325 BOOLEAN;
  p_EncryptionKeyID_69875ad6f325 UUID;
  p_AllowDecryptInAPI_69875ad6f325 BOOLEAN;
  p_SendEncryptedValue_69875ad6f325 BOOLEAN;
  p_IsSoftPrimaryKey_69875ad6f325 BOOLEAN;
  p_IsSoftForeignKey_69875ad6f325 BOOLEAN;
  p_RelatedEntityJoinFields_69875ad6f325 TEXT;
  p_JSONType_69875ad6f325 VARCHAR(255);
  p_JSONTypeIsArray_69875ad6f325 BOOLEAN;
  p_JSONTypeDefinition_69875ad6f325 TEXT;
  p_UserSearchPredicateAPI_69875ad6f325 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_69875ad6f325 BOOLEAN;
  p_AutoUpdateFullTextSearch_69875ad6f325 BOOLEAN;
  p_AutoUpdateExtendedType_69875ad6f325 BOOLEAN;
  p_IsComputed_69875ad6f325 BOOLEAN;
  p_EmbeddedRecord_69875ad6f325 TEXT;
  p_Configuration_69875ad6f325 TEXT;
  p_ID_69875ad6f325 UUID;
BEGIN
  p_DisplayName_69875ad6f325 := 'Name';
  p_AutoUpdateDescription_69875ad6f325 := TRUE;
  p_IsPrimaryKey_69875ad6f325 := FALSE;
  p_IsUnique_69875ad6f325 := FALSE;
  p_ValueListType_69875ad6f325 := 'None';
  p_DefaultInView_69875ad6f325 := TRUE;
  p_DefaultColumnWidth_69875ad6f325 := 150;
  p_AllowUpdateAPI_69875ad6f325 := TRUE;
  p_AllowUpdateInView_69875ad6f325 := TRUE;
  p_IncludeInUserSearchAPI_69875ad6f325 := TRUE;
  p_FullTextSearchEnabled_69875ad6f325 := FALSE;
  p_IncludeInGeneratedForm_69875ad6f325 := TRUE;
  p_GeneratedFormSection_69875ad6f325 := 'Details';
  p_IsNameField_69875ad6f325 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_69875ad6f325 := FALSE;
  p_RelatedEntityDisplayType_69875ad6f325 := 'Search';
  p_AutoUpdateRelatedEntityInfo_69875ad6f325 := TRUE;
  p_ValuesToPackWithSchema_69875ad6f325 := 'Auto';
  p_Status_69875ad6f325 := 'Active';
  p_AutoUpdateIsNameField_69875ad6f325 := TRUE;
  p_AutoUpdateDefaultInView_69875ad6f325 := TRUE;
  p_AutoUpdateCategory_69875ad6f325 := TRUE;
  p_AutoUpdateDisplayName_69875ad6f325 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_69875ad6f325 := FALSE;
  p_Encrypt_69875ad6f325 := FALSE;
  p_AllowDecryptInAPI_69875ad6f325 := FALSE;
  p_SendEncryptedValue_69875ad6f325 := FALSE;
  p_IsSoftPrimaryKey_69875ad6f325 := FALSE;
  p_IsSoftForeignKey_69875ad6f325 := FALSE;
  p_JSONTypeIsArray_69875ad6f325 := FALSE;
  p_UserSearchPredicateAPI_69875ad6f325 := 'BeginsWith';
  p_AutoUpdateUserSearchPredicate_69875ad6f325 := TRUE;
  p_AutoUpdateFullTextSearch_69875ad6f325 := TRUE;
  p_AutoUpdateExtendedType_69875ad6f325 := TRUE;
  p_IsComputed_69875ad6f325 := FALSE;
  p_ID_69875ad6f325 := '5A23C3B3-0797-42C5-A31F-700D7180D826';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_69875ad6f325,
    'Description', p_Description_69875ad6f325,
    'AutoUpdateDescription', p_AutoUpdateDescription_69875ad6f325,
    'IsPrimaryKey', p_IsPrimaryKey_69875ad6f325,
    'IsUnique', p_IsUnique_69875ad6f325,
    'Category', p_Category_69875ad6f325,
    'ValueListType', p_ValueListType_69875ad6f325,
    'ExtendedType', p_ExtendedType_69875ad6f325,
    'CodeType', p_CodeType_69875ad6f325,
    'DefaultInView', p_DefaultInView_69875ad6f325,
    'ViewCellTemplate', p_ViewCellTemplate_69875ad6f325,
    'DefaultColumnWidth', p_DefaultColumnWidth_69875ad6f325,
    'AllowUpdateAPI', p_AllowUpdateAPI_69875ad6f325,
    'AllowUpdateInView', p_AllowUpdateInView_69875ad6f325,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_69875ad6f325,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_69875ad6f325,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_69875ad6f325,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_69875ad6f325,
    'GeneratedFormSection', p_GeneratedFormSection_69875ad6f325,
    'IsNameField', p_IsNameField_69875ad6f325,
    'RelatedEntityID', p_RelatedEntityID_69875ad6f325,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_69875ad6f325,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_69875ad6f325,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_69875ad6f325,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_69875ad6f325,
    'EntityIDFieldName', p_EntityIDFieldName_69875ad6f325,
    'ScopeDefault', p_ScopeDefault_69875ad6f325,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_69875ad6f325,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_69875ad6f325,
    'Status', p_Status_69875ad6f325,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_69875ad6f325,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_69875ad6f325,
    'AutoUpdateCategory', p_AutoUpdateCategory_69875ad6f325,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_69875ad6f325,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_69875ad6f325,
    'Encrypt', p_Encrypt_69875ad6f325,
    'EncryptionKeyID', p_EncryptionKeyID_69875ad6f325,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_69875ad6f325,
    'SendEncryptedValue', p_SendEncryptedValue_69875ad6f325,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_69875ad6f325,
    'IsSoftForeignKey', p_IsSoftForeignKey_69875ad6f325,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_69875ad6f325,
    'JSONType', p_JSONType_69875ad6f325,
    'JSONTypeIsArray', p_JSONTypeIsArray_69875ad6f325,
    'JSONTypeDefinition', p_JSONTypeDefinition_69875ad6f325,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_69875ad6f325,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_69875ad6f325,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_69875ad6f325,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_69875ad6f325,
    'IsComputed', p_IsComputed_69875ad6f325
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_69875ad6f325,
    'Configuration', p_Configuration_69875ad6f325,
    'ID', p_ID_69875ad6f325
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_69875ad6f325, p_Description := p_Description_69875ad6f325, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_69875ad6f325, p_IsPrimaryKey := p_IsPrimaryKey_69875ad6f325, p_IsUnique := p_IsUnique_69875ad6f325, p_Category := p_Category_69875ad6f325, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_69875ad6f325, p_ExtendedType := p_ExtendedType_69875ad6f325, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_69875ad6f325, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_69875ad6f325, p_ViewCellTemplate := p_ViewCellTemplate_69875ad6f325, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_69875ad6f325, p_AllowUpdateAPI := p_AllowUpdateAPI_69875ad6f325, p_AllowUpdateInView := p_AllowUpdateInView_69875ad6f325, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_69875ad6f325, p_FullTextSearchEnabled := p_FullTextSearchEnabled_69875ad6f325, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_69875ad6f325, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_69875ad6f325, p_GeneratedFormSection := p_GeneratedFormSection_69875ad6f325, p_IsNameField := p_IsNameField_69875ad6f325, p_RelatedEntityID := p_RelatedEntityID_69875ad6f325, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_69875ad6f325, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_69875ad6f325, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_69875ad6f325, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_69875ad6f325, p_EntityIDFieldName := p_EntityIDFieldName_69875ad6f325, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_69875ad6f325, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_69875ad6f325, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_69875ad6f325, p_Status := p_Status_69875ad6f325, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_69875ad6f325, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_69875ad6f325, p_AutoUpdateCategory := p_AutoUpdateCategory_69875ad6f325, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_69875ad6f325, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_69875ad6f325, p_Encrypt := p_Encrypt_69875ad6f325, p_EncryptionKeyID := p_EncryptionKeyID_69875ad6f325, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_69875ad6f325, p_SendEncryptedValue := p_SendEncryptedValue_69875ad6f325, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_69875ad6f325, p_IsSoftForeignKey := p_IsSoftForeignKey_69875ad6f325, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_69875ad6f325, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_69875ad6f325, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_69875ad6f325, p_JSONTypeDefinition := p_JSONTypeDefinition_69875ad6f325, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_69875ad6f325, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_69875ad6f325, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_69875ad6f325, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_69875ad6f325, p_IsComputed := p_IsComputed_69875ad6f325, p_EmbeddedRecord := p_EmbeddedRecord_69875ad6f325, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_69875ad6f325, p_Configuration_Clear := TRUE, p_ID := p_ID_69875ad6f325);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_abc348592dc9 VARCHAR(255);
  p_Description_abc348592dc9 TEXT;
  p_AutoUpdateDescription_abc348592dc9 BOOLEAN;
  p_IsPrimaryKey_abc348592dc9 BOOLEAN;
  p_IsUnique_abc348592dc9 BOOLEAN;
  p_Category_abc348592dc9 VARCHAR(255);
  p_ValueListType_abc348592dc9 VARCHAR(20);
  p_ExtendedType_abc348592dc9 VARCHAR(50);
  p_CodeType_abc348592dc9 VARCHAR(50);
  p_DefaultInView_abc348592dc9 BOOLEAN;
  p_ViewCellTemplate_abc348592dc9 TEXT;
  p_DefaultColumnWidth_abc348592dc9 INTEGER;
  p_AllowUpdateAPI_abc348592dc9 BOOLEAN;
  p_AllowUpdateInView_abc348592dc9 BOOLEAN;
  p_IncludeInUserSearchAPI_abc348592dc9 BOOLEAN;
  p_FullTextSearchEnabled_abc348592dc9 BOOLEAN;
  p_UserSearchParamFormatAPI_abc348592dc9 VARCHAR(500);
  p_IncludeInGeneratedForm_abc348592dc9 BOOLEAN;
  p_GeneratedFormSection_abc348592dc9 VARCHAR(10);
  p_IsNameField_abc348592dc9 BOOLEAN;
  p_RelatedEntityID_abc348592dc9 UUID;
  p_RelatedEntityFieldName_abc348592dc9 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_abc348592dc9 BOOLEAN;
  p_RelatedEntityNameFieldMap_abc348592dc9 VARCHAR(255);
  p_RelatedEntityDisplayType_abc348592dc9 VARCHAR(20);
  p_EntityIDFieldName_abc348592dc9 VARCHAR(100);
  p_ScopeDefault_abc348592dc9 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_abc348592dc9 BOOLEAN;
  p_ValuesToPackWithSchema_abc348592dc9 VARCHAR(10);
  p_Status_abc348592dc9 VARCHAR(25);
  p_AutoUpdateIsNameField_abc348592dc9 BOOLEAN;
  p_AutoUpdateDefaultInView_abc348592dc9 BOOLEAN;
  p_AutoUpdateCategory_abc348592dc9 BOOLEAN;
  p_AutoUpdateDisplayName_abc348592dc9 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_abc348592dc9 BOOLEAN;
  p_Encrypt_abc348592dc9 BOOLEAN;
  p_EncryptionKeyID_abc348592dc9 UUID;
  p_AllowDecryptInAPI_abc348592dc9 BOOLEAN;
  p_SendEncryptedValue_abc348592dc9 BOOLEAN;
  p_IsSoftPrimaryKey_abc348592dc9 BOOLEAN;
  p_IsSoftForeignKey_abc348592dc9 BOOLEAN;
  p_RelatedEntityJoinFields_abc348592dc9 TEXT;
  p_JSONType_abc348592dc9 VARCHAR(255);
  p_JSONTypeIsArray_abc348592dc9 BOOLEAN;
  p_JSONTypeDefinition_abc348592dc9 TEXT;
  p_UserSearchPredicateAPI_abc348592dc9 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_abc348592dc9 BOOLEAN;
  p_AutoUpdateFullTextSearch_abc348592dc9 BOOLEAN;
  p_AutoUpdateExtendedType_abc348592dc9 BOOLEAN;
  p_IsComputed_abc348592dc9 BOOLEAN;
  p_EmbeddedRecord_abc348592dc9 TEXT;
  p_Configuration_abc348592dc9 TEXT;
  p_ID_abc348592dc9 UUID;
BEGIN
  p_DisplayName_abc348592dc9 := 'ID';
  p_Description_abc348592dc9 := 'Same value as the parent __mj_BizAppsCommon.Organization.ID. The primary key IS the foreign key; this is not a separate surrogate identity.';
  p_AutoUpdateDescription_abc348592dc9 := TRUE;
  p_IsPrimaryKey_abc348592dc9 := TRUE;
  p_IsUnique_abc348592dc9 := TRUE;
  p_ValueListType_abc348592dc9 := 'None';
  p_DefaultInView_abc348592dc9 := FALSE;
  p_DefaultColumnWidth_abc348592dc9 := 150;
  p_AllowUpdateAPI_abc348592dc9 := FALSE;
  p_AllowUpdateInView_abc348592dc9 := TRUE;
  p_IncludeInUserSearchAPI_abc348592dc9 := FALSE;
  p_FullTextSearchEnabled_abc348592dc9 := FALSE;
  p_IncludeInGeneratedForm_abc348592dc9 := TRUE;
  p_GeneratedFormSection_abc348592dc9 := 'Details';
  p_IsNameField_abc348592dc9 := FALSE;
  p_RelatedEntityID_abc348592dc9 := 'C70448F9-9792-41D7-A82C-784B66429D54';
  p_RelatedEntityFieldName_abc348592dc9 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_abc348592dc9 := TRUE;
  p_RelatedEntityDisplayType_abc348592dc9 := 'Search';
  p_AutoUpdateRelatedEntityInfo_abc348592dc9 := TRUE;
  p_ValuesToPackWithSchema_abc348592dc9 := 'Auto';
  p_Status_abc348592dc9 := 'Active';
  p_AutoUpdateIsNameField_abc348592dc9 := TRUE;
  p_AutoUpdateDefaultInView_abc348592dc9 := TRUE;
  p_AutoUpdateCategory_abc348592dc9 := TRUE;
  p_AutoUpdateDisplayName_abc348592dc9 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_abc348592dc9 := FALSE;
  p_Encrypt_abc348592dc9 := FALSE;
  p_AllowDecryptInAPI_abc348592dc9 := FALSE;
  p_SendEncryptedValue_abc348592dc9 := FALSE;
  p_IsSoftPrimaryKey_abc348592dc9 := FALSE;
  p_IsSoftForeignKey_abc348592dc9 := FALSE;
  p_JSONTypeIsArray_abc348592dc9 := FALSE;
  p_UserSearchPredicateAPI_abc348592dc9 := 'Contains';
  p_AutoUpdateUserSearchPredicate_abc348592dc9 := TRUE;
  p_AutoUpdateFullTextSearch_abc348592dc9 := TRUE;
  p_AutoUpdateExtendedType_abc348592dc9 := TRUE;
  p_IsComputed_abc348592dc9 := FALSE;
  p_ID_abc348592dc9 := '1AFC3C88-35B4-4EA3-910E-5217F648EE21';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_abc348592dc9,
    'Description', p_Description_abc348592dc9,
    'AutoUpdateDescription', p_AutoUpdateDescription_abc348592dc9,
    'IsPrimaryKey', p_IsPrimaryKey_abc348592dc9,
    'IsUnique', p_IsUnique_abc348592dc9,
    'Category', p_Category_abc348592dc9,
    'ValueListType', p_ValueListType_abc348592dc9,
    'ExtendedType', p_ExtendedType_abc348592dc9,
    'CodeType', p_CodeType_abc348592dc9,
    'DefaultInView', p_DefaultInView_abc348592dc9,
    'ViewCellTemplate', p_ViewCellTemplate_abc348592dc9,
    'DefaultColumnWidth', p_DefaultColumnWidth_abc348592dc9,
    'AllowUpdateAPI', p_AllowUpdateAPI_abc348592dc9,
    'AllowUpdateInView', p_AllowUpdateInView_abc348592dc9,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_abc348592dc9,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_abc348592dc9,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_abc348592dc9,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_abc348592dc9,
    'GeneratedFormSection', p_GeneratedFormSection_abc348592dc9,
    'IsNameField', p_IsNameField_abc348592dc9,
    'RelatedEntityID', p_RelatedEntityID_abc348592dc9,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_abc348592dc9,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_abc348592dc9,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_abc348592dc9,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_abc348592dc9,
    'EntityIDFieldName', p_EntityIDFieldName_abc348592dc9,
    'ScopeDefault', p_ScopeDefault_abc348592dc9,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_abc348592dc9,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_abc348592dc9,
    'Status', p_Status_abc348592dc9,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_abc348592dc9,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_abc348592dc9,
    'AutoUpdateCategory', p_AutoUpdateCategory_abc348592dc9,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_abc348592dc9,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_abc348592dc9,
    'Encrypt', p_Encrypt_abc348592dc9,
    'EncryptionKeyID', p_EncryptionKeyID_abc348592dc9,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_abc348592dc9,
    'SendEncryptedValue', p_SendEncryptedValue_abc348592dc9,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_abc348592dc9,
    'IsSoftForeignKey', p_IsSoftForeignKey_abc348592dc9,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_abc348592dc9,
    'JSONType', p_JSONType_abc348592dc9,
    'JSONTypeIsArray', p_JSONTypeIsArray_abc348592dc9,
    'JSONTypeDefinition', p_JSONTypeDefinition_abc348592dc9,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_abc348592dc9,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_abc348592dc9,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_abc348592dc9,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_abc348592dc9,
    'IsComputed', p_IsComputed_abc348592dc9
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_abc348592dc9,
    'Configuration', p_Configuration_abc348592dc9,
    'ID', p_ID_abc348592dc9
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_abc348592dc9, p_Description := p_Description_abc348592dc9, p_AutoUpdateDescription := p_AutoUpdateDescription_abc348592dc9, p_IsPrimaryKey := p_IsPrimaryKey_abc348592dc9, p_IsUnique := p_IsUnique_abc348592dc9, p_Category := p_Category_abc348592dc9, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_abc348592dc9, p_ExtendedType := p_ExtendedType_abc348592dc9, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_abc348592dc9, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_abc348592dc9, p_ViewCellTemplate := p_ViewCellTemplate_abc348592dc9, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_abc348592dc9, p_AllowUpdateAPI := p_AllowUpdateAPI_abc348592dc9, p_AllowUpdateInView := p_AllowUpdateInView_abc348592dc9, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_abc348592dc9, p_FullTextSearchEnabled := p_FullTextSearchEnabled_abc348592dc9, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_abc348592dc9, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_abc348592dc9, p_GeneratedFormSection := p_GeneratedFormSection_abc348592dc9, p_IsNameField := p_IsNameField_abc348592dc9, p_RelatedEntityID := p_RelatedEntityID_abc348592dc9, p_RelatedEntityFieldName := p_RelatedEntityFieldName_abc348592dc9, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_abc348592dc9, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_abc348592dc9, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_abc348592dc9, p_EntityIDFieldName := p_EntityIDFieldName_abc348592dc9, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_abc348592dc9, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_abc348592dc9, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_abc348592dc9, p_Status := p_Status_abc348592dc9, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_abc348592dc9, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_abc348592dc9, p_AutoUpdateCategory := p_AutoUpdateCategory_abc348592dc9, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_abc348592dc9, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_abc348592dc9, p_Encrypt := p_Encrypt_abc348592dc9, p_EncryptionKeyID := p_EncryptionKeyID_abc348592dc9, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_abc348592dc9, p_SendEncryptedValue := p_SendEncryptedValue_abc348592dc9, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_abc348592dc9, p_IsSoftForeignKey := p_IsSoftForeignKey_abc348592dc9, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_abc348592dc9, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_abc348592dc9, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_abc348592dc9, p_JSONTypeDefinition := p_JSONTypeDefinition_abc348592dc9, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_abc348592dc9, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_abc348592dc9, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_abc348592dc9, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_abc348592dc9, p_IsComputed := p_IsComputed_abc348592dc9, p_EmbeddedRecord := p_EmbeddedRecord_abc348592dc9, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_abc348592dc9, p_Configuration_Clear := TRUE, p_ID := p_ID_abc348592dc9);
  END IF;
END $mj$;
