---
'@mj-biz-apps/sales-ng': minor
---

Promote an existing Organization or Person into sales, rather than re-entering it. Sales Accounts and
Sales Contacts are IS-A subtypes — `SalesAccount.ID` **is** `Organization.ID` — so a company
bizapps-common already holds needs only its subtype row inserted. Decided in `docs/DECISIONS.md`
D-PR1–D-PR4.

Three entry points: a card on Common's Organization and Person forms (contributed with
`@RegisterClassEx(BaseFormPanel)`, so bizapps-common is not modified), an **Add existing** button
beside **New** on the Sales Accounts and Contacts rail pages, and a link under the deal form's party
fields. All three open the same dialog, and `PromoteParty` runs MJ's sequence: `NewRecord()`,
`AttachToParent(CompositeKey.FromID(parentID))`, the child's own fields, `Save()`.

A promotion prefills `AccountTypeID` from the `AccountType` row flagged `IsProspect` — by flag, never
by the name `Prospect` — and leaves Lifecycle Stage, Owner and Territory null. `IsActive` and
`OptedOutOfOutreach` are the only NOT NULL columns on these children and `NewRecord()` seeds both, so
nothing else is required and nothing here may null them out.

It pre-checks existence before writing, which is not redundant: `AttachToParent` asks only whether the
PARENT row exists, so it returns true for an already-promoted record, and People and Organizations
carry `AllowMultipleSubtypes = 1` so nothing upstream refuses it. Without the check a second promotion
reaches the database and dies on `PK_SalesAccount` — a raw key violation with nothing in it a rep could
act on. A FAILED existence read refuses the promotion rather than trying anyway, deliberately the
opposite of the Deals panel's New gate, which fails open because the server's refusal there is a
sentence.

Adds `Sales: Party Lookup Promotable Accounts` and `Sales: Party Lookup Promotable Contacts`, the exact
complement of the deal pickers' own queries. The deal's pickers are NOT relaxed to include promotable
rows: common's `bizapps-party-field` cannot mark a row unselectable, so a promotable row there would be
selectable and would store an ID the server must refuse (D-PR2). New integration checks `PL7` and `PL8`
assert the pair partitions the set — disjoint and covering — so relaxing the picker's `EXISTS` cannot
stay green; verified by mutating that filter and watching both `PL3` and `PL7` go red.

The Deals panel on those forms now re-reads its own gate on a record refresh. A promotion does not
change the record's ID, so without that it kept saying "Not a sales customer" beside a record that had
just become one.

The dialog lists both halves of the directory: parties that already have their sales row are badged
and selected outright (writing nothing), while the rest promote on selection. When a search matches
nothing it offers to create a new one — an account from a name, a contact from first and last name,
since `Person.DisplayName` is a persisted computed column. The deal form's pickers now pass
`[AllowCreate]="false"`, so creation is reachable only after a search has come up empty rather than
competing with the matches still on screen (D-PR5).
