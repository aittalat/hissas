'use client';

import {
  DAY_NAMES_AR,
  makeGrid,
  periodTimes,
  type SchoolConfig,
  type SchoolDay,
  type Slot,
} from '@hissas/shared';

/**
 * شبكة أوقات الفراغ بخانات ✓ (availGrid): خانة، يوم كامل، أو عمود حصة؛ والأزرار السريعة.
 * الخانات المحجوزة في مدرسة أخرى تظهر ولا تتغير.
 */
export function AvailabilityGrid({
  config,
  isFree,
  isExt,
  onToggle,
  onQuick,
}: {
  config: SchoolConfig;
  isFree: (d: number, p: number) => boolean;
  isExt: (d: number, p: number) => boolean;
  onToggle: (slots: Slot[], on: boolean) => void;
  onQuick: (mode: 'all' | 'am' | 'pm' | 'none') => void;
}) {
  const g = makeGrid(config);
  const PR = periodTimes(config);
  const AD = g.activeDays;
  const am = config.am_count;
  const slotsOfDay = (d: number): Slot[] =>
    PR.map((_, p) => [d, p] as Slot).filter(([, p]) => g.isValid(d, p));
  const slotsOfCol = (p: number): Slot[] =>
    AD.filter((d) => g.isValid(d, p)).map((d) => [d, p] as Slot);
  const allOn = (ks: Slot[]) => ks.every(([d, p]) => isFree(d, p) || isExt(d, p));
  let free = 0;
  let tot = 0;
  for (const d of AD)
    for (let p = 0; p < PR.length; p++)
      if (g.isValid(d, p)) {
        tot++;
        if (isFree(d, p)) free++;
      }
  return (
    <>
      <div className="avtools">
        <span className="hint">✓ = متاح. أزل العلامة عن كل ساعة لا يستطيع فيها التدريس.</span>
        <span className="toolbar">
          {(
            [
              ['all', 'كل الأسبوع'],
              ['am', 'الصباح فقط'],
              ['pm', 'المساء فقط'],
              ['none', 'لا شيء'],
            ] as const
          ).map(([v, n]) => (
            <button key={v} className="btn sm ghost" onClick={() => onQuick(v)}>
              {n}
            </button>
          ))}
        </span>
      </div>
      <div className="tt-wrap" style={{ border: 0 }}>
        <table className="avg">
          <thead>
            <tr>
              <th />
              {PR.map((pp, p) => [
                p === am ? <th key={`s${p}`} className="sep" aria-hidden="true" /> : null,
                <th key={p}>
                  <label>
                    <input
                      type="checkbox"
                      checked={allOn(slotsOfCol(p))}
                      onChange={(e) => onToggle(slotsOfCol(p), e.target.checked)}
                    />
                    <span>{pp[0]}</span>
                  </label>
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {AD.map((d) => (
              <tr key={d}>
                <th>
                  <label>
                    <input
                      type="checkbox"
                      checked={allOn(slotsOfDay(d))}
                      onChange={(e) => onToggle(slotsOfDay(d), e.target.checked)}
                    />
                    <span>{DAY_NAMES_AR[d as SchoolDay]}</span>
                  </label>
                </th>
                {PR.map((_, p) => [
                  p === am ? <td key={`s${p}`} className="sep" aria-hidden="true" /> : null,
                  !g.isValid(d, p) ? (
                    <td key={p} className="na" aria-hidden="true" />
                  ) : isExt(d, p) ? (
                    <td key={p} className="xt" title="محجوز في مدرسة أخرى">
                      مدرسة أخرى
                    </td>
                  ) : (
                    <td key={p}>
                      <input
                        type="checkbox"
                        className="avck"
                        aria-label={`${DAY_NAMES_AR[d as SchoolDay]} ${PR[p]?.[0]}`}
                        checked={isFree(d, p)}
                        onChange={(e) => onToggle([[d, p]], e.target.checked)}
                      />
                    </td>
                  ),
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        {free} ساعة متاحة من {tot}.
      </p>
    </>
  );
}
