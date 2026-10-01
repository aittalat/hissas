import { DAY_NAMES_AR, type SchoolDay } from '../calendar';
import type { Teacher } from '../contract/school';
import { periodTimes } from '../grid';
import { rowGroups } from './groups';
import { Occupancy } from './moves';
import { unitIndex, type Model, type PlacementMap, type Unit } from './units';

/**
 * غياب الأستاذ والتعويض (analyze / approve / darijaFor في النموذج الأولي).
 * اليوم هنا رقم يوم الأسبوع (0 = الإثنين)؛ الواجهة تحوّل التاريخ إلى يومه.
 */

export type SubstitutionType = 'same' | 'review' | 'swap' | 'cancel';

export type SubstitutionOption =
  | { type: 'same'; teacher_id: string }
  | { type: 'review'; teacher_id: string }
  /** تقديم حصة لاحقة (unit في period) إلى وقت الحصة الغائبة. */
  | { type: 'swap'; unit: string; period: number }
  | { type: 'cancel' };

/** حصة متأثرة بالغياب (ساعة أو ساعتان متتاليتان) وبدائلها مرتبة. */
export interface AffectedLesson {
  period: number;
  len: number;
  units: string[];
  class_id: string;
  subject: string;
  teacher_id: string;
  options: SubstitutionOption[];
}

/** تعويض معتمد سابقا (يحجز الأستاذ البديل). */
export interface ApprovedSubstitution {
  absence_id: string;
  day: number;
  period: number;
  len: number;
  class_id: string;
  units: string[];
  type: SubstitutionType;
  substitute_teacher_id: string | null;
  swap_unit: string | null;
  swap_period: number | null;
}

export interface ApprovedAbsence {
  id: string;
  teacher_id: string;
  day: number;
  reason: string;
}

export interface SubstitutionContext {
  absences: ApprovedAbsence[];
  substitutions: ApprovedSubstitution[];
}

/**
 * الحصص المتأثرة بغياب سجل أستاذ في يوم، وبدائل كل حصة بالترتيب:
 * أستاذ نفس المادة متفرغ؛ ثم مراجعة مع أستاذ حاضر ذلك اليوم (الأكثر ساعات أولا، 2 كحد أقصى)؛
 * ثم تقديم حصة لاحقة من نفس الفترة (للساعة المفردة)؛ ثم الإلغاء.
 */
export function analyzeAbsence(
  model: Model,
  placed: PlacementMap,
  teacherId: string,
  day: number,
  ctx: SubstitutionContext = { absences: [], substitutions: [] },
): AffectedLesson[] {
  const { school, grid } = model;
  const d = day;
  const o = Occupancy.from(model, placed);
  const byKey = unitIndex(model);
  const rec = new Map(school.teachers.map((t) => [t.id, t]));
  const pk = (id: string) => rec.get(id)?.person_id ?? id;
  const absent = new Set(ctx.absences.filter((a) => a.day === d).map((a) => pk(a.teacher_id)));
  absent.add(pk(teacherId));
  const freeT = (t: Teacher, p: number, len: number) => {
    const k = t.person_id;
    if (absent.has(k)) return false;
    for (let i = 0; i < len; i++) {
      const q = p + i;
      if (o.personAt(k, d, q) || model.isBlocked(k, d, q)) return false;
      if (
        ctx.substitutions.some(
          (s) =>
            s.day === d &&
            s.substitute_teacher_id === t.id &&
            q >= s.period &&
            q < s.period + s.len,
        )
      )
        return false;
    }
    return true;
  };
  const dayLoad = (personId: string) => {
    let n = 0;
    for (let q = 0; q < grid.periods; q++) if (o.personAt(personId, d, q)) n++;
    return n;
  };

  return rowGroups(model, o, 'person', pk(teacherId), d).map((g) => {
    const u = g.unit;
    const len = g.units.length;
    const p = g.period;
    const options: SubstitutionOption[] = [];
    for (const t of school.teachers)
      if (t.id !== teacherId && t.subject === u.subject && freeT(t, p, len))
        options.push({ type: 'same', teacher_id: t.id });
    school.teachers
      .filter((t) => t.id !== teacherId && t.subject !== u.subject && freeT(t, p, len))
      .map((t) => ({ t, n: dayLoad(t.person_id) }))
      .filter((z) => z.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 2)
      .forEach((z) => options.push({ type: 'review', teacher_id: z.t.id }));
    if (len === 1) {
      const end = grid.halfRange(grid.halfOf(p))[1];
      for (let q = p + 1; q < end; q++) {
        const v = o.classAt(u.class_id, d, q);
        if (!v) continue;
        const vu = byKey.get(v) as Unit;
        if (vu.person_id === pk(teacherId)) continue;
        const vt = rec.get(vu.teacher_id);
        if (vt && freeT(vt, p, 1)) {
          options.push({ type: 'swap', unit: v, period: q });
          break;
        }
      }
    }
    options.push({ type: 'cancel' });
    return {
      period: p,
      len,
      units: g.units,
      class_id: u.class_id,
      subject: u.subject,
      teacher_id: u.teacher_id,
      options,
    };
  });
}

/** اسم نوع التعويض (subLabel). */
export const SUBSTITUTION_LABEL: Record<SubstitutionType, string> = {
  same: 'تعويض',
  review: 'مراجعة',
  swap: 'مُقدَّمة',
  cancel: 'ملغاة',
};

