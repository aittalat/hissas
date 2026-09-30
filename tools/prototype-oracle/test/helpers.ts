import type { Placement, SchoolData } from '@hissas/shared';
import { loadScenarios, randomPlacements, randomSchool } from '@hissas/shared/testing';

/** عدد المدارس العشوائية (يمكن رفعه محليا: PARITY_CASES=2000). */
export const CASES = Number(process.env.PARITY_CASES ?? 250);

export interface Case {
  label: string;
  seed: number;
  school: SchoolData;
  placements: Placement[];
}

/** مدارس عشوائية + جداول عشوائية على بيانات السيناريوهات + جداول النموذج الأولي المحفوظة. */
export function* cases(randomCount = CASES, perScenario = 5): Generator<Case> {
  for (let seed = 1; seed <= randomCount; seed++) {
    const school = randomSchool(seed);
    yield { label: `seed ${seed}`, seed, school, placements: randomPlacements(school, seed) };
  }
  for (const s of loadScenarios()) {
    for (let seed = 1; seed <= perScenario; seed++)
      yield {
        label: `${s.scenario} seed ${seed}`,
        seed,
        school: s.school,
        placements: randomPlacements(s.school, seed),
      };
    for (const run of s.prototype.runs)
      yield {
        label: `${s.scenario} run ${run.seed}`,
        seed: run.seed,
        school: s.school,
        placements: run.placements,
      };
  }
}
