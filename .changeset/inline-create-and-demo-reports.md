---
'@mj-biz-apps/sales-ng': minor
---

Inline account and contact creation happens in a slide-in and selects the result back into the field.

S-US1 says a rep can create a customer organization or primary contact "without leaving the deal."
`CreateRelated()` opened a new Explorer tab and returned nothing to the picker, so the rep had to navigate
back and re-find the record they had just made. It now opens a slide-in via `MJFormPresenterService` —
omitting `RecordId` is the presenter's own contract for a new record — reads the created entity from
`AfterSaved()`, reloads the lookups, and selects it.

The old comment argued there was no reliable moment to come back at. That was true of a tab, which has no
lifecycle the component can await, and false of a slide-in, which has exactly that moment. The half of the
argument worth keeping is kept: an explicit switch over a `DealRelatedTarget` union writes only the field
the rep launched from. The create button is now also hidden when that field is not editable, so a locked
deal cannot create a record it would then fail to attach.
