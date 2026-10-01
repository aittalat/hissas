/**
 * قراءة صورة وتصغيرها في المتصفح قبل الحفظ (readLogo في النموذج الأولي).
 * لاحقا: الرفع إلى S3 خاص تحت {school_id}/ والحفظ برابط موقّع.
 */
export async function readImage(
  file: File,
  opts: { max: number; type: 'image/png' | 'image/jpeg'; quality?: number; square?: boolean },
): Promise<string> {
  const url = await new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = no;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = no;
    i.src = url;
  });
  // صورة التلميذ: قص مربع من الوسط (الوجه غالبا في الوسط)
  const side = Math.min(img.width, img.height);
  const sx = opts.square ? (img.width - side) / 2 : 0;
  const sy = opts.square ? Math.max(0, (img.height - side) / 3) : 0;
  const sw = opts.square ? side : img.width;
  const sh = opts.square ? side : img.height;
  const k = Math.min(1, opts.max / Math.max(sw, sh));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(sw * k));
  cv.height = Math.max(1, Math.round(sh * k));
  const ctx = cv.getContext('2d');
  if (ctx) {
    if (opts.type === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  }
  return cv.toDataURL(opts.type, opts.quality);
}

/** شعار المدرسة: PNG، 256 بكسل كحد أقصى. */
export const readLogo = (file: File) => readImage(file, { max: 256, type: 'image/png' });

/** صورة التلميذ: JPEG مربع 320 بكسل (حوالي 20 ك.ب). */
export const readPhoto = (file: File) =>
  readImage(file, { max: 320, type: 'image/jpeg', quality: 0.85, square: true });
