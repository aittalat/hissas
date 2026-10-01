import { describe, expect, it } from 'vitest';
import { SchoolDataSchema } from '../contract/school';
import { randomPlacements, randomSchool } from './random';

describe('randomSchool', () => {
  it('يولد مدارس صالحة وقابلة للتكرار', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = randomSchool(seed);
      const r = SchoolDataSchema.safeParse(s);
      expect(r.success, `seed ${seed}: ${r.success ? '' : r.error.message}`).toBe(true);
      expect(randomSchool(seed)).toEqual(s);
      expect(randomPlacements(s, seed)).toEqual(randomPlacements(s, seed));
    }
  });
});
