'use client';

import { incidentDelta, lowBehavior, studentName } from '@hissas/shared';
import { Plus, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { IncidentDialog, useModals } from '@/components/life/modals';
import { usePhoto } from '@/components/life/photo';
import { Avatar, PageHeader } from '@/components/life/ui';
import { fmtDate, useLife } from '@/lib/life';

/** الانضباط (viewDiscipline): تسجيل حادثة، تلاميذ تحت 16 نقطة، كل الحوادث. */
export default function DisciplinePage() {
  const { life, cName } = useLife();
  const { openStudent } = useModals();
  const photo = usePhoto();
  const [add, setAdd] = useState(false);
  const I = [...life.incidents].sort((a, b) => b.date.localeCompare(a.date));
  const low = lowBehavior(life);
  const byId = new Map(life.students.map((s) => [s.id, s]));
  return (
    <>
      <PageHeader
        icon={ShieldAlert}
        tone="var(--p-pink)"
        title="الانضباط"
        sub="نظام نقاط السلوك: 20 نقطة لكل تلميذ في بداية السنة."
      >
        <button className="btn primary" onClick={() => setAdd(true)}>
          <Plus aria-hidden size={16} style={{ verticalAlign: -3 }} /> تسجيل حادثة
        </button>
      </PageHeader>
      <div className="grid2">
        <section className="panel">
          <h3>كل الحوادث ({I.length})</h3>
          <div className="list">
            {I.length ? (
              I.map((i) => {
                const d = incidentDelta(i);
                const s = byId.get(i.student_id);
                return (
                  <button
                    key={i.id}
                    className="row"
                    onClick={() => openStudent(i.student_id, 'disc')}
                  >
                    <span className="toolbar" style={{ flexWrap: 'nowrap' }}>
                      {s && (
                        <Avatar
                          name={studentName(s)}
                          gender={s.gender}
                          photo={photo(s)}
                          size={38}
                        />
                      )}
                      <span>
                        <b>{i.title}</b>
                        <br />
                        <span className="meta">
                          {studentName(s)} · {fmtDate(i.date)} · {i.measure}
                        </span>
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
        <section className="panel">
          <h3>تلاميذ تحت 16 نقطة</h3>
          {low.length ? (
            <div className="list">
              {low.map(({ student: s, points }) => (
                <button key={s.id} className="row" onClick={() => openStudent(s.id, 'disc')}>
                  <span className="toolbar" style={{ flexWrap: 'nowrap' }}>
                    <Avatar name={studentName(s)} gender={s.gender} photo={photo(s)} size={38} />
                    <span>
                      {studentName(s)} · <span className="meta">{cName(s.class_id)}</span>
                    </span>
                  </span>
                  <span className={`tag ${points < 10 ? 'bad' : ''}`}>{points}/20</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">كل التلاميذ فوق 16 نقطة.</p>
          )}
        </section>
      </div>
      {add && <IncidentDialog onClose={() => setAdd(false)} />}
    </>
  );
}
