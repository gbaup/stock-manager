import { getHomeSales, getUsers, getTransitCount, getExpensesForMetrics } from '@/app/lib/queries';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { MetricsScreen } from '@/components/screens/metrics-screen';

export default async function MetricsPage() {
  const [sales, users, transitCount, expenses, exchangeRate] = await Promise.all([
    getHomeSales(),
    getUsers(),
    getTransitCount(),
    getExpensesForMetrics(),
    getExchangeRate(),
  ]);
  return (
    <MetricsScreen
      sales={sales}
      users={users}
      transitCount={transitCount}
      expenses={expenses}
      exchangeRate={exchangeRate}
    />
  );
}
