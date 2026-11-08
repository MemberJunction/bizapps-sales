# Baseline-in-place migrations, and how they ended

Moved from `CLAUDE.md` on 2026-10-11. The rule in force is in `CLAUDE.md` under "Migrations — additive
only".

## Closed on 2026-09-18

Schema changes became **new migration files**, and editing an applied one, the baseline included, ended.
An applied migration's content is part of its checksum, so editing it makes Flyway refuse the whole run
on every host that already has it, and there were such hosts by then, a UAT environment among them.

The switch had happened before anyone noticed. `migrations/` held five additive files after the
baseline, including `V202608251930__v5.2.x__Metadata_Sync.sql`. CLAUDE.md said "switch to additive-only
at first publish", and the first publish was `V202608251930`, three weeks earlier. The rule was read
instead of the directory, which is how a corrected `AmountSourceHash` description was first written as
an edit to `V202608042101` before being redone as a new migration. `V202609020650`'s own header
already stated the discipline: it is numbered before its partner deliberately, "so no already-computed
migration checksum changes."

## The pre-publish loop

Schema changes edited the baseline migration in place; fix-up migrations were not stacked. That was
only safe because rebuilding from zero was routine:

```bash
CONFIRM_DROP=<database> scripts/rebuild-db.sh   # drop+create, MJ core, bizapps-common, this app's DDL
npm run mj:codegen                       # PASS 1 — entity metadata + SQL objects
scripts/append-codegen.sh                # fold generated SQL below the baseline's banner
pnpm mj sync push --dir metadata         # seed the type tables + remote-operation rows
npm run mj:codegen:files                 # PASS 2 — FILES ONLY (--skipdb)
npm run build
scripts/seed-dev-data.sh && scripts/seed-demo-data.sh   # the rebuild dropped all data
# then restart MJAPI AND MJExplorer
```

- `append-codegen.sh` was not optional. The generated half of the baseline is what makes a fresh
  `mj migrate` produce a working database rather than bare tables. It was lost once in a sibling repo
  and could not be recovered without another full rebuild.
- `rebuild-db.sh` trims the generated half before applying, so CodeGen regenerates it in full. Without
  the trim, CodeGen emits only a delta, which `append-codegen.sh` refuses.
- CodeGen ran twice, and pass 2 had to be `--skipdb`. Remote operations generate from metadata rows,
  not from the schema, so pass 1 could not see an operation `sync push` had not inserted yet:
  `remote_operations.ts` came out holding only MJ's core operations, and every `Sales.*` shell was
  missing. Pass 2 emitted them, and `--skipdb` restricted it to TypeScript, Angular and GraphQL files.
- `append-codegen.sh` was not re-run after pass 2. With the generated half in place a full pass emits
  only a delta, and with `--skipdb` there is no SQL to fold in.
- Not restarting both servers after a rebuild cost a Playwright debugging cycle in Phase 2. `ng serve`'s
  watch mode rebuilds the bundle on a package change but does not re-read metadata.

`scripts/rebuild-db.sh` kept trimming the baseline's generated half after the loop ended, leaving a
shipped migration modified in the working tree. The trim and `append-codegen.sh` were removed for
#217; the rebuild now applies every migration as shipped.
