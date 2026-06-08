import { getSaldosData, getTransitCount } from '@/app/lib/queries';
import { SaldosScreen } from '@/components/screens/saldos-screen';

export default async function SaldosPage() {
  const [{ purchases, sales, expenses, conversions }, transitCount] = await Promise.all([
    getSaldosData(),
    getTransitCount(),
  ]);

  return (
    <SaldosScreen
      purchases={purchases}
      sales={sales}
      expenses={expenses}
      conversions={conversions}
      transitCount={transitCount}
    />
  );
}
