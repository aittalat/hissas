import { describe, expect, it } from 'vitest';
import { SchoolDataSchema } from '../contract/school';
import { at, tinySchool } from '../testing/builder';
import { conflictSet, violations } from './conflicts';
import { diagnose, forcedLone, maxPossible } from './diagnose';
import { diffPlans } from './diff';
import { metrics, quality } from './metrics';
import { applyMoves, validTargets } from './moves';
import { buildModel, placementMap, type Model } from './units';

const kinds = (model: Model, ...p: Parameters<typeof placementMap>[0][]) =>
  violations(model, placementMap(p.flat())).map((v) => v.kind);

describe('بيانات الاختبار', () => {
  it('tinySchool صالحة', () => {
    expect(SchoolDataSchema.safeParse(tinySchool()).success).toBe(true);
  });
});

describe('القيد 6.1-1: لا تعارض قسم ولا شخص في نفس الساعة', () => {
  const model = buildModel(tinySchool());
  it('قسم بحصتين في نفس الساعة', () => {
    const p = [at('A', 'ma', 0, 0, 0), at('A', 'fr', 0, 0, 0)];
    expect(kinds(model, p)).toContain('class_clash');
    expect(conflictSet(model, placementMap(p)).size).toBe(2);
  });
  it('نفس الأستاذ مع قسمين في نفس الساعة', () => {
    const p = [at('A', 'ma', 0, 0, 0), at('B', 'ma', 0, 0, 0)];
    expect(kinds(model, p)).toEqual(['person_clash']);
  });
  it('القيد 6.1-5: شخص بمادتين (fr وcpt) = تعارض واحد', () => {
    const p = [at('B', 'fr', 0, 1, 1), at('A', 'cpt', 0, 1, 1)];
    expect(kinds(model, p)).toEqual(['person_clash']);
  });
  it('بدون تعارض', () => {
    expect(kinds(model, [at('A', 'ma', 0, 0, 0), at('B', 'ma', 0, 0, 1)])).toEqual([]);
  });
});

describe('القيد 6.1-2: أوقات الفراغ والعطل', () => {
  const school = tinySchool();
  school.config.days = ['full', 'am', 'full', 'full', 'full', 'off'];
  school.persons[0] = { ...school.persons[0]!, unavailable: [[2, 1]], other_school: [[3, 5]] };
  const model = buildModel(school);
  it('يوم عطلة', () => expect(kinds(model, [at('A', 'ma', 0, 5, 0)])).toEqual(['invalid_slot']));
  it('مساء يوم "صباح فقط"', () =>
    expect(kinds(model, [at('A', 'ma', 0, 1, 4)])).toEqual(['invalid_slot']));
  it('صباح يوم "صباح فقط" مقبول', () => expect(kinds(model, [at('A', 'ma', 0, 1, 3)])).toEqual([]));
  it('ساعة غير متاحة', () =>
    expect(kinds(model, [at('A', 'ma', 0, 2, 1)])).toEqual(['blocked_slot']));
  it('محجوز في مدرسة أخرى', () =>
    expect(kinds(model, [at('A', 'ma', 0, 3, 5)])).toEqual(['blocked_slot']));
});

describe('القيد 6.1-3: ساعتان كحد أقصى للمادة مع القسم في اليوم', () => {
  const model = buildModel(tinySchool());
  it('ثلاث ساعات رياضيات في يوم واحد', () => {
    const p = [at('A', 'ma', 0, 0, 0), at('A', 'ma', 1, 0, 1), at('A', 'ma', 2, 0, 2)];
    expect(kinds(model, p)).toEqual(['daily_cap']);
    expect(conflictSet(model, placementMap(p)).size).toBe(3);
  });
  it('المحاسبة (no_daily_cap) مستثناة', () => {
    const p = [at('A', 'cpt', 0, 0, 0), at('A', 'cpt', 1, 0, 1), at('A', 'cpt', 2, 0, 2)];
    expect(kinds(model, p)).toEqual([]);
  });
});

describe('القيد 6.1-4: غير المتواجد يأتي صباحا أو مساء فقط', () => {
  const model = buildModel(tinySchool());
  it('p1 غير متواجد صباحا ومساء', () => {
    const p = [at('A', 'ma', 0, 0, 0), at('B', 'ma', 0, 0, 5)];
    expect(kinds(model, p)).toEqual(['half_day']);
    expect(metrics(model, placementMap(p)).split).toBe(1);
  });
  it('p2 متواجد: مسموح', () => {
    expect(kinds(model, [at('A', 'fr', 0, 0, 0), at('B', 'fr', 0, 0, 5)])).toEqual([]);
  });
  it('fits يمنع الفترة الأخرى', () => {
    const placed = placementMap([at('A', 'ma', 0, 0, 0)]);
    const targets = validTargets(model, placed, 'B|ma|0').filter(([d]) => d === 0);
    expect(targets.every(([, p]) => p < 4)).toBe(true);
  });
});

