'use client';

import {
  BRAND_COLORS,
  PLATFORM_DOMAIN,
  PLATFORM_NAME,
  brandCss,
  buildModel,
  metrics,
  placementMap,
  quality,
  slugify,
} from '@hissas/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppPreview, BrandForm, type BrandFields } from '@/components/brand/brand-form';
import { Logo } from '@/components/logo';
import { ToastProvider, useToast } from '@/components/toast';
import { demoSchoolState, emptySchoolState, uid } from '@/lib/demo';
import { setPlatform, usePlatform } from '@/lib/store';
import type { SchoolState } from '@/lib/types';

/** أرقام بطاقة المدرسة (schoolStats). */
function schoolStats(s: SchoolState) {
  const model = buildModel(s.school);
  const m = metrics(model, placementMap(s.placements));
  return {
    cls: s.school.classes.length,
    tch: new Set(s.school.teachers.map((t) => t.person_id)).size,
    h: model.units.length,
    q: model.units.length ? quality(m, 0) : null,
  };
}

type NewSchool = BrandFields & { start: 'empty' | 'demo'; slugEdited: boolean };

/**
 * لوحة صاحب المنصة (viewOwner، SPEC §7.11): المدارس وإنشاؤها وحذفها.
 * لاحقا: platformDb فقط، وكل عملية في audit_log؛ ولا بيانات تلاميذ دون support_access.
 */
