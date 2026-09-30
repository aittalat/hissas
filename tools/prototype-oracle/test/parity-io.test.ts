import {
  DEFAULT_SUBJECTS,
  applyImport,
  buildImport,
  buildModel,
  distributionRows,
  freeTimeRows,
  placementMap,
  printableHtml,
  timetableMatrix,
  timetableTitle,
  exportTargets,
  workbookModel,
  type Cell,
  type Sheet,
} from '@hissas/shared';
import { rng } from '@hissas/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrototypeOracle } from '../src/oracle';
import { cases, normSchool } from './helpers';

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

type R = ReturnType<typeof rng>;
const WHICH = ['all', 'classes', 'teachers'] as const;

const FR_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const AR_DAYS = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** تنويع ورقة التوزيع: عناوين فرنسية، ترتيب أعمدة، أسطر عنوان، أسطر ناقصة ومكررة، أسماء بديلة. */
function perturbDist(rows: Cell[][], r: R): Sheet {
  const [head, ...body] = rows.map((x) => [...x]);
  const header = r.chance(0.5)
    ? ['Classe', 'Matière', 'Professeur', 'Heures', 'Présent']
    : [...(head ?? [])];
  let data = body.map((row) => {
    const x = [...row];
    if (r.chance(0.15))
      x[1] = r.pick([
        'maths',
        'Physique chimie',
        'anglais',
        'SVT',
        'Histoire',
        'Informatique',
        'فلسفة',
        'EPS',
      ]);
    if (r.chance(0.1)) x[3] = `${x[3]},0`;
    if (r.chance(0.1)) x[4] = r.pick(['oui', 'x', '1', 'نعم', 'non', '']);
    return x;
  });
  if (r.chance(0.3)) data.push(['', '', '', '', '']);
  if (r.chance(0.3)) data.push(['1AC-Z', 'maths', '', 4, '']);
  if (r.chance(0.3) && data.length) data.push([...(data[0] as Cell[])]);
  if (r.chance(0.2)) data.push(['Classe X', 'مادة غريبة', 'أ. مجهول', 3, '']);
  if (r.chance(0.3)) data = data.sort(() => (r.chance(0.5) ? -1 : 1));
  // ترتيب أعمدة مختلف
  const perm = r.chance(0.4) ? [2, 0, 1, 4, 3] : [0, 1, 2, 3, 4];
  const apply = (row: Cell[]) => perm.map((i) => row[i] ?? '');
  const out: Sheet = [apply(header), ...data.map(apply)];
  if (r.chance(0.3)) out.unshift(['التوزيع البيداغوجي 2026']);
  return out;
}

/** تنويع ورقة أوقات الفراغ: أيام فرنسية، صيغ وقت مختلفة، حالات، أسطر خاطئة. */
function perturbFree(rows: Cell[][], r: R): Sheet {
  const [head, ...body] = rows.map((x) => [...x]);
  const header = r.chance(0.5) ? ['Professeur', 'Jour', 'De', 'À', 'Statut'] : [...(head ?? [])];
  const fmt = (t: Cell): Cell => {
    const [h, m] = String(t).split(':').map(Number);
    return r.pick([
      `${h}:${String(m).padStart(2, '0')}`,
      `${h}h${String(m).padStart(2, '0')}`,
      ((h ?? 0) * 60 + (m ?? 0)) / 1440,
    ]);
  };
  const data = body.map((row) => {
    const x = [...row];
    const d = AR_DAYS.indexOf(String(x[1]));
    if (d >= 0 && r.chance(0.4)) x[1] = FR_DAYS[d];
    x[2] = fmt(x[2]);
    x[3] = fmt(x[3]);
    if (x[4] === 'مدرسة أخرى' && r.chance(0.5)) x[4] = 'autre école';
    if (r.chance(0.1)) x[4] = r.pick(['غير متاح', 'indisponible', 'متاح']);
    return x;
  });
  if (r.chance(0.3)) data.push(['أ. غير موجود', 'lundi', '8:00', '10:00', '']);
  if (r.chance(0.3)) data.push(['أ. خطأ', 'يوم', '10:00', '9:00', '']);
  if (r.chance(0.2)) data.push(['', '', '', '', '']);
  return [header, ...data];
}

