'use client';

import {
  dayIndex,
  earlyWarnings,
  incidentDelta,
  latestIncidents,
  slotLabel,
  studentName,
  todaySummary,
} from '@hissas/shared';
import Link from 'next/link';
import { Avatar, PanelHead } from '@/components/life/ui';
import { useModals } from '@/components/life/modals';
import { fmtDate, useLife } from '@/lib/life';

/** لوحة اليوم (viewHome، SPEC §7.10). */
export default function HomePage() {
  const { life, today, cName, state, model, placed, href } = useLife();
  const { openStudent } = useModals();
  const sum = todaySummary(life, today);
  const di = dayIndex(today);
  const tAbs = state.absences.filter((a) => a.day === di);
  const alerts = earlyWarnings(life, today);
  const inc = latestIncidents(life);
  const byId = new Map(life.students.map((s) => [s.id, s]));
  const tName = (id: string) => {
    const t = model.school.teachers.find((x) => x.id === id);
    return (t && model.person(t.person_id)?.full_name) ?? '';
  };
  return (
    <>
      <PanelHead
        title={`لوحة اليوم · ${fmtDate(today)}`}
        sub="كل ما يحتاجه الحارس العام في صفحة واحدة."
      >
        <Link className="btn primary sm" href={href('/absences?tab=mark')}>
          تسجيل الغياب
        </Link>
        <Link className="btn sm" href={href('/discipline')}>
          تسجيل حادثة
        </Link>
        <Link className="btn sm" href={href('/comm')}>
          رسالة للأولياء
        </Link>
      </PanelHead>
      <div className="stats">
        <div className="stat ok">
          <span>الحاضرون</span>
          <b className="num">
            {sum.present}
            <small> / {sum.active}</small>
          </b>
        </div>
        <div className={`stat${sum.absent ? ' bad' : ''}`}>
          <span>الغائبون اليوم</span>
          <b className="num">{sum.absent}</b>
        </div>
        <div className="stat">
          <span>المتأخرون اليوم</span>
          <b className="num">{sum.late}</b>
        </div>
        <div className={`stat${tAbs.length ? ' bad' : ''}`}>
          <span>أساتذة غائبون</span>
          <b className="num">{tAbs.length}</b>
        </div>
      </div>
      <div className="grid2">
        <section className="panel">
          <h3>إنذار مبكر: غياب متكرر هذا الشهر</h3>
          <p className="hint">
            التلاميذ الذين بلغوا {life.rules.monthly_absence_alert} غيابات أو أكثر هذا الشهر.
          </p>
          {alerts.length ? (
            <div className="list">
              {alerts.slice(0, 6).map(({ student: s, stats }) => (
                <button key={s.id} className="row" onClick={() => openStudent(s.id)}>
                  <span className="toolbar">
                    <Avatar name={studentName(s)} gender={s.gender} size={34} />
                    <span>
                      <b>{studentName(s)}</b>
                      <br />
                      <span className="meta">{cName(s.class_id)}</span>
                    </span>
                  </span>
                  <span className="tag bad">{stats.month} غيابات</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">لا يوجد تلميذ في وضعية إنذار.</p>
          )}
        </section>
        <section className="panel">
          <h3>غياب اليوم</h3>
          {sum.records.length ? (
            <div className="list">
              {sum.records.slice(0, 8).map((a) => {
                const s = byId.get(a.student_id);
                return s ? (
                  <button key={a.id} className="row" onClick={() => openStudent(s.id)}>
                    <span className="toolbar">
                      <Avatar name={studentName(s)} gender={s.gender} size={34} />
                      <span>
                        <b>{studentName(s)}</b>
                        <br />
                        <span className="meta">
                          {cName(s.class_id)} ·{' '}
                          {slotLabel(model, placed, s.class_id, a.date, a.period)}
                        </span>
                      </span>
                    </span>
                    <span className={`tag ${a.type === 'late' ? '' : 'bad'}`}>
                      {a.type === 'late' ? `تأخر ${a.late_minutes} د` : 'غائب'}
                    </span>
                  </button>
                ) : null;
              })}
            </div>
          ) : (
            <p className="muted">لم يُسجل أي غياب اليوم.</p>
          )}
        </section>
        <section className="panel">
          <h3>الأساتذة الغائبون اليوم</h3>
          {tAbs.length ? (
            <div className="list">
              {tAbs.map((a) => (
                <div key={a.id} className="row" style={{ cursor: 'default' }}>
                  <span>
                    <b>{tName(a.teacher_id)}</b>
                    <br />
                    <span className="meta">{a.reason}</span>
                  </span>
                  <span className="tag acc">
                    {state.substitutions.filter((s) => s.absence_id === a.id).length} حصص معالجة
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">لا يوجد أستاذ غائب اليوم.</p>
          )}
          <Link className="btn sm" href={href('/timetable/absences')}>
            تصريح بغياب أستاذ
          </Link>
        </section>
        <section className="panel">
          <h3>آخر الحوادث</h3>
          {inc.length ? (
            <div className="list">
              {inc.map((i) => {
                const s = byId.get(i.student_id);
                return (
                  <button
                    key={i.id}
                    className="row"
                    onClick={() => openStudent(i.student_id, 'disc')}
                  >
                    <span>
                      <b>{i.title}</b>
                      <br />
                      <span className="meta">
                        {studentName(s)} · {s ? cName(s.class_id) : ''} · {fmtDate(i.date)}
                      </span>
                    </span>
                    <span className={`tag ${i.type === 'positive' ? 'acc' : 'bad'}`}>
                      {i.type === 'positive' ? 'إيجابي' : `−${-incidentDelta(i)} نقطة`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="muted">لا توجد حوادث.</p>
          )}
        </section>
      </div>
    </>
  );
}
