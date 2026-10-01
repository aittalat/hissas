import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ScenarioSchema, type Scenario } from './oracle';
import { SchoolDataSchema, totalHours } from './school';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = resolve(root, 'fixtures/scenarios');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f: string): Scenario =>
  ScenarioSchema.parse(JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
const scenarios = files.map(load);
const byId = (id: string) => {
  const s = scenarios.find((x) => x.scenario === id);
  if (!s) throw new Error(`سيناريو غير موجود: ${id}`);
  return s;
};

describe('fixtures من النموذج الأولي', () => {
  it('تحتوي سيناريوهات القبول الخمسة لـ SPEC §6.5', () => {
    expect(scenarios.map((s) => s.scenario).sort()).toEqual([
      '6.5-1-demo',
      '6.5-2-all-not-present',
      '6.5-3-max-16',
      '6.5-4-45min-0830',
      '6.5-5-two-subjects',
    ]);
  });

  it('البيانات التجريبية: 8 أقسام، 17 أستاذا، 205 ساعات', () => {
    const { school } = byId('6.5-1-demo');
    expect(school.classes).toHaveLength(8);
    expect(school.persons).toHaveLength(17);
    expect(totalHours(school)).toBe(205);
  });

  it('مولَّدة من النسخة الحالية لـ reference/prototype.html', () => {
    const sha = createHash('sha256')
      .update(readFileSync(resolve(root, '../../reference/prototype.html')))
      .digest('hex');
    for (const s of scenarios) expect(s.prototype_sha256, s.scenario).toBe(sha);
  });

  it.each(scenarios.map((s) => [s.scenario, s] as const))(
    '%s: أفضل تشغيل للنموذج الأولي يحقق ما يطلبه SPEC',
    (_id, s) => {
      const best = s.prototype.runs.reduce((a, b) => (b.quality > a.quality ? b : a));
      const e = s.expected;
      if (e.conflicts !== undefined) expect(best.conflicts).toBe(e.conflicts);
      for (const k of ['unplaced', 'split', 'tgaps', 'lone'] as const)
        if (e[k] !== undefined) expect(best.metrics[k], k).toBe(e[k]);
      for (const part of e.diagnose_includes ?? [])
        expect(
          s.prototype.diagnose.some((d) => d.includes(part)),
          part,
        ).toBe(true);
    },
  );

  it('كل الساعات الموضوعة تشير إلى ساعات موجودة في البيانات', () => {
    for (const s of scenarios) {
      const hours = new Map<string, number>();
      for (const t of s.school.teachers)
        for (const c of t.classes) hours.set(`${c.class_id}|${t.subject}`, c.hours);
      for (const run of s.prototype.runs)
        for (const p of run.placements) {
          const h = hours.get(`${p.class_id}|${p.subject}`);
          expect(h, `${s.scenario} ${p.class_id}|${p.subject}`).toBeDefined();
          expect(p.index).toBeLessThan(h ?? 0);
        }
    }
  });
});

describe('SchoolDataSchema', () => {
  const demo = byId('6.5-1-demo').school;

  it('يرفض مادة في قسم بأستاذين', () => {
    const bad = structuredClone(demo);
    const t = bad.teachers.find((x) => x.classes.length > 0);
    const first = t?.classes[0];
    if (!t || !first) throw new Error('لا يوجد سجل بأقسام');
    bad.teachers.push({ ...t, id: 'dup', classes: [first] });
    expect(SchoolDataSchema.safeParse(bad).success).toBe(false);
  });

  it('يرفض سجلا يشير إلى شخص غير موجود', () => {
    const bad = structuredClone(demo);
    bad.teachers = bad.teachers.map((t, i) => (i === 0 ? { ...t, person_id: 'nobody' } : t));
    expect(SchoolDataSchema.safeParse(bad).success).toBe(false);
  });

  it('يرفض أياما غير الستة', () => {
    const bad = structuredClone(demo) as unknown as { config: { days: string[] } };
    bad.config.days = ['full', 'full', 'full', 'full', 'full'];
    expect(SchoolDataSchema.safeParse(bad).success).toBe(false);
  });
});
