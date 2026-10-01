'use client';

import {
  GENDER_LABEL,
  RELATION_LABEL,
  STUDENT_LISTS,
  absenceStats,
  attestationHtml,
  behaviorPoints,
  listData,
  listTableHtml,
  schoolYear,
  searchStudents,
  studentName,
  toggleArchive,
  type Student,
  type StudentListKey,
} from '@hissas/shared';
import {
  Archive,
  ArrowRight,
  BookOpen,
  CalendarX2,
  ChartColumn,
  ClipboardList,
  Download,
  EllipsisVertical,
  FileText,
  FolderOpen,
  GraduationCap,
  IdCard,
  Info,
  Pencil,
  Plus,
  Printer,
  ShieldAlert,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useModals, type StudentTab } from '@/components/life/modals';
import { PhotoActions, usePhoto } from '@/components/life/photo';
import {
  Avatar,
  ClassFilter,
  FilterPop,
  PageHeader,
  SearchBox,
  ViewToggle,
  useDismiss,
  useSubTab,
  type ViewMode,
} from '@/components/life/ui';
import { useLife } from '@/lib/life';
import { download, writeWorkbook } from '@/lib/xlsx';

const TABS = [
  ['active', 'التلاميذ النشطون'],
  ['archived', 'المؤرشفون'],
  ['photos', 'صور التلاميذ'],
  ['lists', 'القوائم ولوحات القيادة'],
] as const;

const PAGE = 48;

