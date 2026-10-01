import { createAvatar } from '@dicebear/core';
import * as lorelei from '@dicebear/lorelei';
import type { Student } from '@hissas/shared';
import type { SchoolState } from './types';

/**
 * رسوم توضيحية للتلاميذ في المدرسة التجريبية فقط (Lorelei، رخصة CC0): لا صور أطفال حقيقية
 * قبل التصريح لدى CNDP. التلميذ الذي رُفعت صورته تظهر صورته دائما.
 */
const BOY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 22, 27, 39, 43, 46, 47];
const GIRL = [13, 14, 15, 16, 17, 18, 19, 21, 23, 24, 26, 31, 32, 35, 40, 41, 42, 45];
const SKIN = ['f2d3b1', 'e8bf98', 'd9a878', 'c18c62', 'a8734d'];
const HAIR = ['2b1a12', '3b2416', '1a1110', '5a3a22', '4a2c1a'];
type Hair = NonNullable<lorelei.Options['hair']>[number];
type Eyes = NonNullable<lorelei.Options['eyes']>[number];
type Brows = NonNullable<lorelei.Options['eyebrows']>[number];
const v = (n: number) => `variant${String(n).padStart(2, '0')}` as Hair;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const cache = new Map<string, string>();

export function demoPortrait(s: Pick<Student, 'id' | 'gender'>): string {
  const key = `${s.id}|${s.gender}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const h = hash(s.id);
  const hair = s.gender === 'f' ? GIRL : BOY;
  const uri = createAvatar(lorelei, {
    seed: s.id,
    hair: [v(hair[h % hair.length] as number)],
    skinColor: [SKIN[(h >>> 5) % SKIN.length] as string],
    hairColor: [HAIR[(h >>> 9) % HAIR.length] as string],
    eyes: [2, 4, 6, 9, 10, 12, 13, 14, 16, 21, 23, 24].map(
      (n) => `variant${String(n).padStart(2, '0')}` as Eyes,
    ),
    eyebrows: [1, 2, 5, 9, 12].map((n) => `variant${String(n).padStart(2, '0')}` as Brows),
    mouth: ['happy01', 'happy02', 'happy03', 'happy05', 'happy07', 'happy08', 'happy09', 'happy12'],
    beardProbability: 0,
    earringsProbability: s.gender === 'f' ? 15 : 0,
    glassesProbability: 8,
    frecklesProbability: 0,
    hairAccessoriesProbability: s.gender === 'f' ? 20 : 0,
  }).toDataUri();
  cache.set(key, uri);
  return uri;
}

/** صورة التلميذ: المرفوعة، وإلا رسم توضيحي في المدرسة التجريبية لثمانية تلاميذ من كل عشرة. */
export function studentPhoto(
  state: Pick<SchoolState, 'photos' | 'demo'>,
  s: Pick<Student, 'id' | 'gender'>,
): string | null {
  const own = state.photos[s.id];
  if (own) return own;
  if (state.demo && hash(`${s.id}#p`) % 10 < 8) return demoPortrait(s);
  return null;
}
