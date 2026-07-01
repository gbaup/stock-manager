import { getModels, getUsers } from '@/app/lib/queries';
import { getRate } from '@/app/lib/exchange-rate';
import { PurchaseForm } from '@/components/screens/purchase-form';

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ modelId?: string; newModelId?: string }>;
}) {
  const { modelId, newModelId } = await searchParams;
  const [models, users, rate] = await Promise.all([getModels(), getUsers(), getRate()]);
  return (
    <PurchaseForm
      models={models}
      presetModelId={modelId}
      newModelId={newModelId}
      users={users}
      rate={rate}
    />
  );
}
