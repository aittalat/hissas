'use client';

import type { Student } from '@hissas/shared';
import { Camera, Trash2 } from 'lucide-react';
import { useToast } from '@/components/toast';
import { studentPhoto } from '@/lib/avatar';
import { readPhoto } from '@/lib/image';
import { useSchoolCtx } from '@/lib/school';

/** صورة تلميذ من حالة المدرسة (المرفوعة، أو رسم توضيحي في المدرسة التجريبية). */
export function usePhoto() {
  const { state } = useSchoolCtx();
  return (s: Pick<Student, 'id' | 'gender'>) => studentPhoto(state, s);
}

/** رفع صورة التلميذ أو حذفها. */
export function PhotoActions({ studentId }: { studentId: string }) {
  const { state, update } = useSchoolCtx();
  const toast = useToast();
  const own = !!state.photos[studentId];
  return (
    <div className="photo-edit">
      <label className="btn sm">
        <Camera aria-hidden size={15} style={{ verticalAlign: -3 }} />{' '}
        {own ? 'تغيير الصورة' : 'إضافة صورة'}
        <input
          type="file"
          accept="image/*"
          className="sr"
          aria-label="صورة التلميذ"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            readPhoto(f)
              .then((url) => {
                update((s) => ({ ...s, photos: { ...s.photos, [studentId]: url } }));
                toast('حُفظت صورة التلميذ');
              })
              .catch(() => toast('تعذّرت قراءة الصورة'));
          }}
        />
      </label>
      {own && (
        <button
          className="btn sm ghost"
          onClick={() => {
            update((s) => {
              const photos = { ...s.photos };
              delete photos[studentId];
              return { ...s, photos };
            });
            toast('حُذفت الصورة');
          }}
        >
          <Trash2 aria-hidden size={15} style={{ verticalAlign: -3 }} /> حذف الصورة
        </button>
      )}
    </div>
  );
}
