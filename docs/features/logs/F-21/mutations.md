# F-21 guard mutation check (committee decision 6, AC "the guard is mutation-checked")

Each mutation below was applied to the real source file, `node --test --test-name-pattern="none unclassified today"
lib/f21-exclusions.test.ts` was run, and the file was restored (`git checkout`). The same four mutations, plus a new
filing-reason literal and a new rebuild writer, also run permanently inside the test itself ("F-21 guard, mutation
check"), against in-memory copies of the sources. Recorded 2026-11-02 on branch claude/f21-exclusion-counts.

### 1. MatchResult gains excludedX (lib/trades.ts)
```
not ok 1 - F-21 guard: every exclusion counter in the sources is summed or named as left out (none unclassified today)
    + actual - expected
    + [
    +   'MatchResult.excludedX'
    + ]
    - []
  expected:
  actual:
    0: 'MatchResult.excludedX'
# pass 0
# fail 1
```
### 2. The options result gains excludedX (lib/options.ts#matchOptions)
```
not ok 1 - F-21 guard: every exclusion counter in the sources is summed or named as left out (none unclassified today)
    + actual - expected
    + [
    +   'options.excludedX'
    + ]
    - []
  expected:
  actual:
    0: 'options.excludedX'
# pass 0
# fail 1
```
### 3. The public-filing result gains excludedX (lib/public-trades.ts#matchPublic)
```
not ok 1 - F-21 guard: every exclusion counter in the sources is summed or named as left out (none unclassified today)
    + actual - expected
    + [
    +   'public.excludedX'
    + ]
    - []
  expected:
  actual:
    0: 'public.excludedX'
# pass 0
# fail 1
```
### 4. The schema gains users.excluded_x (db/schema.sql)
```
not ok 1 - F-21 guard: every exclusion counter in the sources is summed or named as left out (none unclassified today)
    + actual - expected
    + [
    +   'schema.users.excluded_x'
    + ]
    - []
  expected:
  actual:
# pass 0
# fail 1
```
