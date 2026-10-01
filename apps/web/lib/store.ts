'use client';

import { useSyncExternalStore } from 'react';
import { demoMeta, demoSchoolState } from './demo';
import type { PlatformState, SchoolMeta, SchoolState } from './types';

/**
 * مخزن المنصة في المتصفح (مثل النموذج الأولي: localStorage). كل تعديل يمر عبر update()
 * ويعيد حالة جديدة؛ المكونات تشترك عبر usePlatform(). سيُستبدل بطبقة خادم + قاعدة بيانات.
 */

const KEY = 'hissas-web-v1';
type Listener = () => void;

let state: PlatformState | null = null;
const listeners = new Set<Listener>();

function initial(): PlatformState {
  const meta = demoMeta();
  return {
    v: 1,
    current: meta.id,
    schools: [meta],
    data: { [meta.id]: demoSchoolState(meta.name) },
  };
}

function load(): PlatformState {
  if (state) return state;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const o = JSON.parse(raw) as PlatformState;
      if (o?.v === 1 && o.schools?.length) {
        // حقول أُضيفت بعد أول نسخة
        for (const d of Object.values(o.data)) {
          d.docs ??= [];
          d.photos ??= {};
        }
        for (const m of o.schools)
          if (m.slug === 'demo' && o.data[m.id]) o.data[m.id]!.demo ??= true;
        return (state = o);
      }
    }
  } catch {
    /* بيانات تالفة: نبدأ من جديد */
  }
  state = initial();
  persist();
  return state;
}

function persist() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* التخزين ممتلئ أو غير متاح */
  }
}

function emit() {
  persist();
  for (const l of listeners) l();
}

export function getPlatform(): PlatformState {
  return load();
}

export function setPlatform(fn: (s: PlatformState) => PlatformState): void {
  state = fn(load());
  emit();
}

/** تعديل حالة مدرسة. */
export function updateSchool(id: string, fn: (s: SchoolState) => SchoolState): void {
  setPlatform((p) => {
    const cur = p.data[id];
    return cur ? { ...p, data: { ...p.data, [id]: fn(cur) } } : p;
  });
}

export function updateMeta(id: string, fn: (m: SchoolMeta) => SchoolMeta): void {
  setPlatform((p) => ({ ...p, schools: p.schools.map((m) => (m.id === id ? fn(m) : m)) }));
}

/** إرجاع كل شيء للبيانات التجريبية (للاختبارات والعرض). */
export function resetPlatform(): void {
  state = initial();
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      l();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

const serverSnapshot = (): PlatformState | null => null;

/** حالة المنصة (null أثناء التصيير على الخادم). */
export function usePlatform(): PlatformState | null {
  return useSyncExternalStore(subscribe, load, serverSnapshot);
}

/** المدرسة من slug. */
export function useSchool(
  slug: string,
): { meta: SchoolMeta; data: SchoolState } | null | undefined {
  const p = usePlatform();
  if (!p) return undefined;
  const meta = p.schools.find((m) => m.slug === slug);
  const data = meta && p.data[meta.id];
  return meta && data ? { meta, data } : null;
}
