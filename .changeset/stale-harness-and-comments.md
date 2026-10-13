---
"@mj-biz-apps/sales-core-entities-server": patch
---

Correct comments that described contracts v1 and orders' old booked statuses. The close-won route probe reads contracts v2's `MustBeChild`; the two probes built on the removed customer XOR constraint are deleted. The mutation driver gives expected-miss mutants their own verdict instead of a vacuous OK, CI's changeset warning looks at the PR rather than the tree, and the Explorer harness preflight points at the QA guide instead of commands that do not exist.
