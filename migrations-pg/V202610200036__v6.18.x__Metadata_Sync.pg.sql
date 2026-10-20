-- =============================================================================================
-- PostgreSQL counterpart of V202610200036__v6.18.x__Metadata_Sync.sql -- BizApps Sales v6.18.x Metadata_Sync
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.6) on the push log the T-SQL file
--     was generated from. Each query record is a DO block that calls the core spUpdateQuery
--     function in whichever signature the host has (jsonb or named parameters). The entity record
--     calls spUpdateEntity with jsonb only: MJ 6.1.x defines that function only in its jsonb form.
--     Every parameter the T-SQL call passes as NULL carries a _Clear flag there, so the jsonb call,
--     which writes every key it is given, sets the same values.
--   * The converter rewrites T-SQL inside string literals, so every string value (the query SQL
--     above all, which stays T-SQL) is restored verbatim from the T-SQL file.
--   * Schema names use the same placeholders as the T-SQL file.
-- =============================================================================================

SET standard_conforming_strings = on;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_0a30949527b8 VARCHAR(255);
  p_CategoryID_0a30949527b8 UUID;
  p_UserQuestion_0a30949527b8 TEXT;
  p_Description_0a30949527b8 TEXT;
  p_SQL_0a30949527b8 TEXT;
  p_TechnicalDescription_0a30949527b8 TEXT;
  p_OriginalSQL_0a30949527b8 TEXT;
  p_Feedback_0a30949527b8 TEXT;
  p_Status_0a30949527b8 VARCHAR(15);
  p_QualityRank_0a30949527b8 INTEGER;
  p_ExecutionCostRank_0a30949527b8 INTEGER;
  p_UsesTemplate_0a30949527b8 BOOLEAN;
  p_AuditQueryRuns_0a30949527b8 BOOLEAN;
  p_CacheEnabled_0a30949527b8 BOOLEAN;
  p_CacheTTLMinutes_0a30949527b8 INTEGER;
  p_CacheMaxSize_0a30949527b8 INTEGER;
  p_EmbeddingVector_0a30949527b8 TEXT;
  p_EmbeddingModelID_0a30949527b8 UUID;
  p_CacheValidationSQL_0a30949527b8 TEXT;
  p_SQLDialectID_0a30949527b8 UUID;
  p_Reusable_0a30949527b8 BOOLEAN;
  p_ExternalDataSourceID_0a30949527b8 UUID;
  p_IsMaterialized_0a30949527b8 BOOLEAN;
  p_ID_0a30949527b8 UUID;
BEGIN
  p_Name_0a30949527b8 := 'Sales: Forecast History';
  p_CategoryID_0a30949527b8 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_0a30949527b8 := 'What did we think the forecast was on a past date, and how has it moved since?';
  p_Description_0a30949527b8 := 'Point-in-time forecast from ForecastSnapshot (master plan §9.4). A DIFFERENT QUESTION from "Sales: Forecast by Category", not a variant of it: reconstructing a past forecast from Deal is impossible, not merely inaccurate, because amounts change, dates move and deals get recategorised without the current row carrying what it used to say. CommitChangeSincePrior is the column a forecast review actually reads — not the level, but the movement.';
  p_SQL_0a30949527b8 := '-- Forecast history — what we THOUGHT the forecast was, on a past date. Master plan §9.4.
