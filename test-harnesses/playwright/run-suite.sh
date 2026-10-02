#!/usr/bin/env bash
#
# Run the Explorer suite in TWO PHASES: the parallel-safe majority at several workers, then the few
# specs that cannot share a host, one at a time.
#
# WHY, measured rather than assumed. The same suite takes 34 minutes at one worker and 9m37s at four
# -- but at four, three specs that pass alone start failing:
#
#     20-demo-tour, 71-lost-and-reopen, 78-line-removal-tripwire
#
# Nothing improved in the other direction, which is what distinguishes contention from noise. All
# three work against SEEDED demo rows rather than rows they create under their own run prefix
# (`PW-LIFE-<base36>`), so a concurrent spec mutating the same seed is enough to break them. For
# 20-demo-tour that is not even a defect: walking the seeded demo data is the point of the spec.
#
# So the speedup is taken where it is safe and declined where it is not. Roughly 10 + 3 minutes
# against 34, with no invented failures.
#
# The split is a LIST, not a rule, and it is only as good as its last measurement. Re-run the whole
# suite at PW_WORKERS=4 occasionally and compare against a one-worker run: a spec that fails only in
# the parallel phase belongs in SERIAL_SPECS, and one that has been fixed to own its data can leave.
#
#   usage:  bash run-suite.sh [workers]        (default 4)
#
set -u

WORKERS="${1:-4}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
CONFIG="test-harnesses/playwright/playwright.config.ts"

# Specs that cannot run alongside others. Keep the reason next to the name.
SERIAL_SPECS=(
  "specs/20-demo-tour.spec.ts"            # walks the seeded demo deals by design
  "specs/71-lost-and-reopen.spec.ts"      # voids/reopens an order another spec may be reading
  "specs/78-line-removal-tripwire.spec.ts" # removes a line from a shared order
)

cd "$REPO" || exit 1

# Playwright has no --testIgnore on the CLI, so phase A is expressed as an explicit file list:
# everything under specs/ that is not in SERIAL_SPECS.
PARALLEL_FILES=()
while IFS= read -r f; do
  rel="specs/$(basename "$f")"
  skip=0
  for s in "${SERIAL_SPECS[@]}"; do [ "$rel" = "$s" ] && skip=1; done
  [ "$skip" -eq 0 ] && PARALLEL_FILES+=("test-harnesses/playwright/$rel")
done < <(ls "$HERE"/specs/*.spec.ts | grep -v '99-diagnose' | sort)

echo "=============================================================="
echo " PHASE A — ${#PARALLEL_FILES[@]} spec(s) at ${WORKERS} workers"
echo "=============================================================="
start_a=$(date +%s)
PW_HEADLESS=1 PW_WORKERS="$WORKERS" npx playwright test --config "$CONFIG" --project=crud --no-deps "${PARALLEL_FILES[@]}"
code_a=$?
end_a=$(date +%s)

echo
echo "=============================================================="
echo " PHASE B — ${#SERIAL_SPECS[@]} spec(s) at 1 worker (cannot share a host)"
echo "=============================================================="
SERIAL_FILES=()
for s in "${SERIAL_SPECS[@]}"; do SERIAL_FILES+=("test-harnesses/playwright/$s"); done
start_b=$(date +%s)
PW_HEADLESS=1 PW_WORKERS=1 npx playwright test --config "$CONFIG" --project=crud --no-deps "${SERIAL_FILES[@]}"
code_b=$?
end_b=$(date +%s)

echo
echo "=============================================================="
printf ' phase A: %dm %02ds  (exit %d)\n' $(( (end_a-start_a)/60 )) $(( (end_a-start_a)%60 )) "$code_a"
printf ' phase B: %dm %02ds  (exit %d)\n' $(( (end_b-start_b)/60 )) $(( (end_b-start_b)%60 )) "$code_b"
printf ' TOTAL  : %dm %02ds\n' $(( (end_b-start_a)/60 )) $(( (end_b-start_a)%60 ))
echo "=============================================================="

# Either phase failing fails the run; a green phase A means nothing on its own.
[ "$code_a" -eq 0 ] && [ "$code_b" -eq 0 ]
