---
"@mj-biz-apps/sales-ng": patch
---

The Deal form's dedicated Pipeline control carries the `--required-empty` modifier.

`Deal.PipelineID` is NOT NULL, and base-forms styles that modifier on the input — so a dedicated control that omits it shows a required field as though it were optional, and the rep finds out at save time. The condition mirrors MJ's own `IsRequiredEmpty` getter: required, editing, and no value.

The rest of this change is test harness only.
