export const dynamic = 'force-dynamic';
import { getModels, getUsers } from '@/app/lib/queries';
import { PurchaseForm } from '@/components/screens/purchase-form';

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ modelId?: string }>;
}) {
  const { modelId } = await searchParams;
  const [models, users] = await Promise.all([getModels(), getUsers()]);
  return <PurchaseForm models={models} presetModelId={modelId} users={users} />;
}
