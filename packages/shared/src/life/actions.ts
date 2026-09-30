import type {
  AttendanceRecord,
  Incident,
  ParentMeeting,
  SchoolLife,
  Student,
} from '../contract/life';
import { periodTimes } from '../grid';
import { Occupancy } from '../timetable/moves';
import { unitIndex, type Model, type PlacementMap } from '../timetable/units';

/**
 * أفعال الحارس العام (vieClick في النموذج الأولي): تسجيل الغياب، التبرير، الحوادث، محاضر
 * اللقاءات، إضافة تلميذ، رسائل الأولياء. ترجع حالة جديدة + الرسائل التي تُرسل للأولياء.
 */

/** رسالة لولي تلميذ: نص عادي في التطبيق ونص بالدارجة للرسالة الصوتية. */
export interface ParentMessage {
  student_id: string;
  text: string;
  darija: string;
}

export type LifeResult<T = SchoolLife> =
  { ok: true; life: T; messages: ParentMessage[]; info?: string } | { ok: false; error: string };

/** أسباب غياب التلميذ (اختيار سبب غير "بدون سبب" يجعله مبررا). */
export const ABSENCE_REASONS = ['مرض', 'ظرف عائلي', 'موعد طبي', 'نقل', 'بدون سبب'] as const;
/** أسباب غياب الأستاذ. */
export const TEACHER_ABSENCE_REASONS = ['مرض', 'تكوين', 'رخصة إدارية', 'ظرف عائلي'] as const;
/** إجراءات الانضباط. */
export const INCIDENT_MEASURES = [
  'تنبيه شفوي',
  'إنذار كتابي',
  'استدعاء الولي',
  'عمل لفائدة المدرسة',
  'توقيف مؤقت',
  'مجلس الانضباط',
  'بدون إجراء',
] as const;
export const RELATION_LABEL = { father: 'الأب', mother: 'الأم', guardian: 'الولي' } as const;
export const GENDER_LABEL = { m: 'ذكر', f: 'أنثى' } as const;
export const DEFAULT_RECORDER = 'الحراسة العامة';

/** يوم الأسبوع من تاريخ (dayIdx): 0 = الإثنين … 5 = السبت، والأحد -1. */
export function dayIndex(iso: string): number {
  const g = new Date(`${iso}T12:00`).getDay();
  return g === 0 ? -1 : g - 1;
}

/** وصف الحصة من الجدول (slotLabel): "08:00 · الرياضيات · أ. …"، أو الوقت فقط. */
export function slotLabel(
  model: Model,
  placed: PlacementMap,
  classId: string,
  date: string,
  period: number,
): string {
  const times = periodTimes(model.school.config);
  const tl = times[period]?.[0] ?? '--:--';
  const d = dayIndex(date);
  if (d < 0 || !model.grid.isValid(d, period)) return tl;
  const v = Occupancy.from(model, placed).classAt(classId, d, period);
  if (!v) return tl;
  const u = unitIndex(model).get(v);
  if (!u) return tl;
  const sh = model.school.subjects.find((s) => s.key === u.subject)?.short ?? u.subject;
  const t = model.school.teachers.find((x) => x.id === u.teacher_id);
  const name = t && model.person(t.person_id)?.full_name;
  return `${tl} · ${sh}${name ? ` · ${name}` : ''}`;
}

/** الحصص التي فيها درس للقسم في ذلك التاريخ (لاختيار الحصة عند تسجيل الغياب). */
export function lessonPeriods(
  model: Model,
  placed: PlacementMap,
  classId: string,
  date: string,
): number[] {
  const d = dayIndex(date);
  if (d < 0) return [];
  const o = Occupancy.from(model, placed);
  const out: number[] = [];
  for (let p = 0; p < model.grid.periods; p++)
    if (model.grid.isValid(d, p) && o.classAt(classId, d, p)) out.push(p);
  return out;
}

export interface AttendanceMarks {
  class_id: string;
  date: string;
  period: number;
  /** التلاميذ غير الحاضرين فقط: غائب أو متأخر (+ الدقائق). */
  marks: { student_id: string; type: 'absent' | 'late'; minutes?: number }[];
}

/**
 * حفظ الغياب والتأخر (mk-save): الكل حاضر افتراضيا؛ تسجيل نفس التلميذ لنفس الحصة مرتين
 * يعوّض الأول؛ التأخر بدقيقة على الأقل (10 افتراضيا)؛ رسالة لكل ولي.
 * newId: مولّد معرّفات للتسجيلات الجديدة.
 */
