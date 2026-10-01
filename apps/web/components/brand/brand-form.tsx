'use client';

/* eslint-disable @next/next/no-img-element -- الشعار رابط data أو رابط S3 موقّع، لا صورة ثابتة */
import {
  BRAND_COLORS,
  PLATFORM_DOMAIN,
  PLATFORM_NAME,
  appIconInitial,
  inkOn,
} from '@hissas/shared';
import { useState } from 'react';
import { Logo } from '@/components/logo';
import { readLogo } from '@/lib/image';
import { useToast } from '@/components/toast';

export interface BrandFields {
  name: string;
  slug: string;
  color: string;
  logo: string | null;
}

/**
 * نموذج الهوية (brandForm): الاسم، الرابط، اللون، الشعار.
 * الاسم والرابط يُعتمدان عند مغادرة الحقل (onCommit)، واللون والشعار فورا.
 */
export function BrandForm({
  prefix,
  value,
  onChange,
  onCommitName,
  onCommitSlug,
}: {
  prefix: string;
  value: BrandFields;
  onChange: (patch: Partial<BrandFields>) => void;
  onCommitName?: (name: string) => void;
  onCommitSlug?: (slug: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(value.name);
  const [slug, setSlug] = useState(value.slug);
  const [seen, setSeen] = useState({ name: value.name, slug: value.slug });
  // تحديث الحقول عند تغيّر القيمة من الخارج (مثلا بعد تصحيح الرابط)
  if (seen.name !== value.name || seen.slug !== value.slug) {
    setSeen({ name: value.name, slug: value.slug });
    setName(value.name);
    setSlug(value.slug);
  }
  return (
    <>
      <label className="fld">
        اسم المدرسة
        <input
          type="text"
          id={`${prefix}-name`}
          value={name}
          placeholder="مثال: Groupe Scolaire Larus"
          onChange={(e) => {
            setName(e.target.value);
            if (!onCommitName) onChange({ name: e.target.value });
          }}
          onBlur={() => onCommitName?.(name)}
        />
      </label>
      <label className="fld">
        عنوان الموقع
        <span className="slug">
          <span dir="ltr">
            <input
              type="text"
              id={`${prefix}-slug`}
              value={slug}
              dir="ltr"
              aria-label="الاسم في الرابط"
              onChange={(e) => {
                setSlug(e.target.value);
                if (!onCommitSlug) onChange({ slug: e.target.value });
              }}
              onBlur={() => onCommitSlug?.(slug)}
            />
            .{PLATFORM_DOMAIN}
          </span>
        </span>
      </label>
      <div className="fld">
        لون المدرسة
        <div className="chips">
          {BRAND_COLORS.map((c) => (
            <button
              key={c}
              className="sw"
              aria-pressed={value.color === c}
              style={{ background: c }}
              aria-label={c}
              onClick={() => onChange({ color: c })}
            />
          ))}
          <input
            type="color"
            id={`${prefix}-colorx`}
            value={value.color}
            aria-label="لون آخر"
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </div>
      </div>
      <div className="fld">
        الشعار
        <div className="toolbar">
          <Logo name={value.name} color={value.color} logo={value.logo} size={48} />
          <label className="btn sm">
            رفع صورة الشعار
            <input
              type="file"
              id={`${prefix}-logo`}
              accept="image/*"
              className="sr"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  readLogo(f)
                    .then((logo) => onChange({ logo }))
                    .catch(() => toast('تعذّرت قراءة الصورة'));
              }}
            />
          </label>
          {value.logo && (
            <button className="btn sm ghost" onClick={() => onChange({ logo: null })}>
              إزالة
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** معاينة أيقونة التطبيق باسم المدرسة (appPreview). */
export function AppPreview({ value }: { value: BrandFields }) {
  return (
    <div className="appprev">
      <div className="homescreen">
        <div className="icon" style={{ background: value.logo ? '#fff' : value.color }}>
          {value.logo ? (
            <img src={value.logo} alt="" />
          ) : (
            <span style={{ color: inkOn(value.color) }}>{appIconInitial(value.name)}</span>
          )}
        </div>
        <span className="iname">{value.name}</span>
      </div>
      <div>
        <b>تطبيق باسم المدرسة</b>
        <p className="hint">
          هكذا ستظهر أيقونة تطبيقها في هواتف الأولياء عند نشر نسخة خاصة بها في App Store وGoogle
          Play. التطبيق العام &quot;{PLATFORM_NAME}&quot; يعرض نفس الشعار والألوان بعد تسجيل الدخول.
        </p>
        <p className="hint" dir="ltr" style={{ textAlign: 'start' }}>
          https://{value.slug}.{PLATFORM_DOMAIN}
        </p>
      </div>
    </div>
  );
}
