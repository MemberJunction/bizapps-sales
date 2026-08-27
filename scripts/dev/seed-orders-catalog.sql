/*
    Seeds orders' REAL Product catalogue so the deal-line picker and the close-won handoff have
    something to work with.

    COMPANY-AGNOSTIC BY DESIGN. An earlier version hardcoded the company UUIDs of one host and was
    therefore useless anywhere else — including on a freshly rebuilt copy of the same host, because
    `seed-dev-data.sh` mints new IDs. This one DISCOVERS the companies: the "selling" company is
    whichever one the first active pipeline belongs to, which is exactly what `ResolveSalesFixture`
    picks, and the "other" company is any second one. Get that pairing wrong and PP2 — the
    cross-tenant leak check — passes for the wrong reason.

    Chosen to make each filter dimension OBSERVABLE, not to look realistic:
      - all four Status values appear, so PP1 has non-Active rows to require the absence of
      - windows are open-ended, already closed, and not yet open, so PP3 and PP4 can each fail
      - the other company's products are named distinctly, so PP2's name-based exclusion is meaningful

    Run AFTER the metadata pushes (it needs a ProductType and a RevenueRecognitionType) and BEFORE
    seed-revenue-stack.sql, which prices whatever it finds here.

    Idempotent: every insert is guarded.
*/
SET NOCOUNT ON;

DECLARE @sellCo  UNIQUEIDENTIFIER = (
    SELECT TOP 1 p.CompanyID FROM __mj_BizAppsSales.Pipeline p WHERE p.IsActive = 1 ORDER BY p.Name);
DECLARE @otherCo UNIQUEIDENTIFIER = (
    SELECT TOP 1 c.ID FROM __mj.Company c WHERE c.ID <> @sellCo ORDER BY c.Name);

IF @sellCo IS NULL
    THROW 50010, 'No active pipeline exists — run scripts/seed-dev-data.sh first.', 1;
IF @otherCo IS NULL
    THROW 50011, 'Only one Company exists; PP2 (the cross-tenant leak check) needs a second one.', 1;

DECLARE @ptype  UNIQUEIDENTIFIER = (SELECT TOP 1 ID FROM __mj_BizAppsOrders.ProductType            WHERE IsActive = 1 ORDER BY Name);
DECLARE @revrec UNIQUEIDENTIFIER = (SELECT TOP 1 ID FROM __mj_BizAppsOrders.RevenueRecognitionType WHERE IsActive = 1 ORDER BY Sequence);

IF @ptype IS NULL OR @revrec IS NULL
    THROW 50012, 'Push orders'' metadata/product-types and metadata/revenue-recognition-types first.', 1;

/*
    A SUBSCRIPTION TYPE, so the term-start dimension is observable too (#32).

    WHICH type does not matter here and is deliberately not chosen by Code. The deal workspace only
    asks whether a product HAS a SubscriptionTypeID -- that is orders' own test for which lines get a
    term (`materializeSubscriptions`) -- and the type's StartMode only decides what confirm does with
    the date, which is orders' side of the boundary.

    A WARNING rather than a THROW when none exists, unlike @ptype and @revrec above. Those two are
    required to insert a Product at all; this one is not, so a host that has not pushed orders'
    subscription-types still gets its catalogue and simply cannot see the term start. Spec 82 skips
    with the same explanation rather than failing.
*/
DECLARE @subtype UNIQUEIDENTIFIER = (
    SELECT TOP 1 ID FROM __mj_BizAppsOrders.SubscriptionType WHERE IsActive = 1 ORDER BY Sequence);

IF @subtype IS NULL
    PRINT 'NOTE: no active SubscriptionType exists, so no product is a subscription and the deal '
        + 'workspace will show no Term start. Push orders'' metadata/subscription-types to enable it.';

DECLARE @catSell  UNIQUEIDENTIFIER = 'c0d50000-0000-4000-b000-00000000c001';
DECLARE @catOther UNIQUEIDENTIFIER = 'c0d50000-0000-4000-b000-00000000c002';

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.ProductCategory WHERE ID = @catSell)
    INSERT INTO __mj_BizAppsOrders.ProductCategory (ID, CompanyID, Name, IsActive)
    VALUES (@catSell, @sellCo, 'Platform', 1);

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.ProductCategory WHERE ID = @catOther)
    INSERT INTO __mj_BizAppsOrders.ProductCategory (ID, CompanyID, Name, IsActive)
    VALUES (@catOther, @otherCo, 'Education', 1);

