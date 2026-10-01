'use client';

import {
  DAY_NAMES_AR,
  Occupancy,
  noticeLessonMoved,
  periodTimes,
  targetsFor,
  unitKey,
  type Model,
  type PlacementMap,
  type SchoolDay,
  type Teacher,
} from '@hissas/shared';
import { useState } from 'react';
import { TimetableGrid } from '@/components/timetable/grid';
import { useToast } from '@/components/toast';
import { useSchoolCtx } from '@/lib/school';

/** ساعات الأستاذ هنا، والمحجوزة في مدارس أخرى، والمتاحة (tStats). */
function teacherStats(model: Model, placed: PlacementMap, o: Occupancy, t: Teacher) {
  const { grid } = model;
  const here = model.units.filter((u) => u.teacher_id === t.id && placed.has(u.key)).length;
  const person = model.person(t.person_id);
  const ext = (person?.other_school ?? []).filter(([d, p]) => grid.isValid(d, p)).length;
  let free = 0;
  for (let d = 0; d < 6; d++)
    for (let p = 0; p < grid.periods; p++)
      if (
        grid.isValid(d, p) &&
        !model.isBlocked(t.person_id, d, p) &&
        !o.personAt(t.person_id, d, p)
      )
        free++;
  return { here, ext, free };
}

/** عنصر عشوائي (محاكاة المدرسة الأخرى). */
function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)] as T;
}

interface Request {
  tid: string;
  unit: string;
  day: number;
  period: number;
}

/**
 * شبكة الأساتذة المشتركين (viewNet، SPEC §7.7). محاكاة: المدرسة الأخرى لا تظهر باسمها.
 * لاحقا: الحجز والطلبات عبر الخادم مع عزل المدارس (قاعدة 6 في CLAUDE.md).
 */
