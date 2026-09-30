import type { SchoolConfig } from './contract/school';

/**
 * الشبكة الزمنية لمدرسة: الحصص وأوقاتها والخانات الصالحة.
 * منقولة حرفيا من النموذج الأولي: periodsOf، NP، halfOf، halfRange، valid، activeDays، capOf.
 * الحصص مرقمة في اليوم: 0..am_count-1 صباحا ثم am_count..am_count+pm_count-1 مساء.
 */
export type Half = 0 | 1;

export interface Grid {
  readonly config: SchoolConfig;
  /** عدد الحصص في اليوم الكامل (NP). */
  readonly periods: number;
  /** الأيام غير المعطلة. */
  readonly activeDays: readonly number[];
  /** 0 = صباح، 1 = مساء. */
  halfOf(period: number): Half;
  /** [أول حصة، بعد آخر حصة) في النصف. */
  halfRange(half: Half): readonly [number, number];
  /** خانة صالحة: يوم غير معطل، وليست مساء يوم "صباح فقط". */
  isValid(day: number, period: number): boolean;
  /** آخر حصة ممكنة في اليوم (حسب نظامه). */
  lastPeriod(day: number): number;
}

export function makeGrid(config: SchoolConfig): Grid {
  const am = config.am_count;
  const periods = am + config.pm_count;
  return {
    config,
    periods,
    activeDays: config.days.flatMap((m, d) => (m === 'off' ? [] : [d])),
    halfOf: (p) => (p < am ? 0 : 1),
    halfRange: (h) => (h === 0 ? [0, am] : [am, periods]),
    isValid(day, period) {
      if (day < 0 || day > 5 || period < 0) return false;
      const mode = config.days[day];
      if (mode === 'off' || mode === undefined) return false;
      return period < (mode === 'am' ? am : periods);
    },
    lastPeriod: (day) => (config.days[day] === 'am' ? am : periods) - 1,
  };
}

/** خانات الأسبوع لكل قسم (capOf). */
export function weeklyCapacity(config: SchoolConfig): number {
  return config.days.reduce(
    (a, m) =>
      a + (m === 'full' ? config.am_count + config.pm_count : m === 'am' ? config.am_count : 0),
    0,
  );
}

const toMin = (s: string) => {
  const [h = 0, m = 0] = s.split(':').map(Number);
  return h * 60 + m;
};
const fmt = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

/**
 * أوقات الحصص [بداية، نهاية] (periodsOf): الاستراحة تُضاف قبل الحصة الثالثة
 * في كل فترة فيها 4 حصص أو أكثر.
 */
export function periodTimes(config: SchoolConfig): [string, string][] {
  const out: [string, string][] = [];
  const half = (start: string, n: number) => {
    let t = toMin(start);
    for (let i = 0; i < n; i++) {
      if (i === 2 && config.break_after_2nd_minutes && n >= 4) t += config.break_after_2nd_minutes;
      out.push([fmt(t), fmt(t + config.period_minutes)]);
      t += config.period_minutes;
    }
  };
  half(config.am_start, config.am_count);
  half(config.pm_start, config.pm_count);
  return out;
}
