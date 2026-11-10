import { getBuiltSaldos } from '@/app/lib/ledger-queries';
import { getHomeSales, getModels, getTransitCount } from '@/app/lib/queries';
import { SaldosScreen } from '@/components/screens/saldos-screen';

export default async function SaldosPage() {
  // Sales + models feed the read-only sale detail modal (same one as Home)
  // and the per-partner "kept for themselves" count. Both are cached reads.
  const [saldos, transitCount, sales, models] = await Promise.all([
    getBuiltSaldos(),
    getTransitCount(),
    getHomeSales(),
    getModels(),
  ]);

  return <SaldosScreen {...saldos} transitCount={transitCount} sales={sales} models={models} />;
}
