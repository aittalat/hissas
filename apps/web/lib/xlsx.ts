import type { Cell, Sheet, SheetModel } from '@hissas/shared';

/**
 * كتابة وقراءة ملفات Excel. [قرار معلق: ExcelJS أو SheetJS — docs/UI-READINESS.md §5.5]
 * كل ما يخص المكتبة محصور في هذا الملف: النموذج (SheetModel) والقراءة (Sheet) من @hissas/shared.
 * المكتبة تُحمَّل عند الحاجة فقط.
 */

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** ملف Excel من اليمين إلى اليسار: ورقة لكل SheetModel (الدمج، عرض الأعمدة، ارتفاع الأسطر). */
export async function writeWorkbook(sheets: readonly SheetModel[]): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ rightToLeft: true }] });
    for (const r of s.rows) ws.addRow(r);
    s.cols.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    s.rowHeights?.forEach((h, i) => {
      ws.getRow(i + 1).height = h;
    });
    ws.eachRow((row) =>
      row.eachCell((c) => {
        if (typeof c.value === 'string' && c.value.includes('\n'))
          c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      }),
    );
    for (const m of s.merges) ws.mergeCells(m.s.r + 1, m.s.c + 1, m.e.r + 1, m.e.c + 1);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: XLSX_TYPE });
}

/** قيمة خلية بسيطة: الوقت كسر يوم كما في SheetJS (parseTime يفهمه). */
function cellValue(v: unknown): Cell {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) {
    // ExcelJS يقرأ خلايا الوقت تاريخا بتوقيت UTC فوق 1899-12-30
    const days = (v.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
    return days - Math.floor(days);
  }
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((x) => x.text).join('');
    if (o.result !== undefined) return cellValue(o.result);
    if (o.text !== undefined) return String(o.text);
  }
  return String(v);
}

/** أوراق الملف كمصفوفات أسطر (sheet_to_json بـ header:1). CSV يُقرأ نصا. */
export async function readWorkbook(file: File): Promise<Sheet[]> {
  const buf = await file.arrayBuffer();
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const { tsvRows } = await import('@hissas/shared');
    return [tsvRows(new TextDecoder().decode(buf))];
  }
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets.map((ws) => {
    const rows: Sheet = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const vals = Array.from((row.values as unknown[]).slice(1), cellValue);
      rows[n - 1] = vals;
    });
    const width = Math.max(0, ...rows.map((r) => r?.length ?? 0));
    return Array.from(rows, (r) => {
      const x = r ?? [];
      return [...x, ...Array<Cell>(width - x.length).fill('')];
    });
  });
}

/** تحميل ملف في المتصفح. */
export function download(filename: string, data: Blob | string, type = 'text/html') {
  const blob =
    typeof data === 'string' ? new Blob([data], { type: `${type};charset=utf-8` }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
