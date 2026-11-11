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
`AutoUpdateIsNameField` on `Sales Contacts.FirstName`. CodeGen's reconciler sets `IsNameField = 1` on
its own pick but never clears the previous one, so on the pass that added the two inherited Person
columns it flagged `FirstName` *alongside* the pinned `DisplayNameAndEmail`, and the view generator
takes the lower Sequence. Every denormalized contact-name column in the schema was then regenerated to
join `FirstName` — `SalesContact` on Deal Contact Roles, `PrimaryContact`/`BillingContact` on Deals,
`DefaultPrimaryContact`/`DefaultBillingContact` on Sales Accounts — narrowing `nvarchar(753)` to
`nvarchar(100)` and showing a bare first name on every deal and account surface. It also inverted
golive#259, whose picker fix is built by subtracting the name field from the column plan.

Also fixes `DealEntityServer.defaultCreationDateOnCreate()`, which read a private `_NeverSet` through
a cast; MJ 6.2.0 renamed that backing field and exposed a public `NeverSet` getter, so the cast read
`undefined` and every new deal silently kept its `NewRecord()` instant instead of the server save
clock (#532).
