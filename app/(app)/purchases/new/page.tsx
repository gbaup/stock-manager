import { getModels, getUsers } from '@/app/lib/queries';
import { getRate } from '@/app/lib/exchange-rate';
import { PurchaseForm } from '@/components/screens/purchase-form';

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ modelId?: string }>;
}) {
  const { modelId } = await searchParams;
  const [models, users, rate] = await Promise.all([getModels(), getUsers(), getRate()]);
  return <PurchaseForm models={models} presetModelId={modelId} users={users} rate={rate} />;
}
