'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RatesDiscountsPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/property-settings/rates-discounts/rates');
  }, [router]);

  return null;
}
