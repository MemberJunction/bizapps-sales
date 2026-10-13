# CodeGen lags by one pass when a new view column appears

Moved from `CLAUDE.md` on 2026-10-11. The rule in force is in `CLAUDE.md` under "CodeGen output must be
reproducible from this repo": run CodeGen until it reports `success: true` AND per-entity parity is
clean, using the parity query given there.

## Corrected on 2026-09-20

This entry used to read "A FULL SECOND CODEGEN PASS CORRUPTS THE DATABASE", and that rule was
backwards. Measured on 2026-09-20, after giving `Sales Contacts` a name field, which makes every view
with an FK to it gain a name column:

| | Deals | Deal Contact Roles | CodeGen said |
|---|---|---|---|
| after pass 1 | 59 fields / **61** columns | 10 / **11** | `success: false` |
| after pass 2 | **61 / 61** | **11 / 11** | `success: true` |

The **first** pass left the corruption; the **second** repaired it. `createNewEntityFieldsFromSchema`
builds `EntityField` rows by reading the base view's columns, so on the pass that CREATES those columns
they are not yet visible to it. The next pass sees them and registers them.

The original incident below is the same lag seen from the other side: pass 1 could not resolve the
IsA-derived `Account` join, pass 2 added the column, and metadata was one pass behind *then*. One
mechanism, not two rules. The "never run it twice" wording is why this repo went weeks unable to pick up
the contact name columns at all.

`entityFieldsSequenceCheck` pointed at the wrong entity. On the failing pass it reported a sequence
mismatch on `Deal Contact Roles` and said nothing about `Deals` being 59-vs-61, the one that breaks
inserts. A `success: false` naming one entity is not a statement about the others.

`git checkout` is not an undo: pass 1 writes views, sprocs and `EntityField` rows. A `BACKUP DATABASE`,
checked with `RESTORE VERIFYONLY`, is what made the 2026-09-20 run safe.

## The original incident

Running plain `mj:codegen` a second time regenerated `vwDeals` with **eleven** virtual lookup columns
where pass 1 produced ten: it added an `Account` join, derived from the `SalesAccount` IsA child, that
pass 1 had not been able to resolve yet. It did **not** add the matching `EntityField` row. The result:
`vwDeals`/`spCreateDeal` returned 56 columns while `Deal` had 55 registered fields, and since
`SQLServerDataProvider` builds its `@ResultTable` from *entity metadata* and then does
`INSERT INTO @ResultTable EXEC spCreateDeal`, **every Deal insert failed** with *"Column name or number
of supplied values does not match table definition"*, inside a transaction that then aborted. It also
drifted the live DB away from the baseline, because `append-codegen.sh` was (correctly) not re-run.

The original conclusion, "a single pass is self-consistent; two full passes are not", was wrong: the lag
is one pass, in whichever direction the new column appears. It is an IsA-ordering effect, so it bites
hardest on `SalesAccount`/`SalesContact` and anything else extending a parent entity, which is where it
bit again on 2026-09-20.

The `Deal` TABLE never changed. `spCreateDeal` ends in `SELECT * FROM vwDeals`, and the provider declares
`@ResultTable` with one column per `EntityField`, filled by a POSITIONAL `INSERT ... EXEC`. It is the
save-capture *width* that fails, not anything about the table.
