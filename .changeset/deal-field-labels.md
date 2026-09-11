---
"@mj-biz-apps/sales-entities": minor
---

Label two Deal fields the way a salesperson names them: `DealStatusTypeID` becomes **Status** and `ForecastCategoryTypeID` becomes **Forecast Category**, replacing "Deal Status Type ID" and "Forecast Category Type ID". These are `EntityField.DisplayName`, so they change the field label on the form and the column header in every grid that shows the field — which is why they are a migration rather than a string in a panel.

Matched on `(EntityID, Name)` rather than on the EntityField id: those ids are minted per host by CodeGen, so an id-keyed guard matches nothing on any other database. The migration asserts both labels are in place before it finishes, so a guard that matched nothing fails loudly instead of reporting success.

`AutoUpdateDisplayName` goes to 0 with them. CodeGen already leaves an existing field's DisplayName alone, so this is belt and braces — the label is now a deliberate choice rather than something derived from the column name.
