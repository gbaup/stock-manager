'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
    const [state, action, isPending] = useActionState(login, undefined);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
            <div className="bg-gray-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-800">
                <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Stock Manager
                </h1>
                <form action={action} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-300">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-600"
                            placeholder="admin@example.com"
                        />
                        {state?.errors?.email && (
                            <p className="text-red-500 text-sm mt-1">{state.errors.email}</p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-300">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-600"
                            placeholder="••••••••"
                        />
                        {state?.errors?.password && (
                            <p className="text-red-500 text-sm mt-1">{state.errors.password}</p>
                        )}
                    </div>

                    {state?.message && (
                        <p className="text-red-500 text-sm text-center">{state.message}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? 'Logging in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
