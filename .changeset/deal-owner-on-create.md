---
'@mj-biz-apps/sales-core-entities-server': minor
---

A new deal is born with an owner: the account's owner when it has one, otherwise whoever created it.

Nothing populated `DealTeamMember` — not the deal type, not the pipeline, not the account — so `stampOwnerFromTeam()` had nothing to derive from, and the Overview reported *"No owner assigned."* on a deal created seconds earlier. The form's team panel is gated on the deal being saved, so at the moment of creation there was no way to supply one either: every new deal was unowned and stayed that way until somebody noticed.

**Why the entity and not the form.** `DealTeamMember` is the source of truth for who is on a deal and `Deal.OwnerEmployeeID` is a stamp derived from it, so a form that wrote either would be a second authority on membership. In `Save()`, an Action, an agent and the HubSpot importer all get the same default from the same code.

**Why the account first.** A deal on an existing customer belongs to whoever runs that customer, whether a rep, an SE or an admin typed it in — so it beats the creator, who is merely the person at the keyboard. The creator is the fallback for a deal with no account yet, or an account nobody owns.

It calls the existing `SetOwner()` rather than writing roster code: `DealTeamMember` is unique on *(deal, employee, role)*, so replacing an owner is a remove plus an add, and the collection contributes deletions before insertions. Restating that would have been a second implementation of the same intent.

**It is a default, not a rule.** Each of these leaves the deal exactly as the caller left it: an update rather than a create, a caller that already supplied a roster (guarded on `RosterDrivesThisSave`, the same test `stampOwnerFromTeam` uses, so the two cannot disagree), and nothing resolving at all — `System` and `Anonymous` have no linked Employee, and an unowned deal is the honest outcome. A failed read of the account is also not fatal. The one thing this must never do is cost someone a deal they were creating.

Two details worth recording. `UserInfo.EmployeeID` is typed `number` in `@memberjunction/core` while the column is a `uniqueidentifier` — verified against the database — so it is read as a string and anything else is ignored rather than written into a foreign key. And it does not reuse the veto's `SafeID`, which throws: that is right where ids arrive from Orders, and wrong on our own field on a deal somebody is creating.

Ten tests cover both resolution paths and every way it declines; all four guards are mutation-checked.
