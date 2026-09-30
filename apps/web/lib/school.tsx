'use client';

import { buildModel, placementMap, type Model, type Notice, type Slot } from '@hissas/shared';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { uid } from './demo';
import { updateMeta, updateSchool, useSchool } from './store';
import type { SchoolMeta, SchoolState } from './types';

export interface SchoolCtx {
  meta: SchoolMeta;
  state: SchoolState;
  model: Model;
  placed: Map<string, Slot>;
  update: (fn: (s: SchoolState) => SchoolState) => void;
  setMeta: (fn: (m: SchoolMeta) => SchoolMeta) => void;
  /** إشعار للأولياء (عام أو لقسم). */
  notify: (n: Notice) => void;
  /** مسار داخل المدرسة. */
  href: (path?: string) => string;
}

const Ctx = createContext<SchoolCtx | null>(null);

export function SchoolProvider({
  slug,
  children,
  fallback,
}: {
  slug: string;
  children: ReactNode;
  fallback: ReactNode;
}) {
  const found = useSchool(slug);
  const id = found?.meta.id;
  const update = useCallback(
    (fn: (s: SchoolState) => SchoolState) => id && updateSchool(id, fn),
    [id],
  );
  const setMeta = useCallback(
    (fn: (m: SchoolMeta) => SchoolMeta) => id && updateMeta(id, fn),
    [id],
  );
  const notify = useCallback(
    (n: Notice) =>
      id &&
      updateSchool(id, (s) => ({
        ...s,
        notices: [{ ...n, id: uid(), ts: Date.now() }, ...s.notices].slice(0, 60),
      })),
    [id],
  );
  const school = found?.data.school;
  const placements = found?.data.placements;
  const model = useMemo(() => (school ? buildModel(school) : null), [school]);
  const placed = useMemo(() => (placements ? placementMap(placements) : null), [placements]);
  if (found === undefined) return <div className="loading">…</div>;
  if (!found || !model || !placed) return <>{fallback}</>;
  const value: SchoolCtx = {
    meta: found.meta,
    state: found.data,
    model,
    placed,
    update,
    setMeta,
    notify,
    href: (path = '') => `/s/${found.meta.slug}${path}`,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSchoolCtx(): SchoolCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSchoolCtx خارج SchoolProvider');
  return c;
}