describe('الاستيراد مطابق للنموذج الأولي', () => {
  it('buildImport + applyImport على أوراق مصدّرة ثم معدّلة', async () => {
    let custom = 0;
    let warnings = 0;
    let errors = 0;
    for (const c of cases(120, 3)) {
      const r = rng(c.seed * 7 + 5);
      await oracle.load(c.school, c.placements);
      const ex = await oracle.exportsAll('all');
      const sheets: Sheet[] = [];
      const kind = r.int(0, 9);
      if (kind === 0) sheets.push([['لا شيء'], ['هنا']]);
      else {
        if (kind !== 1) sheets.push(perturbFree(ex.free, r));
        sheets.push(perturbDist(ex.dist, r));
        if (r.chance(0.5)) sheets.reverse();
      }
      const mine = buildImport(sheets, c.school.subjects, c.school.config);
      const proto = await oracle.importBuild(sheets);
      expect(mine, c.label).toEqual(proto);
      if (!mine.ok) {
        errors++;
        continue;
      }
      custom += mine.custom.length;
      warnings += mine.warnings.length;
      const applied = await oracle.importApply(sheets);
      // انحراف مقصود: مادة معروفة بالاسم البديل وغير موجودة في كتالوج المدرسة تُضاف من
      // الكتالوج الافتراضي؛ النموذج الأولي يتركها مرجعا بلا مادة.
      const keys = new Set(applied!.subjects.map((x) => x.key));
      const missing = DEFAULT_SUBJECTS.filter(
        (x) => !keys.has(x.key) && applied!.classes.some((k) => k.subjects.includes(x.key)),
      );
      const protoSchool = {
        ...applied!,
        subjects: [
          ...applied!.subjects.filter((x) => !x.key.startsWith('x')),
          ...missing,
          ...applied!.subjects.filter((x) => x.key.startsWith('x')),
        ],
      };
      expect(normSchool(applyImport(c.school, mine)), c.label).toEqual(normSchool(protoSchool));
    }
    expect(errors).toBeGreaterThan(3);
    expect(custom).toBeGreaterThan(10);
    expect(warnings).toBeGreaterThan(50);
  });
});

const trim = (rows: (string | number)[][]) =>
  rows.map((row) => {
    const x = [...row];
    while (x.length && x[x.length - 1] === '') x.pop();
    return x;
  });

describe('التصدير مطابق للنموذج الأولي', () => {
  it('التوزيع، أوقات الفراغ، مصفوفات الجداول وعناوينها، صفحة الطباعة، وملف Excel', async () => {
    for (const c of cases(80, 2)) {
      const model = buildModel(c.school);
      const placed = placementMap(c.placements);
      await oracle.load(c.school, c.placements);
      const w = WHICH[c.seed % 3] as (typeof WHICH)[number];
      const ex = await oracle.exportsAll(w);
      expect(distributionRows(c.school), `${c.label}: dist`).toEqual(ex.dist);
      expect(freeTimeRows(model), `${c.label}: free`).toEqual(ex.free);
      const mats = exportTargets(model, w).map(([mode, id]) => ({
        mode,
        id,
        title: timetableTitle(c.school, mode, id),
        ...timetableMatrix(model, placed, mode, id),
      }));
      expect(mats, `${c.label}: matrices`).toEqual(ex.mats);
      expect(
        printableHtml(model, placed, w, { color: '#1D5A48', logo: null }),
        `${c.label}: html`,
      ).toBe(ex.html);

      const sheets = await oracle.workbookSheets(w);
      const mine = workbookModel(model, placed, w);
      expect(
        mine.map((s) => ({ name: s.name, rows: trim(s.rows), merges: s.merges })),
        `${c.label}: xlsx`,
      ).toEqual(sheets.map((s) => ({ name: s.name, rows: trim(s.rows), merges: s.merges })));
    }
  });
});
