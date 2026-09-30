import type { SchoolData, Scenario } from '@hissas/shared';

/** تعريف سيناريو قبول: كيف يُبنى من البيانات التجريبية، وما يطلبه SPEC. */
export interface ScenarioDef {
  scenario: string;
  title: string;
  spec: string;
  build(demo: SchoolData): SchoolData;
  expected: Scenario['expected'];
}

const clone = <T>(x: T): T => structuredClone(x);

function person(s: SchoolData, id: string) {
  const p = s.persons.find((x) => x.id === id);
  if (!p) throw new Error(`شخص غير موجود في البيانات التجريبية: ${id}`);
  return p;
}

/** اختبارات القبول SPEC §6.5، مبنية على seed() للنموذج الأولي. */
export const SCENARIOS: ScenarioDef[] = [
  {
    scenario: '6.5-1-demo',
    title: 'البيانات التجريبية: 8 أقسام، 17 أستاذا، 205 ساعات',
    spec: '0 تعارض، 0 بدون مكان، 0 يوم صباحا ومساء، 0 فراغ أساتذة، ويوم ساعة واحدة واحد فقط (أستاذ التنظيم الإداري بـ3 ساعات، حالة مستحيلة رياضيا)',
    build: (demo) => clone(demo),
    expected: { conflicts: 0, unplaced: 0, split: 0, tgaps: 0, lone: 1 },
  },
  {
    scenario: '6.5-2-all-not-present',
    title: 'نفس البيانات مع كل الأساتذة غير متواجدين',
    spec: 'القيود الإلزامية محترمة 100%',
    build: (demo) => {
      const s = clone(demo);
      for (const p of s.persons) p.present = false;
      return s;
    },
    expected: { conflicts: 0, split: 0 },
  },
  {
    scenario: '6.5-3-max-16',
    title: 'أستاذ بـ20 ساعة ويوم كامل غير متاح',
    spec: 'التشخيص يعطي "الحد الأقصى 16"',
    build: (demo) => {
      const s = clone(demo);
      // أ. هشام الفاسي: الرياضيات 4 س × 5 أقسام = 20 س، غير متواجد؛ الجمعة كاملة غير متاحة
      const p = person(s, 't5');
      const periods = s.config.am_count + s.config.pm_count;
      for (let q = 0; q < periods; q++) p.unavailable.push([4, q]);
      return s;
    },
    expected: { diagnose_includes: ['أ. هشام الفاسي: 20 ساعات، والحد الأقصى الممكن 16'] },
  },
  {
    scenario: '6.5-4-45min-0830',
    title: 'توقيت 45 دقيقة، بداية 08:30، الأربعاء والجمعة صباحا فقط',
    spec: 'جدول كامل',
    build: (demo) => {
      const s = clone(demo);
      // الإعداد السريع "45 دقيقة · تبدأ 08:30" في النموذج الأولي
      s.config = {
        ...s.config,
        period_minutes: 45,
        am_start: '08:30',
        am_count: 5,
        pm_start: '14:30',
        pm_count: 4,
        break_after_2nd_minutes: 15,
        days: ['full', 'full', 'am', 'full', 'am', 'off'],
      };
      return s;
    },
    expected: { conflicts: 0, unplaced: 0 },
  },
  {
    scenario: '6.5-5-two-subjects',
    title: 'أستاذ واحد بمادتين (علوم الحياة + الإعلاميات)',
    spec: '0 تعارض بين حصصه',
    build: (demo) => {
      const s = clone(demo);
      // سجل الإعلاميات (t11) يصير للشخص نفسه الذي يدرّس علوم الحياة (t8)، كما في معالج
      // "إضافة أستاذ" بنفس الاسم. الشخص متواجد إذا كان أحد سجلاته متواجدا (persons())،
      // وسجل الإعلاميات متواجد؛ ولولا ذلك لكانت 22 ساعة أكثر من الحد الأقصى الممكن (20).
      const inf = s.teachers.find((t) => t.id === 't11');
      if (!inf) throw new Error('سجل الإعلاميات t11 غير موجود');
      inf.person_id = 't8';
      person(s, 't8').present = person(s, 't11').present || person(s, 't8').present;
      s.persons = s.persons.filter((p) => p.id !== 't11');
      return s;
    },
    expected: { conflicts: 0 },
  },
];
