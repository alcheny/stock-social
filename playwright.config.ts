import { defineConfig } from '@playwright/test';
import path from 'node:path';

// Runs against a production build (`npm run build` first) with seeded demo data.
// The browser renders system-ui/sans-serif in DejaVu Sans on every machine (e2e/fonts.conf), so a layout that fits in a
// session container also fits on the CI runner.
const FONTCONFIG_FILE = path.resolve('e2e/fonts.conf'); // run from the repo root, as npm scripts and CI do

export default defineConfig({
  testDir: 'e2e',
  // One worker, as CI runs it (ci.yml `--workers=1`): the vendor and billing fakes listen on fixed ports
  // (e2e/connect.spec.ts) and the feed lock assumes one test at a time; parallel workers hit EADDRINUSE.
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    launchOptions: { env: { ...process.env, FONTCONFIG_FILE } },
  },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: { ALLOW_DEV_AUTH: '1' },
  },
});
