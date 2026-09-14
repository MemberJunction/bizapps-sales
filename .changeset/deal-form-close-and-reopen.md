---
"@mj-biz-apps/sales-ng": minor
---

Deal form: close and reopen a deal through actions, not by typing into the Status field (#205).

The Status control offers the open lifecycle only, filtered by the `LocksDeal` flag the server's own
refusal reads. Closing and reopening are actions on the Close panel: the close offers the real closing
statuses by name and collects the loss reason and notes the operation demands; the reopen collects the
reason `Sales.ReopenDeal` requires. Both surface the operation's warnings on success, not just on
failure — a close whose contract was stubbed or whose finance task could not be routed now says so.

The reopen is new here. The issue reported two defects, not one: a status write that closed a deal
without closing it, and no way back afterwards. Filtering the statuses fixed the first and left the
second, while the Status hint told the user to reopen a deal the form gave them no way to reopen.
