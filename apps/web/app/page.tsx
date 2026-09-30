import { DAY_NAMES_AR, SCHOOL_DAYS } from '@hissas/shared';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-brand text-3xl font-bold">حصص</h1>
      <p className="mt-2">منصة تدبير المدارس الخصوصية — قيد البناء.</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {SCHOOL_DAYS.map((d) => (
          <li key={d} className="rounded border px-2 py-1 text-sm">
            {DAY_NAMES_AR[d]}
          </li>
        ))}
      </ul>
    </main>
  );
}
