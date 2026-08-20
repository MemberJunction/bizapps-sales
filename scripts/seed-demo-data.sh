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
#   4. SALES NEVER COMPUTES MONEY, and the embedded order is where you can see it. A lined deal's
#      intent — product and quantity — lives on ORDER lines now, not on the deal, because DealLine is
#      retired. Deal.AmountIsComputed = 0 still says the header figure is a human's estimate rather
#      than a traceable answer, and nothing in this app derives it. The prices on the seeded order
#      lines are TRANSCRIBED from the catalogue by this script, which is a seeding convenience and not
#      a pricing path: no code in sales multiplies, discounts, or totals anything.
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
      N'{"CreateContract":true,"ContractTypeCode":"Standard","TermMonths":12,"SubscriptionLinesTo":"Contract","OneTimeLinesTo":"Order","OrderState":"Confirmed","RequireApprovalTaskTypeCode":null}',
      1, 10, 1);

DECLARE @s1 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000001';
DECLARE @s2 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000002';
DECLARE @s3 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000003';
DECLARE @s4 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000004';
DECLARE @s5 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000005';
DECLARE @s6 UNIQUEIDENTIFIER='91111111-0000-4000-A000-000000000006';

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.PipelineStage WHERE ID=@s1)
  INSERT INTO __mj_BizAppsSales.PipelineStage (ID, PipelineID, Name, Code, DisplayOrder, Probability, ForecastCategoryTypeID, DealStatusTypeID, RottingDays, GuidanceMarkdown, IsActive) VALUES
   (@s1, @pipe1, N'Discovery',    N'DISC',  10, 10,  @fcPipe, @stOpen, 14, N'**What good looks like:** the economic buyer is named and the current cost of doing nothing is quantified.', 1),
   (@s2, @pipe1, N'Qualification',N'QUAL',  20, 25,  @fcPipe, @stOpen, 14, N'**What good looks like:** budget, authority and a compelling event are all confirmed in writing.', 1),
   (@s3, @pipe1, N'Proposal',     N'PROP',  30, 50,  @fcBest, @stOpen, 21, N'**What good looks like:** a priced proposal the champion has seen and can defend internally.', 1),
   (@s4, @pipe1, N'Negotiation',  N'NEG',   40, 75,  @fcComm, @stOpen, 21, N'**What good looks like:** a mutual action plan with dates, and legal engaged.', 1),
   (@s5, @pipe1, N'Signed',       N'SIGNED',50, 100, @fcClos, @stWon,  NULL, N'Contract executed. This stage is where Sales.CloseDeal will create the contract and orders.', 1),
   (@s6, @pipe1, N'Lost',         N'LOST',  60, 0,   @fcClos, @stLost, NULL, N'A loss reason is mandatory — it is the highest-value, most-skipped data in any CRM.', 1);

-- ============================ PIPELINE 2 — a SIMPLE (header-only) motion ============================
DECLARE @pipe2 UNIQUEIDENTIFIER='90111111-0000-4000-A000-000000000002';
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Pipeline WHERE ID=@pipe2)
  INSERT INTO __mj_BizAppsSales.Pipeline (ID, CompanyID, Name, Code, Description, DealTypeID, DefaultForecastCategoryTypeID,
        RequiresDealLines, CloseWonPolicy, IsDefault, DisplayRank, IsActive)
    VALUES (@pipe2, @co2, N'D2C', N'D2C',
      N'A different company, a different motion (master plan §4.2). RequiresDealLines = 0: these deals never carry catalog lines — the flag survived the DealLine retirement and now means the deal''s EMBEDDED ORDER stays empty, so the amount is entered by hand and AmountIsComputed stays 0.',
      @dtNew, @fcPipe, 0, N'{"CreateContract":false,"OneTimeLinesTo":"Order","OrderState":"Draft"}', 1, 20, 1);

DECLARE @t1 UNIQUEIDENTIFIER='92111111-0000-4000-A000-000000000001';
DECLARE @t2 UNIQUEIDENTIFIER='92111111-0000-4000-A000-000000000002';
DECLARE @t3 UNIQUEIDENTIFIER='92111111-0000-4000-A000-000000000003';
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.PipelineStage WHERE ID=@t1)
  INSERT INTO __mj_BizAppsSales.PipelineStage (ID, PipelineID, Name, Code, DisplayOrder, Probability, ForecastCategoryTypeID, DealStatusTypeID, RottingDays, IsActive) VALUES
   (@t1, @pipe2, N'Introduced', N'INTRO',  10, 20, @fcPipe, @stOpen, 30, 1),
   (@t2, @pipe2, N'Evaluating', N'EVAL',   20, 60, @fcComm, @stOpen, 30, 1),
   (@t3, @pipe2, N'Booked',     N'BOOKED', 30, 100,@fcClos, @stWon,  NULL, 1);

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


