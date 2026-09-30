import { Occupancy, applyMoves, type Move } from './moves';
import { unitIndex, type Model, type PlacementMap, type Unit } from './units';

/** حصة معروضة: ساعة أو أكثر متتالية لنفس القسم والمادة والأستاذ داخل نفس الفترة. */
export interface LessonGroup {
  day: number;
  /** أول حصة. */
  period: number;
  /** الوحدة الأولى (للمادة والقسم والأستاذ). */
  unit: Unit;
  /** مفاتيح الوحدات بالترتيب. */
  units: string[];
}

/**
 * تجميع الساعات المتتالية في يوم قسم أو شخص (rowGroups): تنضم الساعة إلى الحصة السابقة إذا
 * كانت ملاصقة لها، في نفس الفترة، ولنفس القسم والمادة والسجل.
 */
export function rowGroups(
  model: Model,
  o: Occupancy,
  kind: 'class' | 'person',
  id: string,
  day: number,
): LessonGroup[] {
  const byKey = unitIndex(model);
  const out: LessonGroup[] = [];
  for (let p = 0; p < model.grid.periods; p++) {
    const k = kind === 'class' ? o.classAt(id, day, p) : o.personAt(id, day, p);
    if (!k) continue;
    const u = byKey.get(k);
    if (!u) continue;
    const g = out[out.length - 1];
    if (
      g &&
      g.period + g.units.length === p &&
      model.grid.halfOf(g.period) === model.grid.halfOf(p) &&
      g.unit.subject === u.subject &&
      g.unit.class_id === u.class_id &&
      g.unit.teacher_id === u.teacher_id
    )
      g.units.push(k);
    else out.push({ day, period: p, unit: u, units: [k] });
  }
  return out;
}

/** هدف نقل يدوي: نقل إلى خانة فارغة، أو تبديل مع حصة بنفس الطول. */
export type Target = { kind: 'move' } | { kind: 'swap'; with: string[] };

/**
 * الخانات التي يمكن نقل حصة (ساعة أو ساعتين) إليها دون تعارض (targetsFor):
 * نقل مباشر، وإلا تبديل مع حصة القسم التي تبدأ في تلك الخانة وبنفس عدد الساعات.
 * المفتاح `${day}-${period}`.
 */
export function targetsFor(
  model: Model,
  placed: PlacementMap,
  units: readonly string[],
): Map<string, Target> {
  const res = new Map<string, Target>();
  const byKey = unitIndex(model);
  const first = units[0];
  const u0 = first === undefined ? undefined : byKey.get(first);
  const x = first === undefined ? undefined : placed.get(first);
  if (!u0 || !x) return res;
  const { grid } = model;
  const n = units.length;
  const o = Occupancy.from(model, placed);
  for (const d of grid.activeDays)
    for (let p = 0; p + n - 1 < grid.periods; p++) {
      if (grid.halfOf(p) !== grid.halfOf(p + n - 1) || (d === x[0] && p === x[1])) continue;
      const mv: Move[] = units.map((unit, k) => ({ unit, day: d, period: p + k }));
      if (applyMoves(model, placed, mv)) {
        res.set(`${d}-${p}`, { kind: 'move' });
        continue;
      }
      const G = rowGroups(model, o, 'class', u0.class_id, d).find(
        (g) => g.period === p && g.units.length === n,
      );
      if (!G || G.units.some((k) => units.includes(k))) continue;
      const sw: Move[] = [
        ...mv,
        ...G.units.map((unit, k) => ({ unit, day: x[0], period: x[1] + k })),
      ];
      if (applyMoves(model, placed, sw)) res.set(`${d}-${p}`, { kind: 'swap', with: G.units });
    }
  return res;
}
