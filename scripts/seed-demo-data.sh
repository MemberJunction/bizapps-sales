#!/usr/bin/env bash
#
# Seed DEMO data — a pipeline that tells the story, not just rows that fill a grid.
#
# WHY THIS IS SEPARATE FROM seed-dev-data.sh. That script seeds the MINIMUM the app needs to be
# usable at all (one Company, one Employee, your User) — without it, Pipeline.CompanyID has no target
# and the app is literally uncreatable. This script is different: it exists so a DEMO has something
# worth looking at, and every row in it is chosen to make one of the design decisions visible on
# screen.
#
# WHY NOT metadata/. Same reason as seed-dev-data.sh, and more so: this is illustrative fiction. It
# must never reach an environment where someone could mistake "Northwind Health Group" for a customer.
#
# WHAT THE DATA IS DESIGNED TO SHOW
#
#   1. VOCABULARY IS DATA, NOT CODE. The main pipeline's winning stage is called **"Signed"**, not
#      "Closed Won" — and the app still knows it is a win, because the stage points at a
#      DealStatusType carrying IsWon=1. That single row is the master plan §3 argument made visible:
#      rename the label, behaviour is unchanged. There is no string 'Closed Won' anywhere in the code.
#
#   2. A PIPELINE BELONGS TO A COMPANY (L-14). Two companies, each with its own pipeline and its own
#      motion — which is what makes every rollup sliceable by company for free.
#
#   3. IDENTITY IS SHARED, NOT FORKED. Every SalesAccount IS an Organization and every SalesContact IS
#      a Person, same UUID. Open an account and the name comes from the parent row.
#
#   4. SALES NEVER COMPUTES MONEY -- AND BOTH HALVES OF THAT ARE ON SCREEN. Five of the seven deals
#      carry order lines and come back ENGINE-PRICED: AmountIsComputed = 1, with a timestamp and a
#      source hash. Two carry a STATED amount and no lines at all, AmountIsComputed = 0, saying the
#      figure is a human's rather than a traceable answer. The distinction is the point, so the demo
#      has to show both -- a screen where everything is stated proves nothing about the cache.
#
#      THE PRICED FIVE CANNOT COME FROM THIS SCRIPT. UnitPrice and CompanyID are stamped by orders
#      from the product, and LineTotalGross comes from its pricing engine, so a SQL INSERT would have
#      to invent the money it is meant to prove sales never invents. They are seeded by
#      scripts/seed-demo-lines.mjs instead, which drives the entity layer and lets orders answer --
#      run from the bottom of this script, and separately re-runnable. DN-15.
#
#   5. THE DEAL TEAM, INCLUDING D-6. One deal carries an Employee owner AND a partner manager who is a
#      common.Person with no Employee record — the exactly-one-of case that D-6 exists for.
#
#   6. PROVENANCE IS IMMUTABLE. DealStageEvent rows carry the amount AS IT WAS at each transition, so
#      the history reconstructs even though the deal's current amount has since changed.
#
#   7. POINT-IN-TIME vs NOW. A ForecastSnapshot holds what the forecast looked like earlier in the
#      period — the question a forecast review actually asks, and unanswerable from Deal alone.
#
# IDEMPOTENT: fixed UUIDs, and every insert is guarded. Re-running changes nothing.
# REMOVABLE:  scripts/seed-demo-data.sh --remove  deletes exactly these rows, child-first.
#
# Usage: scripts/seed-demo-data.sh [--remove]
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
set -a; . ./.env; set +a

SQLCMD="sqlcmd -S ${DB_HOST},${DB_PORT:-1433} -U ${DB_USERNAME} -P ${DB_PASSWORD} -C -N o -b"
say() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

TMP="$(mktemp -t sales-demo-XXXXXX.sql)"
trap 'rm -f "$TMP"' EXIT

if [[ "${1:-}" == "--remove" ]]; then
    say "Removing demo data from ${DB_DATABASE}"
    cat > "$TMP" <<'SQL'
SET NOCOUNT ON;
-- Child-first, because the S1 foreign keys are real.
DELETE FROM __mj_BizAppsSales.DealStageEvent  WHERE DealID   IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE DealNumber LIKE 'DEAL-9%');
DELETE FROM __mj_BizAppsSales.DealTeamMember  WHERE DealID   IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE DealNumber LIKE 'DEAL-9%');
-- THE EMBEDDED ORDER, and the order of these two statements is the whole trick.
--
-- `Deal.OrderID` is a real FK to orders' OrderHeader, so the order cannot be deleted while a deal
-- still points at it, and the deal cannot be deleted while its own children exist. Null the link
-- FIRST, delete the deals, then take the orders -- reversing any pair of these fails on a constraint
-- that is doing exactly its job.
--
-- Only the orders THIS script created are removed, matched on the demo number prefix. An order that
-- arrived any other way belongs to orders, not to us.
UPDATE __mj_BizAppsSales.Deal SET OrderID = NULL WHERE DealNumber LIKE 'DEAL-9%';
--
-- ONE CORRECTION TO THE NOTE ABOVE. The `ORD-DEMO-9%` deletes below no longer match anything this
-- script created: order numbers are minted by orders' own sequence now that the entity layer
-- provisions them (DN-15), not written here with a demo prefix. They are kept because they still
-- clean a host seeded by the older script, and because deleting an order this app did not create
-- is not something to widen the WHERE clause for.
DELETE FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE DealNumber LIKE 'DEAL-9%');
DELETE FROM __mj_BizAppsSales.DealContactRole WHERE DealID   IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE DealNumber LIKE 'DEAL-9%');
DELETE FROM __mj_BizAppsSales.Deal            WHERE DealNumber LIKE 'DEAL-9%';
IF OBJECT_ID('__mj_BizAppsOrders.OrderLine', 'U') IS NOT NULL
BEGIN
    DELETE FROM __mj_BizAppsOrders.OrderLine
     WHERE OrderHeaderID IN (SELECT ID FROM __mj_BizAppsOrders.OrderHeader WHERE OrderNumber LIKE 'ORD-DEMO-9%');
    DELETE FROM __mj_BizAppsOrders.OrderHeader WHERE OrderNumber LIKE 'ORD-DEMO-9%';
