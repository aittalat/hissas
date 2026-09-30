import { DEFAULT_SUBJECTS } from '../catalog';
import type { SchoolConfig, SchoolData, Slot, Subject } from '../contract/school';
import { levelRank, sortClasses } from '../edit/data';
import { makeGrid, periodTimes } from '../grid';
import { DAY_ALIASES, DISTRIBUTION_COLUMNS, FREE_TIME_COLUMNS, SUBJECT_ALIASES } from './aliases';
import { norm, toMinutes } from './text';

/**
 * استيراد بيانات المدرسة من Excel (SPEC §7.7): ورقة "التوزيع" (القسم، المادة، الأستاذ، الساعات،
 * متواجد) وورقة "أوقات الفراغ" (الأستاذ، اليوم، من، إلى، الحالة)، بعناوين عربية أو فرنسية.
 * منقول من buildImport في النموذج الأولي، بنفس التحذيرات.
 */

export type Cell = string | number | boolean | null | undefined;
export type Sheet = Cell[][];

const stripAl = (s: string) => s.replace(/^ال/, '');

/** مطابقة اسم مادة (matchSub): الاسم أو الاختصار، ثم الأسماء البديلة، ثم الاحتواء، ثم المواد الجديدة. */
export function matchSubject(
  name: Cell,
  catalog: readonly Subject[],
  custom: readonly Subject[] = [],
): string | null {
  const n = stripAl(norm(name));
  if (!n) return null;
  for (const s of catalog)
    if (stripAl(norm(s.name)) === n || stripAl(norm(s.short)) === n) return s.key;
  for (const [k, a] of Object.entries(SUBJECT_ALIASES))
    if (a.some((x) => stripAl(norm(x)) === n)) return k;
  for (const [k, a] of Object.entries(SUBJECT_ALIASES))
    if (
      a.some((x) => {
        const y = stripAl(norm(x));
        return y.length > 3 && (n.includes(y) || y.includes(n));
      })
    )
      return k;
  for (const s of custom) if (norm(s.name) === n) return s.key;
  return null;
}

/** اليوم من اسمه (parseDay): 0 = الإثنين، -1 إذا لم يُفهم. */
export function parseDay(s: Cell): number {
  const n = norm(s);
  return DAY_ALIASES.findIndex((a) => a.some((x) => norm(x) === n));
}

/** الوقت بالدقائق (parseTime): كسر يوم Excel، أو "8:30" / "8h30" / "8.30" / "8". */
export function parseTime(v: Cell): number | null {
  if (typeof v === 'number' && v < 1) return Math.round(v * 1440);
  const m = String(v ?? '').match(/(\d{1,2})\s*[:h.]\s*(\d{2})?/i);
  return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null;
}

/** "نعم / oui / yes / x / 1 / ✓ / true". */
export const yes = (v: Cell) => /^(نعم|oui|yes|x|1|✓|true)$/i.test(String(v ?? '').trim());

