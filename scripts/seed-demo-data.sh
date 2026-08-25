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
_PRESET_DB_DATABASE="${DB_DATABASE:-}"
set -a; . ./.env; set +a

# AN EXPLICIT DB_DATABASE FROM THE ENVIRONMENT WINS OVER .env.
#
# `set -a; . ./.env` ASSIGNS, so it silently overwrites anything already exported -- which made
# `DB_DATABASE=SomeOtherDb bash scripts/seed-demo-data.sh` seed the database named in .env instead. On a
# machine where several sessions share one checkout that is a script which cannot be pointed at a
# target: it always writes wherever .env happens to point, which during a fresh-install test was very
# nearly the live demo host.
#
# A value exported by the caller is captured before the source and reinstated after. Unset means
# unchanged behaviour, so the ordinary `bash scripts/seed-demo-data.sh` still reads .env exactly as before.
# The same defect was fixed in rebuild-db.sh and append-codegen.sh; those four are all of them.
[ -n "${_PRESET_DB_DATABASE:-}" ] && DB_DATABASE="$_PRESET_DB_DATABASE"

SQLCMD="sqlcmd -S ${DB_HOST},${DB_PORT:-1433} -U ${DB_USERNAME} -P ${DB_PASSWORD} -C -N o -b"
say() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

TMP="$(mktemp -t sales-demo-XXXXXX.sql)"
trap 'rm -f "$TMP"' EXIT

if [[ "${1:-}" == "--remove" ]]; then
    say "Removing demo data from ${DB_DATABASE}"
    cat > "$TMP" <<'SQL'
SET NOCOUNT ON;
-- Child-first, because the S1 foreign keys are real.
-- THE AUDIT ROWS THIS SEED CAUSED, and deleting them is deliberate rather than tidy-minded.
--
-- Normally a teardown has no business touching __mj.RecordChange. Here it does, for one specific reason:
-- the demo deals use FIXED UUIDs so the seed is idempotent, so audit rows left behind would RE-ATTACH to
-- the next set of deals seeded under the same ids. The demo would come back carrying a slip history it
-- had not created, and the entity-layer step that seeds that history counts what exists before adding
-- more -- so it would skip, and the numbers on screen would be whatever had accumulated.
--
-- Scoped to the demo record ids only, in MJ's Field|Value form. An audit row for any other record is
-- somebody else's evidence.
DELETE rc FROM __mj.RecordChange rc
  JOIN __mj.Entity e ON e.ID = rc.EntityID
 WHERE e.Name = 'MJ_BizApps_Sales: Deals'
   AND rc.RecordID IN (SELECT 'ID|' + CAST(ID AS varchar(50)) FROM __mj_BizAppsSales.Deal WHERE DealNumber LIKE 'DEAL-9%');
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
    DELETE FROM __mj_BizAppsCommon.ContactMethod WHERE PersonID IN ('C0111111-0000-4000-A000-000000000001','C0111111-0000-4000-A000-000000000002','C0111111-0000-4000-A000-000000000003','C0111111-0000-4000-A000-000000000004');
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

-- ==================== CONTACT METHOD — what makes the Outlook demo show anything ====================
--
-- WITHOUT THIS ROW THE MAIL INGEST WRITES NOTHING, and it fails in the least obvious way: the run
-- reports success, fetches everything, and files every message as irrelevant. `RelevanceFilter` resolves
-- an ADDRESS to a Person through a contact method, and `DealMatcher.MatchOpenDeals` then keys on
-- `PrimaryContactID IN (...)` or `AccountID IN (...)`. An address nobody owns matches nobody, so a real
-- inbox against a seeded database gives "25 fetched, 25 irrelevant, 0 written" and looks like a bug in
-- the pipeline rather than a gap in the fixture.
--
-- SO IT IS SEEDED RATHER THAN HAND-ADDED. A hand-added row does not survive `--remove`, and the demo set
-- is rebuilt between takes; the next take would silently go back to writing nothing.
--
-- WHY DANA WHITFIELD, AND WHY BOTH DEALS LIGHT UP. Dana (@c1) is the primary contact on **DEAL-9001 AND
-- DEAL-9003** — verified, they share her and share an account. So one contact method makes every matched
-- message attach to both deals. That is `MatchOpenDeals`' documented multi-match behaviour, not an
-- accident: an address identifies a PERSON, and a person can be live on more than one deal at once.
-- Routing a message to one deal by reading its subject would be content-based guessing, which this
-- product deliberately does not do.
--
-- The address is a second mailbox the demo operator controls, used to send deal correspondence INTO the
-- work mailbox. Messages the operator sent from the work address to himself carry no second address at
-- all, so they match nothing and stay off the timeline — which is correct, and is what stops the whole
-- inbox landing on a deal.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCommon.ContactMethod
             WHERE PersonID=@c1 AND Value=N'josue.garcia5824@gmail.com')
