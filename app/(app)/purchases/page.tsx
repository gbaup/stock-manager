export const dynamic = 'force-dynamic';
import { getPurchases, getTransitCount } from '@/app/lib/queries';
import { PurchasesScreen } from '@/components/screens/purchases-screen';

export default async function PurchasesPage() {
  const [batches, transitCount] = await Promise.all([getPurchases(), getTransitCount()]);
  return <PurchasesScreen batches={batches} transitCount={transitCount} />;
}
