import { z } from 'zod';
import { PlacementSchema, SchoolDataSchema } from './school';

/** مؤشرات النموذج الأولي كما تحسبها metrics() حرفيا. */
export const PrototypeMetricsSchema = z.object({
  gaps: z.number().int(),
  dups: z.number().int(),
  tgaps: z.number().int(),
  lone: z.number().int(),
  split: z.number().int(),
  unplaced: z.number().int(),
  placed: z.number().int(),
  total: z.number().int(),
});
export type PrototypeMetrics = z.infer<typeof PrototypeMetricsSchema>;

export const OracleRunSchema = z.object({
  seed: z.number().int(),
  budget_ms: z.number().int(),
  metrics: PrototypeMetricsSchema,
  /** عدد الساعات في conflictSet() (تعارض، وقت محجوب، أكثر من ساعتين). */
  conflicts: z.number().int(),
  quality: z.number().int(),
  placements: z.array(PlacementSchema),
});
export type OracleRun = z.infer<typeof OracleRunSchema>;

/** ما يطلبه SPEC §6.5 للسيناريو (القيم الغائبة غير مشروطة). */
export const ExpectationSchema = z.object({
  conflicts: z.number().int().optional(),
  unplaced: z.number().int().optional(),
  split: z.number().int().optional(),
  tgaps: z.number().int().optional(),
  lone: z.number().int().optional(),
  diagnose_includes: z.array(z.string()).optional(),
});

/** ملف سيناريو: البيانات + ما يطلبه SPEC + ما أنتجه النموذج الأولي فعلا. */
export const ScenarioSchema = z.object({
  scenario: z.string(),
  title: z.string(),
  spec: z.string(),
  prototype_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  school: SchoolDataSchema,
  expected: ExpectationSchema,
  prototype: z.object({
    diagnose: z.array(z.string()),
    /** الأشخاص الذين يُضطرون رياضيا ليوم بساعة واحدة (forcedLone). */
    forced_lone: z.array(z.string()),
    /** الساعات المطلوبة والحد الأقصى الممكن لكل شخص (tMax). */
    t_max: z.array(
      z.object({ person_id: z.string(), need: z.number().int(), max: z.number().int() }),
    ),
    runs: z.array(OracleRunSchema).min(1),
    /** عناوين اقتراحات advise() لأفضل تشغيل. */
    advise_titles: z.array(z.string()),
  }),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
