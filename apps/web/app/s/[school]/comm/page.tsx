'use client';

import { audienceCount, validateBroadcast } from '@hissas/shared';
import { useState } from 'react';
import { ParentPreview } from '@/components/life/parent-preview';
import { PanelHead } from '@/components/life/ui';
import { fmtTime, useLife } from '@/lib/life';

/** التواصل مع الأولياء (viewComm) + معاينة تطبيق الولي. */
export default function CommPage() {
  const { life, model, state, notify, cName, toast } = useLife();
  const [C, setC] = useState({ to: 'all', title: '', text: '', dar: '' });
  const send = () => {
    const err = validateBroadcast(C);
    if (err) {
      toast(err);
      return;
    }
    notify({
      class_id: C.to === 'all' ? null : C.to,
      title: C.title.trim(),
      text: C.text.trim(),
      darija: C.dar.trim(),
    });
    const n = audienceCount(life, C.to);
    setC({ to: C.to, title: '', text: '', dar: '' });
    toast(`أُرسلت إلى ${n} وليا`);
  };
  return (
    <>
      <PanelHead
        title="التواصل مع الأولياء"
        sub="رسالة مكتوبة في التطبيق، ورسالة صوتية بالدارجة على واتساب في النسخة الكاملة."
      />
      <div className="grid2">
        <section className="panel">
          <h3>رسالة جديدة</h3>
          <label className="fld">
            إلى
            <select id="cm-to" value={C.to} onChange={(e) => setC({ ...C, to: e.target.value })}>
              <option value="all">كل الأولياء</option>
              {model.school.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  أولياء {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            العنوان
            <input
              type="text"
              id="cm-title"
              value={C.title}
              placeholder="مثال: اجتماع الأولياء"
              onChange={(e) => setC({ ...C, title: e.target.value })}
            />
          </label>
          <label className="fld">
            النص
            <textarea
              id="cm-text"
              rows={3}
              value={C.text}
              onChange={(e) => setC({ ...C, text: e.target.value })}
            />
          </label>
          <label className="fld">
            بالدارجة (للرسالة الصوتية)
            <textarea
              id="cm-dar"
              rows={2}
              value={C.dar}
              placeholder="السلام عليكم، …"
              onChange={(e) => setC({ ...C, dar: e.target.value })}
            />
          </label>
          <button className="btn primary" onClick={send}>
            إرسال
          </button>
        </section>
        <section className="panel">
          <h3>آخر الرسائل</h3>
          <div className="list">
            {state.notices.length ? (
              state.notices.slice(0, 8).map((n) => (
                <div key={n.id} className="card">
                  <time>
                    {fmtTime(n.ts)} · {n.class_id ? `أولياء ${cName(n.class_id)}` : 'كل الأولياء'}
                  </time>
                  <b>{n.title}</b>
                  <span>{n.text}</span>
                </div>
              ))
            ) : (
              <p className="muted">لا توجد رسائل.</p>
            )}
          </div>
        </section>
      </div>
      <ParentPreview />
    </>
  );
}