/** تقسيم نص ملصوق من Excel (tsvRows): tab، وإلا ";"، وإلا ",". */
export function tsvRows(txt: string): Sheet {
  return String(txt || '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split(l.includes('\t') ? '\t' : l.includes(';') ? ';' : ','));
}

/** إيجاد الأعمدة (findCols): تطابق تام أولا، ثم احتواء لكلمات من 4 حروف فأكثر. */
export function findColumns<K extends string>(
  head: Cell[],
  spec: Readonly<Record<K, readonly string[]>>,
): Partial<Record<K, number>> {
  const H = head.map(norm);
  const r: Partial<Record<K, number>> = {};
  const used = new Set<number>();
  const keys = Object.keys(spec) as K[];
  for (const k of keys) {
    const i = H.findIndex((h, j) => !used.has(j) && spec[k].some((w) => h === norm(w)));
    if (i >= 0) {
      r[k] = i;
      used.add(i);
    }
  }
  for (const k of keys) {
    if (r[k] != null) continue;
    const i = H.findIndex(
      (h, j) => !used.has(j) && spec[k].some((w) => norm(w).length >= 4 && h.includes(norm(w))),
    );
    if (i >= 0) {
      r[k] = i;
      used.add(i);
    }
  }
  return r;
}

type DistCols = Partial<Record<keyof typeof DISTRIBUTION_COLUMNS, number>>;
type FreeCols = Partial<Record<keyof typeof FREE_TIME_COLUMNS, number>>;

export type SheetKind =
  { kind: 'dist'; row: number; cols: DistCols } | { kind: 'free'; row: number; cols: FreeCols };

/** نوع الورقة (sheetKind): البحث عن سطر العناوين في أول 6 أسطر. */
export function sheetKind(rows: Sheet): SheetKind | null {
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const h = (rows[r] ?? []).map((x) => String(x ?? ''));
    const d = findColumns(h, DISTRIBUTION_COLUMNS);
    if (d.c != null && d.s != null && d.t != null && d.h != null)
      return { kind: 'dist', row: r, cols: d };
    const f = findColumns(h, FREE_TIME_COLUMNS);
    if (f.t != null && f.d != null && f.f != null && f.to != null)
      return { kind: 'free', row: r, cols: f };
  }
  return null;
}

export interface ImportedTeacher {
  id: string;
  person_id: string;
  name: string;
  subject: string;
  classes: { class_id: string; hours: number }[];
  present: boolean;
  shared: boolean;
  unavailable: Slot[];
  other_school: Slot[];
}

export interface ImportPreview {
  ok: true;
  classes: { id: string; name: string; subjects: string[] }[];
  teachers: ImportedTeacher[];
  /** مواد غير معروفة أُضيفت كما هي (x0، x1…). */
  custom: Subject[];
  warnings: string[];
  /** عدد الأشخاص (نفس الاسم = نفس الشخص). */
  persons: number;
  /** عدد السجلات التي لها أوقات فراغ. */
  with_free: number;
}

export type ImportResult = ImportPreview | { ok: false; error: string };

const slotOf = (k: string): Slot => k.split('-').map(Number) as Slot;
const cellAt = (r: Cell[], i: number | undefined) => (i === undefined ? undefined : r[i]);

/**
 * قراءة الأوراق وبناء معاينة الاستيراد (buildImport). catalog = مواد المدرسة الحالية،
 * config = توقيت المدرسة (لتحويل أوقات "من–إلى" إلى حصص بهامش 5 دقائق).
 */
