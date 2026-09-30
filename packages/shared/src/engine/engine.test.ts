import { describe, expect, it } from 'vitest';
import { loadScenarios } from '../testing/scenarios';
import { conflictSet, violations } from '../timetable/conflicts';
import { metrics, quality } from '../timetable/metrics';
import { buildModel, placementMap } from '../timetable/units';
import { buildSolutions, generateTimetable } from './solve';

const scenarios = Object.fromEntries(loadScenarios().map((s) => [s.scenario, s]));
const sc = (id: string) => {
  const s = scenarios[id];
  if (!s) throw new Error(id);
  return s;
};

describe('المحرك المحلي (منقول من engine في النموذج الأولي)', () => {
  it.each(['6.5-1-demo', '6.5-2-all-not-present', '6.5-4-45min-0830', '6.5-5-two-subjects'])(
    '%s: جدول كامل بلا مخالفات وبجودة قريبة من النموذج الأولي',
    (id) => {
      const s = sc(id);
      const pl = generateTimetable(s.school, [], 3000);
      const model = buildModel(s.school);
      const placed = placementMap(pl);
      const m = metrics(model, placed);
      expect(violations(model, placed)).toEqual([]);
      expect(m.unplaced).toBe(0);
      const best = Math.max(...s.prototype.runs.map((r) => r.quality));
      expect(quality(m, conflictSet(model, placed).size)).toBeGreaterThanOrEqual(best - 12);
    },
    30_000,
  );

  it('6.5-3: الحصص الأربع المستحيلة تبقى بدون مكان، ولا مخالفة', () => {
    const s = sc('6.5-3-max-16');
    const pl = generateTimetable(s.school, [], 2000);
    const model = buildModel(s.school);
    const placed = placementMap(pl);
    expect(violations(model, placed)).toEqual([]);
    expect(metrics(model, placed).unplaced).toBe(4);
  }, 30_000);

  it('الأقسام المقفلة لا تتغير', () => {
    const s = sc('6.5-1-demo');
    const run = s.prototype.runs[0]!;
    const school = { ...s.school, locked_classes: ['1ACA', 'TC'] };
    const pl = generateTimetable(school, run.placements, 2000);
    const key = (p: {
      class_id: string;
      subject: string;
      index: number;
      day: number;
      period: number;
    }) => `${p.class_id}|${p.subject}|${p.index}|${p.day}|${p.period}`;
    const got = new Set(pl.map(key));
    for (const p of run.placements)
      if (['1ACA', 'TC'].includes(p.class_id)) expect(got.has(key(p))).toBe(true);
  }, 30_000);

  it('buildSolutions: حلول مختلفة، كل حل بلا مخالفات، وقائمة التغييرات تطابق الفرق', () => {
    const s = sc('6.5-1-demo');
    // جدول مشوّه: نزع 10 ساعات
    const state = { school: s.school, placements: s.prototype.runs[0]!.placements.slice(10) };
    const set = buildSolutions(state, 'إصلاح', null, false);
    expect(set.list.length).toBeGreaterThan(0);
    expect(set.list.length).toBeLessThanOrEqual(3);
    const model = buildModel(s.school);
    for (const sol of set.list) {
      expect(violations(model, placementMap(sol.placements))).toEqual([]);
      expect(sol.changes.length).toBeGreaterThan(0);
    }
    // النتيجة تتحسن من حل لآخر
    for (let i = 1; i < set.list.length; i++)
      expect(set.list[i]!.score).toBeLessThan(set.list[i - 1]!.score);
  }, 60_000);

  it('buildSolutions مع تعديل (زيادة ساعة): البيانات الجديدة في after', () => {
    const s = sc('6.5-1-demo');
    const state = { school: s.school, placements: s.prototype.runs[0]!.placements };
    const t = s.school.teachers[0]!;
    const c = t.classes[0]!;
    const set = buildSolutions(
      state,
      'زيادة',
      { kind: 'add_hour', teacher_id: t.id, class_id: c.class_id, regen: true },
      false,
    );
    expect(set.after.school.teachers[0]!.classes[0]!.hours).toBe(c.hours + 1);
  }, 60_000);
});
