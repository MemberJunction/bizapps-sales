# Sales on QA — what to expect

**For testers. Written 2026-08-24, against `44ba849`.**

Six things worth knowing before you start. Four are ours, two are not, and each says which. Where
something is broken you will get a sentence explaining it rather than a stack trace — if you ever see
a raw database error, that is itself a bug worth reporting.

---

## 1. You cannot remove a line from an order — expected, and accepted for QA

**Not ours. The cause is in bizapps-orders.**

Add lines freely, edit them freely. **Removing one will be declined** with an on-screen explanation.
Nothing breaks and nothing is silently lost — you get told.

Andrew has accepted this for QA and it is scheduled to be addressed during UAT. Please don't file it.

<details>
<summary>Why, if you want the detail</summary>

Two things compound in orders. `savePendingLines()` never reads the collection's `Removed` list, so no
delete is ever issued. And the collection declares a `Sequence` on `LineNumber`, so MJ re-stamps line
numbers by array position — meaning the surviving line gets renumbered onto the orphan that is still
sitting at line 1. Rather than let you trigger a constraint violation, Sales declines the gesture up
front and explains.
</details>

---

## 2. Creating a customer inline can occasionally bind to nothing

**Ours. Open, and genuinely intermittent.**

When you create an account or contact from inside the deal workspace rather than picking an existing
one, it can occasionally fail to attach to the deal. The record is created; the deal just doesn't end
up pointing at it.

**If you hit it:** note what you clicked and in what order, and say so. We have not been able to
reproduce it reliably in weeks of trying, so a sequence of steps that triggers it is worth more than
another report that it happens. Tracked as **DN-19**.

**Workaround:** create the account or contact first, then pick it from the lookup.

---

## 3. The browser test suite is not green — and that means less than it sounds

**Ours, and it is a harness problem rather than a product one.**

Please don't read the automated browser results as a statement about the app. As of the last full
measurement the browser suite sits at roughly **10 passed / 16 failed / 3 skipped**, and **every
failure investigated so far has been a defect in the test harness** — tests clicking the wrong thing,
waiting on the wrong element, or tripping over records the tests themselves deleted. Not the app
failing.

What *is* measured, and what you can lean on:

| | |
|---|---|
| Server-side behaviour | **127 automated checks passing**, across 9 areas |
| Gates on every change | **7**, all green — including one that forbids Sales from ever computing money itself |
| Closing a won deal | run **end to end on a live host**, including the order and contract it creates |

So the app's behaviour underneath the browser is well covered. **The browser layer is not finished
coverage yet**, which is precisely why your manual testing is the thing that matters this week.

---

## 4. Ten checks can't be proven by our mutation tool — a boundary, not a hole

**Ours, and it needs no action from you.** Included only so nobody reads it as a coverage gap.

We routinely try to break the app on purpose to confirm each automated check would actually catch the
break. **Ten checks cannot be tested that way**, because what they assert isn't ours to break: they
cover the MemberJunction framework saving related records, orders stamping prices and company onto a
line, code that is generated rather than written, and seeded configuration rows.

The checks are real and they run. We simply can't prove them with that particular tool, and saying so
is more honest than quietly counting them.

*(Measured when the suite held 123 checks; it now holds 127, and the four newer ones have not been
classified. Treat ten as a floor.)*

---

## 5. Outlook ingest has never fetched a real message

**Ours. Built, never exercised against live mail.**

The activity pipeline — pulling mail and meetings in, matching them to deals, filing them on the
timeline — is written, and it is proven end to end against fixtures. **Nothing has ever fetched a real
message from a real mailbox.**

**So don't go looking for it on QA.** If you connect a mailbox and see nothing, that is this, not a
bug you have found. Andrew is aware. First live run is still ahead of us.

---

## 6. For whoever installs this

`mj-app.json` declares:

```json
"mjVersionRange": ">=6.0.0 <7.0.0"
```

The MJ core this app is pinned to is a **prerelease** — `6.1.0-edge.3`. Under standard semver a
prerelease does **not** satisfy that range. Neither did `edge.2`, so this predates the current version
bump and is not new.

Which means whatever reads that field is either not enforcing it, or is already passing
`includePrerelease`. **Both are fine — but it is worth knowing before an install rather than after**,
because if a future installer starts enforcing it strictly, this app will be refused for a reason that
has nothing to do with the app.

---

## Reporting

Worth a report: anything not on this list; a raw database or server error reaching the screen; anything
lost silently rather than refused with an explanation.

Not worth a report: removing an order line (#1), an empty Outlook timeline (#5).

For #2, the steps you took matter far more than the fact it happened.
