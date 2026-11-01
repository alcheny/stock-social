// Sharded hourly sync (docs/SYNC.md; committee: docs/features/logs/sync/committee-2026-11-01.md): the pure parts.
// Shard parameters, run configuration from the environment, the per-shard vendor request budget (a token bucket) and
// the per-trader failure backoff. No database, no vendor: lib/sync-shard.ts runs them.

export const MAX_SHARDS = 1024;

export type Shard = { shard: number; of: number };
// `?shard=i&of=N`: both or neither, integers, 0 <= i < N <= MAX_SHARDS. Neither = shard 0 of 1 (every trader, the
// behavior before sharding). Anything else is an error the route answers with 400.
export function parseShard(params: URLSearchParams): Shard | { error: string } {
  const s = params.get('shard'), o = params.get('of');
  if (s === null && o === null) return { shard: 0, of: 1 };
  if (s === null || o === null) return { error: 'shard and of go together' };
  if (!/^\d{1,4}$/.test(s) || !/^\d{1,4}$/.test(o)) return { error: 'shard and of are whole numbers' };
  const shard = Number(s), of = Number(o);
  if (of < 1 || of > MAX_SHARDS) return { error: `of is between 1 and ${MAX_SHARDS}` };
  if (shard >= of) return { error: 'shard is below of' };
  return { shard, of };
}
// A trader's shard: its id modulo the shard count (the SQL uses the same rule: `u.id % of = shard`).
export const shardOf = (userId: number, of: number) => userId % of;

// Run configuration (docs/SYNC.md → Configuration). Read per call so a deploy's environment change applies at once.
export type RunConfig = { concurrency: number; rps: number; burst: number; page: number };
const int = (v: string | undefined, dflt: number, min: number, max: number) => {
  const n = v === undefined || v === '' ? dflt : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : dflt;
};
export function runConfig(env: Record<string, string | undefined> = process.env): RunConfig {
  const rps = int(env.SYNC_VENDOR_RPS, 10, 1, 1000);
  return {
    concurrency: int(env.SYNC_CONCURRENCY, 6, 1, 32),
    rps,
    burst: int(env.SYNC_VENDOR_BURST, rps, 1, 1000),
    page: int(env.SYNC_PAGE, 500, 10, 5000),
  };
}

