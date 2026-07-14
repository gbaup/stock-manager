import { Suspense } from 'react';
import { getPublicModels } from '@/app/lib/queries';
import { getCurrentUserId } from '@/app/lib/auth';
import { PublicScreen } from '@/components/screens/public-screen';

type PublicModels = Awaited<ReturnType<typeof getPublicModels>>['models'];

async function PublicScreenWithAuth({
  models, today, whatsappNumber, whatsappMessage,
}: { models: PublicModels; today: string; whatsappNumber?: string; whatsappMessage?: string }) {
  const loggedIn = (await getCurrentUserId()) !== null;
  return (
    <PublicScreen
      models={models}
      today={today}
      loggedIn={loggedIn}
      whatsappNumber={whatsappNumber}
      whatsappMessage={whatsappMessage}
    />
  );
}

export default async function PublicPage() {
  const { models, today } = await getPublicModels();
  const whatsappNumber = process.env.WHATSAPP_NUMBER || undefined;
  const whatsappMessage = process.env.WHATSAPP_MESSAGE || undefined;
  return (
    <div className="app-shell">
      <Suspense fallback={
        <PublicScreen
          models={models}
          today={today}
          loggedIn={false}
          whatsappNumber={whatsappNumber}
          whatsappMessage={whatsappMessage}
        />
      }>
        <PublicScreenWithAuth
          models={models}
          today={today}
          whatsappNumber={whatsappNumber}
          whatsappMessage={whatsappMessage}
        />
      </Suspense>
    </div>
  );
}
