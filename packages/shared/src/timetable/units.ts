import type { Person, Placement, SchoolData, Slot } from '../contract/school';
import { makeGrid, type Grid } from '../grid';

/** ساعة واحدة من (القسم، المادة): الوحدة التي يضعها المحرك. */
export interface Unit {
  /** `${class_id}|${subject}|${index}` */
  key: string;
  class_id: string;
  subject: string;
  index: number;
  teacher_id: string;
  person_id: string;
}

export const unitKey = (class_id: string, subject: string, index: number) =>
  `${class_id}|${subject}|${index}`;

const slotKey = (d: number, p: number) => d * 100 + p;

/**
 * مدرسة جاهزة للحساب: الشبكة، الوحدات بنفس ترتيب unitsOf في النموذج الأولي،
 * والأشخاص بترتيب أول ظهور في السجلات (كما في persons()).
 */
export interface Model {
  school: SchoolData;
  grid: Grid;
  units: Unit[];
  /** مواد أقسام بلا أستاذ (miss في unitsOf). */
  missing: { class_id: string; subject: string }[];
  /** الأشخاص الذين لهم سجلات، بترتيب أول ظهور. */
  persons: Person[];
  person(id: string): Person | undefined;
  /** الخانة محجوبة للشخص (غير متاح أو محجوز في مدرسة أخرى). */
  isBlocked(personId: string, day: number, period: number): boolean;
  subjectNoCap(subject: string): boolean;
}

export function buildModel(school: SchoolData): Model {
  const grid = makeGrid(school.config);
  const units: Unit[] = [];
  const missing: Model['missing'] = [];
  for (const c of school.classes)
    for (const s of c.subjects) {
      const t = school.teachers.find(
        (t) => t.subject === s && t.classes.some((x) => x.class_id === c.id),
      );
      const hours = t?.classes.find((x) => x.class_id === c.id)?.hours;
      if (!t || hours === undefined) {
        missing.push({ class_id: c.id, subject: s });
        continue;
      }
      for (let j = 0; j < hours; j++)
        units.push({
          key: unitKey(c.id, s, j),
          class_id: c.id,
          subject: s,
          index: j,
          teacher_id: t.id,
          person_id: t.person_id,
        });
    }

  const byId = new Map(school.persons.map((p) => [p.id, p]));
  const order: Person[] = [];
  const seen = new Set<string>();
  for (const t of school.teachers) {
    const p = byId.get(t.person_id);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      order.push(p);
    }
  }

  const blocked = new Map<string, Set<number>>();
  for (const p of school.persons)
    blocked.set(
      p.id,
      new Set([...p.unavailable, ...p.other_school].map(([d, q]) => slotKey(d, q))),
    );
  const noCap = new Set(school.subjects.filter((s) => s.no_daily_cap).map((s) => s.key));

  return {
    school,
    grid,
    units,
    missing,
    persons: order,
    person: (id) => byId.get(id),
    // شخص غير موجود = محجوب دائما (blocked(undefined) في النموذج الأولي)
    isBlocked: (id, d, p) => blocked.get(id)?.has(slotKey(d, p)) ?? true,
    subjectNoCap: (s) => noCap.has(s),
  };
}

/** خريطة الوحدة ← الخانة. إذا تكررت الوحدة يُعتمد آخر ظهور. */
export type PlacementMap = ReadonlyMap<string, Slot>;

export function placementMap(placements: readonly Placement[]): Map<string, Slot> {
  const m = new Map<string, Slot>();
  for (const x of placements) m.set(unitKey(x.class_id, x.subject, x.index), [x.day, x.period]);
  return m;
}

export function toPlacements(model: Model, map: PlacementMap): Placement[] {
  const out: Placement[] = [];
  for (const u of model.units) {
    const s = map.get(u.key);
    if (s)
      out.push({
        class_id: u.class_id,
        subject: u.subject,
        index: u.index,
        day: s[0],
        period: s[1],
      });
  }
  return out;
}
