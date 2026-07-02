import { Suspense } from 'react';
import { getPublicModels } from '@/app/lib/queries';
import { getCurrentUserId } from '@/app/lib/auth';
import { PublicScreen } from '@/components/screens/public-screen';

type PublicModels = Awaited<ReturnType<typeof getPublicModels>>['models'];

async function PublicScreenWithAuth({ models, today }: { models: PublicModels; today: string }) {
  const loggedIn = (await getCurrentUserId()) !== null;
  return <PublicScreen models={models} today={today} loggedIn={loggedIn} />;
}

export default async function PublicPage() {
  const { models, today } = await getPublicModels();
  return (
    <div className="app-shell">
      <Suspense fallback={<PublicScreen models={models} today={today} loggedIn={false} />}>
        <PublicScreenWithAuth models={models} today={today} />
      </Suspense>
    </div>
  );
}
