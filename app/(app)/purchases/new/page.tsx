export const dynamic = 'force-dynamic';
import { getModels } from '@/app/lib/queries';
import { PurchaseForm } from '@/components/screens/purchase-form';

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ modelId?: string }>;
}) {
  const { modelId } = await searchParams;
  const models = await getModels();
  return <PurchaseForm models={models} presetModelId={modelId} />;
}
