import type { PrototypeMetrics } from '../contract/oracle';
import type { Model, PlacementMap } from './units';

/**
 * مؤشرات الجدول (metrics في النموذج الأولي)، حرفيا بما في ذلك سلوكه مع الجداول المتعارضة:
 * - gaps: ساعات فارغة بين حصص القسم داخل نفس الفترة.
 * - dups: ساعات مادة ليس لها جار من نفس المادة، في يوم فيه ساعتان أو أكثر للمادة مع القسم.
 * - tgaps / lone / split: للأساتذة غير المتواجدين فقط — فراغات، أيام بساعة واحدة، أيام صباحا ومساء.
 */
export function metrics(model: Model, placed: PlacementMap): PrototypeMetrics {
  const { grid, units } = model;
  const cd = new Map<string, Set<number>>();
  const td = new Map<string, { person: string; periods: number[] }>();
  const sd = new Map<string, number[]>();
  let count = 0;
  for (const u of units) {
    const x = placed.get(u.key);
    if (!x) continue;
    count++;
    const [d, p] = x;
    const ck = `${u.class_id}|${d}`;
    if (!cd.has(ck)) cd.set(ck, new Set());
    cd.get(ck)?.add(p);
    const tk = `${u.person_id}|${d}`;
    if (!td.has(tk)) td.set(tk, { person: u.person_id, periods: [] });
    td.get(tk)?.periods.push(p);
    const sk = `${u.class_id}|${u.subject}|${d}`;
    if (!sd.has(sk)) sd.set(sk, []);
    sd.get(sk)?.push(p);
  }

  // الفراغ في كل فترة = (آخر − أول + 1 − العدد)؛ العدد يشمل التكرار كما في النموذج الأولي
  const gapsOf = (list: number[]) => {
    let n = 0;
    for (const h of [0, 1] as const) {
      const [lo, hi] = grid.halfRange(h);
      const b = list.filter((q) => q >= lo && q < hi);
      if (b.length) n += Math.max(...b) - Math.min(...b) + 1 - b.length;
    }
    return n;
  };

  let gaps = 0;
  for (const set of cd.values()) gaps += gapsOf([...set]);

  let tgaps = 0;
  let lone = 0;
  let split = 0;
  for (const { person, periods } of td.values()) {
    const P = model.person(person);
    if (!P || P.present) continue;
    tgaps += gapsOf(periods);
    if (periods.length === 1) lone++;
    const am = periods.filter((q) => grid.halfOf(q) === 0).length;
    if (am && am < periods.length) split++;
  }

  let dups = 0;
  for (const list of sd.values()) {
    const a = [...list].sort((x, y) => x - y);
    if (a.length < 2) continue;
    for (let i = 0; i < a.length; i++) {
      const cur = a[i] as number;
      const prev = a[i - 1];
      const next = a[i + 1];
      const L = prev !== undefined && prev === cur - 1 && grid.halfOf(prev) === grid.halfOf(cur);
      const R = next !== undefined && next === cur + 1 && grid.halfOf(next) === grid.halfOf(cur);
      if (!L && !R) dups++;
    }
  }

  return {
    gaps,
    dups,
    tgaps,
    lone,
    split,
    unplaced: units.length - count,
    placed: count,
    total: units.length,
  };
}

/** الجودة /100 (quality): conflicts = عدد الساعات في conflictSet. */
export function quality(m: PrototypeMetrics, conflicts: number): number {
  return Math.max(
    0,
    Math.round(
      100 -
        m.gaps * 3 -
        m.dups * 4 -
        m.tgaps * 4 -
        m.split * 5 -
        m.lone * 8 -
        m.unplaced * 12 -
        conflicts * 15,
    ),
  );
}