// The shard's vendor request budget: `rps` tokens a second, at most `burst` saved. `take(n)` resolves once n tokens
// are taken; waiters are served in order, so one trader never starves behind later ones. One bucket per run: the
// shard lease (lib/sync-shard.ts) keeps one run per shard at a time, so it is the shard's whole budget.
// `now` and `sleep` are test hooks.
export class TokenBucket {
  private tokens: number;
  private last: number;
  private queue: Promise<void> = Promise.resolve();
  private readonly rps: number;
  private readonly burst: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  waitedMs = 0; // total time spent waiting for tokens (a counter for the run log)
  taken = 0;
  private pending = 0; // tokens asked for and not yet taken
  constructor(rps: number, burst = rps, now: () => number = () => performance.now(), sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {
    this.rps = rps; this.burst = Math.max(1, burst); this.now = now; this.sleep = sleep;
    this.tokens = this.burst; this.last = now();
  }
  private refill() {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + ((t - this.last) / 1000) * this.rps);
    this.last = t;
  }
  // How long a request for n tokens would wait now, behind the requests already queued (the fit check counts it).
  estimateWaitMs(n = 1): number {
    this.refill();
    const short = this.pending + n - this.tokens;
    return short <= 0 ? 0 : Math.ceil((short / this.rps) * 1000);
  }
  take(n = 1): Promise<void> {
    this.pending += n;
    const run = this.queue.then(async () => {
      // A request bigger than the burst is taken one burst at a time.
      let left = n;
      while (left > 0) {
        const want = Math.min(left, this.burst);
        this.refill();
        if (this.tokens < want) {
          const ms = Math.ceil(((want - this.tokens) / this.rps) * 1000);
          this.waitedMs += ms;
          await this.sleep(ms);
          this.refill();
        }
        this.tokens -= want;
        this.pending -= want;
        left -= want;
      }
      this.taken += n;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

// A trader whose sync throws waits before its next attempt: one round after the first failure, then doubling, capped
// at a day (committee O3). The wait is counted from the failure on the database clock. A success clears it.
export const BACKOFF_BASE_MS = 3_600_000;
export const BACKOFF_CAP_MS = 24 * 3_600_000;
export const backoffMs = (failures: number) => failures < 1 ? 0 : Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.min(failures - 1, 30));

// Failure classes (committee O3). `transient`: the vendor or the network failed for everyone (429, 5xx, a vendor
// timeout, a dropped connection, a database blip): never held against the trader, retried next round. `refused`: the
// vendor refused this trader's link (401/403/404): backed off and counted on its own (the owner decides its TR-5 rule).
// `trader`: anything else specific to this trader (another 4xx, AccountClaimedError, a record the rebuild rejects).
export type FailureKind = 'transient' | 'refused' | 'trader';
const TRANSPORT_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE', 'ECONNABORTED', 'EHOSTUNREACH', 'ENETUNREACH',
  'ERR_NETWORK', 'ERR_SOCKET_CONNECTION_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
  // postgres.js connection errors and SQLSTATE: connection exceptions (08…), admin shutdown, serialization, deadlock.
  'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED', 'CONNECT_TIMEOUT', '57P01', '57P02', '57P03', '40001', '40P01']);
export const errStatus = (e: unknown): number | undefined => {
  const x = e as { status?: unknown; response?: { status?: unknown } } | null;
  const s = x?.status ?? x?.response?.status;
  return typeof s === 'number' ? s : undefined;
};
export function classify(e: unknown): FailureKind {
  const status = errStatus(e);
  if (status !== undefined) return status === 429 || status >= 500 ? 'transient' : status === 401 || status === 403 || status === 404 ? 'refused' : 'trader';
  const x = e as { name?: unknown; code?: unknown } | null;
  if (x?.name === 'VendorTimeoutError' || x?.name === 'AxiosError') return 'transient';
  if (typeof x?.code === 'string' && (TRANSPORT_CODES.has(x.code) || x.code.startsWith('08'))) return 'transient';
  return 'trader';
}
// What a failure line may say: the error's class name and HTTP status, never its message (vendor text can echo the
// vendor user id).
export const errLabel = (e: unknown) => {
  const name = e instanceof Error ? e.name : typeof e;
  const status = errStatus(e);
  return status === undefined ? name : `${name} ${status}`;
};

// The run breaker: once `min` attempts have finished, the run stops dispatching when at least `ratio` of the last
// `window` failed for reasons not the trader's (transient, or refusals on that scale: our own credentials).
export class Breaker {
  private last: boolean[] = [];
  private readonly window: number;
  private readonly ratio: number;
  tripped = false;
  constructor(window = 20, ratio = 0.5) { this.window = window; this.ratio = ratio; }
  record(bad: boolean) {
    this.last.push(bad);
    if (this.last.length > this.window) this.last.shift();
    if (this.last.length >= this.window && this.last.filter(Boolean).length >= this.ratio * this.window) this.tripped = true;
    return this.tripped;
  }
}

// The database settings sharded sync relies on (committee round 2, reliability): both timeouts set; the gap a sync may
// leave between statements (`idle_in_transaction_session_timeout`) above the largest sync cost and below the per-user
// lease; enough connections for every shard's workers plus their two spare connections and 20 for the rest of the app.
export type DbSettings = { statementTimeoutMs: number; idleInTxMs: number; maxConnections: number };
export function dbConfigCheck(s: DbSettings, plan: { shards: number; workers: number; maxSyncCostMs: number; userLeaseMs: number }) {
  const problems: string[] = [];
  if (s.statementTimeoutMs <= 0) problems.push('statement_timeout is 0');
  if (s.idleInTxMs <= 0) problems.push('idle_in_transaction_session_timeout is 0');
  else {
    if (s.idleInTxMs <= plan.maxSyncCostMs) problems.push('idle_in_transaction_session_timeout is at or below the largest sync cost');
    if (s.idleInTxMs >= plan.userLeaseMs) problems.push('idle_in_transaction_session_timeout is at or above the per-user lease');
  }
  const need = plan.shards * (plan.workers + 2) + 20;
  if (s.maxConnections < need) problems.push(`max_connections is below ${need}`);
  return { ok: problems.length === 0, problems };
}
