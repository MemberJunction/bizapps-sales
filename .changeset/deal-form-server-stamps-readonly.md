---
'@mj-biz-apps/sales-ng': patch
---

Deal form: the two server-maintained stamps are no longer offered for editing.

The Account & people panel rendered `CompanyID` and `OwnerEmployeeID` as editable on any unlocked deal, and neither is a field a caller may set. `stampCompanyFromPipeline()` overwrites a supplied `CompanyID` from the pipeline's company; `ownerStampEditRefusal()` refuses a supplied `OwnerEmployeeID` outright, because the owner comes from the deal team via `stampOwnerFromTeam()`. CLAUDE.md states it directly — "written by entity-server code. Never hand-set them."

So a rep could pick a company or an owner, press Save, and have the choice silently discarded or the save refused. That is the "accepts typing, refuses on save" behaviour golive#206 item 3 exists to delete, on a panel nobody had revisited.

Both fields stay **rendered and navigable** — `link: 'Record'` is untouched, so the company and the owner are still visible and still open their records. What goes away is the invitation to type into them.

The flag is consulted BEFORE the close lock, deliberately: the lock is not the reason. A server stamp is frozen on an open deal too, and checking it after the lock would leave exactly the case that matters — an unlocked deal — still editable.

Not to be confused with the `''`-into-`uniqueidentifier` bug also found on this panel's neighbours: these five fields all carry `RelatedEntityID` and render as FK pickers, so they never had that defect. That one was the generated Sales Accounts form, fixed separately.
