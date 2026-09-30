/**
 * يكتب عقد المحرك كـ JSON Schema في packages/shared/contract/solver.schema.json.
 * منه تُولَّد نماذج pydantic في services/solver (انظر services/solver/scripts/gen-contract.sh).
 *
 *   pnpm --filter @hissas/shared contract:export
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractJsonSchema } from '../src/contract/json-schema';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../contract/solver.schema.json');
writeFileSync(out, JSON.stringify(contractJsonSchema(), null, 2) + '\n');
console.log(`كُتب ${out}`);
