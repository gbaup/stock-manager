import { getBuiltSaldos } from '@/app/lib/ledger-queries';
import { getTransitCount } from '@/app/lib/queries';
import { SaldosScreen } from '@/components/screens/saldos-screen';

export default async function SaldosPage() {
  const [saldos, transitCount] = await Promise.all([
    getBuiltSaldos(),
    getTransitCount(),
    getUsers(),
  ]);

  return <SaldosScreen {...saldos} transitCount={transitCount} />;
}
