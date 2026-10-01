import { Occupancy, buildModel, placementMap, rowGroups, targetsFor } from '@hissas/shared';
import { rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle } from '../src/oracle';
import { cases } from './helpers';

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

describe('rowGroups وtargetsFor مطابقة للنموذج الأولي', () => {
  it('تجميع الساعات المتتالية والنقل/التبديل اليدوي', async () => {
    for (const c of cases()) {
      const model = buildModel(c.school);
      const placed = placementMap(c.placements);
      const o = Occupancy.from(model, placed);
      const conv = (kind: 'class' | 'person', id: string) =>
        model.grid.activeDays.flatMap((d) =>
          rowGroups(model, o, kind, id, d).map((g) => ({
            day: d,
            period: g.period,
            units: g.units,
          })),
        );
      await oracle.load(c.school, c.placements);
      const proto = await oracle.groups();
      const classes = Object.fromEntries(c.school.classes.map((k) => [k.id, conv('class', k.id)]));
      const persons = Object.fromEntries(model.persons.map((p) => [p.id, conv('person', p.id)]));
      expect(classes, `${c.label}: groups/classes`).toEqual(proto.classes);
      expect(persons, `${c.label}: groups/persons`).toEqual(proto.persons);

      const all = Object.values(classes).flat();
      if (!all.length) continue;
      const r = rng(c.seed);
      for (let i = 0; i < 3; i++) {
        const sel = r.pick(all).units;
        const mine = Object.fromEntries(targetsFor(model, placed, sel));
        expect(mine, `${c.label}: targetsFor ${sel.join(',')}`).toEqual(await oracle.targets(sel));
      }
    }
  });
});
