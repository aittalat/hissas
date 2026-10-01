'use client';

import {
  PLATFORM_DOMAIN,
  SIDEBAR_MODULES,
  TIMETABLE_TABS,
  brandCss,
  schoolYear,
} from '@hissas/shared';
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  GraduationCap,
  House,
  LayoutGrid,
  MessagesSquare,
  Palette,
  Presentation,
  School,
  ShieldAlert,
  UserX,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { LifeModalsProvider } from '@/components/life/modals';
import { PageHeader, useDismiss } from '@/components/life/ui';
import { Logo } from '@/components/logo';
import { ToastProvider } from '@/components/toast';
import { SchoolProvider, useSchoolCtx } from '@/lib/school';
import { usePlatform } from '@/lib/store';

const MODULE_PATH: Record<string, string> = {
  home: '',
  students: '/students',
  parents: '/parents',
  teachers: '/teachers',
  classes: '/classes',
  absences: '/absences',
  discipline: '/discipline',
  tt: '/timetable',
  comm: '/comm',
  modules: '/modules',
  brand: '/brand',
};

const TAB_PATH: Record<string, string> = {
  tt: '',
  cfg: '/config',
  data: '/data',
  io: '/io',
  net: '/network',
  abs: '/absences',
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** إشعارات آخر 24 ساعة (جرس الشريط العلوي). */
function recentCount(ts: readonly number[]) {
  const since = Date.now() - 86_400_000;
  return ts.filter((t) => t >= since).length;
}

const ICON: Record<string, LucideIcon> = {
  home: House,
  students: GraduationCap,
  parents: UsersRound,
  teachers: Presentation,
  classes: School,
  absences: UserX,
  discipline: ShieldAlert,
  tt: CalendarDays,
  comm: MessagesSquare,
  modules: LayoutGrid,
  brand: Palette,
};

function UserMenu({ schools }: { schools: number }) {
  const { href } = useSchoolCtx();
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div className="user" ref={ref}>
      <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <span className="user-ic">
          <CircleUserRound aria-hidden size={22} />
        </span>
        <span className="user-name">الحارس العام</span>
        <ChevronDown aria-hidden size={16} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <Link role="menuitem" href="/owner">
            <Building2 aria-hidden /> مدارسي ({schools})
          </Link>
          <Link role="menuitem" href={href('/brand')} onClick={() => setOpen(false)}>
            <Palette aria-hidden /> هوية المدرسة
          </Link>
          <Link role="menuitem" href={href('/modules')} onClick={() => setOpen(false)}>
            <LayoutGrid aria-hidden /> كل الوحدات
          </Link>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { meta, state, href } = useSchoolCtx();
  const platform = usePlatform();
  const router = useRouter();
  const path = usePathname();
  const base = href();
  const rest = path.slice(base.length);
  const inTT = rest.startsWith('/timetable');
  const current =
    Object.entries(MODULE_PATH).find(([k, p]) =>
      k === 'home' ? rest === '' || rest === '/' : rest.startsWith(p),
    )?.[0] ?? 'home';
  const tab = inTT
    ? (Object.entries(TAB_PATH).find(([, p]) => p && rest.startsWith(`/timetable${p}`))?.[0] ??
      'tt')
    : null;
  const today = state.life.attendance.filter((a) => a.date === todayISO()).length;
  const bell = recentCount([...state.notices, ...state.messages].map((n) => n.ts));
  return (
    <>
      <style>{brandCss(meta.color)}</style>
      <div className="frame">
        <nav className="nav" aria-label="وحدات المنصة">
          <Link className="nav-logo" href={base} aria-label={meta.name}>
            <Logo name={meta.name} color={meta.color} logo={meta.logo} size={46} />
          </Link>
          {SIDEBAR_MODULES.map(([k, n]) => {
            const Icon = ICON[k] ?? LayoutGrid;
            return (
              <Link
                key={k}
                className={`nav-it side-it${k === 'modules' ? ' apps' : ''}`}
                href={`${base}${MODULE_PATH[k]}`}
                aria-current={current === k ? 'page' : 'false'}
              >
                <Icon aria-hidden />
                <span>{n}</span>
                {k === 'absences' && today ? <b className="badge">{today}</b> : null}
              </Link>
            );
          })}
        </nav>
        <div className="body">
          <header className="topbar top">
            <div>
              <button className="icon-btn" aria-label="رجوع" onClick={() => router.back()}>
                <ChevronRight aria-hidden />
              </button>
            </div>
            <div className="title">
              <h1 style={{ font: 'inherit', margin: 0 }}>{meta.name}</h1>
              <small className="num">{schoolYear()}</small>
            </div>
            <div className="tools">
              <Link className="icon-btn accent" href={`${base}/comm`} aria-label="الإشعارات">
                <Bell aria-hidden />
                {bell > 0 && <b className="badge">{bell}</b>}
              </Link>
              <button className="icon-btn" disabled title="الفرنسية قريبا" aria-label="اللغة">
                FR
              </button>
              <UserMenu schools={platform?.schools.length ?? 1} />
            </div>
          </header>
          <div className="content">
            {inTT && (
              <PageHeader
                icon={CalendarDays}
                tone="var(--p-teal)"
                title="جدول الحصص"
                sub={`${state.school.classes.length} أقسام · ${new Set(state.school.teachers.map((t) => t.person_id)).size} أستاذا · ${meta.slug}.${PLATFORM_DOMAIN}`}
                nav={
                  <nav className="pills" role="tablist" aria-label="أقسام جدول الحصص">
                    {TIMETABLE_TABS.map(([k, n]) => (
                      <Link
                        key={k}
                        role="tab"
                        className="pill"
                        aria-selected={tab === k}
                        href={`${base}/timetable${TAB_PATH[k]}`}
                      >
                        {n}
                      </Link>
                    ))}
                  </nav>
                }
              />
            )}
            <main>{children}</main>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SchoolLayout({ children }: { children: ReactNode }) {
  const { school } = useParams<{ school: string }>();
  return (
    <ToastProvider>
      <SchoolProvider
        slug={school}
        fallback={
          <div className="app" style={{ maxWidth: 640 }}>
            <section className="panel">
              <h2>المدرسة غير موجودة</h2>
              <p className="muted">
                <Link href="/owner">الرجوع إلى المدارس</Link>
              </p>
            </section>
          </div>
        }
      >
        <LifeModalsProvider>
          <Shell>{children}</Shell>
        </LifeModalsProvider>
      </SchoolProvider>
    </ToastProvider>
  );
}