-- DEAL-9007 sits apart from the five above because it is the CONTRAST CASE, and it is easier to see
-- when it is not buried in a six-row VALUES list. It is a lined deal on the ORDER-ONLY pipeline: the
-- same close action that gives a B2B deal a contract gives this one none, because the policy differs
-- and nothing in the code reads either pipeline's name. Its order is seeded further down with the
-- other embedded orders.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal WHERE ID=@d7)
INSERT INTO __mj_BizAppsSales.Deal (ID, DealNumber, Name, PipelineID, PipelineStageID, DealTypeID, DealStatusTypeID,
   AccountID, PrimaryContactID, CompanyID, OwnerEmployeeID, Amount, AmountIsComputed, TermMonths,
   ExpectedCloseDate, Probability, ForecastCategoryTypeID, LeadSourceTypeID, Description, NextStep, NextStepDate) VALUES
 (@d7, N'DEAL-9007', N'Beacon Charter Schools — Campus Seats', @pipe2, @t2, @dtNew, @stOpen,
  @acc3, @c3, @co2, @emp2, 9500.0000, 0, 12, '2026-10-20', 60, @fcComm, @lsPart,
  N'A LINED deal on the order-only pipeline. Its embedded order carries the seats; closing it creates no contract, where the same action on a B2B deal does. Same machinery, different policy.',
  N'Confirm campus count before quoting', '2026-08-25');

UPDATE __mj_BizAppsSales.Deal SET ActualCloseDate='2026-07-28', ClosedAt='2026-07-28T16:40:00Z' WHERE ID=@d5 AND ActualCloseDate IS NULL;
UPDATE __mj_BizAppsSales.Deal SET ActualCloseDate='2026-07-14', ClosedAt='2026-07-14T11:05:00Z', LossReasonID=@lrPrice,
       LossNotes=N'Incumbent discounted 30% at the last minute; we declined to match.' WHERE ID=@d6 AND LossReasonID IS NULL;

-- ============================ THE EMBEDDED ORDER — where lines live now ============================
--
-- THE DEAL HOLDS NO LINE ITEMS. It used to: `DealLine` carried product, quantity, the requested
-- discount and a transcribed set of signed figures, and closing the deal copied them onto an order.
-- That table is retired. The ORDER is now an embedded record on the deal -- `Deal.OrderID`, a real FK
-- to orders' `OrderHeader` -- created with the deal, and adding a line to a deal writes an ORDER line.
-- One place holds what is being sold, which is the point: two tables holding the same intent is how
-- they end up disagreeing.
--
-- WHY THIS SCRIPT WRITES ORDERS IN RAW SQL. Everywhere else, an order is provisioned through the
-- entity layer so orders' own server code mints the number, stamps the company and prices the lines.
-- A seed script cannot reach that: it is `sqlcmd`, there is no provider, and the provisioning path is
-- deliberately not duplicated here. So these rows are written directly and the figures are TRANSCRIBED
-- FICTION, exactly as the old signed figures were -- a demo dataset, not a priced quote.
--
-- `UnitPrice` is drawn from the catalogue's own `ProductPrice.Amount` rather than invented, so the
-- numbers on screen agree with what the pricing engine would resolve for the same product. Sales still
-- computes nothing: this script transcribes a price it looked up, and no code path in the app does.
--
-- ONLY THE LINED DEALS GET AN ORDER. Under the real model every deal is created with one; here, three
-- deals carry lines and the rest are header-only, which keeps the demo showing the contrast that
-- matters (a priced motion beside a simple one) rather than seeding four empty orders to be uniform.
--
-- STATUS IS DRAFT. The model advances an order to Quoted when its deal reaches the agreement stage or
-- higher, but nothing in the schema yet says WHICH stage that is -- see DECISIONS-NEEDED.md. Draft is
-- the honest seed: it is what deal creation produces, and it is what an unadvanced order really is.

