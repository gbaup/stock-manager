import { getTeams } from '@/app/lib/queries';
import { ModelForm } from '@/components/screens/model-form';

export default async function NewModelPage() {
  const teams = await getTeams();
  return <ModelForm teams={teams} />;
}
