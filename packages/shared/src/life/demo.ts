import type { AttendanceRecord, Incident, Parent, SchoolLife, Student } from '../contract/life';
import type { SchoolData } from '../contract/school';

/**
 * بيانات تلاميذ تجريبية (seedStudents في النموذج الأولي): 12–17 تلميذا لكل قسم، إخوة بنفس الولي،
 * غيابات الأسبوعين الماضيين، وحادثة اليوم. قابلة للتكرار (مولّد ببذرة 7). المعرّفات متسلسلة.
 */
const FN_B = [
  'ياسين',
  'آدم',
  'يوسف',
  'زكرياء',
  'أنس',
  'إلياس',
  'حمزة',
  'عمر',
  'أيوب',
  'مهدي',
  'ريان',
  'إسماعيل',
  'سفيان',
  'بلال',
  'نزار',
  'وليد',
  'سامي',
  'زياد',
  'إدريس',
  'طه',
];
const FN_G = [
  'مريم',
  'سارة',
  'هبة',
  'إيناس',
  'نور',
  'لينا',
  'آية',
  'رهف',
  'جنى',
  'ضحى',
  'هاجر',
  'سلمى',
  'ريم',
  'خديجة',
  'ملاك',
  'إخلاص',
  'نادية',
  'شيماء',
  'أميمة',
  'ياسمين',
];
const LN = [
  'العلوي',
  'بنعلي',
  'الإدريسي',
  'التازي',
  'الفاسي',
  'المرابط',
  'الحسني',
  'القاسمي',
  'بوزيد',
  'الشرقاوي',
  'السعيدي',
  'الوزاني',
  'بنموسى',
  'الكتاني',
  'أمزيان',
  'الرحماني',
  'الصقلي',
  'الزياني',
  'بلحاج',
  'العمراني',
  'الناصري',
  'بنجلون',
  'الشامي',
  'الغزاوي',
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function demoLife(school: SchoolData, now: Date = new Date()): SchoolLife {
  let r = 7;
  const rnd = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)] as T;
  const students: Student[] = [];
  const parents: (Parent & { ln: string })[] = [];
  const attendance: AttendanceRecord[] = [];
  const incidents: Incident[] = [];
  let mat = 100;
  let ids = 0;
  const yy = String(now.getFullYear()).slice(2);
  for (const c of school.classes) {
    const n = 12 + Math.floor(rnd() * 6);
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const g = rnd() < 0.5 ? 'm' : 'f';
      let ln = pick(LN);
      let fn = pick(g === 'm' ? FN_B : FN_G);
      while (seen.has(fn + ln)) {
        ln = pick(LN);
        fn = pick(g === 'm' ? FN_B : FN_G);
      }
      seen.add(fn + ln);
      let par = parents.find((p) => p.ln === ln && rnd() < 0.35);
      if (!par) {
        const fa = rnd() < 0.6;
        par = {
          id: `p${parents.length + 1}`,
          ln,
          full_name: `${fa ? 'السيد ' : 'السيدة '}${pick(fa ? FN_B : FN_G)} ${ln}`,
          phone: `06${String(Math.floor(rnd() * 1e8)).padStart(8, '0')}`,
          relation: fa ? 'father' : 'mother',
        };
        parents.push(par);
      }
      students.push({
        id: `e${++ids}`,
        class_id: c.id,
        first_name: fn,
        last_name: ln,
        gender: g,
        matricule: `${++mat}/${yy}`,
        birth_date: `20${10 + Math.floor(rnd() * 6)}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`,
        massar_code: null,
        parent_id: par.id,
        status: 'active',
        health_note: rnd() < 0.06 ? 'حساسية' : '',
        photo_consent: rnd() > 0.05,
        is_new: rnd() < 0.2,
      });
    }
  }
  let aid = 0;
  const add = (x: Omit<AttendanceRecord, 'id'>) => attendance.push({ id: `a${++aid}`, ...x });
  for (let k = 1; k <= 12; k++) {
    const d = new Date(now);
    d.setDate(now.getDate() - k);
    if (d.getDay() === 0) continue;
    for (let j = 0; j < 4; j++) {
      const s = students[Math.floor(rnd() * students.length)] as Student;
      const late = rnd() < 0.35;
      add({
        student_id: s.id,
        date: iso(d),
        period: Math.floor(rnd() * 4),
        type: late ? 'late' : 'absent',
        late_minutes: late ? 5 + Math.floor(rnd() * 30) : 0,
        justified: rnd() < 0.5,
        reason: rnd() < 0.5 ? 'مرض' : '',
        comment: '',
        parent_message_status: 'sent',
      });
    }
  }
  for (let k = 0; k < 3; k++) {
    const s = students[Math.floor(rnd() * students.length)] as Student;
    add({
      student_id: s.id,
      date: iso(now),
      period: 0,
      type: 'absent',
      late_minutes: 0,
      justified: false,
      reason: '',
      comment: '',
      parent_message_status: 'sent',
    });
  }
  const s0 = students[3];
  if (s0)
    for (let k = 2; k < 7; k++) {
      const d = new Date(now);
      d.setDate(now.getDate() - k);
      if (d.getDay())
        add({
          student_id: s0.id,
          date: iso(d),
          period: 1,
          type: 'absent',
          late_minutes: 0,
          justified: false,
          reason: '',
          comment: '',
          parent_message_status: 'sent',
        });
    }
  const s1 = students[9];
  if (s1)
    incidents.push({
      id: 'i1',
      student_id: s1.id,
      date: iso(now),
      time: '10:15',
      title: 'استعمال الهاتف أثناء الحصة',
      type: 'negative',
      gravity: 'light',
      measure: 'تنبيه شفوي',
      description: 'استعمل الهاتف أثناء حصة الرياضيات.',
      visible_to_parent: true,
      recorded_by: 'الحراسة العامة',
    });
  return {
    students,
    parents: parents.map(({ ln: _ln, ...p }) => p),
    attendance,
    incidents,
    meetings: [],
    rules: { monthly_absence_alert: 4, late_threshold_minutes: 15 },
  };
}
