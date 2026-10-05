/*
    Gives contracts a CURRENT TEMPLATE to default, so a close-won contract can be created on a fresh host.

    The B2B pipeline's close-won policy names 'Order Form', and contracts ships that type with
    TemplateRequired = 1. The seam sends no ContractTemplateID; contracts defaults it to a template that is
    Published AND IsUsable (vwContractTemplates derives IsUsable from a SourceURL or an attached file).
    A host built from migrations has no template at all, so every close-won contract is refused with
    "A Order Form must reference the agreement version" -- and close-won-contract CT6 and CT7 fail on it.

    Contracts' metadata ships the template TYPES (Master Agreement, Statement of Work) but no template, so
    this one is demo configuration, like the orders catalog. It is a version of the shipped Master
    Agreement type, found by the primary key contracts' metadata gives it rather than by its name --
    the push must have run first.

    Skips cleanly when contracts is not installed (it is optional for deal CRUD). Idempotent: it only
    inserts when no Published, usable template exists, so it never adds a second one beside a real one.
*/
SET NOCOUNT ON;

IF OBJECT_ID('__mj_BizAppsContracts.ContractTemplate') IS NULL
BEGIN
    PRINT '  contracts is not installed on this host -- no contract template seeded';
    RETURN;
END

IF EXISTS (SELECT 1 FROM __mj_BizAppsContracts.vwContractTemplates WHERE Status = 'Published' AND IsUsable = 1)
BEGIN
    PRINT '  contracts already has a Published, usable template -- left as it is';
    RETURN;
END

DECLARE @templateTypeID UNIQUEIDENTIFIER =
    (SELECT ID FROM __mj_BizAppsContracts.ContractTemplateType
      WHERE ID = '33333333-0000-4000-8000-000000002001' AND Status = 'Active');
DECLARE @templateID     UNIQUEIDENTIFIER = '90111111-0000-4000-C000-000000000002';

IF @templateTypeID IS NULL
    THROW 50001, 'Contracts has no active Master Agreement template type (33333333-...-2001). Push contracts'' metadata/contract-template-types first.', 1;

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsContracts.ContractTemplate WHERE ID = @templateID)
    INSERT INTO __mj_BizAppsContracts.ContractTemplate
        (ID, Name, ContractTemplateTypeID, VersionLabel, IntroducedDate, SourceURL, Description, Status)
    VALUES (@templateID, N'Demo Master Agreement (2026-01)', @templateTypeID, N'2026-01', '2026-01-01',
            N'https://example.com/terms/demo-master-agreement-2026-01',
            N'Demo seed: a Published template with a SourceURL, so contracts can default it.', 'Published');
ELSE
    UPDATE __mj_BizAppsContracts.ContractTemplate
       SET Status = 'Published',
           SourceURL = COALESCE(SourceURL, N'https://example.com/terms/demo-master-agreement-2026-01')
     WHERE ID = @templateID;

PRINT '  seeded the demo contract template';
