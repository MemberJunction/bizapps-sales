---
'@mj-biz-apps/sales-ng': patch
---

Cancels a pending price request when the line dialog closes, and grants SELECT on the layered `vwSalesContacts`.

**The debounce timer outlived the dialog.** It was cleared only by being RESCHEDULED, so a rep who typed a quantity and clicked Cancel within 350ms left a timer firing against a destroyed component — a pointless `Orders.PriceOrder` round trip and a `detectChanges()` on a view Angular had already torn down. The dialog sits inside `@if (EditorOpen)`, so it is genuinely destroyed on both Save and Cancel. The component now implements `OnDestroy`.

**`vwSalesContacts` is granted explicitly.** The migration that creates the layered wrapper DROPs the previous view, and dropping a view discards its permissions.

This is insurance rather than a repair: CodeGen re-grants on exactly this kind of object — its own guard is described as being for *"objects CodeGen refreshes or GRANTS ON but does NOT create — specifically the application-owned outer view of a layered entity"* — and a run duly restored all three roles. On the documented install sequence the grants arrive without this file. It ships for the window in between, and for any path that applies migrations without a CodeGen run afterwards, where no application role can read Sales Contacts. The failure is invisible to anyone testing as `sa`, which is how it went unnoticed. bizapps-contracts grants explicitly in its own layering migration for the same reason.

A new migration rather than an edit to the one that creates the view: that migration is applied, and changing its content changes its Flyway checksum.
