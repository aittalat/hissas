# حصص — خطة البناء (المرحلة 1)

> وثيقة تصميم فقط، لا كود تنفيذي. المرجع: `SPEC.md` و`reference/prototype.html`.
> كل ما يخالف SPEC حرفيا معلَّم بـ **[انحراف مقترح]**، وقد اعتُمد كله (القسم 5 و`docs/adr/0001-plan-decisions.md`).

---

## 1. هيكل المستودع (monorepo)

الأدوات: **pnpm workspaces + Turborepo** لجزء TypeScript، و**uv** لجزء Python. Node 22 LTS، Python 3.12، PostgreSQL 16.

```
hissas/
├── SPEC.md · CLAUDE.md · PROGRESS.md
├── reference/
│   └── prototype.html              # النموذج الأولي: مرجع السلوك (لا يُعدَّل)
├── docs/
│   ├── PLAN.md                     # هذه الوثيقة
│   └── adr/                        # قرارات معمارية مرقمة (0001-…)
├── apps/
│   ├── web/                        # Next.js (App Router) + TS + Tailwind، RTL، ar/fr
│   │   ├── app/(platform)/         # لوحة صاحب المنصة (super admin)
│   │   ├── app/(school)/           # كل شاشات المدرسة (الحارس، المدير، الكتابة…)
│   │   ├── app/(parent)/           # معاينة/واجهة الولي
│   │   ├── app/api/                # route handlers (رفع S3، مهام المحرك، التصدير)
│   │   ├── server/                 # منطق الخادم: tenancy، RBAC، audit، solver client
│   │   └── messages/{ar,fr}.json   # الترجمات (next-intl)
│   └── mobile/                     # Expo (لاحقا — فارغ في المرحلة 1)
├── services/
│   └── solver/                     # FastAPI + OR-Tools CP-SAT (بدون اتصال بقاعدة البيانات)
│       ├── solver/model.py         # بناء نموذج CP-SAT
│       ├── solver/metrics.py       # نفس مؤشرات النموذج الأولي
│       ├── solver/diagnose.py      # الحد الأقصى الممكن + assumptions
│       ├── solver/api.py           # /solve /repair /diagnose /jobs
│       └── tests/                  # وحدة لكل قاعدة 6.1 + قبول 6.5 + أداء
├── packages/
│   ├── shared/                     # نواة المجال بـ TS (تُستعمل في web وmobile)
│   │   ├── src/grid/               # الحصص والأوقات (periodsOf, valid, capOf)
│   │   ├── src/timetable/          # fits, conflicts, metrics, quality, tMax, diffPlans, advise
│   │   ├── src/contract/           # عقد المحرك (zod) → JSON Schema → نماذج pydantic
│   │   ├── src/rbac/               # مصفوفة الصلاحيات can(role, action)
│   │   ├── src/i18n/               # نصوص الإشعارات بالعربية والدارجة والفرنسية
│   │   └── fixtures/               # demo-school.json + حالات القبول 6.5 (مشتركة مع Python)
│   ├── db/                         # Prisma schema + migrations SQL (RLS) + seed + tenant client
│   └── config/                     # tsconfig/eslint/tailwind presets مشتركة
├── tools/
│   └── prototype-oracle/           # Playwright: يشغّل prototype.html ويصدّر البيانات والمؤشرات المرجعية
├── infra/                          # AWS CDK (TypeScript)
├── docker-compose.yml              # postgres + solver للتطوير المحلي
└── .github/workflows/ci.yml
```

**تدفق التبعيات:** `web → shared, db` · `db → shared` · `solver` مستقل ويستهلك فقط JSON Schema المولَّد من `shared/contract` · `mobile → shared` (لاحقا).

**لماذا المحرك بدون قاعدة بيانات؟** يتلقى طلبا مكتفيا بذاته (JSON) ويرجع حلا. هكذا: لا يعبر حدود المدارس أبدا، يُختبر بملفات ثابتة، ويتوسع أفقيا دون أسرار قاعدة البيانات.

---

## 2. مخطط قاعدة البيانات (Prisma) مع عزل المدارس

### 2.1 اصطلاحات

- أسماء الحقول **snake_case** كما في SPEC وفي سياسات RLS (لا `@map` للحقول)، والنماذج PascalCase مع `@@map` لاسم الجدول.
- المعرّفات `uuid` v7 (`@default(uuid(7)) @db.Uuid`)، والأوقات `timestamptz`.
- **كل جدول بيانات مدرسة يحمل `school_id`** — حتى الجداول الفرعية التي لا يذكره SPEC فيها (lessons, placements, class_subjects, teacher_class_hours, locked_classes, substitutions). السبب: سياسة RLS واحدة بسيطة وقابلة للتدقيق آليا على كل جدول.
- **مفاتيح أجنبية مركّبة `(x_id, school_id) → (id, school_id)`** للعلاقات الإلزامية: قاعدة البيانات نفسها تمنع ربط سجل من مدرسة بسجل من مدرسة أخرى. لذلك كل جدول مدرسة فيه `@@unique([id, school_id])`.
- العلاقات الاختيارية (nullable) مفتاح بسيط على `id` + `ON DELETE SET NULL (col)` مكتوب في SQL (Prisma لا يعبّر عنه)، والتحقق من نفس المدرسة بـ trigger.
- `day` من 0 (الإثنين) إلى 5 (السبت). `period` فهرس الحصة في اليوم: `0..am_count-1` صباحا ثم `am_count..` مساء.
- ما لا يعبّر عنه Prisma (RLS، CHECK، فهارس جزئية، `NULLS NOT DISTINCT`، أدوار Postgres، منع تعديل audit_log) يُكتب في ملفات SQL داخل migrations (`prisma migrate dev --create-only` ثم إضافة SQL).

