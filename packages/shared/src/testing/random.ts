import type { DayMode } from '../calendar';
import type { Person, Placement, SchoolData, Slot, Subject, Teacher } from '../contract/school';
import { buildModel } from '../timetable/units';

/** مولّد عشوائي ببذرة (mulberry32) — نتائج قابلة للتكرار. */
export function rng(seed: number) {
  let a = seed | 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)] as T;
  const chance = (p: number) => next() < p;
  return { next, int, pick, chance };
}

/**
 * مدرسة عشوائية صغيرة وصالحة (للمطابقة مع النموذج الأولي): أنظمة أيام وأعداد حصص متنوعة،
 * أشخاص متواجدون وغير متواجدين، أشخاص بعدة مواد، خانات محجوبة، مواد بلا سقف يومي.
 */
export function randomSchool(seed: number): SchoolData {
  const r = rng(seed);
  const am = r.int(2, 6);
  const pm = r.int(0, 5);
  const P = am + pm;
  const days = Array.from({ length: 6 }, () =>
    r.pick<DayMode>(['full', 'full', 'full', 'am', 'off']),
  ) as SchoolData['config']['days'];
  const subjects: Subject[] = Array.from({ length: r.int(2, 5) }, (_, i) => ({
    key: `s${i}`,
    name: `مادة ${i}`,
    short: `م${i}`,
    default_hours: r.int(1, 4),
    hue: r.int(0, 359),
    no_daily_cap: r.chance(0.2),
    hard: r.chance(0.3),
    prefer_double: r.chance(0.2),
  }));
  const classes = Array.from({ length: r.int(1, 4) }, (_, i) => ({
    id: `c${i}`,
    name: `C-${i}`,
    level_rank: r.int(0, 5),
    subjects: subjects.filter(() => r.chance(0.7)).map((s) => s.key),
  }));
  const randomSlots = (n: number): Slot[] => {
    const set = new Set<string>();
    for (let i = 0; i < n; i++) set.add(`${r.int(0, 5)}-${r.int(0, Math.max(0, P - 1))}`);
    return [...set].map((k) => k.split('-').map(Number) as Slot);
  };
  const persons: Person[] = Array.from({ length: r.int(1, 5) }, (_, i) => ({
    id: `p${i}`,
    full_name: `أ. شخص ${i}`,
    present: r.chance(0.4),
    shared: r.chance(0.2),
    unavailable: r.chance(0.5) ? randomSlots(r.int(1, 10)) : [],
    other_school: r.chance(0.3) ? randomSlots(r.int(1, 6)) : [],
  }));
  const records = new Map<string, Teacher>();
  for (const c of classes)
    for (const s of c.subjects) {
      if (!r.chance(0.85)) continue;
      const p = r.pick(persons);
      const id = `r-${p.id}-${s}`;
      if (!records.has(id)) records.set(id, { id, person_id: p.id, subject: s, classes: [] });
      records.get(id)?.classes.push({ class_id: c.id, hours: r.int(1, 5) });
    }
  // الأشخاص بلا سجلات لا يظهرون في persons() للنموذج الأولي
  const used = new Set([...records.values()].map((t) => t.person_id));
  return {
    version: 1,
    name: `random-${seed}`,
    config: {
      period_minutes: r.pick([45, 50, 55, 60]),
      am_start: '08:00',
      am_count: am,
      pm_start: '14:00',
      pm_count: pm,
      break_after_2nd_minutes: r.pick([0, 10, 15]),
      pairing_mode: r.pick([1, 2] as const),
      days,
    },
    subjects,
    classes,
    persons: persons.filter((p) => used.has(p.id)),
    teachers: [...records.values()],
    locked_classes: [],
  };
}

/**
 * جدول عشوائي للمدرسة: معظم الساعات موضوعة، بما فيها خانات غير صالحة وتعارضات
 * (لاختبار المؤشرات على الحالات الصعبة أيضا).
 */
export function randomPlacements(school: SchoolData, seed: number, density = 0.8): Placement[] {
  const r = rng(seed ^ 0x9e3779b9);
  const model = buildModel(school);
  const P = model.grid.periods;
  const out: Placement[] = [];
  for (const u of model.units) {
    if (!r.chance(density)) continue;
    // نصف الحالات في خانات قليلة لتكثير التعارضات والتجاور
    const day = r.chance(0.5) ? r.int(0, 1) : r.int(0, 5);
    const period = r.chance(0.5) ? r.int(0, Math.min(3, P - 1)) : r.int(0, Math.max(0, P - 1));
    out.push({ class_id: u.class_id, subject: u.subject, index: u.index, day, period });
  }
  return out;
}
