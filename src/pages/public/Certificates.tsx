import { useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { db, type Certificate } from '../../lib/db';
import { fmtDate, getSetting } from '../../lib/services';
import { CertificateService, CourseService } from '../../lib/lms';
import { useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, EmptyState, Modal } from '../../components/ui';
import { PublicShell } from '../../components/Shell';

/* ================= certificate sheet ================= */

export function CertificateSheet({ cert, compact }: { cert: Certificate; compact?: boolean }) {
  const template = db.byId('certificateTemplates', cert.templateId);
  const course = CourseService.byId(cert.courseId);
  const student = db.byId('users', cert.userId);
  const instructor = course ? db.byId('users', course.instructorId) : undefined;
  const siteUrl = getSetting('site_url', window.location.origin);
  const verifyUrl = `${siteUrl}/#/certificate/verify/${cert.number}`;
  const theme = template?.theme ?? 'navy';
  const accent = template?.accent ?? '#2dd4bf';
  const bg = theme === 'ivory' ? '#faf7f0' : theme === 'graphite' ? '#171a21' : '#0c1226';
  const fg = theme === 'ivory' ? '#26221a' : '#eef2fb';
  const sub = theme === 'ivory' ? '#7a7263' : '#93a0bd';
  const classic = template?.frame === 'classic';

  return (
    <div id="cert-print-area" className="relative mx-auto w-full max-w-[860px] overflow-hidden rounded-xl shadow-2xl" style={{ background: bg, aspectRatio: '1.414 / 1' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />
      <div className="absolute inset-0" style={{ border: `2px solid ${accent}`, opacity: 0.7, margin: classic ? 14 : 22, borderRadius: classic ? 0 : 18 }} />
      {classic && <div className="absolute inset-0" style={{ border: `1px solid ${accent}`, opacity: 0.45, margin: 22 }} />}
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: accent, opacity: 0.14 }} />
      <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full blur-3xl" style={{ background: accent, opacity: 0.1 }} />

      <div className="relative flex h-full flex-col items-center justify-center px-[7%] text-center" style={{ color: fg }}>
        <div className="flex items-center gap-2.5">
          <span style={{ color: accent }}><Icon name="logo" size={compact ? 26 : 34} /></span>
          <span className="font-display font-bold tracking-tight" style={{ fontSize: compact ? 15 : 19 }}>{getSetting('site_name', 'KMSIT Computer')}</span>
        </div>
        <p className="mt-[2.2%] font-mono uppercase" style={{ fontSize: compact ? 8 : 11, letterSpacing: '0.42em', color: accent }}>Certificate of Completion</p>
        <p className="mt-[2.5%]" style={{ fontSize: compact ? 9 : 12, color: sub }}>dengan bangga diberikan kepada</p>
        <h1 className="mt-[1.4%] font-display font-bold leading-tight" style={{ fontSize: compact ? 24 : 40, color: fg, borderBottom: `2px solid ${accent}`, paddingBottom: '0.6%', paddingLeft: '4%', paddingRight: '4%' }}>
          {student?.name ?? '—'}
        </h1>
        <p className="mt-[2%] max-w-[80%]" style={{ fontSize: compact ? 9 : 12.5, color: sub }}>
          telah menyelesaikan seluruh materi dan lulus evaluasi pada kelas
        </p>
        <p className="mt-[1%] font-display font-bold" style={{ fontSize: compact ? 14 : 21, color: accent }}>{course?.title ?? '—'}</p>

        <div className="mt-[3%] flex w-full items-end justify-between px-[4%]">
          <div className="text-center" style={{ minWidth: '24%' }}>
            <p className="font-display italic font-semibold" style={{ fontSize: compact ? 12 : 17, color: fg }}>{instructor?.name ?? '—'}</p>
            <div className="mx-auto mt-1 mb-1" style={{ borderTop: `1.5px solid ${sub}`, width: '85%' }} />
            <p className="font-mono uppercase" style={{ fontSize: compact ? 7 : 9, letterSpacing: '0.2em', color: sub }}>Instructor</p>
          </div>
          <div className="text-center" style={{ minWidth: '20%' }}>
            <p className="font-mono font-bold" style={{ fontSize: compact ? 9 : 12, color: fg }}>{fmtDate(cert.issuedAt)}</p>
            <div className="mx-auto mt-1 mb-1" style={{ borderTop: `1.5px solid ${sub}`, width: '85%' }} />
            <p className="font-mono uppercase" style={{ fontSize: compact ? 7 : 9, letterSpacing: '0.2em', color: sub }}>Tanggal Terbit</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-lg bg-white p-1.5"><QRCode value={verifyUrl} size={compact ? 46 : 66} /></span>
            <p className="font-mono font-bold" style={{ fontSize: compact ? 7.5 : 10.5, color: fg }}>{cert.number}</p>
          </div>
        </div>
        <p className="mt-[1.6%] font-mono" style={{ fontSize: compact ? 7 : 9, color: sub }}>Verifikasi: {verifyUrl}</p>
      </div>
    </div>
  );
}

/* ================= modal (preview + print) ================= */

export function CertificateModal({ certId, open, onClose }: { certId: string; open: boolean; onClose: () => void }) {
  useDB();
  const cert = db.byId('certificates', certId);
  if (!cert) return null;
  const valid = cert.status === 'issued';
  return (
    <Modal open={open} onClose={onClose} title={`Sertifikat · ${cert.number}`} wide footer={
      <>
        {!valid && <Badge tone="danger">DICABUT</Badge>}
        <span className="mr-auto font-mono text-[11px] text-base-400">{cert.views}x diverifikasi</span>
        <button className="btn-ghost" onClick={onClose}>Tutup</button>
        {valid && <button className="btn-primary" onClick={() => window.print()}><Icon name="download" size={15} /> Unduh PDF</button>}
      </>
    }>
      <div className={valid ? '' : 'opacity-50 grayscale'}>
        <CertificateSheet cert={cert} />
      </div>
      <p className="mt-3 text-center text-[11px] text-base-400">Pilih "Save as PDF" pada dialog cetak (orientasi landscape otomatis).</p>
    </Modal>
  );
}

/* ================= public verification page ================= */

export function VerifyPage() {
  useDB();
  const [num, setNum] = useState('');
  const [searched, setSearched] = useState<Certificate | null | 'invalid'>(null);
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const directId = urlParams.get('c');
  const directCert = directId ? db.byId('certificates', directId) : null;

  const verify = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const found = CertificateService.verify(trimmed);
    setSearched(found ?? 'invalid');
    setNum(trimmed);
  };

  const shown = directCert ?? (searched && searched !== 'invalid' ? searched : null);
  const invalid = searched === 'invalid' && !directCert;

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center anim-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-500 flex items-center justify-center gap-2"><Icon name="shield" size={14} /> Verifikasi Sertifikat</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-base-900 dark:text-base-50">Cek Keaslian Sertifikat</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-base-500 dark:text-base-400">Masukkan nomor sertifikat (contoh: KMSIT-{new Date().getFullYear()}-482913) untuk memverifikasi keasliannya.</p>
        </div>
        <form className="mx-auto mt-7 flex max-w-lg gap-2 anim-rise" onSubmit={(e) => { e.preventDefault(); verify(num); }}>
          <div className="relative flex-1">
            <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-400" />
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="KMSIT-2026-XXXXXX" className="input pl-10 py-3 font-mono uppercase" />
          </div>
          <button className="btn-primary px-6">{`Verifikasi`}</button>
        </form>

        <div className="mt-10">
          {invalid && (
            <div className="mx-auto max-w-lg rounded-2xl border border-danger-500/30 bg-danger-500/[0.07] p-6 text-center anim-scale">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-500/15 text-danger-500"><Icon name="alert-triangle" size={26} /></span>
              <p className="mt-4 font-display text-lg font-bold text-danger-500">Sertifikat Tidak Valid</p>
              <p className="mt-1 text-sm text-base-500 dark:text-base-400">Nomor <b className="font-mono">{num}</b> tidak ditemukan dalam database. Sertifikat ini mungkin palsu atau terjadi kesalahan input.</p>
            </div>
          )}
          {shown && (
            <div className="anim-scale">
              <div className={`mx-auto mb-6 flex max-w-lg items-center gap-3 rounded-2xl border p-4 ${shown.status === 'issued' ? 'border-ok-500/30 bg-ok-500/[0.08]' : 'border-danger-500/30 bg-danger-500/[0.07]'}`}>
                <Icon name={shown.status === 'issued' ? 'check-circle' : 'alert-triangle'} size={22} className={shown.status === 'issued' ? 'text-ok-500' : 'text-danger-500'} />
                <div className="flex-1">
                  <p className={`font-display font-bold ${shown.status === 'issued' ? 'text-ok-500' : 'text-danger-500'}`}>
                    {shown.status === 'issued' ? 'Sertifikat Terverifikasi Asli' : 'Sertifikat Telah Dicabut'}
                  </p>
                  <p className="font-mono text-[11px] text-base-400">{shown.number} · terbit {fmtDate(shown.issuedAt)} · {shown.views}x dilihat</p>
                </div>
                <Badge tone={shown.status === 'issued' ? 'ok' : 'danger'}>{shown.status === 'issued' ? 'VALID' : 'REVOKED'}</Badge>
              </div>
              <div className={shown.status === 'issued' ? '' : 'opacity-50 grayscale'}>
                <CertificateSheet cert={shown} />
              </div>
              {shown.status === 'issued' && (
                <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
                  {[
                    { l: 'Pemegang', v: db.byId('users', shown.userId)?.name ?? '—' },
                    { l: 'Kelas', v: CourseService.byId(shown.courseId)?.title ?? '—' },
                    { l: 'Instructor', v: (() => { const c = CourseService.byId(shown.courseId); return c ? db.byId('users', c.instructorId)?.name ?? '—' : '—'; })() },
                  ].map((x) => (
                    <div key={x.l} className="card p-4 text-center">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-base-400">{x.l}</p>
                      <p className="mt-1 truncate font-display text-sm font-bold text-base-900 dark:text-base-50">{x.v}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!shown && !invalid && (
            <div className="mt-4"><EmptyState icon="award" title="Belum ada pencarian" sub="Hasil verifikasi akan tampil di sini." /></div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
