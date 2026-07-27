import { getHomeSales, getUsers, getTransitCount } from '@/app/lib/queries';
import { MetricsScreen } from '@/components/screens/metrics-screen';

export default async function MetricsPage() {
  const [sales, users, transitCount] = await Promise.all([
    getHomeSales(),
    getUsers(),
    getTransitCount(),
  ]);
  return <MetricsScreen sales={sales} users={users} transitCount={transitCount} />;
}
