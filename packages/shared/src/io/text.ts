/**
 * تطبيع النص للمقارنة (norm في النموذج الأولي): حروف صغيرة، حذف التشكيل والعلامات،
 * أ/إ/آ ← ا، ة ← ه، ى ← ي، مسافات موحّدة.
 */
export function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟ̀-ͯ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

/** "HH:MM" ← دقائق منذ منتصف الليل. */
export const toMinutes = (s: string): number => {
  const [h = 0, m = 0] = String(s).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