END
DELETE FROM __mj_BizAppsSales.ForecastSnapshot WHERE SnapshotJSON LIKE '%"demo":true%';
DELETE FROM __mj_BizAppsSales.PipelineStage   WHERE PipelineID IN (SELECT ID FROM __mj_BizAppsSales.Pipeline WHERE Code IN ('B2B','D2C','ENT-NEWBIZ','PARTNER-REF'));
DELETE FROM __mj_BizAppsSales.Pipeline        WHERE Code IN ('B2B','D2C','ENT-NEWBIZ','PARTNER-REF');
-- IDENTITY IS SHARED TOO, and for the same reason the selling company is.
--
-- These Persons and Organizations are sales' demo fiction, but once orders is installed they stop
-- being only ours: an order bills TO a person (FK_OrderHeader_BillToPerson) and ships to an
-- organization. Deleting the sales child then the common parent fails on those references -- and with
-- sqlcmd's -b and the script's `set -e`, that aborted the ENTIRE teardown on the configuration
-- docs/QA-GUIDE.md tells testers to run. It failed on FK_OrderHeader_BillToPerson in exactly that way.
--
-- Retaining is the RIGHT answer rather than merely the survivable one, and it is the same ruling this
-- script already applies to the company below: a record another app still points at is not sales' to
-- delete. The SalesAccount/SalesContact rows go either way, because those ARE sales' -- it is only the
-- shared parent that is spared.
DELETE FROM __mj_BizAppsSales.SalesContact    WHERE ID IN ('C0111111-0000-4000-A000-000000000001','C0111111-0000-4000-A000-000000000002','C0111111-0000-4000-A000-000000000003','C0111111-0000-4000-A000-000000000004');
BEGIN TRY
    DELETE FROM __mj_BizAppsCommon.Person     WHERE ID IN ('C0111111-0000-4000-A000-000000000001','C0111111-0000-4000-A000-000000000002','C0111111-0000-4000-A000-000000000003','C0111111-0000-4000-A000-000000000004');
END TRY
BEGIN CATCH
    PRINT 'Demo Person rows retained - another app still references them (expected when orders is installed and an order bills to one).';
END CATCH
DELETE FROM __mj_BizAppsSales.SalesAccount    WHERE ID IN ('A0111111-0000-4000-A000-000000000001','A0111111-0000-4000-A000-000000000002','A0111111-0000-4000-A000-000000000003');
BEGIN TRY
    DELETE FROM __mj_BizAppsCommon.Organization WHERE ID IN ('A0111111-0000-4000-A000-000000000001','A0111111-0000-4000-A000-000000000002','A0111111-0000-4000-A000-000000000003');
END TRY
BEGIN CATCH
    PRINT 'Demo Organization rows retained - another app still references them (expected when orders is installed).';
END CATCH
DELETE FROM __mj.Employee WHERE ID IN ('E0111111-0000-4000-A000-000000000002','E0111111-0000-4000-A000-000000000003');
-- THE SELLING COMPANY IS SHARED, so removing sales' demo data must not assume it can take the
-- company with it. Once orders is installed its catalogue hangs off this company
-- (FK_ProductCategory_Company, FK_Product_Company), and the delete fails -- which, with sqlcmd's
-- -b and the script's `set -e`, aborted the whole teardown on exactly the configuration
-- docs/QA-GUIDE.md tells testers to run. Retaining it is also the RIGHT answer, not just the
-- survivable one: a company another app still points at is not sales' to delete.
BEGIN TRY
    DELETE FROM __mj.Company WHERE ID = 'B0111111-0000-4000-A000-000000000002';
END TRY
BEGIN CATCH
    PRINT 'Company B0111111-0000-4000-A000-000000000002 retained - another app still references it (expected when orders is installed).';
END CATCH
SELECT 'deals remaining: ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal;
SELECT 'pipelines remaining: ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Pipeline;
SQL
    $SQLCMD -d "${DB_DATABASE}" -h -1 -W -i "$(cygpath -w "$TMP" 2>/dev/null || echo "$TMP")"
    echo "Demo data removed."
    exit 0
fi

say "Seeding demo data into ${DB_DATABASE}"

cat > "$TMP" <<'SQL'
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

-- Fixed ids so this is idempotent and removable.
DECLARE @co1 UNIQUEIDENTIFIER = 'C0A5E100-0001-4A01-9E11-5B7C3D2F8A01';   -- from seed-dev-data.sh
DECLARE @co2 UNIQUEIDENTIFIER = 'B0111111-0000-4000-A000-000000000002';
DECLARE @emp1 UNIQUEIDENTIFIER = 'E11B6200-0001-4B02-8F22-6C8D4E3A9B02'; -- from seed-dev-data.sh
DECLARE @emp2 UNIQUEIDENTIFIER = 'E0111111-0000-4000-A000-000000000002';
DECLARE @emp3 UNIQUEIDENTIFIER = 'E0111111-0000-4000-A000-000000000003';

-- ============================ a second selling company (L-14 / §9.2) ============================
IF NOT EXISTS (SELECT 1 FROM __mj.Company WHERE ID=@co2)
    EXEC __mj.spCreateCompany @ID=@co2, @Name=N'BC Education Group (Local Dev)',
        @Description=N'Demo second operating company — shows that every rollup slices by company because Pipeline.CompanyID is required.',
        @Domain=N'bced.example', @Website=N'https://bced.example';

