// F-16 AC 2 and AC "after a hide" (docs/features/logs/F-16-F-17/plan.md §7, §8 #2 and #23; engineer A): hiding a profile
// leaves its trades counted on none of the public surfaces: the feed, /t, /t/<SYM>, /t/compare, the stock image, the
// profile, trade, month and story images, the pane JSON and the sitemap; the trader's renamed-from handle is a 404 too.
// Plus E2: a visible profile's share images carry `public, max-age=300` (the production build, as npm run test:e2e runs).
// Each surface is checked before and after the hide, scoped to this file's own fixture: trader T (renamed from an old
// handle) with five large recent closes on symbol S (S is T's alone) and three on R, and helper trader W with three on R,
// so R is in the sitemap only while both count. Removed by id at the end.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { feedLock } from './feed-lock.ts';

const IMAGE_CACHE = 'public, max-age=300';

test('a hidden profile is counted on no public surface, and its old handle is a 404 too', async ({ page, request }) => {
  test.setTimeout(120_000);
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const release = await feedLock('shared'); // T is feed-eligible (e2e/feed-lock.ts)
  const tag = Math.random().toString(36).slice(2, 8);
  const old = `f16o${tag}`, handle = `f16h${tag}`, helper = `f16w${tag}`;
  const S = `ZQ${tag.toUpperCase()}`, R = `ZR${tag.toUpperCase()}`;
  const users: number[] = [], attempts: number[] = [];
  const closedAt = new Date(Date.now() - 3_600_000);
  const ym = closedAt.toISOString().slice(0, 7);
  const sell = `${handle}-s0`;
  const status = async (r: APIRequestContext, url: string) => (await r.get(url)).status();
  try {
    // The stock image of S before any trade exists: what it must equal again once T is hidden.
    const emptyImage = await (await request.get(`/t/${S}/opengraph-image`)).body();

    const mk = async (h: string) => {
      const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
        insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${h}, ${`Fixture ${h}`}, now(), a.id from a
        returning id, signup_attempt_id`;
      users.push(u.id as number); attempts.push(u.signup_attempt_id as number);
      return u.id as number;
    };
    const t = await mk(old), w = await mk(helper);
    // The rename chain (F-17): T renamed old → handle; the old handle is held, so it answers the retired 404.
    await sql`update users set handle = ${handle} where id = ${t}`;
    await sql`insert into handle_reservations (handle, until, user_id) values (${old}, now() + interval '30 days', ${t})`;
    const close = (u: number, id: string, symbol: string, r: number) => sql`insert into closed_trades
      (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u}, ${id}, 'acc', ${symbol}, ${new Date(closedAt.getTime() - 2 * 86_400_000)}, ${closedAt}, ${r}, 2, true)`;
    for (let i = 0; i < 5; i++) await close(t, `${handle}-s${i}`, S, 3 + i * 0.1);
    for (let i = 0; i < 3; i++) { await close(t, `${handle}-r${i}`, R, 0.2); await close(w, `${helper}-r${i}`, R, -0.1); }

    const urls = {
      profileImage: `/u/${handle}/opengraph-image`,
      story: `/u/${handle}/story`,
      tradeImage: `/u/${handle}/trade/${sell}/opengraph-image`,
      monthImage: `/u/${handle}/month/${ym}/opengraph-image`,
      pane: `/u/${handle}/pane`,
      paneChart: `/u/${handle}/pane-chart`,
      trade: `/u/${handle}/trade/${sell}`,
      profile: `/u/${handle}`,
    };
    const looks = async () => {
      await page.goto('/');
      const feed = (await page.locator('main').innerText()).includes(`@${handle}`);
      // /t, searched by a prefix only S has (a search for S itself redirects to /t/S while it is an exact match).
      await page.goto(`/t?q=${S.slice(0, -1)}`);
      const index = await page.locator(`main a[href="/t/${S}"]`).count() > 0;
      await page.goto(`/t/${S}`);
      const symbolEmpty = (await page.locator('main').innerText()).includes(`No verified closed trades in ${S} yet.`);
      await page.goto(`/t/compare?a=${S}&b=${R}`);
      const compareEmpty = (await page.locator('main').innerText()).includes(`No verified closed trades in ${S} yet.`);
      const stockImage = Buffer.compare(await (await request.get(`/t/${S}/opengraph-image`)).body(), emptyImage) === 0;
      const sitemap = (await (await request.get('/sitemap.xml')).text()).includes(`/t/${R}</loc>`);
      const codes: Record<string, number> = {};
      for (const [k, u] of Object.entries(urls)) codes[k] = await status(request, u);
      return { feed, index, symbolEmpty, compareEmpty, stockImage, sitemap, codes };
    };

    const visible = await looks();
    expect(visible).toEqual({
      feed: true, index: true, symbolEmpty: false, compareEmpty: false, stockImage: false, sitemap: true,
      codes: { profileImage: 200, story: 200, tradeImage: 200, monthImage: 200, pane: 200, paneChart: 200, trade: 200, profile: 200 },
    });
    // E2: bounded caching on a visible profile's share images and the stock image (the production build).
    for (const u of [urls.profileImage, urls.story, urls.tradeImage, urls.monthImage, `/t/${S}/opengraph-image`]) {
      expect((await request.get(u)).headers()['cache-control'], u).toBe(IMAGE_CACHE);
    }
    // The old handle is retired before and after the hide.
    for (const u of [`/u/${old}`, `/u/${old}/trade/${sell}`, `/u/${old}/opengraph-image`, `/u/${old}/pane`]) expect(await status(request, u), u).toBe(404);

    // TODO(lead): once scripts/hide.ts (engineer B) is merged, hide and unhide through it instead of this update.
    await sql`update users set hidden_at = now() where id = ${t}`;

    const hidden = await looks();
    expect(hidden).toEqual({
      feed: false, index: false, symbolEmpty: true, compareEmpty: true, stockImage: true, sitemap: false,
      codes: { profileImage: 404, story: 404, tradeImage: 404, monthImage: 404, pane: 404, paneChart: 404, trade: 404, profile: 404 },
    });
    for (const u of [urls.pane, urls.paneChart]) expect((await request.get(u)).headers()['cache-control'], u).toBe('no-store');
    // The rename chain: the old handle's URLs stay 404 (retired), the new handle's are 404 (hidden).
    for (const u of [`/u/${old}`, `/u/${old}/trade/${sell}`, `/u/${old}/opengraph-image`, `/u/${old}/story`, `/u/${old}/pane`]) expect(await status(request, u), u).toBe(404);
    // R still has W's trades, so its page still answers; only T's are gone from it.
    await page.goto(`/t/${R}`);
    await expect(page.locator('main')).not.toContainText(handle);
  } finally {
    await sql`delete from handle_reservations where handle = ${old}`;
    if (users.length) await sql`delete from users where id in ${sql(users)}`;
    if (attempts.length) await sql`delete from signup_attempts where id in ${sql(attempts)}`;
    await sql.end({ timeout: 1 });
    await release();
  }
});
