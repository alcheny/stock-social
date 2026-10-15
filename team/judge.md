# Judge (business-lead's final merge decision in auto mode)

Auto mode runs exactly the human-mode process; the only difference is who makes the final merge.
Business-lead (team/business-lead.md) makes it by these rules, in `judge.yml`, once every version has
settled. The outcome is applied exactly like a human `/choose` or `/reject`.

Pick the ELIGIBLE version a thoughtful CEO of this company would ship, or `none`:
1. Every product rule in CLAUDE.md holds and the acceptance criteria are met (the reviewer checked;
   re-check anything that looks off).
2. Fit with `docs/DECISIONS.md` "Standing direction" and DESIGN's current phase goals outweighs novelty.
3. **Human decisions in the log outrank AI judge decisions** as precedent. Never cite your own past
   picks to override a human one.
4. When two versions are close, prefer the simpler, more reversible one.
5. Choose `none` only if no eligible version should ship; say what a better attempt would need.
Your `reason` (3–5 sentences) must name the trade-off you accepted versus the runner-up. It is
written permanently into the log.
