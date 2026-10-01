'use client';

import { MODULE_MAP } from '@hissas/shared';
import { useRouter } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { PageHeader } from '@/components/life/ui';
import { useLife } from '@/lib/life';

/** مسار الوحدات المفعّلة (mod-go). */
const PATH: Record<string, string> = {
  students: '/students',
  absences: '/absences',
  discipline: '/discipline',
  attest: '/students',
  tt: '/timetable',
  comm: '/comm',
  lists: '/students?tab=lists',
};

/** كل الوحدات (viewModules): المفعّلة تعمل، والأخرى في خارطة الطريق. */
export default function ModulesPage() {
  const { href, toast } = useLife();
  const router = useRouter();
  return (
    <>
      <PageHeader
        icon={LayoutGrid}
        tone="var(--p-yellow)"
        title="كل الوحدات"
        sub="الوحدات المفعّلة تعمل الآن. الأخرى في خارطة الطريق."
      />
      <div className="lgrid">
        {MODULE_MAP.map(([g, L]) => (
          <section key={g} className="panel">
            <h3>{g}</h3>
            <div className="list">
              {L.map(([k, n, on]) => (
                <button
                  key={k}
                  className="row"
                  aria-disabled={on ? undefined : true}
                  onClick={() => {
                    if (!on) {
                      toast('هذه الوحدة في خارطة الطريق');
                      return;
                    }
                    if (k === 'attest') toast('افتح ملف التلميذ ثم اضغط "شهادة مدرسية"');
                    router.push(href(PATH[k] ?? ''));
                  }}
                >
                  <span>{n}</span>
                  <span className={`tag${on ? ' acc' : ''}`}>{on ? 'مفعّلة' : 'قريبا'}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
