'use client';

import {
  DAY_NAMES_AR,
  SUBSTITUTION_LABEL,
  compensationLedger,
  norm,
  teacherCards,
  teacherReport,
  type SchoolDay,
} from '@hissas/shared';
import {
  ArrowRight,
  ClipboardList,
  Hourglass,
  Plus,
  Presentation,
  Repeat,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { Avatar, PageHeader, SearchBox, useSubTab } from '@/components/life/ui';
import { useLife } from '@/lib/life';
import { download, writeWorkbook } from '@/lib/xlsx';

const TABS = [
  ['list', 'الأساتذة'],
  ['reports', 'التقارير والقوائم'],
] as const;

/** الأساتذة (viewTeachers): البطاقات، ولوحة التقارير. */
export default function TeachersPage() {
  const { model, href } = useLife();
  const tab = useSubTab(TABS);
  const [q, setQ] = useState('');
  const cards = teacherCards(model);
  return (
    <>
      <PageHeader
        icon={Presentation}
        tone="var(--p-yellow)"
        title="الأساتذة"
        count={cards.length}
        tabs={TABS}
        current={tab}
      >
        {tab === 'list' && <SearchBox value={q} onChange={setQ} />}
      </PageHeader>
      {tab === 'reports' ? (
        <Reports />
      ) : (
        <div className="wgrid cards">
          <Link className="add-card" href={href('/timetable/data?new=1')}>
            <span className="plus">
              <Plus aria-hidden />
            </span>
            إضافة أستاذ
          </Link>
          {cards
            .filter((x) => !q || norm(x.name).includes(norm(q)))
            .map((x, i) => (
              <Link
                key={x.person_id}
                className={`wcard pcard tone-${(i + 2) % 6}`}
                href={href(`/timetable/data?t=${x.teacher_id}`)}
              >
                <Avatar name={x.name} size={96} ring />
                <b>{x.name}</b>
                <span className="meta">{x.subjects.join(' · ')}</span>
                <span className="sub">
                  {x.hours} ساعة{x.present ? ' · متواجد' : ''}
                </span>
              </Link>
            ))}
        </div>
      )}
    </>
  );
}

type Report = { key: string; title: string; H: string[]; R: (string | number)[][] };

function Reports() {
  const { model, state, meta, toast } = useLife();
  const [open, setOpen] = useState<string | null>(null);
  const { school } = model;
  const tName = (id: string) => {
    const t = school.teachers.find((x) => x.id === id);
    return (t && model.person(t.person_id)?.full_name) ?? id;
  };
  const rep = teacherReport(model, state.absences, state.substitutions);
  const ledger = compensationLedger({
    absences: state.absences,
    substitutions: state.substitutions,
  });
  const reports: Report[] = [
    {
      key: 'dist',
      title: 'التوزيع البيداغوجي',
      H: ['الأستاذ', 'المادة', 'الأقسام', 'الساعات', 'متواجد'],
      R: rep.map((r) => [r[0], r[1], r[2], r[3], r[6]] as (string | number)[]),
    },
    {
      key: 'abs',
      title: 'غيابات الأساتذة المعتمدة',
      H: ['الأستاذ', 'اليوم', 'السبب', 'الحصص المعالجة'],
      R: state.absences.map((a) => [
        tName(a.teacher_id),
        DAY_NAMES_AR[a.day as SchoolDay],
        a.reason,
        state.substitutions
          .filter((s) => s.absence_id === a.id)
          .map((s) => SUBSTITUTION_LABEL[s.type])
          .join('، '),
      ]),
    },
    {
      key: 'hours',
      title: 'الساعات والغيابات والتعويض لكل أستاذ',
      H: ['الأستاذ', 'الساعات', 'غيابات', 'ساعات تعويض'],
      R: rep.map((r) => [r[0], r[3], r[4], r[5]] as (string | number)[]),
    },
    {
      key: 'subs',
      title: 'ساعات التعويض هذا الأسبوع',
      H: ['الأستاذ', 'عوّض', 'غاب'],
      R: [...ledger].filter(([, v]) => v.sub || v.abs).map(([k, v]) => [tName(k), v.sub, v.abs]),
    },
  ];
  const cols: [string, LucideIcon, string, string[]][] = [
    ['قوائم الأساتذة', ClipboardList, 'var(--p-yellow)', ['dist']],
    ['الغياب والتأخر', UserX, 'var(--p-teal)', ['abs']],
    ['الحجم الساعي', Hourglass, 'var(--p-peach)', ['hours']],
    ['تعويض الأساتذة', Repeat, 'var(--p-pink)', ['subs']],
  ];
  const r = reports.find((x) => x.key === open);
  if (r)
    return (
      <section className="panel">
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <button className="btn sm ghost" onClick={() => setOpen(null)}>
            <ArrowRight aria-hidden size={15} style={{ verticalAlign: -3 }} /> كل التقارير
          </button>
          <button
            className="btn sm"
            onClick={() =>
              void writeWorkbook([
                {
                  name: 'Rapport',
                  rows: [[meta.name], [r.title], r.H, ...r.R],
                  merges: [],
                  cols: r.H.map(() => 22),
                },
              ])
                .then((b) => {
                  download(`rapport-${r.key}.xlsx`, b);
                  toast('تم حفظ الملف');
                })
                .catch(() => toast('تعذّر حفظ الملف'))
            }
          >
            Excel
          </button>
        </div>
        <h3>
          {r.title} <span className="tag acc">{r.R.length}</span>
        </h3>
        <div className="tt-wrap" style={{ border: 0 }}>
          <table className="plain">
            <thead>
              <tr>
                {r.H.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.R.length ? (
                r.R.map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={r.H.length} className="muted">
                    لا توجد بيانات.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  return (
    <div className="dash">
      {cols.map(([title, Icon, tone, keys]) => (
        <section key={title} className="dash-col" style={{ '--tone': tone } as CSSProperties}>
          <h3>
            <Icon aria-hidden /> {title}
          </h3>
          {reports
            .filter((x) => keys.includes(x.key))
            .map((x) => (
              <button key={x.key} className="dash-it" onClick={() => setOpen(x.key)}>
                <ClipboardList aria-hidden />
                <span>{x.title}</span>
                <span className="n num">{x.R.length}</span>
              </button>
            ))}
        </section>
      ))}
    </div>
  );
}
