import type { SchoolConfig, SchoolData } from '../contract/school';
import type { Placement } from '../contract/school';

/** مدرسة صغيرة للاختبارات: 4 حصص صباحا و4 مساء، الإثنين–الجمعة، والسبت عطلة. */
export function tinySchool(over: Partial<SchoolData> = {}): SchoolData {
  const config: SchoolConfig = {
    period_minutes: 60,
    am_start: '08:00',
    am_count: 4,
    pm_start: '14:00',
    pm_count: 4,
    break_after_2nd_minutes: 0,
    pairing_mode: 2,
    days: ['full', 'full', 'full', 'full', 'full', 'off'],
  };
  const subject = (key: string, extra: Partial<SchoolData['subjects'][number]> = {}) => ({
    key,
    name: key,
    short: key,
    default_hours: 2,
    hue: 0,
    no_daily_cap: false,
    hard: false,
    prefer_double: false,
    ...extra,
  });
  return {
    version: 1,
    name: 'test',
    config,
    subjects: [subject('ma'), subject('fr'), subject('cpt', { no_daily_cap: true })],
    classes: [
      { id: 'A', name: 'A', level_rank: 0, subjects: ['ma', 'fr', 'cpt'] },
      { id: 'B', name: 'B', level_rank: 0, subjects: ['ma', 'fr'] },
    ],
    persons: [
      {
        id: 'p1',
        full_name: 'أ. واحد',
        present: false,
        shared: false,
        unavailable: [],
        other_school: [],
      },
      {
        id: 'p2',
        full_name: 'أ. اثنان',
        present: true,
        shared: false,
        unavailable: [],
        other_school: [],
      },
    ],
    teachers: [
      {
        id: 't1',
        person_id: 'p1',
        subject: 'ma',
        classes: [
          { class_id: 'A', hours: 4 },
          { class_id: 'B', hours: 4 },
        ],
      },
      {
        id: 't2',
        person_id: 'p2',
        subject: 'fr',
        classes: [
          { class_id: 'A', hours: 3 },
          { class_id: 'B', hours: 3 },
        ],
      },
      { id: 't3', person_id: 'p2', subject: 'cpt', classes: [{ class_id: 'A', hours: 3 }] },
    ],
    locked_classes: [],
    ...over,
    ...(over.config ? {} : { config }),
  };
}

export const at = (
  class_id: string,
  subject: string,
  index: number,
  day: number,
  period: number,
): Placement => ({ class_id, subject, index, day, period });
