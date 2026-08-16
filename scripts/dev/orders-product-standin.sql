/* ============================================================================================
   DEV-ONLY STAND-IN — orders' Product and its four lookup tables, transcribed VERBATIM.

   WHAT THIS IS. `__mj_BizAppsOrders.Product` as bizapps-orders actually defines it, copied
   without modification from its migration
   `V202607061432__v0.1.x__Tables_and_Objects.sql`, so a picker built here is built against
   real columns, real constraints and real identity.

   WHY IT EXISTS RATHER THAN THE REAL MIGRATION. Orders' full schema cannot be applied to this
   host: it has hard foreign keys into `__mj_BizAppsAccounting` (Dimension, DimensionValue,
   JournalEntry), and accounting in turn has a hard FK into `__mj_BizAppsTasks.Task`. Neither
   schema is present, and bizapps-tasks is not even cloned. Applying orders in full therefore
   means applying tasks and accounting in full first — the seven-repo workspace project, which
   is explicitly out of scope here.

   `Product` itself is SELF-CONTAINED: its only foreign keys are to the four lookup tables
   below (all in orders' own schema), to `__mj.Company`, and to itself
   (`SuccessorProductID`). Nothing it touches lives in accounting or tasks. That is what makes
   a faithful stand-in possible instead of an invented shape.

   THE SWAP, when the real workspace lands: drop the `__mj_BizAppsOrders` schema and let orders'
   own migrations create it. Nothing here is edited into a shape orders would not produce, so
   the swap is a deletion rather than a reconciliation. The one thing that WILL differ is
   completeness — orders defines 49 tables and this defines 5.

   NOT FOR PRODUCTION. This file is not a migration and is not in migrations/.
   ============================================================================================ */

IF SCHEMA_ID('__mj_BizAppsOrders') IS NULL
    EXEC('CREATE SCHEMA __mj_BizAppsOrders');
GO

