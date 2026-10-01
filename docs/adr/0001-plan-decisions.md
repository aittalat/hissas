# ADR 0001 — قرارات الخطة المعتمدة

- **الحالة:** معتمد (2026-09-30، موافقة صاحب المشروع على `docs/PLAN.md`)
- **السياق:** القسم 5 من `docs/PLAN.md` طرح قرارات تنحرف عن SPEC أو تكمله.

## القرارات

1. **نشر الويب على ECS Fargate** (أو App Runner مع VPC connector) بدل Amplify، لأن Amplify SSR لا يدخل VPC خاصا (RDS والمحرك داخليان).
2. **الأستاذ المشترك**: الحجوزات بين المدارس تُحسب بالتداخل الزمني الفعلي (يوم + دقائق)، ثم تُحوَّل إلى أرقام حصص كل مدرسة كـ `availability.status = other_school` و`source = network`، دون أي إشارة للمدرسة المصدر.
3. **الوزن `over`** (3 لكل حصة فوق `max(5, P−2)` في يوم القسم) يبقى في دالة الهدف كما في النموذج الأولي.
4. **`absences.person_id`** بدل `teacher_id`: الغياب لشخص وليس لسجل مادة.
5. **إضافات على SPEC §5**: `users`، `memberships`، `support_access`، `solver_jobs`، `subjects.prefer_double`، `subjects.name_fr`، `availability.source`، `timetables.published_at`/`input_hash`، ونسخ `school_id` في كل الجداول الفرعية.
6. **`present`/`shared`** متطابقان لكل سجلات نفس الشخص في المدرسة، يُفرض بـ trigger مع إبقاء بنية §5.
7. **الاستضافة**: لا بيانات حقيقية قبل حسم المنطقة وتصريح CNDP؛ التطوير ببيانات وهمية في `eu-west-3`.

## قرارات أدوات (الخطوة 0)

- **TypeScript 6.0** وليس 7: `typescript-eslint` 8 يدعم `<6.1` فقط.
- **ESLint 9** (flat config): حزم `eslint-config-next` لم تُعلن دعم ESLint 10 بعد.
- **Python 3.12** مثبت عبر uv (`.python-version`)، و`httpx2` لعميل الاختبار (Starlette أهمل `httpx`).
- صورة المحرك تثبت uv عبر pip (لا تعتمد على ghcr.io)، وتعمل بمستعمل غير root.
