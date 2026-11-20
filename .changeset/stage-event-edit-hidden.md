---
"@mj-biz-apps/sales-ng": patch
---

A Deal Stage Event record no longer offers an Edit button that does nothing.

Stage events are append-only. The form already refused edit mode, but it wrote its reason into a property no template rendered, and the toolbar kept showing Edit because the base form answers "can edit" from the entity's Update permission. Clicking Edit therefore did nothing and said nothing.

The form now reports that it cannot be edited, so the toolbar hides Edit, and it still refuses edit mode for callers that skip the toolbar. A new `before-fields` panel, `MJSDealStageEventNoticePanel`, shows the append-only explanation on every stage event record. `ReadOnlyNotice` on the form now returns that same sentence (`STAGE_EVENT_APPEND_ONLY_NOTICE`) instead of being set on click.

The server still accepts updates to stage events; that is tracked separately.
