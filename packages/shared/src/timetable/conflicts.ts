import type { Model, PlacementMap, Unit } from './units';

/**
 * الساعات المخالفة للقيود (conflictSet في النموذج الأولي): أكثر من ساعتين للمادة مع القسم
 * في اليوم (إلا no_daily_cap)، خانة غير صالحة أو محجوبة للأستاذ، تعارض قسم أو شخص.
 * ترجع مفاتيح الوحدات.
 */
export function conflictSet(model: Model, placed: PlacementMap): Set<string> {
  const bad = new Set<string>();
  const perDay = new Map<string, Unit[]>();
  for (const u of model.units) {
    const x = placed.get(u.key);
    if (!x || model.subjectNoCap(u.subject)) continue;
    const k = `${u.class_id}|${u.subject}|${x[0]}`;
    if (!perDay.has(k)) perDay.set(k, []);
    perDay.get(k)?.push(u);
  }
  for (const list of perDay.values()) if (list.length > 2) for (const u of list) bad.add(u.key);

  const seen = new Map<string, string>();
  for (const u of model.units) {
    const x = placed.get(u.key);
    if (!x) continue;
    const [d, p] = x;
    if (!model.grid.isValid(d, p) || model.isBlocked(u.person_id, d, p)) bad.add(u.key);
    for (const k of [`${u.class_id}|c|${d}|${p}`, `${u.person_id}|t|${d}|${p}`]) {
      const other = seen.get(k);
      if (other && other !== u.key) {
        bad.add(u.key);
        bad.add(other);
      } else seen.set(k, u.key);
    }
  }
  return bad;
}

export type ViolationKind =
  'class_clash' | 'person_clash' | 'invalid_slot' | 'blocked_slot' | 'daily_cap' | 'half_day';

export interface Violation {
  kind: ViolationKind;
  /** الوحدات المعنية. */
  units: string[];
  day: number;
  period?: number;
  class_id?: string;
  person_id?: string;
  subject?: string;
}

/**
 * كل مخالفات القيود الإلزامية 6.1 بشكل مفصّل (لاختبارات المحرك وللواجهة).
 * يغطي ما يغطيه conflictSet، ويضيف القاعدة 4: غير المتواجد لا يأتي صباحا ومساء في نفس اليوم.
 */
export function violations(model: Model, placed: PlacementMap): Violation[] {
  const out: Violation[] = [];
  const bySlot = new Map<string, Unit[]>();
  const add = (k: string, u: Unit) => {
    if (!bySlot.has(k)) bySlot.set(k, []);
    bySlot.get(k)?.push(u);
  };
  const cap = new Map<string, Unit[]>();
  const halves = new Map<string, [Unit[], Unit[]]>();
  for (const u of model.units) {
    const x = placed.get(u.key);
    if (!x) continue;
    const [d, p] = x;
    if (!model.grid.isValid(d, p))
      out.push({ kind: 'invalid_slot', units: [u.key], day: d, period: p, class_id: u.class_id });
    else if (model.isBlocked(u.person_id, d, p))
      out.push({ kind: 'blocked_slot', units: [u.key], day: d, period: p, person_id: u.person_id });
    add(`c|${u.class_id}|${d}|${p}`, u);
    add(`t|${u.person_id}|${d}|${p}`, u);
    if (!model.subjectNoCap(u.subject)) {
      const k = `${u.class_id}|${u.subject}|${d}`;
      if (!cap.has(k)) cap.set(k, []);
      cap.get(k)?.push(u);
    }
    if (!model.person(u.person_id)?.present) {
      const k = `${u.person_id}|${d}`;
      if (!halves.has(k)) halves.set(k, [[], []]);
      halves.get(k)?.[model.grid.halfOf(p)].push(u);
    }
  }
  for (const [k, list] of bySlot) {
    if (list.length < 2) continue;
    const [kind, id, d, p] = k.split('|');
    const first = list[0] as Unit;
    out.push(
      kind === 'c'
        ? {
            kind: 'class_clash',
            units: list.map((u) => u.key),
            day: Number(d),
            period: Number(p),
            class_id: id,
          }
        : {
            kind: 'person_clash',
            units: list.map((u) => u.key),
            day: Number(d),
            period: Number(p),
            person_id: first.person_id,
          },
    );
  }
  for (const list of cap.values()) {
    if (list.length <= 2) continue;
    const u = list[0] as Unit;
    out.push({
      kind: 'daily_cap',
      units: list.map((x) => x.key),
      day: placed.get(u.key)?.[0] ?? -1,
      class_id: u.class_id,
      subject: u.subject,
    });
  }
  for (const [k, [am, pm]] of halves) {
    if (!am.length || !pm.length) continue;
    const [person, d] = k.split('|');
    out.push({
      kind: 'half_day',
      units: [...am, ...pm].map((u) => u.key),
      day: Number(d),
      person_id: person,
    });
  }
  return out;
}