/* ---- SubscriptionType (verbatim, lines 17-104) ---- */
CREATE TABLE __mj_BizAppsOrders.SubscriptionType (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    -- OPTIONAL override. NULL = the base class drives entirely from the columns below.
    DriverClass NVARCHAR(200) NULL,

    -- WHO can hold it
    -- WHO MAY HOLD the subscription — the subscriber of record, whose name is on it
    -- and who renews it.
    SubscriberScope NVARCHAR(20) NOT NULL DEFAULT 'Either',   -- Organization | Person | Either
    -- WHO DERIVES THE BENEFIT, which is a different question from who holds it (D62):
    --
    --   Holder        the benefit follows WHOEVER holds it — a person for a personal
    --                 membership, an organization for an org-held one. This is what a
    --                 flexible type (SubscriberScope='Either') needs, and it is why the
    --                 three values are not two: collapsing it into `Individual` forces
    --                 every such type to demand a named person and breaks org purchases.
    --   Individual    a NAMED person benefits, who may DIFFER from the holder — a corporate
    --                 seat, where the org pays and an employee is the member.
    --   Organization  the organization's members benefit collectively — a trade association
    --                 where a company joins and its people are members by virtue of that.
    --
    -- `SubscriberScope` answers who HOLDS it; this answers who BENEFITS. The pair covers:
    --   Either       + Holder        buy it as a person or as a company; either way you hold it
    --   Organization + Individual    a seat
    --   Organization + Organization  a trade association
    --
    -- It decides the DEDUPE SCOPE, which is the working part: `Organization` keys on the org
    -- so a second purchase extends the company's one membership; `Individual` keys on the
    -- (org, person) pair so ten seats for ten staff are ten subscriptions rather than ten
    -- collisions under RejectDuplicate.
    BenefitModel NVARCHAR(30) NOT NULL DEFAULT 'Holder',

    -- WHEN a term starts
    StartMode NVARCHAR(20) NOT NULL DEFAULT 'Immediate',      -- Immediate | Deferred | CalendarAnchored
    DeferredStartDays INT NULL,                               -- StartMode = Deferred
    AnchorMonth TINYINT NULL,                                 -- CalendarAnchored: e.g. 1 (Jan) or 7 (Jul)
    AnchorDay TINYINT NULL,
    -- What to do with the stub before the first anchor date.
    PartialPeriodMode NVARCHAR(20) NULL,                      -- Prorate | ChargeFull | ExtendToNextAnchor

    -- HOW LONG, and how often money and revenue move (deliberately separate:
    -- annual billing with monthly recognition is the common case)
    DefaultTermMonths INT NULL,
    BillingCadence NVARCHAR(20) NOT NULL DEFAULT 'Annual',    -- Monthly | Quarterly | Annual | Custom
    RecognitionCadence NVARCHAR(20) NOT NULL DEFAULT 'MatchBilling',
    CustomCycleDays INT NULL,
    TrialDays INT NOT NULL DEFAULT 0,

    -- WHAT HAPPENS when an existing subscriber buys again
    ConcurrencyMode NVARCHAR(20) NOT NULL DEFAULT 'ExtendExisting',  -- AllowMultiple | ExtendExisting | RejectDuplicate
    ReactivationMode NVARCHAR(30) NOT NULL DEFAULT 'AlwaysCreateNew',-- ReactivateExisting | AlwaysCreateNew | ReactivateWithinWindow
    ReactivationWindowDays INT NULL,

    -- ENDING
    AutoRenewDefault BIT NOT NULL DEFAULT 1,
    RenewalLeadDays INT NULL,   -- NULL = inherit SubscriptionType.RenewalLeadDays
    CancellationMode NVARCHAR(20) NOT NULL DEFAULT 'EndOfTerm',      -- Immediate | EndOfTerm | EndOfBillingPeriod
    CancellationRefundMode NVARCHAR(30) NOT NULL DEFAULT 'NoRefund', -- NoRefund | ProrateUnused | FullRefundWithinWindow
    CancellationWindowDays INT NULL,
    GracePeriodDays INT NOT NULL DEFAULT 0,

    Sequence INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_SubscriptionType PRIMARY KEY (ID),
    CONSTRAINT UQ_SubscriptionType_Code UNIQUE (Code),
    CONSTRAINT CK_SubscriptionType_SubscriberScope CHECK (SubscriberScope IN ('Organization','Person','Either')),
    CONSTRAINT CK_SubscriptionType_BenefitModel CHECK (BenefitModel IN ('Holder','Individual','Organization')),
    -- An organization-wide benefit cannot be held by a person: there are no members to spread it to.
    CONSTRAINT CK_SubscriptionType_BenefitModelScope CHECK (
        BenefitModel <> 'Organization' OR SubscriberScope <> 'Person'),
    CONSTRAINT CK_SubscriptionType_StartMode CHECK (StartMode IN ('Immediate','Deferred','CalendarAnchored')),
    CONSTRAINT CK_SubscriptionType_PartialPeriodMode CHECK (PartialPeriodMode IS NULL OR PartialPeriodMode IN ('Prorate','ChargeFull','ExtendToNextAnchor')),
    CONSTRAINT CK_SubscriptionType_BillingCadence CHECK (BillingCadence IN ('Monthly','Quarterly','Annual','Custom')),
    CONSTRAINT CK_SubscriptionType_RecognitionCadence CHECK (RecognitionCadence IN ('Monthly','Quarterly','Annual','MatchBilling')),
    CONSTRAINT CK_SubscriptionType_ConcurrencyMode CHECK (ConcurrencyMode IN ('AllowMultiple','ExtendExisting','RejectDuplicate')),
    CONSTRAINT CK_SubscriptionType_ReactivationMode CHECK (ReactivationMode IN ('ReactivateExisting','AlwaysCreateNew','ReactivateWithinWindow')),
    CONSTRAINT CK_SubscriptionType_CancellationMode CHECK (CancellationMode IN ('Immediate','EndOfTerm','EndOfBillingPeriod')),
    CONSTRAINT CK_SubscriptionType_CancellationRefundMode CHECK (CancellationRefundMode IN ('NoRefund','ProrateUnused','FullRefundWithinWindow')),
    -- CalendarAnchored is meaningless without an anchor date.
    CONSTRAINT CK_SubscriptionType_Anchor CHECK (StartMode <> 'CalendarAnchored' OR (AnchorMonth IS NOT NULL AND AnchorDay IS NOT NULL)),
    CONSTRAINT CK_SubscriptionType_AnchorMonth CHECK (AnchorMonth IS NULL OR (AnchorMonth BETWEEN 1 AND 12)),
    CONSTRAINT CK_SubscriptionType_AnchorDay CHECK (AnchorDay IS NULL OR (AnchorDay BETWEEN 1 AND 31)),
    CONSTRAINT CK_SubscriptionType_GracePeriodDays CHECK (GracePeriodDays >= 0),
    CONSTRAINT CK_SubscriptionType_TrialDays CHECK (TrialDays >= 0)
);
GO