-- ============================ a real deal team needs real people ============================
IF NOT EXISTS (SELECT 1 FROM __mj.Employee WHERE ID=@emp2)
    EXEC __mj.spCreateEmployee @ID=@emp2, @FirstName=N'Priya', @LastName=N'Raman', @CompanyID=@co1,
        @Title=N'Sales Engineer', @Email=N'priya.raman@demo.local', @Active=1;
IF NOT EXISTS (SELECT 1 FROM __mj.Employee WHERE ID=@emp3)
    EXEC __mj.spCreateEmployee @ID=@emp3, @FirstName=N'Tom', @LastName=N'Okafor', @CompanyID=@co1,
        @Title=N'SDR', @Email=N'tom.okafor@demo.local', @Active=1;

-- ============================ vocabulary lookups (by CODE, never by name) ============================
DECLARE @stOpen UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealStatusType WHERE Code='OPEN');
DECLARE @stWon  UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealStatusType WHERE Code='WON');
DECLARE @stLost UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealStatusType WHERE Code='LOST');
-- Deal-type codes are NEW / UPSELL / RENEWAL — master plan §4.2's exact vocabulary.
-- S1 seeded NEWBIZ/EXPANSION/CROSSSELL/PARTNER instead; re-seeded to the plan's three.
DECLARE @dtNew  UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealType WHERE Code='NEW');
DECLARE @dtRen  UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealType WHERE Code='RENEWAL');
DECLARE @dtUps  UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealType WHERE Code='UPSELL');
DECLARE @fcPipe UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.ForecastCategoryType WHERE Code='PIPELINE');
DECLARE @fcBest UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.ForecastCategoryType WHERE Code='BESTCASE');
DECLARE @fcComm UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.ForecastCategoryType WHERE Code='COMMIT');
DECLARE @fcClos UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.ForecastCategoryType WHERE Code='CLOSED');
DECLARE @roleOwner UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealRole WHERE Code='OWNER');
DECLARE @roleSE    UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealRole WHERE Code='SE');
DECLARE @roleSDR   UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealRole WHERE Code='SDR');
DECLARE @rolePM    UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.DealRole WHERE Code='PARTNERMGR');
DECLARE @atCust UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.AccountType WHERE Code='CUSTOMER');
DECLARE @atProsp UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.AccountType WHERE Code='PROSPECT');
DECLARE @lsRef UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.LeadSourceType WHERE Code='REFERRAL');
DECLARE @lsOut UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.LeadSourceType WHERE Code='OUTBOUND');
DECLARE @lsPart UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.LeadSourceType WHERE Code='PARTNER');
DECLARE @lcCust UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.LifecycleStageType WHERE Code='CUSTOMER');
DECLARE @lcOpp  UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.LifecycleStageType WHERE Code='OPPORTUNITY');
DECLARE @brEcon UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.BuyingRoleType WHERE Code='ECONBUYER');
DECLARE @brChamp UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.BuyingRoleType WHERE Code='CHAMPION');
DECLARE @lrPrice UNIQUEIDENTIFIER = (SELECT ID FROM __mj_BizAppsSales.LossReason WHERE Code='PRICE');

-- ============================ ACCOUNTS — IsA children of Organization ============================
DECLARE @acc1 UNIQUEIDENTIFIER='A0111111-0000-4000-A000-000000000001';
DECLARE @acc2 UNIQUEIDENTIFIER='A0111111-0000-4000-A000-000000000002';
DECLARE @acc3 UNIQUEIDENTIFIER='A0111111-0000-4000-A000-000000000003';

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Organization WHERE ID=@acc1)
  INSERT INTO __mj_BizAppsCommon.Organization (ID, Name) VALUES (@acc1, N'Northwind Health Group');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Organization WHERE ID=@acc2)
  INSERT INTO __mj_BizAppsCommon.Organization (ID, Name) VALUES (@acc2, N'Cascade Manufacturing');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Organization WHERE ID=@acc3)
  INSERT INTO __mj_BizAppsCommon.Organization (ID, Name) VALUES (@acc3, N'Beacon Charter Schools');

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.SalesAccount WHERE ID=@acc1)
  INSERT INTO __mj_BizAppsSales.SalesAccount (ID, OwnerEmployeeID, AccountTypeID, LifecycleStageTypeID, LeadSourceTypeID,
      Territory, Tier, ICPFitScore, IndustryCode, EmployeeCountBand, AnnualRevenueBand, HealthStatus, IsActive)
    VALUES (@acc1, @emp1, @atCust, @lcCust, @lsRef, N'Northeast', N'Enterprise', 88, N'Healthcare', N'1001-5000', N'$100M-$500M', N'Healthy', 1);
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.SalesAccount WHERE ID=@acc2)
  INSERT INTO __mj_BizAppsSales.SalesAccount (ID, OwnerEmployeeID, AccountTypeID, LifecycleStageTypeID, LeadSourceTypeID,
      Territory, Tier, ICPFitScore, IndustryCode, EmployeeCountBand, AnnualRevenueBand, HealthStatus, IsActive)
    VALUES (@acc2, @emp1, @atProsp, @lcOpp, @lsOut, N'Midwest', N'Mid-Market', 64, N'Manufacturing', N'251-1000', N'$50M-$100M', N'Unknown', 1);
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.SalesAccount WHERE ID=@acc3)
  INSERT INTO __mj_BizAppsSales.SalesAccount (ID, OwnerEmployeeID, AccountTypeID, LifecycleStageTypeID, LeadSourceTypeID,
      Territory, Tier, ICPFitScore, EmployeeCountBand, AnnualRevenueBand, HealthStatus, IsActive)
    VALUES (@acc3, @emp2, @atProsp, @lcOpp, @lsPart, N'West', N'SMB', 71, N'51-250', N'$10M-$50M', N'Healthy', 1);

