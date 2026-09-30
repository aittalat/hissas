'use client';

import { incidentDelta, lowBehavior, studentName } from '@hissas/shared';
import { IncidentForm, useModals } from '@/components/life/modals';
import { PanelHead } from '@/components/life/ui';
import { fmtDate, useLife } from '@/lib/life';

/** الانضباط (viewDiscipline): نموذج الحادثة، تلاميذ تحت 16 نقطة، كل الحوادث. */
export default function DisciplinePage() {
  const { life, cName } = useLife();
  const { openStudent } = useModals();
  const I = [...life.incidents].sort((a, b) => b.date.localeCompare(a.date));
  const low = lowBehavior(life);
  const byId = new Map(life.students.map((s) => [s.id, s]));
  return (
    <>
      <PanelHead title="الانضباط" sub="نظام نقاط السلوك: 20 نقطة لكل تلميذ في بداية السنة." />
      <div className="grid2">
        <section className="panel">
          <IncidentForm />
        </section>
        <section className="panel">
          <h3>تلاميذ تحت 16 نقطة</h3>
          {low.length ? (
            <div className="list">
              {low.map(({ student: s, points }) => (
                <button key={s.id} className="row" onClick={() => openStudent(s.id, 'disc')}>
                  <span>
                    {studentName(s)} · <span className="meta">{cName(s.class_id)}</span>
                  </span>
                  <span className={`tag ${points < 10 ? 'bad' : ''}`}>{points}/20</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">كل التلاميذ فوق 16 نقطة.</p>
          )}
          <h3>كل الحوادث ({I.length})</h3>
          <div className="list">
            {I.length ? (
              I.map((i) => {
                const d = incidentDelta(i);
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
                        {studentName(byId.get(i.student_id))} · {fmtDate(i.date)} · {i.measure}
                      </span>
                    </span>
                    <span className={`tag ${i.type === 'positive' ? 'acc' : 'bad'}`}>
                      {d > 0 ? `+${d}` : `−${-d}`}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="muted">لا توجد حوادث.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
