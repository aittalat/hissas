import type { Slot } from '../contract/school';
import { unitIndex, type Model, type PlacementMap, type Unit } from './units';

/** إشغال الخانات (newOcc/put في النموذج الأولي). */
export class Occupancy {
  private readonly cls = new Map<string, string>();
  private readonly per = new Map<string, string>();
  private readonly subjDay = new Map<string, number>();

  constructor(private readonly model: Model) {}

  static from(model: Model, placed: PlacementMap, ignore?: ReadonlySet<string>): Occupancy {
    const o = new Occupancy(model);
    for (const u of model.units) {
      if (ignore?.has(u.key)) continue;
      const x = placed.get(u.key);
      if (x) o.put(u, x[0], x[1]);
    }
    return o;
  }

  put(u: Unit, d: number, p: number): void {
    this.cls.set(`${u.class_id}|${d}|${p}`, u.key);
    this.per.set(`${u.person_id}|${d}|${p}`, u.key);
    const k = `${u.class_id}|${u.subject}|${d}`;
    this.subjDay.set(k, (this.subjDay.get(k) ?? 0) + 1);
  }

  /** عدد ساعات المادة مع القسم في اليوم. */
  subjectDayCount(classId: string, subject: string, d: number): number {
    return this.subjDay.get(`${classId}|${subject}|${d}`) ?? 0;
  }

  classAt(classId: string, d: number, p: number) {
    return this.cls.get(`${classId}|${d}|${p}`);
  }

  personAt(personId: string, d: number, p: number) {
    return this.per.get(`${personId}|${d}|${p}`);
  }

  /**
   * يمكن وضع الساعة في الخانة (fits): القيود 6.1 مقابل الإشغال الحالي —
   * سقف ساعتين، قاعدة الفترة الواحدة لغير المتواجد، خانة صالحة وفارغة وغير محجوبة.
   */
  fits(u: Unit, d: number, p: number): boolean {
    const { model } = this;
    const { grid } = model;
    if (
      !model.subjectNoCap(u.subject) &&
      (this.subjDay.get(`${u.class_id}|${u.subject}|${d}`) ?? 0) + 1 > 2
    )
      return false;
    const person = model.person(u.person_id);
    if (person && !person.present) {
      const [lo, hi] = grid.halfRange(grid.halfOf(p) === 0 ? 1 : 0);
      for (let q = lo; q < hi; q++) if (this.personAt(u.person_id, d, q)) return false;
    }
    if (!grid.isValid(d, p)) return false;
    if (this.classAt(u.class_id, d, p) || this.personAt(u.person_id, d, p)) return false;
    return !model.isBlocked(u.person_id, d, p);
  }
}

export interface Move {
  unit: string;
  day: number;
  period: number;
}

/**
 * تطبيق نقلات على جدول (applyMoves): الوحدات المنقولة تُرفع أولا ثم توضع بالترتيب،
 * وكل نقلة يجب أن تحترم القيود. يرجع الجدول الجديد أو null.
 */
export function applyMoves(
  model: Model,
  placed: PlacementMap,
  moves: readonly Move[],
): Map<string, Slot> | null {
  const byKey = unitIndex(model);
  const o = Occupancy.from(model, placed, new Set(moves.map((m) => m.unit)));
  const next = new Map(placed);
  for (const m of moves) {
    const u = byKey.get(m.unit);
    if (!u || !o.fits(u, m.day, m.period)) return null;
    o.put(u, m.day, m.period);
    next.set(u.key, [m.day, m.period]);
  }
  return next;
}

/** كل الخانات التي يمكن نقل الساعة إليها (بعد رفعها من مكانها). */
export function validTargets(model: Model, placed: PlacementMap, unit: string): Slot[] {
  const u = unitIndex(model).get(unit);
  if (!u) return [];
  const o = Occupancy.from(model, placed, new Set([unit]));
  const out: Slot[] = [];
  for (let d = 0; d < 6; d++)
    for (let p = 0; p < model.grid.periods; p++) if (o.fits(u, d, p)) out.push([d, p]);
  return out;
}
