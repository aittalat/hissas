/** شاشة لم تُبنَ بعد (مؤقت أثناء بناء الواجهات). */
export function Soon({ title }: { title: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">قيد البناء.</p>
    </section>
  );
}
