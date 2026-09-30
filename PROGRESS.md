# PROGRESS — حصص

آخر تحديث: 2026-09-30

## الحالة الحالية

**الخطوة 0 (التأسيس) مكتملة.** التالي: الخطوة 1 — prototype oracle.

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

## ملاحظات مفتوحة

- الفرع مدفوع إلى GitHub؛ يجب التأكد من أول تشغيل لـ CI هناك (خاصة مهمة compose).

## التالي

- [ ] **الخطوة 1 — prototype oracle**: `tools/prototype-oracle` (Playwright) يشغل `seed()` وسيناريوهات 6.5 ويصدّر `packages/shared/fixtures/*.json` + المؤشرات المرجعية.
- [ ] الخطوة 2 — نواة المجال `packages/shared` (العقد، الشبكة الزمنية، القواعد، المؤشرات، التشخيص، diff).
- [ ] الخطوة 3 — المحرك `/solve` + `/diagnose` + اختبارات القبول 6.5.
- [ ] الخطوة 4 — `/repair` + المهام.
- [ ] الخطوة 5 — قاعدة البيانات وRLS.
- [ ] الخطوة 6 — أساس الويب (مصادقة، tenancy، RBAC، i18n، هوية).
- [ ] الخطوة 7 — شاشات جدول الحصص (§7.1–7.9).
- [ ] الخطوة 8 — الحياة المدرسية (§7.10).
- [ ] الخطوة 9 — النشر على AWS.
- [ ] الخطوة 10 — تطبيق الهاتف (لاحقا).
