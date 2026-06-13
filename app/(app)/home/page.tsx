import { Suspense } from 'react';
import { getModels, getHomeSales, getUsers, getTransitCount } from '@/app/lib/queries';
import { getCurrentUserId } from '@/app/lib/auth';
import { HomeScreen } from '@/components/screens/home-screen';
import { BottomNav } from '@/components/ui/chrome';

async function HomeContent() {
  const [models, sales, users, transitCount, sessionUserId] = await Promise.all([
    getModels(),
    getHomeSales(),
    getUsers(),
    getTransitCount(),
    getCurrentUserId(),
  ]);

  return (
    <>
      <HomeScreen models={models} sales={sales} users={users} sessionUserId={sessionUserId ?? ''} />
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
