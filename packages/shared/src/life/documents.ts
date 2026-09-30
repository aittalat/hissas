import type { Student } from '../contract/life';
import { schoolYear } from '../io/export';
import { studentName } from './stats';

/**
 * وثائق قابلة للطباعة: الشهادة المدرسية (attestationHTML) وصفحة القوائم (tableHTML)،
 * بنفس قوالب النموذج الأولي.
 */

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );

export interface DocBrand {
  name: string;
  color: string;
  /** رابط الشعار (موقّع) أو null. */
  logo: string | null;
}

/** صفحة طباعة قائمة بترويسة المدرسة (tableHTML). */
export function listTableHtml(
  brand: DocBrand,
  title: string,
  H: readonly string[],
  R: readonly (readonly (string | number)[])[],
  now = new Date(),
): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:12mm;color:#111}header{display:flex;gap:10px;align-items:center;border-bottom:2px solid ${brand.color};padding-bottom:8px;margin-bottom:10px}h1{font-size:16px;margin:0}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #444;padding:5px;text-align:start}th{background:#eee}</style></head><body><header>${brand.logo ? `<img src="${brand.logo}" style="height:40px">` : ''}<div><b>${esc(brand.name)}</b> · ${schoolYear(now)}<h1>${esc(title)}</h1></div></header><table><thead><tr>${H.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${R.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}

/** الشهادة المدرسية (attestationHTML): A4 عمودي، بالعربية مع العنوان الفرنسي. */
export function attestationHtml(
  brand: DocBrand,
  s: Student,
  className: string,
  now = new Date(),
): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>شهادة مدرسية</title><style>@page{size:A4;margin:18mm}body{font-family:Tahoma,Arial,sans-serif;color:#111;line-height:1.9}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${brand.color};padding-bottom:10px}h1{text-align:center;font-size:24px;margin:40px 0 6px}h2{text-align:center;font-size:15px;font-weight:400;margin:0 0 30px;color:#555}p{font-size:16px}.sig{margin-top:60px;text-align:left}</style></head><body>
  <header><div><b>${esc(brand.name)}</b><br>السنة الدراسية ${schoolYear(now)}</div>${brand.logo ? `<img src="${brand.logo}" style="height:64px">` : ''}</header>
  <h1>شهادة مدرسية</h1><h2>Attestation de scolarité</h2>
  <p>يشهد مدير مؤسسة <b>${esc(brand.name)}</b> أن التلميذ(ة) <b>${esc(studentName(s))}</b>، المزداد(ة) بتاريخ <b>${esc(s.birth_date)}</b>، رقم التسجيل <b>${esc(s.matricule)}</b>، يتابع دراسته بالمؤسسة بقسم <b>${esc(className)}</b> برسم السنة الدراسية <b>${schoolYear(now)}</b>.</p>
  <p>سُلّمت هذه الشهادة بطلب من المعني(ة) بالأمر للإدلاء بها عند الحاجة.</p><p class="sig">حُرّر في: ${now.toLocaleDateString('fr-MA')}<br>توقيع المدير وختم المؤسسة</p></body></html>`;
}
