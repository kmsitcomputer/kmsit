import { useState } from 'react';
import { db, uid, type Quiz, type Question, type QuestionType, type ID } from '../../lib/db';
import { fmtDateTime } from '../../lib/services';
import { QuizService, CourseService } from '../../lib/lms';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Avatar, Badge, Confirm, DataTable, Field, IconButton, Modal, PageHeader, Select, StatusBadge, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';

/* ================= question editor ================= */

const TYPE_LABEL: Record<QuestionType, string> = { single: 'Pilihan Ganda', boolean: 'Benar/Salah', multiple: 'Jawaban Ganda', short: 'Isian Singkat' };

function QuestionEditor({ question, quizId, onClose }: { question: Question | null; quizId: ID; onClose: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState(() => ({
    type: question?.type ?? 'single' as QuestionType,
    text: question?.text ?? '',
    options: question?.options.length ? question.options : [{ id: uid(), text: '' }, { id: uid(), text: '' }, { id: uid(), text: '' }, { id: uid(), text: '' }],
    correct: question?.correct ?? [] as string[],
    points: question?.points ?? 10,
  }));

  const save = () => {
    if (!f.text.trim()) { toast('error', 'Pertanyaan wajib diisi.'); return; }
    if (f.type === 'short') {
      if (f.correct.filter((c) => c.trim()).length === 0) { toast('error', 'Isi minimal satu kunci jawaban.'); return; }
    } else if (f.correct.length === 0) { toast('error', 'Tandai kunci jawaban yang benar.'); return; }
    const data = { type: f.type, text: f.text.trim(), options: f.type === 'boolean' ? [] : f.options.filter((o) => o.text.trim()), correct: f.correct.filter((c) => c.trim()), points: Number(f.points) || 10 };
    if (question) QuizService.updateQuestion(question.id, data);
    else QuizService.addQuestion(quizId, data);
    toast('success', 'Soal disimpan.');
    onClose();
  };

  const toggleCorrect = (id: string, multi: boolean) => {
    setF((p) => ({ ...p, correct: multi ? (p.correct.includes(id) ? p.correct.filter((x) => x !== id) : [...p.correct, id]) : [id] }));
  };

  return (
    <Modal open onClose={onClose} title={question ? 'Edit Soal' : 'Tambah Soal'} wide footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan Soal</button></>
    }>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px_110px]">
        <Field label="Tipe Soal"><Select value={f.type} onChange={(e) => { const t = e.target.value as QuestionType; setF({ ...f, type: t, correct: [] }); }}>
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </Select></Field>
        <Field label="Poin"><TextInput type="number" min={1} value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} /></Field>
      </div>
      <div className="mt-4"><Field label="Pertanyaan" required><TextArea rows={2} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Tulis pertanyaan di sini…" /></Field></div>
      {(f.type === 'single' || f.type === 'multiple' || f.type === 'boolean') && (
        <div className="mt-4">
          <p className="label">Opsi Jawaban {f.type === 'multiple' && <span className="normal-case text-brand-500">(tandai SEMUA yang benar)</span>}</p>
          <div className="space-y-2">
            {(f.type === 'boolean' ? [{ id: 'true', text: 'Benar' }, { id: 'false', text: 'Salah' }] : f.options).map((opt, i) => {
              const checked = f.correct.includes(opt.id);
              return (
                <div key={opt.id} className="flex items-center gap-2.5">
                  <button onClick={() => toggleCorrect(opt.id, f.type === 'multiple')} title="Tandai sebagai jawaban benar"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${checked ? 'border-ok-500 bg-ok-500 text-white' : 'border-base-300 dark:border-base-600 hover:border-ok-500'}`}>
                    {checked && <Icon name="check" size={12} />}
                  </button>
                  {f.type === 'boolean' ? (
                    <span className="flex-1 text-sm font-semibold text-base-700 dark:text-base-200">{opt.text}</span>
                  ) : (
                    <>
                      <TextInput value={opt.text} placeholder={`Opsi ${String.fromCharCode(65 + i)}`} onChange={(e) => setF({ ...f, options: f.options.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o) })} className="flex-1" />
                      <IconButton icon="trash" title="Hapus opsi" tone="danger" onClick={() => setF({ ...f, options: f.options.filter((o) => o.id !== opt.id), correct: f.correct.filter((c) => c !== opt.id) })} />
                    </>
                  )}
                </div>
              );
            })}
            {f.type !== 'boolean' && (
              <button className="btn-outline btn-sm" onClick={() => setF({ ...f, options: [...f.options, { id: uid(), text: '' }] })}><Icon name="plus" size={12} /> Tambah Opsi</button>
            )}
          </div>
        </div>
      )}
      {f.type === 'short' && (
        <div className="mt-4">
          <Field label="Kunci Jawaban" hint="Satu per baris — semua variasi diterima (case-insensitive).">
            <TextArea rows={3} value={f.correct.join('\n')} onChange={(e) => setF({ ...f, correct: e.target.value.split('\n') })} placeholder={'mis.\nCtrl + C\nctrl+c'} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ================= quiz builder ================= */

function QuizBuilder({ quizId, onClose }: { quizId: ID | 'new'; onClose: () => void }) {
  useDB();
  const { user, toast } = useApp();
  const existing = quizId !== 'new' ? QuizService.byId(quizId) : undefined;
  const [f, setF] = useState(() => ({
    title: existing?.title ?? '', courseId: existing?.courseId ?? '', description: existing?.description ?? '',
    timeLimitMin: existing?.timeLimitMin ?? 10, passingScore: existing?.passingScore ?? 70,
    maxAttempts: existing?.maxAttempts ?? 3, randomize: existing?.randomize ?? false, active: existing?.active ?? true,
  }));
  const [qModal, setQModal] = useState<{ q: Question | null } | null>(null);
  const [delQ, setDelQ] = useState<Question | null>(null);
  const [createdId, setCreatedId] = useState<ID | null>(null);
  if (!user) return null;
  const effectiveId: ID | null = existing?.id ?? createdId;

  const myCourses = user.roleKey === 'instructor' ? CourseService.ofInstructor(user.id) : CourseService.list();
  const questions = effectiveId ? QuizService.questions(effectiveId) : [];
  const attempts = effectiveId ? db.where('quizAttempts', (a) => a.quizId === effectiveId && a.status === 'submitted').sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0)) : [];

  const saveMeta = (): Quiz | null => {
    if (!f.title.trim()) { toast('error', 'Judul quiz wajib diisi.'); return null; }
    const data = { ...f, courseId: f.courseId || null, timeLimitMin: Number(f.timeLimitMin) || 10, passingScore: Math.min(100, Number(f.passingScore) || 70), maxAttempts: Number(f.maxAttempts) || 0 };
    if (existing) { QuizService.update(existing.id, data); toast('success', 'Quiz disimpan.'); return existing; }
    if (createdId) { QuizService.update(createdId, data); toast('success', 'Quiz disimpan.'); return db.byId('quizzes', createdId) ?? null; }
    const q = QuizService.create(user.id, data, user);
    toast('success', 'Quiz dibuat — tambahkan soal.');
    return q;
  };

  const ensureSaved = (): ID | null => {
    if (effectiveId) return effectiveId;
    const q = saveMeta();
    if (q) setCreatedId(q.id);
    return q?.id ?? null;
  };

  return (
    <Modal open onClose={onClose} title={existing ? `Quiz — ${existing.title}` : 'Buat Quiz'} wide footer={
      <><button className="btn-ghost" onClick={onClose}>Tutup</button><button className="btn-primary" onClick={() => { if (saveMeta()) onClose(); }}><Icon name="check" size={14} /> Simpan</button></>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul Quiz" required><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="cth: Quiz Akhir — Excel Dasar" /></Field>
        <Field label="Terikat ke Kelas" hint="Quiz muncul di player kelas ini.">
          <Select value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
            <option value="">— Umum (tidak terikat) —</option>
            {myCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2"><Field label="Deskripsi"><TextArea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
        <Field label="Batas Waktu (menit)"><TextInput type="number" min={1} value={f.timeLimitMin} onChange={(e) => setF({ ...f, timeLimitMin: Number(e.target.value) })} /></Field>
        <Field label="Batas Lulus (%)"><TextInput type="number" min={1} max={100} value={f.passingScore} onChange={(e) => setF({ ...f, passingScore: Number(e.target.value) })} /></Field>
        <Field label="Maks. Percobaan" hint="0 = tak terbatas"><TextInput type="number" min={0} value={f.maxAttempts} onChange={(e) => setF({ ...f, maxAttempts: Number(e.target.value) })} /></Field>
        <div className="flex items-end gap-5 pb-2">
          <Toggle checked={f.randomize} onChange={(v) => setF({ ...f, randomize: v })} label="Acak Soal" />
          <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Aktif" />
        </div>
      </div>

      {effectiveId || f.title.trim() ? (
        <>
          <div className="mt-5 rounded-xl border border-base-200 dark:border-base-800">
            <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-4 py-3">
              <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">Bank Soal <span className="ml-1 font-mono text-[10px] font-normal text-base-400">{questions.length} soal · {questions.reduce((a, q) => a + q.points, 0)} poin</span></p>
              <button className="btn-primary btn-sm" onClick={() => { if (ensureSaved()) setQModal({ q: null }); }}><Icon name="plus" size={12} /> Soal</button>
            </div>
            {questions.length === 0 ? <p className="px-4 py-6 text-center text-sm text-base-400">Belum ada soal.</p> : (
              <ul>
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800/70 px-4 py-2.5 last:border-0">
                    <span className="font-mono text-[10px] font-bold text-brand-500">{String(i + 1).padStart(2, '0')}</span>
                    <Badge tone={q.type === 'single' ? 'brand' : q.type === 'boolean' ? 'info' : q.type === 'multiple' ? 'accent' : 'ok'}>{TYPE_LABEL[q.type]}</Badge>
                    <span className="flex-1 truncate text-sm font-semibold text-base-700 dark:text-base-200">{q.text}</span>
                    <span className="font-mono text-[10px] text-base-400">{q.points} poin</span>
                    <IconButton icon="pencil" title="Edit soal" tone="brand" onClick={() => setQModal({ q })} />
                    <IconButton icon="trash" title="Hapus soal" tone="danger" onClick={() => setDelQ(q)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-5 rounded-xl border border-base-200 dark:border-base-800">
            <div className="border-b border-base-200 dark:border-base-800 px-4 py-3"><p className="font-display text-sm font-bold text-base-900 dark:text-base-50">Percobaan ({attempts.length})</p></div>
            {attempts.length === 0 ? <p className="px-4 py-6 text-center text-sm text-base-400">Belum ada yang mengerjakan.</p> : (
              <table className="w-full">
                <thead className="bg-base-100/60 dark:bg-base-850"><tr><th className="th">Student</th><th className="th">Waktu</th><th className="th">Skor</th><th className="th">Hasil</th></tr></thead>
                <tbody>
                  {attempts.slice(0, 8).map((a) => {
                    const u = db.byId('users', a.userId);
                    return (
                      <tr key={a.id}>
                        <td className="td"><span className="flex items-center gap-2"><Avatar name={u?.name ?? '?'} size={22} />{u?.name ?? '—'}</span></td>
                        <td className="td font-mono text-[11px] text-base-400">{fmtDateTime(a.submittedAt)}</td>
                        <td className="td font-mono text-xs font-bold">{a.percent}% <span className="text-base-400">({a.score}/{a.maxScore})</span></td>
                        <td className="td"><StatusBadge status={a.passed ? 'completed' : 'rejected'} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
      {qModal && effectiveId && <QuestionEditor quizId={effectiveId} question={qModal.q} onClose={() => setQModal(null)} />}
      <Confirm open={!!delQ} onClose={() => setDelQ(null)} message="Hapus soal ini dari bank soal?" onConfirm={() => { if (delQ) { QuizService.removeQuestion(delQ.id); toast('success', 'Soal dihapus.'); } }} />
    </Modal>
  );
}

/* ================= list page ================= */

export default function QuizzesAdmin() {
  useDB();
  const { user, toast } = useApp();
  const [builder, setBuilder] = useState<ID | 'new' | null>(null);
  const [del, setDel] = useState<Quiz | null>(null);
  if (!user) return null;
  const isInstructor = user.roleKey === 'instructor';
  let rows = isInstructor ? QuizService.ofInstructor(user.id) : QuizService.list();
  rows = rows.sort((a, b) => b.createdAt - a.createdAt);

  return (
    <DashShell title="Quiz">
      <PageHeader title={isInstructor ? 'Quiz Saya' : 'Manajemen Quiz'} sub="Buat quiz, kelola bank soal, dan pantau hasil student."
        actions={<button className="btn-primary" onClick={() => setBuilder('new')}><Icon name="plus" size={15} /> Buat Quiz</button>} />
      <DataTable rows={rows} pageSize={8} searchKeys={(q: Quiz) => `${q.title} ${q.description}`}
        emptyTitle="Belum ada quiz" emptySub="Quiz terhubung ke kelas dan menjadi syarat sertifikat."
        emptyAction={<button className="btn-primary" onClick={() => setBuilder('new')}><Icon name="plus" size={14} /> Create New</button>}
        columns={[
          { key: 'title', label: 'Quiz', render: (q: Quiz) => (
            <div><p className="font-bold text-base-900 dark:text-base-100">{q.title}</p>
              <p className="font-mono text-[10px] text-base-400">{q.courseId ? `Kelas: ${CourseService.byId(q.courseId)?.title ?? '—'}` : 'Quiz umum'}</p></div>
          )},
          { key: 'questions', label: 'Soal', render: (q: Quiz) => <span className="font-mono text-xs font-bold">{QuizService.questions(q.id).length}</span> },
          { key: 'time', label: 'Durasi', render: (q: Quiz) => <span className="font-mono text-xs">{q.timeLimitMin} mnt</span> },
          { key: 'pass', label: 'Batas Lulus', render: (q: Quiz) => <Badge tone="brand">{q.passingScore}%</Badge> },
          { key: 'attempts', label: 'Percobaan', render: (q: Quiz) => <span className="font-mono text-xs">{db.count('quizAttempts', (a) => a.quizId === q.id && a.status === 'submitted')}</span> },
          { key: 'active', label: 'Status', render: (q: Quiz) => <StatusBadge status={q.active ? 'active' : 'draft'} /> },
        ]}
        rowActions={(q: Quiz) => (
          <>
            <IconButton icon="pencil" title="Kelola soal" tone="brand" onClick={() => setBuilder(q.id)} />
            <IconButton icon={q.active ? 'eye-off' : 'eye'} title={q.active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => { QuizService.update(q.id, { active: !q.active }); toast('success', q.active ? 'Quiz dinonaktifkan.' : 'Quiz diaktifkan.'); }} />
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(q)} />
          </>
        )} />
      {builder && <QuizBuilder quizId={builder} onClose={() => setBuilder(null)} />}
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus quiz "${del?.title}" beserta soal & riwayat percobaan?`}
        onConfirm={() => { if (del) { QuizService.remove(del.id); toast('success', 'Quiz dihapus.'); } }} />
    </DashShell>
  );
}
