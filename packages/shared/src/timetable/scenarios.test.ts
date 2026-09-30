import { describe, expect, it } from 'vitest';
import { loadScenarios } from '../testing/scenarios';
import { conflictSet } from './conflicts';
import { diagnose, forcedLonePersons, maxPossible } from './diagnose';
import { metrics, quality } from './metrics';
import { buildModel, placementMap, toPlacements } from './units';

const scenarios = loadScenarios().map((s) => [s.scenario, s] as const);

describe('المطابقة مع نتائج النموذج الأولي المحفوظة', () => {
  it.each(scenarios)('%s: التشخيص والحد الأقصى والساعة المفروضة', (_id, s) => {
    const model = buildModel(s.school);
    expect(diagnose(model)).toEqual(s.prototype.diagnose);
    expect(model.persons.map((p) => ({ person_id: p.id, ...maxPossible(model, p.id) }))).toEqual(
      s.prototype.t_max,
    );
    expect(forcedLonePersons(model)).toEqual(s.prototype.forced_lone);
  });

  it.each(scenarios)('%s: المؤشرات والتعارضات والجودة لكل تشغيل', (_id, s) => {
    const model = buildModel(s.school);
    for (const run of s.prototype.runs) {
      const placed = placementMap(run.placements);
      const m = metrics(model, placed);
      const conflicts = conflictSet(model, placed).size;
      expect(m).toEqual(run.metrics);
      expect(conflicts).toBe(run.conflicts);
      expect(quality(m, conflicts)).toBe(run.quality);
      expect(toPlacements(model, placed)).toEqual(
        [...run.placements].sort((a, b) => order(model, a) - order(model, b)),
      );
    }
  });
});

function order(
  model: ReturnType<typeof buildModel>,
  p: { class_id: string; subject: string; index: number },
) {
  return model.units.findIndex(
    (u) => u.class_id === p.class_id && u.subject === p.subject && u.index === p.index,
  );
}