-- ============================ CONTACTS — IsA children of Person ============================
DECLARE @c1 UNIQUEIDENTIFIER='C0111111-0000-4000-A000-000000000001';
DECLARE @c2 UNIQUEIDENTIFIER='C0111111-0000-4000-A000-000000000002';
DECLARE @c3 UNIQUEIDENTIFIER='C0111111-0000-4000-A000-000000000003';
DECLARE @c4 UNIQUEIDENTIFIER='C0111111-0000-4000-A000-000000000004';  -- the PARTNER REP (D-6)

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Person WHERE ID=@c1)
  INSERT INTO __mj_BizAppsCommon.Person (ID, FirstName, LastName) VALUES (@c1, N'Dana', N'Whitfield');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Person WHERE ID=@c2)
  INSERT INTO __mj_BizAppsCommon.Person (ID, FirstName, LastName) VALUES (@c2, N'Marcus', N'Bell');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Person WHERE ID=@c3)
  INSERT INTO __mj_BizAppsCommon.Person (ID, FirstName, LastName) VALUES (@c3, N'Alina', N'Duarte');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.Person WHERE ID=@c4)
  INSERT INTO __mj_BizAppsCommon.Person (ID, FirstName, LastName) VALUES (@c4, N'Ravi', N'Shankar');

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.SalesContact WHERE ID=@c1)
  INSERT INTO __mj_BizAppsSales.SalesContact (ID, OwnerEmployeeID, LifecycleStageTypeID, BuyingRoleTypeID, LeadSourceTypeID, Seniority, OptedOutOfOutreach)
    VALUES (@c1, @emp1, @lcCust, @brEcon, @lsRef, N'VP', 0);
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.SalesContact WHERE ID=@c2)
  INSERT INTO __mj_BizAppsSales.SalesContact (ID, OwnerEmployeeID, LifecycleStageTypeID, BuyingRoleTypeID, LeadSourceTypeID, Seniority, OptedOutOfOutreach)
    VALUES (@c2, @emp1, @lcOpp, @brChamp, @lsOut, N'Director', 0);
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.SalesContact WHERE ID=@c3)
  INSERT INTO __mj_BizAppsSales.SalesContact (ID, OwnerEmployeeID, LifecycleStageTypeID, BuyingRoleTypeID, LeadSourceTypeID, Seniority, OptedOutOfOutreach, DoNotContactReason)
    VALUES (@c3, @emp2, @lcOpp, @brEcon, @lsPart, N'CFO', 1, N'Asked for email only during evaluation');
-- Ravi is a PARTNER REP: a Person with NO Employee record. This is the D-6 case.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.SalesContact WHERE ID=@c4)
  INSERT INTO __mj_BizAppsSales.SalesContact (ID, LifecycleStageTypeID, LeadSourceTypeID, Seniority, OptedOutOfOutreach)
    VALUES (@c4, @lcOpp, @lsPart, N'Partner Principal', 0);

-- ============================ PIPELINE 1 — and the point about labels ============================
DECLARE @pipe1 UNIQUEIDENTIFIER='90111111-0000-4000-A000-000000000001';
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Pipeline WHERE ID=@pipe1)
  INSERT INTO __mj_BizAppsSales.Pipeline (ID, CompanyID, Name, Code, Description, DealTypeID, DefaultForecastCategoryTypeID,
        RequiresDealLines, CloseWonPolicy, IsDefault, DisplayRank, IsActive)
    VALUES (@pipe1, @co1, N'B2B', N'B2B',
      N'The main motion, per master plan §4.2. NOTE the winning stage is called "Signed", not "Closed Won" — the app still knows it is a win because the stage points at a DealStatusType with IsWon=1.',
      @dtNew, @fcPipe, 1,
      N'{"CreateContract":true,"ContractTypeCode":"Standard","TermMonths":12,"SubscriptionLinesTo":"Contract","OneTimeLinesTo":"Order","RequireApprovalTaskTypeCode":null}',
      1, 10, 1);

-- REPOINTED, NOT RE-INSERTED, and this is the seam between two seeding mechanisms.
--
-- `metadata/pipelines/` now ships this same pipeline — same UUID — so that installing the app leaves
-- something a tester can put a deal on. It has to name a company, and on a bare install that is a
-- created-on-demand 'Default Company'. This seed owns the DEV companies, so it moves the row rather
-- than adding a second one: same pipeline, real company, one board.
--
-- The INSERT above still matters for a database seeded WITHOUT a metadata push. Either path ends here.
UPDATE __mj_BizAppsSales.Pipeline SET CompanyID = @co1 WHERE ID = @pipe1 AND CompanyID <> @co1;

DECLARE @s1 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000001';
DECLARE @s2 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000002';
DECLARE @s3 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000003';
DECLARE @s4 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000004';
DECLARE @s5 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000005';
DECLARE @s6 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000006';

