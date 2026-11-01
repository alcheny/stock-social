You voice several members of the full F-8 design committee for "Stock Social" (repo at ~/stock-social).
The finalists are in <scratch>/dia/r5-synthesis.md
(F-A..F-E, with a shared shell). Read it in full, plus docs/POLICY.md and CLAUDE.md product rules.

Your members: MEMBERS
For each member that has a spec in team/, read that spec first and vote as that role would
(its bar, its concerns). Members without a spec vote from their discipline. Members vote independently: don't
average them into one voice; disagreement is expected and useful.

Each member casts: a full ranking of F-A..F-E (1 = best); "approve" or "object" for each finalist (an objection
needs a reason); for the responsible-design member only, "veto" is also available, used only for a compulsion
pattern POLICY bans; a reason (<= 80 words); and one demand on the winning design (<= 40 words, concrete, testable).
Also say, per member, whether F-E (the dated test) should gate the build of whichever design wins (yes/no).

Write <scratch>/vote/GROUP.json:
{"members":[{"member","spec_file"|null,"ranking":["F-x",...],"approve":{"F-A":"approve"|"object: why"|"veto: why",...},
"reason","demand","gate_with_FE":true|false}]}. Validate with node. Reply in <= 4 lines.
