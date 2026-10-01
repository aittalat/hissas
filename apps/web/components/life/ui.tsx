'use client';

/* eslint-disable @next/next/no-img-element -- الصور روابط data أو روابط S3 موقّعة */
import { hueOf, initials } from '@hissas/shared';
import { LayoutGrid, List, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** درجات الباستيل للبطاقات (tone-0 … tone-5). */
export const TONES = 6;
export const toneOf = (key: string) => `tone-${hueOf(key) % TONES}`;

/**
 * رأس الصفحة: أيقونة على خلفية باستيل، العنوان والعدد، تبويبات حبوب (?tab=)، وأدوات
 * (تحميل، بحث، تصفية، طريقة العرض).
 */
export function PageHeader<K extends string>({
  icon: Icon,
  tone = 'var(--p-yellow)',
  title,
  count,
  sub,
  nav,
  tabs,
  current,
  children,
}: {
  icon: LucideIcon;
  tone?: string;
  title: string;
  count?: number;
  sub?: string;
  /** تبويبات بمسارات (جدول الحصص) بدل ?tab=. */
  nav?: ReactNode;
  tabs?: readonly (readonly [K, string])[];
  current?: K;
  children?: ReactNode;
}) {
  const path = usePathname();
  return (
    <header className="phead">
      <span className="phead-ic" style={{ '--tone': tone } as CSSProperties}>
        <Icon aria-hidden />
      </span>
      <div className="phead-main">
        <h2>
          {title} {count !== undefined && <small className="num">({count})</small>}
        </h2>
        {sub && <p className="hint">{sub}</p>}
        {nav}
        {tabs && (
          <nav className="pills subtabs" aria-label={title}>
            {tabs.map(([k, n], i) => (
              <Link
                key={k}
                className="pill"
                href={i === 0 ? path : `${path}?tab=${k}`}
                aria-pressed={current === k}
                replace
              >
                {n}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {children && <div className="phead-tools">{children}</div>}
    </header>
  );
}

/** التبويب الفرعي من ?tab= (UI.sub): روابط قابلة للمشاركة، مثل "تسجيل الغياب" من لوحة اليوم. */
export function useSubTab<K extends string>(items: readonly (readonly [K, string])[]): K {
  const v = useSearchParams().get('tab');
  return (items.find(([k]) => k === v)?.[0] ?? items[0]?.[0]) as K;
}

/**
 * صورة الشخص: الصورة إن وُجدت، وإلا الحروف الأولى على تدرّج لوني ثابت من الاسم.
 * ring: إطار أبيض وظل (بطاقات التلاميذ ولوحة التفاصيل).
 */
export function Avatar({
  name,
  gender,
  photo,
  size = 56,
  ring = false,
}: {
  name: string;
  gender?: 'm' | 'f' | null;
  photo?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const h = gender === 'f' ? 330 : gender === 'm' ? 205 : hueOf(name);
  const cls = `ph${photo ? ' pic' : ''}${ring ? ' ring' : ''}`;
  return (
    <span
      className={cls}
      style={{ width: size, height: size, fontSize: size * 0.34, '--h': h } as CSSProperties}
    >
      {photo ? <img src={photo} alt="" /> : initials(name)}
    </span>
  );
}

/** بحث (searchBox) مع اختيار الحقل اختياريا. */
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
    <label className="search">
      <Search aria-hidden />
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
    <label className="fld">
      القسم
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

/** إغلاق قائمة منبثقة عند النقر خارجها أو Escape. */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/** زر "تصفية حسب" بقائمة منبثقة. active: عدد المرشحات المفعّلة. */
export function FilterPop({ active = 0, children }: { active?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div className="pop" ref={ref}>
      <button className="soft-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <SlidersHorizontal aria-hidden />
        تصفية حسب{active ? ` (${active})` : ''}
      </button>
      {open && <div className="menu">{children}</div>}
    </div>
  );
}

export type ViewMode = 'grid' | 'list';

/** بطاقات أو لائحة. */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="طريقة العرض">
      <button aria-pressed={value === 'grid'} aria-label="بطاقات" onClick={() => onChange('grid')}>
        <LayoutGrid aria-hidden />
      </button>
      <button aria-pressed={value === 'list'} aria-label="لائحة" onClick={() => onChange('list')}>
        <List aria-hidden />
      </button>
    </div>
  );
}
