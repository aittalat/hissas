import type { Slot } from '../contract/school';
import type { Model, PlacementMap } from '../timetable/units';

/**
 * المحرك المحلي المؤقت: منقول من engine() في النموذج الأولي (جشع + تلدين محاكى + تفكيك
 * وإعادة بناء، بتقييم تزايدي ونفس الأوزان). يُستعمل في المتصفح إلى أن يُربط محرك CP-SAT
 * (services/solver)، وله نفس المدخل والمخرج (جدول). غير حتمي (Math.random) ومحدود بالوقت.
 */

/** أوزان دالة الهدف (W في النموذج الأولي؛ SPEC §6.2). */
export const WEIGHTS = {
  un: 10000,
  lone: 400,
  cgap: 6,
  nadj: 20,
  sing: 3,
  tgap: 250,
  pgap: 1,
  th1: 40,
  split: 300,
  half1: 2,
  hard: 1,
  last: 0.5,
  over: 3,
} as const;

export interface EngineOptions {
  /** عقوبة لكل حصة تتحرك عن الجدول الأولي (للإصلاح). */
  mv?: number;
  random?: () => number;
  now?: () => number;
}

export interface Engine {
  greedy(): void;
  anneal(ms: number, T0: number, T1: number): number;
  out(): Map<string, Slot>;
  score(): number;
}

type Change = [number, number, number];

/** قراءة عنصر مصفوفة عددية (الفهرس صالح دائما داخل المحرك). */
const g = (a: Int16Array | Uint8Array | Int8Array | Float64Array, i: number) => a[i] as number;

