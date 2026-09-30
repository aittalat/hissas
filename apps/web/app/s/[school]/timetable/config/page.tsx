'use client';

import {
  DAY_MODE_LABELS,
  DAY_NAMES_AR,
  TIMING_CHOICES,
  TIMING_PRESETS,
  buildModel,
  periodTimes,
  timeList,
  weeklyCapacity,
  type DayMode,
  type SchoolConfig,
  type SchoolDay,
} from '@hissas/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { useGenerate } from '@/lib/generate';
import { useSchoolCtx } from '@/lib/school';

/** توقيت المدرسة (viewCfg، SPEC §7.3). */
export default function ConfigPage() {
  const { meta, state, setMeta, href } = useSchoolCtx();
  const router = useRouter();
  const { generate, busy } = useGenerate();
  const toast = useToast();
  const [c, setC] = useState<SchoolConfig>(() => structuredClone(state.school.config));
  const [name, setName] = useState(meta.name);
  const set = (patch: Partial<SchoolConfig>) => setC((x) => ({ ...x, ...patch }));
  const PR = periodTimes(c);
  const cap = weeklyCapacity(c);
  const model = buildModel(state.school);
  const need = Math.max(
    0,
    ...state.school.classes.map((k) => model.units.filter((u) => u.class_id === k.id).length),
  );
  const changed = JSON.stringify(c) !== JSON.stringify(state.school.config) || name !== meta.name;
  const num = (v: string) => Number(v);

  const save = async () => {
    if (!c.days.some((m) => m !== 'off')) return toast('اختر يوم دراسة واحدا على الأقل');
    const n = name.trim() || meta.name;
    setMeta((m) => ({ ...m, name: n }));
    await generate({ ...state.school, name: n, config: c }, (unplaced) =>
      unplaced
        ? `حُفظ التوقيت، وبقيت ${unplaced} حصص بدون مكان`
        : 'حُفظ التوقيت وأُعيد توليد الجدول بدون تعارض',
    );
    router.push(href('/timetable'));
  };

  return (
    <div className="split">
      <section className="panel">
        <h2>توقيت المدرسة</h2>
        <p className="hint">لكل مدرسة نظامها. اضبطه مرة واحدة، والمحرك يبني الجدول عليه.</p>
        <label className="fld">
          اسم المدرسة
          <input
            type="text"
            id="cfg-school"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="fld">
          إعداد سريع
          <div className="chips">
            {TIMING_PRESETS.map((p) => (
              <button key={p.label} className="chip" onClick={() => set(p.config)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="fld">
          مدة الحصة (دقيقة)
          <select
            id="cfg-dur"
            value={c.period_minutes}
            onChange={(e) => set({ period_minutes: num(e.target.value) })}
          >
            {TIMING_CHOICES.period_minutes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          بداية الصباح
          <select
            id="cfg-ams"
            value={c.am_start}
            onChange={(e) => set({ am_start: e.target.value })}
          >
            {timeList(...TIMING_CHOICES.am_start_range).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          عدد حصص الصباح
          <select
            id="cfg-amn"
            value={c.am_count}
            onChange={(e) => set({ am_count: num(e.target.value) })}
          >
            {TIMING_CHOICES.am_count.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          بداية المساء
          <select
            id="cfg-pms"
            value={c.pm_start}
            onChange={(e) => set({ pm_start: e.target.value })}
          >
            {timeList(...TIMING_CHOICES.pm_start_range).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          عدد حصص المساء
          <select
            id="cfg-pmn"
            value={c.pm_count}
            onChange={(e) => set({ pm_count: num(e.target.value) })}
          >
            {TIMING_CHOICES.pm_count.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          الاستراحة بعد الحصة الثانية (دقيقة)
          <select
            id="cfg-brk"
            value={c.break_after_2nd_minutes}
            onChange={(e) => set({ break_after_2nd_minutes: num(e.target.value) })}
          >
            {TIMING_CHOICES.break_after_2nd_minutes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          تجميع ساعات المادة في القسم
          <select
            id="cfg-blk"
            value={c.pairing_mode}
            onChange={(e) => set({ pairing_mode: num(e.target.value) === 1 ? 1 : 2 })}
          >
            <option value={2}>حصص من ساعتين متتاليتين كحد أقصى</option>
            <option value={1}>ساعة واحدة في كل حصة</option>
          </select>
        </label>
      </section>
      <section className="panel">
        <h2>أيام الدراسة</h2>
        <div className="list">
          {c.days.map((mode, d) => (
            <div className="row" style={{ cursor: 'default' }} key={d}>
              <b>{DAY_NAMES_AR[d as SchoolDay]}</b>
              <div className="seg" role="group" aria-label={DAY_NAMES_AR[d as SchoolDay]}>
                {(Object.entries(DAY_MODE_LABELS) as [DayMode, string][]).map(([v, n]) => (
                  <button
                    key={v}
                    aria-pressed={mode === v}
                    onClick={() =>
                      set({ days: c.days.map((x, i) => (i === d ? v : x)) as SchoolConfig['days'] })
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="stats">
          <div className="stat">
            <span>خانات الأسبوع لكل قسم</span>
            <b className="num">{cap}</b>
          </div>
          <div className={`stat${need > cap ? ' bad' : ' ok'}`}>
            <span>الحصص المطلوبة لأكبر قسم</span>
            <b className="num">{need}</b>
          </div>
        </div>
        {need > cap && (
          <div className="banner bad">
            الخانات ({cap}) أقل من الحصص المطلوبة ({need}). زد عدد الحصص أو أيام الدراسة.
          </div>
        )}
        <h3>توقيت الحصص</h3>
        <div className="chips">
          {PR.map((p, i) => (
            <span key={i} className={`tag ${i < c.am_count ? 'acc' : ''}`}>
              {p[0]} - {p[1]}
            </span>
          ))}
        </div>
        <p className="hint">
          أوقات فراغ الأساتذة محفوظة حسب رقم الحصة في اليوم، لذلك راجعها بعد تغيير عدد الحصص.
        </p>
        <div className="toolbar">
          <button className="btn primary" disabled={!changed || busy} onClick={save}>
            {busy ? 'جارٍ الحفظ والتوليد…' : 'حفظ وإعادة توليد الجدول'}
          </button>
          {changed && (
            <button
              className="btn ghost"
              onClick={() => {
                setC(structuredClone(state.school.config));
                setName(meta.name);
              }}
            >
              تراجع
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
