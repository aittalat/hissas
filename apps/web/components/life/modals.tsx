'use client';

import {
  GENDER_LABEL,
  INCIDENT_MEASURES,
  RELATION_LABEL,
  absenceStats,
  addStudent,
  attestationHtml,
  behaviorPoints,
  incidentDelta,
  pointsLevel,
  recordIncident,
  recordMeeting,
  siblings,
  slotLabel,
  studentName,
  toggleArchive,
  transferStudent,
  updateAttendance,
  type Incident,
} from '@hissas/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { uid } from '@/lib/demo';
import { fmtDate, todayISO, useLife } from '@/lib/life';
import { download } from '@/lib/xlsx';
import { Avatar } from './ui';

export type StudentTab = 'info' | 'abs' | 'disc' | 'meet' | 'docs' | 'notes';

interface Modals {
  openStudent: (id: string, tab?: StudentTab) => void;
  openNewStudent: (classId?: string) => void;
}

const Ctx = createContext<Modals | null>(null);

export function useModals(): Modals {
  const c = useContext(Ctx);
  if (!c) throw new Error('useModals خارج LifeModalsProvider');
  return c;
}

/** نوافذ ملف التلميذ والتلميذ الجديد، مشتركة بين كل الشاشات (UI.stuOpen / UI.stuNew). */
export function LifeModalsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ id: string; tab: StudentTab } | null>(null);
  const [newCls, setNewCls] = useState<string | null>(null);
  const openStudent = useCallback(
    (id: string, tab: StudentTab = 'info') => setOpen({ id, tab }),
    [],
  );
  const openNewStudent = useCallback((c?: string) => setNewCls(c ?? ''), []);
  const shown = open !== null || newCls !== null;
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setNewCls(null);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [shown]);
  return (
    <Ctx.Provider value={{ openStudent, openNewStudent }}>
      {children}
      {open ? (
        <StudentFile
          key={open.id}
          id={open.id}
          tab={open.tab}
          setTab={(tab) => setOpen({ ...open, tab })}
          onClose={() => setOpen(null)}
        />
      ) : newCls !== null ? (
        <NewStudent
          classId={newCls}
          onClose={() => setNewCls(null)}
          onSaved={(id) => {
            setNewCls(null);
            setOpen({ id, tab: 'info' });
          }}
        />
      ) : null}
    </Ctx.Provider>
  );
}

const TAG = (i: Pick<Incident, 'type' | 'gravity'>) => {
  const d = incidentDelta(i);
  return d > 0 ? `+${d}` : `−${-d}`;
};

