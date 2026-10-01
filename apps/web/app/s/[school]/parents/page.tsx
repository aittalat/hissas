'use client';

import { RELATION_LABEL, searchParents, studentName } from '@hissas/shared';
import { ArrowRight, Phone, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useModals } from '@/components/life/modals';
import { usePhoto } from '@/components/life/photo';
import { Avatar, PageHeader, SearchBox } from '@/components/life/ui';
import { useLife } from '@/lib/life';

const PAGE = 60;

/** الأولياء (viewParents): بطاقات، ولوحة جانبية بأبناء الولي. */
export default function ParentsPage() {
  const { life, cName } = useLife();
  const { openStudent } = useModals();
  const photo = usePhoto();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const L = searchParents(life, q);
  const p = open ? life.parents.find((x) => x.id === open) : undefined;
  const kids = (pid: string) => life.students.filter((s) => s.parent_id === pid);
  return (
    <>
      <PageHeader
        icon={UsersRound}
        tone="var(--p-purple)"
        title="الأولياء"
        count={life.parents.length}
      >
        <SearchBox
          value={q}
          placeholder="بحث بالاسم أو الهاتف"
          onChange={(v) => {
            setQ(v);
            setMore(false);
          }}
        />
      </PageHeader>
      <div className={`browse${p ? ' open' : ''}`}>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <div className="wgrid cards">
            {L.slice(0, more ? undefined : PAGE).map((x, i) => {
              const ch = kids(x.id);
              return (
                <button
                  key={x.id}
                  className={`wcard pcard tone-${(i + 1) % 6}`}
                  aria-pressed={open === x.id}
                  onClick={() => setOpen(open === x.id ? null : x.id)}
                >
                  <Avatar name={x.full_name} size={88} ring />
                  <b>{x.full_name}</b>
                  <span className="meta">{RELATION_LABEL[x.relation]}</span>
                  <span className="tag acc">
                    {ch.length} {ch.length > 1 ? 'أبناء' : 'ابن'}
                  </span>
                </button>
              );
            })}
          </div>
          {L.length > PAGE && !more && (
            <button
              className="btn sm ghost"
              style={{ justifySelf: 'center' }}
              onClick={() => setMore(true)}
            >
              عرض الكل ({L.length})
            </button>
          )}
        </div>
        {p && (
          <aside className="detail" aria-label={p.full_name}>
            <button className="icon-btn close" aria-label="إغلاق" onClick={() => setOpen(null)}>
              <ArrowRight aria-hidden />
            </button>
            <Avatar name={p.full_name} size={112} ring />
            <h3>{p.full_name}</h3>
            <p className="status" style={{ color: 'var(--accent)' }}>
              {RELATION_LABEL[p.relation]}
            </p>
            <a className="btn sm" href={`tel:${p.phone}`} dir="ltr">
              <Phone aria-hidden size={15} style={{ verticalAlign: -3 }} /> {p.phone}
            </a>
            <section className="info">
              <header style={{ color: 'var(--ink)' }}>الأبناء</header>
              <div className="list">
                {kids(p.id).map((s) => (
                  <button key={s.id} className="row" onClick={() => openStudent(s.id)}>
                    <span className="toolbar" style={{ flexWrap: 'nowrap' }}>
                      <Avatar name={studentName(s)} gender={s.gender} photo={photo(s)} size={40} />
                      <b>{studentName(s)}</b>
                    </span>
                    <span className="meta">{cName(s.class_id)}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        )}
      </div>
    </>
  );
}
