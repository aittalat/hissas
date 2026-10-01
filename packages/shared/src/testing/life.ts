import type { AttendanceRecord, Incident, Parent, SchoolLife, Student } from '../contract/life';
import type { SchoolData } from '../contract/school';
import { rng } from './random';

const FIRST_M = ['ياسين', 'آدم', 'يوسف', 'زكرياء', 'أنس', 'حمزة'];
const FIRST_F = ['مريم', 'سارة', 'هبة', 'إيناس', 'نور', 'لينا'];
const LAST = ['العلوي', 'بنعلي', 'الإدريسي', 'التازي', 'الفاسي'];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** حياة مدرسية عشوائية للاختبار: تلاميذ وإخوة، غيابات حول اليوم، حوادث. */
export function randomLife(school: SchoolData, seed: number, today: Date): SchoolLife {
  const r = rng(seed ^ 0x51ed);
  const parents: Parent[] = [];
  const students: Student[] = [];
  let n = 0;
  for (const c of school.classes)
    for (let i = 0, k = r.int(2, 7); i < k; i++) {
      const g = r.chance(0.5) ? 'm' : 'f';
      const last = r.pick(LAST);
      let p = parents.find((x) => x.full_name.endsWith(last) && r.chance(0.4));
      if (!p) {
        p = {
          id: `p${parents.length}`,
          full_name: `${r.chance(0.6) ? 'السيد' : 'السيدة'} ${r.pick(FIRST_M)} ${last}`,
          phone: `06${String(r.int(0, 99999999)).padStart(8, '0')}`,
          relation: r.pick(['father', 'mother', 'guardian'] as const),
        };
        parents.push(p);
      }
      students.push({
        id: `e${n}`,
        class_id: c.id,
        first_name: r.pick(g === 'm' ? FIRST_M : FIRST_F),
        last_name: last,
        gender: g,
        birth_date: `201${r.int(0, 5)}-0${r.int(1, 9)}-1${r.int(0, 9)}`,
        matricule: `${101 + n}/26`,
        massar_code: null,
        parent_id: p.id,
        status: r.chance(0.9) ? 'active' : 'archived',
        health_note: r.chance(0.1) ? 'حساسية' : '',
        photo_consent: r.chance(0.9),
        is_new: r.chance(0.2),
      });
      n++;
    }
  const attendance: AttendanceRecord[] = [];
  const incidents: Incident[] = [];
  if (students.length) {
    for (let k = 0; k < r.int(0, 40); k++) {
      const d = new Date(today);
      d.setDate(today.getDate() - r.int(0, 45));
      const late = r.chance(0.35);
      attendance.push({
        id: `a${k}`,
        student_id: r.pick(students).id,
        date: iso(d),
        period: r.int(0, 5),
        type: late ? 'late' : 'absent',
        late_minutes: late ? r.int(1, 40) : 0,
        justified: r.chance(0.4),
        reason: r.pick(['', 'مرض', 'نقل']),
        comment: '',
        parent_message_status: 'sent',
      });
    }
    for (let k = 0; k < r.int(0, 12); k++) {
      const pos = r.chance(0.25);
      incidents.push({
        id: `i${k}`,
        student_id: r.pick(students).id,
        date: iso(new Date(today.getTime() - r.int(0, 60) * 86400000)),
        time: '10:15',
        title: pos ? 'مشاركة متميزة' : 'استعمال الهاتف',
        type: pos ? 'positive' : 'negative',
        gravity: r.pick(['light', 'medium', 'serious'] as const),
        measure: pos ? 'تنويه' : 'تنبيه شفوي',
        description: '',
        visible_to_parent: r.chance(0.6),
        recorded_by: 'الحراسة العامة',
      });
    }
  }
  return {
    students,
    parents,
    attendance,
    incidents,
    meetings: [],
    rules: { monthly_absence_alert: r.pick([1, 2, 3, 4]), late_threshold_minutes: 15 },
  };
}

export { iso as isoDate };
