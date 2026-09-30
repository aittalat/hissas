import { weeklyCapacity } from '../grid';
import type { Model } from './units';

/** مجموع min(2، ساعات القسم) لكل (قسم، مادة) للشخص — أو كل الساعات لـ no_daily_cap. */
function dailyCap(model: Model, personId: string): { need: number; cap: number } {
  const per = new Map<string, { subject: string; hours: number }>();
  let need = 0;
  for (const u of model.units) {
    if (u.person_id !== personId) continue;
    need++;
    const k = `${u.class_id}|${u.subject}`;
    const e = per.get(k) ?? { subject: u.subject, hours: 0 };
    e.hours++;
    per.set(k, e);
  }
  let cap = 0;
  for (const { subject, hours } of per.values())
    cap += model.subjectNoCap(subject) ? hours : Math.min(2, hours);
  return { need, cap };
}

/** الخانات الحرة للشخص في الأسبوع (freeOf). */
export function freeSlots(model: Model, personId: string): number {
  let f = 0;
  for (let d = 0; d < 6; d++)
    for (let p = 0; p < model.grid.periods; p++)
      if (model.grid.isValid(d, p) && !model.isBlocked(personId, d, p)) f++;
  return f;
}

/**
 * الحد الأقصى الممكن للشخص (tMax، SPEC §6.3): مجموع على الأيام النشطة لـ
 * min(سقف اليوم، الخانات المتاحة في أفضل فترة) — أو في الفترتين للمتواجد.
 */
export function maxPossible(model: Model, personId: string): { need: number; max: number } {
  const { need, cap } = dailyCap(model, personId);
  const present = model.person(personId)?.present ?? false;
  const { grid } = model;
  let max = 0;
  for (const d of grid.activeDays) {
    const av = (h: 0 | 1) => {
      const [lo, hi] = grid.halfRange(h);
      let n = 0;
      for (let p = lo; p < hi; p++) if (grid.isValid(d, p) && !model.isBlocked(personId, d, p)) n++;
      return n;
    };
    max += Math.min(cap, present ? av(0) + av(1) : Math.max(av(0), av(1)));
  }
  return { need, max };
}

/**
 * الشخص يُضطر رياضيا ليوم بساعة واحدة (forcedLone): لا يوجد عدد أيام k بحيث
 * 2k ≤ الساعات ≤ k × سقف اليوم. (المعنى للأستاذ غير المتواجد.)
 */
export function forcedLone(model: Model, personId: string): boolean {
  const { need: H, cap: M } = dailyCap(model, personId);
  for (let k = 1; k <= model.grid.activeDays.length; k++)
    if (2 * k <= H && H <= k * M) return false;
  return H > 0;
}

/** الأشخاص غير المتواجدين المضطرون ليوم بساعة واحدة، بترتيب الأشخاص. */
export function forcedLonePersons(model: Model): string[] {
  return model.persons.filter((p) => !p.present && forcedLone(model, p.id)).map((p) => p.id);
}

/**
 * أسباب عدم إمكان وضع كل الحصص قبل الحل (diagnose، SPEC §6.3) بنفس نصوص النموذج الأولي.
 */
export function diagnose(model: Model): string[] {
  const r: string[] = [];
  for (const x of model.persons) {
    const { need, max } = maxPossible(model, x.id);
    const f = freeSlots(model, x.id);
    if (need > f) {
      r.push(`${x.full_name}: ${need} ساعات مطلوبة و${f} فقط متاحة في أوقاته`);
      continue;
    }
    if (need > max)
      r.push(
        `${x.full_name}: ${need} ساعات، والحد الأقصى الممكن ${max}${x.present ? '' : ' لأنه يأتي إما صباحا أو مساء فقط'} وحسب أوقات فراغه`,
      );
  }
  const cap = weeklyCapacity(model.school.config);
  for (const c of model.school.classes) {
    const need = model.units.filter((u) => u.class_id === c.id).length;
    if (need > cap) r.push(`${c.name}: ${need} حصة و${cap} خانة فقط في الأسبوع`);
  }
  return r;
}
