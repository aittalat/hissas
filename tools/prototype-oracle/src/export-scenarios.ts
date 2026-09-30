/**
 * يولّد packages/shared/fixtures/scenarios/*.json من النموذج الأولي:
 * البيانات، وما يطلبه SPEC، وما أنتجه النموذج الأولي فعلا (تشخيص، generate() بعدة بذور، اقتراحات).
 *
 *   pnpm --filter @hissas/prototype-oracle export [--budget 5000] [--seeds 1,2,3]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ScenarioSchema, type OracleRun, type Scenario } from '@hissas/shared';
import { stringifyCompact } from './json';
import { PrototypeOracle, REPO_ROOT, prototypeSha256 } from './oracle';
import { SCENARIOS } from './scenarios';

export const FIXTURES_DIR = resolve(REPO_ROOT, 'packages/shared/fixtures/scenarios');

const { values } = parseArgs({
  options: {
    budget: { type: 'string', default: '5000' },
    seeds: { type: 'string', default: '1,2,3' },
    only: { type: 'string' },
  },
});
const budget = Number(values.budget);
const seeds = values.seeds.split(',').map(Number);

const oracle = await PrototypeOracle.open();
try {
  const demo = await oracle.demoSchool();
  const sha = prototypeSha256();
  mkdirSync(FIXTURES_DIR, { recursive: true });

  for (const def of SCENARIOS) {
    if (values.only && def.scenario !== values.only) continue;
    const school = def.build(demo);
    await oracle.load(school);
    const diagnose = await oracle.diagnose();
    const forced_lone = await oracle.forcedLone();
    const t_max = await oracle.tMax();

    const runs: OracleRun[] = [];
    for (const seed of seeds) {
      await oracle.load(school);
      const placements = await oracle.generate(seed, budget);
      const m = await oracle.measure();
      runs.push({ seed, budget_ms: budget, ...m, placements });
      console.log(
        `${def.scenario} seed=${seed}: جودة ${m.quality}، تعارض ${m.conflicts}، بدون مكان ${m.metrics.unplaced}، ساعة واحدة ${m.metrics.lone}، فراغ أساتذة ${m.metrics.tgaps}`,
      );
    }
    const best = runs.reduce((a, b) => (b.quality > a.quality ? b : a));
    await oracle.load(school, best.placements);
    const advise_titles = await oracle.adviseTitles();

    const scenario: Scenario = ScenarioSchema.parse({
      scenario: def.scenario,
      title: def.title,
      spec: def.spec,
      prototype_sha256: sha,
      school,
      expected: def.expected,
      prototype: { diagnose, forced_lone, t_max, runs, advise_titles },
    });
    writeFileSync(resolve(FIXTURES_DIR, `${def.scenario}.json`), stringifyCompact(scenario));
  }
} finally {
  await oracle.close();
}
