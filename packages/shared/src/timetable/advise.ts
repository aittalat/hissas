import { DAY_NAMES_AR, type SchoolDay } from '../calendar';
import type { PrototypeMetrics } from '../contract/oracle';
import type { SchoolData, Slot, Teacher } from '../contract/school';
import { addHour, removeHour, setPresent, type TimetableState } from '../edit/timetable-state';
import { periodTimes, weeklyCapacity } from '../grid';
import { freeSlots, maxPossible } from './diagnose';
import { metrics } from './metrics';
import { Occupancy, applyMoves, type Move } from './moves';
import {
  buildModel,
  placementMap,
  toPlacements,
  unitIndex,
  unitKey,
  type Model,
  type PlacementMap,
  type Unit,
} from './units';

/**
 * مستشار الجدول (advise في النموذج الأولي): يكتشف المشاكل ويقترح لكل واحدة حلولا بأثرها.
 * الخيارات بيانات (AdviceAction) لا دوال، وتُطبَّق بـ applyAdviceAction. لا شيء يُطبَّق دون موافقة.
 */

export type AdviceKind =
  | 'unplaced'
  | 'forced_lone'
  | 'class_gap'
  | 'class_single'
  | 'teacher_gap'
  | 'teacher_split'
  | 'split_subject';

export type AdviceAction =
  /** زيادة ساعة، في خانة محددة أو بدونها (ثم إعادة التوليد إذا regen). */
  | { kind: 'add_hour'; teacher_id: string; class_id: string; slot?: Slot; regen: boolean }
  /** نقص ساعة؛ slot = خانة الحصة التي تُحذف. */
  | { kind: 'remove_hour'; teacher_id: string; class_id: string; slot?: Slot; regen: boolean }
  | { kind: 'move'; moves: Move[] }
  | { kind: 'set_present'; person_id: string; regen: boolean }
  /** فتح شاشة: التوقيت أو بيانات الأستاذ. */
  | { kind: 'goto'; screen: 'cfg' | 'data'; teacher_id?: string }
  /** حلول تلقائية لكل الجدول (/repair)؛ deep = بحث أعمق. */
  | { kind: 'solve'; deep: boolean };

export interface AdviceOption {
  label: string;
  /** وسوم الأثر كما تُعرض ("−1 فراغ للأقسام"، "أ. …: 20 ← 21 ساعة في الأسبوع"…). */
  effects: string[];
  action: AdviceAction;
}

export interface Advice {
  kind: AdviceKind;
  title: string;
  detail: string;
  options: AdviceOption[];
}

/** وسوم الفرق بين مؤشرين (effTags). */
export function effectTags(m0: PrototypeMetrics, m: PrototypeMetrics): string[] {
  const r: string[] = [];
  const dd = (a: number, b: number, n: string) => {
    if (b > a) r.push(`+${b - a} ${n}`);
    else if (b < a) r.push(`−${a - b} ${n}`);
  };
  dd(m0.unplaced, m.unplaced, 'حصة بدون مكان');
  dd(m0.gaps, m.gaps, 'فراغ للأقسام');
  dd(m0.lone, m.lone, 'يوم بساعة واحدة');
  dd(m0.split, m.split, 'يوم صباحا ومساء');
  dd(m0.tgaps, m.tgaps, 'فراغ للأساتذة');
  dd(m0.dups, m.dups, 'ساعة مفصولة');
  return r;
}

/** تطبيق خيار على الحالة. goto وsolve لا يغيّران البيانات (تتكفل بهما الواجهة/المحرك). */
export function applyAdviceAction(state: TimetableState, action: AdviceAction): TimetableState {
  switch (action.kind) {
    case 'add_hour':
      return addHour(state, action.teacher_id, action.class_id, action.slot);
    case 'remove_hour':
      return removeHour(state, action.teacher_id, action.class_id, action.slot);
    case 'set_present':
      return setPresent(state, action.person_id, true);
    case 'move': {
      const model = buildModelCached(state.school);
      const next = applyMoves(model, placementMap(state.placements), action.moves);
      return next
        ? { school: structuredClone(state.school), placements: toPlacements(model, next) }
        : state;
    }
    default:
      return state;
  }
}

