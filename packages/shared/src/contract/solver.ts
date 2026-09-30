import { z } from 'zod';
import { PrototypeMetricsSchema } from './oracle';
import { PlacementSchema, SchoolDataSchema, SlotSchema } from './school';

/**
 * عقد المحرك (services/solver). مصدر واحد: هذه المخططات ← JSON Schema ← نماذج pydantic.
 * المحرك يتلقى بيانات المدرسة كاملة ومكتفية بذاتها، ولا يتصل بقاعدة البيانات.
 */

export const SolveOptionsSchema = z
  .object({
    /** المهلة القصوى للحل (SPEC §9: < 30 ث لمدرسة من 30 قسما). */
    time_limit_s: z.number().positive().max(120).default(20),
    random_seed: z.number().int().min(0).default(0),
    workers: z.number().int().min(1).max(16).default(8),
  })
  .meta({ id: 'SolveOptions' });

/** المؤشرات المعروضة (SPEC §6.4) بنفس حساب النموذج الأولي. */
export const EvaluationSchema = z
  .object({
    metrics: PrototypeMetricsSchema,
    /** عدد الساعات المخالفة للقيود (conflictSet). */
    conflicts: z.number().int(),
    /** الجودة /100. */
    quality: z.number().int(),
  })
  .meta({ id: 'Evaluation' });

export const SolveStatusSchema = z
  .enum(['optimal', 'feasible', 'infeasible', 'unknown'])
  .meta({ id: 'SolveStatus' });

export const ChangeSchema = z
  .object({
    class_id: z.string(),
    subject: z.string(),
    from: SlotSchema.nullable(),
    to: SlotSchema.nullable(),
    add: z.boolean().optional(),
    del: z.boolean().optional(),
  })
  .meta({ id: 'Change' });

const school = SchoolDataSchema;
const placements = z.array(PlacementSchema);

/** POST /solve — جدول كامل. الأقسام المقفلة تبقى على خاناتها في current. */
export const SolveRequestSchema = z
  .object({
    school,
    current: placements.default([]),
    options: SolveOptionsSchema.prefault({}),
  })
  .meta({ id: 'SolveRequest' });

export const SolveResponseSchema = z
  .object({
    status: SolveStatusSchema,
    placements,
    evaluation: EvaluationSchema,
    /** قيمة دالة الهدف (بالأوزان ×2). */
    objective: z.number(),
    wall_time_s: z.number(),
    /** أسباب الحصص بدون مكان (فارغة إذا وُضع كل شيء). */
    diagnose: z.array(z.string()),
  })
  .meta({ id: 'SolveResponse' });

export const RepairKindSchema = z
  .enum(['min_change', 'balanced', 'best_quality'])
  .meta({ id: 'RepairKind' });

/** POST /repair — تحسين جدول موجود بعقوبة على كل حصة تتحرك (SPEC §6.4). */
export const RepairRequestSchema = z
  .object({
    school,
    current: placements,
    options: SolveOptionsSchema.prefault({}),
  })
  .meta({ id: 'RepairRequest' });

export const RepairSolutionSchema = z
  .object({
    kind: RepairKindSchema,
    placements,
    evaluation: EvaluationSchema,
    changes: z.array(ChangeSchema),
  })
  .meta({ id: 'RepairSolution' });

export const RepairResponseSchema = z
  .object({
    before: EvaluationSchema,
    /** حتى 3 حلول مختلفة: أقل تغيير، متوازن، أفضل جودة. */
    solutions: z.array(RepairSolutionSchema),
  })
  .meta({ id: 'RepairResponse' });

export const MaxPossibleSchema = z
  .object({ person_id: z.string(), need: z.number().int(), max: z.number().int() })
  .meta({ id: 'MaxPossible' });

/** POST /diagnose — أسباب الحصص بدون مكان والأيام المشكلة (SPEC §6.3). */
export const DiagnoseRequestSchema = z
  .object({
    school,
    current: placements.default([]),
    options: SolveOptionsSchema.prefault({}),
  })
  .meta({ id: 'DiagnoseRequest' });

export const DiagnoseResponseSchema = z
  .object({
    /** رسائل قبل الحل (الحد الأقصى الممكن، الخانات، سعة الأقسام). */
    reasons: z.array(z.string()),
    max_possible: z.array(MaxPossibleSchema),
    /** أشخاص يُضطرون رياضيا ليوم بساعة واحدة. */
    forced_lone: z.array(z.string()),
    /** القيود المتعارضة (من assumptions في CP-SAT) — تُملأ في الخطوة 3. */
    conflicting_constraints: z.array(z.string()),
  })
  .meta({ id: 'DiagnoseResponse' });

export type SolveOptions = z.infer<typeof SolveOptionsSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type SolveRequest = z.input<typeof SolveRequestSchema>;
export type SolveResponse = z.infer<typeof SolveResponseSchema>;
export type RepairRequest = z.input<typeof RepairRequestSchema>;
export type RepairResponse = z.infer<typeof RepairResponseSchema>;
export type DiagnoseRequest = z.input<typeof DiagnoseRequestSchema>;
export type DiagnoseResponse = z.infer<typeof DiagnoseResponseSchema>;

/** كل مخططات العقد، بالاسم الذي يظهر في JSON Schema وفي pydantic. */
export const SOLVER_CONTRACT = {
  SolveRequest: SolveRequestSchema,
  SolveResponse: SolveResponseSchema,
  RepairRequest: RepairRequestSchema,
  RepairResponse: RepairResponseSchema,
  DiagnoseRequest: DiagnoseRequestSchema,
  DiagnoseResponse: DiagnoseResponseSchema,
} as const;
