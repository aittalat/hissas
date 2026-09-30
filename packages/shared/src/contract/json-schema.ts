import { z } from 'zod';
import { SOLVER_CONTRACT } from './solver';

/**
 * JSON Schema (2020-12) لكل العقد: كل مخطط مسمى (meta id) في $defs.
 * الطلبات بصيغة "input" (القيم الافتراضية اختيارية)؛ قيود superRefine لا تُترجم،
 * والمحرك يعيد التحقق من سلامة المراجع بنفسه.
 */
export function contractJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(z.object(SOLVER_CONTRACT).meta({ title: 'SolverContract' }), {
    target: 'draft-2020-12',
    io: 'input',
  }) as Record<string, unknown>;
}
