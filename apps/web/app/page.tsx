'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePlatform } from '@/lib/store';

/** الصفحة الرئيسية: المدرسة المفتوحة، وإلا لوحة صاحب المنصة. */
export default function Home() {
  const p = usePlatform();
  const router = useRouter();
  useEffect(() => {
    if (!p) return;
    const m = p.schools.find((x) => x.id === p.current) ?? p.schools[0];
    router.replace(m ? `/s/${m.slug}` : '/owner');
  }, [p, router]);
  return <div className="loading">…</div>;
}
