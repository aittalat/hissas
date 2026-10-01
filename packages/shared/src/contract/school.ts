import { z } from 'zod';
import { DAY_MODES } from '../calendar';

/**
 * بيانات مدرسة مكتفية بذاتها: كل ما يحتاجه المحرك والمؤشرات.
 * هي صيغة ملفات fixtures المشتركة بين TypeScript وPython، ومدخل عقد المحرك لاحقا.
 */

/** معرّف: حروف وأرقام و_ . - (يسمح بـ uuid وبمعرّفات النموذج الأولي، ويمنع تصادم المفاتيح المركبة). */
const id = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+$/)
  .meta({ id: 'Id' });
const day = z.number().int().min(0).max(5).meta({ id: 'Day' });
const period = z.number().int().min(0).max(15).meta({ id: 'Period' });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** خانة زمنية: [اليوم، رقم الحصة في اليوم]. */
export const SlotSchema = z.tuple([day, period]).meta({ id: 'Slot' });
export type Slot = z.infer<typeof SlotSchema>;

export const SchoolConfigSchema = z
  .object({
    period_minutes: z.number().int().min(30).max(90),
    am_start: hhmm,
    am_count: z.number().int().min(0).max(8),
    pm_start: hhmm,
    pm_count: z.number().int().min(0).max(8),
    break_after_2nd_minutes: z.number().int().min(0).max(60),
    /** 2 = حصص من ساعتين متتاليتين مفضلة، 1 = ساعة واحدة في كل حصة. */
    pairing_mode: z.union([z.literal(1), z.literal(2)]),
    /** 6 أيام، من الإثنين إلى السبت. */
    days: z.tuple([
      z.enum(DAY_MODES),
      z.enum(DAY_MODES),
      z.enum(DAY_MODES),
      z.enum(DAY_MODES),
      z.enum(DAY_MODES),
      z.enum(DAY_MODES),
    ]),
  })
  .meta({ id: 'SchoolConfig' });
export type SchoolConfig = z.infer<typeof SchoolConfigSchema>;

export const SubjectSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_]+$/),
    name: z.string().min(1),
    short: z.string().min(1),
    default_hours: z.number().int().min(1).max(8),
    hue: z.number().int().min(0).max(359),
    no_daily_cap: z.boolean(),
    hard: z.boolean(),
    prefer_double: z.boolean(),
  })
  .meta({ id: 'Subject' });
export type Subject = z.infer<typeof SubjectSchema>;

export const ClassSchema = z
  .object({
    id,
    name: z.string().min(1),
    level_rank: z.number().int(),
    /** مفاتيح مواد القسم. */
    subjects: z.array(z.string()),
  })
  .meta({ id: 'SchoolClass' });
export type SchoolClass = z.infer<typeof ClassSchema>;

/** الأستاذ كشخص: أوقاته وقاعدة الحضور تخصه هو لا مادته. */
export const PersonSchema = z
  .object({
    id,
    full_name: z.string().min(1),
    present: z.boolean(),
    shared: z.boolean(),
    unavailable: z.array(SlotSchema),
    other_school: z.array(SlotSchema),
  })
  .meta({ id: 'Person' });
export type Person = z.infer<typeof PersonSchema>;

/** سجل أستاذ لمادة واحدة (الشخص الذي يدرّس مادتين له سجلان). */
export const TeacherSchema = z
  .object({
    id,
    person_id: id,
    subject: z.string(),
    classes: z.array(
      z.object({ class_id: id, hours: z.number().int().min(1).max(8) }).meta({ id: 'ClassHours' }),
    ),
  })
  .meta({ id: 'Teacher' });
export type Teacher = z.infer<typeof TeacherSchema>;

export const PlacementSchema = z
  .object({
    class_id: id,
    subject: z.string(),
    /** رقم الساعة داخل (القسم، المادة): 0..hours-1. */
    index: z.number().int().min(0),
    day,
    period,
  })
  .meta({ id: 'Placement' });
export type Placement = z.infer<typeof PlacementSchema>;

export const SchoolDataSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    config: SchoolConfigSchema,
    subjects: z.array(SubjectSchema),
    classes: z.array(ClassSchema),
    persons: z.array(PersonSchema),
    teachers: z.array(TeacherSchema),
    locked_classes: z.array(id),
  })
  .superRefine((s, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    const dupes = (label: string, ids: string[]) => {
      const seen = new Set<string>();
      for (const x of ids) {
        if (seen.has(x)) issue(`${label} مكرر: ${x}`);
        seen.add(x);
      }
    };
    dupes(
      'مفتاح مادة',
      s.subjects.map((x) => x.key),
    );
    dupes(
      'قسم',
      s.classes.map((x) => x.id),
    );
    dupes(
      'شخص',
      s.persons.map((x) => x.id),
    );
    dupes(
      'سجل أستاذ',
      s.teachers.map((x) => x.id),
    );

    const subjects = new Set(s.subjects.map((x) => x.key));
    const classes = new Map(s.classes.map((c) => [c.id, c]));
    const persons = new Set(s.persons.map((p) => p.id));
    for (const c of s.classes)
      for (const k of c.subjects) if (!subjects.has(k)) issue(`القسم ${c.id}: مادة مجهولة ${k}`);

    const owner = new Map<string, string>();
    for (const t of s.teachers) {
      if (!persons.has(t.person_id)) issue(`السجل ${t.id}: شخص مجهول ${t.person_id}`);
      if (!subjects.has(t.subject)) issue(`السجل ${t.id}: مادة مجهولة ${t.subject}`);
      for (const { class_id } of t.classes) {
        const c = classes.get(class_id);
        if (!c) {
          issue(`السجل ${t.id}: قسم مجهول ${class_id}`);
          continue;
        }
        if (!c.subjects.includes(t.subject))
          issue(`السجل ${t.id}: المادة ${t.subject} ليست من مواد ${class_id}`);
        const k = `${class_id}|${t.subject}`;
        const prev = owner.get(k);
        if (prev) issue(`${k}: أستاذان (${prev} و${t.id}) — المادة في القسم لأستاذ واحد`);
        owner.set(k, t.id);
      }
    }
    for (const c of s.locked_classes) if (!classes.has(c)) issue(`قسم مقفل مجهول: ${c}`);
  })
  .meta({ id: 'SchoolData' });
export type SchoolData = z.infer<typeof SchoolDataSchema>;

/** عدد الساعات المطلوبة في الأسبوع (مجموع الوحدات). */
export function totalHours(school: SchoolData): number {
  return school.teachers.reduce((a, t) => a + t.classes.reduce((b, c) => b + c.hours, 0), 0);
}
