import { getModels, getTeams, getUsers } from '@/app/lib/queries';
import { getRate } from '@/app/lib/exchange-rate';
import { PurchaseForm } from '@/components/screens/purchase-form';

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ modelId?: string; newModelId?: string }>;
}) {
  const { modelId, newModelId } = await searchParams;
  const [models, users, rate, teams] = await Promise.all([getModels(), getUsers(), getRate(), getTeams()]);
  return (
    <PurchaseForm
      models={models}
      presetModelId={modelId}
      newModelId={newModelId}
      users={users}
      rate={rate}
      teams={teams}
    />
  );
}
