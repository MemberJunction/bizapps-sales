#!/usr/bin/env bash
#
# Rebuild the local development database from scratch.
#
# WHY THIS EXISTS: the standing pre-production practice is that schema changes EDIT THE BASELINE
# MIGRATION IN PLACE rather than adding fix-up migrations. That is only safe if rebuilding from zero
# is routine — otherwise the baseline drifts from what anyone actually has installed. This script is
# that routine.
#
# WHAT IT DOES
#   1. drop + recreate the database
#   2. MJ core schema at the pinned version
#   3. bizapps-common   — applied with sqlcmd rather than `mj migrate`, because `mj migrate` would
#                         rewrite common's ${flyway:defaultSchema} to THIS app's schema and put
#                         common's tables and procedures inside __mj_BizAppsSales. The substitution
#                         is therefore done here, pinned to common's OWN schema.
#
#                         ⚠️ ${flyway:defaultSchema} MEANS __mj_BizAppsCommon, NOT __mj.
#                         The bizapps-orders script this was derived from substitutes __mj here and
#                         its comment asserts that common "extends core". That is wrong, and it fails
#                         silently in a way worth knowing about: common's BASELINE hardcodes
#                         __mj_BizAppsCommon, so the tables land correctly and the database looks
#                         fine — but all five of common's VERSIONED migrations (the v5.28 tolerant SP
#                         regen, the v5.29 Person.DisplayName computed column and its wireup, the
#                         v5.29 metadata sync, the v5.30 LinkedUserID unique constraint) reference
#                         [${flyway:defaultSchema}].[Person] / [AddressType] / [vwAddressLinks] and
#                         die on "Invalid object name '__mj.Person'". Because the loop does not check
#                         sqlcmd's exit status, the rebuild reports success and common is left at its
#                         baseline with none of its patches. Verified here 2026-08-04.
#   4. this app's migrations
#
# WHAT IT DELIBERATELY DOES NOT DO, unlike the bizapps-orders script it is derived from:
#   * no bizapps-accounting step, and no accounting seed metadata. Sales books nothing and computes
#     no money — it asks Orders.PreviewOrder. Nothing in the S1 schema references an accounting row.
#   * no bizapps-orders step. DealLine.ProductID and Deal.ContractID are SOFT references (DG-6), so
#     the sales baseline stands up with only common present. This is the single fact that makes the
#     S1 CRUD milestone reachable without the whole family installed and built.
#   Both arrive when S2 wires the pricing bridge, and this script grows the steps then.
#
# AFTER THIS, still by hand (they need judgement, not automation):
#   npm run mj:codegen                     # regenerate entity metadata + SQL objects
#   scripts/append-codegen.sh              # append the generated SQL below the migration's banner
#   pnpm mj sync push --dir metadata # seed the type tables
#
# Usage: scripts/rebuild-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
# THE TARGET DATABASE IS NAMED BY THE CALLER, NOT INFERRED FROM .env.
#
# Step 1 of this script is DROP DATABASE. Sourcing .env with `set -a` overwrites anything already in
# the environment, so the obvious safety measure — `DB_DATABASE=scratch scripts/rebuild-db.sh` —
# was silently discarded and the run proceeded against .env's value. Measured 2026-08-25: with
# DB_DATABASE=MY_SCRATCH_DB exported, the value after this source was MJ_V6_Host, the recording host
# that holds the demo data. A caller taking that precaution would have destroyed it while believing
# the override held.
#
# So: .env still supplies credentials and every other setting, but the database this script DROPS
# must be named explicitly in CONFIRM_DROP, and it wins over .env. There is no default and no
# prompt — an unattended run with no CONFIRM_DROP stops instead of guessing.
#
#   CONFIRM_DROP=MJ_Sales_FreshInstall scripts/rebuild-db.sh
#
# This is deliberately not a blocklist of protected names. A blocklist protects the hosts someone
# thought of; naming the target protects every database including the ones added next week.
set -a; . ./.env; set +a

if [[ -z "${CONFIRM_DROP:-}" ]]; then
    printf '\033[1mrebuild-db.sh refuses to guess which database to drop.\033[0m\n' >&2
    printf '  .env currently resolves DB_DATABASE to: %s\n' "${DB_DATABASE:-<unset>}" >&2
    printf '  Treat that as the value NOT to copy unless you truly mean it — the everyday .env\n' >&2
    printf '  target is a working host, not a scratch database. Name the scratch database:\n' >&2
    printf '      CONFIRM_DROP=<database-to-destroy> scripts/rebuild-db.sh\n' >&2
    exit 2
fi
DB_DATABASE="$CONFIRM_DROP"

MJ_VERSION="${MJ_CORE_VERSION:-v5.51.0}"
COMMON_REPO="${BIZAPPS_COMMON_REPO:-$ROOT/../bizapps-common}"
MJ="node $ROOT/node_modules/@memberjunction/cli/bin/run.js"
SQLCMD="sqlcmd -S ${DB_HOST},${DB_PORT:-1433} -U ${DB_USERNAME} -P ${DB_PASSWORD} -C -N o"

say() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