/* ---- RevenueRecognitionType (verbatim, lines 125-142) ---- */
CREATE TABLE __mj_BizAppsOrders.RevenueRecognitionType (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    -- The @RegisterClass key resolved through MJ's ClassFactory. Subclass a shipped
    -- driver and register under the same key to override it.
    DriverClass NVARCHAR(200) NOT NULL,
    -- True when recognition is deferred (booking credits Deferred Revenue and the
    -- schedule releases it). False = recognized at booking, credited straight to Sales.
    IsDeferred BIT NOT NULL DEFAULT 0,
    -- True when the driver needs OrderLine.ServicePeriodStart/End to compute.
    RequiresServicePeriod BIT NOT NULL DEFAULT 0,
    Sequence INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_RevenueRecognitionType PRIMARY KEY (ID),
    CONSTRAINT UQ_RevenueRecognitionType_Code UNIQUE (Code)
);
GO

/* ---- ProductType (verbatim, lines 148-183) ---- */
CREATE TABLE __mj_BizAppsOrders.ProductType (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    RequiresFulfillment BIT NOT NULL DEFAULT 0,
    DefaultRevenueRecognitionTypeID UNIQUEIDENTIFIER NULL,
    DefaultIsTaxable BIT NOT NULL DEFAULT 1,
    -- The backstop of the taxability walk. DefaultIsTaxable is NOT NULL because the walk has to
    -- terminate somewhere: if nothing above answers, this does.
    DefaultTaxCategory NVARCHAR(50) NULL,
    DefaultSubscriptionTypeID UNIQUEIDENTIFIER NULL,
    ProductExtensionEntity NVARCHAR(255) NULL,
    OrderLineExtensionEntity NVARCHAR(255) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    -- ENTITLEMENT POLICY BACKSTOPS (D76). Three settings resolved by ONE walk down the same chain
    -- taxability uses: product -> its category -> that category's ancestors -> here. NOT NULL for
    -- the same reason DefaultIsTaxable is: the walk has to terminate with a real answer, and
    -- 'nobody said' must not silently mean 'grant nothing'.
    --
    --   GrantTiming    WHEN access begins. OnConfirm is the default because a confirmed order is a
    --                  claim; OnPaidInFull ties access to cash for deployments that need it.
    --   QuantityMode   PerUnit multiplies the template quantity by the line quantity, so buying
    --                  three 5-seat packs gives fifteen seats. Flat ignores line quantity.
    --   ValidityMode   HOW LONG. Perpetual is the default because the commonest non-subscription
    --                  grant is a digital download that never expires. A subscription type should
    --                  be seeded as SubscriptionTerm so grants follow the term window.
    DefaultEntitlementGrantTiming NVARCHAR(20) NOT NULL DEFAULT 'OnConfirm',
    DefaultEntitlementQuantityMode NVARCHAR(20) NOT NULL DEFAULT 'PerUnit',
    DefaultEntitlementValidityMode NVARCHAR(20) NOT NULL DEFAULT 'Perpetual',
    CONSTRAINT PK_ProductType PRIMARY KEY (ID),
    CONSTRAINT UQ_ProductType_Name UNIQUE (Name),
    CONSTRAINT CK_ProductType_EntGrantTiming CHECK (DefaultEntitlementGrantTiming IN ('OnConfirm','OnPaidInFull','OnActivation')),
    CONSTRAINT CK_ProductType_EntQuantityMode CHECK (DefaultEntitlementQuantityMode IN ('PerUnit','Flat')),
    CONSTRAINT CK_ProductType_EntValidityMode CHECK (DefaultEntitlementValidityMode IN ('Perpetual','EventWindow','FixedDuration','SubscriptionTerm'))
);
GO

