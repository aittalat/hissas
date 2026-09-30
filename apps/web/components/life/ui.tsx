'use client';

import { avatarHue, initials } from '@hissas/shared';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

/** رأس الشاشة (panelHead): العنوان، سطر وصف، وأزرار. */
export function PanelHead({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mhead">
      <div>
        <h2>{title}</h2>
        {sub && <p className="hint">{sub}</p>}
      </div>
      <div className="toolbar">{children}</div>
    </header>
  );
}

/** التبويب الفرعي من ?tab= (UI.sub): روابط قابلة للمشاركة، مثل "تسجيل الغياب" من لوحة اليوم. */
export function useSubTab<K extends string>(items: readonly (readonly [K, string])[]): K {
  const v = useSearchParams().get('tab');
  return (items.find(([k]) => k === v)?.[0] ?? items[0]?.[0]) as K;
}

export function SubTabs<K extends string>({
  items,
  current,
}: {
  items: readonly (readonly [K, string])[];
  current: K;
}) {
  const path = usePathname();
  return (
    <div className="chips subtabs">
      {items.map(([k, n], i) => (
        <Link
          key={k}
          className="chip"
          href={i === 0 ? path : `${path}?tab=${k}`}
          aria-pressed={current === k}
          replace
        >
          {n}
        </Link>
      ))}
    </div>
  );
}

/** صورة رمزية بالحروف الأولى (avatar): أزرق للذكور، وردي للإناث، ولون من الاسم للأولياء. */
export function Avatar({
  name,
  gender,
  size = 56,
}: {
  name: string;
  gender?: 'm' | 'f' | null;
  size?: number;
}) {
  return (
    <span
      className="av"
      style={
        {
          width: size,
          height: size,
          fontSize: size * 0.36,
          '--h': avatarHue(name, gender),
        } as CSSProperties
      }
    >
      {initials(name)}
    </span>
  );
}

/** بحث بالاسم (searchBox). */
export function SearchBox({
  value,
  onChange,
  placeholder = 'بحث بالاسم',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="sr">{placeholder}</span>
      <input
        type="search"
        id="f-q"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** تصفية بالقسم (clsFilter). */
export function ClassFilter({
  classes,
  value,
  onChange,
}: {
  classes: readonly { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span className="sr">القسم</span>
      <select id="f-cls" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">كل الأقسام</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
