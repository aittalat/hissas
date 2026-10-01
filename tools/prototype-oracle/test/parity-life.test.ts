import {
  STUDENT_LISTS,
  absenceStats,
  analyzeAbsence,
  approveAbsence,
  parentDay,
  type SubstitutionContext,
  addStudent,
  attestationHtml,
  audienceCount,
  behaviorPoints,
  brandCss,
  buildModel,
  hueOf,
  initials,
  inkOn,
  listData,
  listTableHtml,
  logoInitial,
  periodTimes,
  placementMap,
  recordAttendance,
  recordIncident,
  recordMeeting,
  slotLabel,
  slugify,
  updateAttendance,
  validateBroadcast,
  type SchoolLife,
} from '@hissas/shared';
import { isoDate, randomLife, rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle } from '../src/oracle';
import { cases } from './helpers';

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

const now = new Date();
const today = isoDate(now);
const strip = <T extends { id: string }>(xs: T[]) => xs.map(({ id: _id, ...x }) => x);

describe('الحياة المدرسية مطابقة للنموذج الأولي', () => {
  it('الإحصاءات، النقاط، القوائم التسع، وصف الحصة، والوثائق', async () => {
    for (const c of cases(60, 2)) {
      const life = randomLife(c.school, c.seed, now);
      const model = buildModel(c.school);
      const placed = placementMap(c.placements);
      const r = rng(c.seed * 3 + 1);
      const slots: [string, string, number][] = c.school.classes.length
        ? Array.from({ length: 6 }, () => {
            const d = new Date(now.getTime() - r.int(0, 9) * 86400000);
            return [r.pick(c.school.classes).id, isoDate(d), r.int(0, model.grid.periods)];
          })
        : [];
      await oracle.load(c.school, c.placements);
      const p = await oracle.lifeQuery(life, slots);
      for (const s of life.students) {
        expect(absenceStats(life.attendance, s.id, today), c.label).toEqual(p.abs[s.id]);
        expect(behaviorPoints(life.incidents, s.id), c.label).toBe(p.points[s.id]);
      }
      for (const [k] of STUDENT_LISTS)
        expect(listData(k, life, c.school), `${c.label} ${k}`).toEqual(p.lists[k]);
      expect(
        slots.map(([k, d, q]) => slotLabel(model, placed, k, d, q)),
        c.label,
      ).toEqual(p.labels);
      const s0 = life.students[0];
      if (s0)
        expect(
          attestationHtml(
            { name: 'oracle', color: '#1D5A48', logo: null },
            s0,
            c.school.classes.find((k) => k.id === s0.class_id)?.name ?? s0.class_id,
            now,
          ),
        ).toBe(p.docs.attestation);
      expect(
        listTableHtml(
          { name: c.school.name, color: '#1D5A48', logo: null },
          'عنوان',
          ['أ', 'ب'],
          [
            ['1', '<x>'],
            ['2', '&'],
          ],
          now,
        ),
      ).toBe(p.docs.table);
    }
  });

  it('أفعال الحارس العام: الغياب، التبرير، الحوادث، التلاميذ، اللقاءات، الرسائل', async () => {
    const kinds: Record<string, number> = {};
    for (const c of cases(120, 3)) {
      if (!c.school.classes.length) continue;
      const life = randomLife(c.school, c.seed, now);
      const model = buildModel(c.school);
      const placed = placementMap(c.placements);
      const r = rng(c.seed * 5 + 9);
      const act = life.students.filter((s) => s.status === 'active');
      for (let k = 0; k < 3; k++) {
        const kind = r.pick([
          'mark',
          'mark',
          'incident',
          'student',
          'reason',
          'just',
          'meeting',
          'broadcast',
        ] as const);
        await oracle.load(c.school, c.placements);
        const label = `${c.label} ${kind}`;
        let res: ReturnType<typeof recordAttendance> | null = null;
        let op: Record<string, unknown>;
        switch (kind) {
          case 'mark': {
            const cls = r.pick(c.school.classes).id;
            const date = isoDate(new Date(now.getTime() - r.int(0, 3) * 86400000));
            const period = r.int(0, Math.max(0, model.grid.periods - 1));
            const marks = act
              .filter((s) => s.class_id === cls && r.chance(0.5))
              .map((s) =>
                r.chance(0.5)
                  ? { student_id: s.id, type: 'absent' as const }
                  : {
                      student_id: s.id,
                      type: 'late' as const,
                      ...(r.chance(0.7) ? { minutes: r.int(0, 30) } : {}),
                    },
              );
            op = { kind, class_id: cls, date, period, marks };
            let n = 0;
            res = recordAttendance(
              life,
              { class_id: cls, date, period, marks },
              slotLabel(model, placed, cls, date, period),
              periodTimes(c.school.config)[period]?.[0] ?? '--:--',
              () => `new${n++}`,
            );
            break;
          }
          case 'incident': {
            const input = {
              student_id: r.chance(0.9) && act.length ? r.pick(act).id : '',
              title: r.chance(0.85)
                ? r.pick(['شجار في الساحة', ' تأخر متكرر ', 'مساعدة زميل'])
                : ' ',
              type: r.pick(['negative', 'positive'] as const),
              gravity: r.pick(['light', 'medium', 'serious'] as const),
              measure: r.pick(['تنبيه شفوي', 'استدعاء الولي']),
              date: today,
              time: '10:00',
              description: r.pick(['', ' وصف ']),
              visible_to_parent: r.chance(0.5),
            };
            if (!input.student_id) continue;
            op = { kind, input };
            res = recordIncident(life, input, 'new');
            break;
          }
          case 'student': {
            const input = {
              first_name: r.chance(0.9) ? 'سامي' : ' ',
              last_name: 'الناصري',
              class_id: r.pick(c.school.classes).id,
              gender: r.pick(['m', 'f'] as const),
              birth_date: r.chance(0.5) ? '2014-05-02' : '',
              parent_name:
                r.chance(0.4) && life.parents.length
                  ? r.pick(life.parents).full_name
                  : r.pick(['', 'السيد عمر الناصري']),
              parent_phone: r.pick(['', '0612345678']),
            };
            op = { kind, input };
            const p = await oracle.lifeAction(life, op);
            const res2 = addStudent(
              life,
              input,
              { student_id: p.newStudent ?? 'x', parent_id: p.newParent ?? 'x' },
              true,
              now,
            );
            kinds[kind] = (kinds[kind] ?? 0) + 1;
            if (!res2.ok) expect(res2.error, label).toBe(p.toast);
            else {
              expect(res2.life.students, label).toEqual(p.students);
              expect(res2.life.parents, label).toEqual(p.parents);
              expect(res2.info, label).toBe(p.toast);
            }
            continue;
          }
          case 'reason':
          case 'just': {
            if (!life.attendance.length) continue;
            const a = r.pick(life.attendance);
            const value =
              kind === 'reason' ? r.pick(['', 'مرض', 'بدون سبب', 'نقل']) : r.chance(0.5);
            op = { kind, id: a.id, value };
            const p = await oracle.lifeAction(life, op);
            const next = updateAttendance(
              life,
              a.id,
              kind === 'reason' ? { reason: value as string } : { justified: value as boolean },
            );
            expect(next.attendance, label).toEqual(p.attendance);
            kinds[kind] = (kinds[kind] ?? 0) + 1;
            continue;
          }
          case 'meeting': {
            if (!act.length) continue;
            const input = {
              student_id: r.pick(act).id,
              date: today,
              reason: r.chance(0.8) ? 'غياب متكرر' : ' ',
              requested_by: r.pick(['', 'الأب']),
              school_attendees: r.pick(['', 'الحارس العام']),
              family_attendees: '',
              discussed_points: r.pick(['', 'الانضباط']),
              agreed_measures: '',
            };
            op = { kind, input };
            const p = await oracle.lifeAction(life, op);
            const res2 = recordMeeting(life, input, 'x', today);
            kinds[kind] = (kinds[kind] ?? 0) + 1;
            if (!res2.ok) expect(res2.error, label).toBe(p.toast);
            else
              expect(strip(res2.life.meetings), label).toEqual(
                strip(p.meetings as { id: string }[]),
              );
            continue;
          }
          case 'broadcast': {
            const to = r.chance(0.5) ? 'all' : r.pick(c.school.classes).id;
            const title = r.chance(0.8) ? 'اجتماع الأولياء' : '';
            op = { kind, to, title, text: 'النص' };
            const p = await oracle.lifeAction(life, op);
            const err = validateBroadcast({ title, text: 'النص' });
            expect(err ?? `أُرسلت إلى ${audienceCount(life, to)} وليا`, label).toBe(p.toast);
            kinds[kind] = (kinds[kind] ?? 0) + 1;
            continue;
          }
        }
        const p = await oracle.lifeAction(life, op);
        kinds[kind] = (kinds[kind] ?? 0) + 1;
        if (!res || !res.ok) {
          expect(res && !res.ok ? res.error : '', label).toBe(p.toast);
          continue;
        }
        expect(strip(res.life.attendance), label).toEqual(strip(p.attendance));
        expect(
          res.life.incidents.map(({ id: _i, time: _t, ...x }) => x),
          label,
        ).toEqual(
          (p.incidents as { id: string; time: string }[]).map(({ id: _i, time: _t, ...x }) => x),
        );
        expect(res.messages, label).toEqual(p.messages);
        if (kind === 'mark') expect(res.info, label).toBe(p.toast);
      }
    }
    expect(Object.keys(kinds).sort()).toEqual([
      'broadcast',
      'incident',
      'just',
      'mark',
      'meeting',
      'reason',
      'student',
    ]);
  });
});

