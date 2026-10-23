// Runs once when a server instance starts, before it handles any request (Next.js instrumentation `register`).
// A production server with the test-only vendor base URL set refuses to start (lib/vendor-env.ts).
import { assertVendorBaseUrl } from './lib/vendor-env.ts';

export function register() {
  assertVendorBaseUrl();
}
