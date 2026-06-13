import { getModels, getUsers } from '@/app/lib/queries';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { QuickSaleForm } from '@/components/screens/quick-sale-form';

export default async function SellPage() {
  const [models, users, usdRate] = await Promise.all([
    getModels(),
    getUsers(),
    getExchangeRate(),
  ]);

  return <QuickSaleForm models={models} users={users} usdRate={usdRate} />;
}
