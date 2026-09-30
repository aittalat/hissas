'use client';

import { norm, teacherCards, teacherReport } from '@hissas/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, PanelHead, SearchBox, SubTabs, useSubTab } from '@/components/life/ui';
import { useLife } from '@/lib/life';

const TABS = [
  ['list', 'الأساتذة'],
  ['reports', 'التقارير'],
] as const;

/** الأساتذة (viewTeachers): البطاقات، والتقرير البيداغوجي. */
export default function TeachersPage() {
  const { model, state, href } = useLife();
  const tab = useSubTab(TABS);
  const [q, setQ] = useState('');
  const cards = teacherCards(model);
  return (
    <>
      <PanelHead title={`الأساتذة (${cards.length})`}>
        <Link className="btn primary sm" href={href('/timetable/data?new=1')}>
          + إضافة أستاذ
        </Link>
      </PanelHead>
      <SubTabs items={TABS} current={tab} />
      {tab === 'reports' ? (
        <section className="panel">
          <h3>التوزيع البيداغوجي والساعات</h3>
          <div className="tt-wrap" style={{ border: 0 }}>
            <table className="plain">
              <thead>
                <tr>
                  {[
                    'الأستاذ',
                    'المادة',
                    'الأقسام',
                    'الساعات',
                    'غيابات',
                    'ساعات تعويض',
                    'متواجد',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teacherReport(model, state.absences, state.substitutions).map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} />
          </div>
          <div className="cards">
            {cards
              .filter((x) => !q || norm(x.name).includes(norm(q)))
              .map((x) => (
                <Link
                  key={x.person_id}
                  className="pcard"
                  href={href(`/timetable/data?t=${x.teacher_id}`)}
                >
                  <Avatar name={x.name} />
                  <b>{x.name}</b>
                  <span className="meta">{x.subjects.join(' · ')}</span>
                  <span className={`tag${x.present ? ' acc' : ''}`}>
                    {x.hours} ساعة{x.present ? ' · متواجد' : ''}
                  </span>
                </Link>
              ))}
          </div>
        </>
      )}
    </>
  );
}
