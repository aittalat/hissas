/// <reference lib="webworker" />
import { buildSolutions, generateTimetable } from '@hissas/shared';

/** المحرك المحلي في Web Worker: التوليد والحلول دون تجميد الواجهة. */
self.onmessage = (e: MessageEvent) => {
  const { op, args } = e.data as { op: 'generate' | 'solutions'; args: unknown[] };
  try {
    const result =
      op === 'generate'
        ? generateTimetable(...(args as Parameters<typeof generateTimetable>))
        : buildSolutions(...(args as Parameters<typeof buildSolutions>));
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
