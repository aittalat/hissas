'use client';

import {
  DAY_NAMES_AR,
  applyAdviceAction,
  advise,
  applyMoves,
  conflictSet,
  diagnose,
  forcedLone,
  loneDays,
  loneProposals,
  metrics,
  noticeHoursChanged,
  noticeLessonMoved,
  periodTimes,
  placementMap,
  quality,
  targetsFor,
  toPlacements,
  type Advice,
  type AdviceOption,
  type LoneProposal,
  type Move,
  type SchoolDay,
} from '@hissas/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EffectTags } from '@/components/timetable/effects';
import { TimetableGrid, timetableTsv } from '@/components/timetable/grid';
import { SolutionsPanel, useSolutions } from '@/components/timetable/solutions';
import { useToast } from '@/components/toast';
import { useSchoolCtx } from '@/lib/school';

const day = (d: number) => DAY_NAMES_AR[d as SchoolDay];

export default function TimetablePage() {
  const ctx = useSchoolCtx();
  const { meta, state, model, placed, update, notify, href } = ctx;
  const toast = useToast();
  const router = useRouter();
  const solutions = useSolutions();
  const { school } = state;
  const [mode, setMode] = useState<'class' | 'teacher'>('class');
  const [pickId, setPickId] = useState<string | null>(null);
  const [sel, setSel] = useState<string[] | null>(null);
  const [advAll, setAdvAll] = useState(false);
  const [fix, setFix] = useState<{ key: string; list: LoneProposal[] } | null>(null);
  const [copy, setCopy] = useState<string | null>(null);

  const times = periodTimes(school.config);
  const tl = (p: number) => times[p]?.[0] ?? '--:--';
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  const cName = (c: string) => school.classes.find((x) => x.id === c)?.name ?? c;
  const tName = (tid: string) => {
    const t = school.teachers.find((x) => x.id === tid);
    return (t && model.person(t.person_id)?.full_name) ?? tid;
  };

  const list =
    mode === 'class'
      ? school.classes.map((c) => ({ id: c.id, n: c.name }))
      : school.teachers.map((t) => ({ id: t.id, n: tName(t.id) }));
  const id = list.some((x) => x.id === pickId) ? (pickId as string) : (list[0]?.id ?? '');

  const conf = useMemo(() => conflictSet(model, placed), [model, placed]);
  const m = useMemo(() => metrics(model, placed), [model, placed]);
  const q = quality(m, conf.size);
  const why = useMemo(() => (m.unplaced ? diagnose(model) : []), [model, m.unplaced]);
  const adv: Advice[] = useMemo(
    () => (solutions.open ? [] : advise(model, placed)),
    [model, placed, solutions.open],
  );
  const lone = useMemo(() => (m.lone ? loneDays(model, placed) : []), [model, placed, m.lone]);
  const targets = useMemo(
    () => (sel && mode === 'class' ? targetsFor(model, placed, sel) : undefined),
    [model, placed, sel, mode],
  );
  const unplaced = model.units.filter((u) => !placed.has(u.key));
  const locked = school.locked_classes.includes(id);

  if (!school.classes.length || !school.teachers.length)
    return (
      <section className="panel">
        <h2>ابدأ بإدخال بيانات {meta.name}</h2>
        <p className="muted">المدرسة جديدة. أدخل الأقسام والأساتذة، ثم ولّد جدول الحصص.</p>
        <div className="list">
          <Link className="row" href={href('/timetable/config')}>
            <span>
              <b>١. توقيت المدرسة</b>
              <br />
              <span className="meta">مدة الحصة، ساعة البداية، أيام الدراسة</span>
            </span>
          </Link>
          <Link className="row" href={href('/timetable/data')}>
            <span>
              <b>٢. الأقسام والأساتذة</b>
              <br />
              <span className="meta">أضف الأقسام، ثم كل أستاذ بأقسامه وساعاته وأوقات فراغه</span>
            </span>
          </Link>
          <Link className="row" href={href('/timetable/io')}>
            <span>
              <b>أو استيراد ملف Excel</b>
              <br />
              <span className="meta">إذا كانت البيانات عندك في جدول</span>
            </span>
          </Link>
        </div>
      </section>
    );

  /** تطبيق جدول جديد (commitPlace): التعويضات التي تمس حصصا منقولة تُلغى. */
  const commit = (next: Map<string, readonly [number, number]> | Map<string, [number, number]>) => {
    const pl = toPlacements(model, next as Map<string, [number, number]>);
    const moved = new Set(
      model.units
        .filter((u) => String(next.get(u.key)) !== String(placed.get(u.key)))
        .map((u) => u.key),
    );
    update((s) => ({
      ...s,
      placements: pl,
      substitutions: s.substitutions.filter(
        (x) => !x.units.some((k) => moved.has(k)) && !(x.swap_unit && moved.has(x.swap_unit)),
      ),
    }));
    setSel(null);
    setFix(null);
  };

  const onCell = (d: number, p: number, g: string[] | null) => {
    if (mode !== 'class') return;
    if (sel && placed.get(sel[0] as string)) {
      const t = targets?.get(`${d}-${p}`);
      const x = placed.get(sel[0] as string) as [number, number];
      if (t) {
        const mv: Move[] = sel.map((unit, k) => ({ unit, day: d, period: p + k }));
        if (t.kind === 'swap')
          mv.push(...t.with.map((unit, k) => ({ unit, day: x[0], period: x[1] + k })));
        const np = applyMoves(model, placed, mv);
        if (np) {
          commit(np);
          toast(t.kind === 'move' ? 'نُقلت الحصة بدون تعارض' : 'بُدّلت الحصتان بدون تعارض');
          return;
        }
      }
      if (g && g.join(',') === sel.join(',')) {
        setSel(null);
        return;
      }
    }
    if (g) setSel(g);
    else if (sel) toast('هذه الخانة تسبب تعارضا، اختر خانة مظللة');
  };

  const runAdvice = (a: Advice, op: AdviceOption) => {
    const act = op.action;
    if (act.kind === 'goto') {
      router.push(
        href(
          act.screen === 'cfg'
            ? '/timetable/config'
            : `/timetable/data${act.teacher_id ? `?t=${act.teacher_id}` : ''}`,
        ),
      );
      return;
    }
    if (act.kind === 'solve') {
      solutions.build(act.deep ? 'بحث أعمق' : 'إصلاح تلقائي للجدول', null, act.deep);
      return;
    }
    if ('regen' in act && act.regen) {
      solutions.build(op.label, act, false);
      return;
    }
    const next = applyAdviceAction({ school: state.school, placements: state.placements }, act);
    update((s) => ({ ...s, school: next.school, placements: next.placements }));
    notify(noticeHoursChanged());
    const msg =
      act.kind === 'move'
        ? 'نُقلت الحصة'
        : act.kind === 'add_hour'
          ? act.slot
            ? 'أُضيفت الساعة في مكانها'
            : 'زادت ساعة'
          : act.kind === 'remove_hour'
            ? 'نقصت ساعة'
            : 'صار الأستاذ متواجدا';
    const nm = metrics(model, placementMap(next.placements));
    toast(`${msg}. الآن: ${nm.gaps} فراغ، ${nm.lone} يوم بساعة واحدة، ${nm.unplaced} بدون مكان`);
    void a;
  };

  const applyFix = (c: LoneProposal) => {
    const np = applyMoves(model, placed, c.moves);
    if (!np) {
      toast('تغيّر الجدول، اعرض الحلول من جديد');
      setFix(null);
      return;
    }
    for (const mv of c.moves) {
      const u = model.units.find((x) => x.key === mv.unit);
      const y = placed.get(mv.unit);
      if (u && y)
        notify(
          noticeLessonMoved(
            u.class_id,
            sh(u.subject),
            { day: y[0], time: tl(y[1]) },
            { day: mv.day, time: tl(mv.period) },
          ),
        );
    }
    commit(np);
    toast('طُبّق الحل، وباقي الجدول بقي كما هو');
  };

  const doCopy = async () => {
    const txt = timetableTsv(model, placed, mode, id);
    try {
      await navigator.clipboard.writeText(txt);
      setCopy(null);
      toast('تم النسخ، الصقه في Excel');
    } catch {
      setCopy(txt);
    }
  };

  const lim = advAll ? adv.length : 4;
  const effAcc = (e: string) => e.startsWith('−') || e === 'يصبح تفادي الساعة الواحدة ممكنا';

  return (
    <>
      {state.dirty && (
        <div className="banner">
          تغيّرت بيانات الأساتذة أو الأقسام بعد آخر توليد. أعد توليد الجدول لتطبيق التغييرات.
        </div>
      )}
      {conf.size > 0 && (
        <div className="banner bad">
          {conf.size} حصص في تعارض (مؤطرة بالأحمر). أعد التوليد أو انقلها يدويا.
        </div>
      )}
      <section className="panel">
        <div className="toolbar">
          <button
            className="btn primary"
            disabled={!!solutions.busy}
            onClick={() => solutions.generate()}
          >
            {solutions.busy === 'generate'
              ? 'جارٍ التوليد… (قد يستغرق حتى 15 ثانية)'
              : 'توليد الجدول تلقائيا'}
          </button>
          <div className="seg" role="group" aria-label="طريقة العرض">
            <button
              aria-pressed={mode === 'class'}
              onClick={() => (setMode('class'), setPickId(null), setSel(null))}
            >
              حسب القسم
            </button>
            <button
              aria-pressed={mode === 'teacher'}
              onClick={() => (setMode('teacher'), setPickId(null), setSel(null))}
            >
              حسب الأستاذ
            </button>
          </div>
          <label>
            <span className="sr">{mode === 'class' ? 'القسم' : 'الأستاذ'}</span>
            <select
              id="tt-id"
              value={id}
              onChange={(e) => (setPickId(e.target.value), setSel(null), setCopy(null))}
            >
              {list.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.n}
                </option>
              ))}
            </select>
          </label>
          {mode === 'class' && (
            <button
              className="btn"
              aria-pressed={locked}
              onClick={() =>
                update((s) => ({
                  ...s,
                  school: {
                    ...s.school,
                    locked_classes: locked
                      ? s.school.locked_classes.filter((c) => c !== id)
                      : [...s.school.locked_classes, id],
                  },
                }))
              }
            >
              {locked ? 'مقفل عند التوليد' : 'قفل هذا القسم'}
            </button>
          )}
          <button className="btn ghost" onClick={doCopy}>
            نسخ إلى Excel
          </button>
        </div>
        <div className="stats">
          <div className="stat">
            <span>جودة الجدول</span>
            <b>
              {q}
              <small> / 100</small>
            </b>
            <div className="meter">
              <i style={{ width: `${q}%` }} />
            </div>
          </div>
          <div className={`stat${m.unplaced ? ' bad' : ' ok'}`}>
            <span>الحصص المبرمجة</span>
            <b className="num">
              {m.placed}
              <small> / {m.total}</small>
            </b>
          </div>
          <div className="stat">
            <span>فراغات بين الحصص (الأقسام)</span>
            <b className="num">{m.gaps}</b>
          </div>
          <div className={`stat${conf.size ? ' bad' : ' ok'}`}>
            <span>تعارضات</span>
            <b className="num">{conf.size}</b>
          </div>
          <div className={`stat${m.lone ? ' bad' : ' ok'}`}>
            <span>أيام يأتي فيها أستاذ لساعة واحدة</span>
            <b className="num">{m.lone}</b>
          </div>
          <div className={`stat${m.tgaps ? ' bad' : ' ok'}`}>
            <span>ساعات فارغة بين حصص الأساتذة</span>
            <b className="num">{m.tgaps}</b>
          </div>
          <div className={`stat${m.split ? ' bad' : ' ok'}`}>
            <span>أيام يأتي فيها أستاذ صباحا ومساء</span>
            <b className="num">{m.split}</b>
          </div>
        </div>
        {school.locked_classes.length > 0 && (
          <div className="chips">
            <span className="hint">مقفلة (تبقى كما هي عند التوليد):</span>
            {school.locked_classes.map((c) => (
              <span key={c} className="tag acc">
                {cName(c)}
              </span>
            ))}
          </div>
        )}
        {unplaced.length > 0 && (
          <div className="banner bad">
            <b>{unplaced.length} حصص بدون مكان.</b>{' '}
            {why.length
              ? `السبب: ${why.join('؛ ')}. عدّل هذه البيانات ثم أعد التوليد.`
              : 'لا يوجد سبب واضح في البيانات: القواعد مجتمعة ضيقة جدا. اضغط "بحث أعمق" في الاقتراحات أسفله.'}
            <div className="chips" style={{ marginTop: 6 }}>
              {unplaced.map((u) => (
                <span key={u.key} className="tag bad">
                  {cName(u.class_id)} · {sh(u.subject)}
                </span>
              ))}
            </div>
          </div>
        )}

        <SolutionsPanel solutions={solutions} />

        {!solutions.open && adv.length > 0 && (
          <div className="affected">
            <header>
              <h3>اقتراحات لتحسين الجدول</h3>
              <span className="tag">{adv.length}</span>
            </header>
            <p className="hint">
              كل اقتراح يوضح أثره قبل التطبيق. تغيير عدد الساعات يجب أن يوافق التوزيع الرسمي للمواد.
            </p>
            <div className="list">
              {adv.slice(0, lim).map((a, i) => (
                <div className="card" key={`${a.kind}-${i}-${a.title}`}>
                  <b>{a.title}</b>
                  <span className="hint">{a.detail}</span>
                  {a.options.map((op, j) => {
                    const act = op.action;
                    const big = act.kind === 'solve' || ('regen' in act && act.regen);
                    return (
                      <div className="adv-op" key={j}>
                        <span>{op.label}</span>
                        {op.effects.length > 0 && (
                          <EffectTags effects={op.effects} accent={effAcc} />
                        )}
                        <div>
                          <button
                            className={`btn sm${j === 0 ? ' primary' : ''}`}
                            disabled={!!solutions.busy}
                            onClick={() => runAdvice(a, op)}
                          >
                            {act.kind === 'goto' ? 'فتح الإعدادات' : big ? 'عرض الحلول' : 'تطبيق'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {adv.length > 4 && (
                <button className="btn sm ghost" onClick={() => setAdvAll(!advAll)}>
                  {advAll ? 'عرض أقل' : `عرض كل الاقتراحات (${adv.length})`}
                </button>
              )}
            </div>
          </div>
        )}

        {m.lone > 0 && !solutions.open && (
          <div className="affected">
            <header>
              <h3>{m.lone} أيام يأتي فيها أستاذ لساعة واحدة</h3>
              <button
                className="btn primary sm"
                disabled={!!solutions.busy}
                onClick={() => solutions.build('إصلاح تلقائي للجدول', null, false)}
              >
                {solutions.busy === 'solutions' ? 'جارٍ البحث عن حلول…' : 'حلول تلقائية'}
              </button>
            </header>
            <p className="hint">
              &quot;حلول تلقائية&quot; يقترح عليك عدة حلول لكل الجدول مع قائمة التغييرات، ولا يطبق
              شيئا قبل اختيارك. أو اعرض الحلول لكل حالة على حدة.
            </p>
            <div className="list">
              {lone.map((ln) => {
                const u = model.units.find((x) => x.key === ln.unit);
                const x = placed.get(ln.unit);
                const k = `${ln.person_id}|${ln.day}`;
                const person = model.person(ln.person_id);
                const open = fix?.key === k;
                if (!u || !x) return null;
                const forced = forcedLone(model, ln.person_id);
                return (
                  <div key={k}>
                    <div className="row" style={{ cursor: 'default' }}>
                      <span>
                        <b>{person?.full_name}</b> · {day(ln.day)}{' '}
                        {forced && <span className="tag">لا يمكن تفاديه</span>}
                        <br />
                        <span className="meta">
                          ساعة واحدة فقط: {sh(u.subject)} مع {cName(u.class_id)} على {tl(x[1])}
                        </span>
                      </span>
                      <button
                        className="btn sm"
                        aria-expanded={open}
                        onClick={() =>
                          setFix(
                            open ? null : { key: k, list: loneProposals(model, placed, ln, 3) },
                          )
                        }
                      >
                        {open ? 'إخفاء' : 'عرض الحلول'}
                      </button>
                    </div>
                    {open && fix && (
                      <>
                        {!fix.list.length && (
                          <p className="hint" style={{ padding: '4px 8px' }}>
                            {forced
                              ? 'لا يمكن تفادي هذه الحالة: ساعات هذا الأستاذ لا يمكن توزيعها على أيام من ساعتين على الأقل، لأن المادة لا تتجاوز ساعتين في اليوم مع نفس القسم. الحلول: غيّر عدد ساعاته، أو أسند له قسما آخر، أو فعّل "متواجد في المدرسة".'
                              : 'لا يوجد حل بتعديل صغير. جرّب "إصلاح تلقائي"، أو أضف أوقات فراغ لهذا الأستاذ.'}
                          </p>
                        )}
                        {fix.list.map((c, i) => (
                          <div className="card" style={{ marginInlineStart: 12 }} key={i}>
                            <b>
                              الحل {i + 1} {i === 0 && <span className="tag acc">الأفضل</span>}
                            </b>
                            {c.moves.map((mv) => {
                              const v = model.units.find((z) => z.key === mv.unit);
                              const y = placed.get(mv.unit);
                              return v && y ? (
                                <span key={mv.unit}>
                                  نقل {sh(v.subject)} ({cName(v.class_id)} · {tName(v.teacher_id)})
                                  من {day(y[0])} {tl(y[1])} إلى {day(mv.day)} {tl(mv.period)}
                                </span>
                              ) : null;
                            })}
                            <LoneEffects before={c.before} after={c.after} />
                            <div>
                              <button className="btn sm primary" onClick={() => applyFix(c)}>
                                تطبيق هذا الحل
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {model.missing.length > 0 && (
          <div className="banner">
            مواد بدون أستاذ:{' '}
            {model.missing.map((x) => `${cName(x.class_id)} / ${sh(x.subject)}`).join('، ')}
          </div>
        )}
        <p className="hint">
          {mode === 'class'
            ? 'الساعتان المتتاليتان لنفس المادة تظهران كحصة واحدة. اضغط على حصة لاختيارها، ثم على خانة مظللة لنقلها أو تبديلها. النظام لا يقترح إلا الخانات الخالية من التعارض.'
            : 'جدول الأستاذ يجمع حصصه هنا وساعاته المحجوزة في مدارس أخرى، دون إظهار اسم تلك المدارس.'}
        </p>
        <TimetableGrid
          model={model}
          placed={placed}
          mode={mode}
          id={id}
          selected={mode === 'class' ? sel : null}
          conflicts={conf}
          targets={targets}
          subs={state.substitutions}
          onCell={onCell}
        />
        <div className="legend">
          <span>
            <i className="lg-free" />
            ساعة فارغة
          </span>
          <span>
            <i className="lg-ext" />
            محجوز في مدرسة أخرى
          </span>
          <span>
            <i className="lg-move" />
            يمكن النقل إليها
          </span>
          <span>
            <i className="lg-swap" />
            يمكن التبديل معها
          </span>
        </div>
        {copy && (
          <div className="panel">
            <p className="hint">
              لم يسمح المتصفح بالنسخ التلقائي. حدّد النص وانسخه يدويا ثم الصقه في Excel.
            </p>
            <textarea id="copybox" readOnly value={copy} />
          </div>
        )}
      </section>
    </>
  );
}

function LoneEffects({
  before,
  after,
}: {
  before: LoneProposal['before'];
  after: LoneProposal['after'];
}) {
  const eff: { t: string; acc: boolean }[] = [];
  const dd = (a: number, b: number, n: string) => {
    if (b > a) eff.push({ t: `+${b - a} ${n}`, acc: false });
    else if (b < a) eff.push({ t: `−${a - b} ${n}`, acc: true });
  };
  dd(before.lone, after.lone, 'ساعة واحدة');
  dd(before.gaps, after.gaps, 'فراغ للأقسام');
  dd(before.tgaps, after.tgaps, 'فراغ للأساتذة');
  dd(before.dups, after.dups, 'ساعة مفصولة عن ساعة نفس المادة');
  return (
    <div className="chips">
      {eff.map((e) => (
        <span key={e.t} className={`tag${e.acc ? ' acc' : ''}`}>
          {e.t}
        </span>
      ))}
    </div>
  );
}
