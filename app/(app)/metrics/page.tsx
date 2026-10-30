import { getHomeSales, getUsers, getTransitCount } from '@/app/lib/queries';
import { getBuiltSaldos } from '@/app/lib/ledger-queries';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { MetricsScreen } from '@/components/screens/metrics-screen';

export default async function MetricsPage() {
  const [sales, users, transitCount, exchangeRate, saldos] = await Promise.all([
    getHomeSales(),
    getUsers(),
    getTransitCount(),
    getExchangeRate(),
    getBuiltSaldos(),
  ]);
  return (
    <MetricsScreen
      sales={sales}
      users={users}
      transitCount={transitCount}
      exchangeRate={exchangeRate}
      movements={saldos.movements}
    />
  );
}
