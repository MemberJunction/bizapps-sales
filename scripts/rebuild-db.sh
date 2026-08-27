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
#   * no bizapps-contracts step. It does not install on a fresh database (KI-13), and sales has no
#     FK into it -- measured 2026-08-25: sales' only cross-schema FKs are to __mj,
#     __mj_BizAppsCommon and __mj_BizAppsOrders. If that changes, contracts goes LAST, after sales.
#
#   IT USED TO SKIP ORDERS AND ACCOUNTING TOO, on the grounds that "DealLine.ProductID and
#   Deal.ContractID are SOFT references (DG-6), so the sales baseline stands up with only common
#   present." That was true when it was written and stopped being true on 2026-08-19, when da0f69f
#   gave Deal.OrderID a real FK to __mj_BizAppsOrders.OrderHeader. DealLine no longer exists at all.
#   The steps the header promised would "arrive when S2 wires the pricing bridge" are now present.
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
# THE CALLER'S MJ_CORE_VERSION SURVIVES THE .env, which it did not before.
#
# `. ./.env` assigns unconditionally, so a value exported on the command line was silently
# replaced by the one in the file. `MJ_CORE_VERSION=v6.1.0-edge.4 scripts/rebuild-db.sh` then
# migrated to edge.3 and said so in its own banner -- which is the worst version of this, because
# the run LOOKS like the experiment you asked for. Found while trying to test whether a newer core
# clears the common failure; the answer was neither yes nor no, it was "you did not test that".
#
# Scoped to this one variable on purpose. DB_DATABASE is deliberately taken from .env and then
# replaced by CONFIRM_DROP below, and that ordering must not change.
_caller_mj_core_version="${MJ_CORE_VERSION:-}"
set -a; . ./.env; set +a
[[ -n "$_caller_mj_core_version" ]] && MJ_CORE_VERSION="$_caller_mj_core_version"

if [[ -z "${CONFIRM_DROP:-}" ]]; then
    printf '\033[1mrebuild-db.sh refuses to guess which database to drop.\033[0m\n' >&2
    printf '  .env currently resolves DB_DATABASE to: %s\n' "${DB_DATABASE:-<unset>}" >&2
    printf '  Treat that as the value NOT to copy unless you truly mean it — the everyday .env\n' >&2
    printf '  target is a working host, not a scratch database. Name the scratch database:\n' >&2
    printf '      CONFIRM_DROP=<database-to-destroy> scripts/rebuild-db.sh\n' >&2
    exit 2
fi
DB_DATABASE="$CONFIRM_DROP"

# THE MJ CORE TAG, READ FROM THE CLI THIS SCRIPT IS ABOUT TO INVOKE -- not hardcoded.
#
# The default was v5.51.0 while this workspace runs 6.1.0-edge.4: a MAJOR version apart, chosen once
# and never revisited. Any host that does not set MJ_CORE_VERSION installs a v5 core and then applies
# v6-era app migrations on top of it.
#
# WHY IT SURVIVED THIS LONG, which is the part worth keeping: `.env` on the machine that actually runs
# this script sets MJ_CORE_VERSION explicitly, and the block below honours that. So the stale default
# was masked on the only host anyone tested -- it would have fired for the next person to clone the
# repo and rebuild without that line, which is precisely a QA machine.
#
# Reading the tag from `node_modules/@memberjunction/cli` means the core installed and the CLI that
# installs it cannot disagree again, including after the next version bump. An explicit MJ_CORE_VERSION
# still wins, so a deliberate pin is unaffected.
#
# THIS DOES NOT FIX THE FROM-EMPTY INSTALL, and must not be read as doing so. Measured 2026-08-27
# against a scratch database: with the core at v6.1.0-edge.3 the rebuild still dies in COMMON's
# V202608252150 migration with
#
#     Procedure or function spUpdateExistingEntitiesFromSchema has too many arguments specified
#
# because common calls that proc with @ExcludedSchemaNames and the core at that tag does not declare
# it. That is a core-version compatibility problem between common and MJ, not this line -- an earlier
# note of mine blamed the v5 pin for it and was wrong.
MJ_CLI_PKG="$ROOT/node_modules/@memberjunction/cli/package.json"
if [[ -z "${MJ_CORE_VERSION:-}" ]]; then
    [[ -f "$MJ_CLI_PKG" ]] || {
        echo "cannot resolve the MJ CLI at $MJ_CLI_PKG -- run pnpm install, or set MJ_CORE_VERSION" >&2
        exit 1
    }
    # The path goes in as an ARGUMENT, not inside the JS string. Git Bash rewrites POSIX paths to
    # Windows ones for arguments to native programs but not for text inside a quoted script, so
    # `node -p "require('/c/v6/...')"` fails on Windows with MODULE_NOT_FOUND while this works.
    MJ_CORE_VERSION="v$(node -e 'console.log(require(process.argv[1]).version)' "$MJ_CLI_PKG")"