--
-- ══ THIS IS A DIFFERENT QUESTION FROM `forecast-by-category.sql`, NOT A VARIANT OF IT ═══════════
--
-- §9.4: "''What is the forecast'' and ''what did we think the forecast was on the 1st'' are different
-- queries. The first reads `Deal`; the second reads `ForecastSnapshot`."
--
-- The distinction is not stylistic. Reconstructing a past forecast from `Deal` is IMPOSSIBLE, not
-- merely inaccurate: amounts change, expected close dates move, deals are recategorised, and none of
-- those leave the current row carrying what it used to say. A forecast review that asks "we called
-- 4.2 million on the first — where did it go?" cannot be answered from live data at all.
--
-- So the answer has to be captured, not derived. The `Sales.CaptureForecastSnapshot` Action writes one
-- row per company × pipeline × owner × period, on a daily ScheduledJob. This query reads them.
--
-- THE ACTION IS THE WRITER (D-31): exactly one thing writes ForecastSnapshot, and
-- `scripts/capture-forecast-snapshot.sql` is a manual tool that is deliberately unseeded rather than a
-- second path. So "what grain do these rows have" is a question about WHICH QUERY THE ACTION READS.
--
-- It reads `Sales: Forecast by Owner` by default (D-32, #216), which groups by the deal''s owner stamp. So
-- both LAG windows below partition by a real OwnerEmployeeID and the Employee join projects OwnerName.
-- A NULL owner is an unassigned deal. Snapshots captured from `Sales: Forecast by Category` instead carry
-- OwnerEmployeeID = NULL meaning "across all owners", and render as one partition with no owner names.
--
-- It is a COMPANION rather than a widened `Forecast by Category` deliberately: that query is published,
-- the dashboard consumes it, and changing a report''s row shape to serve a second consumer is how one
-- consumer breaks another.
--
-- ══ THE COLUMN NAMES DIVERGE FROM THE MASTER PLAN, DELIBERATELY ════════════════════════════════
--
-- §9.5 lists the columns as `Commit` / `BestCase` / `Pipeline` / `Closed`. The shipped table has
-- `CommitAmount` / `BestCaseAmount` / `PipelineAmount` / `ClosedAmount`, and the shipped names are
-- authoritative — `docs/DECISIONS.md` D6. `COMMIT` is reserved in T-SQL and in Postgres, and
-- production is Postgres.
--
-- DATE DIMENSION: CapturedAt — when the picture was taken. PeriodStart/PeriodEnd describe which
-- period the snapshot was ABOUT, which is a different thing and is filtered separately.
--
-- CapturedOnOrBefore IS A BUSINESS DAY (#289). CapturedAt is a DATETIMEOFFSET and the parameter is
-- date-only, so comparing them directly put the bound at UTC midnight at the START of that day: "as
-- we saw it on the 1st" left out every snapshot taken on the 1st itself. The bound is now judged on
-- `[__mj_BizAppsCommon].[fnBusinessDayOf]()`, the business day of the instant — a function, not an
-- inline `AT TIME ZONE`, which MJ''s SQL parser cannot read (see deal-cycle-time.sql). The padded UTC
-- bound beside it (two days past the date) is wider than any zone offset and only lets an index on
-- CapturedAt narrow the scan.
SELECT
    fs.CapturedAt,
    fs.PeriodStart,
    fs.PeriodEnd,
    fs.CompanyID,
    co.Name                                     AS CompanyName,
    fs.PipelineID,
    p.Name                                      AS PipelineName,
    fs.OwnerEmployeeID,
    emp.FirstName + '' '' + emp.LastName          AS OwnerName,
    fs.CommitAmount,
    fs.BestCaseAmount,
    fs.PipelineAmount,
    fs.ClosedAmount,
    -- Movement since the PREVIOUS capture for the same slice. This is the column a forecast review
    -- actually reads: not the level, but the change, and where it came from.
    fs.CommitAmount - LAG(fs.CommitAmount) OVER (
        PARTITION BY fs.CompanyID, fs.PipelineID, fs.OwnerEmployeeID, fs.PeriodStart
        ORDER BY fs.CapturedAt
    )                                           AS CommitChangeSincePrior,
    fs.ClosedAmount - LAG(fs.ClosedAmount) OVER (
        PARTITION BY fs.CompanyID, fs.PipelineID, fs.OwnerEmployeeID, fs.PeriodStart
        ORDER BY fs.CapturedAt
    )                                           AS ClosedChangeSincePrior
FROM [__mj_BizAppsSales].ForecastSnapshot fs
LEFT OUTER JOIN [${mjSchema}].Company co  ON co.ID  = fs.CompanyID
LEFT OUTER JOIN [__mj_BizAppsSales].Pipeline p ON p.ID = fs.PipelineID
LEFT OUTER JOIN [${mjSchema}].Employee emp ON emp.ID = fs.OwnerEmployeeID
WHERE 1 = 1
  {% if CompanyID %}
  AND fs.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND fs.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  -- The period the snapshot is ABOUT.
  {% if PeriodStart %}
  AND fs.PeriodStart >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND fs.PeriodEnd <= {{ PeriodEnd | sqlString }}
  {% endif %}
  -- When the picture was TAKEN. "As we saw it on the 1st" is this filter, not the two above.
  {% if CapturedOnOrBefore %}
  AND fs.CapturedAt < DATEADD(day, 2, {{ CapturedOnOrBefore | sqlString }})
  AND [__mj_BizAppsCommon].[fnBusinessDayOf](fs.CapturedAt) <= {{ CapturedOnOrBefore | sqlString }}
  {% endif %}
ORDER BY
    fs.CapturedAt DESC, co.Name, p.Name;
';
  p_TechnicalDescription_0a30949527b8 := 'Grain: ForecastSnapshot, written by the Sales.CaptureForecastSnapshot Action on the Sales - Forecast Snapshot (daily) ScheduledJob. (scripts/capture-forecast-snapshot.sql is a manual tool, deliberately unseeded -- see its header.) Two independent date concepts: CapturedAt is when the picture was taken ("as we saw it on the 1st"), PeriodStart/PeriodEnd describe which period it was ABOUT — filtered separately because conflating them answers neither question. Column names are *Amount-suffixed, diverging from §9.5''s bare Commit/BestCase/Pipeline/Closed; the shipped names are authoritative per docs/DECISIONS.md D6, since COMMIT is reserved in T-SQL and Postgres and production is Postgres.';
  p_Status_0a30949527b8 := 'Approved';
  p_QualityRank_0a30949527b8 := 9;
  p_ExecutionCostRank_0a30949527b8 := 2;
  p_UsesTemplate_0a30949527b8 := TRUE;
  p_AuditQueryRuns_0a30949527b8 := FALSE;
  p_CacheEnabled_0a30949527b8 := FALSE;
  p_EmbeddingVector_0a30949527b8 := '[0.0035934557672590017,0.12378042936325073,-0.007328607141971588,-0.04287165403366089,-0.0128278573974967,-0.015458809211850166,0.04001140594482422,0.005732997786253691,-0.03127996250987053,0.02928507700562477,0.026858564466238022,-0.039666153490543365,0.02690623141825199,0.02995494194328785,-0.04475988820195198,-0.02434634044766426,0.04035608842968941,-0.005991621874272823,-0.05472142994403839,-0.001571320230141282,0.020733842626214027,-0.021620485931634903,-0.011517439037561417,-0.0006231694715097547,-0.04462519288063049,-0.010423419065773487,-0.022906119003891945,0.004968968685716391,-0.0221527311950922,-0.10959330946207047,0.006893358193337917,-0.01502081286162138,0.03349970281124115,-0.005398820154368877,0.0000025430263121961616,0.02462219074368477,-0.05922747403383255,-0.00030343301477842033,-0.009579936973750591,0.011593191884458065,0.019477004185318947,-0.061651811003685,0.010500903241336346,-0.009972555562853813,-0.0042286524549126625,0.0033062598668038845,-0.01855054683983326,0.034144241362810135,0.010266688652336597,0.0239709485322237,0.04121938347816467,-0.00760358851402998,-0.0376548245549202,-0.014785049483180046,-0.0012728649890050292,-0.061805691570043564,0.01149493083357811,-0.09994398057460785,-0.008662653155624866,-0.047234270721673965,-0.01598563976585865,-0.020594792440533638,0.006218001712113619,-0.032689303159713745,0.02812446467578411,0.0325145460665226,0.09484836459159851,-0.03053460456430912,-0.004207153804600239,-0.04584244266152382,0.09122154861688614,0.00428211921826005,-0.02774285152554512,-0.014772702008485794,-0.009548581205308437,-0.006671527866274118,-0.05393778532743454,-0.02787255495786667,0.0039466144517064095,-0.014376052655279636,0.006137767806649208,0.03855951875448227,-0.00785135943442583,0.005813890136778355,-0.04090902954339981,0.08575509488582611,-0.019145503640174866,-0.05169810354709625,-0.03418572619557381,-0.0029425150714814663,0.08873341232538223,-0.015597300603985786,-0.004995848052203655,-0.004915353376418352,-0.05678329989314079,0.01592663861811161,0.010765278711915016,0.0613272562623024,-0.02871699258685112,-0.013055764138698578,0.07836740463972092,0.02746814861893654,0.03270493820309639,0.010703637264668941,0.048230890184640884,0.06904914230108261,0.012762091122567654,-0.044301893562078476,-0.055273715406656265,0.02342521771788597,-0.01820344105362892,0.0044227177277207375,0.0036120926961302757,-0.015953481197357178,0.007677769288420677,-0.005421229172497988,0.020070143043994904,-0.005794737953692675,-0.033690258860588074,0.033243291079998016,0.067781463265419,-0.0040098754689097404,-0.06952642649412155,0.0018104955088347197,-0.04465446248650551,0.023821206763386726,-0.01126528438180685,-0.03877481073141098,0.007995781488716602,0.023435719311237335,-0.04333455488085747,-0.05945524945855141,0.006720725912600756,-0.017856596037745476,-0.0033047220204025507,-0.004090995527803898,0.011099405586719513,0.05059970170259476,-0.053952429443597794,-0.025103449821472168,-0.0009058873984031379,0.009776732884347439,0.0017621989827603102,0.04334866628050804,-0.04780985787510872,-0.03005463257431984,-0.010649872943758965,0.02630937285721302,0.01574687659740448,0.031409118324518204,-0.05206259712576866,-0.00523559283465147,-0.020974915474653244,-0.015991603955626488,-0.040660981088876724,-0.005666638724505901,0.03715481236577034,-0.00833332072943449,-0.01963580958545208,0.06246646121144295,-0.0014549220213666558,0.0035836214665323496,0.03777655214071274,-0.014017123728990555,-0.02082800678908825,-0.005967925302684307,-0.14283297955989838,0.02267892099916935,-0.11181731522083282,-0.007265509106218815,-0.02767365425825119,-0.050774600356817245,-0.00041819066973403096,-0.0012033877428621054,0.002866931026801467,0.014134815894067287,0.014111446216702461,0.07413501292467117,-0.004008141811937094,-0.0660446435213089,-0.031082620844244957,-0.05776665732264519,-0.020290980115532875,0.025547215715050697,0.005625351797789335,-0.02467465028166771,-0.05545847490429878,-0.06410292536020279,-0.010330560617148876,0.018479611724615097,0.011362163349986076,0.006984978914260864,-0.11429937183856964,-0.012800527736544609,-0.01646495796740055,-0.014559340663254261,0.0011990286875516176,0.06067947670817375,0.054105013608932495,0.035528577864170074,0.00257279584184289,0.026868922635912895,0.015722086653113365,0.06703338772058487,0.019059916958212852,-0.01621158793568611,-0.05004916340112686,-0.029615500941872597,-0.021357204765081406,0.038971107453107834,0.025409378111362457,0.015652714297175407,-0.07228897511959076,0.02282041124999523,-0.008747969754040241,0.034436989575624466,0.04736609011888504,0.040708549320697784,-0.058542054146528244,-0.02180061675608158,-0.03105410747230053,0.005990410223603249,0.0003087653312832117,0.0016037370078265667,0.07542046904563904,0.03842751681804657,0.015593498013913631,-0.030455641448497772,0.025245944038033485,-0.006161128636449575,-0.022143280133605003,0.013329504989087582,0.033537693321704865,0.0018773197662085295,0.033502109348773956,0.0829760953783989,-0.05539149045944214,0.06655921041965485,-0.007083996199071407,0.04259752854704857,-0.01094733364880085,-0.03288766369223595,-0.014477896504104137,0.01730380579829216,0.08223439007997513,-0.018099745735526085,-0.0294555202126503,-0.029887553304433823,0.006307085510343313,-0.00011450103193055838,-0.03649240732192993,0.033672165125608444,0.019054872915148735,-0.016931258141994476,-0.00457422761246562,0.01347640436142683,-0.11720595508813858,-0.001092988415621221,0.053493618965148926,0.06832235306501389,0.017810583114624023,-0.0008859119843691587,0.0171244814991951,-0.017517926171422005,-0.0024035971146076918,-0.036905113607645035,0.025116732344031334,0.03243464231491089,-0.017919417470693588,-0.00808762013912201,0.012938328087329865,0.018988458439707756,-0.021219205111265182,0.009140544570982456,-0.003384894924238324,0.06528916954994202,-0.032279472798109055,-0.04003370925784111,0.02864878438413143,-0.017672087997198105,0.022456476464867592,-0.005556780844926834,-0.007792504969984293,0.015678808093070984,0.01891627162694931,0.07029225677251816,0.05550304427742958,-0.01487786415964365,-0.02426838129758835,-0.10165109485387802,-0.03645894676446915,-0.041058499366045,-0.005800850223749876,-0.003608342260122299,-0.0245145782828331,-0.007894044741988182,-0.05467337369918823,0.04132850840687752,0.022937148809432983,0.03733230382204056,-0.028896193951368332,-0.020657846704125404,-0.028695670887827873,0.008516954258084297,-0.03079047240316868,0.01963203214108944,-0.007539925165474415,0.010905396193265915,-0.011068321764469147,0.0751819983124733,0.00008905609865905717,0.006023222580552101,0.011620619334280491,0.017267387360334396,-0.03549065440893173,-0.030498988926410675,-0.038602858781814575,0.03733526170253754,-0.054216187447309494,0.06867647916078568,0.011765004135668278,-0.013316038995981216,-0.024894898757338524,0.04298856854438782,0.013641523197293282,0.01057136245071888,-0.0017126237507909536,0.01063678227365017,-0.054440297186374664,-0.017461467534303665,0.000671206449624151,-0.07067234814167023,-0.005836484022438526,0.012742474675178528,-0.05059639364480972,-0.06246340274810791,0.010505487211048603,0.00045770424185320735,-0.014202741906046867,-0.007877754978835583,-0.021606558933854103,0.008755676448345184,-0.002328369300812483,-0.04984370246529579,-0.046640027314424515,-0.011812174692749977,0.027778320014476776,0.021544359624385834,-0.09607023745775223,0.03407558426260948,-0.012541788630187511,0.05095713213086128,-0.03963929042220116,-0.02958630584180355,0.006579418200999498,-0.08379339426755905,-0.027110790833830833,-0.04707007855176926,-0.014659102074801922,-0.097031369805336,-0.05414658039808273,0.022135138511657715,0.028169825673103333,0.021340668201446533,-0.012950843200087547,0.031118884682655334,0.010351421311497688,-0.005328794941306114,0.02922770008444786,0.01657775044441223,-0.04954858496785164,-0.0012894310057163239,-0.06290600448846817,0.03554196655750275,0.00664861686527729,-0.022144153714179993,0.02247321791946888,0.028767583891749382,0.016807863488793373,-0.02176629938185215,0.016667351126670837,0.041811130940914154,0.028089413419365883,0.03241725638508797,0.034521277993917465,0.001412457786500454,-0.07208395004272461,-0.054353486746549606,-0.03293696418404579,0.00827519316226244,-0.011907467618584633,0.06595467031002045,0.04123859480023384,-0.03147460147738457,-0.01625826582312584,0.004957539960741997,-0.024175120517611504,0.04640110209584236,0.02258860133588314,0.012040254659950733,0.03198866546154022,-0.06983745843172073,0.06373707205057144,0.00598845025524497,0.039192814379930496,-0.06845957785844803,0.03648115694522858,0.028758300468325615,-0.02859954908490181,-0.023849600926041603,-0.00035042481613345444,-0.028017817065119743,0.05485188215970993,-0.007829360663890839,0.007613809779286385,-0.016810834407806396,-0.007990177720785141,0.02483457885682583,0.02010563388466835,0.004331848584115505,0.05801285058259964,0.000055968514061532915,0.03776342049241066,-0.005425311159342527,0.01478989515453577,0.005853387527167797,0.016327498480677605,-0.051204878836870193,-0.004211570136249065,-0.01721521094441414,-0.004936717450618744,-0.01566397212445736,-0.04133172333240509,0.040716785937547684,-0.0017327186651527882,0.061499375849962234,0.00023458775831386447,0.012970631010830402,0.005970308091491461,0.0015393744688481092,0.00575393158942461,-0.001664518378674984,0.06947343051433563,-0.009882470592856407,-0.03617448732256889,0.01784546673297882,-0.01841966062784195,-0.012327400967478752,-0.017390303313732147,-0.004571403842419386,0.018055211752653122,-0.04567229002714157,0.01283777691423893,0.020821459591388702,0.03427863493561745,-0.03578121215105057,-0.03410101681947708,-0.0515136681497097,0.009011346846818924,0.04321117699146271,0.01699703373014927,0.028877204284071922,-0.04614732041954994,0.017594609409570694,0.06483057886362076,0.03538716584444046,0.027313923463225365,-0.018117578700184822,-0.01809225045144558,-0.01986071839928627,0.04053528606891632,0.003297929186373949,-0.010692618787288666,-0.005901367869228125,0.013159162364900112,0.02538897842168808,-0.009980479255318642,0.03438008576631546,-0.01377792563289404,-0.007297859061509371,-0.04729371890425682,0.04546409845352173,0.031764741986989975,-0.12208479642868042,-0.0016287112375721335,0.03326907381415367,-0.025929054245352745,-0.021889880299568176,-0.019119175150990486,-0.029347630217671394,0.04040028899908066,-0.022172892466187477,-0.041233472526073456,0.08926733583211899,-0.021826544776558876,0.012970633804798126,0.037757422775030136,-0.028523774817585945,0.07314207404851913,0.016656076535582542,-0.02437579073011875,0.006284208036959171,-0.006541144568473101,-0.10366928577423096,-0.039622411131858826,0.018042610958218575,0.03802446275949478,0.004023835528641939,-0.007032785098999739,0.009874512441456318,0.00822263304144144,-0.019174186512827873,-0.0580916553735733,-0.04684621840715408,0.008665873669087887,0.012984925881028175,-0.006832947488874197,0.010835288092494011,-0.028647560626268387,-0.0014114994555711746,0.009962263517081738,0.017809024080634117,0.03846750780940056,0.04423223063349724,0.02542443573474884,0.00015268215793184936,0.00006398335244739428,-0.02148030884563923,0.03785928711295128,0.02417517453432083,-0.05709722638130188,0.05403204262256622,0.004309077747166157,0.030686788260936737,-0.009096872061491013,-0.04631137475371361,-0.010590196587145329,-0.04390968754887581,0.047570765018463135,-0.03558269143104553,-0.06891526281833649,0.04200144112110138,0.13180947303771973,-0.0011335660237818956,-0.019526701420545578,-0.014925718307495117,-0.02911660447716713,-0.018886446952819824,0.006089765578508377,0.049699362367391586,0.034742794930934906,-0.030740346759557724,-0.03242719545960426,-0.004817273002117872,-0.061546120792627335,-7.420091357794757e-33,-0.03744528442621231,-0.003921124152839184,-0.01175727415829897,-0.08809929341077805,-0.023073509335517883,-0.007146254647523165,0.012769213877618313,-0.04730604588985443,0.024563565850257874,-0.024013053625822067,-0.04634568840265274,-0.011960724368691444,0.024702638387680054,-0.0020835211034864187,0.04806169494986534,0.01643916219472885,0.02594969980418682,-0.03620709851384163,0.008693280629813671,-0.0038475680630654097,0.03822031989693642,0.045735012739896774,0.04368668422102928,0.09996280074119568,-0.025123097002506256,0.04035911336541176,-0.016669366508722305,0.022270090878009796,0.008948099799454212,-0.04365590214729309,0.02059643156826496,-0.0633193850517273,0.0072266049683094025,-0.013150716200470924,-0.02857990935444832,-0.07292808592319489,0.0380365289747715,-0.01908261701464653,-0.033209893852472305,-0.03919511288404465,0.04411334916949272,0.0394735112786293,0.006151682697236538,0.03750428557395935,-0.02922140806913376,-0.028287755325436592,0.008354274556040764,-0.029037529602646828,-0.029426366090774536,-0.009374597109854221,0.04504808783531189,0.023440545424818993,-0.008360262028872967,0.01660859026014805,0.010217183269560337,0.05664472654461861,0.03834304213523865,0.0016626990400254726,-0.021649204194545746,0.015317550860345364,0.04220478609204292,0.01651339791715145,-0.013038041070103645,0.02521447092294693,0.0009498480358161032,0.03175405412912369,0.03971385210752487,-0.004250320605933666,0.021409496665000916,0.02596220001578331,-0.01850314997136593,0.016447454690933228,-0.007949781604111195,0.022700835019350052,0.07489380240440369,0.0046742260456085205,0.011108692735433578,0.0035378308966755867,-0.0008620590670034289,0.11129218339920044,0.048997003585100174,-0.011054778471589088,-0.004459140356630087,0.008893322199583054,0.029816625639796257,0.007218438200652599,-0.01923261769115925,0.02161506935954094,0.017799265682697296,0.004144230391830206,0.006361973937600851,0.0846821516752243,-0.026159808039665222,0.021102910861372948,-0.0252380408346653,0.026417631655931473,0.029870914295315742,-0.0010231983615085483,0.024661798030138016,0.0052854083478450775,-0.05983128026127815,0.0038519061636179686,0.031098593026399612,0.025562139227986336,-0.00898821372538805,0.024172598496079445,0.05866334214806557,0.02795880287885666,-0.0462653711438179,-0.0093288104981184,0.005213215481489897,0.033973801881074905,-0.0028267588932067156,-0.00802271906286478,0.043794866651296616,-0.0409201942384243,0.0008848818251863122,0.020178938284516335,-0.02847280167043209,0.023423954844474792,0.025676339864730835,0.1109493151307106,0.031033001840114594,0.010993008501827717,0.014328948222100735,-0.02462317794561386,0.03152495622634888,-0.0809168666601181,-0.0280093252658844,0.017060687765479088,0.008288007229566574,0.016799168661236763,3.32081668830142e-7,-0.029755664989352226,0.005640588700771332,0.013181624002754688,0.02732369862496853,0.034845512360334396,0.024480825290083885,-0.0480731837451458,0.006224348209798336,0.022426044568419456,0.028994733467698097,0.040593221783638,-0.056775566190481186,0.03304624557495117,0.048057034611701965,0.028159325942397118,-0.05397980287671089,-0.06340658664703369,0.013186278752982616,-0.05245380848646164,-0.015483292751014233,0.04406481236219406,0.011463949456810951,0.041094426065683365,-0.0022142392117530107,0.012581798247992992,-0.0014940636465325952,-0.01229466125369072,-0.0893191322684288,-0.026433559134602547,-0.019294168800115585,0.04584996774792671,-0.0011172398226335645,0.006038484629243612,-0.04479936510324478,-0.01610967516899109,-0.004907058551907539,-0.055791910737752914,0.010584349744021893,0.011443889699876308,-0.009563476778566837,-0.009687152691185474,0.0029748843517154455,-0.027809739112854004,-0.006721945479512215,0.0031102714128792286,-0.031069764867424965,-0.004562989342957735,-0.02223990112543106,-0.061396390199661255,0.024638770148158073,-0.006187632214277983,0.014959113672375679,0.01650153286755085,0.010027159005403519,0.022372324019670486,0.038155317306518555,-0.007082348223775625,0.01342977024614811,0.06159566342830658,-0.023178573697805405,-0.020543169230222702,0.0007392572588287294,0.010822632350027561,0.054966963827610016,-0.010064679197967052,-0.0667232871055603,0.01949843019247055,2.97205494300554e-34,0.03889469429850578,0.027995888143777847,0.001979836029931903,-0.046302758157253265,0.036411747336387634,-0.004683345090597868,0.0981251671910286,-0.03219885006546974,-0.00034572629374451935,-0.015309124253690243,-0.04231477901339531]';
  p_EmbeddingModelID_0a30949527b8 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_0a30949527b8 := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_0a30949527b8 := FALSE;
  p_IsMaterialized_0a30949527b8 := FALSE;
  p_ID_0a30949527b8 := '5A1E5000-0001-4000-A000-00000000000C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_0a30949527b8,
    'CategoryID', p_CategoryID_0a30949527b8,
    'UserQuestion', p_UserQuestion_0a30949527b8,
    'Description', p_Description_0a30949527b8,
    'SQL', p_SQL_0a30949527b8,
    'TechnicalDescription', p_TechnicalDescription_0a30949527b8,
    'OriginalSQL', p_OriginalSQL_0a30949527b8,
    'Feedback', p_Feedback_0a30949527b8,
    'Status', p_Status_0a30949527b8,
    'QualityRank', p_QualityRank_0a30949527b8,
    'ExecutionCostRank', p_ExecutionCostRank_0a30949527b8,
    'UsesTemplate', p_UsesTemplate_0a30949527b8,
    'AuditQueryRuns', p_AuditQueryRuns_0a30949527b8,
    'CacheEnabled', p_CacheEnabled_0a30949527b8,
    'CacheTTLMinutes', p_CacheTTLMinutes_0a30949527b8,
    'CacheMaxSize', p_CacheMaxSize_0a30949527b8,
    'EmbeddingVector', p_EmbeddingVector_0a30949527b8,
    'EmbeddingModelID', p_EmbeddingModelID_0a30949527b8,
    'CacheValidationSQL', p_CacheValidationSQL_0a30949527b8,
    'SQLDialectID', p_SQLDialectID_0a30949527b8,
    'Reusable', p_Reusable_0a30949527b8,
    'ExternalDataSourceID', p_ExternalDataSourceID_0a30949527b8,
    'IsMaterialized', p_IsMaterialized_0a30949527b8,
    'ID', p_ID_0a30949527b8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_0a30949527b8, p_CategoryID := p_CategoryID_0a30949527b8, p_UserQuestion := p_UserQuestion_0a30949527b8, p_Description := p_Description_0a30949527b8, p_SQL := p_SQL_0a30949527b8, p_TechnicalDescription := p_TechnicalDescription_0a30949527b8, p_OriginalSQL := p_OriginalSQL_0a30949527b8, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_0a30949527b8, p_Feedback_Clear := TRUE, p_Status := p_Status_0a30949527b8, p_QualityRank := p_QualityRank_0a30949527b8, p_ExecutionCostRank := p_ExecutionCostRank_0a30949527b8, p_UsesTemplate := p_UsesTemplate_0a30949527b8, p_AuditQueryRuns := p_AuditQueryRuns_0a30949527b8, p_CacheEnabled := p_CacheEnabled_0a30949527b8, p_CacheTTLMinutes := p_CacheTTLMinutes_0a30949527b8, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_0a30949527b8, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_0a30949527b8, p_EmbeddingModelID := p_EmbeddingModelID_0a30949527b8, p_CacheValidationSQL := p_CacheValidationSQL_0a30949527b8, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_0a30949527b8, p_Reusable := p_Reusable_0a30949527b8, p_ExternalDataSourceID := p_ExternalDataSourceID_0a30949527b8, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_0a30949527b8, p_ID := p_ID_0a30949527b8);
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_6c1b11af9065 VARCHAR(255);
  p_CategoryID_6c1b11af9065 UUID;
  p_UserQuestion_6c1b11af9065 TEXT;
  p_Description_6c1b11af9065 TEXT;
  p_SQL_6c1b11af9065 TEXT;
  p_TechnicalDescription_6c1b11af9065 TEXT;
  p_OriginalSQL_6c1b11af9065 TEXT;
  p_Feedback_6c1b11af9065 TEXT;
  p_Status_6c1b11af9065 VARCHAR(15);
  p_QualityRank_6c1b11af9065 INTEGER;
  p_ExecutionCostRank_6c1b11af9065 INTEGER;
  p_UsesTemplate_6c1b11af9065 BOOLEAN;
  p_AuditQueryRuns_6c1b11af9065 BOOLEAN;
  p_CacheEnabled_6c1b11af9065 BOOLEAN;
  p_CacheTTLMinutes_6c1b11af9065 INTEGER;
  p_CacheMaxSize_6c1b11af9065 INTEGER;
  p_EmbeddingVector_6c1b11af9065 TEXT;
  p_EmbeddingModelID_6c1b11af9065 UUID;
  p_CacheValidationSQL_6c1b11af9065 TEXT;
  p_SQLDialectID_6c1b11af9065 UUID;
  p_Reusable_6c1b11af9065 BOOLEAN;
  p_ExternalDataSourceID_6c1b11af9065 UUID;
  p_IsMaterialized_6c1b11af9065 BOOLEAN;
  p_ID_6c1b11af9065 UUID;
BEGIN
  p_Name_6c1b11af9065 := 'Sales: Slipped Deals';
  p_CategoryID_6c1b11af9065 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_6c1b11af9065 := 'Which deals had their expected close date moved, by how much, and are they still open?';
  p_Description_6c1b11af9065 := 'Deals whose expected close date moved (master plan §9.3 measure 8). Deals pulled FORWARD are kept rather than filtered out, because a report that only ever shows bad news is one people learn to discount.';
  p_SQL_6c1b11af9065 := '-- Slippage — deals whose expected close date MOVED. Master plan §9.3, measure 8.
--
-- ── WHERE THE HISTORY COMES FROM, BECAUSE IT IS NOT WHERE YOU WOULD LOOK FIRST ──────────────────
--
-- §9.3 defines slippage as "deals whose expected close moved", which needs the PREVIOUS value of
-- ExpectedCloseDate. `Deal` holds only the current one, and `DealStageEvent` stamps amount and
-- probability at transition but not dates — so the obvious two sources cannot answer this.
--
-- MJ''s own audit trail can. `Entity.TrackRecordChanges` is 1 on Deals, so every update writes a
-- `__mj.RecordChange` row whose `ChangesJSON` carries `{"Field":{"field","oldValue","newValue"}}` per
-- changed column. That is a real, already-working source of exactly this fact, and it means slippage
-- needs no new column and no new stamp — a conclusion worth recording, because the alternative
-- reading is that the schema is missing something.
--
-- ── HOW THIS WAS FOUND, BECAUSE THE FAILURE SHAPE IS WORTH KNOWING ─────────────────────────────
--
-- The first version of this query joined `d.ID = rc.RecordID` directly and was reported as running
-- clean. It was not: it was measured over data where NO row qualified, so the conversion was never
-- attempted. The moment a real expected-close date moved, the same statement died with Msg 8169.
--
-- A statement that is clean over an empty set and fatal over a populated one is the shape to hunt in
-- anything that joins, converts or casts. `test-harnesses/verify-queries.mjs` now exercises every
-- query against data that reaches its joins, for exactly this reason.
--
-- The one thing it depends on: RecordChange rows survive. They are audit data, so nothing prunes them
-- today, but a retention policy on that table would silently shorten this report''s history rather
-- than break it. Worth knowing before someone adds one.
--
-- DATE DIMENSION: RecordChange.ChangedAt — when the slip was RECORDED, which is the only date that
-- answers "how much slipped this month". The dates being moved FROM and TO are reported as values.
--
-- THE PERIOD IS IN BUSINESS DAYS (#289). ChangedAt is a DATETIMEOFFSET and PeriodStart/PeriodEnd are
-- date-only, so comparing them directly put both bounds at UTC midnight: a slip recorded on the last
-- evening of the period (after 6 PM Central, 7 PM in daylight time) fell out, and one from the evening
-- before the period fell in. Each bound is now judged on `[__mj_BizAppsCommon].[fnBusinessDayOf]()`,
-- the business day of the instant — a function, not an inline `AT TIME ZONE`, which MJ''s SQL parser
-- cannot read (see deal-cycle-time.sql). The padded UTC range beside it (a day before the start, two
-- after the end) is wider than any zone offset and only lets an index on ChangedAt narrow the scan.
--
-- EVERY JSON_VALUE SITS INSIDE `CASE WHEN ISJSON(...) = 1`. SQL Server does not evaluate a WHERE
-- clause left to right: the plan may run JSON_VALUE before the ISJSON test or the join to Deals has
-- removed a row. RecordChange holds ChangesJSON that is not JSON — MJ core''s own migrations leave
-- entries cut off at 4,000 characters, and orders writes some too — and one such row anywhere in the
-- table failed the whole query with Msg 13609. A CASE is evaluated in order, so the guard holds
-- whatever plan is chosen.
--
-- POSITIVE DAYS = SLIPPED LATER, which is the case people mean. A negative figure is a deal PULLED
-- FORWARD and is kept rather than filtered, because a report that only ever shows bad news is one
-- people learn to discount.
WITH slips AS (
    SELECT
        /**
         * THE DEAL ID, PARSED OUT OF A COMPOSITE KEY STRING.
         *
         * `RecordChange.RecordID` is NVARCHAR and holds MJ''s composite-key encoding -- for a
         * single-column primary key that is `ID|<guid>`, e.g. `ID|261709E2-7106-43B0-9CB9-...`. It is
         * NOT a bare guid, and joining it straight to `Deal.ID` is fatal: SQL Server converts toward
         * uniqueidentifier and raises
         *
         *     Msg 8169 -- Conversion failed when converting from a character string to uniqueidentifier
         *
         * TRY_CONVERT, not CONVERT, and that is the load-bearing half. A row whose key does not parse
         * yields NULL and drops out of the join; with plain CONVERT it would kill the whole statement.
         * Composite keys with more than one column encode as `A|1|B|2`, which is not this table''s
         * shape today but is exactly the input that would otherwise turn a report into an outage.
         */
        TRY_CONVERT(UNIQUEIDENTIFIER, SUBSTRING(rc.RecordID, CHARINDEX(''|'', rc.RecordID) + 1, 36)) AS DealID,
        rc.ChangedAt,
        TRY_CONVERT(DATE, CASE WHEN ISJSON(rc.ChangesJSON) = 1
                               THEN JSON_VALUE(rc.ChangesJSON, ''$.ExpectedCloseDate.oldValue'') END) AS FromDate,
        TRY_CONVERT(DATE, CASE WHEN ISJSON(rc.ChangesJSON) = 1
                               THEN JSON_VALUE(rc.ChangesJSON, ''$.ExpectedCloseDate.newValue'') END) AS ToDate
    FROM [${mjSchema}].RecordChange rc
    INNER JOIN [${mjSchema}].Entity e
            ON e.ID = rc.EntityID
           AND e.Name = ''MJ_BizApps_Sales: Deals''
    WHERE rc.Type = ''Update''
      AND ISJSON(rc.ChangesJSON) = 1
      AND CASE WHEN ISJSON(rc.ChangesJSON) = 1
               THEN JSON_VALUE(rc.ChangesJSON, ''$.ExpectedCloseDate.field'') END IS NOT NULL
      {% if PeriodStart %}
      AND rc.ChangedAt >= DATEADD(day, -1, {{ PeriodStart | sqlString }})
      AND [__mj_BizAppsCommon].[fnBusinessDayOf](rc.ChangedAt) >= {{ PeriodStart | sqlString }}
      {% endif %}
      {% if PeriodEnd %}
      AND rc.ChangedAt < DATEADD(day, 2, {{ PeriodEnd | sqlString }})
      AND [__mj_BizAppsCommon].[fnBusinessDayOf](rc.ChangedAt) <= {{ PeriodEnd | sqlString }}
      {% endif %}
)
SELECT
    d.ID                                        AS DealID,
    d.DealNumber,
    d.Name                                      AS DealName,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    d.PipelineStage                             AS StageName,
    d.OwnerEmployee                             AS OwnerName,
    d.Amount,
    d.AmountIsComputed,
    st.IsOpen                                   AS IsStillOpen,
    COUNT(*)                                    AS SlipCount,
    MIN(s.FromDate)                             AS EarliestExpected,
    MAX(s.ToDate)                               AS CurrentExpected,
    -- Net movement across every slip in the window: where it was first expected, versus where it
    -- ended up. Summing each individual slip would double-count a deal moved twice in one direction.
    DATEDIFF(day, MIN(s.FromDate), MAX(s.ToDate)) AS NetDaysSlipped,
    MAX(s.ChangedAt)                            AS LastSlippedAt
FROM slips s
INNER JOIN [__mj_BizAppsSales].vwDeals d
        ON d.ID = s.DealID
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
WHERE s.DealID IS NOT NULL
  AND s.FromDate IS NOT NULL
  AND s.ToDate IS NOT NULL
  AND s.FromDate <> s.ToDate
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if OpenOnly == "true" %}
  AND st.IsOpen = 1
  {% endif %}
GROUP BY
    d.ID, d.DealNumber, d.Name, d.CompanyID, d.Company, d.PipelineID, d.Pipeline,
    d.PipelineStage, d.OwnerEmployee, d.Amount, d.AmountIsComputed, st.IsOpen
ORDER BY
    NetDaysSlipped DESC, d.Amount DESC;
';
  p_TechnicalDescription_6c1b11af9065 := 'Grain: Deal, sourced from __mj.RecordChange. Neither Deal nor DealStageEvent holds the previous ExpectedCloseDate, so the history comes from MJ''s own audit trail: Entity.TrackRecordChanges is 1 on Deals and ChangesJSON carries {"Field":{"field","oldValue","newValue"}} per changed column, read with JSON_VALUE. This means slippage needs no new column and no new stamp. It does depend on RecordChange rows surviving — a retention policy on that table would silently shorten this report''s history rather than break it. Date dimension: RecordChange.ChangedAt (when the slip was recorded). NetDaysSlipped compares earliest-from to latest-to, so a deal moved twice the same way is not counted twice.';
  p_Status_6c1b11af9065 := 'Approved';
  p_QualityRank_6c1b11af9065 := 8;
  p_ExecutionCostRank_6c1b11af9065 := 4;
  p_UsesTemplate_6c1b11af9065 := TRUE;
  p_AuditQueryRuns_6c1b11af9065 := FALSE;
  p_CacheEnabled_6c1b11af9065 := FALSE;
  p_EmbeddingVector_6c1b11af9065 := '[-0.00649840384721756,0.06354920566082001,0.007675152271986008,-0.010545003227889538,-0.015879813581705093,-0.02950541488826275,0.014115551486611366,-0.020451145246624947,-0.006625291891396046,0.01813005842268467,0.03633018210530281,0.04641103371977806,-0.0035293791443109512,0.059797514230012894,-0.04263390600681305,0.0002215420245192945,0.041371650993824005,-0.007628154940903187,-0.03509622812271118,-0.007583156228065491,0.008363155648112297,0.003294150112196803,-0.04001384600996971,-0.009111844934523106,0.008454928174614906,0.01729082316160202,-0.027455460280179977,-0.006043981295078993,0.020712215453386307,-0.07990648597478867,0.044229768216609955,0.027249915525317192,-0.0006897957064211369,0.005783989559859037,0.00000257375609180599,-0.01569116860628128,-0.02891935035586357,-0.046716902405023575,-0.03898393362760544,0.0005996316322125494,-0.03775918856263161,-0.1129387766122818,0.01468243170529604,-0.011554512195289135,-0.0046317619271576405,-0.041366904973983765,-0.013581923209130764,-0.0065751164220273495,-0.0040664030238986015,0.03372397646307945,0.01415359415113926,0.022135775536298752,-0.038411349058151245,-0.006270579062402248,0.016316426917910576,-0.057449087500572205,0.036330197006464005,-0.12528610229492188,-0.02254091389477253,-0.061716243624687195,-0.039938487112522125,0.008394859731197357,-0.015414010733366013,-0.03643202781677246,-0.0029631874058395624,0.03509265184402466,-0.07238207757472992,-0.002305583795532584,-0.0515453927218914,-0.044371407479047775,0.03499704226851463,0.01177054550498724,-0.042357660830020905,-0.1381784826517105,-0.035227321088314056,-0.02092425711452961,-0.029553474858403206,-0.0005412846803665161,0.023998940363526344,0.006437978241592646,-0.07989971339702606,0.03779646381735802,0.009924587793648243,0.0018562190234661102,-0.01854311302304268,0.07155671715736389,-0.02418101765215397,-0.035906825214624405,-0.013110251165926456,0.03517966344952583,0.04234154894948006,0.011591131798923016,0.00003848080450552516,-0.048191990703344345,0.019610950723290443,0.010143747553229332,-0.008635761216282845,0.04233802109956741,-0.038739901036024094,-0.06875469535589218,-0.03851357847452164,0.021953903138637543,-0.0011499477550387383,0.023730283603072166,0.060788534581661224,-0.041596412658691406,0.0038206973113119602,-0.01860850118100643,-0.02587018348276615,0.06267588585615158,0.005880664102733135,-0.008336199447512627,0.0062368884682655334,0.027282966300845146,-0.02394094318151474,-0.031739313155412674,0.008755513466894627,0.012884308584034443,-0.00539172301068902,-0.018650032579898834,0.007959457114338875,0.013070054352283478,-0.05343630537390709,-0.01903044432401657,-0.0594838485121727,0.02882097102701664,0.03510179743170738,0.01082915160804987,0.018707815557718277,0.04402150958776474,-0.03748220577836037,-0.052002813667058945,0.021305866539478302,-0.024857262149453163,-0.012882722541689873,-0.05815776437520981,-0.0008083861321210861,0.007012003567069769,-0.06831420212984085,0.005682563874870539,-0.016649529337882996,0.07099955528974533,0.01973067782819271,0.06472641974687576,-0.013756105676293373,-0.019360531121492386,-0.024791551753878593,0.022129002958536148,0.0017976267263293266,0.01569160632789135,-0.03789028525352478,0.007339875679463148,0.00951295718550682,0.007891171611845493,-0.05609127879142761,-0.015303516760468483,-0.00844117533415556,-0.0027388320304453373,-0.001904257107526064,0.05849854275584221,-0.007791024167090654,-0.07088521867990494,-0.0019856258295476437,0.03146524727344513,0.00378565420396626,0.007877389900386333,0.05450303480029106,-0.006754591595381498,-0.024732284247875214,-0.011968182399868965,-0.014477712102234364,-0.043280672281980515,0.010393630713224411,-0.04293053597211838,-0.001992921344935894,-0.042451754212379456,-0.048053909093141556,0.06322500854730606,-0.01892472617328167,-0.018055472522974014,-0.06322595477104187,-0.004751418251544237,-0.037301987409591675,-0.017111066728830338,-0.004844417329877615,-0.0610569529235363,-0.04656559228897095,-0.03577147424221039,0.015728188678622246,0.03777897357940674,0.02462030202150345,0.009754796512424946,0.020183037966489792,0.005435248836874962,-0.0410006120800972,-0.0070121209137141705,-0.025910034775733948,0.06748121976852417,0.04208951070904732,0.054137203842401505,-0.017192566767334938,0.013455834239721298,-0.03068426065146923,0.047779422253370285,-0.0037331911735236645,-0.011999242939054966,-0.06725610792636871,0.00927168782800436,0.000874002871569246,0.015384380705654621,0.050330232828855515,0.01623610407114029,-0.021119289100170135,0.001481265644542873,-0.008218513801693916,0.008312399499118328,0.038373805582523346,0.025980034843087196,-0.0635889396071434,0.0194101445376873,-0.012583918869495392,0.03064042143523693,0.0012778082164004445,0.009901990182697773,0.08216696977615356,0.03524770215153694,0.025233091786503792,-0.00891689583659172,-0.015090090222656727,-0.05304400995373726,0.03618810698390007,-0.017278436571359634,0.023680465295910835,-0.013155546970665455,0.03986180201172829,0.047887470573186874,-0.028269924223423004,0.00926742423325777,0.05159143730998039,0.08992407470941544,-0.013827593065798283,0.023120606318116188,-0.0545511357486248,-0.001534927636384964,0.0487222746014595,0.004546545445919037,-0.022388646379113197,-0.03172394260764122,0.0004677937540691346,0.013482482172548771,-0.025410691276192665,0.04176081717014313,0.03811498358845711,-0.02858123555779457,-0.005184076260775328,0.012794370763003826,-0.09283798187971115,0.06591711193323135,0.07681483775377274,0.017272036522626877,0.04519378021359444,-0.004851935897022486,-0.007568643428385258,-0.013213707134127617,-0.035512711852788925,-0.026657989248633385,0.0387146957218647,0.04576904699206352,-0.0327400378882885,0.03834344819188118,0.020236793905496597,0.006252582650631666,0.013405282981693745,-0.03433654084801674,0.02093963697552681,0.084520123898983,-0.017838425934314728,-0.04876961186528206,0.009367009624838829,-0.005165912676602602,0.021374858915805817,0.05470515042543411,-0.011535977013409138,0.009702999144792557,0.017376363277435303,0.037738919258117676,-0.0230787955224514,-0.04004886373877525,-0.06368765980005264,-0.019058190286159515,-0.042844559997320175,-0.03475283458828926,0.009268097579479218,0.02817770279943943,-0.06429440528154373,0.004395386204123497,-0.008728341199457645,-0.009225059300661087,-0.010579532943665981,0.02064904011785984,-0.004127840045839548,0.02032831311225891,-0.061177924275398254,0.008161242119967937,0.023483211174607277,0.0022908318787813187,-0.026866411790251732,0.055259063839912415,-0.007468900177627802,0.0005757485050708055,0.007247462403029203,0.012525861151516438,-0.041935816407203674,-0.013453710824251175,-0.043261680752038956,-0.028089508414268494,0.03048878163099289,0.028636110946536064,-0.09245102852582932,0.07535756379365921,-0.016434988006949425,-0.02776140719652176,0.02027386985719204,0.06843338906764984,0.0008851481252349913,-0.0305168516933918,0.010314074344933033,-0.013235291466116905,0.0221725907176733,-0.09394308924674988,-0.005773684475570917,-0.02866910956799984,-0.04121709614992142,-0.03959817439317703,-0.04715544357895851,-0.018603716045618057,0.005264968611299992,0.029278088361024857,-0.02851790003478527,0.04629760608077049,-0.022126561030745506,0.0005987550248391926,0.019615311175584793,-0.1266563981771469,-0.04774077236652374,-0.04093446955084801,0.06042230501770973,0.06112576276063919,-0.07365162670612335,0.010947261936962605,-0.0880553275346756,0.0026405341923236847,0.008645361289381981,-0.01713772490620613,0.01791193336248398,-0.08116530627012253,-0.0010820082388818264,-0.034434303641319275,-0.03590702265501022,-0.07182364165782928,-0.025729963555932045,0.0035209334455430508,-0.030218813568353653,0.023902652785182,-0.013803353533148766,0.0105493338778615,0.017863474786281586,0.02455591969192028,0.012082326225936413,-0.031076760962605476,-0.029124515131115913,-0.013740562833845615,0.011950697749853134,0.015932781621813774,0.0036955110263079405,-0.004914276767522097,0.0093964459374547,-0.04668999835848808,0.06964186578989029,0.00019815514679066837,-0.008214376866817474,0.012789341621100903,0.053888700902462006,0.02019260823726654,0.07276973873376846,0.026838524267077446,-0.06294050067663193,-0.0062299431301653385,-0.044359881430864334,0.0626644492149353,-0.017661944031715393,0.03279179334640503,0.03174704685807228,0.0312198493629694,0.0006695709889754653,0.012458237819373608,-0.011338531039655209,0.04796673730015755,-0.020785151049494743,0.0014402592787519097,0.050773315131664276,-0.01836954429745674,0.05899403989315033,0.0027369565796107054,0.04383460059762001,-0.05148324370384216,-0.030154652893543243,-0.04208490252494812,-0.031367432326078415,-0.012188353575766087,0.037694867700338364,0.038637660443782806,0.04358430579304695,-0.04643987864255905,0.05642573535442352,0.029919331893324852,-0.009819461032748222,-0.004000200890004635,-0.006967856083065271,0.0663449764251709,0.02124706469476223,0.003301153890788555,0.02470441162586212,-0.014281945303082466,-0.11567951738834381,-0.010087104514241219,-0.0013637145748361945,-0.020125364884734154,0.006940659135580063,-0.02423008903861046,-0.022222809493541718,0.048888612538576126,-0.018130294978618622,0.058716244995594025,0.0594453290104866,0.019636129960417747,0.0068310219794511795,-0.010361304506659508,-0.05081258341670036,0.011410640552639961,-0.043456804007291794,0.019072627648711205,0.06827651709318161,0.03718847408890724,0.021966643631458282,0.043004345148801804,-0.00878416933119297,-0.013912664726376534,-0.01482494454830885,-0.009749541990458965,-0.02279905043542385,0.01943822018802166,0.04725448414683342,0.01831698976457119,0.021573735401034355,-0.010080130770802498,0.023067371919751167,-0.07296956330537796,-0.011028639040887356,-0.02229631505906582,0.0014380522770807147,0.00530606135725975,-0.011636613868176937,0.035365086048841476,0.042396463453769684,-0.06259973347187042,-0.044512346386909485,-0.042167723178863525,0.02045993134379387,0.029541928321123123,0.03956697881221771,-0.021138964220881462,-0.03364326059818268,-0.006261150818318129,-0.02122359722852707,0.020999565720558167,-0.0056614261120557785,0.025548677891492844,0.08414499461650848,0.037919845432043076,-0.004353714175522327,0.030682040378451347,-0.019346000626683235,-0.05633830651640892,-0.05357975512742996,0.04896514117717743,0.02052224613726139,-0.01340869627892971,-0.028846872970461845,0.040709007531404495,0.06596116721630096,-0.025562681257724762,-0.05229366198182106,0.052607789635658264,0.010898868553340435,0.04822197183966637,-0.016725873574614525,-0.007415693253278732,0.009124425239861012,0.021810298785567284,0.02055460773408413,0.029305629432201385,0.01468114834278822,-0.04896638169884682,-0.02395373396575451,0.04164878651499748,0.043629370629787445,0.0025583270471543074,0.044148679822683334,-0.004524651449173689,0.04458572715520859,-0.07074043154716492,0.05884057655930519,-0.052561331540346146,0.024556074291467667,0.037561602890491486,-0.016919657588005066,0.03704801946878433,0.010687545873224735,0.02907189540565014,0.011105096898972988,0.00952796172350645,-0.006100403610616922,0.009475069120526314,0.02294008620083332,-0.017794135957956314,-0.016905944794416428,-0.008239923045039177,0.04362546280026436,-0.02660839445888996,-0.08088778704404831,0.07201289385557175,-0.014585964381694794,0.06891433894634247,0.016725879162549973,-0.016044003888964653,0.007510684430599213,0.003285070415586233,0.01999175176024437,-0.038574110716581345,-0.03115384839475155,0.04948887974023819,0.07194669544696808,-0.012045305222272873,0.0012858412228524685,0.017792489379644394,-0.03212357312440872,-0.005058384966105223,-0.010180894285440445,0.019181037321686745,0.004216969013214111,-0.00026339845499023795,0.02603999339044094,-0.022779148072004318,-0.055452484637498856,-7.692286625619258e-33,0.004145998973399401,0.046462297439575195,0.02789481170475483,-0.052205733954906464,-0.00878344476222992,-0.043938048183918,0.005785172805190086,-0.003857684787362814,0.01537596806883812,0.020384440198540688,0.024746142327785492,0.03796713426709175,0.018151838332414627,-0.023243671283125877,0.06995084136724472,-0.04607854783535004,0.00001463138141843956,-0.036339182406663895,0.010998074896633625,0.0008826203411445022,-0.08961381018161774,0.061496175825595856,0.06156224012374878,0.007657137233763933,-0.04505571722984314,0.00501196039840579,-0.005418145563453436,-0.0007112897583283484,0.009991047903895378,-0.07934047281742096,0.018842389807105064,-0.04507872834801674,0.004051803145557642,-0.03189226984977722,-0.02821275405585766,-0.0869961827993393,0.05154508352279663,0.01317728590220213,0.012023468501865864,0.0007796314312145114,0.07283714413642883,0.022181900218129158,-0.002233146457001567,0.03632761910557747,-0.00818965770304203,-0.011592002585530281,0.0231307465583086,-0.012155622243881226,-0.004613717086613178,0.0520755797624588,0.07617500424385071,0.02647555246949196,-0.031713422387838364,0.004383054096251726,-0.03597700968384743,0.06987455487251282,0.052353229373693466,-0.0063817910850048065,0.02745906449854374,0.04942597448825836,-0.04872341454029083,0.013455149717628956,-0.008299200795590878,-0.04352262616157532,-0.0033998882863670588,0.04915286600589752,-0.0517420768737793,0.04420393332839012,0.031111689284443855,0.051026325672864914,-0.015033124946057796,0.0861922949552536,-0.06047311797738075,-0.027907002717256546,-0.016445763409137726,-0.04799342155456543,0.0367433987557888,0.01102574821561575,-0.02629246562719345,-0.007047578226774931,-0.0076812924817204475,0.018240738660097122,-0.039792004972696304,-0.029508473351597786,0.05129927024245262,0.08877904713153839,0.0016688533360138535,0.010205916129052639,0.035580676048994064,0.0002897022641263902,-0.014855176210403442,0.06408882141113281,-0.02228523977100849,0.01925809495151043,-0.014548925682902336,-0.02923172526061535,0.01370290294289589,0.042622391134500504,-0.030951067805290222,-0.0020574545487761497,-0.035177502781152725,0.0027817750815302134,0.019743992015719414,-0.01703345775604248,0.0063276649452745914,-0.003418763866648078,-0.03798200935125351,0.047865130007267,-0.019382910802960396,-0.0038084229454398155,0.011931419372558594,0.021488390862941742,0.035961657762527466,-0.06723064929246902,0.001963528338819742,-0.048031434416770935,0.010187261737883091,-0.045519910752773285,0.032517220824956894,-0.009106293320655823,-0.008494512178003788,0.03911827132105827,0.021591998636722565,0.04550883546471596,-0.003843587124720216,-0.011200356297194958,0.06357745081186295,-0.012658401392400265,-0.032134056091308594,0.008327105082571507,-0.006937213242053986,0.041954878717660904,3.300239654890902e-7,0.042902011424303055,-0.0050903186202049255,-0.007094500120729208,0.030398281291127205,-0.004194505512714386,-0.04536231607198715,-0.05655275285243988,0.03376132249832153,0.011435629799962044,0.014539171941578388,0.04200286418199539,-0.04400253668427467,0.038030363619327545,0.010512085631489754,-0.021517692133784294,0.03711636736989021,-0.0012522706529125571,-0.0188791174441576,-0.06372876465320587,-0.03707423061132431,0.04795609042048454,0.03538112714886665,0.011269171722233295,0.032911594957113266,0.012718364596366882,-0.025823429226875305,-0.016549600288271904,-0.021415863186120987,-0.01762520521879196,0.016722537577152252,0.022516990080475807,-0.030439825728535652,-0.03066829778254032,-0.08423644304275513,0.02727390080690384,0.008482859469950199,-0.01684633269906044,-0.009838597849011421,0.025598721578717232,-0.07896363735198975,-0.062477465718984604,-0.04204032942652702,-0.016445361077785492,0.02728879265487194,-0.0021450212225317955,0.028854381293058395,0.0010020930785685778,0.014418520033359528,-0.07554098963737488,0.0035660190042108297,0.026537606492638588,0.030855750665068626,0.06059719994664192,0.011241880245506763,0.014067098498344421,0.012591608799993992,-0.02107701264321804,0.028594957664608955,0.016665905714035034,0.012279345653951168,-0.005956364329904318,-0.01952277310192585,0.013010517694056034,-0.028292417526245117,-0.06158692389726639,-0.03384138643741608,-0.01931001991033554,1.8864289720135395e-34,0.03271118178963661,0.008427050895988941,-0.015474994666874409,0.03797554224729538,0.019266849383711815,0.00838790088891983,0.06018025055527687,-0.06690298765897751,-0.024319656193256378,0.037154704332351685,-0.012686544097959995]';
  p_EmbeddingModelID_6c1b11af9065 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_6c1b11af9065 := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_6c1b11af9065 := FALSE;
  p_IsMaterialized_6c1b11af9065 := FALSE;
  p_ID_6c1b11af9065 := '5A1E5000-0001-4000-A000-000000000007';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_6c1b11af9065,
    'CategoryID', p_CategoryID_6c1b11af9065,
    'UserQuestion', p_UserQuestion_6c1b11af9065,
    'Description', p_Description_6c1b11af9065,
    'SQL', p_SQL_6c1b11af9065,
    'TechnicalDescription', p_TechnicalDescription_6c1b11af9065,
    'OriginalSQL', p_OriginalSQL_6c1b11af9065,
    'Feedback', p_Feedback_6c1b11af9065,
    'Status', p_Status_6c1b11af9065,
    'QualityRank', p_QualityRank_6c1b11af9065,
    'ExecutionCostRank', p_ExecutionCostRank_6c1b11af9065,
    'UsesTemplate', p_UsesTemplate_6c1b11af9065,
    'AuditQueryRuns', p_AuditQueryRuns_6c1b11af9065,
    'CacheEnabled', p_CacheEnabled_6c1b11af9065,
    'CacheTTLMinutes', p_CacheTTLMinutes_6c1b11af9065,
    'CacheMaxSize', p_CacheMaxSize_6c1b11af9065,
    'EmbeddingVector', p_EmbeddingVector_6c1b11af9065,
    'EmbeddingModelID', p_EmbeddingModelID_6c1b11af9065,
    'CacheValidationSQL', p_CacheValidationSQL_6c1b11af9065,
    'SQLDialectID', p_SQLDialectID_6c1b11af9065,
    'Reusable', p_Reusable_6c1b11af9065,
    'ExternalDataSourceID', p_ExternalDataSourceID_6c1b11af9065,
    'IsMaterialized', p_IsMaterialized_6c1b11af9065,
    'ID', p_ID_6c1b11af9065
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_6c1b11af9065, p_CategoryID := p_CategoryID_6c1b11af9065, p_UserQuestion := p_UserQuestion_6c1b11af9065, p_Description := p_Description_6c1b11af9065, p_SQL := p_SQL_6c1b11af9065, p_TechnicalDescription := p_TechnicalDescription_6c1b11af9065, p_OriginalSQL := p_OriginalSQL_6c1b11af9065, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_6c1b11af9065, p_Feedback_Clear := TRUE, p_Status := p_Status_6c1b11af9065, p_QualityRank := p_QualityRank_6c1b11af9065, p_ExecutionCostRank := p_ExecutionCostRank_6c1b11af9065, p_UsesTemplate := p_UsesTemplate_6c1b11af9065, p_AuditQueryRuns := p_AuditQueryRuns_6c1b11af9065, p_CacheEnabled := p_CacheEnabled_6c1b11af9065, p_CacheTTLMinutes := p_CacheTTLMinutes_6c1b11af9065, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_6c1b11af9065, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_6c1b11af9065, p_EmbeddingModelID := p_EmbeddingModelID_6c1b11af9065, p_CacheValidationSQL := p_CacheValidationSQL_6c1b11af9065, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_6c1b11af9065, p_Reusable := p_Reusable_6c1b11af9065, p_ExternalDataSourceID := p_ExternalDataSourceID_6c1b11af9065, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_6c1b11af9065, p_ID := p_ID_6c1b11af9065);
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_Name_9d94095389c2 VARCHAR(255);
  p_CategoryID_9d94095389c2 UUID;
  p_UserQuestion_9d94095389c2 TEXT;
  p_Description_9d94095389c2 TEXT;
  p_SQL_9d94095389c2 TEXT;
  p_TechnicalDescription_9d94095389c2 TEXT;
  p_OriginalSQL_9d94095389c2 TEXT;
  p_Feedback_9d94095389c2 TEXT;
  p_Status_9d94095389c2 VARCHAR(15);
  p_QualityRank_9d94095389c2 INTEGER;
  p_ExecutionCostRank_9d94095389c2 INTEGER;
  p_UsesTemplate_9d94095389c2 BOOLEAN;
  p_AuditQueryRuns_9d94095389c2 BOOLEAN;
  p_CacheEnabled_9d94095389c2 BOOLEAN;
  p_CacheTTLMinutes_9d94095389c2 INTEGER;
  p_CacheMaxSize_9d94095389c2 INTEGER;
  p_EmbeddingVector_9d94095389c2 TEXT;
  p_EmbeddingModelID_9d94095389c2 UUID;
  p_CacheValidationSQL_9d94095389c2 TEXT;
  p_SQLDialectID_9d94095389c2 UUID;
  p_Reusable_9d94095389c2 BOOLEAN;
  p_ExternalDataSourceID_9d94095389c2 UUID;
  p_IsMaterialized_9d94095389c2 BOOLEAN;
  p_ID_9d94095389c2 UUID;
