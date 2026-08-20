# Decisions needed

Raised while rewriting `scripts/seed-demo-data.sh` for the embedded-order model, and while
assessing the `feature/pipeline-board` rebase. Nothing here is blocking tonight's work — each item
has a defensible interim choice recorded in the code — but each is a call someone else should make.

---

## D-1 · Which pipeline stage means "agreement or higher"?

**Where it bites:** the seed script sets every embedded order to `Draft`.

The model says an order advances to `Quoted` when its deal reaches the agreement stage or higher.
Nothing in the schema says which stage that is. `PipelineStage` has `DisplayOrder`, so "or higher" is
expressible as arithmetic, but identifying the *threshold* stage would mean comparing a stage name in
code — which `npm run test:vocabulary-gate` fails the build over, correctly.

Neither seeded pipeline even has a stage called Agreement: B2B runs Discovery → Qualification →
Proposal → Negotiation → Signed → Lost, and D2C runs Introduced → Evaluating → Booked.

**Interim choice:** seed every order `Draft`. It is what deal creation genuinely produces, and it is
what an unadvanced order actually is — so the demo is honest rather than aspirational.

**What is needed:** a behaviour flag on `PipelineStage` (a `QuotesOrder BIT` set on every stage at or
above the threshold keeps "or higher" out of code entirely), plus a ruling on which stages carry it
per pipeline. Once that exists, the seed should set `Quoted` on the deals sitting at or beyond it —
DEAL-9001 is at Negotiation and is the obvious candidate.

---

## D-2 · `Deal.Amount` is no longer maintained by anything

**Where it bites:** the seeded header amounts, and the pipeline board's column totals.

`Deal.Amount` is seeded as a human's stated figure with `AmountIsComputed = 0`, which was always the
design. What changed is that the line items which used to sit beside it now live on the embedded
order, and **nothing reconciles the two**. A deal can carry `Amount = 185000` while its order lines
say something else entirely, and no code notices.

The pipeline board sums `Deal.Amount` for its column totals, so it will show figures that are
unpriced, stale, or both — silently.

**Now measured, on the reseeded demo data.** The board sums `Deal.Amount`; the embedded order lines say
something else entirely:

| Deal | `Deal.Amount` (what the board shows) | Order lines (what is being sold) |
|---|---|---|
| DEAL-9001 | 185,000 | 106,080 |
| DEAL-9003 | 96,000 | 73,080 |
| DEAL-9007 | 9,500 | 4,775 |

That is a 43–50% divergence on every lined deal, and nothing anywhere reconciles it. The board's column
totals are therefore confidently wrong rather than obviously missing, which is the worse failure — a
blank total invites a question, a precise one does not.

**Interim choice:** seeded amounts left as-is and deliberately NOT reconciled to the order lines. The
figures differ, visibly, which is more useful than quietly making them agree in seed data and
discovering the gap in production.

**What is needed:** a decision on what `Deal.Amount` means now. Three shapes, and they are not
equivalent:

1. a read-through of the embedded order's total — one number, always current, and the three
   provenance columns (`AmountIsComputed`, `AmountComputedAt`, `AmountSourceHash`) retire with it;
2. a cached answer whose hash fingerprints the ORDER's lines rather than the retired deal lines, so
   the UI can still say *"stale, reprice"*;
3. it stays a human's estimate and the board stops summing it, showing an order-derived total instead.

---

## D-3 · `Pipeline.RequiresDealLines` survived a table that did not

The column still exists post-rework and the seed still sets it (`0` on the header-only pipeline).
Its description still reads *"whether deals carry catalog lines"*, which now has to be read as "whether
the deal's embedded ORDER carries lines" — the flag outlived the table it was named for.

**Interim choice:** kept, used, and its narrative updated in the seed to say what it now means.

**What is needed:** either a rename (`RequiresOrderLines`) or an updated column description. Low
urgency, but the current name will mislead exactly once per newcomer.

---

## D-4 · Demo order numbers are a reserved prefix, not sequence-minted

Real orders take their number from orders' own sequence (`ORD-000035`). The seed cannot reach that —
it is `sqlcmd` with no provider — so demo orders are `ORD-DEMO-9001/9003/9007`.

**Interim choice:** the `ORD-DEMO-9%` prefix. It keeps the seed idempotent, lets teardown match
exactly its own rows, and can never collide with a sequence-minted number.

**What is needed:** confirmation that a visibly-fake order number is acceptable in the demo. If it is
not, the alternative is provisioning through the entity layer, which means the seed stops being a SQL
script — a much larger change.

---

## D-5 · The stage-event append is now on every write path, including ones that never had it

**Raised by:** moving the board's append out of the deleted `SaveDealOperation` and into
`DealEntityServer.Save()`.

This is a genuine behaviour change and worth being explicit about rather than discovering. Previously
only a stage move made through `Sales.SaveDeal` produced a `DealStageEvent`. Now every stage move does —
an Action, an agent, a fixture, a raw `BaseEntity.Save()`, a data fix run from a script.

That is almost certainly what was always wanted: an append-only provenance log with a hole in it for
whichever callers bypassed one operation is not really a log. But it means **any bulk or migration
script that moves deals between stages will now generate one event per deal**, and a HubSpot import that
replays historical stage history will write events as a side effect of loading.

**Interim choice:** the append fires on every path, because a partial log is worse than a noisy one.

**What is needed:** confirmation, plus a decision on whether an importer needs a documented way to
suppress it — the same shape as the close-lock bypass the importer already needs (CLAUDE.md rule 3
gives it 'an explicit, audited path'), rather than a general-purpose off switch.

---

## D-6 · `board-move` is registered as an unconditional bundle

I added `board-move` to `scripts/expected-check-counts.json` with `requires: null`, so the coverage gate
expects it on every host. BD1–BD4 drive a deal through the entity and read `DealStageEvent`; they touch
no sibling app directly.

**But saving a deal now provisions its embedded order**, which does need orders. On a host without
orders the save may refuse and all four would fail for a reason none of them are about.

**Interim choice:** `requires: null`, because it is true of what the checks themselves read, and it was
correct on the host I verified against.

**What is needed:** a decision on whether every bundle that saves a deal now implicitly requires orders.
If so, `board-move` should be `requires: "orders"` — and so should `save-deal`.