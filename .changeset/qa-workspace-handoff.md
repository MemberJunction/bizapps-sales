---
'@mj-biz-apps/sales-integration-tests': patch
---

A turnkey workspace-setup guide, an end-to-end smoke, and a company-agnostic catalogue seed.

`docs/WORKSPACE-SETUP.md` is the guide a tester can follow to stand up the full sales → orders →
accounting stack without re-deriving it: clone order, the CLI bootstrap chicken-and-egg, migration order,
the seeds, and the rough edges worth recognising. Every step was executed end to end against a fresh clone
set and an empty database, reaching 38/38 integration checks and an 11/11 smoke.

`test-harnesses/smoke-close-won.mjs` walks a deal from creation through the picker to a booked order and
reports pass/fail per step. Unlike the `close-won-handoff` bundle it COMMITS, leaving a `SMOKE-`prefixed
deal and a real order to open.

`scripts/dev/seed-orders-catalog.sql` replaces a version that hardcoded one host's company UUIDs. It now
discovers the selling company the same way `ResolveSalesFixture` does — via the first active pipeline —
which is what makes PP2, the cross-tenant leak check, meaningful rather than accidentally true.