BEGIN
  p_Name_9d94095389c2 := 'Sales: Stage Conversion and Dwell';
  p_CategoryID_9d94095389c2 := '5A1E5000-0000-4000-A000-000000000001';
  p_UserQuestion_9d94095389c2 := 'How do deals move between stages, how long do they sit, and which stages get skipped?';
  p_Description_9d94095389c2 := 'Conversion and dwell at the TRANSITION grain (master plan §9.1, §9.3 measure 7). This is the one measure that cannot be answered from Deal at all: the current stage says where a deal is, only the append-only event log says where it has been. Skipped and backward moves fall out for free because rows key on the (From, To) pair rather than on adjacency.';
  p_SQL_9d94095389c2 := '-- Stage conversion and dwell time. Master plan §9.3, measure 7 — the TRANSITION grain (§9.1).
--
-- THIS IS THE ONE QUERY THAT CANNOT BE ANSWERED FROM `Deal`, and that is why DealStageEvent is
-- append-only. A deal''s current stage says where it is; only the event log says where it has BEEN,
-- how long it sat there, and what it was worth on the way out. Reconstructing this from Deal is not
-- merely hard, it is impossible once a deal moves twice.
--
-- DATE DIMENSION: ChangedAt — the transition date. §9.2 lists it as its own dimension precisely
-- because it answers questions neither close date can.
--
-- THE PERIOD IS IN BUSINESS DAYS (#289). ChangedAt is a DATETIMEOFFSET and PeriodStart/PeriodEnd are
-- date-only, so comparing them directly put both bounds at UTC midnight: a move made on the last
-- evening of the period (after 6 PM Central, 7 PM in daylight time) fell out, and one from the evening
-- before the period fell in. Each bound is now judged on `[__mj_BizAppsCommon].[fnBusinessDayOf]()`,
-- the business day of the instant — a function, not an inline `AT TIME ZONE`, which MJ''s SQL parser
-- cannot read (see deal-cycle-time.sql). The padded UTC range beside it (a day before the start, two
-- after the end) is wider than any zone offset and only lets an index on ChangedAt narrow the scan.
--
-- DWELL COMES FROM THE STAMP, NOT FROM ARITHMETIC ACROSS ROWS. DealStageEvent.DaysInPreviousStage is
-- recorded at transition time. Deriving it here by joining each event to its predecessor would give a
-- different answer for any deal whose history was imported rather than lived — the HubSpot importer
-- preserves original ChangedAt values, so the gaps between events are real history and the stamps are
-- the authority on them.
--
-- SKIPPED STAGES FALL OUT OF THIS FOR FREE. Because rows are keyed on the (From, To) pair rather than
-- on adjacency, a jump from Discovery straight to Negotiation appears as its own pair rather than
-- being silently absorbed into two hops that never happened.
--
-- AMOUNT AT TRANSITION IS THE DEPARTING VALUE. The event stamps what the deal was worth on the way
-- OUT of the from-stage, so a conversion rate weighted by value reflects what was actually at stake
-- at that moment rather than what the deal is worth today.
SELECT
    p.ID                                        AS PipelineID,
    p.Name                                      AS PipelineName,
    e.FromStageID,
    fs.Name                                     AS FromStageName,
    fs.DisplayOrder                             AS FromStageOrder,
    e.ToStageID,
    ts.Name                                     AS ToStageName,
    ts.DisplayOrder                             AS ToStageOrder,
    -- A move that lands in a stage further down the board than the next one is a SKIP, and it is
    -- worth seeing: skipped stages are either a process shortcut worth adopting or a discipline
    -- problem worth naming.
    CASE WHEN ts.DisplayOrder > fs.DisplayOrder + 1 THEN 1 ELSE 0 END AS IsSkip,
    CASE WHEN ts.DisplayOrder < fs.DisplayOrder    THEN 1 ELSE 0 END AS IsBackward,
    COUNT(*)                                    AS TransitionCount,
    COUNT(DISTINCT e.DealID)                    AS DealCount,
    AVG(CAST(e.DaysInPreviousStage AS FLOAT))   AS AvgDaysInFromStage,
    MAX(e.DaysInPreviousStage)                  AS MaxDaysInFromStage,
    SUM(ISNULL(e.AmountAtTransition, 0))        AS AmountMoved,
    AVG(CAST(e.ProbabilityAtTransition AS FLOAT)) AS AvgProbabilityLeaving
FROM [__mj_BizAppsSales].DealStageEvent e
INNER JOIN [__mj_BizAppsSales].Deal d
        ON d.ID = e.DealID
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage fs
        ON fs.ID = e.FromStageID
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage ts
        ON ts.ID = e.ToStageID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if PeriodStart %}
  AND e.ChangedAt >= DATEADD(day, -1, {{ PeriodStart | sqlString }})
  AND [__mj_BizAppsCommon].[fnBusinessDayOf](e.ChangedAt) >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND e.ChangedAt < DATEADD(day, 2, {{ PeriodEnd | sqlString }})
  AND [__mj_BizAppsCommon].[fnBusinessDayOf](e.ChangedAt) <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    p.ID, p.Name, e.FromStageID, fs.Name, fs.DisplayOrder,
    e.ToStageID, ts.Name, ts.DisplayOrder