-- OrderStatusOnEntry — what entering each stage means for the deal's ORDER (S-US5, D-OS1).
--
-- NULL on the first two on purpose: Discovery and Qualification say NOTHING about the order, which is
-- the default and the common case. The order stays in whatever state it is in.
--
-- Quoted from Proposal onward, INCLUDING the winning stage. Andrew's rule is "Proposal or higher is
-- Quoted", and a quote is exactly what a proposal is. Confirmed is deliberately NOT seeded anywhere:
-- confirming books journal entries, and which stage earns that is the one open question here — see
-- DECISIONS-NEEDED.md DN-10. Changing it is one field on one row.
--
-- Voided on Lost (S-US7). It is also what makes the reopen case in S-US8 behave: the order is Voided,
-- Voided is TERMINAL in orders, and a reopen into Proposal therefore asks for a move orders refuses.
-- The deal reopens anyway with a warning, which is the intended outcome and not a bug to route around.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.PipelineStage WHERE ID=@s1)
  INSERT INTO __mj_BizAppsSales.PipelineStage (ID, PipelineID, Name, Code, DisplayOrder, Probability, ForecastCategoryTypeID, DealStatusTypeID, OrderStatusOnEntry, RottingDays, GuidanceMarkdown, IsActive) VALUES
   (@s1, @pipe1, N'Discovery',    N'DISC',  10, 10,  @fcPipe, @stOpen, NULL,        14, N'**What good looks like:** the economic buyer is named and the current cost of doing nothing is quantified.', 1),
   (@s2, @pipe1, N'Qualification',N'QUAL',  20, 25,  @fcPipe, @stOpen, NULL,        14, N'**What good looks like:** budget, authority and a compelling event are all confirmed in writing.', 1),
   (@s3, @pipe1, N'Proposal',     N'PROP',  30, 50,  @fcBest, @stOpen, N'Quoted',   21, N'**What good looks like:** a priced proposal the champion has seen and can defend internally.', 1),
   (@s4, @pipe1, N'Negotiation',  N'NEG',   40, 75,  @fcComm, @stOpen, N'Quoted',   21, N'**What good looks like:** a mutual action plan with dates, and legal engaged.', 1),
   (@s5, @pipe1, N'Signed',       N'SIGNED',50, 100, @fcClos, @stWon,  N'Quoted',   NULL, N'Contract executed. Entering it quotes the order; finance confirms it, which is what books the ledger.', 1),
   (@s6, @pipe1, N'Lost',         N'LOST',  60, 0,   @fcClos, @stLost, N'Voided',   NULL, N'A loss reason is mandatory — it is the highest-value, most-skipped data in any CRM. Entering it VOIDS the order.', 1);

-- ============================ PIPELINE 2 — a SIMPLE (header-only) motion ============================
DECLARE @pipe2 UNIQUEIDENTIFIER='90111111-0000-4000-A000-000000000002';
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Pipeline WHERE ID=@pipe2)
  INSERT INTO __mj_BizAppsSales.Pipeline (ID, CompanyID, Name, Code, Description, DealTypeID, DefaultForecastCategoryTypeID,
        RequiresDealLines, CloseWonPolicy, IsDefault, DisplayRank, IsActive)
    VALUES (@pipe2, @co2, N'D2C', N'D2C',
      N'A different company, a different motion (master plan §4.2). RequiresDealLines = 0: these deals never carry catalog lines — the flag survived the DealLine retirement and now means the deal''s EMBEDDED ORDER stays empty, so the amount is entered by hand and AmountIsComputed stays 0.',
      @dtNew, @fcPipe, 0, N'{"CreateContract":false,"OneTimeLinesTo":"Order"}', 1, 20, 1);

-- Repointed for the same reason as B2B — and this one carries the multi-company case (L-14 / §9.2),
-- which is the whole point of it having a DIFFERENT selling company from the pipeline above. The
-- shipped metadata cannot express that: it has one company to work with and no basis for inventing a
-- second, so demonstrating two is this seed's job.
UPDATE __mj_BizAppsSales.Pipeline SET CompanyID = @co2 WHERE ID = @pipe2 AND CompanyID <> @co2;

DECLARE @t1 UNIQUEIDENTIFIER='92111111-0000-4000-A000-000000000001';
DECLARE @t2 UNIQUEIDENTIFIER='92111111-0000-4000-A000-000000000002';
DECLARE @t3 UNIQUEIDENTIFIER='92111111-0000-4000-A000-000000000003';
-- The D2C motion has no proposal step, so only the winning stage speaks about the order. Introduced
-- and Evaluating leave it alone.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.PipelineStage WHERE ID=@t1)
  INSERT INTO __mj_BizAppsSales.PipelineStage (ID, PipelineID, Name, Code, DisplayOrder, Probability, ForecastCategoryTypeID, DealStatusTypeID, OrderStatusOnEntry, RottingDays, IsActive) VALUES
   (@t1, @pipe2, N'Introduced', N'INTRO',  10, 20, @fcPipe, @stOpen, NULL,      30, 1),
   (@t2, @pipe2, N'Evaluating', N'EVAL',   20, 60, @fcComm, @stOpen, NULL,      30, 1),
   (@t3, @pipe2, N'Booked',     N'BOOKED', 30, 100,@fcClos, @stWon,  N'Quoted', NULL, 1);

