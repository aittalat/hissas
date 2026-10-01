import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScenarioSchema, type Scenario } from '../contract/oracle';

/** مسار ملفات السيناريوهات (fixtures) المولدة من النموذج الأولي. */
export const SCENARIOS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/scenarios',
);

export function loadScenarios(): Scenario[] {
  return readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ScenarioSchema.parse(JSON.parse(readFileSync(resolve(SCENARIOS_DIR, f), 'utf8'))));
}
