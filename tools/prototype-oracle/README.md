# prototype-oracle

يشغّل `reference/prototype.html` في Chromium (Playwright) ويستعمل دواله **كما هي** مرجعا للسلوك:
`seed`، `metrics`، `conflictSet`، `quality`، `diagnose`، `tMax`، `forcedLone`، `generate`، `advise`.

- `src/init.js` — يُحقن قبل التحميل: `Math.random` بذرة ثابتة، ومدرسة فارغة كي لا يولّد جدولا عند الإقلاع.
- `src/bridge.js` — يُحقن بعد التحميل: تحويل بين حالة النموذج الأولي `S` وصيغة `SchoolData` (`@hissas/shared`).
- `src/oracle.ts` — واجهة Node: `PrototypeOracle.open()`، `demoSchool()`، `load()`، `measure()`، `generate()`…
- `src/scenarios.ts` — سيناريوهات القبول SPEC §6.5 مبنية على البيانات التجريبية.

## توليد fixtures

```sh
pnpm --filter @hissas/prototype-oracle export             # كل السيناريوهات، البذور 1,2,3، ميزانية 5000 مللي ثانية
pnpm --filter @hissas/prototype-oracle export --only 6.5-3-max-16 --seeds 1 --budget 2000
```

النتيجة في `packages/shared/fixtures/scenarios/*.json`: البيانات، ما يطلبه SPEC (`expected`)، وما أنتجه
النموذج الأولي (`prototype`). `generate()` محدود بالوقت، فإعادة التوليد قد تعطي جداول مختلفة قليلا؛
أعد التوليد فقط عند تغيير النموذج الأولي أو السيناريوهات (الاختبارات تكشف ذلك عبر `prototype_sha256`).

## الاختبارات

`pnpm test` يعيد فتح النموذج الأولي ويتحقق أن: التحويل ذهابا وإيابا لا يغيّر البيانات، وأن التشخيص
والمؤشرات والجودة المحفوظة تُعاد حرفيا لكل جدول محفوظ.

إذا كان Chromium مثبتا مسبقا بإصدار مختلف عن Playwright: `CHROMIUM_PATH=/path/to/chrome pnpm test`.
