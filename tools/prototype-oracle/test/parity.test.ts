import {
  buildModel,
  conflictSet,
  diagnose,
  diffPlans,
  forcedLonePersons,
  maxPossible,
  metrics,
  placementMap,
  quality,
  validTargets,
  type SchoolData,
} from '@hissas/shared';
import { loadScenarios, randomPlacements, randomSchool, rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle } from '../src/oracle';

/** عدد المدارس العشوائية (يمكن رفعه محليا: PARITY_CASES=2000). */
const CASES = Number(process.env.PARITY_CASES ?? 250);

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

/** يقارن كل ما تحسبه نواة المجال بما يحسبه النموذج الأولي لنفس المدرسة والجدول. */
async function compare(school: SchoolData, seed: number, label: string) {
  const placements = randomPlacements(school, seed);
  const model = buildModel(school);
  const placed = placementMap(placements);
  const r = rng(seed);
  const sample = model.units.length ? Array.from({ length: 3 }, () => r.pick(model.units).key) : [];

  await oracle.load(school, placements);
  const proto = await oracle.measure();
  const inspection = await oracle.inspect(sample);

  const m = metrics(model, placed);
  const conflicts = conflictSet(model, placed);
  expect(m, `${label}: metrics`).toEqual(proto.metrics);
  expect([...conflicts].sort(), `${label}: conflictSet`).toEqual(inspection.conflicts);
  expect(quality(m, conflicts.size), `${label}: quality`).toBe(proto.quality);
  for (const k of sample)
    expect(validTargets(model, placed, k), `${label}: fits ${k}`).toEqual(inspection.targets[k]);

  expect(diagnose(model), `${label}: diagnose`).toEqual(await oracle.diagnose());
  expect(
    model.persons.map((p) => ({ person_id: p.id, ...maxPossible(model, p.id) })),
    `${label}: tMax`,
  ).toEqual(await oracle.tMax());
  expect(forcedLonePersons(model), `${label}: forcedLone`).toEqual(await oracle.forcedLone());
}

describe('المطابقة مع النموذج الأولي على مدارس وجداول عشوائية', () => {
  it(`${CASES} مدرسة عشوائية`, async () => {
    for (let seed = 1; seed <= CASES; seed++)
      await compare(randomSchool(seed), seed, `seed ${seed}`);
  });

  it.each(loadScenarios().map((s) => [s.scenario, s] as const))(
    '%s: جداول عشوائية على بيانات السيناريو',
    async (_id, s) => {
      for (let seed = 1; seed <= 10; seed++)
        await compare(s.school, seed, `${s.scenario} seed ${seed}`);
    },
  );
});

describe('diffPlans', () => {
  it('نفس المدرسة، جدولان عشوائيان', async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = randomSchool(seed);
      const a = randomPlacements(s, seed);
      const b = randomPlacements(s, seed + 1000);
      const m = buildModel(s);
      expect(diffPlans(m, placementMap(a), m, placementMap(b)), `seed ${seed}`).toEqual(
        await oracle.diff(s, a, s, b),
      );
    }
  });

  it('بعد زيادة أو نقص ساعات', async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s0 = randomSchool(seed);
      const s1 = structuredClone(s0);
      const r = rng(seed);
      for (const t of s1.teachers)
        for (const c of t.classes)
          if (r.chance(0.4)) c.hours = Math.max(1, Math.min(8, c.hours + r.pick([-1, 1])));
      const a = randomPlacements(s0, seed);
      const b = randomPlacements(s1, seed + 7);
      expect(
        diffPlans(buildModel(s0), placementMap(a), buildModel(s1), placementMap(b)),
        `seed ${seed}`,
      ).toEqual(await oracle.diff(s0, a, s1, b));
    }
  });
});
