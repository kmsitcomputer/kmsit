import { Link } from 'react-router-dom';
import { api, type OpsStatus } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, PageHeader, StatCard } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { RemoteView, useRemote } from '../../components/remote';

const WARNING_TEXT: Record<string, string> = {
  queue_sync: 'Queue memakai sync — email reset dikirim di dalam request.',
  scheduler_heartbeat_missing: 'Heartbeat scheduler belum ada — pasang cron "* * * * * php artisan schedule:run".',
  scheduler_heartbeat_stale: 'Heartbeat scheduler basi — cron kemungkinan berhenti.',
  failed_jobs: 'Ada failed job — periksa dengan "php artisan queue:failed".',
  queue_backlog: 'Job tertunda lebih dari 10 menit — worker/cron tidak berjalan.',
  mail_not_delivered: 'Mailer log/array — email tidak terkirim ke pengguna.',
};

const INTEGRATION_LABEL: Record<string, string> = {
  tripay: 'Tripay', xendit: 'Xendit', stripe: 'Stripe', video_embed: 'Video YouTube/Vimeo (embed)',
  zoom: 'Zoom Meeting', google_meet: 'Google Meet', youtube_channel: 'YouTube Channel', rajaongkir: 'RajaOngkir', openroute: 'OpenRoute',
};

/** Queue/scheduler/maintenance/backup/integration status for super_admin (read-only). */
export function OpsPanel({ status }: { status: OpsStatus }) {
  const { t } = useApp();
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="server" label="Queue" value={status.queue.connection} sub={status.queue.scheduler_worker ? 'worker via cron' : 'worker terpisah'} tone={status.queue.connection === 'sync' ? 'warn' : 'ok'} />
        <StatCard icon="clock" label="Scheduler" value={status.scheduler.healthy ? 'Sehat' : 'Bermasalah'} sub={status.scheduler.heartbeat_at ? fmtDateTime(status.scheduler.heartbeat_at) : 'belum ada heartbeat'} tone={status.scheduler.healthy ? 'ok' : 'danger'} />
        <StatCard icon="alert-triangle" label="Failed jobs" value={status.queue.failed_jobs ?? '—'} sub={status.queue.pending_jobs !== null ? `${status.queue.pending_jobs} tertunda` : undefined} tone={status.queue.failed_jobs ? 'danger' : 'ok'} />
        <StatCard icon="shield" label="Maintenance" value={status.maintenance ? 'Aktif' : 'Nonaktif'} sub={`env ${status.environment}`} tone={status.maintenance ? 'warn' : 'info'} />
      </div>
      {status.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {status.warnings.map((w) => (
            <p key={w} className="flex items-center gap-2 rounded-xl border border-warn-400/30 bg-warn-400/10 px-4 py-2.5 text-sm font-semibold text-accent-500"><Icon name="alert-triangle" size={15} /> {WARNING_TEXT[w] ?? w}</p>
          ))}
        </div>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <p className="label">Integrasi</p>
          <ul className="space-y-2">
            {status.integrations.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-base-700 dark:text-base-200">{INTEGRATION_LABEL[row.key] ?? row.key}{row.selected ? <span className="ml-2 font-mono text-[10px] text-brand-500">aktif · {row.mode}</span> : null}</span>
                <Badge tone={row.status === 'active' ? 'ok' : row.status === 'not_configured' ? 'warn' : 'neutral'}>{row.status === 'active' ? 'Aktif' : row.status === 'not_configured' ? 'Belum dikonfigurasi' : t('not_active')}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <p className="label">Mail, cache & backup</p>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Mailer</span><Badge tone={status.mail.delivers ? 'ok' : 'warn'}>{status.mail.mailer}</Badge></li>
            <li className="flex justify-between"><span>Cache store</span><span className="font-mono text-xs">{status.cache.store}</span></li>
            <li className="flex justify-between"><span>Backup terakhir</span><span className="font-mono text-xs">{status.backup.last_export_at ? fmtDateTime(status.backup.last_export_at) : 'belum pernah'}</span></li>
          </ul>
          <Link to="/dashboard/settings-system" className="btn-outline btn-sm mt-4 inline-flex"><Icon name="download" size={13} /> Audit & Backup</Link>
        </div>
      </div>
    </>
  );
}

export function OperationsPage() {
  const { t } = useApp();
  const status = useRemote(() => api.opsStatus(), []);
  return (
    <DashShell title={t('nav_operations')}>
      <PageHeader title={t('nav_operations')} sub="Status queue, scheduler, maintenance, backup, dan integrasi (read-only, tanpa secret)."
        actions={<button className="btn-outline" onClick={status.reload}><Icon name="refresh" size={14} /> {t('state_retry')}</button>} />
      <RemoteView remote={status}>{(data) => <OpsPanel status={data} />}</RemoteView>
    </DashShell>
  );
}