export function createEngine(model: Model, init: PlacementMap, opt: EngineOptions = {}): Engine {
  const random = opt.random ?? Math.random;
  const now =
    opt.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const { school, grid, units: U } = model;
  const W = WEIGHTS;
  const D = 6;
  const P = grid.periods;
  const AD = grid.activeDays;
  const amN = school.config.am_count;
  const hf = (p: number) => (p < amN ? 0 : 1);
  const cI = new Map(school.classes.map((c, i) => [c.id, i]));
  const tI = new Map(model.persons.map((x, i) => [x.id, i]));
  const skeys = school.subjects.map((s) => s.key);
  const sI = new Map(skeys.map((s, i) => [s, i]));
  const C = school.classes.length;
  const T = model.persons.length;
  const SN = skeys.length;
  const N = U.length;
  const uc = new Int16Array(N);
  const ut = new Int16Array(N);
  const us = new Int16Array(N);
  const lk = new Uint8Array(N);
  const nocap = school.subjects.map((s) => s.no_daily_cap);
  const hard = school.subjects.map((s) => s.hard);
  const dbl = school.subjects.map((s) => s.prefer_double);
  const pres = model.persons.map((x) => x.present);
  const locked = new Set(school.locked_classes);
  const blk = school.config.pairing_mode >= 2;
  const wmv = opt.mv || 0;
  U.forEach((u, i) => {
    uc[i] = cI.get(u.class_id) ?? 0;
    ut[i] = tI.get(u.person_id) ?? 0;
    us[i] = sI.get(u.subject) ?? 0;
    lk[i] = locked.has(u.class_id) && init.has(u.key) ? 1 : 0;
  });
  const av = new Uint8Array(T * D * P);
  model.persons.forEach((x, ti) => {
    for (let d = 0; d < D; d++)
      for (let p = 0; p < P; p++)
        av[(ti * D + d) * P + p] = grid.isValid(d, p) && !model.isBlocked(x.id, d, p) ? 1 : 0;
  });
  const TH = new Uint8Array(T * D * 2);
  const Gc = new Int16Array(C * D * P).fill(-1);
  const Gt = new Int16Array(T * D * P).fill(-1);
  const SC = new Uint8Array(C * SN * D);
  const need = new Uint8Array(C * SN);
  const pd = new Int8Array(N).fill(-1);
  const pp = new Int8Array(N).fill(-1);
  const od = new Int8Array(N).fill(-1);
  const op = new Int8Array(N).fill(-1);
  for (let i = 0; i < N; i++)
    need[(uc[i] as number) * SN + (us[i] as number)] =
      g(need, (uc[i] as number) * SN + (us[i] as number)) + 1;
  const lastP = (d: number) => (school.config.days[d] === 'am' ? amN : P) - 1;
  const capD = Math.max(5, P - 2);
  const CD = new Float64Array(C * D);
  const TD = new Float64Array(T * D);
  const CS = new Float64Array(C * SN);
  let total = 0;

  const ok = (i: number, d: number, p: number) =>
    d >= 0 &&
    p >= 0 &&
    p < P &&
    !!g(av, (g(ut, i) * D + d) * P + p) &&
    (pres[g(ut, i)] || !g(TH, (g(ut, i) * D + d) * 2 + 1 - hf(p))) &&
    g(Gc, (g(uc, i) * D + d) * P + p) < 0 &&
    g(Gt, (g(ut, i) * D + d) * P + p) < 0 &&
    (nocap[g(us, i)] || g(SC, (g(uc, i) * SN + g(us, i)) * D + d) < 2);
  const set = (i: number, d: number, p: number) => {
    pd[i] = d;
    pp[i] = p;
    TH[(g(ut, i) * D + d) * 2 + hf(p)] = g(TH, (g(ut, i) * D + d) * 2 + hf(p)) + 1;
    Gc[(g(uc, i) * D + d) * P + p] = i;
    Gt[(g(ut, i) * D + d) * P + p] = i;
    SC[(g(uc, i) * SN + g(us, i)) * D + d] = g(SC, (g(uc, i) * SN + g(us, i)) * D + d) + 1;
  };
  const unset = (i: number) => {
    const d = g(pd, i);
    const p = g(pp, i);
    if (d < 0) return;
    TH[(g(ut, i) * D + d) * 2 + hf(p)] = g(TH, (g(ut, i) * D + d) * 2 + hf(p)) - 1;
    Gc[(g(uc, i) * D + d) * P + p] = -1;
    Gt[(g(ut, i) * D + d) * P + p] = -1;
    SC[(g(uc, i) * SN + g(us, i)) * D + d] = g(SC, (g(uc, i) * SN + g(us, i)) * D + d) - 1;
    pd[i] = -1;
    pp[i] = -1;
  };
  function cDay(c: number, d: number) {
    let sc = 0;
    let tot = 0;
    const b = (c * D + d) * P;
    for (const [lo, hi] of [
      [0, amN],
      [amN, P],
    ] as const) {
      let f = -1;
      let l = -1;
      let n = 0;
      for (let p = lo; p < hi; p++)
        if (g(Gc, b + p) >= 0) {
          n++;
          if (f < 0) f = p;
          l = p;
        }
      if (n) {
        sc += (l - f + 1 - n) * W.cgap;
        if (n === 1) sc += W.half1;
      }
      tot += n;
    }
    if (tot > capD) sc += (tot - capD) * W.over;
    const lp = lastP(d);
    for (let p = 0; p < P; p++) {
      const i = g(Gc, b + p);
      if (i < 0) continue;
      const s = g(us, i);
      if (hard[s] && hf(p) === 1) sc += W.hard;
      if (p === lp) sc += W.last;
      if (g(SC, (c * SN + s) * D + d) >= 2) {
        const L =
          p > 0 && hf(p - 1) === hf(p) && g(Gc, b + p - 1) >= 0 && g(us, g(Gc, b + p - 1)) === s;
        const R =
          p < P - 1 &&
          hf(p + 1) === hf(p) &&
          g(Gc, b + p + 1) >= 0 &&
          g(us, g(Gc, b + p + 1)) === s;
        if (!L && !R) sc += W.nadj;
      }
    }
    return sc;
  }
  function tDay(t: number, d: number) {
    let n = 0;
    let gp = 0;
    let h1 = 0;
    const b = (t * D + d) * P;
    for (const [lo, hi] of [
      [0, amN],
      [amN, P],
    ] as const) {
      let f = -1;
      let l = -1;
      let k = 0;
      for (let p = lo; p < hi; p++)
        if (g(Gt, b + p) >= 0) {
          k++;
          if (f < 0) f = p;
          l = p;
        }
      if (k) gp += l - f + 1 - k;
      if (k === 1) h1++;
      n += k;
    }
    if (pres[t]) return gp * W.pgap;
    let k0 = 0;
    for (let p = 0; p < amN; p++) if (g(Gt, b + p) >= 0) k0++;
    return (n === 1 ? W.lone : h1 * W.th1) + gp * W.tgap + (k0 && n - k0 ? W.split : 0);
  }
  function cSub(c: number, s: number) {
    const h = g(need, c * SN + s);
    if (h < 2 || nocap[s]) return 0;
    let singles = 0;
    for (let d = 0; d < D; d++) if (g(SC, (c * SN + s) * D + d) === 1) singles++;
    const ex = Math.max(0, singles - (h % 2));
    return ex * (dbl[s] ? W.sing * 3 : blk ? W.sing : 0);
  }
  const uTerm = (i: number) =>
    (g(pd, i) < 0 ? W.un : 0) +
    (wmv && g(od, i) >= 0 && (g(pd, i) !== g(od, i) || g(pp, i) !== g(op, i)) ? wmv : 0);
  function full() {
    total = 0;
    for (let c = 0; c < C; c++) for (let d = 0; d < D; d++) total += CD[c * D + d] = cDay(c, d);
    for (let t = 0; t < T; t++) for (let d = 0; d < D; d++) total += TD[t * D + d] = tDay(t, d);
    for (let c = 0; c < C; c++) for (let s = 0; s < SN; s++) total += CS[c * SN + s] = cSub(c, s);
    for (let i = 0; i < N; i++) total += uTerm(i);
  }
  const kC = new Set<number>();
  const kT = new Set<number>();
  const kS = new Set<number>();
  function apply(ch: Change[]): number | null {
    kC.clear();
    kT.clear();
    kS.clear();
    const old: Change[] = [];
    for (const [i, d] of ch) {
      old.push([i, g(pd, i), g(pp, i)]);
      if (g(pd, i) >= 0) {
        kC.add(g(uc, i) * D + g(pd, i));
        kT.add(g(ut, i) * D + g(pd, i));
      }
      if (d >= 0) {
        kC.add(g(uc, i) * D + d);
        kT.add(g(ut, i) * D + d);
      }
      kS.add(g(uc, i) * SN + g(us, i));
    }
    let before = 0;
    for (const k of kC) before += g(CD, k);
    for (const k of kT) before += g(TD, k);
    for (const k of kS) before += g(CS, k);
    for (const [i] of ch) before += uTerm(i);
    for (const [i] of ch) unset(i);
    let good = true;
    for (const [i, d, p] of ch) {
      if (d < 0) continue;
      if (!ok(i, d, p)) {
        good = false;
        break;
      }
      set(i, d, p);
    }
    if (!good) {
      for (const [i] of ch) unset(i);
      for (const [i, d, p] of old) if (d >= 0) set(i, d, p);
      return null;
    }
    let after = 0;
    for (const k of kC) {
      const v = cDay((k / D) | 0, k % D);
      CD[k] = v;
      after += v;
    }
    for (const k of kT) {
      const v = tDay((k / D) | 0, k % D);
      TD[k] = v;
      after += v;
    }
    for (const k of kS) {
      const v = cSub((k / SN) | 0, k % SN);
      CS[k] = v;
      after += v;
    }
    for (const [i] of ch) after += uTerm(i);
    total += after - before;
    return after - before;
  }
  const rnd = (n: number) => Math.floor(random() * n);
  const pick = <X>(a: readonly X[]) => a[rnd(a.length)] as X;

  // الحالة الابتدائية
  U.forEach((u, i) => {
    const x = init.get(u.key);
    if (x && x[0] >= 0) {
      od[i] = x[0];
      op[i] = x[1];
      if (ok(i, x[0], x[1])) set(i, x[0], x[1]);
    }
  });
  for (let i = 0; i < N; i++) if (lk[i] && g(pd, i) < 0) lk[i] = 0;
  full();

  function greedy() {
    if (!N) return;
    const free = new Float64Array(T);
    const load = new Float64Array(T);
    for (let t = 0; t < T; t++)
      for (let k = 0; k < D * P; k++) free[t] = g(free, t) + g(av, t * D * P + k);
    for (let i = 0; i < N; i++) load[g(ut, i)] = g(load, g(ut, i)) + 1;
    const order: [number, number][] = [];
    for (let i = 0; i < N; i++)
      if (g(pd, i) < 0) order.push([i, g(free, g(ut, i)) - g(load, g(ut, i)) + random() * 4]);
    order.sort((a, b) => a[1] - b[1]);
    for (const [i] of order) {
      let bd = -1;
      let bp = -1;
      let bv = 1e18;
      for (const d of AD)
        for (let p = 0; p < P; p++) {
          if (!ok(i, d, p)) continue;
          const dl = apply([[i, d, p]]) as number;
          const v = dl + random() * 1.5;
          apply([[i, -1, -1]]);
          if (v < bv) {
            bv = v;
            bd = d;
            bp = p;
          }
        }
      if (bd >= 0) apply([[i, bd, bp]]);
    }
  }

  function propose(): Change[] | null {
    const r = random();
    if (r < 0.25) {
      let k = rnd(N);
      for (let j = 0; j < N; j++, k = (k + 1) % N)
        if (g(pd, k) < 0 && !lk[k]) {
          const i = k;
          const d = pick(AD);
          const p = rnd(P);
          if (!g(av, (g(ut, i) * D + d) * P + p)) return null;
          const ej = new Set<number>();
          const a = g(Gc, (g(uc, i) * D + d) * P + p);
          const b = g(Gt, (g(ut, i) * D + d) * P + p);
          if (a >= 0) ej.add(a);
          if (b >= 0) ej.add(b);
          if (!nocap[g(us, i)] && g(SC, (g(uc, i) * SN + g(us, i)) * D + d) >= 2) {
            const bb = (g(uc, i) * D + d) * P;
            const same: number[] = [];
            for (let q = 0; q < P; q++) {
              const v = g(Gc, bb + q);
              if (v >= 0 && g(us, v) === g(us, i)) same.push(v);
            }
            ej.add(pick(same));
          }
          for (const e of ej) if (lk[e]) return null;
          return [[i, d, p], ...[...ej].map((e): Change => [e, -1, -1])];
        }
    }
    const i = rnd(N);
    if (lk[i] || g(pd, i) < 0) return null;
    const c = g(uc, i);
    const d = g(pd, i);
    const p = g(pp, i);
    const t = g(ut, i);
    if (r < 0.55) return [[i, pick(AD), rnd(P)]];
    if (r < 0.8) {
      const d2 = pick(AD);
      const p2 = rnd(P);
      const w = g(Gc, (c * D + d2) * P + p2);
      if (w === i) return null;
      if (w < 0) return [[i, d2, p2]];
      if (lk[w]) return null;
      return [
        [i, d2, p2],
        [w, d, p],
      ];
    }
    if (r < 0.9) {
      const b = (c * D + d) * P;
      let j = -1;
      if (
        p > 0 &&
        hf(p - 1) === hf(p) &&
        g(Gc, b + p - 1) >= 0 &&
        g(us, g(Gc, b + p - 1)) === g(us, i)
      )
        j = g(Gc, b + p - 1);
      else if (
        p < P - 1 &&
        hf(p + 1) === hf(p) &&
        g(Gc, b + p + 1) >= 0 &&
        g(us, g(Gc, b + p + 1)) === g(us, i)
      )
        j = g(Gc, b + p + 1);
      if (j < 0 && g(SC, (c * SN + g(us, i)) * D + d) >= 2) {
        for (let q = 0; q < P; q++) {
          const v = g(Gc, b + q);
          if (v >= 0 && v !== i && g(us, v) === g(us, i)) {
            j = v;
            break;
          }
        }
        if (j < 0) return null;
        const q = g(pp, j) + (random() < 0.5 ? -1 : 1);
        if (q < 0 || q >= P || hf(q) !== hf(g(pp, j))) return null;
        const w = g(Gc, b + q);
        if (w === i) return null;
        if (w < 0) return [[i, d, q]];
        if (lk[w]) return null;
        return [
          [i, d, q],
          [w, d, p],
        ];
      }
      if (j < 0 || lk[j]) return null;
      const d2 = pick(AD);
      const p2 = rnd(P - 1);
      if (hf(p2) !== hf(p2 + 1)) return null;
      const [a1, a2] = g(pp, i) < g(pp, j) ? [i, j] : [j, i];
      return [
        [a1, d2, p2],
        [a2, d2, p2 + 1],
      ];
    }
    // استهداف يوم بساعة واحدة: ضم ساعة أخرى للأستاذ بجانبها أو نقلها ليوم يدرّس فيه
    const tb = (t * D + d) * P;
    let n = 0;
    for (let q = 0; q < P; q++) if (g(Gt, tb + q) >= 0) n++;
    if (n > 1 && random() < 0.35) {
      // تبديل وقتي حصتين للأستاذ في نفس اليوم مع قسمين مختلفين
      const hs: number[] = [];
      for (let q = 0; q < P; q++) {
        const j = g(Gt, tb + q);
        if (j >= 0 && j !== i) hs.push(j);
      }
      const j = pick(hs);
      if (lk[j]) return null;
      const q = g(pp, j);
      const c2 = g(uc, j);
      if (c2 === c) return null;
      const w1 = g(Gc, (c * D + d) * P + q);
      const w2 = g(Gc, (c2 * D + d) * P + p);
      if ((w1 >= 0 && lk[w1]) || (w2 >= 0 && lk[w2])) return null;
      const ch: Change[] = [
        [i, d, q],
        [j, d, p],
      ];
      if (w1 >= 0) ch.push([w1, d, p]);
      if (w2 >= 0 && w2 !== w1) ch.push([w2, d, q]);
      return ch;
    }
    if (n > 1 && !pres[t]) {
      let k0 = 0;
      for (let q = 0; q < amN; q++) if (g(Gt, tb + q) >= 0) k0++;
      const k1 = n - k0;
      if (k0 && k1 && random() < 0.6) {
        // جمع ساعات اليوم في فترة واحدة
        const mine = hf(p);
        const other = 1 - mine;
        if ((mine === 0 ? k0 : k1) > (mine === 0 ? k1 : k0)) return null;
        const [lo, hi] = other ? [amN, P] : [0, amN];
        const hs: number[] = [];
        for (let q = lo; q < hi; q++) if (g(Gt, tb + q) >= 0) hs.push(q);
        const q = pick(hs);
        const p2 = q + (random() < 0.5 ? -1 : 1);
        if (p2 < lo || p2 >= hi || g(Gt, tb + p2) >= 0) return null;
        const w = g(Gc, (c * D + d) * P + p2);
        if (w < 0) return [[i, d, p2]];
        if (lk[w] || w === i) return null;
        return [
          [i, d, p2],
          [w, d, p],
        ];
      }
    }
    if (n > 1) {
      // سد فراغ في جدول الأستاذ: نقل الساعة إلى جانب ساعة أخرى له في نفس الفترة
      const [lo, hi] = hf(p) ? [amN, P] : [0, amN];
      const hs: number[] = [];
      for (let q = lo; q < hi; q++) if (g(Gt, tb + q) >= 0 && q !== p) hs.push(q);
      if (!hs.length) return null;
      const q = pick(hs);
      const p2 = q + (random() < 0.5 ? -1 : 1);
      if (p2 < lo || p2 >= hi || p2 === p) return null;
      const w = g(Gc, (c * D + d) * P + p2);
      if (w < 0) return [[i, d, p2]];
      if (lk[w] || w === i) return null;
      return [
        [i, d, p2],
        [w, d, p],
      ];
    }
    if (pres[t] || n !== 1) return null;
    if (random() < 0.5) {
      const days = AD.filter((x) => x !== d);
      const d2 = pick(days);
      const b2 = (t * D + d2) * P;
      const hs: number[] = [];
      for (let q = 0; q < P; q++) if (g(Gt, b2 + q) >= 0) hs.push(q);
      if (!hs.length) return null;
      const q = pick(hs);
      const p2 = q + (random() < 0.5 ? -1 : 1);
      if (p2 < 0 || p2 >= P || hf(p2) !== hf(q)) return null;
      const w = g(Gc, (c * D + d2) * P + p2);
      if (w < 0) return [[i, d2, p2]];
      if (lk[w] || w === i) return null;
      return [
        [i, d2, p2],
        [w, d, p],
      ];
    }
    const mine: number[] = [];
    for (let j = 0; j < N; j++)
      if (g(ut, j) === t && j !== i && g(pd, j) >= 0 && g(pd, j) !== d && !lk[j]) mine.push(j);
    if (!mine.length) return null;
    const j = pick(mine);
    const p2 = p + (random() < 0.5 ? -1 : 1);
    if (p2 < 0 || p2 >= P || hf(p2) !== hf(p)) return null;
    const w = g(Gc, (g(uc, j) * D + d) * P + p2);
    if (w < 0) return [[j, d, p2]];
    if (lk[w] || w === j) return null;
    return [
      [j, d, p2],
      [w, g(pd, j), g(pp, j)],
    ];
  }

  // تفكيك وإعادة بناء (LNS): نزع مجموعة حصص مترابطة ثم إعادة وضعها بأفضل طريقة
  function ruinSet(): number[] | null {
    const R = new Set<number>();
    const r = random();
    if (r < 0.6) {
      const cand: [number, number][] = [];
      for (let t = 0; t < T; t++)
        if (!pres[t]) for (const d of AD) if (g(TD, t * D + d) >= W.th1) cand.push([t, d]);
      if (!cand.length) return null;
      const [t, d] = pick(cand);
      const b = (t * D + d) * P;
      const cls = new Set<number>();
      for (let q = 0; q < P; q++) {
        const i = g(Gt, b + q);
        if (i >= 0 && !lk[i]) {
          R.add(i);
          cls.add(g(uc, i));
        }
      }
      for (const c of cls) {
        const bb = (c * D + d) * P;
        const L: number[] = [];
        for (let q = 0; q < P; q++) {
          const i = g(Gc, bb + q);
          if (i >= 0 && !lk[i] && !R.has(i)) L.push(i);
        }
        for (let k = 0; k < 2 && L.length; k++) R.add(L.splice(rnd(L.length), 1)[0] as number);
      }
    } else {
      const c = rnd(C);
      const d = pick(AD);
      const h = rnd(2);
      const [lo, hi] = h ? [amN, P] : [0, amN];
      const bb = (c * D + d) * P;
      for (let q = lo; q < hi; q++) {
        const i = g(Gc, bb + q);
        if (i >= 0 && !lk[i]) R.add(i);
      }
      const d2 = pick(AD);
      const b2 = (c * D + d2) * P;
      for (let q = 0; q < P; q++) {
        const i = g(Gc, b2 + q);
        if (i >= 0 && !lk[i] && random() < 0.5) R.add(i);
      }
    }
    return R.size ? [...R] : null;
  }
  function lns(Tp: number) {
    const R = ruinSet();
    if (!R) return;
    const snap: Change[] = R.map((i) => [i, g(pd, i), g(pp, i)]);
    const before = total;
    apply(R.map((i): Change => [i, -1, -1]));
    const order = R.map((i): [number, number] => {
      let n = 0;
      for (const d of AD) for (let p = 0; p < P; p++) if (ok(i, d, p)) n++;
      return [i, n + random()];
    })
      .sort((a, b) => a[1] - b[1])
      .map((x) => x[0]);
    for (const i of order) {
      let bd = -1;
      let bp = -1;
      let bv = 1e18;
      for (const d of AD)
        for (let p = 0; p < P; p++) {
          if (!ok(i, d, p)) continue;
          const dl = apply([[i, d, p]]) as number;
          apply([[i, -1, -1]]);
          const v = dl + random() * 0.5;
          if (v < bv) {
            bv = v;
            bd = d;
            bp = p;
          }
        }
      if (bd >= 0) apply([[i, bd, bp]]);
    }
    const dl = total - before;
    if (!(dl <= 0 || random() < Math.exp(-dl / Tp))) {
      apply(R.map((i): Change => [i, -1, -1]));
      apply(snap);
    }
  }
  function anneal(ms: number, T0: number, T1: number) {
    if (!N) return 0;
    const t0 = now();
    let Tp = T0;
    let it = 0;
    let best = total;
    const bd = Int8Array.from(pd);
    const bp = Int8Array.from(pp);
    for (;;) {
      if ((it & 255) === 0) {
        const el = now() - t0;
        if (el > ms) break;
        Tp = T0 * Math.pow(T1 / T0, el / ms);
      }
      it++;
      if ((it & 31) === 0) {
        lns(Tp);
        if (total < best - 1e-9) {
          best = total;
          bd.set(pd);
          bp.set(pp);
        }
        continue;
      }
      const ch = propose();
      if (!ch) continue;
      const old: Change[] = ch.map(([i]) => [i, g(pd, i), g(pp, i)]);
      const dl = apply(ch);
      if (dl === null) continue;
      if (dl <= 0 || random() < Math.exp(-dl / Tp)) {
        if (total < best - 1e-9) {
          best = total;
          bd.set(pd);
          bp.set(pp);
        }
      } else apply(old);
    }
    if (total > best + 1e-9) {
      for (let i = 0; i < N; i++) unset(i);
      for (let i = 0; i < N; i++) if (g(bd, i) >= 0) set(i, g(bd, i), g(bp, i));
      full();
    }
    return it;
  }
  const out = () => {
    const m = new Map<string, Slot>();
    for (let i = 0; i < N; i++)
      if (g(pd, i) >= 0) m.set((U[i] as { key: string }).key, [g(pd, i), g(pp, i)]);
    return m;
  };
  return { greedy, anneal, out, score: () => total };
}