-- ============================ DEALS ============================
DECLARE @d1 UNIQUEIDENTIFIER='93111111-0000-4000-A000-000000000001';
DECLARE @d2 UNIQUEIDENTIFIER='93111111-0000-4000-A000-000000000002';
DECLARE @d3 UNIQUEIDENTIFIER='93111111-0000-4000-A000-000000000003';
DECLARE @d4 UNIQUEIDENTIFIER='93111111-0000-4000-A000-000000000004';
DECLARE @d5 UNIQUEIDENTIFIER='93111111-0000-4000-A000-000000000005';
DECLARE @d6 UNIQUEIDENTIFIER='93111111-0000-4000-A000-000000000006';
DECLARE @d7 UNIQUEIDENTIFIER='93111111-0000-4000-A000-000000000007';

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal WHERE ID=@d1)
INSERT INTO __mj_BizAppsSales.Deal (ID, DealNumber, Name, PipelineID, PipelineStageID, DealTypeID, DealStatusTypeID,
   AccountID, PrimaryContactID, CompanyID, OwnerEmployeeID, Amount, AmountIsComputed, TermMonths,
   ExpectedCloseDate, Probability, ForecastCategoryTypeID, LeadSourceTypeID, Description, NextStep, NextStepDate) VALUES
 (@d1, N'DEAL-9001', N'Northwind Health — Platform Rollout', @pipe1, @s4, @dtNew, @stOpen,
  @acc1, @c1, @co1, @emp1, 185000.0000, 0, 24, '2026-09-30', 75, @fcComm, @lsRef,
  N'Multi-site rollout. In Negotiation, forecast Commit.', N'Legal redlines back from their counsel', '2026-08-12'),
 (@d2, N'DEAL-9002', N'Cascade Manufacturing — Pilot', @pipe1, @s2, @dtNew, @stOpen,
  @acc2, @c2, @co1, @emp1, 42000.0000, 0, 12, '2026-11-15', 25, @fcPipe, @lsOut,
  N'Early. Champion identified, economic buyer not yet confirmed.', N'Book discovery with their CFO', '2026-08-08'),
 (@d3, N'DEAL-9003', N'Northwind Health — Year 2 Renewal', @pipe1, @s3, @dtRen, @stOpen,
  @acc1, @c1, @co1, @emp2, 96000.0000, 0, 12, '2026-10-31', 50, @fcBest, @lsRef,
  N'RENEWAL: DealType.RequiresRenewalSource=1, so closing this routes to Contracts.RenewTerm rather than CreateFromDeal.',
  N'Confirm seat count for the coming year', '2026-08-20'),
 (@d4, N'DEAL-9004', N'Beacon Charter Schools — District Licence', @pipe2, @t2, @dtNew, @stOpen,
  @acc3, @c3, @co2, @emp2, 28000.0000, 0, 12, '2026-10-01', 60, @fcComm, @lsPart,
  N'SIMPLE deal on a header-only pipeline: no catalog lines, amount entered by hand. Partner-SOURCED (see LeadSourceType) but type NEW — how it was originated and what kind of motion it is are two different facts, which is why they are two different columns.', N'Partner to introduce the superintendent', '2026-08-15'),
 (@d5, N'DEAL-9005', N'Cascade Manufacturing — Line 2 Expansion', @pipe1, @s5, @dtUps, @stWon,
  @acc2, @c2, @co1, @emp1, 64000.0000, 0, 12, '2026-07-31', 100, @fcClos, @lsOut,
  N'WON — and note the stage is called "Signed". Behaviour comes from DealStatusType.IsWon, not the label. Type UPSELL: more of what Cascade already buys.', NULL, NULL),
 (@d6, N'DEAL-9006', N'Beacon Charter Schools — Add-on Modules', @pipe1, @s6, @dtUps, @stLost,
  @acc3, @c3, @co1, @emp3, 15000.0000, 0, 12, '2026-07-15', 0, @fcClos, @lsPart,
  N'LOST on price. Loss reason is the app''s only mandatory field.', NULL, NULL);

UPDATE __mj_BizAppsSales.Deal SET ActualCloseDate='2026-07-28', ClosedAt='2026-07-28T16:40:00Z' WHERE ID=@d5 AND ActualCloseDate IS NULL;
UPDATE __mj_BizAppsSales.Deal SET ActualCloseDate='2026-07-14', ClosedAt='2026-07-14T11:05:00Z', LossReasonID=@lrPrice,
       LossNotes=N'Incumbent discounted 30% at the last minute; we declined to match.' WHERE ID=@d6 AND LossReasonID IS NULL;

--
-- ============================ WHY THERE ARE NO DEAL LINES ANY MORE ============================
--
-- THIS SEED USED TO INSERT `DealLine` ROWS, AND IT WAS BROKEN. `DealLine` and `DealLineType` were
-- dropped when the order became an embedded record on the deal (S-US4), so the two `SELECT ID FROM
-- DealLineType` lookups this file opened with failed on `Invalid object name` and took the entire
-- batch with them. Every demo seed since the drop has been failing at that point — which is why a
-- host could have deals with no order lines at all and nobody noticed the seed had stopped halfway.
--
-- A deal's lines now live on its ORDER, and they are ORDERS' rows: `OrderLine.UnitPrice` and
-- `CompanyID` are stamped by `OrderLineEntityServer` from the product, and `LineTotalGross` is
-- computed by orders' pricing engine. A SQL seed cannot write them without inventing money, which is
-- precisely what Rule 1 forbids — so it does not write them at all.
--
-- The consequence is honest rather than convenient: seeded deals carry a STATED amount
-- (`AmountIsComputed = 0`, the L-2 simple deal) and no order lines. `DealEntityServer` leaves such an
-- amount alone (save-deal.SD22), so the figures below are what the dashboard shows and they are true
-- to what they claim to be. Adding lines that add up to them needs orders to price them, which means
-- driving the entity layer rather than SQL — see DECISIONS-NEEDED.md DN-15.

-- ============================ THE D2C LINED DEAL (DEAL-9007) ============================
--
-- WHY THIS ONE EXISTS. Every other lined deal sits on the B2B pipeline, whose policy books a
-- CONFIRMED order. This one carries a line on the ORDER-ONLY pipeline, whose policy books a DRAFT.
-- Closing the two and getting different order states out of the SAME close action is the clearest
-- proof available that routing reads the pipeline's CloseWonPolicy rather than its name.
--
-- Its product must belong to the ORDER-ONLY pipeline's selling company (@co2), not @co1 --
-- products are per-company and the picker filters on exactly that, so a @co1 product here would be
-- unpickable in the UI and unroutable on close.
--
-- Its amount is STATED, like every other seeded deal: no line rows, nothing computed. See the note
-- above about why this seed no longer writes lines.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal WHERE ID=@d7)
INSERT INTO __mj_BizAppsSales.Deal (ID, DealNumber, Name, PipelineID, PipelineStageID, DealTypeID, DealStatusTypeID,
   AccountID, PrimaryContactID, CompanyID, OwnerEmployeeID, Amount, AmountIsComputed, TermMonths,
   ExpectedCloseDate, Probability, ForecastCategoryTypeID, LeadSourceTypeID, Description, NextStep, NextStepDate) VALUES
 (@d7, N'DEAL-9007', N'Beacon Charter Schools — Campus Seats', @pipe2, @t2, @dtNew, @stOpen,
  @acc3, @c3, @co2, @emp2, 9500.0000, 0, 12, '2026-10-20', 60, @fcComm, @lsPart,
  N'A LINED deal on the order-only pipeline. Its embedded order carries the seats; closing it creates no contract, where the same action on a B2B deal does. Same machinery, different policy.',
  N'Confirm campus count before quoting', '2026-08-25');