/** التلاميذ (viewStudents + viewLists): بطاقات بالصور، لائحة، لوحة تفاصيل، صور القسم، القوائم. */
export default function StudentsPage() {
  const { life, today, cName, model, meta, toast } = useLife();
  const { openNewStudent } = useModals();
  const tab = useSubTab(TABS);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [gender, setGender] = useState<'' | 'm' | 'f'>('');
  const [alertOnly, setAlertOnly] = useState(false);
  const [view, setView] = useState<ViewMode>('grid');
  const [more, setMore] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const status = tab === 'archived' ? 'archived' : 'active';
  const lim = life.rules.monthly_absence_alert;
  const L = searchStudents(life, { status, q, class_id: cls }).filter(
    (s) =>
      (!gender || s.gender === gender) &&
      (!alertOnly || absenceStats(life.attendance, s.id, today).month >= lim),
  );
  const active = life.students.filter((s) => s.status === 'active').length;
  const filters = (cls ? 1 : 0) + (gender ? 1 : 0) + (alertOnly ? 1 : 0);
  const reset = () => setMore(false);

  const exportList = () => {
    const P = new Map(life.parents.map((p) => [p.id, p]));
    const H = ['الاسم', 'القسم', 'رقم التسجيل', 'الجنس', 'الولي', 'الهاتف'];
    const R = L.map((s) => [
      studentName(s),
      cName(s.class_id),
      s.matricule,
      GENDER_LABEL[s.gender],
      P.get(s.parent_id)?.full_name ?? '',
      P.get(s.parent_id)?.phone ?? '',
    ]);
    void writeWorkbook([
      {
        name: 'Eleves',
        rows: [[`${meta.name} · ${schoolYear()}`], ['لائحة التلاميذ'], H, ...R],
        merges: [],
        cols: [24, 12, 12, 8, 26, 14],
      },
    ])
      .then((b) => {
        download('eleves.xlsx', b);
        toast('تم حفظ الملف');
      })
      .catch(() => toast('تعذّر حفظ الملف'));
  };

  return (
    <>
      <PageHeader icon={GraduationCap} title="التلاميذ" count={active} tabs={TABS} current={tab}>
        {(tab === 'active' || tab === 'archived') && (
          <>
            <button className="icon-btn" aria-label="تحميل اللائحة (Excel)" onClick={exportList}>
              <Download aria-hidden />
            </button>
            <SearchBox
              value={q}
              placeholder="بحث بالاسم أو رقم التسجيل"
              onChange={(v) => {
                setQ(v);
                reset();
              }}
            />
            <FilterPop active={filters}>
              <ClassFilter
                classes={model.school.classes}
                value={cls}
                onChange={(v) => {
                  setCls(v);
                  reset();
                }}
              />
              <div className="fld">
                الجنس
                <div className="seg" role="group" aria-label="الجنس">
                  {(
                    [
                      ['', 'الكل'],
                      ['m', 'ذكور'],
                      ['f', 'إناث'],
                    ] as const
                  ).map(([k, n]) => (
                    <button key={k} aria-pressed={gender === k} onClick={() => setGender(k)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <label className="opt" style={{ paddingInline: 0 }}>
                <input
                  type="checkbox"
                  checked={alertOnly}
                  onChange={(e) => setAlertOnly(e.target.checked)}
                />
                <span>في وضعية إنذار غياب فقط</span>
              </label>
            </FilterPop>
            <ViewToggle value={view} onChange={setView} />
          </>
        )}
      </PageHeader>
      {tab === 'lists' ? (
        <Lists />
      ) : tab === 'photos' ? (
        <Trombinoscope />
      ) : (
        <div className={`browse${sel ? ' open' : ''}`}>
          <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
            {!L.length && (
              <p className="muted">
                {life.students.length
                  ? 'لا توجد نتائج.'
                  : 'لا يوجد تلاميذ بعد. أضف تلميذا أو استورد اللائحة.'}
              </p>
            )}
            {view === 'grid' ? (
              <div className="wgrid cards">
                {tab === 'active' && (
                  <button className="add-card" onClick={() => openNewStudent(cls)}>
                    <span className="plus">
                      <Plus aria-hidden />
                    </span>
                    إضافة تلميذ
                  </button>
                )}
                {L.slice(0, more ? undefined : PAGE).map((s, i) => (
                  <StudentCard
                    key={s.id}
                    s={s}
                    tone={i % 6}
                    selected={sel === s.id}
                    onSelect={() => setSel(sel === s.id ? null : s.id)}
                  />
                ))}
              </div>
            ) : (
              <StudentTable rows={L.slice(0, more ? undefined : PAGE)} onSelect={setSel} />
            )}
            {L.length > PAGE && !more && (
              <button
                className="btn sm ghost"
                style={{ justifySelf: 'center' }}
                onClick={() => setMore(true)}
              >
                عرض الكل ({L.length})
              </button>
            )}
          </div>
          {sel && <StudentPanel id={sel} onClose={() => setSel(null)} />}
        </div>
      )}
    </>
  );
}

function StudentCard({
  s,
  tone,
  selected,
  onSelect,
}: {
  s: Student;
  tone: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { life, today, cName, setLife, toast, meta } = useLife();
  const { openStudent } = useModals();
  const photo = usePhoto();
  const [menu, setMenu] = useState(false);
  const ref = useDismiss<HTMLDivElement>(menu, () => setMenu(false));
  const st = absenceStats(life.attendance, s.id, today);
  const alert = st.month >= life.rules.monthly_absence_alert;
  const name = studentName(s);
  const key = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };
  const item = (label: string, Icon: LucideIcon, fn: () => void) => (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        setMenu(false);
        fn();
      }}
    >
      <Icon aria-hidden /> {label}
    </button>
  );
  return (
    <div
      className={`wcard pcard tone-${tone}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={name}
      onClick={onSelect}
      onKeyDown={key}
    >
      {alert && <i className="dot" title={`إنذار غياب: ${st.month} غيابات هذا الشهر`} />}
      <div ref={ref}>
        <button
          className="kebab"
          aria-label={`خيارات ${name}`}
          aria-expanded={menu}
          onClick={(e) => {
            e.stopPropagation();
            setMenu(!menu);
          }}
        >
          <EllipsisVertical aria-hidden />
        </button>
        {menu && (
          <div className="menu" role="menu">
            {item('ملف التلميذ', IdCard, () => openStudent(s.id))}
            {item('الشهادة المدرسية', FileText, () => {
              download(
                `attestation-${s.matricule.replace('/', '-')}.html`,
                attestationHtml(meta, s, cName(s.class_id)),
              );
              toast('تم حفظ الملف');
            })}
            {item(s.status === 'active' ? 'أرشفة (مغادرة)' : 'إعادة التفعيل', Archive, () => {
              setLife((l) => toggleArchive(l, s.id));
              toast(s.status === 'active' ? 'نُقل التلميذ إلى الأرشيف' : 'أُعيد تفعيل التلميذ');
            })}
          </div>
        )}
      </div>
      <Avatar name={name} gender={s.gender} photo={photo(s)} size={104} ring />
      <b>{name}</b>
      <span className="meta">{cName(s.class_id)}</span>
      <span className={`sub${alert ? ' bad' : ''}`}>
        {alert ? `${st.month} غيابات هذا الشهر` : s.matricule}
      </span>
    </div>
  );
}

function StudentTable({ rows, onSelect }: { rows: Student[]; onSelect: (id: string) => void }) {
  const { life, today, cName } = useLife();
  const photo = usePhoto();
  const P = new Map(life.parents.map((p) => [p.id, p]));
  return (
    <section className="panel" style={{ padding: 8 }}>
      <div className="tt-wrap" style={{ border: 0 }}>
        <table className="plain">
          <thead>
            <tr>
              <th>التلميذ</th>
              <th>القسم</th>
              <th>رقم التسجيل</th>
              <th>الولي</th>
              <th>الهاتف</th>
              <th>غيابات الشهر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                tabIndex={0}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(s.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <span className="toolbar" style={{ gap: 10, flexWrap: 'nowrap' }}>
                    <Avatar name={studentName(s)} gender={s.gender} photo={photo(s)} size={36} />
                    <b>{studentName(s)}</b>
                  </span>
                </td>
                <td>{cName(s.class_id)}</td>
                <td className="num">{s.matricule}</td>
                <td>{P.get(s.parent_id)?.full_name}</td>
                <td dir="ltr" style={{ textAlign: 'end' }}>
                  {P.get(s.parent_id)?.phone}
                </td>
                <td className="num">{absenceStats(life.attendance, s.id, today).month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** لوحة التفاصيل الجانبية (مثل البطاقة اليمنى في المرجع). */
function StudentPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { life, today, cName, meta, toast } = useLife();
  const { openStudent } = useModals();
  const photo = usePhoto();
  const s = life.students.find((x) => x.id === id);
  if (!s) return null;
  const P = life.parents.find((p) => p.id === s.parent_id);
  const st = absenceStats(life.attendance, s.id, today);
  const alert = st.month >= life.rules.monthly_absence_alert;
  const name = studentName(s);
  const quick: [StudentTab, string, LucideIcon, string][] = [
    ['abs', 'الغياب', CalendarX2, 'var(--p-pink)'],
    ['disc', 'الانضباط', ShieldAlert, 'var(--p-yellow)'],
    ['meet', 'لقاءات الأولياء', UsersRound, 'var(--p-teal)'],
    ['docs', 'الوثائق', FolderOpen, 'var(--p-blue)'],
    ['notes', 'النقط', BookOpen, 'var(--p-peach)'],
  ];
  return (
    <aside className="detail" aria-label={`تفاصيل ${name}`}>
      <button className="icon-btn close" aria-label="إغلاق التفاصيل" onClick={onClose}>
        <ArrowRight aria-hidden />
      </button>
      <Avatar name={name} gender={s.gender} photo={photo(s)} size={132} ring />
      <PhotoActions studentId={s.id} />
      <h3>{name}</h3>
      <p className="status" style={{ color: alert ? 'var(--bad)' : 'var(--accent)' }}>
        {s.status === 'archived'
          ? 'مؤرشف'
          : alert
            ? `إنذار: ${st.month} غيابات هذا الشهر`
            : `مسجل ${schoolYear()}`}
      </p>
      <div className="toolbar" style={{ justifyContent: 'center' }}>
        <button className="btn sm" onClick={() => openStudent(s.id)}>
          ملف التلميذ
        </button>
        <button
          className="btn sm"
          onClick={() => {
            download(
              `attestation-${s.matricule.replace('/', '-')}.html`,
              attestationHtml(meta, s, cName(s.class_id)),
            );
            toast('تم حفظ الملف');
          }}
        >
          شهادة مدرسية
        </button>
      </div>
      <section className="info">
        <header>
          <Info aria-hidden /> معلومات عامة
          <button
            className="icon-btn"
            aria-label="تعديل في ملف التلميذ"
            onClick={() => openStudent(s.id)}
          >
            <Pencil aria-hidden />
          </button>
        </header>
        <b>{name}</b>
        <dl>
          <dt>رقم التسجيل</dt>
          <dd className="num">{s.matricule}</dd>
          <dt>رمز مسار</dt>
          <dd dir="ltr" style={{ textAlign: 'start' }}>
            {s.massar_code ?? '—'}
          </dd>
          <dt>الجنس</dt>
          <dd>{GENDER_LABEL[s.gender]}</dd>
          <dt>القسم</dt>
          <dd>{cName(s.class_id)}</dd>
          <dt>تاريخ الازدياد</dt>
          <dd className="num">{s.birth_date}</dd>
          <dt>الولي</dt>
          <dd>
            {P?.full_name ?? '—'}
            {P ? ` (${RELATION_LABEL[P.relation]})` : ''}
          </dd>
          <dt>الهاتف</dt>
          <dd dir="ltr" style={{ textAlign: 'start' }}>
            {P?.phone || '—'}
          </dd>
          <dt>نقاط السلوك</dt>
          <dd className="num">{behaviorPoints(life.incidents, s.id)}/20</dd>
          <dt>ملاحظة صحية</dt>
          <dd>{s.health_note || '—'}</dd>
        </dl>
      </section>
      <div className="quick">
        {quick.map(([k, label, Icon, tone]) => (
          <button
            key={k}
            title={label}
            aria-label={label}
            style={{ '--tone': tone } as CSSProperties}
            onClick={() => openStudent(s.id, k)}
          >
            <Icon aria-hidden />
          </button>
        ))}
      </div>
    </aside>
  );
}

/** صور التلاميذ حسب القسم (Trombinoscope)، قابلة للطباعة. */
function Trombinoscope() {
  const { life, model } = useLife();
  const photo = usePhoto();
  const [cls, setCls] = useState(model.school.classes[0]?.id ?? '');
  const L = life.students.filter((s) => s.status === 'active' && s.class_id === cls);
  return (
    <section className="panel">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="pills">
          {model.school.classes.map((c) => (
            <button
              key={c.id}
              className="pill"
              aria-pressed={c.id === cls}
              onClick={() => setCls(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <button className="soft-btn" onClick={() => window.print()}>
          <Printer aria-hidden /> طباعة
        </button>
      </div>
      {L.length ? (
        <div className="trombi">
          {L.map((s) => (
            <figure key={s.id}>
              <Avatar name={studentName(s)} gender={s.gender} photo={photo(s)} size={96} />
              <figcaption>{studentName(s)}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="muted">لا يوجد تلاميذ في هذا القسم.</p>
      )}
    </section>
  );
}

const GROUP_STYLE: Record<string, [LucideIcon, string]> = {
  القوائم: [ClipboardList, 'var(--p-yellow)'],
  الأعداد: [ChartColumn, 'var(--p-purple)'],
  التسجيل: [UserPlus, 'var(--p-teal)'],
  التتبع: [FileText, 'var(--p-blue)'],
};

/** القوائم ولوحات القيادة: أعمدة بعناوين ملونة، والقائمة تُفتح جدولا. */
function Lists() {
  const { life, model, meta, toast } = useLife();
  const [open, setOpen] = useState<StudentListKey | null>(null);
  const L = open && STUDENT_LISTS.find((x) => x[0] === open);
  if (open && L) {
    const { H, R } = listData(open, life, model.school);
    return (
      <section className="panel">
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <button className="btn sm ghost" onClick={() => setOpen(null)}>
            <ArrowRight aria-hidden size={15} style={{ verticalAlign: -3 }} /> كل القوائم
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
    );
  }
  const groups = [...new Set(STUDENT_LISTS.map((x) => x[2]))];
  return (
    <div className="dash">
      {groups.map((g) => {
        const [Icon, tone] = GROUP_STYLE[g] ?? [ClipboardList, 'var(--p-yellow)'];
        return (
          <section key={g} className="dash-col" style={{ '--tone': tone } as CSSProperties}>
            <h3>
              <Icon aria-hidden /> {g}
            </h3>
            {STUDENT_LISTS.filter((x) => x[2] === g).map((x) => (
              <button key={x[0]} className="dash-it" onClick={() => setOpen(x[0])}>
                <ClipboardList aria-hidden />
                <span>{x[1]}</span>
                <span className="n num">{listData(x[0], life, model.school).R.length}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}
