import { Suspense } from 'react';
import { getModels, getUsers } from '@/app/lib/queries';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { getCurrentUserId } from '@/app/lib/auth';
import { QuickSaleForm } from '@/components/screens/quick-sale-form';

async function SellContent() {
  const [models, users, usdRate, sessionUserId] = await Promise.all([
    getModels(),
    getUsers(),
    getExchangeRate(),
    getCurrentUserId(),
  ]);

  return <QuickSaleForm models={models} users={users} usdRate={usdRate} sessionUserId={sessionUserId ?? ''} />;
}

export default function SellPage() {
  return (
    <Suspense>
      <SellContent />
    </Suspense>
  );
}
