import { DAY_NAMES_AR, type SchoolDay } from '../calendar';
import type { SchoolData } from '../contract/school';
import { periodTimes } from '../grid';
import { rowGroups } from '../timetable/groups';
import { Occupancy } from '../timetable/moves';
import type { Model, PlacementMap } from '../timetable/units';

/**
 * التصدير (SPEC §7.7): أوراق "التوزيع" و"أوقات الفراغ"، مصفوفة جدول كل قسم وأستاذ، ورقة
 * Excel لكل جدول، وصفحة الطباعة A4 الأفقية. منقول من distAOA، freeAOA، ttMatrix، ttTitle،
 * workbook، printableHTML في النموذج الأولي. كتابة ملف xlsx نفسه في طبقة الويب.
 */

export type Row = (string | number)[];
const day = (d: number) => DAY_NAMES_AR[d as SchoolDay];

/** السنة الدراسية (schoolYear): من غشت إلى يوليوز. */
export function schoolYear(now: Date = new Date()): string {
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

/** ورقة "التوزيع" (distAOA): سطر لكل (قسم، مادة) لها أستاذ. */
export function distributionRows(school: SchoolData): Row[] {
  const r: Row[] = [['القسم', 'المادة', 'الأستاذ', 'الساعات', 'متواجد']];
  const person = new Map(school.persons.map((p) => [p.id, p]));
  for (const c of school.classes)
    for (const s of c.subjects) {
      const t = school.teachers.find(
        (t) => t.subject === s && t.classes.some((x) => x.class_id === c.id),
      );
      if (!t) continue;
      const p = person.get(t.person_id);
      r.push([
        c.name,
        school.subjects.find((x) => x.key === s)?.name ?? s,
        p?.full_name ?? '',
        t.classes.find((x) => x.class_id === c.id)?.hours ?? 0,
        p?.present ? 'نعم' : '',
      ]);
    }
  return r;
}

/**
 * ورقة "أوقات الفراغ" (freeAOA): لكل أستاذ ويوم، مجالات متتالية (داخل نفس الفترة) للأوقات
 * المتاحة، ثم للمحجوزة في مدرسة أخرى.
 */
export function freeTimeRows(model: Model): Row[] {
  const r: Row[] = [['الأستاذ', 'اليوم', 'من', 'إلى', 'الحالة']];
  const { grid } = model;
  const PR = periodTimes(model.school.config);
  const P = grid.periods;
  for (const x of model.persons) {
    const unav = new Set(x.unavailable.map(([d, p]) => `${d}-${p}`));
    const ext = new Set(x.other_school.map(([d, p]) => `${d}-${p}`));
    for (const d of grid.activeDays)
      for (const [kind, label] of [
        ['f', ''],
        ['x', 'مدرسة أخرى'],
      ] as const) {
        const cond = (k: string) => (kind === 'f' ? !unav.has(k) && !ext.has(k) : ext.has(k));
        let st = -1;
        for (let p = 0; p <= P; p++) {
          const on = p < P && grid.isValid(d, p) && cond(`${d}-${p}`);
          if (st >= 0 && (!on || grid.halfOf(p) !== grid.halfOf(p - 1))) {
            r.push([
              x.full_name,
              day(d),
              (PR[st] as [string, string])[0],
              (PR[p - 1] as [string, string])[1],
              label,
            ]);
            st = -1;
          }
          if (on && st < 0) st = p;
        }
      }
  }
  return r;
}

export type ExportMode = 'class' | 'teacher';
export type ExportWhich = 'all' | 'classes' | 'teachers';

export interface MatrixCell {
  period: number;
  len: number;
  /** اختصار المادة. */
  subject: string;
  /** الأستاذ (في جدول القسم) أو القسم (في جدول الأستاذ). */
  who: string;
}

/** مصفوفة جدول قسم أو أستاذ (ttMatrix): الحصص المجمعة لكل يوم نشط، ومجموع الساعات. */
export function timetableMatrix(
  model: Model,
  placed: PlacementMap,
  mode: ExportMode,
  id: string,
): { rows: { day: number; cells: MatrixCell[] }[]; hours: number } {
  const o = Occupancy.from(model, placed);
  const { school } = model;
  const sh = (s: string) => school.subjects.find((x) => x.key === s)?.short ?? s;
  const tName = (tid: string) => {
    const t = school.teachers.find((x) => x.id === tid);
    return (t && model.person(t.person_id)?.full_name) ?? '';
  };
  const cName = (c: string) => school.classes.find((x) => x.id === c)?.name ?? c;
  const key = mode === 'class' ? id : (school.teachers.find((t) => t.id === id)?.person_id ?? id);
  let hours = 0;
  const rows = model.grid.activeDays.map((d) => ({
    day: d,
    cells: rowGroups(model, o, mode === 'class' ? 'class' : 'person', key, d).map((g) => {
      hours += g.units.length;
      return {
        period: g.period,
        len: g.units.length,
        subject: sh(g.unit.subject),
        who: mode === 'class' ? tName(g.unit.teacher_id) : cName(g.unit.class_id),
      };
    }),
  }));
  return { rows, hours };
}

/** عنوان الجدول (ttTitle). id للأستاذ = سجل (تُذكر كل مواد الشخص). */
export function timetableTitle(
  school: SchoolData,
  mode: ExportMode,
  id: string,
): { title: string; sub: string } {
  if (mode === 'class')
    return {
      title: 'EMPLOI DU TEMPS · جدول الحصص',
      sub: `القسم: ${school.classes.find((c) => c.id === id)?.name ?? id}`,
    };
  const t = school.teachers.find((x) => x.id === id);
  const recs = t
    ? [t, ...school.teachers.filter((x) => x !== t && x.person_id === t.person_id)]
    : [];
  const subs = recs
    .map((r) => school.subjects.find((x) => x.key === r.subject)?.short ?? r.subject)
    .join(' / ');
  const name = (t && school.persons.find((p) => p.id === t.person_id)?.full_name) ?? '';
  return {
    title: 'EMPLOI DU TEMPS PROFESSEUR · جدول حصص الأستاذ',
    sub: `الأستاذ: ${name} · المادة: ${subs}`,
  };
}

/** الجداول المصدَّرة (exportTargets): كل قسم، ثم كل أستاذ (بسجله الأول). */
export function exportTargets(model: Model, which: ExportWhich): [ExportMode, string][] {
  const r: [ExportMode, string][] = [];
  if (which !== 'teachers') for (const c of model.school.classes) r.push(['class', c.id]);
  if (which !== 'classes')
    for (const p of model.persons) {
      const t = model.school.teachers.find((x) => x.person_id === p.id);
      if (t) r.push(['teacher', t.id]);
    }
  return r;
}

/** أسماء أوراق Excel صالحة وفريدة (31 حرفا كحد أقصى، بدون []:*?/\). */
export function sheetNamer(): (s: string) => string {
  const names = new Set<string>();
  return (s) => {
    const b =
      String(s)
        .replace(/[[\]:*?/\\]/g, ' ')
        .slice(0, 28)
        .trim() || 'ورقة';
    let n = b;
    let i = 2;
    while (names.has(n)) n = `${b.slice(0, 26)} ${i++}`;
    names.add(n);
    return n;
  };
}

export interface SheetModel {
  name: string;
  rows: Row[];
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  cols: number[];
  /** ارتفاع الأسطر بالنقاط (عند الحاجة). */
  rowHeights?: number[];
}

/**
 * نموذج ملف Excel (workbook): ورقة لكل جدول (ترويسة من 3 أسطر، الساعتان المتتاليتان في خلية
 * مدمجة)، ثم ورقتا "التوزيع" و"أوقات الفراغ". الملف من اليمين إلى اليسار.
 */
export function workbookModel(
  model: Model,
  placed: PlacementMap,
  which: ExportWhich,
  now = new Date(),
): SheetModel[] {
  const { school } = model;
  const PR = periodTimes(school.config);
  const nm = sheetNamer();
  const out: SheetModel[] = [];
  for (const [mode, id] of exportTargets(model, which)) {
    const M = timetableMatrix(model, placed, mode, id);
    const T = timetableTitle(school, mode, id);
    const rows: Row[] = [
      [`${school.name} · ${schoolYear(now)}`],
      [T.title],
      [`${T.sub} · مجموع الساعات: ${M.hours}`],
      ['اليوم', ...PR.map((p) => `${p[0]}-${p[1]}`)],
    ];
    const merges: SheetModel['merges'] = [];
    for (const row of M.rows) {
      const r: Row = [day(row.day), ...PR.map(() => '')];
      for (const c of row.cells) {
        r[1 + c.period] = `${c.subject}\n${c.who}`;
        if (c.len > 1)
          merges.push({
            s: { r: rows.length, c: 1 + c.period },
            e: { r: rows.length, c: c.period + c.len },
          });
      }
      rows.push(r);
    }
    const header = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: PR.length } }));
    const t = school.teachers.find((x) => x.id === id);
    const name =
      mode === 'class'
        ? (school.classes.find((c) => c.id === id)?.name ?? id)
        : `أستاذ ${(t && school.persons.find((p) => p.id === t.person_id)?.full_name) ?? ''}`;
    out.push({
      name: nm(name),
      rows,
      merges: [...header, ...merges],
      cols: [11, ...PR.map(() => 18)],
      rowHeights: rows.map((_, i) => (i > 3 ? 42 : 20)),
    });
  }
  out.push({
    name: nm('التوزيع'),
    rows: distributionRows(school),
    merges: [],
    cols: [12, 28, 26, 9, 9],
  });
  out.push({
    name: nm('أوقات الفراغ'),
    rows: freeTimeRows(model),
    merges: [],
    cols: [26, 11, 8, 8, 12],
  });
  return out;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );

