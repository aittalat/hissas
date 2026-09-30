/** أيام الدراسة: 0 = الإثنين … 5 = السبت (SPEC §5: school_config.days). */
export const SCHOOL_DAYS = [0, 1, 2, 3, 4, 5] as const;
export type SchoolDay = (typeof SCHOOL_DAYS)[number];

/** نظام اليوم: يوم كامل، صباح فقط، أو عطلة. */
export const DAY_MODES = ['full', 'am', 'off'] as const;
export type DayMode = (typeof DAY_MODES)[number];

export const DAY_NAMES_AR: Readonly<Record<SchoolDay, string>> = {
  0: 'الإثنين',
  1: 'الثلاثاء',
  2: 'الأربعاء',
  3: 'الخميس',
  4: 'الجمعة',
  5: 'السبت',
};

export function isDayMode(value: unknown): value is DayMode {
  return typeof value === 'string' && (DAY_MODES as readonly string[]).includes(value);
}
