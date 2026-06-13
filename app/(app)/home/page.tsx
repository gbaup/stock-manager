import { getModels, getHomeSales, getUsers, getTransitCount } from '@/app/lib/queries';
import { HomeScreen } from '@/components/screens/home-screen';
import { BottomNav } from '@/components/ui/chrome';

export default async function HomePage() {
  const [models, sales, users, transitCount] = await Promise.all([
    getModels(),
    getHomeSales(),
    getUsers(),
    getTransitCount(),
  ]);

  return (
    <>
      <HomeScreen models={models} sales={sales} users={users} />
      <BottomNav transitCount={transitCount} />
    </>
  );
}