INSERT INTO __mj_BizAppsCommon.ContactMethod (ID, PersonID, ContactTypeID, Value, Label, IsPrimary)
  VALUES (NEWID(), @c1,
          (SELECT TOP 1 ID FROM __mj_BizAppsCommon.ContactType WHERE Name=N'Email'),
          N'josue.garcia5824@gmail.com',
          N'Outlook demo — deal correspondence',
          0);

-- ============================ PIPELINE 1 — and the point about labels ============================
--
-- CloseWonPolicy.ContractTypeCode IS 'Order Form', AND THE VALUE IS LOAD-BEARING.
--
-- It said 'Standard' until 2026-08-20, which was v1 contracts vocabulary. The 2026-08-18 contracts
-- rebuild replaced MSA / Standard / Membership / Evergreen / Pilot -- names describing a commercial
-- SHAPE -- with names describing what the DOCUMENT is: Order Form, Statement of Work, Payment Link,
-- Change Order. Nothing matched 'Standard' any more, so every B2B close-won created no contract and
-- reported 'No contract type matches Standard'. The close still SUCCEEDED and recorded the reason,
-- which is exactly why it went unnoticed -- an honest report of a failure still reads as a pass to
-- anyone watching the return value.
--
-- 'Order Form' is what S-US2 names as the default, and it is also the only safe class of answer: it
-- has ParentStatusRequirement = NULL, so it STANDS ALONE. A type requiring a parent -- Change Order --
-- is refused by ContractEntityServer.ValidateAsync(), because a change order that amends nothing has
-- no lineage. Any future value here must satisfy that too.
DECLARE @pipe1 UNIQUEIDENTIFIER='90111111-0000-4000-A000-000000000001';
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Pipeline WHERE ID=@pipe1)
  INSERT INTO __mj_BizAppsSales.Pipeline (ID, CompanyID, Name, Code, Description, DealTypeID, DefaultForecastCategoryTypeID,
        RequiresDealLines, CloseWonPolicy, IsDefault, DisplayRank, IsActive)
    VALUES (@pipe1, @co1, N'B2B', N'B2B',
      N'The main motion, per master plan §4.2. NOTE the winning stage is called "Signed", not "Closed Won" — the app still knows it is a win because the stage points at a DealStatusType with IsWon=1.',
      @dtNew, @fcPipe, 1,
      -- 'Order Form', not 'Standard'. THE THIRD PLACE THIS DEFECT LIVED: contracts ships Order Form,
      -- Statement of Work, Payment Link and Change Order, and nothing on any host is called Standard,
      -- so a close-won down this pipeline planned a contract the seam could not create. The metadata
      -- copy was found by close-won-contract.CT1 and the seeded DB row by CT6; this INSERT is guarded
      -- by IF NOT EXISTS, so it only fires on a host that has no pipelines yet -- which is exactly the
      -- host nobody would think to check.
      --
      -- BOTH SIDES OF THE MERGE AGREED ON 'Order Form' -- two people found the same defect
      -- independently, which is worth knowing. The incoming line also carried "OrderState":"Confirmed",
      -- and that is NOT taken: D-OS1 retired OrderState in favour of PipelineStage.OrderStatusOnEntry,
      -- because a close-time key speaks once about one kind of close while a stage speaks on every
      -- change. Reinstating it here would fail silently -- a key no code reads, in the one place a fresh
      -- install seeds from, leaving the next reader to work out which design won.
      N'{"CreateContract":true,"ContractTypeCode":"Order Form","TermMonths":12,"SubscriptionLinesTo":"Contract","OneTimeLinesTo":"Order","RequireApprovalTaskTypeCode":null,"CloseWonTasks":{"AssigneeEntityName":"MJ_BizApps_Common: People","AssigneeRecordID":"C0111111-0000-4000-A000-000000000004","DueInDays":5}}',
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
      @dtNew, @fcPipe, 0, N'{"CreateContract":false,"OneTimeLinesTo":"Order","CloseWonTasks":{"AssigneeEntityName":"MJ_BizApps_Common: People","AssigneeRecordID":"C0111111-0000-4000-A000-000000000004","DueInDays":5}}', 1, 20, 1);

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
 -- EXPECTED CLOSE IS IN THE PAST, DELIBERATELY. `Sales: Slipped Deals` and the dashboard's "Past
 -- expected close" KPI both select open deals whose ExpectedCloseDate has gone, and with every seeded
 -- date in the future BOTH read zero -- the same silence as the by-rep reports below, from a different
 -- cause. This deal is the one that has slipped: still open, still in Qualification, and past the date
 -- it was meant to land. It also puts it beyond the stage's RottingDays, so the rotting indicator has a
 -- subject too. A fixed past date rather than a relative one, because every other date in this file is
 -- fixed and a demo that drifts with the clock is worse than one that is plainly dated.
 (@d2, N'DEAL-9002', N'Cascade Manufacturing — Pilot', @pipe1, @s2, @dtNew, @stOpen,
  @acc2, @c2, @co1, @emp1, 42000.0000, 0, 12, '2026-08-05', 25, @fcPipe, @lsOut,
  N'Early. Champion identified, economic buyer not yet confirmed. SLIPPED: expected close has passed and it is still open.', N'Book discovery with their CFO', '2026-08-08'),
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

