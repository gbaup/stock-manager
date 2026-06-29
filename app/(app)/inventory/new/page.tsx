import { getTeams } from '@/app/lib/queries';
import { ModelForm } from '@/components/screens/model-form';

export default async function NewModelPage({
  searchParams,
}: {
  searchParams: Promise<{ fromPurchase?: string; prefillTeam?: string }>;
}) {
  const { fromPurchase, prefillTeam } = await searchParams;
  const teams = await getTeams();
  return <ModelForm teams={teams} prefillTeam={prefillTeam} fromPurchase={fromPurchase === '1'} />;
}
