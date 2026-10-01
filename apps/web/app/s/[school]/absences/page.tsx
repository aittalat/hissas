'use client';

import {
  ABSENCE_REASONS,
  absenceList,
  absenceTracking,
  lessonPeriods,
  periodTimes,
  recordAttendance,
  slotLabel,
  studentName,
  updateAttendance,
} from '@hissas/shared';
import { useState } from 'react';
import { useModals } from '@/components/life/modals';
import { UserX } from 'lucide-react';
import { usePhoto } from '@/components/life/photo';
import { Avatar, ClassFilter, PageHeader, useSubTab } from '@/components/life/ui';
import { uid } from '@/lib/demo';
import { fmtDate, useLife } from '@/lib/life';

const TABS = [
  ['list', 'لائحة الغياب'],
  ['mark', 'تسجيل الغياب'],
  ['track', 'التتبع'],
] as const;

/** غياب وتأخر التلاميذ (viewAbsences). */
export default function AbsencesPage() {
  const tab = useSubTab(TABS);
  return (
    <>
      <PageHeader
        icon={UserX}
        tone="var(--p-pink)"
        title="غياب وتأخر التلاميذ"
        sub="كل غياب يُرسَل للولي في التطبيق وبرسالة صوتية بالدارجة."
        tabs={TABS}
        current={tab}
      />
      {tab === 'mark' ? <Mark /> : tab === 'track' ? <Track /> : <List />}
    </>
  );
}

