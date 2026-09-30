'use client';

import {
  STUDENT_LISTS,
  absenceStats,
  listData,
  listTableHtml,
  schoolYear,
  searchStudents,
  studentName,
  type StudentListKey,
} from '@hissas/shared';
import { useState } from 'react';
import { useModals } from '@/components/life/modals';
import {
  Avatar,
  ClassFilter,
  PanelHead,
  SearchBox,
  SubTabs,
  useSubTab,
} from '@/components/life/ui';
import { useLife } from '@/lib/life';
import { download, writeWorkbook } from '@/lib/xlsx';

const TABS = [
  ['active', 'النشطون'],
  ['archived', 'المؤرشفون'],
  ['lists', 'القوائم والتقارير'],
] as const;

/** التلاميذ (viewStudents + viewLists). */
export default function StudentsPage() {
  const { life, today, cName, model } = useLife();
  const { openStudent, openNewStudent } = useModals();
  const tab = useSubTab(TABS);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [more, setMore] = useState(false);
  const L = tab === 'lists' ? [] : searchStudents(life, { status: tab, q, class_id: cls });
  return (
    <>
      <PanelHead title={`التلاميذ (${life.students.filter((s) => s.status === 'active').length})`}>
        <button className="btn primary sm" onClick={() => openNewStudent(cls)}>
          + إضافة تلميذ
        </button>
      </PanelHead>
      <SubTabs items={TABS} current={tab} />
      {tab === 'lists' ? (
        <Lists />
      ) : (
        <>
          <div className="toolbar">
            <SearchBox
              value={q}
              placeholder="بحث بالاسم أو رقم التسجيل"
              onChange={(v) => {
                setQ(v);
                setMore(false);
              }}
            />
            <ClassFilter
              classes={model.school.classes}
              value={cls}
              onChange={(v) => {
                setCls(v);
                setMore(false);
              }}
            />
          </div>
          {!L.length ? (
            <p className="muted">
              {life.students.length
                ? 'لا توجد نتائج.'
                : 'لا يوجد تلاميذ بعد. أضف تلميذا أو استورد اللائحة.'}
            </p>
          ) : (
            <>
              <div className="cards">
                {L.slice(0, more ? undefined : 48).map((s) => {
                  const st = absenceStats(life.attendance, s.id, today);
                  return (
                    <button key={s.id} className="pcard" onClick={() => openStudent(s.id)}>
                      {st.month >= life.rules.monthly_absence_alert && (
                        <i className="dot" title="إنذار غياب" />
                      )}
                      <Avatar name={studentName(s)} gender={s.gender} />
                      <b>{studentName(s)}</b>
                      <span className="meta">
                        {cName(s.class_id)} · {s.matricule}
                      </span>
                    </button>
                  );
                })}
              </div>
              {L.length > 48 && !more && (
                <button className="btn sm ghost" onClick={() => setMore(true)}>
                  عرض الكل ({L.length})
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function Lists() {
  const { life, model, meta, toast } = useLife();
  const [open, setOpen] = useState<StudentListKey | null>(null);
  const L = open && STUDENT_LISTS.find((x) => x[0] === open);
  if (open && L) {
    const { H, R } = listData(open, life, model.school);
    return (
      <>
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <button className="btn sm ghost" onClick={() => setOpen(null)}>
            ← كل القوائم
          </button>
          <span className="toolbar">
            <button
              className="btn sm"
              onClick={() =>
                void writeWorkbook([
                  {
                    name: 'Liste',
                    rows: [[`${model.school.name} · ${schoolYear()}`], [L[1]], H, ...R],
                    merges: [],
                    cols: H.map(() => 20),
                  },
                ])
                  .then((b) => {
                    download(`liste-${open}.xlsx`, b);
                    toast('تم حفظ الملف');
                  })
                  .catch(() => toast('تعذّر حفظ الملف'))
              }
            >
              Excel
            </button>
            <button
              className="btn sm"
              onClick={() => {
                download(`liste-${open}.html`, listTableHtml(meta, L[1], H, R));
                toast('تم حفظ الملف');
              }}
            >
              للطباعة
            </button>
          </span>
        </div>
        <section className="panel">
          <h3>
            {L[1]} <span className="tag acc">{R.length}</span>
          </h3>
          <div className="tt-wrap" style={{ border: 0 }}>
            <table className="plain">
              <thead>
                <tr>
                  {H.map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {R.length ? (
                  R.map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={H.length} className="muted">
                      لا توجد بيانات.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }
  const groups = [...new Set(STUDENT_LISTS.map((x) => x[2]))];
  return (
    <div className="lgrid">
      {groups.map((g) => (
        <section key={g} className="panel">
          <h3>{g}</h3>
          <div className="list">
            {STUDENT_LISTS.filter((x) => x[2] === g).map((x) => (
              <button key={x[0]} className="row" onClick={() => setOpen(x[0])}>
                <span>{x[1]}</span>
                <span className="meta">{listData(x[0], life, model.school).R.length}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
