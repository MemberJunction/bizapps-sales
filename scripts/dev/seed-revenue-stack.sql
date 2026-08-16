/*
    Makes a shared host ABLE TO BOOK — the six data layers a close-won order crosses, in one script.

    NOT a migration and not a shipped seed. This exists because standing up sales → orders → accounting
    means satisfying four apps' preconditions, and each refuses at a different layer with a message that
    names its own layer rather than the missing data. `docs/KNOWN-ISSUES.md` KI-11 lists them in the order
    the failures arrive.

    RUN THE METADATA PUSHES FIRST — this script assumes they have happened, and says so if they have not:
      accounting: metadata/currencies, metadata/gl-account-roles, metadata/journal-entry-types
      orders:     metadata/journal-entry-types, metadata/product-types,
                  metadata/revenue-recognition-types, metadata/subscription-types

    Idempotent: every insert is guarded, so re-running changes nothing.
*/
SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.GLAccountRole)
    THROW 50001, 'Push accounting''s metadata/gl-account-roles first (see KI-11).', 1;
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.Currency WHERE Code = 'USD')
    THROW 50002, 'Push accounting''s metadata/currencies first — the company profile needs a valid FunctionalCurrencyCode.', 1;

DECLARE @companyEntityID UNIQUEIDENTIFIER = (SELECT ID FROM __mj.Entity WHERE Name = 'MJ: Companies');

/* ── 6. Accounting-enable every company ─────────────────────────────────────
   AccountingCompanyProfile is an IsA child of __mj.Company, so ID = Company.ID.
   Not a new key — getting this wrong produces "no AccountingCompanyProfile exists for @CompanyID"
   while a row plainly exists. */
INSERT INTO __mj_BizAppsAccounting.AccountingCompanyProfile
    (ID, EntityType, CompanyCode, FunctionalCurrencyCode, FiscalYearStartMonth, FiscalYearStartDay, IsActive)
SELECT c.ID, 'LegalEntity',
       UPPER(LEFT(REPLACE(REPLACE(REPLACE(c.Name, ' ', ''), '(', ''), ')', ''), 8)),
       'USD', 1, 1, 1
FROM __mj.Company c
WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.AccountingCompanyProfile p WHERE p.ID = c.ID);

/* ── 5. A journal-entry number sequence per company × fiscal year ────────── */
INSERT INTO __mj_BizAppsAccounting.JournalEntrySequence (CompanyID, FiscalYear, NextSequenceNumber)
SELECT c.ID, y.yr, 1
FROM __mj.Company c
CROSS JOIN (SELECT 2025 AS yr UNION ALL SELECT 2026 UNION ALL SELECT 2027 UNION ALL SELECT 2028) y
WHERE NOT EXISTS (
    SELECT 1 FROM __mj_BizAppsAccounting.JournalEntrySequence s WHERE s.CompanyID = c.ID AND s.FiscalYear = y.yr);

/* ── 3. A chart of accounts, and a COMPANY-LEVEL link per role ──────────────
   The GL resolver walks product → category tree → product type → company default. The company default is
   where that walk ends, so a link here is what stops "No GL account is linked for role 'X'". */
DECLARE @map TABLE (RoleName NVARCHAR(100), Code NVARCHAR(20), AccountType NVARCHAR(20));
INSERT INTO @map VALUES
    ('Accounts Receivable', '1100', 'Asset'),   ('Cash', '1000', 'Asset'),
    ('Inventory', '1300', 'Asset'),             ('Deferred Revenue', '2400', 'Liability'),
    ('Sales', '4000', 'Revenue'),               ('Sales Discounts', '4100', 'Revenue'),
    ('Sales Returns and Allowances', '4200', 'Revenue'),
    ('Cost of Goods Sold', '5000', 'Expense'),  ('Processing Fee', '5100', 'Expense');

INSERT INTO __mj_BizAppsAccounting.GLAccount (ID, CompanyID, Code, Name, AccountType, IsActive, IsSystemSeeded)
SELECT NEWID(), c.ID, m.Code, r.Name, m.AccountType, 1, 0
FROM __mj.Company c
CROSS JOIN @map m
JOIN __mj_BizAppsAccounting.GLAccountRole r ON r.Name = m.RoleName
WHERE NOT EXISTS (
    SELECT 1 FROM __mj_BizAppsAccounting.GLAccount g WHERE g.CompanyID = c.ID AND g.Code = m.Code);

INSERT INTO __mj_BizAppsAccounting.GLAccountLink (ID, GLAccountID, GLAccountRoleID, EntityID, RecordID, Status)
SELECT NEWID(), g.ID, r.ID, @companyEntityID, CONVERT(NVARCHAR(750), c.ID), 'Active'
FROM __mj.Company c
CROSS JOIN @map m
JOIN __mj_BizAppsAccounting.GLAccountRole r ON r.Name = m.RoleName
JOIN __mj_BizAppsAccounting.GLAccount g ON g.CompanyID = c.ID AND g.Code = m.Code
WHERE NOT EXISTS (
    SELECT 1 FROM __mj_BizAppsAccounting.GLAccountLink l
    WHERE l.GLAccountRoleID = r.ID AND l.RecordID = CONVERT(NVARCHAR(750), c.ID));

/* ── 1. A price rule per sellable product ───────────────────────────────────
   Amounts are arbitrary and deliberately varied: nothing asserts on them, and the seam test compares
   orders' number against orders' own number rather than against a constant. Sales never supplies a
   price, so without a rule here orders correctly refuses to guess one. */
INSERT INTO __mj_BizAppsOrders.ProductPrice
    (ID, ProductID, PricingModel, FeeType, Amount, EffectiveFrom, Priority, Status)
SELECT NEWID(), p.ID, 'PerUnit', 'Standard',
       CAST(100 + (ABS(CHECKSUM(p.SKU)) % 400) AS DECIMAL(18, 2)), '2020-01-01', 1, 'Active'
FROM __mj_BizAppsOrders.Product p
WHERE p.Status = 'Active'                                  -- vocabulary-grep-allow: ORDERS' Product.Status is a CHECK-constrained enum in another app's schema with no flag table behind it.
  AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.ProductPrice x WHERE x.ProductID = p.ID);

SELECT 'AccountingCompanyProfile' AS Layer, COUNT(*) AS Rows FROM __mj_BizAppsAccounting.AccountingCompanyProfile
UNION ALL SELECT 'JournalEntrySequence', COUNT(*) FROM __mj_BizAppsAccounting.JournalEntrySequence
UNION ALL SELECT 'GLAccount',            COUNT(*) FROM __mj_BizAppsAccounting.GLAccount
UNION ALL SELECT 'GLAccountLink',        COUNT(*) FROM __mj_BizAppsAccounting.GLAccountLink
UNION ALL SELECT 'ProductPrice',         COUNT(*) FROM __mj_BizAppsOrders.ProductPrice;
