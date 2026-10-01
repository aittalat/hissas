'use client';

import { buildModel, metrics, noticePublished, placementMap } from '@hissas/shared';
import { useCallback, useState } from 'react';
import { useToast } from '@/components/toast';
import { useSchoolCtx } from './school';
import { solveTimetable } from './solver';

/**
 * توليد الجدول (generate في النموذج الأولي): جدول جديد يعوّض الحالي، وتُلغى تعويضات الغياب،
 * ويُرسل إشعار "نُشر جدول الحصص". [قرار معلق: مسودة ثم نشر.]
 */
export function useGenerate() {
  const { state, update, notify } = useSchoolCtx();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const generate = useCallback(
    async (school = state.school, onDone?: (unplaced: number, total: number) => string) => {
      setBusy(true);
      try {
        const placements = await solveTimetable(school, state.placements);
        update((s) => ({
          ...s,
          school,
          placements,
          dirty: false,
          substitutions: [],
          absences: [],
        }));
        notify(noticePublished());
        const m = metrics(buildModel(school), placementMap(placements));
        toast(
          onDone
            ? onDone(m.unplaced, m.total)
            : m.unplaced
              ? `تم التوليد، وبقيت ${m.unplaced} حصص بدون مكان`
              : 'تم توليد جدول كامل بدون تعارض',
        );
      } catch (e) {
        toast(`تعذّر التوليد: ${String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [state.school, state.placements, update, notify, toast],
  );
  return { generate, busy };
}
