---
'@mj-biz-apps/sales-entities': minor
---

`V202611102330__v6.31.x__ISA_Parent_Computed_Columns.sql` and its PostgreSQL counterpart bring three
inherited parent COMPUTED columns into this app's IS-A views, which CodeGen emits but no migration
carried: `Organization.WebsiteDomain` onto `vwSalesAccounts`, and `Person.DisplayName` and
`Person.EmailDomain` onto `vwSalesContactsGenerated` (the app-owned `vwSalesContacts` wrapper is
`SELECT g.*`, and CodeGen's own `sp_refreshview` call carries them through to it). MJ's
`InheritedParentColumns` selects a parent field that is `IsVirtual` AND `IsComputed`, because such a
column lives on the parent table; the IS-A parent-field sync that MJ Setup runs skips virtual fields,
so these three were absent from the views with no field row and no failure to show it. Captured from a
single CodeGen pass against MJ core v6.2.1; a second pass emitted nothing, and applying the migration
to a clean pre-drift database and regenerating emitted no SQL at all.

`metadata/entity-fields/.sales-contact-name-field.json` clears `IsNameField` and
`AutoUpdateIsNameField` on `Sales Contacts.FirstName`, so the pinned `DisplayNameAndEmail` stays the
only flagged name field. CodeGen picks one name field per entity and clears the others, but only those
with `AutoUpdateIsNameField = 1` — a pinned field is never touched in either direction. The pinned
field here is also ineligible to win, because `isFieldEligibleForNameField` rejects any `IsVirtual`
field that is not an inherited IS-A column and `DisplayNameAndEmail` is a sales-only concat in
`vwSalesContactsGenerated` rather than a column on `Person`. So on the pass that added the two
inherited Person columns, the reconciler fell through to its AI-ranked candidates, picked `FirstName`,
and could not clear the pinned one — leaving two fields flagged, with the view generator taking the
lower `Sequence`. Every denormalized contact-name column in the schema was then regenerated to join
`FirstName` — `SalesContact` on Deal Contact Roles, `PrimaryContact`/`BillingContact` on Deals,
`DefaultPrimaryContact`/`DefaultBillingContact` on Sales Accounts — narrowing `nvarchar(753)` to
`nvarchar(100)` and showing a bare first name on every deal and account surface. It also inverted
golive#259, whose picker fix is built by subtracting the name field from the column plan.

Also fixes `DealEntityServer.defaultCreationDateOnCreate()`, which read a private `_NeverSet` through
a cast; MJ 6.2.0 renamed that backing field and exposed a public `NeverSet` getter, so the cast read
`undefined` and every new deal silently kept its `NewRecord()` instant instead of the server save
clock (#532).
