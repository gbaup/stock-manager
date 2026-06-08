'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, isPending] = useActionState(login, undefined);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-dot" />
          <span className="login-brand-name">StockControl</span>
        </div>

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" placeholder="admin@ejemplo.com" />
            {state?.errors?.email && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 4 }}>{state.errors.email}</p>}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required className="input" placeholder="••••••••" />
            {state?.errors?.password && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 4 }}>{state.errors.password}</p>}
          </div>

          {state?.message && (
            <p style={{ color: 'var(--danger)', fontSize: 13.5, textAlign: 'center' }}>{state.message}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
            style={{ marginTop: 4 }}
          >
            {isPending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