### 2.2 المخطط

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // الدور hissas_app (خاضع لـ RLS)
  directUrl = env("DIRECT_DATABASE_URL") // الدور hissas_owner (للهجرات فقط)
}

// ───────────────────────── المنصة (خارج عزل المدرسة) ─────────────────────────

model School {
  id         String   @id @default(uuid(7)) @db.Uuid
  name       String
  slug       String   @unique              // slug.hissas.ma — CHECK ^[a-z0-9-]{3,40}$ + قائمة محجوزة (www, api, admin…)
  color      String   @default("#1D5A48")  // CHECK ^#[0-9A-Fa-f]{6}$
  logo_url   String?                        // مفتاح S3 (يُقدَّم برابط موقّع)
  plan       String   @default("trial")
  status     SchoolStatus @default(active)
  created_at DateTime @default(now()) @db.Timestamptz

  config SchoolConfig?
  rules  SchoolRules?
  @@map("schools")
}

enum SchoolStatus { active suspended deleted }

model User {
  id             String   @id @default(uuid(7)) @db.Uuid
  email          String?  @unique            // citext
  phone          String?  @unique            // صيغة E.164
  password_hash  String                      // argon2id
  display_name   String
  locale         Locale   @default(ar)
  is_super_admin Boolean  @default(false)
  person_id      String?  @unique @db.Uuid   // إذا كان المستعمل أستاذا
  created_at     DateTime @default(now()) @db.Timestamptz
  memberships Membership[]
  person      Person? @relation(fields: [person_id], references: [id])
  @@map("users")
}

enum Locale { ar fr }

model SupportAccess {                         // SPEC §2: صاحب المنصة لا يرى بيانات التلاميذ إلا عند الدعم وبسجل
  id            String    @id @default(uuid(7)) @db.Uuid
  school_id     String    @db.Uuid
  admin_user_id String    @db.Uuid
  reason        String
  started_at    DateTime  @default(now()) @db.Timestamptz
  expires_at    DateTime  @db.Timestamptz
  ended_at      DateTime? @db.Timestamptz
  @@map("support_access")
}

// ───────────────────────── عضوية وصلاحيات (RLS) ─────────────────────────

model Membership {
  id         String @id @default(uuid(7)) @db.Uuid
  school_id  String @db.Uuid
  user_id    String @db.Uuid
  role       Role
  parent_id  String? @db.Uuid     // إذا role = parent
  student_id String? @db.Uuid     // إذا role = student
  created_at DateTime @default(now()) @db.Timestamptz
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  @@unique([user_id, school_id, role])
  @@unique([id, school_id])
  @@map("memberships")
}

enum Role { director supervisor secretary teacher parent student }

// ───────────────────────── إعدادات المدرسة ─────────────────────────

model SchoolConfig {
  school_id               String   @id @db.Uuid
  period_minutes          Int      @default(60)     // CHECK 45..60
  am_start                String   @default("08:00") // "HH:MM" CHECK
  am_count                Int      @default(4)      // CHECK 3..6
  pm_start                String   @default("14:00")
  pm_count                Int      @default(4)      // CHECK 0..5
  break_after_2nd_minutes Int      @default(0)      // تُطبق فقط إذا كانت الفترة ≥ 4 حصص (كما في periodsOf)
  pairing_mode            Int      @default(2)      // CHECK IN (1,2)
  days                    Json                       // 6 عناصر: "full" | "am" | "off" — يُتحقق منه بـ zod + CHECK jsonb_array_length = 6
  updated_at              DateTime @updatedAt @db.Timestamptz
  school School @relation(fields: [school_id], references: [id], onDelete: Cascade)
  @@map("school_config")
}

model SchoolRules {
  school_id              String @id @db.Uuid
  monthly_absence_alert  Int    @default(4)
  late_threshold_minutes Int    @default(15)
  school School @relation(fields: [school_id], references: [id], onDelete: Cascade)
  @@map("school_rules")
}

// ───────────────────────── المواد والأقسام ─────────────────────────

model Subject {
  id             String  @id @default(uuid(7)) @db.Uuid
  school_id      String? @db.Uuid              // NULL = مادة عامة (كتالوج المنصة)
  key            String                        // ar, fr, ma, pc, svt, hg, en, inf, eps, ei, eco, cpt, org, phi…
  name           String                        // بالعربية
  name_fr        String?
  short          String
  default_hours  Int                           // CHECK 1..8
  hue            Int                           // CHECK 0..359
  no_daily_cap   Boolean @default(false)       // المحاسبة
  hard           Boolean @default(false)       // مادة صعبة (عقوبة بعد الزوال)
  prefer_double  Boolean @default(false)       // التربية البدنية: وزن الساعة المفردة ×3 — [انحراف مقترح: حقل غير مذكور في §5]
  @@unique([school_id, key])                   // + فهرس SQL بـ NULLS NOT DISTINCT
  @@map("subjects")
}

model Class {
  id         String @id @default(uuid(7)) @db.Uuid
  school_id  String @db.Uuid
  name       String
  level_rank Int                                // 1AC=0 … 2BAC=5، غيره 99 (lvlRank)
  @@unique([school_id, name])
  @@unique([id, school_id])
  @@map("classes")
}

model ClassSubject {
  school_id  String @db.Uuid
  class_id   String @db.Uuid                   // FK مركّب (class_id, school_id)
  subject_id String @db.Uuid                   // FK بسيط (قد تكون مادة عامة)
  @@id([class_id, subject_id])
  @@map("class_subjects")
}

