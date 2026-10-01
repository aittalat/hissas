import type { SchoolData, Slot, Teacher } from '../contract/school';
import { makeGrid } from '../grid';
import { cloneState, type TimetableState } from './timetable-state';

/**
 * تعديل بيانات المدرسة (شاشة "الأساتذة والأقسام"، SPEC §7.4) بنفس قواعد النموذج الأولي.
 * كل دالة ترجع حالة جديدة ولا تعدّل المدخل. أوقات الشخص وحضوره واسمه على مستوى الشخص،
 * فكل سجلاته (مواده) تتبعه تلقائيا (syncPerson في النموذج الأولي).
 * الجدول لا يتغير هنا: الواجهة تعلّم "تغيّرت البيانات بعد آخر توليد".
 */

export type EditResult = { ok: true; state: TimetableState } | { ok: false; error: string };

const ok = (state: TimetableState): EditResult => ({ ok: true, state });
const fail = (error: string): EditResult => ({ ok: false, error });

/** المستويات بالترتيب (لترتيب الأقسام). */
export const LEVELS = ['1AC', '2AC', '3AC', 'TC', '1BAC', '2BAC'] as const;

/** مواد القسم الافتراضية (الإعدادي والجذع المشترك) عند إضافة قسم بدون نموذج. */
export const CORE_SUBJECTS = [
  'ar',
  'fr',
  'ma',
  'pc',
  'svt',
  'hg',
  'en',
  'inf',
  'eps',
  'ei',
] as const;

/** رتبة المستوى من اسم القسم (lvlRank): 1AC=0 … 2BAC=5، غيره 99. */
export function levelRank(name: string): number {
  const k = String(name).replace(/[\s-]/g, '').toUpperCase();
  const i = LEVELS.findIndex((l) => k.startsWith(l));
  return i < 0 ? 99 : i;
}

/** ترتيب الأقسام (sortClasses): بالمستوى ثم بالاسم؛ وأقسام كل أستاذ تتبع نفس الترتيب. */
export function sortClasses(school: SchoolData): void {
  school.classes.sort(
    (a, b) => levelRank(a.name) - levelRank(b.name) || a.name.localeCompare(b.name),
  );
  const order = new Map(school.classes.map((c, i) => [c.id, i]));
  for (const t of school.teachers)
    t.classes.sort((a, b) => (order.get(a.class_id) ?? 0) - (order.get(b.class_id) ?? 0));
}

const teacher = (s: SchoolData, id: string) => s.teachers.find((t) => t.id === id);
const hoursIn = (t: Teacher, c: string) => t.classes.find((x) => x.class_id === c);
const defaultHours = (s: SchoolData, subject: string) =>
  s.subjects.find((x) => x.key === subject)?.default_hours ?? 2;

/** يضيف القسم لسجل مع الحفاظ على ترتيب الأقسام. */
function addClassTo(s: SchoolData, t: Teacher, classId: string, hours: number) {
  t.classes.push({ class_id: classId, hours });
  const order = new Map(s.classes.map((c, i) => [c.id, i]));
  t.classes.sort((a, b) => (order.get(a.class_id) ?? 0) - (order.get(b.class_id) ?? 0));
}

/** المادة في القسم لأستاذ واحد: ينزع القسم من سجلات أخرى بنفس المادة. */
function takeClass(s: SchoolData, keep: Teacher, subject: string, classId: string) {
  for (const x of s.teachers)
    if (x !== keep && x.subject === subject)
      x.classes = x.classes.filter((c) => c.class_id !== classId);
}

function ensureSubjectInClass(s: SchoolData, classId: string, subject: string) {
  const c = s.classes.find((x) => x.id === classId);
  if (c && !c.subjects.includes(subject)) c.subjects.push(subject);
}

/**
 * زر +/− لساعات الأستاذ في قسم (ed-h): إضافة قسم جديد تبدأ بالساعات الافتراضية للمادة وتنزعه
 * من أستاذ آخر لنفس المادة؛ الوصول إلى 0 يزيل القسم؛ الحد الأقصى 8.
 */
export function changeHours(
  state: TimetableState,
  teacherId: string,
  classId: string,
  delta: 1 | -1,
): EditResult {
  const next = cloneState(state);
  const s = next.school;
  const t = teacher(s, teacherId);
  if (!t) return fail('الأستاذ غير موجود');
  const cur = hoursIn(t, classId);
  if (!cur) {
    if (delta < 0) return ok(next);
    takeClass(s, t, t.subject, classId);
    addClassTo(s, t, classId, defaultHours(s, t.subject));
    ensureSubjectInClass(s, classId, t.subject);
  } else {
    const n = cur.hours + delta;
    if (n <= 0) t.classes = t.classes.filter((c) => c.class_id !== classId);
    else cur.hours = Math.min(8, n);
  }
  return ok(next);
}

export interface NewTeacherInput {
  name: string;
  subject: string;
  /** ساعات كل قسم (0 أو أقل = غير مختار). */
  classes: Record<string, number>;
  present: boolean;
  /** الخانات المتاحة (المعالج يبدأ بكل الخانات). */
  free: Slot[];
}

