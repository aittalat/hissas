import type { SchoolLife, Student } from '../contract/life';
import type { SchoolData } from '../contract/school';
import { studentName } from './stats';

/** القوائم والتقارير (LISTS + listData في النموذج الأولي): المفتاح، العنوان، المجموعة. */
export const STUDENT_LISTS = [
  ['all', 'اللائحة العامة للتلاميذ', 'القوائم'],
  ['bycls', 'التلاميذ حسب القسم', 'القوائم'],
  ['family', 'التلاميذ حسب الأسرة (الإخوة)', 'القوائم'],
  ['nophoto', 'تلاميذ لا يريدون التصوير', 'القوائم'],
  ['eff', 'عدد التلاميذ حسب القسم والجنس', 'الأعداد'],
  ['new', 'التلاميذ الجدد', 'التسجيل'],
  ['health', 'تلاميذ لديهم ملاحظة صحية', 'التتبع'],
  ['absrate', 'نسب الغياب حسب القسم', 'التتبع'],
  ['disc', 'حوادث الانضباط', 'التتبع'],
] as const;

export type StudentListKey = (typeof STUDENT_LISTS)[number][0];

export interface Table {
  H: string[];
  R: (string | number)[][];
}

/** بيانات قائمة (listData). */
export function listData(k: StudentListKey, life: SchoolLife, school: SchoolData): Table {
  const act = life.students.filter((s) => s.status === 'active');
  const P = new Map(life.parents.map((p) => [p.id, p]));
  const cls = (id: string) => school.classes.find((c) => c.id === id)?.name ?? id;
  const row = (s: Student) => [
    studentName(s),
    cls(s.class_id),
    s.matricule,
    s.gender === 'f' ? 'أنثى' : 'ذكر',
    P.get(s.parent_id)?.full_name ?? '',
    P.get(s.parent_id)?.phone ?? '',
  ];
  const H = ['الاسم', 'القسم', 'رقم التسجيل', 'الجنس', 'الولي', 'الهاتف'];
  switch (k) {
    case 'all':
      return { H, R: act.map(row) };
    case 'bycls':
      return {
        H,
        R: school.classes.flatMap((c) => act.filter((s) => s.class_id === c.id).map(row)),
      };
    case 'family':
      return {
        H: ['الولي', 'الهاتف', 'الأبناء', 'العدد'],
        R: life.parents
          .map((p) => {
            const ch = act.filter((s) => s.parent_id === p.id);
            return [
              p.full_name,
              p.phone,
              ch.map((s) => `${s.first_name} (${cls(s.class_id)})`).join('، '),
              ch.length,
            ];
          })
          .filter((r) => (r[3] as number) > 1),
      };
    case 'nophoto':
      return { H, R: act.filter((s) => !s.photo_consent).map(row) };
    case 'eff':
      return {
        H: ['القسم', 'ذكور', 'إناث', 'المجموع'],
        R: [
          ...school.classes.map((c) => {
            const L = act.filter((s) => s.class_id === c.id);
            return [
              c.name,
              L.filter((s) => s.gender === 'm').length,
              L.filter((s) => s.gender === 'f').length,
              L.length,
            ];
          }),
          [
            'المجموع',
            act.filter((s) => s.gender === 'm').length,
            act.filter((s) => s.gender === 'f').length,
            act.length,
          ],
        ],
      };
    case 'new':
      return { H, R: act.filter((s) => s.is_new).map(row) };
    case 'health':
      return {
        H: [...H, 'ملاحظة'],
        R: act.filter((s) => s.health_note).map((s) => [...row(s), s.health_note]),
      };
    case 'absrate':
      return {
        H: ['القسم', 'التلاميذ', 'الغيابات', 'غير مبررة', 'التأخرات'],
        R: school.classes.map((c) => {
          const ids = new Set(act.filter((s) => s.class_id === c.id).map((s) => s.id));
          const A = life.attendance.filter((a) => ids.has(a.student_id));
          return [
            c.name,
            ids.size,
            A.filter((a) => a.type === 'absent').length,
            A.filter((a) => a.type === 'absent' && !a.justified).length,
            A.filter((a) => a.type === 'late').length,
          ];
        }),
      };
    case 'disc':
      return {
        H: ['التاريخ', 'التلميذ', 'القسم', 'الحادثة', 'الإجراء'],
        R: life.incidents.map((i) => {
          const s = life.students.find((x) => x.id === i.student_id);
          return [i.date, studentName(s), cls(s ? s.class_id : ''), i.title, i.measure || ''];
        }),
      };
  }
}