// ───────────────────────── الأساتذة (شبكة مشتركة) ─────────────────────────

model Person {                                  // شخص الأستاذ — عام، يُرى فقط عبر مدرسة يرتبط بها
  id         String  @id @default(uuid(7)) @db.Uuid
  full_name  String
  phone      String?
  email      String?
  created_at DateTime @default(now()) @db.Timestamptz
  @@map("persons")
}

model Teacher {                                 // سجل لكل (مدرسة، شخص، مادة)
  id         String  @id @default(uuid(7)) @db.Uuid
  school_id  String  @db.Uuid
  person_id  String  @db.Uuid
  subject_id String  @db.Uuid
  present    Boolean @default(false)            // ثابت: نفس القيمة لكل سجلات الشخص في المدرسة (trigger)
  shared     Boolean @default(false)
  active     Boolean @default(true)
  @@unique([school_id, person_id, subject_id])  // "نفس الاسم بمادة أخرى = نفس الشخص"
  @@unique([id, school_id])
  @@unique([id, subject_id])                    // يُستهدف من teacher_class_hours
  @@map("teachers")
}

model TeacherClassHours {
  school_id  String @db.Uuid
  teacher_id String @db.Uuid
  class_id   String @db.Uuid
  subject_id String @db.Uuid                    // منسوخ من teachers لفرض القيد أدناه
  hours      Int                                // CHECK 1..8
  @@id([teacher_id, class_id])
  @@unique([class_id, subject_id])              // مادة في قسم = أستاذ واحد (كما في unitsOf)
  // FK (teacher_id, subject_id) → teachers(id, subject_id)
  // FK (class_id, subject_id)   → class_subjects
  @@map("teacher_class_hours")
}

model Availability {                            // تخزين متفرق: غياب السطر = free
  school_id String @db.Uuid
  person_id String @db.Uuid
  day       Int                                 // 0..5
  period    Int
  status    AvailabilityStatus
  source    AvailabilitySource @default(manual) // [انحراف مقترح] network = كتبه نظام الشبكة من مدرسة أخرى
  @@id([person_id, school_id, day, period])
  @@map("availability")
}

enum AvailabilityStatus { free unavailable other_school }
enum AvailabilitySource { manual network }

// ───────────────────────── جدول الحصص ─────────────────────────

model Timetable {
  id           String    @id @default(uuid(7)) @db.Uuid
  school_id    String    @db.Uuid
  status       TimetableStatus @default(draft)
  created_at   DateTime  @default(now()) @db.Timestamptz
  published_at DateTime? @db.Timestamptz
  created_by   String?   @db.Uuid
  score        Json?                            // المؤشرات + الجودة /100 + حالة الحل (OPTIMAL/FEASIBLE)
  input_hash   String?                          // بصمة المدخلات (لمعرفة "الجدول قديم")
  @@unique([id, school_id])
  // فهرس جزئي: UNIQUE (school_id) WHERE status = 'published'
  @@map("timetables")
}

enum TimetableStatus { draft published archived }

model Lesson {                                  // ساعة = وحدة
  id           String @id @default(uuid(7)) @db.Uuid
  school_id    String @db.Uuid
  timetable_id String @db.Uuid
  class_id     String @db.Uuid
  subject_id   String @db.Uuid
  teacher_id   String @db.Uuid
  person_id    String @db.Uuid                  // منسوخ من teachers (لقيد عدم التعارض في placements)
  index        Int                              // 0..hours-1
  @@unique([timetable_id, class_id, subject_id, index])
  @@unique([id, class_id, person_id])
  @@unique([id, school_id])
  @@map("lessons")
}

model Placement {                               // غياب السطر = حصة بدون مكان
  lesson_id    String @id @db.Uuid
  school_id    String @db.Uuid
  timetable_id String @db.Uuid
  class_id     String @db.Uuid                  // FK مركّب (lesson_id, class_id, person_id) → lessons
  person_id    String @db.Uuid
  day          Int
  period       Int
  @@unique([timetable_id, class_id, day, period])   // القيد 6.1-1 على مستوى القاعدة: لا تعارض قسم
  @@unique([timetable_id, person_id, day, period])  // ولا تعارض أستاذ (شخص)
  @@map("placements")
}

model LockedClass {
  school_id    String @db.Uuid
  timetable_id String @db.Uuid
  class_id     String @db.Uuid
  @@id([timetable_id, class_id])
  @@map("locked_classes")
}

model SolverJob {                               // [انحراف مقترح] تتبع مهام المحرك غير المتزامنة
  id          String    @id @default(uuid(7)) @db.Uuid
  school_id   String    @db.Uuid
  op          SolverOp
  status      JobStatus @default(queued)
  request     Json
  result      Json?
  error       String?
  created_by  String?   @db.Uuid
  created_at  DateTime  @default(now()) @db.Timestamptz
  finished_at DateTime? @db.Timestamptz
  @@map("solver_jobs")
}

enum SolverOp  { solve repair diagnose }
enum JobStatus { queued running done failed }

// ───────────────────────── الغياب والتعويض ─────────────────────────

model Absence {
  id         String   @id @default(uuid(7)) @db.Uuid
  school_id  String   @db.Uuid
  teacher_id String   @db.Uuid                  // [انحراف مقترح] الأصح person_id: الغياب لشخص وليس لمادة (analyze يستعمل pk)
  day_date   DateTime @db.Date
  reason     String                             // مرض، تكوين، رخصة إدارية، ظرف عائلي…
  created_by String?  @db.Uuid
  created_at DateTime @default(now()) @db.Timestamptz
  @@unique([id, school_id])
  @@map("absences")
}

