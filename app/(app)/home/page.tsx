import { Suspense } from 'react';
import { getModels, getHomeSales, getUsers, getTransitCount } from '@/app/lib/queries';
import { getCurrentUserId } from '@/app/lib/auth';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { HomeScreen } from '@/components/screens/home-screen';
import { BottomNav, Sidebar } from '@/components/ui/chrome';

async function HomeContent() {
  const [models, sales, users, transitCount, sessionUserId, usdRate] = await Promise.all([
    getModels(),
    getHomeSales(),
    getUsers(),
    getTransitCount(),
    getCurrentUserId(),
    getExchangeRate(),
  ]);

  return (
    <>
      <Sidebar transitCount={transitCount} />
      <HomeScreen models={models} sales={sales} users={users} sessionUserId={sessionUserId ?? ''} usdRate={usdRate} />
      <BottomNav transitCount={transitCount} />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