export interface Branding {
  color: string;
  /** رابط الشعار (موقّع) أو null. */
  logo: string | null;
}

const PRINT_CSS =
  '\n@page{size:A4 landscape;margin:10mm}body{font-family:Tahoma,"Segoe UI",Arial,sans-serif;margin:0;color:#111}\n.sheet{page-break-after:always;padding:8mm}.sheet:last-child{page-break-after:auto}\nheader{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px;font-size:12px}\n.t{text-align:center}h1{font-size:17px;margin:0}h2{font-size:14px;margin:4px 0 0;font-weight:600}.n{text-align:center}.n b{font-size:18px}\ntable{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px}th,td{border:1px solid #333;padding:4px;text-align:center;vertical-align:middle;height:46px}\nth{background:#eef1ee}th span{font-weight:400;color:#555}th.d{width:70px}td.s{background:#f6f8f6}td.off{background:repeating-linear-gradient(135deg,#fff 0 5px,#e5e5e5 5px 6px)}\n.l{width:18px;background:#fafafa;writing-mode:vertical-rl;font-size:10px;color:#666}footer{display:flex;justify-content:space-between;margin-top:14px;font-size:11px;color:#444}\n@media screen{body{background:#ddd}.sheet{background:#fff;max-width:1100px;margin:12px auto;box-shadow:0 1px 4px rgb(0 0 0/.2)}}\n';