/* ---- ProductCategory (verbatim, lines 198-232) ---- */
CREATE TABLE __mj_BizAppsOrders.ProductCategory (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(40) NULL,
    Name NVARCHAR(200) NOT NULL,
    ParentProductCategoryID UNIQUEIDENTIFIER NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    -- TAXABILITY DEFAULTS FOR THIS CATEGORY (D73). The middle of the walk, and the level most
    -- deployments actually configure: 'publications are exempt here, merchandise is not' is a
    -- statement about a category, not about each of two hundred products.
    --
    -- NAMED 'Default*' to match ProductType and to say what they are — a default for the products
    -- BELOW, not an assertion about the category itself. Product.IsTaxable is the actual value;
    -- these two are what it falls back to.
    --
    -- NULLABLE, because the walk continues past a silent category to its PARENT, then that
    -- parent's parent, up to the root, and only then to the product type. A NOT NULL default here
    -- would terminate the walk at the first category and make an ancestor's setting unreachable —
    -- which is the whole point of having a tree.
    DefaultIsTaxable BIT NULL,
    DefaultTaxCategory NVARCHAR(50) NULL,
    -- ENTITLEMENT POLICY DEFAULTS FOR THIS CATEGORY (D76). NULLABLE for exactly the reason the
    -- taxability defaults above are: the walk continues past a silent category to its parent and on
    -- to the root, and a NOT NULL default here would terminate it at the first level, making an
    -- ancestor's setting unreachable.
    DefaultEntitlementGrantTiming NVARCHAR(20) NULL,
    DefaultEntitlementQuantityMode NVARCHAR(20) NULL,
    DefaultEntitlementValidityMode NVARCHAR(20) NULL,
    CONSTRAINT PK_ProductCategory PRIMARY KEY (ID),
    CONSTRAINT CK_ProductCategory_NoSelfParent CHECK (ParentProductCategoryID IS NULL OR ParentProductCategoryID <> ID),
    CONSTRAINT CK_ProductCategory_EntGrantTiming CHECK (DefaultEntitlementGrantTiming IS NULL OR DefaultEntitlementGrantTiming IN ('OnConfirm','OnPaidInFull','OnActivation')),
    CONSTRAINT CK_ProductCategory_EntQuantityMode CHECK (DefaultEntitlementQuantityMode IS NULL OR DefaultEntitlementQuantityMode IN ('PerUnit','Flat')),
    CONSTRAINT CK_ProductCategory_EntValidityMode CHECK (DefaultEntitlementValidityMode IS NULL OR DefaultEntitlementValidityMode IN ('Perpetual','EventWindow','FixedDuration','SubscriptionTerm'))
);
GO