fi
MJ_VERSION="$MJ_CORE_VERSION"
MJ="node $ROOT/node_modules/@memberjunction/cli/bin/run.js"
SQLCMD="sqlcmd -S ${DB_HOST},${DB_PORT:-1433} -U ${DB_USERNAME} -P ${DB_PASSWORD} -C -N o"

say() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

# THE SIBLING APPS, IN DEPENDENCY ORDER. This order is not negotiable and it is the same one
# WORKSPACE-SETUP.md section 4 documents. Verified end to end 2026-08-25 against a genuinely empty
# database: core 45 migrations, common 12, tasks 4, accounting 2, orders 10, sales 4 -- all clean.
#
# ORDERS IS REQUIRED, and this script did not install it until now. Deal.OrderID became a REAL FK to
# __mj_BizAppsOrders.OrderHeader on 2026-08-19 (da0f69f), inline and unconditional in CREATE TABLE
# Deal, so the sales baseline stops applying without orders present. The header of this script had
# claimed the opposite as a design choice ("the sales baseline stands up with only common present")
# and that claim outlived the commit that falsified it by six days. Nobody noticed because nobody ran
# this script in between -- see KNOWN-ISSUES KI-24 for what that cost.
#
# EACH REPO MIGRATES ITSELF, with its own --schema. The previous version applied common by hand with
# sqlcmd plus a sed substitution, because running `mj migrate` from THIS repo rewrites the sibling's
# ${flyway:defaultSchema} to __mj_BizAppsSales. Invoking the sibling's own CLI from the sibling's own
# directory does not have that problem, so the substitution -- and the whole class of bug that
# KNOWN-ISSUES KI-2 records against the orders variant of this script -- simply goes away.
SIBLINGS=(
    "bizapps-common:__mj_BizAppsCommon"
    "bizapps-tasks:__mj_BizAppsTasks"
    "bizapps-accounting:__mj_BizAppsAccounting"
    "bizapps-orders:__mj_BizAppsOrders"
)

# FAIL BEFORE DROPPING ANYTHING, not halfway through. A missing sibling used to surface as a sed
# error after the database had already been recreated, leaving a half-built shell. .env's
# BIZAPPS_COMMON_REPO pointed at a directory that does not exist when this was written.
for entry in "${SIBLINGS[@]}"; do
    name="${entry%%:*}"
    var="BIZAPPS_$(printf '%s' "${name#bizapps-}" | tr '[:lower:]' '[:upper:]')_REPO"
    dir="${!var:-$ROOT/../$name}"
    [[ -d "$dir/migrations" ]] || { echo "missing sibling repo: $dir/migrations (set $var)" >&2; exit 1; }
    [[ -f "$dir/node_modules/@memberjunction/cli/bin/run.js" ]] || {
        echo "sibling has no CLI: $dir (run pnpm install there)" >&2; exit 1; }
done

say "1/7  Recreating ${DB_DATABASE}"
$SQLCMD -d master -Q "
    IF DB_ID('${DB_DATABASE}') IS NOT NULL
    BEGIN
        ALTER DATABASE [${DB_DATABASE}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${DB_DATABASE}];
    END
    CREATE DATABASE [${DB_DATABASE}];"

say "2/7  MJ core @ ${MJ_VERSION}"
$MJ migrate -t "${MJ_VERSION}"


# Declared and validated above, before the drop. Only the migrating happens here.
n=2
for entry in "${SIBLINGS[@]}"; do
    name="${entry%%:*}"; schema="${entry#*:}"; n=$((n+1))
    var="BIZAPPS_$(printf '%s' "${name#bizapps-}" | tr '[:lower:]' '[:upper:]')_REPO"
    dir="${!var:-$ROOT/../$name}"
    say "$n/7  $name -> $schema"
    ( cd "$dir" && DB_DATABASE="$DB_DATABASE" \
        node node_modules/@memberjunction/cli/bin/run.js migrate --schema "$schema" --dir ./migrations )
done

# bizapps-contracts is deliberately NOT here. It does not install on a fresh database (KI-13) and
# sales has no FK into it -- measured: sales' only cross-schema FKs are to __mj, __mj_BizAppsCommon
# and __mj_BizAppsOrders. If that changes, contracts goes LAST, after sales.

# TRIM THE GENERATED HALF BEFORE APPLYING. Once CodeGen output lives in the baseline, a rebuild
# produces a database whose entity metadata is ALREADY current — so the next CodeGen run has nothing
# to do and emits only a delta, which append-codegen.sh then refuses (rightly) as a partial. The
# cycle is only self-consistent if the rebuild applies the hand-authored DDL alone and CodeGen
# regenerates the rest from scratch. This is what makes "edit the baseline in place" safe.
say "7/7  bizapps-sales (hand-authored DDL only)"
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
