'use client';

import {
  applyImport,
  buildImport,
  distributionRows,
  freeTimeRows,
  printableHtml,
  tsvRows,
  weeklyCapacity,
  workbookModel,
  type ExportWhich,
  type ImportResult,
  type Sheet,
} from '@hissas/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { useGenerate } from '@/lib/generate';
import { useSchoolCtx } from '@/lib/school';
import { download, readWorkbook, writeWorkbook } from '@/lib/xlsx';

const WHICH: [ExportWhich, string][] = [
  ['all', 'الكل'],
  ['classes', 'الأقسام'],
  ['teachers', 'الأساتذة'],
];

/** استيراد وتصدير (viewIO، SPEC §7.5–7.6). */
export default function IoPage() {
  const { meta, state, model, placed, href } = useSchoolCtx();
  const { generate, busy } = useGenerate();
  const toast = useToast();
  const router = useRouter();
  const [which, setWhich] = useState<ExportWhich>('all');
  const [imp, setImp] = useState<ImportResult | null>(null);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [working, setWorking] = useState(false);
  const { school } = state;
  const cap = weeklyCapacity(school.config);
  const read = (sheets: Sheet[]) => setImp(buildImport(sheets, school.subjects, school.config));

  const exportXlsx = async () => {
    setWorking(true);
    try {
      download('emplois-du-temps.xlsx', await writeWorkbook(workbookModel(model, placed, which)));
      toast('تم حفظ الملف');
    } catch {
      toast('تعذّر حفظ الملف');
    } finally {
      setWorking(false);
    }
  };

  const exportTemplate = async () => {
    setWorking(true);
    try {
      const blob = await writeWorkbook([
        { name: 'التوزيع', rows: distributionRows(school), merges: [], cols: [12, 28, 26, 9, 9] },
        { name: 'أوقات الفراغ', rows: freeTimeRows(model), merges: [], cols: [26, 11, 8, 8, 12] },
      ]);
      download('donnees-ecole.xlsx', blob);
      toast('تم حفظ الملف');
    } catch {
      toast('تعذّر حفظ الملف');
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    if (!imp || !imp.ok) return;
    const next = applyImport(school, imp);
    await generate(
      next,
      (unplaced, total) =>
        `استُورد ${next.classes.length} أقسام، وتولّد الجدول: ${total - unplaced}/${total} حصة`,
    );
    setImp(null);
    router.push(href('/timetable'));
  };

  return (
    <div className="grid2">
      <section className="panel">
        <h2>تصدير الجداول</h2>
        <p className="hint">
          جدول لكل قسم ولكل أستاذ، بترويسة المدرسة والسنة الدراسية ومجموع الساعات، والساعتان
          المتتاليتان في خانة واحدة.
        </p>
        <div className="seg" role="group" aria-label="ما الذي تريد تصديره">
          {WHICH.map(([v, n]) => (
            <button key={v} aria-pressed={which === v} onClick={() => setWhich(v)}>
              {n}
            </button>
          ))}
        </div>
        <div className="list">
          <div className="row" style={{ cursor: 'default' }}>
            <span>
              <b>ملف Excel</b>
              <br />
              <span className="meta">
                ورقة لكل جدول، وورقتا &quot;التوزيع&quot; و&quot;أوقات الفراغ&quot; قابلتان للتعديل
                ثم الاستيراد
              </span>
            </span>
            <button className="btn primary sm" disabled={working} onClick={() => void exportXlsx()}>
              تحميل
            </button>
          </div>
          <div className="row" style={{ cursor: 'default' }}>
            <span>
              <b>صفحة للطباعة (PDF)</b>
              <br />
              <span className="meta">
                افتح الملف في المتصفح، ثم اطبعه أو احفظه PDF. كل جدول في صفحة A4 أفقية
              </span>
            </span>
            <button
              className="btn sm"
              onClick={() => {
                download(
                  'emplois-du-temps.html',
                  printableHtml(model, placed, which, { color: meta.color, logo: meta.logo }),
                );
                toast('تم حفظ الملف');
              }}
            >
              تحميل
            </button>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>استيراد بيانات مدرستك</h2>
        <p className="hint">
          ملف Excel فيه ورقتان: <b>التوزيع</b> (القسم، المادة، الأستاذ، الساعات، متواجد) و
          <b>أوقات الفراغ</b> (الأستاذ، اليوم، من، إلى). الأسهل: حمّل القالب ببياناتك الحالية، عدّله
          في Excel، ثم استورده.
        </p>
        <div className="toolbar">
          <button className="btn sm" disabled={working} onClick={() => void exportTemplate()}>
            تحميل القالب
          </button>
          <label
            className="btn sm primary"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            اختيار ملف Excel
            <input
              type="file"
              id="io-file"
              accept=".xlsx,.csv"
              className="sr"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f)
                  readWorkbook(f)
                    .then(read)
                    .catch(() =>
                      setImp({
                        ok: false,
                        error: 'تعذّرت قراءة الملف. تأكد أنه ملف Excel (.xlsx) أو CSV.',
                      }),
                    );
              }}
            />
          </label>
        </div>
        <details>
          <summary>أو الصق من Excel مباشرة</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label className="fld">
              التوزيع (مع سطر العناوين)
              <textarea
                id="io-p1"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                placeholder={'القسم\tالمادة\tالأستاذ\tالساعات\tمتواجد'}
              />
            </label>
            <label className="fld">
              أوقات الفراغ (اختياري)
              <textarea
                id="io-p2"
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                placeholder={'الأستاذ\tاليوم\tمن\tإلى'}
              />
            </label>
            <div>
              <button className="btn sm" onClick={() => read([tsvRows(p1), tsvRows(p2)])}>
                قراءة البيانات الملصقة
              </button>
            </div>
          </div>
        </details>
        {imp && !imp.ok && <div className="banner bad">{imp.error}</div>}
        {imp?.ok && (
          <div className="affected">
            <header>
              <h3>معاينة قبل الاستيراد</h3>
              <span className="tag acc">
                {imp.classes.length} أقسام · {imp.persons} أستاذا
              </span>
            </header>
            <table className="plain">
              <thead>
                <tr>
                  <th>القسم</th>
                  <th>المواد</th>
                  <th>الساعات</th>
                </tr>
              </thead>
              <tbody>
                {imp.classes.map((c) => {
                  const n = imp.teachers.reduce(
                    (a, t) => a + (t.classes.find((x) => x.class_id === c.id)?.hours ?? 0),
                    0,
                  );
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="num">{c.subjects.length}</td>
                      <td className="num">
                        {n} {n > cap && <span className="tag bad">الخانات {cap} فقط</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint">
              {imp.with_free} أساتذة بأوقات فراغ محددة. الأستاذ الذي يدرّس مادتين يُعامل كشخص واحد،
              فلا تتعارض حصصه.
            </p>
            {imp.warnings.length > 0 && (
              <ul className="chg">
                {imp.warnings.slice(0, 12).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {imp.warnings.length > 12 && <li>و{imp.warnings.length - 12} ملاحظات أخرى</li>}
              </ul>
            )}
            <div className="banner">
              الاستيراد يعوّض الأقسام والأساتذة الحاليين ثم يولّد جدولا جديدا بتوقيت مدرستك المحفوظ.
            </div>
            <div className="toolbar">
              <button className="btn primary" disabled={busy} onClick={() => void apply()}>
                {busy ? 'جارٍ الاستيراد والتوليد…' : 'تأكيد الاستيراد وتوليد الجدول'}
              </button>
              <button className="btn ghost" onClick={() => setImp(null)}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