describe('الهوية مطابقة للنموذج الأولي', () => {
  it('inkOn، متغيرات CSS، الرابط، الحرف الأول، hueOf، initials', async () => {
    const colors = ['#1D5A48', '#FFFFFF', '#F6E9CE', '#000000', '#C2185B', '#12', 'red', '#abcdef'];
    const names = [
      'مدرسة النجاح',
      'Groupe Scolaire Larus',
      'École Al Amal',
      'GS Atlas',
      '',
      'Lycée Ibn Sina 2',
      'élève---test',
      'ecole',
    ];
    const taken = ['groupe-scolaire-larus', 'ecole', 'ecole-2'];
    await oracle.load(cases(1, 0).next().value!.school, []);
    const p = await oracle.brand(colors, names, taken);
    for (const c of colors) {
      if (/^#[0-9a-f]{6}$/i.test(c)) expect(inkOn(c), c).toBe(p.ink[c]);
      expect(brandCss(c), c).toBe(p.css[c]);
    }
    for (const n of names) {
      expect(slugify(n, taken), n).toBe(p.slug[n]);
      expect(logoInitial(n), n).toBe(p.initial[n]);
      expect(hueOf(n), n).toBe(p.hue[n]);
      expect(initials(n), n).toBe(p.initials[n]);
    }
  });
});

export type { SchoolLife };

describe('تطبيق الولي مطابق للنموذج الأولي', () => {
  it('يوم التلميذ مع التعويضات (تعويض، مراجعة، تقديم، إلغاء، خانة فرغت)', async () => {
    const kinds = new Set<string>();
    for (const c of cases(120, 4)) {
      if (!c.school.classes.length) continue;
      const life = randomLife(c.school, c.seed, now);
      const model = buildModel(c.school);
      const placed = placementMap(c.placements);
      const r = rng(c.seed * 11 + 2);
      const day = r.pick(model.grid.activeDays);
      if (day === undefined || !c.school.teachers.length) continue;
      // غياب أستاذين بخيارات عشوائية
      let ctx: SubstitutionContext = { absences: [], substitutions: [] };
      for (let k = 0; k < 2; k++) {
        const t = r.pick(c.school.teachers).id;
        const lessons = analyzeAbsence(model, placed, t, day, ctx);
        const abs = { id: `a${k}`, teacher_id: t, day, reason: 'مرض' };
        const res = approveAbsence(
          model,
          abs,
          lessons,
          lessons.map((l) => r.int(0, l.options.length - 1)),
        );
        ctx = {
          absences: [...ctx.absences, abs],
          substitutions: [...ctx.substitutions, ...res.substitutions],
        };
      }
      const firstActive = new Set(
        c.school.classes
          .map(
            (k) =>
              life.students.find((s) => s.class_id === k.id && s.status === 'active')?.class_id,
          )
          .filter(Boolean),
      );
      const cls = [...firstActive][0] as string | undefined;
      if (!cls) continue;
      await oracle.load(c.school, c.placements);
      const proto = await oracle.parentDay(life, cls, day, ctx.substitutions);
      const mine = parentDay(model, placed, cls, day, ctx.substitutions).map(
        (it): [string, string] => {
          kinds.add(it.kind);
          const time = it.kind === 'moved_out' ? it.start : it.start + (it.end ?? '');
          switch (it.kind) {
            case 'moved_out':
              return [time, `فارغة: قُدّمت هذه الحصة إلى ${it.to}`];
            case 'lesson':
              return [time, it.subject + it.teacher];
            case 'same':
              return [time, `${it.subject}${it.teacher}تعويض`];
            case 'review':
              return [time, `حصة مراجعةبدل ${it.subject} · ${it.teacher}تغيير`];
            case 'swap':
              return [time, `${it.subject}${it.teacher}مُقدَّمة`];
            case 'cancel':
              return [time, `${it.subject}ملغاة`];
          }
        },
      );
      expect(mine, c.label).toEqual(proto);
    }
    expect([...kinds].sort()).toEqual(['cancel', 'lesson', 'moved_out', 'review', 'same', 'swap']);
  });
});
