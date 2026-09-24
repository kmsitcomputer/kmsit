import { useCallback, useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { StatusError } from '../lib/api';
import type { Page } from '../lib/pagination';
import { useApp } from '../state/store';
import { Icon } from './icons';
import { EmptyState, Spinner } from './ui';

export type RemoteStatus = 'loading' | 'ready' | 'error' | 'forbidden';
export interface Remote<T> { status: RemoteStatus; data: T | null; error: string; reload: () => void; }

/**
 * Loads server data and keeps 401/403/5xx visible as states instead of swallowing them
 * into empty arrays. Stale responses (deps changed mid-flight) are ignored.
 */
export function useRemote<T>(loader: () => Promise<T>, deps: DependencyList): Remote<T> {
  const [state, setState] = useState<{ status: RemoteStatus; data: T | null; error: string }>({ status: 'loading', data: null, error: '' });
  const seq = useRef(0);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, status: 'loading' }));
    loader().then(
      (data) => { if (id === seq.current) setState({ status: 'ready', data, error: '' }); },
      (err: unknown) => {
        if (id !== seq.current) return;
        const status = err instanceof StatusError ? err.status : 0;
        setState({ status: status === 401 || status === 403 ? 'forbidden' : 'error', data: null, error: err instanceof Error ? err.message : '' });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload };
}

/** Renders loading / forbidden / error / empty states around server data. */
export function RemoteView<T>({ remote, isEmpty, emptyTitle, emptySub, children }: {
  remote: Remote<T>; isEmpty?: (data: T) => boolean; emptyTitle?: string; emptySub?: string; children: (data: T) => ReactNode;
}) {
  const { t } = useApp();
  if (remote.status === 'loading' && remote.data === null) {
    return <div className="flex items-center justify-center gap-2 py-14 text-sm text-base-400"><Spinner /> {t('loading')}</div>;
  }
  if (remote.status === 'forbidden') {
    return <EmptyState icon="shield" title={t('state_forbidden')} sub={t('state_forbidden_sub')} />;
  }
  if (remote.status === 'error') {
    return <EmptyState icon="alert-triangle" title={t('state_error')} sub={remote.error}
      action={<button className="btn-primary" onClick={remote.reload}><Icon name="refresh" size={14} /> {t('state_retry')}</button>} />;
  }
  if (remote.data === null) return null;
  if (isEmpty?.(remote.data)) return <EmptyState title={emptyTitle ?? t('no_data')} sub={emptySub} />;
  return <>{children(remote.data)}</>;
}

/** Server-side pagination controls. */
export function Pager<T>({ page, onPage }: { page: Page<T>; onPage: (n: number) => void }) {
  const { t } = useApp();
  if (page.total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-200 dark:border-base-800 px-4 py-3 text-xs text-base-500">
      <span>{t('page_of', { page: page.page, last: page.lastPage, total: page.total })}</span>
      <div className="flex gap-2">
        <button className="btn-ghost px-3 py-1.5" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)}>{t('prev')}</button>
        <button className="btn-ghost px-3 py-1.5" disabled={page.page >= page.lastPage} onClick={() => onPage(page.page + 1)}>{t('next')}</button>
      </div>
    </div>
  );
}

export interface PagedColumn<T> { key: string; label: string; render: (row: T) => ReactNode; className?: string; }

/** Table over one server page; search/filter UI lives in `toolbar` so it can drive the query. */
export function PagedTable<T>({ page, columns, onPage, toolbar, rowKey, rowActions }: {
  page: Page<T>; columns: PagedColumn<T>[]; onPage: (n: number) => void; toolbar?: ReactNode;
  rowKey: (row: T) => string; rowActions?: (row: T) => ReactNode;
}) {
  const { t } = useApp();
  return (
    <div className="card overflow-hidden anim-rise">
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-base-200 dark:border-base-800 px-4 py-3">{toolbar}</div>}
      {page.items.length === 0 ? (
        <div className="p-4"><EmptyState title={t('no_data')} /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-base-100/60 dark:bg-base-850">
              <tr>{columns.map((c) => <th key={c.key} className={`th ${c.className ?? ''}`}>{c.label}</th>)}{rowActions && <th className="th text-right">{t('action')}</th>}</tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
                <tr key={rowKey(row)} className="border-t border-base-100 dark:border-base-800/70">
                  {columns.map((c) => <td key={c.key} className={`td ${c.className ?? ''}`}>{c.render(row)}</td>)}
                  {rowActions && <td className="td text-right">{rowActions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} onPage={onPage} />
    </div>
  );
}
