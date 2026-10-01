'use client';

import { classCounts, hueOf, norm, studentName } from '@hissas/shared';
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Grip,
  Mars,
  Plus,
  Presentation,
  School,
  Venus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useModals } from '@/components/life/modals';
import { usePhoto } from '@/components/life/photo';
import { Avatar, PageHeader, SearchBox, useDismiss } from '@/components/life/ui';
import { useLife } from '@/lib/life';

/** المستوى من اسم القسم للعرض فقط ("1AC-A" ← "1AC"، "1BAC EX" ← "1BAC"). */
const levelOf = (name: string) => name.split(/[-\s]/)[0] || name;

/** الأقسام (viewClasses): بطاقات بالمستوى والأعداد، وتفاصيل القسم بتلاميذه وأساتذته. */
export default function ClassesPage() {
  const { life, model, href } = useLife();
  const [view, setView] = useState<{ id: string; part: 'students' | 'teachers' } | null>(null);
  const [q, setQ] = useState('');
  const { school } = model;
  const c = view ? school.classes.find((x) => x.id === view.id) : undefined;
  const list = school.classes.filter((x) => !q || norm(x.name).includes(norm(q)));
  return (
    <>
      <PageHeader icon={School} tone="var(--p-blue)" title="الأقسام" count={school.classes.length}>
        <SearchBox value={q} onChange={setQ} placeholder="بحث عن قسم" />
      </PageHeader>
      {c && view && <ClassDetail id={c.id} part={view.part} onClose={() => setView(null)} />}
      <div className="clsgrid cards">
        <Link className="add-card" href={href('/timetable/data')}>
          <span className="plus">
            <Plus aria-hidden />
          </span>
          إضافة أو استيراد
        </Link>
        {list.map((x) => (
          <ClassCard
            key={x.id}
            id={x.id}
            onOpen={(part) => {
              setView({ id: x.id, part });
              window.scrollTo(0, 0);
            }}
          />
        ))}
      </div>
      {!list.length && <p className="muted">لا توجد أقسام.</p>}
      {!life.students.length && school.classes.length > 0 && (
        <p className="hint">لا يوجد تلاميذ بعد في هذه المدرسة.</p>
      )}
    </>
  );
}

function ClassCard({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (part: 'students' | 'teachers') => void;
}) {
  const { life, model, href } = useLife();
  const [menu, setMenu] = useState(false);
  const ref = useDismiss<HTMLDivElement>(menu, () => setMenu(false));
  const x = model.school.classes.find((k) => k.id === id);
  if (!x) return null;
  const n = classCounts(life, x.id);
  const lv = levelOf(x.name);
  const h = hueOf(lv);
  return (
    <article
      className={`ccard2 tone-${h % 6}`}
      style={{ '--h': h } as CSSProperties}
      aria-label={x.name}
    >
      <span className="ph ring" style={{ width: 84, height: 84, '--h': h } as CSSProperties}>
        {lv}
      </span>
      <span className="lv">{lv}</span>
      <button
        className="nm cname"
        onClick={() => onOpen('students')}
        style={{ border: 0, cursor: 'pointer' }}
      >
        {x.name}
      </button>
      <span className="cnt">التلاميذ: {n.total}</span>
      <span className="gs">
        <span className="boy" title="ذكور">
          <Mars aria-hidden /> {n.m}
        </span>
        <span className="girl" title="إناث">
          <Venus aria-hidden /> {n.f}
        </span>
      </span>
      <div ref={ref}>
        <button
          className="act"
          aria-label={`خيارات ${x.name}`}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <Grip aria-hidden />
        </button>
        {menu && (
          <div className="menu" role="menu">
            <button role="menuitem" onClick={() => (setMenu(false), onOpen('students'))}>
              <span className="mi" style={{ '--tone': 'var(--p-yellow)' } as CSSProperties}>
                <GraduationCap aria-hidden />
              </span>
              التلاميذ
            </button>
            <button role="menuitem" onClick={() => (setMenu(false), onOpen('teachers'))}>
              <span className="mi" style={{ '--tone': 'var(--p-pink)' } as CSSProperties}>
                <Presentation aria-hidden />
              </span>
              الأساتذة
            </button>
            <Link role="menuitem" href={href(`/timetable?c=${x.id}`)}>
              <span className="mi" style={{ '--tone': 'var(--p-blue)' } as CSSProperties}>
                <CalendarDays aria-hidden />
              </span>
              جدول الحصص
            </Link>
            <Link role="menuitem" href={href('/absences?tab=mark')}>
              <span className="mi" style={{ '--tone': 'var(--p-teal)' } as CSSProperties}>
                <ClipboardCheck aria-hidden />
              </span>
              تسجيل الغياب
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

function ClassDetail({
  id,
  part,
  onClose,
}: {
  id: string;
  part: 'students' | 'teachers';
  onClose: () => void;
}) {
  const { life, model, href } = useLife();
  const { openStudent } = useModals();
  const photo = usePhoto();
  const { school } = model;
  const c = school.classes.find((x) => x.id === id);
  if (!c) return null;
  const L = life.students.filter((s) => s.status === 'active' && s.class_id === c.id);
  const T = [...new Set(model.units.filter((u) => u.class_id === c.id).map((u) => u.teacher_id))]
    .map((tid) => school.teachers.find((t) => t.id === tid))
    .filter((t) => !!t);
  return (
    <section className="panel">
      <header className="mhead">
        <h3>
          {c.name} · {L.length} تلميذا · {T.length} أستاذا
        </h3>
        <div className="toolbar">
          <Link className="btn sm" href={href(`/timetable?c=${c.id}`)}>
            جدول الحصص
          </Link>
          <button className="icon-btn" aria-label="إغلاق" onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>
      </header>
      <div className="grid2">
        <div style={{ order: part === 'teachers' ? 2 : 1 }}>
          <h3>التلاميذ</h3>
          <div className="trombi" style={{ marginTop: 10 }}>
            {L.length ? (
              L.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openStudent(s.id)}
                  style={{
                    border: 0,
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <figure>
                    <Avatar name={studentName(s)} gender={s.gender} photo={photo(s)} size={72} />
                    <figcaption>{studentName(s)}</figcaption>
                  </figure>
                </button>
              ))
            ) : (
              <p className="muted">لا يوجد تلاميذ.</p>
            )}
          </div>
        </div>
        <div style={{ order: part === 'teachers' ? 1 : 2 }}>
          <h3>الأساتذة</h3>
          <div className="list">
            {T.length ? (
              T.map((t) => {
                const name = model.person(t.person_id)?.full_name ?? t.id;
                return (
                  <Link key={t.id} className="row" href={href(`/timetable/data?t=${t.id}`)}>
                    <span className="toolbar" style={{ flexWrap: 'nowrap' }}>
                      <Avatar name={name} size={34} />
                      {name}
                    </span>
                    <span className="meta">
                      {school.subjects.find((s) => s.key === t.subject)?.short} ·{' '}
                      {t.classes.find((x) => x.class_id === c.id)?.hours ?? 0} س
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="muted">لا يوجد أساتذة.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
