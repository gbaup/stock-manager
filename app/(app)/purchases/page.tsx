import { getPurchases, getTransitCount, getModels, getUsers } from '@/app/lib/queries';
import { getRate } from '@/app/lib/exchange-rate';
import { PurchasesScreen } from '@/components/screens/purchases-screen';

export default async function PurchasesPage() {
  const [batches, transitCount, models, users, rate] = await Promise.all([
    getPurchases(),
    getTransitCount(),
    getModels(),
    getUsers(),
    getRate(),
  ]);
  return <PurchasesScreen batches={batches} transitCount={transitCount} models={models} users={users} rate={rate} />;
}
