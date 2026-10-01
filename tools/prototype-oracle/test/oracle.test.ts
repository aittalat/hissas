import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ScenarioSchema, type Scenario } from '@hissas/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stringifyCompact } from '../src/json';
import { PrototypeOracle, REPO_ROOT } from '../src/oracle';
import { SCENARIOS } from '../src/scenarios';

const dir = resolve(REPO_ROOT, 'packages/shared/fixtures/scenarios');
const scenarios: Scenario[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ScenarioSchema.parse(JSON.parse(readFileSync(resolve(dir, f), 'utf8'))));

let oracle: PrototypeOracle;
beforeAll(async () => {
  oracle = await PrototypeOracle.open();
});
afterAll(() => oracle?.close());

describe('التحويل بين النموذج الأولي وSchoolData', () => {
  it('بيانات seed() الحالية = بيانات السيناريوهات المحفوظة (بعد نفس التحويل)', async () => {
    const demo = await oracle.demoSchool();
    for (const def of SCENARIOS) {
      const saved = scenarios.find((s) => s.scenario === def.scenario);
      expect(saved, def.scenario).toBeDefined();
      expect(def.build(demo), def.scenario).toEqual(saved?.school);
    }
  });

  it.each(scenarios.map((s) => [s.scenario, s] as const))(
    '%s: تحميل البيانات ثم تصديرها يعطي نفس البيانات',
    async (_id, s) => {
      await oracle.load(s.school);
      expect(await oracle.exportSchool()).toEqual(s.school);
    },
  );
});

describe('إعادة حساب النتائج المحفوظة في النموذج الأولي', () => {
  it.each(scenarios.map((s) => [s.scenario, s] as const))(
    '%s: التشخيص والحد الأقصى والساعة المفروضة',
    async (_id, s) => {
      await oracle.load(s.school);
      expect(await oracle.diagnose()).toEqual(s.prototype.diagnose);
      expect(await oracle.tMax()).toEqual(s.prototype.t_max);
      expect(await oracle.forcedLone()).toEqual(s.prototype.forced_lone);
    },
  );

  it.each(scenarios.map((s) => [s.scenario, s] as const))(
    '%s: المؤشرات والجودة لكل تشغيل محفوظ',
    async (_id, s) => {
      for (const run of s.prototype.runs) {
        await oracle.load(s.school, run.placements);
        expect(await oracle.placements()).toEqual(run.placements);
        const m = await oracle.measure();
        expect(m.metrics).toEqual(run.metrics);
        expect(m.conflicts).toBe(run.conflicts);
        expect(m.quality).toBe(run.quality);
      }
    },
  );
});

describe('stringifyCompact', () => {
  it('ملفات fixtures مكتوبة بالصيغة القياسية (كما يكتبها المصدّر)', () => {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const raw = readFileSync(resolve(dir, f), 'utf8');
      expect(stringifyCompact(JSON.parse(raw)), f).toBe(raw);
    }
  });

  it('يحفظ القيم كما هي', () => {
    const v = {
      a: 'نص طويل '.repeat(30),
      b: [
        [0, 1],
        [2, 3],
      ],
      c: { x: 1, y: [1, 2] },
      d: [],
    };
    expect(JSON.parse(stringifyCompact(v))).toEqual(v);
  });
});
