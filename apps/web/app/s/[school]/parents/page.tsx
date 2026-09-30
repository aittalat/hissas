'use client';

import { RELATION_LABEL, searchParents, studentName } from '@hissas/shared';
import { useState } from 'react';
import { useModals } from '@/components/life/modals';
import { Avatar, PanelHead, SearchBox } from '@/components/life/ui';
import { useLife } from '@/lib/life';

/** الأولياء (viewParents). */
export default function ParentsPage() {
  const { life, cName } = useLife();
  const { openStudent } = useModals();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const L = searchParents(life, q);
  const p = open ? life.parents.find((x) => x.id === open) : undefined;
  return (
    <>
      <PanelHead title={`الأولياء (${life.parents.length})`}>
        <SearchBox
          value={q}
          placeholder="بحث بالاسم أو الهاتف"
          onChange={(v) => {
            setQ(v);
            setMore(false);
          }}
        />
      </PanelHead>
      {p && (
        <section className="panel">
          <header className="mhead">
            <div className="toolbar">
              <Avatar name={p.full_name} size={48} />
              <div>
                <h3>{p.full_name}</h3>
                <p className="hint">
                  {RELATION_LABEL[p.relation]} · <span dir="ltr">{p.phone}</span>
                </p>
              </div>
            </div>
            <button className="btn sm ghost" aria-label="إغلاق" onClick={() => setOpen(null)}>
              ✕
            </button>
          </header>
          <div className="list">
            {life.students
              .filter((s) => s.parent_id === p.id)
              .map((s) => (
                <button key={s.id} className="row" onClick={() => openStudent(s.id)}>
                  <span className="toolbar">
                    <Avatar name={studentName(s)} gender={s.gender} size={32} />
                    <b>{studentName(s)}</b>
                  </span>
                  <span className="meta">{cName(s.class_id)}</span>
                </button>
              ))}
          </div>
        </section>
      )}
      <div className="cards">
        {L.slice(0, more ? undefined : 60).map((x) => {
          const n = life.students.filter((s) => s.parent_id === x.id).length;
          return (
            <button
              key={x.id}
              className="pcard"
              onClick={() => {
                setOpen(x.id);
                window.scrollTo(0, 0);
              }}
            >
              <Avatar name={x.full_name} />
              <b>{x.full_name}</b>
              <span className="tag acc">
                {n} {n > 1 ? 'أبناء' : 'ابن'}
              </span>
            </button>
          );
        })}
      </div>
      {L.length > 60 && !more && (
        <button className="btn sm ghost" onClick={() => setMore(true)}>
          عرض الكل ({L.length})
        </button>
      )}
    </>
  );
}