/**
 * معالج "إضافة أستاذ" بخمس خطوات (saveNewTeacher): نفس الاسم = نفس الشخص (مادة أخرى،
 * نفس أوقات الفراغ)؛ الأقسام المختارة تُنزع من الأستاذ السابق لنفس المادة.
 * ids: معرّف السجل الجديد، ومعرّف الشخص إذا كان جديدا.
 */
export function addTeacher(
  state: TimetableState,
  input: NewTeacherInput,
  ids: { teacher_id: string; person_id: string },
): EditResult {
  const next = cloneState(state);
  const s = next.school;
  const name = input.name.trim();
  if (!name) return fail('اكتب اسم الأستاذ');
  const chosen = Object.entries(input.classes).filter(([, h]) => h > 0);
  if (!chosen.length) return fail('اختر قسما واحدا على الأقل');
  const same = s.persons.find(
    (p) => p.full_name.trim() === name && s.teachers.some((t) => t.person_id === p.id),
  );
  if (same && s.teachers.some((t) => t.person_id === same.id && t.subject === input.subject))
    return fail('هذا الأستاذ مسجل بنفس المادة. عدّل ساعاته من لائحة الأساتذة');

  const t: Teacher = {
    id: ids.teacher_id,
    person_id: same ? same.id : ids.person_id,
    subject: input.subject,
    classes: [],
  };
  for (const [c] of chosen) {
    takeClass(s, t, input.subject, c);
    ensureSubjectInClass(s, c, input.subject);
  }
  for (const [c, h] of chosen) addClassTo(s, t, c, Math.min(8, Math.max(1, Math.round(h))));
  if (same) {
    if (input.present) same.present = true;
  } else {
    const grid = makeGrid(s.config);
    const free = new Set(input.free.map(([d, p]) => `${d}-${p}`));
    const unavailable: Slot[] = [];
    for (const d of grid.activeDays)
      for (let p = 0; p < grid.periods; p++)
        if (grid.isValid(d, p) && !free.has(`${d}-${p}`)) unavailable.push([d, p]);
    s.persons.push({
      id: ids.person_id,
      full_name: name,
      present: input.present,
      shared: false,
      unavailable,
      other_school: [],
    });
  }
  s.teachers.push(t);
  return ok(next);
}

/** تغيير اسم الأستاذ (كل سجلاته). اسم فارغ لا يغيّر شيئا. */
export function renameTeacher(state: TimetableState, teacherId: string, name: string): EditResult {
  const next = cloneState(state);
  const t = teacher(next.school, teacherId);
  const p = t && next.school.persons.find((x) => x.id === t.person_id);
  if (p) p.full_name = name.trim() || p.full_name;
  return ok(next);
}

/**
 * تغيير مادة السجل (ed-s): الساعات ترجع للافتراضي للمادة الجديدة، وأقسامه تُنزع من أستاذ آخر
 * لنفس المادة. الأقسام التي ليست فيها المادة الجديدة تسقط من السجل.
 */
export function changeSubject(
  state: TimetableState,
  teacherId: string,
  subject: string,
): EditResult {
  const next = cloneState(state);
  const s = next.school;
  const t = teacher(s, teacherId);
  if (!t) return fail('الأستاذ غير موجود');
  t.subject = subject;
  const h = defaultHours(s, subject);
  for (const c of t.classes) takeClass(s, t, subject, c.class_id);
  t.classes = t.classes
    .filter((c) => s.classes.find((k) => k.id === c.class_id)?.subjects.includes(subject))
    .map((c) => ({ class_id: c.class_id, hours: h }));
  return ok(next);
}

/** "متواجد في المدرسة طول اليوم". */
export function setTeacherPresent(
  state: TimetableState,
  teacherId: string,
  present: boolean,
): EditResult {
  const next = cloneState(state);
  const t = teacher(next.school, teacherId);
  const p = t && next.school.persons.find((x) => x.id === t.person_id);
  if (p) p.present = present;
  return ok(next);
}

/** "يعمل أيضا في مدارس أخرى": إلغاؤه يمسح الحجوزات في المدارس الأخرى. */
export function setTeacherShared(
  state: TimetableState,
  teacherId: string,
  shared: boolean,
): EditResult {
  const next = cloneState(state);
  const t = teacher(next.school, teacherId);
  const p = t && next.school.persons.find((x) => x.id === t.person_id);
  if (p) {
    p.shared = shared;
    if (!shared) p.other_school = [];
  }
  return ok(next);
}

/**
 * خانات ✓ أوقات الفراغ (setAvail): on = متاح. الخانات المحجوزة في مدرسة أخرى لا تتغير.
 */
