import type { ApprovedAbsence, ApprovedSubstitution } from '../timetable/substitutions';
import type { Model } from '../timetable/units';

/**
 * تقرير الأساتذة (viewTeachers → التقارير): التوزيع البيداغوجي والساعات والغيابات وساعات التعويض.
 * الصف: الأستاذ، المواد، الأقسام، الساعات، الغيابات، ساعات التعويض، متواجد.
 */
export function teacherReport(
  model: Model,
  absences: readonly ApprovedAbsence[],
  subs: readonly ApprovedSubstitution[],
): (string | number)[][] {
  const { school } = model;
  const pk = (tid: string) => school.teachers.find((t) => t.id === tid)?.person_id ?? tid;
  const cName = (c: string) => school.classes.find((x) => x.id === c)?.name ?? c;
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  return model.persons.map((x) => {
    const mine = model.units.filter((u) => u.person_id === x.id);
    const cls = [...new Set(mine.map((u) => cName(u.class_id)))];
    const ab = absences.filter((a) => pk(a.teacher_id) === x.id).length;
    const rep = subs
      .filter((s) => s.substitute_teacher_id && pk(s.substitute_teacher_id) === x.id)
      .reduce((a, s) => a + s.len, 0);
    return [
      x.full_name,
      school.teachers
        .filter((t) => t.person_id === x.id)
        .map((r) => sh(r.subject))
        .join(' / '),
      cls.join('، '),
      mine.length,
      ab,
      rep,
      x.present ? 'نعم' : 'لا',
    ];
  });
}

/** بطاقة الأستاذ: موادّه، عدد ساعاته، متواجد. */
export function teacherCards(model: Model) {
  const { school } = model;
  return model.persons.map((x) => ({
    person_id: x.id,
    teacher_id: school.teachers.find((t) => t.person_id === x.id)?.id ?? '',
    name: x.full_name,
    subjects: school.teachers
      .filter((t) => t.person_id === x.id)
      .map((t) => school.subjects.find((s) => s.key === t.subject)?.short ?? t.subject),
    hours: model.units.filter((u) => u.person_id === x.id).length,
    present: x.present,
  }));
}
