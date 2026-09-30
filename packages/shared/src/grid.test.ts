import { describe, expect, it } from 'vitest';
import { makeGrid, periodTimes, weeklyCapacity } from './grid';
import { tinySchool } from './testing/builder';

describe('الشبكة الزمنية', () => {
  it('الإعداد السريع "45 دقيقة · تبدأ 08:30": الاستراحة قبل الحصة الثالثة', () => {
    const config = {
      ...tinySchool().config,
      period_minutes: 45,
      am_start: '08:30',
      am_count: 5,
      pm_start: '14:30',
      pm_count: 4,
      break_after_2nd_minutes: 15,
    };
    expect(periodTimes(config)).toEqual([
      ['08:30', '09:15'],
      ['09:15', '10:00'],
      ['10:15', '11:00'],
      ['11:00', '11:45'],
      ['11:45', '12:30'],
      ['14:30', '15:15'],
      ['15:15', '16:00'],
      ['16:15', '17:00'],
      ['17:00', '17:45'],
    ]);
  });

  it('لا استراحة في فترة من أقل من 4 حصص', () => {
    const config = { ...tinySchool().config, pm_count: 3, break_after_2nd_minutes: 10 };
    expect(periodTimes(config).slice(4)).toEqual([
      ['14:00', '15:00'],
      ['15:00', '16:00'],
      ['16:00', '17:00'],
    ]);
  });

  it('خانات الأسبوع: الأربعاء والجمعة صباحا فقط (سيناريو 6.5-4)', () => {
    const config = {
      ...tinySchool().config,
      am_count: 5,
      pm_count: 4,
      days: ['full', 'full', 'am', 'full', 'am', 'off'] as const,
    };
    expect(weeklyCapacity({ ...config, days: [...config.days] })).toBe(3 * 9 + 2 * 5);
  });

  it('الخانات الصالحة والفترات', () => {
    const g = makeGrid({
      ...tinySchool().config,
      days: ['full', 'am', 'off', 'full', 'full', 'full'],
    });
    expect(g.periods).toBe(8);
    expect(g.activeDays).toEqual([0, 1, 3, 4, 5]);
    expect(g.isValid(1, 3)).toBe(true);
    expect(g.isValid(1, 4)).toBe(false);
    expect(g.isValid(2, 0)).toBe(false);
    expect(g.isValid(0, 8)).toBe(false);
    expect(g.isValid(6, 0)).toBe(false);
    expect([g.halfOf(3), g.halfOf(4)]).toEqual([0, 1]);
    expect(g.lastPeriod(1)).toBe(3);
    expect(g.lastPeriod(0)).toBe(7);
  });
});
