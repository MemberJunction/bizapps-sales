#!/bin/bash
# Validates that all @mj-biz-apps packages exist on npm before publishing

echo "Checking for new packages that need npm placeholders..."

MISSING=()
CHECKED=0
MAX_RETRIES=3
RETRY_DELAY=2

# `timeout` is GNU coreutils and is NOT on a stock macOS. Without this the command substitution
# fails for EVERY package, each one is reported absent, and the script tells a developer running it
# locally that all five of their published packages need placeholders. CI (ubuntu-latest) has it,
# which is exactly why the failure only ever appears on the machine where nobody trusts it.
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT=(timeout 10)
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT=(gtimeout 10)
else
  TIMEOUT=()
fi

for pkg_json in $(find packages -name "package.json" -maxdepth 2 -not -path "*/node_modules/*"); do
  name=$(jq -r '.name // ""' "$pkg_json")

  # Only check @mj-biz-apps scoped packages
  if [[ "$name" != @mj-biz-apps/* ]]; then
    continue
  fi

  # `private: true` packages are never published, so they have no npm presence to validate and
  # requiring one would fail every release. This repo has one -- @mj-biz-apps/sales-integration-tests,
  # dispatched by `mj test` from the workspace and deliberately not on the registry. MJ's own
  # NEW_PACKAGE_SETUP.md states the same rule for @memberjunction/*; the copy of this script that
  # came from bizapps-forms did not need it, because that repo has no private package.
  if [ "$(jq -r '.private // false' "$pkg_json")" = "true" ]; then
    echo "  skipping $name (private: true -- changesets never publishes it)"
    continue
  fi

  CHECKED=$((CHECKED + 1))

  # Check if package exists on npm with retry logic
  EXISTS=false
  for attempt in $(seq 1 $MAX_RETRIES); do
    if output=$("${TIMEOUT[@]}" npm view "$name" version 2>&1); then
      EXISTS=true
      break
    fi

    # A 404 is a definitive answer — the package really is absent, so stop retrying. Anything
    # else (timeout, DNS, registry 5xx) is transient and worth another attempt. `npm view` exits
    # 1 for both, so the exit code cannot tell them apart and the message has to.
    #
    # This used to read the exit code from `$?` *after* the `if`, where bash reports the status
    # of the `if` compound command itself — defined as 0 when the condition was false and there
    # is no else branch. It was therefore never 1, the fast path never fired, and a genuinely
    # missing package burned every retry and both sleeps before being reported.
    if echo "$output" | grep -q 'E404'; then
      break
    fi

    if [ "$attempt" -lt "$MAX_RETRIES" ]; then
      sleep $RETRY_DELAY
    fi
  done

  if [ "$EXISTS" = false ]; then
    MISSING+=("$name")
  fi

  # Progress indicator
  if [ $((CHECKED % 10)) -eq 0 ]; then
    echo "  Checked $CHECKED @mj-biz-apps packages..."
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "::error::Found ${#MISSING[@]} package(s) without npm placeholders:"
  for pkg in "${MISSING[@]}"; do
    echo "  - $pkg"
  done
  echo ""
  echo "For each missing package, publish a 0.0.0 placeholder manually before"
  echo "the automated workflow can take over."
  exit 1
fi

echo "All $CHECKED @mj-biz-apps packages exist on npm"
