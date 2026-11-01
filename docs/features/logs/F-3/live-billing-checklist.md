# F-3 · Before live billing: the owner's checklist

Live billing stays off (`LIVE_BILLING` unset; a live key is refused without it). The owner switches it on only when every
item below is done. Sources: the F-3 decision of 2026-11-01 and the legal committee's conditions 21, 23 and 24
(`committee-2026-11-01.md`).

- [ ] Terms are live with billing, automatic renewal and refund sections stating exactly the Subscribe screen's lines
      (price, interval, "plus applicable sales tax", no free trial, cancel path, cancellation at period end, the refund
      line). A later change applies only to purchases made after it.
- [ ] The Privacy Policy covers billing (the processor as record holder for charges, refunds and tax; the app's
      ids-only rows; the consent record kept 3 years without name or email), saved views and private notes (owner-only,
      exported, deleted with the account, deleted when the noted trader deletes theirs) and states that a trader's
      export never includes other users' notes. POLICY P6.
- [ ] The connect consent (F-1's screen) carries: "Your record may also appear in other viewers' private comparison
      tools; they cannot change it, and you are not told who views it." (condition 24).
- [ ] Each processor email is checked against the required lines and the result recorded here:
  - [ ] receipt and acknowledgment: plan, amount charged including tax, renewal date, price plus tax, interval, how to
        cancel and when cancellation takes effect, the refund line, the billing contact (a role address);
  - [ ] failed payment, with the grace end (7 days);
  - [ ] yearly plans: a reminder 30 days before renewal with price, date and a cancel link;
  - [ ] cancellation confirmation, with the end date;
  - [ ] price change, at least 30 days ahead, with a cancel link.
  None may carry a handle, symbol, return or record field (POLICY F3b).
- [ ] Processor settings: automatic tax on; the hosted checkout shows the total with tax before payment; the portal
      cancels at period end, switches plans with proration shown, and offers at most one retention offer naming price
      and plan only.
- [ ] Live secrets created by the owner in the deploy platform only (never in the repository or CI logs).
- [ ] The data vendor's answer on market data, if Record tools ever adds open-position values (it shows none today;
      adding them returns to the legal committee first).
