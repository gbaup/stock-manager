import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';
import LoginForm from './login-form';

async function AuthRedirect() {
  const userId = await getCurrentUserId();
  if (userId) redirect('/');
  return null;
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthRedirect />
      <LoginForm />
    </Suspense>
  );
}
