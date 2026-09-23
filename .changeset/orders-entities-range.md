---
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

`@mj-biz-apps/orders-entities` is declared as `^5.14.0` rather than pinned exactly, so the pin stops
needing a human to chase orders' releases (bc-aidp-next-golive#258).

WHY THE EXACT PIN CANNOT HOLD. Orders OWNS `orders-entities` and pins it exactly inside `orders-ng`,
`orders-server` and `orders-core-entities-server`, rewriting those pins on every release. Sales'
declaration lives in another repo, so nothing moves it. Two different exact pins is precisely what no
resolver can satisfy from one copy: it nests a second `orders-entities` under the sales packages, that
copy re-runs every module-scope `@RegisterClass` in it, `ClassFactory` auto-increments priority so the
duplicate `OrderHeaderEntity` outranks `OrderEntityServer`, and `OrderNumber` is never minted. Every
new order header then fails its NOT NULL insert — the Orders screen, and every Deal that provisions an
embedded order. It is silent, because the collision warning compares class NAMES.

No repo's CI can see that drift. Sales resolves one copy of whatever it pins, orders is internally
consistent, and both are green; the duplicate exists only in a host that installs BOTH.

THE DRIFT HAD ALREADY RECURRED. #258 was fixed on 2026-09-22 by moving the pin 5.13.0 → 5.14.0. Orders
has since shipped 5.15.0 and 5.16.0 and pins 5.16.0 internally, so a host installing today's published
sales beside today's published orders nests three copies. Measured:

    sales declares `5.14.0`   ->  2 copies  (5.14.0 nested under sales, 5.16.0 at the root)
    sales declares `^5.14.0`  ->  1 copy    (5.16.0)

A range defers to the owner's pin, which is what actually produces the single copy. The general rule,
and the reason this is worth stating beyond one package: the OWNER of a package may pin it exactly; a
CONSUMER in another repo declares a range and lets the owner's pin win. `mj-app.json` already declared
its app-level dependencies this way (`mj-bizapps-orders: ">=5.1.0 <6.0.0"`); only the npm manifests
had diverged.

The floor is 5.14.0 because that is where the order-line veto seam was verified, not where a resolver
happened to land — `dist/order-line-edit-veto.js`, its three exports and the `index.d.ts` re-export are
present and identical in the 5.13.0, 5.14.0, 5.15.0 and 5.16.0 tarballs. `LoadDealLockOrderLineVeto`'s
own documentation argued for the exact pin and is rewritten; leaving it would have left the repo's
stated rule contradicting its manifests.

The lockfile is deliberately NOT moved: this changes policy, not versions, so the only churn is the
five specifier strings. Verified separately that `orders-entities` 5.16.0 builds and passes all 587
tests with every other package held constant, so the range is safe across its whole span.