/* ---- Product (verbatim, lines 246-285) ---- */
CREATE TABLE __mj_BizAppsOrders.Product (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(200) NOT NULL,
    SKU NVARCHAR(80) NULL,
    ProductTypeID UNIQUEIDENTIFIER NOT NULL,
    ProductCategoryID UNIQUEIDENTIFIER NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Draft',
    SuccessorProductID UNIQUEIDENTIFIER NULL,
    AvailableFrom DATE NULL,
    AvailableTo DATE NULL,
    RevenueRecognitionTypeID UNIQUEIDENTIFIER NOT NULL,
    StandaloneSellingPrice DECIMAL(19,4) NULL,
    -- NULL = not a subscription product. Cadence, term length, anchoring, concurrency,
    -- cancellation and grace all live on the type (D45) — not duplicated here.
    SubscriptionTypeID UNIQUEIDENTIFIER NULL,
    -- NULLABLE so 'inherit' is sayable (D73). Taxability resolves product -> category -> type,
    -- most specific wins, exactly as GL accounts resolve. NOT NULL DEFAULT 1 could not express
    -- 'whatever my category says', which meant every product had to restate a decision its
    -- category had already made — and restated decisions drift.
    IsTaxable BIT NULL,
    Description NVARCHAR(MAX) NULL,
    -- Taxability key, matched against accounting's TaxRate.TaxCategory (D71 phase 4).
    -- A STRING rather than a ProductTaxCategory table: accounting already keys taxability by
    -- string, and a table here would need syncing to it and could drift.
    TaxCategory NVARCHAR(50) NULL,
    -- ENTITLEMENT POLICY AT THE PRODUCT (D76) — the most specific level, and the one that overrides
    -- everything above it. NULL means 'ask my category', which is the normal case: policy is usually
    -- a statement about a KIND of thing, and only the exceptions are set here.
    EntitlementGrantTiming NVARCHAR(20) NULL,
    EntitlementQuantityMode NVARCHAR(20) NULL,
    EntitlementValidityMode NVARCHAR(20) NULL,
    CONSTRAINT PK_Product PRIMARY KEY (ID),
    CONSTRAINT CK_Product_Status CHECK (Status IN ('Draft','Active','Discontinued','EOL')),
    CONSTRAINT CK_Product_NoSelfSuccessor CHECK (SuccessorProductID IS NULL OR SuccessorProductID <> ID),
    CONSTRAINT CK_Product_Availability CHECK (AvailableFrom IS NULL OR AvailableTo IS NULL OR AvailableTo >= AvailableFrom),
    CONSTRAINT CK_Product_EntGrantTiming CHECK (EntitlementGrantTiming IS NULL OR EntitlementGrantTiming IN ('OnConfirm','OnPaidInFull','OnActivation')),
    CONSTRAINT CK_Product_EntQuantityMode CHECK (EntitlementQuantityMode IS NULL OR EntitlementQuantityMode IN ('PerUnit','Flat')),
    CONSTRAINT CK_Product_EntValidityMode CHECK (EntitlementValidityMode IS NULL OR EntitlementValidityMode IN ('Perpetual','EventWindow','FixedDuration','SubscriptionTerm'))
);
GO

/* ---- Product's own FKs and indexes, verbatim ---- */
ALTER TABLE __mj_BizAppsOrders.ProductCategory
    ADD CONSTRAINT FK_ProductCategory_Parent
    FOREIGN KEY (ParentProductCategoryID) REFERENCES __mj_BizAppsOrders.ProductCategory(ID);
ALTER TABLE __mj_BizAppsOrders.ProductCategory
    ADD CONSTRAINT FK_ProductCategory_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
ALTER TABLE __mj_BizAppsOrders.Product
    ADD CONSTRAINT FK_Product_ProductType
    FOREIGN KEY (ProductTypeID) REFERENCES __mj_BizAppsOrders.ProductType(ID);
ALTER TABLE __mj_BizAppsOrders.Product
    ADD CONSTRAINT FK_Product_ProductCategory
    FOREIGN KEY (ProductCategoryID) REFERENCES __mj_BizAppsOrders.ProductCategory(ID);
ALTER TABLE __mj_BizAppsOrders.Product
    ADD CONSTRAINT FK_Product_Company
    FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID);
ALTER TABLE __mj_BizAppsOrders.Product
    ADD CONSTRAINT FK_Product_SuccessorProduct
    FOREIGN KEY (SuccessorProductID) REFERENCES __mj_BizAppsOrders.Product(ID);
ALTER TABLE __mj_BizAppsOrders.Product
    ADD CONSTRAINT FK_Product_RevenueRecognitionType
    FOREIGN KEY (RevenueRecognitionTypeID) REFERENCES __mj_BizAppsOrders.RevenueRecognitionType(ID);
ALTER TABLE __mj_BizAppsOrders.ProductType
    ADD CONSTRAINT FK_ProductType_DefaultRevenueRecognitionType
    FOREIGN KEY (DefaultRevenueRecognitionTypeID) REFERENCES __mj_BizAppsOrders.RevenueRecognitionType(ID);
ALTER TABLE __mj_BizAppsOrders.Product
    ADD CONSTRAINT FK_Product_SubscriptionType
    FOREIGN KEY (SubscriptionTypeID) REFERENCES __mj_BizAppsOrders.SubscriptionType(ID);
ALTER TABLE __mj_BizAppsOrders.ProductType
    ADD CONSTRAINT FK_ProductType_DefaultSubscriptionType
    FOREIGN KEY (DefaultSubscriptionTypeID) REFERENCES __mj_BizAppsOrders.SubscriptionType(ID);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_Product_SKU
    ON __mj_BizAppsOrders.Product (SKU)
    WHERE SKU IS NOT NULL;
GO
GO
