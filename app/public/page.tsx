export const dynamic = 'force-dynamic';
import { getPublicModels } from '@/app/lib/queries';
import { PublicScreen } from '@/components/screens/public-screen';

export default async function PublicPage() {
  const models = await getPublicModels();
  return (
    <div className="app-shell">
      <PublicScreen models={models} />
    </div>
  );
}
