import { useEffect, useState } from 'react';
import { tempId as uid } from '../../lib/format';
import { fmtDateTime } from '../../lib/format';
import { api, type ApiAdminCourse, type ApiAdminQuiz } from '../../lib/api';
import { useApp } from '../../state/store';
import { can } from '../../lib/permissions';
import { Icon } from '../../components/icons';
import { Avatar, Badge, Confirm, Field, IconButton, Modal, PageHeader, Select, StatusBadge, TextArea, TextInput, Toggle } from '../../components/ui';
import { PagedTable, RemoteView, useRemote } from '../../components/remote';
import { DashShell } from '../../components/Shell';

/* ================= shared question-draft types =================
 * These mirror what the backend's admin quiz endpoints accept/return
 * (POST/PUT /admin/quizzes send & receive the FULL question/option list
 * on every save — the backend does a full replace, not a diff). */

type QType = 'single' | 'multiple' | 'boolean' | 'short';
type ApiQuestion = NonNullable<ApiAdminQuiz['questions']>[number];
type OptionDraft = { key: string; id?: string; text: string; is_correct: boolean };
type QuestionDraft = { key: string; id?: string; type: QType; text: string; points: number; options: OptionDraft[] };

const TYPE_LABEL: Record<QType, string> = { single: 'Pilihan Ganda', boolean: 'Benar/Salah', multiple: 'Jawaban Ganda', short: 'Isian Singkat' };

function toDraft(q: ApiQuestion): QuestionDraft {
  return {
    key: q.id, id: q.id, type: q.type as QType, text: q.text, points: q.points,
    options: (q.options || []).map((o) => ({ key: o.id, id: o.id, text: o.text, is_correct: o.is_correct })),
  };
}

function questionPayload(q: QuestionDraft) {
  return {
    ...(q.id ? { id: q.id } : {}),
    type: q.type, text: q.text, points: q.points,
    options: q.options.map((o) => ({ ...(o.id ? { id: o.id } : {}), text: o.text, is_correct: o.is_correct })),
  };
}

/* ================= question editor ================= */