export function recordAttendance(
  life: SchoolLife,
  input: AttendanceMarks,
  label: string,
  periodStart: string,
  newId: () => string,
): LifeResult {
  if (!input.marks.length) return { ok: false, error: 'كل التلاميذ حاضرون · لا شيء للإرسال' };
  let attendance = [...life.attendance];
  const messages: ParentMessage[] = [];
  for (const m of input.marks) {
    const s = life.students.find((x) => x.id === m.student_id);
    if (!s) continue;
    const mins = m.type === 'late' ? Math.max(1, Number(m.minutes) || 10) : 0;
    attendance = attendance.filter(
      (x) => !(x.student_id === s.id && x.date === input.date && x.period === input.period),
    );
    const rec: AttendanceRecord = {
      id: newId(),
      student_id: s.id,
      date: input.date,
      period: input.period,
      type: m.type,
      late_minutes: mins,
      justified: false,
      reason: '',
      comment: '',
      parent_message_status: 'sent',
    };
    attendance.push(rec);
    messages.push(
      m.type === 'late'
        ? {
            student_id: s.id,
            text: `تأخر ${s.first_name} ${mins} دقيقة عن حصة ${label}`,
            darija: `السلام عليكم، ${s.first_name} تعطل ${mins} دقيقة اليوم على حصة ${periodStart}.`,
          }
        : {
            student_id: s.id,
            text: `غياب ${s.first_name} عن حصة ${label}`,
            darija: `السلام عليكم، ${s.first_name} ما حضرش اليوم لحصة ${periodStart}. إلا كان عندو عذر، عافاكم علمونا.`,
          },
    );
  }
  return {
    ok: true,
    life: { ...life, attendance },
    messages,
    info: `سُجّل ${input.marks.length} وأُشعر الأولياء`,
  };
}

/** تعديل سطر غياب: التبرير، السبب (سبب غير "بدون سبب" يجعله مبررا)، الملاحظة. */
export function updateAttendance(
  life: SchoolLife,
  id: string,
  change: { justified?: boolean; reason?: string; comment?: string },
): SchoolLife {
  return {
    ...life,
    attendance: life.attendance.map((x) => {
      if (x.id !== id) return x;
      const y = { ...x };
      if (change.justified !== undefined) y.justified = change.justified;
      if (change.reason !== undefined) {
        y.reason = change.reason;
        if (change.reason && change.reason !== 'بدون سبب') y.justified = true;
      }
      if (change.comment !== undefined) y.comment = change.comment;
      return y;
    }),
  };
}

export interface IncidentInput {
  student_id: string;
  title: string;
  type: Incident['type'];
  gravity: Incident['gravity'];
  measure: string;
  date: string;
  time: string;
  description: string;
  visible_to_parent: boolean;
  recorded_by?: string;
}

/** نص إشعار الولي بحادثة (عادي + دارجة). الإيجابي "تنويه". */
export function incidentMessage(s: Student, i: Pick<Incident, 'type' | 'title' | 'measure'>) {
  return i.type === 'positive'
    ? {
        text: `تنويه: ${i.title}`,
        darija: `السلام عليكم، بغينا نهنيوكم: ${s.first_name} ${i.title}. الله يحفظو.`,
      }
    : {
        text: `ملاحظة سلوكية: ${i.title}${i.measure ? ` · الإجراء: ${i.measure}` : ''}`,
        darija: `السلام عليكم، بغينا نعلموكم بلي ${s.first_name} وقعات ليه ملاحظة: ${i.title}. الإجراء: ${i.measure}.`,
      };
}

/** تسجيل حادثة (in-save): التلميذ والعنوان إجباريان؛ الإيجابي إجراؤه "تنويه". */
export function recordIncident(life: SchoolLife, input: IncidentInput, id: string): LifeResult {
  if (!input.student_id) return { ok: false, error: 'اختر التلميذ' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'اكتب عنوان الحادثة' };
  const s = life.students.find((x) => x.id === input.student_id);
  const inc: Incident = {
    id,
    student_id: input.student_id,
    date: input.date,
    time: input.time,
    title,
    type: input.type,
    gravity: input.gravity,
    measure: input.type === 'positive' ? 'تنويه' : input.measure,
    description: input.description.trim(),
    visible_to_parent: input.visible_to_parent,
    recorded_by: input.recorded_by ?? DEFAULT_RECORDER,
  };
  const messages: ParentMessage[] =
    inc.visible_to_parent && s ? [{ student_id: s.id, ...incidentMessage(s, inc) }] : [];
  return { ok: true, life: { ...life, incidents: [...life.incidents, inc] }, messages };
}

