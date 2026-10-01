import {
  analyzeAbsence,
  approveAbsence,
  buildModel,
  compensationLedger,
  placementMap,
  substitutionTexts,
  type SubstitutionContext,
} from '@hissas/shared';
import { rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle } from '../src/oracle';
import { cases } from './helpers';

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

describe('الغياب والتعويض مطابق للنموذج الأولي', () => {
  it('analyze + نصوص الخيارات + approve + ساعات التعويض، مع غياب سابق في نفس اليوم', async () => {
    const seen = { same: 0, review: 0, swap: 0, cancel: 0 };
    let lessonsTotal = 0;
    for (const c of cases(250, 8)) {
      const model = buildModel(c.school);
      const placed = placementMap(c.placements);
      const r = rng(c.seed * 17 + 3);
      if (!c.school.teachers.length || !model.grid.activeDays.length) continue;
      const day = r.pick(model.grid.activeDays);
      let ctx: SubstitutionContext = { absences: [], substitutions: [] };

      for (let step = 0; step < 2; step++) {
        const teacher = r.pick(c.school.teachers).id;
        const lessons = analyzeAbsence(model, placed, teacher, day, ctx);
        const choices = lessons.map((l) => r.int(0, l.options.length - 1));
        await oracle.load(c.school, c.placements);
        const proto = await oracle.absence(teacher, day, ctx, choices);

        const label = `${c.label} step ${step} ${teacher}@${day}`;
        expect(
          lessons.map((l) => ({
            ...l,
            texts: l.options.map((o) => {
              const t = substitutionTexts(model, l, o, day);
              return { label: t.best ? `${t.label} الأفضل` : t.label, darija: t.darija };
            }),
          })),
          label,
        ).toEqual(proto.lessons);

        const absence = { id: `a${step}`, teacher_id: teacher, day, reason: 'مرض' };
        const res = approveAbsence(model, absence, lessons, choices);
        expect(
          res.substitutions.map(({ absence_id: _a, ...x }) => x),
          label,
        ).toEqual(proto.approved);
        expect(res.notices, label).toEqual(proto.notices);
        const ledger = compensationLedger({
          absences: [absence],
          substitutions: res.substitutions,
        });
        expect(Object.fromEntries(ledger), label).toEqual(proto.ledger);

        for (const l of lessons) for (const o of l.options) seen[o.type]++;
        lessonsTotal += lessons.length;
        ctx = {
          absences: [...ctx.absences, absence],
          substitutions: [...ctx.substitutions, ...res.substitutions],
        };
      }
    }
    expect(lessonsTotal).toBeGreaterThan(200);
    for (const k of ['same', 'review', 'swap', 'cancel'] as const)
      expect(seen[k], k).toBeGreaterThan(20);
  });
});
