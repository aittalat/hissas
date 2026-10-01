/** وسوم الأثر: "−" مميّز (تحسن)، و"+" عادي. */
export function EffectTags({
  effects,
  accent,
}: {
  effects: string[];
  accent?: (e: string) => boolean;
}) {
  const acc = accent ?? ((e: string) => e.startsWith('−'));
  return (
    <div className="chips">
      {effects.map((e, i) => (
        <span key={i} className={`tag${acc(e) ? ' acc' : ''}`}>
          {e}
        </span>
      ))}
    </div>
  );
}
