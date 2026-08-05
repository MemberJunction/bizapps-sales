/**
 * BizApps Sales — integration check bundles, dispatched by `mj test`.
 *
 * EMPTY AT S1, WITH TWO CHECKS ALREADY SPECIFIED. Both are named in the definition of done
 * (master plan §14) and both are the kind of guarantee that only a failing test preserves:
 *
 *   1. `Deal.Amount` for any lined deal equals the `Orders.PreviewOrder` result for the same draft
 *      (§6). This failure mode arrives by accretion — "just this one rounding case" — so it needs a
 *      test that fails, not a paragraph that asks nicely. Lands with S2.
 *   2. A closed deal is immutable at the ENTITY-SERVER level, proven by a check that attempts a
 *      direct `BaseEntity.Save()` and is refused (§7.3, L-17). Asserting it through the UI would
 *      prove nothing; the point of the lock is that an Action or an agent hits the same wall.
 *
 * ⚠️ RUN_MUTATION_TESTS=1 IS MANDATORY. Without it these suites run ZERO checks and pass
 * vacuously — the exact failure `scripts/assert-check-count.mjs` exists to catch. Integration
 * checks hit a LIVE database with nothing mocked; each check rolls back.
 */

export {};
