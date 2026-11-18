#!/usr/bin/env bash
# Collects one line of evidence per project for the receipts under each card:
# the default branch's CI result (and when it was last green), how many tests
# its source defines, when it was last committed to, and its licence. The list
# of projects is read from the page itself, so a new card is picked up as soon
# as it has a receipt slot. Writes JSON to stdout.
#
# Needs: gh (authenticated), jq, git. Usage: USER=owner collect-proof.sh index.html
set -euo pipefail
page="${1:-index.html}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

repos=$(grep -o '<p class="receipt" data-repo="[^"]*"' "$page" | sed 's/.*data-repo="\([^"]*\)"/\1/' | sort -u)
echo '{' ; first=1
for r in $repos; do
  meta=$(gh api "repos/$USER/$r" --jq '{branch: .default_branch, licence: (.license.spdx_id // "")}' 2>/dev/null || echo '')
  if [ -z "$meta" ]; then echo "skipping $r: not readable" >&2; continue; fi
  branch=$(jq -r .branch <<<"$meta")
  licence=$(jq -r .licence <<<"$meta"); [ "$licence" = "NOASSERTION" ] && licence=""
  last_commit=$(gh api "repos/$USER/$r/commits?sha=$branch&per_page=1" --jq '.[0].commit.committer.date')

  # The newest completed run on the default branch decides passing or failing;
  # if it failed, the newest success says when it was last green.
  runs=$(gh api "repos/$USER/$r/actions/runs?branch=$branch&status=completed&per_page=50" \
           --jq '[.workflow_runs[] | {c: .conclusion, d: .updated_at}]' 2>/dev/null || echo '[]')
  ci=$(jq -r 'if length == 0 then "none" elif .[0].c == "success" then "passing" else "failing" end' <<<"$runs")
  last_green=$(jq -r '[.[] | select(.c == "success")][0].d // ""' <<<"$runs")

  # Tests are counted in the source at the last commit, not taken from a badge:
  # Python test functions, and Kotlin or Java methods marked @Test.
  tests=""
  if git clone -q --depth 1 --branch "$branch" "https://github.com/$USER/$r" "$work/$r" 2>/dev/null; then
    py=$( (grep -rhoE --include='test_*.py' --include='*_test.py' '^\s*(async\s+)?def test_' "$work/$r" || true) | wc -l)
    jv=$( (grep -rhoE --include='*.kt' --include='*.java' '@Test\b' "$work/$r" || true) | wc -l)
    n=$((py + jv)); [ "$n" -gt 0 ] && tests="$n"
  fi

  [ $first -eq 1 ] || echo ','; first=0
  jq -n --arg r "$r" --arg ci "$ci" --arg lg "$last_green" --arg t "$tests" --arg lc "$last_commit" --arg li "$licence" \
    '{($r): {ci: $ci, lastGreen: $lg, tests: $t, lastCommit: $lc, licence: $li}}' | sed '1d;$d'
done
echo '}'
