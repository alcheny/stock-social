// Privacy work (2026-11-01), log hygiene (POLICY P3, P6): what an error may say in a server log. Never its message: a
// vendor or database message can carry an address, an account number, a handle or a query's parameters. Only the
// error's class name, a numeric HTTP status and a short code (SQLSTATE, errno name) are kept.
// lib/privacy-logs.test.ts holds every console call in server code to safe arguments.
const NAME = /^[A-Za-z][A-Za-z0-9]{0,40}$/;
const CODE = /^[A-Z0-9_]{1,16}$/;

export function logSafe(e: unknown): string {
  const x = (e ?? {}) as { name?: unknown; status?: unknown; code?: unknown; response?: { status?: unknown } };
  const parts: string[] = [];
  const name = e instanceof Error ? e.constructor.name || e.name : typeof e === 'object' && e !== null ? 'object' : typeof e;
  parts.push(NAME.test(name) ? name : 'Error');
  const status = typeof x.status === 'number' ? x.status : typeof x.response?.status === 'number' ? x.response.status : null;
  if (status !== null && Number.isInteger(status)) parts.push(`status ${status}`);
  if (typeof x.code === 'string' && CODE.test(x.code)) parts.push(`code ${x.code}`);
  return parts.join(' ');
}
