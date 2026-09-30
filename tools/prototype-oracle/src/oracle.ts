import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Change, Placement, PrototypeMetrics, SchoolData, Slot } from '@hissas/shared';
import { chromium, type Browser, type Page } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '../../..');
export const PROTOTYPE_PATH = resolve(REPO_ROOT, 'reference/prototype.html');
const BRIDGE_PATH = resolve(here, 'bridge.js');
const INIT_PATH = resolve(here, 'init.js');

export function prototypeSha256(): string {
  return createHash('sha256').update(readFileSync(PROTOTYPE_PATH)).digest('hex');
}

export interface Measure {
  metrics: PrototypeMetrics;
  conflicts: number;
  quality: number;
}

export interface TMaxRow {
  person_id: string;
  need: number;
  max: number;
}

/** دوال الجسر المحقون في الصفحة (انظر bridge.js). */
interface Bridge {
  seedDemo(): void;
  exportSchool(name?: string): SchoolData;
  loadSchool(data: SchoolData): void;
  placements(): Placement[];
  setPlacements(list: Placement[]): void;
  measure(): Measure;
  diagnose(): string[];
  tMax(): TMaxRow[];
  forcedLone(): string[];
  generate(budget: number): void;
  adviseTitles(): string[];
  inspect(unitKeys: string[]): Inspection;
  groups(): ProtoGroups;
  lone(): ProtoLone[];
  adviseAll(): ProtoAdvice[];
  applyAdvice(i: number, j: number): { school: SchoolData; placements: Placement[] };
  targets(keys: string[]): Record<string, ProtoTarget>;
  diff(s0: SchoolData, p0: Placement[], s1: SchoolData, p1: Placement[]): Change[];
}

export interface ProtoAdviceFlags {
  run: boolean;
  regen: boolean;
  fix: boolean;
  deep: boolean;
  goto: string | null;
  teacher: string | null;
}
export interface ProtoAdvice {
  title: string;
  detail: string;
  options: { label: string; effects: string[]; flags: ProtoAdviceFlags }[];
}

export interface ProtoLone {
  person_id: string;
  day: number;
  unit: string;
  proposals: {
    moves: { unit: string; day: number; period: number }[];
    after: PrototypeMetrics;
    score: number;
  }[];
}

export interface ProtoGroup {
  day: number;
  period: number;
  units: string[];
}
export interface ProtoGroups {
  classes: Record<string, ProtoGroup[]>;
  persons: Record<string, ProtoGroup[]>;
}
export type ProtoTarget = { kind: 'move' } | { kind: 'swap'; with: string[] };

export interface Inspection {
  /** مفاتيح الوحدات في conflictSet، مرتبة. */
  conflicts: string[];
  /** لكل وحدة مطلوبة: الخانات التي يقبلها fits بعد رفعها من مكانها. */
  targets: Record<string, Slot[]>;
}

declare global {
  interface Window {
    __oracle: Bridge;
    __seedRandom(seed: number): void;
  }
}

function launchOptions() {
  // في بيئات فيها Chromium مثبت مسبقا بإصدار مختلف عن Playwright
  const path = process.env.CHROMIUM_PATH;
  if (path && existsSync(path)) return { executablePath: path };
  return {};
}

export class PrototypeOracle {
  private constructor(
    private readonly browser: Browser,
    private readonly page: Page,
  ) {}

  static async open(): Promise<PrototypeOracle> {
    const browser = await chromium.launch(launchOptions());
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // مكتبة xlsx من CDN غير لازمة للحساب
    await page.route(/cdnjs\.cloudflare\.com/, (r) => r.abort());
    await page.addInitScript({ path: INIT_PATH });
    await page.goto(pathToFileURL(PROTOTYPE_PATH).href);
    await page.addScriptTag({ path: BRIDGE_PATH });
    if (errors.length) throw new Error(`أخطاء في النموذج الأولي: ${errors.join(' | ')}`);
    return new PrototypeOracle(browser, page);
  }

  close(): Promise<void> {
    return this.browser.close();
  }

  seedRandom(seed: number): Promise<void> {
    return this.page.evaluate((s) => window.__seedRandom(s), seed);
  }

  /** بيانات seed() للنموذج الأولي (8 أقسام، 17 أستاذا، 205 ساعات). */
  async demoSchool(name = 'مدرسة تجريبية'): Promise<SchoolData> {
    return this.page.evaluate((n) => {
      window.__oracle.seedDemo();
      return window.__oracle.exportSchool(n);
    }, name);
  }

  load(school: SchoolData, placements: Placement[] = []): Promise<void> {
    return this.page.evaluate(
      ([s, p]) => {
        window.__oracle.loadSchool(s);
        window.__oracle.setPlacements(p);
      },
      [school, placements] as const,
    );
  }

  exportSchool(): Promise<SchoolData> {
    return this.page.evaluate(() => window.__oracle.exportSchool());
  }

  placements(): Promise<Placement[]> {
    return this.page.evaluate(() => window.__oracle.placements());
  }

  measure(): Promise<Measure> {
    return this.page.evaluate(() => window.__oracle.measure());
  }

  diagnose(): Promise<string[]> {
    return this.page.evaluate(() => window.__oracle.diagnose());
  }

  tMax(): Promise<TMaxRow[]> {
    return this.page.evaluate(() => window.__oracle.tMax());
  }

  forcedLone(): Promise<string[]> {
    return this.page.evaluate(() => window.__oracle.forcedLone());
  }

  adviseTitles(): Promise<string[]> {
    return this.page.evaluate(() => window.__oracle.adviseTitles());
  }

  inspect(unitKeys: string[]): Promise<Inspection> {
    return this.page.evaluate((k) => window.__oracle.inspect(k), unitKeys);
  }

  adviseAll(): Promise<ProtoAdvice[]> {
    return this.page.evaluate(() => window.__oracle.adviseAll());
  }

  applyAdvice(i: number, j: number): Promise<{ school: SchoolData; placements: Placement[] }> {
    return this.page.evaluate(([a, b]) => window.__oracle.applyAdvice(a, b), [i, j] as const);
  }

  lone(): Promise<ProtoLone[]> {
    return this.page.evaluate(() => window.__oracle.lone());
  }

  groups(): Promise<ProtoGroups> {
    return this.page.evaluate(() => window.__oracle.groups());
  }

  targets(keys: string[]): Promise<Record<string, ProtoTarget>> {
    return this.page.evaluate((k) => window.__oracle.targets(k), keys);
  }

  diff(s0: SchoolData, p0: Placement[], s1: SchoolData, p1: Placement[]): Promise<Change[]> {
    return this.page.evaluate(([a, b, c, d]) => window.__oracle.diff(a, b, c, d), [
      s0,
      p0,
      s1,
      p1,
    ] as const);
  }

  /** generate() كما هو: بحث محلي عشوائي بميزانية زمنية (قد يمتد 12 ث للحصص بدون مكان). */
  async generate(seed: number, budgetMs: number): Promise<Placement[]> {
    await this.seedRandom(seed);
    await this.page.evaluate((b) => window.__oracle.generate(b), budgetMs);
    return this.placements();
  }
}
