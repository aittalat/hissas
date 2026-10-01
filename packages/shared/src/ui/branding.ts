import type { SchoolConfig } from '../contract/school';

/**
 * هوية المدرسة (SPEC §4): الألوان، لون النص فوق لون المدرسة، متغيرات CSS في الوضعين،
 * الحرف الأول للشعار، الرابط. منقول من inkOn، applyBrand، logoHTML، slugify في النموذج الأولي.
 */

export const PLATFORM_NAME = 'حصص';
export const PLATFORM_DOMAIN = 'hissas.ma';
export const DEFAULT_BRAND_COLOR = '#1D5A48';

/** الألوان المقترحة عند إنشاء مدرسة (BRANDS). */
export const BRAND_COLORS = [
  '#1D5A48',
  '#1F4E9C',
  '#8C2F39',
  '#6A3FA0',
  '#B35C00',
  '#0F6E7A',
  '#2B2B2B',
  '#C2185B',
] as const;

/** لون النص المقروء فوق لون (inkOn): أسود للألوان الفاتحة، أبيض للداكنة. */
export function inkOn(hex: string): '#111' | '#fff' {
  const n = parseInt(String(hex).slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111' : '#fff';
}

export interface BrandVars {
  '--accent': string;
  '--accent-ink': string;
  '--accent-soft': string;
}

/**
 * متغيرات CSS من لون المدرسة (applyBrand): في الوضع الفاتح اللون نفسه، وفي الداكن لون أفتح
 * (مزج 58% مع الأبيض). لون غير صالح ← اللون الافتراضي.
 */
export function brandVars(color: string): { light: BrandVars; dark: BrandVars } {
  const c = /^#[0-9a-f]{6}$/i.test(color || '') ? color : DEFAULT_BRAND_COLOR;
  return {
    light: {
      '--accent': c,
      '--accent-ink': inkOn(c),
      '--accent-soft': `color-mix(in srgb,${c} 14%,#FFFFFF)`,
    },
    dark: {
      '--accent': `color-mix(in srgb,${c} 58%,#FFFFFF)`,
      '--accent-ink': '#0B1410',
      '--accent-soft': `color-mix(in srgb,${c} 30%,#151D19)`,
    },
  };
}

/** نص CSS كامل لهوية المدرسة (نفس ما يحقنه النموذج الأولي في #brandcss). */
export function brandCss(color: string): string {
  const { light, dark } = brandVars(color);
  const decl = (v: BrandVars) =>
    Object.entries(v)
      .map(([k, x]) => `${k}:${x}`)
      .join(';');
  const d = `${decl(dark)};`;
  return `:root{${decl(light)}}\n@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${d}}}:root[data-theme="dark"]{${d}}`;
}

/** الحرف الأول لشعار المدرسة بدون صورة (logoHTML): بعد حذف "مدرسة/école/GS/groupe scolaire". */
export function logoInitial(name: string): string {
  return (
    [...String(name || '?').replace(/^(مدرسة|ecole|école|gs|groupe scolaire)\s+/i, '')][0] || '?'
  );
}

/** الحرف الأول في أيقونة التطبيق (appPreview). */
export function appIconInitial(name: string): string {
  return [...String(name || '?')][0] || '?';
}

/**
 * الاسم في الرابط slug.hissas.ma (slugify): حروف لاتينية صغيرة وأرقام وشرطات، 30 حرفا كحد أقصى،
 * "ecole" إذا فرغ، ورقم عند التكرار مع مدرسة أخرى.
 */
export function slugify(name: string, taken: readonly string[] = []): string {
  const b =
    String(name || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'ecole';
  let s = b;
  let i = 2;
  while (taken.includes(s)) s = `${b}-${i++}`;
  return s;
}

/** درجة لون ثابتة من نص (hueOf): لبطاقات الأقسام والصور الرمزية. */
export function hueOf(s: string): number {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** الحروف الأولى لاسم (initials): أول حرف من أول كلمتين، بفاصل ZWNJ. */
export function initials(name: string): string {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0])
    .join('‌');
}

/** درجة لون الصورة الرمزية: ذكر 210، أنثى 330، وإلا من الاسم. */
export function avatarHue(name: string, gender?: 'm' | 'f' | null): number {
  return gender === 'f' ? 330 : gender === 'm' ? 210 : hueOf(name);
}

/** الإعدادات السريعة لتوقيت المدرسة (PRESETS). */
export const TIMING_PRESETS: readonly {
  label: string;
  config: Pick<
    SchoolConfig,
    'period_minutes' | 'am_start' | 'am_count' | 'pm_start' | 'pm_count' | 'break_after_2nd_minutes'
  >;
}[] = [
  {
    label: 'ساعة · تبدأ 08:00',
    config: {
      period_minutes: 60,
      am_start: '08:00',
      am_count: 4,
      pm_start: '14:00',
      pm_count: 4,
      break_after_2nd_minutes: 0,
    },
  },
  {
    label: 'ساعة · تبدأ 08:30',
    config: {
      period_minutes: 60,
      am_start: '08:30',
      am_count: 4,
      pm_start: '14:30',
      pm_count: 3,
      break_after_2nd_minutes: 0,
    },
  },
  {
    label: '45 دقيقة · تبدأ 08:00',
    config: {
      period_minutes: 45,
      am_start: '08:00',
      am_count: 5,
      pm_start: '14:00',
      pm_count: 4,
      break_after_2nd_minutes: 15,
    },
  },
  {
    label: '45 دقيقة · تبدأ 08:30',
    config: {
      period_minutes: 45,
      am_start: '08:30',
      am_count: 5,
      pm_start: '14:30',
      pm_count: 4,
      break_after_2nd_minutes: 15,
    },
  },
];

/** نظام اليوم في شاشة التوقيت (DAYMODES). */
export const DAY_MODE_LABELS = { full: 'يوم كامل', am: 'صباح فقط', off: 'عطلة' } as const;

/** التوقيت الافتراضي لمدرسة جديدة (DEFCFG). */
export const DEFAULT_CONFIG: SchoolConfig = {
  period_minutes: 60,
  am_start: '08:00',
  am_count: 4,
  pm_start: '14:00',
  pm_count: 4,
  break_after_2nd_minutes: 0,
  pairing_mode: 2,
  days: ['full', 'full', 'full', 'full', 'full', 'off'],
};

/** أوقات كل 15 دقيقة بين وقتين (timeList)، لقوائم بداية الصباح والمساء. */
export function timeList(from: string, to: string): string[] {
  const m = (x: string) => {
    const [h = 0, mi = 0] = x.split(':').map(Number);
    return h * 60 + mi;
  };
  const f = (t: number) =>
    `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  const r: string[] = [];
  for (let t = m(from); t <= m(to); t += 15) r.push(f(t));
  return r;
}

/** خيارات شاشة التوقيت (viewCfg). */
export const TIMING_CHOICES = {
  period_minutes: [45, 50, 55, 60],
  am_count: [3, 4, 5, 6],
  pm_count: [0, 2, 3, 4, 5],
  break_after_2nd_minutes: [0, 10, 15, 20],
  /** بداية الصباح 07:30–09:00 وبداية المساء 13:00–15:00. */
  am_start_range: ['07:30', '09:00'],
  pm_start_range: ['13:00', '15:00'],
} as const;
