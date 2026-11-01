// Security hardening (2026-11-01), F12 and F19: route and form values checked before they reach SQL. Junk (a NUL byte,
// which Postgres text cannot hold; a non-numeric id for a bigint column) is "not found" or a no-op, never a 500.

// Exactly what users.handle allows (its CHECK, db/schema.sql), so no valid handle is refused.
export const routeHandle = (raw: unknown): string | null => (typeof raw === 'string' && /^[a-z0-9_]{3,20}$/.test(raw) ? raw : null);

// A closed_trades id: a positive bigint, digits only.
export const tradeIdParam = (raw: unknown): string | null => (typeof raw === 'string' && /^[1-9]\d{0,17}$/.test(raw) ? raw : null);