function Mark() {
  const { life, model, placed, today, apply } = useLife();
  const photo = usePhoto();
  const classes = model.school.classes;
  const [cls, setCls] = useState(classes[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState<number | null>(null);
  const [marks, setMarks] = useState<Record<string, 'absent' | 'late'>>({});
  const [mins, setMins] = useState<Record<string, number>>({});
  const c = classes.some((x) => x.id === cls) ? cls : (classes[0]?.id ?? '');
  const d = date || today;
  const slots = lessonPeriods(model, placed, c, d);
  const all = slots.length ? slots : [...Array(model.grid.periods).keys()];
  const p = period !== null && slots.includes(period) ? period : (slots[0] ?? 0);
  const students = life.students.filter((x) => x.status === 'active' && x.class_id === c);
  const n = Object.keys(marks).length;
  const save = () => {
    const r = recordAttendance(
      life,
      {
        class_id: c,
        date: d,
        period: p,
        marks: Object.entries(marks).map(([student_id, type]) => ({
          student_id,
          type,
          minutes: mins[student_id] ?? 10,
        })),
      },
      slotLabel(model, placed, c, d, p),
      periodTimes(model.school.config)[p]?.[0] ?? '--:--',
      () => `a${uid()}`,
    );
    if (apply(r)) {
      setMarks({});
      setMins({});
    }
  };
  return (
    <section className="panel">
      <div className="toolbar">
        <label className="fld">
          القسم
          <select
            id="mk-cls"
            value={c}
            onChange={(e) => {
              setCls(e.target.value);
              setMarks({});
              setMins({});
            }}
          >
            {classes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          التاريخ
          <input type="date" id="mk-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="fld">
          الحصة
          <select id="mk-p" value={p} onChange={(e) => setPeriod(Number(e.target.value))}>
            {all.map((q) => (
              <option key={q} value={q}>
                {slotLabel(model, placed, c, d, q)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">كل التلاميذ حاضرون افتراضيا. اضغط فقط على الغائبين أو المتأخرين.</p>
      <div className="list">
        {students.map((s) => {
          const r = marks[s.id] ?? '';
          const set = (v: '' | 'absent' | 'late') =>
            setMarks((m) => {
              const x = { ...m };
              if (v) x[s.id] = v;
              else delete x[s.id];
              return x;
            });
          return (
            <div key={s.id} className="row" style={{ cursor: 'default' }}>
              <span className="toolbar">
                <Avatar name={studentName(s)} gender={s.gender} photo={photo(s)} size={40} />
                <b>{studentName(s)}</b>
              </span>
              <span className="seg" role="group" aria-label={studentName(s)}>
                {(
                  [
                    ['', 'حاضر'],
                    ['absent', 'غائب'],
                    ['late', 'متأخر'],
                  ] as const
                ).map(([k, t]) => (
                  <button key={k} aria-pressed={r === k} onClick={() => set(k)}>
                    {t}
                  </button>
                ))}
              </span>
              {r === 'late' && (
                <label className="nt-h">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={mins[s.id] ?? 10}
                    aria-label="دقائق التأخر"
                    onChange={(e) => setMins({ ...mins, [s.id]: Number(e.target.value) })}
                  />{' '}
                  د
                </label>
              )}
            </div>
          );
        })}
      </div>
      <div className="toolbar">
        <button
          className="btn primary"
          disabled={!life.students.some((x) => x.class_id === c)}
          onClick={save}
        >
          حفظ وإشعار الأولياء{n ? ` (${n})` : ''}
        </button>
      </div>
    </section>
  );
}

function Track() {
  const { life, today, cName, setLife } = useLife();
  const { openStudent } = useModals();
  const rows = absenceTracking(life, today);
  const lim = life.rules.monthly_absence_alert;
  return (
    <section className="panel">
      <div className="toolbar">
        <label className="fld">
          حد الإنذار الشهري
          <select
            id="rule-abs"
            value={lim}
            onChange={(e) =>
              setLife((l) => ({
                ...l,
                rules: { ...l.rules, monthly_absence_alert: Number(e.target.value) },
              }))
            }
          >
            {[2, 3, 4, 5, 6, 8].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tt-wrap" style={{ border: 0 }}>
        <table className="plain">
          <thead>
            <tr>
              <th>التلميذ</th>
              <th>القسم</th>
              <th>غيابات</th>
              <th>غير مبررة</th>
              <th>تأخرات</th>
              <th>هذا الشهر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student: s, stats: st }) => (
              <tr
                key={s.id}
                tabIndex={0}
                onClick={() => openStudent(s.id)}
                onKeyDown={(e) => e.key === 'Enter' && openStudent(s.id)}
              >
                <td>{studentName(s)}</td>
                <td>{cName(s.class_id)}</td>
                <td className="num">{st.abs}</td>
                <td className="num">{st.unj}</td>
                <td className="num">{st.late}</td>
                <td className="num">
                  {st.month} {st.month >= lim && <span className="tag bad">إنذار</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function List() {
  const { life, model, placed, cName, setLife } = useLife();
  const { openStudent } = useModals();
  const [date, setDate] = useState('');
  const [cls, setCls] = useState('');
  const A = absenceList(life, { date, class_id: cls });
  const upd = (id: string, change: Parameters<typeof updateAttendance>[2]) =>
    setLife((l) => updateAttendance(l, id, change));
  return (
    <>
      <div className="toolbar">
        <ClassFilter classes={model.school.classes} value={cls} onChange={setCls} />
        <label>
          <span className="sr">التاريخ</span>
          <input type="date" id="f-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date && (
          <button className="btn sm ghost" onClick={() => setDate('')}>
            كل التواريخ
          </button>
        )}
      </div>
      <div className="tt-wrap">
        <table className="plain abs">
          <thead>
            <tr>
              {[
                'التلميذ',
                'القسم',
                'التاريخ والحصة',
                'النوع',
                'مبرر',
                'السبب',
                'ملاحظة',
                'الولي',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {A.length ? (
              A.map(({ record: a, student: s }) => (
                <tr key={a.id}>
                  <td>
                    <button className="lnk" onClick={() => openStudent(s.id)}>
                      {studentName(s)}
                    </button>
                  </td>
                  <td>{cName(s.class_id)}</td>
                  <td>
                    {fmtDate(a.date)}
                    <br />
                    <span className="meta">
                      {slotLabel(model, placed, s.class_id, a.date, a.period)}
                    </span>
                  </td>
                  <td>
                    <span className={`tag ${a.type === 'late' ? '' : 'bad'}`}>
                      {a.type === 'late' ? `تأخر ${a.late_minutes} د` : 'غائب'}
                    </span>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={a.justified}
                      aria-label="مبرر"
                      onChange={(e) => upd(a.id, { justified: e.target.checked })}
                    />
                  </td>
                  <td>
                    <select
                      value={a.reason}
                      aria-label="السبب"
                      onChange={(e) => upd(a.id, { reason: e.target.value })}
                    >
                      <option value="">—</option>
                      {ABSENCE_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      defaultValue={a.comment}
                      aria-label="ملاحظة"
                      style={{ width: 120 }}
                      onBlur={(e) =>
                        e.target.value !== a.comment && upd(a.id, { comment: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <span className="tag acc">✓ أُرسلت</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="muted">
                  لا يوجد غياب مسجل.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
