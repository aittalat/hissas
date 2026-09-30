'use client';

import {
  PLATFORM_DOMAIN,
  PLATFORM_NAME,
  SIDEBAR_MODULES,
  TIMETABLE_TABS,
  brandCss,
} from '@hissas/shared';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LifeModalsProvider } from '@/components/life/modals';
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

function Shell({ children }: { children: ReactNode }) {
  const { meta, state, href } = useSchoolCtx();
  const platform = usePlatform();
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
  const persons = new Set(state.school.teachers.map((t) => t.person_id)).size;
  return (
    <>
      <style>{brandCss(meta.color)}</style>
      <div className="app">
        <header className="top">
          <div className="brand">
            <Logo name={meta.name} color={meta.color} logo={meta.logo} size={44} />
            <div>
              <p className="plat">{PLATFORM_NAME} · منصة التدبير المدرسي</p>
              <h1>{meta.name}</h1>
              <p>
                {state.school.classes.length} أقسام · {persons} أستاذا ·{' '}
                <span dir="ltr">
                  {meta.slug}.{PLATFORM_DOMAIN}
                </span>
              </p>
            </div>
          </div>
          <div className="toolbar">
            <Link className="btn sm" href="/owner">
              مدارسي ({platform?.schools.length ?? 1})
            </Link>
          </div>
        </header>
        <div className="shell">
          <nav className="side" aria-label="وحدات المنصة">
            {SIDEBAR_MODULES.map(([k, n]) => (
              <Link
                key={k}
                className="side-it"
                href={`${base}${MODULE_PATH[k]}`}
                aria-current={current === k ? 'page' : 'false'}
              >
                <span>{n}</span>
                {k === 'absences' && today ? <b className="badge">{today}</b> : null}
              </Link>
            ))}
          </nav>
          <div className="work">
            {inTT && (
              <nav className="tabs" role="tablist" aria-label="أقسام جدول الحصص">
                {TIMETABLE_TABS.map(([k, n]) => (
                  <Link
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    href={`${base}/timetable${TAB_PATH[k]}`}
                  >
                    {n}
                  </Link>
                ))}
              </nav>
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
          <div className="app">
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
