import type { PrototypeMetrics } from '../contract/oracle';
import { metrics } from './metrics';
import { Occupancy, applyMoves, type Move } from './moves';
import { unitIndex, type Model, type PlacementMap } from './units';

/** يوم يأتي فيه أستاذ غير متواجد لساعة واحدة. */
export interface LoneDay {
  person_id: string;
  day: number;
  /** الساعة الوحيدة في ذلك اليوم. */
  unit: string;
}

/** كل أيام الساعة الواحدة للأساتذة غير المتواجدين (loneList). */
export function loneDays(model: Model, placed: PlacementMap): LoneDay[] {
  const o = Occupancy.from(model, placed);
  const out: LoneDay[] = [];
  for (const x of model.persons) {
    if (x.present) continue;
    for (const d of model.grid.activeDays) {
      let n = 0;
      let unit: string | undefined;
      for (let q = 0; q < model.grid.periods; q++) {
        const v = o.personAt(x.id, d, q);
        if (v) {
          n++;
          unit = v;
        }
      }
      if (n === 1 && unit) out.push({ person_id: x.id, day: d, unit });
    }
  }
  return out;
}

/** ترتيب الحلول (scoreOf). */
export function scoreOf(m: PrototypeMetrics): number {
  return m.unplaced * 1000 + m.lone * 200 + m.split * 150 + m.tgaps * 120 + m.gaps * 3 + m.dups * 4;
}

/**
 * نقلات صغيرة مرشحة لإزالة يوم الساعة الواحدة (candidates):
 * 1) نقل الساعة إلى يوم آخر يدرّس فيه الأستاذ (خانة فارغة، أو تبديل مع حصة القسم بجانب ساعاته)؛
 * 2) جلب ساعة أخرى للأستاذ من يوم آخر إلى جانبها.
 * الأقسام المقفلة لا تتحرك.
 */
export function loneCandidates(model: Model, placed: PlacementMap, lone: LoneDay): Move[][] {
  const res: Move[][] = [];
  const byKey = unitIndex(model);
  const u = byKey.get(lone.unit);
  const x = placed.get(lone.unit);
  if (!u || !x) return res;
  const { grid } = model;
  const P = grid.periods;
  const tid = lone.person_id;
  const d = lone.day;
  const o = Occupancy.from(model, placed);
  const locked = new Set(model.school.locked_classes);
  const can = (k: string) => {
    const v = byKey.get(k);
    return !!v && !locked.has(v.class_id);
  };
  const hoursOn = (dd: number) => {
    let n = 0;
    for (let q = 0; q < P; q++) if (o.personAt(tid, dd, q)) n++;
    return n;
  };
  const adj = (dd: number) => {
    const r: number[] = [];
    for (let q = 0; q < P; q++)
      if (o.personAt(tid, dd, q))
        for (const p of [q - 1, q + 1])
          if (p >= 0 && p < P && grid.halfOf(p) === grid.halfOf(q)) r.push(p);
    return r;
  };

  if (can(lone.unit))
    for (const d2 of grid.activeDays) {
      if (d2 === d || !hoursOn(d2)) continue;
      const near = adj(d2);
      for (let p = 0; p < P; p++) {
        const w = o.classAt(u.class_id, d2, p);
        if (!w) {
          res.push([{ unit: lone.unit, day: d2, period: p }]);
          continue;
        }
        if (w !== lone.unit && can(w) && near.includes(p))
          res.push([
            { unit: lone.unit, day: d2, period: p },
            { unit: w, day: x[0], period: x[1] },
          ]);
      }
    }

  for (const v of model.units) {
    const y = placed.get(v.key);
    if (v.person_id !== tid || v.key === lone.unit || !y || !can(v.key) || y[0] === d) continue;
    for (const p of [x[1] - 1, x[1] + 1]) {
      if (p < 0 || p >= P || grid.halfOf(p) !== grid.halfOf(x[1])) continue;
      const w = o.classAt(v.class_id, d, p);
      if (!w) res.push([{ unit: v.key, day: d, period: p }]);
      else if (can(w))
        res.push([
          { unit: v.key, day: d, period: p },
          { unit: w, day: y[0], period: y[1] },
        ]);
    }
  }
  return res;
}

export interface LoneProposal {
  moves: Move[];
  before: PrototypeMetrics;
  after: PrototypeMetrics;
  score: number;
}

/**
 * أفضل الحلول الصغيرة ليوم ساعة واحدة (proposals): النقلات الصالحة التي تنقص أيام الساعة
 * الواحدة دون زيادة الحصص بدون مكان، مرتبة بـ scoreOf + 2 لكل نقلة، وحل واحد لكل نقلة أولى.
 */
export function loneProposals(
  model: Model,
  placed: PlacementMap,
  lone: LoneDay,
  max = 3,
): LoneProposal[] {
  const before = metrics(model, placed);
  const seen = new Set<string>();
  const out: LoneProposal[] = [];
  for (const moves of loneCandidates(model, placed, lone)) {
    const sig = JSON.stringify(moves);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const next = applyMoves(model, placed, moves);
    if (!next) continue;
    const after = metrics(model, next);
    if (after.unplaced > before.unplaced || after.lone >= before.lone) continue;
    out.push({ moves, before, after, score: scoreOf(after) + moves.length * 2 });
  }
  out.sort((a, b) => a.score - b.score);
  const pick: LoneProposal[] = [];
  const firsts = new Set<string>();
  for (const c of out) {
    const k = JSON.stringify(c.moves[0]);
    if (firsts.has(k)) continue;
    firsts.add(k);
    pick.push(c);
    if (pick.length >= max) break;
  }
  return pick;
}