function Owner() {
  const p = usePlatform();
  const router = useRouter();
  const toast = useToast();
  const [ns, setNs] = useState<NewSchool | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!p) return <div className="loading">…</div>;
  const cur = p.schools.find((m) => m.id === p.current) ?? p.schools[0];
  const cards = p.schools.map((m) => ({
    m,
    st: p.data[m.id] && schoolStats(p.data[m.id] as SchoolState),
  }));
  const tc = cards.reduce((a, c) => a + (c.st?.cls ?? 0), 0);
  const tt = cards.reduce((a, c) => a + (c.st?.tch ?? 0), 0);

  const open = (id: string) => {
    const m = p.schools.find((x) => x.id === id);
    if (!m) return;
    setPlatform((s) => ({ ...s, current: id }));
    router.push(`/s/${m.slug}/timetable`);
  };

  const create = () => {
    if (!ns) return;
    const name = ns.name.trim();
    if (!name) {
      toast('اكتب اسم المدرسة');
      return;
    }
    const id = `s${uid()}`;
    const slug = slugify(
      ns.slug || name,
      p.schools.map((m) => m.slug),
    );
    const meta = { id, name, slug, color: ns.color, logo: ns.logo, created: Date.now() };
    const data = ns.start === 'demo' ? demoSchoolState(name) : emptySchoolState(name);
    setPlatform((s) => ({
      ...s,
      current: id,
      schools: [...s.schools, meta],
      data: { ...s.data, [id]: data },
    }));
    setNs(null);
    toast(`أُنشئت ${name}`);
    router.push(`/s/${slug}/timetable`);
  };

  const remove = (id: string) => {
    setPlatform((s) => {
      const schools = s.schools.filter((x) => x.id !== id);
      const data = { ...s.data };
      delete data[id];
      return {
        ...s,
        schools,
        data,
        current: s.current === id ? (schools[0]?.id ?? null) : s.current,
      };
    });
    setConfirm(null);
    toast('حُذفت المدرسة');
  };

  return (
    <>
      {cur && <style>{brandCss(cur.color)}</style>}
      <div className="app">
        <header className="top">
          <div className="brand">
            {cur && <Logo name={cur.name} color={cur.color} logo={cur.logo} size={44} />}
            <div>
              <p className="plat">{PLATFORM_NAME} · منصة التدبير المدرسي</p>
              <h1>{cur?.name ?? PLATFORM_NAME}</h1>
            </div>
          </div>
          {cur && (
            <div className="toolbar">
              <Link className="btn sm" href={`/s/${cur.slug}/timetable`}>
                رجوع إلى المدرسة
              </Link>
            </div>
          )}
        </header>
        <main style={{ display: 'grid', gap: 16 }}>
          <section className="panel">
            <header className="toolbar" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2>لوحة صاحب المنصة</h2>
                <p className="hint">
                  كل مدرسة لها بياناتها المعزولة، وشعارها، وألوانها، ورابطها الخاص. لا ترى أي مدرسة
                  بيانات مدرسة أخرى.
                </p>
              </div>
              <button
                className="btn primary"
                onClick={() =>
                  setNs({
                    name: '',
                    slug: '',
                    color: BRAND_COLORS[p.schools.length % BRAND_COLORS.length] ?? '#1D5A48',
                    logo: null,
                    start: 'empty',
                    slugEdited: false,
                  })
                }
              >
                + إضافة مدرسة
              </button>
            </header>
            <div className="stats">
              <div className="stat">
                <span>المدارس</span>
                <b className="num">{p.schools.length}</b>
              </div>
              <div className="stat">
                <span>الأقسام</span>
                <b className="num">{tc}</b>
              </div>
              <div className="stat">
                <span>الأساتذة</span>
                <b className="num">{tt}</b>
              </div>
            </div>
          </section>
          {ns && (
            <section className="panel">
              <header className="toolbar" style={{ justifyContent: 'space-between' }}>
                <h2>مدرسة جديدة</h2>
                <button className="btn sm ghost" onClick={() => setNs(null)}>
                  إلغاء
                </button>
              </header>
              <div className="grid2">
                <div style={{ display: 'grid', gap: 12 }}>
                  <BrandForm
                    prefix="ns"
                    value={ns}
                    onChange={(patch) =>
                      setNs((n) => {
                        if (!n) return n;
                        const next = { ...n, ...patch };
                        if (patch.slug !== undefined) next.slugEdited = true;
                        else if (patch.name !== undefined && !n.slugEdited)
                          next.slug = slugify(patch.name);
                        return next;
                      })
                    }
                  />
                  <div className="fld">
                    البداية
                    <div className="seg" role="group" aria-label="البداية">
                      <button
                        aria-pressed={ns.start === 'empty'}
                        onClick={() => setNs({ ...ns, start: 'empty' })}
                      >
                        مدرسة فارغة
                      </button>
                      <button
                        aria-pressed={ns.start === 'demo'}
                        onClick={() => setNs({ ...ns, start: 'demo' })}
                      >
                        ببيانات تجريبية
                      </button>
                    </div>
                  </div>
                  <div>
                    <button className="btn primary" onClick={create}>
                      إنشاء المدرسة
                    </button>
                  </div>
                </div>
                <AppPreview value={ns} />
              </div>
            </section>
          )}
          <div className="schools">
            {cards.map(({ m, st }) => {
              const isCur = m.id === cur?.id;
              return (
                <article
                  key={m.id}
                  className={`panel school${isCur ? ' cur' : ''}`}
                  style={{ '--sc': m.color } as React.CSSProperties}
                >
                  <header className="toolbar">
                    <Logo name={m.name} color={m.color} logo={m.logo} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{m.name}</b> {isCur && <span className="tag acc">مفتوحة</span>}
                      <br />
                      <span className="hint" dir="ltr">
                        {m.slug}.{PLATFORM_DOMAIN}
                      </span>
                    </div>
                  </header>
                  <div className="kv">
                    <span>
                      أقسام <b>{st?.cls ?? 0}</b>
                    </span>
                    <span>
                      أساتذة <b>{st?.tch ?? 0}</b>
                    </span>
                    <span>
                      ساعات <b>{st?.h ?? 0}</b>
                    </span>
                    <span>
                      جودة الجدول <b>{st?.q ?? '—'}</b>
                    </span>
                  </div>
                  <div className="toolbar">
                    <button
                      className={`btn sm${isCur ? '' : ' primary'}`}
                      onClick={() => open(m.id)}
                    >
                      {isCur ? 'العودة إليها' : 'فتح المدرسة'}
                    </button>
                    {p.schools.length > 1 &&
                      (confirm === m.id ? (
                        <>
                          <button className="btn sm danger" onClick={() => remove(m.id)}>
                            تأكيد حذف كل بياناتها
                          </button>
                          <button className="btn sm ghost" onClick={() => setConfirm(null)}>
                            تراجع
                          </button>
                        </>
                      ) : (
                        <button className="btn sm ghost" onClick={() => setConfirm(m.id)}>
                          حذف
                        </button>
                      ))}
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}

export default function OwnerPage() {
  return (
    <ToastProvider>
      <Owner />
    </ToastProvider>
  );
}
