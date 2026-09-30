import type { PrototypeMetrics } from '../contract/oracle';
import type { Placement, Slot } from '../contract/school';
import type { TimetableState } from '../edit/timetable-state';
import { applyAdviceAction, type AdviceAction } from '../timetable/advise';
import { conflictSet } from '../timetable/conflicts';
import { diagnose } from '../timetable/diagnose';
import { diffPlans, type Change } from '../timetable/diff';
import { metrics, quality } from '../timetable/metrics';
import { buildModel, placementMap, toPlacements, type Model } from '../timetable/units';
import { createEngine, type EngineOptions } from './local';

/**
 * عمليات المحرك المحلي (generate، improve، buildSolutions في النموذج الأولي) على حالة الجدول.
 * الواجهة تشغّلها في Web Worker؛ محرك CP-SAT سيأخذ مكانها بنفس المدخلات والمخرجات.
 */

type Opt = Pick<EngineOptions, 'random' | 'now'>;

const clock = (o: Opt) =>
  o.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

/** الأقسام المقفلة تبقى على خاناتها. */
function lockedInit(model: Model, placements: readonly Placement[]): Map<string, Slot> {
  const placed = placementMap(placements);
  const init = new Map<string, Slot>();
  for (const c of model.school.locked_classes)
    for (const u of model.units) {
      const x = placed.get(u.key);
      if (u.class_id === c && x) init.set(u.key, x);
    }
  return init;
}

/**
 * توليد جدول كامل (generate): تشغيلان (جشع + تلدين)، ثم تلميع، ثم بحث أعمق حتى 12 ثانية
 * ما دامت هناك حصص بدون مكان ولا سبب واضح لها في البيانات.
 */
export function generateTimetable(
  school: TimetableState['school'],
  placements: readonly Placement[],
  budget = 5000,
  o: Opt = {},
): Placement[] {
  const model = buildModel(school);
  const init = lockedInit(model, placements);
  const now = clock(o);
  let best: { pl: Map<string, Slot>; sc: number } | null = null;
  const runs = 2;
  const per = (budget * 0.8) / runs;
  for (let r = 0; r < runs; r++) {
    const E = createEngine(model, init, o);
    E.greedy();
    E.anneal(per, 25, 0.15);
    if (!best || E.score() < best.sc) best = { pl: E.out(), sc: E.score() };
  }
  let b = best as { pl: Map<string, Slot>; sc: number };
  {
    const E = createEngine(model, b.pl, o);
    E.anneal(budget * 0.2, 3, 0.05);
    if (E.score() < b.sc) b = { pl: E.out(), sc: E.score() };
  }
  const miss = (pl: Map<string, Slot>) => model.units.filter((u) => !pl.has(u.key)).length;
  const t1 = now();
  if (miss(b.pl) && !diagnose(model).length)
    for (let k = 0; miss(b.pl) && now() - t1 < 12000; k++) {
      const E = createEngine(model, k % 2 ? init : b.pl, o);
      if (k % 2) E.greedy();
      E.anneal(2000, k % 2 ? 25 : 12, 0.1);
      if (E.score() < b.sc) b = { pl: E.out(), sc: E.score() };
    }
  return toPlacements(model, b.pl);
}

export interface Solution {
  kind: 'min_change' | 'balanced' | 'best_quality';
  name: string;
  desc: string;
  placements: Placement[];
  metrics: PrototypeMetrics;
  quality: number;
  changes: Change[];
  score: number;
}

export interface SolutionSet {
  title: string;
  /** الحالة بعد التعديل المطلوب (قبل اختيار الحل): بيانات المدرسة الجديدة. */
  after: TimetableState;
  before: PrototypeMetrics;
  q0: number;
  list: Solution[];
}

const CONFIGS = [
  { kind: 'min_change', name: 'أقل تغيير', desc: 'ينقل أقل عدد من الحصص', mv: 12, T0: 3, ms: 1000 },
  {
    kind: 'balanced',
    name: 'متوازن',
    desc: 'توازن بين الجودة وعدد التغييرات',
    mv: 4,
    T0: 6,
    ms: 1200,
  },
  {
    kind: 'best_quality',
    name: 'أفضل جودة',
    desc: 'أفضل جدول ممكن ولو تغيرت حصص أكثر',
    mv: 1,
    T0: 15,
    ms: 1600,
  },
] as const;

/**
 * حلول للاختيار (buildSolutions، SPEC §6.4 /repair): يطبّق التعديل المطلوب (إن وُجد)، ثم يبحث
 * عن ثلاثة حلول بعقوبة تحرك 12 / 4 / 1، ويحذف المكرر وما لا يحسّن على السابق.
 * لا يُطبَّق شيء: الواجهة تعرض الحلول وقائمة التغييرات، والمستعمل يختار.
 */
export function buildSolutions(
  state: TimetableState,
  title: string,
  mutation: AdviceAction | null,
  deep: boolean,
  o: Opt = {},
): SolutionSet {
  const m0Model = buildModel(state.school);
  const pl0 = placementMap(state.placements);
  const m0 = metrics(m0Model, pl0);
  const after = mutation ? applyAdviceAction(state, mutation) : structuredClone(state);
  const model = buildModel(after.school);
  const init = placementMap(after.placements);
  const list: Solution[] = [];
  const seen = new Set<string>();
  for (const c of CONFIGS) {
    let best: { sc: number; pl: Map<string, Slot> } | null = null;
    for (let r = 0; r < 2; r++) {
      const E = createEngine(model, init, { ...o, mv: c.mv });
      E.greedy();
      E.anneal((deep ? c.ms * 4 : c.ms) / 2, deep ? c.T0 * 2 : c.T0, 0.1);
      if (!best || E.score() < best.sc) best = { sc: E.score(), pl: E.out() };
    }
    const b = best as { sc: number; pl: Map<string, Slot> };
    const ch = diffPlans(m0Model, pl0, model, b.pl);
    const m = metrics(model, b.pl);
    const sig = JSON.stringify(ch);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const pure = createEngine(model, b.pl, o).score();
    const last = list[list.length - 1];
    if (last && pure >= last.score - 1e-6) continue;
    if (!mutation && !ch.length) continue;
    list.push({
      kind: c.kind,
      name: c.name,
      desc: c.desc,
      placements: toPlacements(model, b.pl),
      metrics: m,
      quality: quality(m, conflictSet(model, b.pl).size),
      changes: ch,
      score: pure,
    });
  }
  return { title, after, before: m0, q0: quality(m0, 0), list };
}
