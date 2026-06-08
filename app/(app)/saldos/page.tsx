import { getSaldosData, getTransitCount, getUsers } from '@/app/lib/queries';
import { SaldosScreen } from '@/components/screens/saldos-screen';

export default async function SaldosPage() {
  const [{ purchases, sales, expenses, conversions }, transitCount, users] = await Promise.all([
    getSaldosData(),
    getTransitCount(),
    getUsers(),
  ]);

  return (
    <SaldosScreen
      purchases={purchases}
      sales={sales}
      expenses={expenses}
      conversions={conversions}
      transitCount={transitCount}
      users={users}
    />
  );
}
