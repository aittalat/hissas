import {
  advise,
  applyAdviceAction,
  buildModel,
  placementMap,
  type AdviceAction,
} from '@hissas/shared';
import { rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle, type ProtoAdviceFlags } from '../src/oracle';
import { cases, normSchool, sortPlacements } from './helpers';

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

/** نوع الخيار كما يُرى في النموذج الأولي (run/regen/fix/deep/goto/tid). */
function flagsOf(a: AdviceAction): ProtoAdviceFlags {
  const base = { run: false, regen: false, fix: false, deep: false, goto: null, teacher: null };
  switch (a.kind) {
    case 'add_hour':
    case 'remove_hour':
    case 'set_present':
      return { ...base, run: true, regen: a.regen };
    case 'move':
      return { ...base, run: true };
    case 'goto':
      return { ...base, goto: a.screen, teacher: a.teacher_id ?? null };
    case 'solve':
      return { ...base, fix: true, deep: a.deep };
  }
}

describe('advise مطابق للنموذج الأولي', () => {
  it('المشاكل والخيارات وأثر تطبيق كل خيار', async () => {
    const kinds = new Map<string, number>();
    let applied = 0;
    for (const c of cases(150, 4)) {
      const model = buildModel(c.school);
      const placed = placementMap(c.placements);
      const mine = advise(model, placed);
      await oracle.load(c.school, c.placements);
      const proto = await oracle.adviseAll();
      expect(
        mine.map((a) => ({
          title: a.title,
          detail: a.detail,
          options: a.options.map((o) => ({
            label: o.label,
            effects: o.effects,
            flags: flagsOf(o.action),
          })),
        })),
        c.label,
      ).toEqual(proto);
      for (const a of mine) kinds.set(a.kind, (kinds.get(a.kind) ?? 0) + 1);

      // تطبيق عينة من الخيارات التي تغيّر البيانات
      const r = rng(c.seed * 13 + 1);
      const runnable = mine.flatMap((a, i) =>
        a.options.flatMap((o, j) =>
          ['add_hour', 'remove_hour', 'set_present', 'move'].includes(o.action.kind)
            ? [{ i, j, o }]
            : [],
        ),
      );
      for (let k = 0; k < Math.min(2, runnable.length); k++) {
        const { i, j, o } = r.pick(runnable);
        const state = applyAdviceAction({ school: c.school, placements: c.placements }, o.action);
        const p = await oracle.applyAdvice(i, j);
        expect(normSchool(state.school), `${c.label}: ${o.label}`).toEqual(normSchool(p.school));
        expect(sortPlacements(state.placements), `${c.label}: ${o.label}`).toEqual(
          sortPlacements(p.placements),
        );
        applied++;
      }
    }
    // التغطية: كل أنواع المشاكل السبعة ظهرت، وطُبّقت خيارات كثيرة
    expect([...kinds.keys()].sort()).toEqual(
      [
        'class_gap',
        'class_single',
        'forced_lone',
        'split_subject',
        'teacher_gap',
        'teacher_split',
        'unplaced',
      ].sort(),
    );
    expect(applied).toBeGreaterThan(150);
  });
});
