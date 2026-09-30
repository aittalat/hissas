import {
  addClass,
  addTeacher,
  buildModel,
  changeHours,
  changeSubject,
  deleteClass,
  deleteTeacher,
  placementMap,
  quickAvailability,
  renameTeacher,
  setAvailability,
  setTeacherPresent,
  setTeacherShared,
  toPlacements,
  toggleClassSubject,
  validSlots,
  type EditResult,
  type SchoolData,
  type Slot,
  type TimetableState,
} from '@hissas/shared';
import { rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle } from '../src/oracle';
import { cases, normSchool, sortPlacements } from './helpers';

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

type R = ReturnType<typeof rng>;

/** عملية عشوائية صالحة للمدرسة: [وصفها للنموذج الأولي، تطبيقها في TS]. */
function randomOp(
  school: SchoolData,
  r: R,
): [Record<string, unknown>, (s: TimetableState, newId: string | null) => EditResult] {
  const T = school.teachers;
  const C = school.classes;
  const S = school.subjects;
  const t = T.length ? r.pick(T).id : '';
  const c = C.length ? r.pick(C).id : '';
  const slots = validSlots(school);
  const kinds = [
    'hours',
    'hours',
    'add_teacher',
    'add_teacher',
    'rename',
    'subject',
    'present',
    'shared',
    'avail_slot',
    'avail_day',
    'avail_col',
    'quick',
    'delete_teacher',
    'add_class',
    'add_class',
    'toggle_subject',
    'delete_class',
  ] as const;
  let kind: (typeof kinds)[number] = r.pick(kinds);
  if (!T.length || !C.length || !slots.length) kind = 'add_class';
  switch (kind) {
    case 'hours': {
      const delta = r.pick([1, -1] as const);
      return [{ kind, teacher: t, class: c, delta }, (s) => changeHours(s, t, c, delta)];
    }
    case 'add_teacher': {
      const names = school.persons.map((p) => p.full_name);
      const name = r.chance(0.1)
        ? '  '
        : r.chance(0.4) && names.length
          ? r.pick(names)
          : `أ. جديد ${r.int(1, 99)}`;
      const classes: Record<string, number> = {};
      for (const k of C) if (r.chance(0.4)) classes[k.id] = r.int(0, 9);
      const input = {
        name,
        subject: r.pick(S).key,
        classes,
        present: r.chance(0.4),
        free: slots.filter(() => r.chance(0.7)),
      };
      return [
        { kind, input },
        (s, id) => addTeacher(s, input, { teacher_id: id ?? 'none', person_id: id ?? 'none' }),
      ];
    }
    case 'rename': {
      const name = r.chance(0.2) ? '' : `أ. اسم ${r.int(1, 50)}`;
      return [{ kind, teacher: t, name }, (s) => renameTeacher(s, t, name)];
    }
    case 'subject': {
      const subject = r.pick(S).key;
      return [{ kind, teacher: t, subject }, (s) => changeSubject(s, t, subject)];
    }
    case 'present':
    case 'shared': {
      const on = r.chance(0.5);
      return [
        { kind, teacher: t, on },
        (s) => (kind === 'present' ? setTeacherPresent(s, t, on) : setTeacherShared(s, t, on)),
      ];
    }
    case 'avail_slot': {
      const [day, period] = r.pick(slots);
      const on = r.chance(0.5);
      return [
        { kind, teacher: t, day, period, on },
        (s) => setAvailability(s, t, [[day, period]], on),
      ];
    }
    case 'avail_day': {
      const day = r.pick(slots)[0];
      const on = r.chance(0.5);
      return [
        { kind, teacher: t, day, on },
        (s) => setAvailability(s, t, validSlots(s.school, { day }), on),
      ];
    }
    case 'avail_col': {
      const period = r.pick(slots)[1];
      const on = r.chance(0.5);
      return [
        { kind, teacher: t, period, on },
        (s) => setAvailability(s, t, validSlots(s.school, { period }), on),
      ];
    }
    case 'quick': {
      const mode = r.pick(['all', 'am', 'pm', 'none'] as const);
      return [{ kind, teacher: t, mode }, (s) => quickAvailability(s, t, mode)];
    }
    case 'delete_teacher':
      return [{ kind, teacher: t }, (s) => deleteTeacher(s, t)];
    case 'add_class': {
      const name = r.chance(0.1)
        ? ' '
        : r.chance(0.2) && C.length
          ? r.pick(C).name.toUpperCase()
          : r.pick(['2AC-C', '1BAC SM', 'TC-B', 'Classe 9', 'ق-3']);
      const from = r.chance(0.5) && C.length ? r.pick(C).id : undefined;
      return [{ kind, name, from }, (s) => addClass(s, name, from)];
    }
    case 'toggle_subject': {
      const subject = r.pick(S).key;
      return [{ kind, class: c, subject }, (s) => toggleClassSubject(s, c, subject)];
    }
    case 'delete_class':
      return [{ kind, class: c }, (s) => deleteClass(s, c)];
  }
}

describe('تعديل البيانات (§7.4) مطابق لمعالجات النموذج الأولي', () => {
  it('عمليات عشوائية على مدارس عشوائية وعلى البيانات التجريبية', async () => {
    const counts: Record<string, number> = {};
    let errors = 0;
    for (const c of cases(200, 6)) {
      const r = rng(c.seed * 97 + 11);
      for (let k = 0; k < 3; k++) {
        const [op, run] = randomOp(c.school, r);
        await oracle.load(c.school, c.placements);
        const proto = await oracle.edit(op);
        const res = run({ school: c.school, placements: c.placements }, proto.newTeacherId);
        const label = `${c.label} ${JSON.stringify(op)}`;
        counts[op.kind as string] = (counts[op.kind as string] ?? 0) + 1;
        if (!res.ok) {
          errors++;
          expect(res.error, label).toBe(proto.toast);
          continue;
        }
        // انحراف مقصود: القسم الجديد بدون نموذج يأخذ من المواد الافتراضية (CORE) الموجودة في
        // كتالوج المدرسة فقط؛ النموذج الأولي يضيفها كلها ولو لم تكن في الكتالوج.
        const keys = new Set(proto.school.subjects.map((x) => x.key));
        const protoSchool = {
          ...proto.school,
          classes: proto.school.classes.map((k) => ({
            ...k,
            subjects: k.subjects.filter((x) => keys.has(x)),
          })),
        };
        expect(normSchool(res.state.school), label).toEqual(normSchool(protoSchool));
        const model = buildModel(res.state.school);
        expect(
          sortPlacements(toPlacements(model, placementMap(res.state.placements))),
          label,
        ).toEqual(sortPlacements(proto.placements));
      }
    }
    expect(Object.keys(counts).length).toBe(14);
    expect(errors).toBeGreaterThan(10);
  });
});

// أنواع للتحقق فقط
export type { Slot };
