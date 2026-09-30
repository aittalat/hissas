import { z } from 'zod';

/**
 * بيانات الحياة المدرسية (SPEC §5، واجهة الحارس العام §7.10). الحقول بأسماء قاعدة البيانات.
 * التواريخ بصيغة YYYY-MM-DD.
 */

const id = z.string().regex(/^[A-Za-z0-9_.-]+$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ParentSchema = z.object({
  id,
  full_name: z.string().min(1),
  phone: z.string(),
  relation: z.enum(['father', 'mother', 'guardian']),
});
export type Parent = z.infer<typeof ParentSchema>;

export const StudentSchema = z.object({
  id,
  class_id: id,
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  gender: z.enum(['m', 'f']),
  birth_date: z.string(),
  matricule: z.string(),
  massar_code: z.string().nullable().default(null),
  parent_id: id,
  status: z.enum(['active', 'archived']),
  health_note: z.string().default(''),
  photo_consent: z.boolean(),
  is_new: z.boolean(),
});
export type Student = z.infer<typeof StudentSchema>;

export const AttendanceSchema = z.object({
  id,
  student_id: id,
  date: isoDate,
  period: z.number().int().min(0),
  type: z.enum(['absent', 'late']),
  late_minutes: z.number().int().min(0),
  justified: z.boolean(),
  reason: z.string(),
  comment: z.string(),
  parent_message_status: z.enum(['pending', 'sent', 'read']),
});
export type AttendanceRecord = z.infer<typeof AttendanceSchema>;

export const IncidentSchema = z.object({
  id,
  student_id: id,
  date: isoDate,
  time: z.string(),
  title: z.string().min(1),
  type: z.enum(['negative', 'positive']),
  gravity: z.enum(['light', 'medium', 'serious']),
  measure: z.string(),
  description: z.string(),
  visible_to_parent: z.boolean(),
  recorded_by: z.string(),
});
export type Incident = z.infer<typeof IncidentSchema>;

export const ParentMeetingSchema = z.object({
  id,
  student_id: id,
  date: isoDate,
  reason: z.string().min(1),
  requested_by: z.string(),
  school_attendees: z.string(),
  family_attendees: z.string(),
  discussed_points: z.string(),
  agreed_measures: z.string(),
});
export type ParentMeeting = z.infer<typeof ParentMeetingSchema>;

export const SchoolRulesSchema = z.object({
  monthly_absence_alert: z.number().int().min(1).default(4),
  late_threshold_minutes: z.number().int().min(0).default(15),
});
export type SchoolRules = z.infer<typeof SchoolRulesSchema>;

/** كل بيانات الحياة المدرسية لمدرسة (للحساب في الذاكرة). */
export interface SchoolLife {
  students: Student[];
  parents: Parent[];
  attendance: AttendanceRecord[];
  incidents: Incident[];
  meetings: ParentMeeting[];
  rules: SchoolRules;
}
