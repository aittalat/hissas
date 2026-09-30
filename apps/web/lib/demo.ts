import demoFixture from '@hissas/shared/fixtures/scenarios/6.5-1-demo.json';
import {
  DEFAULT_CONFIG,
  DEFAULT_SUBJECTS,
  ScenarioSchema,
  demoLife,
  noticePublished,
  type SchoolData,
} from '@hissas/shared';
import type { SchoolMeta, SchoolState } from './types';

const scenario = ScenarioSchema.parse(demoFixture);

export const uid = () => Math.random().toString(36).slice(2, 9);

/** المدرسة التجريبية: بيانات seed() في النموذج الأولي وأفضل جدول ولّده. */
export function demoSchoolState(name: string, now = new Date()): SchoolState {
  const school: SchoolData = { ...structuredClone(scenario.school), name };
  const best = scenario.prototype.runs.reduce((a, b) => (b.quality > a.quality ? b : a));
  return {
    school,
    placements: structuredClone(best.placements),
    dirty: false,
    life: demoLife(school, now),
    absences: [],
    substitutions: [],
    notices: [{ ...noticePublished(), id: uid(), ts: now.getTime() }],
    messages: [],
    docs: [],
    netLog: [],
  };
}

/** مدرسة فارغة: التوقيت الافتراضي وكتالوج المواد فقط (emptyData). */
export function emptySchoolState(name: string): SchoolState {
  return {
    school: {
      version: 1,
      name,
      config: structuredClone(DEFAULT_CONFIG),
      subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })),
      classes: [],
      persons: [],
      teachers: [],
      locked_classes: [],
    },
    placements: [],
    dirty: false,
    life: {
      students: [],
      parents: [],
      attendance: [],
      incidents: [],
      meetings: [],
      rules: { monthly_absence_alert: 4, late_threshold_minutes: 15 },
    },
    absences: [],
    substitutions: [],
    notices: [],
    messages: [],
    docs: [],
    netLog: [],
  };
}

export function demoMeta(): SchoolMeta {
  return {
    id: `s${uid()}`,
    name: 'مدرسة تجريبية',
    slug: 'demo',
    color: '#1D5A48',
    logo: null,
    created: Date.now(),
  };
}
