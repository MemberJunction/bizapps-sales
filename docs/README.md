# Documentation index

Every hand-written document in this repository, what it is for, and whether it describes the app as it
is now. **Current** documents are kept up to date with the code. **History** documents explain how a
current rule came about; read them for the reasoning, not for instructions.

Open defects are GitHub issues, not documents: [bizapps-sales issues](https://github.com/MemberJunction/bizapps-sales/issues).

## Start here

| Document | What it is for | Status |
|---|---|---|
| [`README.md`](../README.md) | What the app does, its dependencies, how to install it, and the entity model | Current |
| [`CLAUDE.md`](../CLAUDE.md) | The rules for working in this repository, for people and for Claude | Current |
| [`.env.example`](../.env.example) | Every environment variable the repository reads, with placeholders | Current |

## Decisions and known issues

| Document | What it is for | Status |
|---|---|---|
| [`docs/DECISIONS.md`](DECISIONS.md) | The rulings that govern the app, each with its reasoning | Current |
| [`DECISIONS-NEEDED.md`](../DECISIONS-NEEDED.md) | Calls made while building the app, and the [open questions](../DECISIONS-NEEDED.md#open-questions) that still need a ruling | Current |
| [`docs/KNOWN-ISSUES.md`](KNOWN-ISSUES.md) | The status of every `KI-n` entry, the open ones, behaviour that is by design, and standing rules | Current |
| [`docs/UPSTREAM-BLOCKERS.md`](UPSTREAM-BLOCKERS.md) | Asks for other repositories, and whether each is filed | Current |
| [`docs/upstream/`](upstream/) | Drafts of upstream asks that are not filed yet | Current |

## Building, testing and releasing

| Document | What it is for | Status |
|---|---|---|
| [`docs/WORKSPACE-SETUP.md`](WORKSPACE-SETUP.md) | Building the joined workspace and the database it needs | Current; its header says which parts were last run and when |
| [`docs/QA-GUIDE.md`](QA-GUIDE.md) | Configuration, seeding, the automated checks, and the manual test scenarios | Current |
| [`docs/PUBLISHING.md`](PUBLISHING.md) | How a release is cut, and what the release gates check | Current |
| [`.changeset/README.md`](../.changeset/README.md) | When a PR needs a changeset, and which bump level | Current |
| [`docs/CODEGEN-PARTIAL-RUNS.md`](CODEGEN-PARTIAL-RUNS.md) | How a partial CodeGen run drops objects, and the preconditions for every run | Current |
| [`docs/CHECK-MUTATION-EVIDENCE.md`](CHECK-MUTATION-EVIDENCE.md) | Which integration checks have been shown able to fail, by mutant | Current; updated by hand after a mutation run |
| [`test-harnesses/playwright/README.md`](../test-harnesses/playwright/README.md) | Running the Explorer UI harness, and the traps found while building it | Current |
| [`test-harnesses/MUTATION-RUNS.md`](../test-harnesses/MUTATION-RUNS.md) | Recovering from an interrupted mutation run, and the process rules for agents running one | Current |
| [`test-harnesses/playwright/COVERAGE-MAP.md`](../test-harnesses/playwright/COVERAGE-MAP.md) | What each Explorer spec asserts, and what it does not | Current |
| [`scripts/dev/README.md`](../scripts/dev/README.md) | The development-only seeds | Current |
| [`.claude/skills/report-issue/SKILL.md`](../.claude/skills/report-issue/SKILL.md) | The `/report-issue` skill for filing bugs | Current |

## Metadata

| Document | What it is for | Status |
|---|---|---|
| [`metadata/entities/README.md`](../metadata/entities/README.md) | Form layout and search settings on the Sales entities | Current |
| [`metadata/entity-relationships/README.md`](../metadata/entity-relationships/README.md) | The child collections on `Deal`, and where relationships appear on forms | Current |
| [`metadata/queries/README.md`](../metadata/queries/README.md) | The read-model queries and the rules they follow | Current |

## History

| Document | What it is for | Status |
|---|---|---|
| [`docs/history/agent-working-rules.md`](history/agent-working-rules.md) | The incidents behind `CLAUDE.md` critical rules 5–8 | History |
| [`docs/history/codegen-one-pass-lag.md`](history/codegen-one-pass-lag.md) | The measurements behind "run CodeGen until it reports `success: true`" | History |
| [`docs/history/migrations-baseline-in-place.md`](history/migrations-baseline-in-place.md) | The pre-release practice of editing the baseline migration in place, and why it ended | History |
| [`docs/history/mj-core-edge-versions.md`](history/mj-core-edge-versions.md) | The MJ core edge-version pins used before the 6.1 LTS line | History |
| [`plans/bizapps-sales-master.md`](https://github.com/MemberJunction/bizapps-sales/blob/an-master-plan/plans/bizapps-sales-master.md) on the `an-master-plan` branch | The original specification; `docs/DECISIONS.md` records where the app departs from it | Specification |

Release notes are in each package's `CHANGELOG.md`, written by changesets.
