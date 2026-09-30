'use client';

import {
  addClass,
  addTeacher,
  changeHours,
  changeSubject,
  deleteClass,
  deleteTeacher,
  freeSlots,
  makeGrid,
  quickAvailability,
  renameTeacher,
  setAvailability,
  setTeacherPresent,
  setTeacherShared,
  toggleClassSubject,
  validSlots,
  weeklyCapacity,
  type EditResult,
  type Slot,
  type Teacher,
  type TimetableState,
} from '@hissas/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AvailabilityGrid } from '@/components/data/availability';
import { useToast } from '@/components/toast';
import { demoSchoolState, uid } from '@/lib/demo';
import { useGenerate } from '@/lib/generate';
import { useSchoolCtx } from '@/lib/school';

/** الأساتذة والأقسام (viewData، SPEC §7.4). */
export default function DataPage() {
  return (
    <Suspense>
      <DataScreen />
    </Suspense>
  );
}

function DataScreen() {
  const { meta, state, model, update, href } = useSchoolCtx();
  const toast = useToast();
  const params = useSearchParams();
  const { school } = state;
  const [picked, setPicked] = useState<string | null>(params.get('t'));
  const [confirm, setConfirm] = useState<string | null>(null);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [clsOpen, setClsOpen] = useState<string | null>(null);
  const [addC, setAddC] = useState({ n: '', from: '' });
  const t = school.teachers.find((x) => x.id === picked) ?? school.teachers[0];
  const cap = weeklyCapacity(school.config);
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  const cName = (c: string) => school.classes.find((x) => x.id === c)?.name ?? c;
  const tName = (x: Teacher) => school.persons.find((p) => p.id === x.person_id)?.full_name ?? x.id;
  const person = (x: Teacher) => school.persons.find((p) => p.id === x.person_id);
  const hoursOf = (x: Teacher) => x.classes.reduce((a, c) => a + c.hours, 0);

  /** تطبيق تعديل على البيانات: "تغيّرت البيانات بعد آخر توليد". */
  const edit = (fn: (s: TimetableState) => EditResult, ok?: string, dirty = true) => {
    const r = fn({ school: state.school, placements: state.placements });
    if (!r.ok) {
      toast(r.error);
      return null;
    }
    update((s) => ({
      ...s,
      school: r.state.school,
      placements: r.state.placements,
      dirty: dirty || s.dirty,
    }));
    if (ok) toast(ok);
    return r;
  };

  const classesPanel = (
    <section className="panel">
      <h2>الأقسام</h2>
      <div className="list">
        {school.classes.map((c) => {
          const n = model.units.filter((u) => u.class_id === c.id).length;
          return (
            <div key={c.id}>
              <div className="row" style={{ cursor: 'default' }}>
                <span>
                  <b>{c.name}</b>
                  <br />
                  <span className="meta num">
                    {n} حصة في الأسبوع · {c.subjects.length} مواد{n > cap ? ' · يفوق الخانات' : ''}
                  </span>
                </span>
                <span className="toolbar">
                  <button
                    className="btn sm ghost"
                    aria-expanded={clsOpen === c.id}
                    onClick={() => setClsOpen(clsOpen === c.id ? null : c.id)}
                  >
                    المواد
                  </button>
                  {confirm === `cls:${c.id}` ? (
                    <span className="toolbar">
                      <button
                        className="btn sm danger"
                        onClick={() => {
                          edit((s) => deleteClass(s, c.id), 'حُذف القسم');
                          update((s) => ({
                            ...s,
                            substitutions: s.substitutions.filter((x) => x.class_id !== c.id),
                          }));
                          setConfirm(null);
                        }}
                      >
                        تأكيد الحذف
                      </button>
                      <button className="btn sm ghost" onClick={() => setConfirm(null)}>
                        تراجع
                      </button>
                    </span>
                  ) : (
                    <button
                      className="btn sm ghost"
                      aria-label={`حذف ${c.name}`}
                      onClick={() => setConfirm(`cls:${c.id}`)}
                    >
                      حذف
                    </button>
                  )}
                </span>
              </div>
              {clsOpen === c.id && (
                <div className="chips" style={{ padding: '4px 4px 8px' }}>
                  {school.subjects.map((s) => (
                    <button
                      key={s.key}
                      className="chip"
                      aria-pressed={c.subjects.includes(s.key)}
                      onClick={() => edit((st) => toggleClassSubject(st, c.id, s.key))}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <h3>إضافة قسم</h3>
      <label className="fld">
        اسم القسم
        <input
          type="text"
          id="addc-n"
          value={addC.n}
          onChange={(e) => setAddC({ ...addC, n: e.target.value })}
          placeholder="مثال: 2AC-C"
          dir="ltr"
        />
      </label>
      <label className="fld">
        نفس أساتذة وساعات قسم
        <select
          id="addc-from"
          value={addC.from}
          onChange={(e) => setAddC({ ...addC, from: e.target.value })}
        >
          <option value="">بدون، سأحدد الأساتذة لاحقا</option>
          {school.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn"
        onClick={() => {
          if (
            edit(
              (s) => addClass(s, addC.n, addC.from || undefined),
              'أُضيف القسم. أعد توليد الجدول.',
            )
          )
            setAddC({ n: '', from: '' });
        }}
      >
        إضافة القسم
      </button>
    </section>
  );

  return (
    <div className="split">
      <div style={{ display: 'grid', gap: 16 }}>
        <section className="panel">
          <header className="toolbar" style={{ justifyContent: 'space-between' }}>
            <h2>الأساتذة</h2>
            <button className="btn primary sm" onClick={() => setWizard(newWizard(school))}>
              + إضافة أستاذ
            </button>
          </header>
          <div className="tt-wrap" style={{ border: 0 }}>
            <table className="plain">
              <thead>
                <tr>
                  <th>الأستاذ</th>
                  <th>المادة</th>
                  <th>الساعات</th>
                </tr>
              </thead>
              <tbody>
                {school.teachers.map((x) => {
                  const p = person(x);
                  const over = hoursOf(x) > freeSlots(model, x.person_id);
                  const choose = () => {
                    setPicked(x.id);
                    setConfirm(null);
                    setWizard(null);
                  };
                  return (
                    <tr
                      key={x.id}
                      className={x.id === t?.id ? 'on' : ''}
                      tabIndex={0}
                      onClick={choose}
                      onKeyDown={(e) => e.key === 'Enter' && choose()}
                    >
                      <td>
                        {tName(x)} {p?.present && <span className="tag acc">متواجد</span>}{' '}
                        {p?.shared && <span className="tag acc">مشترك</span>}
                        <br />
                        <span className="hint">
                          {x.classes.map((c) => `${cName(c.class_id)}: ${c.hours} س`).join(' · ') ||
                            'بدون أقسام'}
                        </span>
                      </td>
                      <td>{sh(x.subject)}</td>
                      <td className="num">
                        {hoursOf(x)} {over && <span className="tag bad">يفوق المتاح</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {classesPanel}
        <section className="panel">
          <h3>البيانات التجريبية</h3>
          <div className="toolbar">
            {confirm === 'reset' ? (
              <>
                <button
                  className="btn danger"
                  onClick={() => {
                    update(() => demoSchoolState(meta.name));
                    setConfirm(null);
                    setPicked(null);
                    toast('رجعت البيانات التجريبية');
                  }}
                >
                  تأكيد: حذف كل تغييراتي
                </button>
                <button className="btn ghost" onClick={() => setConfirm(null)}>
                  تراجع
                </button>
              </>
            ) : (
              <button className="btn ghost" onClick={() => setConfirm('reset')}>
                استرجاع البيانات التجريبية
              </button>
            )}
          </div>
        </section>
      </div>
      <section className="panel">
        {wizard ? (
          <Wizard
            state={wizard}
            setState={setWizard}
            onSave={(w) => {
              const tid = `t${uid()}`;
              const r = edit((s) =>
                addTeacher(
                  s,
                  { name: w.n, subject: w.s, classes: w.cls, present: w.present, free: w.free },
                  { teacher_id: tid, person_id: tid },
                ),
              );
              if (r) {
                setPicked(tid);
                setWizard({ ...w, done: tid });
                toast('أُضيف الأستاذ');
              }
            }}
            timetableHref={href('/timetable')}
            onClose={() => setWizard(null)}
          />
        ) : t ? (
          <TeacherEditor
            key={t.id}
            t={t}
            confirm={confirm}
            setConfirm={setConfirm}
            edit={edit}
            onDeleted={() => {
              setPicked(null);
              setConfirm(null);
            }}
          />
        ) : (
          <p className="muted">لا يوجد أساتذة بعد. أضف أول أستاذ.</p>
        )}
        {model.missing.length > 0 && (
          <div className="banner">
            مواد بدون أستاذ:{' '}
            {model.missing.map((x) => `${cName(x.class_id)} / ${sh(x.subject)}`).join('، ')}
          </div>
        )}
      </section>
    </div>
  );
}

type Edit = (
  fn: (s: TimetableState) => EditResult,
  ok?: string,
  dirty?: boolean,
) => EditResult | null;

function TeacherEditor({
  t,
  confirm,
  setConfirm,
  edit,
  onDeleted,
}: {
  t: Teacher;
  confirm: string | null;
  setConfirm: (c: string | null) => void;
  edit: Edit;
  onDeleted: () => void;
}) {
  const { state, model } = useSchoolCtx();
  const { school } = state;
  const p = school.persons.find((x) => x.id === t.person_id);
  const [name, setName] = useState(p?.full_name ?? '');
  const hours = t.classes.reduce((a, c) => a + c.hours, 0);
  const has = (list: Slot[] | undefined, d: number, q: number) =>
    !!list?.some(([a, b]) => a === d && b === q);
  return (
    <>
      <h2>{p?.full_name}</h2>
      <label className="fld">
        الاسم
        <input
          type="text"
          id="ed-n"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => edit((s) => renameTeacher(s, t.id, name), undefined, false)}
        />
      </label>
      <label className="fld">
        المادة
        <select
          id="ed-s"
          value={t.subject}
          onChange={(e) => edit((s) => changeSubject(s, t.id, e.target.value))}
        >
          {school.subjects.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="fld">
        الساعات الأسبوعية في كل قسم
        <p className="hint">
          صفر يعني أن الأستاذ لا يدرّس هذا القسم. إذا أضفت قسما يدرّسه أستاذ آخر لنفس المادة، ينتقل
          إليه.
        </p>
        <div className="list">
          {school.classes.map((c) => {
            const cur = t.classes.find((x) => x.class_id === c.id);
            const n = cur?.hours ?? 0;
            const other =
              !cur &&
              school.teachers.find(
                (x) =>
                  x.id !== t.id &&
                  x.subject === t.subject &&
                  x.classes.some((y) => y.class_id === c.id),
              );
            return (
              <div
                key={c.id}
                className={`row hrow${cur ? ' on' : ''}`}
                style={{ cursor: 'default' }}
              >
                <span>
                  <b>{c.name}</b>
                  {other && (
                    <>
                      <br />
                      <span className="meta">
                        يدرّسه الآن{' '}
                        {school.persons.find((x) => x.id === other.person_id)?.full_name}
                      </span>
                    </>
                  )}
                </span>
                <span className="step" role="group" aria-label={`ساعات ${c.name}`}>
                  <button
                    className="btn sm"
                    aria-label="إنقاص"
                    disabled={!n}
                    onClick={() => edit((s) => changeHours(s, t.id, c.id, -1))}
                  >
                    −
                  </button>
                  <b className="num">{n} س</b>
                  <button
                    className="btn sm"
                    aria-label="زيادة"
                    disabled={n >= 8}
                    onClick={() => edit((s) => changeHours(s, t.id, c.id, 1))}
                  >
                    +
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <label className="opt" style={{ paddingInline: 0 }}>
        <input
          type="checkbox"
          id="ed-pr"
          checked={!!p?.present}
          onChange={(e) => edit((s) => setTeacherPresent(s, t.id, e.target.checked))}
        />
        <span>
          <b>متواجد في المدرسة طول اليوم</b>
          <br />
          <span className="hint">
            {p?.present
              ? 'يمكن أن تكون ساعاته متفرقة عند الضرورة.'
              : 'لا يُستدعى لساعة واحدة، وساعاته في اليوم متتالية بدون فراغ، ومجموعة إما صباحا أو مساء.'}
          </span>
        </span>
      </label>
      <label className="opt" style={{ paddingInline: 0 }}>
        <input
          type="checkbox"
          id="ed-sh"
          checked={!!p?.shared}
          onChange={(e) => edit((s) => setTeacherShared(s, t.id, e.target.checked))}
        />
        <span>يعمل أيضا في مدارس أخرى (عضو في شبكة الأساتذة)</span>
      </label>
      <div className="kv">
        <span>
          ساعات مطلوبة <b>{hours}</b>
        </span>
        <span>
          ساعات متاحة <b>{freeSlots(model, t.person_id)}</b>
        </span>
      </div>
      <h3>أوقات الفراغ</h3>
      <AvailabilityGrid
        config={school.config}
        isFree={(d, q) => !has(p?.unavailable, d, q) && !has(p?.other_school, d, q)}
        isExt={(d, q) => has(p?.other_school, d, q)}
        onToggle={(slots, on) => edit((s) => setAvailability(s, t.id, slots, on))}
        onQuick={(mode) => edit((s) => quickAvailability(s, t.id, mode))}
      />
      <div className="toolbar">
        {confirm === `del:${t.id}` ? (
          <>
            <button
              className="btn danger"
              onClick={() => {
                if (edit((s) => deleteTeacher(s, t.id), 'حُذف الأستاذ')) onDeleted();
              }}
            >
              تأكيد حذف {p?.full_name}
            </button>
            <button className="btn ghost" onClick={() => setConfirm(null)}>
              تراجع
            </button>
          </>
        ) : (
          <button className="btn ghost danger" onClick={() => setConfirm(`del:${t.id}`)}>
            حذف الأستاذ
          </button>
        )}
      </div>
    </>
  );
}

interface WizardState {
  n: string;
  s: string;
  /** القسم ← الساعات. */
  cls: Record<string, number>;
  present: boolean;
  free: Slot[];
  done: string | null;
}

function newWizard(school: TimetableState['school'], n = '', s?: string): WizardState {
  return {
    n,
    s: s ?? school.subjects[0]?.key ?? 'ar',
    cls: {},
    present: false,
    free: validSlots(school),
    done: null,
  };
}

/** معالج "إضافة أستاذ" بخمس خطوات (viewNewTeacher). */
function Wizard({
  state: N,
  setState,
  onSave,
  onClose,
  timetableHref,
}: {
  state: WizardState;
  setState: (w: WizardState | null) => void;
  onSave: (w: WizardState) => void;
  onClose: () => void;
  timetableHref: string;
}) {
  const { state, model } = useSchoolCtx();
  const { generate, busy } = useGenerate();
  const router = useRouter();
  const { school } = state;
  const def = (s: string) => school.subjects.find((x) => x.key === s)?.default_hours ?? 2;
  const nameOf = (tid: string) => {
    const t = school.teachers.find((x) => x.id === tid);
    return (t && school.persons.find((p) => p.id === t.person_id)?.full_name) ?? '';
  };
  if (N.done) {
    const t = school.teachers.find((x) => x.id === N.done);
    return (
      <>
        <h2>تمت إضافة {nameOf(N.done)}</h2>
        <p className="hint">أُضيف الأستاذ بساعاته وأوقات فراغه. ماذا تريد الآن؟</p>
        <div className="list">
          <button className="row" onClick={() => setState(newWizard(school))}>
            إضافة أستاذ آخر
          </button>
          <button
            className="row"
            onClick={() =>
              setState(
                newWizard(school, nameOf(N.done as string), t?.subject === 'ar' ? 'fr' : 'ar'),
              )
            }
          >
            إضافة مادة أخرى لنفس الأستاذ
          </button>
          <button
            className="row"
            disabled={busy}
            onClick={() => {
              void generate().then(() => router.push(timetableHref));
            }}
          >
            {busy ? 'جار التوليد…' : 'توليد الجدول الآن'}
          </button>
          <button className="row" onClick={onClose}>
            الرجوع إلى لائحة الأساتذة
          </button>
        </div>
      </>
    );
  }
  const persons = school.persons.filter((p) => school.teachers.some((t) => t.person_id === p.id));
  const same = persons.find((p) => p.full_name.trim() === N.n.trim());
  const sameRec = same && school.teachers.find((t) => t.person_id === same.id);
  const need = Object.values(N.cls).reduce((a, h) => a + h, 0);
  const avail = same ? freeSlots(model, same.id) : N.free.length;
  const g = makeGrid(school.config);
  const freeSet = new Set(N.free.map(([d, p]) => `${d}-${p}`));
  const setFree = (slots: Slot[], on: boolean) => {
    const f = new Set(freeSet);
    for (const [d, p] of slots) {
      if (on) f.add(`${d}-${p}`);
      else f.delete(`${d}-${p}`);
    }
    setState({ ...N, free: [...f].map((k) => k.split('-').map(Number) as Slot) });
  };
  return (
    <>
      <header className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h2>إضافة أستاذ</h2>
        <button className="btn sm ghost" onClick={onClose}>
          إلغاء
        </button>
      </header>
      <label className="fld">
        ١. الاسم
        <input
          type="text"
          id="nt-n"
          list="nt-names"
          value={N.n}
          placeholder="أ. الاسم الكامل"
          onChange={(e) => setState({ ...N, n: e.target.value })}
        />
        <datalist id="nt-names">
          {persons.map((p) => (
            <option key={p.id} value={p.full_name} />
          ))}
        </datalist>
      </label>
      {same && sameRec && (
        <p className="hint">
          هذا الاسم موجود ({school.subjects.find((s) => s.key === sameRec.subject)?.short}). سيُضاف
          كمادة أخرى لنفس الأستاذ، وتُستعمل نفس أوقات فراغه.
        </p>
      )}
      <label className="fld">
        ٢. المادة
        <select
          id="nt-s"
          value={N.s}
          onChange={(e) => {
            const s = e.target.value;
            setState({
              ...N,
              s,
              cls: Object.fromEntries(Object.keys(N.cls).map((c) => [c, def(s)])),
            });
          }}
        >
          {school.subjects.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="fld">
        ٣. الأقسام وعدد الساعات في الأسبوع
        <div className="list">
          {school.classes.map((c) => {
            const on = N.cls[c.id] != null;
            const other = school.teachers.find(
              (x) => x.subject === N.s && x.classes.some((y) => y.class_id === c.id),
            );
            return (
              <div
                key={c.id}
                className={`row hrow${on ? ' on' : ''}`}
                style={{ cursor: 'default' }}
              >
                <label className="opt" style={{ padding: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const cls = { ...N.cls };
                      if (e.target.checked) cls[c.id] = def(N.s);
                      else delete cls[c.id];
                      setState({ ...N, cls });
                    }}
                  />
                  <span>
                    <b>{c.name}</b>
                    {other && (
                      <>
                        <br />
                        <span className="meta">
                          يدرّسه الآن {nameOf(other.id)}، وسينتقل للأستاذ الجديد
                        </span>
                      </>
                    )}
                    {!c.subjects.includes(N.s) && (
                      <>
                        <br />
                        <span className="meta">هذه المادة غير مفعّلة في القسم، وستُضاف</span>
                      </>
                    )}
                  </span>
                </label>
                {on && (
                  <label className="nt-h">
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={N.cls[c.id]}
                      aria-label={`ساعات ${c.name}`}
                      onChange={(e) =>
                        setState({
                          ...N,
                          cls: {
                            ...N.cls,
                            [c.id]: Math.max(
                              1,
                              Math.min(8, Math.round(Number(e.target.value)) || 1),
                            ),
                          },
                        })
                      }
                    />{' '}
                    س
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <label className="opt" style={{ paddingInline: 0 }}>
        <input
          type="checkbox"
          id="nt-pr"
          checked={N.present}
          onChange={(e) => setState({ ...N, present: e.target.checked })}
        />
        <span>
          <b>٤. متواجد في المدرسة طول اليوم</b>
          <br />
          <span className="hint">
            إذا لم يكن متواجدا: يأتي إما صباحا أو مساء، بساعتين متتاليتين على الأقل وبدون فراغ.
          </span>
        </span>
      </label>
      <div className="fld">٥. أوقات الفراغ{same ? ' (مشتركة مع مادته الأخرى)' : ''}</div>
      {same ? (
        <p className="hint">
          تُستعمل أوقات فراغ {same.full_name} الحالية. يمكنك تعديلها بعد الحفظ.
        </p>
      ) : (
        <AvailabilityGrid
          config={school.config}
          isFree={(d, p) => freeSet.has(`${d}-${p}`)}
          isExt={() => false}
          onToggle={setFree}
          onQuick={(mode) => {
            const all = validSlots(school);
            setState({
              ...N,
              free:
                mode === 'none'
                  ? []
                  : all.filter(
                      ([, p]) =>
                        mode === 'all' || (mode === 'am' ? g.halfOf(p) === 0 : g.halfOf(p) === 1),
                    ),
            });
          }}
        />
      )}
      <div className="kv">
        <span>
          الساعات المطلوبة <b>{need}</b>
        </span>
        <span>
          الساعات المتاحة <b>{avail}</b>
        </span>
      </div>
      {need > avail && <div className="banner bad">الساعات المطلوبة أكثر من الساعات المتاحة.</div>}
      <div className="toolbar">
        <button className="btn primary" onClick={() => onSave(N)}>
          حفظ الأستاذ
        </button>
      </div>
    </>
  );
}