-- ============================ THE EMBEDDED ORDERS ARE NOT SEEDED HERE ============================
--
-- THIS BLOCK USED TO INSERT `OrderHeader` AND `OrderLine` ROWS, with UnitPrice transcribed from the
-- catalogue. Both halves were wrong and the second is the one that matters:
--
--   * TRANSCRIBING A PRICE IS INVENTING MONEY. `OrderLine.UnitPrice` and `CompanyID` are stamped by
--     `OrderLineEntityServer` from the product, and `LineTotalGross` comes from orders pricing
--     engine. A SQL INSERT can only produce them by copying a number and asserting it, which is
--     exactly what Rule 1 exists to prevent -- in the seed that is supposed to DEMONSTRATE Rule 1.
--   * IT BYPASSED PROVISIONING. An order written here carries none of what `DealEntityServer` puts
--     on one, and the deal amount cache never learns the order exists.
--
-- `scripts/seed-demo-lines.mjs` does it through the entity layer instead: lines by product and
-- quantity only, priced by orders, with the amount cache following. It runs from the bottom of this
-- script. The close stamps that used to sit in this block are already set further up -- keeping them
-- here as well was how one of the three merged versions came to write them twice. DN-15.
-- ============================ PAYMENT SCHEDULE — the EXCEPTION case, on one deal only ============================
-- Five of the six demo deals carry NO rows here, and that is the design: no rows means standard terms
-- (100% on execution). Only DEAL-9001 negotiated instalments, so only DEAL-9001 has a schedule. "Did
-- this deal negotiate payment terms?" is therefore a row count, not arithmetic.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID=@d1)
INSERT INTO __mj_BizAppsSales.DealPaymentSchedule (DealID, PaymentDate, Amount, Description, DisplayOrder) VALUES
 (@d1, '2026-10-01', 80400.0000,  N'40% on execution',                    10),
 (@d1, '2027-01-01', 60300.0000,  N'30% on completion of Phase 1 rollout', 20),
 (@d1, '2027-04-01', 60300.0000,  N'30% on final acceptance',              30);

-- ============================ DEAL TEAM — including the D-6 partner rep ============================
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealTeamMember WHERE DealID=@d1)
INSERT INTO __mj_BizAppsSales.DealTeamMember (DealID, EmployeeID, PersonID, DealRoleID, AttributionPct, IsActive, Notes) VALUES
 (@d1, @emp1, NULL, @roleOwner, 100.00, 1, N'Owner. Deal.OwnerEmployeeID is a server-maintained stamp of this row.'),
 (@d1, @emp2, NULL, @roleSE,    NULL,   1, N'Sales engineer — DealRole.AllowsMultiplePerDeal=1 for this role.'),
 (@d1, @emp3, NULL, @roleSDR,   NULL,   1, N'Sourced the opportunity.');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealTeamMember WHERE DealID=@d4)
INSERT INTO __mj_BizAppsSales.DealTeamMember (DealID, EmployeeID, PersonID, DealRoleID, AttributionPct, IsActive, Notes) VALUES
 (@d4, @emp2, NULL, @roleOwner, 100.00, 1, N'Owner.'),
 -- D-6: a partner rep who is a common.Person with NO Employee record. EmployeeID is NULL here.
 (@d4, NULL, @c4,   @rolePM,    NULL,   1, N'D-6: partner principal, a Person with no Employee record. The exactly-one-of CHECK allows exactly this.');

-- ============================ BUYING COMMITTEE ============================
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealContactRole WHERE DealID=@d1)
INSERT INTO __mj_BizAppsSales.DealContactRole (DealID, SalesContactID, BuyingRoleTypeID, Influence, Notes) VALUES
 (@d1, @c1, @brEcon,  90.00, N'Signs the contract.'),
 (@d1, @c2, @brChamp, 70.00, N'Internal advocate; runs the evaluation.');

-- ============================ STAGE HISTORY — amount stamped AT each transition ============================
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealStageEvent WHERE DealID=@d1)
INSERT INTO __mj_BizAppsSales.DealStageEvent (DealID, FromStageID, ToStageID, FromDealStatusTypeID, ToDealStatusTypeID,
   ChangedAt, DaysInPreviousStage, AmountAtTransition, ProbabilityAtTransition, Notes) VALUES
 (@d1, NULL, @s1, NULL,    @stOpen, '2026-05-02T14:10:00Z', NULL, 120000.0000, 10, N'Created from an inbound referral.'),
 (@d1, @s1,  @s2, @stOpen, @stOpen, '2026-05-20T09:30:00Z', 18,   120000.0000, 25, N'Economic buyer confirmed.'),
 (@d1, @s2,  @s3, @stOpen, @stOpen, '2026-06-18T16:05:00Z', 29,   150000.0000, 50, N'Scope grew to a second site — amount revised up.'),
 (@d1, @s3,  @s4, @stOpen, @stOpen, '2026-07-22T11:45:00Z', 34,   185000.0000, 75, N'Proposal accepted in principle; into negotiation.');
-- The amount was 120k, then 150k, now 185k. The history reconstructs BECAUSE each row stamped its own
-- amount — reading Deal.Amount alone would wrongly report 185k for every one of these transitions.

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealStageEvent WHERE DealID=@d5)
INSERT INTO __mj_BizAppsSales.DealStageEvent (DealID, FromStageID, ToStageID, FromDealStatusTypeID, ToDealStatusTypeID,
   ChangedAt, DaysInPreviousStage, AmountAtTransition, ProbabilityAtTransition, Notes) VALUES
 (@d5, @s4, @s5, @stOpen, @stWon, '2026-07-28T16:40:00Z', 12, 64000.0000, 100, N'Signed. A closing status with LocksDeal=1 freezes the deal from here.');