export interface SubstitutionTexts {
  /** نص الخيار في الواجهة (optLabel بدون تنسيق). */
  label: string;
  /** "الأفضل" لخيار أستاذ نفس المادة. */
  best: boolean;
  notice_title: string;
  notice_text: string;
  /** رسالة الأولياء بالدارجة (darijaFor). */
  darija: string;
}

/** نصوص خيار تعويض (للواجهة وللإشعار) بنفس صياغة النموذج الأولي. */
export function substitutionTexts(
  model: Model,
  lesson: AffectedLesson,
  option: SubstitutionOption,
  day: number,
): SubstitutionTexts {
  const { school } = model;
  const times = periodTimes(school.config);
  const tl = (p: number) => times[p]?.[0] ?? '--:--';
  const dn = DAY_NAMES_AR[day as SchoolDay];
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  const tn = (id: string) => {
    const t = school.teachers.find((x) => x.id === id);
    return (t && model.person(t.person_id)?.full_name) ?? id;
  };
  const tSub = (id: string) => sh(school.teachers.find((x) => x.id === id)?.subject ?? '');
  const c = school.classes.find((x) => x.id === lesson.class_id)?.name ?? lesson.class_id;
  const s = sh(lesson.subject);
  const tm = tl(lesson.period);
  const title = `${SUBSTITUTION_LABEL[option.type]} · ${s} · ${dn} ${tm}`;
  switch (option.type) {
    case 'same':
      return {
        label: `تعويض بأستاذ نفس المادة: ${tn(option.teacher_id)}`,
        best: true,
        notice_title: title,
        notice_text: `يعوّض ${tn(option.teacher_id)} الحصة.`,
        darija: `السلام عليكم، حصة ${s} ديال قسم ${c} نهار ${dn} مع ${tm} غادي يقريها أستاذ آخر ديال نفس المادة. الحصة عادية.`,
      };
    case 'review':
      return {
        label: `حصة مراجعة مع ${tn(option.teacher_id)} (${tSub(option.teacher_id)})`,
        best: false,
        notice_title: title,
        notice_text: `حصة مراجعة مع ${tn(option.teacher_id)}.`,
        darija: `السلام عليكم، حصة ${s} ديال قسم ${c} نهار ${dn} مع ${tm} غادي تكون حصة مراجعة مع أستاذ آخر.`,
      };
    case 'swap': {
      const vs = sh(unitIndex(model).get(option.unit)?.subject ?? '');
      return {
        label: `تقديم حصة ${vs} (${tl(option.period)}) إلى هذا الوقت، فتصبح ${tl(option.period)} فارغة`,
        best: false,
        notice_title: title,
        notice_text: `قُدّمت حصة ${vs} إلى ${tm}.`,
        darija: `السلام عليكم، نهار ${dn} حصة ${vs} تقدمات لـ ${tm}، والحصة ديال ${tl(option.period)} ولات فارغة.`,
      };
    }
    case 'cancel':
      return {
        label: 'إلغاء الحصة وإشعار الأولياء',
        best: false,
        notice_title: title,
        notice_text: 'الحصة ملغاة.',
        darija: `السلام عليكم، حصة ${s} ديال قسم ${c} نهار ${dn} مع ${tm} ملغية حيت الأستاذ غايب. إلا كانت آخر حصة، التلميذ غادي يخرج بكري.`,
      };
  }
}

/** إشعار لأولياء قسم. */
export interface ClassNotice {
  class_id: string | null;
  title: string;
  text: string;
  darija: string | null;
}

export interface ApprovalResult {
  substitutions: ApprovedSubstitution[];
  notices: ClassNotice[];
}

/**
 * اعتماد الغياب (approve): تعويض لكل حصة حسب الخيار المختار، وإشعار لأولياء قسمها.
 * choices[i] = رقم الخيار المختار للحصة i (0 = الأول، وهو الافتراضي).
 */
export function approveAbsence(
  model: Model,
  absence: ApprovedAbsence,
  lessons: AffectedLesson[],
  choices: number[],
): ApprovalResult {
  const substitutions: ApprovedSubstitution[] = [];
  const notices: ClassNotice[] = [];
  lessons.forEach((r, i) => {
    const o = r.options[choices[i] ?? 0] as SubstitutionOption;
    substitutions.push({
      absence_id: absence.id,
      day: absence.day,
      period: r.period,
      len: r.len,
      class_id: r.class_id,
      units: r.units,
      type: o.type,
      substitute_teacher_id: o.type === 'same' || o.type === 'review' ? o.teacher_id : null,
      swap_unit: o.type === 'swap' ? o.unit : null,
      swap_period: o.type === 'swap' ? o.period : null,
    });
    const t = substitutionTexts(model, r, o, absence.day);
    notices.push({
      class_id: r.class_id,
      title: t.notice_title,
      text: t.notice_text,
      darija: t.darija,
    });
  });
  return { substitutions, notices };
}

/** ساعات التعويض والغياب لكل سجل أستاذ (ledger): تُحتسب في أجور العرضيين. */
export function compensationLedger(
  ctx: SubstitutionContext,
): Map<string, { sub: number; abs: number }> {
  const L = new Map<string, { sub: number; abs: number }>();
  const get = (k: string) => {
    let e = L.get(k);
    if (!e) {
      e = { sub: 0, abs: 0 };
      L.set(k, e);
    }
    return e;
  };
  const byId = new Map(ctx.absences.map((a) => [a.id, a]));
  for (const s of ctx.substitutions) {
    const a = byId.get(s.absence_id);
    if (a) get(a.teacher_id).abs += s.len;
    if (s.substitute_teacher_id) get(s.substitute_teacher_id).sub += s.len;
  }
  return L;
}
