/**
 * التنقل والوحدات (MODS، TABS، MODULE_MAP في النموذج الأولي، SPEC §7.10).
 */

/** الشريط الجانبي لواجهة الحارس العام. */
export const SIDEBAR_MODULES = [
  ['home', 'اليوم'],
  ['students', 'التلاميذ'],
  ['parents', 'الأولياء'],
  ['teachers', 'الأساتذة'],
  ['classes', 'الأقسام'],
  ['absences', 'الغياب والتأخر'],
  ['discipline', 'الانضباط'],
  ['tt', 'جدول الحصص'],
  ['comm', 'التواصل'],
  ['modules', 'كل الوحدات'],
  ['brand', 'هوية المدرسة'],
] as const;

/** تبويبات وحدة جدول الحصص. */
export const TIMETABLE_TABS = [
  ['tt', 'جدول الحصص'],
  ['cfg', 'توقيت المدرسة'],
  ['data', 'الأساتذة والأقسام'],
  ['io', 'استيراد وتصدير'],
  ['net', 'شبكة الأساتذة'],
  ['abs', 'غياب الأساتذة والتعويض'],
] as const;

/** خريطة كل الوحدات: [المجموعة، [المفتاح، الاسم، مفعّل]]. */
export const MODULE_MAP: readonly (readonly [
  string,
  readonly (readonly [string, string, boolean])[],
])[] = [
  [
    'الحياة المدرسية',
    [
      ['students', 'التلاميذ', true],
      ['absences', 'الغياب والتأخر', true],
      ['discipline', 'الانضباط', true],
      ['preinsc', 'ما قبل التسجيل', false],
      ['attest', 'الشهادات المدرسية', true],
      ['lost', 'الأشياء الضائعة', false],
    ],
  ],
  [
    'البيداغوجيا',
    [
      ['tt', 'جدول الحصص الذكي', true],
      ['notes', 'النقط والبيانات ومسار', false],
      ['cahier', 'دفتر النصوص', false],
      ['orient', 'التوجيه وما بعد الباكالوريا', false],
    ],
  ],
  [
    'الخدمات',
    [
      ['transport', 'النقل المدرسي', false],
      ['cantine', 'المطعم والوجبات', false],
    ],
  ],
  [
    'المالية',
    [
      ['fees', 'الواجبات والأداء', false],
      ['invoice', 'الفوترة الإلكترونية', false],
      ['payroll', 'أجور الأساتذة', false],
    ],
  ],
  [
    'التواصل',
    [
      ['comm', 'الرسائل والإشعارات', true],
      ['gallery', 'معرض الصور', false],
      ['polls', 'استطلاعات الرأي', false],
    ],
  ],
  [
    'أخرى',
    [
      ['lists', 'القوائم والتقارير', true],
      ['connect', 'تتبع الدخول', false],
      ['pointage', 'الحضور الإلكتروني للموظفين', false],
    ],
  ],
];

/** تبويبات ملف التلميذ. */
export const STUDENT_FILE_TABS = ['info', 'abs', 'disc', 'meet', 'docs', 'notes'] as const;
