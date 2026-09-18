---
'@mj-biz-apps/sales-entities': patch
'@mj-biz-apps/sales-ng': patch
---

Deal form: a closed deal no longer shows a permanent, unactionable stale-amount warning (golive#230).

Every Won deal carried "A line has changed since this amount was last priced. Reprice the order to
update the total." — forever, and with nothing the reader could do about it. The deal is locked, so the
amount cannot change; and there is no reprice control anywhere in this codebase, so the sentence asked
for an action that does not exist.

**The check was keyed on a proxy rather than on the thing it cared about.** Both surfaces read the
newest `__mj_UpdatedAt` across the order's lines and called the amount stale if it was later than
`AmountComputedAt` — which asks "was a line TOUCHED", not "has the number moved". Closing a deal books
the order, which moves every line's status and stamps `__mj_UpdatedAt` without a figure changing, so the
close itself guaranteed the warning and the lock guaranteed nobody could clear it.

That is CLAUDE.md rule 8's shape exactly: a claim that was true when it was written — a touched line
usually did mean a moved price — and stayed asserted after the close flow started touching lines for its
own reasons. A proxy can be outgrown; the number cannot.

**Now it compares the number.** `ResolveDealAmountFreshness` in `sales-entities` tests the cached
`Deal.Amount` against the order's current `TotalGross`, which is the SAME test
`DealEntityServer.refreshAmountFromOrder()` uses to decide the cache is already current — so the surface
and the server agree by construction rather than by coincidence: if the server would rewrite the cache,
this says stale; if it would no-op, this says fresh. Still a comparison of two stored figures, never
arithmetic.

**A locked deal returns fresh before anything else**, and does not even read the order. The amount is
frozen, so there is no edit that could resolve the notice and no reason to ask.

**The copy now names an action that exists**: "The products on this deal changed after the amount was
calculated. Save the deal to update it." Verified rather than assumed — `DealEntityServer.Save()` sets
`amountMayHaveMoved` when `AmountIsComputed === true`, which is precisely the state the notice appears
in, and then re-reads `OrderHeader.TotalGross` into the cache.

The rule is shared so the Deal form and the deal hero cannot answer it differently, the same reason
`ResolveDealLockState` is. 12 checks, each no-warning case paired with one that DOES warn on the same
input — a suite that only proved "a locked deal is quiet" would pass against an implementation that
never warned at all.