ORDER BY
    p.Name, fs.DisplayOrder, ts.DisplayOrder;
';
  p_TechnicalDescription_9d94095389c2 := 'Grain: DealStageEvent. Date dimension: ChangedAt. Dwell comes from the stored DaysInPreviousStage stamp rather than being derived by joining each event to its predecessor — the importer preserves original ChangedAt values, so the stamps are the authority. AmountAtTransition is the DEPARTING value, so value-weighted conversion reflects what was at stake at that moment rather than what the deal is worth today.';
  p_Status_9d94095389c2 := 'Approved';
  p_QualityRank_9d94095389c2 := 9;
  p_ExecutionCostRank_9d94095389c2 := 3;
  p_UsesTemplate_9d94095389c2 := TRUE;
  p_AuditQueryRuns_9d94095389c2 := FALSE;
  p_CacheEnabled_9d94095389c2 := FALSE;
  p_EmbeddingVector_9d94095389c2 := '[-0.004340851679444313,0.019213544204831123,-0.009912729263305664,-0.0424935519695282,-0.01668274588882923,-0.020581483840942383,0.026275230571627617,-0.019465601071715355,-0.0623057559132576,-0.0009073386318050325,0.02236279472708702,0.036067891865968704,0.027088966220617294,0.12636396288871765,-0.03675501421093941,0.011827151291072369,0.033312201499938965,-0.004493492655456066,-0.10598582029342651,0.01375563908368349,0.00322133325971663,-0.00477512227371335,-0.03983995318412781,-0.019002996385097504,0.001020788331516087,-0.03131355717778206,-0.05781491473317146,0.010057847015559673,0.027933962643146515,-0.054025694727897644,-0.03747370094060898,0.036669954657554626,0.0043592294678092,0.042067136615514755,0.000002539300567150349,-0.038159191608428955,-0.05460095405578613,0.00009454800601815805,-0.06342227756977081,0.09066891670227051,-0.005873367190361023,-0.024458881467580795,-0.0029860890936106443,0.009732922539114952,-0.04176739230751991,0.018173232674598694,-0.02692093700170517,0.018840981647372246,0.011849622242152691,0.006548596080392599,0.010686663910746574,0.02195301279425621,-0.02599487453699112,0.008138034492731094,0.011825734749436378,-0.042100727558135986,0.025827184319496155,-0.05741551145911217,-0.012179517187178135,-0.031209316104650497,-0.045514658093452454,-0.024367837235331535,0.0024706695694476366,-0.0872761532664299,0.02682223729789257,0.008966372348368168,0.05063537508249283,-0.01683041825890541,0.0005542720318771899,-0.026347916573286057,0.05014914646744728,0.004858645144850016,0.0009314871276728809,-0.025968685746192932,0.006682681851089001,-0.04065239802002907,-0.04280894622206688,-0.003960398491472006,0.00887282844632864,-0.02646780200302601,-0.037978071719408035,0.038403868675231934,-0.0005667560617439449,-0.035019367933273315,-0.07078591734170914,0.01872459426522255,-0.01724756881594658,-0.04185739532113075,-0.03611403703689575,0.002721515716984868,0.06478918343782425,-0.033005330711603165,0.0331549234688282,-0.013040062971413136,-0.045618440955877304,-0.014103393070399761,0.034636929631233215,0.1177017092704773,-0.04486995190382004,-0.04603032022714615,0.01192738488316536,0.040349096059799194,0.013316763564944267,0.026466703042387962,0.026037132367491722,-0.04337869584560394,-0.0028331836219877005,-0.03244706988334656,-0.06868556141853333,0.08098524063825607,-0.01146790198981762,0.013123485259711742,-0.0423920564353466,0.021107668057084084,-0.06005628779530525,-0.025771066546440125,-0.0198074784129858,0.018502118065953255,-0.030481798574328423,0.04611968994140625,0.08588746190071106,0.010460324585437775,-0.019471682608127594,0.0002453673514537513,0.0129779651761055,0.03177008405327797,-0.014909496530890465,-0.0007004214567132294,0.05939541757106781,0.06656070798635483,-0.04449727013707161,-0.031262993812561035,0.028255973011255264,-0.016430670395493507,-0.019952192902565002,0.02253168262541294,0.00015223730588331819,0.03907535970211029,-0.041653551161289215,-0.005561803467571735,0.006275566760450602,0.0133442934602499,-0.006295735016465187,0.03410239517688751,0.005426408257335424,-0.0061540487222373486,-0.020601728931069374,0.028176382184028625,-0.011973630636930466,0.026994796469807625,-0.036570630967617035,0.04663672298192978,0.034201450645923615,0.006928012706339359,-0.061156876385211945,0.013958574272692204,0.01321560051292181,-0.013537392020225525,0.01235031709074974,0.06409488618373871,0.029292117804288864,-0.0501520000398159,0.035644643008708954,0.018612146377563477,-0.019851358607411385,0.015127772465348244,-0.00123150076251477,-0.0057512023486196995,0.01695682480931282,-0.04526302218437195,0.02606605924665928,-0.06593561172485352,-0.01587066985666752,0.0013648460153490305,0.015290003269910812,0.03140321001410484,0.03732345625758171,0.05786282196640968,-0.007561397273093462,-0.02882709540426731,-0.07465234398841858,-0.061467017978429794,-0.008524250239133835,0.004353792406618595,0.006968629080802202,-0.056245069950819016,0.01726117730140686,-0.020619621500372887,0.0007706916076131165,0.04020030051469803,0.013082318939268589,0.03508846461772919,0.010336734354496002,-0.03227509185671806,-0.04761923477053642,0.00031872797990217805,-0.02496747113764286,0.033823538571596146,0.030682548880577087,0.033874429762363434,0.0027932259254157543,-0.01157885417342186,-0.08124928176403046,-0.0032673634123057127,0.018974555656313896,0.006816393230110407,-0.017781924456357956,-0.02063206396996975,-0.026914188638329506,0.026190219447016716,0.04148319363594055,0.014601743780076504,-0.031649067997932434,0.03418273851275444,-0.00801536999642849,0.046699561178684235,0.022194700315594673,0.011688289232552052,-0.08623120188713074,-0.010122078470885754,-0.026141032576560974,-0.04479704052209854,0.05479156970977783,-0.0007691530045121908,0.023769108578562737,0.05097060278058052,-0.0013871416449546814,-0.007922204211354256,0.0033096494153141975,-0.038572799414396286,0.028675807639956474,-0.006919888313859701,0.06299544870853424,0.007405247073620558,0.010052291676402092,0.11374805122613907,0.019296221435070038,0.046876173466444016,0.023472478613257408,0.0641401931643486,0.002156469039618969,-0.0681157335639,-0.02402695268392563,-0.006973736919462681,0.08328033238649368,-0.010237154550850391,-0.007912830449640751,0.013937010429799557,0.014840299263596535,0.02558112144470215,-0.0010309603530913591,0.04175090044736862,0.010024132207036018,-0.008276085369288921,0.006734529510140419,-0.0019264152506366372,-0.11301545798778534,0.034264784306287766,0.037268493324518204,0.09631559252738953,0.057140711694955826,-0.038601599633693695,-0.037245117127895355,-0.01938544027507305,0.015273441560566425,-0.021847836673259735,0.01944836415350437,-0.006195449270308018,-0.014047864824533463,0.026134280487895012,0.06745357811450958,0.03446716442704201,-0.003122619353234768,-0.0056265536695718765,-0.0017367468681186438,0.047337599098682404,0.03833375871181488,-0.007905279286205769,-0.023780150339007378,-0.028466885909438133,0.03202364593744278,-0.0450279675424099,-0.012758183293044567,0.02879025973379612,0.010696080513298512,0.0243863333016634,0.03385927900671959,-0.049411218613386154,-0.07635657489299774,-0.07232886552810669,0.032577402889728546,-0.051978159695863724,-0.0023942196276038885,-0.02280665747821331,-0.0539788082242012,-0.018351156264543533,-0.08578784018754959,0.015796294435858727,-0.0009343171841464937,0.08284781873226166,-0.02620110660791397,-0.06117343530058861,-0.012025975622236729,-0.018440071493387222,-0.006910382770001888,0.04851333796977997,-0.029820336028933525,0.01836729608476162,-0.0007808837108314037,0.06571824848651886,-0.003934894222766161,-0.00020625811885111034,-0.01691962592303753,-0.06894240528345108,0.0017013048054650426,0.01777375489473343,0.02958146668970585,0.04832884296774864,-0.049189645797014236,0.08867543190717697,-0.013021099381148815,0.028686970472335815,0.004095613956451416,0.00249991612508893,-0.015316424891352654,0.016400735825300217,0.013186291791498661,0.016112858429551125,-0.0031212654430419207,-0.05085865408182144,0.016887713223695755,-0.07438282668590546,-0.055837396532297134,-0.0077565391547977924,0.0008748543332330883,-0.005286154802888632,0.011940695345401764,0.0014965826412662864,-0.022970028221607208,0.03304819017648697,-0.03590143471956253,-0.001237700111232698,0.0023830400314182043,0.015919292345643044,0.016103317961096764,0.015882505103945732,0.048770226538181305,0.0010890807025134563,-0.06354394555091858,0.035636890679597855,-0.02056712843477726,0.059502601623535156,-0.028385018929839134,-0.044836875051259995,-0.027284367009997368,-0.006309828720986843,-0.04104368016123772,-0.00993530172854662,0.008432975970208645,-0.07586652040481567,-0.0031987661495804787,0.06562301516532898,-0.019811242818832397,0.03406115621328354,0.0162497665733099,0.004985705483704805,0.02519981935620308,-0.037443533539772034,0.0226997472345829,0.0023129091132432222,-0.05696158483624458,0.00029832383734174073,-0.039744503796100616,-0.016089651733636856,0.023227833211421967,-0.03157726302742958,0.04217709228396416,-0.011740866117179394,0.04506170004606247,-0.014077377505600452,0.016053466126322746,-0.07515175640583038,0.07771129161119461,-0.028279701247811317,0.057679615914821625,0.021521979942917824,-0.021597830578684807,-0.01796559803187847,-0.04137441888451576,0.0015743018593639135,0.009210048243403435,-0.056365255266427994,-0.00526371318846941,-0.019040975719690323,0.006863867398351431,0.0404929593205452,-0.0009224359528161585,0.03838878870010376,-0.02856556326150894,0.006154599599540234,-0.0012112930417060852,0.03906111419200897,0.06749459356069565,0.022278839722275734,0.07040712237358093,-0.007331100292503834,-0.015086564235389233,0.010657207109034061,-0.018695708364248276,0.02080090157687664,0.08639402687549591,-0.05080031231045723,0.014912421815097332,-0.03242609649896622,0.0025213193148374557,0.0560743622481823,0.01933283731341362,0.027691973373293877,-0.010282592847943306,-0.04451422020792961,-0.03949494659900665,0.014547338709235191,0.06467098742723465,0.003970182500779629,-0.04699133709073067,0.0004850108816754073,0.037363357841968536,-0.07651245594024658,0.01573435217142105,-0.015205646865069866,-0.043016109615564346,-0.02026480995118618,-0.019007189199328423,0.06534630805253983,-0.018605921417474747,0.03199812397360802,0.012383963912725449,-0.017411623150110245,0.041603416204452515,0.0024462095461785793,-0.034376874566078186,0.019903874024748802,0.13242892920970917,-0.010685142129659653,0.021963244304060936,0.029980184510350227,-0.02781684324145317,-0.006604035384953022,0.0033285256940871477,-0.04291226342320442,0.0069147804751992226,-0.012945241294801235,0.03906763717532158,-0.037159357219934464,0.001787271467037499,-0.012956531718373299,-0.0918378159403801,-0.029649775475263596,-0.04305548220872879,-0.007804372813552618,-0.010641118511557579,0.058187440037727356,-0.04584889858961105,0.026605630293488503,0.04224332049489021,-0.06621051579713821,-0.08553995192050934,0.03799497336149216,0.04438354820013046,0.004049279261380434,0.017549891024827957,-0.02566024847328663,-0.051581863313913345,0.0016009133541956544,0.01691213995218277,0.023267727345228195,-0.003320849034935236,0.009725639596581459,0.013351714238524437,0.011584472842514515,-0.016418244689702988,-0.012503556907176971,0.0157783180475235,-0.07422255724668503,-0.01651233248412609,0.04810461401939392,0.012209673412144184,0.02054763026535511,-0.04448933154344559,-0.041072916239500046,0.042856331914663315,-0.029232632368803024,-0.007073125336319208,0.06015019118785858,-0.025521984323859215,-0.014034805819392204,0.007087831851094961,-0.046612370759248734,0.029618384316563606,-0.0008625212940387428,-0.007728481199592352,0.006092866882681847,-0.011811883188784122,-0.03522951155900955,-0.005425565876066685,0.03585867956280708,-0.0020781459752470255,0.03684359788894653,0.0156891867518425,0.019321314990520477,0.014026214368641376,0.0008782600634731352,-0.0028859225567430258,0.020700760185718536,-0.012073027901351452,-0.06717146188020706,-0.01808285340666771,0.04484780132770538,0.04339715465903282,0.028218958526849747,0.02386283501982689,-0.0041907369159162045,0.021816318854689598,-0.004389904905110598,0.012536056339740753,-0.07346951961517334,0.015191430225968361,0.00429709954187274,0.0474250465631485,0.04018012434244156,-0.050028786063194275,0.05543319880962372,-0.06905987858772278,0.011358853429555893,-0.003545014187693596,-0.03788091614842415,-0.02314111776649952,0.009154558181762695,0.052669182419776917,-0.026637626811861992,-0.0458499938249588,0.017115816473960876,-0.011822318658232689,-0.012185370549559593,0.009225927293300629,-0.022142620757222176,0.006968517322093248,-0.04433106631040573,0.019392849877476692,0.015964798629283905,0.02891988307237625,-0.03389846906065941,0.06254894286394119,-0.009015415795147419,-0.031187662854790688,-7.771398864797537e-33,-0.03345097601413727,-0.026845572516322136,-0.006793440785259008,0.017580661922693253,-0.055395014584064484,-0.08108064532279968,-0.02313127927482128,-0.024696627631783485,0.01822821982204914,-0.0061531467363238335,0.014077195897698402,0.006817299406975508,0.023130586370825768,0.006068952847272158,0.03801889717578888,0.021065277978777885,0.011188865639269352,-0.0016804927727207541,-0.023249968886375427,0.021056873723864555,-0.014505727216601372,0.014834082685410976,0.027158541604876518,0.09901707619428635,-0.019222693517804146,0.0007444042712450027,-0.034324634820222855,0.004148722160607576,-0.047476816922426224,-0.05736883729696274,0.016322946175932884,-0.061280932277441025,0.0041121537797153,-0.017359236255288124,0.008988560177385807,-0.08773762732744217,-0.00398170156404376,-0.003286640392616391,-0.02211139351129532,0.0013307713670656085,0.040671225637197495,-0.0010539753129705787,-0.005698287859559059,0.015860935673117638,-0.007707369979470968,-0.024955207481980324,0.009517671540379524,-0.008455614559352398,-0.02140546776354313,0.002439548959955573,-0.04488633573055267,0.0010988293215632439,-0.03576331585645676,0.025939233601093292,0.008572419174015522,0.05024127662181854,0.045125920325517654,-0.1029687449336052,-0.014453663490712643,0.010743837803602219,0.021127231419086456,0.014216918498277664,-0.00882733054459095,-0.007612744811922312,0.018887553364038467,-0.027903450652956963,-0.015221084468066692,0.029033692553639412,0.10894046723842621,-0.008603903464972973,-0.013356132432818413,0.05413028597831726,-0.04952581226825714,-0.07761798053979874,0.007634700275957584,0.07014551013708115,0.01668252982199192,0.0028830457013100386,0.015925778076052666,0.02901916764676571,-0.0037541037891060114,-0.0041678003035485744,0.039219439029693604,-0.005045302677899599,-0.018839992582798004,-0.023706721141934395,-0.008421407081186771,0.009710067883133888,0.013017905876040459,0.00651269406080246,0.016982723027467728,0.04076080024242401,-0.036348871886730194,0.0177825465798378,-0.059119243174791336,0.004031962715089321,0.014400617219507694,0.04631638899445534,0.014792864210903645,0.0069900560192763805,0.0017075890209525824,-0.0038600892294198275,0.04458971694111824,-0.04793301224708557,0.034487225115299225,0.016530629247426987,-0.004595357924699783,-0.008074326440691948,-0.04307285696268082,0.010041170753538609,0.009387864731252193,0.022920293733477592,-0.023369569331407547,-0.03784538432955742,0.01920720748603344,-0.03760721534490585,-0.0018099865410476923,-0.002845445415005088,0.0033491291105747223,0.037181682884693146,0.020398639142513275,0.08684918284416199,0.009711879305541515,0.029797373339533806,0.005464546848088503,0.002926053712144494,0.03161580488085747,-0.02106642909348011,-0.023326607421040535,-0.03596969693899155,-0.006419986020773649,0.015216900035738945,3.352901956077403e-7,0.03907489776611328,0.027141137048602104,-0.016034092754125595,0.020174946635961533,0.025856144726276398,0.010224921628832817,-0.02595953457057476,0.004565721843391657,0.057345300912857056,-0.037302203476428986,0.007837754674255848,-0.03547969087958336,0.04029855877161026,0.016643889248371124,0.09323356300592422,-0.0732484683394432,0.00654587522149086,-0.0031266999430954456,-0.02192790061235428,-0.05699583515524864,0.048400357365608215,-0.008718597702682018,0.026683611795306206,0.02780863270163536,-0.013806994073092937,0.015515676699578762,0.024020925164222717,-0.04948129504919052,0.022887149825692177,-0.0046523576602339745,0.02212652377784252,-0.12375998497009277,-0.02493065968155861,-0.006105218082666397,-0.014059728942811489,0.04636663571000099,-0.040423668920993805,-0.003895793342962861,0.027338821440935135,-0.03073612041771412,-0.029582930728793144,-0.060549721121788025,-0.0139658497646451,0.028227398172020912,0.03677951544523239,-0.0934453010559082,-0.005559611599892378,0.02636871114373207,-0.04233735799789429,-0.015507791191339493,-0.017085958272218704,0.05119450390338898,0.06166238337755203,0.03964358568191528,0.03464147076010704,0.04246615990996361,0.006036203354597092,-0.0027801429387181997,0.03749912604689598,0.0526149608194828,-0.024441998451948166,-0.011635075323283672,0.008001753129065037,0.029059091582894325,0.013087164610624313,-0.03847716748714447,-0.03920548036694527,3.8876357838352596e-34,0.02787652239203453,0.0010294042294844985,0.04807561635971069,-0.017446497455239296,0.017163550481200218,-0.02924419566988945,0.08734350651502609,-0.0262029729783535,0.015331649221479893,-0.06312191486358643,-0.03181944414973259]';
  p_EmbeddingModelID_9d94095389c2 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_SQLDialectID_9d94095389c2 := '1F203987-A37B-4BC1-85B3-BA50DC33C3E0';
  p_Reusable_9d94095389c2 := FALSE;
  p_IsMaterialized_9d94095389c2 := FALSE;
  p_ID_9d94095389c2 := '5A1E5000-0001-4000-A000-000000000006';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
    'Name', p_Name_9d94095389c2,
    'CategoryID', p_CategoryID_9d94095389c2,
    'UserQuestion', p_UserQuestion_9d94095389c2,
    'Description', p_Description_9d94095389c2,
    'SQL', p_SQL_9d94095389c2,
    'TechnicalDescription', p_TechnicalDescription_9d94095389c2,
    'OriginalSQL', p_OriginalSQL_9d94095389c2,
    'Feedback', p_Feedback_9d94095389c2,
    'Status', p_Status_9d94095389c2,
    'QualityRank', p_QualityRank_9d94095389c2,
    'ExecutionCostRank', p_ExecutionCostRank_9d94095389c2,
    'UsesTemplate', p_UsesTemplate_9d94095389c2,
    'AuditQueryRuns', p_AuditQueryRuns_9d94095389c2,
    'CacheEnabled', p_CacheEnabled_9d94095389c2,
    'CacheTTLMinutes', p_CacheTTLMinutes_9d94095389c2,
    'CacheMaxSize', p_CacheMaxSize_9d94095389c2,
    'EmbeddingVector', p_EmbeddingVector_9d94095389c2,
    'EmbeddingModelID', p_EmbeddingModelID_9d94095389c2,
    'CacheValidationSQL', p_CacheValidationSQL_9d94095389c2,
    'SQLDialectID', p_SQLDialectID_9d94095389c2,
    'Reusable', p_Reusable_9d94095389c2,
    'ExternalDataSourceID', p_ExternalDataSourceID_9d94095389c2,
    'IsMaterialized', p_IsMaterialized_9d94095389c2,
    'ID', p_ID_9d94095389c2
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateQuery"(p_Name := p_Name_9d94095389c2, p_CategoryID := p_CategoryID_9d94095389c2, p_UserQuestion := p_UserQuestion_9d94095389c2, p_Description := p_Description_9d94095389c2, p_SQL := p_SQL_9d94095389c2, p_TechnicalDescription := p_TechnicalDescription_9d94095389c2, p_OriginalSQL := p_OriginalSQL_9d94095389c2, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_9d94095389c2, p_Feedback_Clear := TRUE, p_Status := p_Status_9d94095389c2, p_QualityRank := p_QualityRank_9d94095389c2, p_ExecutionCostRank := p_ExecutionCostRank_9d94095389c2, p_UsesTemplate := p_UsesTemplate_9d94095389c2, p_AuditQueryRuns := p_AuditQueryRuns_9d94095389c2, p_CacheEnabled := p_CacheEnabled_9d94095389c2, p_CacheTTLMinutes := p_CacheTTLMinutes_9d94095389c2, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_9d94095389c2, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_9d94095389c2, p_EmbeddingModelID := p_EmbeddingModelID_9d94095389c2, p_CacheValidationSQL := p_CacheValidationSQL_9d94095389c2, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_9d94095389c2, p_Reusable := p_Reusable_9d94095389c2, p_ExternalDataSourceID := p_ExternalDataSourceID_9d94095389c2, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_9d94095389c2, p_ID := p_ID_9d94095389c2);
  END IF;
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
  p_AllowUpdateAPI_1d7e762d39bc := FALSE;
  p_AllowCreateAPI_1d7e762d39bc := TRUE;
  p_AllowDeleteAPI_1d7e762d39bc := FALSE;
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