say "1/4  Recreating ${DB_DATABASE}"
$SQLCMD -d master -Q "
    IF DB_ID('${DB_DATABASE}') IS NOT NULL
    BEGIN
        ALTER DATABASE [${DB_DATABASE}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${DB_DATABASE}];
    END
    CREATE DATABASE [${DB_DATABASE}];"

say "2/4  MJ core @ ${MJ_VERSION}"
$MJ migrate -t "${MJ_VERSION}"

say "3/4  bizapps-common"
# See the header note on why this is sqlcmd + sed rather than `mj migrate`.
#
# THE SUBSTITUTED SQL GOES THROUGH A TEMP FILE, NOT A PIPE. `sqlcmd -i /dev/stdin` is what the
# sibling repo uses and it works there because that path is a Linux/macOS construct; the Windows
# (Go) sqlcmd has no /proc/self/fd/0 and dies with "Error occurred while opening or operating on
# file /dev/stdin". `-i` wants a real path on every platform, so we give it one.
COMMON_TMP="$(mktemp -t bizapps-common-XXXXXX.sql)"
trap 'rm -f "$COMMON_TMP"' EXIT
for f in "$COMMON_REPO"/migrations/*.sql; do
    printf '  %s\n' "$(basename "$f")"
    sed 's/\${flyway:defaultSchema}/__mj_BizAppsCommon/g; s/\${mjSchema}/__mj/g' "$f" > "$COMMON_TMP"
    # -b makes sqlcmd exit non-zero on a SQL error, so `set -e` actually stops the rebuild. Without
    # it the loop swallows failures and reports a successful rebuild over a half-applied dependency —
    # which is exactly how the placeholder bug above stayed invisible.
    $SQLCMD -b -d "${DB_DATABASE}" -i "$(cygpath -w "$COMMON_TMP" 2>/dev/null || echo "$COMMON_TMP")"
done

# TRIM THE GENERATED HALF BEFORE APPLYING. Once CodeGen output lives in the baseline, a rebuild
# produces a database whose entity metadata is ALREADY current — so the next CodeGen run has nothing
# to do and emits only a delta, which append-codegen.sh then refuses (rightly) as a partial. The
# cycle is only self-consistent if the rebuild applies the hand-authored DDL alone and CodeGen
# regenerates the rest from scratch. This is what makes "edit the baseline in place" safe.
say "4/4  bizapps-sales (hand-authored DDL only)"
MARKER='CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE'
SALES_MIGRATION=$(grep -rl "$MARKER" "$ROOT/migrations"/*.sql | head -1)
if [[ -n "$SALES_MIGRATION" ]]; then
    MARKER_LINE=$(grep -n "$MARKER" "$SALES_MIGRATION" | head -1 | cut -d: -f1)
    BANNER_END=$(awk -v s="$MARKER_LINE" 'NR>=s && /^-- =+$/ { print NR; exit }' "$SALES_MIGRATION")
    GENERATED_LINES=$(( $(wc -l < "$SALES_MIGRATION") - BANNER_END ))
    if (( GENERATED_LINES > 0 )); then
        printf '  trimming %s lines of generated output (CodeGen will regenerate them)\n' "$GENERATED_LINES"
        head -n "$BANNER_END" "$SALES_MIGRATION" > "$SALES_MIGRATION.tmp"
        mv "$SALES_MIGRATION.tmp" "$SALES_MIGRATION"
        # RECORD WHAT WE TRIMMED, so append-codegen.sh has something to compare against. Its shrink
        # guard exists to catch a partial CodeGen run being appended over a full one — but it
        # compares the incoming output against what is CURRENTLY below the banner, and by this point
        # that is zero. In the normal flow (rebuild -> codegen -> append) the guard could therefore
        # never fire, which is the one flow it was written for.
        mkdir -p "$ROOT/migrations/codegen"
        printf '%s\n' "$GENERATED_LINES" > "$ROOT/migrations/codegen/.previous-generated-lines"
    fi
fi

# STALE EMITS ARE DEBRIS, AND THEY ACCUMULATE INTO THE BASELINE. append-codegen.sh concatenates
# EVERY file in migrations/codegen/, so runs left over from previous rebuilds are appended again on
# the next one. In the sibling repo that was not hypothetical: the baseline reached 309k lines
# carrying EIGHT stacked copies of every view and procedure before anyone noticed, because each copy
# is valid SQL and the last one wins. Clearing here means the emits appended are exactly the ones
# this rebuild produced.
find "$ROOT/migrations/codegen" -maxdepth 1 -name '*.sql' -delete 2>/dev/null || true

# --schema is REQUIRED, not optional. Without it `mj migrate` uses the CORE schema's flyway history,
# which already carries a SQL_BASELINE from step 2 — so flyway skips this app's `B` baseline
# entirely and reports "0 applied" while creating nothing.
$MJ migrate --schema __mj_BizAppsSales --dir "$ROOT/migrations"

say "Done"
cat <<'NEXT'
Next, in order:
  npm run mj:codegen
  scripts/append-codegen.sh
  pnpm mj sync push --dir metadata
  npm run build
NEXT
