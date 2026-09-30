import type { Placement, SchoolData, Slot } from '../contract/school';

/** بيانات المدرسة مع جدولها: الحالة التي تعدّلها الاقتراحات وشاشة البيانات. */
export interface TimetableState {
  school: SchoolData;
  placements: Placement[];
}

export const cloneState = (s: TimetableState): TimetableState => structuredClone(s);

export function teacherHours(school: SchoolData, teacherId: string, classId: string): number {
  return (
    school.teachers.find((t) => t.id === teacherId)?.classes.find((c) => c.class_id === classId)
      ?.hours ?? 0
  );
}

function setHoursRaw(school: SchoolData, teacherId: string, classId: string, hours: number) {
  const t = school.teachers.find((x) => x.id === teacherId);
  const c = t?.classes.find((x) => x.class_id === classId);
  if (c) c.hours = hours;
}

/**
 * زيادة ساعة للأستاذ مع القسم (addHour)؛ إذا أُعطيت خانة توضع الساعة الجديدة فيها.
 */
export function addHour(
  state: TimetableState,
  teacherId: string,
  classId: string,
  slot?: Slot,
): TimetableState {
  const next = cloneState(state);
  const t = next.school.teachers.find((x) => x.id === teacherId);
  if (!t) return next;
  const h = teacherHours(next.school, teacherId, classId);
  setHoursRaw(next.school, teacherId, classId, h + 1);
  if (slot)
    next.placements.push({
      class_id: classId,
      subject: t.subject,
      index: h,
      day: slot[0],
      period: slot[1],
    });
  return next;
}

/**
 * نقص ساعة (removeHour): تُحذف الساعة الموضوعة في الخانة المعطاة، وإلا ساعة بدون مكان،
 * وإلا آخر ساعة؛ ثم يُعاد ترقيم الساعات الباقية بالترتيب. لا شيء إذا كانت ساعة واحدة.
 */
export function removeHour(
  state: TimetableState,
  teacherId: string,
  classId: string,
  slot?: Slot | null,
): TimetableState {
  const next = cloneState(state);
  const t = next.school.teachers.find((x) => x.id === teacherId);
  const h = teacherHours(next.school, teacherId, classId);
  if (!t || h <= 1) return next;
  const s = t.subject;
  const at = new Map<number, Slot>();
  for (const x of next.placements)
    if (x.class_id === classId && x.subject === s && x.index < h)
      at.set(x.index, [x.day, x.period]);
  const idx = [...Array(h).keys()];
  let drop = slot
    ? idx.find((j) => at.get(j)?.[0] === slot[0] && at.get(j)?.[1] === slot[1])
    : undefined;
  if (drop === undefined) drop = idx.find((j) => !at.has(j)) ?? h - 1;
  const keep = idx.filter((j) => j !== drop).map((j) => at.get(j));
  next.placements = next.placements.filter((x) => !(x.class_id === classId && x.subject === s));
  keep.forEach((x, j) => {
    if (x)
      next.placements.push({ class_id: classId, subject: s, index: j, day: x[0], period: x[1] });
  });
  setHoursRaw(next.school, teacherId, classId, h - 1);
  return next;
}

/** اعتبار الشخص متواجدا في المدرسة. */
export function setPresent(
  state: TimetableState,
  personId: string,
  present: boolean,
): TimetableState {
  const next = cloneState(state);
  const p = next.school.persons.find((x) => x.id === personId);
  if (p) p.present = present;
  return next;
}
