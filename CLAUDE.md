# CLAUDE.md — حصص

منصة SaaS لتدبير المدارس الخصوصية في المغرب (multi-tenant). هذا الملف يحفظ القرارات والقواعد الثابتة. التفاصيل في `docs/PLAN.md`، والتقدم في `PROGRESS.md`.

## المراجع (اقرأها قبل أي عمل)

1. `SPEC.md` — المواصفات. هي المرجع عند أي تعارض.
2. `reference/prototype.html` — النموذج الأولي. **مرجع السلوك** لكل شاشة وقاعدة (المحرك `engine`، المؤشرات `metrics`/`quality`، التشخيص `diagnose`/`tMax`، الاقتراحات `advise`، الحلول `buildSolutions`/`diffPlans`، التعويض `analyze`). لا يُعدَّل.
3. `docs/PLAN.md` — الهيكل، مخطط قاعدة البيانات، نموذج CP-SAT، خطوات البناء.
4. `PROGRESS.md` — ما أُنجز وما التالي. حدّثه في نهاية كل خطوة.

## القرارات الثابتة

- **Monorepo**: pnpm workspaces + Turborepo (TS)، uv (Python). Node 22، TypeScript 6.0 (ليس 7: حدود typescript-eslint)، ESLint 9، Next.js 16، Tailwind 4، Vitest، Python 3.12، PostgreSQL 16.
- **النشر**: الويب على ECS Fargate (لا Amplify: لا يصل إلى VPC)، RDS خاص، المحرك على ECS داخلي. القرارات المعتمدة في `docs/adr/0001-plan-decisions.md`.
- **الحزم**: `apps/web` (Next.js App Router + TS + Tailwind)، `apps/mobile` (Expo، لاحقا)، `services/solver` (FastAPI + OR-Tools CP-SAT)، `packages/shared` (نواة المجال + عقد المحرك + RBAC)، `packages/db` (Prisma + SQL)، `infra` (AWS CDK).
- **عقد المحرك مصدره واحد**: zod في `packages/shared/src/contract` ← JSON Schema ← نماذج pydantic. لا يُكتب العقد يدويا في Python.
- **المحرك بدون قاعدة بيانات**: يتلقى JSON مكتفيا بذاته ويرجع حلا. لا أسرار DB في المحرك.
- **نموذج CP-SAT**: متغير لكل (مجموعة قسم×مادة، يوم، حصة) لا لكل ساعة. قيود 6.1 صارمة، أهداف 6.2 بنفس أوزان النموذج الأولي ×2 (أعداد صحيحة). الحصص بدون مكان هدف (10000) لا قيد، كي يوجد حل دائما.
- **المؤشرات واحدة في كل مكان**: `metrics`/`quality` في TS وPython مطابقة للنموذج الأولي، ومحمية باختبارات parity.
- **الوحدة هي الساعة**؛ ساعتان متتاليتان لنفس المادة والقسم تُعرضان كحصة واحدة، ولا تعبران استراحة الغداء.
- **المصادقة**: Auth.js، credentials (بريد/هاتف + كلمة سر argon2id)، جلسات JWT. رمز SMS لاحقا.
- **الترجمة**: next-intl، العربية (RTL، افتراضية) والفرنسية؛ نصوص الأولياء بالدارجة أيضا. Tailwind بخصائص منطقية فقط (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`)، لا `left`/`right`.
- **الهوية**: لون المدرسة ← متغيرات CSS (فاتح وداكن)، الشعار من S3.
- **الملفات**: S3 خاص، روابط موقّعة فقط، المفاتيح تبدأ بـ `{school_id}/`.

## قواعد عزل المدارس (غير قابلة للتفاوض)

1. **كل جدول بيانات مدرسة فيه `school_id`**، ومفاتيح أجنبية مركّبة `(x_id, school_id)` للعلاقات الإلزامية.
2. **كل جدول فيه `school_id` عليه `ENABLE` + `FORCE ROW LEVEL SECURITY`** وسياسة `school_id = app.current_school()`. اختبار آلي يفشل إذا نُسي جدول.
3. **Fail-closed**: بدون `app.school_id` لا يرجع أي سطر.
4. الوصول لبيانات المدرسة **فقط** عبر `tenantDb(schoolId)` (يضبط `set_config('app.school_id', …, true)` داخل معاملة). العميل الخام ممنوع خارج مسار صاحب المنصة (`platformDb`)، وكل استعمال له يُسجل في `audit_log`.
5. `school_id` يأتي من النطاق الفرعي + عضوية المستعمل، **أبدا من جسم الطلب أو المعاملات**.
6. الأستاذ المشترك: المدرسة ترى "محجوز في مدرسة أخرى" **دون اسم تلك المدرسة** أو أي معرّف لها.
7. صاحب المنصة لا يرى بيانات التلاميذ إلا عبر `support_access` محدود زمنيا ومسجَّل.

## قواعد المنتج الثابتة

- **لا شيء يتغير دون موافقة المستعمل**: كل حل تلقائي يُعرض مع المؤشرات قبل/بعد وقائمة التغييرات (من ← إلى) قبل التطبيق.
- **كل معلومة تُدخل مرة واحدة**: جدول الحصص ← الغياب ← التعويض ← الأجور ← التقارير.
- **كل تعديل** (خاصة الغياب والحوادث) يُسجل في `audit_log` (إلحاق فقط).
- الحارس العام لا يرى المالية؛ الولي يرى أبناءه فقط والحوادث `visible_to_parent` فقط.
- المنصة تكمّل Massar ولا تعوّضها.
- **لا بيانات حقيقية** قبل حسم منطقة الاستضافة والتصريح لدى CNDP (القانون 09-08).

## قواعد العمل

- **الاختبار أولا للقواعد**: كل قاعدة من 6.1 لها اختبار وحدة؛ اختبارات القبول 6.5 تعمل في CI؛ كل خطأ يُكتشف يُضاف كاختبار فاشل قبل إصلاحه.
- **عند الشك في سلوك**: شغّل النموذج الأولي (أو `tools/prototype-oracle`) وطابقه، ولا تخمّن.
- **أي انحراف عن SPEC** يُسجل كـ ADR في `docs/adr/` بعد موافقة صاحب المشروع.
- الأداء: التوليد الكامل < 30 ثانية لمدرسة من 30 قسما.
- **الأوامر**:
  - من الجذر: `pnpm install`، `pnpm format:check`، `pnpm lint`، `pnpm typecheck`، `pnpm test`، `pnpm build`.
  - داخل `services/solver`: `uv sync`، `uv run ruff check .`، `uv run ruff format --check .`، `uv run mypy solver tests`، `uv run pytest`.
  - `docker compose up -d --build --wait` ← Postgres على 5432 والمحرك على 8000 (`/health`).
  - `pnpm --filter @hissas/prototype-oracle export` ← يعيد توليد `packages/shared/fixtures/scenarios/*.json` من النموذج الأولي (عند تغييره فقط). في بيئة سحابية فيها Chromium مسبقا: `CHROMIUM_PATH=/opt/pw-browsers/chromium`.
  - عند تغيير عقد المحرك (`packages/shared/src/contract/solver.ts` أو `school.ts`): `pnpm --filter @hissas/shared contract:export` ثم `services/solver/scripts/gen-contract.sh`، ويُلتزم بالملفين المولَّدين (`contract/solver.schema.json` و`solver/contract.py`). CI يفشل إذا لم يُحدَّثا.
- **نواة المجال** (`packages/shared/src/timetable`) منقولة حرفيا من النموذج الأولي ومحمية باختبار مطابقة عشوائي (`tools/prototype-oracle/test/parity.test.ts`). أي تغيير في سلوكها يجب أن يمر بالمطابقة أو يُسجل كانحراف مقصود.
- **fixtures السيناريوهات هي الحقيقة المشتركة**: TS وPython يختبران عليها؛ لا تُعدَّل يدويا.
- **CI** (`.github/workflows/ci.yml`) يشغل كل ما سبق؛ لا commit يكسره.
- ملف `AGENTS.md` لا يُستعمل (`agentGuidance: false` في turbo.json)؛ المرجع هو هذا الملف.
- التطوير على الفرع المحدد؛ commit لكل خطوة مكتملة؛ لا PR إلا بطلب.