/** محضر لقاء مع الأولياء (mt-save): السبب إجباري، والباقي "—" إذا فرغ. */
export function recordMeeting(
  life: SchoolLife,
  input: Omit<ParentMeeting, 'id'>,
  id: string,
  today: string,
): LifeResult {
  if (!input.reason.trim()) return { ok: false, error: 'اكتب سبب اللقاء' };
  const or = (v: string, d = '—') => v.trim() || d;
  const m: ParentMeeting = {
    id,
    student_id: input.student_id,
    reason: input.reason.trim(),
    date: input.date || today,
    requested_by: or(input.requested_by, DEFAULT_RECORDER),
    school_attendees: or(input.school_attendees),
    family_attendees: or(input.family_attendees),
    discussed_points: or(input.discussed_points),
    agreed_measures: or(input.agreed_measures),
  };
  return { ok: true, life: { ...life, meetings: [...life.meetings, m] }, messages: [] };
}

export interface NewStudentInput {
  first_name: string;
  last_name: string;
  class_id: string;
  gender: 'm' | 'f';
  birth_date: string;
  parent_name: string;
  parent_phone: string;
}

/**
 * إضافة تلميذ (stu-new-save): يُربط بولي موجود بنفس الاسم (ويُحدَّث هاتفه) وبإخوته، وإلا يُنشأ
 * ولي جديد؛ رقم التسجيل "عدد التلاميذ+101/السنة". [قرار معلق: الربط بالهاتف بدل الاسم.]
 */
export function addStudent(
  life: SchoolLife,
  input: NewStudentInput,
  ids: { student_id: string; parent_id: string },
  hasClasses: boolean,
  now = new Date(),
): LifeResult {
  const fn = input.first_name.trim();
  const ln = input.last_name.trim();
  if (!fn || !ln) return { ok: false, error: 'اكتب الاسم والنسب' };
  if (!hasClasses) return { ok: false, error: 'أضف قسما أولا' };
  const pn = input.parent_name.trim();
  const pp = input.parent_phone.trim();
  const parents = life.parents.map((p) => ({ ...p }));
  let par = pn ? parents.find((p) => p.full_name.trim() === pn) : undefined;
  if (!par) {
    par = { id: ids.parent_id, full_name: pn || `ولي ${fn} ${ln}`, phone: pp, relation: 'father' };
    parents.push(par);
  } else if (pp) par.phone = pp;
  const yy = String(now.getFullYear()).slice(2);
  const st: Student = {
    id: ids.student_id,
    class_id: input.class_id,
    first_name: fn,
    last_name: ln,
    gender: input.gender || 'm',
    birth_date: input.birth_date || '—',
    matricule: `${life.students.length + 101}/${yy}`,
    massar_code: null,
    parent_id: par.id,
    status: 'active',
    health_note: '',
    photo_consent: true,
    is_new: true,
  };
  const students = [...life.students, st];
  const linked = students.filter((x) => x.parent_id === par.id).length > 1;
  return {
    ok: true,
    life: { ...life, students, parents },
    messages: [],
    info: `أُضيف التلميذ${linked ? ' ورُبط بإخوته' : ''}`,
  };
}

/** أرشفة التلميذ أو إعادة تفعيله. */
export const toggleArchive = (life: SchoolLife, id: string): SchoolLife => ({
  ...life,
  students: life.students.map((s) =>
    s.id === id ? { ...s, status: s.status === 'active' ? 'archived' : 'active' } : s,
  ),
});

/** نقل التلميذ إلى قسم آخر. */
export const transferStudent = (life: SchoolLife, id: string, classId: string): SchoolLife => ({
  ...life,
  students: life.students.map((s) => (s.id === id ? { ...s, class_id: classId } : s)),
});

/** رسالة لكل الأولياء أو أولياء قسم (cm-send): العنوان والنص إجباريان. */
export function validateBroadcast(input: { title: string; text: string }): string | null {
  return input.title.trim() && input.text.trim() ? null : 'اكتب العنوان والنص';
}
