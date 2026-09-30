/* eslint-disable @next/next/no-img-element -- الشعار رابط data أو رابط S3 موقّع، لا صورة ثابتة */
import { inkOn, logoInitial } from '@hissas/shared';

/** شعار المدرسة: الصورة، أو الحرف الأول على لون المدرسة (logoHTML). */
export function Logo({
  name,
  color,
  logo,
  size = 40,
}: {
  name: string;
  color: string;
  logo: string | null;
  size?: number;
}) {
  if (logo)
    return (
      <img
        src={logo}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          objectFit: 'contain',
          background: '#fff',
        }}
      />
    );
  return (
    <span
      className="ini"
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        background: color,
        color: inkOn(color),
        fontSize: size * 0.45,
      }}
    >
      {logoInitial(name)}
    </span>
  );
}
