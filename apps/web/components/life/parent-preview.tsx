'use client';

import { DAY_NAMES_AR, parentDay, type SchoolDay } from '@hissas/shared';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { fmtTime, todayISO, useLife } from '@/lib/life';

/** أسماء افتراضية عندما لا يوجد تلاميذ (STUN). */
const STUN = ['ياسين', 'مريم', 'زكرياء', 'آدم', 'سارة', 'هبة', 'يوسف', 'إيناس'];

/** معاينة تطبيق الولي (viewParent، SPEC §7.9): تلميذ لكل قسم، يومه، والإشعارات. */
export function ParentPreview() {
  const { meta, life, model, placed, state, cName, toast } = useLife();
  const { school, grid } = model;
  const SL = life.students.length
    ? school.classes
        .map((c) => life.students.find((s) => s.class_id === c.id && s.status === 'active'))
        .filter((s) => !!s)
        .map((s) => ({ n: s.first_name, c: s.class_id, sid: s.id as string | null }))
    : school.classes
        .slice(0, 8)
        .map((c, i) => ({ n: STUN[i % STUN.length] as string, c: c.id, sid: null }));
  const active = grid.activeDays;
  const [stu, setStu] = useState(0);
  const [day, setDay] = useState(() => {
    const g = new Date(`${todayISO()}T12:00`).getDay();
    const d = g === 0 ? -1 : g - 1;
    return active.includes(d) ? d : (active[0] ?? 0);
  });
  const st = SL[stu] ?? SL[0];
  const d = active.includes(day) ? day : (active[0] ?? 0);
  const hue = (short: string) => school.subjects.find((s) => s.short === short)?.hue ?? 150;
  const items = st ? parentDay(model, placed, st.c, d, state.substitutions) : [];
  const les = (subject: string, sub: ReactNode, extra?: ReactNode, x = false) => (
    <div className={`les${x ? ' x' : ''}`} style={{ '--h': hue(subject) } as CSSProperties}>
      <b>{subject}</b>
      {sub}
      {extra}
    </div>
  );
  const play = (text: string) => {
    try {
      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = 'ar-MA';
      speechSynthesis.cancel();
      speechSynthesis.speak(ut);
    } catch {
      /* المتصفح لا يدعم القراءة الصوتية */
    }
    toast('معاينة تقريبية بصوت المتصفح؛ الصوت الطبيعي بالدارجة في النسخة الكاملة');
  };
  const msgs = st?.sid ? state.messages.filter((m) => m.student_id === st.sid).slice(0, 3) : [];
  const notes = st
    ? state.notices.filter((n) => n.class_id === null || n.class_id === st.c).slice(0, 5)
    : [];
  return (
    <div className="grid2">
      <section className="panel">
        <h2>معاينة تطبيق الولي</h2>
        <p className="hint">
          اختر تلميذا ويوما. التغييرات التي تعتمدها في تبويب الغياب تظهر هنا مباشرة.
        </p>
        <div className="chips">
          {SL.map((s, i) => (
            <button key={s.c} className="chip" aria-pressed={i === stu} onClick={() => setStu(i)}>
              {s.n} · {cName(s.c)}
            </button>
          ))}
        </div>
        <p className="hint">
          في النسخة الكاملة: تطبيق Android وiOS، ورسائل واتساب رسمية، ومقاطع صوتية طبيعية بالدارجة.
        </p>
      </section>
      <div className="phone" aria-label="شاشة الهاتف">
        <div className="scr">
          <div className="hi">
            <span className="toolbar" style={{ gap: 8 }}>
              <Logo name={meta.name} color={meta.color} logo={meta.logo} size={28} />
              <span className="muted" style={{ fontSize: 12.5 }}>
                {school.name}
              </span>
            </span>
            <b>{st ? `${st.n} · ${cName(st.c)}` : ''}</b>
          </div>
          <div className="chips">
            {active.map((i) => (
              <button key={i} className="chip" aria-pressed={i === d} onClick={() => setDay(i)}>
                {DAY_NAMES_AR[i as SchoolDay]}
              </button>
            ))}
          </div>
          <div className="tl">
            {items.map((it) => (
              <div key={it.start} className="tl-it">
                <time>
                  {it.start}
                  {'end' in it && it.end && (
                    <>
                      <br />
                      {it.end}
                    </>
                  )}
                </time>
                {it.kind === 'moved_out' ? (
                  <div className="emp">فارغة: قُدّمت هذه الحصة إلى {it.to}</div>
                ) : it.kind === 'lesson' ? (
                  les(it.subject, <small>{it.teacher}</small>)
                ) : it.kind === 'same' ? (
                  les(it.subject, <small>{it.teacher}</small>, <span className="tag">تعويض</span>)
                ) : it.kind === 'review' ? (
                  <div className="les" style={{ '--h': hue(it.subject) } as CSSProperties}>
                    <b>حصة مراجعة</b>
                    <small>
                      بدل {it.subject} · {it.teacher}
                    </small>
                    <span className="tag">تغيير</span>
                  </div>
                ) : it.kind === 'swap' ? (
                  les(
                    it.subject,
                    <small>{it.teacher}</small>,
                    <span className="tag">مُقدَّمة</span>,
                  )
                ) : (
                  les(it.subject, null, <span className="tag bad">ملغاة</span>, true)
                )}
              </div>
            ))}
            {!items.length && (
              <p className="muted" style={{ textAlign: 'center' }}>
                لا توجد حصص في هذا اليوم.
              </p>
            )}
          </div>
          <h3 style={{ fontSize: 14 }}>الإشعارات</h3>
          {msgs.map((m) => (
            <div key={m.id} className="card">
              <time>{fmtTime(m.ts)}</time>
              <b>رسالة من الحراسة العامة</b>
              <span>{m.text}</span>
              {m.darija && <span className="darija">بالدارجة: {m.darija}</span>}
            </div>
          ))}
          {notes.map((n) => (
            <div key={n.id} className="card">
              <time>{fmtTime(n.ts)}</time>
              <b>{n.title}</b>
              <span>{n.text}</span>
              {n.darija && (
                <>
                  <div className="voice">
                    <button aria-label="استماع للرسالة الصوتية" onClick={() => play(n.darija)}>
                      ▶
                    </button>
                    <div className="wave" />
                    <span>0:0{Math.min(9, 3 + Math.round(n.darija.length / 40))}</span>
                  </div>
                  <span className="darija">بالدارجة: {n.darija}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
