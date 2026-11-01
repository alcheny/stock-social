# Ideas: review process and register

Every non-technical idea (product direction, pricing, legal and policy positions, privacy choices, growth,
vendors, claims in copy, how the team works) goes to the **idea board** before it becomes a decision. The board's
members, lenses and rounds are in [`team/idea-board.md`](../team/idea-board.md). Code changes go through the
committee cycle (`docs/IMPLEMENTATION.md`); an idea that becomes a feature then goes to a design session.

## How an idea gets reviewed

1. Anyone (the owner, a design session, a committee, an agent) adds it to the register below with status
   `proposed`, one line on what it is and who raised it.
2. Claude runs the board (a multi-agent workflow: independent reviews, debate, fact-check, chair's
   recommendation) and files the result in `docs/ideas/<date>-<topic>.md`.
3. The owner decides, or, where the owner has delegated, the board's recommended option is recorded as the
   decision. Status becomes `adopted`, `adopted with conditions`, `testing` or `rejected`.

## Register

| # | Idea | Raised by | Status | Review |
|---|---|---|---|---|