DECLARE @p TABLE (
    ID UNIQUEIDENTIFIER, Name NVARCHAR(200), SKU NVARCHAR(100),
    CompanyID UNIQUEIDENTIFIER, CatID UNIQUEIDENTIFIER,
    Status NVARCHAR(50), AvailFrom DATE, AvailTo DATE,
    -- Subscription or one-time. Exactly one SELLABLE product of each is what makes the term start
    -- observable: both appear in the same deal's line grid, and only one may offer the field.
    IsSub BIT);

INSERT INTO @p VALUES
    -- The selling company's catalogue.
    ('a0d50000-0000-4000-b000-000000000001', 'Platform — Standard Seat', 'PLAT-STD', @sellCo,  @catSell,  'Active',       NULL,         NULL, 1),
    ('a0d50000-0000-4000-b000-000000000002', 'Platform — Premium Seat',  'PLAT-PRM', @sellCo,  @catSell,  'Active',       '2024-01-01', NULL, 0),
    -- Active, window CLOSED: offered in 2025, not today, not in 2027.
    ('a0d50000-0000-4000-b000-000000000003', 'Expired Promo Bundle',     'PROMO-24', @sellCo,  @catSell,  'Active',       '2024-01-01', '2025-12-31', 0),
    -- Active, window NOT OPEN yet: not today, offered in 2027.
    ('a0d50000-0000-4000-b000-000000000004', 'Next Year Programme',      'PROG-27',  @sellCo,  @catSell,  'Active',       '2027-01-01', NULL, 0),
    -- The three unsellable statuses, all INSIDE their windows so only status can exclude them.
    ('a0d50000-0000-4000-b000-000000000005', 'Unreleased Concept',       'DRAFT-01', @sellCo,  @catSell,  'Draft',        NULL,         NULL, 0),
    ('a0d50000-0000-4000-b000-000000000006', 'Legacy Toolkit',           'DISC-01',  @sellCo,  @catSell,  'Discontinued', NULL,         NULL, 0),
    ('a0d50000-0000-4000-b000-000000000007', 'Retired Appliance',        'EOL-01',   @sellCo,  @catSell,  'EOL',          NULL,         NULL, 0),
    -- Another company's catalogue. Distinct names on purpose — see the header.
    ('a0d50000-0000-4000-b000-000000000008', 'EDU Campus Licence',       'EDU-CAMP', @otherCo, @catOther, 'Active',       NULL,         NULL, 0),
    ('a0d50000-0000-4000-b000-000000000009', 'EDU Learner Seat',         'EDU-SEAT', @otherCo, @catOther, 'Active',       NULL,         NULL, 0);

INSERT INTO __mj_BizAppsOrders.Product
    (ID, Name, SKU, ProductTypeID, ProductCategoryID, CompanyID, Status, AvailableFrom, AvailableTo,
     RevenueRecognitionTypeID, IsTaxable, SubscriptionTypeID)
SELECT s.ID, s.Name, s.SKU, @ptype, s.CatID, s.CompanyID, s.Status, s.AvailFrom, s.AvailTo, @revrec, 1,
       CASE WHEN s.IsSub = 1 THEN @subtype END
FROM @p s
WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.Product x WHERE x.ID = s.ID);

/*
    AND THE SAME LINKAGE ON A HOST THAT ALREADY HAS THESE ROWS.

    The insert above is guarded by NOT EXISTS, which is what makes this script idempotent -- and would
    also make this change a silent no-op on every machine that has already run it, including the one it
    was written on. Re-running a seed and observing nothing change is exactly the failure this repo
    keeps finding, so the linkage is applied explicitly.

    Narrow on purpose: it only ever SETS the id on the row meant to carry it, and only while that row
    has none. It never clears one, and never touches a product this script did not seed.
*/
IF @subtype IS NOT NULL
    UPDATE p
       SET p.SubscriptionTypeID = @subtype
      FROM __mj_BizAppsOrders.Product p
      JOIN @p s ON s.ID = p.ID
     WHERE s.IsSub = 1 AND p.SubscriptionTypeID IS NULL;

SELECT Status,
       COUNT(*) AS n,
       SUM(CASE WHEN CompanyID = @sellCo THEN 1 ELSE 0 END) AS selling_company
FROM __mj_BizAppsOrders.Product
GROUP BY Status
ORDER BY Status;
