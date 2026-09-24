/**
 * Pagination adapter for the backend standard: Laravel length-aware paginator JSON
 * (`data`, `current_page`, `per_page`, `total`, `last_page`), usually nested under a
 * resource key (e.g. `{ users: {...} }`). `per_page` is capped at 100 server-side.
 */
export interface Page<T> { items: T[]; page: number; perPage: number; total: number; lastPage: number; }

type RawPaginator = { data?: unknown[]; current_page?: number; per_page?: number; total?: number; last_page?: number };

export function toPage<T>(raw: unknown, map: (row: any) => T): Page<T> {
  const p = (raw ?? {}) as RawPaginator;
  const rows = Array.isArray(p.data) ? p.data : Array.isArray(raw) ? (raw as unknown[]) : [];
  return {
    items: rows.map(map),
    page: Number(p.current_page ?? 1),
    perPage: Number(p.per_page ?? rows.length),
    total: Number(p.total ?? rows.length),
    lastPage: Math.max(1, Number(p.last_page ?? 1)),
  };
}

export const emptyPage = <T,>(): Page<T> => ({ items: [], page: 1, perPage: 20, total: 0, lastPage: 1 });

export type QueryValue = string | number | boolean | null | undefined;

/** Builds `?a=1&b=x`, dropping empty values. */
export function pageQuery(params: Record<string, QueryValue>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    q.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}
