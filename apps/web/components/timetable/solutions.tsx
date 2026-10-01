'use client';

import {
  DAY_NAMES_AR,
  effectTags,
  noticeSolutionApplied,
  periodTimes,
  placementMap,
  type AdviceAction,
  type Change,
  type SchoolDay,
  type SolutionSet,
} from '@hissas/shared';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { useGenerate } from '@/lib/generate';
import { useSchoolCtx } from '@/lib/school';
import { solveSolutions } from '@/lib/solver';
import { EffectTags } from './effects';

export interface Solutions {
  open: SolutionSet | null;
  busy: 'generate' | 'solutions' | null;
  generate: () => void;
  build: (title: string, mutation: AdviceAction | null, deep: boolean) => void;
  apply: (i: number) => void;
  cancel: () => void;
}

/** حلول للاختيار (buildSolutions/applySol): لا يتغير شيء قبل اختيار المستعمل. */
export function useSolutions(): Solutions {
  const { state, update, notify } = useSchoolCtx();
  const toast = useToast();
  const gen = useGenerate();
  const [open, setOpen] = useState<SolutionSet | null>(null);
  const [busy, setBusy] = useState<'solutions' | null>(null);
  return {
    open,
    busy: gen.busy ? 'generate' : busy,
    generate: () => {
      setOpen(null);
      void gen.generate();
    },
    build: (title, mutation, deep) => {
      setBusy('solutions');
      solveSolutions({ school: state.school, placements: state.placements }, title, mutation, deep)
        .then(setOpen)
        .catch((e) => toast(`تعذّر البحث عن حلول: ${String(e)}`))
        .finally(() => setBusy(null));
    },
    apply: (i) => {
      const sol = open?.list[i];
      if (!open || !sol) return;
      const next = placementMap(sol.placements);
      const prev = placementMap(state.placements);
      const moved = new Set(
        [...next.keys(), ...prev.keys()].filter((k) => String(next.get(k)) !== String(prev.get(k))),
      );
      update((s) => ({
        ...s,
        school: open.after.school,
        placements: sol.placements,
        substitutions: s.substitutions.filter(
          (x) => !x.units.some((k) => moved.has(k)) && !(x.swap_unit && moved.has(x.swap_unit)),
        ),
      }));
      if (sol.changes.length) notify(noticeSolutionApplied(sol.changes.length));
      setOpen(null);
      toast(`طُبّق الحل: ${sol.changes.length} تغيير`);
    },
    cancel: () => {
      setOpen(null);
      toast('أُلغي، والجدول بقي كما هو');
    },
  };
}

/** لائحة الحلول مع المؤشرات وقائمة التغييرات (viewSols). */
export function SolutionsPanel({ solutions }: { solutions: Solutions }) {
  const { model } = useSchoolCtx();
  const X = solutions.open;
  if (!X) return null;
  const school = X.after.school;
  const times = periodTimes(school.config);
  const at = (s: readonly [number, number]) =>
    `${DAY_NAMES_AR[s[0] as SchoolDay]} ${times[s[1]]?.[0] ?? '--:--'}`;
  const line = (x: Change) => {
    const t = school.teachers.find(
      (t) => t.subject === x.subject && t.classes.some((c) => c.class_id === x.class_id),
    );
    const tn = t && school.persons.find((p) => p.id === t.person_id)?.full_name;
    const who = `${school.subjects.find((s) => s.key === x.subject)?.short ?? x.subject} · ${school.classes.find((c) => c.id === x.class_id)?.name ?? x.class_id}${tn ? ` · ${tn}` : ''}`;
    if (x.from && x.to)
      return (
        <>
          <b>{who}</b>: من {at(x.from)} إلى {at(x.to)}
        </>
      );
    if (x.to)
      return (
        <>
          <b>{who}</b>: {x.add ? 'ساعة جديدة' : 'وُضعت'} في {at(x.to)}
        </>
      );
    return (
      <>
        <b>{who}</b>: {x.del ? 'حُذفت ساعة' : 'بقيت بدون مكان'} من {x.from ? at(x.from) : ''}
      </>
    );
  };
  void model;
  return (
    <div className="affected sols">
      <header>
        <h3>اختر حلا · {X.title}</h3>
        <button className="btn sm ghost" onClick={solutions.cancel}>
          إلغاء
        </button>
      </header>
      <p className="hint">
        لم يتغير شيء في الجدول بعد. قارن الحلول واطلع على كل تغيير، ثم طبّق الحل الذي يناسبك.
      </p>
      {!X.list.length && (
        <p className="muted">
          لم يجد المحرك حلا أفضل من الجدول الحالي. جرّب اقتراحات تغيير الساعات أو أوقات الفراغ.
        </p>
      )}
      {X.list.map((sol, i) => (
        <div className="card" key={sol.kind}>
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <b>
              الحل {i + 1} · {sol.name}
            </b>
            <span className="hint">
              الجودة {X.q0} ← {sol.quality}
            </span>
          </header>
          <span className="hint">{sol.desc}</span>
          <div className="chips">
            <EffectTags effects={effectTags(X.before, sol.metrics)} />
            <span className="tag">
              {sol.changes.length ? `${sol.changes.length} تغيير` : 'بدون نقل أي حصة'}
            </span>
          </div>
          {sol.changes.length > 0 && (
            <details>
              <summary>عرض التغييرات ({sol.changes.length})</summary>
              <ul className="chg">
                {sol.changes.map((x, k) => (
                  <li key={k}>{line(x)}</li>
                ))}
              </ul>
            </details>
          )}
          <div>
            <button
              className={`btn sm${i === 0 ? ' primary' : ''}`}
              onClick={() => solutions.apply(i)}
            >
              تطبيق هذا الحل
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
