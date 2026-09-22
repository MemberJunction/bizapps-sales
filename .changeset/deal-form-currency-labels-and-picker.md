---
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-ng": patch
---

Fix six field-level problems a tester hit creating a deal (bc-aidp-next-golive#259).

- A new deal now takes its currency from the selling company's `AccountingCompanyProfile.FunctionalCurrencyCode`, falling back to USD. Create-only, never over a supplied value, and it cannot refuse a save: a host without accounting creates deals with no currency exactly as before.
- `Deal.CurrencyID` ships a soft foreign key to accounting's currency table, so the Commercial section offers a picker and a name instead of an empty text box.
- `Amount`, `MRR` and `ARR` render as currency while reading. Editing still goes through `mj-form-field`; there is no currency type to ask it for, and the platform gap is filed separately.
- Six Deal labels drop their trailing "ID", and `MRR` / `ARR` stop reading as "Mrr" and "Arr".
- The native `<select>` controls the deal form draws itself — Status, and the two loss-reason pickers — match the shared control's typography and underline instead of the browser's defaults.
- Sales Contacts gains three picker columns, so two contacts with the same name and email can be told apart in a lookup.
