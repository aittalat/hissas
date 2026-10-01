import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadScenarios, SCENARIOS_DIR } from '../testing/scenarios';
import { contractJsonSchema } from './json-schema';
import { SolveRequestSchema, SolveResponseSchema } from './solver';

describe('عقد المحرك', () => {
  it('contract/solver.schema.json محدَّث (pnpm --filter @hissas/shared contract:export)', () => {
    const saved = JSON.parse(
      readFileSync(resolve(SCENARIOS_DIR, '../../contract/solver.schema.json'), 'utf8'),
    );
    expect(saved).toEqual(contractJsonSchema());
  });

  it('طلب الحل يقبل بيانات كل سيناريو ويملأ القيم الافتراضية', () => {
    for (const s of loadScenarios()) {
      const r = SolveRequestSchema.parse({ school: s.school });
      expect(r.current).toEqual([]);
      expect(r.options).toEqual({ time_limit_s: 20, random_seed: 0, workers: 8 });
    }
  });

  it('الجواب يرفض حالة غير معروفة', () => {
    const run = loadScenarios()[0]!.prototype.runs[0]!;
    const ok = {
      status: 'optimal',
      placements: run.placements,
      evaluation: { metrics: run.metrics, conflicts: run.conflicts, quality: run.quality },
      objective: 0,
      wall_time_s: 1,
      diagnose: [],
    };
    expect(SolveResponseSchema.safeParse(ok).success).toBe(true);
    expect(SolveResponseSchema.safeParse({ ...ok, status: 'done' }).success).toBe(false);
  });
});
