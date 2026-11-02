# F-29 · Independent code review

Branch `claude/f29-gated-options-wording`, `git diff origin/main...HEAD` at 07b34976 (the product commit; the docs-only
commits were read for context). Reviewer standard: `team/reviewer.md`. Read only. Checks run: `npm test` (2385 tests:
1808 pass, 0 fail, 575 skipped for no DATABASE_URL), `npx tsc --noEmit` (clean), `node --test lib/f29-gated-wording.test.ts`
(green). E2e was not run (no server). Every finding below was reproduced against the code.

**Verdict: changes requested (1 blocking finding, latent until the gate opens; the fix is one line).**

## Findings

### B1 · Blocking · the card shows open-gate text once the gate opens (`lib/options-view.ts:67`)
`cardOptionsLine` keeps any `v.line` that does not start with "Options:". With the gate open and no long option close
to summarize, `optionDisplayText` (`lib/options-view.ts:55-62`, fix round 4 N7) returns the short, technical or
open-other lines instead of an options line, and they pass the filter. Reproduced:
`paneView({ gate: 'open', counts: { short: 3, openShort: 1, ... }, summary: null })` gives `{ open: true, line: 'Short
options not shown: 3 closed, 1 open. ...' }`, and `cardOptionsLine` returns that line. So the feed card prints an
open-gate line under its strip. That contradicts plan D6 and round 3 engineer demand 1 ("once the gate opens, the card
has no count line"), and the helper's own doc comment. The AC 2 unit test (`lib/f29-gated-wording.test.ts:123-131`)
checks only the open case that has a summary, so it misses this.
It cannot happen today (`optionsPublic()` is false, so every view is `gate: 'closed'`). It appears on the first deploy
that opens the gate, which is exactly the flip F-29 exists to make safe.
**Fix:** key on the view's gate flag instead of the text: `v && !v.open && v.line ? v.line : undefined`. `open` is
`gate === 'open' && hasOptions`, and the line is null when there are no options. Add the summary-null open case
(short-only, and technical-only) to the AC 2 unit test.

### N1 · Non-blocking · the share preview image URL is not gate-keyed (`app/u/[handle]/share-prompt.tsx:39`)
`<img className="preview" src={`/u/${handle}/opengraph-image`}>` uses the bare URL, while the profile's og:image of
the same body is now `?g=o0`. The share body is the same in both gate states (plan B3), so nothing wrong is served
today. But the AC 6 source test is titled "every URL-keyed public cache reference goes through withGate", and that
claim is not true. If a later change makes the card gate-dependent, this cache survives the flip.
**Fix:** `src={withGate(`/u/${handle}/opengraph-image`)}`, and add the line to the AC 6 source scan. Or narrow the
test title to the URLs it checks.

### N2 · Non-blocking · the open-gate card has a qualifier but no count line (`app/ui.tsx:111`, `lib/options-view.ts:67`)
Decision (b) reads "exactly one options qualifier and one count line while a qualifier is on screen". With the gate
open, the strip still prints "Excluding options" (`label` is true when there are closes), but the card has no count
line, by design (plan D6, round 3). This is a deliberate deviation from the literal wording, and the PR should list it
for the business lead next to the AC 9 share-part note. The reverse case already exists in the pane: gate closed with
open options only (`closes = 0`) shows a count line and no qualifier.
**Fix:** none in code. Name it in the PR's open items.

### N3 · Non-blocking · AC 9's "profile body" is checked through the pane (`e2e/f29-render.ts:57-62`, `e2e/f29-gated-wording.spec.ts:112-125`)
The one-process flip test renders `ProfilePane` in both states. It does not render the profile page's
options block (`OptionsLines`/`OptionTradesSection` in `app/u/[handle]/page.tsx`). The plan accepted this proxy, but
the AC says "profile". **Fix:** say so in the PR, or render `OptionsLines` for both views in `f29-render.ts`.

### N4 · Non-blocking · the feature file's ACs are all unticked (`docs/features/F-29-gated-options-wording.md:73-84`)
The Build log says the stops pass, yet no AC is ticked, including those with a passing test (1, 5, 7, 8). **Fix:** tick
the ACs that are met. Leave AC 9 unticked, as the log says.

## Checked, no finding
- **Gate-key logic** (`lib/gate-key.ts`). `gateKey` and `optionsPublic` share one column check, and a unit test asserts
  they agree for both field sets. `gateCacheControl` returns cacheable only for an exact key match. A missing, stale or
  garbage `g` gets 200 with `no-store`, never a 404, so pages opened before a flip keep working. The CDN window for
  pre-flip pages is stated as a `ponytail:`.
- **Header precedence.** In both routes `isFilerHandle(handle) ? 'no-store' : gateCacheControl(...)` comes after every 404.
  The pane's 404s keep `no-store`. The story 404 has no header, as before F-29. The F-23 prefix pin
  (`pane-model.test.ts:70-71`) still holds.
- **URL building.** `withGate` adds `&` when a query exists (pane `?v=2`, story `?format=square`) and `?` otherwise
  (three og URLs). `lib/share.ts:28` `/\/story(\?|$)/` still classifies the keyed story URL. There are no fragments
  at the call sites.
- **og:image override.** File-based `opengraph-image` replaces config images only when the page's `openGraph` has no
  `images` key (`node_modules/next/dist/lib/metadata/metadata-resolution-primitives.js:114`). All three pages set
  `images`, so the keyed URL is the one emitted. No `twitter-image` files exist.
- **Client bundles.** `lazy-pane.tsx`, `share-card.tsx` and `share-prompt.tsx` import only `lib/gate-key.ts`, which
  imports only `privacy-fields.ts`, which has no imports. `node:crypto` stays server side, and a unit test guards it.
- **Pane order.** Stats, then OpenGrid, then CombinedLine, then the qualifier, then PaneOptions. Nothing sits between
  the grids, so the `.stats + .open-stats` adjacency rules still match. The new CSS rule (specificity 0,3,0) overrides
  `.pane .share-label`. The F-21/F-34 slot is marked with a ponytail.
- **Card count line.** It renders only with a strip, under it, with its own class. No `.pane` or `.options-gated` rule
  reaches it. The gate-closed text is `OPTIONS.gated` (no new copy).
- **POLICY.** `F29.howInterim` matches the signed words byte for byte (unit literal, plus a sign-off file check), and
  `OPTIONS.how` is unchanged. No advice words, third-party names or new colours (`.muted` tokens only). No
  "not asked" or "declined" in any copy.
- **Tests.** No existing test was edited or removed (the diff adds 3 test files only). No existing test asserted the
  pane or story `public` headers on URLs without `g`.
- **Protected files.** None touched.
- **Privacy.** No new public field. The card shows the count text the pane already serves.
- **A11y.** The pane qualifier follows the figures in DOM and reading order (ariaSnapshot test). The profile is unchanged
  (the qualifier comes before the stats). No `aria-describedby` is used, because pane ids repeat. Muted and small, no
  warning tone, and the test checks this.
- **Additive edits** to shared files: `lib/copy.ts` (a block at the end plus one token in `allCopy`) and
  `app/globals.css` (a block at the end).