-- ============ THE CLOSED DEALS NEED TEAMS, OR TWO REPORTS ANSWER WITH SILENCE ============
--
-- ══ THIS WAS A REAL GAP, AND THE SYMPTOM WAS INDISTINGUISHABLE FROM A BROKEN QUERY ══════════════
--
-- Every team row above sits on an OPEN deal, and both by-rep reports key on ActualCloseDate joined
-- through DealTeamMember. So `Sales: Bookings by Owner` and
-- `Sales: Deal Involvement by Rep (Attribution-Weighted)` returned ZERO ROWS on seeded data -- the two
-- reports §9.4 exists to distinguish, both silent. A query that runs clean and returns nothing looks
-- exactly like one that is broken, and the reader has no way to tell which they are looking at.
--
-- The deals already carried OwnerEmployeeID. That made it worse rather than better: the stamp is
-- SERVER-DERIVED from the owner-role team row, so a closed deal with a stamp and no team row is a state
-- the app's own rules forbid (save-deal.SD3/SD26) sitting in the demo as though it were normal.
--
-- ══ THE ATTRIBUTION VALUES ARE CHOSEN TO MAKE §9.4's DISTINCTION VISIBLE ════════════════════════
--
-- The two reports are not variants of one another and must never be substituted, and the demo now shows
-- WHY rather than only asserting it:
--
--   DEAL-9005 (WON, owner @emp1): 60 / 25 / 15 -- sums to exactly 100.
--       The reconciliation case, and it is the headline. Measured on the live database: bookings-by-owner
--       credits the whole 27,480 to @emp1 ONCE, while the weighted report splits the SAME deal
--       16,488 / 6,870 / 4,122 -- which adds back to 27,480 exactly. Same deal, same money, two answers
--       that are both true and neither substitutable.
--
--       And the trap is visible in the same rows: `WonAmountOfDealsTouched` reads 27,480 on EVERY one of the
--       three. Summing that column gives 82,440 for a 27,480 deal. That is §9.4's triple-count, on
--       screen, in a report that is otherwise correct -- which is exactly why §9.4 says to state the
--       basis in the report definition rather than trust a reader to pick the right column.
--
--   DEAL-9006 (LOST, owner @emp3): 100 / 30 -- sums to 130.
--       Nothing constrains attribution to total 100, and this deal does not. BE PRECISE ABOUT WHAT IT
--       DEMONSTRATES, THOUGH: because the deal was LOST, the weighted report shows it as
--       WonDealsInvolvedIn = 0 and no money, so the 130% surfaces only through `AvgAttributionPct` and
--       the involvement counts -- not as an inflated amount. Showing over-attribution on real revenue
--       would need a second WON deal, and inventing one to make a point is not what a demo is for.
--       What this case does prove is that a LOSS carries a team at all, which is what makes win RATE by
--       rep answerable rather than just bookings.
--
-- Bookings-by-owner is UNAFFECTED by both: it filters on DealRole.IsOwnerRole and sums Deal.Amount, so
-- it counts each deal exactly once whatever the percentages say. That is the whole point of the pair,
-- and it is now observable in the data rather than only in the query comments.
--
-- DIFFERENT OWNERS ON PURPOSE (@emp1 and @emp3), so the by-rep reports return more than one row --
-- a single-row report cannot show whether grouping works.
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealTeamMember WHERE DealID=@d5)
INSERT INTO __mj_BizAppsSales.DealTeamMember (DealID, EmployeeID, PersonID, DealRoleID, AttributionPct, IsActive, Notes) VALUES
 (@d5, @emp1, NULL, @roleOwner, 60.00, 1, N'Owner. Matches Deal.OwnerEmployeeID, which is a server-derived stamp OF this row -- the team is the source of truth.'),
 (@d5, @emp2, NULL, @roleSE,    25.00, 1, N'Sales engineer. Ran the Line 2 capacity modelling that won it.'),
 (@d5, @emp3, NULL, @roleSDR,   15.00, 1, N'Sourced the expansion conversation. 60/25/15 = 100: credit splits cleanly here.');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.DealTeamMember WHERE DealID=@d6)
