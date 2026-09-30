'use client';

import { classCounts, hueOf, studentName } from '@hissas/shared';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useModals } from '@/components/life/modals';
import { Avatar, PanelHead } from '@/components/life/ui';
import { useLife } from '@/lib/life';

/** الأقسام (viewClasses): بطاقات بالأعداد، وتفاصيل القسم بتلاميذه وأساتذته. */
export default function ClassesPage() {
  const { life, model, href } = useLife();
  const { openStudent } = useModals();
  const [view, setView] = useState<string | null>(null);
  const { school } = model;
  const c = view ? school.classes.find((x) => x.id === view) : undefined;
  const act = life.students.filter((s) => s.status === 'active');
  return (
    <>
      <PanelHead title={`الأقسام (${school.classes.length})`}>
        <Link className="btn primary sm" href={href('/timetable/data')}>
          + إضافة قسم
        </Link>
      </PanelHead>
      {c &&
        (() => {
          const L = act.filter((s) => s.class_id === c.id);
          const T = [
            ...new Set(model.units.filter((u) => u.class_id === c.id).map((u) => u.teacher_id)),
          ]
            .map((id) => school.teachers.find((t) => t.id === id))
            .filter((t) => !!t);
          return (
            <section className="panel">
              <header className="mhead">
                <h3>
                  {c.name} · {L.length} تلميذا
                </h3>
                <div className="toolbar">
                  <Link className="btn sm" href={href(`/timetable?c=${c.id}`)}>
                    جدول الحصص
                  </Link>
                  <button className="btn sm ghost" aria-label="إغلاق" onClick={() => setView(null)}>
                    ✕
                  </button>
                </div>
              </header>
              <div className="grid2">
                <div>
                  <h3>التلاميذ</h3>
                  <div className="list">
                    {L.length ? (
                      L.map((s) => (
                        <button key={s.id} className="row" onClick={() => openStudent(s.id)}>
                          <span className="toolbar">
                            <Avatar name={studentName(s)} gender={s.gender} size={30} />
                            {studentName(s)}
                          </span>
                          <span className="meta">{s.matricule}</span>
                        </button>
                      ))
                    ) : (
                      <p className="muted">لا يوجد تلاميذ.</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3>الأساتذة</h3>
                  <div className="list">
                    {T.length ? (
                      T.map((t) => (
                        <div key={t.id} className="row" style={{ cursor: 'default' }}>
                          <span>{model.person(t.person_id)?.full_name}</span>
                          <span className="meta">
                            {school.subjects.find((s) => s.key === t.subject)?.short} ·{' '}
                            {t.classes.find((x) => x.class_id === c.id)?.hours ?? 0} س
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="muted">لا يوجد أساتذة.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}
      <div className="cards">
        {school.classes.map((x) => {
          const n = classCounts(life, x.id);
          return (
            <button
              key={x.id}
              className="pcard ccard"
              style={{ '--h': hueOf(x.name) } as CSSProperties}
              onClick={() => {
                setView(x.id);
                window.scrollTo(0, 0);
              }}
            >
              <span className="cname">{x.name}</span>
              <span className="meta">{n.total} تلميذا</span>
              <span className="gs">
                <span>♂ {n.m}</span>
                <span>♀ {n.f}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