function StudentFile({
  id,
  tab,
  setTab,
  onClose,
}: {
  id: string;
  tab: StudentTab;
  setTab: (t: StudentTab) => void;
  onClose: () => void;
}) {
  const { meta, life, model, placed, cName, setLife, apply, toast, state, update, today } =
    useLife();
  const s = life.students.find((x) => x.id === id);
  const [mt, setMt] = useState({
    reason: '',
    date: todayISO(),
    by: '',
    school: '',
    family: '',
    points: '',
    measures: '',
  });
  if (!s) return null;
  const P = life.parents.find((p) => p.id === s.parent_id);
  const st = absenceStats(life.attendance, s.id, today);
  const pts = behaviorPoints(life.incidents, s.id);
  const name = studentName(s);
  const tabs: [StudentTab, string][] = [
    ['info', 'المعلومات'],
    ['abs', `الغياب (${st.abs})`],
    ['disc', `الانضباط (${pts}/20)`],
    ['meet', 'لقاءات الأولياء'],
    ['docs', 'الوثائق'],
    ['notes', 'النقط'],
  ];
  let body: ReactNode;
  if (tab === 'info')
    body = (
      <div className="grid2">
        <section className="panel">
          <h3>التلميذ</h3>
          <div className="kvl">
            <span>الاسم</span>
            <b>{name}</b>
            <span>القسم</span>
            <b>{cName(s.class_id)}</b>
            <span>تاريخ الازدياد</span>
            <b>{s.birth_date}</b>
            <span>الجنس</span>
            <b>{GENDER_LABEL[s.gender]}</b>
            <span>ملاحظة صحية</span>
            <b>{s.health_note || '—'}</b>
            <span>التصوير</span>
            <b>{s.photo_consent ? 'موافق' : 'غير موافق'}</b>
          </div>
          <label className="fld">
            نقل إلى قسم
            <select
              id="stu-cls"
              value={s.class_id}
              onChange={(e) => {
                setLife((l) => transferStudent(l, s.id, e.target.value));
                toast(`نُقل التلميذ إلى ${cName(e.target.value)}`);
              }}
            >
              {model.school.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="panel">
          <h3>الولي</h3>
          <div className="kvl">
            <span>الاسم</span>
            <b>{P?.full_name ?? '—'}</b>
            <span>الصفة</span>
            <b>{P ? RELATION_LABEL[P.relation] : '—'}</b>
            <span>الهاتف</span>
            <b dir="ltr">{P?.phone || '—'}</b>
            <span>الإخوة</span>
            <b>
              {siblings(life, s)
                .map((x) => `${x.first_name} (${cName(x.class_id)})`)
                .join('، ') || '—'}
            </b>
          </div>
          <div className="toolbar">
            <button
              className="btn sm"
              onClick={() => {
                download(
                  `attestation-${s.matricule.replace('/', '-')}.html`,
                  attestationHtml(meta, s, cName(s.class_id)),
                );
                toast('تم حفظ الملف');
              }}
            >
              شهادة مدرسية
            </button>
            <button
              className="btn sm ghost"
              onClick={() => {
                setLife((l) => toggleArchive(l, s.id));
                toast(s.status === 'active' ? 'نُقل التلميذ إلى الأرشيف' : 'أُعيد تفعيل التلميذ');
              }}
            >
              {s.status === 'active' ? 'أرشفة (مغادرة)' : 'إعادة التفعيل'}
            </button>
          </div>
        </section>
      </div>
    );
  else if (tab === 'abs') {
    const A = life.attendance
      .filter((a) => a.student_id === s.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    body = (
      <>
        <div className="stats">
          <div className="stat">
            <span>غيابات</span>
            <b className="num">{st.abs}</b>
          </div>
          <div className={`stat${st.unj ? ' bad' : ''}`}>
            <span>غير مبررة</span>
            <b className="num">{st.unj}</b>
          </div>
          <div className="stat">
            <span>تأخرات</span>
            <b className="num">{st.late}</b>
          </div>
          <div className={`stat${st.month >= life.rules.monthly_absence_alert ? ' bad' : ''}`}>
            <span>هذا الشهر</span>
            <b className="num">{st.month}</b>
          </div>
        </div>
        {A.length ? (
          <div className="tt-wrap" style={{ border: 0 }}>
            <table className="plain">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الحصة</th>
                  <th>النوع</th>
                  <th>مبرر</th>
                  <th>السبب</th>
                </tr>
              </thead>
              <tbody>
                {A.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDate(a.date)}</td>
                    <td>{slotLabel(model, placed, s.class_id, a.date, a.period)}</td>
                    <td>{a.type === 'late' ? `تأخر ${a.late_minutes} د` : 'غياب'}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={a.justified}
                        aria-label="مبرر"
                        onChange={(e) =>
                          setLife((l) => updateAttendance(l, a.id, { justified: e.target.checked }))
                        }
                      />
                    </td>
                    <td>{a.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">لا يوجد غياب مسجل.</p>
        )}
      </>
    );
  } else if (tab === 'disc') {
    const I = life.incidents
      .filter((i) => i.student_id === s.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const lv = pointsLevel(pts);
    body = (
      <div className="grid2">
        <section className="panel">
          <div className="points">
            <span className={`face ${lv}`}>{lv === 'ok' ? '☺' : lv === 'mid' ? '😐' : '☹'}</span>
            <div>
              <b className="num" style={{ fontSize: 28 }}>
                {pts}
              </b>
              <span className="hint"> / 20 نقطة سلوك</span>
              <p className="hint">
                تبدأ كل سنة بـ20 نقطة، وتنقص حسب خطورة الحادثة، وتزيد بالسلوك الإيجابي.
              </p>
            </div>
          </div>
          <div className="list">
            {I.length ? (
              I.map((i) => (
                <div key={i.id} className="row" style={{ cursor: 'default' }}>
                  <span>
                    <b>{i.title}</b>
                    <br />
                    <span className="meta">
                      {fmtDate(i.date)} {i.time} · {i.measure || 'بدون إجراء'}
                      {i.visible_to_parent ? ' · منشور للولي' : ''}
                    </span>
                  </span>
                  <span className={`tag ${i.type === 'positive' ? 'acc' : 'bad'}`}>{TAG(i)}</span>
                </div>
              ))
            ) : (
              <p className="muted">لا توجد حوادث.</p>
            )}
          </div>
        </section>
        <section className="panel">
          <IncidentForm studentId={s.id} />
        </section>
      </div>
    );
  } else if (tab === 'meet') {
    const M = life.meetings
      .filter((m) => m.student_id === s.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const fields: [keyof typeof mt, string][] = [
      ['reason', 'سبب اللقاء'],
      ['date', 'التاريخ'],
      ['by', 'طلبه'],
      ['school', 'الحاضرون من المدرسة'],
      ['family', 'الحاضرون من الأسرة'],
    ];
    body = (
      <div className="grid2">
        <section className="panel">
          <h3>محاضر اللقاءات</h3>
          {M.length ? (
            M.map((m) => (
              <div key={m.id} className="card">
                <b>{m.reason}</b>
                <time>
                  {fmtDate(m.date)} · طلبه: {m.requested_by}
                </time>
                <span>
                  <b>الحاضرون:</b> {m.school_attendees} / {m.family_attendees}
                </span>
                <span>
                  <b>النقاط:</b> {m.discussed_points}
                </span>
                <span>
                  <b>الإجراءات:</b> {m.agreed_measures}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">لا توجد لقاءات مسجلة.</p>
          )}
        </section>
        <section className="panel">
          <h3>محضر لقاء جديد</h3>
          {fields.map(([k, l]) => (
            <label key={k} className="fld">
              {l}
              <input
                type={k === 'date' ? 'date' : 'text'}
                id={`mt-${k}`}
                value={mt[k]}
                onChange={(e) => setMt({ ...mt, [k]: e.target.value })}
              />
            </label>
          ))}
          <label className="fld">
            النقاط التي نوقشت
            <textarea
              id="mt-points"
              rows={3}
              value={mt.points}
              onChange={(e) => setMt({ ...mt, points: e.target.value })}
            />
          </label>
          <label className="fld">
            الإجراءات المتفق عليها
            <textarea
              id="mt-measures"
              rows={3}
              value={mt.measures}
              onChange={(e) => setMt({ ...mt, measures: e.target.value })}
            />
          </label>
          <button
            className="btn primary"
            onClick={() => {
              const r = recordMeeting(
                life,
                {
                  student_id: s.id,
                  reason: mt.reason,
                  date: mt.date,
                  requested_by: mt.by,
                  school_attendees: mt.school,
                  family_attendees: mt.family,
                  discussed_points: mt.points,
                  agreed_measures: mt.measures,
                },
                `m${uid()}`,
                today,
              );
              if (apply(r, 'حُفظ المحضر'))
                setMt({
                  reason: '',
                  date: todayISO(),
                  by: '',
                  school: '',
                  family: '',
                  points: '',
                  measures: '',
                });
            }}
          >
            حفظ المحضر
          </button>
        </section>
      </div>
    );
  } else if (tab === 'docs') {
    const D = state.docs.filter((d) => d.student_id === s.id);
    body = (
      <section className="panel">
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <h3>وثائق التلميذ</h3>
          <label className="btn sm primary">
            + إضافة وثيقة
            <input
              type="file"
              id="doc-file"
              className="sr"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const ext = (f.name.split('.').pop() ?? '').toLowerCase();
                const kind =
                  ext === 'pdf'
                    ? 'PDF'
                    : /^(png|jpe?g|webp|heic)$/.test(ext)
                      ? 'صورة'
                      : ext.toUpperCase();
                update((x) => ({
                  ...x,
                  docs: [
                    ...x.docs,
                    {
                      id: uid(),
                      student_id: s.id,
                      name: f.name,
                      kind,
                      size: f.size,
                      date: todayISO(),
                    },
                  ],
                }));
                toast('أُضيفت الوثيقة');
              }}
            />
          </label>
        </div>
        <p className="hint">
          في هذه المرحلة يُحفظ اسم الوثيقة ونوعها فقط. في المنصة الحقيقية تُحفظ الملفات على S3.
        </p>
        <div className="list">
          {D.length ? (
            D.map((d) => (
              <div key={d.id} className="row" style={{ cursor: 'default' }}>
                <span>
                  <b>{d.name}</b>
                  <br />
                  <span className="meta">
                    {d.kind} · {Math.max(1, Math.round(d.size / 1024))} ك.ب · {fmtDate(d.date)}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <p className="muted">
              لا توجد وثائق. الوثائق المعتادة: عقد الازدياد، الصور، شهادة المغادرة، الشهادة الطبية.
            </p>
          )}
        </div>
      </section>
    );
  } else
    body = (
      <section className="panel">
        <h3>النقط والبيان</h3>
        <p className="muted">
          وحدة النقط من المرحلة 2: إدخال النقط من الأستاذ، المعدلات بالمعاملات الرسمية، البيان PDF،
          وتصدير مسار.
        </p>
      </section>
    );
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={`ملف ${name}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet">
        <header className="mhead">
          <div className="toolbar">
            <Avatar name={name} gender={s.gender} size={52} />
            <div>
              <h2>{name}</h2>
              <p className="hint">
                {cName(s.class_id)} · رقم التسجيل {s.matricule}
                {s.status === 'archived' ? ' · مؤرشف' : ''}
              </p>
            </div>
          </div>
          <button className="btn sm ghost" aria-label="إغلاق" onClick={onClose}>
            ✕ إغلاق
          </button>
        </header>
        <div className="chips subtabs">
          {tabs.map(([k, n]) => (
            <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
              {n}
            </button>
          ))}
        </div>
        {body}
      </div>
    </div>
  );
}

/** نموذج تسجيل حادثة (incidentForm): بدون تلميذ محدد يظهر اختيار التلميذ. */
export function IncidentForm({ studentId }: { studentId?: string }) {
  const { life, cName, apply } = useLife();
  const act = life.students.filter((s) => s.status === 'active');
  const blank = {
    sid: act[0]?.id ?? '',
    title: '',
    type: 'negative' as Incident['type'],
    gravity: 'light' as Incident['gravity'],
    measure: INCIDENT_MEASURES[0] as string,
    date: todayISO(),
    desc: '',
    pub: true,
  };
  const [F, setF] = useState(blank);
  const sid = studentId ?? F.sid;
  const save = () => {
    const now = new Date();
    const r = recordIncident(
      life,
      {
        student_id: sid,
        title: F.title,
        type: F.type,
        gravity: F.gravity,
        measure: F.measure,
        date: F.date || todayISO(),
        time: now.toTimeString().slice(0, 5),
        description: F.desc,
        visible_to_parent: F.pub,
      },
      `i${uid()}`,
    );
    if (!r.ok) {
      apply(r);
      return;
    }
    const pts = behaviorPoints(r.life.incidents, sid);
    if (apply(r, `سُجّلت الحادثة · ${pts}/20 نقطة${F.pub ? ' · أُشعر الولي' : ''}`))
      setF({ ...blank, sid: F.sid });
  };
  return (
    <>
      <h3>تسجيل حادثة أو سلوك</h3>
      {!studentId && (
        <label className="fld">
          التلميذ
          <select id="in-sid" value={F.sid} onChange={(e) => setF({ ...F, sid: e.target.value })}>
            {act.map((s) => (
              <option key={s.id} value={s.id}>
                {studentName(s)} · {cName(s.class_id)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="fld">
        العنوان
        <input
          type="text"
          id="in-title"
          value={F.title}
          placeholder="مثال: شجار في الساحة"
          onChange={(e) => setF({ ...F, title: e.target.value })}
        />
      </label>
      <div className="grid2" style={{ gap: 8 }}>
        <label className="fld">
          النوع
          <select
            id="in-type"
            value={F.type}
            onChange={(e) => setF({ ...F, type: e.target.value as Incident['type'] })}
          >
            <option value="negative">سلوك سلبي</option>
            <option value="positive">سلوك إيجابي</option>
          </select>
        </label>
        <label className="fld">
          الخطورة
          <select
            id="in-grav"
            value={F.gravity}
            onChange={(e) => setF({ ...F, gravity: e.target.value as Incident['gravity'] })}
          >
            <option value="light">خفيفة (−1)</option>
            <option value="medium">متوسطة (−2)</option>
            <option value="serious">خطيرة (−4)</option>
          </select>
        </label>
        <label className="fld">
          الإجراء
          <select
            id="in-measure"
            value={F.measure}
            onChange={(e) => setF({ ...F, measure: e.target.value })}
          >
            {INCIDENT_MEASURES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          التاريخ
          <input
            type="date"
            id="in-date"
            value={F.date}
            onChange={(e) => setF({ ...F, date: e.target.value })}
          />
        </label>
      </div>
      <label className="fld">
        الوصف
        <textarea
          id="in-desc"
          rows={3}
          value={F.desc}
          onChange={(e) => setF({ ...F, desc: e.target.value })}
        />
      </label>
      <label className="opt" style={{ paddingInline: 0 }}>
        <input
          type="checkbox"
          id="in-pub"
          checked={F.pub}
          onChange={(e) => setF({ ...F, pub: e.target.checked })}
        />
        <span>إشعار الولي في التطبيق</span>
      </label>
      <button className="btn primary" onClick={save}>
        حفظ
      </button>
    </>
  );
}

/** تلميذ جديد (viewStuNew). [قرار معلق: ربط الولي بالهاتف بدل الاسم.] */
function NewStudent({
  classId,
  onClose,
  onSaved,
}: {
  classId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { life, model, apply } = useLife();
  const classes = model.school.classes;
  const [F, setF] = useState({
    first_name: '',
    last_name: '',
    class_id: classId || classes[0]?.id || '',
    gender: 'm' as 'm' | 'f',
    birth_date: '',
    parent_name: '',
    parent_phone: '',
  });
  const set = (k: keyof typeof F) => (e: { target: { value: string } }) =>
    setF({ ...F, [k]: e.target.value });
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="تلميذ جديد"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet small">
        <header className="mhead">
          <h2>تلميذ جديد</h2>
          <button className="btn sm ghost" aria-label="إغلاق" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="grid2" style={{ gap: 10 }}>
          <label className="fld">
            الاسم
            <input
              type="text"
              id="sn-fn"
              value={F.first_name}
              onChange={set('first_name')}
              autoFocus
            />
          </label>
          <label className="fld">
            النسب
            <input type="text" id="sn-ln" value={F.last_name} onChange={set('last_name')} />
          </label>
          <label className="fld">
            القسم
            <select id="sn-cls" value={F.class_id} onChange={set('class_id')}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            الجنس
            <select id="sn-g" value={F.gender} onChange={set('gender')}>
              <option value="m">ذكر</option>
              <option value="f">أنثى</option>
            </select>
          </label>
          <label className="fld">
            تاريخ الازدياد
            <input type="date" id="sn-birth" value={F.birth_date} onChange={set('birth_date')} />
          </label>
          <label className="fld">
            اسم الولي
            <input
              type="text"
              id="sn-pn"
              value={F.parent_name}
              onChange={set('parent_name')}
              list="sn-plist"
            />
            <datalist id="sn-plist">
              {life.parents.map((p) => (
                <option key={p.id} value={p.full_name} />
              ))}
            </datalist>
          </label>
          <label className="fld">
            هاتف الولي
            <input
              type="tel"
              id="sn-pp"
              value={F.parent_phone}
              onChange={set('parent_phone')}
              dir="ltr"
            />
          </label>
        </div>
        <p className="hint">إذا كان الولي مسجلا باسمه، يُربط التلميذ به تلقائيا مع إخوته.</p>
        <button
          className="btn primary"
          onClick={() => {
            const sid = `e${uid()}`;
            const r = addStudent(
              life,
              F,
              { student_id: sid, parent_id: `p${uid()}` },
              classes.length > 0,
            );
            if (apply(r)) onSaved(sid);
          }}
        >
          حفظ التلميذ
        </button>
      </div>
    </div>
  );
}