INSERT INTO __mj_BizAppsSales.DealTeamMember (DealID, EmployeeID, PersonID, DealRoleID, AttributionPct, IsActive, Notes) VALUES
 (@d6, @emp3, NULL, @roleOwner, 100.00, 1, N'Owner, and the deal was lost -- a loss has a team too, which is what makes win RATE by rep answerable at all.'),
 (@d6, @emp2, NULL, @roleSE,    30.00, 1, N'Sales engineer. 100+30 = 130: this deal is the one that makes AttributionCoveragePct visibly non-decorative.');

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
-- The two counts the by-rep reports actually depend on. A team-member total says nothing about whether
-- those reports can answer: what matters is whether the CLOSED deals have members, because both key on
-- ActualCloseDate. Zero here means both reports return silence.
UNION ALL SELECT '  closed w/ team   ' + CAST(COUNT(DISTINCT d.ID) AS varchar)
  FROM __mj_BizAppsSales.Deal d
  JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
  JOIN __mj_BizAppsSales.DealTeamMember tm ON tm.DealID = d.ID
 WHERE t.IsClosed = 1 AND d.ActualCloseDate IS NOT NULL
-- PAST DUE is the DASHBOARD question -- its 'Past expected close' KPI -- and the rotting indicator's.
-- NO DOUBLE QUOTE MAY APPEAR ANYWHERE IN THIS BLOCK. It sits inside sqlcmd -Q argument, which the
-- shell quotes with double quotes, so a single stray one closes that string and bash begins executing
-- the SQL as commands -- reported as: Sales:: command not found. A confusing way to learn it. It is NOT
-- what `Sales: Slipped Deals` reports -- that one reads __mj.RecordChange for deals whose expected close
-- date was MOVED, which no SQL seed can produce because RecordChange is a side effect of a save. The
-- entity-layer step at the bottom of this script creates that history; these two counters are different
-- questions and were briefly conflated here.
UNION ALL SELECT '  past due open    ' + CAST(COUNT(*) AS varchar)
  FROM __mj_BizAppsSales.Deal d
  JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
 WHERE t.IsOpen = 1 AND d.ExpectedCloseDate < CAST(SYSUTCDATETIME() AS date)
UNION ALL SELECT '  close-date moves ' + CAST(COUNT(*) AS varchar)
  FROM __mj.RecordChange rc
  JOIN __mj.Entity e ON e.ID = rc.EntityID
 WHERE e.Name = 'MJ_BizApps_Sales: Deals'
   AND ISJSON(rc.ChangesJSON) = 1
   AND JSON_VALUE(rc.ChangesJSON, '$.ExpectedCloseDate.field') IS NOT NULL
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