describe('القيد 6.1-7: التجاور لا يعبر استراحة الغداء', () => {
  const model = buildModel(tinySchool());
  it('آخر حصة صباحا وأول حصة مساء ليستا متتاليتين', () => {
    const across = metrics(model, placementMap([at('A', 'fr', 0, 0, 3), at('A', 'fr', 1, 0, 4)]));
    const inside = metrics(model, placementMap([at('A', 'fr', 0, 0, 2), at('A', 'fr', 1, 0, 3)]));
    expect(across.dups).toBe(2);
    expect(inside.dups).toBe(0);
  });
});

describe('المؤشرات', () => {
  const model = buildModel(tinySchool());
  it('فراغ القسم وفراغ الأستاذ غير المتواجد ويوم الساعة الواحدة', () => {
    const p = [at('A', 'ma', 0, 0, 0), at('A', 'ma', 1, 0, 2), at('B', 'ma', 0, 1, 0)];
    const m = metrics(model, placementMap(p));
    expect(m.gaps).toBe(1);
    expect(m.tgaps).toBe(1);
    expect(m.lone).toBe(1);
    expect(m.unplaced).toBe(m.total - 3);
  });
  it('الجودة لا تنزل تحت 0', () => {
    expect(quality(metrics(model, new Map()), 0)).toBe(0);
  });
});

describe('التشخيص (6.3)', () => {
  it('أستاذ غير متواجد بساعات أكثر من الحد الأقصى', () => {
    const school = tinySchool();
    // p1: 8 ساعات رياضيات، والجمعة والخميس والأربعاء غير متاحة → يومان × min(4، 4) = 8 ✓
    // ثم نحجب الثلاثاء أيضا → الحد 4
    school.persons[0] = {
      ...school.persons[0]!,
      unavailable: [1, 2, 3, 4].flatMap((d) =>
        Array.from({ length: 8 }, (_, p) => [d, p] as [number, number]),
      ),
    };
    const model = buildModel(school);
    expect(maxPossible(model, 'p1')).toEqual({ need: 8, max: 4 });
    expect(diagnose(model)).toEqual([
      'أ. واحد: 8 ساعات، والحد الأقصى الممكن 4 لأنه يأتي إما صباحا أو مساء فقط وحسب أوقات فراغه',
    ]);
  });
  it('ساعات أكثر من الخانات الحرة', () => {
    const school = tinySchool();
    school.persons[0] = {
      ...school.persons[0]!,
      unavailable: [0, 1, 2, 3, 4].flatMap((d) =>
        Array.from({ length: 7 }, (_, p) => [d, p] as [number, number]),
      ),
    };
    expect(diagnose(buildModel(school))).toEqual([
      'أ. واحد: 8 ساعات مطلوبة و5 فقط متاحة في أوقاته',
    ]);
  });
  it('قسم بحصص أكثر من خانات الأسبوع', () => {
    const school = tinySchool();
    school.config.days = ['am', 'off', 'off', 'off', 'off', 'off'];
    expect(diagnose(buildModel(school))).toContain('A: 10 حصة و4 خانة فقط في الأسبوع');
  });
  it('forcedLone: 3 ساعات بسقف يومي 2 تفرض يوما بساعة واحدة', () => {
    const school = tinySchool();
    school.teachers[0] = { ...school.teachers[0]!, classes: [{ class_id: 'A', hours: 3 }] };
    expect(forcedLone(buildModel(school), 'p1')).toBe(true);
    expect(forcedLone(buildModel(tinySchool()), 'p1')).toBe(false);
  });
});

describe('النقل اليدوي وقائمة التغييرات', () => {
  const model = buildModel(tinySchool());
  const base = placementMap([at('A', 'ma', 0, 0, 0), at('B', 'ma', 0, 0, 1)]);
  it('applyMoves يرفض نقلا يسبب تعارضا ويقبل نقلا صالحا', () => {
    expect(applyMoves(model, base, [{ unit: 'A|ma|0', day: 0, period: 1 }])).toBeNull();
    const next = applyMoves(model, base, [{ unit: 'A|ma|0', day: 0, period: 2 }]);
    expect(next?.get('A|ma|0')).toEqual([0, 2]);
  });
  it('diffPlans: الساعات متماثلة داخل (القسم، المادة)', () => {
    const after = placementMap([
      at('A', 'ma', 1, 0, 0),
      at('A', 'ma', 0, 2, 0),
      at('B', 'ma', 0, 0, 1),
    ]);
    expect(diffPlans(model, base, model, after)).toEqual([
      { class_id: 'A', subject: 'ma', from: null, to: [2, 0], add: false },
    ]);
    const moved = placementMap([at('A', 'ma', 0, 3, 3), at('B', 'ma', 0, 0, 1)]);
    expect(diffPlans(model, base, model, moved)).toEqual([
      { class_id: 'A', subject: 'ma', from: [0, 0], to: [3, 3] },
    ]);
  });
});
