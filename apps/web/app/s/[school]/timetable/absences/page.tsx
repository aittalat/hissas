'use client';

import {
  DAY_NAMES_AR,
  SUBSTITUTION_LABEL,
  TEACHER_ABSENCE_REASONS,
  analyzeAbsence,
  approveAbsence,
  compensationLedger,
  makeGrid,
  periodTimes,
  substitutionTexts,
  type AffectedLesson,
  type SchoolDay,
} from '@hissas/shared';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { uid } from '@/lib/demo';
import { useSchoolCtx } from '@/lib/school';

/** اليوم الافتراضي: اليوم الحالي إذا كان يوم دراسة (defDay/fixDay). */
function defaultDay(active: readonly number[]): number {
  const d = (new Date().getDay() + 6) % 7;
  return active.includes(d) ? d : (active[0] ?? 0);
}

/** غياب الأساتذة والتعويض (viewAbs، SPEC §7.8). اليوم = يوم الأسبوع [قرار معلق: التاريخ]. */
export default function AbsencesPage() {
  const { state, model, placed, update, notify } = useSchoolCtx();
  const toast = useToast();
  const { school } = state;
  const active = makeGrid(school.config).activeDays;
  const [tid, setTid] = useState(school.teachers[0]?.id ?? '');
  const [day, setDay] = useState(() => defaultDay(active));
  const [reason, setReason] = useState<string>(TEACHER_ABSENCE_REASONS[0]);
  const [rows, setRows] = useState<{ tid: string; day: number; lessons: AffectedLesson[] } | null>(
    null,
  );
  const [choices, setChoices] = useState<number[]>([]);
  const t = school.teachers.find((x) => x.id === tid) ?? school.teachers[0];
  const d = active.includes(day) ? day : (active[0] ?? 0);
  const times = periodTimes(school.config);
  const tl = (p: number) => times[p]?.[0] ?? '--:--';
  const tName = (id: string | null | undefined) => {
    const x = school.teachers.find((y) => y.id === id);
    return (x && model.person(x.person_id)?.full_name) ?? '';
  };
  const cName = (c: string) => school.classes.find((x) => x.id === c)?.name ?? c;
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  const ctx = { absences: state.absences, substitutions: state.substitutions };
  const ledger = [...compensationLedger(ctx)].filter(
    ([k, v]) => school.teachers.some((x) => x.id === k) && (v.sub || v.abs),
  );

  const analyze = () => {
    if (!t) return;
    if (state.absences.some((a) => a.teacher_id === t.id && a.day === d)) {
      toast('هذا الغياب معتمد من قبل');
      return;
    }
    const lessons = analyzeAbsence(model, placed, t.id, d, ctx);
    setRows({ tid: t.id, day: d, lessons });
    setChoices(lessons.map(() => 0));
  };

  const approve = () => {
    if (!rows) return;
    const absence = { id: uid(), teacher_id: rows.tid, day: rows.day, reason };
    const r = approveAbsence(model, absence, rows.lessons, choices);
    update((s) => ({
      ...s,
      absences: [...s.absences, absence],
      substitutions: [...s.substitutions, ...r.substitutions],
    }));
    for (const n of r.notices) notify({ ...n, darija: n.darija ?? '' });
    setRows(null);
    toast('اعتُمد التعويض وأُشعر الأساتذة والأولياء');
  };

  const cancel = (id: string) => {
    update((s) => ({
      ...s,
      absences: s.absences.filter((a) => a.id !== id),
      substitutions: s.substitutions.filter((x) => x.absence_id !== id),
    }));
    toast('أُلغي الغياب ورجع الجدول كما كان');
  };

  return (
    <div className="split">
      <section className="panel">
        <h2>تصريح بغياب أستاذ</h2>
        <label className="fld">
          الأستاذ
          <select
            id="abs-t"
            value={t?.id ?? ''}
            onChange={(e) => {
              setTid(e.target.value);
              setRows(null);
            }}
          >
            {school.teachers.map((x) => (
              <option key={x.id} value={x.id}>
                {tName(x.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          اليوم
          <select
            id="abs-d"
            value={d}
            onChange={(e) => {
              setDay(Number(e.target.value));
              setRows(null);
            }}
          >
            {active.map((i) => (
              <option key={i} value={i}>
                {DAY_NAMES_AR[i as SchoolDay]}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          السبب
          <select id="abs-r" value={reason} onChange={(e) => setReason(e.target.value)}>
            {TEACHER_ABSENCE_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button className="btn primary" onClick={analyze}>
          عرض الحصص المتأثرة
        </button>
        <h3>ساعات التعويض هذا الأسبوع</h3>
        {ledger.length ? (
          <>
            <table className="plain">
              <thead>
                <tr>
                  <th>الأستاذ</th>
                  <th>عوّض</th>
                  <th>غاب</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(([k, v]) => (
                  <tr key={k}>
                    <td>{tName(k)}</td>
                    <td className="num">{v.sub}</td>
                    <td className="num">{v.abs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">تُحتسب هذه الساعات تلقائيا في كشف أجور الأساتذة العرضيين.</p>
          </>
        ) : (
          <p className="hint">لا توجد تعويضات بعد.</p>
        )}
      </section>
      <section className="panel">
        {rows ? (
          <>
            <h2>
              {tName(rows.tid)} · {DAY_NAMES_AR[rows.day as SchoolDay]}
            </h2>
            {!rows.lessons.length ? (
              <p className="muted">لا توجد حصص لهذا الأستاذ في هذا اليوم.</p>
            ) : (
              <>
                <p className="hint">
                  {rows.lessons.length} حصص متأثرة. اختر حلا لكل حصة، ثم اعتمد لإشعار الأساتذة
                  والأولياء.
                </p>
                {rows.lessons.map((r, i) => (
                  <div className="affected" key={`${r.period}-${r.class_id}`}>
                    <header>
                      <h3>
                        {tl(r.period)} · {cName(r.class_id)} · {sh(r.subject)}
                      </h3>
                      {r.len === 2 && <span className="tag acc">حصتان</span>}
                    </header>
                    {r.options.map((o, j) => {
                      const x = substitutionTexts(model, r, o, rows.day);
                      return (
                        <label className="opt" key={j}>
                          <input
                            type="radio"
                            name={`ao${i}`}
                            checked={choices[i] === j}
                            onChange={() => setChoices((c) => c.map((v, k) => (k === i ? j : v)))}
                          />
                          <span>
                            {x.label} {x.best && <span className="tag acc">الأفضل</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
                <div className="toolbar">
                  <button className="btn primary" onClick={approve}>
                    اعتماد وإشعار الجميع
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          !state.absences.length && (
            <>
              <h2>التعويض التلقائي</h2>
              <p className="muted">
                اختر أستاذا ويوما لترى الحصص المتأثرة والبدائل المرتبة: أستاذ نفس المادة، ثم حصة
                مراجعة، ثم تقديم حصة لاحقة، ثم الإلغاء.
              </p>
            </>
          )
        )}
        {state.absences.length > 0 && (
          <>
            <h3>الغيابات المعتمدة</h3>
            <div className="list">
              {state.absences.map((a) => {
                const ss = state.substitutions.filter((s) => s.absence_id === a.id);
                return (
                  <div className="row" style={{ cursor: 'default' }} key={a.id}>
                    <span>
                      <b>{tName(a.teacher_id)}</b> · {DAY_NAMES_AR[a.day as SchoolDay]} · {a.reason}
                      <br />
                      <span className="meta">
                        {ss.map((s) => `${tl(s.period)} ${SUBSTITUTION_LABEL[s.type]}`).join('، ')}
                      </span>
                    </span>
                    <button className="btn sm ghost" onClick={() => cancel(a.id)}>
                      إلغاء
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
