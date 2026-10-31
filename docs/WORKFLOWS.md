# Workflows and automations in Sales

For the people who run a sales pipeline on Sales and the administrators who automate it. It builds on
MemberJunction's [Workflows for Business Users](https://github.com/MemberJunction/MJ/blob/next/guides/WORKFLOWS_FOR_BUSINESS_USERS.md)
guide; read that first for what a workflow is, how one starts, and why a condition should say
**becomes**, not **is**. This page covers what is specific to Sales: the moments worth automating,
the conditions that catch them, and the rules Sales adds.

Developers: the record-change trigger mechanics are in MemberJunction's
[Workflows and Task Graphs Guide](https://github.com/MemberJunction/MJ/blob/next/guides/WORKFLOW_AND_TASK_GRAPH_GUIDE.md)
("Triggers: when a workflow runs").

## Names are yours, so conditions point at records

In Sales, pipelines, stages and statuses are data. A team can rename "Closed Won" to "Signed", or add
a stage, with no code change ([DECISIONS.md](DECISIONS.md) and the vocabulary rule in
[CLAUDE.md](../CLAUDE.md)). Automations follow the same rule. A condition never tests a stage's or
status's **name**. It tests:

- **the specific stage or status record**, by its ID (open the record to copy it), or
- **a flag on the status**: every deal status says whether it is open, closed, won or lost, and
  whether it locks the deal (`IsOpen`, `IsClosed`, `IsWon`, `IsLost`, `LocksDeal`).

A workflow that needs to know "was this a win?" reads the status's `IsWon` flag in a step and branches
on it. It never compares the words.

## Moments worth automating

| Moment | Record and event | Condition | Example automation |
|---|---|---|---|
| A deal's status changes (won, lost, reopened) | `MJ_BizApps_Sales: Deals`, updated | `DidFieldChange('DealStatusTypeID')`, then branch on the new status's `IsWon` / `IsLost` | Won: notify finance and the delivery lead, start onboarding. Lost: ask the owner for the loss reason, schedule a check-in in six months |
| A deal reaches one specific status | Deals, updated | `DidFieldChangeToValue('DealStatusTypeID', '<status ID>')` | The same, when only one status matters |
| A deal moves stage | `MJ_BizApps_Sales: Deal Stage Events`, created | `String(NewValues.ToStageID).toLowerCase() === '<stage ID, in lower case>'` | Bring in a solutions engineer at the technical stage; request legal review at the contract stage |
| A new deal is created | Deals, created | Often none; or test `NewValues`, such as its pipeline | Welcome the account; assign a first task to the owner |
| Someone joins a deal team | `MJ_BizApps_Sales: Deal Team Members`, created | Often none | Tell them, with a link to the deal |

Notes on the table:

- **Use a deal stage event for stage moves.** Sales appends one `Deal Stage Event` for every stage
  transition, in the same save, and never edits it afterwards. It records the stage and status moved
  from and to, who moved it, how long the deal sat in the previous stage, and the deal's amount and
  probability at that moment. That makes it the cleanest trigger for "when a deal reaches stage X",
  and a source for messages ("moved to Negotiation after 12 days, at $48,000").
- **A created record has no "before".** That is why stage-event conditions test `NewValues`.
- **IDs are compared in lower case.** SQL Server returns IDs in upper case and PostgreSQL in lower
  case. `DidFieldChangeToValue` ignores case; a direct comparison on `NewValues` needs
  `.toLowerCase()`.

## Moments that need a schedule instead

These become true without anyone saving a deal, so no record-change trigger can catch them. Run a
workflow on a schedule that finds them:

- a deal's expected close date has passed and it is still open;
- a deal's next-step date is today or overdue;
- a deal has sat in one stage longer than your norm.

## Rules Sales adds

- **Closing and reopening already run Sales' own flow.** Any save that moves a deal into a status that
  locks it runs Sales' close operation, and a move out runs the reopen, whatever made the save: the
  form, an import, an agent, an automation ([DECISIONS.md](DECISIONS.md), D-ST1). The close appends the
  stage event and does Sales' own close-out work, so check what it already does before automating the
  same thing.
- **A closed, locked deal cannot be edited.** In a status that locks the deal, the deal, its order's
  lines, its payment schedule and its team are refused on save, whoever saves them. An automation that
  tries to change a locked deal fails. To change one, reopen it; reopening records a reason.
- **Sales never computes money.** An automation that needs an amount reads it: the deal's `Amount`
  (a copy of its order's total), or the stage event's `AmountAtTransition`. It never multiplies,
  discounts or totals anything itself.
- **"The rep" means the owner.** A deal can have several team members (an account executive, a
  solutions engineer, a development rep). To message the person accountable, use the deal's owner,
  which Sales keeps in step with the owner-role team member. To message everyone, use the team.
- **Winning a deal can confirm its order.** When a deal enters a stage that names an order status, its
  order moves to that status. If that is *Confirmed*, the automations in Orders for a confirmed order
  fire for it too, such as sending the invoice. Decide which app owns each message, so the customer
  hears once. See [Orders workflows](https://github.com/MemberJunction/bizapps-orders/blob/next/docs/workflows.md).
- **Make anything outward-facing durable.** Closing a deal is one transaction. An automation whose
  `RunMode` is `Durable` runs only after that transaction commits, never for a close that rolled back,
  and survives a server restart. Use it for every automation that emails, messages or calls another
  system.

## Shipping an automation with Sales

An automation is metadata: an `MJ: Entity Actions` row with its invocation, filter and parameters. One
that every Sales installation should get is declared under `metadata/` and reaches an installation
only through a release's metadata migration ([PUBLISHING.md](PUBLISHING.md)). An automation one
installation wants for itself is created in that installation.

## Learn more

- [Workflows for Business Users](https://github.com/MemberJunction/MJ/blob/next/guides/WORKFLOWS_FOR_BUSINESS_USERS.md):
  the concepts, for everyone
- [Workflows and Task Graphs Guide](https://github.com/MemberJunction/MJ/blob/next/guides/WORKFLOW_AND_TASK_GRAPH_GUIDE.md):
  the mechanics, for developers
- [Orders workflows](https://github.com/MemberJunction/bizapps-orders/blob/next/docs/workflows.md):
  orders, payments, subscriptions and access
- [DECISIONS.md](DECISIONS.md): why deal statuses, locks and closes behave as they do