model Substitution {
  id                    String  @id @default(uuid(7)) @db.Uuid
  school_id             String  @db.Uuid
  absence_id            String  @db.Uuid
  lesson_ids            String[] @db.Uuid         // حصة من ساعة أو ساعتين متتاليتين
  type                  SubstitutionType
  substitute_teacher_id String? @db.Uuid         // same | review
  moved_lesson_id       String? @db.Uuid         // swap: الحصة المقدَّمة
  moved_from_period     Int?
  @@map("substitutions")
}

enum SubstitutionType { same review swap cancel }
// ساعات التعويض (ledger) مشتقة: COUNT(substitutions same|review) لكل بديل، وساعات الغياب لكل غائب.

// ───────────────────────── التواصل والتدقيق ─────────────────────────

model Notification {
  id          String   @id @default(uuid(7)) @db.Uuid
  school_id   String   @db.Uuid
  class_id    String?  @db.Uuid                 // NULL = كل المدرسة
  title       String
  text        String
  darija_text String
  created_at  DateTime @default(now()) @db.Timestamptz
  @@map("notifications")
}

model AuditLog {                                // إلحاق فقط: REVOKE UPDATE, DELETE من كل الأدوار
  id         BigInt   @id @default(autoincrement())
  school_id  String?  @db.Uuid                  // NULL = حدث منصة
  user_id    String?  @db.Uuid
  action     String                             // مثال: attendance.update
  entity     String
  entity_id  String?
  payload    Json                               // before/after
  created_at DateTime @default(now()) @db.Timestamptz
  @@index([school_id, created_at])
  @@map("audit_log")
}

// ───────────────────────── الحياة المدرسية ─────────────────────────

model Parent {
  id        String @id @default(uuid(7)) @db.Uuid
  school_id String @db.Uuid
  full_name String
  phone     String
  relation  ParentRelation
  user_id   String? @db.Uuid
  @@unique([school_id, phone])                  // ربط تلقائي للإخوة بنفس الولي
  @@unique([id, school_id])
  @@map("parents")
}

enum ParentRelation { father mother guardian }

model Student {
  id            String   @id @default(uuid(7)) @db.Uuid
  school_id     String   @db.Uuid
  class_id      String   @db.Uuid
  first_name    String
  last_name     String
  gender        Gender
  birth_date    DateTime @db.Date
  matricule     String
  massar_code   String?
  parent_id     String   @db.Uuid
  status        StudentStatus @default(active)
  health_note   String?
  photo_consent Boolean  @default(true)
  is_new        Boolean  @default(false)
  photo_url     String?                         // مفتاح S3
  @@unique([school_id, matricule])
  @@unique([school_id, massar_code])
  @@unique([id, school_id])
  @@map("students")
}

enum Gender        { m f }
enum StudentStatus { active archived }

model Attendance {
  id                    String   @id @default(uuid(7)) @db.Uuid
  school_id             String   @db.Uuid
  student_id            String   @db.Uuid
  date                  DateTime @db.Date
  period                Int
  lesson_id             String?  @db.Uuid
  type                  AttendanceType
  late_minutes          Int?                    // CHECK type='late' ⇔ late_minutes > 0
  justified             Boolean  @default(false)
  reason                String?
  comment               String?
  parent_message_status MessageStatus @default(pending)
  recorded_by           String   @db.Uuid
  @@unique([student_id, date, period])          // التسجيل مرتين لنفس الحصة يعوّض الأول (upsert)
  @@index([school_id, date])
  @@map("attendance")
}

enum AttendanceType { absent late }
enum MessageStatus  { pending sent read }

model Incident {
  id                String   @id @default(uuid(7)) @db.Uuid
  school_id         String   @db.Uuid
  student_id        String   @db.Uuid
  date              DateTime @db.Date
  time              String?                     // "HH:MM"
  title             String
  type              IncidentType
  gravity           Gravity?                    // إلزامي إذا negative (CHECK)
  points_delta      Int                         // light −1، medium −2، serious −4، positive +1 (يُحسب في الخادم)
  measure           String?
  description       String?
  visible_to_parent Boolean  @default(false)
  recorded_by       String   @db.Uuid
  @@map("incidents")
}

enum IncidentType { negative positive }
enum Gravity      { light medium serious }

model ParentMeeting {
  id               String   @id @default(uuid(7)) @db.Uuid
  school_id        String   @db.Uuid
  student_id       String   @db.Uuid
  date             DateTime @db.Date
  reason           String
  requested_by     String
  school_attendees String
  family_attendees String
  discussed_points String
  agreed_measures  String
  @@map("parent_meetings")
}

model StudentDocument {
  id          String   @id @default(uuid(7)) @db.Uuid
  school_id   String   @db.Uuid
  student_id  String   @db.Uuid
  name        String
  kind        String
  s3_key      String                            // s3://bucket/{school_id}/students/{student_id}/…
  size        Int
  uploaded_at DateTime @default(now()) @db.Timestamptz
  @@map("student_documents")
}

