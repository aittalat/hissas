'use client';

import type { LifeResult, ParentMessage, SchoolLife } from '@hissas/shared';
import { useCallback } from 'react';
import { useToast } from '@/components/toast';
import { uid } from './demo';
import { useSchoolCtx } from './school';

/** تاريخ اليوم YYYY-MM-DD بالتوقيت المحلي (todayISO). */
export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "الإثنين 3 مارس" (fmtDate). */
export function fmtDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00`).toLocaleDateString('ar-MA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
}

/** "10:15" (fmt). */
export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });

/**
 * أفعال الحياة المدرسية: تطبيق نتيجة (حالة + رسائل للأولياء + رسالة تأكيد)،
 * وإرسال رسائل الأولياء (sendParentMsg). لاحقا: الخادم يرسل الإشعار وواتساب.
 */
export function useLife() {
  const ctx = useSchoolCtx();
  const { update } = ctx;
  const toast = useToast();

  const send = useCallback(
    (msgs: readonly ParentMessage[]) => {
      if (!msgs.length) return;
      const ts = Date.now();
      update((s) => ({
        ...s,
        messages: [...msgs.map((m) => ({ ...m, id: uid(), ts })).reverse(), ...s.messages].slice(
          0,
          300,
        ),
      }));
    },
    [update],
  );

  const setLife = useCallback(
    (fn: (l: SchoolLife) => SchoolLife) => update((s) => ({ ...s, life: fn(s.life) })),
    [update],
  );

  /** يطبّق نتيجة فعل: الخطأ رسالة، والنجاح حالة جديدة + رسائل + تأكيد. */
  const apply = useCallback(
    (r: LifeResult, ok?: string) => {
      if (!r.ok) {
        toast(r.error);
        return false;
      }
      update((s) => ({ ...s, life: r.life }));
      send(r.messages);
      const msg = r.info ?? ok;
      if (msg) toast(msg);
      return true;
    },
    [update, send, toast],
  );

  const { state, model } = ctx;
  const cName = (c: string) => model.school.classes.find((x) => x.id === c)?.name ?? c;
  return { ...ctx, life: state.life, today: todayISO(), cName, send, setLife, apply, toast };
}
