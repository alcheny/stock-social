#!/usr/bin/env bash
# Stop the review servers and delete the review-a/b/c worktrees made by scripts/review.sh.
set -uo pipefail
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PARENT=$(dirname "$ROOT")

for port in 3001 3002 3003; do lsof -ti tcp:$port | xargs kill 2>/dev/null; done
for v in a b c; do
  dir="$PARENT/review-$v"
  [ -d "$dir" ] && git -C "$ROOT" worktree remove --force "$dir" && echo "removed $dir"
done
git -C "$ROOT" worktree prune
git -C "$ROOT" worktree list
