'use client';

import type {
  AdviceAction,
  Placement,
  SchoolData,
  SolutionSet,
  TimetableState,
} from '@hissas/shared';

/**
 * عميل المحرك. حاليا المحرك المحلي في Web Worker؛ لاحقا طلبات /jobs إلى services/solver
 * بنفس الدوال.
 */
function run<T>(op: 'generate' | 'solutions', args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ ok: boolean; result?: T; error?: string }>) => {
      w.terminate();
      if (e.data.ok) resolve(e.data.result as T);
      else reject(new Error(e.data.error));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message));
    };
    w.postMessage({ op, args });
  });
}

export const solveTimetable = (school: SchoolData, placements: Placement[], budget = 5000) =>
  run<Placement[]>('generate', [school, placements, budget]);

export const solveSolutions = (
  state: TimetableState,
  title: string,
  mutation: AdviceAction | null,
  deep: boolean,
) => run<SolutionSet>('solutions', [state, title, mutation, deep]);