export default function NetworkPage() {
  const { state, model, placed, update, notify } = useSchoolCtx();
  const toast = useToast();
  const { school } = state;
  const [picked, setPicked] = useState<string | null>(null);
  const [req, setReq] = useState<Request | null>(null);
  const times = periodTimes(school.config);
  const tl = (p: number) => times[p]?.[0] ?? '--:--';
  const dn = (d: number) => DAY_NAMES_AR[d as SchoolDay];
  const tName = (t: Teacher) => model.person(t.person_id)?.full_name ?? t.id;
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  const sn = (s: string) => school.subjects.find((x) => x.key === s)?.name ?? s;
  const cName = (c: string) => school.classes.find((x) => x.id === c)?.name ?? c;
  const shared = school.teachers.filter((t) => model.person(t.person_id)?.shared);

  if (!shared.length)
    return (
      <section className="panel">
        <h2>شبكة الأساتذة المشتركين</h2>
        <p className="muted">
          لا يوجد أستاذ مشترك. فعّل خيار &quot;يعمل في مدارس أخرى&quot; من تبويب الأساتذة والأقسام.
        </p>
      </section>
    );

  const t = shared.find((x) => x.id === picked) ?? (shared[0] as Teacher);
  const o = Occupancy.from(model, placed);
  const st = teacherStats(model, placed, o, t);
  const log = (text: string) =>
    update((s) => ({ ...s, netLog: [{ ts: Date.now(), text }, ...s.netLog] }));
  /** حجز خانة في مدرسة أخرى للشخص (ext). */
  const book = (d: number, p: number) =>
    update((s) => ({
      ...s,
      school: {
        ...s.school,
        persons: s.school.persons.map((x) =>
          x.id === t.person_id
            ? { ...x, other_school: [...x.other_school, [d, p] as [number, number]] }
            : x,
        ),
      },
    }));

  const simulateBook = () => {
    const fr: [number, number][] = [];
    for (let d = 0; d < 6; d++)
      for (let p = 0; p < model.grid.periods; p++)
        if (
          model.grid.isValid(d, p) &&
          !model.isBlocked(t.person_id, d, p) &&
          !o.personAt(t.person_id, d, p)
        )
          fr.push([d, p]);
    if (!fr.length) {
      toast('لا توجد ساعة فارغة لهذا الأستاذ');
      return;
    }
    const [d, p] = pick(fr);
    book(d, p);
    log(
      `حجزت مدرسة أخرى ${dn(d)} ${tl(p)} عند ${tName(t)}. اختفت هذه الساعة من الأوقات المتاحة لمدرستك.`,
    );
    toast('اختفت الساعة من المتاح فورا');
  };

  const simulateRequest = () => {
    const mine = model.units.filter((u) => u.teacher_id === t.id && placed.has(u.key));
    if (!mine.length) {
      toast('لا توجد حصص لهذا الأستاذ هنا');
      return;
    }
    const u = pick(mine);
    const [day, period] = placed.get(u.key) as [number, number];
    setReq({ tid: t.id, unit: u.key, day, period });
  };

  const request = req && req.tid === t.id ? req : null;
  const ru = request && model.units.find((u) => u.key === request.unit);
  const alts =
    request && ru
      ? [...targetsFor(model, placed, [ru.key])]
          .filter(([, v]) => v.kind === 'move')
          .map(([k]) => k.split('-').map(Number) as [number, number])
          .filter(([d, p]) => !(d === request.day && p === request.period))
          .slice(0, 4)
      : [];

  const accept = (d: number, p: number) => {
    if (!request || !ru) return;
    update((s) => ({
      ...s,
      placements: s.placements.map((x) =>
        unitKey(x.class_id, x.subject, x.index) === ru.key ? { ...x, day: d, period: p } : x,
      ),
      school: {
        ...s.school,
        persons: s.school.persons.map((x) =>
          x.id === t.person_id
            ? {
                ...x,
                other_school: [
                  ...x.other_school,
                  [request.day, request.period] as [number, number],
                ],
              }
            : x,
        ),
      },
    }));
    log(
      `قبول طلب مدرسة أخرى لساعة ${dn(request.day)} ${tl(request.period)}. نُقلت حصة ${sh(ru.subject)} (${cName(ru.class_id)}) إلى ${dn(d)} ${tl(p)}.`,
    );
    notify(
      noticeLessonMoved(
        ru.class_id,
        sh(ru.subject),
        { day: request.day, time: tl(request.period) },
        { day: d, time: tl(p) },
      ),
    );
    setReq(null);
    toast('نُقلت الحصة وأُشعر الأولياء');
  };

  return (
    <div className="split">
      <section className="panel">
        <h2>الأساتذة المشتركون</h2>
        <p className="hint">يدخل الأستاذ أوقاته مرة واحدة، وكل مدرسة ترى فقط ما هو متاح لها.</p>
        <div className="list">
          {shared.map((x) => {
            const s = teacherStats(model, placed, o, x);
            return (
              <button
                key={x.id}
                className="row"
                aria-pressed={x.id === t.id}
                onClick={() => {
                  setPicked(x.id);
                  setReq(null);
                }}
              >
                <span>
                  <b>{tName(x)}</b>
                  <br />
                  <span className="meta">{sn(x.subject)}</span>
                </span>
                <span className="meta num">
                  {s.here} هنا · {s.ext} خارجها
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <header className="toolbar" style={{ justifyContent: 'space-between' }}>
          <h2>{tName(t)}</h2>
          <div className="kv">
            <span>
              ساعات هنا <b>{st.here}</b>
            </span>
            <span>
              محجوزة في مدارس أخرى <b>{st.ext}</b>
            </span>
            <span>
              ما زالت متاحة <b>{st.free}</b>
            </span>
          </div>
        </header>
        <div className="toolbar">
          <button className="btn" onClick={simulateBook}>
            محاكاة: مدرسة أخرى تحجز ساعة فارغة
          </button>
          <button className="btn" onClick={simulateRequest}>
            محاكاة: مدرسة أخرى تطلب ساعة مستعملة هنا
          </button>
        </div>
        {request && ru && (
          <div className="affected">
            <header>
              <h3>طلب من مدرسة أخرى</h3>
              <span className="tag">ينتظر قرارك</span>
            </header>
            <p>
              تطلب مدرسة أخرى ساعة{' '}
              <b>
                {dn(request.day)} {tl(request.period)}
              </b>
              . عند {tName(t)} في هذا الوقت حصة {sh(ru.subject)} مع {cName(ru.class_id)}.
            </p>
            {alts.length ? (
              <>
                <p className="hint">يمكن نقل الحصة هنا إلى أحد هذه الأوقات دون أي تعارض:</p>
                <div className="chips">
                  {alts.map(([d, p]) => (
                    <button key={`${d}-${p}`} className="chip" onClick={() => accept(d, p)}>
                      {dn(d)} {tl(p)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="hint">لا يوجد وقت بديل خال من التعارض.</p>
            )}
            <div className="toolbar">
              <button
                className="btn ghost"
                onClick={() => {
                  log(
                    `رُفض طلب ساعة ${dn(request.day)} ${tl(request.period)}؛ تبقى الحصة في مدرستك.`,
                  );
                  setReq(null);
                }}
              >
                رفض الطلب والإبقاء على الحصة هنا
              </button>
            </div>
          </div>
        )}
        <TimetableGrid model={model} placed={placed} mode="teacher" id={t.id} />
        <div className="legend">
          <span>
            <i className="lg-free" />
            متاح للمدارس
          </span>
          <span>
            <i className="lg-ext" />
            محجوز في مدرسة أخرى (دون اسمها)
          </span>
        </div>
        {state.netLog.length > 0 && (
          <>
            <h3>سجل الشبكة</h3>
            <div className="log">
              {state.netLog.slice(0, 8).map((l, i) => (
                <div key={i}>
                  <time>
                    {new Date(l.ts).toLocaleTimeString('ar-MA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  {l.text}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
