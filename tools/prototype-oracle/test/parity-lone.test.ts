import { buildModel, loneDays, loneProposals, placementMap } from '@hissas/shared';
import { rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle } from '../src/oracle';
import { cases } from './helpers';

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

describe('أيام الساعة الواحدة وحلولها مطابقة للنموذج الأولي', () => {
  it('loneList + proposals (مع أقسام مقفلة أحيانا)', async () => {
    let total = 0;
    let withProposals = 0;
    for (const c of cases()) {
      const r = rng(c.seed * 31 + 7);
      const school = structuredClone(c.school);
      // قفل قسم عشوائي في ثلث الحالات
      if (school.classes.length && r.chance(0.33))
        school.locked_classes = [r.pick(school.classes).id];
      const model = buildModel(school);
      const placed = placementMap(c.placements);
      const mine = loneDays(model, placed).map((ln) => ({
        ...ln,
        proposals: loneProposals(model, placed, ln).map((p) => ({
          moves: p.moves,
          after: p.after,
          score: p.score,
        })),
      }));
      await oracle.load(school, c.placements);
      expect(mine, c.label).toEqual(await oracle.lone());
      total += mine.length;
      withProposals += mine.filter((x) => x.proposals.length).length;
    }
    // الحالات يجب أن تغطي أياما بحلول فعلية
    expect(total).toBeGreaterThan(100);
    expect(withProposals).toBeGreaterThan(30);
  });
});
