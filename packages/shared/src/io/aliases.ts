/* مولَّد من reference/prototype.html (SUBALIAS، DAYALIAS، DSPEC، FSPEC) — لا تعدّله يدويا. */

/** أسماء بديلة للمواد (عربية وفرنسية) للاستيراد. */
export const SUBJECT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  ar: ['عربيه', 'اللغه العربيه', 'arabe'],
  fr: ['فرنسيه', 'اللغه الفرنسيه', 'francais', 'français', 'french'],
  ma: ['رياضيات', 'الرياضيات', 'math', 'maths', 'mathematiques'],
  pc: [
    'فيزياء',
    'الفيزياء',
    'الفيزياء والكيمياء',
    'فيزياء وكيمياء',
    'pc',
    'physique',
    'physique-chimie',
    'physique chimie',
  ],
  svt: ['علوم الحياه والارض', 'علوم الحياه', 'العلوم الطبيعيه', 'svt'],
  hg: [
    'اجتماعيات',
    'الاجتماعيات',
    'التاريخ والجغرافيا',
    'تاريخ وجغرافيا',
    'hg',
    'histoire',
    'histoire-geo',
    'histoire geographie',
  ],
  en: ['انجليزيه', 'الانجليزيه', 'اللغه الانجليزيه', 'انكليزيه', 'anglais', 'english'],
  inf: ['اعلاميات', 'الاعلاميات', 'informatique', 'info'],
  eps: ['تربيه بدنيه', 'التربيه البدنيه', 'بدنيه', 'eps', 'sport'],
  ei: ['تربيه اسلاميه', 'التربيه الاسلاميه', 'اسلاميه', 'islamique', 'education islamique'],
  eco: [
    'اقتصاد',
    'الاقتصاد',
    'الاقتصاد العام',
    'الاقتصاد العام والاحصاء',
    'economie',
    'economie generale',
  ],
  cpt: ['محاسبه', 'المحاسبه', 'المحاسبه والرياضيات الماليه', 'comptabilite'],
  org: [
    'تنظيم اداري',
    'التنظيم الاداري',
    'الاقتصاد والتنظيم الاداري للمقاولات',
    'اقتصاد وتنظيم',
    'organisation',
    'eoae',
  ],
  phi: ['فلسفه', 'الفلسفه', 'philosophie', 'philo'],
};

/** أسماء الأيام (الإثنين أولا) بالعربية والفرنسية. */
export const DAY_ALIASES: readonly (readonly string[])[] = [
  ['اثنين', 'الاثنين', 'lundi', 'lun'],
  ['ثلاثاء', 'الثلاثاء', 'mardi', 'mar'],
  ['اربعاء', 'الاربعاء', 'mercredi', 'mer'],
  ['خميس', 'الخميس', 'jeudi', 'jeu'],
  ['جمعه', 'الجمعه', 'vendredi', 'ven'],
  ['سبت', 'السبت', 'samedi', 'sam'],
];

/** عناوين أعمدة ورقة "التوزيع". */
export const DISTRIBUTION_COLUMNS = {
  c: ['القسم', 'الفصل', 'classe', 'class'],
  s: ['الماده', 'matiere', 'matière'],
  t: ['الاستاذ', 'الأستاذ', 'professeur', 'prof', 'enseignant'],
  h: ['الساعات', 'عدد الساعات', 'heures', 'volume', 'h/s'],
  pr: ['متواجد', 'present', 'présent'],
} as const;

/** عناوين أعمدة ورقة "أوقات الفراغ". */
export const FREE_TIME_COLUMNS = {
  t: ['الاستاذ', 'الأستاذ', 'professeur', 'prof', 'enseignant'],
  d: ['اليوم', 'jour'],
  f: ['من', 'de', 'debut', 'début'],
  to: ['الى', 'إلى', 'a', 'à', 'fin'],
  st: ['الحاله', 'الحالة', 'statut', 'etat'],
} as const;
