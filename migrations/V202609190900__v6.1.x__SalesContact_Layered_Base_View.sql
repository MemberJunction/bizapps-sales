-- =============================================================================
-- V202609190900 — Sales Contacts moves to a LAYERED base view.
-- =============================================================================
-- Hands CodeGen a PRIVATE view name so the application can own the public one.
-- Follows the pattern bizapps-contracts established (MJ#3419): CodeGen owns
-- vwSalesContactsGenerated, and the next migration creates vwSalesContacts as a
-- thin wrapper adding one derived column.
--
-- WHY SALES CONTACTS NEEDS THIS AT ALL.
--
-- `Sales Contacts` had NO name field — IsNameField was false on all 30 registered
-- fields — so every lookup to it rendered a raw GUID. A rep reported the Sales
-- Contact picker on the Deal form showing ids instead of people.
--
-- It is an IS-A asymmetry, not a missing setting. `vwSalesAccounts` inherits
-- `Name` from Organization, which CodeGen auto-marks as the name field, so the
-- Account picker was always fine. Person's name field is `DisplayName`, and
-- `DisplayName` is COMPUTED IN vwPeople rather than stored on the Person table —
-- and the generated child view joins the TABLE. So the child inherited FirstName,
-- LastName and Email and could not inherit the one column that names the person.
-- CodeGen found nothing to mark, correctly.
--
-- WHY THE FLAGS SHIP AS A MIGRATION rather than only in metadata/entities/.
-- A fresh environment runs migrate -> codegen -> sync push. That FIRST codegen,
-- seeing BaseViewGenerated = 1, resolves its target to the PUBLIC name and
-- DROP/CREATEs vwSalesContacts as a plain generated view — silently destroying
-- the wrapper. Shipping the flag here means every environment that migrates has
-- it before any codegen can run.
--
-- Keyed by entity NAME, never by ID: entity IDs are minted at first registration,
-- so a hardcoded UUID stops matching the first time a database is rebuilt from
-- zero. The UPDATE skips cleanly when the row is absent.
--
-- WHY THE INNER VIEW IS CARRIED HERE. CodeGen writes an object to its SQL output
-- only for entities it considers MODIFIED, and flipping BaseViewGenerated does not
-- count as one — so a plain post-flag codegen run produces a capture with the
-- generated view MISSING, and the omission is invisible until a fresh install
-- reaches the wrapper and fails on an object nothing created. This is the current
-- generated definition with only the view NAME changed; if it is ever re-captured,
-- check by name that vwSalesContactsGenerated is present.
-- =============================================================================

UPDATE [${mjSchema}].[Entity]
   SET [BaseViewGenerated] = 0,
       [GeneratedBaseViewName] = 'vwSalesContactsGenerated'
 WHERE [Name] = 'MJ_BizApps_Sales: Sales Contacts'
   AND ([BaseViewGenerated] <> 0
        OR [GeneratedBaseViewName] IS NULL
        OR [GeneratedBaseViewName] <> 'vwSalesContactsGenerated');
GO

IF OBJECT_ID('[__mj_BizAppsSales].[vwSalesContactsGenerated]', 'V') IS NOT NULL
    DROP VIEW [__mj_BizAppsSales].[vwSalesContactsGenerated];
GO

CREATE VIEW [__mj_BizAppsSales].[vwSalesContactsGenerated]
AS
SELECT
    s.*,
    __mj_isa_p1.[FirstName],
    __mj_isa_p1.[LastName],
    __mj_isa_p1.[MiddleName],
    __mj_isa_p1.[Prefix],
    __mj_isa_p1.[Suffix],
    __mj_isa_p1.[PreferredName],
    __mj_isa_p1.[Title],
    __mj_isa_p1.[Email],
    __mj_isa_p1.[Phone],
    __mj_isa_p1.[DateOfBirth],
    __mj_isa_p1.[Gender],
    __mj_isa_p1.[PhotoURL],
    __mj_isa_p1.[Bio],
    __mj_isa_p1.[LinkedUserID],
    __mj_isa_p1.[Status],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[Name] AS [LifecycleStageType],
    mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[Name] AS [BuyingRoleType],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType]
FROM
    [__mj_BizAppsSales].[SalesContact] AS s
INNER JOIN
    [__mj_BizAppsCommon].[Person] AS __mj_isa_p1
  ON
    [s].[ID] = __mj_isa_p1.[ID]
LEFT OUTER JOIN
    [__mj].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [s].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [__mj_BizAppsSales].[LifecycleStageType] AS mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID
  ON
    [s].[LifecycleStageTypeID] = mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[ID]
LEFT OUTER JOIN
    [__mj_BizAppsSales].[BuyingRoleType] AS mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID
  ON
    [s].[BuyingRoleTypeID] = mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[ID]
LEFT OUTER JOIN
    [__mj_BizAppsSales].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [s].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
GO
