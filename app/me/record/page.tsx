import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { habits, insights, MIN_TRADES, sinceLast, visitDecision } from '@/lib/insights.ts';
import { pct } from '@/lib/trades.ts';
import { REASONS, REASON_LABEL, reflectionInsights, type Reason } from '@/lib/reflections.ts';
import { RULE_KINDS, RULE_LABEL, ruleAdherence, ruleOutcomes, rulesByReason, ruleTrend, signedPct, tradesLabel, type RuleKind } from '@/lib/rules.ts';
import { setReflection, setRule } from '@/app/actions.ts';
import { Badge } from '../../ui.tsx';

export const metadata: Metadata = { title: 'My record · Stock Social', robots: { index: false, follow: false } };

const FEW = 'too few trades to say';
const sign = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');

export default async function MyRecord() {
  const me = await currentUser();
  if (!me) redirect('/login');

  const rows = await sql`select sell_id, symbol, return_pct, holding_days, closed_at, verified from closed_trades where user_id = ${me.id}`;
  const [v] = await sql`select record_first_viewed_at as first, record_last_viewed_at as last, record_prev_viewed_at as prev from users where id = ${me.id}`;
  const { roll, baseline } = visitDecision(new Date(), v.last as Date | null, v.prev as Date | null, v.first as Date | null);
  // The guard on record_last_viewed_at stops two simultaneous tabs from counting one visit twice.
  if (roll) await sql`update users set record_prev_viewed_at = ${baseline}, record_last_viewed_at = now(), record_view_count = record_view_count + 1 where id = ${me.id} and record_last_viewed_at is not distinct from ${v.last as Date | null}`;
  // No-op after the first open: the guard keeps the original timestamp.
  await sql`update users set record_first_viewed_at = now() where id = ${me.id} and record_first_viewed_at is null`;

  // Tags for sell_ids with no current trade are kept in the DB on purpose and simply never matched here.
  const tags = await sql`select sell_id, reason from trade_reflections where user_id = ${me.id}`;
  const reasonOf = new Map(tags.map((t) => [t.sell_id as string, t.reason as Reason]));
  const trades = rows.map((t) => ({ sellId: t.sell_id as string, symbol: t.symbol as string, returnPct: t.return_pct as number, holdingDays: t.holding_days as number, closedAt: t.closed_at as Date }));
  const ruleRows = await sql`select kind, days from trade_rules where user_id = ${me.id}`;
  const rules = ruleRows.map((x) => ({ kind: x.kind as RuleKind, days: x.days as number }));
  const adherence = ruleAdherence(trades, rules);
  const outcomes = ruleOutcomes(trades, rules);
  const trends = ruleTrend(trades, rules);
  const byReason = rulesByReason(trades, rules, reasonOf);
  const r = insights(trades);
  const groups = reflectionInsights(trades, reasonOf);
  const recent = [...trades].sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
  const row = (t: (typeof trades)[number]) => {
    const when = t.closedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const cur = reasonOf.get(t.sellId);
    return (
      <li key={t.sellId}>
        <form action={setReflection} aria-label={`Why I took it: ${t.symbol}, closed ${when}`}>
          <input type="hidden" name="sellId" value={t.sellId} />
          <div className="rec-since"><b>{t.symbol}</b><span className={sign(t.returnPct)}>{pct(t.returnPct)}</span><span className="muted small">{when}</span></div>
          <div className="rec-chips">
            {REASONS.map((x) => (
              <button key={x} type="submit" name="reason" value={cur === x ? '' : x} aria-pressed={cur === x} className={cur === x ? 'on' : ''}>
                {REASON_LABEL[x]}{cur === x && <span className="sr-only"> Selected, tap to clear</span>}
              </button>
            ))}
          </div>
        </form>
      </li>
    );
  };
  const since = sinceLast(trades, baseline);
  const hb = habits(trades);
  const day = baseline?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const demo = rows.length > 0 && !rows.every((t) => t.verified);

  return (
    <main className="page rec">
      <h1 style={{ marginBottom: 4 }}>My record {demo && <Badge verified={false} />}</h1>
      <p className="muted" style={{ marginTop: 0 }}>Only you can see this page. It&apos;s a description of your closed trades, not advice.</p>
      <p><Link href={`/u/${me.handle}`}>← Back to my profile</Link></p>

      {r.total === 0 ? (
        <div className="rec-card">
          <p style={{ margin: 0 }}>No closed trades yet. Once a trade you&apos;ve connected closes, your habits appear here.</p>
          <p style={{ margin: '8px 0 0' }}>{me.snaptrade_user_id ? 'Your next sync will pick them up.' : <Link href="/connect">Connect your broker (read-only)</Link>}</p>
        </div>
      ) : <>
        {r.total < MIN_TRADES && <p className="muted">You have {r.total} closed trade{r.total === 1 ? '' : 's'}. Figures need at least {MIN_TRADES} trades behind them.</p>}

        {baseline && (
          <section aria-label="Since your last visit">
            <h2>Since your last visit</h2>
            {since.fresh.length === 0 ? <p className="muted">Nothing new since {day}.</p> : <>
              <p className="muted small" style={{ marginBottom: 0 }}>Closed since {day}</p>
              <ul className="rec-since">
                {since.fresh.slice(0, 10).map((t, i) => (
                  <li key={i}><b>{t.symbol}</b><span className={sign(t.returnPct)}>{pct(t.returnPct)}</span></li>
                ))}
              </ul>
              {since.fresh.length > 10 && <p className="muted small">+{since.fresh.length - 10} more</p>}
              {since.takeaway ? <p>{since.takeaway}</p> : <p className="muted">{FEW}</p>}
            </>}
          </section>
        )}

        <h2>How long you hold</h2>
        <div className="rec-grid rec-buckets">
          {r.buckets.map((b) => (
            <section key={b.key} className="rec-card" aria-label={b.label}>
              <h3>{b.label}</h3>
              <p className="muted small">{b.n} trade{b.n === 1 ? '' : 's'}</p>
              {b.enough ? <>
                <dl className="rec-dl">
                  <div><dt>Win rate</dt><dd>{Math.round(b.winRate! * 100)}%</dd></div>
                  <div><dt>Avg return</dt><dd className={sign(b.avgReturn!)}>{pct(b.avgReturn!)}</dd></div>
                </dl>
                <p className="small">{b.takeaway}</p>
              </> : <p className="muted">{FEW}</p>}
            </section>
          ))}
        </div>

        <h2>Symbols</h2>
        {r.symbols.enough ? <>
          <dl className="rec-dl rec-card">
            <div><dt>Best</dt><dd>{r.symbols.best!.symbol} <span className={sign(r.symbols.best!.avgReturn)}>{pct(r.symbols.best!.avgReturn)}</span> <span className="muted small">{r.symbols.best!.n} trades</span></dd></div>
            {r.symbols.worst && <div><dt>Worst</dt><dd>{r.symbols.worst.symbol} <span className={sign(r.symbols.worst.avgReturn)}>{pct(r.symbols.worst.avgReturn)}</span> <span className="muted small">{r.symbols.worst.n} trades</span></dd></div>}
          </dl>
          <p>{r.symbols.takeaway}</p>
        </> : <p className="muted">{FEW}</p>}

        <h2>Wins versus losses</h2>
        <div className="rec-grid">
          <div className="rec-card">
            <dl className="rec-dl"><div><dt>Average win</dt><dd className={r.winLoss.avgWin === null ? 'muted' : 'up'}>{r.winLoss.avgWin === null ? FEW : pct(r.winLoss.avgWin)}</dd></div></dl>
            <p className="muted small">from {r.winLoss.wins} win{r.winLoss.wins === 1 ? '' : 's'}</p>
          </div>
          <div className="rec-card">
            <dl className="rec-dl"><div><dt>Average loss</dt><dd className={r.winLoss.avgLoss === null ? 'muted' : 'down'}>{r.winLoss.avgLoss === null ? FEW : pct(r.winLoss.avgLoss)}</dd></div></dl>
            <p className="muted small">from {r.winLoss.losses} loss{r.winLoss.losses === 1 ? '' : 'es'}</p>
          </div>
        </div>
        {r.winLoss.takeaway && <p>{r.winLoss.takeaway}</p>}

        <h2>Longest losing streak</h2>
        {r.streak.enough ? <>
          <p className="rec-big">{r.streak.longestLosing} in a row</p>
          <p>{r.streak.takeaway}</p>
        </> : <p className="muted">{FEW}</p>}

        <h2>Habits</h2>
        <h3>Holding winners and losers</h3>
        <div className="rec-grid">
          {([['Winning trades', hb.hold.winners], ['Losing trades', hb.hold.losers]] as const).map(([label, s]) => (
            <section key={label} className="rec-card" aria-label={label}>
              <h4 style={{ margin: 0 }}>{label}</h4>
              <dl className="rec-dl"><div><dt>Avg held</dt><dd className={s.enough ? '' : 'muted'}>{s.enough ? `${s.avgDays!.toFixed(1)} days` : FEW}</dd></div></dl>
              <p className="muted small">from {s.n} trade{s.n === 1 ? '' : 's'}</p>
            </section>
          ))}
        </div>
        {hb.hold.takeaway && <p>{hb.hold.takeaway}</p>}

        <h3>After a win, after a loss</h3>
        <div className="rec-grid">
          {([['After a win', hb.after.win], ['After a loss', hb.after.loss]] as const).map(([label, s]) => (
            <section key={label} className="rec-card" aria-label={label}>
              <h4 style={{ margin: 0 }}>{label}</h4>
              <p className="muted small">{s.n} trade{s.n === 1 ? '' : 's'}</p>
              {s.enough ? (
                <dl className="rec-dl">
                  <div><dt>Win rate</dt><dd>{Math.round(s.winRate! * 100)}%</dd></div>
                  <div><dt>Avg return</dt><dd className={sign(s.avgReturn!)}>{pct(s.avgReturn!)}</dd></div>
                </dl>
              ) : <p className="muted">{FEW}</p>}
            </section>
          ))}
        </div>
        {hb.after.takeaway && <p>{hb.after.takeaway}</p>}
        <p className="muted small">Trades that close close together can be one position being sold in pieces.</p>

        <h2>Your reasons</h2>
        <h3>Why I took it</h3>
        <ul className="rec-tag-list">{recent.slice(0, 20).map(row)}</ul>
        {recent.length > 20 && <details><summary>Show all</summary><ul className="rec-tag-list">{recent.slice(20).map(row)}</ul></details>}
        <p className="muted">Only trades you&apos;ve tagged are counted. This describes your trades, it isn&apos;t advice.</p>
        {groups.length === 0 ? <p className="muted">Tag a trade above and a comparison appears here.</p> : (
          <div className="rec-grid">
            {groups.map((g) => (
              <section key={g.reason} className="rec-card" aria-label={REASON_LABEL[g.reason]}>
                <h4 style={{ margin: 0 }}>{REASON_LABEL[g.reason]}</h4>
                <p className="muted small">{g.n} trade{g.n === 1 ? '' : 's'}</p>
                {g.enough ? <>
                  <dl className="rec-dl">
                    <div><dt>Win rate</dt><dd>{Math.round(g.winRate! * 100)}%</dd></div>
                    <div><dt>Avg return</dt><dd className={sign(g.avgReturn!)}>{pct(g.avgReturn!)}</dd></div>
                  </dl>
                  {g.takeaway && <p className="small">{g.takeaway}</p>}
                </> : <p className="muted">{FEW}</p>}
              </section>
            ))}
          </div>
        )}
      </>}

      <h2>Your rules</h2>
      <p className="muted">Pick up to two rules for yourself. This page only counts how your closed trades measured up. It is private. A hold of exactly N days counts as following the rule.</p>
      <div className="rec-grid">
        {RULE_KINDS.map((kind) => {
          const rule = rules.find((x) => x.kind === kind);
          const a = adherence.find((x) => x.kind === kind);
          const o = outcomes.find((x) => x.kind === kind);
          const tr = trends.find((x) => x.kind === kind);
          const br = byReason.find((x) => x.kind === kind);
          const label = rule ? RULE_LABEL[kind].replace('N', String(rule.days)) : RULE_LABEL[kind];
          return (
            <section key={kind} className="rec-card" aria-label={RULE_LABEL[kind]}>
              <h3>{label}</h3>
              {rule && a && (a.enough ? <>
                <p className="rec-big">{Math.round(a.share! * 100)}%</p>
                <p className="muted small">{a.followed} of {a.applicable}</p>
                <p className="small">{a.takeaway}</p>
              </> : <>
                <p className="muted">{FEW}</p>
                <p className="muted small">{a.applicable} applicable so far</p>
              </>)}
              {rule && a?.enough && o && (
                <div role="group" aria-label="How trades that followed the rule compared">
                  <h4>How they compared</h4>
                  {o.enough ? <>
                    <dl className="small">
                      <dt>Followed the rule</dt>
                      <dd>{tradesLabel(o.followed.count)}, avg {signedPct(o.followed.avgReturn!)}</dd>
                      <dt>Did not follow</dt>
                      <dd>{tradesLabel(o.notFollowed.count)}, avg {signedPct(o.notFollowed.avgReturn!)}</dd>
                    </dl>
                    <p className="small">{o.takeaway}</p>
                  </> : <>
                    <p className="small">Followed: {tradesLabel(o.followed.count)}. Not followed: {tradesLabel(o.notFollowed.count)}.</p>
                    <p className="muted small">too few trades to compare yet</p>
                  </>}
                  <p className="muted small">This compares different trades. It does not show that the rule caused the difference.</p>
                </div>
              )}
              {rule && tr && (
                <div role="group" aria-label="Recent versus earlier">
                  <h4>Recent versus earlier</h4>
                  {tr.enough ? <>
                    <p className="small">{tr.takeaway}</p>
                    <p className="muted small">These are small samples. A difference of a trade or two is within noise. Only your latest 20 applicable trades are compared.</p>
                  </> : <>
                    <p className="muted">{FEW}</p>
                    <p className="muted small">{tr.applicable} applicable so far. A comparison needs at least 15: the latest 10 and at least 5 before them.</p>
                  </>}
                </div>
              )}
              {rule && br && (
                <div role="group" aria-label="Rules by reason">
                  <h4>Rules by reason</h4>
                  {br.applicable === 0 ? <p className="muted small">No trades this rule applies to yet.</p> : <>
                    <p className="muted small">Reasons known for {br.tagged} of {br.applicable} trades this rule applies to</p>
                    {br.tagged === 0 ? <p className="small">Tag a trade above and a comparison appears here.</p> : <>
                      <dl className="small">
                        {br.cells.map((c) => (
                          <div key={c.reason}>
                            <dt>{REASON_LABEL[c.reason]}</dt>
                            <dd>{c.enough ? `${c.followed} of ${c.applicable} (${Math.round(c.share! * 100)}%)` : `${FEW}. ${c.applicable} tagged so far`}</dd>
                          </div>
                        ))}
                      </dl>
                      {br.takeaway && <p className="small">{br.takeaway}</p>}
                      <p className="muted small">This compares different trades. It does not show that your reason caused the difference.</p>
                    </>}
                  </>}
                </div>
              )}
              {!rule && <p className="muted small">Not set</p>}
              <form action={setRule} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input type="hidden" name="kind" value={kind} />
                <label htmlFor={`days-${kind}`}>Days</label>
                <input id={`days-${kind}`} name="days" type="number" min={1} max={365} step={1} inputMode="numeric" required defaultValue={rule?.days} style={{ minHeight: 44, width: 90 }} />
                <button type="submit" name="intent" value="set" style={{ minHeight: 44 }}>{rule ? 'Update' : 'Set rule'}</button>
                {rule && <button type="submit" name="intent" value="clear" formNoValidate style={{ minHeight: 44 }}>Clear rule</button>}
              </form>
            </section>
          );
        })}
      </div>

      <p className="muted small">
        Percentages only. Computed from your verified closed trades each time you open this page.
        {me.excluded_positions > 0 && <> Trades with no recorded entry are excluded: {me.excluded_positions}.</>}
      </p>
    </main>
  );
}
