import type { Slot } from '../contract/school';
import type { Model, PlacementMap } from './units';

/** تغيير في الجدول لـ (قسم، مادة): من خانة إلى خانة، أو ساعة أُضيفت/حُذفت/بقيت بدون مكان. */
export interface Change {
  class_id: string;
  subject: string;
  from: Slot | null;
  to: Slot | null;
  /** to فقط: ساعة جديدة (زادت ساعات المادة)، وإلا "وُضعت". */
  add?: boolean;
  /** from فقط: حُذفت ساعة (نقصت ساعات المادة)، وإلا "بقيت بدون مكان". */
  del?: boolean;
}

const enc = (s: Slot) => s[0] * 100 + s[1];
const dec = (v: number): Slot => [Math.floor(v / 100), v % 100];

function slotMap(model: Model, placed: PlacementMap) {
  const m = new Map<string, number[]>();
  for (const u of model.units) {
    const x = placed.get(u.key);
    if (!x) continue;
    const k = `${u.class_id}|${u.subject}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)?.push(enc(x));
  }
  for (const v of m.values()) v.sort((a, b) => a - b);
  return m;
}

function need(model: Model) {
  const m = new Map<string, number>();
  for (const u of model.units) {
    const k = `${u.class_id}|${u.subject}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * الفرق بين جدولين (diffPlans): الساعات متماثلة داخل (القسم، المادة)، فتُطابق الخانات
 * المشتركة أولا، والباقي نقلات بالترتيب، ثم إضافات أو حذف.
 */
export function diffPlans(
  before: Model,
  placedBefore: PlacementMap,
  after: Model,
  placedAfter: PlacementMap,
): Change[] {
  const A = slotMap(before, placedBefore);
  const B = slotMap(after, placedAfter);
  const n0 = need(before);
  const n1 = need(after);
  const out: Change[] = [];
  for (const k of new Set([...A.keys(), ...B.keys(), ...n1.keys()])) {
    const b = [...(B.get(k) ?? [])];
    const rm = (A.get(k) ?? []).filter((x) => {
      const i = b.indexOf(x);
      if (i >= 0) {
        b.splice(i, 1);
        return false;
      }
      return true;
    });
    const sep = k.lastIndexOf('|');
    const class_id = k.slice(0, sep);
    const subject = k.slice(sep + 1);
    const dn = (n1.get(k) ?? 0) - (n0.get(k) ?? 0);
    const moves = Math.min(rm.length, b.length);
    for (let i = 0; i < moves; i++)
      out.push({ class_id, subject, from: dec(rm[i] as number), to: dec(b[i] as number) });
    for (let i = moves; i < b.length; i++)
      out.push({ class_id, subject, from: null, to: dec(b[i] as number), add: dn > 0 });
    for (let i = moves; i < rm.length; i++)
      out.push({ class_id, subject, from: dec(rm[i] as number), to: null, del: dn < 0 });
  }
  return out;
}
