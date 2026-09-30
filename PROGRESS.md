# PROGRESS — حصص

آخر تحديث: 2026-09-30

## الحالة الحالية

**الخطوتان 0 و1 مكتملتان.** التالي: الخطوة 2 — نواة المجال `packages/shared`.

## ما أُنجز

### التخطيط

- [x] قراءة `SPEC.md` و`reference/prototype.html`، ونقل النموذج الأولي إلى `reference/`.
- [x] `docs/PLAN.md` + `CLAUDE.md` — **معتمدة** مع قرارات القسم 5 (`docs/adr/0001-plan-decisions.md`).

### الخطوة 0 — التأسيس

- [x] Monorepo: pnpm workspaces + Turborepo (`package.json`، `pnpm-workspace.yaml`، `turbo.json`).
- [x] `packages/config`: tsconfig (base/library/nextjs، strict + `noUncheckedIndexedAccess`) وإعداد ESLint مشترك (typescript-eslint strict).
- [x] `packages/shared`: هيكل الحزمة + أول نوع مجال (`SCHOOL_DAYS`، `DayMode`) مع اختبار Vitest.
- [x] `apps/web`: Next.js 16 + Tailwind 4، `lang="ar" dir="rtl"`، متغيرات CSS للهوية (فاتح/داكن)، يستهلك `@hissas/shared`، `output: standalone`.
- [x] `services/solver`: FastAPI + OR-Tools، uv + Python 3.12، ruff + mypy strict + pytest، `/health` يحل نموذج CP-SAT تافها، Dockerfile بمستعمل غير root.
- [x] `docker-compose.yml`: Postgres 16 + المحرك مع healthchecks.
- [x] CI (`.github/workflows/ci.yml`): TypeScript (format · lint · typecheck · test · build)، Solver (ruff · mypy · pytest)، compose (بناء وتشغيل وفحص الصحة).

**التحقق المحلي:** `pnpm format:check`، `pnpm lint` (0 تحذير)، `pnpm typecheck`، `pnpm test` (2 اختبارات)، `pnpm build`، و`ruff`/`mypy`/`pytest` (1 اختبار) — كلها ناجحة. `docker compose up --wait`: القاعدة والمحرك بحالة healthy، و`/health` يرجع `cp_sat: true`.
(في بيئة التطوير السحابية، بناء الصورة يحتاج تمرير الوكيل وشهادته يدويا؛ ليس ذلك جزءا من المستودع.)

### الخطوة 1 — prototype oracle

- [x] `packages/shared/src/contract`: مخططات zod لـ `SchoolData` (إعدادات، مواد، أقسام، أشخاص، سجلات أساتذة، خانات) مع تحقق من سلامة المراجع، و`Scenario` (البيانات + ما يطلبه SPEC + نتائج النموذج الأولي).
- [x] `tools/prototype-oracle`: Playwright يشغل `reference/prototype.html` دون تعديله؛ `init.js` (عشوائية ببذرة ثابتة) و`bridge.js` (تحويل `S` ⇄ `SchoolData`)، وواجهة Node (`PrototypeOracle`).
- [x] `packages/shared/fixtures/scenarios/*.json`: سيناريوهات القبول الخمسة لـ §6.5، لكل منها: التشخيص، `tMax`، `forcedLone`، ثلاث تشغيلات لـ `generate()` (بذور 1–3، 5 ث) بمؤشراتها وجداولها، وعناوين `advise()`.
- [x] الاختبارات: `shared` (14): صحة الملفات، 8 أقسام / 17 أستاذا / 205 ساعات، بصمة النموذج الأولي، تحقق SPEC على نتائج النموذج الأولي، رفض البيانات الخاطئة. `prototype-oracle` (18): التحويل ذهابا وإيابا، وإعادة حساب كل تشخيص ومؤشر وجودة محفوظة حرفيا في المتصفح، والصيغة القياسية للملفات.
- [x] CI يثبت Chromium ويشغل اختبارات oracle.

**نتائج النموذج الأولي (المرجع الذي يجب أن يساويه CP-SAT أو يتفوق عليه):**

| السيناريو | أفضل جودة | تعارض | بدون مكان | يوم ساعة واحدة | ملاحظة |
|---|---|---|---|---|---|
| 1 البيانات التجريبية | 92 | 0 | 0 | 1 (t16 مفروض) | يحقق SPEC |
| 2 كل الأساتذة غير متواجدين | 92 (84–92 حسب البذرة) | 0 | 0 | 1 | يحقق SPEC |
| 3 الحد الأقصى 16 | 44 | 0 | 4 | 1 | التشخيص: "أ. هشام الفاسي: 20 ساعات، والحد الأقصى الممكن 16 …" |
| 4 توقيت 45 د، 08:30 | 84 | 0 | 0 | **2** | يوم ساعة واحدة زائد غير مفروض: فرصة لـ CP-SAT |
| 5 أستاذ بمادتين | 92 | 0 | 0 | 1 | انظر الملاحظة |

- **ملاحظة السيناريو 5:** دمج سجل الإعلاميات مع شخص علوم الحياة يعطي 22 ساعة؛ لو بقي الشخص غير متواجد لكان الحد الأقصى 20 (حالة مستحيلة). في النموذج الأولي الشخص متواجد إذا كان أحد سجلاته متواجدا (`persons()`)، وسجل الإعلاميات متواجد، فالشخص المدمج متواجد.
- **ملاحظة صياغة:** رسائل التشخيص في النموذج الأولي تقول "20 ساعات" (لا "20 ساعة" كما في مثال SPEC)؛ الاختبار يطابق النص الفعلي.

## ملاحظات مفتوحة

- CI على GitHub أخضر للخطوة 0 (المهام الثلاث).

## التالي

- [ ] **الخطوة 2 — نواة المجال `packages/shared`**: الشبكة الزمنية، القواعد (`fits`/`conflictSet`)، `metrics`/`quality`، `tMax`/`diagnose`/`forcedLone`، `diffPlans`، عقد المحرك (JSON Schema ← pydantic)؛ parity مع oracle على جداول عشوائية.
- [ ] الخطوة 3 — المحرك `/solve` + `/diagnose` + اختبارات القبول 6.5.
- [ ] الخطوة 4 — `/repair` + المهام.
- [ ] الخطوة 5 — قاعدة البيانات وRLS.
- [ ] الخطوة 6 — أساس الويب (مصادقة، tenancy، RBAC، i18n، هوية).
- [ ] الخطوة 7 — شاشات جدول الحصص (§7.1–7.9).
- [ ] الخطوة 8 — الحياة المدرسية (§7.10).
- [ ] الخطوة 9 — النشر على AWS.
- [ ] الخطوة 10 — تطبيق الهاتف (لاحقا).