export function buildImport(
  sheets: Sheet[],
  catalog: readonly Subject[],
  config: SchoolConfig,
): ImportResult {
  const warn: string[] = [];
  const custom: Subject[] = [];
  const cls = new Map<string, { name: string; subjects: string[]; id?: string }>();
  const tch = new Map<
    string,
    {
      name: string;
      subject: string;
      cls: string[];
      hrs: Map<string, number>;
      present: boolean;
      nk: string;
    }
  >();
  const seenCS = new Set<string>();
  let dist: { rows: Sheet; row: number; cols: DistCols } | null = null;
  let free: { rows: Sheet; row: number; cols: FreeCols } | null = null;
  for (const rows of sheets) {
    const k = sheetKind(rows);
    if (!k) continue;
    if (k.kind === 'dist' && !dist) dist = { rows, row: k.row, cols: k.cols };
    if (k.kind === 'free' && !free) free = { rows, row: k.row, cols: k.cols };
  }
  if (!dist)
    return {
      ok: false,
      error: 'لم أجد جدول التوزيع. يجب أن يحتوي على الأعمدة: القسم، المادة، الأستاذ، الساعات.',
    };

  let bad = 0;
  const C = dist.cols;
  for (const r of dist.rows.slice(dist.row + 1)) {
    const cn = String(cellAt(r, C.c) ?? '').trim();
    const sn = String(cellAt(r, C.s) ?? '').trim();
    const tn = String(cellAt(r, C.t) ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    const h = Math.round(Number(String(cellAt(r, C.h) ?? '').replace(',', '.')));
    if (!cn && !sn && !tn) continue;
    if (!cn || !sn || !tn || !(h > 0)) {
      bad++;
      continue;
    }
    let s = matchSubject(sn, catalog, custom);
    if (!s) {
      s = `x${custom.length}`;
      custom.push({
        key: s,
        name: sn,
        short: sn,
        default_hours: 2,
        hue: (custom.length * 67 + 20) % 360,
        no_daily_cap: false,
        hard: false,
        prefer_double: false,
      });
      warn.push(`مادة جديدة أُضيفت كما هي: ${sn}`);
    }
    const ck = norm(cn);
    if (!cls.has(ck)) cls.set(ck, { name: cn, subjects: [] });
    const entry = cls.get(ck) as { name: string; subjects: string[] };
    if (!entry.subjects.includes(s)) entry.subjects.push(s);
    const csk = `${ck}|${s}`;
    if (seenCS.has(csk)) {
      warn.push(`${cn} · ${sn}: مذكورة أكثر من مرة، اعتمدت السطر الأول`);
      continue;
    }
    seenCS.add(csk);
    const tk = `${norm(tn)}|${s}`;
    if (!tch.has(tk))
      tch.set(tk, { name: tn, subject: s, cls: [], hrs: new Map(), present: false, nk: norm(tn) });
    const t = tch.get(tk) as NonNullable<ReturnType<typeof tch.get>>;
    t.cls.push(ck);
    t.hrs.set(ck, Math.min(8, h));
    if (C.pr != null && yes(cellAt(r, C.pr))) t.present = true;
  }
  if (bad) warn.push(`${bad} أسطر ناقصة أو غير مفهومة تم تجاهلها`);

  // الأقسام: المعرّف من الاسم
  const used = new Set<string>();
  const classes = [...cls.values()].map((c) => {
    const base = c.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'C';
    let id = base;
    let i = 2;
    while (used.has(id)) id = base + i++;
    used.add(id);
    c.id = id;
    return { id, name: c.name, subjects: c.subjects };
  });
  const classId = (ck: string) => cls.get(ck)?.id as string;

  // الأساتذة: نفس الاسم = نفس الشخص
  const pidOf = new Map<string, string>();
  const teachers: ImportedTeacher[] = [];
  let ti = 0;
  for (const t of tch.values()) {
    const id = `t${++ti}`;
    if (!pidOf.has(t.nk)) pidOf.set(t.nk, id);
    teachers.push({
      id,
      person_id: pidOf.get(t.nk) as string,
      name: t.name,
      subject: t.subject,
      classes: t.cls.map((ck) => ({ class_id: classId(ck), hours: t.hrs.get(ck) as number })),
      present: t.present,
      shared: false,
      unavailable: [],
      other_school: [],
    });
  }
  for (const x of teachers)
    if (x.person_id !== x.id) {
      const r = teachers.find((z) => z.id === x.person_id);
      if (r && (r.present || x.present)) r.present = x.present = true;
    }

  // أوقات الفراغ
  let withFree = 0;
  if (free) {
    const grid = makeGrid(config);
    const P = grid.periods;
    const PR = periodTimes(config);
    const F = free.cols;
    const byT = new Map<string, { f: Set<string>; x: Set<string>; u: Set<string> }>();
    let fbad = 0;
    for (const r of free.rows.slice(free.row + 1)) {
      const tn = norm(String(cellAt(r, F.t) ?? '').replace(/\s+/g, ' '));
      const d = parseDay(cellAt(r, F.d));
      const a = parseTime(cellAt(r, F.f));
      const b = parseTime(cellAt(r, F.to));
      if (!tn && d < 0) continue;
      if (!tn || d < 0 || a == null || b == null || b <= a) {
        fbad++;
        continue;
      }
      const st = norm(cellAt(r, F.st) ?? '');
      const kind = /مدرس|autre|ecole/.test(st) ? 'x' : /غير|indispo|non/.test(st) ? 'u' : 'f';
      if (!byT.has(tn)) byT.set(tn, { f: new Set(), x: new Set(), u: new Set() });
      const e = byT.get(tn) as { f: Set<string>; x: Set<string>; u: Set<string> };
      for (let p = 0; p < P; p++) {
        const [s0, s1] = PR[p] as [string, string];
        if (toMinutes(s0) >= a - 5 && toMinutes(s1) <= b + 5) e[kind].add(`${d}-${p}`);
      }
    }
    if (fbad) warn.push(`${fbad} أسطر في أوقات الفراغ غير مفهومة تم تجاهلها`);
    const all: string[] = [];
    for (let d = 0; d < 6; d++)
      for (let p = 0; p < P; p++) if (grid.isValid(d, p)) all.push(`${d}-${p}`);
    for (const t of teachers) {
      const e = byT.get(norm(t.name));
      if (!e) continue;
      withFree++;
      t.other_school = [...e.x].map(slotOf);
      t.unavailable = (e.f.size ? all.filter((k) => !e.f.has(k) && !e.x.has(k)) : [...e.u]).map(
        slotOf,
      );
      if (t.other_school.length) t.shared = true;
    }
    const names = new Set(teachers.map((t) => norm(t.name)));
    for (const n of byT.keys())
      if (!names.has(n)) warn.push(`أوقات فراغ لأستاذ غير موجود في التوزيع: ${n}`);
  }
  const persons = new Set(teachers.map((t) => t.person_id)).size;
  if (!free) warn.push('لا يوجد جدول أوقات الفراغ: سيُعتبر كل الأساتذة متاحين طول الأسبوع');
  else if (withFree < persons)
    warn.push(`${persons - withFree} أساتذة بدون أوقات فراغ: سيُعتبرون متاحين طول الأسبوع`);
  return { ok: true, classes, teachers, custom, warnings: warn, persons, with_free: withFree };
}

/**
 * تطبيق الاستيراد (applyImport): يعوّض الأقسام والأساتذة، ويضيف المواد الجديدة إلى الكتالوج،
 * ويرتب الأقسام. الجدول يُفرغ (يُعاد توليده بعد ذلك).
 */
export function applyImport(base: SchoolData, preview: ImportPreview): SchoolData {
  const subjects = [...base.subjects];
  const have = new Set(subjects.map((s) => s.key));
  const used = new Set(preview.classes.flatMap((c) => c.subjects));
  for (const s of DEFAULT_SUBJECTS)
    if (used.has(s.key) && !have.has(s.key)) {
      subjects.push({ ...s });
      have.add(s.key);
    }
  for (const s of preview.custom) if (!have.has(s.key)) subjects.push(s);

  const persons = new Map<string, SchoolData['persons'][number]>();
  for (const t of preview.teachers) {
    const p = persons.get(t.person_id);
    if (!p)
      persons.set(t.person_id, {
        id: t.person_id,
        full_name: t.name,
        present: t.present,
        shared: t.shared,
        unavailable: t.unavailable,
        other_school: t.other_school,
      });
    else {
      p.present ||= t.present;
      p.shared ||= t.shared;
    }
  }
  const school: SchoolData = {
    ...structuredClone(base),
    subjects,
    classes: preview.classes.map((c) => ({
      id: c.id,
      name: c.name,
      level_rank: levelRank(c.name),
      subjects: [...c.subjects],
    })),
    persons: [...persons.values()],
    teachers: preview.teachers.map((t) => ({
      id: t.id,
      person_id: t.person_id,
      subject: t.subject,
      classes: t.classes.map((c) => ({ ...c })),
    })),
    locked_classes: [],
  };
  sortClasses(school);
  return school;
}
