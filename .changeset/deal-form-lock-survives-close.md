---
"@mj-biz-apps/sales-ng": patch
---

The Deal form re-resolves its close lock after every save and refresh, not only when the form opens.

`resolveCloseLock()` ran once, in `ngOnInit`, and reads the PERSISTED status, so a deal closed in the form kept `IsLocked = false` for the rest of the session. The hero's Locked chip was right the whole time because it reads the record; the form component did not.

That is what the form reasons from: `FieldEditable()` returns `!locked || IsDealFieldEditableWhileLocked(...)`, so a stale false made every field report editable — the dedicated Pipeline control rendered an editable picker on a locked deal, which the server then refused on save. `EditableFieldNames()` returned null instead of the locked carve-outs, and `ValidateAsync` reads the same signal.
