import { getModels, getTransitCount, getTeams, getUsers } from '@/app/lib/queries';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { InventoryScreen } from '@/components/screens/inventory-screen';

export default async function InventoryPage() {
  const [models, transitCount, teams, users, usdRate] = await Promise.all([
    getModels(),
    getTransitCount(),
    getTeams(),
    getUsers(),
    getExchangeRate(),
  ]);
  return <InventoryScreen models={models} transitCount={transitCount} teams={teams} users={users} usdRate={usdRate} />;
}