export function setAvailability(
  state: TimetableState,
  teacherId: string,
  slots: Slot[],
  on: boolean,
): EditResult {
  const next = cloneState(state);
  const t = teacher(next.school, teacherId);
  const p = t && next.school.persons.find((x) => x.id === t.person_id);
  if (!p) return ok(next);
  const key = (x: Slot) => `${x[0]}-${x[1]}`;
  const ext = new Set(p.other_school.map(key));
  for (const sl of slots) {
    if (ext.has(key(sl))) continue;
    p.unavailable = p.unavailable.filter((x) => key(x) !== key(sl));
    if (!on) p.unavailable.push([sl[0], sl[1]]);
  }
  return ok(next);
}

/** كل الخانات الصالحة في الأيام النشطة (لليوم d فقط، أو للحصة p فقط). */
export function validSlots(school: SchoolData, only?: { day?: number; period?: number }): Slot[] {
  const g = makeGrid(school.config);
  const out: Slot[] = [];
  for (const d of g.activeDays)
    for (let p = 0; p < g.periods; p++)
      if (
        g.isValid(d, p) &&
        (only?.day === undefined || only.day === d) &&
        (only?.period === undefined || only.period === p)
      )
        out.push([d, p]);
  return out;
}

/** الأزرار السريعة: كل الأسبوع / الصباح فقط / المساء فقط / لا شيء (av-quick). */
export function quickAvailability(
  state: TimetableState,
  teacherId: string,
  mode: 'all' | 'am' | 'pm' | 'none',
): EditResult {
  const all = validSlots(state.school);
  const g = makeGrid(state.school.config);
  const r = setAvailability(state, teacherId, all, false);
  if (!r.ok || mode === 'none') return r;
  const keep = all.filter(
    ([, p]) => mode === 'all' || (mode === 'am' ? g.halfOf(p) === 0 : g.halfOf(p) === 1),
  );
  return setAvailability(r.state, teacherId, keep, true);
}

/** حذف سجل أستاذ (مادة واحدة). الشخص يُحذف إذا لم يبق له أي سجل. */
export function deleteTeacher(state: TimetableState, teacherId: string): EditResult {
  const next = cloneState(state);
  const s = next.school;
  const t = teacher(s, teacherId);
  if (!t) return ok(next);
  s.teachers = s.teachers.filter((x) => x.id !== teacherId);
  if (!s.teachers.some((x) => x.person_id === t.person_id))
    s.persons = s.persons.filter((p) => p.id !== t.person_id);
  return ok(next);
}

/** معرّف القسم من اسمه: حروف وأرقام لاتينية كبيرة، مع رقم عند التكرار (addClass). */
export function classIdFor(school: SchoolData, name: string): string {
  const base =
    String(name)
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase() || 'C';
  let id = base;
  let i = 2;
  while (school.classes.some((c) => c.id === id)) id = base + i++;
  return id;
}

/**
 * إضافة قسم (cls-add): اسم إجباري وغير مكرر؛ "نفس أساتذة وساعات قسم" ينسخ مواده وإسناداته.
 */
export function addClass(
  state: TimetableState,
  name: string,
  fromClassId?: string,
): EditResult & { class_id?: string } {
  const next = cloneState(state);
  const s = next.school;
  const n = name.trim();
  if (!n) return fail('اكتب اسم القسم أولا');
  if (s.classes.some((c) => c.name.toLowerCase() === n.toLowerCase()))
    return fail('هذا القسم موجود');
  const id = classIdFor(s, n);
  const from = fromClassId ? s.classes.find((c) => c.id === fromClassId) : undefined;
  const keys = new Set(s.subjects.map((x) => x.key));
  s.classes.push({
    id,
    name: n,
    level_rank: levelRank(n),
    subjects: from ? [...from.subjects] : CORE_SUBJECTS.filter((k) => keys.has(k)),
  });
  sortClasses(s);
  if (from)
    for (const t of s.teachers) {
      const h = hoursIn(t, from.id);
      if (h) addClassTo(s, t, id, h.hours);
    }
  return { ...ok(next), class_id: id };
}

/** تفعيل/إلغاء مادة في قسم (cls-subj): الإلغاء ينزع القسم من أساتذة المادة. */
export function toggleClassSubject(
  state: TimetableState,
  classId: string,
  subject: string,
): EditResult {
  const next = cloneState(state);
  const s = next.school;
  const c = s.classes.find((x) => x.id === classId);
  if (!c) return fail('القسم غير موجود');
  if (c.subjects.includes(subject)) {
    c.subjects = c.subjects.filter((k) => k !== subject);
    for (const t of s.teachers)
      if (t.subject === subject) t.classes = t.classes.filter((x) => x.class_id !== classId);
  } else c.subjects.push(subject);
  return ok(next);
}

/** حذف قسم (cls-del): يزول من الأساتذة ومن الأقسام المقفلة. */
export function deleteClass(state: TimetableState, classId: string): EditResult {
  const next = cloneState(state);
  const s = next.school;
  s.classes = s.classes.filter((c) => c.id !== classId);
  for (const t of s.teachers) t.classes = t.classes.filter((x) => x.class_id !== classId);
  s.locked_classes = s.locked_classes.filter((c) => c !== classId);
  return ok(next);
}
