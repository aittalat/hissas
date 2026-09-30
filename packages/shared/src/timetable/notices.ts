import { DAY_NAMES_AR, type SchoolDay } from '../calendar';

/**
 * نصوص إشعارات الأولياء المتعلقة بالجدول (note() في النموذج الأولي): عربي + دارجة.
 * نصوص التعويض في substitutions.ts، والغياب والحوادث في life/actions.ts.
 */
export interface Notice {
  class_id: string | null;
  title: string;
  text: string;
  darija: string;
}

/** بعد توليد/نشر جدول جديد. */
export const noticePublished = (): Notice => ({
  class_id: null,
  title: 'نُشر جدول الحصص',
  text: 'الجدول الجديد متاح الآن في تطبيق الآباء والتلاميذ والأساتذة.',
  darija: 'السلام عليكم، جدول الحصص الجديد راه واجد فالتطبيق. تقدرو تشوفوه دابا.',
});

/** بعد تطبيق حل (applySol) فيه تغييرات. */
export const noticeSolutionApplied = (changes: number): Notice => ({
  class_id: null,
  title: 'تحديث جدول الحصص',
  text: `عُدّلت ${changes} حصص في الجدول.`,
  darija: 'السلام عليكم، تبدلو شي حصص فجدول الحصص. شوفو الجدول الجديد فالتطبيق.',
});

/** بعد اقتراح غيّر الساعات (runAdvice). */
export const noticeHoursChanged = (): Notice => ({
  class_id: null,
  title: 'تحديث جدول الحصص',
  text: 'عُدّل الجدول بعد تغيير في الساعات.',
  darija: 'السلام عليكم، تبدل شي حاجة فجدول الحصص. شوفو الجدول الجديد فالتطبيق.',
});

/** نقل حصة (حلول يوم الساعة الواحدة، أو طلب شبكة الأساتذة): لأولياء القسم. */
export function noticeLessonMoved(
  classId: string,
  subjectShort: string,
  from: { day: number; time: string },
  to: { day: number; time: string },
): Notice {
  const dn = (d: number) => DAY_NAMES_AR[d as SchoolDay];
  return {
    class_id: classId,
    title: 'تغيير في جدول الحصص',
    text: `نُقلت حصة ${subjectShort} من ${dn(from.day)} ${from.time} إلى ${dn(to.day)} ${to.time}.`,
    darija: `السلام عليكم، حصة ${subjectShort} تبدل الوقت ديالها: من نهار ${dn(from.day)} مع ${from.time} لنهار ${dn(to.day)} مع ${to.time}.`,
  };
}
