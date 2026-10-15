#!/usr/bin/env bash
# Run variants A/B/C of an autopilot issue side by side: A → :3001, B → :3002, C → :3003.
# Usage: scripts/review.sh <issue-number>   e.g. scripts/review.sh 21. Ctrl+C stops all three.
set -euo pipefail
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
ISSUE=${1:-}; ISSUE=${ISSUE#\#}
if ! [[ "$ISSUE" =~ ^[0-9]+$ ]]; then
  echo "Usage: scripts/review.sh <issue-number>   e.g. scripts/review.sh 21"
  git -C "$ROOT" fetch -q --prune origin '+refs/heads/autopilot/*:refs/remotes/origin/autopilot/*'
  echo "Issues with versions to review:"
  git -C "$ROOT" branch -r --list 'origin/autopilot/issue-*' | sed -E 's@.*issue-([0-9]+)-([a-z]).*@  \1@' | sort -un
  exit 1
fi
PARENT=$(dirname "$ROOT")

git -C "$ROOT" fetch -q --prune origin '+refs/heads/autopilot/*:refs/remotes/origin/autopilot/*'
if ! git -C "$ROOT" rev-parse -q --verify "origin/autopilot/issue-$ISSUE-a" "origin/autopilot/issue-$ISSUE-b" "origin/autopilot/issue-$ISSUE-c" >/dev/null 2>&1 \
   && [ -z "$(git -C "$ROOT" branch -r --list "origin/autopilot/issue-$ISSUE-[abc]")" ]; then
  echo "Issue #$ISSUE has no versions to review. Issues that do:"
  git -C "$ROOT" branch -r --list 'origin/autopilot/issue-*' | sed -E 's@.*issue-([0-9]+)-([a-z]).*@  #\1 (\2)@' | sort -u
  exit 1
fi

pids=()
trap 'kill ${pids[@]+"${pids[@]}"} 2>/dev/null; wait' EXIT INT TERM

port=3001
for v in a b c; do
  dir="$PARENT/review-$v"
  ref="origin/autopilot/issue-$ISSUE-$v"
  if ! git -C "$ROOT" rev-parse -q --verify "$ref" >/dev/null; then echo "Version $(echo $v | tr a-z A-Z): none on GitHub, skipped"; port=$((port + 1)); continue; fi
  if [ -d "$dir" ]; then git -C "$dir" checkout -q --detach "$ref"   # refresh to the latest commit
  else git -C "$ROOT" worktree add -q "$dir" "$ref"; fi
  cp "$ROOT/.env" "$dir/"
  (cd "$dir" && npm ci --silent && npx next dev -p "$port" 2>&1 | sed "s/^/[$v:$port] /") &
  pids+=($!)
  echo "Version $(echo $v | tr a-z A-Z) → http://localhost:$port/u/momentum_maya"
  port=$((port + 1))
done
wait
