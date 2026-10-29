---
'@mj-biz-apps/sales-ng': minor
---

The Deal form's Account picker finds a sales account by its acronym as a starts-with match, and shows
the acronym next to the website domain under the name ("NAR · nar.realtor"). Sales now requires
bizapps-common 5.57.0 or later (Organization.Acronym), in `mj-app.json` and in every package's common
peer range. Migration `V202610291600` refreshes the Sales Account view and procedures to carry the
inherited Acronym and registers its field, so the Sales Account form shows it.
