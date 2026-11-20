---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

A weekly Lapsed Close Date Digest emails each audience the open deals whose expected close date has passed or was never set. Who receives it, and how each email reads, is data: Company Leader, CEO, CFO and CTO audiences carry their own rules (portfolio-wide or per company, a minimum number of days lapsed, whether deals with no close date are listed, whether to send when nothing is lapsed), and recipients are chosen per audience and company. Adds the Deal Digest Audience Types and Deal Digest Recipients entities.

Emails are sent as the company's default Mailbox identity, display name included, falling back to the `DigestFromAddress` setting. The job's `StartingPayload` fails closed: an absent field takes its default, but a field that is present and unreadable — `{"dryRun": "true"}`, say — ends the run `Failed` without sending, rather than being ignored and mailing the real roster.