/** صفحة الطباعة (printableHTML): كل جدول في صفحة A4 أفقية بترويسة المدرسة وشعارها. */
export function printableHtml(
  model: Model,
  placed: PlacementMap,
  which: ExportWhich,
  brand: Branding,
  now = new Date(),
): string {
  const { school, grid } = model;
  const PR = periodTimes(school.config);
  const am = school.config.am_count;
  const AD = grid.activeDays;
  let body = '';
  for (const [mode, id] of exportTargets(model, which)) {
    const M = timetableMatrix(model, placed, mode, id);
    const T = timetableTitle(school, mode, id);
    let tb = `<tr><th class="d">اليوم</th>${PR.map((p, i) => (i === am ? '<th class="l"></th>' : '') + `<th>${p[0]}<br><span>${p[1]}</span></th>`).join('')}</tr>`;
    for (const row of M.rows) {
      const at = new Map(row.cells.map((c) => [c.period, c]));
      let tr = `<th class="d">${day(row.day)}</th>`;
      for (let p = 0; p < PR.length; p++) {
        if (p === am)
          tr += row.day === AD[0] ? `<td class="l" rowspan="${AD.length}">استراحة</td>` : '';
        const c = at.get(p);
        if (c) {
          tr += `<td colspan="${c.len}" class="s"><b>${esc(c.subject)}</b><br>${esc(c.who)}</td>`;
          p += c.len - 1;
          continue;
        }
        let skip = false;
        for (const cc of row.cells) if (p > cc.period && p < cc.period + cc.len) skip = true;
        if (skip) continue;
        tr += `<td class="${grid.isValid(row.day, p) ? '' : 'off'}"></td>`;
      }
      tb += `<tr>${tr}</tr>`;
    }
    body += `<section class="sheet"><header style="border-color:${brand.color}"><div style="display:flex;gap:10px;align-items:center">${brand.logo ? `<img src="${brand.logo}" alt="" style="height:44px">` : ''}<div><b>${esc(school.name)}</b><br>السنة الدراسية ${schoolYear(now)}</div></div><div class="t"><h1>${esc(T.title)}</h1><h2>${esc(T.sub)}</h2></div><div class="n">مجموع الساعات<br><b>${M.hours}</b></div></header><table>${tb}</table><footer><span>توقيع المدير</span><span>تم الإنشاء بمنصة حصص</span></footer></section>`;
  }
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جداول الحصص · ${esc(school.name)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
}