function QuestionEditor({ question, onSave, onClose }: { question: QuestionDraft | null; onSave: (q: QuestionDraft) => void; onClose: () => void }) {
  const { toast } = useApp();
  const [type, setType] = useState<QType>(question?.type ?? 'single');
  const [text, setText] = useState(question?.text ?? '');
  const [points, setPoints] = useState(question?.points ?? 10);
  const [err, setErr] = useState('');

  const [options, setOptions] = useState<OptionDraft[]>(() =>
    question && question.type !== 'boolean' && question.type !== 'short' && question.options.length
      ? question.options.map((o) => ({ ...o }))
      : [0, 1, 2, 3].map(() => ({ key: uid(), text: '', is_correct: false })),
  );

  const boolInit = question?.type === 'boolean' ? question.options : [];
  const [boolCorrect, setBoolCorrect] = useState<'true' | 'false' | ''>(() => {
    if (boolInit.find((o) => o.text === 'Benar')?.is_correct) return 'true';
    if (boolInit.find((o) => o.text === 'Salah')?.is_correct) return 'false';
    return '';
  });
  const [boolIds] = useState<{ true?: string; false?: string }>(() => ({
    true: boolInit.find((o) => o.text === 'Benar')?.id,
    false: boolInit.find((o) => o.text === 'Salah')?.id,
  }));

  const [shortText, setShortText] = useState(() => (question?.type === 'short' ? question.options.map((o) => o.text).join('\n') : ''));
  const [shortIds] = useState<(string | undefined)[]>(() => (question?.type === 'short' ? question.options.map((o) => o.id) : []));

  const toggleCorrect = (key: string) => {
    setOptions((prev) => prev.map((o) => (type === 'multiple' ? (o.key === key ? { ...o, is_correct: !o.is_correct } : o) : { ...o, is_correct: o.key === key })));
  };

  const save = () => {
    const trimmedText = text.trim();
    if (!trimmedText) { setErr('Pertanyaan wajib diisi.'); return; }
    let optionsPayload: OptionDraft[];
    if (type === 'boolean') {
      if (!boolCorrect) { setErr('Tandai kunci jawaban yang benar.'); return; }
      optionsPayload = [
        { key: 'bool-true', id: boolIds.true, text: 'Benar', is_correct: boolCorrect === 'true' },
        { key: 'bool-false', id: boolIds.false, text: 'Salah', is_correct: boolCorrect === 'false' },
      ];
    } else if (type === 'short') {
      const lines = shortText.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length === 0) { setErr('Isi minimal satu kunci jawaban.'); return; }
      optionsPayload = lines.map((t, i) => ({ key: shortIds[i] ?? uid(), id: shortIds[i], text: t, is_correct: true }));
    } else {
      const cleaned = options.filter((o) => o.text.trim());
      if (cleaned.length === 0) { setErr('Tambahkan minimal satu opsi.'); return; }
      if (!cleaned.some((o) => o.is_correct)) { setErr('Tandai kunci jawaban yang benar.'); return; }
      optionsPayload = cleaned;
    }
    setErr('');
    onSave({ key: question?.key ?? uid(), id: question?.id, type, text: trimmedText, points: Number(points) || 10, options: optionsPayload });
    toast('success', 'Soal disimpan.');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={question ? 'Edit Soal' : 'Tambah Soal'} wide footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan Soal</button></>
    }>
      {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-[1fr_180px_110px]">
        <Field label="Tipe Soal"><Select value={type} onChange={(e) => setType(e.target.value as QType)}>
          {(Object.keys(TYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </Select></Field>
        <Field label="Poin"><TextInput type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></Field>
      </div>
      <div className="mt-4"><Field label="Pertanyaan" required><TextArea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pertanyaan di sini…" /></Field></div>
      {(type === 'single' || type === 'multiple' || type === 'boolean') && (
        <div className="mt-4">
          <p className="label">Opsi Jawaban {type === 'multiple' && <span className="normal-case text-brand-500">(tandai SEMUA yang benar)</span>}</p>
          <div className="space-y-2">
            {type === 'boolean' ? (
              (['true', 'false'] as const).map((val) => {
                const checked = boolCorrect === val;
                return (
                  <div key={val} className="flex items-center gap-2.5">
                    <button onClick={() => setBoolCorrect(val)} title="Tandai sebagai jawaban benar"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${checked ? 'border-ok-500 bg-ok-500 text-white' : 'border-base-300 dark:border-base-600 hover:border-ok-500'}`}>
                      {checked && <Icon name="check" size={12} />}
                    </button>
                    <span className="flex-1 text-sm font-semibold text-base-700 dark:text-base-200">{val === 'true' ? 'Benar' : 'Salah'}</span>
                  </div>
                );
              })
            ) : options.map((opt, i) => {
              const checked = opt.is_correct;
              return (
                <div key={opt.key} className="flex items-center gap-2.5">
                  <button onClick={() => toggleCorrect(opt.key)} title="Tandai sebagai jawaban benar"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${checked ? 'border-ok-500 bg-ok-500 text-white' : 'border-base-300 dark:border-base-600 hover:border-ok-500'}`}>
                    {checked && <Icon name="check" size={12} />}
                  </button>
                  <TextInput value={opt.text} placeholder={`Opsi ${String.fromCharCode(65 + i)}`} onChange={(e) => setOptions(options.map((o) => o.key === opt.key ? { ...o, text: e.target.value } : o))} className="flex-1" />
                  <IconButton icon="trash" title="Hapus opsi" tone="danger" onClick={() => setOptions(options.filter((o) => o.key !== opt.key))} />
                </div>
              );
            })}
            {type !== 'boolean' && (
              <button className="btn-outline btn-sm" onClick={() => setOptions([...options, { key: uid(), text: '', is_correct: false }])}><Icon name="plus" size={12} /> Tambah Opsi</button>
            )}
          </div>
        </div>
      )}
      {type === 'short' && (
        <div className="mt-4">
          <Field label="Kunci Jawaban" hint="Satu per baris — semua variasi diterima (case-insensitive).">
            <TextArea rows={3} value={shortText} onChange={(e) => setShortText(e.target.value)} placeholder={'mis.\nCtrl + C\nctrl+c'} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ================= quiz builder ================= */

function QuizBuilder({ quizId, onClose, onSaved }: { quizId: string | 'new'; onClose: () => void; onSaved: () => void }) {
  const { user, toast } = useApp();
  const isNew = quizId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<ApiAdminCourse[]>([]);
  const [f, setF] = useState({ title: '', courseId: '', description: '', timeLimitMin: 10, passingScore: 70, maxAttempts: 3, randomize: false, active: true });
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [attempts, setAttempts] = useState<Array<{ id: string; user?: { name?: string; email?: string }; submitted_at: string | null; score: number; max_score: number; percent: number; passed: boolean; status: string }>>([]);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [qModal, setQModal] = useState<{ q: QuestionDraft | null } | null>(null);
  const [delQ, setDelQ] = useState<QuestionDraft | null>(null);
  const [err, setErr] = useState('');

  // Course options come from /admin/courses, which instructors and course managers may read; others see a general quiz only.
  const canListCourses = !!user && (user.roleKey === 'instructor' || can(user, 'manage_courses'));
  useEffect(() => { if (canListCourses) void api.adminCourses({ per_page: 100 }).then((page) => setCourses(page.items)).catch(() => setCourses([])); }, [canListCourses]);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    void api.adminQuiz(quizId).then((q) => {
      setF({
        title: q.title, courseId: q.course_id ?? '', description: q.description ?? '',
        timeLimitMin: q.time_limit_min, passingScore: q.passing_score, maxAttempts: q.max_attempts,
        randomize: q.randomize, active: q.active,
      });
      setQuestions((q.questions ?? []).map(toDraft));
    }).catch((error) => setErr(error instanceof Error ? error.message : 'Gagal memuat quiz.')).finally(() => setLoading(false));
    void api.quizAttempts(quizId).then((page) => { setAttempts(page.items); setAttemptsTotal(page.total); }).catch(() => { setAttempts([]); setAttemptsTotal(0); });
  }, [quizId, isNew]);

  if (!user) return null;

  const save = () => {
    if (!f.title.trim()) { setErr('Judul quiz wajib diisi.'); return; }
    setErr('');
    setSaving(true);
    const payload = {
      course_id: f.courseId || null, title: f.title.trim(), description: f.description.trim() || null,
      time_limit_min: Number(f.timeLimitMin) || 0, passing_score: Math.min(100, Math.max(0, Number(f.passingScore) || 0)),
      max_attempts: Number(f.maxAttempts) || 0, randomize: f.randomize, active: f.active,
      questions: questions.map(questionPayload),
    };
    const req = isNew ? api.createQuiz(payload) : api.updateQuiz(quizId, payload);
    void req.then(() => {
      toast('success', isNew ? 'Quiz dibuat.' : 'Quiz disimpan.');
      onSaved();
      onClose();
    }).catch((error) => setErr(error instanceof Error ? error.message : 'Gagal menyimpan quiz.')).finally(() => setSaving(false));
  };

  const handleQuestionSave = (draft: QuestionDraft) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.key === draft.key);
      if (idx === -1) return [...prev, draft];
      const next = [...prev]; next[idx] = draft; return next;
    });
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Buat Quiz' : `Quiz — ${f.title}`} wide footer={
      <><button className="btn-ghost" onClick={onClose}>Tutup</button><button className="btn-primary" disabled={saving} onClick={save}><Icon name="check" size={14} /> Simpan</button></>
    }>
      {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
      {loading ? <p className="py-6 text-center text-sm text-base-400">Memuat quiz…</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Judul Quiz" required><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="cth: Quiz Akhir — Excel Dasar" /></Field>
            <Field label="Terikat ke Kelas" hint="Quiz muncul di player kelas ini.">
              <Select value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
                <option value="">— Umum (tidak terikat) —</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
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

          {f.title.trim() ? (
            <>
              <div className="mt-5 rounded-xl border border-base-200 dark:border-base-800">
                <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-4 py-3">
                  <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">Bank Soal <span className="ml-1 font-mono text-[10px] font-normal text-base-400">{questions.length} soal · {questions.reduce((a, q) => a + q.points, 0)} poin</span></p>
                  <button className="btn-primary btn-sm" onClick={() => setQModal({ q: null })}><Icon name="plus" size={12} /> Soal</button>
                </div>
                {questions.length === 0 ? <p className="px-4 py-6 text-center text-sm text-base-400">Belum ada soal.</p> : (
                  <ul>
                    {questions.map((q, i) => (
                      <li key={q.key} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800/70 px-4 py-2.5 last:border-0">
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
              {!isNew && (
                <div className="mt-5 rounded-xl border border-base-200 dark:border-base-800">
                  <div className="border-b border-base-200 dark:border-base-800 px-4 py-3"><p className="font-display text-sm font-bold text-base-900 dark:text-base-50">Percobaan ({attemptsTotal})</p></div>
                  {attempts.length === 0 ? <p className="px-4 py-6 text-center text-sm text-base-400">Belum ada yang mengerjakan.</p> : (
                    <table className="w-full">
                      <thead className="bg-base-100/60 dark:bg-base-850"><tr><th className="th">Student</th><th className="th">Waktu</th><th className="th">Skor</th><th className="th">Hasil</th></tr></thead>
                      <tbody>
                        {attempts.slice(0, 8).map((a) => (
                          <tr key={a.id}>
                            <td className="td"><span className="flex items-center gap-2"><Avatar name={a.user?.name ?? '?'} size={22} />{a.user?.name ?? a.user?.email ?? '—'}</span></td>
                            <td className="td font-mono text-[11px] text-base-400">{a.submitted_at ? fmtDateTime(Date.parse(a.submitted_at)) : '—'}</td>
                            <td className="td font-mono text-xs font-bold">{a.percent}% <span className="text-base-400">({a.score}/{a.max_score})</span></td>
                            <td className="td"><StatusBadge status={a.passed ? 'completed' : 'rejected'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          ) : null}
        </>
      )}
      {qModal && <QuestionEditor question={qModal.q} onSave={handleQuestionSave} onClose={() => setQModal(null)} />}
      <Confirm open={!!delQ} onClose={() => setDelQ(null)} message="Hapus soal ini dari bank soal?" onConfirm={() => {
        if (delQ) { setQuestions((prev) => prev.filter((q) => q.key !== delQ.key)); toast('success', 'Soal dihapus — klik Simpan untuk menerapkan.'); }
        setDelQ(null);
      }} />
    </Modal>
  );
}

/* ================= list page ================= */

export default function QuizzesAdmin() {
  const { user, toast } = useApp();
  const [builder, setBuilder] = useState<string | 'new' | null>(null);
  const [del, setDel] = useState<ApiAdminQuiz | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { setPage(1); }, [q]);
  const quizzes = useRemote(() => api.adminQuizzes({ page, q }), [page, q, user?.id]);
  const refresh = quizzes.reload;

  if (!user) return null;
  const isInstructor = user.roleKey === 'instructor';

  const toggleActive = (q: ApiAdminQuiz, val: boolean) => {
    void api.adminQuiz(q.id).then((full) => {
      const payload = {
        course_id: full.course_id, title: full.title, description: full.description,
        time_limit_min: full.time_limit_min, passing_score: full.passing_score, max_attempts: full.max_attempts,
        randomize: full.randomize, active: val,
        questions: (full.questions ?? []).map((qq) => ({
          id: qq.id, type: qq.type, text: qq.text, points: qq.points,
          options: (qq.options ?? []).map((o) => ({ id: o.id, text: o.text, is_correct: o.is_correct })),
        })),
      };
      return api.updateQuiz(q.id, payload);
    }).then(() => {
      toast('success', val ? 'Quiz diaktifkan.' : 'Quiz dinonaktifkan.');
      refresh();
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui status quiz.'));
  };

  return (
    <DashShell title="Quiz">
      <PageHeader title={isInstructor ? 'Quiz Saya' : 'Manajemen Quiz'} sub="Buat quiz, kelola bank soal, dan pantau hasil student."
        actions={<button className="btn-primary" onClick={() => setBuilder('new')}><Icon name="plus" size={15} /> Buat Quiz</button>} />
      <RemoteView remote={quizzes} isEmpty={(p) => p.total === 0 && !q} emptyTitle="Belum ada quiz" emptySub="Quiz terhubung ke kelas dan menjadi syarat sertifikat.">
        {(data) => <PagedTable<ApiAdminQuiz> page={data} onPage={setPage} rowKey={(row) => row.id}
        toolbar={<form className="relative min-w-[200px] flex-1 sm:max-w-xs" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }}>
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari quiz…" className="input pl-9 py-2 text-sm" />
        </form>}
        columns={[
          { key: 'title', label: 'Quiz', render: (q: ApiAdminQuiz) => (
            <div><p className="font-bold text-base-900 dark:text-base-100">{q.title}</p>
              <p className="font-mono text-[10px] text-base-400">{q.course ? `Kelas: ${q.course.title}` : 'Quiz umum'}</p></div>
          )},
          { key: 'questions', label: 'Soal', render: (q: ApiAdminQuiz) => <span className="font-mono text-xs font-bold">{q.questions_count ?? 0}</span> },
          { key: 'time', label: 'Durasi', render: (q: ApiAdminQuiz) => <span className="font-mono text-xs">{q.time_limit_min} mnt</span> },
          { key: 'pass', label: 'Batas Lulus', render: (q: ApiAdminQuiz) => <Badge tone="brand">{q.passing_score}%</Badge> },
          { key: 'active', label: 'Status', render: (q: ApiAdminQuiz) => <StatusBadge status={q.active ? 'active' : 'draft'} /> },
        ]}
        rowActions={(q: ApiAdminQuiz) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton icon="pencil" title="Kelola soal" tone="brand" onClick={() => setBuilder(q.id)} />
            <IconButton icon={q.active ? 'eye-off' : 'eye'} title={q.active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => toggleActive(q, !q.active)} />
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(q)} />
          </div>
        )} />}
      </RemoteView>
      {builder && <QuizBuilder quizId={builder} onClose={() => setBuilder(null)} onSaved={refresh} />}
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus quiz "${del?.title}" beserta soal & riwayat percobaan?`}
        onConfirm={() => {
          if (!del) return;
          void api.deleteQuiz(del.id).then(() => {
            toast('success', 'Quiz dihapus.');
            refresh();
          }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menghapus quiz.'));
          setDel(null);
        }} />
    </DashShell>
  );
}
