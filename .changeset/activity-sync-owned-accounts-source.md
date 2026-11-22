---
'@mj-biz-apps/sales-core-entities-server': minor
---

Adds the `Sales.OwnedAccounts` consent source for Activity Sync. A connection whose `Settings.Consent.Sources` names it captures email and meetings with a salesperson's own accounts without a tag: the source returns the website domain of each active account the mailbox owner's employee owns, and the email domain of each active contact employed at one of those accounts, so an account with no website still counts. Free-mail contact domains are left out. A user with no linked employee, or an employee who owns nothing, gets an empty list with the reason and tag capture continues; a failed read throws, so the run fails closed. More than 5,000 accounts or 20,000 account-and-domain pairs is reported. Needs the `@mj-biz-apps/common-activity-sync` release that adds `BaseActivityConsentSource`.
