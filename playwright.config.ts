import { defineConfig } from '@playwright/test';

// Runs against a production build (`npm run build` first) with seeded demo data.
// The browser renders system-ui/sans-serif in DejaVu Sans on every machine (e2e/fonts.conf), so a layout that fits in a
// session container also fits on the CI runner.
const FONTCONFIG_FILE = new URL('./e2e/fonts.conf', import.meta.url).pathname;

export default defineConfig({
  testDir: 'e2e',
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
