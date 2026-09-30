import type { AttendanceRecord, Incident, SchoolLife, Student } from '../contract/life';
import { norm } from '../io/text';

/**
 * حسابات الحياة المدرسية (واجهة الحارس العام، SPEC §7.10). منقولة من absStats، stuPoints،
 * viewHome، viewDiscipline، viewAbsences، filteredStudents في النموذج الأولي.
 */

export const studentName = (s: Pick<Student, 'first_name' | 'last_name'> | undefined) =>
  s ? `${s.first_name} ${s.last_name}` : '';

const monthOf = (iso: string) => iso.slice(0, 7);

export interface AbsenceStats {
  /** كل الغيابات. */
  abs: number;
  late: number;
  /** غيابات غير مبررة. */
  unj: number;
  /** غيابات الشهر الحالي. */
  month: number;
}

/** إحصاء غياب تلميذ (absStats). today = تاريخ اليوم (YYYY-MM-DD). */
export function absenceStats(
  att: readonly AttendanceRecord[],
  studentId: string,
  today: string,
): AbsenceStats {
  const a = att.filter((x) => x.student_id === studentId);
  const m = monthOf(today);
  return {
    abs: a.filter((x) => x.type === 'absent').length,
    late: a.filter((x) => x.type === 'late').length,
    unj: a.filter((x) => x.type === 'absent' && !x.justified).length,
    month: a.filter((x) => x.type === 'absent' && monthOf(x.date) === m).length,
  };
}

/** أثر الحادثة على نقاط السلوك: خفيفة −1، متوسطة −2، خطيرة −4، إيجابي +1. */
export function incidentDelta(i: Pick<Incident, 'type' | 'gravity'>): number {
  if (i.type === 'positive') return 1;
  return -({ light: 1, medium: 2, serious: 4 }[i.gravity] ?? 0);
}

/** نقاط السلوك /20 (stuPoints): 20 + مجموع الآثار، بين 0 و20. */
export function behaviorPoints(incidents: readonly Incident[], studentId: string): number {
  const sum = incidents
    .filter((i) => i.student_id === studentId)
    .reduce((a, i) => a + incidentDelta(i), 0);
  return Math.max(0, Math.min(20, 20 + sum));
}

/** وجه نقاط السلوك في ملف التلميذ: ≥16 جيد، ≥10 متوسط، وإلا ضعيف. */
export const pointsLevel = (p: number): 'ok' | 'mid' | 'bad' =>
  p >= 16 ? 'ok' : p >= 10 ? 'mid' : 'bad';

const active = (life: SchoolLife) => life.students.filter((s) => s.status === 'active');

/** الإنذار المبكر: التلاميذ النشطون الذين بلغوا حد الغياب الشهري، الأكثر أولا. */
export function earlyWarnings(
  life: SchoolLife,
  today: string,
): { student: Student; stats: AbsenceStats }[] {
  return active(life)
    .map((s) => ({ student: s, stats: absenceStats(life.attendance, s.id, today) }))
    .filter((x) => x.stats.month >= life.rules.monthly_absence_alert)
    .sort((a, b) => b.stats.month - a.stats.month);
}

/** بطاقات لوحة اليوم: الحاضرون من النشطين، الغائبون (تلاميذ مختلفون)، المتأخرون (تسجيلات). */
export function todaySummary(life: SchoolLife, today: string) {
  const A = life.attendance.filter((a) => a.date === today);
  const absent = new Set(A.filter((a) => a.type === 'absent').map((a) => a.student_id));
  const n = active(life).length;
  return {
    records: A,
    active: n,
    present: n - absent.size,
    absent: absent.size,
    late: A.filter((a) => a.type === 'late').length,
  };
}

/** آخر الحوادث (الأحدث أولا). */
export const latestIncidents = (life: SchoolLife, n = 4) =>
  [...life.incidents].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);

/** تلاميذ تحت 16 نقطة، الأضعف أولا. */
export function lowBehavior(life: SchoolLife): { student: Student; points: number }[] {
  return active(life)
    .map((s) => ({ student: s, points: behaviorPoints(life.incidents, s.id) }))
    .filter((x) => x.points < 16)
    .sort((a, b) => a.points - b.points);
}

/** جدول التتبع: من له غياب أو تأخر، الأكثر غير مبرر ثم الأكثر غيابا. */
export function absenceTracking(
  life: SchoolLife,
  today: string,
): { student: Student; stats: AbsenceStats }[] {
  return active(life)
    .map((s) => ({ student: s, stats: absenceStats(life.attendance, s.id, today) }))
    .filter((x) => x.stats.abs + x.stats.late > 0)
    .sort((a, b) => b.stats.unj - a.stats.unj || b.stats.abs - a.stats.abs);
}

/** لائحة الغياب: تصفية بالتاريخ والقسم، الأحدث أولا، 150 كحد أقصى. */
export function absenceList(
  life: SchoolLife,
  filter: { date?: string; class_id?: string },
): { record: AttendanceRecord; student: Student }[] {
  const byId = new Map(life.students.map((s) => [s.id, s]));
  return life.attendance
    .filter((a) => !filter.date || a.date === filter.date)
    .map((a) => ({ record: a, student: byId.get(a.student_id) }))
    .filter(
      (x): x is { record: AttendanceRecord; student: Student } =>
        !!x.student && (!filter.class_id || x.student.class_id === filter.class_id),
    )
    .sort((x, y) => y.record.date.localeCompare(x.record.date))
    .slice(0, 150);
}

/** بحث التلاميذ: الحالة، القسم، والاسم أو رقم التسجيل (بالتطبيع العربي). */
export function searchStudents(
  life: SchoolLife,
  opts: { status?: Student['status']; q?: string; class_id?: string },
): Student[] {
  const q = norm(opts.q ?? '');
  const c = opts.class_id ?? '';
  const status = opts.status ?? 'active';
  return life.students.filter(
    (s) =>
      s.status === status &&
      (!c || s.class_id === c) &&
      (!q || norm(studentName(s)).includes(q) || norm(s.matricule).includes(q)),
  );
}

/** بحث الأولياء بالاسم أو الهاتف. */
export function searchParents(life: SchoolLife, q = '') {
  const n = norm(q);
  return life.parents.filter((p) => !n || norm(p.full_name).includes(n) || p.phone.includes(n));
}

/** أعداد تلاميذ القسم النشطين: ذكور، إناث، المجموع. */
export function classCounts(life: SchoolLife, classId: string) {
  const L = active(life).filter((s) => s.class_id === classId);
  return {
    total: L.length,
    m: L.filter((s) => s.gender === 'm').length,
    f: L.filter((s) => s.gender === 'f').length,
  };
}

/** الإخوة: تلاميذ نفس الولي. */
export const siblings = (life: SchoolLife, s: Student) =>
  life.students.filter((x) => x.parent_id === s.parent_id && x.id !== s.id);

/** عدد الأولياء المستهدفين برسالة (أولياء مختلفون لتلاميذ نشطين). */
export function audienceCount(life: SchoolLife, to: 'all' | string): number {
  return new Set(
    active(life)
      .filter((s) => to === 'all' || s.class_id === to)
      .map((s) => s.parent_id),
  ).size;
}
