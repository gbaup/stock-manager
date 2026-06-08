import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';
import LoginForm from './login-form';

export default async function LoginPage() {
  const userId = await getCurrentUserId();
  if (userId) redirect('/');

  return <LoginForm />;
}
