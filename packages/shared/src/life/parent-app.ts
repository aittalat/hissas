import { periodTimes } from '../grid';
import { rowGroups } from '../timetable/groups';
import { Occupancy } from '../timetable/moves';
import type { ApprovedSubstitution } from '../timetable/substitutions';
import { unitIndex, type Model, type PlacementMap } from '../timetable/units';

/**
 * يوم التلميذ في تطبيق الولي (viewParent، SPEC §7.9): حصص القسم مع التعويضات المعتمدة.
 */
export type TimelineItem =
  | { kind: 'lesson'; start: string; end: string | null; subject: string; teacher: string }
  | { kind: 'same'; start: string; end: string | null; subject: string; teacher: string }
  | { kind: 'review'; start: string; end: string | null; subject: string; teacher: string }
  | { kind: 'swap'; start: string; end: string | null; subject: string; teacher: string }
  | { kind: 'cancel'; start: string; end: string | null; subject: string }
  /** الحصة فرغت لأنها قُدّمت إلى وقت آخر. */
  | { kind: 'moved_out'; start: string; to: string };

export function parentDay(
  model: Model,
  placed: PlacementMap,
  classId: string,
  day: number,
  subs: readonly ApprovedSubstitution[],
): TimelineItem[] {
  const { school, grid } = model;
  const PR = periodTimes(school.config);
  const tl = (p: number) => PR[p]?.[0] ?? '--:--';
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  const tName = (tid: string | null) => {
    const t = school.teachers.find((x) => x.id === tid);
    return (t && model.person(t.person_id)?.full_name) ?? '';
  };
  const byKey = unitIndex(model);
  const o = Occupancy.from(model, placed);
  const PG = new Map(rowGroups(model, o, 'class', classId, day).map((g) => [g.period, g]));
  const out: TimelineItem[] = [];
  for (let p = 0; p < grid.periods; p++) {
    if (!grid.isValid(day, p)) continue;
    const sw = subs.find(
      (s) => s.class_id === classId && s.day === day && s.type === 'swap' && s.swap_period === p,
    );
    if (sw) {
      out.push({ kind: 'moved_out', start: tl(p), to: tl(sw.period) });
      continue;
    }
    const g = PG.get(p);
    if (!g) continue;
    const len = g.units.length;
    const start = tl(p);
    const end = len > 1 ? (PR[p + len - 1]?.[1] ?? null) : null;
    const u = g.unit;
    const s = subs.find((x) => x.class_id === classId && x.day === day && x.period === p);
    if (!s)
      out.push({
        kind: 'lesson',
        start,
        end,
        subject: sh(u.subject),
        teacher: tName(u.teacher_id),
      });
    else if (s.type === 'same')
      out.push({
        kind: 'same',
        start,
        end,
        subject: sh(u.subject),
        teacher: tName(s.substitute_teacher_id),
      });
    else if (s.type === 'review')
      out.push({
        kind: 'review',
        start,
        end,
        subject: sh(u.subject),
        teacher: tName(s.substitute_teacher_id),
      });
    else if (s.type === 'swap') {
      const vu = byKey.get(s.swap_unit ?? '');
      out.push({
        kind: 'swap',
        start,
        end,
        subject: sh(vu?.subject ?? ''),
        teacher: tName(vu?.teacher_id ?? null),
      });
    } else out.push({ kind: 'cancel', start, end, subject: sh(u.subject) });
  }
  return out;
}
