'use client';

import {
  DAY_NAMES_AR,
  Occupancy,
  SUBSTITUTION_LABEL,
  periodTimes,
  rowGroups,
  type ApprovedSubstitution,
  type Model,
  type PlacementMap,
  type SchoolDay,
  type Target,
} from '@hissas/shared';
import type { CSSProperties, ReactNode } from 'react';

/** حصة داخل خانة (lesson). */
export function Lesson({
  hue,
  subject,
  sub,
  extra,
}: {
  hue: number;
  subject: string;
  sub?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="les" style={{ '--h': hue } as CSSProperties}>
      <b>{subject}</b>
      {sub}
      {extra}
    </div>
  );
}

export interface GridProps {
  model: Model;
  placed: PlacementMap;
  mode: 'class' | 'teacher';
  /** قسم أو سجل أستاذ. */
  id: string;
  /** مفاتيح الحصة المختارة. */
  selected?: string[] | null;
  conflicts?: ReadonlySet<string>;
  /** أهداف النقل/التبديل للحصة المختارة (`${d}-${p}`). */
  targets?: ReadonlyMap<string, Target>;
  subs?: readonly ApprovedSubstitution[];
  onCell?: (day: number, period: number, group: string[] | null) => void;
}

/** شبكة جدول قسم أو أستاذ (grid في النموذج الأولي). */
export function TimetableGrid({
  model,
  placed,
  mode,
  id,
  selected,
  conflicts,
  targets,
  subs = [],
  onCell,
}: GridProps) {
  const { school, grid } = model;
  const PR = periodTimes(school.config);
  const AD = grid.activeDays;
  const am = school.config.am_count;
  const o = Occupancy.from(model, placed);
  const subject = (k: string) => school.subjects.find((s) => s.key === k);
  const tName = (tid: string) => {
    const t = school.teachers.find((x) => x.id === tid);
    return (t && model.person(t.person_id)?.full_name) ?? '';
  };
  const cName = (c: string) => school.classes.find((x) => x.id === c)?.name ?? c;
  const personId =
    mode === 'teacher' ? (school.teachers.find((t) => t.id === id)?.person_id ?? id) : null;
  const person = personId ? model.person(personId) : null;
  const unav = new Set(person?.unavailable.map(([d, p]) => `${d}-${p}`));
  const ext = new Set(person?.other_school.map(([d, p]) => `${d}-${p}`));
  const selKey = selected?.join(',');
  const click = (d: number, p: number, g: string[] | null) => onCell?.(d, p, g);
  const keyAct = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className="tt-wrap">
      <table className="tt">
        <thead>
          <tr>
            <th className="dh" scope="col">
              <span className="sr">اليوم</span>
            </th>
            {PR.map((pp, p) => [
              p === am ? <th key={`l${p}`} aria-hidden="true" /> : null,
              <th key={p} scope="col">
                <span className="pt">{pp[0]}</span>
                <span className="pt2">{pp[1]}</span>
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {AD.map((d) => {
            const G = rowGroups(
              model,
              o,
              mode === 'class' ? 'class' : 'person',
              mode === 'class' ? id : (personId as string),
              d,
            );
            const at = new Map(G.map((g) => [g.period, g]));
            const inside = new Set(
              G.flatMap((g) => g.units.slice(1).map((_, k) => g.period + k + 1)),
            );
            const cells: ReactNode[] = [];
            for (let p = 0; p < PR.length; p++) {
              if (p === am && d === AD[0])
                cells.push(
                  <td key="lunch" className="lunch" rowSpan={AD.length}>
                    <span>استراحة الغداء</span>
                  </td>,
                );
              if (inside.has(p)) continue;
              const g = at.get(p);
              const t = targets?.get(`${d}-${p}`);
              if (g) {
                const gs = g.units.join(',');
                const sub =
                  mode === 'class'
                    ? subs.find((s) => s.class_id === id && s.day === d && s.period === p)
                    : undefined;
                const cls = [
                  'cell',
                  selKey === gs ? 'sel' : '',
                  g.units.some((k) => conflicts?.has(k)) ? 'conf' : '',
                  t?.kind === 'swap' ? 't-swap' : '',
                ].join(' ');
                const sj = subject(g.unit.subject);
                cells.push(
                  <td
                    key={p}
                    className={cls}
                    colSpan={g.units.length}
                    tabIndex={0}
                    onClick={() => click(d, p, g.units)}
                    onKeyDown={(e) => keyAct(e, () => click(d, p, g.units))}
                    data-day={d}
                    data-period={p}
                  >
                    <Lesson
                      hue={sj?.hue ?? 0}
                      subject={sj?.short ?? g.unit.subject}
                      sub={
                        <small>
                          {mode === 'class' ? tName(g.unit.teacher_id) : cName(g.unit.class_id)}
                        </small>
                      }
                      extra={
                        <>
                          {sub ? <span className="tag">{SUBSTITUTION_LABEL[sub.type]}</span> : null}
                          {g.units.length > 1 ? <em>{g.units.length} ساعات</em> : null}
                        </>
                      }
                    />
                  </td>,
                );
                continue;
              }
              if (!grid.isValid(d, p)) {
                cells.push(<td key={p} className="cell off" />);
                continue;
              }
              if (ext.has(`${d}-${p}`)) {
                cells.push(
                  <td key={p} className="cell ext">
                    <span>محجوز في مدرسة أخرى</span>
                  </td>,
                );
                continue;
              }
              if (unav.has(`${d}-${p}`)) {
                cells.push(
                  <td key={p} className="cell unav">
                    <span>غير متاح</span>
                  </td>,
                );
                continue;
              }
              cells.push(
                <td
                  key={p}
                  className={`cell free ${t?.kind === 'move' ? 't-move' : ''}`}
                  tabIndex={t?.kind === 'move' ? 0 : undefined}
                  onClick={() => click(d, p, null)}
                  onKeyDown={(e) => keyAct(e, () => click(d, p, null))}
                  data-day={d}
                  data-period={p}
                />,
              );
            }
            return (
              <tr key={d}>
                <th className="dh" scope="row">
                  {DAY_NAMES_AR[d as SchoolDay]}
                </th>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** نص الجدول لنسخه إلى Excel (tsv). */
export function timetableTsv(
  model: Model,
  placed: PlacementMap,
  mode: 'class' | 'teacher',
  id: string,
): string {
  const { school, grid } = model;
  const PR = periodTimes(school.config);
  const o = Occupancy.from(model, placed);
  const personId =
    mode === 'teacher' ? (school.teachers.find((t) => t.id === id)?.person_id ?? id) : '';
  const units = new Map(model.units.map((u) => [u.key, u]));
  const rows = [['', ...PR.map((p) => `${p[0]}-${p[1]}`)].join('\t')];
  for (const d of grid.activeDays) {
    const r = [DAY_NAMES_AR[d as SchoolDay]];
    for (let p = 0; p < PR.length; p++) {
      const v = mode === 'class' ? o.classAt(id, d, p) : o.personAt(personId, d, p);
      const u = v ? units.get(v) : undefined;
      if (!u) {
        r.push('');
        continue;
      }
      const sh = school.subjects.find((s) => s.key === u.subject)?.short ?? u.subject;
      const t = school.teachers.find((x) => x.id === u.teacher_id);
      const who =
        mode === 'class'
          ? ((t && model.person(t.person_id)?.full_name) ?? '')
          : (school.classes.find((c) => c.id === u.class_id)?.name ?? '');
      r.push(`${sh} - ${who}`);
    }
    rows.push(r.join('\t'));
  }
  return rows.join('\n');
}
