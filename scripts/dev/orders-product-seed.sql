/* DEV-ONLY seed. Every row exists to make one picker filter observable:
   two companies (so CompanyID filtering is provable), all four Status values,
   and availability windows in the past, the future and open-ended. */
DECLARE @BCE UNIQUEIDENTIFIER = 'B0111111-0000-4000-A000-000000000002'; -- BC Education Group
DECLARE @BC  UNIQUEIDENTIFIER = 'C0A5E100-0001-4A01-9E11-5B7C3D2F8A01'; -- Blue Cypress
DECLARE @PT UNIQUEIDENTIFIER, @PC UNIQUEIDENTIFIER, @RR UNIQUEIDENTIFIER;

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.ProductType)
    INSERT INTO __mj_BizAppsOrders.ProductType (ID, Name) VALUES (NEWID(), 'Standard');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.ProductCategory)
    INSERT INTO __mj_BizAppsOrders.ProductCategory (ID, CompanyID, Name) VALUES (NEWID(), 'B0111111-0000-4000-A000-000000000002', 'Platform');
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.RevenueRecognitionType)
    INSERT INTO __mj_BizAppsOrders.RevenueRecognitionType (ID, Code, Name, DriverClass) VALUES (NEWID(), 'RATABLE', 'Ratable', 'RatableRevenueDriver');

SELECT TOP 1 @PT = ID FROM __mj_BizAppsOrders.ProductType;
SELECT TOP 1 @PC = ID FROM __mj_BizAppsOrders.ProductCategory;
SELECT TOP 1 @RR = ID FROM __mj_BizAppsOrders.RevenueRecognitionType;

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsOrders.Product)
INSERT INTO __mj_BizAppsOrders.Product
    (ID, Name, SKU, CompanyID, ProductTypeID, ProductCategoryID, RevenueRecognitionTypeID,
     Status, AvailableFrom, AvailableTo)
VALUES
 -- BC Education Group: the company Sales' pipelines sell for.
 (NEWID(),'Platform — Enterprise Seat','PLAT-ENT',      @BCE,@PT,@PC,@RR,'Active',      '2026-01-01', NULL),
 (NEWID(),'Platform — Standard Seat',  'PLAT-STD',      @BCE,@PT,@PC,@RR,'Active',      NULL,         NULL),
 (NEWID(),'Onboarding — Implementation','ONB-IMPL',     @BCE,@PT,@PC,@RR,'Active',      '2026-01-01','2027-12-31'),
 (NEWID(),'Legacy Portal',             'LEG-PORT',      @BCE,@PT,@PC,@RR,'Discontinued',NULL,         NULL),
 (NEWID(),'Draft Concept',             NULL,            @BCE,@PT,@PC,@RR,'Draft',       NULL,         NULL),
 (NEWID(),'Sunset Module',             'SUN-MOD',       @BCE,@PT,@PC,@RR,'EOL',         NULL,         NULL),
 -- Active, but its window CLOSED before today: must not be offered.
 (NEWID(),'Expired Promo Bundle',      'EXP-PROMO',     @BCE,@PT,@PC,@RR,'Active',      '2025-01-01','2025-12-31'),
 -- Active, but its window OPENS later: must not be offered yet.
 (NEWID(),'Next Year Programme',       'NEXT-YR',       @BCE,@PT,@PC,@RR,'Active',      '2027-06-01', NULL),
 -- ANOTHER COMPANY, active and in-window: the cross-tenant leak test.
 (NEWID(),'Other Co Platform',         'OTHER-PLAT',    @BC, @PT,@PC,@RR,'Active',      NULL,         NULL);

SELECT COUNT(*) AS ProductsSeeded FROM __mj_BizAppsOrders.Product;
