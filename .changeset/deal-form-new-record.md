---
'@mj-biz-apps/sales-ng': minor
---

The New Deal form works, the Sales Contact picker shows people instead of GUIDs, and a closed deal's lines can no longer be edited from the form.

Four UAT defects (bc-aidp-next-golive#244) plus the half of golive#206 item 1 that sales#110 fixed on the wrong surface. `minor` rather than `patch` because two migrations ship with it.

**A new deal could not be saved at all.** `Deal.CompanyID` is `NOT NULL` with no default, the form renders it server-maintained — correctly, a rep must not choose the selling company — and `DealEntityServer.stampCompanyFromPipeline()` fills it on save. But `BaseFormComponent.SaveRecord` runs `Validate()` first and returns early when it fails, so the save never reached the server that was going to supply the value. Required, unsettable, filled too late.

It worked in the deal workspace, which stamped it client-side *"so the record validates locally"*. Unmounting the workspace (9d6ef9e) took that with it and the form was never given the equivalent. The form now resolves the pipeline's company and stamps it before the base save.

This is not the client deciding the company: it reads the same authority the server reads, and the server overwrites on arrival, so the two cannot disagree. `CompanyID` stays read-only and `server-owned-fields.ts` still refuses a user's edit to it. The rule is keyed on the CAUSE — an absent company with a pipeline to resolve it — not on `IsSaved`, so a path that creates a deal some other way is covered without anyone remembering to widen a guard.

**Products still need a saved deal, and now the form says so.** A deal mints its order on first save, so there is genuinely nowhere to put a product until then. Combined with the above that was a deadlock. The sequence is now stated twice: a guidance flag in the hero on any unsaved deal, and fuller copy in the panel. Styled as guidance, not the warning tone the lock uses — telling a rep in orange that naming a new deal has gone wrong is not the message.

**The Sales Contact picker showed raw GUIDs.** `Sales Contacts` had no name field at all — `IsNameField` false on all 30 registered fields — so every lookup to it rendered an id.

An IS-A asymmetry, not a missing setting: `vwSalesAccounts` inherits `Name` from Organization and CodeGen auto-marks it, while Person's name field is `DisplayName`, which is COMPUTED in `vwPeople` rather than stored on the Person table. The generated child view joins the TABLE, so the child inherited FirstName, LastName and Email and could not inherit the one column that names the person. CodeGen correctly found nothing to mark.

Two migrations move the entity to a layered base view (the pattern contracts established, MJ#3419): CodeGen owns `vwSalesContactsGenerated`, and sales owns `vwSalesContacts` as a wrapper adding `DisplayNameAndEmail` — the display name, plus the primary email in brackets when there is one.

It reads common's `vwPeople` rather than re-deriving either half, because `PrimaryEmail` is a contact-method lookup with a fallback and copying that into sales would drift the first time common changed it. `AutoUpdateIsNameField` is off, or the next CodeGen run would re-derive the flag from the schema — which is what produced no name field in the first place — and the pickers would go back to GUIDs with nothing in the diff to explain it. The string is built with `CONCAT`: `NULL + ' ('` is NULL in T-SQL, which would have produced a blank name field in the one case nobody seeds data for.

**The new-record header no longer briefs on a record that does not exist.** Account, owner, amount, stage and next step rendered as a grid of dashes under the name still being typed. Gated on `IsSaved`, not `EditMode` — a saved deal being edited still has all of it to show.

**A closed deal's lines can no longer be edited from the form.** sales#110 closed this on the deal WORKSPACE, a component no template has mounted since 9d6ef9e. The form still offered it: the lines grid renders outside the panel's `@if (!IsLocked)` block — deliberately, because a locked deal must still SHOW what was sold — so hiding the Add button did not take the row double-click with it. All four fields were typeable on a Won deal, and the refusal arrived from `DealLockOrderLineVeto` after Save. Offered, taken, refused: the shape golive#206 exists to delete.

Closed in two layers, because gating only the entry point is how this reopens. The panel declines to open the editor and says why where the Add button used to be; the editor refuses on its own account, resolving the lock itself from the deal it was handed rather than taking an `@Input` a future caller could forget. It reads the PERSISTED status, matching the server — a deal being closed right now still reads open.

The refusal sentence now exists on four surfaces, so `deal-lock-refusal-copy` derives it from `DealLockRefusal('update')` in the server source, as text, and checks every copy against it. Reading the file sidesteps the bundling problem that forces the duplication — `sales-core-entities-server` pulls `node:crypto` and cannot go in a browser bundle — and keeps the server the one that decides.

**Creating a deal happens on one screen — the one it opens on.** Pipeline, Deal Type, Account and both contacts now render together on the Pipeline section while the deal is unsaved. Left-nav shows one section at a time and opens a new deal on Pipeline, so composing one otherwise meant setting the name in the header, the pipeline in one rail item and the customer in another.

It also corrects something backwards: on a new deal that section used to show Stage, Forecast Category and Probability — the three the server derives from the stage on create — and neither of the two a rep actually chooses. Offering a derived field invites someone to set a value that is immediately overwritten, so those three are suppressed while unsaved.

The party panel drops exactly the borrowed fields for as long as the Pipeline section shows them, filtered through the same shared lists that section iterates. Two separate lists would agree today and drift the first time somebody added a fourth contact field, which is the shape golive#189/#190 already cost a round of UAT — a test asks it as a set intersection, in BOTH saved and unsaved states, so neither direction can regress and a later addition is covered without anyone remembering.

The server-maintained stamps are never borrowed: a rep cannot set either, so two permanently-blank read-only boxes among the creation fields would ask a question with no answer. Routing these through the Pipeline panel also means they inherit the shared `FieldEditable` rule — server-maintained and close-lock handling — rather than a one-off copy.

Absence is not the same state as unsaved, and getting that wrong hid fields from a panel that had no deal at all. Both getters key on `!this.Record || this.Record.IsSaved`.

**The Amount / Weighted / Situation block is hidden until the deal exists**, for the reason the hero briefing is: on a record nobody has saved it renders zeroes and dashes under the fields still being filled in.

**Three rail items showed a blank page on a new deal.** Selecting "What's being sold", "Internal team" or "Buying team" rendered the header and nothing else. Each already carried an @else branch explaining that the deal must be saved first, and none of it was reachable: all three are `[DefaultExpanded]="false"`, and a collapsed panel in left-nav renders no body. The explanation existed and could not be read — a correct message nothing displays, which is the same defect class as a correct getter nothing consumes. They now open while the deal is unsaved and collapse as before once it is saved.

**What this does not fix.** The left nav still lists every section on a new record. MJ resolves section inclusion statically, with no notion of record state, and `BaseFormPolicy.DecorateChrome` is explicitly forbidden from changing membership — `plans/form-chrome-layering.md` makes inclusion a static `Primary | More | None` at all three layers. Filed upstream as MemberJunction/MJ#4618.