IF OBJECT_ID('__mj_BizAppsOrders.OrderHeader', 'U') IS NOT NULL
BEGIN
    -- Fixed ids and demo-prefixed numbers, so this is idempotent and the teardown can find exactly
    -- these rows. `OrderNumber` carries a UNIQUE index; the prefix keeps demo orders from ever
    -- colliding with a number orders' own sequence mints.
    DECLARE @o1 UNIQUEIDENTIFIER='90111111-0000-4000-A000-000000000001';  -- DEAL-9001
    DECLARE @o3 UNIQUEIDENTIFIER='90111111-0000-4000-A000-000000000003';  -- DEAL-9003
    DECLARE @o7 UNIQUEIDENTIFIER='90111111-0000-4000-A000-000000000007';  -- DEAL-9007

    /* ── the catalogue, resolved by SKU ──────────────────────────────────────────────────────────
     *
     * BY SKU, NOT BY NAME AND NOT BY HARDCODED ID. A product name is a label somebody will rewrite;
     * an id differs per install. `SKU` is the catalogue's stable business key, and resolving through
     * it means this script keeps working against a reseeded orders catalogue.
     *
     * Sellability is checked the same way the picker checks it -- Active, and inside its availability
     * window -- so a seed can never hand the demo a product the UI would refuse to offer.
     */
    DECLARE @today date = CAST(SYSUTCDATETIME() AS date);

    DECLARE @pStd UNIQUEIDENTIFIER, @pStdPrice DECIMAL(19,4), @pStdName NVARCHAR(255);
    DECLARE @pPrm UNIQUEIDENTIFIER, @pPrmPrice DECIMAL(19,4), @pPrmName NVARCHAR(255);
    DECLARE @pSeat UNIQUEIDENTIFIER, @pSeatPrice DECIMAL(19,4), @pSeatName NVARCHAR(255);

    SELECT TOP 1 @pStd = p.ID, @pStdName = p.Name,
           @pStdPrice = (SELECT TOP 1 pp.Amount FROM __mj_BizAppsOrders.ProductPrice pp
                          WHERE pp.ProductID = p.ID AND pp.Status = 'Active' ORDER BY pp.Priority, pp.__mj_CreatedAt)
      FROM __mj_BizAppsOrders.Product p
     WHERE p.SKU = 'PLAT-STD' AND p.CompanyID = @co1 AND p.Status = 'Active'
       AND (p.AvailableFrom IS NULL OR p.AvailableFrom <= @today)
       AND (p.AvailableTo   IS NULL OR p.AvailableTo   >= @today);

    SELECT TOP 1 @pPrm = p.ID, @pPrmName = p.Name,
           @pPrmPrice = (SELECT TOP 1 pp.Amount FROM __mj_BizAppsOrders.ProductPrice pp
                          WHERE pp.ProductID = p.ID AND pp.Status = 'Active' ORDER BY pp.Priority, pp.__mj_CreatedAt)
      FROM __mj_BizAppsOrders.Product p
     WHERE p.SKU = 'PLAT-PRM' AND p.CompanyID = @co1 AND p.Status = 'Active'
       AND (p.AvailableFrom IS NULL OR p.AvailableFrom <= @today)
       AND (p.AvailableTo   IS NULL OR p.AvailableTo   >= @today);

    SELECT TOP 1 @pSeat = p.ID, @pSeatName = p.Name,
           @pSeatPrice = (SELECT TOP 1 pp.Amount FROM __mj_BizAppsOrders.ProductPrice pp
                           WHERE pp.ProductID = p.ID AND pp.Status = 'Active' ORDER BY pp.Priority, pp.__mj_CreatedAt)
      FROM __mj_BizAppsOrders.Product p
     WHERE p.SKU = 'EDU-SEAT' AND p.CompanyID = @co2 AND p.Status = 'Active'
       AND (p.AvailableFrom IS NULL OR p.AvailableFrom <= @today)
       AND (p.AvailableTo   IS NULL OR p.AvailableTo   >= @today);

    -- One sellable product is enough to stay coherent. Falling back beats seeding a line with a NULL
    -- ProductID -- which the schema now refuses outright, because OrderLine.ProductID is NOT NULL.
    IF @pPrm IS NULL BEGIN SET @pPrm = @pStd; SET @pPrmName = @pStdName; SET @pPrmPrice = @pStdPrice; END

    IF @pStd IS NULL OR @pSeat IS NULL
        PRINT 'Catalogue not seeded for one or both selling companies - lined deals will be header-only. Run orders'' product seed first.';

    /* ── DEAL-9001 — the priced B2B motion, two distinguishable lines ───────────────────────────── */
    IF @pStd IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.OrderHeader WHERE ID=@o1)
    BEGIN
        INSERT INTO __mj_BizAppsOrders.OrderHeader (ID, OrderNumber, OrderDate, Status, CompanyID, Description)
        VALUES (@o1, N'ORD-DEMO-9001', '2026-08-01', 'Draft', @co1,
                N'The embedded order for DEAL-9001. Created with the deal, holds every line, and is what finance reviews and advances after Closed Won.');

        INSERT INTO __mj_BizAppsOrders.OrderLine (OrderHeaderID, ProductID, CompanyID, LineNumber, Quantity, UnitPrice, Description) VALUES
         (@o1, @pStd, @co1, 1, 250, @pStdPrice, N'Platform seats — the recurring core of the rollout'),
         (@o1, @pPrm, @co1, 2,  20, @pPrmPrice, N'Premium seats for their clinical leads');

        UPDATE __mj_BizAppsSales.Deal SET OrderID = @o1 WHERE ID = @d1;
    END

    /* ── DEAL-9003 — a RENEWAL, so the same shape carries a different meaning ───────────────────── */
    IF @pStd IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.OrderHeader WHERE ID=@o3)
    BEGIN
        INSERT INTO __mj_BizAppsOrders.OrderHeader (ID, OrderNumber, OrderDate, Status, CompanyID, Description)
        VALUES (@o3, N'ORD-DEMO-9003', '2026-08-05', 'Draft', @co1,
                N'The embedded order for the Year 2 renewal. DealType.RequiresRenewalSource routes the CONTRACT differently; the order is the same shape either way.');

        INSERT INTO __mj_BizAppsOrders.OrderLine (OrderHeaderID, ProductID, CompanyID, LineNumber, Quantity, UnitPrice, Description) VALUES
         (@o3, @pStd, @co1, 1, 180, @pStdPrice, N'Renewal seats — fewer than year one, which is the story');

        UPDATE __mj_BizAppsSales.Deal SET OrderID = @o3 WHERE ID = @d3;
    END

    /* ── DEAL-9007 — the SAME machinery on the other pipeline ───────────────────────────────────
     *
     * WHY THIS ONE EXISTS. Every other lined deal sits on the B2B pipeline, whose CloseWonPolicy
     * creates a contract. This one carries lines on the order-only pipeline, whose policy does not.
     * Closing the two and watching one produce a contract and the other not -- from the SAME close
     * action -- is the clearest proof available that routing reads the policy rather than the name.
     *
     * Its product must belong to THAT pipeline's selling company. Products are per-company and the
     * picker filters on exactly that, so a @co1 product here would be unpickable in the UI.
     */
    IF @pSeat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.OrderHeader WHERE ID=@o7)
    BEGIN
        INSERT INTO __mj_BizAppsOrders.OrderHeader (ID, OrderNumber, OrderDate, Status, CompanyID, Description)
        VALUES (@o7, N'ORD-DEMO-9007', '2026-08-10', 'Draft', @co2,
                N'The embedded order for the D2C campus deal — same machinery, different pipeline policy.');

        INSERT INTO __mj_BizAppsOrders.OrderLine (OrderHeaderID, ProductID, CompanyID, LineNumber, Quantity, UnitPrice, Description) VALUES
         (@o7, @pSeat, @co2, 1, 25, @pSeatPrice, N'Campus seats — one line, deliberately: the contrast is the pipeline, not the size');

        UPDATE __mj_BizAppsSales.Deal SET OrderID = @o7 WHERE ID = @d7;
    END
END
ELSE
    PRINT 'bizapps-orders is not installed - deals seeded header-only, with no embedded orders.';
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
UNION ALL SELECT '  demo orders      ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsOrders.OrderHeader WHERE OrderNumber LIKE 'ORD-DEMO-9%'
UNION ALL SELECT '  order lines      ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsOrders.OrderLine ol JOIN __mj_BizAppsOrders.OrderHeader oh ON oh.ID=ol.OrderHeaderID WHERE oh.OrderNumber LIKE 'ORD-DEMO-9%'
UNION ALL SELECT '  payment sched.   ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealPaymentSchedule
UNION ALL SELECT '  team members     ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealTeamMember
UNION ALL SELECT '  buying committee ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealContactRole
UNION ALL SELECT '  stage events     ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.DealStageEvent
UNION ALL SELECT '  forecast snaps   ' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.ForecastSnapshot;"

cat <<'NEXT'

Demo data seeded. Remove it again with:
    scripts/seed-demo-data.sh --remove

Walkthrough and talking points: docs/DEMO.md
NEXT
