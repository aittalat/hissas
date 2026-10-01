'use client';

import { slugify } from '@hissas/shared';
import { useRouter } from 'next/navigation';
import { AppPreview, BrandForm } from '@/components/brand/brand-form';
import { useSchoolCtx } from '@/lib/school';
import { getPlatform } from '@/lib/store';

/** هوية المدرسة (viewBrand): الاسم، الرابط، اللون، الشعار. */
export default function BrandPage() {
  const { meta, setMeta, update } = useSchoolCtx();
  const router = useRouter();
  return (
    <div className="grid2">
      <section className="panel">
        <h2>هوية المدرسة</h2>
        <p className="hint">تظهر في رأس الصفحة، وتطبيق الأولياء، والجداول المطبوعة.</p>
        <BrandForm
          prefix="br"
          value={meta}
          onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
          onCommitName={(v) => {
            const name = v.trim() || meta.name;
            setMeta((m) => ({ ...m, name }));
            update((s) => ({ ...s, school: { ...s.school, name } }));
          }}
          onCommitSlug={(v) => {
            const taken = getPlatform()
              .schools.filter((m) => m.id !== meta.id)
              .map((m) => m.slug);
            const slug = slugify(v || meta.name, taken);
            if (slug === meta.slug) return;
            setMeta((m) => ({ ...m, slug }));
            router.replace(`/s/${slug}/brand`);
          }}
        />
      </section>
      <section className="panel">
        <AppPreview value={meta} />
      </section>
    </div>
  );
}