const modelCache = new WeakMap<SchoolData, Model>();
function buildModelCached(school: SchoolData): Model {
  let m = modelCache.get(school);
  if (!m) {
    m = buildModel(school);
    modelCache.set(school, m);
  }
  return m;
}

// ───────────────────────── الحساب ─────────────────────────

interface Scored {
  sc: number;
  option: AdviceOption;
}

export function advise(model: Model, placed: PlacementMap): Advice[] {
  const { school, grid, units } = model;
  const P = grid.periods;
  const AD = grid.activeDays;
  const byKey = unitIndex(model);
  const o = Occupancy.from(model, placed);
  const m0 = metrics(model, placed);
  const cap = weeklyCapacity(school.config);
  const times = periodTimes(school.config);
  const tl = (p: number) => times[p]?.[0] ?? '--:--';
  const day = (d: number) => DAY_NAMES_AR[d as SchoolDay];
  const subj = new Map(school.subjects.map((s) => [s.key, s]));
  const sh = (s: string) => subj.get(s)?.short ?? s;
  const cls = new Map(school.classes.map((c) => [c.id, c]));
  const clsName = (id: string) => cls.get(id)?.name ?? id;
  const person = (id: string) => model.person(id);
  const tName = (t: Teacher) => person(t.person_id)?.full_name ?? t.id;
  const tOf = (c: string, s: string) =>
    school.teachers.find((t) => t.subject === s && t.classes.some((x) => x.class_id === c));
  const hrsOf = (t: Teacher, c: string) => t.classes.find((x) => x.class_id === c)?.hours ?? 0;
  const hoursOf = (t: Teacher) => t.classes.reduce((a, c) => a + c.hours, 0);
  const teachesCls = (t: Teacher) =>
    t.classes.map((x) => x.class_id).filter((c) => cls.get(c)?.subjects.includes(t.subject));
  const clsTotal = (c: string) => units.filter((u) => u.class_id === c).length;
  const tDayN = (personId: string, d: number) => {
    let n = 0;
    for (let q = 0; q < P; q++) if (o.personAt(personId, d, q)) n++;
    return n;
  };
  const hChange = (t: Teacher, dv: number) =>
    `${tName(t)}: ${hoursOf(t)} ← ${hoursOf(t) + dv} ساعة في الأسبوع`;
  const recordsOf = (personId: string) => school.teachers.filter((t) => t.person_id === personId);
  const unitOf = (k: string) => byKey.get(k) as Unit;
  const at = (k: string) => placed.get(k) as Slot;
  const noCap = (s: string) => model.subjectNoCap(s);

  /** إضافة ساعة في خانة محددة (fillOpts): أفضل خيارين. */
  const fillOpts = (c: string, d: number, p: number): AdviceOption[] => {
    const r: Scored[] = [];
    for (const s of cls.get(c)?.subjects ?? []) {
      const t = tOf(c, s);
      if (!t) continue;
      if (model.isBlocked(t.person_id, d, p) || o.personAt(t.person_id, d, p) || o.classAt(c, d, p))
        continue;
      if (!noCap(s) && o.subjectDayCount(c, s, d) >= 2) continue;
      const h = hrsOf(t, c);
      if (h >= 8 || clsTotal(c) + 1 > cap) continue;
      const nu: Unit = {
        key: unitKey(c, s, h),
        class_id: c,
        subject: s,
        index: h,
        teacher_id: t.id,
        person_id: t.person_id,
      };
      const m2 = { ...model, units: [...units, nu] };
      const pl2 = new Map(placed);
      pl2.set(nu.key, [d, p]);
      const m = metrics(m2, pl2);
      if (m.lone > m0.lone || m.tgaps > m0.tgaps || m.split > m0.split) continue;
      const pair = [p - 1, p + 1].some((q) => {
        if (q < 0 || q >= P || grid.halfOf(q) !== grid.halfOf(p)) return false;
        const v = o.classAt(c, d, q);
        return !!v && unitOf(v).subject === s;
      });
      r.push({
        sc:
          (m.gaps - m0.gaps) * 3 +
          (m.lone - m0.lone) * 10 +
          (m.dups - m0.dups) * 2 -
          (pair ? 2 : 0) -
          (tDayN(t.person_id, d) ? 1 : 0),
        option: {
          label: `إضافة ساعة ${sh(s)} مع ${tName(t)} في ${day(d)} ${tl(p)} (${h} ← ${h + 1} س في هذا القسم)`,
          effects: [...effectTags(m0, m), hChange(t, 1)],
          action: { kind: 'add_hour', teacher_id: t.id, class_id: c, slot: [d, p], regen: false },
        },
      });
    }
    return r
      .sort((a, b) => a.sc - b.sc)
      .slice(0, 2)
      .map((x) => x.option);
  };

  /** أفضل نقل من بين أهداف (moveOpt): يُقبل فقط إذا حسّن النتيجة. */
  const moveOpt = (targets: Move[][]): AdviceOption[] => {
    let best: Scored | null = null;
    for (const mv of targets) {
      const np = applyMoves(model, placed, mv);
      if (!np) continue;
      const m = metrics(model, np);
      const sc =
        (m.gaps - m0.gaps) * 3 +
        (m.lone - m0.lone) * 10 +
        (m.split - m0.split) * 8 +
        (m.tgaps - m0.tgaps) * 6 +
        (m.dups - m0.dups) * 2 +
        (m.unplaced - m0.unplaced) * 50 +
        mv.length * 0.1;
      if (sc >= 0) continue;
      if (!best || sc < best.sc)
        best = {
          sc,
          option: {
            label: mv
              .map(({ unit, day: d, period: p }) => {
                const u = unitOf(unit);
                const y = at(unit);
                const t = school.teachers.find((x) => x.id === u.teacher_id) as Teacher;
                return `نقل ${sh(u.subject)} (${clsName(u.class_id)} · ${tName(t)}) من ${day(y[0])} ${tl(y[1])} إلى ${day(d)} ${tl(p)}`;
              })
              .join('، و'),
            effects: effectTags(m0, m),
            action: { kind: 'move', moves: mv },
          },
        };
    }
    return best ? [best.option] : [];
  };

  /** نقص الساعة المعطاة (removeOpt) إذا لم يزد أيام الساعة الواحدة. */
  const removeOpt = (k: string, why?: string): AdviceOption[] => {
    const u = unitOf(k);
    const t = school.teachers.find((x) => x.id === u.teacher_id) as Teacher;
    const h = hrsOf(t, u.class_id);
    if (h <= 1) return [];
    const pl = new Map(placed);
    pl.delete(k);
    const m = metrics({ ...model, units: units.filter((z) => z.key !== k) }, pl);
    if (m.lone > m0.lone) return [];
    const y = placed.get(k);
    return [
      {
        label: `نقص ساعة ${sh(u.subject)} (${h} ← ${h - 1} س في هذا القسم)${y ? ` وحذف حصة ${day(y[0])} ${tl(y[1])}` : ''}`,
        effects: [...effectTags(m0, m), hChange(t, -1), ...(why ? [why] : [])],
        action: {
          kind: 'remove_hour',
          teacher_id: t.id,
          class_id: u.class_id,
          ...(y ? { slot: y } : {}),
          regen: false,
        },
      },
    ];
  };

  /** forcedLoneH: مع إمكان تجربة عدد ساعات مختلف لسجل وقسم. */
  const forcedLoneH = (t: Teacher, over?: { class_id: string; hours: number }) => {
    let H = 0;
    let M = 0;
    const recs = [t, ...school.teachers.filter((x) => x !== t && x.person_id === t.person_id)];
    for (const r of recs)
      for (const c of teachesCls(r)) {
        const h = r === t && over && over.class_id === c ? over.hours : hrsOf(r, c);
        if (h <= 0) continue;
        H += h;
        M += noCap(r.subject) ? h : Math.min(2, h);
      }
    for (let k = 1; k <= AD.length; k++) if (2 * k <= H && H <= k * M) return false;
    return H > 0;
  };

  const out: Advice[] = [];
  const fixAll: AdviceOption = {
    label: 'البحث عن حلول تلقائية لكل الجدول',
    effects: [],
    action: { kind: 'solve', deep: false },
  };

  // 1) حصص بدون مكان
  const unpl = units.filter((u) => !placed.has(u.key));
  if (unpl.length) {
    const opts: AdviceOption[] = [];
    for (const c of school.classes) {
      const n = clsTotal(c.id);
      if (n <= cap) continue;
      const subs = c.subjects
        .map((s) => ({ s, t: tOf(c.id, s) }))
        .filter((x): x is { s: string; t: Teacher } => !!x.t && hrsOf(x.t, c.id) >= 3)
        .sort((a, b) => hrsOf(b.t, c.id) - hrsOf(a.t, c.id))
        .slice(0, 3);
      for (const x of subs) {
        const h = hrsOf(x.t, c.id);
        opts.push({
          label: `${c.name}: نقص ساعة ${sh(x.s)} (${h} ← ${h - 1} س)`,
          effects: [`${n} ← ${n - 1} حصة للقسم، والخانات ${cap}`],
          action: { kind: 'remove_hour', teacher_id: x.t.id, class_id: c.id, regen: true },
        });
      }
      opts.push({
        label: `زيادة حصص في توقيت المدرسة (الخانات الآن ${cap})`,
        effects: [],
        action: { kind: 'goto', screen: 'cfg' },
      });
    }
    for (const X of model.persons) {
      const t = recordsOf(X.id)[0] as Teacher;
      const { need, max } = maxPossible(model, X.id);
      const f = Math.min(freeSlots(model, X.id), max);
      if (need <= f) continue;
      if (!X.present)
        opts.push({
          label: `اعتبار ${X.full_name} متواجدا في المدرسة (يمكن أن يأتي صباحا ومساء)`,
          effects: [`الحد الأقصى يصبح ${maxPossible(model, X.id, true).max} ساعة`],
          action: { kind: 'set_present', person_id: X.id, regen: true },
        });
      for (const c of teachesCls(t)
        .filter((c) => hrsOf(t, c) >= 2)
        .slice(0, 3)) {
        const h = hrsOf(t, c);
        opts.push({
          label: `${X.full_name}: نقص ساعة مع ${clsName(c)} (${h} ← ${h - 1} س)`,
          effects: [`${need} ساعة مطلوبة و${f} متاحة`],
          action: { kind: 'remove_hour', teacher_id: t.id, class_id: c, regen: true },
        });
      }
      opts.push({
        label: `توسيع أوقات فراغ ${X.full_name}`,
        effects: [],
        action: { kind: 'goto', screen: 'data', teacher_id: t.id },
      });
    }
    if (!opts.length)
      opts.push({
        label: 'بحث أعمق (حوالي 20 ثانية) لإيجاد مكان لكل الحصص',
        effects: [],
        action: { kind: 'solve', deep: true },
      });
    out.push({
      kind: 'unplaced',
      title: `${unpl.length} حصص بدون مكان`,
      detail: unpl
        .slice(0, 6)
        .map((u) => `${clsName(u.class_id)} · ${sh(u.subject)}`)
        .join('، '),
      options: opts,
    });
  }

  // 2) أستاذ يُضطر ليوم بساعة واحدة بسبب عدد ساعاته
  for (const x of model.persons) {
    const recs = recordsOf(x.id);
    const t = recs[0] as Teacher;
    if (x.present || !forcedLoneH(t)) continue;
    const opts: AdviceOption[] = [];
    for (const r of recs)
      for (const c of teachesCls(r)) {
        const h = hrsOf(r, c);
        if (h < 8 && clsTotal(c) + 1 <= cap && !forcedLoneH(r, { class_id: c, hours: h + 1 }))
          opts.push({
            label: `زيادة ساعة ${sh(r.subject)} مع ${clsName(c)} (${h} ← ${h + 1} س)`,
            effects: ['يصبح تفادي الساعة الواحدة ممكنا', hChange(r, 1)],
            action: { kind: 'add_hour', teacher_id: r.id, class_id: c, regen: true },
          });
        if (h > 1 && !forcedLoneH(r, { class_id: c, hours: h - 1 }))
          opts.push({
            label: `نقص ساعة ${sh(r.subject)} مع ${clsName(c)} (${h} ← ${h - 1} س)`,
            effects: ['يصبح تفادي الساعة الواحدة ممكنا', hChange(r, -1)],
            action: { kind: 'remove_hour', teacher_id: r.id, class_id: c, regen: true },
          });
      }
    opts.push({
      label: `اعتبار ${x.full_name} متواجدا في المدرسة (تُقبل الساعة الواحدة)`,
      effects: [],
      action: { kind: 'set_present', person_id: x.id, regen: false },
    });
    out.push({
      kind: 'forced_lone',
      title: `${x.full_name} يُضطر ليوم بساعة واحدة`,
      detail: `${hoursOf(t)} ساعات في الأسبوع لا يمكن توزيعها على أيام من ساعتين على الأقل، لأن المادة لا تتجاوز ساعتين في اليوم مع نفس القسم.`,
      options: opts,
    });
  }

  // 3) فراغات بين حصص القسم، و4) فترة بساعة واحدة للقسم
  for (const c of school.classes)
    for (const d of AD)
      for (const h of [0, 1] as const) {
        const [lo, hi] = grid.halfRange(h);
        const ps: number[] = [];
        for (let p = lo; p < hi; p++) if (o.classAt(c.id, d, p)) ps.push(p);
        if (!ps.length) continue;
        const f = ps[0] as number;
        const l = ps[ps.length - 1] as number;
        for (let p = f + 1; p < l; p++) {
          if (o.classAt(c.id, d, p) || !grid.isValid(d, p)) continue;
          const edge = [o.classAt(c.id, d, f) as string, o.classAt(c.id, d, l) as string];
          const before = ps.filter((q) => q < p).length;
          const after = ps.filter((q) => q > p).length;
          const opts = [
            ...fillOpts(c.id, d, p),
            ...moveOpt(edge.map((k) => [{ unit: k, day: d, period: p }])),
            ...edge.flatMap((k) => {
              const y = at(k);
              return (y[1] === l && after === 1) || (y[1] === f && before === 1)
                ? removeOpt(k, 'تُغلق الفراغ')
                : [];
            }),
          ];
          if (opts.length)
            out.push({
              kind: 'class_gap',
              title: `فراغ في ${c.name} · ${day(d)} ${tl(p)}`,
              detail: 'ساعة فارغة بين حصتين للقسم.',
              options: opts,
            });
        }
        if (ps.length === 1 && grid.isValid(d, f)) {
          const p = f;
          const k = o.classAt(c.id, d, p) as string;
          const u = unitOf(k);
          const adj = [p - 1, p + 1]
            .filter((q) => q >= lo && q < hi && grid.isValid(d, q))
            .flatMap((q) => fillOpts(c.id, d, q));
          const targets: Move[][] = [];
          for (const d2 of AD)
            for (let q = 0; q < P; q++) {
              if (d2 === d && grid.halfOf(q) === h) continue;
              if (o.classAt(c.id, d2, q)) continue;
              const nb = [q - 1, q + 1].some(
                (z) =>
                  z >= 0 && z < P && grid.halfOf(z) === grid.halfOf(q) && !!o.classAt(c.id, d2, z),
              );
              if (nb) targets.push([{ unit: k, day: d2, period: q }]);
            }
          const opts = [...adj.slice(0, 2), ...moveOpt(targets)];
          if (opts.length)
            out.push({
              kind: 'class_single',
              title: `${c.name} يحضر لساعة واحدة · ${day(d)} ${h ? 'مساء' : 'صباحا'}`,
              detail: `حصة ${sh(u.subject)} وحدها في هذه الفترة.`,
              options: opts,
            });
        }
      }

  // 6) ساعة فارغة بين حصتين في جدول أستاذ غير متواجد
  for (const X of model.persons) {
    if (X.present) continue;
    for (const d of AD)
      for (const h of [0, 1] as const) {
        const [lo, hi] = grid.halfRange(h);
        const ps: number[] = [];
        for (let p = lo; p < hi; p++) if (o.personAt(X.id, d, p)) ps.push(p);
        if (ps.length < 2) continue;
        const first = ps[0] as number;
        const last = ps[ps.length - 1] as number;
        for (let p = first + 1; p < last; p++) {
          if (o.personAt(X.id, d, p)) continue;
          const T: Move[][] = [];
          for (const v of units) {
            if (v.person_id !== X.id) continue;
            const y = placed.get(v.key);
            if (!y) continue;
            if (y[0] === d && y[1] !== first && y[1] !== last) continue;
            const w = o.classAt(v.class_id, d, p);
            if (!w) T.push([{ unit: v.key, day: d, period: p }]);
            else if (w !== v.key)
              T.push([
                { unit: v.key, day: d, period: p },
                { unit: w, day: y[0], period: y[1] },
              ]);
          }
          out.push({
            kind: 'teacher_gap',
            title: `${X.full_name}: ساعة فارغة بين حصتين · ${day(d)} ${tl(p)}`,
            detail: 'يدرّس حصة، ثم ينتظر ساعة، ثم يدرّس الحصة الموالية.',
            options: [...moveOpt(T), fixAll],
          });
        }
      }
  }

  // 7) أستاذ غير متواجد يأتي صباحا ومساء في نفس اليوم
  for (const X of model.persons) {
    if (X.present) continue;
    for (const d of AD) {
      const am: number[] = [];
      const pm: number[] = [];
      for (let p = 0; p < P; p++) if (o.personAt(X.id, d, p)) (grid.halfOf(p) ? pm : am).push(p);
      if (!am.length || !pm.length) continue;
      const [few, many] = am.length <= pm.length ? [am, pm] : [pm, am];
      const T: Move[][] = [];
      for (const q0 of few) {
        const k = o.personAt(X.id, d, q0) as string;
        const u = unitOf(k);
        for (const q of many)
          for (const p of [q - 1, q + 1]) {
            if (p < 0 || p >= P || grid.halfOf(p) !== grid.halfOf(q) || o.personAt(X.id, d, p))
              continue;
            const w = o.classAt(u.class_id, d, p);
            if (!w) T.push([{ unit: k, day: d, period: p }]);
            else
              T.push([
                { unit: k, day: d, period: p },
                { unit: w, day: d, period: q0 },
              ]);
          }
      }
      out.push({
        kind: 'teacher_split',
        title: `${X.full_name}: يأتي صباحا ومساء · ${day(d)}`,
        detail: `${am.length} ساعات صباحا و${pm.length} مساء. الأفضل جمعها في فترة واحدة.`,
        options: [...(few.length === 1 ? moveOpt(T) : []), fixAll],
      });
    }
  }

  // 5) ساعتان لنفس المادة في نفس اليوم غير متتاليتين
  const sd = new Map<string, string[]>();
  for (const u of units) {
    const x = placed.get(u.key);
    if (!x) continue;
    const k = `${u.class_id}|${u.subject}|${x[0]}`;
    if (!sd.has(k)) sd.set(k, []);
    sd.get(k)?.push(u.key);
  }
  for (const [k, ids] of sd) {
    if (ids.length !== 2) continue;
    const [i0, i1] = ids as [string, string];
    const a = at(i0);
    const b = at(i1);
    if (Math.abs(a[1] - b[1]) === 1 && grid.halfOf(a[1]) === grid.halfOf(b[1])) continue;
    const [c, s, dS] = k.split('|') as [string, string, string];
    const d = Number(dS);
    const T: Move[][] = [];
    for (const [mover, anchor] of [
      [i0, i1],
      [i1, i0],
    ] as const) {
      const y = at(anchor);
      const x = at(mover);
      for (const q of [y[1] - 1, y[1] + 1]) {
        if (q < 0 || q >= P || grid.halfOf(q) !== grid.halfOf(y[1])) continue;
        const w = o.classAt(c, d, q);
        if (!w) T.push([{ unit: mover, day: d, period: q }]);
        else if (w !== mover) {
          T.push([
            { unit: mover, day: d, period: q },
            { unit: w, day: x[0], period: x[1] },
          ]);
          const u = unitOf(mover);
          const j = o.personAt(u.person_id, d, q);
          if (j && j !== mover && unitOf(j).class_id !== c) {
            const w2 = o.classAt(unitOf(j).class_id, d, x[1]);
            const mv: Move[] = [
              { unit: mover, day: d, period: q },
              { unit: w, day: x[0], period: x[1] },
              { unit: j, day: d, period: x[1] },
            ];
            if (w2 && w2 !== w) mv.push({ unit: w2, day: d, period: q });
            T.push(mv);
          }
        }
      }
    }
    const opts = moveOpt(T);
    if (opts.length)
      out.push({
        kind: 'split_subject',
        title: `${sh(s)} مفصولة في ${clsName(c)} · ${day(d)}`,
        detail: `ساعتا المادة في ${tl(a[1])} و${tl(b[1])}، ويمكن جعلهما متتاليتين.`,
        options: opts,
      });
  }

  return out;
}