-- ============================ POINT-IN-TIME FORECAST ============================
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.ForecastSnapshot WHERE SnapshotJSON LIKE '%"demo":true%')
INSERT INTO __mj_BizAppsSales.ForecastSnapshot (CompanyID, PipelineID, OwnerEmployeeID, PeriodStart, PeriodEnd, CapturedAt,
   CommitAmount, BestCaseAmount, PipelineAmount, ClosedAmount, SnapshotJSON)
VALUES (@co1, @pipe1, @emp1, '2026-07-01', '2026-09-30', '2026-08-01T06:00:00Z',
   185000.0000, 281000.0000, 323000.0000, 64000.0000,
   N'{"demo":true,"note":"What the forecast looked like on 1 Aug. Deal.Amount has moved since — which is exactly why this table exists."}');

-- ============================ MAKE IT PLEASANT TO CLICK AROUND ============================
-- Two data-only navigation fixes, both discovered by actually driving the UI:
--
--   1. ApplicationEntity.Sequence decides which entity the app OPENS ON. CodeGen's default ordering
--      opened "Deal Contact Roles" — entity 5 of 19, and a poor first impression. Reordered so the app
--      lands on Deals with the demo rows already on screen.
--
--   2. The All-Entities panel is a 19-card ALPHABETICAL grid, and Sequence does NOT reorder it. It has a
--      "My Favorites" toggle, but seeding that from SQL was attempted and does not work: neither
--      __mj.UserApplicationEntity nor __mj.UserFavorite (against the 'MJ: Entities' meta-entity)
--      populates it — the panel still reports "0 entities". Whatever backs it is not reachable this way,
--      so favourites are left to the UI: click the star on an entity and it sticks. The panel's SEARCH
--      box (or "/") is the fast path in the meantime — type "deal" and the list filters instantly.
DECLARE @app UNIQUEIDENTIFIER = (SELECT ID FROM __mj.Application WHERE Name='__mj_BizAppsSales');
DECLARE @order TABLE (EntityName NVARCHAR(255), Seq INT);
INSERT INTO @order VALUES
 ('MJ_BizApps_Sales: Deals',1),('MJ_BizApps_Sales: Pipelines',2),('MJ_BizApps_Sales: Pipeline Stages',3),
 ('MJ_BizApps_Sales: Sales Accounts',4),('MJ_BizApps_Sales: Sales Contacts',5),
 ('MJ_BizApps_Sales: Deal Lines',6),('MJ_BizApps_Sales: Deal Team Members',7),
 ('MJ_BizApps_Sales: Deal Stage Events',8),('MJ_BizApps_Sales: Deal Contact Roles',9),
 ('MJ_BizApps_Sales: Forecast Snapshots',10),
 ('MJ_BizApps_Sales: Deal Status Types',11),('MJ_BizApps_Sales: Deal Types',12),('MJ_BizApps_Sales: Deal Roles',13),
 ('MJ_BizApps_Sales: Forecast Category Types',14),('MJ_BizApps_Sales: Loss Reasons',15),
 ('MJ_BizApps_Sales: Lead Source Types',16),('MJ_BizApps_Sales: Lifecycle Stage Types',17),
 ('MJ_BizApps_Sales: Buying Role Types',18),('MJ_BizApps_Sales: Account Types',19);
UPDATE ae SET Sequence = o.Seq
FROM __mj.ApplicationEntity ae JOIN __mj.Entity e ON ae.EntityID=e.ID JOIN @order o ON o.EntityName=e.Name
WHERE ae.ApplicationID=@app;

COMMIT;
SELECT 'committed' AS status;
SQL

$SQLCMD -d "${DB_DATABASE}" -h -1 -W -i "$(cygpath -w "$TMP" 2>/dev/null || echo "$TMP")"

# ── THE PRICED HALF, THROUGH THE ENTITY LAYER ────────────────────────────────────────────────────
#
# After the SQL half has COMMITTED, deliberately. This step loads the provider and both server
# packages, and it is the slow part of the seed; running it inside the transaction above would hold
# table locks across a provider startup. It is also allowed to fail without failing the seed: the SQL
# rows are already committed by here, so aborting would leave a half-seeded database, and a demo where
# every deal is hand-typed is still a working demo -- just a less complete story.
say "Pricing five deals through the entity layer"
if node scripts/seed-demo-lines.mjs; then
    :
else
    echo ""
    echo "  !! Order lines were NOT seeded, so all seven deals stay hand-typed."
    echo "     The demo works; the stated-vs-priced distinction just is not visible."
    echo "     Re-run on its own once fixed:  node scripts/seed-demo-lines.mjs"
fi

say "What the demo now contains"
$SQLCMD -d "${DB_DATABASE}" -h -1 -W -Q "
SET NOCOUNT ON;
SELECT '  companies        ' + CAST(COUNT(*) AS varchar) FROM __mj.Company
UNION ALL SELECT '  employees        ' + CAST(COUNT(*) AS varchar) FROM __mj.Employee
UNION ALL SELECT '  pipelines        ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Pipeline
UNION ALL SELECT '  stages           ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.PipelineStage
UNION ALL SELECT '  accounts         ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.SalesAccount
UNION ALL SELECT '  contacts         ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.SalesContact
UNION ALL SELECT '  deals            ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal
UNION ALL SELECT '  deals w/ order   ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal WHERE OrderID IS NOT NULL
UNION ALL SELECT '  payment sched.   ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealPaymentSchedule
UNION ALL SELECT '  team members     ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealTeamMember
UNION ALL SELECT '  buying committee ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealContactRole
UNION ALL SELECT '  stage events     ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealStageEvent
UNION ALL SELECT '  forecast snaps   ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.ForecastSnapshot
UNION ALL SELECT '  priced deals     ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal WHERE AmountIsComputed = 1
UNION ALL SELECT '  stated deals     ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal WHERE AmountIsComputed = 0;"

cat <<'NEXT'

Demo data seeded. Remove it again with:
    scripts/seed-demo-data.sh --remove

Walkthrough and talking points: docs/DEMO.md
NEXT
