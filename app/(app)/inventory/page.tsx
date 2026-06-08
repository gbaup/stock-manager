export const dynamic = 'force-dynamic';
import { getModels, getTransitCount } from '@/app/lib/queries';
import { InventoryScreen } from '@/components/screens/inventory-screen';

export default async function InventoryPage() {
  const [models, transitCount] = await Promise.all([getModels(), getTransitCount()]);
  return <InventoryScreen models={models} transitCount={transitCount} />;
}
