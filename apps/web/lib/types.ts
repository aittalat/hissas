import type {
  ApprovedAbsence,
  ApprovedSubstitution,
  Notice,
  ParentMessage,
  Placement,
  SchoolData,
  SchoolLife,
} from '@hissas/shared';

/**
 * حالة المنصة في المتصفح (مرحلة "الواجهات أولا"): كل مدرسة ببياناتها المعزولة.
 * تُستبدل لاحقا بقاعدة البيانات عبر نفس واجهة store.ts.
 */

export interface SchoolMeta {
  id: string;
  name: string;
  /** slug.hissas.ma */
  slug: string;
  color: string;
  /** Data URL مؤقتا (S3 لاحقا). */
  logo: string | null;
  created: number;
}

export interface TimedNotice extends Notice {
  id: string;
  ts: number;
}

export interface TimedMessage extends ParentMessage {
  id: string;
  ts: number;
}

export interface SchoolState {
  school: SchoolData;
  placements: Placement[];
  /** تغيّرت البيانات بعد آخر توليد. */
  dirty: boolean;
  life: SchoolLife;
  absences: ApprovedAbsence[];
  substitutions: ApprovedSubstitution[];
  /** إشعارات عامة أو لأولياء قسم (note). */
  notices: TimedNotice[];
  /** رسائل خاصة لولي تلميذ (غياب، حادثة). */
  messages: TimedMessage[];
  /** سجل شبكة الأساتذة المشتركين. */
  netLog: { ts: number; text: string }[];
}

export interface PlatformState {
  v: 1;
  current: string | null;
  schools: SchoolMeta[];
  data: Record<string, SchoolState>;
}
