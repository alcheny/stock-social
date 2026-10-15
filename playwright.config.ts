import { defineConfig } from '@playwright/test';

// Runs against a production build (`npm run build` first) with seeded demo data.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: { ALLOW_DEV_AUTH: '1' },
  },
});