model ParentMessage {
  id          String   @id @default(uuid(7)) @db.Uuid
  school_id   String   @db.Uuid
  student_id  String?  @db.Uuid                 // رسالة خاصة (غياب، حادثة)
  class_id    String?  @db.Uuid                 // أولياء قسم؛ الاثنان NULL = كل الأولياء
  title       String
  text        String
  darija_text String
  created_at  DateTime @default(now()) @db.Timestamptz
  @@map("parent_messages")
}
```

(العلاقات `@relation` المركّبة محذوفة من العرض أعلاه للاختصار، ومذكورة في التعليقات؛ ستُكتب كاملة في `packages/db/prisma/schema.prisma`.)

### 2.3 عزل المدارس: ثلاث طبقات

**أ) أدوار Postgres**

| الدور | الاستعمال | RLS |
|---|---|---|
| `hissas_owner` | الهجرات فقط (CI/النشر) | مالك الجداول |
| `hissas_app` | تطبيق الويب — كل الطلبات العادية | خاضع (`FORCE ROW LEVEL SECURITY`) |
| `hissas_platform` | لوحة صاحب المنصة + مهمة مزامنة الشبكة | `BYPASSRLS`، مسار كود منفصل، كل استعمال يُسجل في audit_log |

المحرك (solver) **لا يملك أي اتصال بقاعدة البيانات**.

**ب) RLS (الحماية الثانية)** — على كل جدول فيه `school_id`:

- `ENABLE` + `FORCE ROW LEVEL SECURITY`.
- الدالة `app.current_school()` = `NULLIF(current_setting('app.school_id', true), '')::uuid`. بدون إعداد ← NULL ← **صفر سطور (fail-closed)**.
- سياسة `tenant_isolation`: `USING (school_id = app.current_school()) WITH CHECK (school_id = app.current_school())`.
- `subjects`: القراءة `school_id IS NULL OR school_id = app.current_school()`، والكتابة لمواد المدرسة فقط (المواد العامة يكتبها `hissas_platform`).
- `persons`: قراءة فقط إذا وُجد `teachers` في المدرسة الحالية يشير إليه. البحث عن شخص موجود في مدرسة أخرى (ربط أستاذ مشترك) يمر عبر دالة `SECURITY DEFINER` تتطلب تطابق الهاتف وموافقة الأستاذ، ولا تكشف أي مدرسة.
- `availability` بحالة `other_school`: تكتبه دالة `SECURITY DEFINER` (`sync_network_availability(person_id)`) عند نشر جدول في مدرسة أخرى، **دون أي إشارة إلى المدرسة المصدر**.
- `audit_log`: `INSERT` فقط؛ `REVOKE UPDATE, DELETE`.

**ج) طبقة التطبيق (الحماية الأولى)** — في `packages/db`:

- `tenantDb(schoolId)`: عميل Prisma موسّع (`$extends`) يلف **كل** عملية في معاملة تبدأ بـ `SELECT set_config('app.school_id', $1, true)` (محلي للمعاملة ← آمن مع RDS Proxy/PgBouncer)، ويضيف `school_id` تلقائيا للكتابة ويتحقق منه في القراءة.
- لا يُصدَّر عميل Prisma الخام من `packages/db` إلا لـ `platformDb` (مسار صاحب المنصة) — قاعدة lint تمنع استيراده في شاشات المدرسة.
- `school_id` يُحدد من النطاق الفرعي (`slug.hissas.ma` عبر middleware) **ثم يُتحقق** من وجود عضوية للمستعمل في تلك المدرسة. لا يُقبل أبدا من جسم الطلب.
- الصلاحيات حسب الدور (الحارس لا يرى المالية، الولي يرى أبناءه فقط والحوادث المرئية فقط) في `shared/rbac` + فلاتر في طبقة الخدمة، مع اختبارات مصفوفة كاملة.

---

## 3. نموذج CP-SAT للمحرك

### 3.1 المدخلات (عقد `SolveRequest`، مصدره `shared/contract`)

- **الشبكة**: الأيام النشطة، `am_count`، `pm_count`، نظام كل يوم (full/am/off) ← مجموعة الخانات الصالحة `valid(d,p)`، والنصف `half(p) ∈ {am, pm}`، وآخر حصة في اليوم `last(d)`.
- **المواد**: `no_daily_cap`، `hard`، `prefer_double`.
- **الأشخاص** (لا السجلات): `present`، والخانات المحجوبة = اتحاد `unavailable ∪ other_school` على كل سجلاته.
- **المجموعات** `g = (class, subject)` بأستاذها (الشخص) `t(g)` وعدد ساعاتها `h(g)`.
- الأقسام المقفلة مع خاناتها الحالية، والجدول الحالي (لـ `/repair`)، والأوزان، و`time_limit_s` و`seed`.

### 3.2 المتغيرات

قرار أساسي: **ساعات نفس (القسم، المادة) متماثلة** (نفس الأستاذ)، فالنموذج لا ينشئ متغيرا لكل ساعة بل لكل مجموعة وخانة. هذا يلغي التماثل (symmetry) بين الساعات ويصغّر النموذج كثيرا. أرقام الحصص (`lessons.index`) تُعطى بعد الحل حسب ترتيب الوقت.

| المتغير | النوع | المعنى |
|---|---|---|
| `y[g,d,p]` | Bool | ساعة من المجموعة g في اليوم d والحصة p. **يُنشأ فقط** إذا كانت الخانة صالحة وشخص g متاحا فيها (القيد 2 بالإقصاء) |
| `u[g]` | Int 0..h(g) | ساعات g بدون مكان |
| `x[t,d,p]` | تعبير = Σ y لمجموعات الشخص t | انشغال الأستاذ (≤ 1) |
| `z[c,d,p]` | تعبير = Σ y لمجموعات القسم c | انشغال القسم (≤ 1) |
| `a[t,d,h]` | Bool | الشخص t يدرّس في النصف h من اليوم d |
| `w[t,d]` | Bool | الشخص t يدرّس في اليوم d |
| `n[t,d]` | Int | ساعات t في اليوم d |
| `pre/suf[·,d,p]` | Bool | "توجد حصة قبل/بعد p في نفس النصف" (لحساب الفراغات) |
| `adj[g,d,p]` | Bool | `y[g,d,p] ∧ y[g,d,p+1]` و p, p+1 في نفس النصف |
| `one[g,d]`، `m[g,d]` | Bool | g بساعة واحدة في اليوم / بساعتين أو أكثر في اليوم |

### 3.3 القيود الإلزامية (6.1)

1. **لا تعارض**: `Σ_{g∈c} y[g,d,p] ≤ 1` لكل قسم، و`Σ_{g: t(g)=t} y[g,d,p] ≤ 1` لكل **شخص**.
2. **أوقات الفراغ والعطل**: لا يُنشأ `y` لخانة غير صالحة (يوم off، مساء يوم am) أو محجوبة للشخص (unavailable أو other_school).
3. **ساعتان كحد أقصى**: `Σ_p y[g,d,p] ≤ 2` لكل g ليست `no_daily_cap`.
4. **غير المتواجد**: `y[g,d,p] ≤ a[t,d,half(p)]` و`a[t,d,am] + a[t,d,pm] ≤ 1`.
5. **الشخص الواحد بعدة مواد**: محقق بنيويا لأن القيود 1 و4 والأهداف مفهرسة بالشخص t لا بالسجل.
6. **الأقسام المقفلة**: `y` لمجموعاتها مثبتة على خاناتها الحالية (ثوابت)، وتبقى تشغل خانات أساتذتها.
7. **لا عبور لاستراحة الغداء**: التجاور (`adj`) معرّف فقط داخل نفس النصف، فلا "حصة من ساعتين" تعبر الغداء. في النقل اليدوي: الهدف يجب أن يكون داخل نصف واحد (كما في `targetsFor`).

+ التغطية: `Σ_{d,p} y[g,d,p] + u[g] = h(g)` (عدم التغطية هدف لا قيد، كي يوجد حل دائما ويُشخَّص الباقي).

### 3.4 دالة الهدف (6.2) — نفس أوزان النموذج الأولي

CP-SAT يقبل معاملات صحيحة فقط ← **كل الأوزان ×2** (بسبب 0.5). التكوينات أدناه كلها خطية ومحكمة تحت التصغير (minimization).

| الهدف | الوزن الأصلي | الوزن في CP-SAT | التكوين |
|---|---|---|---|
| حصة بدون مكان | 10000 | 20000 | `Σ u[g]` |
| أستاذ غير متواجد بساعة واحدة في اليوم | 400 | **720** (انظر الملاحظة) | `lone[t,d]` مع `y ≤ w` و`n[t,d] ≥ 2·w[t,d] − lone[t,d]` |
| ساعة فارغة بين حصص غير المتواجد (نفس النصف) | 250 | 500 | `gap[t,d,p] ≥ pre[p−1] + suf[p+1] − x[p] − 1`، مع `pre[p] ≥ x[q≤p]`، `suf[p] ≥ x[r≥p]` |
| نصف يوم بساعة واحدة لغير المتواجد | 40 | 80 | `h1[t,d,h]`: `cnt ≥ 2·a − h1` |
| ساعتان لنفس المادة في اليوم غير متتاليتين | 20 (لكل ساعة بلا جار) | 40 | `iso[g,d,p] ≥ y[g,d,p] + m[g,d] − 1 − adj[g,d,p−1] − adj[g,d,p]`، `m[g,d] ≥ Σ_p y − 1` |
| فراغ بين حصص القسم (نفس النصف) | 6 | 12 | نفس تكوين الفراغ على `z` |
| ساعة مفردة لمادة يمكن تجميعها | 3 (×3 = 9 لـ `prefer_double`) | 6 / 18 | لكل g بـ h ≥ 2 وليست no_daily_cap: `one[g,d]` بـ `cnt ≥ 2·w − one`، `excess[g] ≥ Σ_d one[g,d] − (h mod 2)`، `excess ≥ 0`. يُطبق على المواد العادية فقط إذا `pairing_mode = 2`، وعلى `prefer_double` دائما |
| القسم يحضر لساعة واحدة في نصف يوم | 2 | 4 | `h1` على القسم |
| مادة صعبة بعد الزوال | 1 | 2 | `Σ y[g,d,p]` لـ g صعبة و p مسائية |
| حصة في آخر خانة من اليوم | 0.5 | 1 | `Σ y[·,d,last(d)]` |
| فراغ في جدول أستاذ متواجد | 1 | 2 | تكوين الفراغ على `x` للمتواجدين |
| يوم مثقل للقسم (> max(5, P−2) حصص) | 3 لكل حصة زائدة | 6 | `over[c,d] ≥ Σ z − cap` — **موجود في النموذج الأولي (`W.over`) وغير مذكور في جدول SPEC** |
| (repair فقط) كل ساعة تتحرك | 12 / 4 / 1 | 24 / 8 / 2 | `Σ_{(d,p) ∈ الأصل(g)} (1 − y[g,d,p])` |

**ملاحظة الوزن 720:** في `tDay` الكلفة هي `400` إذا كانت ساعات اليوم = 1، **وإلا** `h1 × 40` (ليست جمعا). اليوم بساعة واحدة يحمل تلقائيا `h1 = 1`، فوزن `lone` = 400 − 40 = 360 (×2 = 720) يعيد الكلفة نفسها بالضبط.
الوزن `split` (300) في النموذج الأولي لا يُحتاج: القيد 4 يجعله مستحيلا.

**التوافق:** `solver/metrics.py` و`shared/timetable/metrics.ts` ينفذان نفس `metrics()` و`quality()` للنموذج الأولي. اختبار parity يضمن أن الثلاثة (النموذج الأولي، TS، Python) يعطون نفس الأرقام لنفس الجدول.

### 3.5 الحل والتشخيص

- `num_workers = 8`، `max_time_in_seconds` من الطلب (افتراضيا 20 ث)، `random_seed` ثابت في الاختبارات. **Solution hint**: الجدول الحالي (repair) أو حل جشع سريع (solve).
- **`/solve`**: النموذج كاملا مع الأقسام المقفلة.
- **`/repair`**: ثلاث حلول بعقوبة تحرك 12 / 4 / 1 (أقل تغيير، متوازن، أفضل جودة) كما في `buildSolutions`؛ تُحذف الحلول المكررة أو التي لا تحسّن على السابقة؛ لكل حل: المؤشرات قبل/بعد، الجودة /100، قائمة التغييرات (من ← إلى) بنفس منطق `diffPlans` (مطابقة بالمجموعة).
- **`/diagnose`**:
  1. **قبل الحل** (حساب مباشر، منقول من `diagnose()` و`tMax()`): لكل شخص: الساعات المطلوبة مقابل الخانات الحرة، ثم الحد الأقصى الممكن = Σ_الأيام `min(سقف اليوم، الخانات المتاحة في أفضل نصف)` (أو في النصفين للمتواجد)، حيث سقف اليوم = Σ `min(2, ساعات القسم)` (أو الساعات كاملة لـ no_daily_cap). ولكل قسم: الحصص مقابل خانات الأسبوع. الرسائل بنفس الصيغة الحرفية للنموذج الأولي.
  2. **بعد الحل** (إذا بقيت `u > 0`): نموذج ثان يفرض `u = 0` بقيود مشروطة بـ **assumptions** (literal لكل: أوقات فراغ شخص، قاعدة صباحا/مساء لشخص، سقف يومي لمجموعة، أقسام مقفلة). `SufficientAssumptionsForInfeasibility()` ← نواة متعارضة، تُصغَّر بالحذف التدريجي ضمن مهلة، ثم تُترجم إلى جمل (مثال: "أ. هشام الفاسي: 20 ساعة، والحد الأقصى الممكن 16 لأنه يأتي إما صباحا أو مساء فقط").
  3. `forcedLone`: الأستاذ الذي لا يمكن رياضيا تفادي يوم الساعة الواحدة له (الحالة المستحيلة في اختبار القبول 1) يُعلَّم كذلك.
- **المهام**: `/solve` و`/repair` متزامنتان (للاختبارات والاستعمال الداخلي)، والويب يستعمل `POST /jobs` + `GET /jobs/{id}` (تشغيل في الخلفية) ويسجل في `solver_jobs`، والواجهة تتابع التقدم. المصادقة بين الويب والمحرك: رمز خدمة موقّع (HMAC) قصير الأجل.

### 3.6 الاقتراحات (`advise`) — أين تعيش؟

الكشف عن المشاكل وبدائلها المحلية (نقل، إضافة/نقص ساعة، "اعتبار الأستاذ متواجدا") يُنقل إلى `packages/shared/timetable/advise.ts` (حساب لحظي على الجدول المعروض، كما في النموذج الأولي: `fillOpts`، `moveOpt`، `removeOpt`، الأنواع السبعة). الخيارات التي تتطلب إعادة توليد (`regen`/`fix`/"بحث أعمق") تستدعي `/repair` وتُعرض كاختيار حل. **لا شيء يُطبق قبل موافقة المستعمل.**

---

## 4. خطوات البناء بالترتيب وطريقة اختبار كل خطوة

كل خطوة تنتهي بـ: CI أخضر، تحديث `PROGRESS.md`، commit. لا ننتقل للتالية قبل نجاح اختبارات القبول الخاصة بها.

| # | الخطوة | المُنتَج | كيف نختبرها |
|---|---|---|---|
| **0** | التأسيس | monorepo (pnpm+turbo، uv)، TS strict، ESLint/Prettier، ruff/mypy، docker-compose (Postgres 16)، GitHub Actions | CI يشغل lint + typecheck + اختبارات فارغة بنجاح؛ `docker compose up` يعمل |
| **1** | المرجع القابل للتنفيذ (prototype oracle) | `tools/prototype-oracle`: Playwright يفتح `reference/prototype.html`، يشغل `seed()` وسيناريوهات 6.5، ويصدّر `fixtures/*.json` بصيغة العقد + مؤشرات النموذج الأولي المرجعية | الملفات تمر بتحقق zod؛ البيانات التجريبية = 8 أقسام، 17 أستاذا، 205 ساعات |
| **2** | نواة المجال `packages/shared` | العقد (zod ← JSON Schema ← pydantic)، الشبكة الزمنية، `fits`/`conflictSet`، `metrics`/`quality`، `tMax`/`diagnose`/`forcedLone`، `diffPlans` | Vitest: اختبار لكل قاعدة؛ **parity** مع النموذج الأولي: جداول عشوائية (fast-check) تُقاس في المتصفح وفي TS ← نفس الأرقام |
| **3** | المحرك `/solve` + `/diagnose` | نموذج CP-SAT كما في القسم 3 | pytest: **اختبار وحدة لكل قيد 6.1** (حالة صغيرة تفشل إذا أُزيل القيد)؛ **اختبارات القبول 6.5 الخمسة**؛ parity المؤشرات Python↔TS على نفس الملفات؛ اختبار أداء 30 قسما < 30 ث (في CI على main) |
| **4** | المحرك `/repair` + `/jobs` | 3 حلول + قائمة التغييرات | جدول مثالي ← "أقل تغيير" بـ 0 تغيير؛ عدد التغييرات تنازلي عبر الحلول الثلاثة؛ الأقسام المقفلة لا تتغير؛ قائمة التغييرات = diff الحلين |
| **5** | قاعدة البيانات `packages/db` | schema.prisma، migrations SQL (أدوار، RLS، CHECK، فهارس جزئية)، `tenantDb`، seed من ملف البيانات التجريبية | اختبارات تكامل على Postgres حقيقي: **مصفوفة عزل** لكل جدول (قراءة/كتابة/تعديل/حذف عبر مدرسة أخرى ← 0 سطر أو خطأ)؛ fail-closed بدون `app.school_id`؛ **اختبار تغطية** يفشل إذا وُجد جدول فيه `school_id` بلا `FORCE RLS`؛ خصوصية الأستاذ المشترك (المدرسة A ترى other_school دون اسم B)؛ قيود placements تمنع التعارض |
| **6** | أساس الويب | Next.js، Auth.js (credentials، JWT)، تحديد المدرسة بالنطاق الفرعي + العضوية، RBAC، next-intl ar/fr RTL، هوية المدرسة (متغيرات CSS فاتح/داكن)، audit تلقائي | Playwright: دخول بكل دور؛ اختبارات وحدة لمصفوفة الصلاحيات؛ subdomain خاطئ/بلا عضوية ← 404؛ كل تعديل ينتج سطرا في audit_log |
| **7** | شاشات جدول الحصص (§7.1–7.9) بترتيب SPEC | لوحة المنصة، الهوية (رفع S3 موقّع)، التوقيت، الأساتذة والأقسام (معالج 5 خطوات)، جدول الحصص (توليد، قفل، نقل يدوي بالخانات الصالحة)، الاقتراحات + اختيار الحل، استيراد/تصدير Excel وطباعة A4، الغياب والتعويض، معاينة تطبيق الولي | لكل شاشة سيناريو Playwright يعيد تدفق النموذج الأولي؛ `advise` في TS يعطي **نفس لائحة المشاكل** التي يعطيها النموذج الأولي على البيانات التجريبية؛ استيراد ملف تصدَّر ← نفس البيانات (round-trip) |
| **8** | الحياة المدرسية (§7.10) | اليوم، التلاميذ، الأولياء، الأساتذة، الأقسام، الغياب والتأخر، الانضباط (نظام 20 نقطة)، التواصل، القوائم والتقارير، ملف التلميذ والوثائق | وحدة: حساب النقط (حدود 0..20)، الإنذار المبكر، استبدال تسجيل الغياب المكرر؛ RBAC: الحارس لا يصل للمالية، الولي يرى أبناءه والحوادث المرئية فقط؛ audit لكل تعديل غياب/حادثة؛ الوثائق بروابط موقّعة فقط |
| **9** | النشر على AWS | `infra/` بـ CDK: RDS (مشفر، نسخ يومي، PITR)، الويب، المحرك على ECS Fargate، S3 خاص + KMS، Secrets Manager، بيئة staging | smoke tests بعد كل نشر (دخول، توليد جدول تجريبي، رفع شعار)؛ اختبار استرجاع نسخة احتياطية مرة قبل الإطلاق |
| **10** | تطبيق الهاتف (لاحقا) | Expo + App Variants لكل مدرسة | خارج المرحلة 1 |

**قاعدة ثابتة للاختبار:** كل خطأ يُكتشف يُضاف أولا كاختبار فاشل ثم يُصلح.

---

## 5. قرارات معتمدة (انظر `docs/adr/0001-plan-decisions.md`)

1. **Amplify والشبكة الخاصة [مهم]:** خدمة Amplify Hosting (SSR) لا تدخل VPC، فلا تصل مباشرة إلى RDS خاص ولا إلى محرك داخلي. اقتراحي: **نشر الويب على ECS Fargate** (أو App Runner مع VPC connector) خلف ALB/CloudFront، بدل Amplify. البديل (RDS عام + Amplify) أضعف أمنيا لبيانات قاصرين.
2. **الأستاذ المشترك بتوقيتين مختلفين [مهم]:** مدرسة بحصص 60 د وأخرى بـ 45 د: رقم الحصة لا يعني نفس الوقت. اقتراحي: الحجوزات بين المدارس تُحسب **بالتداخل الزمني الفعلي** (يوم + دقيقة البداية/النهاية) ثم تُحوَّل إلى أرقام حصص كل مدرسة كـ `other_school`، مع `source = network`.
3. **الوزن `over` (3):** موجود في محرك النموذج الأولي وغير مذكور في جدول 6.2. اقتراحي: الإبقاء عليه (موجود في القسم 3.4).
4. **`absences.person_id` بدل `teacher_id`:** الغياب لشخص (يدرّس ربما مادتين) لا لسجل مادة.
5. **حقول إضافية:** `subjects.prefer_double` و`subjects.name_fr`، `availability.source`، `timetables.published_at/input_hash`، والجداول `users`، `memberships`، `support_access`، `solver_jobs`.
6. **ثبات `present`/`shared` لكل شخص في المدرسة:** مع إبقاء بنية §5 (سجل لكل مادة)، يُفرض بـ trigger. البديل الأنظف جدول `school_persons(school_id, person_id, present, shared)`؛ أقترح الإبقاء على §5 + trigger.
7. **منطقة الاستضافة (CNDP):** لا بيانات حقيقية قبل الحسم؛ التطوير والتجريب ببيانات وهمية في `eu-west-3` (باريس) إلى حين القرار.
